import fs from "fs"
import path from "path"
import { AppEvent } from "../interfaces/types"

/**
 * TelemetryStore — append-only, project-scoped event log.
 *
 * Each project gets its own NDJSON file:
 *   dataset/{projectId}/telemetry/events.ndjson
 *
 * The store is purely additive. Events are never deleted or overwritten.
 * This makes it safe as a historical source for the workspace UI:
 * - If the browser disconnects, events are not lost
 * - If the server restarts, event history is preserved
 * - The SSE stream is the live transport; TelemetryStore is the durable record
 */
export class TelemetryStore {
  private static readonly TELEMETRY_DIR = "telemetry"
  private static readonly EVENTS_FILE   = "events.ndjson"

  private getEventsPath(projectId: string): string {
    const dir = path.resolve(
      process.cwd(),
      "dataset",
      projectId,
      TelemetryStore.TELEMETRY_DIR
    )
    fs.mkdirSync(dir, { recursive: true })
    return path.join(dir, TelemetryStore.EVENTS_FILE)
  }

  /**
   * Append a single event to the project's event log.
   * Synchronous write to ensure ordering is preserved.
   */
  append(projectId: string, event: AppEvent): void {
    try {
      const filePath = this.getEventsPath(projectId)
      const line = JSON.stringify(event) + "\n"
      fs.appendFileSync(filePath, line, "utf-8")
    } catch (err) {
      // TelemetryStore failure must never crash the pipeline
      console.error(`[TelemetryStore] Failed to append event for project ${projectId}:`, err)
    }
  }

  /**
   * Read all events for a project in chronological order.
   * Returns [] if no events exist yet.
   */
  getAll(projectId: string): AppEvent[] {
    try {
      const filePath = this.getEventsPath(projectId)
      if (!fs.existsSync(filePath)) return []
      const raw = fs.readFileSync(filePath, "utf-8")
      return raw
        .split("\n")
        .filter(line => line.trim().length > 0)
        .map(line => JSON.parse(line) as AppEvent)
    } catch (err) {
      console.error(`[TelemetryStore] Failed to read events for project ${projectId}:`, err)
      return []
    }
  }

  /**
   * Read events after a given timestamp (for reconnect scenarios).
   * The browser can pass its last-seen timestamp to get only new events.
   */
  getSince(projectId: string, sinceTimestamp: string): AppEvent[] {
    return this.getAll(projectId).filter(ev => ev.timestamp > sinceTimestamp)
  }

  /**
   * Read events of a specific type for a project.
   */
  getByType(projectId: string, eventType: string): AppEvent[] {
    return this.getAll(projectId).filter(ev => ev.type === eventType)
  }
}
