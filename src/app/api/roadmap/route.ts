import { NextResponse } from 'next/server'
import { callAI } from '../../../../worker/ai-service'
import { saveTask } from '@/lib/db'
import fs from 'fs'
import path from 'path'

export async function POST(req: Request) {
  try {
    const { productIdea } = await req.json()

    if (!productIdea) {
      return NextResponse.json({ success: false, error: 'Product idea is required' }, { status: 400 })
    }

    const repo = process.env.REPO_PATH || './repo'
    fs.mkdirSync(repo, { recursive: true })

    console.log(`Planning product, modules, and architecture for: "${productIdea}"`)

    // Step 1: Generate Product Plan & Architecture specifications
    const planningPrompt = `
You are a senior Software Architect and Product Manager.
Generate a comprehensive Product Plan & Architecture specification for the SaaS idea: "${productIdea}".
You must define:
1. The SaaS Product Scope (Target audience, core value proposition).
2. The Module Breakdown (Exactly what user, billing, core, dashboard, and AI modules are needed).
3. The File & Directory Architecture tree.
4. Database Schema concepts (tables, relationships).

Return the response in a structured markdown format. Use two main sections separated by the boundary string "=== ARCHITECTURE_BOUNDARY ===".
Section 1: Product Plan
Section 2: Architecture Specification
`
    const systemPrompt = "You are a senior SaaS product architect. Plan clean, modular, modern SaaS structures."
    const planResult = await callAI(planningPrompt, undefined, undefined, systemPrompt)

    if (!planResult) {
      throw new Error("Failed to generate plan and architecture specification.")
    }

    // Split plan and architecture
    const parts = planResult.split("=== ARCHITECTURE_BOUNDARY ===")
    const productPlan = parts[0]?.trim() || planResult
    const architecture = parts[1]?.trim() || "See product-plan.md for architecture."

    // Save to the repository
    fs.writeFileSync(path.join(repo, 'product-plan.md'), productPlan)
    fs.writeFileSync(path.join(repo, 'architecture.md'), architecture)
    console.log("Saved product-plan.md and architecture.md to target repository.")

    // Step 2: Generate the 5 actionable developer implementation tasks based on the architecture
    const tasksPrompt = `
Based on the following Architecture and Product Plan, generate a structured 5-step development roadmap of implementation tasks.
Each task must be a clear, developer-actionable directive specifying what components, schema tables, or APIs to build.

Product Plan:
${productPlan.slice(0, 1000)}

Architecture:
${architecture.slice(0, 1000)}

Return JSON ONLY:
{
  "tasks": [
    {
      "name": "Task Name (e.g. Step 1: User Schema Setup)",
      "description": "Provide a complete prompt description of what files to modify/create, what Drizzle schema to define, and key features to implement."
    }
  ]
}
`
    const taskSystemPrompt = "You are a senior product coordinator. Output ONLY valid JSON containing step-by-step development tasks."
    const taskResult = await callAI(tasksPrompt, undefined, undefined, taskSystemPrompt)

    let cleanJson = taskResult || ""
    const jsonMatch = cleanJson.match(/```json\n([\s\S]*?)\n```/)
    if (jsonMatch) {
      cleanJson = jsonMatch[1]
    }
    
    const data = JSON.parse(cleanJson)
    const tasks = data.tasks || []
    
    // Reverse tasks so they are inserted in order (unshift)
    const reversedTasks = [...tasks].reverse()

    for (const t of reversedTasks) {
      saveTask({
        id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
        name: t.name,
        status: 'pending',
        timestamp: new Date().toLocaleTimeString(),
        description: t.description
      })
    }

    return NextResponse.json({ success: true, productPlan, architecture })
  } catch (error: any) {
    console.error("Roadmap planning error:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
