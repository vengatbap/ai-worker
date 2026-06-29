import { BaseAgent } from "./BaseAgent"
import { AgentRequest, AgentResponse, ArchitectArtifact } from "../../core/interfaces/types"
import { ModelRouterImpl } from "../../core/router/ModelRouterImpl"
import fs from "fs"
import path from "path"

export class ArchitectAgent extends BaseAgent {
  private modelRouter: ModelRouterImpl

  constructor() {
    // Load system prompt from prompts/architect/v1/system.md
    const systemPromptPath = path.resolve(process.cwd(), "prompts/architect/v1/system.md")
    const systemPrompt = fs.existsSync(systemPromptPath) 
      ? fs.readFileSync(systemPromptPath, "utf-8")
      : "You are an Architect AI."
    
    super("Architect", systemPrompt)
    this.modelRouter = new ModelRouterImpl()
  }

  async execute(req: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now()
    const { provider, model } = this.modelRouter.route(this.role)

    req.context.logger(`Executing Architect Agent using ${provider} / ${model}...`)

    // Load project.json (planner artifact)
    const datasetDir = path.resolve(process.cwd(), "dataset", req.projectId)
    const plannerJsonPath = path.join(datasetDir, "project.json")

    if (!fs.existsSync(plannerJsonPath)) {
      return {
        status: "failed",
        generatedArtifacts: [],
        logs: ["Architect failed: Missing dependency artifact project.json"],
        metrics: { tokenCount: 0, durationMs: Date.now() - startTime }
      }
    }

    const plannerJsonContent = fs.readFileSync(plannerJsonPath, "utf-8")

    // Load user prompt template
    const userPromptPath = path.resolve(process.cwd(), "prompts/architect/v1/user.md")
    let userPrompt = fs.existsSync(userPromptPath)
      ? fs.readFileSync(userPromptPath, "utf-8")
      : "Please generate a structured architecture based on: ${projectJson}"
    
    userPrompt = userPrompt.replace("${projectJson}", plannerJsonContent)

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
        artifactId: `architecture-${req.projectId}`,
        version: 1,
        status: "Draft" as const,
        createdBy: this.role,
        createdAt: new Date().toISOString(),
        projectId: req.projectId,
        parentArtifactId: `planning-${req.projectId}`,
        schemaVersion: "1.0"
      }

      const architectArtifact: ArchitectArtifact = {
        metadata,
        systemArchitecture: parsedData.systemArchitecture || "",
        folderTree: parsedData.folderTree || {},
        databaseSchema: parsedData.databaseSchema || { tables: [] },
        apiSchema: parsedData.apiSchema || [],
        techStack: parsedData.techStack || [],
        securityArchitecture: parsedData.securityArchitecture || "",
        deploymentArchitecture: parsedData.deploymentArchitecture || "",
        integrations: parsedData.integrations || [],
        codingStandards: parsedData.codingStandards || [],
        constraints: parsedData.constraints || [],
        assumptions: parsedData.assumptions || [],
        risks: parsedData.risks || [],
        dependencyGraph: parsedData.dependencyGraph || [],
        erdMermaid: parsedData.erdMermaid || "",
        openapiYaml: parsedData.openapiYaml || "",
        architectureYaml: parsedData.architectureYaml || "",
        adrs: parsedData.adrs || []
      }

      // Create target domain directory: dataset/{projectId}/architecture/
      const archDir = path.join(datasetDir, "architecture")
      if (!fs.existsSync(archDir)) {
        fs.mkdirSync(archDir, { recursive: true })
      }

      // 1. Consolidated JSON
      fs.writeFileSync(path.join(archDir, "architecture.json"), JSON.stringify(architectArtifact, null, 2))

      // 2. Database schemas JSON
      fs.writeFileSync(path.join(archDir, "database.json"), JSON.stringify(architectArtifact.databaseSchema, null, 2))

      // 3. API specification openapi.yaml
      fs.writeFileSync(path.join(archDir, "openapi.yaml"), architectArtifact.openapiYaml)

      // 4. Folder structure tree JSON
      fs.writeFileSync(path.join(archDir, "folder-tree.json"), JSON.stringify(architectArtifact.folderTree, null, 2))

      // 5. Dependency Graph JSON
      fs.writeFileSync(path.join(archDir, "dependency-graph.json"), JSON.stringify(architectArtifact.dependencyGraph, null, 2))

      // 6. ERD Mermaid code
      fs.writeFileSync(path.join(archDir, "erd.mmd"), architectArtifact.erdMermaid)

      // 7. SaaS Manifest Yaml
      fs.writeFileSync(path.join(archDir, "architecture.yaml"), architectArtifact.architectureYaml)

      // 8. ADR Markdown documents
      const adrDir = path.join(archDir, "adr")
      if (!fs.existsSync(adrDir)) {
        fs.mkdirSync(adrDir, { recursive: true })
      }
      for (const adr of architectArtifact.adrs) {
        const adrMd = `# ${adr.title}\n\n**Status:** ${adr.status}\n\n## Context\n${adr.context}\n\n## Decision\n${adr.decision}`
        fs.writeFileSync(path.join(adrDir, adr.filename), adrMd)
      }

      // 9. Human readable architecture summary Markdown
      const archSummaryMd = `# System Architecture Overview\n${architectArtifact.systemArchitecture}\n\n` +
        `## Tech Stack\n${architectArtifact.techStack.map(t => `- ${t}`).join("\n")}\n\n` +
        `## Security Architecture\n${architectArtifact.securityArchitecture}\n\n` +
        `## Deployment Architecture\n${architectArtifact.deploymentArchitecture}`
      fs.writeFileSync(path.join(archDir, "architecture.md"), archSummaryMd)

      return {
        status: "success",
        generatedArtifacts: [
          "architecture/architecture.json",
          "architecture/database.json",
          "architecture/openapi.yaml",
          "architecture/folder-tree.json",
          "architecture/dependency-graph.json",
          "architecture/erd.mmd",
          "architecture/architecture.yaml",
          "architecture/architecture.md"
        ],
        logs: ["Architect pipeline completed successfully."],
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
        logs: [`Architect Agent execution failed: ${err.message}`],
        metrics: {
          tokenCount: 0,
          durationMs: Date.now() - startTime
        }
      }
    }
  }
}
