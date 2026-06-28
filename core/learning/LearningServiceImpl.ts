import { LearningService, AppEvent } from "../interfaces/types"
import fs from "fs"
import path from "path"

export class LearningServiceImpl implements LearningService {
  private baseDir: string

  constructor() {
    this.baseDir = path.resolve(process.cwd(), "dataset")
  }

  private getProjectDatasetDir(projectId: string): string {
    const dir = path.join(this.baseDir, projectId)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  async onEvent(event: AppEvent): Promise<void> {
    const projectId = event.payload?.projectId || "global"
    const dir = this.getProjectDatasetDir(projectId)
    
    // Save flat events.jsonl stream
    const eventsFile = path.join(dir, "events.jsonl")
    fs.appendFileSync(eventsFile, JSON.stringify(event) + "\n")

    // Organize specialized subfolders dynamically based on event types
    const eventType = event.type.toLowerCase()
    if (eventType.includes("prompt")) {
      this.writeSubfile(dir, "prompts", `${event.id}.txt`, event.payload?.content || "")
    } else if (eventType.includes("response") || eventType.includes("completion")) {
      this.writeSubfile(dir, "responses", `${event.id}.txt`, event.payload?.content || "")
    } else if (eventType.includes("diff") || eventType.includes("fix")) {
      this.writeSubfile(dir, "diffs", `${event.id}.diff`, event.payload?.content || "")
    } else if (eventType.includes("error") || eventType.includes("compiler")) {
      this.writeSubfile(dir, "compiler", `${event.id}.log`, event.payload?.content || "")
    } else if (eventType.includes("review") || eventType.includes("qa")) {
      this.writeSubfile(dir, "reviews", `${event.id}.txt`, event.payload?.content || "")
    } else if (eventType.includes("metric")) {
      this.writeSubfile(dir, "metrics", `${event.id}.json`, JSON.stringify(event.payload, null, 2))
    } else if (eventType.includes("artifact")) {
      this.writeSubfile(dir, "artifacts", `${event.id}.md`, event.payload?.content || "")
    }
  }

  private writeSubfile(projectDir: string, subfolder: string, filename: string, content: string): void {
    const folder = path.join(projectDir, subfolder)
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true })
    }
    fs.writeFileSync(path.join(folder, filename), content)
  }

  async exportDataset(projectId: string): Promise<string> {
    const dir = this.getProjectDatasetDir(projectId)
    return dir // Returns path to compiled dataset directory
  }
}
