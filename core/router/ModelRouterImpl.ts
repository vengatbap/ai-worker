import { ModelRouter } from "../interfaces/types"

export class ModelRouterImpl implements ModelRouter {
  private tokenCount = 0
  private costUsd = 0

  route(agentRole: string): { provider: string; model: string } {
    const roleUpper = agentRole.toUpperCase()
    
    // Resolve dynamically from environment, e.g. PLANNER_PROVIDER, PLANNER_MODEL
    const provider = process.env[`${roleUpper}_PROVIDER`] || process.env.AI_PROVIDER || "groq"
    const model = process.env[`${roleUpper}_MODEL`] || process.env.AI_MODEL || "llama-3.3-70b-versatile"

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
