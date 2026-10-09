function initPahingaChat() {
  'use strict';

  /* ================= Config ================= */
  const SPEECH_LANG = 'en-US';      // e.g. 'en-PH' or 'fil-PH' if your target browsers support it
  const GREETING = 'I’m right here. Take a breath first — slowly, there’s no rush here. What are you feeling right now?';
  const DEFAULT_PLACEHOLDER = 'Speak or type freely... you are safe here.';
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
  let recognizer = null;
  let fallbackTimer = null;
  let statusTimer = null;
  let baseText = '';
  let currentUtterance = null;
  let currentVoiceBtn = null;
  let currentAudio = null;
  let currentAudioUrl = null;
  let voiceRunId = 0;
  let pinned = true;
  let voiceAutoRead = false;
  let orbPaused = false;

  /* ================= Local AI & Response Engine ================= */
  let classifier = null;
  let modelLoading = false;
  let modelReady = false;
  let modelFailed = false;

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
      'Burnout is your body and mind telling you it’s time to stop pushing. You don’t have to prove anything or accomplish anything here. Would you like to take one slow, easy breath with the circle?',
      'When you’ve run on empty for too long, even small steps feel exhausting. You are allowed to simply exist and rest right now. What is one pressure you can set down for the next few minutes?',
      'Pahinga muna sandali. Hindi mo kailangang patunayan ang sarili mo sa bawat segundo. Subukan nating huminga nang malalim kasabay ng bilog.'
    ],
    talented: [
      'It’s so painful when you feel like you’re falling short, but comparison hides all the quiet effort you’ve given. You are allowed to learn and grow at your own pace. Would it help to drop your shoulders and take a slow breath?',
      'Your worth as a person doesn’t depend on how effortless things seem for others. You carry your own unique value. What is one small, kind thing you can tell yourself right now?',
      'Madalas nating ikumpara ang simula natin sa tagumpay ng iba. May sarili kang bilis at halaga. Huminga tayo nang dahan-dahan, nandito lang ako.'
    ],
    comparison: [
      'Measuring your inside against everyone else’s outside will always feel unfair to you. You don’t have to keep up with the whole world in this space. Would you like to take an unhurried breath together?',
      'It is exhausting to constantly measure yourself against others. You have your own story, and you are allowed to move gently. What would feel most soothing for you in this moment?',
      'Nakakapagod makipaghabulan sa mundo. Dito sa Pahinga, sapat ka kung sino ka ngayon. Gusto mo bang huminga nang marahan?'
    ],
    down: [
      'I hear you, and it’s okay that you feel this way. You don’t have to force a smile or pretend you’re okay in this sanctuary. Would you like to take one quiet breath with the circle, or just sit here for a while?',
      'Heavy days come, and feeling down doesn’t mean you’ve failed at anything. I’m right here beside you. What does your body feel like it needs most right now?',
      'Ayos lang kahit hindi ka okay ngayon. Hindi mo kailangang magpanggap dito. Samahan kita, huminga tayo nang payapa.'
    ],
    heavy: [
      'That sounds like a lot to carry all at once. You don’t have to carry every single piece of it by yourself right this second. Would it help to take one slow breath and let your jaw loosen?',
      'When everything feels heavy, even deciding what to do next is exhausting. Let’s make this space as simple as possible. What is the smallest thing you need from this moment?',
      'Napakabigat nga niyan dalhin nang mag-isa. Bitiwan mo muna ang ibang pasanin kahit sa ilang minuto lang. Inhale nang dahan-dahan... at exhale.'
    ]
  };

  // Keyword-based emotional intent routing
  const INTENT_PATTERNS = [
    {
      regex: /\b(tired|exhausted|sleep|can'?t sleep|insomnia|drained|weary|fatigue|pagod|antok)\b/i,
      replies: [
        'Exhaustion reaches deep into the bones. You don’t need to push through another thing right now. Would it help to close your eyes and take one soft breath with the circle?',
        'Your mind has been running hard. It makes complete sense that you feel drained. Would you like to pause here and rest for a moment?',
        'Ramdam ko ang pagod mo. Pahinga muna ang isip at katawan. Huminga tayo nang banayad kasama ng bilog.'
      ]
    },
    {
      regex: /\b(anxious|anxiety|panic|overwhelm\w*|scared|afraid|stress\w*|pressure|nervous|kaba|takot)\b/i,
      replies: [
        'When anxiety or tension builds up, everything feels urgent. But right here, nothing is asking anything from you. Would it help to take a slow 4-second breath with the circle?',
        'I hear the pressure you’re under. Let’s take this one second at a time. What is one small thing in the room around you that feels steady right now?',
        'Huminahon ka muna, walang humahabol sa atin. Dahan-dahan lang, isa-isang segundo. Subukan nating huminga nang malalim.'
      ]
    },
    {
      regex: /\b(lonely|alone|nobody|isolated|no one understands|empty|mag-isa|lungkot)\b/i,
      replies: [
        'Feeling isolated in a noisy world can be so heavy. Even in quietness, you are not invisible here. Would it help to sit together and take one gentle breath?',
        'I’m glad you reached out, even with just a few words. You don’t have to face this completely alone. How does your chest feel right now?',
        'Kahit tahimik ang paligid, hindi ka nag-iisa rito. Nandito ako para makinig at samahan ka.'
      ]
    }
  ];

  // Restrained non-clinical sentiment templates (Reflect -> Ground -> Invite agency)
  const SENTIMENT_TEMPLATES = {
    NEGATIVE: [
      'That sounds like a lot to carry at once. Would it help to take one slow breath with the circle?',
      'I hear you. You don’t have to hold everything together here. What is the smallest thing you need from this moment?',
      'It makes sense that you feel that way. Let’s take things one moment at a time. Would you like to pause and breathe with me?',
      'Thank you for sharing that with me. It’s okay to feel worn down. What would feel most comforting for you right now?',
      'Mabigat man ang pakiramdam ngayon, hindi mo kailangang buhatin ang lahat nang sabay-sabay. Pahinga muna tayo sandali kasabay ng bilog.'
    ],
    POSITIVE: [
      'I’m glad there is a moment of lightness for you today. Would it help to take a gentle breath and simply savor it?',
      'That is really nice to hear. You deserve these calm spaces. How does it feel to pause and take that in?',
      'Holding onto small moments of relief can be such a quiet strength. What is one thing you’re grateful for right now?',
      'Nakakagaan sa loob marinig iyan. Karapat-dapat ka sa kapayapaan at ginhawa. Namnamin natin ang sandaling ito.'
    ],
    NEUTRAL: [
      'Thank you for telling me. Let’s just take a quiet pause together. How does your body feel right now?',
      'I’m right here with you. There’s no rush to explain or fix anything. What feels most present for you in this moment?',
      'I hear you. Let’s take one easy, unhurried breath together and see what arises.',
      'Salamat sa pagbabahagi. Nandito lang ako, walang nagmamadali. Hingang malalim at pakinggan ang sarili.'
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

    // 4. Local Sentiment Classification via On-Device DistilBERT (Transformers.js)
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

    // 5. Fallback template (Zero delay, instant non-clinical reply)
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
    form.dataset.typing = String(hasText && !listening);
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
    const response = await fetch('/api/elevenlabs-voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) throw new Error('Cloud voice request failed.');

    const blob = await response.blob();
    if (voiceRunId !== runId) return;

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudioUrl = url;
    currentAudio = audio;
    currentVoiceBtn = btn;
    setSpeaking(btn, true);

    const finish = () => {
      if (currentAudio !== audio || voiceRunId !== runId) return;
      currentAudio = null;
      currentAudioUrl = null;
      currentVoiceBtn = null;
      URL.revokeObjectURL(url);
      setSpeaking(btn, false);
    };
    audio.onended = finish;
    audio.onerror = () => {
      if (currentAudio !== audio || voiceRunId !== runId) return;
      finish();
      showStatus('Cloud voice playback failed. Using browser voice instead.', 3600);
      speakWithBrowser(text, btn, runId);
    };
    await audio.play();
    showStatus('Reply voiced with ElevenLabs.', 2400);
  }

  async function toggleVoice(btn) {
    if (currentVoiceBtn === btn) { stopVoice(); return; }
    stopVoice();
    stopListening();

    const text = btn.closest('article').querySelector('.msg-text').textContent;
    const runId = voiceRunId;
    currentVoiceBtn = btn;
    setSpeaking(btn, true);
    btn.querySelector('.voice-label').textContent = 'Loading voice';

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
    micBtn.setAttribute('aria-label', on ? 'Stop voice input' : 'Start voice input');
    input.placeholder = on ? 'Listening... go ahead, I’m here.' : DEFAULT_PLACEHOLDER;
    syncComposer();
  }

  function startListening() {
    stopVoice();

    // Fallback: no SpeechRecognition support -> brief listening state, then hand back to typing.
    if (!SpeechRecognitionCtor) {
      setListening(true);
      showStatus('Voice input isn’t available in this browser. You can type instead.');
      fallbackTimer = setTimeout(() => {
        setListening(false);
        input.focus();
      }, 2200);
      return;
    }

    const rec = new SpeechRecognitionCtor();
    rec.lang = SPEECH_LANG;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    baseText = input.value.trim() ? input.value.trimEnd() + ' ' : '';

    rec.onstart = () => setListening(true);
    rec.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      input.value = baseText + transcript;
      autoResize();
      syncComposer();
    };
    rec.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        showStatus('Microphone access is blocked. Allow it in your browser settings to use voice.', 4500);
      } else if (event.error === 'no-speech') {
        showStatus('I didn’t catch that. Tap the mic and try again.');
      } else if (event.error !== 'aborted') {
        showStatus('Voice input stopped unexpectedly. You can type instead.');
      }
    };
    rec.onend = () => {
      if (recognizer === rec) recognizer = null;
      setListening(false);
      input.focus();
    };

    recognizer = rec;
    try {
      rec.start();
    } catch (err) {
      recognizer = null;
      setListening(false);
    }
  }

  function stopListening() {
    clearTimeout(fallbackTimer);
    if (recognizer) {
      try { recognizer.stop(); } catch (err) { /* already stopped */ }
    } else if (listening) {
      setListening(false);
    }
  }

  micBtn.addEventListener('click', () => (listening ? stopListening() : startListening()));

  /* ================= Composer events ================= */
  input.addEventListener('input', () => { autoResize(); syncComposer(); });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();           // Enter sends, Shift+Enter inserts a newline
      send();
    } else if (e.key === 'Escape') {
      stopListening();
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
    addMessage('ai', GREETING);
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
    if (e.key === 'Escape') { stopVoice(); stopListening(); }
  });

  window.addEventListener('pagehide', () => {
    stopVoice();
    if (ambientActive) setAmbientActive(false);
    if (recognizer) { try { recognizer.abort(); } catch (err) { /* noop */ } }
  });

  /* ================= Init ================= */
  addMessage('ai', GREETING, { animate: false, meta: 'Offline Sanctuary' });
  thread.setAttribute('aria-live', 'polite');   // announce only what arrives after load
  scroller.scrollTop = 0;
  autoResize();
  syncComposer();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPahingaChat);
} else {
  initPahingaChat();
}
