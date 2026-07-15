/* ============================================================
   APP — events, modal system, init
   ============================================================ */

/* ── Init ────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {
  // Load locale before first render so t() is ready
  if (typeof loadLocale === 'function') {
    await loadLocale();
  }
  // Always start at the splash screen
  showSplash();
});

/* ── Splash screen ───────────────────────────────────── */

function showSplash() {
  document.getElementById('splash-screen').classList.remove('hidden');
  document.getElementById('onboarding-overlay').classList.add('hidden');
  document.getElementById('main-app').classList.add('hidden');
  document.body.classList.add('is-splash');
  renderLangMenu();
}

function hideSplash() {
  document.getElementById('splash-screen').classList.add('hidden');
  document.body.classList.remove('is-splash');
}

/** "Get Started" button — always goes to onboarding for new users */
function startFromSplash() {
  hideSplash();
  showOnboarding();
}

/** "Sign In" button — returning users jump straight to their dashboard */
function signInFromSplash() {
  hideSplash();
  if (state.onboardingComplete) {
    showMainApp();
  } else {
    showOnboarding();
  }
}

function showMainApp() {
  document.getElementById('onboarding-overlay').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');
  seedOnboardingToIOS();
  seedOnboardingToAndroid();
  renderDashboard();
}

function showOnboarding() {
  document.getElementById('onboarding-overlay').classList.remove('hidden');
  document.getElementById('main-app').classList.add('hidden');
  renderOnboarding();
  // Re-apply highlight state after every render (ob-modal is re-used across sessions)
  _setObValidating(false); // triggers the latch logic inside _setObValidating
  updateObSectionStates();
}


/* ── Onboarding modal ────────────────────────────────── */

function openOnboarding(tab = 0) {
  state.onboardingTab = tab;
  // Trigger B: user is returning to the modal after completing onboarding →
  // enable highlights so unanswered fields are visually flagged.
  if (state.onboardingComplete) state.showHighlights = true;
  showOnboarding();
}

function closeOnboarding() {
  if (!state.onboardingComplete) return; // can't close if not yet done
  showMainApp();
}

function setOnboardingTab(idx) {
  _setObValidating(false);
  state.onboardingTab = idx;
  renderOnboarding();
}

/* Required fields per tab — maps tab index to OB_Q_ANSWERED keys */
const OB_TAB_REQUIRED = [
  ['title', 'platforms'],              // Tab 0: About
  ['distribution'],                    // Tab 1: Distribution
  ['screenshots'],                     // Tab 2: Assets
  ['compliance'],                        // Tab 3: Compliance
];

function _setObValidating(on) {
  // Once highlights are enabled by a trigger (returning visit or AI pre-pop),
  // callers can't turn them off — state.showHighlights latches it permanently.
  const active = on || state.showHighlights;
  document.getElementById('ob-modal')?.classList.toggle('is-validating', active);
  document.getElementById('submit-modal')?.classList.toggle('is-validating', active);
  document.getElementById('cq-modal')?.classList.toggle('is-validating', active);
}

function nextOnboardingTab() {
  // Prototype mode: advance freely — validation only triggers on Launch Dashboard
  _setObValidating(false);
  if (state.onboardingTab < 2) {
    state.onboardingTab++;
    renderOnboarding();
    const body = document.getElementById('ob-body');
    if (body) body.scrollTop = 0;
  }
}

function toggleOnboardingPlatform(pid) {
  if (state.activePlatforms.has(pid)) {
    state.activePlatforms.delete(pid);
  } else {
    state.activePlatforms.add(pid);
    if (!state.platformStepStatus[pid]) {
      state.platformStepStatus[pid] = makeEmptyPlatformSteps()[pid] || {};
    }
  }
  // Re-render just the platform tiles section in-place (platform is now in Game Details tab)
  const gridWrap = document.getElementById('ob-plat-grid-wrap');
  if (gridWrap) {
    gridWrap.innerHTML = buildObPlatTilesHTML();
    gridWrap.classList.toggle('is-req-empty', state.activePlatforms.size === 0);
  }
  renderOnboardingFooter();
  updateObSectionStates();
}

function prevOnboardingTab() {
  if (state.onboardingTab > 0) {
    _setObValidating(false);
    state.onboardingTab--;
    renderOnboarding();
    const body = document.getElementById('ob-body');
    if (body) body.scrollTop = 0;
  }
}

function completeOnboarding() {
  // Prototype mode: no mandatory fields — launch dashboard freely.
  // Validation infrastructure (OB_TAB_REQUIRED, _setObValidating) retained for future use.

  if (state._newProjectMode) {
    // Creating a 2nd+ project — preserve activePlatforms selected during onboarding
    const ver  = makeEmptyVersion('1.0');
    const proj = {
      id:               generateId('proj'),
      name:             state.formData.title,
      formData:         JSON.parse(JSON.stringify(state.formData)),
      uploads:          JSON.parse(JSON.stringify(state.uploads)),
      questionAnswers:  JSON.parse(JSON.stringify(state.questionAnswers)),
      questionInferred: JSON.parse(JSON.stringify(state.questionInferred)),
      versions:         [ver],
      buildCounters:    makeBuildCounters(),
    };
    state.projects.push(proj);
    state.activeProjectId = proj.id;
    state.activeVersionId = ver.id;
    // Keep state.activePlatforms — already populated by platform tiles in onboarding
    state.platformStepStatus = makeEmptyPlatformSteps();
    state._newProjectMode    = false;
  } else {
    // First project ever
    const ver  = makeEmptyVersion('1.0');
    const proj = {
      id:               generateId('proj'),
      name:             state.formData.title,
      formData:         JSON.parse(JSON.stringify(state.formData)),
      uploads:          JSON.parse(JSON.stringify(state.uploads)),
      questionAnswers:  JSON.parse(JSON.stringify(state.questionAnswers)),
      questionInferred: JSON.parse(JSON.stringify(state.questionInferred)),
      versions:         [ver],
      buildCounters:    makeBuildCounters(),
    };
    state.projects.push(proj);
    state.activeProjectId = proj.id;
    state.activeVersionId = ver.id;
    // Keep state.activePlatforms — already populated by platform-select tab in onboarding
    state.platformStepStatus = makeEmptyPlatformSteps();
  }

  state.onboardingComplete = true;
  showMainApp();
}


/* ── Task modal ──────────────────────────────────────── */

