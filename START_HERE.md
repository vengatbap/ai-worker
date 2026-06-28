# 🚀 Quick Start - AI Worker with 10 Models

## ✅ Integration Complete!

Your AI Worker now supports these 10 providers with 25+ models:

```
✅ OpenAI (GPT-4o, etc.)
✅ Anthropic Claude (Best reasoning)
✅ Google Gemini (Fast & cheap)
✅ Groq (Fastest, FREE) ⚡
✅ Ollama (Local, FREE) 🔒
✅ Hugging Face (FREE tier)
✅ Replicate (Pay-per-use)
✅ Together AI (FREE tier)
✅ Mistral (Lightweight, FREE)
✅ Cohere (Text generation, FREE)
```

---

## 5-Minute Setup

### Step 1: Choose Your Model

```bash
# Option A: Fastest (Recommended)
npm run use:groq
# FREE, 25x faster than GPT-4, no credit card needed

# Option B: Best Quality
npm run use:claude
# Excellent reasoning, $3 per 1M tokens

# Option C: Local & Private
npm run use:ollama
# Download from https://ollama.ai, no API key needed

# Option D: Your Current Setup
npm run use:openai
# Already configured
```

### Step 2: Get API Key (if needed)

For **Groq** (recommended):
```
1. Go to: https://console.groq.com
2. Click "Sign Up Free"
3. Copy your API key
4. Add to .env.local: GROQ_API_KEY=gsk_xxxxx
```

### Step 3: Run the Worker

```bash
npm run worker
```

Done! 🎉

---

## Available Commands

```bash
# Show all models
npm run show-models

# Switch to any provider (one command)
npm run use:groq        # Fastest, FREE
npm run use:claude      # Best reasoning
npm run use:gemini      # Balanced
npm run use:together    # Best free quality
npm run use:huggingface # Open source
npm run use:mistral     # Lightweight
npm run use:replicate   # Pay-per-use
npm run use:cohere      # Text generation
npm run use:ollama      # Local, FREE
npm run use:openai      # Your current setup

# Run worker
npm run worker
```

---

## Recommended Setups

### For Fastest Development (FREE)
```env
AI_PROVIDER=groq
AI_MODEL=mixtral-8x7b-32768
GROQ_API_KEY=gsk_xxxxx
```

### For Best Quality (Affordable)
```env
AI_PROVIDER=anthropic
AI_MODEL=claude-3-sonnet
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

### For Privacy (Local, FREE)
```env
AI_PROVIDER=ollama
AI_MODEL=mistral
OLLAMA_HOST=http://localhost:11434
```

---

## All Free Options

| Provider | Model | Speed | Quality | Setup |
|----------|-------|-------|---------|-------|
| Groq | Mixtral 8x7b | ⚡⚡⚡⚡⚡ | ⭐⭐⭐⭐ | 2 min |
| Together | Nous Hermes 2 | ⚡⚡⚡⚡ | ⭐⭐⭐⭐⭐ | 2 min |
| Hugging Face | Mistral 7b | ⚡⚡⚡ | ⭐⭐⭐⭐ | 2 min |
| Mistral | Mistral Tiny | ⚡⚡⚡ | ⭐⭐⭐ | 2 min |
| Cohere | Command Light | ⚡⚡⚡ | ⭐⭐⭐ | 2 min |
| Ollama | Mistral | ⚡⚡ | ⭐⭐⭐ | 5 min |

---

## Documentation

- **SETUP_COMPLETE.md** - Full setup guide with all details
- **COMPLETE_MODELS_GUIDE.md** - Comprehensive model comparison
- **QUICK_REFERENCE.md** - One-page cheat sheet
- **MULTI_MODEL_CONFIG.md** - Configuration details

---

## Get Started Now

```bash
# 1. Pick a model
npm run use:groq

# 2. Get API key from https://console.groq.com
# 3. Add to .env.local: GROQ_API_KEY=gsk_xxxxx
# 4. Run
npm run worker
```

That's it! 🚀

---

## Need Help?

**Q: Which model should I use?**
- Speed: Use **Groq** (free)
- Quality: Use **Claude** (affordable)
- Privacy: Use **Ollama** (local)

**Q: Do I need to pay?**
- No! 6 providers are completely free

**Q: Can I switch models anytime?**
- Yes! Just run `npm run use:<provider>` and restart

**Q: How long to set up?**
- 2-5 minutes per provider

**Start now:**
```bash
npm run show-models     # See all options
npm run use:groq        # Choose your model
npm run worker          # Start working!
```

Happy coding! ✨
