import { openai } from "./ai"

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

  const res = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [{ role: "user", content: prompt }]
  })

  return res.choices[0].message.content
}