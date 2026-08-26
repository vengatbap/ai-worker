import { NextResponse } from "next/server"
import { EventBusImpl } from "../../../../../core/events/EventBusImpl"
import { AppEvent } from "../../../../../core/interfaces/types"
import fs from "fs"
import path from "path"

/**
 * GET /api/workspace/projects
 *
 * Returns a list of all projects that have a dataset directory with
 * a ProjectManifest.json. Projects that are in-progress (no manifest yet)
 * are also returned with inferred status from telemetry events.
 */
export async function GET() {
  try {
    const datasetRoot = path.resolve(process.cwd(), "dataset")

    if (!fs.existsSync(datasetRoot)) {
      return NextResponse.json({ projects: [] })
    }

    const entries = fs.readdirSync(datasetRoot, { withFileTypes: true })
    const projects = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const projectId = entry.name
      const projectDir = path.join(datasetRoot, projectId)
      const manifestPath = path.join(projectDir, "ProjectManifest.json")

      const eventBus = new EventBusImpl()
      const events = eventBus.getHistory(projectId)

      // Determine current stage from manifest or latest events
      let projectName = projectId
      let currentStage = "pending"
      let status: "running" | "completed" | "failed" | "pending" = "pending"
      let updatedAt = new Date().toISOString()

      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
          projectName  = manifest.metadata?.projectName || projectId
          currentStage = manifest.currentStage || "deployment"
          status       = "completed"
          updatedAt    = manifest.metadata?.updatedAt || updatedAt
        } catch {
          // malformed manifest — show as pending
        }
      } else if (events.length > 0) {
        // Infer status from latest events
        const lastEvent = events[events.length - 1]
        if (lastEvent.type === "pipeline.done") {
          status = lastEvent.payload?.status === "success" ? "completed" : "failed"
        } else if (lastEvent.type === "workflow_failed") {
          status = "failed"
        } else {
          status = "running"
        }
        updatedAt = lastEvent.timestamp

        // Infer current stage from last agent.completed
        const completedEvents = events
          .filter((e: AppEvent) => e.type === "agent.completed")
          .map((e: AppEvent) => e.payload?.agentRole)
        currentStage = completedEvents[completedEvents.length - 1] || "starting"
      }

      // Get the goal (prompt) from workflow_started event
      const startEvent = events.find((e: AppEvent) => e.type === "workflow_started")
      const goal = startEvent?.payload?.prompt || ""

      projects.push({
        projectId,
        projectName,
        currentStage,
        status,
        updatedAt,
        goal,
        eventCount: events.length,
      })
    }

    // Sort most recently updated first
    projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

    return NextResponse.json({ projects })
  } catch (error: any) {
    console.error("[/api/workspace/projects] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
