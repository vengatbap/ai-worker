import { BaseAgent } from "./BaseAgent"
import { AgentRequest, AgentResponse } from "../../core/interfaces/types"
import { ModelRouterImpl } from "../../core/router/ModelRouterImpl"

export class QAAgent extends BaseAgent {
  private modelRouter: ModelRouterImpl

  constructor() {
    super("QA", "You are a QA AI. Analyze compiler test errors and review test suites coverage.")
    this.modelRouter = new ModelRouterImpl()
  }

  async execute(req: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now()
    const { provider, model } = this.modelRouter.route(this.role)

    req.context.logger(`Executing QA AI using ${provider} / ${model}...`)

    const prompt = `
You are a senior Quality Assurance Engineer.
Review the compiler/test logs below and propose fixes for bugs or type mismatches.

Logs:
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
        generatedArtifacts: ["qa-report"],
        logs: [response],
        metrics: {
          tokenCount: 0,
          durationMs: Date.now() - startTime
        }
      }
    } catch (err: any) {
      return {
        status: "failed",
        generatedArtifacts: [],
        logs: [`QA validation failed: ${err.message}`],
        metrics: {
          tokenCount: 0,
          durationMs: Date.now() - startTime
        }
      }
    }
  }
}
