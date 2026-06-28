import { BaseAgent } from "./BaseAgent"
import { AgentRequest, AgentResponse } from "../../core/interfaces/types"
import { ModelRouterImpl } from "../../core/router/ModelRouterImpl"

export class ArchitectAgent extends BaseAgent {
  private modelRouter: ModelRouterImpl

  constructor() {
    super("Architect", "You are a SaaS Architect AI. Output detailed code architecture trees and database schemas.")
    this.modelRouter = new ModelRouterImpl()
  }

  async execute(req: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now()
    const { provider, model } = this.modelRouter.route(this.role)

    req.context.logger(`Executing Architect AI using ${provider} / ${model}...`)

    const prompt = `
You are a senior Software Architect.
Analyze the target plan and generate a detailed Code Architecture blueprint.
Must define: File directory layouts, database schema tables, API contracts, and third party package choices.

Plan details:
${req.goal}
`
    try {
      const response = await this.providerService.callAI(
        prompt,
        provider,
        model,
        this.systemPrompt
      )

      return {
        status: "success",
        generatedArtifacts: ["architecture"],
        logs: ["Architect successfully generated codebase blueprint details."],
        metrics: {
          tokenCount: 0,
          durationMs: Date.now() - startTime
        }
      }
    } catch (err: any) {
      return {
        status: "failed",
        generatedArtifacts: [],
        logs: [`Architect execution failed: ${err.message}`],
        metrics: {
          tokenCount: 0,
          durationMs: Date.now() - startTime
        }
      }
    }
  }
}
