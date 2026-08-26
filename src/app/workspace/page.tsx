"use client"

import React, { useEffect, useState } from "react"
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
  Loader2,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  FolderGit2
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

interface Project {
  projectId:    string
  projectName:  string
  currentStage: string
  status:       "running" | "completed" | "failed" | "pending"
  updatedAt:    string
  goal:         string
  eventCount:   number
}

export default function WorkspaceListPage() {
  const [projects, setProjects]   = useState<Project[]>([])
  const [loading, setLoading]     = useState(true)
  const [goal, setGoal]           = useState("")
  const [projectName, setProjectName] = useState("")
  const [starting, setStarting]   = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/workspace/projects")
      const data = await res.json()
      setProjects(data.projects || [])
    } catch (err) {
      console.error("Failed to load projects:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
    const interval = setInterval(fetchProjects, 4000)
    return () => clearInterval(interval)
  }, [])

  async function handleStart() {
    if (!goal.trim()) return
    setStarting(true)
    setError(null)
    try {
      const res = await fetch("/api/workspace/run", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ goal: goal.trim(), projectName: projectName.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to start")
      window.location.href = `/workspace/${data.projectId}`
    } catch (err: any) {
      setError(err.message)
      setStarting(false)
    }
  }

  const activeProjects = projects.filter(p => p.status === "running")
  const completedProjects = projects.filter(p => p.status === "completed")

  return (
    <div className="flex h-screen bg-[#050505] text-zinc-100 overflow-hidden font-sans">
      {/* Sleek Sidebar */}
      <aside className="w-64 border-r border-[#141414] flex flex-col p-5 bg-[#0a0a0a]/70 backdrop-blur-xl shrink-0">
        <div className="flex items-center space-x-3 px-2 py-3 border-b border-[#141414] mb-6">
          <div className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <Cpu className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white">SaaS Builder AI</h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Engineering OS v4</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5">
          <NavItem icon={<Activity className="w-4 h-4" />} label="Command Center" active />
          <NavItem icon={<Layers className="w-4 h-4" />} label="Workspaces" count={projects.length} />
          <NavItem icon={<ShieldCheck className="w-4 h-4" />} label="Governance & QA" />
          <NavItem icon={<Zap className="w-4 h-4" />} label="Model Router" />
          <NavItem icon={<Terminal className="w-4 h-4" />} label="Event Telemetry" />
        </nav>

        {/* System Node Badge */}
        <div className="pt-4 border-t border-[#141414] space-y-3">
          <div className="bg-[#0e0e0e] border border-[#1a1a1a] p-3 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Engine Node</span>
              <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ACTIVE
              </span>
            </div>
            <p className="text-xs font-mono text-zinc-400 mt-1">Mistral + Cohere</p>
          </div>
          <button 
            onClick={() => setIsNewModalOpen(true)}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] flex items-center justify-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </aside>

      {/* Main Command Center Content */}
      <main className="flex-1 flex flex-col overflow-y-auto bg-[#050505]">
        {/* Top Header */}
        <header className="h-16 border-b border-[#141414] px-8 flex items-center justify-between bg-[#080808]/40 backdrop-blur-md sticky top-0 z-20">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white">Engineering Command Center</h2>
            <p className="text-xs text-zinc-500">Autonomous AI engineering organization ready for deployment</p>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-xs text-zinc-500">
              {activeProjects.length > 0 ? (
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  {activeProjects.length} Pipeline(s) Running
                </span>
              ) : "Autonomous Loop Idle"}
            </span>
          </div>
        </header>

        <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
          {/* 4 Status Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatusMetricCard 
              label="Engineering Organization" 
              value="9 Agents" 
              sub="Research, Dev, QA, Deploy"
              icon={<Cpu className="w-5 h-5 text-emerald-400" />}
            />
            <StatusMetricCard 
              label="Active Pipelines" 
              value={activeProjects.length.toString()} 
              sub={`${projects.length} total projects created`}
              icon={<Activity className="w-5 h-5 text-blue-400" />}
              highlight={activeProjects.length > 0}
            />
            <StatusMetricCard 
              label="Quality & Governance" 
              value="92%+" 
              sub="Automatic transactional rollback"
              icon={<ShieldCheck className="w-5 h-5 text-purple-400" />}
            />
            <StatusMetricCard 
              label="Routing Resilience" 
              value="Tier 1" 
              sub="Mistral ➔ Cohere Fallback"
              icon={<Zap className="w-5 h-5 text-amber-400" />}
            />
          </div>

          {/* "What should we build?" Launcher Card */}
          <div className="bg-gradient-to-b from-[#0e0e0e] to-[#080808] border border-[#1a1a1a] rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            
            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">What should your engineering team build today?</h3>
                    <p className="text-xs text-zinc-500">The AI organization will research, architect, code, test, review, and document the solution.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Project Name (e.g., Modern Next.js 14 Todo Application)"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  className="w-full bg-[#050505] border border-[#1c1c1c] rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                />
                <textarea
                  placeholder="Describe your requirements in detail... (e.g. Build a modern Todo app with PostgreSQL persistence, user authentication, protected layouts, and comprehensive unit tests)"
                  value={goal}
                  onChange={e => setGoal(e.target.value)}
                  rows={3}
                  className="w-full bg-[#050505] border border-[#1c1c1c] rounded-xl p-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 resize-none transition-all"
                  onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleStart() }}
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-2 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-500">Quick templates:</span>
                  <button 
                    onClick={() => {
                      setProjectName("Next.js 14 Todo App")
                      setGoal("Create a simple Todo application with authentication, protected routes, PostgreSQL persistence, and CRUD operations.")
                    }}
                    className="text-[11px] bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white px-2.5 py-1 rounded-lg border border-white/5 transition-colors"
                  >
                    Todo App
                  </button>
                  <button 
                    onClick={() => {
                      setProjectName("SaaS Billing & Auth System")
                      setGoal("Build a full SaaS customer portal with Stripe subscription tiers, Supabase auth, and webhook management.")
                    }}
                    className="text-[11px] bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white px-2.5 py-1 rounded-lg border border-white/5 transition-colors"
                  >
                    SaaS Billing
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-zinc-600 hidden sm:inline">⌘ + Enter to dispatch</span>
                  <button
                    onClick={handleStart}
                    disabled={!goal.trim() || starting}
                    className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 font-extrabold text-xs px-6 py-2.5 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)] flex items-center space-x-2"
                  >
                    {starting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Initializing Team...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Start Building</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Project Workspaces Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Engineering Workspaces</h3>
                <p className="text-xs text-zinc-600">Active and completed repositories generated by the OS</p>
              </div>
              <span className="text-xs text-zinc-500 font-mono">{projects.length} total projects</span>
            </div>

            {loading ? (
              <div className="h-48 flex flex-col items-center justify-center text-zinc-500 space-y-2 bg-[#0a0a0a]/40 border border-[#141414] rounded-2xl">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                <p className="text-xs">Loading workspaces...</p>
              </div>
            ) : projects.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-zinc-500 space-y-3 bg-[#0a0a0a]/40 border border-[#141414] rounded-2xl p-8 text-center">
                <FolderGit2 className="w-8 h-8 text-zinc-700" />
                <div>
                  <p className="text-sm font-semibold text-zinc-400">No engineering workspaces created yet</p>
                  <p className="text-xs text-zinc-600 mt-1">Submit your first build prompt above to activate the AI team.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.map(project => {
                  const isRunning = project.status === "running"
                  const isSuccess = project.status === "completed"
                  const isFailed  = project.status === "failed"

                  return (
                    <Link
                      key={project.projectId}
                      href={`/workspace/${project.projectId}`}
                      className="group bg-[#090909] border border-[#141414] hover:border-emerald-500/30 rounded-2xl p-5 transition-all relative overflow-hidden hover:shadow-[0_0_25px_rgba(0,0,0,0.5)]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-bold text-white text-sm truncate group-hover:text-emerald-400 transition-colors">
                              {project.projectName}
                            </h4>
                            <span className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                              isRunning && "bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse",
                              isSuccess && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                              isFailed  && "bg-red-500/10 text-red-400 border border-red-500/20",
                              project.status === "pending" && "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                            )}>
                              {isRunning ? "● Working" : isSuccess ? "✓ Complete" : isFailed ? "✗ Failed" : "○ Pending"}
                            </span>
                          </div>

                          {project.goal && (
                            <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                              {project.goal}
                            </p>
                          )}

                          <div className="flex items-center space-x-4 pt-2 text-[11px] text-zinc-600 font-mono">
                            <span>Stage: <strong className="text-zinc-400">{project.currentStage}</strong></span>
                            <span>•</span>
                            <span>{project.eventCount} events</span>
                            <span>•</span>
                            <span>{new Date(project.updatedAt).toLocaleTimeString()}</span>
                          </div>
                        </div>

                        <div className="w-8 h-8 rounded-xl bg-white/5 group-hover:bg-emerald-500 group-hover:text-zinc-950 flex items-center justify-center text-zinc-500 transition-all shrink-0">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function NavItem({ icon, label, active = false, count }: { icon: React.ReactNode, label: string, active?: boolean, count?: number }) {
  return (
    <div className={cn(
      "flex items-center space-x-3 px-3.5 py-2.5 rounded-xl cursor-pointer text-xs font-semibold transition-all group",
      active ? "bg-white/5 text-white ring-1 ring-white/10" : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
    )}>
      <div className={cn(
        "transition-colors",
        active ? "text-emerald-400" : "group-hover:text-white"
      )}>
        {icon}
      </div>
      <span className="flex-1">{label}</span>
      {count !== undefined && (
        <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-md">{count}</span>
      )}
      {active && <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_8px_#10b981]" />}
    </div>
  )
}

function StatusMetricCard({ label, value, sub, icon, highlight = false }: { label: string, value: string, sub: string, icon: React.ReactNode, highlight?: boolean }) {
  return (
    <div className={cn(
      "bg-[#0a0a0a]/50 border p-5 rounded-2xl space-y-3 transition-all relative overflow-hidden",
      highlight ? "border-emerald-500/40 bg-emerald-500/[0.02]" : "border-[#141414] hover:border-[#222]"
    )}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{label}</span>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold tracking-tight text-white">{value}</div>
        <div className="text-[11px] text-zinc-500 mt-0.5">{sub}</div>
      </div>
    </div>
  )
}
