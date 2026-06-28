import { callAI } from "./ai-service.js"

export async function generateSpec(task: string) {

  const prompt = `
You are a senior software architect.

Convert the following task into a technical specification.

Return JSON with:

{
 "files": [],
 "database_changes": [],
 "tests": []
}

Task:
${task}
`

  const systemPrompt = "You are a software architect. Return ONLY valid JSON."

  const result = await callAI(prompt, undefined, undefined, systemPrompt)

  return result
}