function openTaskModal(platformId, stepId) {
  const step = PLATFORMS[platformId].steps.find(s => s.id === stepId);
  if (step && (step.isSubmit || step.isReview)) {
    openSubmitModal(platformId);
    return;
  }
  state.activeModal = { type: 'task', platformId, stepId };
  renderTaskModal();
  document.getElementById('task-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeTaskModal() {
  state.activeModal = null;
  document.getElementById('task-overlay').classList.add('hidden');
  document.body.style.overflow = '';
  // No renderDashboard() here — targeted updates handle any state changes
}

function taskOverlayClick(e) {
  if (e.target === document.getElementById('task-overlay')) {
    closeTaskModal();
  }
}

function markTaskDone(platformId, stepId) {
  state.platformStepStatus[platformId][stepId] = 'complete';

  // Targeted DOM update — animate only this dot, not all completed dots
  const dot = document.getElementById(`dot-${platformId}-${stepId}`);
  if (dot) {
    dot.classList.add('is-complete', 'just-completed');
    dot.addEventListener('animationend', () => dot.classList.remove('just-completed'), { once: true });
    const taskRow = dot.closest('.card-task');
    if (taskRow) taskRow.classList.add('is-done');
  }

  // Recalculate progress and update bar + step count
  const counts = platformStepCount(platformId);
  const pct = counts.total ? Math.round((counts.complete / counts.total) * 100) : 0;
  const barFill = document.getElementById(`bar-fill-${platformId}`);
  if (barFill) barFill.style.width = pct + '%';
  const stepCountEl = document.getElementById(`step-count-${platformId}`);
  if (stepCountEl) stepCountEl.textContent = `${counts.complete} / ${counts.total} steps`;

  // Unlock submit button if all required steps now done
  if (counts.allRequired && !counts.submitDone) {
    const submitBtn = document.getElementById(`submit-btn-${platformId}`);
    if (submitBtn) {
      submitBtn.classList.remove('is-locked');
      submitBtn.removeAttribute('disabled');
      submitBtn.setAttribute('title', 'Submit for review');
      submitBtn.setAttribute('onclick', `finalSubmit('${platformId}')`);
    }
  }

  closeTaskModal();
}

function markTaskUndone(platformId, stepId) {
  state.platformStepStatus[platformId][stepId] = 'not_started';

  // Targeted DOM update — remove complete state from this dot only
  const dot = document.getElementById(`dot-${platformId}-${stepId}`);
  if (dot) {
    dot.classList.remove('is-complete', 'just-completed');
    const taskRow = dot.closest('.card-task');
    if (taskRow) taskRow.classList.remove('is-done');
  }

  // Recalculate progress
  const counts = platformStepCount(platformId);
  const pct = counts.total ? Math.round((counts.complete / counts.total) * 100) : 0;
  const barFill = document.getElementById(`bar-fill-${platformId}`);
  if (barFill) barFill.style.width = pct + '%';
  const stepCountEl = document.getElementById(`step-count-${platformId}`);
  if (stepCountEl) stepCountEl.textContent = `${counts.complete} / ${counts.total} steps`;

  // Re-lock submit button if requirements no longer met
  if (!counts.allRequired && !counts.submitDone) {
    const submitBtn = document.getElementById(`submit-btn-${platformId}`);
    if (submitBtn) {
      submitBtn.classList.add('is-locked');
      submitBtn.setAttribute('disabled', '');
      submitBtn.setAttribute('title', 'Complete all steps first');
      submitBtn.removeAttribute('onclick');
    }
  }

  closeTaskModal();
}


/* ── iOS Step Modal ───────────────────────────────────── */

// Seed onboarding answers into iOS submission state (idempotent — only fills nulls)
function seedOnboardingToIOS() {
  if (!state.iosSubmitAnswers.privacyPolicyUrl && state.formData.privacyUrl) {
    state.iosSubmitAnswers.privacyPolicyUrl = state.formData.privacyUrl;
  }
  if (state.iosSubmitAnswers.hasIAP === null && state.questionAnswers.inAppPurchases !== null) {
    state.iosSubmitAnswers.hasIAP = state.questionAnswers.inAppPurchases;
    state.iosAnswerMeta.hasIAP = { humanConfirmed: true };
  }
  if (state.iosSubmitAnswers.collectsData === null && state.questionAnswers.dataCollection !== null) {
    state.iosSubmitAnswers.collectsData = state.questionAnswers.dataCollection;
    state.iosAnswerMeta.collectsData = { humanConfirmed: true };
  }
  if (state.iosSubmitAnswers.selectedCountries.length === 0) {
    const langs = new Set([state.formData.primaryLanguage, ...state.formData.localizations]);
    state.iosSubmitAnswers.selectedCountries = IOS_COUNTRIES
      .filter(c => langs.has(c.lang))
      .map(c => c.code);
    state.iosSubmitAnswers.distPreset = 'custom';
  }
}

async function openStepModal(pid, stepId) {
  if (pid === 'android') {
    seedOnboardingToAndroid();
    state.stepModal = { platformId: pid, stepId, inferenceStatus: null };
    document.getElementById('submit-overlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    const andStep = PLATFORMS[pid].steps.find(s => s.id === stepId);
    if (andStep?.hasInference && CLAUDE_API_KEY) {
      state.stepModal.inferenceStatus = 'loading';
      renderStepModal();
      try {
        // Unified call: delete shared cache key so all platforms re-run together
        delete state.platformInferenceCache['unified:questionnaire'];
        await runInference(pid, stepId);
        state.stepModal.inferenceStatus = 'done';
        _postInferenceSetup(stepId);
      } catch(err) {
        state.stepModal.inferenceStatus = 'error';
        state.stepModal.inferenceError  = err.message === 'NO_KEY' ? 'No API key set.' : err.message;
      }
      reRenderAndroidStepModal();
      updateAndroidCard();
    } else if (stepId === 'improveSubmission') {
      _autoRunImproveSubmission(pid);
    } else {
      renderStepModal();
    }
    return;
  }
  if (pid === 'steam') {
    state.stepModal = { platformId: pid, stepId, inferenceStatus: null };
    document.getElementById('submit-overlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    const stmStep = PLATFORMS[pid].steps.find(s => s.id === stepId);
    if (stmStep?.hasInference && CLAUDE_API_KEY) {
      state.stepModal.inferenceStatus = 'loading';
      renderStepModal();
      try {
        // Unified call: delete shared cache key so all platforms re-run together
        delete state.platformInferenceCache['unified:questionnaire'];
        await runInference(pid, stepId);
        state.stepModal.inferenceStatus = 'done';
        _postInferenceSetup(stepId);
      } catch(err) {
        state.stepModal.inferenceStatus = 'error';
        state.stepModal.inferenceError  = err.message === 'NO_KEY' ? 'No API key set.' : err.message;
      }
      reRenderSteamStepModal();
      updateSteamCard();
    } else if (stepId === 'improveSubmission') {
      _autoRunImproveSubmission(pid);
    } else {
      renderStepModal();
    }
    return;
  }

  seedOnboardingToIOS();

  state.stepModal = { platformId: pid, stepId, inferenceStatus: null };

  // Open overlay immediately so user sees something
  renderStepModal();
  // Mark Store Page Preview as visited before rendering
  if (stepId === 'storePreview') state.iosStorePreviewSeen = true;

  document.getElementById('submit-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // For inference steps: re-run every open to use latest accumulated knowledge
  const step = PLATFORMS[pid].steps.find(s => s.id === stepId);
  if (step?.hasInference) {
    state.stepModal.inferenceStatus = 'loading';
    renderStepModal();
    try {
      // Unified call: delete shared cache key so all platforms re-run together
      delete state.platformInferenceCache['unified:questionnaire'];
      await runInference(pid, stepId);
      state.stepModal.inferenceStatus = 'done';
      _postInferenceSetup(stepId);
    } catch(err) {
      state.stepModal.inferenceStatus = 'error';
      state.stepModal.inferenceError  = err.message === 'NO_KEY' ? 'No API key set.' : err.message;
    }
    reRenderStepModal();
    updateIOSCard();
  } else if (stepId === 'improveSubmission') {
    _autoRunImproveSubmission(pid);
  }
}

function closeStepModal() {
  document.getElementById('submit-overlay').classList.add('hidden');
  document.body.style.overflow = '';
  updateIOSCard();
  updateAndroidCard();
  updateSteamCard();
}

function submitOverlayClick(e) {
  if (e.target === document.getElementById('submit-overlay')) closeStepModal();
}

// Update the iOS active card step completion states without full re-render
function updateIOSCard() {
  if (!state.activePlatforms.has('ios')) return;
  const checkSVG = `<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  PLATFORMS.ios.steps.forEach((step, i) => {
    const card = document.getElementById(`ios-step-card-${step.id}`);
    if (!card) return;
    const done = isIOSSectionComplete(step.id);
    card.classList.toggle('is-complete', done);
    const numEl = card.querySelector('.ios-step-num');
    if (numEl) {
      numEl.classList.toggle('is-done', done);
      numEl.classList.remove('is-risk-warn', 'is-risk-high');
      numEl.innerHTML = done ? checkSVG : String(i + 1);
    }
  });

  // Update submit step card lock state
  const counts = platformStepCount('ios');
  const submitCard = document.getElementById('ios-step-card-submit');
  if (submitCard) submitCard.classList.toggle('submit-step-locked', !counts.allRequired);
}

/* ── Legacy submit modal (non-iOS platforms) ─────────── */

function openSubmitModal(platformId) {
  state.submitModal.platformId = platformId;
  state.submitModal.expanded   = [];
  renderSubmitModal();
  document.getElementById('submit-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeSubmitModal() {
  document.getElementById('submit-overlay').classList.add('hidden');
  document.body.style.overflow = '';
}

function toggleRiskCategory(catId) {
  const idx = state.submitModal.expanded.indexOf(catId);
  if (idx === -1) state.submitModal.expanded.push(catId);
  else            state.submitModal.expanded.splice(idx, 1);
  // Toggle directly in DOM — no full re-render needed
  const el = document.getElementById('risk-cat-' + catId);
  if (el) el.classList.toggle('is-expanded', state.submitModal.expanded.includes(catId));
}

/* ── iOS Submit Modal — section toggle ───────────────── */

function toggleIOSSection(sectionId) {
  const idx = state.submitModal.expanded.indexOf(sectionId);
  if (idx === -1) state.submitModal.expanded.push(sectionId);
  else            state.submitModal.expanded.splice(idx, 1);
  const isOpen = state.submitModal.expanded.includes(sectionId);
  const el = document.getElementById('ios-sec-' + sectionId);
  if (el) el.classList.toggle('is-expanded', isOpen);
  if (sectionId === 'ios-distribution' && isOpen) {
    requestAnimationFrame(() => initDistributionMap());
  }
}

/* ── iOS Submit Modal — answer handlers ──────────────── */

// Re-render the step modal body while preserving scroll position
function reRenderStepModal() {
  const bodyEl   = document.getElementById('step-modal-body');
  const scrollTop = bodyEl ? bodyEl.scrollTop : 0;
  renderStepModal();
  const newBodyEl = document.getElementById('step-modal-body');
  if (newBodyEl) newBodyEl.scrollTop = scrollTop;
}

/* ── Global fixed-position tooltip ───────────────────── */
// Single delegated handler on document — avoids overflow/z-index clipping
// from scrolling containers. Tooltip text lives in data-tip on the anchor.
(function initGlobalTooltip() {
  const TIP_W = 230;
  const MARGIN = 10;

  function showTip(anchor) {
    const tip = document.getElementById('g-tip');
    if (!tip) return;
    // Prefer data-tip attribute; fall back to hidden .tooltip-body text
    let text = anchor.dataset.tip || '';
    if (!text) {
      const body = anchor.querySelector('.tooltip-body');
      if (body) text = body.textContent.trim();
    }
    if (!text) return;
    tip.textContent = text;
    tip.classList.add('is-visible');

    const r = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const th = tip.offsetHeight;

    // Horizontal: center on anchor, clamp to viewport
    let left = r.left + r.width / 2 - TIP_W / 2;
    left = Math.max(MARGIN, Math.min(left, vw - TIP_W - MARGIN));

    // Vertical: prefer above; fall back to below
    let top = r.top - th - 8;
    if (top < MARGIN) top = r.bottom + 8;

    tip.style.left = left + 'px';
    tip.style.top  = top  + 'px';
  }

  function hideTip() {
    const tip = document.getElementById('g-tip');
    if (tip) tip.classList.remove('is-visible');
  }

  document.addEventListener('mouseover', e => {
    const anchor = e.target.closest('.tooltip-anchor');
    if (anchor) showTip(anchor);
  });
  document.addEventListener('mouseout', e => {
    const anchor = e.target.closest('.tooltip-anchor');
    if (anchor && !anchor.contains(e.relatedTarget)) hideTip();
  });
  document.addEventListener('scroll', hideTip, true);
})();

// Called by YES/NO and intensity/chip clicks — re-renders immediately
// Clicking the already-selected value toggles it back to null (deselect)
function answerIOSField(field, value) {
  const current      = state.iosSubmitAnswers[field];
  const meta         = state.iosAnswerMeta[field];
  const humanAlready = meta?.humanConfirmed === true;

  if (current === value && humanAlready) {
    // Human-confirmed answer clicked again → unselect
    state.iosSubmitAnswers[field] = null;
    delete state.iosAnswerMeta[field];
  } else if (current === value && !humanAlready) {
    // AI-inferred answer clicked → promote to human-confirmed, keep value
    state.iosAnswerMeta[field] = { ...(meta || {}), humanConfirmed: true };
  } else {
    // Different value selected → set and mark human
    state.iosSubmitAnswers[field] = value;
    state.iosAnswerMeta[field] = { ...(meta || {}), humanConfirmed: true };
  }
  reRenderStepModal();
}

// Called by text oninput — updates state only, no re-render (prevents cursor jumping)
function updateIOSTextField(field, value) {
  state.iosSubmitAnswers[field] = value;
}

/**
 * Set privacy policy URL across ALL platforms and the global formData at once.
 * Called from any platform's privacy URL input so they stay in sync.
 */
function setPrivacyUrl(url) {
  state.formData.privacyUrl                    = url;
  state.iosSubmitAnswers.privacyPolicyUrl      = url;
  state.androidSubmitAnswers.privacyPolicyUrl  = url;
  state.steamSubmitAnswers.privacyPolicyUrl    = url;
  // Sync sibling platform inputs that are currently in the DOM
  // (but don't change the one that's actively focused — it's the source)
  const active = document.activeElement;
  ['ios-privacy-url', 'android-privacy-url', 'steam-privacy-url'].forEach(id => {
    const el = document.getElementById(id);
    if (el && el !== active && el.value !== url) el.value = url;
  });
  // Update card progress bars and section states — NO full re-render here
  // because that would destroy the focused input. Re-render happens on blur (see inputs).
  updateObSectionStates();
  updateAndroidCard();
  updateIOSCard();
  updateSteamCard?.();
}

/* ── Privacy matrix handlers ─────────────────────────── */

function togglePrivacyMatrix() {
  state.privacyMatrixExpanded = !state.privacyMatrixExpanded;
  reRenderStepModal();
}

function toggleContentRatingExpanded(value) {
  // Re-snapshot on "Unanswered" click so newly-answered questions get hidden
  if (!value) takeFilterSnapshot('ios');
  state.iosContentRatingExpanded = value;
  reRenderStepModal();
}

function toggleAndroidContentRatingExpanded(value) {
  if (!value) takeFilterSnapshot('android');
  state.androidContentRatingExpanded = value;
  reRenderStepModal();
}

function toggleSteamContentRatingExpanded(value) {
  if (!value) takeFilterSnapshot('steam');
  state.steamContentRatingExpanded = value;
  reRenderStepModal();
}

/* ── Privacy preset chips ────────────────────────────── */
function togglePrivacyPreset(id) {
  const preset = PRIVACY_PRESETS.find(p => p.id === id);
  if (!preset) return;

  let curr = [...(state.privacyPresets || [])];

  if (id === 'guest') {
    // Guest is exclusive — toggle off all others
    state.privacyPresets = curr.includes('guest') ? [] : ['guest'];
  } else {
    // Any non-guest preset: deselect guest, toggle this one
    curr = curr.filter(p => p !== 'guest');
    state.privacyPresets = curr.includes(id)
      ? curr.filter(p => p !== id)
      : [...curr, id];
  }

  const selected  = state.privacyPresets;
  const hasGuest  = selected.includes('guest');
  const pid       = state.stepModal?.platformId;

  if (selected.length === 0) {
    // Nothing selected — clear descriptions AND any AI-inferred data types, then re-render
    if (state.iosSubmitAnswers) {
      state.iosSubmitAnswers.privacyDescription = '';
      state.iosSubmitAnswers.dataPerType        = {};
      state.iosSubmitAnswers.collectsData       = null;
    }
    if (state.androidSubmitAnswers) {
      state.androidSubmitAnswers.androidDataDescription = '';
    }
    state.privacyAIStatus = null;
    reRenderStepModal();
    return;
  }

  if (hasGuest) {
    state.iosSubmitAnswers.collectsData            = 'no';
    state.androidSubmitAnswers.collectsOrSharesData = 'no';
    state.iosSubmitAnswers.privacyDescription       = '';
    state.androidSubmitAnswers.androidDataDescription = '';
    reRenderStepModal();
    return;
  }

  // Non-guest presets selected
  state.iosSubmitAnswers.collectsData            = 'yes';
  state.androidSubmitAnswers.collectsOrSharesData = 'yes';
  const combined = selected
    .map(pid2 => PRIVACY_PRESETS.find(p => p.id === pid2)?.description || '')
    .filter(Boolean)
    .join(' ');
  state.iosSubmitAnswers.privacyDescription       = combined;
  state.androidSubmitAnswers.androidDataDescription = combined;

  // Trigger AI translation for the active platform only
  if (combined.length >= 20) {
    if (pid === 'ios')     _triggerPrivacyAI();
    if (pid === 'android') _triggerAndroidDataAI();
  }
  reRenderStepModal();
}

/* ── Privacy NLP → privacy label AI translation ───────── */

// Fires on blur (focus-out) — not on every keystroke
function updatePrivacyDescription(val) {
  state.iosSubmitAnswers.privacyDescription = val;
  _setInputComplete('ob-prv-nlp-textarea', !!(val?.trim()));
  if (!val || val.trim().length < 20) return;
  _triggerPrivacyAI();
}

async function _triggerPrivacyAI() {
  if (!CLAUDE_API_KEY) return;
  const desc = (state.iosSubmitAnswers.privacyDescription || '').trim();
  if (desc.length < 20) return;

  // If this exact description succeeded before, restore cached result instantly
  if (desc === state.privacyLastSuccessDesc && state.privacyLastSuccessResult) {
    state.iosSubmitAnswers.dataPerType = state.privacyLastSuccessResult;
    state.privacyAIStatus = 'complete';
    reRenderStepModal();
    return;
  }

  state.privacyAIStatus = 'loading';
  reRenderStepModal();

  const typeList    = IOS_DATA_TYPES.flatMap(g => g.types)
    .map(t => `${t.id}: ${t.label} — ${t.desc}`).join('\n');
  const purposeList = IOS_PURPOSES
    .map(p => `${p.id}: ${p.label} — ${p.desc}`).join('\n');

  const prompt = `You are helping a mobile game developer fill in Apple App Store Data Privacy labels.

Developer's description of their data collection:
"${desc}"

Available data type IDs:
${typeList}

Available purpose IDs:
${purposeList}

Return ONLY valid JSON — no markdown fences, no extra text:
{
  "selections": [
    { "typeId": "<exact data type id>", "purposes": ["<purpose id>", ...], "tracking": "yes|no" }
  ]
}

Rules:
- Only include types clearly mentioned or strongly implied by the description.
- Only include purposes that genuinely apply to each type.
- Set tracking "yes" only if data crosses into third-party apps/websites for advertising.
- Be conservative — omit rather than guess.`;

  try {
    const res = await fetch(CLAUDE_ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key':                                 CLAUDE_API_KEY,
        'anthropic-version':                         '2023-06-01',
        'content-type':                              'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model:      CLAUDE_MODEL,
        max_tokens: 800,
        messages:   [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      }),
    });

    if (!res.ok) throw new Error('API ' + res.status);
    const data    = await res.json();
    const text    = (data.content?.[0]?.text || '').trim();
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed  = JSON.parse(cleaned);

    const validTypeIds    = new Set(IOS_DATA_TYPES.flatMap(g => g.types).map(t => t.id));
    const validPurposeIds = new Set(IOS_PURPOSES.map(p => p.id));
    const newPerType      = {};

    for (const sel of (parsed.selections || [])) {
      if (!validTypeIds.has(sel.typeId)) continue;
      const purposes = (sel.purposes || []).filter(p => validPurposeIds.has(p));
      newPerType[sel.typeId] = {
        purposes,
        identity: 'no',
        tracking: sel.tracking === 'yes' ? 'yes' : 'no',
      };
    }

    state.iosSubmitAnswers.dataPerType = newPerType;
    state.privacyAIStatus = 'complete';
    state.privacyLastSuccessDesc   = desc;
    state.privacyLastSuccessResult = newPerType;
  } catch (e) {
    console.warn('[Privacy AI]', e.message);
    state.privacyAIStatus = 'error';
  }

  reRenderStepModal();
}

function togglePrivacyDataType(typeId) {
  // Clicking a row (but not a checkbox inside it) toggles selection
  const perType = state.iosSubmitAnswers.dataPerType;
  if (perType[typeId]) {
    delete perType[typeId];
  } else {
    // identity/tracking default to 'no' (unchecked = no, not unknown)
    perType[typeId] = { purposes: [], identity: 'no', tracking: 'no' };
  }
  reRenderStepModal();
}

function setPrivacyMeta(typeId, field, checked) {
  const perType = state.iosSubmitAnswers.dataPerType;
  if (!perType[typeId]) return;
  perType[typeId][field] = checked ? 'yes' : 'no';
  reRenderStepModal();
}

function togglePrivacyPurpose(typeId, purposeId, checked) {
  const perType = state.iosSubmitAnswers.dataPerType;
  if (!perType[typeId]) return;
  const arr = perType[typeId].purposes;
  if (checked && !arr.includes(purposeId)) arr.push(purposeId);
  if (!checked) perType[typeId].purposes = arr.filter(p => p !== purposeId);
  // Checkboxes manage themselves — no full re-render needed
}

function setPrivacyMeta(typeId, field, checked) {
  const perType = state.iosSubmitAnswers.dataPerType;
  if (!perType[typeId]) return;
  perType[typeId][field] = checked ? 'yes' : 'no';
  // Tracking warning updates lazily on next section re-open
}

/* ── Legacy stub (IAP type toggle) ───────────────────── */

function toggleIOSIAPType(typeId) {
  const types = state.iosSubmitAnswers.iapTypes;
  const idx = types.indexOf(typeId);
  if (idx === -1) types.push(typeId); else types.splice(idx, 1);
  reRenderStepModal();
}

/* ── Distribution map ────────────────────────────────── */

async function initDistributionMap() {
  const container = document.getElementById('distribution-map-container');
  if (!container) return;

  if (!_worldTopology) {
    container.innerHTML = '<div class="world-map-loading">Loading map…</div>';
    try {
      const res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
      _worldTopology = await res.json();
    } catch (e) {
      container.innerHTML = '<div class="world-map-loading">Map unavailable offline</div>';
      return;
    }
  }
  renderDistributionMap();
}

function renderDistributionMap() {
  const container = document.getElementById('distribution-map-container');
  if (!container || !_worldTopology) return;

  const W = container.offsetWidth || 480;

  const selected = new Set(
    (state.iosSubmitAnswers.selectedCountries || [])
      .map(code => (IOS_COUNTRIES.find(c => c.code === code) || {}).num)
      .filter(Boolean)
  );

  _drawMap(container, W, selected, new Set());
}

function toggleDistExpand() {
  const list = document.getElementById('dist-country-list');
  const btn  = document.getElementById('dist-expand-btn');
  if (!list || !btn) return;

  const isExpanded = list.classList.toggle('is-expanded');
  const extraCount = IOS_COUNTRIES.length - 10;

  if (isExpanded) {
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
      Show fewer markets`;
  } else {
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      Show ${extraCount} more markets`;
    // Scroll the button back into view when collapsing
    btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function toggleIOSCountry(code) {
  // Manual edit → switch to Custom preset
  state.iosSubmitAnswers.distPreset = 'custom';

  const arr = state.iosSubmitAnswers.selectedCountries;
  const idx = arr.indexOf(code);
  if (idx === -1) arr.push(code); else arr.splice(idx, 1);

  // Update chip visual directly (avoid full re-render)
  const chip = document.getElementById('dist-chip-' + code);
  if (chip) chip.classList.toggle('is-on', idx === -1);

  // Update bar color directly
  const row = chip && chip.closest('.dist-country-row');
  const fill = row && row.querySelector('.dist-bar-fill');
  if (fill) fill.style.background = (idx === -1) ? 'rgba(74,222,128,0.5)' : 'var(--border-hover)';

  // Update preset button highlights without full re-render
  document.querySelectorAll('.dist-preset-btn').forEach(btn => {
    btn.classList.toggle('is-active', btn.textContent.trim() === 'Custom');
  });

  renderDistributionMap();
}

/* ── Claude AI handlers ───────────────────────────────── */

// Called by the Retry button on analysis error — delegates to unified retry
async function _runClaudeAnalysis() {
  await _retryInference('ios', state.stepModal?.stepId || 'questionnaire');
  updateIOSCard();
}

function clearClaudeResults() {
  state.iosSubmitAnswers        = makeBlankIOSAnswers();
  state.iosAnswerMeta           = {};
  state.claudeCache             = null;
  state.iosStorePreviewSeen     = false;
  state.stepModal.inferenceStatus = null;
  state.stepModal.inferenceError  = null;
  reRenderStepModal();
  updateIOSCard();
}


// English-speaking iOS markets
const DIST_PRESET_ENGLISH = IOS_COUNTRIES.filter(c => c.lang === 'en').map(c => c.code);

function setDistPreset(preset) {
  const ans = state.iosSubmitAnswers;
  ans.distPreset = preset;

  if (preset === 'everywhere') {
    ans.selectedCountries = IOS_COUNTRIES.map(c => c.code);
  } else if (preset === 'everywhere_except_cn') {
    ans.selectedCountries = IOS_COUNTRIES.filter(c => c.code !== 'CN').map(c => c.code);
  } else if (preset === 'english_only') {
    ans.selectedCountries = [...DIST_PRESET_ENGLISH];
  }
  // 'custom' → keep current selection as-is

  reRenderStepModal();
  requestAnimationFrame(() => initDistributionMap());
}

function confirmAndSubmit(platformId) {
  state.platformStepStatus[platformId]['reviewSubmission'] = 'complete';
  closeSubmitModal();
  renderDashboard();
}

// Opens the track-selection submit modal for platforms that have defined tracks
// (ios / android / steam). For platforms without tracks, submits directly.
/* Persist selected track from the inline card dropdown (no modal needed) */
function selectTrack(pid, trackId) {
  if (!state.selectedTracks) state.selectedTracks = {};
  state.selectedTracks[pid] = trackId;
  // No re-render needed — the select element already reflects the new value
}

/* Confirm and execute the submit from the inline step card */
function confirmSubmit(pid) {
  if (!state.selectedTracks) state.selectedTracks = {};
  const trackId = state.selectedTracks[pid] || null;
  if (!trackId) {
    // Pulse the dropdown to signal the user must choose a track first
    const sel = document.getElementById('track-sel-' + pid);
    if (sel) { sel.classList.add('pulse-error'); setTimeout(() => sel.classList.remove('pulse-error'), 600); }
    return;
  }
  _doFinalSubmit(pid, trackId);
}

function openTrackSubmitModal(platformId) {
  const tracks = PLATFORM_TRACKS[platformId];
  if (!tracks || !tracks.length) {
    // No tracks defined — submit straight to production
    _doFinalSubmit(platformId, 'production');
    return;
  }
  renderTrackSubmitModal(platformId);
  document.getElementById('submit-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

// Called by the "Submit →" button inside the track-selection modal.
function _confirmTrackSubmit(platformId) {
  const radios = document.querySelectorAll(`input[name="track-sel-${platformId}"]`);
  let trackId = 'production';
  radios.forEach(r => { if (r.checked) trackId = r.value; });
  closeSubmitModal();
  _doFinalSubmit(platformId, trackId);
}

// Mints a ReleaseRecord and marks the submit step complete.
// Build numbers / version strings are always derived automatically — never typed.
function _doFinalSubmit(platformId, trackId) {
  const proj = state.projects.find(p => p.id === state.activeProjectId);
  const ver  = proj?.versions.find(v => v.id === state.activeVersionId);
  if (proj && ver) {
    if (!ver.platformReleases) ver.platformReleases = {};
    if (!ver.platformReleases[platformId]) ver.platformReleases[platformId] = [];
    const rel = makeReleaseRecord(proj, platformId, trackId, ver.versionNumber);
    ver.platformReleases[platformId].push(rel);
  }
  state.platformStepStatus[platformId]['submit'] = 'complete';
  renderDashboard();
}

// Legacy alias kept for any paths that still call finalSubmit directly.
function finalSubmit(platformId) {
  openTrackSubmitModal(platformId);
}


/* ── Platform activate / deactivate ──────────────────── */

function blinkComingSoon(pid) {
  const badge = document.getElementById(`cs-badge-${pid}`);
  if (!badge || badge.classList.contains('is-blinking')) return;
  badge.classList.add('is-blinking');
  setTimeout(() => badge.classList.remove('is-blinking'), 700);
}

function activatePlatform(platformId) {
  state.activePlatforms.add(platformId);
  renderDashboard();
}

function deactivatePlatform(platformId) {
  state.activePlatforms.delete(platformId);
  renderDashboard();
}


/* ── Form helpers ────────────────────────────────────── */

// Auto-round prices to .99 convention (e.g. 5 → 4.99, 10 → 9.99)
function roundPrice(inputEl) {
  let val = parseFloat(inputEl.value);
  if (isNaN(val) || val <= 0) return; // free / blank — leave as-is
  // If the cents portion is already .99 don't touch it
  if (Math.abs(val - Math.floor(val) - 0.99) < 0.001) return;
  // Round to nearest whole dollar then subtract 0.01
  const rounded = Math.round(val);
  const result = rounded > 0 ? (rounded - 0.01).toFixed(2) : val.toFixed(2);
  inputEl.value = result;
  state.formData['price'] = result;
}

/* ── Onboarding section rail predicates ──────────────── */

// Returns true when all required fields for a given section are filled.
// Called by updateObSectionStates() to drive the amber rail + header tint.
const OB_SECTION_ANSWERED = {
  about:        () => !!(state.formData.title?.trim()) &&
                      !!(state.formData.description?.trim()),
  platforms:    () => state.activePlatforms.size > 0,
  distribution: () => !!state.formData.distributionPreset,
  localization: () => !!state.formData.primaryLanguage,  // defaults to 'en' — always answered
  screenshots:  () => state.uploads.screenshots.length > 0,
  compliance:   () => QUESTIONS.every(q => state.questionAnswers[q.id] !== null),
  // Optional sections — never shown as unanswered
  trailer:      () => true,
};

// Per-question answered predicates (drives ob-q data-answered for individual field rails)
const OB_Q_ANSWERED = {
  title:        () => !!(state.formData.title?.trim()),
  desc:         () => !!(state.formData.description?.trim()),
  platforms:    () => state.activePlatforms.size > 0,
  distribution: () => !!state.formData.distributionPreset,
  screenshots:  () => state.uploads.screenshots.length > 0,
  compliance:   () => QUESTIONS.every(q => state.questionAnswers[q.id] !== null),
};

// Toggle is-complete on a specific input element (used for text inputs/textareas)
function _setInputComplete(id, isComplete) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('is-complete', isComplete);
}

function updateObSectionStates() {
  // Per-question rails — each individual field gets its own amber indicator
  for (const [id, pred] of Object.entries(OB_Q_ANSWERED)) {
    const el = document.getElementById('ob-q-' + id);
    if (el) el.setAttribute('data-answered', pred() ? '1' : '0');
  }
  // Section-level state kept for header tinting only (no visual rail)
  for (const [id, pred] of Object.entries(OB_SECTION_ANSWERED)) {
    const el = document.getElementById('ob-sec-' + id);
    if (el) el.classList.toggle('is-unanswered', !pred());
  }
  // If in validation mode and all required fields for this tab are now filled, clear validation
  const required = OB_TAB_REQUIRED[state.onboardingTab] || [];
  if (required.every(id => OB_Q_ANSWERED[id]?.())) {
    _setObValidating(false);
  }
  // Sync is-complete on text inputs — correct after any tab render
  _setInputComplete('ob-title',            !!(state.formData.title?.trim()));
  _setInputComplete('ob-desc',             !!(state.formData.description?.trim()));
  _setInputComplete('ob-prv-nlp-textarea', !!(state.iosSubmitAnswers?.privacyDescription?.trim()));
}

function syncField(field, value) {
  state.formData[field] = value;
  // Keep platform privacy URLs in sync when the global field is updated
  if (field === 'privacyUrl') {
    state.iosSubmitAnswers.privacyPolicyUrl     = value;
    state.androidSubmitAnswers.privacyPolicyUrl = value;
  }
  if (field === 'title') {
    // Keep selector title in sync while the user types
    const selEl = document.getElementById('projectSelectorTitle');
    if (selEl) selEl.textContent = value || 'My Game';
    const curEl = document.getElementById('projectItemCurrent');
    if (curEl) curEl.textContent = value || 'My Game';
  }
  // Live is-complete on the typed input — immediate feedback as user types/clears
  const FIELD_INPUT_MAP = { title: 'ob-title', description: 'ob-desc' };
  if (FIELD_INPUT_MAP[field]) _setInputComplete(FIELD_INPUT_MAP[field], !!(value?.trim()));
  // Update section rails reactively
  updateObSectionStates();
}

function charCount(countId, value, max) {
  const el = document.getElementById(countId);
  if (!el) return;
  const len = (value || '').length;
  const note = el.querySelector('.char-note');
  el.textContent = `${len} / ${max} `;
  if (note) el.appendChild(note);
  el.className = 'char-count';
  if (len > max * 0.9) el.classList.add('is-warn');
  if (len > max)       el.classList.add('is-over');
}


function toggleLang(el, code) {
  const idx = state.formData.localizations.indexOf(code);
  if (idx === -1) { state.formData.localizations.push(code); el.classList.add('is-on'); }
  else            { state.formData.localizations.splice(idx, 1); el.classList.remove('is-on'); }
  updateWorldMap();
}

/* ── Onboarding Distribution Map & Localization ──────── */

const OB_REGULATORY_EXCLUSIONS = ['CN', 'KR', 'JP', 'DE', 'BE', 'VN', 'ZA'];

function _obCountriesForPreset(preset) {
  switch (preset) {
    case 'everywhere':
    case 'global':              return IOS_COUNTRIES.map(c => c.code);
    case 'english_only':        return IOS_COUNTRIES.filter(c => c.lang === 'en').map(c => c.code);
    case 'minimize_regulation': return IOS_COUNTRIES.filter(c => !OB_REG_TIPS[c.code]).map(c => c.code);
    default:                    return state.formData.selectedCountries || IOS_COUNTRIES.map(c => c.code);
  }
}

function setObDistPreset(preset) {
  if (state.formData.distributionPreset === preset) {
    // Toggle off — deselect the preset
    state.formData.distributionPreset = null;
  } else {
    state.formData.distributionPreset = preset;
    if (preset !== 'custom') {
      // Apply the preset's country list
      state.formData.selectedCountries = _obCountriesForPreset(preset);
    }
    // 'custom' keeps whatever countries are currently selected
  }
  _refreshObDistSection();
}

function _selectionMatchesPreset(preset) {
  const expected = new Set(_obCountriesForPreset(preset));
  const actual   = new Set(state.formData.selectedCountries || []);
  if (expected.size !== actual.size) return false;
  for (const c of expected) { if (!actual.has(c)) return false; }
  return true;
}

function toggleObCountry(code) {
  const arr = state.formData.selectedCountries;
  const idx = arr.indexOf(code);
  if (idx === -1) arr.push(code); else arr.splice(idx, 1);

  // Snap preset label to whichever named preset matches the new selection, else 'custom'
  const namedPresets = ['everywhere', 'english_only', 'minimize_regulation'];
  const matched = namedPresets.find(p => _selectionMatchesPreset(p));
  state.formData.distributionPreset = matched || 'custom';

  // Update map + lang list; update chips in-place to preserve expand state
  renderObDistMap();
  updateObLangListWrap();
  _refreshCountryListInPlace();
  // Refresh preset pills
  document.querySelectorAll('.ob-preset-pill[data-preset]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.preset === state.formData.distributionPreset);
  });
}

function _refreshCountryListInPlace() {
  // Update row states in-place without collapsing the extra list
  const selected = new Set(state.formData.selectedCountries || []);
  document.querySelectorAll('.ob-dist-row[data-code]').forEach(row => {
    const code = row.dataset.code;
    const isOn = selected.has(code);
    row.classList.toggle('is-on', isOn);
    const chip = row.querySelector('.ob-dist-row-chip');
    if (chip) chip.classList.toggle('is-on', isOn);
    const tipIcon = row.querySelector('.tooltip-icon');
    if (tipIcon) tipIcon.classList.toggle('is-warned', isOn);
  });
}

function _refreshObDistSection() {
  renderObDistMap();
  updateObCountryList();
  updateObLangListWrap();
  // Refresh dist preset pill active states
  document.querySelectorAll('.ob-preset-pill[data-preset]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.preset === state.formData.distributionPreset);
  });
  // Update required-empty indicator on preset group
  const presetGroup = document.getElementById('ob-dist-preset-group');
  if (presetGroup) {
    presetGroup.classList.toggle('is-req-empty', !state.formData.distributionPreset);
  }
  updateObSectionStates();
}

function _refreshCountrySummary() {
  const el = document.querySelector('.ob-country-count');
  if (!el) return;
  const count = (state.formData.selectedCountries || []).length;
  el.textContent = `${count} ${count === 1 ? 'country' : 'countries'} selected`;
}

function updateObCountryList() {
  const el = document.getElementById('ob-country-list-wrap');
  if (el) el.innerHTML = buildObCountryChips();
}

function toggleObCountryList() {
  const table   = document.getElementById('ob-country-table');
  const chevron = document.getElementById('ob-country-chevron');
  if (!table) return;
  const nowExpanded = table.classList.toggle('is-expanded');
  if (chevron) chevron.innerHTML = nowExpanded ? _chevUp : _chevDown;
}

/* ── Localization handlers ───────────────────────────── */

function _computeLangPresetSelections(preset) {
  const fd      = state.formData;
  const primary = fd.primaryLanguage || 'en';
  const countries = fd.selectedCountries || [];

  // Aggregate gamers per non-primary language
  const langTotals = {};
  IOS_COUNTRIES.forEach(c => {
    if (!countries.includes(c.code) || c.lang === primary) return;
    langTotals[c.lang] = (langTotals[c.lang] || 0) + (c.iosGamers || 0);
  });
  const ranked = Object.entries(langTotals).sort(([,a],[,b]) => b - a).map(([l]) => l);

  if (preset === 'recommended')  return ranked.slice(0, 2);
  if (preset === 'primary_only') return [];
  if (preset === 'all_regions')  return ranked;
  return fd.localizations || [];
}

/* ── Localization picker handlers ────────────────────── */

function toggleLocPrimaryDropdown(event) {
  event.stopPropagation();
  const wrap = document.getElementById('loc-primary-wrap');
  if (!wrap) return;
  const isOpen = wrap.classList.contains('is-open');
  closeAllDropdowns();
  if (!isOpen) wrap.classList.add('is-open');
}

function selectLocPrimary(lang) {
  const oldPrimary = state.formData.primaryLanguage || 'en';
  // Demote old primary into supported (if it's in the featured set and not already there)
  if (lang !== oldPrimary) {
    const locs = new Set(state.formData.localizations || []);
    if (OB_LANG_FEATURED.includes(oldPrimary)) locs.add(oldPrimary);
    locs.delete(lang); // new primary leaves supported
    state.formData.localizations  = [...locs];
    state.formData.primaryLanguage = lang;
  }
  closeAllDropdowns();
  updateObLangListWrap();
}

// Legacy alias — kept for any older callers
function setObPrimaryLang(lang) { selectLocPrimary(lang); }

function setObLangPreset(preset) {
  state.formData.localizationPreset = preset;
  state.formData.localizations      = _computeLangPresetSelections(preset);
  updateObLangListWrap();
  // Update pill states
  document.querySelectorAll('.ob-preset-pill').forEach(btn => {
    const presetMap = {
      'Recommended':'recommended',
      'Primary Language only':'primary_only',
      'Localize for all selected regions':'all_regions',
    };
    const pid = presetMap[btn.textContent.trim()];
    if (pid) btn.classList.toggle('is-active', pid === preset);
  });
}

function applyObLangPreset() {
  // Re-apply current lang preset when primary language changes
  const preset = state.formData.localizationPreset || 'recommended';
  state.formData.localizations = _computeLangPresetSelections(preset);
  updateObLangListWrap();
}

function toggleObLang(lang) {
  const primary = state.formData.primaryLanguage || 'en';
  if (lang === primary) return;
  const arr = state.formData.localizations || [];
  const idx = arr.indexOf(lang);
  if (idx === -1) arr.push(lang); else arr.splice(idx, 1);
  state.formData.localizations = arr;
  // Full re-render so the Subwoofer tip ! badge moves to the next best candidate
  updateObLangListWrap();
}

function _refreshLangListInPlace() {
  const selected = new Set(state.formData.localizations || []);
  // Update chip states in-place
  document.querySelectorAll('#loc-chips .loc-chip:not(.loc-chip-add)').forEach(chip => {
    const onclick = chip.getAttribute('onclick') || '';
    const m = onclick.match(/toggleObLang\('([^']+)'\)/);
    if (!m) return;
    const lang = m[1];
    const isOn = selected.has(lang);
    chip.classList.toggle('is-on', isOn);
  });
}

function updateObLangListWrap() {
  const el = document.getElementById('ob-lang-list-wrap');
  if (el) el.innerHTML = buildObLangList();
}

function updateObLangRecs() { updateObLangListWrap(); } // alias for old callers

function toggleObLangList(btn) {
  const list = document.getElementById('ob-lang-list');
  if (!list) return;
  const expanded = list.classList.toggle('is-expanded');
  btn.innerHTML = expanded
    ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg> Show fewer languages`
    : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg> Show more languages`;
}

async function initObDistMap() {
  // Populate selectedCountries from preset only if a preset is already chosen
  const preset = state.formData.distributionPreset;
  if (!state.formData.selectedCountries?.length && preset && preset !== 'custom') {
    state.formData.selectedCountries = _obCountriesForPreset(preset);
    updateObLangRecs();
  }

  const container = document.getElementById('ob-dist-map-container');
  if (!container) return;

  if (!_worldTopology) {
    container.innerHTML = '<div class="world-map-loading">Loading map…</div>';
    try {
      const res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
      _worldTopology = await res.json();
    } catch (e) {
      container.innerHTML = '<div class="world-map-loading">Map unavailable offline</div>';
      return;
    }
  }
  renderObDistMap();
}

function renderObDistMap() {
  const container = document.getElementById('ob-dist-map-container');
  if (!container || !_worldTopology) return;

  const W = container.offsetWidth || 480;
  const selected = new Set(
    (state.formData.selectedCountries || [])
      .map(code => (IOS_COUNTRIES.find(c => c.code === code) || {}).num)
      .filter(Boolean)
  );
  _drawMap(container, W, selected, new Set());
}

function updateObLangRecs() {
  const el = document.getElementById('ob-lang-recs');
  if (el) el.innerHTML = buildObLangRecs();
}

/* ── World Map ───────────────────────────────────────── */

let _worldTopology = null;  // cached fetch

async function initWorldMap() {
  const container = document.getElementById('world-map-container');
  if (!container) return;

  if (!_worldTopology) {
    container.innerHTML = '<div class="world-map-loading">Loading map…</div>';
    try {
      const res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
      _worldTopology = await res.json();
    } catch (e) {
      container.innerHTML = '<div class="world-map-loading">Map unavailable offline</div>';
      return;
    }
  }
  renderWorldMap();
}

function updateWorldMap() {
  if (_worldTopology) renderWorldMap();
}

function renderWorldMap() {
  const container = document.getElementById('world-map-container');
  if (!container || !_worldTopology || typeof d3 === 'undefined' || typeof topojson === 'undefined') return;

  const W = container.offsetWidth || 480;

  // Build set of active numeric ISO codes
  const activeCodes = new Set();
  const primary = state.formData.primaryLanguage || 'en';
  const extras  = state.formData.localizations   || [];
  [primary, ...extras].forEach(lang => {
    (LANG_COUNTRY_CODES[lang] || []).forEach(c => activeCodes.add(c));
  });

  // Build primary-language-only set for a slightly different shade
  const primaryCodes = new Set((LANG_COUNTRY_CODES[primary] || []).map(Number));

  _drawMap(container, W, activeCodes, primaryCodes);
}

/* ── Shared map renderer ─────────────────────────────── */
// activeCodes  : Set of numeric ISO codes to highlight (active blue)
// primaryCodes : Set of numeric ISO codes for primary shade (brighter blue)
function _drawMap(container, W, activeCodes, primaryCodes) {
  if (!_worldTopology || typeof d3 === 'undefined' || typeof topojson === 'undefined') return;

  // Natural Earth projection fits ~2:1 width-to-height; use 0.50 for full uncropped world
  const H = Math.round(W * 0.50);

  // Colors (dark-theme palette)
  const C_OCEAN    = '#0d1117';
  const C_INACTIVE = '#1e2230';
  const C_ACTIVE   = '#2563d4';
  const C_BORDER   = '#0d1117';
  const C_PRIMARY  = '#3b82f6';

  const projection = d3.geoNaturalEarth1()
    .scale(W / 5.5)
    .translate([W / 2, H / 2]);

  const path      = d3.geoPath().projection(projection);
  const countries = topojson.feature(_worldTopology, _worldTopology.objects.countries);
  const borders   = topojson.mesh(_worldTopology, _worldTopology.objects.countries, (a, b) => a !== b);

  const svg = d3.create('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('width',  W)
    .attr('height', H)
    .style('display', 'block');

  // Ocean background
  svg.append('path')
    .datum({ type: 'Sphere' })
    .attr('d', path)
    .attr('fill', C_OCEAN);

  // Country fills
  svg.append('g')
    .selectAll('path')
    .data(countries.features)
    .join('path')
      .attr('d', path)
      .attr('fill', d => {
        const code = +d.id;
        if (!activeCodes.has(code))  return C_INACTIVE;
        if (primaryCodes.has(code))  return C_PRIMARY;
        return C_ACTIVE;
      })
      .attr('stroke', 'none');

  // Country borders (thin, dark)
  svg.append('path')
    .datum(borders)
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', C_BORDER)
    .attr('stroke-width', 0.4);

  container.innerHTML = '';
  container.appendChild(svg.node());
}

function pickTiming(value) {
  state.formData.releaseTiming = value;
  // Pre-fill launch date to 14 days from today when first selecting specific_date
  if (value === 'specific_date' && !state.formData.releaseDate) {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    state.formData.releaseDate = d.toISOString().split('T')[0]; // YYYY-MM-DD
  }
  // Update chip active state
  document.querySelectorAll('.ob-timing-chip').forEach(chip => {
    chip.classList.toggle('is-on', chip.dataset.timing === value);
  });
  // Re-render the content area
  _refreshTimingContent();
}

function _refreshTimingContent() {
  const content = document.getElementById('ob-timing-content');
  if (!content) return;
  content.innerHTML = buildReleaseTimingContent();
  // Restore date value in newly created input (state already has it)
  const dateInput = document.getElementById('ob-date');
  if (dateInput && state.formData.releaseDate) dateInput.value = state.formData.releaseDate;
}

/* ── Scenario widget — game search ───────────────────────── */

function _renderScenarioSection() {
  const wrap = document.getElementById('ob-scenario-wrap');
  if (!wrap) return;
  wrap.innerHTML = buildScenarioWidget();
}

function _triggerScenarioSearch() {
  const title = (state.formData.title || '').trim();
  if (!title) {
    state.liveSearch = { status: 'error', found: false, error: 'NO_TITLE' };
    _renderScenarioSection();
    const wrap = document.getElementById('ob-scenario-wrap');
    const msg  = wrap ? wrap.querySelector('.ob-live-not-found') : null;
    if (msg) msg.textContent = "Enter your game title above first — then we'll search for it.";
    return;
  }
  state.liveSearch = { status: 'loading', found: false };
  _renderScenarioSection();
  searchGameByTitle(title)
    .then(result => {
      state.liveSearch = {
        status:      'done',
        found:       !!result.found,
        title:       result.title       || null,
        description: result.description || null,
        source:      result.source      || null,
        allStores:   result.allStores   || [],
        confidence:  result.confidence  || 0,
        confirmed:   false,
      };
      _renderScenarioSection();
    })
    .catch(err => {
      console.warn('[Scenario Search] failed:', err.message);
      state.liveSearch = { status: 'error', found: false, error: err.message };
      _renderScenarioSection();
    });
}

function setGameScenario(scenario) {
  // Toggle off if same chip clicked again
  if (state.formData.gameScenario === scenario) {
    state.formData.gameScenario = null;
    state.liveSearch = null;
    _renderScenarioSection();
    return;
  }

  state.formData.gameScenario = scenario;
  state.liveSearch = null;
  _renderScenarioSection();
  updateObSectionStates();

  // Scenarios that need a store search
  if (scenario === 'new_platform' || scenario === 'update') {
    _triggerScenarioSearch();
  }
}

function confirmGameImport() {
  const ls = state.liveSearch;
  if (!ls || !ls.found || !ls.description) return;

  // Pre-populate the description field
  state.formData.description = ls.description;
  const descEl = document.getElementById('ob-desc');
  if (descEl) {
    descEl.value = ls.description;
    charCount('ob-desc-count', ls.description, 4000);
  }

  // Auto-activate platforms where the game was found — replace any prior auto-selection
  // STORE_NAME_TO_PID is defined in claude.js (loaded first)
  const foundPids = [...new Set(
    (ls.allStores || []).map(s => STORE_NAME_TO_PID[(s || '').toLowerCase().trim()] || s)
      .filter(pid => !!PLATFORMS[pid] && !COMING_SOON_PLATFORMS.has(pid))
  )];
  if (foundPids.length) {
    state.activePlatforms.clear();
    foundPids.forEach(pid => {
      state.activePlatforms.add(pid);
      if (!state.platformStepStatus[pid]) {
        state.platformStepStatus[pid] = makeEmptyPlatformSteps()[pid] || {};
      }
    });
    const gridWrap = document.getElementById('ob-plat-grid-wrap');
    if (gridWrap) {
      gridWrap.innerHTML = buildObPlatTilesHTML();
      gridWrap.classList.remove('is-req-empty');
    }
    renderOnboardingFooter();
    updateObSectionStates();
  }

  ls.confirmed = true;
  _renderScenarioSection();
}

function rejectGameImport() {
  state.liveSearch = { status: 'done', found: false };
  _renderScenarioSection();
  const wrap = document.getElementById('ob-scenario-wrap');
  const msg  = wrap ? wrap.querySelector('.ob-live-not-found') : null;
  if (msg) msg.textContent = "Got it — fill in the description below and we'll work from that.";
}

/* ── Dashboard timeline handlers ─────────────────────────── */

function _refreshDashTimeline() {
  const wrap = document.getElementById('dash-timeline-wrap');
  if (!wrap) return;
  wrap.innerHTML = buildDashboardTimeline();
}

function dashPickTiming(value) {
  state.formData.releaseTiming = value;
  if (value === 'specific_date' && !state.formData.releaseDate) {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    state.formData.releaseDate = d.toISOString().split('T')[0];
  }
  _refreshDashTimeline();
}

function dashSetDate(value) {
  state.formData.releaseDate = value;
  _refreshDashTimeline();
}

/* ── IGDB title picklist ─────────────────────────────────── */

let _titleSearchTimer  = null;
let _closePicklistTimer = null;

function _renderTitlePicklist() {
  const el = document.getElementById('ob-title-picklist');
  if (el) el.innerHTML = buildTitlePicklist();
}

// Called from picklist row onmousedown — prevents blur from closing
// the list before the click registers
function _cancelPicklistClose() {
  clearTimeout(_closePicklistTimer);
}

// Called from title input onblur — close picklist shortly after
function _onTitleBlur() {
  _closePicklistTimer = setTimeout(() => {
    state.titlePicklist = [];
    _renderTitlePicklist();
  }, 200);
}

// Debounce-search on every title keystroke
function _onTitleFocus(value) {
  // If there's already text when the field is focused, show the picklist immediately
  const trimmed = (value || '').trim();
  if (trimmed.length >= 3 && !state.titlePicklist?.length) {
    _runTitlePicklist(trimmed);
  } else if (state.titlePicklist?.length) {
    _renderTitlePicklist(); // re-show if results are cached
  }
}

function _onTitleInputScenario(value) {
  // If user edits after confirming, clear confirmation so search can re-run
  if (state.liveSearch && state.liveSearch.confirmed) {
    state.liveSearch = null;
    _renderScenarioSection();
  }
  clearTimeout(_titleSearchTimer);
  const trimmed = (value || '').trim();
  if (trimmed.length < 3) {
    state.titlePicklist = [];
    _renderTitlePicklist();
    return;
  }
  _titleSearchTimer = setTimeout(() => _runTitlePicklist(trimmed), 150);
}

async function _runTitlePicklist(title) {
  if (!IGDB_CLIENT_ID) return;   // no key configured — silent no-op
  try {
    const results = await igdbSearch(title);
    // Only apply if the title hasn't changed since the search started
    if ((state.formData.title || '').trim() === title) {
      state.titlePicklist = results;
      _renderTitlePicklist();
    }
  } catch (err) {
    console.warn('[Picklist] IGDB search failed:', err.message);
    state.titlePicklist = [];
    _renderTitlePicklist();
  }
}

function selectPicklistItem(igdbId) {
  const item = (state.titlePicklist || []).find(x => x.id === igdbId);
  if (!item) return;

  // Close picklist immediately
  clearTimeout(_closePicklistTimer);
  state.titlePicklist = [];
  _renderTitlePicklist();

  // Set game title
  state.formData.title = item.name;
  const titleEl = document.getElementById('ob-title');
  if (titleEl) {
    titleEl.value = item.name;
    charCount('ob-title-count', item.name, 30);
  }

  // Pre-fill description
  if (item.summary) {
    state.formData.description = item.summary;
    const descEl = document.getElementById('ob-desc');
    if (descEl) {
      descEl.value = item.summary;
      charCount('ob-desc-count', item.summary, 4000);
    }
  }

  // Auto-activate platforms — use strict activationPlatforms (no unconfirmed console ports)
  const validPids = (item.activationPlatforms || item.platforms || []).filter(pid => !!PLATFORMS[pid] && !COMING_SOON_PLATFORMS.has(pid));
  if (validPids.length) {
    state.activePlatforms.clear();
    validPids.forEach(pid => {
      state.activePlatforms.add(pid);
      if (!state.platformStepStatus[pid]) {
        state.platformStepStatus[pid] = makeEmptyPlatformSteps()[pid] || {};
      }
    });
    const gridWrap = document.getElementById('ob-plat-grid-wrap');
    if (gridWrap) {
      gridWrap.innerHTML = buildObPlatTilesHTML();
      gridWrap.classList.remove('is-req-empty');
    }
    renderOnboardingFooter();
  }

  // Auto-populate screenshots from IGDB.
  // Always clear previously IGDB-sourced screenshots (id starts with 'igdb-') when
  // a new game is selected, then load the new game's screenshots. User-uploaded
  // screenshots (those with a dataUrl) are left untouched.
  // IGDB CDN images route through wsrv.nl to avoid 403s from direct hotlinking.
  {
    state.uploads.screenshots = state.uploads.screenshots.filter(s => s.dataUrl); // keep only real uploads
    if (item.screenshots && item.screenshots.length > 0) {
      const ts = Date.now();
      item.screenshots.forEach((url, i) => {
        state.uploads.screenshots.push({
          id:   'igdb-' + i + '-' + ts,
          name: `screenshot-${i + 1}.jpg`,
          url,  // stored as URL; rendering proxies through wsrv.nl
        });
      });
    }
    const grid = document.getElementById('ob-screenshot-grid');
    if (grid) renderScreenshotGridInto(grid);
    updateObSectionStates();
  }

  // Show confirmed state in the scenario widget
  state.liveSearch = {
    status:    'done',
    found:     true,
    confirmed: true,
    title:     item.name,
    allStores: item.platforms,
    source:    'IGDB',
  };
  _renderScenarioSection();
  updateObSectionStates();

  // Mark title question as answered
  const qTitle = document.getElementById('ob-q-title');
  if (qTitle) qTitle.dataset.answered = '1';
}

/* ── Prompt drawer (debug) ───────────────────────────────── */

function togglePromptDrawer(btn) {
  const drawer = btn.nextElementSibling;
  if (!drawer) return;
  const isOpen = drawer.classList.toggle('is-open');
  btn.textContent = isOpen ? 'Hide prompt' : 'See prompt';
}

/* ── Alert helpers ───────────────────────────────────────── */

// Show/hide the privacy policy alert based on whether the field has a value
function updatePrivacyAlert(value) {
  const el = document.getElementById('ob-privacy-alert');
  if (!el) return;
  // Show the alert only when the field has been touched (blurred or has some input) AND is empty
  el.style.display = (!value || !value.trim()) ? 'flex' : 'none';
}

function togglePrivacyGen(checkbox) {
  state.formData.privacyGenerated = checkbox.checked;
  const note = document.getElementById('ob-privacy-gen-note');
  if (note) note.style.display = checkbox.checked ? 'block' : 'none';
}


/* ── Upload Assets ───────────────────────────────────── */

function handleIconDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('is-over');
  handleIconFiles(e.dataTransfer.files);
}

function handleIconFiles(files) {
  const file = files[0];
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = ev => {
    state.uploads.appIcon = { name: file.name, dataUrl: ev.target.result };
    const preview = document.getElementById('ob-icon-preview');
    if (preview) {
      preview.innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:14px;" alt="App Icon">`;
    }
  };
  reader.readAsDataURL(file);
}

function removeIcon() {
  state.uploads.appIcon = null;
  const preview = document.getElementById('ob-icon-preview');
  if (preview) {
    preview.innerHTML = `
      <div class="asset-dropzone-icon">↑</div>
      <div class="asset-dropzone-label">Drop icon here, or click to browse</div>
      <div class="asset-dropzone-hint">PNG · 1024×1024</div>`;
  }
}

function handleScreenshotDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('is-over');
  handleScreenshotFiles(e.dataTransfer.files);
}

function handleScreenshotFiles(files) {
  Array.from(files).forEach(file => {
    if (!file.type.startsWith('image/')) return;
    const id = 'ss_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const reader = new FileReader();
    reader.onload = ev => {
      state.uploads.screenshots.push({ id, name: file.name, dataUrl: ev.target.result });
      const grid = document.getElementById('ob-screenshot-grid');
      if (grid) renderScreenshotGridInto(grid);
      updateObSectionStates();   // clear amber as soon as first screenshot lands
    };
    reader.readAsDataURL(file);
  });
}

/* ── Improve Your Submission — AI visual analysis ───────────── */

async function runImproveSubmissionAnalysis(platformId) {
  if (!CLAUDE_API_KEY) {
    state.improveSubmissionAnalysis = { error: 'No API key configured.' };
    renderStepModal(); return;
  }

  const ups  = state.uploads;
  const icon = ups.appIcon;
  const shots = (ups.screenshots || []).filter(s => s.dataUrl);
  // Note: don't gate on images — the analysis also scores store page text + metadata.
  // If no images are available, Claude evaluates text only and notes missing assets.

  state.improveSubmissionAnalysis = { loading: true };
  renderStepModal();

  // Helper: strip data-URL prefix → bare base64 + media type
  function parseDataUrl(dataUrl) {
    const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return null;
    return { mediaType: m[1], data: m[2] };
  }

  // Build vision message content
  const content = [];

  // System context
  content.push({ type: 'text', text:
    `You are an expert mobile game App Store consultant evaluating submission assets for "${state.formData.title || 'this game'}".
You will receive the app icon and up to 5 screenshots. Analyze them for quality, effectiveness, and compliance risk.

Evaluation criteria:

ICON:
- Readability at small sizes (29×29 notification, 60×60 home screen) — is the focal point clear?
- Absence of text or wordmarks (Apple/Google reject icons with text)
- Color contrast and visibility on both light and dark backgrounds
- Genre communication — does it signal the type of game?
- Differentiation — would it stand out in a crowded category listing?
- Avoid generic or over-designed icons that blur at small sizes

SCREENSHOTS:
- Gameplay visibility — do they show actual gameplay, not just menus, loading screens, or cutscenes?
- Feature diversity — do they collectively showcase different game mechanics/moments, or are they repetitive?
- Marketing text overlays — text burned into screenshots (taglines, "BEST GAME EVER", promotional copy) can trigger App Store rejection; pure UI/HUD text is fine
- First screenshot impact — it's the most important; does it immediately communicate the core appeal?
- Visual clarity — is each screenshot readable and visually compelling at thumbnail scale?

STORE PAGE:
You also have access to the game's title and description (provided separately in the message). Evaluate the store page copy quality:
- Is the title distinctive and searchable?
- Does the description open with a compelling hook in the first two sentences?
- Is gameplay clearly described, not just vague adjectives?
- Are there keyword opportunities being missed?

METADATA / TAGS:
- Does the title/description suggest good keyword targeting?
- Are genre signals clear?

BINARY (not available — mark as pending):
- You have no binary to analyze. Score this N/A.

Return ONLY a valid JSON object. No markdown. No explanation. Only the JSON:
{
  "scores": {
    "storePage": "A" | "B" | "C" | "D",
    "assets":    "A" | "B" | "C" | "D",
    "metadata":  "A" | "B" | "C" | "D"
  },
  "items": [
    {
      "area": "Store Page" | "Assets" | "Icon" | "Screenshots" | "Screenshot 1" | "Metadata" | "Binary",
      "severity": "warning" | "tip" | "info",
      "title": "Short title (max 10 words)",
      "body": "2–3 sentence explanation with specific, actionable guidance"
    }
  ]
}

Grade rubric: A = strong, minimal changes needed. B = solid but room to improve. C = notable gaps affecting conversion or compliance. D = significant issues requiring attention.
Only include findings that are genuinely meaningful. Omit filler. If something is strong, say so briefly as "info". If something needs attention, be specific about what and why.`
  });

  // Add store page copy for text analysis
  const fd = state.formData;
  if (fd.title || fd.description) {
    content.push({ type: 'text', text:
      `STORE PAGE COPY:\nTitle: ${fd.title || '(no title)'}\nDescription: ${(fd.description || '(no description)').slice(0, 800)}${(fd.description || '').length > 800 ? '…' : ''}` });
  }

  // Attach icon if present
  if (icon) {
    const parsed = parseDataUrl(icon.dataUrl);
    if (parsed) {
      content.push({ type: 'text', text: 'APP ICON:' });
      content.push({ type: 'image', source: { type: 'base64', media_type: parsed.mediaType, data: parsed.data } });
    }
  }

  // Attach up to 5 screenshots
  const toAnalyze = shots.slice(0, 5);
  toAnalyze.forEach((s, i) => {
    const parsed = parseDataUrl(s.dataUrl);
    if (parsed) {
      content.push({ type: 'text', text: `SCREENSHOT ${i + 1}:` });
      content.push({ type: 'image', source: { type: 'base64', media_type: parsed.mediaType, data: parsed.data } });
    }
  });

  try {
    const res = await fetch(CLAUDE_ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1600,
        messages: [{ role: 'user', content }],
      }),
    });
    if (!res.ok) throw new Error('API ' + res.status);
    const data    = await res.json();
    const raw     = (data.content?.[0]?.text || '').trim();
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed  = JSON.parse(cleaned);
    // Support both new { scores, items } format and legacy flat array
    if (Array.isArray(parsed)) {
      state.improveSubmissionAnalysis = { scores: null, items: parsed };
    } else {
      state.improveSubmissionAnalysis = {
        scores: parsed.scores || null,
        items:  Array.isArray(parsed.items) ? parsed.items : [],
      };
    }
  } catch (err) {
    state.improveSubmissionAnalysis = { error: 'Analysis failed: ' + err.message };
  }
  renderStepModal();
}

