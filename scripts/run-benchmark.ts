import { Orchestrator } from "../worker/orchestrator"
import { EventBusImpl } from "../core/events/EventBusImpl"
import { WorkspaceServiceImpl } from "../core/workspace/WorkspaceServiceImpl"
import fs from "fs"
import path from "path"
import dotenv from "dotenv"

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })

async function executeBenchmark() {
  console.log("====================================================================")
  console.log("              RUNNING LOGIN/SIGNUP INTEGRATION BENCHMARK            ")
  console.log("====================================================================")

  const projectId = "login-signup-benchmark"
  const taskName = "Create Login and Signup Pages"
  const prompt = "Create login and signup pages with a protected layout using Next.js."

  const workspaceService = new WorkspaceServiceImpl()
  const eventBus = new EventBusImpl()

  // Clean up previous runs
  const workspaceDir = path.resolve(process.cwd(), "workspace", projectId)
  if (fs.existsSync(workspaceDir)) {
    fs.rmSync(workspaceDir, { recursive: true, force: true })
  }
  const datasetDir = path.resolve(process.cwd(), "dataset", projectId)
  if (fs.existsSync(datasetDir)) {
    fs.rmSync(datasetDir, { recursive: true, force: true })
  }

  // Monitor scope expansions
  const scopeExpansions: any[] = []
  eventBus.subscribe("scope_expansion", (event) => {
    scopeExpansions.push(event.payload)
    console.log(`[EVENT] Scope expansion triggered: ${JSON.stringify(event.payload, null, 2)}`)
  })

  // Start orchestrator
  const orchestrator = new Orchestrator()
  
  try {
    const result = await orchestrator.runProjectWorkflow(projectId, taskName, prompt)
    console.log("\n====================================================================")
    console.log("                      ORCHESTRATOR RUN COMPLETE                     ")
    console.log("====================================================================")
    
    // Collect telemetry evidence
    const status = await workspaceService.getWorkspaceStatus(projectId)
    const generatedRepoDir = path.join(workspaceDir, "repository")
    
    // Check files created inside repository/
    const srcExists = fs.existsSync(path.join(generatedRepoDir, "src"))
    const filesList: string[] = []
    if (srcExists) {
      const getFiles = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const entryPath = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            getFiles(entryPath)
          } else {
            filesList.push(path.relative(generatedRepoDir, entryPath).replace(/\\/g, "/"))
          }
        }
      }
      getFiles(generatedRepoDir)
    }

    // Load QA score and Review decisions
    let qaScore = 0
    let reviewDecision = "REJECTED"
    try {
      const qaScoreData = JSON.parse(fs.readFileSync(path.join(datasetDir, "quality/quality-score.json"), "utf-8"))
      qaScore = qaScoreData.overallScore || 0
    } catch {}
    try {
      const approvalData = JSON.parse(fs.readFileSync(path.join(datasetDir, "review/approval.json"), "utf-8"))
      reviewDecision = approvalData.decision || "REJECTED"
    } catch {}

    // Find Execution Packages folder to analyze versions
    const pkgFolder = path.join(datasetDir, "planning/execution-packages/TASK-001")
    const packages = fs.existsSync(pkgFolder) ? fs.readdirSync(pkgFolder) : []
    const packageRevisions = packages.filter(f => f.startsWith("execution-package-v") && f.endsWith(".json")).length

    console.log("\n====================================================================")
    console.log("                     LOGIN/SIGNUP BENCHMARK REPORT                  ")
    console.log("====================================================================")
    console.log(`Result                     | ${result.status.toUpperCase()}`)
    console.log(`Workspace State            | ${status.state}`)
    console.log(`Workspace Version          | ${status.currentVersion}`)
    console.log(`Package Revisions          | ${packageRevisions}`)
    console.log(`Dynamic Requests           | ${scopeExpansions.length}`)
    console.log(`Auto Approved              | ${scopeExpansions.filter(e => e.decision === "AUTO_APPROVED").length}`)
    console.log(`Denied                     | ${scopeExpansions.filter(e => e.decision === "DENIED").length}`)
    console.log(`QA Quality Score           | ${qaScore}`)
    console.log(`Review Governance          | ${reviewDecision}`)
    console.log("--------------------------------------------------------------------")
    console.log("Generated Repository Files:")
    filesList.forEach(file => console.log(`  ├── ${file}`))
    console.log("--------------------------------------------------------------------")
    console.log("Final Verdict:")
    if (result.status === "success" && status.state === "READY" && filesList.length > 0) {
      console.log("🎉 V2.1 + V2.2 + V2.3 integration verified successfully!")
    } else {
      console.log("❌ Benchmark validation failed. Check logic logs.")
      process.exit(1)
    }
    console.log("====================================================================")

  } catch (err: any) {
    console.error("\n❌ Benchmark execution crashed:", err.message)
    process.exit(1)
  }
}

executeBenchmark()
