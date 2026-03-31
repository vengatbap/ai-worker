import { openai } from "./ai"

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

  const res = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [{ role: "user", content: prompt }]
  })

  return res.choices[0].message.content
}