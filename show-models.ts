#!/usr/bin/env node

import { AVAILABLE_MODELS, MODEL_RECOMMENDATIONS } from "./worker/models.ts"

function displayComparison() {
  console.clear()
  console.log("╔════════════════════════════════════════════════════════════════╗")
  console.log("║           AI WORKER - AVAILABLE AI MODELS COMPARISON            ║")
  console.log("╚════════════════════════════════════════════════════════════════╝\n")

  console.log("🟦 OPENAI - High Quality Production Models")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  displayProviderModels("openai", AVAILABLE_MODELS.openai)

  console.log("\n🟨 ANTHROPIC - Expert Reasoning & Analysis")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  displayProviderModels("anthropic", AVAILABLE_MODELS.anthropic)

  console.log("\n🟦 GOOGLE GEMINI - Fast & Cost-Effective")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  displayProviderModels("gemini", AVAILABLE_MODELS.gemini)

  console.log("\n🟩 GROQ - Ultra-Fast & FREE ⚡")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  displayProviderModels("groq", AVAILABLE_MODELS.groq)

  console.log("\n🟪 OLLAMA - Local & Private (FREE) 🔒")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  displayProviderModels("ollama", AVAILABLE_MODELS.ollama)

  console.log("\n\n📊 QUICK RECOMMENDATIONS")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log(`\n⚡ For Speed (FREE):`)
  console.log(`   Provider: ${MODEL_RECOMMENDATIONS["fast-and-cheap"].provider}`)
  console.log(`   Model: ${MODEL_RECOMMENDATIONS["fast-and-cheap"].model}`)

  console.log(`\n⚖️  For Balance:`)
  console.log(`   Provider: ${MODEL_RECOMMENDATIONS.balanced.provider}`)
  console.log(`   Model: ${MODEL_RECOMMENDATIONS.balanced.model}`)

  console.log(`\n🏆 For Best Quality:`)
  console.log(`   Provider: ${MODEL_RECOMMENDATIONS["best-quality"].provider}`)
  console.log(`   Model: ${MODEL_RECOMMENDATIONS["best-quality"].model}`)

  console.log(`\n🔒 For Privacy (LOCAL, FREE):`)
  console.log(`   Provider: ${MODEL_RECOMMENDATIONS["local-free"].provider}`)
  console.log(`   Model: ${MODEL_RECOMMENDATIONS["local-free"].model}`)

  console.log("\n\n📖 TO CONFIGURE A MODEL:")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("   1. Edit .env.local and set:")
  console.log("      AI_PROVIDER=<provider>")
  console.log("      AI_MODEL=<model>")
  console.log("      <API_KEY>=your_key_here")
  console.log("\n   2. Run: npm run worker")
  console.log("\n   3. Or use: npx ts-node configure-ai.ts <provider> <api_key>\n")
}

function displayProviderModels(
  provider: string,
  models: Record<string, { cost: string; speed: string; reasoning: string }>
) {
  Object.entries(models).forEach(([modelId, info]) => {
    const row = `   • ${modelId.padEnd(25)} | Cost: ${info.cost.padEnd(10)} | Speed: ${info.speed.padEnd(10)} | Reasoning: ${info.reasoning}`
    console.log(row)
  })
}

displayComparison()
