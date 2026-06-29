import { BaseAgent } from "./BaseAgent"
import { AgentRequest, AgentResponse, ReleaseReport, DeploymentArtifact } from "../../core/interfaces/types"
import { ModelRouterImpl } from "../../core/router/ModelRouterImpl"
import fs from "fs"
import path from "path"

export class DeploymentAgent extends BaseAgent {
  private modelRouter: ModelRouterImpl

  constructor() {
    // Load system prompt from prompts/deployment/v1/system.md
    const systemPromptPath = path.resolve(process.cwd(), "prompts/deployment/v1/system.md")
    const systemPrompt = fs.existsSync(systemPromptPath) 
      ? fs.readFileSync(systemPromptPath, "utf-8")
      : "You are a senior Deployment AI."
    
    super("Deployment", systemPrompt)
    this.modelRouter = new ModelRouterImpl()
  }

  async execute(req: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now()
    const { provider, model } = this.modelRouter.route("QA") // Reuses QA profile router

    req.context.logger(`Executing Deployment AI using ${provider} / ${model}...`)

    const datasetDir = path.resolve(process.cwd(), "dataset", req.projectId)
    
    // Load ProjectManifest
    const manifestPath = path.join(datasetDir, "ProjectManifest.json")
    const projectManifest = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, "utf-8") : "{}"

    // Formulate User prompt template
    const userPromptPath = path.resolve(process.cwd(), "prompts/deployment/v1/user.md")
    let userPrompt = fs.existsSync(userPromptPath)
      ? fs.readFileSync(userPromptPath, "utf-8")
      : "Please generate deployment configurations based on project manifest: ${projectManifest}"
    
    userPrompt = userPrompt.replace("${projectManifest}", projectManifest)

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
      
      const releaseReport: ReleaseReport = {
        deployment: parsedData.deployment || { status: "failed", imageTag: "" },
        verification: parsedData.verification || { healthCheckPassed: false, smokeTestsPassed: false },
        health: parsedData.health || { score: 0, status: "unknown" },
        rollback: parsedData.rollback || { rollbackVersion: "", rollbackSteps: [] },
        metrics: parsedData.metrics || {
          buildTimeMs: 0,
          deploymentTimeMs: 0,
          rollbackTimeMs: 0,
          startupTimeMs: 0,
          imageSizeMb: 0,
          cpuEstimate: "",
          memoryEstimate: "",
          healthScore: 0
        },
        releaseNotes: parsedData.releaseNotes || "",
        status: parsedData.status || "Failed"
      }

      const deployArtifact: DeploymentArtifact = {
        metadata: {
          artifactId: `deploy-${req.projectId}`,
          version: 1,
          status: "Draft",
          createdBy: this.role,
          createdAt: new Date().toISOString(),
          projectId: req.projectId,
          parentArtifactId: `docs-${req.projectId}`,
          schemaVersion: "1.0"
        },
        report: releaseReport
      }

      // Create target directory: dataset/{projectId}/deployment/
      const deployDir = path.join(datasetDir, "deployment")
      if (!fs.existsSync(deployDir)) {
        fs.mkdirSync(deployDir, { recursive: true })
      }

      // Write individual generated deployment blueprints
      const deployFiles = parsedData.deploymentFiles || {}
      for (const [filename, content] of Object.entries(deployFiles)) {
        fs.writeFileSync(path.join(deployDir, filename), content as string)
        req.context.logger(`Published deployment blueprint: ${filename}`)
      }

      // Write report details
      fs.writeFileSync(path.join(deployDir, "deployment-report.json"), JSON.stringify(releaseReport, null, 2))

      // Generate human-readable summary Markdown
      const deploySummaryMd = `# Packaging & Delivery Release Summary\n\n` +
        `## Release Details\n` +
        `* **Release Status:** **${releaseReport.status}**\n` +
        `* **Docker Image Tag:** \`${releaseReport.deployment.imageTag}\`\n` +
        `* **Health Status:** ${releaseReport.health.status} (Score: ${releaseReport.health.score}/100)\n\n` +
        `## Verification Summary\n` +
        `* **Health Check Endpoint:** ${releaseReport.verification.healthCheckPassed ? "✅ Passed" : "❌ Failed"}\n` +
        `* **Smoke Tests Suite:** ${releaseReport.verification.smokeTestsPassed ? "✅ Passed" : "❌ Failed"}\n\n` +
        `## Rollback Plan (${releaseReport.rollback.rollbackVersion})\n` +
        releaseReport.rollback.rollbackSteps.map(s => `- \`${s}\``).join("\n") + `\n\n` +
        `## Release Notes\n` + releaseReport.releaseNotes

      fs.writeFileSync(path.join(deployDir, "deployment-summary.md"), deploySummaryMd)

      // Write deploy history logs
      const historyDir = path.join(deployDir, "history")
      if (!fs.existsSync(historyDir)) {
        fs.mkdirSync(historyDir, { recursive: true })
      }
      const historyCount = fs.readdirSync(historyDir).length + 1
      const historyFilename = `deploy-${String(historyCount).padStart(3, "0")}.json`
      fs.writeFileSync(path.join(historyDir, historyFilename), JSON.stringify(deployArtifact, null, 2))

      return {
        status: "success",
        generatedArtifacts: [
          "deployment/deployment-report.json",
          "deployment/deployment-summary.md"
        ],
        logs: ["Deployment AI completed successfully."],
        metrics: {
          tokenCount: 0,
          durationMs: Date.now() - startTime
        },
        qualityScore: releaseReport.health.score
      }

    } catch (err: any) {
      return {
        status: "failed",
        generatedArtifacts: [],
        logs: [`Deployment Agent execution failed: ${err.message}`],
        metrics: {
          tokenCount: 0,
          durationMs: Date.now() - startTime
        }
      }
    }
  }
}
