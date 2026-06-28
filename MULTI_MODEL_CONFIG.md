# AI Worker - Multi-Model Configuration Guide

This guide helps you configure different AI models to work efficiently with the AI Worker.

## Quick Start

The AI Worker now supports **5 different AI providers**. You can switch between them by changing the `AI_PROVIDER` and `AI_MODEL` in your `.env.local` file.

### Current Configuration
```env
AI_PROVIDER=openai
AI_MODEL=gpt-4o
```

---

## 🟦 Option 1: OpenAI (Current)

**Best for:** High-quality code generation, reasoning-heavy tasks

### Setup
1. Get API key: https://platform.openai.com/api-keys
2. Set in `.env.local`:
```env
AI_PROVIDER=openai
AI_MODEL=gpt-4o
OPENAI_API_KEY=sk-proj-xxxxx
```

### Model Options
- `gpt-4o` - Best quality (recommended)
- `gpt-4-turbo` - Fast and powerful
- `gpt-3.5-turbo` - Budget option

### Pricing
- GPT-4o: $0.03 (input) / $0.06 (output) per 1K tokens
- GPT-3.5-turbo: $0.50 / $1.50 per 1M tokens

---

## 🟨 Option 2: Anthropic Claude (Recommended for Reasoning)

**Best for:** Complex reasoning, detailed specifications, safer outputs

### Setup
1. Get API key: https://console.anthropic.com
2. Install: `npm install @anthropic-ai/sdk`
3. Set in `.env.local`:
```env
AI_PROVIDER=anthropic
AI_MODEL=claude-3-sonnet
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

### Model Options
- `claude-3-opus` - Best reasoning (most expensive)
- `claude-3-sonnet` - Balanced (recommended)
- `claude-3-haiku` - Budget option

### Pricing
- Claude 3 Opus: $0.015 (input) / $0.075 (output) per 1K tokens
- Claude 3 Sonnet: $0.003 (input) / $0.015 (output) per 1K tokens
- Claude 3 Haiku: $0.00025 (input) / $0.00125 (output) per 1K tokens

### Why Use Claude?
- Better at following complex instructions
- Excellent reasoning capabilities
- More thoughtful code generation
- Handles edge cases better

---

## 🟦 Option 3: Google Gemini (Good Balance)

**Best for:** Cost-effective, fast processing, creative tasks

### Setup
1. Get API key: https://aistudio.google.com
2. Install: `npm install @google/generative-ai`
3. Set in `.env.local`:
```env
AI_PROVIDER=gemini
AI_MODEL=gemini-1.5-flash
GEMINI_API_KEY=AIza-xxxxx
```

### Model Options
- `gemini-1.5-pro` - Best quality
- `gemini-1.5-flash` - Fast and cheap (recommended)

### Pricing
- Gemini 1.5 Pro: $0.0075 (input) / $0.03 (output) per 1K tokens
- Gemini 1.5 Flash: $0.075 / $0.3 per 1M tokens

### Why Use Gemini?
- Free tier available
- Very fast processing
- Good for prototyping
- Handles images and multimodal content

---

## 🟩 Option 4: Groq (Ultra-Fast, FREE)

**Best for:** Speed, prototyping, cost-free experiments

### Setup
1. Get API key: https://console.groq.com (free signup)
2. Install: `npm install groq-sdk`
3. Set in `.env.local`:
```env
AI_PROVIDER=groq
AI_MODEL=mixtral-8x7b-32768
GROQ_API_KEY=gsk-xxxxx
```

### Model Options
- `mixtral-8x7b-32768` - Best option (free!)
- `llama-2-70b-chat` - Alternative option

### Pricing
- **COMPLETELY FREE** (no credit card required)

### Why Use Groq?
- ⚡ Ultra-fast inference (100+ tokens/sec)
- 💰 Completely free
- 🎯 Great for prototyping and testing
- Perfect for high-volume tasks

### Example Speed Comparison
- OpenAI GPT-4o: ~4-8 tokens/sec
- Claude 3 Sonnet: ~5-10 tokens/sec
- Groq Mixtral: ~100+ tokens/sec (25x faster!)

---

## 🟪 Option 5: Ollama (Local, Completely Free)

**Best for:** Privacy-focused, offline work, zero costs

### Setup
1. Download Ollama: https://ollama.ai
2. Install and start Ollama service
3. Pull a model:
```bash
ollama pull mistral
# or
ollama pull llama2
```
4. Set in `.env.local`:
```env
AI_PROVIDER=ollama
AI_MODEL=mistral
OLLAMA_HOST=http://localhost:11434
```

### Model Options
- `mistral` - Recommended (7B, fast)
- `llama2` - Good reasoning (7B)
- `neural-chat` - Good for chat tasks
- `orca-mini` - Smaller, faster

### Pricing
- **FREE** (runs locally)

### Why Use Ollama?
- 🔒 Complete privacy (no data leaves your computer)
- 💰 Zero cost
- 🚀 No API limits
- ⚙️ Full control over model parameters
- 🌐 Works offline

### Hardware Requirements
- Minimum: 8GB RAM
- Recommended: 16GB+ RAM for better performance
- GPU support available (much faster)

---

## 📊 Comparison Table

| Feature | OpenAI | Claude | Gemini | Groq | Ollama |
|---------|--------|--------|--------|------|--------|
| Cost | Medium | Low-Medium | Low | FREE | FREE |
| Speed | Good | Good | Very Good | ⚡ Ultra-Fast | Depends |
| Quality | Excellent | Excellent | Very Good | Good | Good |
| API Required | Yes | Yes | Yes | Yes | No |
| Offline | No | No | No | No | Yes |
| Setup Ease | Easy | Easy | Easy | Very Easy | Medium |
| Best For | Production | Reasoning | Balance | Speed | Privacy |

---

## 🚀 Recommended Configurations

### For Production
```env
AI_PROVIDER=openai
AI_MODEL=gpt-4o
```

### For Best Reasoning
```env
AI_PROVIDER=anthropic
AI_MODEL=claude-3-sonnet
```

### For Speed & Cost Balance
```env
AI_PROVIDER=gemini
AI_MODEL=gemini-1.5-flash
```

### For Maximum Speed (Free)
```env
AI_PROVIDER=groq
AI_MODEL=mixtral-8x7b-32768
```

### For Privacy & Offline
```env
AI_PROVIDER=ollama
AI_MODEL=mistral
OLLAMA_HOST=http://localhost:11434
```

---

## 🔄 How to Switch Models

It's super simple - just update your `.env.local` file:

```env
# Before
AI_PROVIDER=openai
AI_MODEL=gpt-4o

