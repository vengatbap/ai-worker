import { ModelRouter } from "../interfaces/types"
import fs from "fs"
import path from "path"

export class ModelRouterImpl implements ModelRouter {
  private tokenCount = 0
  private costUsd = 0
  private profiles: Record<string, any>

  constructor() {
    try {
      const file1 = path.resolve(process.cwd(), "core/router/profiles.json")
      if (fs.existsSync(file1)) {
        this.profiles = JSON.parse(fs.readFileSync(file1, "utf-8"))
      } else {
        const file2 = path.resolve(__dirname, "profiles.json")
        this.profiles = JSON.parse(fs.readFileSync(file2, "utf-8"))
      }
    } catch {
      this.profiles = {}
    }
  }

  route(agentRole: string): { provider: string; model: string } {
    const roleLower = agentRole.toLowerCase()
    const profile = this.profiles[roleLower]

    if (profile && profile.preferred && profile.preferred.length > 0) {
      // Pick first preferred provider/model
      return profile.preferred[0]
    }

    // Default fallback if profile is missing
    const provider = process.env.AI_PROVIDER || "groq"
    const model = process.env.AI_MODEL || "llama-3.3-70b-versatile"
    return { provider, model }
  }

  trackUsage(tokens: number, cost: number): void {
    this.tokenCount += tokens
    this.costUsd += cost
  }

  getMetrics(): { tokenCount: number; costUsd: number } {
    return {
      tokenCount: this.tokenCount,
      costUsd: this.costUsd
    }
  }
}
