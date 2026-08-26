"use client"

import React, { useEffect, useState, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { 
  Activity, 
  Code, 
  Cpu, 
  FileText, 
  Globe, 
  Plus, 
  Send,
  Terminal,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Loader2,
  Sparkles,
  Layers,
  ArrowLeft,
  FileCode2,
  Folder,
  FolderOpen,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  Boxes,
  Compass,
  FileCheck
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

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
  { id: "Research",      name: "Research AI",     desc: "Domain analysis & requirements",  icon: Compass },
  { id: "Planner",       name: "Planner AI",      desc: "MVP features & roadmap",          icon: Layers },
  { id: "Architect",     name: "Architect AI",    desc: "Schema, tables & folder tree",    icon: Boxes },
  { id: "Planning",      name: "Planning AI",     desc: "Execution package generator",     icon: FileText },
  { id: "Developer",     name: "Developer AI",    desc: "Autonomous code generation",      icon: Code },
  { id: "QA",            name: "QA AI",           desc: "Unit tests, linting & defect scan", icon: ShieldCheck },
  { id: "Reviewer",      name: "Reviewer AI",     desc: "Governance & PR compliance",      icon: FileCheck },
  { id: "Documentation", name: "Doc AI",          desc: "System guides & API docs",        icon: FileCode2 },
  { id: "Deployment",    name: "Deployment AI",   desc: "Docker, CI/CD & release bundle",  icon: Globe },
]

export default function WorkspaceDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const router = useRouter()

  // State
  const [projectName, setProjectName]     = useState(projectId)
  const [pipelineStatus, setPipelineStatus] = useState<string>("idle")
  const [agentStatus, setAgentStatus]     = useState<Record<string, AgentStatus>>(
    Object.fromEntries(AGENT_ROLES.map(r => [r.id, "idle" as AgentStatus]))
  )
  const [qaScore, setQaScore]             = useState<number | null>(null)
  const [reviewDecision, setReviewDecision] = useState<string | null>(null)
  const [fileTree, setFileTree]           = useState<TreeNode[]>([])
  const [selectedFile, setSelectedFile]   = useState<TreeNode | null>(null)
  const [fileContent, setFileContent]     = useState<string | null>(null)
  const [activityLog, setActivityLog]     = useState<{ ts: string; text: string; key: string; type?: string }[]>([])
  const [chatInput, setChatInput]         = useState("")
  const [sending, setSending]             = useState(false)
  const [copied, setCopied]               = useState(false)
  const [activeTab, setActiveTab]         = useState<"workspace" | "events">("workspace")
  const activityRef = useRef<HTMLDivElement>(null)

  // ── Load initial state ───────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/workspace/${projectId}`)
      .then(r => r.json())
      .then(d => {
        setProjectName(d.projectName || projectId)
        setPipelineStatus(d.pipelineStatus || "idle")
        if (d.agentStatus) setAgentStatus(d.agentStatus)
        if (d.qaScore !== null && d.qaScore !== undefined) setQaScore(d.qaScore)
        if (d.reviewDecision) setReviewDecision(d.reviewDecision)
      })
      .catch(console.error)

    loadFileTree()

    fetch(`/api/workspace/${projectId}/history`)
      .then(r => r.json())
      .then(d => {
        const entries = (d.events || [])
          .map((ev: AppEvent) => {
            const text = eventToActivity(ev)
            return text ? { ts: ev.timestamp, text, key: ev.id, type: ev.type } : null
          })
          .filter(Boolean) as { ts: string; text: string; key: string; type?: string }[]
        setActivityLog(entries)
      })
      .catch(console.error)
  }, [projectId])

  function loadFileTree() {
    fetch(`/api/workspace/${projectId}/files`)
      .then(r => r.json())
      .then(d => {
        setFileTree(d.tree || [])
        // Auto-select first file if none selected
        if (!selectedFile && d.tree && d.tree.length > 0) {
          const firstFile = findFirstFile(d.tree)
          if (firstFile) handleFileSelect(firstFile)
        }
      })
      .catch(console.error)
  }

  function findFirstFile(nodes: TreeNode[]): TreeNode | null {
    for (const n of nodes) {
      if (n.type === "file") return n
      if (n.children) {
        const found = findFirstFile(n.children)
        if (found) return found
      }
    }
    return null
  }

  // ── SSE subscription ─────────────────────────────────────────────────────
  useEffect(() => {
    const es = new EventSource(`/api/workspace/${projectId}/events`)

    es.onmessage = (e) => {
      try {
        const event: AppEvent = JSON.parse(e.data)
        handleEvent(event)
      } catch { /* ignore */ }
    }

    es.onerror = () => {
      setTimeout(() => {
        fetch(`/api/workspace/${projectId}/history`)
          .then(r => r.json())
          .then(d => {
            const entries = (d.events || [])
              .map((ev: AppEvent) => {
                const text = eventToActivity(ev)
                return text ? { ts: ev.timestamp, text, key: ev.id, type: ev.type } : null
              })
              .filter(Boolean) as { ts: string; text: string; key: string; type?: string }[]
            setActivityLog(entries)
          })
          .catch(console.error)
      }, 1000)
    }

    return () => es.close()
  }, [projectId])

  const handleEvent = useCallback((event: AppEvent) => {
    if (event.type === "agent.started" && event.payload?.agentRole) {
      setAgentStatus(prev => ({ ...prev, [event.payload.agentRole]: "working" }))
    }
    if (event.type === "agent.completed" && event.payload?.agentRole) {
      setAgentStatus(prev => ({ ...prev, [event.payload.agentRole]: "done" }))
    }
    if (event.type === "agent.failed" && event.payload?.agentRole) {
      setAgentStatus(prev => ({ ...prev, [event.payload.agentRole]: "failed" }))
    }

    if (event.type === "workflow_started") setPipelineStatus("running")
    if (event.type === "pipeline.done") {
      setPipelineStatus(event.payload?.status === "success" ? "success" : "failed")
    }

    if (event.type === "qa.scored" && event.payload?.score !== undefined) {
      setQaScore(event.payload.score)
    }

    if (event.type === "reviewer.decision" && event.payload?.decision) {
      setReviewDecision(event.payload.decision)
    }

    if (event.type === "file.created" || event.type === "file.modified") {
      loadFileTree()
    }

    const text = eventToActivity(event)
    if (text) {
      setActivityLog(prev => [...prev, { ts: event.timestamp, text, key: event.id, type: event.type }])
    }
  }, [projectId])

  useEffect(() => {
    if (activityRef.current) {
      activityRef.current.scrollTop = activityRef.current.scrollHeight
    }
  }, [activityLog])

  function handleFileSelect(node: TreeNode) {
    setSelectedFile(node)
    setFileContent(null)
    fetch(`/api/workspace/${projectId}/files?filepath=${encodeURIComponent(node.path)}`)
      .then(r => r.json())
      .then(d => setFileContent(d.content || ""))
      .catch(() => setFileContent("// Could not load file content"))
  }

  const copyCode = () => {
    if (fileContent) {
      navigator.clipboard.writeText(fileContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

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
      setAgentStatus(Object.fromEntries(AGENT_ROLES.map(r => [r.id, "idle" as AgentStatus])))
    } catch (err: any) {
      console.error(err)
    } finally {
      setSending(false)
    }
  }

  function eventToActivity(ev: AppEvent): string | null {
    switch (ev.type) {
      case "agent.started":
        return `[${ev.payload?.agentRole?.toUpperCase()}] Initialized and analyzing scope...`
      case "agent.completed":
        return `[${ev.payload?.agentRole?.toUpperCase()}] Phase completed successfully with approved outputs.`
      case "agent.failed":
        return `[${ev.payload?.agentRole?.toUpperCase()}] Phase encountered error: ${ev.payload?.error || "Execution failed"}`
      case "file.created":
        return `[DEVELOPER] Created repository file: ${ev.payload?.filepath}`
      case "file.modified":
        return `[DEVELOPER] Modified source file: ${ev.payload?.filepath}`
      case "qa.scored":
        return `[QA EVALUATOR] Inspection completed. Quality Score: ${ev.payload?.score}/100`
      case "reviewer.decision":
        return `[REVIEWER] Governance gate decision: ${ev.payload?.decision}`
      case "pipeline.done":
        return ev.payload?.status === "success"
          ? `[PIPELINE] Engineering OS successfully completed all stages. Manifest kernel saved.`
          : `[PIPELINE] Pipeline stopped: ${ev.payload?.error || "Unknown failure"}`
      case "workflow_started":
        return `[ORCHESTRATOR] Activated team for: "${ev.payload?.prompt?.slice(0, 70)}..."`
      case "log_emitted":
        return ev.payload?.message
      default:
        return null
    }
  }

  const isRunning = pipelineStatus === "running"
  const isComplete = pipelineStatus === "success"
  const isFailed = pipelineStatus === "failed"

  return (
    <div className="flex h-screen bg-[#050505] text-zinc-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#141414] flex flex-col p-4 bg-[#0a0a0a]/70 backdrop-blur-xl shrink-0">
        <Link href="/workspace" className="flex items-center space-x-3 px-2 py-3 border-b border-[#141414] mb-6 group">
          <div className="w-8 h-8 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-center group-hover:scale-105 transition-all">
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xs font-bold tracking-tight text-white group-hover:text-emerald-400 transition-colors">SaaS Builder AI</h1>
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold">Workspace Mode</p>
          </div>
        </Link>

        <nav className="flex-1 space-y-1.5">
          <Link href="/workspace">
            <div className="flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5 text-zinc-500" />
              <span>All Workspaces</span>
            </div>
          </Link>
          <div className="flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 text-white ring-1 ring-white/10">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span className="truncate flex-1">{projectName}</span>
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_8px_#10b981]" />
          </div>
        </nav>

        {/* Project Meta Card */}
        <div className="pt-4 border-t border-[#141414] space-y-3">
          <div className="bg-[#0e0e0e] border border-[#1a1a1a] p-3 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Status</span>
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                isRunning && "bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse",
                isComplete && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                isFailed && "bg-red-500/10 text-red-400 border border-red-500/20",
                pipelineStatus === "idle" && "bg-zinc-800 text-zinc-400"
              )}>
                {isRunning ? "● Working" : isComplete ? "✓ Done" : isFailed ? "✗ Failed" : "○ Idle"}
              </span>
            </div>
            {qaScore !== null && (
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-zinc-800/50">
                <span className="text-zinc-500">QA Score</span>
                <span className={qaScore >= 85 ? "font-bold text-emerald-400" : "font-bold text-amber-400"}>
                  {qaScore}/100
                </span>
              </div>
            )}
            {reviewDecision && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">Governance</span>
                <span className="font-bold text-emerald-400">{reviewDecision}</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#050505]">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-[#141414] px-6 flex items-center justify-between bg-[#080808]/70 backdrop-blur-md shrink-0">
          <div className="flex items-center space-x-3">
            <span className="text-xs text-zinc-500 font-mono">workspace /</span>
            <h2 className="text-sm font-bold tracking-tight text-white max-w-md truncate">{projectName}</h2>
          </div>

          <div className="flex items-center space-x-3">
            {isRunning && (
              <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-semibold text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>AI Engineering Active</span>
              </div>
            )}
            {isComplete && (
              <div className="flex items-center space-x-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Ready & Verified</span>
              </div>
            )}
          </div>
        </header>

        {/* 3-Column Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: File Explorer */}
          <div className="w-64 border-r border-[#141414] flex flex-col bg-[#070707] shrink-0">
            <div className="px-4 py-3 border-b border-[#141414] flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Repository Files</span>
              <span className="text-[10px] font-mono text-zinc-600">{fileTree.length} items</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {fileTree.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-600 space-y-2">
                  <FileCode2 className="w-6 h-6 mx-auto text-zinc-700" />
                  <p>No repository files generated yet.</p>
                </div>
              ) : (
                <FileTreeView nodes={fileTree} onSelect={handleFileSelect} selectedPath={selectedFile?.path || null} />
              )}
            </div>
          </div>

          {/* Center Column: Codebase Viewer */}
          <div className="flex-1 flex flex-col bg-[#060606] overflow-hidden border-r border-[#141414]">
            <div className="h-10 border-b border-[#141414] px-4 flex items-center justify-between bg-[#080808]">
              <div className="flex items-center space-x-2 text-xs">
                <FileCode2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-mono text-zinc-300">{selectedFile ? selectedFile.path : "No file selected"}</span>
              </div>
              {selectedFile && (
                <button 
                  onClick={copyCode}
                  className="text-xs text-zinc-500 hover:text-white flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/5 transition-all"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-auto p-4 font-mono text-xs text-zinc-300 leading-relaxed bg-[#060606]">
              {!selectedFile ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-2">
                  <Code className="w-8 h-8 text-zinc-800" />
                  <p>Select a generated file to preview its implementation.</p>
                </div>
              ) : fileContent === null ? (
                <div className="h-full flex items-center justify-center text-zinc-600 space-y-2">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                </div>
              ) : (
                <pre className="whitespace-pre-wrap">{fileContent}</pre>
              )}
            </div>
          </div>

          {/* Right Column: Engineering Team Panel */}
          <div className="w-80 border-l border-[#141414] flex flex-col bg-[#070707] shrink-0 overflow-y-auto p-4 space-y-4">
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Autonomous Organization</span>
              <p className="text-xs text-zinc-600 mt-0.5">Live status across 9 engineering agents</p>
            </div>

            <div className="space-y-2">
              {AGENT_ROLES.map(role => {
                const status = agentStatus[role.id] || "idle"
                const isAgentWorking = status === "working"
                const isAgentDone = status === "done"
                const isAgentFailed = status === "failed"
                const IconComponent = role.icon

                return (
                  <div
                    key={role.id}
                    className={cn(
                      "p-3 rounded-xl border transition-all space-y-1 relative overflow-hidden",
                      isAgentWorking && "border-blue-500/40 bg-blue-500/[0.04] shadow-[0_0_15px_rgba(59,130,246,0.1)]",
                      isAgentDone && "border-emerald-500/20 bg-emerald-500/[0.02]",
                      isAgentFailed && "border-red-500/30 bg-red-500/[0.03]",
                      status === "idle" && "border-[#141414] bg-[#0a0a0a]/40"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className={cn(
                          "w-6 h-6 rounded-lg flex items-center justify-center text-xs",
                          isAgentWorking && "bg-blue-500/20 text-blue-400",
                          isAgentDone && "bg-emerald-500/20 text-emerald-400",
                          isAgentFailed && "bg-red-500/20 text-red-400",
                          status === "idle" && "bg-zinc-800 text-zinc-500"
                        )}>
                          <IconComponent className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">{role.name}</h4>
                          <p className="text-[10px] text-zinc-500">{role.desc}</p>
                        </div>
                      </div>

                      <span className={cn(
                        "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                        isAgentWorking && "bg-blue-500/10 text-blue-400 border border-blue-500/30 animate-pulse",
                        isAgentDone && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
                        isAgentFailed && "bg-red-500/10 text-red-400 border border-red-500/30",
                        status === "idle" && "text-zinc-600 bg-zinc-900 border border-zinc-800"
                      )}>
                        {isAgentWorking ? "Working" : isAgentDone ? "Passed" : isAgentFailed ? "Failed" : "Waiting"}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Bottom Activity Terminal & Prompt Dispatcher */}
        <div className="h-48 border-t border-[#141414] bg-[#070707] flex flex-col shrink-0">
          <div className="h-8 border-b border-[#141414] px-4 flex items-center justify-between bg-[#090909]">
            <div className="flex items-center space-x-2 text-xs">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-bold text-[10px] uppercase tracking-widest text-zinc-400">Live Engineering Stream</span>
            </div>
            <span className="text-[10px] font-mono text-zinc-600">{activityLog.length} events logged</span>
          </div>

          <div 
            ref={activityRef}
            className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1 bg-[#060606] text-zinc-400 leading-relaxed select-text"
          >
            {activityLog.length === 0 ? (
              <p className="text-zinc-600">Waiting for instructions. Submit a build prompt below.</p>
            ) : (
              activityLog.map((act) => (
                <div key={act.key} className="flex items-start space-x-3 hover:bg-white/[0.02] px-2 py-0.5 rounded transition-colors">
                  <span className="text-zinc-600 text-[10px] shrink-0 font-semibold">{new Date(act.ts).toLocaleTimeString()}</span>
                  <span className="text-zinc-300 flex-1">{act.text}</span>
                </div>
              ))
            )}
          </div>

          {/* Prompt Dispatcher Bar */}
          <div className="p-3 border-t border-[#141414] bg-[#090909] flex items-center space-x-3">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Instruct your AI engineering team... (e.g., Implement login with PostgreSQL and unit tests)"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSend() }}
                disabled={sending}
                className="w-full bg-[#050505] border border-[#1a1a1a] rounded-xl px-4 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all font-sans"
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!chatInput.trim() || sending}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 font-extrabold text-xs px-5 py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center space-x-1.5 shrink-0"
            >
              {sending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Send className="w-3 h-3" />
                  <span>Send</span>
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

function FileTreeView({ nodes, onSelect, selectedPath, depth = 0 }: { nodes: TreeNode[], onSelect: (n: TreeNode) => void, selectedPath: string | null, depth?: number }) {
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({ src: true, app: true })

  const toggle = (p: string) => {
    setOpenMap(prev => ({ ...prev, [p]: !prev[p] }))
  }

  return (
    <div className="space-y-0.5">
      {nodes.map((node) => {
        const isDir = node.type === "directory"
        const isOpen = openMap[node.path] ?? true
        const isSelected = selectedPath === node.path

        return (
          <div key={node.path} style={{ paddingLeft: `${depth * 10}px` }}>
            {isDir ? (
              <div>
                <button
                  onClick={() => toggle(node.path)}
                  className="flex items-center space-x-1.5 w-full text-left px-2 py-1 rounded hover:bg-white/5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  {isOpen ? <ChevronDown className="w-3 h-3 text-zinc-500" /> : <ChevronRight className="w-3 h-3 text-zinc-500" />}
                  {isOpen ? <FolderOpen className="w-3.5 h-3.5 text-emerald-400" /> : <Folder className="w-3.5 h-3.5 text-emerald-500/70" />}
                  <span className="font-mono text-xs">{node.name}</span>
                </button>
                {isOpen && node.children && (
                  <FileTreeView nodes={node.children} onSelect={onSelect} selectedPath={selectedPath} depth={depth + 1} />
                )}
              </div>
            ) : (
              <button
                onClick={() => onSelect(node)}
                className={cn(
                  "flex items-center space-x-2 w-full text-left px-2 py-1 rounded text-xs transition-colors font-mono",
                  isSelected ? "bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                )}
              >
                <FileCode2 className={cn("w-3 h-3 shrink-0", isSelected ? "text-emerald-400" : "text-zinc-500")} />
                <span className="truncate">{node.name}</span>
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
