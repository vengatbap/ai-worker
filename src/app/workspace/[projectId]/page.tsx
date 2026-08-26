"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppEvent {
  id:        string
  type:      string
  timestamp: string
  projectId?: string
  payload:   any
}

interface TreeNode {
  name:       string
  path:       string
  type:       "file" | "directory"
  extension?: string
  sizeBytes?: number
  children?:  TreeNode[]
}

type AgentStatus = "idle" | "working" | "done" | "failed"

const AGENT_ROLES = [
  "Research", "Planner", "Architect", "Planning",
  "Developer", "QA", "Reviewer", "Documentation", "Deployment"
]

const ROLE_LABELS: Record<string, string> = {
  Research:      "Research",
  Planner:       "Planner",
  Architect:     "Architect",
  Planning:      "Planning",
  Developer:     "Developer",
  QA:            "QA",
  Reviewer:      "Reviewer",
  Documentation: "Docs",
  Deployment:    "Deploy",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusIcon(s: AgentStatus) {
  if (s === "working") return <span className="text-blue-400 animate-pulse">●</span>
  if (s === "done")    return <span className="text-green-400">✓</span>
  if (s === "failed")  return <span className="text-red-400">✗</span>
  return <span className="text-zinc-600">○</span>
}

function eventToActivity(ev: AppEvent): string | null {
  switch (ev.type) {
    case "agent.started":
      return `${ev.payload?.agentRole} AI  ▶ Starting...`
    case "agent.completed":
      return `${ev.payload?.agentRole} AI  ✓ Completed`
    case "agent.failed":
      return `${ev.payload?.agentRole} AI  ✗ Failed: ${ev.payload?.error || ""}`
    case "file.created":
      return `Developer AI  ✓ Created ${ev.payload?.filepath}`
    case "file.modified":
      return `Developer AI  ✎ Modified ${ev.payload?.filepath}`
    case "qa.scored":
      return `QA AI  Score: ${ev.payload?.score}`
    case "reviewer.decision":
      return `Reviewer AI  Decision: ${ev.payload?.decision}`
    case "pipeline.done":
      return ev.payload?.status === "success"
        ? "Pipeline  ✓ Complete"
        : `Pipeline  ✗ Failed: ${ev.payload?.error || ""}`
    case "workflow_started":
      return `Engineering team started: "${ev.payload?.prompt?.slice(0, 60)}..."`
    case "log_emitted":
      return ev.payload?.message
    default:
      return null
  }
}

function fileLanguage(ext: string): string {
  const map: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    json: "json", md: "markdown", css: "css", html: "html",
    py: "python", sh: "bash", yml: "yaml", yaml: "yaml",
  }
  return map[ext] || "plaintext"
}

// ─── FileExplorer ─────────────────────────────────────────────────────────────

