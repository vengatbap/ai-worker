import { NextResponse } from "next/server"
import { Orchestrator } from "../../../../../worker/orchestrator"

export const dynamic = "force-dynamic"

/**
 * POST /api/workspace/run
 *
 * Starts the AI engineering pipeline for a project.
 *
 * Body:
 *   { goal: string, projectId?: string, projectName?: string }
 *
 * If projectId is not provided, one is generated from the timestamp.
 * Returns immediately with { projectId } so the UI can subscribe to SSE.
 * The pipeline runs asynchronously in the background.
 */
export async function POST(req: Request) {
  try {
    const { goal, projectId: providedId, projectName } = await req.json()

    if (!goal || typeof goal !== "string" || goal.trim().length === 0) {
      return NextResponse.json(
        { error: "goal is required" },
        { status: 400 }
      )
    }

    const projectId = providedId || Date.now().toString()
    const name      = projectName || goal.slice(0, 60).trim()

    const orchestrator = new Orchestrator()

    // Fire and forget — pipeline runs in background
    // EventBus will publish events as each agent progresses
    orchestrator
      .runProjectWorkflow(projectId, name, goal.trim())
      .catch((err) => {
        console.error(`[/api/workspace/run] Pipeline failed for ${projectId}:`, err.message)
      })

    return NextResponse.json({
      success: true,
      projectId,
      projectName: name,
      message: "Engineering team is now working on your request.",
    })
  } catch (error: any) {
    console.error("[/api/workspace/run] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
