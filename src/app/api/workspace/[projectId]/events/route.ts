import { EventBusImpl } from "../../../../../../core/events/EventBusImpl"

/**
 * GET /api/workspace/[projectId]/events
 *
 * Server-Sent Events stream for a project.
 *
 * The browser subscribes to this endpoint immediately after opening a workspace.
 * Events are pushed in real-time as the AI pipeline executes.
 *
 * If the browser disconnects and reconnects:
 * 1. First fetch /api/workspace/[projectId]/history to replay past events
 * 2. Then re-subscribe here for live events going forward
 *
 * The EventBusImpl singleton guarantees that events published by the Orchestrator
 * (running in the same Node.js process) reach this SSE writer.
 */
export async function GET(
  _req: Request,
  { params }: { params: { projectId: string } }
) {
  const { projectId } = params
  const eventBus = new EventBusImpl()

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      // Send a heartbeat comment to keep the connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"))
        } catch {
          clearInterval(heartbeat)
        }
      }, 15_000)

      // Register this browser connection as an SSE writer
      const unsubscribe = eventBus.subscribeSSE(projectId, (data: string) => {
        try {
          controller.enqueue(encoder.encode(data))
        } catch {
          // Connection closed — cleanup handled below
        }
      })

      // Send an initial connection confirmation event
      const connected = JSON.stringify({
        id: `connected-${Date.now()}`,
        type: "connected",
        projectId,
        timestamp: new Date().toISOString(),
        payload: { message: "SSE stream connected" }
      })
      controller.enqueue(encoder.encode(`data: ${connected}\n\n`))

      // Cleanup on disconnect
      return () => {
        clearInterval(heartbeat)
        unsubscribe()
      }
    },

    cancel() {
      // Stream was cancelled by the browser — cleanup is handled via start() return value
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering if behind a proxy
    },
  })
}
