(() => {
  'use strict';

  /* ================= Config ================= */
  const STEP = 1;
  const MIN_AGE = 13;
  const MAX_AGE = 120;
  const NAME_MIN = 2;
  const ABOUT_MAX = 300;
  const ABOUT_MAX_HEIGHT = 320;   // px — textarea stops growing here and scrolls
  const ABOUT_WARN_AT = 270;      // counter turns amber past this many characters

  // ISO 3166-1 alpha-2 codes; display names come from Intl.DisplayNames (falls back to the code).
  const REGION_CODES = (
    'AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ ' +
    'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK ' +
    'FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT ' +
    'JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML ' +
    'MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM ' +
    'PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD ' +
    'TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'
  ).split(' ');

  /* ================= Elements ================= */
  const $ = (id) => document.getElementById(id);
  const app = $('app');
  const form = $('onboarding-form');
  const cta = $('cta');
  const ctaLabel = $('cta-label');
  const formError = $('form-error');
  const countEl = $('about-count');
  const countNumber = $('about-count-n');

  if ($('step-number')) {
    $('step-number').textContent = String(STEP);
  }

  if (!form || !app) return; // Exit if not on the onboarding page

  /* ================= Fields =================
     To add a field: add markup with data-field + an "-error" element, then register it here. */
  const fields = {
    name: {
      el: $('name'),
      error: $('name-error'),
      required: true,
      validate: (v) => (v.length < NAME_MIN ? 'Please tell us what to call you.' : ''),
    },
    country: {
      el: $('country'),
      error: $('country-error'),
      required: true,
      validate: (v) => (v ? '' : 'Please choose your country.'),
    },
    age: {
      el: $('age'),
      error: $('age-error'),
      required: true,
      validate: (v) => {
        if (!v) return 'Please add your age.';
        const n = Number(v);
        if (!Number.isInteger(n) || n < MIN_AGE || n > MAX_AGE) {
          return `Please enter an age from ${MIN_AGE} to ${MAX_AGE}.`;
        }
        return '';
      },
    },
    about: {
      el: $('about'),
      error: $('about-error'),
      required: false,
      validate: (v) => (v.length > ABOUT_MAX ? `Please keep this under ${ABOUT_MAX} characters.` : ''),
    },
  };
  const order = ['name', 'country', 'age', 'about'];
  const requiredKeys = order.filter((k) => fields[k].required);
  let submitting = false;

  /* ================= Countries ================= */
  function populateCountries() {
    let names = null;
    try {
      if (typeof Intl.DisplayNames === 'function') {
        names = new Intl.DisplayNames(['en'], { type: 'region' });
      }
    } catch (err) { /* fall back to codes */ }

    const items = REGION_CODES.map((code) => {
      let label = code;
      try { label = (names && names.of(code)) || code; } catch (err) { /* keep code */ }
      return { code, label };
    }).sort((a, b) => a.label.localeCompare(b.label, 'en'));

    const frag = document.createDocumentFragment();
    for (const { code, label } of items) {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = label;
      frag.append(opt);
    }
    fields.country.el.append(frag);
  }

  /* ================= Validation ================= */
  const valueOf = (key) => fields[key].el.value.trim();

  function setError(key, message) {
    const { el, error } = fields[key];
    error.textContent = message;
    el.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  // Returns the error message; only paints it when `show` is true.
  function validateField(key, show) {
    const message = fields[key].validate(valueOf(key));
    if (show) setError(key, message);
    return message;
  }

  function isReady() {
    return requiredKeys.every((k) => !fields[k].validate(valueOf(k)));
  }

  function syncCta() {
    cta.disabled = submitting || !isReady();
  }

  /* ================= Textarea ================= */
  function autoResize() {
    const el = fields.about.el;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, ABOUT_MAX_HEIGHT) + 'px';
    el.style.overflowY = el.scrollHeight > ABOUT_MAX_HEIGHT ? 'auto' : 'hidden';
  }

  function syncCounter() {
    const length = fields.about.el.value.length;
    countNumber.textContent = length > 0 ? String(length) : '';
    countEl.dataset.near = String(length >= ABOUT_WARN_AT);
  }

  /* ================= Events ================= */
  form.addEventListener('input', (e) => {
    const key = e.target.dataset.field;
    if (!key) return;
    // Don't scold while typing, but clear (or refresh) an error that's already showing.
    if (fields[key].el.getAttribute('aria-invalid') === 'true') validateField(key, true);
    if (key === 'about') { autoResize(); syncCounter(); }
    formError.textContent = '';
    syncCta();
  });

  form.addEventListener('change', (e) => {
    const key = e.target.dataset.field;
    if (!key) return;
    validateField(key, true);   // selects and number steppers commit on change
    syncCta();
  });

  form.addEventListener('focusout', (e) => {
    const key = e.target.dataset.field;
    if (!key) return;
    validateField(key, true);   // validate on blur
    syncCta();
  });

  // Number input: block characters that aren't whole digits.
  fields.age.el.addEventListener('keydown', (e) => {
    if (['e', 'E', '+', '-', '.', ','].includes(e.key)) e.preventDefault();
  });

  // Enter moves to the next field; Cmd/Ctrl+Enter in the textarea submits.
  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    const key = e.target.dataset.field;
    if (!key) return;   // buttons keep their default behavior

    if (key === 'about') {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        submit();
      }
      return;   // plain Enter inserts a newline
    }

    e.preventDefault();
    fields[order[order.indexOf(key) + 1]].el.focus();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submit();
  });

  /* ================= Submit ================= */
  function collectData() {
    const country = fields.country.el;
    return {
      name: valueOf('name'),
      countryCode: country.value,
      country: country.selectedOptions[0] ? country.selectedOptions[0].textContent : '',
      age: Number(valueOf('age')),
      about: valueOf('about'),
    };
  }

  function setSubmitting(on) {
    submitting = on;
    form.setAttribute('aria-busy', String(on));
    ctaLabel.textContent = on ? 'continuing...' : 'continue...';
    syncCta();
  }

  async function onStepComplete(data) {
    document.dispatchEvent(new CustomEvent('pahinga:step-complete', { detail: { step: STEP, data } }));
    
    // Store onboarding info in local storage
    localStorage.setItem('pahinga_onboarded', 'true');
    localStorage.setItem('pahinga_user_data', JSON.stringify(data));
    
    // Simulate short network delay then redirect
    await new Promise((resolve) => setTimeout(resolve, 600));
    window.location.href = '/chat';
  }

  async function submit() {
    if (submitting) return;

    const invalid = order.filter((key) => validateField(key, true));
    syncCta();
    if (invalid.length) {
      fields[invalid[0]].el.focus();
      return;
    }

    formError.textContent = '';
    setSubmitting(true);
    try {
      await onStepComplete(collectData());
    } catch (err) {
      console.error(err);
      formError.textContent = 'Something went wrong on our side. Please try again.';
    } finally {
      setSubmitting(false);
    }
  }

  /* ================= Layout niceties ================= */
  // Mobile keyboards: size the app to the visual viewport so the form scrolls instead of hiding.
  if (window.visualViewport) {
    const fit = () => app.style.setProperty('--app-h', window.visualViewport.height + 'px');
    window.visualViewport.addEventListener('resize', fit);
    fit();
  }

  /* ================= Init ================= */
  populateCountries();
  autoResize();
  syncCounter();
  syncCta();
})();
