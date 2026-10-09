# Pahinga 🌿

> **A quiet, local-first digital companion for stressful moments.**
> Combines on-device text classification with a restrained local response engine, a 9-second paced breathing visual, touch-responsive interaction, and procedural ambient sound. Cloud voice is an optional reading layer with browser speech fallback.

---

## 🌟 The Core Experience

Students and creators under pressure do not always need another long, overwhelming AI answer. Often, what is needed most is a quiet pause, a breath cue, and one gentle next step.

Pahinga is designed as a calm, distraction-free sanctuary with:
1. **On-Device Local AI Inference:** Runs sentiment analysis directly in your browser using `@huggingface/transformers` without transmitting your thoughts or messages to any remote cloud API.
2. **Restrained Grounding Response Engine:** Thoughtfully authored non-clinical templates in English and Taglish following a *Reflect → Ground → Invite Agency* pattern.
3. **Paced Breathing Orb:** A gentle 9-second visual cycle (inhale ~4s, brief hold, exhale ~4s) with pause/resume controls and touch-responsive ripple animations.
4. **Procedural Ambient Sound:** Synthesizes calming ocean waves and soft rain directly via the Web Audio API—100% offline, zero byte downloads, seamlessly synchronized with your breathing cycle.
5. **Private & Safe by Design:** Messages are ephemeral and never logged or sent to external servers. A 24/7 crisis support panel is accessible from any state with verified nationwide hotlines (NCMH 1553).

---

## 📋 Technology and AI Disclosure

*(Per Hackathon Event Requirements)*

