#!/usr/bin/env node

import { execSync } from "child_process"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PROVIDERS = {
  openai: {
    package: "openai",
    name: "OpenAI GPT-4o",
    description: "High-quality code generation",
    env: "OPENAI_API_KEY"
  },
  anthropic: {
    package: "@anthropic-ai/sdk",
    name: "Anthropic Claude",
    description: "Best reasoning and code understanding",
    env: "ANTHROPIC_API_KEY"
  },
  gemini: {
    package: "@google/generative-ai",
    name: "Google Gemini",
    description: "Fast and cost-effective",
    env: "GEMINI_API_KEY"
  },
  groq: {
    package: "groq-sdk",
    name: "Groq (Ultra-Fast, FREE)",
    description: "25x faster, completely free",
    env: "GROQ_API_KEY"
  },
  ollama: {
    package: "ollama",
    name: "Ollama (Local, FREE)",
    description: "Private, offline, zero cost",
    env: "OLLAMA_HOST"
  },
  huggingface: {
    package: "@huggingface/inference",
    name: "Hugging Face (FREE Tier)",
    description: "Access to 300,000+ models, free tier available",
    env: "HUGGINGFACE_API_KEY"
  },
  replicate: {
    package: "replicate",
    name: "Replicate (FREE Credits)",
    description: "Run models in the cloud, free tier with credits",
    env: "REPLICATE_API_KEY"
  },
  together: {
    package: "together-ai",
    name: "Together AI (FREE Tier)",
    description: "Ultra-fast inference, free tier available",
    env: "TOGETHER_API_KEY"
  },
  mistral: {
    package: "mistralai",
    name: "Mistral AI (FREE Tier)",
    description: "Open models with free tier pricing",
    env: "MISTRAL_API_KEY"
  },
  cohere: {
    package: "cohere-ai",
    name: "Cohere (FREE Tier)",
    description: "Production-ready models, free tier for testing",
    env: "COHERE_API_KEY"
  }
}

function showMenu() {
  console.log("\n🤖 AI Worker - Model Configuration\n")
  console.log("Choose an AI provider:\n")
  Object.entries(PROVIDERS).forEach(([key, value], index) => {
    console.log(`${index + 1}. ${value.name}`)
    console.log(`   ${value.description}\n`)
  })
}

function installProvider(provider: keyof typeof PROVIDERS) {
  const providerInfo = PROVIDERS[provider]
  if (!providerInfo) {
    console.error(`❌ Unknown provider: ${provider}`)
    return false
  }

  console.log(`\n📦 Installing ${providerInfo.name}...`)
  try {
    execSync(`npm install ${providerInfo.package}`, { stdio: "inherit" })
    console.log(`✅ ${providerInfo.name} installed successfully!`)
    return true
  } catch (error) {
    console.error(`❌ Failed to install ${providerInfo.name}`)
    return false
  }
}

function updateEnv(provider: string, apiKey: string | null = null) {
  const envPath = path.resolve(__dirname, ".env.local")
  let envContent = fs.readFileSync(envPath, "utf-8")

  // Update AI_PROVIDER
  envContent = envContent.replace(
    /AI_PROVIDER=.*/,
    `AI_PROVIDER=${provider}`
  )

  // Update AI_MODEL based on provider
  const modelMap: Record<string, string> = {
    openai: "gpt-4o",
    anthropic: "claude-3-sonnet",
    gemini: "gemini-1.5-flash",
    groq: "mixtral-8x7b-32768",
    ollama: "mistral"
  }

  envContent = envContent.replace(
    /AI_MODEL=.*/,
    `AI_MODEL=${modelMap[provider]}`
  )

  // Add API key if provided
  if (apiKey) {
    const providerInfo = (PROVIDERS as Record<string, any>)[provider]
    const envVar = providerInfo.env
    const pattern = new RegExp(`${envVar}=.*`, "i")
    if (pattern.test(envContent)) {
      envContent = envContent.replace(pattern, `${envVar}=${apiKey}`)
    } else {
      envContent += `\n${envVar}=${apiKey}`
    }
  }

  fs.writeFileSync(envPath, envContent)
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    showMenu()
    console.log("Usage: npx node configure-ai.ts <provider> [api_key]")
    console.log("Example: npx node configure-ai.ts groq")
    console.log("Example: npx node configure-ai.ts openai sk-proj-xxxxx\n")
    return
  }

  const provider = args[0].toLowerCase()

  if (!PROVIDERS[provider]) {
    console.error(`❌ Unknown provider: ${provider}`)
    console.log("\nAvailable providers:")
    Object.keys(PROVIDERS).forEach(p => console.log(`  - ${p}`))
    return
  }

  const apiKey = args[1] || null

  console.log(`\n🔧 Configuring ${PROVIDERS[provider].name}...`)

  // Install package
  if (!installProvider(provider)) {
    return
  }

  // Update .env.local
  updateEnv(provider, apiKey)

  console.log(`\n✅ Configuration complete!`)
  console.log(`\n📝 Current configuration:`)
  console.log(`   Provider: ${provider}`)
  console.log(`   Model: ${["openai", "anthropic", "gemini", "groq", "ollama"].includes(provider) ? "Auto-selected" : "N/A"}`)
  
  if (!apiKey && PROVIDERS[provider].env !== "OLLAMA_HOST") {
    console.log(`\n⚠️  API Key not provided. Please add your ${PROVIDERS[provider].env} to .env.local`)
  }

  console.log(`\n🚀 Run with: npm run worker\n`)
}

main().catch(console.error)
