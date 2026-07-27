import { WorkspaceService, WorkspaceState, WorkspaceStatus, SnapshotMetadata } from "../interfaces/types"
import fs from "fs"
import path from "path"

export class WorkspaceServiceImpl implements WorkspaceService {
  private baseDir: string

  constructor() {
    this.baseDir = path.resolve(process.cwd(), "workspace")
  }

  private getProjectDir(projectId: string): string {
    const dir = path.join(this.baseDir, projectId)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  private getAiMetadataDir(projectId: string): string {
    const dir = path.join(this.getProjectDir(projectId), ".ai")
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  async initializeWorkspace(projectId: string): Promise<string> {
    const projectDir = this.getProjectDir(projectId)
    
    // Create actual generated application repository folder
    const repoDir = path.join(projectDir, "repository")
    if (!fs.existsSync(repoDir)) {
      fs.mkdirSync(repoDir, { recursive: true })
    }

    // Create OS-controlled .ai metadata directory structure
    const aiDir = this.getAiMetadataDir(projectId)
    const subdirs = ["state", "tasks", "snapshots", "memory", "decisions", "permissions", "recovery"]
    for (const sub of subdirs) {
      const subPath = path.join(aiDir, sub)
      if (!fs.existsSync(subPath)) {
        fs.mkdirSync(subPath, { recursive: true })
      }
    }

    // Initialize status.json if not present
    const statusFile = path.join(aiDir, "state/status.json")
    if (!fs.existsSync(statusFile)) {
      const initialStatus: WorkspaceStatus = {
        projectId,
        state: "READY",
        currentVersion: 0,
        lastUpdated: new Date().toISOString()
      }
      fs.writeFileSync(statusFile, JSON.stringify(initialStatus, null, 2))
    }

    // Initialize default context and memory files
    const contextFile = path.join(projectDir, "context.json")
    if (!fs.existsSync(contextFile)) {
      fs.writeFileSync(contextFile, JSON.stringify({ projectId, variables: {} }, null, 2))
    }

    const memoryFile = path.join(projectDir, "memory.json")
    if (!fs.existsSync(memoryFile)) {
      fs.writeFileSync(memoryFile, JSON.stringify([], null, 2))
    }

    return projectId
  }

  async getContext(workspaceId: string): Promise<Record<string, any>> {
    const dir = this.getProjectDir(workspaceId)
    const file = path.join(dir, "context.json")
    if (!fs.existsSync(file)) return {}
    try {
      return JSON.parse(fs.readFileSync(file, "utf-8"))
    } catch {
      return {}
    }
  }

  async saveContext(workspaceId: string, data: Record<string, any>): Promise<void> {
    const dir = this.getProjectDir(workspaceId)
    const file = path.join(dir, "context.json")
    fs.writeFileSync(file, JSON.stringify(data, null, 2))
  }

  async getMemory(workspaceId: string): Promise<any[]> {
    const dir = this.getProjectDir(workspaceId)
    const file = path.join(dir, "memory.json")
    if (!fs.existsSync(file)) return []
    try {
      return JSON.parse(fs.readFileSync(file, "utf-8"))
    } catch {
      return []
    }
  }

  async addMemory(workspaceId: string, entry: any): Promise<void> {
    const memory = await this.getMemory(workspaceId)
    memory.push({
      ...entry,
      timestamp: new Date().toISOString()
    })
    const dir = this.getProjectDir(workspaceId)
    const file = path.join(dir, "memory.json")
    fs.writeFileSync(file, JSON.stringify(memory, null, 2))
  }

  // OS-owned transactional workspace manager methods
  async getWorkspaceStatus(projectId: string): Promise<WorkspaceStatus> {
    const aiDir = this.getAiMetadataDir(projectId)
    const statusFile = path.join(aiDir, "state/status.json")
    if (!fs.existsSync(statusFile)) {
      return {
        projectId,
        state: "READY",
        currentVersion: 0,
        lastUpdated: new Date().toISOString()
      }
    }
    return JSON.parse(fs.readFileSync(statusFile, "utf-8"))
  }

  async updateWorkspaceState(projectId: string, state: WorkspaceState, lockedByTask?: string): Promise<void> {
    const aiDir = this.getAiMetadataDir(projectId)
    const statusFile = path.join(aiDir, "state/status.json")
    const current = await this.getWorkspaceStatus(projectId)
    
    const updated: WorkspaceStatus = {
      ...current,
      state,
      lockedByTask: lockedByTask !== undefined ? lockedByTask : current.lockedByTask,
      lastUpdated: new Date().toISOString()
    }
    fs.writeFileSync(statusFile, JSON.stringify(updated, null, 2))
  }

  async incrementWorkspaceVersion(projectId: string): Promise<number> {
    const aiDir = this.getAiMetadataDir(projectId)
    const statusFile = path.join(aiDir, "state/status.json")
    const current = await this.getWorkspaceStatus(projectId)
    
    const newVersion = current.currentVersion + 1
    const updated: WorkspaceStatus = {
      ...current,
      currentVersion: newVersion,
      lastUpdated: new Date().toISOString()
    }
    fs.writeFileSync(statusFile, JSON.stringify(updated, null, 2))
    return newVersion
  }

  async createSnapshot(projectId: string, taskId: string, reason: string): Promise<string> {
    const aiDir = this.getAiMetadataDir(projectId)
    const snapshotDir = path.join(aiDir, "snapshots", taskId)
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true })
    }

