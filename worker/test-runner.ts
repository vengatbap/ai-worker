import { execSync } from "child_process"

export function runTests(repoPath: string) {
  try {
    console.log("Running npm run build in", repoPath)
    const buildOutput = execSync("npm run build", {
      cwd: repoPath,
      stdio: ["ignore", "pipe", "pipe"]
    }).toString()

    console.log("Running npm run test in", repoPath)
    const testOutput = execSync("npm run test", {
      cwd: repoPath,
      stdio: ["ignore", "pipe", "pipe"]
    }).toString()

    return { success: true, output: `${buildOutput}\n${testOutput}` }
  } catch (err: any) {
    console.log("Validation failed")
    const stdout = err.stdout ? err.stdout.toString() : ""
    const stderr = err.stderr ? err.stderr.toString() : ""
    return { 
      success: false, 
      errorOutput: `STDOUT:\n${stdout}\nSTDERR:\n${stderr}\nMessage: ${err.message}` 
    }
  }
}