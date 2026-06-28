import { getNextTask } from "./task-loader"
import { generateSpec } from "./spec-generator"
import { generateCode, correctCode } from "./coder"
import { applyCodeChanges } from "./file-writer"
import { runTests } from "./test-runner"
import { commitAndPush } from "./git-manager"

export async function processTask(taskContent: string, taskFile: string = "manual-task.md") {
  console.log("Processing task:", taskFile)

  try {
    const spec = await generateSpec(taskContent)
    if (!spec) throw new Error("Failed to generate spec")
    console.log("Spec generated")

    let code = await generateCode(spec)
    if (!code) throw new Error("Failed to generate code")
    console.log("Code generated")

    applyCodeChanges(code)

    const repo = process.env.REPO_PATH || "./repo"
    
    // Self-Correction Loop
    let testResult = runTests(repo)
    let attempts = 1
    const maxAttempts = 3

    while (!testResult.success && attempts < maxAttempts) {
      console.log(`Validation failed. Self-Correction Attempt ${attempts}/${maxAttempts}...`)
      console.log("Error output:", testResult.errorOutput)
      
      const corrected = await correctCode(code, testResult.errorOutput || "Unknown compilation error")
      if (corrected) {
        code = corrected
        applyCodeChanges(code)
        testResult = runTests(repo)
      }
      attempts++
    }

    if (!testResult.success) {
      console.log("Build failed after all correction attempts.")
      return { success: false, error: testResult.errorOutput || "Build/Test failed" }
    }

    await commitAndPush(repo, `AI completed ${taskFile}`)
    
    return { success: true, report: `AI completed ${taskFile} and pushed to repo.` }
  } catch (error: any) {
    console.error("Worker error:", error)
    return { success: false, error: error.message }
  }
}