# After (switch to Claude)
AI_PROVIDER=anthropic
AI_MODEL=claude-3-sonnet
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

Then run:
```bash
npm run worker
```

The worker will automatically use the new model!

---

## 🐛 Troubleshooting

### "Missing credentials" Error
- Double-check your API key in `.env.local`
- Make sure the key matches the provider you selected

### Model Not Found
- Verify the model name is correct
- For Ollama, make sure `ollama pull <model>` was run first

### Rate Limited
- Try a different provider with higher limits
- Groq has no rate limits and is free!

### Slow Response Time
- Switch to Groq for ultra-fast responses
- Use a smaller model (e.g., Claude Haiku instead of Opus)

### High Costs
- Switch to Claude Haiku or Groq (free)
- Use Ollama for completely free local processing

---

## 📝 Example: Switching to Groq for Free

1. Edit `.env.local`:
```env
AI_PROVIDER=groq
AI_MODEL=mixtral-8x7b-32768
GROQ_API_KEY=gsk-xxxxx (get from https://console.groq.com)
```

2. Run:
```bash
npm run worker
```

✅ Done! You're now using Groq's ultra-fast free API!

---

## 💡 Tips for Efficiency

1. **Use Groq for development** - Fast iteration, completely free
2. **Use Claude for critical tasks** - Better reasoning and edge case handling
3. **Use Ollama for sensitive data** - No data leaves your computer
4. **Monitor costs** - Track token usage on your provider's dashboard
5. **Batch requests** - Process multiple tasks at once

---

## 🆘 Need Help?

Each provider has excellent documentation:
- OpenAI: https://platform.openai.com/docs
- Anthropic: https://docs.anthropic.com
- Google Gemini: https://ai.google.dev
- Groq: https://groq.com/docs
- Ollama: https://github.com/ollama/ollama

