import fs from "fs"
import path from "path"

export function applyCodeChanges(codeJson: string) {

  const repo = process.env.REPO_PATH || "./repo"

  const data = JSON.parse(codeJson)

  for (const file of data.files) {

    const fullPath = path.join(repo, file.path)

    fs.mkdirSync(path.dirname(fullPath), { recursive: true })

    fs.writeFileSync(fullPath, file.content)

    console.log("Created:", fullPath)
  }
}