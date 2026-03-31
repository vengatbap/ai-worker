import { execSync } from "child_process"

export function runTests(repoPath: string) {

  try {

    execSync("npm run build", {
      cwd: repoPath,
      stdio: "inherit"
    })

    execSync("npm run test", {
      cwd: repoPath,
      stdio: "inherit"
    })

    return true

  } catch (err) {

    console.log("Tests failed")

    return false
  }
}