import { WorkspaceService } from "../interfaces/types"
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

  async initializeWorkspace(projectId: string): Promise<string> {
    const dir = this.getProjectDir(projectId)
    
    // Initialize default context and memory files if they don't exist
    const contextFile = path.join(dir, "context.json")
    if (!fs.existsSync(contextFile)) {
      fs.writeFileSync(contextFile, JSON.stringify({ projectId, variables: {} }, null, 2))
    }

    const memoryFile = path.join(dir, "memory.json")
    if (!fs.existsSync(memoryFile)) {
      fs.writeFileSync(memoryFile, JSON.stringify([], null, 2))
    }

    return projectId // For local workspace, ID matches projectId
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
}
