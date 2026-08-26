import { EventBus, AppEvent } from "../interfaces/types"
import { TelemetryStore } from "./TelemetryStore"

/**
 * EventBusImpl — dual-path event transport.
 *
 * Every published event flows through two independent paths:
 *
 *   EventBus.publish(event)
 *      ├── TelemetryStore.append()   → durable NDJSON on disk, project-scoped
 *      └── SSE writers               → live browser stream, per-project subscribers
 *
 * This separation means:
 * - Browser disconnect → events are not lost (TelemetryStore has them)
 * - Server restart     → history survives (file-backed, not in-memory)
 * - Reconnect          → UI fetches history from /api/history then re-subscribes to SSE
 *
 * The singleton pattern ensures all Orchestrator instances share the same
 * in-memory subscriber registry during a process lifetime.
 */
export class EventBusImpl implements EventBus {
  private static instance: EventBusImpl

  /** In-process pub/sub handlers (e.g. LearningService) */
  private handlers: Record<string, ((event: AppEvent) => void)[]> = {}

  /** Live SSE writers keyed by projectId → writer[] */
  private sseWriters: Map<string, Array<(data: string) => void>> = new Map()

  /** Persistent event store */
  private telemetry: TelemetryStore = new TelemetryStore()

  constructor() {
    if (EventBusImpl.instance) {
      return EventBusImpl.instance
    }
    EventBusImpl.instance = this
  }

  // ─── Publish ───────────────────────────────────────────────────────────────

  publish(event: AppEvent): void {
    // 1. Persist to TelemetryStore (durable, project-scoped)
    if (event.projectId) {
      this.telemetry.append(event.projectId, event)
    }

    // 2. Fan-out to live SSE writers for this project
    if (event.projectId) {
      const writers = this.sseWriters.get(event.projectId) ?? []
      const ssePayload = `data: ${JSON.stringify(event)}\n\n`
      for (const write of writers) {
        try {
          write(ssePayload)
        } catch {
          // writer is disconnected — harmless, will be cleaned up on unsubscribe
        }
      }
    }

    // 3. Fire in-process handlers asynchronously (existing behavior)
    const eventHandlers    = this.handlers[event.type]  ?? []
    const wildcardHandlers = this.handlers["*"] ?? []

    setTimeout(() => {
      for (const handler of [...eventHandlers, ...wildcardHandlers]) {
        try {
          handler(event)
        } catch (err) {
          console.error(`[EventBus] Error in handler for ${event.type}:`, err)
        }
      }
    }, 0)
  }

  // ─── In-process subscribe ──────────────────────────────────────────────────

  subscribe(eventType: string, handler: (event: AppEvent) => void): void {
    if (!this.handlers[eventType]) {
      this.handlers[eventType] = []
    }
    this.handlers[eventType].push(handler)
  }

  // ─── SSE subscribe ─────────────────────────────────────────────────────────

  /**
   * Register a live SSE writer for a project.
   * Returns an unsubscribe function — call it when the browser disconnects.
   */
  subscribeSSE(projectId: string, writer: (data: string) => void): () => void {
    if (!this.sseWriters.has(projectId)) {
      this.sseWriters.set(projectId, [])
    }
    this.sseWriters.get(projectId)!.push(writer)

    // Return cleanup function
    return () => {
      const writers = this.sseWriters.get(projectId)
      if (writers) {
        const idx = writers.indexOf(writer)
        if (idx !== -1) writers.splice(idx, 1)
      }
    }
  }

  // ─── Telemetry access (for API bridge) ────────────────────────────────────

  getHistory(projectId: string): AppEvent[] {
    return this.telemetry.getAll(projectId)
  }

  getHistorySince(projectId: string, sinceTimestamp: string): AppEvent[] {
    return this.telemetry.getSince(projectId, sinceTimestamp)
  }
}
