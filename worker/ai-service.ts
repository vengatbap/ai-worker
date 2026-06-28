import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

// Dynamic imports for different providers
let openaiClient: any = null
let anthropicClient: any = null
let groqClient: any = null

async function getOpenAIClient() {
  if (!openaiClient) {
    const { default: OpenAI } = await import("openai")
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return openaiClient
}

async function getAnthropicClient() {
  if (!anthropicClient) {
    const { Anthropic } = await import("@anthropic-ai/sdk")
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return anthropicClient
}

async function getGroqClient() {
  if (!groqClient) {
    const { default: Groq } = await import("groq-sdk")
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY })
  }
  return groqClient
}

export async function callAI(
  prompt: string,
  provider: string = process.env.AI_PROVIDER || "openai",
  model: string = process.env.AI_MODEL || "gpt-4o",
  systemPrompt: string = "You are a helpful assistant. Return ONLY valid JSON."
) {
  try {
    if (provider === "openai") {
      const openai = await getOpenAIClient()
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ]
      })
      return response.choices[0].message.content
    }

    if (provider === "anthropic") {
      const anthropic = await getAnthropicClient()
      const response = await anthropic.messages.create({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: "user", content: prompt }
        ]
      })
      return response.content[0].type === "text" ? response.content[0].text : null
    }

    if (provider === "groq") {
      const groq = await getGroqClient()
      const response = await groq.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ]
      })
      return response.choices[0].message.content
    }

    if (provider === "gemini") {
      const { GoogleGenerativeAI } = await import("@google/generative-ai")
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")
      const generativeModel = genAI.getGenerativeModel({ model })
      const result = await generativeModel.generateContent(prompt)
      return result.response.text()
    }

    if (provider === "ollama") {
      const { Ollama } = await import("ollama")
      const ollama = new Ollama({ host: process.env.OLLAMA_HOST || "http://localhost:11434" } as any)
      const response = await (ollama.generate as any)({
        model,
        prompt: `${systemPrompt}\n\n${prompt}`,
        stream: false
      })
      return response.response
    }

    if (provider === "huggingface") {
      const { HfInference } = await import("@huggingface/inference")
      const hf = new HfInference(process.env.HUGGINGFACE_API_KEY || "")
      const response = await hf.textGeneration({
        model,
        inputs: prompt,
        parameters: {
          max_new_tokens: 1024,
          return_full_text: false
        }
      })
      return response.generated_text
    }

    if (provider === "replicate") {
      const Replicate = await import("replicate")
      const output = await (Replicate.default as any).run(
        model,
        {
          input: {
            prompt: prompt,
            system_prompt: systemPrompt
          }
        }
      )
      return Array.isArray(output) ? output.join("") : output
    }

    if (provider === "together") {
      const { default: axios } = await import("axios")
      const response = await axios.post(
        "https://api.together.xyz/inference",
        {
          model: model || "meta-llama/Llama-2-7b-chat-hf",
          prompt: `${systemPrompt}\n\n${prompt}`,
          max_tokens: 1024
        },
        {
          headers: {
            "Authorization": `Bearer ${process.env.TOGETHER_API_KEY}`
          }
        }
      )
      return response.data.output?.choices?.[0]?.text || response.data.output
    }

    if (provider === "mistral") {
      const { default: axios } = await import("axios")
      const response = await axios.post(
        "https://api.mistral.ai/v1/chat/completions",
        {
          model: model || "mistral-tiny",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ]
        },
        {
          headers: {
            "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      )
      return response.data.choices[0].message.content
    }

    if (provider === "cohere") {
      const cohere = await import("cohere-ai")
      const client = cohere.default.init({
        token: process.env.COHERE_API_KEY || ""
      })
      const response = await client.generate({
        model: model || "command-light",
        prompt: `${systemPrompt}\n\n${prompt}`,
        maxTokens: 1024,
        temperature: 0.7
      })
      return response.generations[0].text
    }

    throw new Error(`Unknown provider: ${provider}`)
  } catch (error: any) {
    console.error(`AI call failed with ${provider}/${model}:`, error.message)
    throw error
  }
}

export async function callAIStream(
  prompt: string,
  onChunk: (chunk: string) => void,
  provider: string = process.env.AI_PROVIDER || "openai",
  model: string = process.env.AI_MODEL || "gpt-4o"
) {
  if (provider === "openai") {
    const openai = await getOpenAIClient()
    const stream = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt }
      ],
      stream: true
    })

    for await (const chunk of stream) {
      if (chunk.choices[0].delta.content) {
        onChunk(chunk.choices[0].delta.content)
      }
    }
  } else if (provider === "anthropic") {
    const anthropic = await getAnthropicClient()
    const stream = await anthropic.messages.stream({
      model,
      max_tokens: 4096,
      messages: [
        { role: "user", content: prompt }
      ]
    })

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        onChunk(event.delta.text)
      }
    }
  } else {
    throw new Error(`Streaming not supported for provider: ${provider}`)
  }
}