/* ── Store Page AI Insights ("Fix it" button) ──────────────── */

async function runStorePageInsights() {
  if (!CLAUDE_API_KEY) {
    state.storePageInsights = { error: 'No API key configured.' };
    renderStepModal(); return;
  }
  state.storePageInsights = { loading: true };
  renderStepModal();

  const fd    = state.formData;
  const title = fd.title || '(no title)';
  const desc  = fd.description || '(no description)';

  const prompt = `You are a professional App Store listing consultant reviewing a mobile game's store page.

Game: "${title}"
Description: "${desc.slice(0, 800)}${desc.length > 800 ? '…' : ''}"

Identify up to 5 specific, actionable improvements for this listing. Focus on what would most increase downloads.
Each issue should target a specific field: "subtitle" (max 30 chars) or "description" (max 4000 chars).

Respond ONLY with valid JSON — an array of objects, no extra text, no markdown:
[
  {
    "field": "subtitle",
    "issue": "One sentence describing the specific problem",
    "suggestion": "One sentence explaining what makes a great version",
    "fixedValue": "The improved text"
  }
]`;

  try {
    const res = await fetch(CLAUDE_ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error('API ' + res.status);
    const data    = await res.json();
    const raw     = (data.content?.[0]?.text || '').trim();
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed  = JSON.parse(cleaned);
    const issues  = (Array.isArray(parsed) ? parsed : [parsed]).slice(0, 5);
    state.storePageInsights = { issues, index: 0 };
  } catch (err) {
    state.storePageInsights = { error: 'Analysis failed: ' + err.message };
  }
  renderStepModal();
}

/* Build the merged store-page suggestion list (max 5) from current analysis state.
   Used by both the render function and applyStorePageFix so they share one source. */
function _getCurrentMergedStoreItems() {
  const spi = state.storePageInsights;
  const ana = state.improveSubmissionAnalysis;

  const spItems = (!spi?.loading && !spi?.error && spi?.issues)
    ? spi.issues.map(iss => ({
        tag: { subtitle:'Subtitle', description:'Description', title:'Title' }[iss.field] || 'Store Page',
        title: iss.issue || iss.title || '',
        body:  iss.suggestion || iss.body || '',
        fixedValue: iss.fixedValue || null,
        field: iss.field || null,
        type:  'sp',
      }))
    : [];

  const anaItems = (!ana?.loading && !ana?.error && ana?.items)
    ? (ana.items || [])
        .filter(t => ['store','asset','icon','screenshot','metadata','tag','keyword']
          .some(k => (t.area || '').toLowerCase().includes(k)))
        .map(item => ({ tag: item.area || 'Store Page', title: item.title || '', body: item.body || '', type: 'ana' }))
    : [];

  return [...spItems, ...anaItems].slice(0, 5);
}

/* Auto-trigger both analyses when the Improve Your Submission step opens */
function _autoRunImproveSubmission(pid) {
  const needsSP = !state.storePageInsights || !!state.storePageInsights.error;
  const needsAI = !state.improveSubmissionAnalysis || !!state.improveSubmissionAnalysis.error;

  // Reset cycling index on fresh analysis run
  state.improveSubmissionIdx = { storePage: 0 };

  if (needsSP) state.storePageInsights        = { loading: true };
  if (needsAI) state.improveSubmissionAnalysis = { loading: true };

  renderStepModal(); // show loading screen immediately

  if (needsSP) runStorePageInsights();
  if (needsAI) runImproveSubmissionAnalysis(pid);
}

/* Apply the current store page fix, then advance */
function applyStorePageFix() {
  if (!state.improveSubmissionIdx) state.improveSubmissionIdx = { storePage: 0 };
  const items = _getCurrentMergedStoreItems();
  const i   = state.improveSubmissionIdx.storePage || 0;
  const cur = items[i];
  if (!cur?.fixedValue || cur.type !== 'sp') return;

  if (cur.field === 'description') {
    state.formData.description = cur.fixedValue;
    const el = document.getElementById('ob-desc');
    if (el) { el.value = cur.fixedValue; charCount('ob-desc-count', cur.fixedValue, 4000); }
  } else if (cur.field === 'subtitle') {
    state.formData.subtitle = cur.fixedValue;
    const el = document.getElementById('ob-subtitle');
    if (el) { el.value = cur.fixedValue; charCount('ob-subtitle-count', cur.fixedValue, 30); }
  } else if (cur.field === 'title') {
    state.formData.title = cur.fixedValue;
    const el = document.getElementById('ob-title');
    if (el) { el.value = cur.fixedValue; charCount('ob-title-count', cur.fixedValue, 30); }
  }

  state.improveSubmissionIdx.storePage = i + 1;
  renderStepModal();
}

/* Advance to next item without applying a fix */
function _nextImprovementItem(section) {
  if (!state.improveSubmissionIdx) state.improveSubmissionIdx = { storePage: 0 };
  if (section === 'storePage') {
    state.improveSubmissionIdx.storePage = (state.improveSubmissionIdx.storePage || 0) + 1;
  }
  renderStepModal();
}

function _screenshotSrc(s) {
  if (s.dataUrl) return s.dataUrl;
  if (!s.url) return '';
  // IGDB CDN images: route through wsrv.nl (images.weserv.nl) which is a dedicated
  // image proxy/CDN that handles hotlink-protected sources reliably.
  // Strip protocol so wsrv.nl can handle both http and https origins.
  if (s.url.includes('images.igdb.com')) {
    const clean = s.url.replace(/^https?:\/\//, '');
    return 'https://wsrv.nl/?url=' + encodeURIComponent(clean) + '&output=jpg';
  }
  return s.url;
}

function renderScreenshotGridInto(grid) {
  if (!state.uploads.screenshots.length) {
    grid.innerHTML = '';
    return;
  }
  grid.innerHTML = state.uploads.screenshots.map(s => `
    <div class="asset-thumb">
      <img src="${_screenshotSrc(s)}" alt="${escHtml(s.name)}">
      <button class="asset-remove" onclick="removeScreenshot('${s.id}')" title="Remove">×</button>
      <div class="asset-name">${escHtml(s.name)}</div>
    </div>
  `).join('');
}

function removeScreenshot(id) {
  state.uploads.screenshots = state.uploads.screenshots.filter(s => s.id !== id);
  const grid = document.getElementById('ob-screenshot-grid');
  if (grid) renderScreenshotGridInto(grid);
}

function handleFeatureDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('is-over');
  handleFeatureFiles(e.dataTransfer.files);
}

function handleFeatureFiles(files) {
  const file = files[0];
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = ev => {
    state.uploads.featureGraphic = { name: file.name, dataUrl: ev.target.result };
    const wrap = document.getElementById('ob-feature-preview');
    if (wrap) {
      wrap.style.display = 'block';
      wrap.innerHTML = `
        <img class="feature-img" src="${ev.target.result}" alt="${file.name}">
        <div class="feature-preview-meta">
          <span class="feature-preview-name">${file.name}</span>
          <button class="btn btn-ghost btn-sm" onclick="removeFeatureGraphic()">Remove</button>
        </div>`;
    }
  };
  reader.readAsDataURL(file);
}

function removeFeatureGraphic() {
  state.uploads.featureGraphic = null;
  const wrap = document.getElementById('ob-feature-preview');
  if (wrap) { wrap.style.display = 'none'; wrap.innerHTML = ''; }
}

function handleTrailerDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('is-over');
  handleTrailerFiles(e.dataTransfer.files);
}

