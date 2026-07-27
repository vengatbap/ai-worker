import { BaseAgent } from "./BaseAgent"
import { AgentRequest, AgentResponse, QualityReport, QualityArtifact } from "../../core/interfaces/types"
import { ModelRouterImpl } from "../../core/router/ModelRouterImpl"
import fs from "fs"
import path from "path"

export class QAAgent extends BaseAgent {
  private modelRouter: ModelRouterImpl

  constructor() {
    // Load system prompt from prompts/qa/v1/system.md
    const systemPromptPath = path.resolve(process.cwd(), "prompts/qa/v1/system.md")
    const systemPrompt = fs.existsSync(systemPromptPath) 
      ? fs.readFileSync(systemPromptPath, "utf-8")
      : "You are a Quality Assurance Engine AI."
    
    super("QA", systemPrompt)
    this.modelRouter = new ModelRouterImpl()
  }

  async execute(req: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now()
    const { provider, model } = this.modelRouter.route(this.role)

    req.context.logger(`Executing QA Engine using ${provider} / ${model}...`)

    // Load execution package details
    const datasetDir = path.resolve(process.cwd(), "dataset", req.projectId)
    const taskPkgPath = path.join(datasetDir, `planning/execution-packages/${req.taskId}/v1.json`)

    if (!fs.existsSync(taskPkgPath)) {
      return {
        status: "failed",
        generatedArtifacts: [],
        logs: [`QA failed: Missing execution package at ${taskPkgPath}`],
        metrics: { tokenCount: 0, durationMs: Date.now() - startTime }
      }
    }

    const packageJsonContent = fs.readFileSync(taskPkgPath, "utf-8")
    const executionPackage = JSON.parse(packageJsonContent)

    // Load actual generated files code contents
    const workspaceDir = path.resolve(process.cwd(), "workspace", req.projectId, "repository")
    const filesData: Array<{ filepath: string; content: string }> = []
    
    for (const file of executionPackage.writes) {
      const filePath = path.join(workspaceDir, file)
      if (fs.existsSync(filePath)) {
        filesData.push({
          filepath: file,
          content: fs.readFileSync(filePath, "utf-8")
        })
      }
    }

    // Formulate User prompt template
    const userPromptPath = path.resolve(process.cwd(), "prompts/qa/v1/user.md")
    let userPrompt = fs.existsSync(userPromptPath)
      ? fs.readFileSync(userPromptPath, "utf-8")
      : "Please evaluate files: ${generatedFiles} against package: ${executionPackage}"
    
    userPrompt = userPrompt.replace("${generatedFiles}", JSON.stringify(filesData, null, 2))
    userPrompt = userPrompt.replace("${executionPackage}", JSON.stringify(executionPackage, null, 2))

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

      const parsedData = JSON.parse(cleanJson) as QualityReport

      // Structure metadata
      const metadata = {
        artifactId: `quality-${req.projectId}-${req.taskId}`,
        version: 1,
        status: "Draft" as const,
        createdBy: this.role,
        createdAt: new Date().toISOString(),
        projectId: req.projectId,
        parentArtifactId: `planning-${req.projectId}`,
        schemaVersion: "1.0"
      }

      const qualityArtifact: QualityArtifact = {
        metadata,
        report: parsedData
      }

      // Create target directory: dataset/{projectId}/quality/
      const qualDir = path.join(datasetDir, "quality")
      if (!fs.existsSync(qualDir)) {
        fs.mkdirSync(qualDir, { recursive: true })
      }

      // Write domain-oriented reports
      fs.writeFileSync(path.join(qualDir, "build-report.json"), JSON.stringify(parsedData.validation.build, null, 2))
      fs.writeFileSync(path.join(qualDir, "lint-report.json"), JSON.stringify(parsedData.validation.lint, null, 2))
      fs.writeFileSync(path.join(qualDir, "test-report.json"), JSON.stringify(parsedData.validation.tests, null, 2))
      fs.writeFileSync(path.join(qualDir, "coverage.json"), JSON.stringify({ coveragePercent: parsedData.validation.tests.coveragePercent }, null, 2))
      fs.writeFileSync(path.join(qualDir, "security-report.json"), JSON.stringify(parsedData.validation.security, null, 2))
      fs.writeFileSync(path.join(qualDir, "performance-report.json"), JSON.stringify(parsedData.validation.performance, null, 2))
      fs.writeFileSync(path.join(qualDir, "accessibility-report.json"), JSON.stringify(parsedData.validation.accessibility, null, 2))
      fs.writeFileSync(path.join(qualDir, "quality-score.json"), JSON.stringify(parsedData.metrics, null, 2))

      // Generate human-readable Markdown Quality Report summary
      const qaReportMd = `# Quality Assurance Report Summary\n\n` +
        `## Quality Metrics\n` +
        `* **Overall Score:** ${parsedData.metrics.overallScore} / 100\n` +
        `* **Security Score:** ${parsedData.metrics.securityScore}\n` +
        `* **Performance Score:** ${parsedData.metrics.performanceScore}\n` +
        `* **Maintainability Score:** ${parsedData.metrics.maintainabilityScore}\n` +
        `* **Coverage Percent:** ${parsedData.metrics.coveragePercent}%\n\n` +
        `## Validation Status\n` +
        `* **Build Compile:** ${parsedData.validation.build.passed ? "✅ Passed" : "❌ Failed"}\n` +
        `* **Lint checks:** ${parsedData.validation.lint.passed ? "✅ Passed" : "❌ Failed"} (${parsedData.validation.lint.errors} errors, ${parsedData.validation.lint.warnings} warnings)\n` +
        `* **Security Vulnerabilities:** ${parsedData.validation.security.issuesFound} issues identified\n` +
        `* **Accessibility ARIA Issues:** ${parsedData.validation.accessibility.ARIAIssues} warnings\n\n` +
        `## Defect Log Tracker\n` + (parsedData.defects.length === 0 ? "*No open bugs registered.*" : parsedData.defects.map(d =>
          `### ${d.id}: ${d.description} [Severity: ${d.severity}]\n` +
          `* **Category:** ${d.category}\n` +
          `* **Suggested Fix:** ${d.suggestedFix}\n` +
          `* **Affected Files:** ${d.affectedFiles.join(", ")}\n` +
          `* **Root Cause:** ${d.rootCause || "Unknown"}`
        ).join("\n\n")) + `\n\n` +
        `## Recommendations\n` + parsedData.recommendations.map(r => `- ${r}`).join("\n")

      fs.writeFileSync(path.join(qualDir, "qa-report.md"), qaReportMd)

      // Write quality history file: dataset/{projectId}/quality/history/attempt-xxx.json
      const historyDir = path.join(qualDir, "history")
      if (!fs.existsSync(historyDir)) {
        fs.mkdirSync(historyDir, { recursive: true })
      }
      
      const attemptsCount = fs.readdirSync(historyDir).length + 1
      const attemptFilename = `attempt-${String(attemptsCount).padStart(3, "0")}.json`
      fs.writeFileSync(path.join(historyDir, attemptFilename), JSON.stringify(qualityArtifact, null, 2))

      return {
        status: "success",
        generatedArtifacts: [
          "quality/build-report.json",
          "quality/lint-report.json",
          "quality/test-report.json",
          "quality/coverage.json",
          "quality/security-report.json",
          "quality/performance-report.json",
          "quality/accessibility-report.json",
          "quality/quality-score.json",
          "quality/qa-report.md"
        ],
        logs: ["QA Engine completed successfully."],
        metrics: {
          tokenCount: 0,
          durationMs: Date.now() - startTime
        },
        qualityScore: parsedData.metrics.overallScore
      }

    } catch (err: any) {
      return {
        status: "failed",
        generatedArtifacts: [],
        logs: [`QA Engine execution failed: ${err.message}`],
        metrics: {
          tokenCount: 0,
          durationMs: Date.now() - startTime
        }
      }
    }
  }
}
