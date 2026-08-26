"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

interface Project {
  projectId:    string
  projectName:  string
  currentStage: string
  status:       "running" | "completed" | "failed" | "pending"
  updatedAt:    string
  goal:         string
  eventCount:   number
}

const STATUS_BADGE: Record<Project["status"], { label: string; className: string }> = {
  running:   { label: "● Working",   className: "text-blue-400"  },
  completed: { label: "✓ Complete",  className: "text-green-400" },
  failed:    { label: "✗ Failed",    className: "text-red-400"   },
  pending:   { label: "○ Pending",   className: "text-zinc-400"  },
}

export default function HomePage() {
  const [projects, setProjects]   = useState<Project[]>([])
  const [loading, setLoading]     = useState(true)
  const [goal, setGoal]           = useState("")
  const [projectName, setProjectName] = useState("")
  const [starting, setStarting]   = useState(false)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/workspace/projects")
      .then(r => r.json())
      .then(d => setProjects(d.projects || []))
      .catch(console.error)
      .finally(() => setLoading(false))
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-800 px-8 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">AI Software Engineering OS</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Your AI engineering team, ready to build.</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-12">
        {/* New project */}
        <div className="mb-12">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
            What should we build?
          </h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <input
              type="text"
              placeholder="Project name (optional)"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
            />
            <textarea
              placeholder="Describe what your engineering team should build..."
              value={goal}
              onChange={e => setGoal(e.target.value)}
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 resize-none"
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleStart() }}
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500">⌘ + Enter to start</p>
              <button
                onClick={handleStart}
                disabled={!goal.trim() || starting}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
              >
                {starting ? "Starting..." : "Start Building →"}
              </button>
            </div>
          </div>
        </div>

        {/* Project list */}
        <div>
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
            Engineering Projects
          </h2>
          {loading ? (
            <div className="text-sm text-zinc-500">Loading projects...</div>
          ) : projects.length === 0 ? (
            <div className="text-sm text-zinc-500">
              No projects yet. Ask your engineering team to start building above.
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map(project => {
                const badge = STATUS_BADGE[project.status]
                return (
                  <Link
                    key={project.projectId}
                    href={`/workspace/${project.projectId}`}
                    className="block bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium text-zinc-100 truncate">
                            {project.projectName}
                          </h3>
                          <span className={`text-xs font-medium shrink-0 ${badge.className}`}>
                            {badge.label}
                          </span>
                        </div>
                        {project.goal && (
                          <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{project.goal}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-zinc-600">
                          <span>Stage: {project.currentStage}</span>
                          <span>{project.eventCount} events</span>
                          <span>{new Date(project.updatedAt).toLocaleString()}</span>
                        </div>
                      </div>
                      <span className="text-zinc-600 text-lg shrink-0">→</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
