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
  const soundBtn = $('sound-btn');
  const feelingChips = $('feeling-chips');
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
  let pinned = true;
  let voiceAutoRead = false;

  /* ================= AI reply (placeholder) =================
     Swap this for your backend call, e.g.:
       const res = await fetch('/api/chat', { method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ messages: history }) });
       return (await res.json()).reply;
  ============================================================ */
  const PLACEHOLDER_REPLIES = [
    'Thank you for telling me. Feeling afraid doesn’t cancel out your strength — they can sit side by side. What feels heaviest in this moment?',
    'I hear you. You don’t have to hold everything together here. Would it help to say a little more about what’s weighing on you?',
    'That makes sense. Let’s go slowly — take one more easy breath, then tell me what comes up when you do.',
  ];
  // TODO: replace with real crisis handling and verified local hotline numbers before launch.
  const CRISIS_PATTERN = /\b(kill myself|end my life|suicid\w*|self[- ]?harm|hurt myself|want to die|don'?t want to live)\b/i;
  const CRISIS_REPLY = 'I’m really glad you told me, and I’m taking it seriously. You deserve support from a real person right now — please contact your local emergency number or a crisis line in your area, or someone you trust who can be with you. I’m here too. Are you safe right now?';
  const ERROR_REPLY = 'Something got in the way on my end. Take a breath, and try sending that again in a moment.';
  let replyIndex = 0;

  async function getAIReply(text /*, history */) {
    await new Promise((r) => setTimeout(r, 1100 + Math.random() * 900));
    if (CRISIS_PATTERN.test(text)) return CRISIS_REPLY;
    return PLACEHOLDER_REPLIES[replyIndex++ % PLACEHOLDER_REPLIES.length];
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
  function addMessage(role, text, { animate = true, track = true } = {}) {
    const node = templates[role].content.firstElementChild.cloneNode(true);
    node.querySelector('.msg-text').textContent = text;
    if (!animate) node.classList.remove('msg-in');
    if (role === 'ai' && !canSpeak) node.querySelector('.voice-btn').remove();
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
      const reply = await getAIReply(text, history);
      if (sid !== sessionId) return;
      typingNode.remove();
      const aiNode = addMessage('ai', reply);
      if (voiceAutoRead && canSpeak) {
        const vBtn = aiNode.querySelector('.voice-btn');
        if (vBtn) toggleVoice(vBtn);
      }
    } catch (err) {
      console.error(err);
      if (sid !== sessionId) return;
      typingNode.remove();
      addMessage('ai', ERROR_REPLY);
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
    if (!canSpeak) return;
    const btn = currentVoiceBtn;
    currentUtterance = null;
    currentVoiceBtn = null;
    if (btn) setSpeaking(btn, false);
    window.speechSynthesis.cancel();
  }

  function toggleVoice(btn) {
    if (!canSpeak) return;
    if (currentVoiceBtn === btn) { stopVoice(); return; }
    stopVoice();
    stopListening();

    const text = btn.closest('article').querySelector('.msg-text').textContent;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = SPEECH_LANG;
    utterance.rate = 0.92;
    utterance.pitch = 1;

    const finish = () => {
      if (currentUtterance !== utterance) return;
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

  /* ================= Sound Toggle ================= */
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      if (!canSpeak) {
        showStatus('Voice reading is not supported by your browser.');
        return;
      }
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
        showStatus('Take a deep breath in... and exhale gently.');
      }
    });
  }

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
    if (recognizer) { try { recognizer.abort(); } catch (err) { /* noop */ } }
  });

  /* ================= Init ================= */
  addMessage('ai', GREETING, { animate: false });
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
