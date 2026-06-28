"use client";

import React, { useState, useEffect } from "react";
import { 
  Activity, 
  Code, 
  Cpu, 
  FileText, 
  GitBranch, 
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
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import axios from "axios";

type TaskStatus = "pending" | "processing" | "success" | "failed";

interface Task {
  id: string;
  name: string;
  status: TaskStatus;
  timestamp: string;
  description: string;
  report?: string;
  error?: string;
}

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [isRoadmapOpen, setIsRoadmapOpen] = useState(false);
  const [generatingRoadmap, setGeneratingRoadmap] = useState(false);
  const [newTaskInput, setNewTaskInput] = useState("");
  const [productIdea, setProductIdea] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Poll Tasks every 3 seconds
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await axios.get("/api/tasks");
        setTasks(res.data.tasks || []);
      } catch (error) {
        console.error("Failed to load tasks:", error);
      } finally {
        setLoadingInitial(false);
      }
    };
    
    fetchTasks();
    const interval = setInterval(fetchTasks, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleLaunchTask = async () => {
    if (!newTaskInput) return;
    setIsNewTaskOpen(false);
    
    try {
      await axios.post("/api/worker", {
        taskContent: newTaskInput,
        taskName: "SaaS Dev Task " + (tasks.length + 1)
      });
      setNewTaskInput("");
    } catch (error: any) {
      console.error("Worker Execution Error:", error);
      alert("Failed to queue task: " + error.message);
    }
  };

  const generateRoadmap = async () => {
    if (!productIdea) return;
    setGeneratingRoadmap(true);
    setIsRoadmapOpen(false);
    try {
      await axios.post("/api/roadmap", { productIdea });
      setProductIdea("");
    } catch (error) {
      console.error("Roadmap generation error:", error);
    } finally {
      setGeneratingRoadmap(false);
    }
  };

  const currentlyProcessing = tasks.find(t => t.status === "processing");
  const completedTasks = tasks.filter(t => t.status === "success");
  const failedTasks = tasks.filter(t => t.status === "failed");

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#1a1a1a] flex flex-col p-4 bg-[#0a0a0a]/50">
        <div className="flex items-center space-x-2 px-2 py-4 border-b border-[#1a1a1a] mb-6">
          <div className="w-8 h-8 bg-emerald-500 rounded-md flex items-center justify-center">
            <Cpu className="w-5 h-5 text-[#050505]" />
          </div>
          <span className="text-xl font-bold tracking-tight">SaaS Builder AI</span>
        </div>

        <nav className="flex-1 space-y-1">
          <NavItem icon={<Activity className="w-4 h-4" />} label="Dashboard" active />
          <NavItem icon={<Code className="w-4 h-4" />} label="Codebase" />
          <NavItem icon={<FileText className="w-4 h-4" />} label="Reports" />
          <NavItem icon={<Globe className="w-4 h-4" />} label="Deployments" />
          <NavItem icon={<Terminal className="w-4 h-4" />} label="Logs" />
        </nav>

        <div className="pt-4 border-t border-[#1a1a1a] text-[10px] text-[#444] px-2 uppercase tracking-widest font-bold">
          Autonomous Loop Active
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-auto bg-[radial-gradient(circle_at_top,_#0f1711_0%,_#050505_40%)]">
        {/* Header */}
        <header className="h-16 border-b border-[#1a1a1a] flex items-center justify-between px-8 bg-[#0a0a0a]/30 backdrop-blur-md sticky top-0 z-10">
          <div className="text-sm text-[#888]">Workspace / <span className="text-white font-medium">Autonomous SaaS Loop</span></div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_5px_#10b981]" />
              <span className="font-semibold uppercase tracking-wider">Loop Runner Active</span>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-8 space-y-12 max-w-7xl mx-auto w-full">
          {/* Active Worker Status */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Worker Status</h2>
              <span className="text-xs text-[#888]">Auto-polling: Active</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatusCard 
                label="Worker Status" 
                value={currentlyProcessing ? "Processing" : "Standby"}
                sub={currentlyProcessing ? `Working on: ${currentlyProcessing.name}` : "Waiting for queued tasks"}
                icon={currentlyProcessing ? <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" /> : <Clock className="w-5 h-5 text-zinc-500" />}
                loading={!!currentlyProcessing}
              />
              <StatusCard 
                label="SaaS Development Tasks" 
                value={`${completedTasks.length}/${tasks.length}`}
                sub="Tasks completed"
                icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              />
              <StatusCard 
                label="Errors Blocked" 
                value={failedTasks.length.toString()}
                sub="Self-corrections logged"
                icon={<AlertCircle className="w-5 h-5 text-amber-500" />}
              />
            </div>
          </section>

          {/* Task Management */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight">SaaS Product Roadmap</h2>
                <p className="text-xs text-[#888]">Tasks queued for execution. The background worker picks them up automatically.</p>
              </div>
              <div className="flex space-x-3">
                <button 
                  onClick={() => setIsRoadmapOpen(true)}
                  disabled={generatingRoadmap}
                  className="bg-[#0a0a0a] border border-[#1a1a1a] hover:border-emerald-500/30 text-zinc-300 text-sm font-semibold px-5 py-2.5 rounded-lg transition-all flex items-center space-x-2 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  <span>{generatingRoadmap ? "Architecting SaaS..." : "Auto-Plan SaaS"}</span>
                </button>
                <button 
                  onClick={() => setIsNewTaskOpen(true)}
                  className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-[#050505] text-sm font-bold px-6 py-2.5 rounded-lg transition-all shadow-[0_4px_14px_rgba(16,185,129,0.4)]"
                >
                  Add Custom Task
                </button>
              </div>
            </div>

            <div className="bg-[#0a0a0a]/60 border border-[#1a1a1a] rounded-2xl overflow-hidden divide-y divide-[#1a1a1a] shadow-xl">
              {loadingInitial ? (
                <div className="p-12 space-y-8">
                   {[1,2,3].map(i => (
                     <div key={i} className="animate-pulse flex items-center space-x-6">
                        <div className="w-12 h-12 bg-white/5 rounded-xl" />
                        <div className="flex-1 space-y-3">
                          <div className="h-5 bg-white/5 rounded-full w-48" />
                          <div className="h-3 bg-white/5 rounded-full w-full opacity-50" />
                        </div>
                     </div>
                   ))}
                </div>
              ) : tasks.length === 0 ? (
                <div className="p-20 flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-20 h-20 bg-emerald-500/5 rounded-full flex items-center justify-center border border-emerald-500/10">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500/20" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-medium">No tasks planned yet</h3>
                    <p className="text-sm text-[#888]">Use Auto-Plan SaaS to generate a customized product specification, architecture layout, and roadmap.</p>
                  </div>
                  <button 
                    onClick={() => setIsRoadmapOpen(true)}
                    className="text-emerald-500 hover:text-emerald-400 font-bold text-sm underline flex items-center space-x-1"
                  >
                    <span>Generate SaaS Roadmap</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                     <thead>
                       <tr className="text-[10px] text-[#555] font-bold uppercase tracking-widest bg-white/[0.02]">
                         <th className="px-6 py-4">Status & Name</th>
                         <th className="px-6 py-4">Requirement / Prompt</th>
                         <th className="px-6 py-4">Status</th>
                         <th className="px-6 py-4 text-right">Details</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-[#181818]">
                        {tasks.map((task) => (
                           <tr 
                             key={task.id} 
                             onClick={() => setSelectedTask(task)}
                             className="hover:bg-white/[0.03] transition-all cursor-pointer group"
                           >
                             <td className="px-6 py-5 whitespace-nowrap">
                               <div className="flex items-center space-x-4">
                                  <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center border",
                                    task.status === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                                    task.status === "processing" ? "bg-amber-500/10 border-amber-500/20 text-amber-500 animate-pulse" :
                                    task.status === "failed" ? "bg-red-500/10 border-red-500/20 text-red-500" :
                                    "bg-zinc-500/10 border-zinc-500/20 text-zinc-500"
                                  )}>
                                     {task.status === "success" ? <CheckCircle2 className="w-5 h-5" /> : 
                                      task.status === "processing" ? <Loader2 className="w-5 h-5 animate-spin" /> :
                                      task.status === "failed" ? <AlertCircle className="w-5 h-5" /> :
                                      <Clock className="w-5 h-5" />}
                                  </div>
                                  <span className="font-semibold text-zinc-100">{task.name}</span>
                               </div>
                             </td>
                             <td className="px-6 py-5">
                               <span className="text-xs text-zinc-500 line-clamp-1 group-hover:text-zinc-400 transition-colors">{task.description}</span>
                             </td>
                             <td className="px-6 py-5 text-xs font-bold uppercase tracking-wider">
                               <span className={cn(
                                 task.status === "success" ? "text-emerald-500" :
                                 task.status === "processing" ? "text-amber-500" :
                                 task.status === "failed" ? "text-red-500" : "text-zinc-600"
                               )}>
                                 {task.status}
                               </span>
                             </td>
                             <td className="px-6 py-5 text-right">
                               <ChevronRight className="w-4 h-4 text-zinc-700 ml-auto group-hover:text-emerald-500 transition-colors" />
                             </td>
                           </tr>
                        ))}
                     </tbody>
                   </table>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Slide-over details modal */}
      <AnimatePresence>
        {selectedTask && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTask(null)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full max-w-xl h-full bg-[#0a0a0a] border-l border-[#1a1a1a] p-8 shadow-2xl flex flex-col overflow-auto z-10"
            >
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#1a1a1a]">
                <h3 className="text-xl font-bold">{selectedTask.name}</h3>
                <button onClick={() => setSelectedTask(null)} className="p-1 hover:bg-white/5 rounded-md text-zinc-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6 flex-1">
                <div>
                  <h4 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Status</h4>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border",
                    selectedTask.status === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                    selectedTask.status === "processing" ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                    selectedTask.status === "failed" ? "bg-red-500/10 border-red-500/20 text-red-500" :
                    "bg-zinc-500/10 border-zinc-500/20 text-zinc-500"
                  )}>
                    {selectedTask.status}
                  </span>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Task Prompt</h4>
                  <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{selectedTask.description}</p>
                </div>

                {selectedTask.report && (
                  <div>
                    <h4 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Execution Report</h4>
                    <pre className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-4 text-xs text-emerald-400 font-mono overflow-auto max-h-60 leading-relaxed whitespace-pre-wrap">
                      {selectedTask.report}
                    </pre>
                  </div>
                )}

                {selectedTask.error && (
                  <div>
                    <h4 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Compilation Errors</h4>
                    <pre className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-4 text-xs text-red-400 font-mono overflow-auto max-h-60 leading-relaxed whitespace-pre-wrap">
                      {selectedTask.error}
                    </pre>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Task Modal */}
      <AnimatePresence>
        {isNewTaskOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNewTaskOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="relative w-full max-w-2xl bg-[#0a0a0a] border border-[#1a1a1a] rounded-[2rem] p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16" />
              
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center space-x-3 mb-8">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                    <Cpu className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold tracking-tight">Assign Intelligence Task</h3>
                    <p className="text-xs text-[#666] uppercase tracking-widest font-bold">Worker Node: MAIN-CORE-01</p>
                  </div>
                </div>

                <div className="flex-1 space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-[#555] uppercase tracking-[0.2em] ml-2">Task Directives</label>
                      <textarea 
                        autoFocus
                        value={newTaskInput}
                        onChange={(e) => setNewTaskInput(e.target.value)}
                        placeholder="e.g., Engineer a new modular sidebar with Framer Motion animations..."
                        className="w-full h-48 bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-6 text-sm focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 resize-none transition-all placeholder:text-zinc-800 leading-relaxed shadow-inner"
                      />
                   </div>
                </div>

                <div className="mt-10 flex items-center justify-between border-t border-[#1a1a1a] pt-6">
                  <p className="text-xs text-[#444] tracking-tight">AI will generate Spec, Code, and Tests automatically.</p>
                  <div className="flex space-x-4">
                    <button 
                      onClick={() => setIsNewTaskOpen(false)}
                      className="px-6 py-2.5 text-sm font-semibold text-[#888] hover:text-white transition-colors"
                    >
                      Abort
                    </button>
                    <button 
                      onClick={handleLaunchTask}
                      className="bg-zinc-100 hover:bg-white text-[#050505] text-sm font-extrabold px-8 py-2.5 rounded-xl transition-all flex items-center space-x-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>Queue Task</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Auto-Plan SaaS Roadmap Generator Modal */}
      <AnimatePresence>
        {isRoadmapOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRoadmapOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="relative w-full max-w-2xl bg-[#0a0a0a] border border-[#1a1a1a] rounded-[2rem] p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16" />
              
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center space-x-3 mb-8">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                    <Sparkles className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold tracking-tight">Architect SaaS Product</h3>
                    <p className="text-xs text-[#666] uppercase tracking-widest font-bold">Plan product, modules, and file architecture</p>
                  </div>
                </div>

                <div className="flex-1 space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-[#555] uppercase tracking-[0.2em] ml-2">What product do you want the AI employee to build?</label>
                      <textarea 
                        autoFocus
                        value={productIdea}
                        onChange={(e) => setProductIdea(e.target.value)}
                        placeholder="e.g. An AI-powered SaaS chatbot that embeds on target websites, has a settings dashboard for training data, and Stripe subscription tiers for premium limits..."
                        className="w-full h-48 bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-6 text-sm focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 resize-none transition-all placeholder:text-zinc-800 leading-relaxed shadow-inner"
                      />
                   </div>
                </div>

                <div className="mt-10 flex items-center justify-between border-t border-[#1a1a1a] pt-6">
                  <p className="text-xs text-[#444] tracking-tight">AI writes architecture specs and outputs task lists.</p>
                  <div className="flex space-x-4">
                    <button 
                      onClick={() => setIsRoadmapOpen(false)}
                      className="px-6 py-2.5 text-sm font-semibold text-[#888] hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={generateRoadmap}
                      disabled={!productIdea}
                      className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-[#050505] text-sm font-extrabold px-8 py-2.5 rounded-xl transition-all flex items-center space-x-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Start Planning</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <div className={cn(
      "flex items-center space-x-3 px-4 py-3 rounded-xl cursor-pointer text-sm font-semibold transition-all group",
      active ? "bg-white/5 text-white ring-1 ring-white/10" : "text-[#555] hover:text-[#bbb] hover:bg-white/5"
    )}>
      <div className={cn(
        "transition-colors",
        active ? "text-emerald-500" : "group-hover:text-white"
      )}>
        {icon}
      </div>
      <span>{label}</span>
      {active && <div className="ml-auto w-1 h-1 bg-emerald-500 rounded-full shadow-[0_0_5px_#10b981]" />}
    </div>
  );
}

function StatusCard({ label, value, sub, icon, loading = false }: { label: string, value: string, sub: string, icon: React.ReactNode, loading?: boolean }) {
  return (
    <div className="bg-[#0a0a0a]/40 border border-[#1a1a1a] p-6 rounded-[1.5rem] space-y-6 hover:border-emerald-500/20 transition-all group relative overflow-hidden">
      <div className="absolute top-0 right-0 p-6 opacity-5">
        {icon}
      </div>
      <div className="flex items-center space-x-2">
        <div className="w-1.5 h-4 bg-emerald-500/20 rounded-full" />
        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">{label}</span>
      </div>
      <div>
        <div className="text-3xl font-bold tracking-tighter text-zinc-100">{value}</div>
        <div className="text-[11px] text-[#555] font-medium uppercase tracking-tight mt-1">{sub}</div>
      </div>
      {loading && (
        <div className="h-1 bg-[#111] rounded-full overflow-hidden mt-2">
           <motion.div 
             initial={{ x: "-100%" }}
             animate={{ x: "100%" }}
             transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
             className="w-1/2 h-full bg-emerald-500" 
           />
        </div>
      )}
    </div>
  );
}
