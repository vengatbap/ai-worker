import { BaseAgent } from "./BaseAgent"
import { AgentRequest, AgentResponse } from "../../core/interfaces/types"
import { ModelRouterImpl } from "../../core/router/ModelRouterImpl"

export class PlannerAgent extends BaseAgent {
  private modelRouter: ModelRouterImpl

  constructor() {
    super("Planner", "You are a Planner AI. Write clear, structured product specification documents.")
    this.modelRouter = new ModelRouterImpl()
  }

  async execute(req: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now()
    const { provider, model } = this.modelRouter.route(this.role)
    
    req.context.logger(`Executing Planner AI using ${provider} / ${model}...`)

    const prompt = `
You are a senior Product Manager.
Analyze this requirement and output a structured Product Specification document.
Must include: Target Audience, Core Modules list, User flow, and MVP Scope.

Requirement:
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
        generatedArtifacts: ["product-plan"],
        logs: ["Planner successfully generated product-plan specifications."],
        metrics: {
          tokenCount: 0, // In production, parse actual usage
          durationMs: Date.now() - startTime
        }
      }
    } catch (err: any) {
      return {
        status: "failed",
        generatedArtifacts: [],
        logs: [`Planner execution failed: ${err.message}`],
        metrics: {
          tokenCount: 0,
          durationMs: Date.now() - startTime
        }
      }
    }
  }
}
