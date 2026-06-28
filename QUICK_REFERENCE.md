# 🤖 AI Models - Quick Reference Card

## One-Line Setup

```bash
npm run use:groq              # FREE, FASTEST (recommended)
npm run use:claude            # Best reasoning
npm run use:gemini            # Balanced cost/speed
npm run use:together          # Best free quality
npm run use:huggingface       # Open source models
npm run use:mistral           # Lightweight/efficient
npm run use:cohere            # Text generation
npm run use:ollama            # Local/private
npm run use:replicate         # Pay-per-use
npm run use:openai            # Production standard
```

## FREE Models (No Credit Card Required)

| Provider | Model | Speed | Quality | Command |
|----------|-------|-------|---------|---------|
| **Groq** | Mixtral 8x7b | ⚡⚡⚡⚡⚡ | ⭐⭐⭐⭐ | `npm run use:groq` |
| **Together** | Nous Hermes 2 | ⚡⚡⚡⚡ | ⭐⭐⭐⭐⭐ | `npm run use:together` |
| **Hugging Face** | Mistral 7b | ⚡⚡⚡⭐ | ⭐⭐⭐⭐ | `npm run use:huggingface` |
| **Mistral** | Mistral Tiny | ⚡⚡⚡ | ⭐⭐⭐ | `npm run use:mistral` |
| **Cohere** | Command Light | ⚡⚡⚡ | ⭐⭐⭐ | `npm run use:cohere` |
| **Ollama** | Mistral | ⚡⚡ | ⭐⭐⭐ | `npm run use:ollama` |

## Paid Models (Best Quality)

| Provider | Model | Cost | Quality | Command |
|----------|-------|------|---------|---------|
| **Claude** | Sonnet | $3/1M | ⭐⭐⭐⭐⭐ | `npm run use:claude` |
| **GPT-4o** | gpt-4o | $30/1M | ⭐⭐⭐⭐⭐ | `npm run use:openai` |
| **Gemini** | 1.5 Flash | $75/1M | ⭐⭐⭐⭐ | `npm run use:gemini` |

## Sign Up Links (5 Minutes Each)

```
Groq ................... https://console.groq.com (FREE)
Together AI ............ https://www.together.ai (FREE $25/month)
Hugging Face ........... https://huggingface.co (FREE)
Mistral ................ https://console.mistral.ai (FREE)
Cohere ................. https://cohere.com (FREE)
Ollama ................. https://ollama.ai (FREE local)
Anthropic Claude ....... https://console.anthropic.com (PAID)
Google Gemini .......... https://aistudio.google.com (PAID)
OpenAI GPT ............ https://platform.openai.com (PAID)
```

## Start Here 👇

```bash
# 1. Quick start with Groq (takes 2 minutes)
npm run use:groq

# 2. Get free API key from https://console.groq.com

# 3. Add to .env.local:
#    GROQ_API_KEY=gsk_xxxxx

# 4. Run your worker
npm run worker
```

## Compare All Models

```bash
npm run show-models
```

## Full Documentation

```bash
# Comprehensive guide with examples
cat COMPLETE_MODELS_GUIDE.md

# Multi-model configuration details
cat MULTI_MODEL_CONFIG.md

# AI Worker overview
cat AI_MODELS_INTEGRATION.md
```
