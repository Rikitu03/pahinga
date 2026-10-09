# PAHINGA — Hackathon Master Plan

**Goal:** Build a calm, working, judge-ready digital companion that satisfies the supplied technical requirements without depending on a cloud AI API for its core experience.

**Planning context:** The uploaded draft schedules remote building on Friday, October 9, 2026, and an in-person demo on Saturday, October 10. The schedule below starts at approximately **2:00 PM on Friday**; confirm the organizer's actual submission, venue, and demo times before relying on the logistics.

> ### 📍 Current Project State (Updated: Friday Evening / Milestone 2 → 3)
> **Current Focus:** Transitioning from **Sanctuary UI** to **Local On-Device AI Inference** (Schedule block ~3:20–4:30 PM).
> - **✅ Completed:** Astro project initialized, local dev running, responsive Sanctuary & Onboarding screens, breathing orb visual, composer with auto-resize & enter-to-send, persistent 24/7 crisis support modal with verified 1553 & mobile numbers, speech synthesis read-aloud (TTS), speech-to-text mic input (STT), zero cloud API dependency.
> - **⏳ Next Immediate Priorities:**
>   1. **Feeling Chips:** Add 4 feeling chips ("overwhelmed", "lonely", "tired", "need a pause") to the sanctuary screen.
>   2. **Local AI Model:** Install `@huggingface/transformers` and load browser sentiment model (`Xenova/distilbert-base-uncased-finetuned-sst-2-english`).
>   3. **Local Response Engine:** Replace current placeholder reply array with intent routing & restrained non-clinical templates.
>   4. **Orb Controls:** Add pause/stop toggle and tap ripple feedback for breathing.

---

## 1. The best strategy in one decision

Build **Pahinga as a local-first web sanctuary**. Its reliable core is:

1. A polished, expressive breathing orb/face.
2. Text input and a few self-selected feeling chips.
3. A small text classifier that runs in the browser, on the user's device.
4. A local response engine that selects and composes short, carefully written grounding replies.
5. Tap/“pet” feedback, optional read-aloud, a discreet support panel, and a no-cloud offline mode.

**Do not make Gemini, ElevenLabs, or another hosted AI service necessary for the app to work.** Cloud generation may be added only as a clearly disclosed, optional secondary mode after the local flow is reliable.

This is the strongest risk-adjusted plan for a solo build: it visibly demonstrates the product experience and local AI inference while protecting time for testing, safety, and the pitch.

## 2. Translate the supplied rules into build decisions

| Supplied requirement | How Pahinga will satisfy it | Proof for judges |
|---|---|---|
| Substantially built during the hackathon | Commit the app in visible milestones: skeleton, local inference, interaction, safety, final polish. Keep a brief build log. | Git history and a short README build log. |
| A meaningful part of AI inference executes locally | Run a pretrained sentiment/text-classification model inside the browser using Transformers.js. Use its result as one input to local response selection. | Show the “On-device AI” indicator and run a test with the browser network disconnected after model assets have been loaded. |
| Working product demonstrated | Build one complete path from user message → on-device inference → grounded reply → orb reaction. | Live demo plus a locally saved screen recording as backup. |
| Models, APIs, frameworks, and major tools disclosed | Add a “Technology & AI Disclosure” section to the README and one pitch slide. | README and slide list each dependency, model, license, purpose, and whether it sends data off-device. |
| Core local AI functionality works without depending entirely on a cloud AI API | Text classification, response selection, breathing, touch interaction, and safety information all work without cloud inference. | Turn off Wi-Fi and demonstrate the core flow. |
| Existing open-source models/libraries and AI-assisted development allowed | Use an existing licensed model/library and document AI-assisted tools as required by the event. | Dependency list, model card/license link, and disclosure. |
| Cloud APIs allowed as secondary components | Only consider an optional cloud-enhanced mode after the local experience has passed every core test. | A visible mode label and a clear statement about when text leaves the device. |

