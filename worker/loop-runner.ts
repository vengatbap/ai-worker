import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { getTasks, updateTaskStatus, DbTask } from "../src/lib/db"
import { processTask } from "./engine"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

async function runLoop() {
  console.log("--------------------------------------------------")
  console.log("🤖 Autonomous SaaS Worker Loop Started...")
  console.log("Monitoring db.json for pending tasks...")
  console.log("--------------------------------------------------")

  while (true) {
    try {
      const tasks = getTasks()
      // Find the oldest pending task
      const pendingTask = [...tasks].reverse().find((t) => t.status === "pending")

      if (pendingTask) {
        console.log(`\n🚀 Found pending task: "${pendingTask.name}"`)
        
        // Mark as processing
        updateTaskStatus(pendingTask.id, "processing")
        console.log(`Status set to: processing`)

        // Run the agent engine
        const result = await processTask(pendingTask.description, pendingTask.name)

        if (result.success) {
          console.log(`✅ Task Succeeded: "${pendingTask.name}"`)
          updateTaskStatus(pendingTask.id, "success", {
            report: result.report || "No summary provided."
          })
        } else {
          console.error(`❌ Task Failed: "${pendingTask.name}"`)
          updateTaskStatus(pendingTask.id, "failed", {
            error: result.error || "Execution error."
          })
        }
      }
    } catch (err: any) {
      console.error("Error in autonomous worker loop:", err.message)
    }

    // Wait 5 seconds before checking again
    await new Promise((resolve) => setTimeout(resolve, 5000))
  }
}

runLoop()
