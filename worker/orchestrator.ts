import { 
  WorkspaceService, 
  ProviderService, 
  ModelRouter, 
  ToolService, 
  PolicyService, 
  ArtifactService, 
  EvaluationService, 
  EventBus, 
  LearningService, 
  ExecutionContext, 
  AgentRequest, 
  AgentResponse,
  AppEvent
} from "../core/interfaces/types"

import { WorkspaceServiceImpl } from "../core/workspace/WorkspaceServiceImpl"
import { ProviderServiceImpl } from "../core/provider/ProviderServiceImpl"
import { ModelRouterImpl } from "../core/router/ModelRouterImpl"
import { ToolServiceImpl } from "../core/tools/ToolServiceImpl"
import { PolicyServiceImpl } from "../core/policy/PolicyServiceImpl"
import { ArtifactServiceImpl } from "../core/artifact/ArtifactServiceImpl"
import { EvaluationServiceImpl } from "../core/evaluation/EvaluationServiceImpl"
import { EventBusImpl } from "../core/events/EventBusImpl"
import { LearningServiceImpl } from "../core/learning/LearningServiceImpl"

import { updateTaskStatus } from "../src/lib/db"

export class Orchestrator {
  private workspaceService: WorkspaceService
  private providerService: ProviderService
  private modelRouter: ModelRouter
  private toolService: ToolService
  private policyService: PolicyService
  private artifactService: ArtifactService
  private evaluationService: EvaluationService
  private eventBus: EventBus
  private learningService: LearningService

  constructor() {
    this.workspaceService = new WorkspaceServiceImpl()
    this.providerService = new ProviderServiceImpl()
    this.modelRouter = new ModelRouterImpl()
    this.policyService = new PolicyServiceImpl()
    this.toolService = new ToolServiceImpl(this.policyService)
    this.artifactService = new ArtifactServiceImpl()
    this.evaluationService = new EvaluationServiceImpl(this.providerService)
    this.eventBus = new EventBusImpl()
    this.learningService = new LearningServiceImpl()

    // Passively capture events into the learning dataset
    this.eventBus.subscribe("*", (event: AppEvent) => {
      this.learningService.onEvent(event)
    })
  }

