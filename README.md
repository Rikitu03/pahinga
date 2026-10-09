# 🌿 Pahinga
> An ambient, voice-enabled emotional sanctuary powered by on-device Local AI and somatic bio-pacing. Built for students and builders facing acute pressure, isolation, and burnout.

---

## 📌 Project Overview
- **Project Name:** Pahinga (*"Rest / Breathe"*)
- **Category:** Health, Wellness & Social Impact
- **Track:** Solo Builder
- **Author:** Jason Recto
- **Event:** AppBuildersPH Hackathon 2026 (Theme: Local AI)

---

## ❓ Why does this product benefit from running AI locally?
*(Mandatory Hackathon Defense)*

1. **Absolute Mental Health Privacy (Zero-Trace Vulnerability):**  
   When students face acute burnout, imposter syndrome, or financial despair, they share their rawest, most sensitive thoughts. Cloud AI logs prompts and risks data leakage. By running AI inference locally on-device, a user’s private confessions **never touch a corporate cloud server or training pipeline**. Total privacy is essential for genuine psychological safety.

2. **Offline Resilience in Moments of Panic (Zero Wi-Fi Dependency):**  
   Anxiety attacks and emotional spirals don't wait for stable internet. In the Philippines, brownouts, spotty mobile data, and dorm Wi-Fi dropouts are daily realities. If someone is hyperventilating and their mental health app throws a *"Network Error / Connecting..."* spinner, it amplifies panic. Pahinga's local inference guarantees immediate, uninterrupted grounding anywhere—even completely offline.

3. **Zero Financial Gatekeeping (Free Forever on Local Hardware):**  
   Students facing severe financial distress cannot afford subscription tiers or metered cloud API calls. Running locally on existing consumer hardware democratizes emotional grounding with zero recurring cost.

---

## ✨ Core Features

1. **Somatic Visual Bio-Pacing:** A glowing, animated breathing orb pulsing at a 4-second rhythm to physically down-regulate heart rate and guide parasympathetic breathing.
2. **Conversational Restraint:** Strictly limits responses to 1–2 grounded sentences. Zero bullet points, zero listicles, and zero unsolicited essays.
3. **Conversational Bridge Pills:** 5 quick-tap anchors for common high-stress states (*"I'm burnt out"*, *"I wish I was talented"*, *"If only I'm as good as everybody"*, *"I feel so down"*, *"Everything feels so heavy"*), each concluding with an open invitation to vent freely.
4. **Authentic Neural Voice:** Pre-cached, unhurried voice delivery (Sarah Eve) paired with browser-native speech synthesis fallback.
5. **Integrated Crisis Triage:** Proactive emergency routing connecting directly to the **National Center for Mental Health (NCMH 1553)** and Hopeline Philippines.

---

## 💻 Technical Breakdown: Local vs. Cloud

| Component | Execution Location | Technology |
| :--- | :--- | :--- |
| **Core AI Inference** | **100% Local (On-Device)** | Hugging Face Transformers.js (`distilbert`) + Local `llama.cpp` Server (`Qwen3-1.7B-Q4_K_M.gguf`) |
| **Somatic Visuals** | **100% Local (On-Device)** | Client-side CSS Keyframe Animations |
| **Voice Playback** | **100% Local (On-Device)** | Local cached neural audio assets + Web Speech API |
| **Session State** | **100% Local (On-Device)** | Browser `localStorage` (Zero remote database) |
| **Web Assets Delivery** | Cloud (Initial Load Only) | Vercel CDN (or 100% offline via local dev server) |

---

## 🛠️ Technology & AI Disclosures
*(Required by AppBuildersPH Rules)*

- **Frontend Framework:** Astro
- **Local AI Runtime:** `@huggingface/transformers` (WASM / CPU on-device inference) + `llama.cpp` backend
- **Local Models:** `Xenova/distilbert-base-uncased-finetuned-sst-2-english` (ONNX quantized) for sentiment routing & `Qwen3-1.7B-Q4_K_M.gguf` for generative reasoning and conversation.
- **Voice Synthesis:** ElevenLabs (for pre-cached offline assets) + Web Speech API (fallback)
- **AI Development Tools:** Gemini 3.1 & GitHub tools used for code scaffolding assistance and debugging.
- **Existing Code & Assets:** Freshly initialized Astro starter template; all application components, styling, and response policies built during the hackathon window.

---

## 🚀 How to Run Locally

To test and recreate Pahinga locally on any laptop:

```bash
# 1. Clone the repository
git clone https://github.com/Rikitu03/pahinga.git
cd pahinga

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev

# 4. Start local llama.cpp server for generative AI
# Note: Requires Qwen3-1.7B-Q4_K_M.gguf model
llama-server -m models/Qwen3-1.7B-Q4_K_M.gguf --port 8080 --ctx-size 2048
```
