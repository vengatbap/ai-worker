import { callAI } from "./ai-service.js"

export async function generateCode(spec: string) {

  const prompt = `
You are a senior fullstack developer.

Stack:
Next.js
Typescript
Postgres
Drizzle ORM

Based on this specification generate code.

Return JSON:

{
 "files": [
   {
     "path": "file_path",
     "content": "file_code"
   }
 ]
}

Specification:
${spec}
`

  const systemPrompt = "You are a senior fullstack developer. Return ONLY valid JSON with files and contents."

  const result = await callAI(prompt, undefined, undefined, systemPrompt)

  return result
}

export async function correctCode(originalCode: string, errorOutput: string) {
  const prompt = `
You are a senior fullstack developer.
The previous code you generated failed validation with the following error:

${errorOutput}

Here was the previously generated JSON containing the code files:
${originalCode}

Please analyze the error and output the CORRECTED code files. Keep the same JSON format.
Make sure you fix imports, types, or any syntax errors.

Return JSON:
{
 "files": [
   {
     "path": "file_path",
     "content": "file_code"
   }
 ]
}
`
  const systemPrompt = "You are a senior fullstack developer. Return ONLY valid JSON with files and contents."
  const result = await callAI(prompt, undefined, undefined, systemPrompt)
  return result
}