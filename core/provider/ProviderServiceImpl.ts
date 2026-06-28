import { ProviderService } from "../interfaces/types"
import { callAI } from "../../worker/ai-service"

export class ProviderServiceImpl implements ProviderService {
  async callAI(
    prompt: string,
    provider: string,
    model: string,
    systemPrompt?: string
  ): Promise<string> {
    const result = await callAI(prompt, provider, model, systemPrompt)
    if (!result) {
      throw new Error(`AI call returned empty response for provider ${provider} / model ${model}`)
    }
    return result
  }
}
