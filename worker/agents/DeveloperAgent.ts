import { BaseAgent } from "./BaseAgent"
import { AgentRequest, AgentResponse, ExecutionPackage } from "../../core/interfaces/types"
import { ModelRouterImpl } from "../../core/router/ModelRouterImpl"
import fs from "fs"
import path from "path"

export class DeveloperAgent extends BaseAgent {
  private modelRouter: ModelRouterImpl

  constructor() {
    // Load system prompt from prompts/developer/v1/system.md
    const systemPromptPath = path.resolve(process.cwd(), "prompts/developer/v1/system.md")
    const systemPrompt = fs.existsSync(systemPromptPath) 
      ? fs.readFileSync(systemPromptPath, "utf-8")
      : "You are a Developer AI."
    
    super("Developer", systemPrompt)
    this.modelRouter = new ModelRouterImpl()
  }

  async execute(req: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now()
    const { provider, model } = this.modelRouter.route(this.role)

    req.context.logger(`Executing Developer Agent using ${provider} / ${model}...`)

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
    const executionPackage = JSON.parse(packageJsonContent) as ExecutionPackage

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
        provider,
        model,
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
      // SAFETY GUARD: Enforce writes limits
      // ==========================================
      const allowedWrites = new Set(executionPackage.writes)
      const allowedReads = new Set(executionPackage.reads)

      for (const filepath of [...changePlan.create, ...changePlan.modify]) {
        if (!allowedWrites.has(filepath)) {
          req.context.logger(`Safety Guard Violation: Attempted unauthorized write to file ${filepath}`, "error")
          return {
            status: "failed",
            generatedArtifacts: [],
            logs: [`Security violation: Attempted write to unauthorized file ${filepath}`],
            metrics: { tokenCount: 0, durationMs: Date.now() - startTime }
          }
        }
      }

      // Execute code writes to the target workspace folder
      const workspaceDir = path.resolve(process.cwd(), "workspace", req.projectId)
      const generatedList: string[] = []

      for (const file of filesToWrite) {
        if (!allowedWrites.has(file.filepath)) {
          req.context.logger(`Safety Guard Violation: Attempted code write to unauthorized target ${file.filepath}`, "error")
          return {
            status: "failed",
            generatedArtifacts: [],
            logs: [`Security violation: Code payload contained unauthorized write target ${file.filepath}`],
            metrics: { tokenCount: 0, durationMs: Date.now() - startTime }
          }
        }

        const targetPath = path.join(workspaceDir, file.filepath)
        const parentDir = path.dirname(targetPath)
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true })
        }

        fs.writeFileSync(targetPath, file.content)
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