function handleTrailerFiles(files) {
  const file = files[0];
  if (!file) return;
  state.uploads.trailer = { name: file.name, size: file.size };
  const info = document.getElementById('ob-trailer-file-info');
  if (info) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    info.style.display = 'block';
    info.innerHTML = `
      <div class="trailer-file-row">
        <span class="trailer-file-name">🎬 ${file.name}</span>
        <span class="trailer-file-size">${mb} MB</span>
        <button class="btn btn-ghost btn-sm" onclick="removeTrailer()">Remove</button>
      </div>`;
  }
}

function removeTrailer() {
  state.uploads.trailer = null;
  const info = document.getElementById('ob-trailer-file-info');
  if (info) { info.style.display = 'none'; info.innerHTML = ''; }
}


/* ── Key Questions / Compliance ──────────────────────── */

function computeInferences() {
  const text = (state.formData.description + ' ' + state.formData.title).toLowerCase();
  for (const q of QUESTIONS) {
    if (state.questionAnswers[q.id] !== null) continue;
    const matched = q.keywords.some(kw => text.includes(kw));
    if (matched) {
      state.questionAnswers[q.id]  = 'yes';
      state.questionInferred[q.id] = true;
    }
  }
}

function answerQuestion(key, value) {
  // Toggle: clicking the already-selected answer deselects it
  if (state.questionAnswers[key] === value) {
    state.questionAnswers[key]  = null;
    state.questionInferred[key] = false;
  } else {
    state.questionAnswers[key]  = value;
    state.questionInferred[key] = false;
  }
  renderComplianceQuestions();
  updateObSectionStates();
}

