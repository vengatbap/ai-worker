# 🤖 AI Worker - Multi-Model Integration Guide

I've successfully integrated **5 powerful AI models** into your AI Worker. You can now switch between them instantly based on your needs!

---

## ⚡ Quick Integration Options

### 1. **Groq (Recommended - FREE & ULTRA-FAST)**
- **Speed:** 25x faster than OpenAI
- **Cost:** FREE (no credit card needed)
- **Setup:** 
  ```bash
  npm run use:groq
  # OR manually:
  # Edit .env.local:
  # AI_PROVIDER=groq
  # AI_MODEL=mixtral-8x7b-32768
  # GROQ_API_KEY=gsk-xxxxx (from https://console.groq.com)
  ```
- **Why:** Perfect for development, testing, prototyping
- **Sign up:** https://console.groq.com

---

### 2. **Anthropic Claude (Best for Reasoning)**
- **Quality:** Excellent reasoning and code analysis
- **Cost:** Low-Medium ($0.003-$0.015 per 1K input tokens)
- **Setup:**
  ```bash
  npm run use:claude
  # OR manually:
  # Edit .env.local:
  # AI_PROVIDER=anthropic
  # AI_MODEL=claude-3-sonnet
  # ANTHROPIC_API_KEY=sk-ant-xxxxx (from https://console.anthropic.com)
  ```
- **Why:** Better at complex tasks, edge cases, detailed analysis
- **Sign up:** https://console.anthropic.com

---

### 3. **Google Gemini (Fast & Balanced)**
- **Speed:** Very fast processing
- **Cost:** Low ($0.075-$0.3 per 1M tokens)
- **Setup:**
  ```bash
  npm run use:gemini
  # OR manually:
  # Edit .env.local:
  # AI_PROVIDER=gemini
  # AI_MODEL=gemini-1.5-flash
  # GEMINI_API_KEY=AIza-xxxxx (from https://aistudio.google.com)
  ```
- **Why:** Good balance of speed, cost, and quality
- **Sign up:** https://aistudio.google.com

---

### 4. **OpenAI GPT-4o (Your Current Setup)**
- **Quality:** Best quality and consistency
- **Cost:** Medium ($0.03-0.06 per 1K tokens)
- **Setup:**
  ```bash
  npm run use:openai
  # Already configured in your .env.local
  ```
- **Why:** Production-ready, most reliable
- **Sign up:** https://platform.openai.com

---

### 5. **Ollama (Local, Completely FREE & Private)**
- **Privacy:** 100% local, no data leaves your computer
- **Cost:** FREE (runs locally)
- **Setup:**
  ```bash
  # 1. Download Ollama: https://ollama.ai
  # 2. Install and start Ollama
  # 3. Pull a model: ollama pull mistral
  # 4. Run:
  npm run use:ollama
  ```
- **Why:** Perfect for sensitive data, offline work
- **Download:** https://ollama.ai

---

## 📊 Comparison Matrix

| Feature | Groq | Claude | Gemini | OpenAI | Ollama |
|---------|------|--------|--------|--------|--------|
| **Cost** | FREE | $ | $ | $$ | FREE |
| **Speed** | ⚡⚡⚡⚡⚡ | ⚡⚡ | ⚡⚡⚡ | ⚡⚡ | ⚡⚡ |
| **Quality** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Reasoning** | Very Good | Excellent | Good | Excellent | Good |
| **Setup** | Easy | Easy | Easy | Ready | Medium |
| **API Key Required** | Yes | Yes | Yes | Yes | No |
| **Privacy** | No* | No | No | No | Yes |
| **Offline** | No | No | No | No | Yes |

*Groq doesn't store queries by default

---

## 🚀 Easy Setup Commands

Use these convenience commands to switch models instantly:

```bash
# Show all available models
npm run show-models

# Configure specific provider (choose one)
npm run use:groq
npm run use:claude
npm run use:gemini
npm run use:openai
npm run use:ollama

# Custom configuration
npm run configure-ai groq
npm run configure-ai anthropic sk-ant-your-key-here

# Run worker with current configuration
npm run worker
```

---

## 💡 Which Model to Use?

### **For Development & Testing**
→ Use **Groq** (FREE, ultra-fast, no quotas)

### **For Complex Code Generation**
→ Use **Claude 3 Sonnet** (Best reasoning)

### **For Production**
→ Use **GPT-4o** or **Claude 3 Opus** (Most reliable)

