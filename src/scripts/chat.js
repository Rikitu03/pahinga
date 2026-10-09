function initPahingaChat() {
  'use strict';

  /* ================= Config ================= */
  const SPEECH_LANG = 'en-US';      // e.g. 'en-PH' or 'fil-PH' if your target browsers support it
  const GREETING = "Hey... how's your day going? Is everything all right?";
  const DEFAULT_PLACEHOLDER = 'Speak or type freely... you are safe here.';

  const PRE_POPULATED_AUDIO = {
    "Hey... how's your day going? Is everything all right?": "/audio/welcome.mp3",
    "When you're exhausted, that inner voice convinces you that you're lacking. But you've built real things with very little support. Take a slow breath... What happened today that made you feel like you aren't enough?": "/audio/was_talented.mp3",
    "I hear you, and it's completely okay that you feel low today. You don't have to force a smile or pretend to be fine. Take a gentle breath... Did something specific happen, or is it just the weight of everything catching up with you?": "/audio/so_down.mp3",
    "Comparing your backstage to everyone else's highlight reel will always feel like a trap. You are carrying a heavy backpack they don't have to carry. Drop your shoulders for a moment... Who or what were you comparing yourself to today?": "/audio/only_asgood.mp3",
    "When the burden feels like a 20-story climb, even breathing feels like work. You don't have to solve tomorrow right this second. Take a soft exhale with me... What is sitting as the heaviest piece on your chest right now?": "/audio/feels_heavy.mp3",
    "You have been running on empty for so long trying to hold everything together. Take a slow, soft breath with me... What has been draining your energy the most lately?": "/audio/burnt_out.mp3"
  };
  const MAX_INPUT_HEIGHT = 120;     // px (about 5 lines)

  /* ================= Elements ================= */
  const $ = (id) => document.getElementById(id);
  const app = $('app');
  const scroller = $('scroller');
  const thread = $('thread');
  const stage = $('orb-stage');
  const orbShell = $('orb-shell');
  const orbToggle = $('orb-toggle');
  const caption = $('orb-caption');
  const form = $('composer');
  const input = $('message');
  const micBtn = $('mic-btn');
  const sendBtn = $('send-btn');
  const statusEl = $('status');
  const endBtn = $('end-session');
  const crisisBtn = $('crisis-btn');
  const crisisModal = $('crisis-modal');
  const closeCrisisModal = $('close-crisis-modal');
  const ambientBtn = $('ambient-btn');
  const soundBtn = $('sound-btn');
  const feelingChips = $('feeling-chips');
  const aiBadge = $('ai-badge');
  const aiBadgeDot = $('ai-badge-dot');
  const aiBadgeText = $('ai-badge-text');
  const templates = {
    ai: $('tpl-ai'),
    user: $('tpl-user'),
    typing: $('tpl-typing'),
  };

  if (!app || !thread || !form || !input) {
    return;
  }

  /* ================= State ================= */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const canSpeak = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

  const history = [];        // [{ role: 'user' | 'assistant', content }]
  let sessionId = 0;         // bumps on "End session" so stale replies are dropped
  let replying = false;
  let listening = false;
  let userWantsMic = false;
  let recognizer = null;
  let micRestartTimer = null;
  let typingDebounceTimer = null;
  let fallbackTimer = null;
  let statusTimer = null;
  let baseText = '';
  let currentUtterance = null;
  let currentVoiceBtn = null;
  let currentAudio = null;
  let currentAudioUrl = null;
  const dynamicAudioCache = new Map(); // text -> blob Object URL
  let voiceRunId = 0;
  let pinned = true;
  let voiceAutoRead = true;
  let orbPaused = false;

  const sharedAudio = new Audio();
  let audioBlessed = false;
  function blessAudio() {
    if (audioBlessed) return;
    audioBlessed = true;
    sharedAudio.play().catch(() => {});
  }
  document.addEventListener('click', blessAudio, { once: true });
  document.addEventListener('keydown', blessAudio, { once: true });

  /* ================= Local AI & Response Engine ================= */
  let classifier = null;
  let modelLoading = false;
  let modelReady = false;
  let modelFailed = false;
  let qwenUnavailableUntil = 0;

  function getOnboardingContext() {
    try {
      const raw = localStorage.getItem('pahinga_user_data');
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;

      const clean = (value, max) => typeof value === 'string'
        ? value.trim().slice(0, max)
        : '';
      const profile = {
        name: clean(data.name, 80),
        country: clean(data.country, 100),
        about: clean(data.about, 300),
      };

      return profile.name || profile.country || profile.about ? profile : null;
    } catch (err) {
      console.info('[Pahinga] Onboarding context unavailable; continuing without profile.', err);
      return null;
    }
  }

  function updateAIBadge(status, percent = null) {
    if (!aiBadge || !aiBadgeDot || !aiBadgeText) return;
    if (status === 'ready') {
      aiBadgeDot.className = 'size-1.5 rounded-full bg-emerald-500';
      aiBadgeText.textContent = 'On-device AI Ready';
      aiBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[0.7rem] font-medium bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/30 transition-all duration-300 cursor-pointer hover:bg-emerald-100/70 shadow-xs';
      aiBadge.title = 'DistilBERT sentiment model active 100% locally in browser cache. Click to check.';
    } else if (status === 'progress') {
      aiBadgeDot.className = 'size-1.5 rounded-full bg-amber-400 animate-pulse';
      aiBadgeText.textContent = percent != null ? `Downloading AI ${percent}%` : 'Downloading AI...';
      aiBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[0.7rem] font-medium bg-amber-50 text-amber-800 ring-1 ring-amber-400/30 transition-all duration-300 cursor-pointer shadow-xs';
      aiBadge.title = 'Loading on-device model weights into browser cache...';
    } else if (status === 'loading') {
      aiBadgeDot.className = 'size-1.5 rounded-full bg-amber-400 animate-pulse';
      aiBadgeText.textContent = 'Preparing AI...';
      aiBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[0.7rem] font-medium bg-amber-50 text-amber-800 ring-1 ring-amber-400/30 transition-all duration-300 cursor-pointer shadow-xs';
      aiBadge.title = 'Lazy-loading local model weights in background...';
    } else {
      aiBadgeDot.className = 'size-1.5 rounded-full bg-teal-500';
      aiBadgeText.textContent = 'Local Engine';
      aiBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[0.7rem] font-medium bg-teal-100/70 text-teal-800 ring-1 ring-teal-600/20 transition-all duration-300 cursor-pointer';
      aiBadge.title = 'Running local non-clinical response engine';
    }
  }

  async function initLocalModel() {
    if (modelLoading || modelReady) return;
    modelLoading = true;
    modelFailed = false;
    updateAIBadge('loading');
    try {
      console.log('[Pahinga] Lazy-loading on-device sentiment model in background...');
      const { pipeline: hfPipeline, env: hfEnv } = await import('@huggingface/transformers');
      if (hfEnv) {
        hfEnv.allowLocalModels = false;
        hfEnv.useBrowserCache = true;
      }
      classifier = await hfPipeline(
        'text-classification',
        'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
        {
          dtype: 'q8',
          progress_callback: (data) => {
            if (data.status === 'progress' && data.total) {
              const pct = Math.round((data.loaded / data.total) * 100);
              updateAIBadge('progress', pct);
            } else if (data.status === 'ready' || data.status === 'done') {
              updateAIBadge('ready');
            }
          }
        }
      );
      modelReady = true;
      modelFailed = false;
      console.log('[Pahinga] On-device DistilBERT sentiment classifier ready and cached.');
      updateAIBadge('ready');
      showStatus('On-device AI ready. Model cached in browser.', 3200);
    } catch (err) {
      classifier = null;
      modelReady = false;
      modelFailed = true;
      console.warn('[Pahinga] On-device model initialization failed; local template fallback is active:', err);
      updateAIBadge('fallback');
      showStatus(
        navigator.onLine
          ? 'On-device AI is unavailable. Local grounding replies are still active.'
          : 'You are offline. Local grounding replies are active; cached AI may be unavailable.',
        4200
      );
    } finally {
      modelLoading = false;
    }
  }

  // Trigger lazy loading promptly without blocking UI interaction
  setTimeout(initLocalModel, 700);

  // Badge click feedback
  if (aiBadge) {
    aiBadge.addEventListener('click', () => {
      if (modelReady) {
        showStatus('On-device AI is active! Powered locally by DistilBERT with zero cloud API calls.', 4000);
      } else if (modelLoading) {
        showStatus('On-device model weights are downloading to your browser cache...', 3500);
      } else {
        showStatus('Starting on-device AI model load...', 3000);
        initLocalModel();
      }
    });
  }

  /* ================= Response Templates (Restrained & Non-clinical) ================= */
  // Dedicated responses for the 5 active feeling chips in the current build
  const CHIP_RESPONSES = {
    burnt_out: [
      "You have been running on empty for so long trying to hold everything together. Take a slow, soft breath with me... What has been draining your energy the most lately?"
    ],
    talented: [
      "When you're exhausted, that inner voice convinces you that you're lacking. But you've built real things with very little support. Take a slow breath... What happened today that made you feel like you aren't enough?"
    ],
    comparison: [
      "Comparing your backstage to everyone else's highlight reel will always feel like a trap. You are carrying a heavy backpack they don't have to carry. Drop your shoulders for a moment... Who or what were you comparing yourself to today?"
    ],
    down: [
      "I hear you, and it's completely okay that you feel low today. You don't have to force a smile or pretend to be fine. Take a gentle breath... Did something specific happen, or is it just the weight of everything catching up with you?"
    ],
    heavy: [
      "When the burden feels like a 20-story climb, even breathing feels like work. You don't have to solve tomorrow right this second. Take a soft exhale with me... What is sitting as the heaviest piece on your chest right now?"
    ]
  };

  // Keyword-based emotional intent routing
  const INTENT_PATTERNS = [
    {
      regex: /\b(tired|exhausted|sleep|can'?t sleep|insomnia|drained|weary|fatigue)\b/i,
      replies: [
        'Exhaustion reaches deep into the bones. You don’t need to push through another thing right now. Would it help to close your eyes and take one soft breath with the circle?',
        'Your mind has been running hard. It makes complete sense that you feel drained. Would you like to pause here and rest for a moment?'
      ]
    },
    {
      regex: /\b(anxious|anxiety|panic|overwhelm\w*|scared|afraid|stress\w*|pressure|nervous)\b/i,
      replies: [
        'When anxiety or tension builds up, everything feels urgent. But right here, nothing is asking anything from you. Would it help to take a slow 4-second breath with the circle?',
        'I hear the pressure you’re under. Let’s take this one second at a time. What is one small thing in the room around you that feels steady right now?'
      ]
    },
    {
      regex: /\b(lonely|alone|nobody|isolated|no one understands|empty)\b/i,
      replies: [
        'Feeling isolated in a noisy world can be so heavy. Even in quietness, you are not invisible here. Would it help to sit together and take one gentle breath?',
        'I’m glad you reached out, even with just a few words. You don’t have to face this completely alone. How does your chest feel right now?'
      ]
    }
  ];

  // Restrained non-clinical sentiment templates (Reflect -> Ground -> Invite agency)
  const SENTIMENT_TEMPLATES = {
    NEGATIVE: [
      'That sounds like a lot to carry at once. Would it help to take one slow breath with the circle?',
      'I hear you. You don’t have to hold everything together here. What is the smallest thing you need from this moment?',
      'It makes sense that you feel that way. Let’s take things one moment at a time. Would you like to pause and breathe with me?',
      'Thank you for sharing that with me. It’s okay to feel worn down. What would feel most comforting for you right now?'
    ],
    POSITIVE: [
      'I’m glad there is a moment of lightness for you today. Would it help to take a gentle breath and simply savor it?',
      'That is really nice to hear. You deserve these calm spaces. How does it feel to pause and take that in?',
      'Holding onto small moments of relief can be such a quiet strength. What is one thing you’re grateful for right now?'
    ],
    NEUTRAL: [
      'Thank you for telling me. Let’s just take a quiet pause together. How does your body feel right now?',
      'I’m right here with you. There’s no rush to explain or fix anything. What feels most present for you in this moment?',
      'I hear you. Let’s take one easy, unhurried breath together and see what arises.'
    ]
  };

  const CRISIS_PATTERN = /\b(kill myself|end my life|suicid\w*|self[- ]?harm|hurt myself|want to die|don'?t want to live|no reason to live|end it all)\b/i;
  const CRISIS_REPLY = 'I hear how much pain you’re carrying, and I want to make sure you are safe. Please know that you don’t have to face this alone. Reach out to the NCMH Crisis Hotline at 1553 (toll-free nationwide) or text 0917-899-8727. Caring support is available 24/7. Are you in a safe place right now?';
  const ERROR_REPLY = 'Something got in the way on my end. Take a breath, and try sending that again in a moment.';

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function matchFeelingChip(text) {
    const lower = text.toLowerCase().trim();
    if (lower.includes('burnt out')) return pickRandom(CHIP_RESPONSES.burnt_out);
    if (lower.includes('talented')) return pickRandom(CHIP_RESPONSES.talented);
    if (lower.includes('as good as') || lower.includes('everybody')) return pickRandom(CHIP_RESPONSES.comparison);
    if (lower.includes('down') && (lower.includes('feel') || lower.includes('so down'))) return pickRandom(CHIP_RESPONSES.down);
    if (lower.includes('heavy')) return pickRandom(CHIP_RESPONSES.heavy);
    return null;
  }

  async function getAIReply(text /*, history */) {
    // 1. Safety & Crisis Rule Check (Highest Priority)
    if (CRISIS_PATTERN.test(text)) {
      if (crisisModal && typeof crisisModal.showModal === 'function') {
        setTimeout(() => {
          try { if (!crisisModal.open) crisisModal.showModal(); } catch (e) {}
        }, 1200);
      }
      await new Promise((r) => setTimeout(r, 800));
      return { text: CRISIS_REPLY, meta: '🚨 24/7 Crisis Support' };
    }

    // Humane, calm pacing delay (simulating thoughtful listening)
    const pacePromise = new Promise((r) => setTimeout(r, 900 + Math.random() * 500));

    // 2. Feeling Chip Override (Direct match for current build chips)
    const chipReply = matchFeelingChip(text);
    if (chipReply) {
      await pacePromise;
      return { text: chipReply, meta: '⚡ Quick Feeling Chip' };
    }

    // 3. Keyword-based Emotional Intent Routing
    for (const intent of INTENT_PATTERNS) {
      if (intent.regex.test(text)) {
        await pacePromise;
        return { text: pickRandom(intent.replies), meta: '🌿 Grounding Pattern' };
      }
    }

    // 4. Optional local generative response via llama.cpp/Qwen3.
    // The endpoint only talks to a localhost runtime; all failures use the existing local path.
    if (Date.now() >= qwenUnavailableUntil) {
      try {
        const recentUserMessages = history
          .filter((entry) => entry.role === 'user')
          .slice(-3, -1)
          .map((entry) => ({ role: 'user', content: entry.content }));
        const response = await fetch('/api/local-qwen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            context: recentUserMessages,
            onboarding: getOnboardingContext(),
          }),
        });
        if (response.ok) {
          const payload = await response.json();
          const generated = typeof payload?.reply === 'string' ? payload.reply.trim() : '';
          if (isAcceptableQwenReply(generated)) {
            await pacePromise;
            return { text: generated, meta: '✨ Local Qwen3 • llama.cpp' };
          }
        }
        qwenUnavailableUntil = Date.now() + 15000;
      } catch (err) {
        qwenUnavailableUntil = Date.now() + 15000;
        console.info('[Pahinga AI] Local Qwen runtime unavailable; using local fallback.', err);
      }
    }

    // 5. Local Sentiment Classification via On-Device DistilBERT (Transformers.js)
    if (modelReady && classifier) {
      try {
        const result = await classifier(text);
        const top = result?.[0];
        if (top && top.label) {
          const sentiment = top.label.toUpperCase();
          const templates = SENTIMENT_TEMPLATES[sentiment] || SENTIMENT_TEMPLATES.NEUTRAL;
          const scorePct = Math.round((top.score || 0) * 100);
          await pacePromise;
          return {
            text: pickRandom(templates),
            meta: `🧠 On-device AI • ${sentiment} (${scorePct}%)`
          };
        }
      } catch (err) {
        console.warn('[Pahinga AI] Local inference warning, falling back to local template:', err);
      }
    } else if (!modelReady && !modelLoading && !modelFailed) {
      // Trigger lazy load if not already triggered
      initLocalModel();
    }

    // 6. Fallback template (Zero delay, instant non-clinical reply)
    await pacePromise;
    return {
      text: pickRandom(SENTIMENT_TEMPLATES.NEUTRAL),
      meta: modelFailed
        ? '🌱 Local Grounding (AI unavailable)'
        : modelLoading
          ? '🌱 Local Grounding (AI loading...)'
          : '🌱 Local Grounding'
    };
  }

  function isAcceptableQwenReply(reply) {
    if (!reply || reply.length > 900) return false;
    if (reply.includes('```') || /^\s*[-*]\s/m.test(reply)) return false;
    if (/\b(as an ai|language model|diagnos(?:e|is)|medical advice|you have depression)\b/i.test(reply)) {
      return false;
    }
    return true;
  }

  /* ================= Helpers ================= */
  function scrollToBottom() {
    requestAnimationFrame(() => {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    });
  }

  function showStatus(message, ms = 3200) {
    clearTimeout(statusTimer);
    statusEl.textContent = message;
    statusEl.dataset.show = 'true';
    statusTimer = setTimeout(() => { statusEl.dataset.show = 'false'; }, ms);
  }

  function autoResize() {
    input.style.height = 'auto';
    const next = Math.min(input.scrollHeight, MAX_INPUT_HEIGHT);
    input.style.height = next + 'px';
    input.style.overflowY = input.scrollHeight > MAX_INPUT_HEIGHT ? 'auto' : 'hidden';
  }

  function syncComposer() {
    const hasText = input.value.trim().length > 0;
    form.dataset.typing = String(hasText);
    sendBtn.disabled = replying || !hasText;
  }

  function collapseOrb() {
    if (stage.dataset.collapsed === 'true') return;
    stage.dataset.collapsed = 'true';
    caption.setAttribute('aria-hidden', 'true');
  }

  function expandOrb() {
    stage.dataset.collapsed = 'false';
    caption.removeAttribute('aria-hidden');
  }

  /* ================= Messages ================= */
  function addMessage(role, text, { animate = true, track = true, meta = null } = {}) {
    const node = templates[role].content.firstElementChild.cloneNode(true);
    node.querySelector('.msg-text').textContent = text;
    if (!animate) node.classList.remove('msg-in');
    if (role === 'ai') {
      const metaEl = node.querySelector('.ai-meta');
      if (metaEl) {
        if (meta) {
          metaEl.textContent = meta;
          metaEl.classList.remove('hidden');
        } else {
          metaEl.classList.add('hidden');
        }
      }
    }
    thread.append(node);
    if (track) history.push({ role: role === 'ai' ? 'assistant' : 'user', content: text });
    scrollToBottom();
    return node;
  }

  function showTyping() {
    const node = templates.typing.content.firstElementChild.cloneNode(true);
    thread.append(node);
    scrollToBottom();
    return node;
  }

  async function send() {
    const text = input.value.trim();
    if (!text || replying) return;

    if (feelingChips) feelingChips.style.display = 'none';

    stopListening();
    stopVoice();
    collapseOrb();
    addMessage('user', text);

    input.value = '';
    autoResize();
    replying = true;
    syncComposer();
    input.focus({ preventScroll: true });

    const sid = sessionId;
    const typingNode = showTyping();
    try {
      const replyData = await getAIReply(text, history);
      if (sid !== sessionId) return;
      typingNode.remove();
      const replyText = typeof replyData === 'string' ? replyData : replyData.text;
      const replyMeta = typeof replyData === 'object' ? replyData.meta : null;
      const aiNode = addMessage('ai', replyText, { meta: replyMeta });
      if (voiceAutoRead) {
        const vBtn = aiNode.querySelector('.voice-btn');
        if (vBtn) toggleVoice(vBtn);
      }
    } catch (err) {
      console.error(err);
      if (sid !== sessionId) return;
      typingNode.remove();
      addMessage('ai', ERROR_REPLY, { meta: 'System Notice' });
    } finally {
      if (sid === sessionId) {
        replying = false;
        syncComposer();
      }
    }
  }

  /* ================= Text to speech ================= */
  function setSpeaking(btn, on) {
    btn.dataset.speaking = String(on);
    btn.querySelector('.voice-label').textContent = on ? 'Stop voice' : 'Hear voice';
  }

  function stopVoice() {
    voiceRunId++;
    const btn = currentVoiceBtn;
    currentUtterance = null;
    currentVoiceBtn = null;
    if (btn) setSpeaking(btn, false);
    if (canSpeak) window.speechSynthesis.cancel();
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.removeAttribute('src');
      currentAudio.load();
      currentAudio = null;
    }
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
      currentAudioUrl = null;
    }
  }

  function speakWithBrowser(text, btn, runId) {
    if (!canSpeak) {
      setSpeaking(btn, false);
      showStatus('Voice reading is unavailable in this browser.', 3600);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = SPEECH_LANG;
    utterance.rate = 0.92;
    utterance.pitch = 1;

    const finish = () => {
      if (currentUtterance !== utterance || voiceRunId !== runId) return;
      setSpeaking(btn, false);
      currentUtterance = null;
      currentVoiceBtn = null;
    };
    utterance.onend = finish;
    utterance.onerror = finish;

    currentUtterance = utterance;   // keep a reference so it isn't garbage-collected mid-speech
    currentVoiceBtn = btn;
    setSpeaking(btn, true);
    window.speechSynthesis.speak(utterance);
  }

  async function speakWithCloud(text, btn, runId) {
    const MAX_RETRIES = 1;
    let response = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (voiceRunId !== runId) return;
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 600 * attempt));
        if (voiceRunId !== runId) return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);

      try {
        const res = await fetch('/api/elevenlabs-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });

        if (res.ok) {
          response = res;
          break;
        }

        // Retry only on transient rate limit or upstream gateway errors (502, 504, 429)
        if (res.status === 429 || res.status === 502 || res.status === 504) {
          continue;
        }

        throw new Error(`Cloud voice rejected with status ${res.status}`);
      } catch (err) {
        if (attempt >= MAX_RETRIES) throw err;
      } finally {
        clearTimeout(timeout);
      }
    }

    if (!response || !response.ok) {
      throw new Error('Cloud voice request failed.');
    }

    const blob = await response.blob();
    if (voiceRunId !== runId) return;

    const url = URL.createObjectURL(blob);
    dynamicAudioCache.set(text, url);

    const audio = sharedAudio;
    audio.src = url;
    audio.playbackRate = 0.96;
    currentAudioUrl = null; // Do not revoke so dynamicAudioCache can replay without re-fetching
    currentAudio = audio;
    currentVoiceBtn = btn;
    setSpeaking(btn, true);

    const finish = () => {
      if (currentAudio !== audio || voiceRunId !== runId) return;
      currentAudio = null;
      currentVoiceBtn = null;
      setSpeaking(btn, false);
      audio.onended = null;
      audio.onerror = null;
    };
    audio.onended = finish;
    audio.onerror = () => {
      if (currentAudio !== audio || voiceRunId !== runId) return;
      finish();
      showStatus('Cloud voice playback failed. Using browser voice instead.', 3600);
      speakWithBrowser(text, btn, runId);
    };

    try {
      await audio.play();
      showStatus('Reply voiced with ElevenLabs.', 2400);
    } catch (e) {
      finish();
      console.warn('[Pahinga Voice] Autoplay or playback was prevented:', e);
      showStatus('Voice ready. Tap "Hear voice" to listen.', 3600);
    }
  }

  async function speakWithStaticAudio(url, btn, runId, isCached = false) {
    const audio = sharedAudio;
    audio.src = url;
    audio.playbackRate = 1.0;
    currentAudioUrl = null;
    currentAudio = audio;
    currentVoiceBtn = btn;
    setSpeaking(btn, true);

    const finish = () => {
      if (currentAudio !== audio || voiceRunId !== runId) return;
      currentAudio = null;
      currentVoiceBtn = null;
      setSpeaking(btn, false);
      audio.onended = null;
      audio.onerror = null;
    };
    audio.onended = finish;
    audio.onerror = () => {
      if (currentAudio !== audio || voiceRunId !== runId) return;
      finish();
      showStatus('Failed to play voice.', 3600);
    };

    try {
      await audio.play();
      showStatus(isCached ? 'Reply voiced with ElevenLabs (cached).' : 'Playing recorded voice.', 2400);
    } catch (e) {
      finish();
      console.warn('[Pahinga Voice] Autoplay or playback was prevented:', e);
      showStatus('Voice ready. Tap "Hear voice" to listen.', 3600);
    }
  }

  async function toggleVoice(btn) {
    if (currentVoiceBtn === btn) { stopVoice(); return; }
    stopVoice();
    stopListening();

    const text = btn.closest('article').querySelector('.msg-text').textContent.trim();
    const runId = voiceRunId;
    currentVoiceBtn = btn;
    setSpeaking(btn, true);
    btn.querySelector('.voice-label').textContent = 'Loading voice';

    const staticAudioUrl = PRE_POPULATED_AUDIO[text];
    if (staticAudioUrl) {
      await speakWithStaticAudio(staticAudioUrl, btn, runId, false);
      return;
    }

    const cachedCloudUrl = dynamicAudioCache.get(text);
    if (cachedCloudUrl) {
      await speakWithStaticAudio(cachedCloudUrl, btn, runId, true);
      return;
    }

    try {
      await speakWithCloud(text, btn, runId);
    } catch (error) {
      if (voiceRunId !== runId) return;
      console.warn('[Pahinga Voice] ElevenLabs unavailable; falling back to browser voice.', error);
      showStatus('Cloud voice unavailable. Using browser voice instead.', 3600);
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.removeAttribute('src');
        currentAudio.load();
        currentAudio = null;
      }
      if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
        currentAudioUrl = null;
      }
      currentVoiceBtn = null;
      setSpeaking(btn, false);
      speakWithBrowser(text, btn, runId);
    }
  }

  thread.addEventListener('click', (e) => {
    const btn = e.target.closest('.voice-btn');
    if (btn) toggleVoice(btn);
  });

  /* ================= Speech to text ================= */
  function setListening(on) {
    listening = on;
    micBtn.dataset.listening = String(on);
    micBtn.setAttribute('aria-pressed', String(on));
    micBtn.setAttribute('aria-label', on ? 'Stop voice input (microphone is on)' : 'Start voice input');
    micBtn.setAttribute('title', on ? 'Stop voice input (click to turn off)' : 'Start voice input');
    input.placeholder = on ? 'Listening... speak freely, take your time (tap mic to stop).' : DEFAULT_PLACEHOLDER;
    syncComposer();
  }

  function startRecognitionEngine() {
    if (!userWantsMic || !SpeechRecognitionCtor) return;

    if (recognizer) {
      try { recognizer.abort(); } catch (err) { /* noop */ }
      recognizer = null;
    }

    let rec;
    try {
      rec = new SpeechRecognitionCtor();
    } catch (err) {
      console.warn('[Pahinga Mic] Failed to instantiate SpeechRecognition:', err);
      userWantsMic = false;
      setListening(false);
      return;
    }

    rec.lang = SPEECH_LANG;
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      if (userWantsMic) {
        setListening(true);
      } else {
        try { rec.stop(); } catch (e) { /* noop */ }
      }
    };

    rec.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = 0; i < event.results.length; i++) {
        const item = event.results[i];
        const piece = item[0].transcript;
        if (item.isFinal) {
          if (finalTranscript && !finalTranscript.endsWith(' ') && !piece.startsWith(' ')) {
            finalTranscript += ' ' + piece;
          } else {
            finalTranscript += piece;
          }
        } else {
          if (interimTranscript && !interimTranscript.endsWith(' ') && !piece.startsWith(' ')) {
            interimTranscript += ' ' + piece;
          } else {
            interimTranscript += piece;
          }
        }
      }

      let combined = finalTranscript;
      if (interimTranscript) {
        if (combined && !combined.endsWith(' ') && !interimTranscript.startsWith(' ')) {
          combined += ' ' + interimTranscript;
        } else {
          combined += interimTranscript;
        }
      }

      combined = combined.trimStart();
      if (baseText) {
        const needsSpace = !baseText.endsWith(' ') && !combined.startsWith(' ');
        input.value = (baseText + (needsSpace && combined ? ' ' : '') + combined).replace(/[ \t]+/g, ' ');
      } else {
        input.value = combined;
      }

      autoResize();
      syncComposer();
    };

    rec.onerror = (event) => {
      console.warn('[Pahinga Mic] Recognition event note:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        userWantsMic = false;
        clearTimeout(micRestartTimer);
        setListening(false);
        showStatus('Microphone access is blocked. Allow it in your browser settings to use voice.', 4500);
      } else if (event.error === 'audio-capture') {
        userWantsMic = false;
        clearTimeout(micRestartTimer);
        setListening(false);
        showStatus('No microphone detected. Please check your audio inputs.', 4000);
      }
      // Note: 'no-speech', 'aborted', and network pauses do not shut off the mic.
      // In manual mode, users have freedom to pause; silence recovers smoothly in onend.
    };

    rec.onend = () => {
      if (recognizer === rec) {
        recognizer = null;
      }

      // If the user still wants the mic active, keep it on and seamlessly restart
      if (userWantsMic) {
        baseText = input.value.trim() ? input.value.trimEnd() + ' ' : '';
        clearTimeout(micRestartTimer);
        micRestartTimer = setTimeout(() => {
          if (userWantsMic) {
            startRecognitionEngine();
          }
        }, 150);
      } else {
        setListening(false);
        input.focus();
      }
    };

    recognizer = rec;

    try {
      rec.start();
    } catch (err) {
      console.warn('[Pahinga Mic] Start attempt deferred:', err);
      if (userWantsMic) {
        clearTimeout(micRestartTimer);
        micRestartTimer = setTimeout(() => {
          if (userWantsMic) startRecognitionEngine();
        }, 300);
      }
    }
  }

  function startListening() {
    stopVoice();

    // Fallback: no SpeechRecognition support -> brief listening state, then hand back to typing.
    if (!SpeechRecognitionCtor) {
      userWantsMic = false;
      setListening(true);
      showStatus('Voice input isn’t available in this browser. You can type instead.', 4000);
      fallbackTimer = setTimeout(() => {
        setListening(false);
        input.focus();
      }, 2200);
      return;
    }

    userWantsMic = true;
    clearTimeout(micRestartTimer);
    clearTimeout(typingDebounceTimer);
    baseText = input.value.trim() ? input.value.trimEnd() + ' ' : '';
    setListening(true);
    showStatus('Microphone is on. Speak freely — tap again when done.', 3200);
    startRecognitionEngine();
  }

  function stopListening({ showFeedback = false } = {}) {
    userWantsMic = false;
    clearTimeout(micRestartTimer);
    clearTimeout(typingDebounceTimer);
    clearTimeout(fallbackTimer);

    if (recognizer) {
      try { recognizer.stop(); } catch (err) { /* already stopped */ }
      recognizer = null;
    }

    setListening(false);
    if (showFeedback) {
      showStatus('Microphone turned off.', 1800);
    }
  }

  micBtn.addEventListener('click', () => {
    if (listening || userWantsMic) {
      stopListening({ showFeedback: true });
    } else {
      startListening();
    }
  });

  /* ================= Composer events ================= */
  input.addEventListener('input', () => {
    if (userWantsMic) {
      clearTimeout(typingDebounceTimer);
      typingDebounceTimer = setTimeout(() => {
        if (userWantsMic && recognizer) {
          baseText = input.value.trim() ? input.value.trimEnd() + ' ' : '';
          try { recognizer.stop(); } catch (e) { /* noop */ }
        }
      }, 300);
    }
    autoResize();
    syncComposer();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();           // Enter sends, Shift+Enter inserts a newline
      send();
    } else if (e.key === 'Escape') {
      stopListening({ showFeedback: true });
    }
  });

  form.addEventListener('submit', (e) => { e.preventDefault(); send(); });

  /* ================= Feeling Chips ================= */
  if (feelingChips) {
    feelingChips.addEventListener('click', (e) => {
      const btn = e.target.closest('.feeling-chip');
      if (!btn || replying) return;
      input.value = btn.textContent.trim();
      send();
    });
  }

  /* ================= Session ================= */
  function endSession() {
    sessionId++;
    stopListening();
    stopVoice();
    replying = false;
    history.length = 0;
    thread.replaceChildren();
    input.value = '';
    autoResize();
    syncComposer();
    expandOrb();
    scroller.scrollTo({ top: 0 });
    const aiNode = addMessage('ai', GREETING, { meta: 'Offline Sanctuary' });
    if (voiceAutoRead) {
      const vBtn = aiNode.querySelector('.voice-btn');
      if (vBtn) toggleVoice(vBtn);
    }
    if (feelingChips) feelingChips.style.display = '';
    showStatus('Session ended. Take care of yourself.');
  }
  if (endBtn) endBtn.addEventListener('click', endSession);

  /* ================= Crisis Support Modal ================= */
  if (crisisBtn && crisisModal) {
    crisisBtn.addEventListener('click', () => {
      crisisModal.showModal();
    });
  }
  if (closeCrisisModal && crisisModal) {
    closeCrisisModal.addEventListener('click', () => {
      crisisModal.close();
    });
  }
  if (crisisModal) {
    crisisModal.addEventListener('click', (e) => {
      if (e.target === crisisModal) crisisModal.close();
    });
  }

  /* ================= Ambient Sound (Procedural Calm Waves & Rain) ================= */
  let audioCtx = null;
  let ambientGain = null;
  let ambientNoiseNode = null;
  let ambientFilter = null;
  let ambientLfo = null;
  let ambientActive = false;

  function initAmbientAudio() {
    if (audioCtx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      showStatus('Ambient audio is not supported in this browser.');
      return;
    }
    audioCtx = new AudioContextClass();

    // 5 seconds of soothing pink noise buffer
    const bufferSize = audioCtx.sampleRate * 5;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045;
      b6 = white * 0.115926;
    }

    ambientNoiseNode = audioCtx.createBufferSource();
    ambientNoiseNode.buffer = noiseBuffer;
    ambientNoiseNode.loop = true;

    // Gentle lowpass filter for deep oceanic / rain warmth
    ambientFilter = audioCtx.createBiquadFilter();
    ambientFilter.type = 'lowpass';
    ambientFilter.frequency.setValueAtTime(360, audioCtx.currentTime);

    // LFO modulator (~0.11Hz ≈ 9s cycle) synced with breathing orb pacing
    ambientLfo = audioCtx.createOscillator();
    ambientLfo.frequency.setValueAtTime(0.11, audioCtx.currentTime);
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.setValueAtTime(140, audioCtx.currentTime);
    ambientLfo.connect(lfoGain);
    lfoGain.connect(ambientFilter.frequency);

    // Master gain with smooth exponential curves to avoid audio pops
    ambientGain = audioCtx.createGain();
    ambientGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);

    ambientNoiseNode.connect(ambientFilter);
    ambientFilter.connect(ambientGain);
    ambientGain.connect(audioCtx.destination);

    ambientNoiseNode.start();
    ambientLfo.start();
  }

  function setAmbientActive(active) {
    if (!ambientBtn) return;
    if (active) {
      initAmbientAudio();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      if (ambientGain && audioCtx) {
        ambientGain.gain.cancelScheduledValues(audioCtx.currentTime);
        ambientGain.gain.setValueAtTime(Math.max(ambientGain.gain.value, 0.0001), audioCtx.currentTime);
        ambientGain.gain.exponentialRampToValueAtTime(0.3, audioCtx.currentTime + 1.5);
      }
      ambientActive = true;
      ambientBtn.dataset.active = 'true';
      ambientBtn.setAttribute('aria-pressed', 'true');
      ambientBtn.setAttribute('aria-label', 'Mute ambient ocean waves');
      showStatus('🌊 Ambient ocean waves playing (synced to 9s breath pacing).', 3500);
    } else {
      if (ambientGain && audioCtx) {
        ambientGain.gain.cancelScheduledValues(audioCtx.currentTime);
        ambientGain.gain.setValueAtTime(Math.max(ambientGain.gain.value, 0.0001), audioCtx.currentTime);
        ambientGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.2);
      }
      ambientActive = false;
      ambientBtn.dataset.active = 'false';
      ambientBtn.setAttribute('aria-pressed', 'false');
      ambientBtn.setAttribute('aria-label', 'Toggle soothing ambient sound');
      showStatus('Ambient sound muted.', 2000);
    }
  }

  if (ambientBtn) {
    ambientBtn.addEventListener('click', () => {
      setAmbientActive(!ambientActive);
    });
  }

  /* ================= Sound Toggle (Read-Aloud TTS) ================= */
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      voiceAutoRead = !voiceAutoRead;
      soundBtn.setAttribute('aria-pressed', String(voiceAutoRead));
      if (voiceAutoRead) {
        soundBtn.classList.add('text-teal-600', 'bg-teal-50', 'ring-teal-400');
        showStatus('Spoken replies enabled.');
      } else {
        soundBtn.classList.remove('text-teal-600', 'bg-teal-50', 'ring-teal-400');
        stopVoice();
        showStatus('Spoken replies paused.');
      }
    });
  }

  /* ================= Orb Touch / Breath Interaction ================= */
  if (orbShell) {
    orbShell.addEventListener('click', () => {
      if (stage && stage.dataset.collapsed !== 'true') {
        orbShell.classList.remove('orb-shell--pulse');
        void orbShell.offsetWidth;
        orbShell.classList.add('orb-shell--pulse');
        stage.dataset.orbState = 'present';
        showStatus('Take a deep breath in... and exhale gently.');
      }
    });
  }

  function setOrbPaused(paused) {
    orbPaused = paused;
    const orb = orbShell && orbShell.querySelector('.orb');
    if (orb) orb.classList.toggle('orb--still', paused);
    if (orbShell) orbShell.classList.toggle('orb-shell--paused', paused);
    if (orbToggle) {
      orbToggle.setAttribute('aria-pressed', String(paused));
      orbToggle.setAttribute('aria-label', paused ? 'Resume breathing orb' : 'Pause breathing orb');
      const label = orbToggle.querySelector('.orb-toggle-label');
      const icon = orbToggle.querySelector('.orb-toggle-icon');
      if (label) label.textContent = paused ? 'Resume breathing' : 'Pause breathing';
      if (icon) icon.textContent = paused ? '▶' : 'Ⅱ';
    }
    if (caption) {
      caption.textContent = paused
        ? 'Breathing paused. Stay here for as long as you need.'
        : 'Inhale gently... drop your shoulders.';
    }
    showStatus(paused ? 'Breathing paused.' : 'Breathing resumed.', 2400);
  }

  if (orbToggle) orbToggle.addEventListener('click', () => setOrbPaused(!orbPaused));

  window.addEventListener('offline', () => {
    showStatus('You are offline. Local responses remain available.', 3600);
  });
  window.addEventListener('online', () => {
    showStatus('Connection restored. On-device AI can retry from the badge.', 3600);
  });

  /* ================= Layout niceties ================= */
  // Keep the latest message in view after the orb finishes collapsing.
  stage.addEventListener('transitionend', (e) => {
    if (e.target === orbShell && e.propertyName === 'height') scrollToBottom();
  });

  // Stay pinned to the bottom when the composer grows or the keyboard opens.
  scroller.addEventListener('scroll', () => {
    pinned = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
  }, { passive: true });
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => { if (pinned) scroller.scrollTop = scroller.scrollHeight; }).observe(scroller);
  }

  // Mobile keyboards: size the app to the visual viewport.
  if (window.visualViewport) {
    const fit = () => app.style.setProperty('--app-h', window.visualViewport.height + 'px');
    window.visualViewport.addEventListener('resize', fit);
    fit();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { stopVoice(); stopListening({ showFeedback: true }); }
  });

  window.addEventListener('pagehide', () => {
    stopVoice();
    if (ambientActive) setAmbientActive(false);
    stopListening();
  });

  /* ================= Init ================= */
  if (soundBtn && voiceAutoRead) {
    soundBtn.setAttribute('aria-pressed', 'true');
    soundBtn.classList.add('text-teal-600', 'bg-teal-50', 'ring-teal-400');
  }

  const aiNode = addMessage('ai', GREETING, { animate: false, meta: 'Offline Sanctuary' });
  thread.setAttribute('aria-live', 'polite');   // announce only what arrives after load
  scroller.scrollTop = 0;
  autoResize();
  syncComposer();

  if (voiceAutoRead) {
    const vBtn = aiNode.querySelector('.voice-btn');
    if (vBtn) {
      setTimeout(() => {
        toggleVoice(vBtn);
      }, 400);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPahingaChat);
} else {
  initPahingaChat();
}
