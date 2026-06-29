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

import { ResearchAgent } from "./agents/ResearchAgent"
import { PlannerAgent } from "./agents/PlannerAgent"
import { ArchitectAgent } from "./agents/ArchitectAgent"
import { TaskAgent } from "./agents/TaskAgent"

import { updateTaskStatus } from "../src/lib/db"
import fs from "fs"
import path from "path"

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
    context.logger("Starting SaaS Builder AI v4 Orchestrator Pipeline...")
    this.publishEvent("workflow_started", { projectId, taskName, prompt })

    try {
      const agentRequest: AgentRequest = {
        id: `req-${projectId}`,
        projectId,
        workspaceId,
        taskId: projectId,
        goal: prompt,
        context
      }

      // ==========================================
      // 1. RESEARCH PHASE
      // ==========================================
      context.logger("Executing Research Agent...")
      updateTaskStatus(projectId, "processing", { report: "Executing Research Agent..." })

      const researchAgent = new ResearchAgent()
      let researchResponse: AgentResponse | null = null
      let researchRetries = 0
      const maxRetries = 3

      while (researchRetries < maxRetries) {
        researchResponse = await researchAgent.execute(agentRequest)
        this.publishEvent("agent_executed", { agent: "Research", status: researchResponse.status, retryCount: researchRetries })

        if (researchResponse.status === "failed") {
          researchRetries++
          context.logger(`Research attempt failed: ${researchResponse.logs.join(", ")}. Retrying...`, "warn")
          continue
        }

        const datasetDir = path.resolve(process.cwd(), "dataset", projectId)
        const researchJsonPath = path.join(datasetDir, "research.json")
        const researchJsonContent = fs.readFileSync(researchJsonPath, "utf-8")
        const parsedResearch = JSON.parse(researchJsonContent)

        const draftArtifact = await this.artifactService.saveArtifact(
          projectId, 
          "research", 
          researchJsonContent, 
          parsedResearch.metadata
        )

        await this.artifactService.updateArtifactStatus(projectId, "research", draftArtifact.version, "Evaluating")

        context.logger("Evaluating Research Artifact...")
        const evalResult = await this.evaluationService.evaluateArtifact(
          draftArtifact, 
          "The artifact must contain Executive Summary, Competitors Analysis, and Tech Recommendations. Minimum quality score must be greater than 85."
        )

        this.publishEvent("metrics_recorded", {
          agent: "Research",
          model: this.modelRouter.route("Research").model,
          provider: this.modelRouter.route("Research").provider,
          durationMs: researchResponse.metrics.durationMs,
          promptTokens: 0,
          completionTokens: 0,
          estimatedCost: 0,
          retryCount: researchRetries,
          qualityScore: evalResult.score
        })

        if (evalResult.score < 85) {
          researchRetries++
          context.logger(`Research Quality Check failed (Score: ${evalResult.score} < 85): ${evalResult.feedback}. Retrying...`, "warn")
          await this.artifactService.updateArtifactStatus(projectId, "research", draftArtifact.version, "Rejected")
          continue
        }

        context.logger(`Research Quality Check passed! Score: ${evalResult.score}`)
        await this.artifactService.updateArtifactStatus(projectId, "research", draftArtifact.version, "Approved")
        break
      }

      if (!researchResponse || researchResponse.status === "failed" || researchRetries >= maxRetries) {
        throw new Error("Research Phase failed to meet quality thresholds after maximum retries.")
      }

      // ==========================================
      // 2. PLANNING PHASE
      // ==========================================
      context.logger("Executing Planner Agent...")
      updateTaskStatus(projectId, "processing", { report: "Executing Planner Agent..." })

      const plannerAgent = new PlannerAgent()
      let plannerResponse: AgentResponse | null = null
      let plannerRetries = 0

      while (plannerRetries < maxRetries) {
        plannerResponse = await plannerAgent.execute(agentRequest)
        this.publishEvent("agent_executed", { agent: "Planner", status: plannerResponse.status, retryCount: plannerRetries })

        if (plannerResponse.status === "failed") {
          plannerRetries++
          context.logger(`Planner attempt failed: ${plannerResponse.logs.join(", ")}. Retrying...`, "warn")
          continue
        }

        const datasetDir = path.resolve(process.cwd(), "dataset", projectId)
        const projectJsonPath = path.join(datasetDir, "project.json")
        const projectJsonContent = fs.readFileSync(projectJsonPath, "utf-8")
        const parsedProject = JSON.parse(projectJsonContent)

        const draftArtifact = await this.artifactService.saveArtifact(
          projectId, 
          "planner", 
          projectJsonContent, 
          parsedProject.metadata
        )

        await this.artifactService.updateArtifactStatus(projectId, "planner", draftArtifact.version, "Evaluating")

        context.logger("Evaluating Planner Artifact...")
        const evalResult = await this.evaluationService.evaluateArtifact(
          draftArtifact, 
          "The artifact must contain functional requirements list, MVP scope detail, roadmap phases, and milestone definitions. Minimum quality score must be greater than 90."
        )

        this.publishEvent("metrics_recorded", {
          agent: "Planner",
          model: this.modelRouter.route("Planner").model,
          provider: this.modelRouter.route("Planner").provider,
          durationMs: plannerResponse.metrics.durationMs,
          promptTokens: 0,
          completionTokens: 0,
          estimatedCost: 0,
          retryCount: plannerRetries,
          qualityScore: evalResult.score
        })

        if (evalResult.score < 90) {
          plannerRetries++
          context.logger(`Planner Quality Check failed (Score: ${evalResult.score} < 90): ${evalResult.feedback}. Retrying...`, "warn")
          await this.artifactService.updateArtifactStatus(projectId, "planner", draftArtifact.version, "Rejected")
          continue
        }

        context.logger(`Planner Quality Check passed! Score: ${evalResult.score}`)
        await this.artifactService.updateArtifactStatus(projectId, "planner", draftArtifact.version, "Approved")
        break
      }

      if (!plannerResponse || plannerResponse.status === "failed" || plannerRetries >= maxRetries) {
        throw new Error("Planning Phase failed to meet quality thresholds after maximum retries.")
      }

      // ==========================================
      // 3. ARCHITECTURE DESIGN PHASE
      // ==========================================
      context.logger("Executing Architect Agent...")
      updateTaskStatus(projectId, "processing", { report: "Executing Architect Agent..." })

      const architectAgent = new ArchitectAgent()
      let archResponse: AgentResponse | null = null
      let archRetries = 0

      while (archRetries < maxRetries) {
        archResponse = await architectAgent.execute(agentRequest)
        this.publishEvent("agent_executed", { agent: "Architect", status: archResponse.status, retryCount: archRetries })

        if (archResponse.status === "failed") {
          archRetries++
          context.logger(`Architect attempt failed: ${archResponse.logs.join(", ")}. Retrying...`, "warn")
          continue
        }

        const datasetDir = path.resolve(process.cwd(), "dataset", projectId)
        const archJsonPath = path.join(datasetDir, "architecture/architecture.json")
        const archJsonContent = fs.readFileSync(archJsonPath, "utf-8")
        const parsedArch = JSON.parse(archJsonContent)

        const draftArtifact = await this.artifactService.saveArtifact(
          projectId, 
          "architecture", 
          archJsonContent, 
          parsedArch.metadata
        )

        await this.artifactService.updateArtifactStatus(projectId, "architecture", draftArtifact.version, "Evaluating")

        context.logger("Evaluating Architect Artifact...")
        const evalResult = await this.evaluationService.evaluateArtifact(
          draftArtifact, 
          "The artifact must contain folderTree definition, tables database schema design, and dependencyGraph connections list. Minimum quality score must be greater than 85."
        )

        this.publishEvent("metrics_recorded", {
          agent: "Architect",
          model: this.modelRouter.route("Architect").model,
          provider: this.modelRouter.route("Architect").provider,
          durationMs: archResponse.metrics.durationMs,
          promptTokens: 0,
          completionTokens: 0,
          estimatedCost: 0,
          retryCount: archRetries,
          qualityScore: evalResult.score
        })

        if (evalResult.score < 85) {
          archRetries++
          context.logger(`Architect Quality Check failed (Score: ${evalResult.score} < 85): ${evalResult.feedback}. Retrying...`, "warn")
          await this.artifactService.updateArtifactStatus(projectId, "architecture", draftArtifact.version, "Rejected")
          continue
        }

        context.logger(`Architect Quality Check passed! Score: ${evalResult.score}`)
        await this.artifactService.updateArtifactStatus(projectId, "architecture", draftArtifact.version, "Approved")
        break
      }

      if (!archResponse || archResponse.status === "failed" || archRetries >= maxRetries) {
        throw new Error("Architecture Phase failed to meet quality thresholds after maximum retries.")
      }

      // ==========================================
      // 4. PROJECT PLANNING ENGINE (TASK AI) PHASE
      // ==========================================
      context.logger("Executing Project Planning Engine (Task AI) Agent...")
      updateTaskStatus(projectId, "processing", { report: "Executing Planning Engine..." })

      const taskAgent = new TaskAgent()
      let taskResponse: AgentResponse | null = null
      let taskRetries = 0

      while (taskRetries < maxRetries) {
        taskResponse = await taskAgent.execute(agentRequest)
        this.publishEvent("agent_executed", { agent: "PlanningEngine", status: taskResponse.status, retryCount: taskRetries })

        if (taskResponse.status === "failed") {
          taskRetries++
          context.logger(`Planning Engine attempt failed: ${taskResponse.logs.join(", ")}. Retrying...`, "warn")
          continue
        }

        const datasetDir = path.resolve(process.cwd(), "dataset", projectId)
        const planningJsonPath = path.join(datasetDir, "planning/tasks.json")
        const planningJsonContent = fs.readFileSync(planningJsonPath, "utf-8")

        // Save raw planning output as metadata version artifact
        const draftArtifact = await this.artifactService.saveArtifact(
          projectId, 
          "planning", 
          planningJsonContent, 
          {
            artifactId: `planning-${projectId}`,
            version: 1,
            status: "Draft",
            createdBy: "PlanningEngine",
            createdAt: new Date().toISOString(),
            projectId,
            parentArtifactId: `architecture-${projectId}`,
            schemaVersion: "1.0"
          }
        )

        await this.artifactService.updateArtifactStatus(projectId, "planning", draftArtifact.version, "Evaluating")

        context.logger("Evaluating Project Backlog Artifact...")
        const evalResult = await this.evaluationService.evaluateArtifact(
          draftArtifact, 
          "The artifact must contain structured epics list, task execution orders, and dependency criteria. Minimum quality score must be greater than 85."
        )

        this.publishEvent("metrics_recorded", {
          agent: "PlanningEngine",
          model: this.modelRouter.route("Planning").model,
          provider: this.modelRouter.route("Planning").provider,
          durationMs: taskResponse.metrics.durationMs,
          promptTokens: 0,
          completionTokens: 0,
          estimatedCost: 0,
          retryCount: taskRetries,
          qualityScore: evalResult.score
        })

        if (evalResult.score < 85) {
          taskRetries++
          context.logger(`Planning Engine Quality Check failed (Score: ${evalResult.score} < 85): ${evalResult.feedback}. Retrying...`, "warn")
          await this.artifactService.updateArtifactStatus(projectId, "planning", draftArtifact.version, "Rejected")
          continue
        }

        context.logger(`Planning Engine Quality Check passed! Score: ${evalResult.score}`)
        await this.artifactService.updateArtifactStatus(projectId, "planning", draftArtifact.version, "Approved")
        break
      }

      if (!taskResponse || taskResponse.status === "failed" || taskRetries >= maxRetries) {
        throw new Error("Planning Engine Phase failed to meet quality thresholds after maximum retries.")
      }

      const totalDuration = Date.now() - startTime
      this.publishEvent("workflow_completed", { projectId, durationMs: totalDuration })

      return {
        status: "success",
        generatedArtifacts: [
          "research.json", 
          "project.json", 
          "architecture/architecture.json", 
          "planning/tasks.json",
          "planning/project-plan.md"
        ],
        logs: ["Orchestrator pipeline completed all quality checks successfully!"],
        metrics: {
          tokenCount: 0,
          durationMs: totalDuration
        }
      }

    } catch (err: any) {
      context.logger(`Workflow pipeline crashed: ${err.message}`, "error")
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