### **For Sensitive Data**
→ Use **Ollama** (Local, private, no data sharing)

### **For Balanced Cost/Performance**
→ Use **Gemini 1.5 Flash** (Fast + affordable)

---

## 🔧 How Each Model Works

All models are integrated through a unified **AI Service** (`worker/ai-service.ts`) that abstracts the complexity. You can:

1. **Switch providers without changing code** - Just update `.env.local`
2. **Use streaming** for real-time responses
3. **Fallback to another provider** if one fails

Example code changes - before:
```typescript
import { openai } from "./ai"
const response = await openai.chat.completions.create(...)
```

After (using any provider):
```typescript
import { callAI } from "./ai-service"
const response = await callAI(prompt)  // Works with ANY provider!
```

---

## 📝 Configuration Examples

### Example 1: Switch to Groq (FREE)
```env
AI_PROVIDER=groq
AI_MODEL=mixtral-8x7b-32768
GROQ_API_KEY=gsk-xyz123...
```

### Example 2: Switch to Claude
```env
AI_PROVIDER=anthropic
AI_MODEL=claude-3-sonnet
ANTHROPIC_API_KEY=sk-ant-xyz123...
```

### Example 3: Use Ollama (Local)
```env
AI_PROVIDER=ollama
AI_MODEL=mistral
OLLAMA_HOST=http://localhost:11434
```

---

## ✅ What Was Added

### New Files
- `worker/models.ts` - Model definitions and comparisons
- `worker/ai-service.ts` - Unified AI service for all providers
- `MULTI_MODEL_CONFIG.md` - Detailed configuration guide
- `configure-ai.ts` - Interactive configuration script
- `show-models.ts` - Model comparison display

### Updated Files
- `worker/spec-generator.ts` - Uses new AI service
- `worker/coder.ts` - Uses new AI service
- `.env.local` - Added provider configuration options
- `package.json` - Added all provider SDKs + npm scripts

### New npm Scripts
```bash
npm run show-models      # Display all models
npm run configure-ai     # Interactive configuration
npm run use:groq         # Quick switch to Groq
npm run use:claude       # Quick switch to Claude
npm run use:gemini       # Quick switch to Gemini
npm run use:openai       # Quick switch to OpenAI
npm run use:ollama       # Quick switch to Ollama
npm run worker           # Run worker with current config
```

---

## 🎯 Next Steps

1. **Choose your preferred model** from the 5 options above
2. **Get an API key** (if needed - Groq and Ollama are free!)
3. **Run the setup command**: `npm run use:<provider>`
4. **Or manually edit** `.env.local` with your API key
5. **Start working**: `npm run worker`

---

## 💰 Cost Estimates (per 1M tokens)

| Model | Input | Output | Notes |
|-------|-------|--------|-------|
| Groq Mixtral | FREE | FREE | Completely free! |
| Claude Haiku | $0.80 | $4 | Budget Claude option |
| Claude Sonnet | $3 | $15 | Recommended Claude |
| Gemini Flash | $0.075 | $0.3 | Very cheap |
| GPT-3.5 Turbo | $0.50 | $1.50 | Budget OpenAI |
| GPT-4o | $30 | $60 | Premium OpenAI |
| Ollama | FREE | FREE | Local, no API calls |

---

## 🆘 Troubleshooting

**Q: "Missing credentials" error?**
A: Make sure your API key is in `.env.local` and matches the provider

**Q: Groq not working?**
A: Sign up free at https://console.groq.com and get your API key

**Q: Want to use Ollama offline?**
A: Download from https://ollama.ai and run `ollama pull mistral`

**Q: Slow responses?**
A: Switch to Groq for 25x faster speeds!

**Q: High costs?**
A: Use Groq (free) or Ollama (free) for development

---

## 📚 Documentation Links

- [Groq Docs](https://groq.com/docs)
- [Anthropic Claude Docs](https://docs.anthropic.com)
- [Google Gemini Docs](https://ai.google.dev)
- [OpenAI Docs](https://platform.openai.com/docs)
- [Ollama Docs](https://github.com/ollama/ollama)

---

## 🎉 You're All Set!

Your AI Worker now supports:
- ✅ OpenAI GPT-4o (Currently active)
- ✅ Anthropic Claude 3 (Best reasoning)
- ✅ Google Gemini (Fast + cheap)
- ✅ Groq Mixtral (FREE + Ultra-fast)
- ✅ Ollama (Local + Private)

Switch between them anytime. Enjoy! 🚀
