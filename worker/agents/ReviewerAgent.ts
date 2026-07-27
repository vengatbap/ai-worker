import { BaseAgent } from "./BaseAgent"
import { AgentRequest, AgentResponse, ReviewReport, ReviewArtifact } from "../../core/interfaces/types"
import { ModelRouterImpl } from "../../core/router/ModelRouterImpl"
import fs from "fs"
import path from "path"

export class ReviewerAgent extends BaseAgent {
  private modelRouter: ModelRouterImpl

  constructor() {
    // Load system prompt from prompts/reviewer/v1/system.md
    const systemPromptPath = path.resolve(process.cwd(), "prompts/reviewer/v1/system.md")
    const systemPrompt = fs.existsSync(systemPromptPath) 
      ? fs.readFileSync(systemPromptPath, "utf-8")
      : "You are a senior Engineering Governance Engine AI."
    
    super("Reviewer", systemPrompt)
    this.modelRouter = new ModelRouterImpl()
  }

  async execute(req: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now()
    const { provider, model } = this.modelRouter.route("QA") // Reuses QA reasoning level router

    req.context.logger(`Executing Reviewer Agent using ${provider} / ${model}...`)

    // Load execution package details to find target writes files
    const datasetDir = path.resolve(process.cwd(), "dataset", req.projectId)
    const taskPkgPath = path.join(datasetDir, `planning/execution-packages/${req.taskId}/v1.json`)

    if (!fs.existsSync(taskPkgPath)) {
      return {
        status: "failed",
        generatedArtifacts: [],
        logs: [`Reviewer failed: Missing execution package at ${taskPkgPath}`],
        metrics: { tokenCount: 0, durationMs: Date.now() - startTime }
      }
    }

    const packageJsonContent = fs.readFileSync(taskPkgPath, "utf-8")
    const executionPackage = JSON.parse(packageJsonContent)

    // Load generated workspace code contents
    const workspaceDir = path.resolve(process.cwd(), "workspace", req.projectId, "repository")
    const filesData: Array<{ filepath: string; content: string }> = []
    
    const targetFiles = executionPackage.outputs?.expectedArtifacts || []
    for (const file of targetFiles) {
      const filePath = path.join(workspaceDir, file)
      if (fs.existsSync(filePath)) {
        filesData.push({
          filepath: file,
          content: fs.readFileSync(filePath, "utf-8")
        })
      }
    }

    // Load architecture.json
    const archJsonPath = path.join(datasetDir, "architecture/architecture.json")
    const archJson = fs.existsSync(archJsonPath) ? fs.readFileSync(archJsonPath, "utf-8") : "{}"

    // Load company-standards.md
    const stdPath = path.resolve(process.cwd(), "prompts/shared/v1/company-standards.md")
    const standards = fs.existsSync(stdPath) ? fs.readFileSync(stdPath, "utf-8") : "Clean Code rules."

    // Formulate User prompt template
    const userPromptPath = path.resolve(process.cwd(), "prompts/reviewer/v1/user.md")
    let userPrompt = fs.existsSync(userPromptPath)
      ? fs.readFileSync(userPromptPath, "utf-8")
      : "Please review generated files: ${generatedFiles} against architecture: ${architectureJson} and standards: ${companyStandards}"
    
    userPrompt = userPrompt.replace("${generatedFiles}", JSON.stringify(filesData, null, 2))
    userPrompt = userPrompt.replace("${architectureJson}", archJson)
    userPrompt = userPrompt.replace("${companyStandards}", standards)

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

      const parsedData = JSON.parse(cleanJson) as ReviewReport

      // Structure metadata
      const metadata = {
        artifactId: `review-${req.projectId}-${req.taskId}`,
        version: 1,
        status: "Draft" as const,
        createdBy: this.role,
        createdAt: new Date().toISOString(),
        projectId: req.projectId,
        parentArtifactId: `planning-${req.projectId}`,
        schemaVersion: "1.0"
      }

      const reviewArtifact: ReviewArtifact = {
        metadata,
        report: parsedData
      }

      // Create target directory: dataset/{projectId}/review/
      const reviewDir = path.join(datasetDir, "review")
      if (!fs.existsSync(reviewDir)) {
        fs.mkdirSync(reviewDir, { recursive: true })
      }

      // Write domain-oriented files
      fs.writeFileSync(path.join(reviewDir, "review-report.json"), JSON.stringify(parsedData, null, 2))
      fs.writeFileSync(path.join(reviewDir, "review-findings.json"), JSON.stringify(parsedData.findings, null, 2))
      
      const approval = {
        decision: parsedData.decision,
        approvedBy: this.role,
        score: parsedData.overallScore,
        reason: parsedData.decision === "APPROVED" 
          ? "Architecture compliance and coding standards gates satisfied." 
          : "Changes requested during engineering governance review."
      }
      fs.writeFileSync(path.join(reviewDir, "approval.json"), JSON.stringify(approval, null, 2))

      // Generate human-readable summary Markdown
      const reviewSummaryMd = `# Pull Request Review Summary\n\n` +
        `## Governance Decision\n` +
        `* **Decision:** **${parsedData.decision}**\n` +
        `* **Compliance Score:** ${parsedData.overallScore} / 100\n` +
        `* **Technical Debt Hours:** ${parsedData.technicalDebtHours} hours\n\n` +
        `## Checklist Status\n` +
        `* **Architecture Compliance:** ${parsedData.architectureCompliance.passed ? "✅ Compliant" : "❌ Non-Compliant"} (${parsedData.architectureCompliance.details})\n` +
        `* **Coding Standards:** ${parsedData.codingStandards.passed ? "✅ Compliant" : "❌ Non-Compliant"} (${parsedData.codingStandards.details})\n` +
        `* **Design Patterns:** ${parsedData.designPatterns.passed ? "✅ Compliant" : "❌ Non-Compliant"} (${parsedData.designPatterns.details})\n` +
        `* **Maintainability:** ${parsedData.maintainability.passed ? "✅ Passed" : "❌ Failed"} (${parsedData.maintainability.details})\n` +
        `* **Security Governance:** ${parsedData.securityGovernance.passed ? "✅ Passed" : "❌ Failed"} (${parsedData.securityGovernance.details})\n\n` +
        `## Findings & Actionable Tasks\n` + (parsedData.findings.length === 0 ? "*No open findings logged.*" : parsedData.findings.map(f =>
          `### ${f.id}: ${f.description} [Severity: ${f.severity}]\n` +
          `* **Category:** ${f.category}\n` +
          `* **File/Line:** ${f.file}:${f.line}\n` +
          `* **Suggested Recommendation:** ${f.recommendation}`
        ).join("\n\n")) + `\n\n` +
        `## Recommendations\n` + parsedData.recommendations.map(r => `- ${r}`).join("\n")

      fs.writeFileSync(path.join(reviewDir, "review-summary.md"), reviewSummaryMd)

      // Write history log file: dataset/{projectId}/review/history/review-xxx.json
      const historyDir = path.join(reviewDir, "history")
      if (!fs.existsSync(historyDir)) {
        fs.mkdirSync(historyDir, { recursive: true })
      }
      const historyCount = fs.readdirSync(historyDir).length + 1
      const historyFilename = `review-${String(historyCount).padStart(3, "0")}.json`
      fs.writeFileSync(path.join(historyDir, historyFilename), JSON.stringify(reviewArtifact, null, 2))

      return {
        status: "success",
        generatedArtifacts: [
          "review/review-report.json",
          "review/review-findings.json",
          "review/approval.json",
          "review/review-summary.md"
        ],
        logs: ["Reviewer Engine completed successfully."],
        metrics: {
          tokenCount: 0,
          durationMs: Date.now() - startTime
        },
        qualityScore: parsedData.overallScore
      }

    } catch (err: any) {
      return {
        status: "failed",
        generatedArtifacts: [],
        logs: [`Reviewer Agent execution failed: ${err.message}`],
        metrics: {
          tokenCount: 0,
          durationMs: Date.now() - startTime
        }
      }
    }
  }
}