- **Frontend Framework:** Astro 7.3 with Tailwind CSS
- **Local Inference Runtime:** Hugging Face `@huggingface/transformers` (v4.3.1) via ONNX Runtime Web (WASM / CPU fallback)
- **Model:** [`Xenova/distilbert-base-uncased-finetuned-sst-2-english`](https://huggingface.co/Xenova/distilbert-base-uncased-finetuned-sst-2-english) (quantized `q8`)
- **Model Task:** English text sentiment classification; not clinical emotion detection or psychiatric evaluation
- **Model License:** The exact Xenova ONNX export repository does not declare a separate license field in its model card or repository metadata. Its upstream [`distilbert-base-uncased-finetuned-sst-2-english`](https://huggingface.co/distilbert/distilbert-base-uncased-finetuned-sst-2-english) model card lists Apache-2.0; confirm the event's accepted interpretation of that upstream license for the exported repository before final submission.
- **Response Generation:** Locally authored templates with deterministic intent routing and feeling chip overrides
- **Voice Output:** ElevenLabs cloud voice when configured, with browser Web Speech API (`SpeechSynthesis`) fallback and optional auto-read/per-bubble controls
- **Voice Input:** Browser Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)
- **Ambient Audio:** Procedural Web Audio API pink noise generator with an LFO-modulated lowpass filter (no external audio assets)
- **Offline Shell & PWA:** Service Worker (`sw.js`) and Web App Manifest (`manifest.json`) for offline asset and model caching
- **Cloud APIs:** ElevenLabs is used only for optional reply audio when cloud voice is configured and available. Text replies, response routing, and local AI inference remain client-side and do not require the cloud voice endpoint.
- **Persistence:** LocalStorage strictly for non-sensitive onboarding completion flag; no conversation history or user text is stored.
- **Known Limitations:** The model is an English-focused sentiment classifier and can misinterpret cultural nuance or complex metaphors; explicit feeling chips and Taglish templates are provided to ground user intent. Pahinga is not a medical device, diagnosis tool, or emergency service.

When ElevenLabs playback is used, the current reply text is sent to ElevenLabs to synthesize audio. The existing status toast indicates cloud-voice use or fallback. Keep the actual API key and voice configuration only in the ignored local `.env` file; never place secret values in source code, documentation, or client bundles.

---

## 🛠️ Getting Started Locally

### Prerequisites
- Node.js `>= 22.12.0`
- npm `>= 10.0.0`

### Installation
```bash
# Clone the repository
git clone https://github.com/Rikitu03/pahinga.git
cd pahinga

# Install dependencies
npm install

# Start local development server
npm run dev
```

Open [http://localhost:4321](http://localhost:4321) in your browser.

For cloud voice, configure the local ignored `.env` file with the ElevenLabs key, voice ID, and model settings used by the server endpoint. The application remains usable with browser speech or text alone when these values are absent or the provider cannot be reached.

---

## 🔌 How to Verify 100% Offline Mode (For Judges)

1. **Warm the Model Cache:** Open [http://localhost:4321/chat](http://localhost:4321/chat) while connected to the internet. Observe the header badge transition from `Preparing AI...` to **`On-device AI Ready`** (green dot), then confirm the service worker is activated in DevTools.
2. **Disconnect Network:** Turn off your Wi-Fi, unplug ethernet, or switch your browser DevTools Network tab to **Offline**.
3. **Send a Message:** Type a message (e.g., *"I'm having a really stressful day"*) or click a feeling chip (*"I'm burnt out"*).
4. **Inspect Network Activity:** Notice zero outgoing network calls to remote AI endpoints.
5. **Verify AI Response:** The message is classified locally in browser memory, and a gentle grounding response appears with the `🧠 On-device AI` or `⚡ Quick Feeling Chip` metadata badge. If WebGPU is unavailable, confirm the supported WASM/CPU path or the explicit local-template fallback remains usable.
6. **Test Ambient Audio & Breathing:** Tap the ambient sound icon in the header (waves icon) to hear the offline ocean waves, and tap/pause the breathing orb.

## ✅ Verification Status

Automated checks completed in the local development environment:

- `npm run build` completes successfully and generates the static pages plus the server-rendered voice endpoint.
- HTTP smoke tests return `200` for `/`, `/chat`, `/onboarding`, `/manifest.json`, and `/sw.js`.
- Headless Edge smoke checks render the chat page and capture desktop (`1440x900`) and phone-sized (`390x844`) screenshots.
- Static inspection confirms no OpenAI, Gemini, Anthropic, Ollama, WebLLM, or frontend chat-completions integration; ElevenLabs is accessed only through the server voice proxy.

Completed on the demo browser/device:

- Warmed the Transformers.js model, disabled the network, and confirmed the offline interaction.
- Verified the supported WASM/CPU fallback behavior with WebGPU unavailable.
- Confirmed the complete demo flow, responsive layouts, and browser-console behavior.
- Captured offline and responsive verification evidence.

The service worker and local template fallback were also verified to keep the basic experience usable when the model is unavailable.

---

## 🛡️ Safety & Crisis Support

Pahinga promotes emotional pause and self-reflection, but never substitutes for professional psychiatric or crisis care. If someone mentions danger or self-harm keywords, Pahinga immediately surfaces verified 24/7 human hotlines:
- **NCMH Crisis Hotline (Philippines):** Toll-free **1553** nationwide
- **Mobile Hotline:** **0917-899-USAP (8727)**
- **Discreet Emergency Dialog:** Always accessible via the hotline icon in the header navigation.

---

## 📜 Build Milestones Log

- **Milestone 1:** Project initialization, Astro + Tailwind setup, design system and responsive sanctuary layout.
- **Milestone 2:** Breathing orb visual with 9-second cycle, pause/resume controls, and tactile touch ripple.
- **Milestone 3:** Hugging Face Transformers.js on-device DistilBERT sentiment classification with zero cloud dependency.
- **Milestone 4:** Restrained response engine, intent routing, and quick feeling chips.
- **Milestone 5:** Taglish response templates, Web Audio procedural ambient ocean waves, and Web Speech TTS/STT.
- **Milestone 6:** Offline PWA service worker caching and 24/7 NCMH crisis support modal integration.
- **License verification:** The exact Xenova export has no separate declared license field; the upstream model is listed as Apache-2.0, and this distinction remains documented for final submission review.