/* ── Project bar dropdowns ───────────────────────────── */

function closeAllDropdowns() {
  document.getElementById('projectSelectorWrap')?.classList.remove('open');
  document.getElementById('versionSelectorWrap')?.classList.remove('open');
  document.getElementById('versionMenu')?.classList.remove('open');
  document.getElementById('profileMenu')?.classList.remove('open');
  document.getElementById('loc-primary-wrap')?.classList.remove('is-open');
  // Close all swSelect dropdowns
  document.querySelectorAll('.sw-select-wrap').forEach(el => el.classList.remove('is-open'));
  // Close language type-ahead search if open
  document.getElementById('lang-search-wrap')?.classList.add('hidden');
  // Close language picker
  document.getElementById('langMenu')?.classList.add('hidden');
}

/* ── Language picker ─────────────────────────────────── */

function toggleLangMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('langMenu');
  if (!menu) return;
  const isHidden = menu.classList.contains('hidden');
  closeAllDropdowns();
  if (isHidden) {
    if (typeof renderLangMenu === 'function') renderLangMenu();
    menu.classList.remove('hidden');
  }
}

/* ── swSelect — reusable styled dropdown ─────────────── */

function toggleSwSelect(event, id) {
  event.stopPropagation();
  const wrap = document.getElementById('swsel-' + id);
  if (!wrap) return;
  const isOpen = wrap.classList.contains('is-open');
  closeAllDropdowns();
  if (!isOpen) wrap.classList.add('is-open');
}

