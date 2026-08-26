import { BaseAgent } from "./BaseAgent"
import { AgentRequest, AgentResponse, DocumentationReport, DocumentationArtifact } from "../../core/interfaces/types"
import fs from "fs"
import path from "path"

export class DocAgent extends BaseAgent {

  constructor() {
    // Load system prompt from prompts/documentation/v1/system.md
    const systemPromptPath = path.resolve(process.cwd(), "prompts/documentation/v1/system.md")
    const systemPrompt = fs.existsSync(systemPromptPath) 
      ? fs.readFileSync(systemPromptPath, "utf-8")
      : "You are a senior Knowledge Publishing Engine AI."
    
    super("Documentation", systemPrompt)
  }

  async execute(req: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now()

    req.context.logger(`Executing Documentation AI (routing handled by ProviderService)...`)

    const datasetDir = path.resolve(process.cwd(), "dataset", req.projectId)
    
    // Load prerequisites
    const archJsonPath = path.join(datasetDir, "architecture/architecture.json")
    const openapiYamlPath = path.join(datasetDir, "architecture/openapi.yaml")
    const projectPlanPath = path.join(datasetDir, "planning/project-plan.md")
    const reviewReportPath = path.join(datasetDir, "review/review-report.json")

    const archJson = fs.existsSync(archJsonPath) ? fs.readFileSync(archJsonPath, "utf-8") : "{}"
    const openapiYaml = fs.existsSync(openapiYamlPath) ? fs.readFileSync(openapiYamlPath, "utf-8") : ""
    const projectPlan = fs.existsSync(projectPlanPath) ? fs.readFileSync(projectPlanPath, "utf-8") : ""
    const reviewReport = fs.existsSync(reviewReportPath) ? fs.readFileSync(reviewReportPath, "utf-8") : "{}"

    // Formulate User prompt template
    const userPromptPath = path.resolve(process.cwd(), "prompts/documentation/v1/user.md")
    let userPrompt = fs.existsSync(userPromptPath)
      ? fs.readFileSync(userPromptPath, "utf-8")
      : "Please compile documentation based on: ${architectureJson}, ${openapiYaml}, ${projectPlan}, ${reviewReport}"
    
    userPrompt = userPrompt.replace("${architectureJson}", archJson)
    userPrompt = userPrompt.replace("${openapiYaml}", openapiYaml)
    userPrompt = userPrompt.replace("${projectPlan}", projectPlan)
    userPrompt = userPrompt.replace("${reviewReport}", reviewReport)

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
      
      const docReport: DocumentationReport = {
        projectDocs: parsedData.projectDocs || { README: false, ARCHITECTURE: false, CHANGELOG: false },
        developerDocs: parsedData.developerDocs || { folderStructure: false, extensionGuide: false },
        apiDocs: parsedData.apiDocs || { endpointsDocs: false, sdkExamples: false },
        userDocs: parsedData.userDocs || { userManual: false, troubleshooting: false },
        releaseDocs: parsedData.releaseDocs || { releaseNotes: false, breakingChanges: false },
        knowledgeBase: parsedData.knowledgeBase || { faq: false, bestPractices: false },
        metrics: parsedData.metrics || {
          coverage: 0,
          brokenLinks: 0,
          missingSections: 0,
          apiCoverage: 0,
          exampleCoverage: 0,
          readability: 0,
          overallScore: 0
        },
        recommendations: parsedData.recommendations || []
      }

      const docArtifact: DocumentationArtifact = {
        metadata: {
          artifactId: `docs-${req.projectId}`,
          version: 1,
          status: "Draft",
          createdBy: this.role,
          createdAt: new Date().toISOString(),
          projectId: req.projectId,
          parentArtifactId: `review-${req.projectId}-${req.taskId}`,
          schemaVersion: "1.0"
        },
        report: docReport
      }

      // Create target directory: dataset/{projectId}/documentation/
      const docDir = path.join(datasetDir, "documentation")
      if (!fs.existsSync(docDir)) {
        fs.mkdirSync(docDir, { recursive: true })
      }

      // Write individual generated documentation Markdown files
      const docsTree = parsedData.documentTree || {}
      for (const [filename, markdownContent] of Object.entries(docsTree)) {
        const fullFilePath = path.join(docDir, filename)
        fs.mkdirSync(path.dirname(fullFilePath), { recursive: true })
        fs.writeFileSync(fullFilePath, markdownContent as string)
        req.context.logger(`Published document: ${filename}`)
      }

      // Write report, knowledgeIndex, search index json files
      fs.writeFileSync(path.join(docDir, "docs-report.json"), JSON.stringify(docReport, null, 2))
      fs.writeFileSync(path.join(docDir, "knowledge-index.json"), JSON.stringify(parsedData.knowledgeIndex || {}, null, 2))

      // Write docs history logs
      const historyDir = path.join(docDir, "history")
      if (!fs.existsSync(historyDir)) {
        fs.mkdirSync(historyDir, { recursive: true })
      }
      const historyCount = fs.readdirSync(historyDir).length + 1
      const historyFilename = `docs-${String(historyCount).padStart(3, "0")}.json`
      fs.writeFileSync(path.join(historyDir, historyFilename), JSON.stringify(docArtifact, null, 2))

      return {
        status: "success",
        generatedArtifacts: [
          "documentation/docs-report.json",
          "documentation/knowledge-index.json"
        ],
        logs: ["Documentation AI completed successfully."],
        metrics: {
          tokenCount: 0,
          durationMs: Date.now() - startTime
        },
        qualityScore: docReport.metrics.overallScore
      }

    } catch (err: any) {
      return {
        status: "failed",
        generatedArtifacts: [],
        logs: [`Documentation Agent execution failed: ${err.message}`],
        metrics: {
          tokenCount: 0,
          durationMs: Date.now() - startTime
        }
      }
    }
  }
}
