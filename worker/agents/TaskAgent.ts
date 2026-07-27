import { BaseAgent } from "./BaseAgent"
import { AgentRequest, AgentResponse, PlanningArtifact, ExecutionPackageV2 } from "../../core/interfaces/types"
import { ModelRouterImpl } from "../../core/router/ModelRouterImpl"
import fs from "fs"
import path from "path"

export class TaskAgent extends BaseAgent {
  private modelRouter: ModelRouterImpl

  constructor() {
    // Load system prompt from prompts/planning/v1/system.md
    const systemPromptPath = path.resolve(process.cwd(), "prompts/planning/v1/system.md")
    const systemPrompt = fs.existsSync(systemPromptPath) 
      ? fs.readFileSync(systemPromptPath, "utf-8")
      : "You are a Project Planning Engine AI."
    
    super("Planning", systemPrompt)
    this.modelRouter = new ModelRouterImpl()
  }

  async execute(req: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now()
    const { provider, model } = this.modelRouter.route(this.role)

    req.context.logger(`Executing Project Planning Engine using ${provider} / ${model}...`)

    // Load architecture.json (architect artifact)
    const datasetDir = path.resolve(process.cwd(), "dataset", req.projectId)
    const archJsonPath = path.join(datasetDir, "architecture/architecture.json")

    if (!fs.existsSync(archJsonPath)) {
      return {
        status: "failed",
        generatedArtifacts: [],
        logs: ["Planning Engine failed: Missing dependency artifact architecture/architecture.json"],
        metrics: { tokenCount: 0, durationMs: Date.now() - startTime }
      }
    }

    const archJsonContent = fs.readFileSync(archJsonPath, "utf-8")

    // Load user prompt template
    const userPromptPath = path.resolve(process.cwd(), "prompts/planning/v1/user.md")
    let userPrompt = fs.existsSync(userPromptPath)
      ? fs.readFileSync(userPromptPath, "utf-8")
      : "Please generate a structured backlog based on: ${architectureJson}"
    
    userPrompt = userPrompt.replace("${architectureJson}", archJsonContent)

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

      // Metadata versions
      const metadata = {
        artifactId: `planning-${req.projectId}`,
        version: 1,
        status: "Draft" as const,
        createdBy: this.role,
        createdAt: new Date().toISOString(),
        projectId: req.projectId,
        parentArtifactId: `architecture-${req.projectId}`,
        schemaVersion: "1.0"
      }

      const planningArtifact: PlanningArtifact = {
        metadata,
        plan: {
          epics: parsedData.epics || [],
          features: parsedData.features || [],
          stories: parsedData.stories || [],
          tasks: parsedData.tasks || [],
          criticalPath: parsedData.criticalPath || [],
          risks: parsedData.risks || [],
          metrics: parsedData.metrics || {
            estimatedDuration: 0,
            estimatedTokens: 0,
            estimatedCost: 0,
            parallelismScore: 0,
            criticalPathLength: 0,
            totalTasks: 0
          }
        }
      }

      // Create target domain directory: dataset/{projectId}/planning/
      const planningDir = path.join(datasetDir, "planning")
      if (!fs.existsSync(planningDir)) {
        fs.mkdirSync(planningDir, { recursive: true })
      }

      // Write domain-oriented backlog files
      fs.writeFileSync(path.join(planningDir, "epics.json"), JSON.stringify(planningArtifact.plan.epics, null, 2))
      fs.writeFileSync(path.join(planningDir, "features.json"), JSON.stringify(planningArtifact.plan.features, null, 2))
      fs.writeFileSync(path.join(planningDir, "stories.json"), JSON.stringify(planningArtifact.plan.stories, null, 2))
      fs.writeFileSync(path.join(planningDir, "tasks.json"), JSON.stringify(planningArtifact.plan.tasks, null, 2))
      fs.writeFileSync(path.join(planningDir, "dependencies.json"), JSON.stringify(parsedData.dependenciesGraph || [], null, 2))
      fs.writeFileSync(path.join(planningDir, "critical-path.json"), JSON.stringify(planningArtifact.plan.criticalPath, null, 2))
      fs.writeFileSync(path.join(planningDir, "sprints.json"), JSON.stringify(parsedData.sprints || [], null, 2))
      fs.writeFileSync(path.join(planningDir, "risks.json"), JSON.stringify(planningArtifact.plan.risks, null, 2))

      // Generate human-readable Markdown execution plan
      const projectPlanMd = `# Project Execution Plan & Backlog\n\n` +
        `## Backlog Metrics\n` +
        `* **Total Tasks:** ${planningArtifact.plan.metrics.totalTasks}\n` +
        `* **Critical Path Length:** ${planningArtifact.plan.metrics.criticalPathLength} tasks\n` +
        `* **Parallelism Score:** ${planningArtifact.plan.metrics.parallelismScore}\n` +
        `* **Estimated Duration:** ${planningArtifact.plan.metrics.estimatedDuration} hours\n` +
        `* **Estimated Cost:** $${planningArtifact.plan.metrics.estimatedCost}\n\n` +
        `## Epics Backlog\n` + planningArtifact.plan.epics.map(e => `* **${e.id}: ${e.name}** - ${e.description}`).join("\n") + `\n\n` +
        `## Tasks List & Execution Order\n` + planningArtifact.plan.tasks.map(t => 
          `### ${t.id}: ${t.title} [Order: ${t.executionOrder}]\n` +
          `* **Description:** ${t.description}\n` +
          `* **Status:** ${t.status}\n` +
          `* **Complexity:** ${t.complexity}\n` +
          `* **Reads:** ${t.reads.map(r => `\`${r}\``).join(", ")}\n` +
          `* **Writes:** ${t.writes.map(w => `\`${w}\``).join(", ")}\n` +
          `* **Acceptance Criteria:**\n` + t.acceptanceCriteria.map(a => `  - ${a}`).join("\n")
        ).join("\n\n")
      
      fs.writeFileSync(path.join(planningDir, "project-plan.md"), projectPlanMd)

      // Generate Execution Packages folder structure
      const packagesDir = path.join(planningDir, "execution-packages")
      if (!fs.existsSync(packagesDir)) {
        fs.mkdirSync(packagesDir, { recursive: true })
      }

      const parsedArch = JSON.parse(archJsonContent)

      for (const task of planningArtifact.plan.tasks) {
        const taskFolder = path.join(packagesDir, task.id)
        if (!fs.existsSync(taskFolder)) {
          fs.mkdirSync(taskFolder, { recursive: true })
        }

                const executionPackage: ExecutionPackageV2 = {
          schemaVersion: "2.0",
          projectId: req.projectId,
          taskId: task.id,
          packageVersion: 1,
          workspace: {
            expectedWorkspaceVersion: 0,
            readScopes: task.reads && task.reads.length > 0 ? task.reads : ["src/**"],
            writeScopes: task.writes && task.writes.length > 0 ? task.writes : ["src/**"],
            createScopes: task.writes && task.writes.length > 0 ? task.writes : ["src/**"],
            deleteScopes: task.deletes || [],
            protectedScopes: [".ai/**", "ProjectManifest.json", ".env*"]
          },
          permissions: {
            allowFileDiscovery: true,
            allowDependencyInstall: false,
            allowNetworkAccess: false,
            allowedCommands: ["npm run build", "npm test", "npm run lint"]
          },
          context: {
            architectureRefs: ["architecture/architecture.json"],
            artifactRefs: [],
            relevantFiles: task.reads || [],
            previousTasks: task.dependencies || [],
            decisions: []
          },
          execution: {
            modelProfile: task.requiredModels[0] || "developer-medium",
            maxRetries: 3,
            timeoutMs: 300000
          },
          acceptanceCriteria: task.acceptanceCriteria || [],
          outputs: {
            expectedArtifacts: task.writes || []
          }
        }

        // v1.json package
        fs.writeFileSync(path.join(taskFolder, "v1.json"), JSON.stringify(executionPackage, null, 2))

        // metadata.json
        const pkgMetadata = {
          packageId: `${task.id}-pkg-v1`,
          version: 1,
          status: "Draft",
          createdBy: this.role,
          createdAt: new Date().toISOString(),
          projectId: req.projectId
        }
        fs.writeFileSync(path.join(taskFolder, "metadata.json"), JSON.stringify(pkgMetadata, null, 2))

        // history.json
        fs.writeFileSync(path.join(taskFolder, "history.json"), JSON.stringify([], null, 2))
      }

      return {
        status: "success",
        generatedArtifacts: [
          "planning/epics.json",
          "planning/features.json",
          "planning/stories.json",
          "planning/tasks.json",
          "planning/dependencies.json",
          "planning/critical-path.json",
          "planning/sprints.json",
          "planning/risks.json",
          "planning/project-plan.md"
        ],
        logs: ["Project Planning Engine completed successfully."],
        metrics: {
          tokenCount: 0,
          durationMs: Date.now() - startTime
        },
        qualityScore: 92
      }

    } catch (err: any) {
      return {
        status: "failed",
        generatedArtifacts: [],
        logs: [`Project Planning Engine execution failed: ${err.message}`],
        metrics: {
          tokenCount: 0,
          durationMs: Date.now() - startTime
        }
      }
    }
  }
}
