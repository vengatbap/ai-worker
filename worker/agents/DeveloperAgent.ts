import { BaseAgent } from "./BaseAgent"
import { AgentRequest, AgentResponse, ExecutionPackageV2 } from "../../core/interfaces/types"
import { ScopeMatcher } from "../../core/policy/ScopeMatcher"
import { ScopePolicyEngine } from "../../core/policy/ScopePolicyEngine"
import { WorkspaceServiceImpl } from "../../core/workspace/WorkspaceServiceImpl"
import fs from "fs"
import path from "path"

export class DeveloperAgent extends BaseAgent {

  constructor() {
    // Load system prompt from prompts/developer/v1/system.md
    const systemPromptPath = path.resolve(process.cwd(), "prompts/developer/v1/system.md")
    const systemPrompt = fs.existsSync(systemPromptPath) 
      ? fs.readFileSync(systemPromptPath, "utf-8")
      : "You are a Developer AI."
    
    super("Developer", systemPrompt)
  }

  async execute(req: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now()

    req.context.logger(`Executing Developer Agent (routing handled by ProviderService)...`)

    // Load target task execution package
    // Task agent wrote v1.json under: dataset/{projectId}/planning/execution-packages/{taskId}/v1.json
    const datasetDir = path.resolve(process.cwd(), "dataset", req.projectId)
    const taskPkgPath = path.join(datasetDir, `planning/execution-packages/${req.taskId}/v1.json`)

    if (!fs.existsSync(taskPkgPath)) {
      return {
        status: "failed",
        generatedArtifacts: [],
        logs: [`Developer failed: Missing task execution package at ${taskPkgPath}`],
        metrics: { tokenCount: 0, durationMs: Date.now() - startTime }
      }
    }

    const packageJsonContent = fs.readFileSync(taskPkgPath, "utf-8")
    const executionPackage = JSON.parse(packageJsonContent) as ExecutionPackageV2

    // Verify Workspace version safety (Stale checks)
    const wsService = new WorkspaceServiceImpl()
    const currentStatus = await wsService.getWorkspaceStatus(req.projectId)
    if (currentStatus.currentVersion !== executionPackage.workspace.expectedWorkspaceVersion) {
      req.context.logger(`Workspace version mismatch: expected ${executionPackage.workspace.expectedWorkspaceVersion}, found ${currentStatus.currentVersion}`, "error")
      return {
        status: "failed",
        generatedArtifacts: [],
        logs: [`STALE_WORKSPACE_VERSION: Expected version ${executionPackage.workspace.expectedWorkspaceVersion} but found version ${currentStatus.currentVersion}`],
        metrics: { tokenCount: 0, durationMs: Date.now() - startTime }
      }
    }

    // Formulate User prompt template
    const userPromptPath = path.resolve(process.cwd(), "prompts/developer/v1/user.md")
    let userPrompt = fs.existsSync(userPromptPath)
      ? fs.readFileSync(userPromptPath, "utf-8")
      : "You are executing this task: ${executionPackage}"
    
    // Inject package context
    userPrompt = userPrompt.replace("${executionPackage}", JSON.stringify(executionPackage, null, 2))
    
    // Check if feedback logs are supplied via request context variables (e.g. compile errors for retry run)
    const feedback = req.context.variables.feedbackLogs || ""
    userPrompt = userPrompt.replace("${feedbackLogs}", feedback)

    try {
      const response = await this.providerService.callAI(
        userPrompt,
        this.role,
        req.taskId,
        this.systemPrompt
      )

      let cleanJson = response.trim()
      const jsonMatch = cleanJson.match(/```json\n([\s\S]*?)\n```/)
      if (jsonMatch) {
        cleanJson = jsonMatch[1]
      }

      const parsedData = JSON.parse(cleanJson)
      const changePlan = parsedData.changePlan || { create: [], modify: [], delete: [] }
      const filesToWrite = parsedData.files || []

      req.context.logger(`Developer Agent formulated change plan: ${JSON.stringify(changePlan)}`)

      // ==========================================
      // SAFETY GUARD: Enforce writes/creates/deletes limits strictly using ScopeMatcher
      // ==========================================
      for (const filepath of changePlan.create) {
        if (!ScopeMatcher.isCreateAllowed(req.projectId, filepath, executionPackage)) {
          req.context.logger(`Scope mismatch: File creation outside scope detected: ${filepath}. Querying policy engine...`)
          
          const capabilityRequest = {
            requestId: `req-expand-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            projectId: req.projectId,
            taskId: req.taskId,
            packageVersion: executionPackage.packageVersion,
            workspaceVersion: currentStatus.currentVersion,
            operation: "CREATE" as const,
            resource: filepath,
            reason: "Developer AI needs to create helper component/file for task resolution.",
            requestedAt: new Date().toISOString()
          }

          const decision = await ScopePolicyEngine.evaluateRequest(capabilityRequest, executionPackage)
          if (decision.decision === "AUTO_APPROVED") {
            req.context.logger(`Policy Engine AUTO_APPROVED scope expansion for CREATE ${filepath} (Version revised to v${decision.packageVersion})`)
            // Reload package
            const taskPkgPath = path.join(datasetDir, `planning/execution-packages/${req.taskId}/v1.json`)
            Object.assign(executionPackage, JSON.parse(fs.readFileSync(taskPkgPath, "utf-8")))
          } else {
            req.context.logger(`Policy Engine rejected scope expansion for CREATE ${filepath} (Decision: ${decision.decision}, Reason: ${decision.reasonCode})`, "error")
            return {
              status: "failed",
              generatedArtifacts: [],
              logs: [`CAPABILITY_DENIED: operation: CREATE, path: ${filepath}, reason: ${decision.reasonCode}`],
              metrics: { tokenCount: 0, durationMs: Date.now() - startTime }
            }
          }
        }
      }

      for (const filepath of changePlan.modify) {
        if (!ScopeMatcher.isWriteAllowed(req.projectId, filepath, executionPackage)) {
          req.context.logger(`Scope mismatch: File modification outside scope detected: ${filepath}. Querying policy engine...`)
          
          const capabilityRequest = {
            requestId: `req-expand-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            projectId: req.projectId,
            taskId: req.taskId,
            packageVersion: executionPackage.packageVersion,
            workspaceVersion: currentStatus.currentVersion,
            operation: "MODIFY" as const,
            resource: filepath,
            reason: "Developer AI needs to modify file for task resolution.",
            requestedAt: new Date().toISOString()
          }

          const decision = await ScopePolicyEngine.evaluateRequest(capabilityRequest, executionPackage)
          if (decision.decision === "AUTO_APPROVED") {
            req.context.logger(`Policy Engine AUTO_APPROVED scope expansion for MODIFY ${filepath} (Version revised to v${decision.packageVersion})`)
            // Reload package
            const taskPkgPath = path.join(datasetDir, `planning/execution-packages/${req.taskId}/v1.json`)
            Object.assign(executionPackage, JSON.parse(fs.readFileSync(taskPkgPath, "utf-8")))
          } else {
            req.context.logger(`Policy Engine rejected scope expansion for MODIFY ${filepath} (Decision: ${decision.decision}, Reason: ${decision.reasonCode})`, "error")
            return {
              status: "failed",
              generatedArtifacts: [],
              logs: [`CAPABILITY_DENIED: operation: MODIFY, path: ${filepath}, reason: ${decision.reasonCode}`],
              metrics: { tokenCount: 0, durationMs: Date.now() - startTime }
            }
          }
        }
      }

      for (const filepath of changePlan.delete) {
        if (!ScopeMatcher.isDeleteAllowed(req.projectId, filepath, executionPackage)) {
          req.context.logger(`Scope mismatch: File deletion outside scope detected: ${filepath}. Querying policy engine...`)
          
          const capabilityRequest = {
            requestId: `req-expand-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            projectId: req.projectId,
            taskId: req.taskId,
            packageVersion: executionPackage.packageVersion,
            workspaceVersion: currentStatus.currentVersion,
            operation: "DELETE" as const,
            resource: filepath,
            reason: "Developer AI needs to delete file.",
            requestedAt: new Date().toISOString()
          }

          const decision = await ScopePolicyEngine.evaluateRequest(capabilityRequest, executionPackage)
          if (decision.decision === "AUTO_APPROVED") {
            req.context.logger(`Policy Engine AUTO_APPROVED scope expansion for DELETE ${filepath} (Version revised to v${decision.packageVersion})`)
            // Reload package
            const taskPkgPath = path.join(datasetDir, `planning/execution-packages/${req.taskId}/v1.json`)
            Object.assign(executionPackage, JSON.parse(fs.readFileSync(taskPkgPath, "utf-8")))
          } else {
            req.context.logger(`Policy Engine rejected scope expansion for DELETE ${filepath} (Decision: ${decision.decision}, Reason: ${decision.reasonCode})`, "error")
            return {
              status: "failed",
              generatedArtifacts: [],
              logs: [`CAPABILITY_DENIED: operation: DELETE, path: ${filepath}, reason: ${decision.reasonCode}`],
              metrics: { tokenCount: 0, durationMs: Date.now() - startTime }
            }
          }
        }
      }

      // Execute code writes to the target workspace repository folder
      const workspaceDir = path.resolve(process.cwd(), "workspace", req.projectId, "repository")
      const generatedList: string[] = []

      for (const file of filesToWrite) {
        // Double-check writes boundaries
        if (!ScopeMatcher.isWriteAllowed(req.projectId, file.filepath, executionPackage) && !ScopeMatcher.isCreateAllowed(req.projectId, file.filepath, executionPackage)) {
          req.context.logger(`Safety Guard Violation: Attempted code write to unauthorized target ${file.filepath}`, "error")
          return {
            status: "failed",
            generatedArtifacts: [],
            logs: [`CAPABILITY_DENIED: operation: WRITE, path: ${file.filepath}, reason: OUTSIDE_WRITE_SCOPE`],
            metrics: { tokenCount: 0, durationMs: Date.now() - startTime }
          }
        }

        const targetPath = path.join(workspaceDir, file.filepath)
        const parentDir = path.dirname(targetPath)
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true })
        }

        const contentToWrite = typeof file.content === "object" ? JSON.stringify(file.content, null, 2) : file.content;
        fs.writeFileSync(targetPath, contentToWrite)
        generatedList.push(file.filepath)
        req.context.logger(`Wrote generated code to workspace target file: ${file.filepath}`)
      }

      return {
        status: "success",
        generatedArtifacts: generatedList,
        logs: ["Developer Agent completed code writes successfully."],
        metrics: {
          tokenCount: 0,
          durationMs: Date.now() - startTime
        },
        qualityScore: 90
      }

    } catch (err: any) {
      return {
        status: "failed",
        generatedArtifacts: [],
        logs: [`Developer Agent execution failed: ${err.message}`],
        metrics: {
          tokenCount: 0,
          durationMs: Date.now() - startTime
        }
      }
    }
  }
}