function swSelectChoose(id, value, callbackFn) {
  closeAllDropdowns();
  if (typeof window[callbackFn] === 'function') window[callbackFn](value);
}

/* ── Profile menu ────────────────────────────────────── */

function toggleProfileMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('profileMenu');
  const isOpen = menu.classList.contains('open');
  closeAllDropdowns();
  if (!isOpen) menu.classList.add('open');
}

/* ── Multi-project / version management ──────────────── */

function createNewProject() {
  saveCurrentToProject();
  // Reset flat state for fresh onboarding
  state.formData         = makeBlankFormData();
  state.uploads          = makeBlankUploads();
  state.questionAnswers  = makeBlankAnswers();
  state.questionInferred = makeBlankInferred();
  state.activePlatforms  = new Set();
  state.platformStepStatus = makeEmptyPlatformSteps();
  state.privacyPresets   = [];
  state._newProjectMode  = true;
  closeAllDropdowns();
  openOnboarding(0);
}

// Opens the New Release modal, pre-filling the suggested version number.
function openNewReleaseModal() {
  closeAllDropdowns();
  const proj = state.projects.find(p => p.id === state.activeProjectId);
  const currentVer = proj?.versions.find(v => v.id === state.activeVersionId);
  const suggested  = bumpMinorVersion(currentVer?.versionNumber || '1.0');

  const overlay = document.getElementById('release-modal-overlay');
  const modal   = document.getElementById('release-modal');
  if (!modal || !overlay) return;

  modal.innerHTML = `
    <div class="release-modal-header">
      <div class="release-modal-title">${t('release.modal.title')}</div>
      <div class="release-modal-subtitle">${t('release.modal.subtitle')}</div>
    </div>
    <div class="release-modal-body">
      <div class="release-modal-field">
        <label class="release-modal-label" for="rm-version">${t('release.modal.version_lbl')}</label>
        <input class="form-input" id="rm-version" type="text" value="${escHtml(suggested)}"
               placeholder="${t('release.modal.version_ph')}" autocomplete="off">
      </div>
      <div class="release-modal-field">
        <label class="release-modal-label" for="rm-name">${t('release.modal.name_lbl')} <span class="release-modal-optional">${t('release.modal.optional')}</span></label>
        <input class="form-input" id="rm-name" type="text" placeholder="${t('release.modal.name_ph')}"
               autocomplete="off">
      </div>
      <div class="release-modal-field">
        <label class="release-modal-label" for="rm-changelog">${t('release.modal.changelog_lbl')} <span class="release-modal-optional">${t('release.modal.optional')}</span></label>
        <textarea class="form-input release-modal-textarea" id="rm-changelog"
                  placeholder="${t('release.modal.changelog_ph')}" rows="4"></textarea>
      </div>
    </div>
    <div class="release-modal-footer">
      <button class="btn btn-ghost" onclick="closeNewReleaseModal()">${t('btn.cancel')}</button>
      <button class="btn btn-primary" onclick="confirmCreateRelease()">${t('release.modal.create_btn')}</button>
    </div>`;

  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  // Focus version field and select all so user can type immediately
  requestAnimationFrame(() => {
    const inp = document.getElementById('rm-version');
    if (inp) { inp.focus(); inp.select(); }
  });
}

function closeNewReleaseModal() {
  document.getElementById('release-modal-overlay')?.classList.add('hidden');
  document.body.style.overflow = '';
}

function releaseModalOverlayClick(e) {
  if (e.target === document.getElementById('release-modal-overlay')) closeNewReleaseModal();
}

function confirmCreateRelease() {
  const versionInput = document.getElementById('rm-version');
  const nameInput    = document.getElementById('rm-name');
  const clInput      = document.getElementById('rm-changelog');

  const versionNumber = (versionInput?.value || '').trim() || '1.0';
  const name          = (nameInput?.value  || '').trim();
  const changelog     = (clInput?.value    || '').trim();

  saveCurrentToProject();
  const proj = state.projects.find(p => p.id === state.activeProjectId);
  if (!proj) { closeNewReleaseModal(); return; }

  const currentVer = proj.versions.find(v => v.id === state.activeVersionId);
  const carryPlats = currentVer ? currentVer.activePlatforms : [];

  // Carry forward completed steps from the previous release, resetting only the
  // per-release mandatory ones (storePreview, reviewSubmission, submit).
  const ver = makeEmptyVersion(versionNumber, carryPlats, currentVer?.platformStepStatus);
  ver.name      = name;
  ver.changelog = changelog;

  proj.versions.push(ver);
  state.activeVersionId    = ver.id;
  state.activePlatforms    = new Set(ver.activePlatforms);
  state.platformStepStatus = JSON.parse(JSON.stringify(ver.platformStepStatus));

  // iOS / Android / Steam use computed completion (not platformStepStatus).
  // Their storePreview step is driven by a "seen" flag — reset it so the
  // Store Page Preview step correctly shows as incomplete on the new release.
  state.iosStorePreviewSeen                        = false;
  state.androidSubmitAnswers.storePreviewSeen      = false;
  state.steamSubmitAnswers.storePreviewSeen        = false;

  closeNewReleaseModal();
  renderDashboard();
}

function switchProject(projectId) {
  if (projectId === state.activeProjectId) { closeAllDropdowns(); return; }
  loadProjectAndVersion(projectId, null);
  closeAllDropdowns();
  renderDashboard();
}

function switchVersion(versionId) {
  if (versionId === state.activeVersionId) { closeAllDropdowns(); return; }
  saveCurrentToProject();
  const proj = state.projects.find(p => p.id === state.activeProjectId);
  const ver  = proj?.versions.find(v => v.id === versionId);
  if (!ver) return;
  state.activeVersionId      = ver.id;
  state.activePlatforms      = new Set(ver.activePlatforms);
  state.platformStepStatus   = JSON.parse(JSON.stringify(ver.platformStepStatus));
  closeAllDropdowns();
  renderDashboard();
}

function toggleProjectDropdown(e) {
  e.stopPropagation();
  const wrap = document.getElementById('projectSelectorWrap');
  const isOpen = wrap.classList.contains('open');
  closeAllDropdowns();
  if (!isOpen) wrap.classList.add('open');
}

function toggleVersionDropdown(e) {
  e.stopPropagation();
  const wrap = document.getElementById('versionSelectorWrap');
  const isOpen = wrap.classList.contains('open');
  closeAllDropdowns();
  if (!isOpen) wrap.classList.add('open');
}

function toggleVersionMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('versionMenu');
  const isOpen = menu.classList.contains('open');
  closeAllDropdowns();
  if (!isOpen) menu.classList.add('open');
}

// Close dropdowns when clicking anywhere outside
document.addEventListener('click', closeAllDropdowns);


/* ── Confirm / Info Modal ────────────────────────────── */

let _confirmCallback = null;

