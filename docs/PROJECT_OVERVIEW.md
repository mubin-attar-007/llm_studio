# LLM Studio — Project Overview & Concepts
### A plain-English guide for presenting & explaining the project

> **One-line pitch:** *LLM Studio is a private, ChatGPT-style AI chat app that runs on an
> ordinary PC using free AI models — in two modes: **Cloud** (powerful, online) and
> **Local** (private, offline).*

---

## 1. The story (why this project exists)

We wanted to use a powerful **open-source AI model** (originally "GLM"). But we hit a wall:

- 🧠 Modern AI models are **huge** — the big GLM model is ~744 **billion** settings.
- 💻 A normal PC **cannot run it** (it needs 180–250 GB of memory; a normal PC has 16 GB).
- 💸 We wanted it **free**.

So the project became: **"How do we use powerful AI for free on a normal PC?"**
The answer is two paths — **Cloud** and **Local** — and this app does both.

---

## 2. The 3 ideas you need (explained simply)

Everything in this project comes down to three simple ideas.

### Idea 1 — The **Model** vs **Where it runs** vs **How you reach it**

```
   THE MODEL              WHERE IT RUNS                 HOW YOU REACH IT
   (the "brain")          (the computer)                (the connection)
   e.g. GLM, Llama   →    your PC  OR  the cloud   →    an "API" (web address + key)
```

- **The model** = the AI software (GLM, Llama, Mistral…). It's just a (very large) file.
- **Where it runs** = either *your PC* ("local") or *someone else's servers* ("cloud").
- **The API** = the doorway you use to talk to a model that runs somewhere else.

> 💡 **Key insight:** "Cloud" and "API" are **not opposites** — they go together.
> A model in the cloud is *always* reached through an API.

### Idea 2 — Local vs Cloud (a simple analogy)

| | 🔒 **Local** (on your PC) | ☁️ **Cloud** (on the internet) |
|---|---|---|
| Analogy | Cooking at home | Ordering from a restaurant |
| Who does the work | Your computer | Their computers |
| Privacy | Total (nothing leaves your PC) | They see your messages |
| Power | Limited by your PC | Huge (data-center GPUs) |
| Cost | Free | Free tier or paid |
| Internet | Not needed | Needed |

### Idea 3 — "Instant" models vs "Reasoning" models

Some models **answer immediately**. Others **"think" first** (write a long hidden draft) before
answering — smarter, but slower.

```
   INSTANT model:     question ──► answer            (fast, ~1 second)
   REASONING model:   question ──► [thinks 10-20s] ──► answer   (slower)
```

> ⚠️ **Important:** "Slow" is **not** about model *size*. A 70-billion model can be instant;
> a smaller "reasoning" model can be slow. It's the **thinking behavior**, not the size.
> *(This is exactly why our first GLM setup felt slow — GLM is a reasoning model.)*

---

## 3. The big picture (how the app works)

```
   YOUR PC                                        THE CLOUD (Cloudflare, USA)
  ┌─────────────────────────────┐               ┌────────────────────────────┐
  │  LLM Studio (the app)        │   you type    │                            │
  │   • a web page in browser    │ ───────────►  │   The AI model runs here   │
  │   • a small Python server    │   (the API)   │   on powerful GPUs         │
  │                              │ ◄───────────  │   (Llama / GLM / Mistral…) │
  │   shows the answer           │   the answer  │                            │
  └─────────────────────────────┘               └────────────────────────────┘
        (thin client — light work)                   (does the heavy work)
```

In **Local mode**, the right-hand box simply moves *onto your PC* (via a tool called Ollama):

```
   ☁️ CLOUD MODE (run.bat)                 🔒 LOCAL MODE (run_local.bat)
  ┌──────────┐     ┌────────────┐         ┌─────────────────────────────┐
  │ Your PC  │ ──► │ Cloudflare │         │ Your PC                     │
  │  (app)   │ ◄── │ runs model │         │  app ──► Ollama runs the    │
  └──────────┘     └────────────┘         │          model on your CPU  │
   fast · 24 models · online              │      ◄──────────────────────│
   data leaves PC                         └─────────────────────────────┘
                                           private · offline · slower
```

---

## 4. The options we evaluated (the "tiers")

There are 5 common ways to use an AI model. We chose **#1 (local)** and **#2 (free cloud)**.

| # | Option | Where it runs | Free? | Private? | We use it? |
|---|---|---|---|---|---|
| 1 | **Local** (Ollama) | Your PC | ✅ | ✅ Fully | ✅ **Yes** (Local mode) |
| 2 | **Free cloud API** (Cloudflare) | Provider's cloud | ✅ (limits) | ⚠️ | ✅ **Yes** (Cloud mode) |
| 3 | Paid API (OpenAI, Anthropic) | Provider's cloud | 💲 | ⚠️ | ❌ Not needed |
| 4 | Rent a GPU & self-host | A server you rent | 💲💲 | ✅ | ❌ Too costly |
| 5 | Free GPU notebooks (Colab) | Temporary cloud | ✅ (limits) | ⚠️ | ❌ Not a real app |

