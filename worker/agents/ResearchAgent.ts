import { BaseAgent } from "./BaseAgent"
import { AgentRequest, AgentResponse, ResearchArtifact } from "../../core/interfaces/types"
import { ModelRouterImpl } from "../../core/router/ModelRouterImpl"
import fs from "fs"
import path from "path"

export class ResearchAgent extends BaseAgent {
  private modelRouter: ModelRouterImpl

  constructor() {
    // Load system prompt from prompts/research/v1/system.md
    const systemPromptPath = path.resolve(process.cwd(), "prompts/research/v1/system.md")
    const systemPrompt = fs.existsSync(systemPromptPath) 
      ? fs.readFileSync(systemPromptPath, "utf-8")
      : "You are a Research AI."
    
    super("Research", systemPrompt)
    this.modelRouter = new ModelRouterImpl()
  }

  async execute(req: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now()
    const { provider, model } = this.modelRouter.route(this.role)

    req.context.logger(`Executing Research Agent using ${provider} / ${model}...`)

    // Load user prompt template
    const userPromptPath = path.resolve(process.cwd(), "prompts/research/v1/user.md")
    let userPrompt = fs.existsSync(userPromptPath)
      ? fs.readFileSync(userPromptPath, "utf-8")
      : "Please perform structured SaaS research for: ${goal}"
    
    userPrompt = userPrompt.replace("${goal}", req.goal)

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

      // Assert validity of JSON structure
      const parsedData = JSON.parse(cleanJson)

      // Structure metadata blocks
      const metadata = {
        artifactId: `research-${req.projectId}`,
        version: 1,
        status: "Draft" as const,
        createdBy: this.role,
        createdAt: new Date().toISOString(),
        projectId: req.projectId,
        parentArtifactId: null,
        schemaVersion: "1.0"
      }

      const researchArtifact: ResearchArtifact = {
        metadata,
        summary: parsedData.summary || "",
        marketOverview: parsedData.marketOverview || "",
        competitors: parsedData.competitors || [],
        technology: parsedData.technology || [],
        risks: parsedData.risks || [],
        opportunities: parsedData.opportunities || [],
        references: parsedData.references || [],
        confidenceScore: parsedData.confidenceScore || 0
      }

      // Write human readable Markdown files to the workspace path for dashboard display
      const datasetDir = path.resolve(process.cwd(), "dataset", req.projectId)
      if (!fs.existsSync(datasetDir)) {
        fs.mkdirSync(datasetDir, { recursive: true })
      }

      const researchMd = `# Executive Summary\n${researchArtifact.summary}\n\n# Market Overview\n${researchArtifact.marketOverview}`
      fs.writeFileSync(path.join(datasetDir, "research.md"), researchMd)

      const competitorsMd = `# Competitor Analysis\n` + researchArtifact.competitors.map(c => 
        `## ${c.name}\n**Strengths:**\n${c.strengths.map(s => `- ${s}`).join("\n")}\n**Weaknesses:**\n${c.weaknesses.map(w => `- ${w}`).join("\n")}`
      ).join("\n\n")
      fs.writeFileSync(path.join(datasetDir, "competitors.md"), competitorsMd)

      const techMd = `# Technology Recommendations\n` + researchArtifact.technology.map(t =>
        `## ${t.recommendation}\n**Confidence Score:** ${t.confidence}\n**Evidence:**\n${t.evidence.map(e => `- ${e}`).join("\n")}`
      ).join("\n\n")
      fs.writeFileSync(path.join(datasetDir, "technology.md"), techMd)

      const risksMd = `# Risks & Mitigations\n` + researchArtifact.risks.map(r =>
        `## ${r.description}\n**Impact:** ${r.impact}\n**Mitigation:** ${r.mitigation}`
      ).join("\n\n")
      fs.writeFileSync(path.join(datasetDir, "risks.md"), risksMd)

      // Save machine readable JSON artifact
      fs.writeFileSync(path.join(datasetDir, "research.json"), JSON.stringify(researchArtifact, null, 2))

      return {
        status: "success",
        generatedArtifacts: ["research.md", "competitors.md", "technology.md", "risks.md", "research.json"],
        logs: ["Research pipeline completed successfully."],
        metrics: {
          tokenCount: 0,
          durationMs: Date.now() - startTime
        },
        qualityScore: researchArtifact.confidenceScore
      }

    } catch (err: any) {
      return {
        status: "failed",
        generatedArtifacts: [],
        logs: [`Research Agent execution failed: ${err.message}`],
        metrics: {
          tokenCount: 0,
          durationMs: Date.now() - startTime
        }
      }
    }
  }
}
