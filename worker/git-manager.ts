import simpleGit from "simple-git"

export async function commitAndPush(repoPath: string, message: string) {

  const git = simpleGit(repoPath)

  await git.checkoutLocalBranch(`ai-task-${Date.now()}`)

  await git.add(".")

  await git.commit(message)

  await git.push("origin", "HEAD")

  console.log("Code pushed to GitHub")
}