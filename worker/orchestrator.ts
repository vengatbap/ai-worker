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

        // Save raw artifact draft in the Artifact Store
        const datasetDir = path.resolve(process.cwd(), "dataset", projectId)
        const researchJsonPath = path.join(datasetDir, "research.json")
        const researchJsonContent = fs.readFileSync(researchJsonPath, "utf-8")
        const parsedResearch = JSON.parse(researchJsonContent)

        // Convert metadata details to Artifact types
        const draftArtifact = await this.artifactService.saveArtifact(
          projectId, 
          "research", 
          researchJsonContent, 
          parsedResearch.metadata
        )

        // Update artifact status to Evaluating
        await this.artifactService.updateArtifactStatus(projectId, "research", draftArtifact.version, "Evaluating")

        // Run evaluation checks
        context.logger("Evaluating Research Artifact...")
        const evalResult = await this.evaluationService.evaluateArtifact(
          draftArtifact, 
          "The artifact must contain Executive Summary, Competitors Analysis, and Tech Recommendations. Minimum quality score must be greater than 85."
        )

        // Record metrics
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

        // Quality check passed
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

        // Save raw artifact draft in the Artifact Store
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

        // Update status to Evaluating
        await this.artifactService.updateArtifactStatus(projectId, "planner", draftArtifact.version, "Evaluating")

        // Run evaluation checks
        context.logger("Evaluating Planner Artifact...")
        const evalResult = await this.evaluationService.evaluateArtifact(
          draftArtifact, 
          "The artifact must contain functional requirements list, MVP scope detail, roadmap phases, and milestone definitions. Minimum quality score must be greater than 90."
        )

        // Record metrics
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

        // Quality check passed
        context.logger(`Planner Quality Check passed! Score: ${evalResult.score}`)
        await this.artifactService.updateArtifactStatus(projectId, "planner", draftArtifact.version, "Approved")
        break
      }

      if (!plannerResponse || plannerResponse.status === "failed" || plannerRetries >= maxRetries) {
        throw new Error("Planning Phase failed to meet quality thresholds after maximum retries.")
      }

      const totalDuration = Date.now() - startTime
      this.publishEvent("workflow_completed", { projectId, durationMs: totalDuration })

      return {
        status: "success",
        generatedArtifacts: ["research.json", "research.md", "project.json", "product-plan.md"],
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
