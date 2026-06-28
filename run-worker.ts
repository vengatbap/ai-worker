import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { getNextTask } from "./worker/task-loader.js"
import { generateSpec } from "./worker/spec-generator.js"
import { generateCode } from "./worker/coder.js"
import { applyCodeChanges } from "./worker/file-writer.js"
import { runTests } from "./worker/test-runner.js"
import { commitAndPush } from "./worker/git-manager.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, ".env.local") })

async function run() {
  try {
    const task = getNextTask()

    if (!task) {
      console.log("No tasks found")
      return
    }

    console.log("Processing task:", task.file)

    const spec = await generateSpec(task.content)
    if (!spec) {
      console.error("ERROR: Failed to generate spec")
      return
    }

    console.log("Spec generated")

    const code = await generateCode(spec)
    if (!code) {
      console.error("ERROR: Failed to generate code")
      return
    }

    console.log("Code generated")

    applyCodeChanges(code)

    const repo = process.env.REPO_PATH || "./repo"

    const success = runTests(repo)

    if (!success) {
      console.log("Build failed")
      return
    }

    await commitAndPush(repo, `AI completed ${task.file}`)
  } catch (error) {
    console.error("ERROR in worker:", error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

run()