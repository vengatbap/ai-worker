import { BaseAgent } from "./BaseAgent"
import { AgentRequest, AgentResponse } from "../../core/interfaces/types"
import { ModelRouterImpl } from "../../core/router/ModelRouterImpl"

export class DeveloperAgent extends BaseAgent {
  private modelRouter: ModelRouterImpl

  constructor() {
    super("Developer", "You are a senior Developer AI. Generate valid multi-file JSON files with code details.")
    this.modelRouter = new ModelRouterImpl()
  }

  async execute(req: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now()
    const { provider, model } = this.modelRouter.route(this.role)

    req.context.logger(`Executing Developer AI using ${provider} / ${model}...`)

    const prompt = `
You are a senior developer. Write clean TypeScript files based on the project goal and architecture details.
Target Goal:
${req.goal}

Expected Output JSON:
{
  "files": [
    {
      "path": "src/utils/helper.ts",
      "content": "export function code..."
    }
  ]
}
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
        generatedArtifacts: ["codebase"],
        logs: [response], // Coder returns raw file payload in logs
        metrics: {
          tokenCount: 0,
          durationMs: Date.now() - startTime
        }
      }
    } catch (err: any) {
      return {
        status: "failed",
        generatedArtifacts: [],
        logs: [`Developer execution failed: ${err.message}`],
        metrics: {
          tokenCount: 0,
          durationMs: Date.now() - startTime
        }
      }
    }
  }
}