---

## 5. What we actually used (the tech stack)

| Piece | What it is | Why we used it |
|---|---|---|
| **Cloudflare Workers AI** | A cloud that hosts many AI models | Free, US-based, 24 models incl. GLM |
| **Ollama** | A tool that runs AI models on your PC | The private/offline Local mode |
| **Flask (Python)** | A small web server | Runs the app, talks to the AI |
| **HTML / CSS / JavaScript** | The web page | The ChatGPT-style interface |
| **OpenAI-compatible API** | A shared "language" providers speak | Lets us **swap providers by editing 1 file** |
| marked · highlight.js · KaTeX | Browser helper libraries | Nice formatting: tables, code, math |

> 🔑 **The clever bit:** because everything speaks the **OpenAI-compatible** "language,"
> the *same app* can talk to Cloudflare, a local Ollama, Groq, Google Gemini, Mistral, etc.
> We switch provider by changing 3 lines in a config file — **no code changes.**

```
  ┌──────────────────── LLM Studio ────────────────────┐
  │  Browser (what you see)      Python (the engine)    │
  │  • index.html                • app.py               │     ┌──────────────┐
  │  • styles.css   ──HTTP──►     • glm_client.py  ──────────►│  ANY provider │
  │  • app.js                    (OpenAI-compatible)    │     │  Cloudflare / │
  │                                                     │     │  Ollama / ... │
  └─────────────────────────────────────────────────────┘     └──────────────┘
```

---

## 6. The models you can pick (the "menu")

### ☁️ Cloud (Cloudflare) — 24 models, switchable in the app
| Group | Examples | Speed |
|---|---|---|
| **Fast / instant** ⭐ | Llama 3.3 70B *(default)*, Llama 4, OpenAI gpt-oss 20B/120B, Mistral, Gemma 4 | ⚡ ~1–3 s |
| **"Thinks" (reasoning)** | GLM-5.2, GLM-4.7, QwQ, DeepSeek-R1, Qwen3 | 🐢 ~10–20 s |
| **Tiny / light** | Llama 3.2 1B/3B, IBM Granite micro | ⚡⚡ very fast |

### 🔒 Local (Ollama) — runs on your PC
| Model | Size | Speed | Best for |
|---|---|---|---|
| **llama3.2:3b** | 2 GB | medium | Better answers |
| **llama3.2:1b** | 1.3 GB | fast | Snappy replies |

*(More can be added anytime: `ollama pull <name>`.)*

---

## 7. How we made it "just work" (the key decisions)

1. **Problem:** GLM (a reasoning model) was slow and sometimes returned nothing — its hidden
   "thinking" used up the reply budget.
2. **Fix #1:** Made the **default a fast, non-reasoning model** (Llama 3.3 70B) → instant replies.
3. **Fix #2:** Added **all 24 Cloudflare models** to a dropdown so we can try any of them, with a
   **"thinks" tag** marking the slow reasoning ones.
4. **Fix #3:** Added **auto-retry** so a dropped/empty reply recovers by itself.
5. **Added Local mode** (Ollama) for full privacy/offline — a small model that fits the PC.

```
  Want a powerful AI model?
        │
        ├─ Can the PC run it? ──► No (16 GB RAM) ──► ☁️  Use free CLOUD (Cloudflare)
        │
        └─ Need privacy / offline? ──► Yes ──► 🔒  Run a SMALL model LOCALLY (Ollama)
```

---

## 8. Talking points / takeaways for the meeting

- ✅ We built a **real, working, ChatGPT-style app** that uses **free** AI.
- ✅ **Two modes:** powerful **cloud** (24 models) and private **local** (offline).
- ✅ It's **provider-independent** — we can switch AI providers in seconds.
- 💡 **"Big" ≠ "slow."** Slowness comes from *reasoning* models, not size.
- 💡 **"Cloud" = "API."** You always reach a cloud model through an API; you never "install" it.
- 🔒 **Privacy is a choice:** local = fully private but smaller; cloud = powerful but the provider sees your data.

---

## 9. Mini-glossary (for questions)

| Term | In simple words |
|---|---|
| **LLM** | "Large Language Model" — the AI that understands and writes text. |
| **Open-source / open-weight** | The AI's files are free to download and use. |
| **API** | A web address + key that lets one program talk to another over the internet. |
| **Cloud** | Someone else's powerful computers, used over the internet. |
| **Local** | Running on *your own* computer. |
| **Token** | A small chunk of text (~¾ of a word) the AI reads/writes. |
| **max_tokens** | A limit *we* set on how long a reply can be (not related to model size). |
| **Reasoning model** | An AI that "thinks" (writes a hidden draft) before answering — smarter but slower. |
| **Quantization** | Shrinking a model so it needs less memory (with a small quality trade-off). |
| **Ollama** | A free tool to run AI models on your own PC. |
| **Cloudflare Workers AI** | A cloud service that hosts many AI models with a free tier. |

---

*LLM Studio — built to show that capable, private AI is reachable on everyday hardware,
for free, with the freedom to choose where it runs.*