**Important distinction:** downloading model files initially is not the same as sending every message to a cloud model. For a trustworthy offline demonstration, preload/cache the model or serve its model files locally, then verify that inference still works when the network is disabled. Transformers.js documents browser inference and model caching; WebGPU acceleration is optional and browser-dependent. See [Transformers.js pipeline guide](https://huggingface.co/docs/transformers.js/en/pipelines), [WebGPU guide](https://huggingface.co/docs/transformers.js/guides/webgpu), and [environment/cache guide](https://huggingface.co/docs/transformers.js/api/env).

---

## 3. Product definition

### The promise

> **Pahinga is a quiet, local-first companion for stressful moments. It offers a small pause, a paced-breathing visual, and one gentle next step—without overwhelming the user with advice.**

Keep the product positioned as a grounding and reflection tool, **not** a diagnostic, therapy, or emergency-response service. Avoid unsupported claims such as “treats anxiety,” “reduces cortisol,” or “clinically regulates the nervous system.” Say the breathing animation *offers an optional pacing cue* instead.

### The main user journey

1. **Arrive:** A calm screen, one short invitation, no sign-in, no dashboard clutter.
2. **Choose or share:** The user selects a feeling chip (for example, “overwhelmed,” “lonely,” “tired,” or “I just need a pause”) or types a short message.
3. **Infer locally:** The browser model runs locally. A small intent/risk routing layer combines the model's broad sentiment signal with the user's explicit choice and simple phrase matching. Do not tell users that a classifier knows what they truly feel.
4. **Respond with restraint:** Pahinga gives one to three short sentences: validate the situation, offer one optional grounding action, then ask at most one gentle question.
5. **Breathe and touch:** The orb uses a 4-second inhale / 4-second exhale visual cycle. Tapping or pressing it triggers a ripple and a warmer face state. Users can stop the animation at any time.
6. **Continue or leave:** The user may request read-aloud, choose another feeling, clear the session, or open support information. No account is needed.

### A response format to enforce

Use the same restrained structure across local response templates:

- **Reflect:** “That sounds like a lot to carry at once.”
- **Offer one action:** “Would it help to take one slow breath with the circle?”
- **Invite agency:** “What is the smallest thing you need from this moment?”

Avoid bullet lists in the companion's spoken replies. Do not force breathing: always allow “not now,” pause, or exit.

---

## 4. Recommended technical architecture

### Feasible architecture (recommended for the hackathon)

| Layer | Recommended choice | Why |
|---|---|---|
| UI | Keep the framework already started. If starting from zero, use Vite + React + CSS. | Minimizes setup and supports quick interaction polish. Do not rewrite an existing working stack just to follow this suggestion. |
| Local NLP inference | `@huggingface/transformers` with a Transformers.js-compatible sentiment model; [`Xenova/distilbert-base-uncased-finetuned-sst-2-english`](https://huggingface.co/Xenova/distilbert-base-uncased-finetuned-sst-2-english) is a practical candidate. | A concrete on-device ML inference step; model task is sentiment classification, not clinical emotion detection. It is English-focused, so explicit feeling chips must remain available and take priority when selected. The upstream DistilBERT model lists Apache-2.0, but the ONNX export repository does not clearly display a license field; confirm the precise model repository's terms before shipping, or choose an export with an explicit suitable license. |
| Response generation | Local response templates selected by a small policy function. | Predictable, fast, easy to safety-review, and entirely independent of a cloud LLM. |
| Local routing | Simple phrase/intent patterns for grounding categories and crisis-support prompts, combined with the user's selected feeling and classifier signal. | Gives the app a meaningful behavior without pretending the sentiment model can infer a person's mental state precisely. Crisis rules are a safety prompt, not a clinical detector. |
| Animation | CSS transforms/opacity or the current animation library. | Smooth orb breathing, blink, smile, and touch ripple without an additional rendering stack. |
| Voice output | Browser `speechSynthesis` behind a “Read aloud” control. Keep text as the guaranteed mode. | Avoids making ElevenLabs/network access part of the critical path. Test the selected browser's available voices beforehand. |
| Input | Typed text and feeling chips first. | Reliable offline. Microphone speech recognition is a stretch feature because browser support and offline behavior vary. |
| Storage | No server database. Store only non-sensitive preferences/check-in metadata in `localStorage`, if needed. Do not save free-text disclosures by default; provide a clear/erase control. | Keeps the scope small and avoids creating a sensitive conversation-history store. |
| Hosting/demo | Run the primary demo locally on the laptop; deploy a public URL only as a secondary route if time permits. | The local server and preloaded model make the offline demonstration easier to verify. A cloud URL alone does not prove offline operation. |

### Local inference flow

```text
User types a message or chooses a feeling
                  ↓
        Local browser classifier
                  ↓
      Local intent/safety routing
                  ↓
       Local response templates
           ↙             ↘
   Companion text      Orb/animation
           ↓
  Optional browser read-aloud
```

**Implementation order for the model:**

1. Load and test a Transformers.js-compatible model with one short sentence.
2. Put initialization behind one shared promise so the model is not loaded on every message.
3. Show a clear “Preparing on-device AI…” state during the first load.
4. Handle initialization failure gracefully; do not block breathing, chips, and local template responses on model availability.
5. Preload the model while internet is available, then turn off the network and verify inference. For the strongest offline proof, serve the necessary model assets locally and document model setup instead of relying only on a remote first download.
6. Try WebGPU only if it works reliably on the actual demo laptop/browser. Keep a CPU/WASM path or clear fallback; WebGPU support is not universal.

### Example integration shape

The code shape below is a starting point, not a complete app. Confirm the current model repository and Transformers.js version before pinning dependencies.

```js
import { pipeline } from '@huggingface/transformers';

let classifierPromise;

function getClassifier() {
  if (!classifierPromise) {
    classifierPromise = pipeline(
      'sentiment-analysis',
      'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
      { dtype: 'q8' }
    );
  }
  return classifierPromise;
}

export async function classifyLocally(text) {
  const classifier = await getClassifier();
  return classifier(text);
}
```

Do not map a positive/negative label directly to “happy/depressed” or any diagnosis. Use it only as a weak signal that influences which prewritten supportive response is offered. A selected feeling chip should override generic sentiment routing.

### Optional cloud mode

Do **not** integrate it until the offline core, tests, and demo are stable. If added, it must be visibly labeled “Cloud-enhanced,” explain that the text will be sent to a provider, and remain optional. Never claim the cloud-enhanced mode is local AI. Do not add Gemini + ElevenLabs + mic input all at once; each is another failure point and another disclosure/privacy requirement.

---

## 5. Scope control: must-build versus stretch

### P0 — Must work before anything else

- [x] One responsive sanctuary screen with orb/face and clear text input. *(Built with Astro, Tailwind, and custom CSS)*
- [ ] Four feeling chips and a submit action.
- [ ] At least one verified on-device ML inference model.
- [ ] Local response selection producing restrained, non-clinical replies.
- [ ] Orb breath animation with pause/stop control. *(Breathing animation active; pause/stop control pending)*
- [ ] Tap/press ripple and visible companion state change.
- [x] Persistent “Support” button with verified help information. *(Header button + 24/7 crisis modal with 1553 and mobile hotlines)*
- [ ] Loading, empty-input, long-input, and model-failure states. *(Empty/long input & typing pulse handled; model-failure pending model integration)*
- [x] No cloud AI API required for the complete basic interaction.
- [ ] README disclosures and an offline demonstration test.

### P1 — Add only after P0 passes

- [x] “Read aloud” via browser speech synthesis. *(Implemented with Web Speech API SpeechSynthesisUtterance & per-message voice button)*
- [ ] Subtle ambient sound, muted by default and user-controlled.
- [x] Optional local-only check-in count or preference persistence. *(Implemented in localStorage for onboarding)*
- [ ] Installable PWA/offline shell, if it does not destabilize the working app.
- [ ] English/Taglish-written response templates. Be transparent that the chosen model may be English-focused.

### P2 — Do not attempt unless ahead of schedule

- [ ] Cloud LLM for optional richer replies.
- [x] Microphone input and speech-to-text. *(Implemented with browser SpeechRecognition in composer)*
- [ ] Full local generative LLM with WebLLM.
- [x] Accounts, database, analytics, multi-page onboarding, physical robot, gaze detection, or sensor integration. *(Note: Onboarding flow already completed at `/onboarding`)*

The physical spherical companion remains the **future vision**, not a claim about the current build. Demonstrate its digital twin and state the hardware ideas as future work only.

---

## 6. Two viable build plans

### Plan A — Feasible and recommended: local classifier + local response engine

**Choose this by default.** It is best suited to a solo developer with one build day.

- The model infers a broad text sentiment signal locally.
- Feeling chips and small local routing rules map the user to a response category.
- Curated response templates create the reply locally.
- The orb, tactile feedback, breathing cue, support panel, and read-aloud are client-side.
- Cloud APIs are not required.

**Why it is strong:** It satisfies the local-inference requirement, is easier to test, reduces privacy exposure, and gives the judges a complete product interaction instead of a half-finished chatbot.

**Trade-off:** It is not a full generative conversational AI. Be candid: the local model classifies text; the companion response engine uses an authored, local policy/template system.

### Plan B — Stronger stretch: full local generative model

Attempt only after Plan A is fully demoable.

- Evaluate [WebLLM local inference](https://webllm.io/docs/guides/local-inference/) on the **actual demo laptop**; it uses WebGPU and requires a compatible browser/device.
- Preselect one small supported model, download/cache it ahead of the event, and test its startup time and offline behavior.
- Keep the same response-length limit, safety rules, user controls, and support panel.
- Make a local deterministic template fallback available if the model fails, loads too slowly, or runs out of memory.

**Go/no-go gate:** If you cannot produce a local response reliably within about 30–45 minutes of trying the model, abandon this stretch and protect Plan A. Do not make a giant first-time model download the critical path on demo day.

### What “great” should mean here

A great hackathon submission is not the one with the most APIs. It is the one that **demonstrates the required local AI clearly, feels thoughtfully designed, works without Wi-Fi, and can be explained honestly**. The local classifier plus polished, restrained interactions should be the target; the local LLM is an optional enhancement, not a prerequisite.

---

## 7. Execution schedule: Friday, October 9

The following schedule assumes work starts around **2:00 PM** and the draft's Saturday demo is still accurate. If the organizer's deadline differs, protect the same order and milestones rather than the exact times.

| Time | Work | Completion gate | Status |
|---|---|---|---|
| 2:00–2:20 PM | Read final rules; create/clean repo; run app locally; create initial commit. | App opens on laptop and there is a Git checkpoint. | ✅ Done |
| 2:20–3:20 PM | Build the single-screen sanctuary: orb, input, chips, responsive layout, loading/empty states. | The UI works without any AI integration. | 🟡 Mostly Done (Chips & orb pause remaining) |
| 3:20–4:30 PM | Integrate local Transformers.js model; show initialization state; run two or three test inputs. | At least one true local model inference returns in-browser. If not stable by the end of this block, fix the model loading path before adding features. | ⏳ Next Up |
| 4:30–5:30 PM | Implement response templates and local routing; ensure the user can override the model with a feeling chip. | Message → inference → useful response works repeatedly. | ⏳ Pending |
| 5:30–6:15 PM | Add breathing cycle, tap/press ripple, blink/smile state, and pause/stop. | The interaction is visually obvious and smooth. | 🟡 Partial (Breathing active; ripple & pause control pending) |
| 6:15–6:45 PM | Add Support panel and privacy note; remove diagnostic or treatment claims. | Support is reachable from any state; messages are not silently persisted or uploaded. | ✅ Done |
| 6:45–7:30 PM | Dinner/break. | Stop coding and rest briefly. | ☕ Done |
| 7:30–8:15 PM | Offline test: preload model, disconnect network, complete the basic flow. Try reload and restart; note any cache limitations. | Core local flow works without cloud AI. If not, fix this before adding voice/cloud features. | ⏳ Pending |
| 8:15–9:00 PM | Visual polish, mobile/window resizing, keyboard accessibility, button labels, motion stop control. | Clean demo path with no obvious broken controls. | 🟡 In Progress |
| 9:00–9:30 PM | Write README and technology/model/API disclosure. | A judge can understand exactly what runs locally and what does not. | ⏳ Pending |
| 9:30–10:00 PM | Rehearse the 5-minute pitch and record a backup demo. Commit/tag a stable version. | The app has a known-good build and a fallback recording. | ⏳ Pending |
| By 10:00–10:30 PM | Stop feature work; prepare laptop/charger and rest. | Avoid risking the working build for low-value late changes. | ⏳ Pending |

### Hard decision gates

- **By 3:20 PM:** the UI must work with no AI.
- **By 4:30 PM:** local inference must be demonstrated. Do not keep switching model families indefinitely.
- **By 7:30 PM:** P0 features must be complete.
- **By 8:15 PM:** prove offline operation or document and fix exactly what failed.
- **After 9:00 PM:** do not introduce new dependencies unless repairing a blocking bug.

---

## 8. Saturday demo preparation

### Before leaving

- [ ] Start the app locally and verify the known-good version.
- [ ] Open Pahinga once while connected so required model assets are loaded.
- [ ] Disconnect Wi-Fi and demonstrate the full core flow again.
- [ ] Keep a local screen recording in case the live demo or laptop fails.
- [ ] Keep a deployed URL as a backup, not as the only proof of offline functionality.
- [ ] Carry laptop, charger, phone/power bank, earphones, student/government ID, and any required extension cord.
- [ ] Confirm official venue, registration window, pitch time, and transit before departure.

### Suggested five-minute demonstration

**0:00–0:40 — Problem.** Students under pressure do not always need another long answer; sometimes they need a quiet, low-friction pause.

**0:40–1:20 — Product.** Show the orb, calm visual hierarchy, and one-click feeling chips.

**1:20–2:20 — Local AI proof.** Enter a prepared sample message. Explain that the small text classifier runs in the browser and the message is routed to the local response engine. Show the “On-device AI” status and point to the network-offline proof if asked.

**2:20–3:20 — Experience.** Tap/pet the orb, show its response, pause the breathing animation, and use read-aloud if reliable.

**3:20–4:10 — Safety and privacy.** Open Support. Explain that Pahinga is not a diagnostic tool, that free-text messages are not sent to a cloud model in local mode, and that help options are always accessible.

**4:10–5:00 — Architecture and future vision.** Explain model/library/framework disclosures, limitations, and the future physical companion as future work. Close with the product promise.

Do not spend the demo trying to prove every stretch feature. Show the complete P0 path, which is the evidence that the project works.

---

## 9. Safety, privacy, and trust checklist

- [x] Use validating, non-judgmental language; no diagnosis or certainty about a person's emotional state.
- [x] Never claim the tool treats anxiety/depression or replaces professional care.
- [ ] Make breathing optional; provide pause/stop/exit controls.
- [x] Keep the Support button visible and easy to reach.
- [x] Use conservative keyword checks only as a prompt to surface support; do not describe them as a reliable suicide-risk detector.
- [x] If someone signals immediate danger, prioritize a brief caring message and visible human/emergency support resources rather than a generic productivity prompt.
- [x] Do not silently save raw messages or send them to analytics/cloud providers.
- [x] If a cloud-enhanced mode is added, disclose the provider and data transfer before use; keep local mode as the default.
- [x] Verify hotline details immediately before submission. The Philippine Information Agency reported the NCMH 24/7 Crisis Hotline at **1553** and listed mobile alternatives in an October 2025 public notice: [PIA / DOH notice](https://pia.gov.ph/news/doh-mental-health-programs-crisis-hotlines-available-this-undas/). Keep the support page focused on validated sources and do not imply Pahinga itself is an emergency service.

---

## 10. Acceptance tests: what “done” means

### Functional tests

- [x] Empty text cannot create a broken response.
- [ ] A normal negative/overwhelmed sample triggers a relevant local response.
- [ ] A neutral/positive sample does not force an anxiety label.
- [ ] Feeling chips work even when model inference is slow or unavailable.
- [ ] Repeated messages do not reload the model every time.
- [ ] The orb breathes smoothly and can be paused/stopped.
- [ ] Tap/press interaction works with mouse, touch, and keyboard where applicable.
- [x] Support opens regardless of the current conversation state.
- [x] Text is still available if speech synthesis is unavailable.
- [x] Refresh/restart works without account credentials.

### Local AI and offline tests

- [ ] The model loads successfully from the chosen local/cached source.
- [ ] Model inference is performed on-device; the message is not sent to a remote LLM API in local mode.
- [ ] After model warm-up, disable the network and complete a full interaction.
- [ ] Try a browser with WebGPU unavailable or disabled; the app should use its supported CPU/WASM path or fall back gracefully.
- [ ] Clearly label the model as an English sentiment classifier—not a diagnostic emotion model—and explain the limitation.
- [ ] Capture a screenshot or short clip of the offline test for evidence.

### Build hygiene

- [x] No API keys in frontend code or Git history.
- [x] No unneeded database/auth/backend.
- [ ] No console errors on the main demo path.
- [ ] No broken layout on the demo laptop and phone-sized viewport.
- [ ] Git repository includes installation instructions, build log, model/library links, license information, and known limitations.

---

## 11. README: required disclosure template

Add a section like this and edit it to match the exact code you ship:

```md
## Technology and AI Disclosure

- Frontend: [exact framework/version]
- UI/animation: [exact libraries, if any]
- Local inference runtime: Hugging Face Transformers.js [exact version]
- Model: [exact model repository and pinned revision]
- Model task: English text sentiment classification; not clinical emotion recognition
- Model license: [verify and state the license for the exact model repository/revision used; do not assume the ONNX export has the same displayed metadata as its upstream model]
- Response generation: locally authored templates and routing rules
- Voice output: browser SpeechSynthesis API (if shipped)
- Persistence: localStorage for [list exactly what is stored]; no raw messages saved by default
- Cloud APIs: [None in local mode / specify optional provider, purpose, and what data leaves the device]
- AI-assisted development: [tools used, as required by event rules]
- Known limitations: sentiment can be wrong; English-focused model; not medical advice or emergency service
- Offline verification: [date/time, browser, device, and steps tested]
```

Do not list Gemini or ElevenLabs as part of the shipped architecture unless the code actually uses them. Do not claim offline support until the offline test has passed.

---

## 12. Pitch and judge Q&A

### Short pitch

> “Pahinga is a local-first digital companion for stressful moments. Instead of overwhelming someone with a long list of advice, it combines on-device text inference with a restrained response engine, a breathing visual, and gentle touch-responsive feedback. Its core experience works without a cloud AI API, and it is designed as the software foundation for a future physical desk companion.”

### “Isn't it just a chatbot?”

> “The response is only one part of the experience. Pahinga combines on-device text inference, a local response policy, optional paced breathing, and a touch-responsive companion interface. The experience still works without a cloud LLM.”

### “Is the model reading emotions accurately?”

> “No model can know a person's true emotional state from a short message. The selected model provides a broad sentiment signal only. The user can choose or override the feeling state, and Pahinga uses that signal to select a gentle response—not to diagnose.”

### “What exactly runs locally?”

> “The text classifier inference, response selection, breathing/touch animation, and support UI run on the device in local mode. A remote model is not required for the core flow. The README names the exact model, runtime, version, license, and optional APIs.”

### “What is the physical robot?”

> “It is the long-term direction, not a hardware prototype being claimed today. The current hackathon product demonstrates the interaction and local software architecture that could later control a physical companion.”

---

## 13. Useful primary references

- [Transformers.js pipeline API](https://huggingface.co/docs/transformers.js/en/pipelines) — browser text classification and model loading.
- [Transformers.js WebGPU guide](https://huggingface.co/docs/transformers.js/guides/webgpu) — optional GPU inference and compatibility caveats.
- [Transformers.js environment/cache settings](https://huggingface.co/docs/transformers.js/api/env) — browser caching and local model paths.
- [Xenova DistilBERT SST-2 ONNX export](https://huggingface.co/Xenova/distilbert-base-uncased-finetuned-sst-2-english) — candidate Transformers.js-compatible sentiment model; [upstream model card](https://huggingface.co/distilbert/distilbert-base-uncased-finetuned-sst-2-english) lists Apache-2.0, but verify the exact export repository's terms before shipping.
- [WebLLM local inference guide](https://webllm.io/docs/guides/local-inference/) — stretch option for full local LLM generation; requires WebGPU and model loading.
- [Philippine Information Agency / DOH hotline notice](https://pia.gov.ph/news/doh-mental-health-programs-crisis-hotlines-available-this-undas/) — public hotline source to re-check before shipping.

---

## Final recommendation

**Ship Plan A completely, then stop.** Make the local classifier run, keep the response policy local, polish the orb interaction, expose human support, prove offline behavior, disclose every model/API/tool, and rehearse a stable five-minute demo. Only attempt Plan B if all Plan A acceptance tests pass early and the local model has already been proven on the actual laptop. A simple, complete, honest product is a stronger submission than a wider feature list that fails during the demo.