function FileTree({
  nodes,
  onSelect,
  selectedPath,
  depth = 0,
}: {
  nodes: TreeNode[]
  onSelect: (n: TreeNode) => void
  selectedPath: string | null
  depth?: number
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({})

  return (
    <ul className="space-y-0.5">
      {nodes.map(node => (
        <li key={node.path}>
          {node.type === "directory" ? (
            <>
              <button
                onClick={() => setOpen(o => ({ ...o, [node.path]: !o[node.path] }))}
                className="flex items-center gap-1.5 w-full text-left px-2 py-1 rounded hover:bg-zinc-800 text-xs text-zinc-400"
                style={{ paddingLeft: `${8 + depth * 12}px` }}
              >
                <span className="text-zinc-600">{open[node.path] ? "▾" : "▸"}</span>
                {node.name}/
              </button>
              {open[node.path] && node.children && (
                <FileTree
                  nodes={node.children}
                  onSelect={onSelect}
                  selectedPath={selectedPath}
                  depth={depth + 1}
                />
              )}
            </>
          ) : (
            <button
              onClick={() => onSelect(node)}
              className={`flex items-center gap-1.5 w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                selectedPath === node.path
                  ? "bg-zinc-700 text-zinc-100"
                  : "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
              style={{ paddingLeft: `${8 + depth * 12}px` }}
            >
              {node.name}
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

// ─── Main Workspace ───────────────────────────────────────────────────────────

export default function WorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>()
  const router = useRouter()

  // State
  const [projectName, setProjectName]     = useState(projectId)
  const [pipelineStatus, setPipelineStatus] = useState<string>("idle")
  const [agentStatus, setAgentStatus]     = useState<Record<string, AgentStatus>>(
    Object.fromEntries(AGENT_ROLES.map(r => [r, "idle" as AgentStatus]))
  )
  const [qaScore, setQaScore]             = useState<number | null>(null)
  const [reviewDecision, setReviewDecision] = useState<string | null>(null)
  const [fileTree, setFileTree]           = useState<TreeNode[]>([])
  const [selectedFile, setSelectedFile]   = useState<TreeNode | null>(null)
  const [fileContent, setFileContent]     = useState<string | null>(null)
  const [activityLog, setActivityLog]     = useState<{ ts: string; text: string; key: string }[]>([])
  const [chatInput, setChatInput]         = useState("")
  const [sending, setSending]             = useState(false)
  const activityRef = useRef<HTMLDivElement>(null)

  // ── Load initial state ───────────────────────────────────────────────────
  useEffect(() => {
    // Load workspace state
    fetch(`/api/workspace/${projectId}`)
      .then(r => r.json())
      .then(d => {
        setProjectName(d.projectName || projectId)
        setPipelineStatus(d.pipelineStatus || "idle")
        if (d.agentStatus) setAgentStatus(d.agentStatus)
        if (d.qaScore !== null) setQaScore(d.qaScore)
        if (d.reviewDecision) setReviewDecision(d.reviewDecision)
      })
      .catch(console.error)

    // Load file tree
    loadFileTree()

    // Load event history and build activity feed
    fetch(`/api/workspace/${projectId}/history`)
      .then(r => r.json())
      .then(d => {
        const entries = (d.events || [])
          .map((ev: AppEvent) => {
            const text = eventToActivity(ev)
            return text ? { ts: ev.timestamp, text, key: ev.id } : null
          })
          .filter(Boolean) as { ts: string; text: string; key: string }[]
        setActivityLog(entries)
      })
      .catch(console.error)
  }, [projectId])

  function loadFileTree() {
    fetch(`/api/workspace/${projectId}/files`)
      .then(r => r.json())
      .then(d => setFileTree(d.tree || []))
      .catch(console.error)
  }

  // ── SSE subscription ─────────────────────────────────────────────────────
  useEffect(() => {
    const es = new EventSource(`/api/workspace/${projectId}/events`)

    es.onmessage = (e) => {
      try {
        const event: AppEvent = JSON.parse(e.data)
        handleEvent(event)
      } catch { /* ignore malformed */ }
    }

    es.onerror = () => {
      // Browser will auto-reconnect; fetch fresh history on reconnect
      setTimeout(() => {
        fetch(`/api/workspace/${projectId}/history`)
          .then(r => r.json())
          .then(d => {
            const entries = (d.events || [])
              .map((ev: AppEvent) => {
                const text = eventToActivity(ev)
                return text ? { ts: ev.timestamp, text, key: ev.id } : null
              })
              .filter(Boolean) as { ts: string; text: string; key: string }[]
            setActivityLog(entries)
          })
          .catch(console.error)
      }, 1000)
    }

    return () => es.close()
  }, [projectId])

  const handleEvent = useCallback((event: AppEvent) => {
    // Update agent status
    if (event.type === "agent.started" && event.payload?.agentRole) {
      setAgentStatus(prev => ({ ...prev, [event.payload.agentRole]: "working" }))
    }
    if (event.type === "agent.completed" && event.payload?.agentRole) {
      setAgentStatus(prev => ({ ...prev, [event.payload.agentRole]: "done" }))
    }
    if (event.type === "agent.failed" && event.payload?.agentRole) {
      setAgentStatus(prev => ({ ...prev, [event.payload.agentRole]: "failed" }))
    }

    // Update pipeline status
    if (event.type === "workflow_started") setPipelineStatus("running")
    if (event.type === "pipeline.done") {
      setPipelineStatus(event.payload?.status === "success" ? "success" : "failed")
    }

    // QA score
    if (event.type === "qa.scored" && event.payload?.score !== undefined) {
      setQaScore(event.payload.score)
    }

    // Reviewer decision
    if (event.type === "reviewer.decision" && event.payload?.decision) {
      setReviewDecision(event.payload.decision)
    }

    // Refresh file tree when files change
    if (event.type === "file.created" || event.type === "file.modified") {
      loadFileTree()
    }

    // Add to activity log
    const text = eventToActivity(event)
    if (text) {
      setActivityLog(prev => [...prev, { ts: event.timestamp, text, key: event.id }])
    }
  }, [projectId])

  // Auto-scroll activity feed
  useEffect(() => {
    if (activityRef.current) {
      activityRef.current.scrollTop = activityRef.current.scrollHeight
    }
  }, [activityLog])

  // ── File selection ────────────────────────────────────────────────────────
  function handleFileSelect(node: TreeNode) {
    setSelectedFile(node)
    setFileContent(null)
    fetch(`/api/workspace/${projectId}/files?filepath=${encodeURIComponent(node.path)}`)
      .then(r => r.json())
      .then(d => setFileContent(d.content || ""))
      .catch(() => setFileContent("// Could not load file content"))
  }

  // ── Chat submit ───────────────────────────────────────────────────────────
  async function handleSend() {
    if (!chatInput.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch("/api/workspace/run", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ goal: chatInput.trim(), projectId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setChatInput("")
      setPipelineStatus("running")
      setAgentStatus(Object.fromEntries(AGENT_ROLES.map(r => [r, "idle" as AgentStatus])))
    } catch (err: any) {
      console.error(err)
    } finally {
      setSending(false)
    }
  }

  // ── Pipeline status label ─────────────────────────────────────────────────
  const pipelineLabel = {
    idle:    "",
    running: "● AI Engineering Active",
    success: "✓ Pipeline Complete",
    failed:  "✗ Pipeline Failed",
  }[pipelineStatus] || ""

  const pipelineColor = {
    idle:    "text-zinc-500",
    running: "text-blue-400",
    success: "text-green-400",
    failed:  "text-red-400",
  }[pipelineStatus] || "text-zinc-500"

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-950 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/workspace")}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ← Projects
          </button>
          <span className="text-zinc-700">|</span>
          <h1 className="text-sm font-semibold truncate max-w-[300px]">{projectName}</h1>
        </div>
        {pipelineLabel && (
          <span className={`text-xs font-medium ${pipelineColor}`}>{pipelineLabel}</span>
        )}
      </div>

      {/* Main 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Files panel */}
        <div className="w-52 shrink-0 border-r border-zinc-800 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-800">
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Files</p>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5">
            {fileTree.length === 0 ? (
              <p className="text-xs text-zinc-600 px-2 py-2">
                No files yet. The engineering team will generate them here.
              </p>
            ) : (
              <FileTree
                nodes={fileTree}
                onSelect={handleFileSelect}
                selectedPath={selectedFile?.path ?? null}
              />
            )}
          </div>
        </div>

        {/* Code viewer */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-zinc-800 flex items-center gap-2">
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Code</p>
            {selectedFile && (
              <span className="text-xs text-zinc-400 font-mono">{selectedFile.path}</span>
            )}
          </div>
          <div className="flex-1 overflow-auto bg-zinc-900/50">
            {!selectedFile ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-zinc-600">Select a file to view its contents</p>
              </div>
            ) : fileContent === null ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-zinc-600">Loading...</p>
              </div>
            ) : (
              <pre className="text-xs font-mono text-zinc-300 p-4 whitespace-pre-wrap leading-relaxed">
                {fileContent}
              </pre>
            )}
          </div>
        </div>

        {/* Engineering team panel */}
        <div className="w-48 shrink-0 border-l border-zinc-800 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-800">
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Engineering Team</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {AGENT_ROLES.map(role => {
              const s = agentStatus[role] ?? "idle"
              return (
                <div
                  key={role}
                  className={`flex items-center justify-between px-2 py-1.5 rounded text-xs ${
                    s === "working" ? "bg-zinc-800" : ""
                  }`}
                >
                  <span className={s === "idle" ? "text-zinc-500" : "text-zinc-200"}>
                    {ROLE_LABELS[role] ?? role}
                  </span>
                  {statusIcon(s)}
                </div>
              )
            })}

            {/* QA / Review summary */}
            {(qaScore !== null || reviewDecision !== null) && (
              <div className="mt-3 pt-3 border-t border-zinc-800 space-y-1.5">
                {qaScore !== null && (
                  <div className="flex items-center justify-between px-2 text-xs">
                    <span className="text-zinc-500">QA Score</span>
                    <span className={qaScore >= 85 ? "text-green-400" : "text-amber-400"}>
                      {qaScore}
                    </span>
                  </div>
                )}
                {reviewDecision && (
                  <div className="flex items-center justify-between px-2 text-xs">
                    <span className="text-zinc-500">Review</span>
                    <span className={reviewDecision === "APPROVED" ? "text-green-400" : "text-amber-400"}>
                      {reviewDecision}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity feed */}
      <div className="border-t border-zinc-800 shrink-0" style={{ height: "180px" }}>
        <div className="px-4 py-1.5 border-b border-zinc-800">
          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Activity</p>
        </div>
        <div
          ref={activityRef}
          className="overflow-y-auto font-mono text-xs leading-relaxed text-zinc-400 px-4 py-2"
          style={{ height: "140px" }}
        >
          {activityLog.length === 0 ? (
            <span className="text-zinc-600">
              No activity yet. Ask your engineering team to start building.
            </span>
          ) : (
            activityLog.map(({ ts, text, key }) => (
              <div key={key} className="flex gap-3 mb-1">
                <span className="text-zinc-600 shrink-0">
                  {new Date(ts).toLocaleTimeString()}
                </span>
                <span>{text}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat input */}
      <div className="border-t border-zinc-800 px-4 py-3 flex gap-3 items-center shrink-0 bg-zinc-950">
        <input
          type="text"
          placeholder="What should we build?"
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSend() }}
          disabled={sending}
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!chatInput.trim() || sending}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors shrink-0"
        >
          {sending ? "..." : "Send"}
        </button>
      </div>
    </div>
  )
}
