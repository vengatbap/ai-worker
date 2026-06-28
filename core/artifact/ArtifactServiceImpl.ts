import { ArtifactService, Artifact } from "../interfaces/types"
import fs from "fs"
import path from "path"

export class ArtifactServiceImpl implements ArtifactService {
  private baseDir: string

  constructor() {
    this.baseDir = path.resolve(process.cwd(), "workspace")
  }

  private getArtifactsDir(projectId: string): string {
    const dir = path.join(this.baseDir, projectId, "artifacts")
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  private getRegistry(projectId: string): Record<string, Artifact[]> {
    const dir = this.getArtifactsDir(projectId)
    const file = path.join(dir, "registry.json")
    if (!fs.existsSync(file)) return {}
    try {
      return JSON.parse(fs.readFileSync(file, "utf-8"))
    } catch {
      return {}
    }
  }

  private saveRegistry(projectId: string, registry: Record<string, Artifact[]>): void {
    const dir = this.getArtifactsDir(projectId)
    const file = path.join(dir, "registry.json")
    fs.writeFileSync(file, JSON.stringify(registry, null, 2))
  }

  async saveArtifact(
    projectId: string,
    name: string,
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<Artifact> {
    const registry = this.getRegistry(projectId)
    const history = registry[name] || []
    const nextVersion = history.length + 1

    const newArtifact: Artifact = {
      id: `${name}-v${nextVersion}`,
      name,
      version: nextVersion,
      content,
      timestamp: new Date().toISOString(),
      metadata
    }

    history.push(newArtifact)
    registry[name] = history
    this.saveRegistry(projectId, registry)

    // Save individual version file as backup
    const dir = this.getArtifactsDir(projectId)
    const versionFile = path.join(dir, `${name.replace(/[^a-zA-Z0-9]/g, "_")}_v${nextVersion}.md`)
    fs.writeFileSync(versionFile, content)

    return newArtifact
  }

  async getArtifact(projectId: string, name: string, version?: number): Promise<Artifact | null> {
    const registry = this.getRegistry(projectId)
    const history = registry[name]
    if (!history || history.length === 0) return null

    if (version === undefined) {
      return history[history.length - 1] // Return latest version
    }

    const artifact = history.find(a => a.version === version)
    return artifact || null
  }

  async listArtifacts(projectId: string): Promise<Artifact[]> {
    const registry = this.getRegistry(projectId)
    const list: Artifact[] = []
    for (const name in registry) {
      const history = registry[name]
      if (history && history.length > 0) {
        list.push(history[history.length - 1]) // Get latest of each
      }
    }
    return list
  }
}
