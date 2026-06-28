import fs from "fs"
import path from "path"
import { extractJson } from "./utils"

export function applyCodeChanges(codeJson: string | undefined) {
  if (!codeJson) {
    console.error("ERROR: No code was generated. AI response was empty.")
    return
  }

  const repo = process.env.REPO_PATH || "./repo"

  try {
    const data = extractJson(codeJson)

    if (!data || !data.files || !Array.isArray(data.files)) {
      console.error("ERROR: Invalid code structure. Expected { files: [...] }")
      return
    }

    for (const file of data.files) {
      const fullPath = path.join(repo, file.path)
      fs.mkdirSync(path.dirname(fullPath), { recursive: true })
      fs.writeFileSync(fullPath, file.content)
      console.log("Created:", fullPath)
    }
  } catch (error) {
    console.error("ERROR applying code changes:", error instanceof Error ? error.message : error)
    return
  }
}