// Supported AI Model Providers
export type ModelProvider = 'openai' | 'anthropic' | 'gemini' | 'groq' | 'ollama' | 'huggingface' | 'replicate' | 'together' | 'mistral' | 'cohere'

export interface AIConfig {
  provider: ModelProvider
  model: string
  apiKey?: string
  baseUrl?: string
}

export const AVAILABLE_MODELS = {
  openai: {
    'gpt-4o': { name: 'GPT-4 Optimized', cost: 'high', speed: 'fast', reasoning: 'excellent' },
    'gpt-4-turbo': { name: 'GPT-4 Turbo', cost: 'high', speed: 'fast', reasoning: 'excellent' },
    'gpt-3.5-turbo': { name: 'GPT-3.5 Turbo', cost: 'low', speed: 'very-fast', reasoning: 'good' }
  },
  anthropic: {
    'claude-3-opus': { name: 'Claude 3 Opus', cost: 'medium', speed: 'moderate', reasoning: 'excellent' },
    'claude-3-sonnet': { name: 'Claude 3 Sonnet', cost: 'low', speed: 'fast', reasoning: 'very-good' },
    'claude-3-haiku': { name: 'Claude 3 Haiku', cost: 'very-low', speed: 'very-fast', reasoning: 'good' }
  },
  gemini: {
    'gemini-1.5-pro': { name: 'Gemini 1.5 Pro', cost: 'medium', speed: 'fast', reasoning: 'excellent' },
    'gemini-1.5-flash': { name: 'Gemini 1.5 Flash', cost: 'low', speed: 'very-fast', reasoning: 'good' }
  },
  groq: {
    'mixtral-8x7b-32768': { name: 'Mixtral 8x7b', cost: 'free', speed: 'ultra-fast', reasoning: 'very-good' },
    'llama-2-70b-chat': { name: 'LLaMA 2 70b', cost: 'free', speed: 'ultra-fast', reasoning: 'good' }
  },
  ollama: {
    'llama2': { name: 'LLaMA 2', cost: 'free', speed: 'depends-on-hardware', reasoning: 'good' },
    'mistral': { name: 'Mistral', cost: 'free', speed: 'depends-on-hardware', reasoning: 'very-good' },
    'neural-chat': { name: 'Neural Chat', cost: 'free', speed: 'depends-on-hardware', reasoning: 'good' }
  },
  huggingface: {
    'meta-llama/Llama-2-7b-chat-hf': { name: 'LLaMA 2 7b (HF)', cost: 'free', speed: 'fast', reasoning: 'good' },
    'mistralai/Mistral-7B-Instruct-v0.1': { name: 'Mistral 7b (HF)', cost: 'free', speed: 'very-fast', reasoning: 'very-good' },
    'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO': { name: 'Nous Hermes 2 (HF)', cost: 'free', speed: 'fast', reasoning: 'excellent' }
  },
  replicate: {
    'meta/llama-2-7b-chat': { name: 'LLaMA 2 7b', cost: 'very-low', speed: 'fast', reasoning: 'good' },
    'mistralai/mistral-7b-instruct-v0.1': { name: 'Mistral 7b', cost: 'very-low', speed: 'fast', reasoning: 'very-good' },
    'jondurbin/airoboros-l2-70b': { name: 'Airoboros 70b', cost: 'low', speed: 'moderate', reasoning: 'excellent' }
  },
  together: {
    'meta-llama/Llama-2-7b-chat-hf': { name: 'LLaMA 2 7b', cost: 'free', speed: 'ultra-fast', reasoning: 'good' },
    'mistralai/Mistral-7B-Instruct-v0.1': { name: 'Mistral 7b', cost: 'free', speed: 'ultra-fast', reasoning: 'very-good' },
    'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO': { name: 'Nous Hermes 2', cost: 'free', speed: 'fast', reasoning: 'excellent' }
  },
  mistral: {
    'mistral-tiny': { name: 'Mistral Tiny', cost: 'very-low', speed: 'very-fast', reasoning: 'good' },
    'mistral-small': { name: 'Mistral Small', cost: 'low', speed: 'fast', reasoning: 'very-good' },
    'mistral-medium': { name: 'Mistral Medium', cost: 'medium', speed: 'moderate', reasoning: 'excellent' }
  },
  cohere: {
    'command-light': { name: 'Command Light', cost: 'free', speed: 'very-fast', reasoning: 'good' },
    'command': { name: 'Command', cost: 'very-low', speed: 'fast', reasoning: 'very-good' },
    'command-plus': { name: 'Command Plus', cost: 'low', speed: 'moderate', reasoning: 'excellent' }
  }
}

export const MODEL_RECOMMENDATIONS = {
  'fast-and-cheap': { provider: 'groq', model: 'mixtral-8x7b-32768' },
  'best-free': { provider: 'together', model: 'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO' },
  'balanced': { provider: 'anthropic', model: 'claude-3-sonnet' },
  'best-quality': { provider: 'openai', model: 'gpt-4o' },
  'local-free': { provider: 'ollama', model: 'mistral' },
  'huggingface-free': { provider: 'huggingface', model: 'mistralai/Mistral-7B-Instruct-v0.1' }
}
