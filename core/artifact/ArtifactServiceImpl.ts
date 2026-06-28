import { ArtifactService, Artifact, ArtifactStatus, ArtifactMetadata } from "../interfaces/types"
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
    metadata: ArtifactMetadata
  ): Promise<Artifact> {
    const registry = this.getRegistry(projectId)
    const history = registry[name] || []

    const newArtifact: Artifact = {
      id: `${name}-v${metadata.version}`,
      name,
      version: metadata.version,
      content,
      timestamp: new Date().toISOString(),
      metadata
    }

    history.push(newArtifact)
    registry[name] = history
    this.saveRegistry(projectId, registry)

    // Save individual version file as backup
    const dir = this.getArtifactsDir(projectId)
    const versionFile = path.join(dir, `${name.replace(/[^a-zA-Z0-9]/g, "_")}_v${metadata.version}.json`)
    fs.writeFileSync(versionFile, JSON.stringify(newArtifact, null, 2))

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

  async updateArtifactStatus(projectId: string, name: string, version: number, status: ArtifactStatus): Promise<void> {
    const registry = this.getRegistry(projectId)
    const history = registry[name]
    if (!history) return

    const artifact = history.find(a => a.version === version)
    if (artifact) {
      artifact.metadata.status = status
      this.saveRegistry(projectId, registry)

      // Also rewrite the individual file copy
      const dir = this.getArtifactsDir(projectId)
      const versionFile = path.join(dir, `${name.replace(/[^a-zA-Z0-9]/g, "_")}_v${version}.json`)
      if (fs.existsSync(versionFile)) {
        fs.writeFileSync(versionFile, JSON.stringify(artifact, null, 2))
      }
    }
  }
}
