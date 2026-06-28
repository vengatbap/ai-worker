import { EvaluationService, Artifact, ProviderService } from "../interfaces/types"

export class EvaluationServiceImpl implements EvaluationService {
  private providerService: ProviderService

  constructor(providerService: ProviderService) {
    this.providerService = providerService
  }

  async evaluateArtifact(
    artifact: Artifact,
    criteria: string
  ): Promise<{ passed: boolean; score: number; feedback: string }> {
    
    // Create verification evaluation prompt
    const prompt = `
You are a senior Software Quality Assurance (QA) engineer.
Please evaluate the following artifact against the criteria below.

Artifact Name: ${artifact.name}
Artifact Content:
${artifact.content}

Evaluation Criteria:
${criteria}

Assess if the artifact satisfies the requirements. Give a score from 0 to 100.
Return JSON ONLY:
{
  "passed": true,
  "score": 95,
  "feedback": "Detailed feedback describing matches or gaps"
}
`
    const systemPrompt = "You are a senior QA evaluator. Return ONLY valid JSON."
    
    try {
      const response = await this.providerService.callAI(
        prompt,
        process.env.QA_PROVIDER || "groq",
        process.env.QA_MODEL || "llama-3.3-70b-versatile",
        systemPrompt
      )

      let cleanJson = response || ""
      const jsonMatch = cleanJson.match(/```json\n([\s\S]*?)\n```/)
      if (jsonMatch) {
        cleanJson = jsonMatch[1]
      }

      const data = JSON.parse(cleanJson)
      return {
        passed: data.passed === true || data.passed === "true" || data.score >= 70,
        score: Number(data.score) || 0,
        feedback: data.feedback || "Evaluated successfully."
      }
    } catch (err: any) {
      return {
        passed: false,
        score: 0,
        feedback: `Evaluation failed with error: ${err.message}`
      }
    }
  }
}
