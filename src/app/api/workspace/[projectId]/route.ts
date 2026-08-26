import { NextResponse } from "next/server"
import { EventBusImpl } from "../../../../../core/events/EventBusImpl"
import { AppEvent } from "../../../../../core/interfaces/types"
import fs from "fs"
import path from "path"

/**
 * GET /api/workspace/[projectId]
 *
 * Returns the full workspace state for a project:
 * - ProjectManifest (if available)
 * - WorkspaceStatus
 * - Agent pipeline status derived from events
 * - Recent activity summary
 */
export async function GET(
  _req: Request,
  { params }: { params: { projectId: string } }
) {
  const { projectId } = params

  try {
    const datasetDir   = path.resolve(process.cwd(), "dataset", projectId)
    const workspaceDir = path.resolve(process.cwd(), "workspace", projectId)
    const manifestPath = path.join(datasetDir, "ProjectManifest.json")

    const eventBus = new EventBusImpl()
    const events   = eventBus.getHistory(projectId)

    // Derive agent statuses from events
    const agentRoles = [
      "Research", "Planner", "Architect", "Planning",
      "Developer", "QA", "Reviewer", "Documentation", "Deployment"
    ]

    const agentStatus: Record<string, "idle" | "working" | "done" | "failed"> = {}
    for (const role of agentRoles) {
      agentStatus[role] = "idle"
    }

    for (const ev of events) {
      if (ev.type === "agent.started"   && ev.payload?.agentRole) agentStatus[ev.payload.agentRole] = "working"
      if (ev.type === "agent.completed" && ev.payload?.agentRole) agentStatus[ev.payload.agentRole] = "done"
      if (ev.type === "agent.failed"    && ev.payload?.agentRole) agentStatus[ev.payload.agentRole] = "failed"
    }

    // Pipeline status
    const lastEvent = events[events.length - 1]
    let pipelineStatus: "idle" | "running" | "success" | "failed" = "idle"
    if (events.some((e: AppEvent) => e.type === "workflow_started")) pipelineStatus = "running"
    if (lastEvent?.type === "pipeline.done") {
      pipelineStatus = lastEvent.payload?.status === "success" ? "success" : "failed"
    }

    // QA score
    const qaEvent = events.filter((e: AppEvent) => e.type === "qa.scored").pop()
    const qaScore = qaEvent?.payload?.score ?? null

    // Reviewer decision
    const reviewEvent = events.filter((e: AppEvent) => e.type === "reviewer.decision").pop()
    const reviewDecision = reviewEvent?.payload?.decision ?? null

    // Workspace version
    let workspaceVersion = 0
    const wsStatusPath = path.join(workspaceDir, ".workspace-status.json")
    if (fs.existsSync(wsStatusPath)) {
      try {
        const ws = JSON.parse(fs.readFileSync(wsStatusPath, "utf-8"))
        workspaceVersion = ws.currentVersion ?? 0
      } catch { /* ignore */ }
    }

    // Manifest
    let manifest = null
    if (fs.existsSync(manifestPath)) {
      try { manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) } catch { /* ignore */ }
    }

    // Project name from workflow_started event or manifest
    const startEvent = events.find((e: AppEvent) => e.type === "workflow_started")
    const projectName = manifest?.metadata?.projectName
      || startEvent?.payload?.taskName
      || projectId

    return NextResponse.json({
      projectId,
      projectName,
      pipelineStatus,
      agentStatus,
      qaScore,
      reviewDecision,
      workspaceVersion,
      manifest,
      eventCount: events.length,
      lastActivity: lastEvent?.timestamp ?? null,
    })
  } catch (error: any) {
    console.error(`[/api/workspace/${projectId}] Error:`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