function openConfirmModal(title, message, confirmLabel, onConfirm, isDanger = false) {
  _confirmCallback = onConfirm;
  document.getElementById('confirm-modal-title').textContent = title;
  document.getElementById('confirm-modal-message').textContent = message;
  const confirmBtn = document.getElementById('confirm-modal-confirm');
  confirmBtn.textContent = confirmLabel;
  confirmBtn.className = `btn ${isDanger ? 'btn-danger' : 'btn-primary'}`;
  confirmBtn.onclick = () => { if (_confirmCallback) _confirmCallback(); };
  const cancelBtn = document.getElementById('confirm-modal-cancel');
  cancelBtn.style.display = '';
  document.getElementById('confirm-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function openInfoModal(title, message) {
  _confirmCallback = null;
  document.getElementById('confirm-modal-title').textContent = title;
  document.getElementById('confirm-modal-message').textContent = message;
  const confirmBtn = document.getElementById('confirm-modal-confirm');
  confirmBtn.textContent = 'OK';
  confirmBtn.className = 'btn btn-primary';
  confirmBtn.onclick = closeConfirmModal;
  document.getElementById('confirm-modal-cancel').style.display = 'none';
  document.getElementById('confirm-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeConfirmModal() {
  document.getElementById('confirm-overlay').classList.add('hidden');
  document.body.style.overflow = '';
  _confirmCallback = null;
}


/* ── Delete Version ───────────────────────────────────── */

function _versionHasReleases(ver) {
  return Object.values(ver.platformReleases || {}).some(list => list && list.length > 0);
}

function deleteCurrentVersion() {
  closeAllDropdowns();
  const proj = state.projects.find(p => p.id === state.activeProjectId);
  if (!proj) return;

  // Case 1: Only one release — can't delete
  if (proj.versions.length === 1) {
    openInfoModal(
      t('delete.release.cant_title'),
      t('delete.release.cant_body')
    );
    return;
  }

  const ver = proj.versions.find(v => v.id === state.activeVersionId);
  if (!ver) return;

  const hasSubmitted       = _versionHasReleases(ver);
  const hasActivePlatforms = ver.activePlatforms && ver.activePlatforms.length > 0;
  const label = 'v' + ver.versionNumber;

  if (hasSubmitted) {
    // Case 2: Release has release records (submitted to at least one track)
    openConfirmModal(
      t('delete.release.submitted_title'),
      t('delete.release.submitted_body', { label }),
      t('btn.delete_anyway'),
      () => _deleteVersion(proj, ver.id),
      true
    );
  } else if (hasActivePlatforms) {
    // Case 3: Active platforms but nothing submitted yet
    openConfirmModal(
      t('delete.release.active_title'),
      t('delete.release.active_body', { label }),
      t('btn.delete'),
      () => _deleteVersion(proj, ver.id),
      true
    );
  } else {
    // Empty version — delete without ceremony
    _deleteVersion(proj, ver.id);
  }
}

function _deleteVersion(proj, verId) {
  proj.versions = proj.versions.filter(v => v.id !== verId);
  // Switch to the last remaining version
  const newVer = proj.versions[proj.versions.length - 1];
  state.activeVersionId    = newVer.id;
  state.activePlatforms    = new Set(newVer.activePlatforms);
  state.platformStepStatus = JSON.parse(JSON.stringify(newVer.platformStepStatus));
  closeConfirmModal();
  renderDashboard();
}


/* ── Delete Project ──────────────────────────────────── */

function deleteCurrentProject() {
  closeAllDropdowns();

  // Can't delete the only project
  if (state.projects.length === 1) {
    openInfoModal(
      'Can\'t delete this project',
      'This is your only project. Create another project first, then delete this one.'
    );
    return;
  }

  const proj = state.projects.find(p => p.id === state.activeProjectId);
  if (!proj) return;

  // Check if any version has release records
  const hasSubmitted = proj.versions.some(_versionHasReleases);

  if (hasSubmitted) {
    openConfirmModal(
      'Delete project with live submissions?',
      `"${proj.name}" has active store submissions. All project data and release records will be permanently deleted. This won't unpublish anything already live.`,
      'Delete project',
      () => _deleteProject(proj.id),
      true
    );
  } else {
    openConfirmModal(
      'Delete project?',
      `Delete "${proj.name}" and all its versions? This cannot be undone.`,
      'Delete project',
      () => _deleteProject(proj.id),
      true
    );
  }
}

function _deleteProject(projectId) {
  state.projects = state.projects.filter(p => p.id !== projectId);
  // Load the first remaining project
  const newProj = state.projects[0];
  loadProjectAndVersion(newProj.id, null);
  closeConfirmModal();
  renderDashboard();
}

function changeInferredAnswer(key) {
  state.questionInferred[key] = false;
  state.questionAnswers[key]  = null;
  const body = document.getElementById('ob-body');
  if (body) {
    const html = buildComplianceTab();
    body.innerHTML = html;
    hydrateComplianceTab();
  }
}

/* ── Consolidated Questionnaire Modal ────────────────── */

async function openCQModal() {
  if (state.activePlatforms.size === 0) return;
  state.cqSeen = true;

  // First-ever open with a key available → run inference before showing modal
  const hasAnswers = Object.keys(state.cqAnswers).length > 0;
  const hasKey = typeof CLAUDE_API_KEY !== 'undefined' && CLAUDE_API_KEY;
  if (!hasAnswers && hasKey && state.cqInferenceStatus === null) {
    await runCQInference();
  }

  renderCQModal();
  document.getElementById('cq-overlay').classList.remove('hidden');
}

async function runCQInference() {
  state.cqInferenceStatus = 'loading';
  state.cqInferenceError  = null;
  renderDashboard(); // show loading state in banner
  try {
    const result = await analyzeCQWithClaude();
    const { applied, skipped } = applyCQResults(result);
    state.cqInferenceStatus = 'done';
    // Trigger A: AI filled ≥80% of questions → enable highlights so users
    // can immediately see what still needs attention.
    const total = applied + skipped;
    if (total > 0 && applied / total >= 0.8) {
      state.showHighlights = true;
      _setObValidating(true);
    }
  } catch (err) {
    state.cqInferenceStatus = 'error';
    state.cqInferenceError  = err.message === 'NO_KEY' ? 'No API key set.' : err.message;
    console.warn('[CQ] Inference failed:', err.message);
  }
  renderDashboard();
}

function closeCQModal() {
  document.getElementById('cq-overlay').classList.add('hidden');
  renderDashboard(); // refresh banner progress
}

function cqOverlayClick(e) {
  if (e.target === document.getElementById('cq-overlay')) closeCQModal();
}

// Mark a CQ answer as human-confirmed (clears AI badge)
function _confirmCQHuman(qid) {
  state.cqAnswerMeta[qid] = { ...(state.cqAnswerMeta[qid] || {}), humanConfirmed: true };
}

// Yes/No and text answers
function setCQAnswer(qid, value) {
  state.cqAnswers[qid] = value;
  _confirmCQHuman(qid);
  const scroll = document.getElementById('cq-modal-body')?.scrollTop || 0;
  renderCQModal();
  requestAnimationFrame(() => {
    const body = document.getElementById('cq-modal-body');
    if (body) body.scrollTop = scroll;
  });
}

// Single-select (option by index to avoid escaping issues)
function setCQSingle(qid, optIdx) {
  const q = CQ_QUESTIONS.find(x => x.id === qid);
  if (!q) return;
  const opt = q.options[optIdx];
  state.cqAnswers[qid] = opt;
  _confirmCQHuman(qid);
  const scroll = document.getElementById('cq-modal-body')?.scrollTop || 0;
  renderCQModal();
  requestAnimationFrame(() => {
    const body = document.getElementById('cq-modal-body');
    if (body) body.scrollTop = scroll;
  });
}

// Multi-select checkbox toggle
/* ── Country chip expand/collapse ────────────────────── */

function toggleObDistExpand(btn) {
  const extraList = document.getElementById('ob-dist-country-list-extra');
  if (!extraList) return;
  const extraCount = IOS_COUNTRIES.length - 10;
  const chevD = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
  const chevU = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`;
  const nowHidden = extraList.classList.toggle('hidden');
  if (nowHidden) {
    // Collapsed — show the expand prompt and scroll button into view
    btn.innerHTML = `${chevD} Show ${extraCount} more markets`;
    btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    // Expanded
    btn.innerHTML = `${chevU} Show fewer markets`;
  }
}

/* ── Language type-ahead search ──────────────────────── */

function toggleLangSearch(event) {
  event.stopPropagation();
  const wrap = document.getElementById('lang-search-wrap');
  if (!wrap) return;
  const isOpen = !wrap.classList.contains('hidden');
  if (isOpen) {
    wrap.classList.add('hidden');
  } else {
    wrap.classList.remove('hidden');
    filterLangSearch('');
    const input = document.getElementById('lang-search-input');
    if (input) { input.value = ''; input.focus(); }
  }
}

function filterLangSearch(query) {
  const fd = state.formData;
  const primary = fd.primaryLanguage || 'en';
  const selected = new Set(fd.localizations || []);
  const featured = new Set(OB_LANG_FEATURED);

  const list = document.getElementById('lang-search-list');
  if (!list) return;

  const q = (query || '').toLowerCase();
  const results = Object.entries(OB_LANG_NAMES)
    .filter(([code, name]) =>
      code !== primary &&
      !featured.has(code) &&
      (q === '' || name.toLowerCase().includes(q) || code.toLowerCase().includes(q))
    )
    .sort(([, a], [, b]) => a.localeCompare(b))   // always alphabetical
    .slice(0, 20);

  if (results.length === 0) {
    list.innerHTML = '<div class="lang-search-empty">No languages found</div>';
    return;
  }

  list.innerHTML = results.map(([code, name]) => {
    const isOn = selected.has(code);
    return `<button class="lang-search-item${isOn ? ' is-on' : ''}" onclick="addLangFromSearch('${code}')">
      <span>${name}</span>
      ${isOn ? '<span class="lang-search-check">✓</span>' : ''}
    </button>`;
  }).join('');
}

function addLangFromSearch(code) {
  const arr = state.formData.localizations || [];
  const idx = arr.indexOf(code);
  if (idx === -1) {
    arr.push(code);
  } else {
    arr.splice(idx, 1);
  }
  state.formData.localizations = arr;
  updateObLangListWrap();
}

function handleCQMulti(el) {
  const qid  = el.dataset.qid;
  const idx  = parseInt(el.dataset.oidx);
  const q    = CQ_QUESTIONS.find(x => x.id === qid);
  if (!q) return;
  const opt     = q.options[idx];
  const NONE_RE = /^none/i;
  const current = Array.isArray(state.cqAnswers[qid]) ? [...state.cqAnswers[qid]] : [];

  if (el.checked) {
    if (NONE_RE.test(opt)) {
      state.cqAnswers[qid] = [opt]; // selecting "None" clears everything else
    } else {
      const filtered = current.filter(v => !NONE_RE.test(v));
      if (!filtered.includes(opt)) filtered.push(opt);
      state.cqAnswers[qid] = filtered;
    }
  } else {
    state.cqAnswers[qid] = current.filter(v => v !== opt);
  }

  _confirmCQHuman(qid);
  const scroll = document.getElementById('cq-modal-body')?.scrollTop || 0;
  renderCQModal();
  requestAnimationFrame(() => {
    const body = document.getElementById('cq-modal-body');
    if (body) body.scrollTop = scroll;
  });
}

/* ═══════════════════════════════════════════════════
   ANDROID HANDLERS
   ═══════════════════════════════════════════════════ */

/* Seed Android answers from onboarding data where possible */
/* ── Android Content Rating — inline CQ answer handlers ─────
   These update cqAnswers (shared with the CQ modal) but re-render
   the step modal instead of the CQ modal.                      */

/* Handle YES/NO on individual options within a multi-select CQ question */
function answerAndroidCRMultiOpt(qid, optIdx, yesOrNo) {
  const q = CQ_QUESTIONS.find(x => x.id === qid);
  if (!q) return;
  const opt = q.options[optIdx];
  if (!opt) return;
  const current = Array.isArray(state.cqAnswers[qid]) ? state.cqAnswers[qid] : [];
  const inArray  = current.includes(opt);

  if (yesOrNo === 'yes') {
    const NONE_RE = /^none$/i;
    if (!inArray) {
      const filtered = current.filter(v => !NONE_RE.test(v));
      filtered.push(opt);
      state.cqAnswers[qid] = filtered;
    } else {
      // Already YES — toggle off (same as clicking selected button again)
      state.cqAnswers[qid] = current.filter(v => v !== opt);
    }
  } else {
    // NO — remove from array
    state.cqAnswers[qid] = current.filter(v => v !== opt);
  }
  _confirmCQHuman(qid);
  reRenderAndroidStepModal();
  updateAndroidCard();
}

function answerAndroidCR(qid, value) {
  const current = state.cqAnswers[qid];
  state.cqAnswers[qid] = (current === value) ? undefined : value;
  // Mark human-confirmed — removes AI badge
  state.cqAnswerMeta[qid] = { ...(state.cqAnswerMeta[qid] || {}), humanConfirmed: true };
  reRenderAndroidStepModal();
  updateAndroidCard();
}

function answerAndroidCRSingle(qid, optIdx) {
  const q = CQ_QUESTIONS.find(x => x.id === qid);
  if (!q) return;
  const opt     = q.options[optIdx];
  const current = state.cqAnswers[qid];
  state.cqAnswers[qid] = (current === opt) ? undefined : opt;
  _confirmCQHuman(qid);
  reRenderAndroidStepModal();
  updateAndroidCard();
}

function toggleAndroidCRMulti(qid, opt, checked) {
  const NONE_RE = /\bnone\b/i;
  const current = Array.isArray(state.cqAnswers[qid]) ? state.cqAnswers[qid] : [];
  if (checked) {
    if (NONE_RE.test(opt)) {
      state.cqAnswers[qid] = [opt];
    } else {
      const filtered = current.filter(v => !NONE_RE.test(v));
      if (!filtered.includes(opt)) filtered.push(opt);
      state.cqAnswers[qid] = filtered;
    }
  } else {
    state.cqAnswers[qid] = current.filter(v => v !== opt);
  }
  _confirmCQHuman(qid);
  reRenderAndroidStepModal();
  updateAndroidCard();
}

function seedOnboardingToAndroid() {
  const a  = state.androidSubmitAnswers;
  const fd = state.formData;
  const qa = state.questionAnswers;
  // Pre-populate collectsOrSharesData from onboarding question
  if (a.collectsOrSharesData === null && qa.dataCollection !== null) {
    a.collectsOrSharesData = qa.dataCollection;
  }
}

/* Update the Android card in the dashboard after changes */
function updateAndroidCard() {
  if (!state.activePlatforms.has('android')) return;
  const checkSVG = `<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  PLATFORMS.android.steps.forEach((step, i) => {
    const card = document.getElementById(`android-step-card-${step.id}`);
    if (!card) return;
    const done = isAndroidSectionComplete(step.id);
    card.classList.toggle('is-complete', done);
    const numEl = card.querySelector('.ios-step-num');
    if (numEl) {
      numEl.classList.toggle('is-done', done);
      numEl.innerHTML = done ? checkSVG : String(i + 1);
    }
  });

  const counts = platformStepCount('android');
  const submitCard = document.getElementById('android-step-card-submit');
  if (submitCard) submitCard.classList.toggle('submit-step-locked', !counts.allRequired);
}

/* Re-render Data Safety modal body preserving scroll */
function reRenderAndroidStepModal() {
  const bodyEl = document.getElementById('step-modal-body');
  const scrollTop = bodyEl ? bodyEl.scrollTop : 0;
  renderStepModal();
  const newBodyEl = document.getElementById('step-modal-body');
  if (newBodyEl) newBodyEl.scrollTop = scrollTop;
}

/* Answer a yes/no android field */
/* Toggle a yes/no or single-choice field — clicking same value again deselects to null */
function answerAndroidField(fieldId, value) {
  const current = state.androidSubmitAnswers[fieldId];
  state.androidSubmitAnswers[fieldId] = (current === value) ? null : value;
  reRenderAndroidStepModal();
  updateAndroidCard();
}

/* Answer a text field */
function answerAndroidTextField(fieldId, value) {
  state.androidSubmitAnswers[fieldId] = value;
  updateAndroidCard();
}

/* Toggle account creation method */
/* Single-select account creation method */
function setAndroidAccountMethod(methodId) {
  state.androidSubmitAnswers.accountMethod = methodId || null;
  reRenderAndroidStepModal();
  updateAndroidCard();
}

/* Toggle a data type row on/off (row click) */
function toggleAndroidDataType(typeId) {
  const a = state.androidSubmitAnswers;
  if (a.dataPerType[typeId]) {
    delete a.dataPerType[typeId];
  } else {
    a.dataPerType[typeId] = { collected: true, shared: false, ephemeral: false, required: true, purposes: [] };
  }
  reRenderAndroidStepModal();
  updateAndroidCard();
}

/* Set a boolean flag (collected/shared/ephemeral/required) on a data type */
function setAndroidTypeFlag(typeId, flag, value) {
  const a = state.androidSubmitAnswers;
  if (!a.dataPerType[typeId]) {
    a.dataPerType[typeId] = { collected: false, shared: false, ephemeral: false, required: true, purposes: [] };
  }
  a.dataPerType[typeId][flag] = value;
  reRenderAndroidStepModal();
  updateAndroidCard();
}

/* Toggle a purpose for a data type */
function toggleAndroidPurpose(typeId, purposeId, checked) {
  const a = state.androidSubmitAnswers;
  if (!a.dataPerType[typeId]) return;
  const purposes = a.dataPerType[typeId].purposes;
  if (checked) {
    if (!purposes.includes(purposeId)) purposes.push(purposeId);
  } else {
    a.dataPerType[typeId].purposes = purposes.filter(p => p !== purposeId);
  }
  updateAndroidCard();
}

/* Toggle the data matrix expanded/collapsed */
function toggleAndroidMatrix() {
  state.androidMatrixExpanded = !state.androidMatrixExpanded;
  reRenderAndroidStepModal();
}

/* Plain-language data description → AI translation */
function updateAndroidDataDescription(val) {
  state.androidSubmitAnswers.androidDataDescription = val;
  if (!val || val.trim().length < 20) return;
  _triggerAndroidDataAI();
}

async function _triggerAndroidDataAI() {
  if (!CLAUDE_API_KEY) return;
  const desc = (state.androidSubmitAnswers.androidDataDescription || '').trim();
  if (desc.length < 20) return;

  state.androidDataAIStatus = 'loading';
  reRenderAndroidStepModal();

  const typeList    = ANDROID_DATA_TYPES.flatMap(g => g.types)
    .map(t => `${t.id}: ${t.label} (${t.group})${t.desc ? ' — ' + t.desc : ''}`).join('\n');
  const purposeList = ANDROID_PURPOSES.map(p => `${p.id}: ${p.label}`).join('\n');

  const prompt = `You are helping a mobile game developer complete the Google Play Data Safety form.

Developer's description of their data collection and sharing:
"${desc}"

Available data type IDs (id: label — description):
${typeList}

Available purpose IDs:
${purposeList}

Return ONLY valid JSON — no markdown fences, no extra text:
{
  "selections": [
    {
      "typeId": "<exact data type id>",
      "collected": true,
      "shared": false,
      "ephemeral": false,
      "required": true,
      "purposes": ["<purpose id>", ...]
    }
  ]
}

Rules:
- Only include types clearly mentioned or strongly implied by the description.
- Set collected:true if the app collects this type, shared:true if shared with third parties.
- ephemeral:true only if data is never stored (only processed in memory).
- required:true if collection is mandatory for the app to function.
- Only include purposes that genuinely apply.
- Be conservative — omit rather than guess.`;

  try {
    const res = await fetch(CLAUDE_ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key':                                 CLAUDE_API_KEY,
        'anthropic-version':                         '2023-06-01',
        'content-type':                              'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model:      CLAUDE_MODEL,
        max_tokens: 1000,
        messages:   [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      }),
    });

    if (!res.ok) throw new Error('API ' + res.status);
    const data    = await res.json();
    const text    = (data.content?.[0]?.text || '').trim();
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed  = JSON.parse(cleaned);

    const validTypeIds    = new Set(ANDROID_DATA_TYPES.flatMap(g => g.types).map(t => t.id));
    const validPurposeIds = new Set(ANDROID_PURPOSES.map(p => p.id));
    const newPerType      = {};

    for (const sel of (parsed.selections || [])) {
      if (!validTypeIds.has(sel.typeId)) continue;
      const purposes = (sel.purposes || []).filter(p => validPurposeIds.has(p));
      newPerType[sel.typeId] = {
        collected: !!sel.collected,
        shared:    !!sel.shared,
        ephemeral: !!sel.ephemeral,
        required:  sel.required !== false,
        purposes,
      };
    }

    state.androidSubmitAnswers.dataPerType = newPerType;
    state.androidDataAIStatus = 'complete';
    state.androidMatrixExpanded = true;
  } catch (e) {
    console.warn('[Android Data AI]', e.message);
    state.androidDataAIStatus = 'error';
  }

  reRenderAndroidStepModal();
  updateAndroidCard();
}

