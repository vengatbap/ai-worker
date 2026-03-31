import fs from "fs"
import path from "path"

export function getNextTask() {
  const taskDir = process.env.TASK_PATH || "./tasks"

  const files = fs.readdirSync(taskDir)

  const taskFile = files.find((f) => f.endsWith(".md"))

  if (!taskFile) return null

  const fullPath = path.join(taskDir, taskFile)

  const content = fs.readFileSync(fullPath, "utf-8")

  return {
    file: taskFile,
    content
  }
}