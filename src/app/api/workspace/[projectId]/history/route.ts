import { NextResponse } from "next/server"
import { EventBusImpl } from "../../../../../../core/events/EventBusImpl"

export const dynamic = "force-dynamic"

/**
 * GET /api/workspace/[projectId]/history
 *
 * Returns all persisted events for a project in chronological order.
 *
 * Used by the browser to:
 * 1. Reconstruct the activity feed on initial page load
 * 2. Replay events after a disconnect (pass ?since= for delta-only)
 *
 * Query params:
 *   ?since=2026-08-26T12:00:00.000Z   — return only events after this timestamp
 *   ?type=agent.completed              — filter by event type
 */
export async function GET(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  const { projectId } = params
  const { searchParams } = new URL(req.url)
  const since = searchParams.get("since")
  const type  = searchParams.get("type")

  try {
    const eventBus = new EventBusImpl()
    let events = since
      ? eventBus.getHistorySince(projectId, since)
      : eventBus.getHistory(projectId)

    if (type) {
      events = events.filter(e => e.type === type)
    }

    return NextResponse.json({ events, count: events.length })
  } catch (error: any) {
    console.error(`[/api/workspace/${projectId}/history] Error:`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