    const repoDir = path.join(this.getProjectDir(projectId), "repository")
    const snapshotRepoDir = path.join(snapshotDir, "repository")
    
    // Copy current repository files
    this.copyDirectory(repoDir, snapshotRepoDir)

    // Write snapshot.json metadata
    const current = await this.getWorkspaceStatus(projectId)
    const metadata: SnapshotMetadata = {
      projectId,
      taskId,
      createdAt: new Date().toISOString(),
      reason,
      previousTask: current.lockedByTask || "",
      workspaceVersion: current.currentVersion,
      status: "valid"
    }

    fs.writeFileSync(path.join(snapshotDir, "snapshot.json"), JSON.stringify(metadata, null, 2))
    return snapshotDir
  }

  async restoreSnapshot(projectId: string, taskId: string): Promise<void> {
    const aiDir = this.getAiMetadataDir(projectId)
    const snapshotDir = path.join(aiDir, "snapshots", taskId)
    if (!fs.existsSync(snapshotDir)) {
      throw new Error(`Snapshot restore failed: Snapshot folder not found at ${snapshotDir}`)
    }

    const repoDir = path.join(this.getProjectDir(projectId), "repository")
    const snapshotRepoDir = path.join(snapshotDir, "repository")

    // Clear current repository
    this.deleteDirectory(repoDir)
    fs.mkdirSync(repoDir, { recursive: true })

    // Copy snapshot back
    this.copyDirectory(snapshotRepoDir, repoDir)
  }

  async verifyWorkspace(projectId: string): Promise<boolean> {
    const projectDir = this.getProjectDir(projectId)
    const repoDir = path.join(projectDir, "repository")
    
    // Enforce folder structure verification checks
    if (!fs.existsSync(repoDir)) return false
    
    const aiDir = this.getAiMetadataDir(projectId)
    const statusFile = path.join(aiDir, "state/status.json")
    if (!fs.existsSync(statusFile)) return false

    return true
  }

  async acquireLock(projectId: string, taskId: string): Promise<boolean> {
    const status = await this.getWorkspaceStatus(projectId)
    if (status.state === "LOCKED" && status.lockedByTask !== taskId) {
      return false
    }

    await this.updateWorkspaceState(projectId, "LOCKED", taskId)
    return true
  }

  async releaseLock(projectId: string, taskId: string): Promise<void> {
    const status = await this.getWorkspaceStatus(projectId)
    if (status.lockedByTask === taskId) {
      await this.updateWorkspaceState(projectId, "READY", "")
    }
  }

  // Helper copy directory recursively
  private copyDirectory(src: string, dest: string) {
    if (!fs.existsSync(src)) return
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true })
    }

    const entries = fs.readdirSync(src, { withFileTypes: true })
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        this.copyDirectory(srcPath, destPath)
      } else {
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }

  // Helper delete directory recursively
  private deleteDirectory(dir: string) {
    if (!fs.existsSync(dir)) return
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        this.deleteDirectory(entryPath)
      } else {
        fs.unlinkSync(entryPath)
      }
    }
    fs.rmdirSync(dir)
  }
}
