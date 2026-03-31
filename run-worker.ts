import dotenv from "dotenv"
import { getNextTask } from "./worker/task-loader"
import { generateSpec } from "./worker/spec-generator"
import { generateCode } from "./worker/coder"
import { applyCodeChanges } from "./worker/file-writer"
import { runTests } from "./worker/test-runner"
import { commitAndPush } from "./worker/git-manager"

dotenv.config()

async function run() {

  const task = getNextTask()

  if (!task) {
    console.log("No tasks found")
    return
  }

  console.log("Processing task:", task.file)

  const spec = await generateSpec(task.content)

  console.log("Spec generated")

  const code = await generateCode(spec!)

  console.log("Code generated")

  applyCodeChanges(code!)

  const repo = process.env.REPO_PATH || "./repo"

  const success = runTests(repo)

  if (!success) {
    console.log("Build failed")
    return
  }

  await commitAndPush(repo, `AI completed ${task.file}`)
}

run()