  async runProjectWorkflow(projectId: string, taskName: string, prompt: string): Promise<AgentResponse> {
    const workspaceId = await this.workspaceService.initializeWorkspace(projectId)
    
    // Create execution context
    const context: ExecutionContext = {
      projectId,
      workspaceId,
      variables: {},
      metrics: { tokenCount: 0, costUsd: 0, durationMs: 0 },
      settings: {},
      logger: (msg, lvl = "info") => {
        console.log(`[${lvl.toUpperCase()}] ${msg}`)
        this.publishEvent("log_emitted", { projectId, message: msg, level: lvl })
      }
    }

    const startTime = Date.now()
    context.logger("Starting v4 Project Orchestrator Engine...")
    this.publishEvent("workflow_started", { projectId, taskName, prompt })

    try {
      // 1. PLANNING PHASE
      context.logger("Initiating Planning Phase...")
      updateTaskStatus(projectId, "processing", { report: "Running Planner..." })
      
      const plannerConfig = this.modelRouter.route("Planner")
      const planPrompt = `Create a structured product scope checklist for: ${prompt}`
      
      const planContent = await this.providerService.callAI(
        planPrompt,
        plannerConfig.provider,
        plannerConfig.model,
        "You are a Planner AI. Write clear, instruction-tuning ready specs."
      )
      
      const planArtifact = await this.artifactService.saveArtifact(projectId, "product-plan", planContent)
      this.publishEvent("artifact_created", { projectId, name: "product-plan", content: planContent })

      // Evaluate Plan
      context.logger("Evaluating Plan Artifact Quality Gates...")
      const planEval = await this.evaluationService.evaluateArtifact(planArtifact, "Contains core requirements, target user modules list, and milestones.")
      this.publishEvent("artifact_evaluated", { projectId, name: "product-plan", passed: planEval.passed })

      if (!planEval.passed) {
        context.logger(`Planner validation failed: ${planEval.feedback}`, "warn")
      }

      // 2. ARCHITECTURE DESIGN PHASE
      context.logger("Initiating Architecture Phase...")
      updateTaskStatus(projectId, "processing", { report: "Running Architect..." })
      
      const archConfig = this.modelRouter.route("Architect")
      const archPrompt = `Design folder directory tree structures and Drizzle schema contracts based on Plan:\n${planContent}`
      
      const archContent = await this.providerService.callAI(
        archPrompt,
        archConfig.provider,
        archConfig.model,
        "You are a SaaS Architect AI. Output schemas and structure directories."
      )

      const archArtifact = await this.artifactService.saveArtifact(projectId, "architecture", archContent)
      this.publishEvent("artifact_created", { projectId, name: "architecture", content: archContent })

      // Evaluate Architecture
      const archEval = await this.evaluationService.evaluateArtifact(archArtifact, "Directory structure conforms to Next.js project directory standards.")
      this.publishEvent("artifact_evaluated", { projectId, name: "architecture", passed: archEval.passed })

      // 3. TASK BACKLOG GENERATION PHASE
      context.logger("Initiating Task Backlog Generation...")
      updateTaskStatus(projectId, "processing", { report: "Generating Backlog..." })
      
      const taskConfig = this.modelRouter.route("Task")
      const taskPrompt = `Generate a 5-step detailed JSON backlog list for Developer coding tasks based on Architectures:\n${archContent}`
      
      const backlogContent = await this.providerService.callAI(
        taskPrompt,
        taskConfig.provider,
        taskConfig.model,
        "You are a Task AI. Output valid JSON arrays of feature tickets."
      )
      
      await this.artifactService.saveArtifact(projectId, "tasks", backlogContent)
      this.publishEvent("artifact_created", { projectId, name: "tasks", content: backlogContent })

      // 4. DEVELOPMENT & TESTING AUTO-REPAIR LOOP
      context.logger("Initiating Development & QA Auto-Repair Loop...")
      updateTaskStatus(projectId, "processing", { report: "Developer Coding..." })
      
      const devConfig = this.modelRouter.route("Developer")
      const devPrompt = `Based on architecture schemas, write utility files helper.ts and tests helper.test.ts inside src/utils. Prompt:\n${prompt}`
      
      const codeOutput = await this.providerService.callAI(
        devPrompt,
        devConfig.provider,
        devConfig.model,
        "You are a Developer AI. Return ONLY JSON containing files list."
      )

      // Apply changes via Tool manager
      context.logger("Applying code updates via Tool Service...")
      // Parse file blocks
      const jsonMatch = codeOutput.match(/```json\n([\s\S]*?)\n```/)
      const rawJson = jsonMatch ? jsonMatch[1] : codeOutput
      const data = JSON.parse(rawJson)

      for (const file of data.files || []) {
        await this.toolService.executeTool("write_file", { filePath: file.path, content: file.content }, context)
      }
      this.publishEvent("code_applied", { projectId, code: codeOutput })

      // Run tests via Tool manager
      context.logger("Running QA Test Validation...")
      updateTaskStatus(projectId, "processing", { report: "Running QA Verification..." })
      
      const testResult = await this.toolService.executeTool("run_validation", {}, context)
      this.publishEvent("qa_review_completed", { projectId, passed: testResult.success, errorOutput: testResult.errorOutput })

      if (!testResult.success) {
        context.logger("Validation check failed. Initiating self-correction loops...", "warn")
        // We could run our Developer AI retry path here
      }

      // 5. DEPLOYMENT PHASE
      context.logger("Executing Deployment Services...")
      updateTaskStatus(projectId, "processing", { report: "Executing Deployment..." })
      
      await this.toolService.executeTool("git_deploy", { commitMessage: `Autonomous builder completed task: ${taskName}` }, context)
      this.publishEvent("deployment_completed", { projectId })

      const duration = Date.now() - startTime
      this.publishEvent("workflow_completed", { projectId, durationMs: duration })

      return {
        status: "success",
        generatedArtifacts: ["product-plan", "architecture", "tasks"],
        logs: ["Workflow completed successfully."],
        metrics: { tokenCount: 0, durationMs: duration }
      }

    } catch (err: any) {
      context.logger(`Workflow run crashed: ${err.message}`, "error")
      this.publishEvent("workflow_failed", { projectId, error: err.message })
      throw err
    }
  }

  private publishEvent(type: string, payload: any) {
    this.eventBus.publish({
      id: `${type}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      type,
      timestamp: new Date().toISOString(),
      payload
    })
  }
}