/* ═══════════════════════════════════════════════════
   STEAM HANDLERS
   ═══════════════════════════════════════════════════ */

function reRenderSteamStepModal() {
  const bodyEl = document.getElementById('step-modal-body');
  const scrollTop = bodyEl ? bodyEl.scrollTop : 0;
  renderStepModal();
  const newBodyEl = document.getElementById('step-modal-body');
  if (newBodyEl) newBodyEl.scrollTop = scrollTop;
}

function updateSteamCard() {
  if (!state.activePlatforms.has('steam')) return;
  const checkSVG = `<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  PLATFORMS.steam.steps.forEach((step, i) => {
    const card = document.getElementById(`steam-step-card-${step.id}`);
    if (!card) return;
    const done = isSteamSectionComplete(step.id);
    card.classList.toggle('is-complete', done);
    const numEl = card.querySelector('.ios-step-num');
    if (numEl) {
      numEl.classList.toggle('is-done', done);
      numEl.classList.remove('is-risk-warn','is-risk-high');
      numEl.innerHTML = done ? checkSVG : String(i + 1);
    }
  });

  const counts = platformStepCount('steam');
  const submitCard = document.getElementById('steam-step-card-submit');
  if (submitCard) submitCard.classList.toggle('submit-step-locked', !counts.allRequired);
}

/* Toggle/answer helpers */
function answerSteamField(fieldId, value) {
  const current = state.steamSubmitAnswers[fieldId];
  state.steamSubmitAnswers[fieldId] = (current === value) ? null : value;
  reRenderSteamStepModal();
  updateSteamCard();
}

function answerSteamTextField(fieldId, value) {
  state.steamSubmitAnswers[fieldId] = value;
  updateSteamCard();
}

/* Unified handler for all Steam content survey yes/no items */
function answerSteamContentItem(itemId, value) {
  if (!state.steamSubmitAnswers.steamContentAnswers) {
    state.steamSubmitAnswers.steamContentAnswers = {};
  }
  const sca = state.steamSubmitAnswers.steamContentAnswers;
  const current = sca[itemId];
  const newVal  = (current === value) ? null : value;
  sca[itemId] = newVal;
  // Mark human-confirmed — removes AI badge
  state.steamAnswerMeta[itemId] = { ...(state.steamAnswerMeta[itemId] || {}), humanConfirmed: true };

  // Auto-cascade for mature declarations chain
  const CHAIN = ['gen_mature', 'some_nudity', 'freq_nudity', 'adult_sexual'];
  const idx = CHAIN.indexOf(itemId);
  if (idx !== -1) {
    if (newVal === 'yes') {
      // Set all preceding chain members to 'yes' if not already answered
      for (let i = 0; i < idx; i++) {
        if (!sca[CHAIN[i]]) sca[CHAIN[i]] = 'yes';
      }
    } else {
      // Set all following chain members to 'no'
      for (let i = idx + 1; i < CHAIN.length; i++) {
        sca[CHAIN[i]] = 'no';
      }
    }
  }
  // freq_violence also requires gen_mature
  if (itemId === 'freq_violence' && newVal === 'yes' && !sca['gen_mature']) {
    sca['gen_mature'] = 'yes';
  }

  reRenderSteamStepModal();
  updateSteamCard();
}

function toggleSteamAIType(typeId, checked) {
  const types = state.steamSubmitAnswers.aiLiveTypes;
  if (checked) { if (!types.includes(typeId)) types.push(typeId); }
  else { state.steamSubmitAnswers.aiLiveTypes = types.filter(t => t !== typeId); }
  reRenderSteamStepModal();
  updateSteamCard();
}

function toggleSteamTag(field, value, checked, maxCount) {
  const arr = state.steamSubmitAnswers[field];
  if (checked) {
    // Add only if under the cap
    if (arr.length < maxCount && !arr.includes(value)) arr.push(value);
    // If at cap, silently ignore (chip stays un-on; re-render shows correct state)
  } else {
    state.steamSubmitAnswers[field] = arr.filter(v => v !== value);
  }
  reRenderStepModal();
  updateSteamCard();
}

function toggleSteamPS(controllerId, checked) {
  const ps = state.steamSubmitAnswers.psControllers;
  if (checked) {
    if (controllerId === 'ps_none') {
      state.steamSubmitAnswers.psControllers = ['ps_none'];
    } else {
      state.steamSubmitAnswers.psControllers = ps
        .filter(c => c !== 'ps_none')
        .concat(ps.includes(controllerId) ? [] : [controllerId]);
      // Auto-select USB if BT+USB selected
      if (controllerId === 'ps_dualshock_bt' && !ps.includes('ps_dualshock_usb')) {
        state.steamSubmitAnswers.psControllers.push('ps_dualshock_usb');
      }
      if (controllerId === 'ps_dualsense_bt' && !ps.includes('ps_dualsense_usb')) {
        state.steamSubmitAnswers.psControllers.push('ps_dualsense_usb');
      }
    }
  } else {
    state.steamSubmitAnswers.psControllers = ps.filter(c => c !== controllerId);
  }
  reRenderSteamStepModal();
}

function toggleSteamAccessibility(featureId, checked) {
  const feats = state.steamSubmitAnswers.accessibilityFeatures;
  if (checked) { if (!feats.includes(featureId)) feats.push(featureId); }
  else { state.steamSubmitAnswers.accessibilityFeatures = feats.filter(f => f !== featureId); }
  updateSteamCard();
}

/* Retry inference for any platform+step */
async function _retryInference(pid, stepId) {
  // Questionnaire steps use the shared unified cache key
  if (stepId === 'questionnaire') {
    delete state.platformInferenceCache['unified:questionnaire'];
  } else {
    delete state.platformInferenceCache[pid + ':' + stepId];
  }
  state.stepModal.inferenceStatus = 'loading';
  state.stepModal.inferenceError  = null;
  const rerender = pid === 'android' ? reRenderAndroidStepModal
                 : pid === 'steam'   ? reRenderSteamStepModal
                 : reRenderStepModal;
  rerender();
  try {
    await runInference(pid, stepId);
    state.stepModal.inferenceStatus = 'done';
    _postInferenceSetup(stepId);
  } catch(err) {
    state.stepModal.inferenceStatus  = 'error';
    state.stepModal.inferenceError   = err.message;
  }
  rerender();
}

/* Post-inference setup: take filter snapshots + collapse to Unanswered for all active platforms */
function _postInferenceSetup(stepId) {
  if (stepId !== 'questionnaire') return;
  for (const p of ['ios', 'android', 'steam']) {
    if (!state.activePlatforms.has(p)) continue;
    takeFilterSnapshot(p);
    if (p === 'ios')     state.iosContentRatingExpanded     = false;
    if (p === 'android') state.androidContentRatingExpanded = false;
    if (p === 'steam')   state.steamContentRatingExpanded   = false;
  }
}

/* Show/hide the "See Prompt" debug overlay */
function showInferencePrompt() {
  const existing = document.getElementById('prompt-debug-overlay');
  if (existing) { existing.remove(); return; }

  const text = (state.lastInferencePrompt || '(no prompt stored yet)')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const overlay = document.createElement('div');
  overlay.id = 'prompt-debug-overlay';
  overlay.className = 'prompt-debug-overlay';
  overlay.innerHTML = `
    <div class="prompt-debug-modal">
      <div class="prompt-debug-header">
        <span class="prompt-debug-title">AI Inference Prompt</span>
        <button class="prompt-debug-close" onclick="document.getElementById('prompt-debug-overlay').remove()">✕</button>
      </div>
      <textarea class="prompt-debug-body" readonly spellcheck="false">${text}</textarea>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

/* ══════════════════════════════════════════════════════
   BUILD UPLOAD  (per-platform binary)
   ══════════════════════════════════════════════════════ */
function handleBuildUpload(pid, files) {
  const file = files?.[0];
  if (!file) return;
  state.platformBuilds = state.platformBuilds || { ios: null, android: null, steam: null };
  state.platformBuilds[pid] = { name: file.name, size: file.size };
  // Re-render the active card to reflect the new build
  const card = document.getElementById('active-card-' + pid);
  if (card) {
    if (pid === 'ios')     card.outerHTML = buildIOSActiveCard(pid);
    else if (pid === 'android') card.outerHTML = buildAndroidActiveCard(pid);
    else if (pid === 'steam')   card.outerHTML = buildSteamActiveCard(pid);
  } else {
    renderDash();
  }
}

/* ══════════════════════════════════════════════════════
   SCREENSHOT STEP  (per-platform selection + uploads)
   ══════════════════════════════════════════════════════ */

// Toggle selection of an onboarding screenshot for a platform
function togglePlatformScreenshot(pid, shotId) {
  if (!state.platformScreenshots) state.platformScreenshots = { ios:{selected:[],custom:[]}, android:{selected:[],custom:[]}, steam:{selected:[],custom:[]} };
  const ps = state.platformScreenshots[pid];
  const idx = ps.selected.indexOf(shotId);
  if (idx >= 0) {
    ps.selected.splice(idx, 1);
  } else {
    ps.selected.push(shotId);
  }
  // Re-render just the screenshot step body in the open modal
  const body = document.getElementById('step-modal-body');
  if (body) {
    const inner = body.querySelector('.ios-step-body-content');
    if (inner) inner.innerHTML = buildScreenshotsSection(pid);
  }
  // Also update the step card complete state
  const cardEl = document.getElementById((pid === 'ios' ? 'ios' : pid) + '-step-card-screenshots');
  if (cardEl) renderDash();
}

// Handle new platform-specific screenshot file uploads
function handlePlatformScreenshotFiles(pid, files) {
  if (!files || !files.length) return;
  if (!state.platformScreenshots) state.platformScreenshots = { ios:{selected:[],custom:[]}, android:{selected:[],custom:[]}, steam:{selected:[],custom:[]} };
  const ps = state.platformScreenshots[pid];
  Array.from(files).forEach(file => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const id = 'pshot-' + pid + '-' + Date.now() + '-' + Math.random().toString(36).slice(2,7);
      ps.custom = ps.custom || [];
      ps.custom.push({ id, name: file.name, dataUrl: ev.target.result });
      // Re-render modal body
      const body = document.getElementById('step-modal-body');
      if (body) {
        const inner = body.querySelector('.ios-step-body-content');
        if (inner) inner.innerHTML = buildScreenshotsSection(pid);
      }
    };
    reader.readAsDataURL(file);
  });
}

// Remove a platform-specific custom screenshot
function removePlatformScreenshot(pid, shotId) {
  if (!state.platformScreenshots?.[pid]) return;
  state.platformScreenshots[pid].custom = (state.platformScreenshots[pid].custom || []).filter(s => s.id !== shotId);
  const body = document.getElementById('step-modal-body');
  if (body) {
    const inner = body.querySelector('.ios-step-body-content');
    if (inner) inner.innerHTML = buildScreenshotsSection(pid);
  }
}
