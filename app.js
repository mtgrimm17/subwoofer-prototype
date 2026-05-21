/* ============================================================
   APP — events, modal system, init
   ============================================================ */

/* ── Init ────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  if (state.onboardingComplete) {
    showMainApp();
  } else {
    showOnboarding();
  }
});

function showMainApp() {
  document.getElementById('onboarding-overlay').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');
  renderDashboard();
}

function showOnboarding() {
  document.getElementById('onboarding-overlay').classList.remove('hidden');
  document.getElementById('main-app').classList.add('hidden');
  renderOnboarding();
}


/* ── Onboarding modal ────────────────────────────────── */

function openOnboarding(tab = 0) {
  state.onboardingTab = tab;
  showOnboarding();
}

function closeOnboarding() {
  if (!state.onboardingComplete) return; // can't close if not yet done
  showMainApp();
}

function setOnboardingTab(idx) {
  state.onboardingTab = idx;
  renderOnboarding();
}

function nextOnboardingTab() {
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
  if (gridWrap) gridWrap.innerHTML = buildObPlatTilesHTML();
  renderOnboardingFooter();
}

function prevOnboardingTab() {
  if (state.onboardingTab > 0) {
    state.onboardingTab--;
    renderOnboarding();
    const body = document.getElementById('ob-body');
    if (body) body.scrollTop = 0;
  }
}

function completeOnboarding() {
  if (!state.formData.title.trim()) {
    alert('Please enter your game title before continuing.');
    setOnboardingTab(0);
    return;
  }
  if (state.activePlatforms.size === 0) {
    alert('Please select at least one platform before continuing.');
    setOnboardingTab(0);
    return;
  }

  if (state._newProjectMode) {
    // Creating a 2nd+ project — preserve activePlatforms selected during onboarding
    const sub  = makeEmptySubmission('Submission 1.0');
    const proj = {
      id:               generateId('proj'),
      name:             state.formData.title,
      formData:         JSON.parse(JSON.stringify(state.formData)),
      uploads:          JSON.parse(JSON.stringify(state.uploads)),
      questionAnswers:  JSON.parse(JSON.stringify(state.questionAnswers)),
      questionInferred: JSON.parse(JSON.stringify(state.questionInferred)),
      submissions:      [sub],
    };
    state.projects.push(proj);
    state.activeProjectId    = proj.id;
    state.activeSubmissionId = sub.id;
    // Keep state.activePlatforms — already populated by platform tiles in onboarding
    state.platformStepStatus = makeEmptyPlatformSteps();
    state._newProjectMode    = false;
  } else {
    // First project ever
    const sub  = makeEmptySubmission('Submission 1.0');
    const proj = {
      id:               generateId('proj'),
      name:             state.formData.title,
      formData:         JSON.parse(JSON.stringify(state.formData)),
      uploads:          JSON.parse(JSON.stringify(state.uploads)),
      questionAnswers:  JSON.parse(JSON.stringify(state.questionAnswers)),
      questionInferred: JSON.parse(JSON.stringify(state.questionInferred)),
      submissions:      [sub],
    };
    state.projects.push(proj);
    state.activeProjectId    = proj.id;
    state.activeSubmissionId = sub.id;
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
  seedOnboardingToIOS();

  state.stepModal = { platformId: pid, stepId, inferenceStatus: null };

  // Open overlay immediately so user sees something
  renderStepModal();
  // Mark Store Page Preview as visited before rendering
  if (stepId === 'storePreview') state.iosStorePreviewSeen = true;

  document.getElementById('submit-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // For inference steps: run analysis the first time (cache thereafter)
  const step = PLATFORMS[pid].steps.find(s => s.id === stepId);
  if (step?.hasInference && !state.claudeCache) {
    state.stepModal.inferenceStatus = 'loading';
    renderStepModal();
    try {
      const result = await analyzeGameWithClaude();
      state.claudeCache = { result };
      // Preserve human-confirmed answers, clear only AI-inferred meta
      state.iosAnswerMeta = Object.fromEntries(
        Object.entries(state.iosAnswerMeta).filter(([, v]) => v.humanConfirmed)
      );
      applyClaudeResults(result);
      state.stepModal.inferenceStatus = 'done';
    } catch(err) {
      state.stepModal.inferenceStatus = 'error';
      state.stepModal.inferenceError  = err.message === 'NO_KEY' ? 'No API key set.' : err.message;
    }
    reRenderStepModal();
    updateIOSCard();
  }
}

function closeStepModal() {
  document.getElementById('submit-overlay').classList.add('hidden');
  document.body.style.overflow = '';
  updateIOSCard();
}

function submitOverlayClick(e) {
  if (e.target === document.getElementById('submit-overlay')) closeStepModal();
}

// Update the iOS active card progress bar + step counts + submit button without full re-render
function updateIOSCard() {
  if (!state.activePlatforms.has('ios')) return;
  const counts = platformStepCount('ios');
  const pct    = counts.total ? Math.round((counts.complete / counts.total) * 100) : 0;

  const barFill = document.getElementById('bar-fill-ios');
  if (barFill) barFill.style.width = pct + '%';

  const stepCountEl = document.getElementById('step-count-ios');
  if (stepCountEl) stepCountEl.textContent = `${counts.complete} / ${counts.total} steps`;

  // Update each step card completion state + risk dot
  PLATFORMS.ios.steps.forEach((step, i) => {
    const card = document.getElementById(`ios-step-card-${step.id}`);
    if (!card) return;
    const done = isIOSSectionComplete(step.id);
    card.classList.toggle('is-complete', done);

    // Update risk dot
    const risk = computeIOSSectionRisk(step.id);
    let riskDot = card.querySelector('.ios-step-risk');
    if (done) {
      if (riskDot) riskDot.remove();
    } else {
      const dotClass = risk === 'HIGH' ? 'high' : risk === 'MEDIUM' ? 'medium' : 'none';
      if (riskDot) {
        riskDot.className = `ios-step-risk ios-step-risk-${dotClass}`;
      } else {
        // Insert before the arrow
        const arrow = card.querySelector('.ios-step-arrow');
        const dot = document.createElement('span');
        dot.className = `ios-step-risk ios-step-risk-${dotClass}`;
        card.insertBefore(dot, arrow);
      }
    }

    const numEl = card.querySelector('.ios-step-num');
    if (numEl) {
      numEl.classList.toggle('is-done', done);
      numEl.innerHTML = done
        ? `<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`
        : String(i + 1);
    }
  });

  // Submit button
  const submitBtn = document.getElementById('submit-btn-ios');
  if (submitBtn) {
    const allDone = counts.allRequired;
    submitBtn.classList.toggle('is-locked', !allDone);
    if (allDone) {
      submitBtn.removeAttribute('disabled');
      submitBtn.setAttribute('onclick', "finalSubmit('ios')");
    } else {
      submitBtn.setAttribute('disabled', '');
      submitBtn.removeAttribute('onclick');
    }
  }
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
function answerIOSField(field, value) {
  state.iosSubmitAnswers[field] = value;
  // Always upsert meta with humanConfirmed — protects this answer from any
  // future AI overwrite, whether or not AI meta existed before the click
  state.iosAnswerMeta[field] = { ...(state.iosAnswerMeta[field] || {}), humanConfirmed: true };
  reRenderStepModal();
}

// Called by text oninput — updates state only, no re-render (prevents cursor jumping)
function updateIOSTextField(field, value) {
  state.iosSubmitAnswers[field] = value;
}

/* ── Privacy matrix handlers ─────────────────────────── */

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

// Called by the Retry button on analysis error
async function _runClaudeAnalysis() {
  state.stepModal.inferenceStatus = 'loading';
  state.stepModal.inferenceError  = null;
  state.iosAnswerMeta = Object.fromEntries(
    Object.entries(state.iosAnswerMeta).filter(([, v]) => v.humanConfirmed)
  );
  reRenderStepModal();
  try {
    const result = await analyzeGameWithClaude();
    state.claudeCache = { result };
    applyClaudeResults(result);
    state.stepModal.inferenceStatus = 'done';
  } catch(err) {
    state.stepModal.inferenceStatus = 'error';
    state.stepModal.inferenceError  = err.message === 'NO_KEY' ? 'No API key set.' : err.message;
  }
  reRenderStepModal();
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

function finalSubmit(platformId) {
  state.platformStepStatus[platformId]['submit'] = 'complete';
  renderDashboard();
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

function syncField(field, value) {
  state.formData[field] = value;
  if (field === 'title') {
    // Keep selector title in sync while the user types
    const selEl = document.getElementById('projectSelectorTitle');
    if (selEl) selEl.textContent = value || 'My Game';
    const curEl = document.getElementById('projectItemCurrent');
    if (curEl) curEl.textContent = value || 'My Game';
  }
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
  state.formData.distributionPreset = preset;
  if (preset !== 'custom') {
    // Apply the preset's country list
    state.formData.selectedCountries = _obCountriesForPreset(preset);
  }
  // 'custom' keeps whatever countries are currently selected
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
  const storeToPid = { ios: 'ios', steam: 'steam', android: 'android' };
  const foundPids = (ls.allStores || []).map(s => storeToPid[s]).filter(Boolean);
  if (foundPids.length) {
    state.activePlatforms.clear();
    foundPids.forEach(pid => {
      state.activePlatforms.add(pid);
      if (!state.platformStepStatus[pid]) {
        state.platformStepStatus[pid] = makeEmptyPlatformSteps()[pid] || {};
      }
    });
    const gridWrap = document.getElementById('ob-plat-grid-wrap');
    if (gridWrap) gridWrap.innerHTML = buildObPlatTilesHTML();
    renderOnboardingFooter();
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

// Re-trigger search when title changes and a search scenario is already selected
let _titleSearchTimer = null;
function _onTitleInputScenario(value) {
  const gs = state.formData.gameScenario;
  if (gs !== 'new_platform' && gs !== 'update') return;
  // Don't re-search if already confirmed
  if (state.liveSearch && state.liveSearch.confirmed) return;
  clearTimeout(_titleSearchTimer);
  if (!value || value.trim().length < 2) return;
  _titleSearchTimer = setTimeout(() => _triggerScenarioSearch(), 800);
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
    };
    reader.readAsDataURL(file);
  });
}

function renderScreenshotGridInto(grid) {
  if (!state.uploads.screenshots.length) {
    grid.innerHTML = '';
    return;
  }
  grid.innerHTML = state.uploads.screenshots.map(s => `
    <div class="asset-thumb">
      <img src="${s.dataUrl}" alt="${s.name}">
      <button class="asset-remove" onclick="removeScreenshot('${s.id}')" title="Remove">×</button>
      <div class="asset-name">${s.name}</div>
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
  state.questionAnswers[key]  = value;
  state.questionInferred[key] = false;
  // Re-render just the compliance tab body in-place
  const body = document.getElementById('ob-body');
  if (body) {
    const html = buildComplianceTab();
    body.innerHTML = html;
    hydrateComplianceTab();
  }
}

/* ── Project bar dropdowns ───────────────────────────── */

function closeAllDropdowns() {
  document.getElementById('projectSelectorWrap')?.classList.remove('open');
  document.getElementById('submissionSelectorWrap')?.classList.remove('open');
  document.getElementById('submissionMenu')?.classList.remove('open');
  document.getElementById('profileMenu')?.classList.remove('open');
  document.getElementById('loc-primary-wrap')?.classList.remove('is-open');
  // Close language type-ahead search if open
  document.getElementById('lang-search-wrap')?.classList.add('hidden');
}

/* ── Profile menu ────────────────────────────────────── */

function toggleProfileMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('profileMenu');
  const isOpen = menu.classList.contains('open');
  closeAllDropdowns();
  if (!isOpen) menu.classList.add('open');
}

/* ── Multi-project / submission management ───────────── */

function createNewProject() {
  saveCurrentToProject();
  // Reset flat state for fresh onboarding
  state.formData         = makeBlankFormData();
  state.uploads          = makeBlankUploads();
  state.questionAnswers  = makeBlankAnswers();
  state.questionInferred = makeBlankInferred();
  state.activePlatforms  = new Set();
  state.platformStepStatus = makeEmptyPlatformSteps();
  state._newProjectMode  = true;
  closeAllDropdowns();
  openOnboarding(0);
}

function createNewSubmission() {
  saveCurrentToProject();
  const proj = state.projects.find(p => p.id === state.activeProjectId);
  if (!proj) return;
  const subNum = proj.submissions.length + 1;
  const sub    = makeEmptySubmission('Submission ' + subNum + '.0');
  proj.submissions.push(sub);
  state.activeSubmissionId   = sub.id;
  state.activePlatforms      = new Set();
  state.platformStepStatus   = makeEmptyPlatformSteps();
  closeAllDropdowns();
  renderDashboard();
}

function switchProject(projectId) {
  if (projectId === state.activeProjectId) { closeAllDropdowns(); return; }
  loadProjectAndSubmission(projectId, null);
  closeAllDropdowns();
  renderDashboard();
}

function switchSubmission(submissionId) {
  if (submissionId === state.activeSubmissionId) { closeAllDropdowns(); return; }
  saveCurrentToProject();
  const proj = state.projects.find(p => p.id === state.activeProjectId);
  const sub  = proj?.submissions.find(s => s.id === submissionId);
  if (!sub) return;
  state.activeSubmissionId   = sub.id;
  state.activePlatforms      = new Set(sub.activePlatforms);
  state.platformStepStatus   = JSON.parse(JSON.stringify(sub.platformStepStatus));
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

function toggleSubmissionDropdown(e) {
  e.stopPropagation();
  const wrap = document.getElementById('submissionSelectorWrap');
  const isOpen = wrap.classList.contains('open');
  closeAllDropdowns();
  if (!isOpen) wrap.classList.add('open');
}

function toggleSubmissionMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('submissionMenu');
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


/* ── Delete Submission ───────────────────────────────── */

function deleteCurrentSubmission() {
  closeAllDropdowns();
  const proj = state.projects.find(p => p.id === state.activeProjectId);
  if (!proj) return;

  // Case 1: Only one submission — can't delete
  if (proj.submissions.length === 1) {
    openInfoModal(
      'Can\'t delete this submission',
      'This is the only submission for this project. Create a new submission first, then delete this one.'
    );
    return;
  }

  const sub = proj.submissions.find(s => s.id === state.activeSubmissionId);
  if (!sub) return;

  // Check if any platform has been submitted in this submission
  const hasSubmitted = Object.keys(PLATFORMS).some(
    pid => sub.platformStepStatus[pid]?.submit === 'complete'
  );

  // Check if any platform is active (in-progress but not submitted)
  const hasActivePlatforms = sub.activePlatforms && sub.activePlatforms.length > 0;

  if (hasSubmitted) {
    // Case 2: Submission has live store submissions
    openConfirmModal(
      'Delete submitted build?',
      `"${sub.name}" has been submitted to one or more stores. Deleting it removes all submission records — this won't unpublish anything already live.`,
      'Delete anyway',
      () => _deleteSubmission(proj, sub.id),
      true
    );
  } else if (hasActivePlatforms) {
    // Case 3: Active platforms but nothing submitted yet
    openConfirmModal(
      'Delete submission?',
      `Delete "${sub.name}"? Any progress on this submission will be lost.`,
      'Delete',
      () => _deleteSubmission(proj, sub.id),
      true
    );
  } else {
    // Empty submission — delete without ceremony
    _deleteSubmission(proj, sub.id);
  }
}

function _deleteSubmission(proj, subId) {
  proj.submissions = proj.submissions.filter(s => s.id !== subId);
  // Switch to the last remaining submission
  const newSub = proj.submissions[proj.submissions.length - 1];
  state.activeSubmissionId = newSub.id;
  state.activePlatforms    = new Set(newSub.activePlatforms);
  state.platformStepStatus = JSON.parse(JSON.stringify(newSub.platformStepStatus));
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

  // Check if any submission has live store submissions
  const hasSubmitted = proj.submissions.some(sub =>
    Object.keys(PLATFORMS).some(pid => sub.platformStepStatus[pid]?.submit === 'complete')
  );

  if (hasSubmitted) {
    openConfirmModal(
      'Delete project with live submissions?',
      `"${proj.name}" has active store submissions. All project data and submission records will be permanently deleted. This won't unpublish anything already live.`,
      'Delete project',
      () => _deleteProject(proj.id),
      true
    );
  } else {
    openConfirmModal(
      'Delete project?',
      `Delete "${proj.name}" and all its submissions? This cannot be undone.`,
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
  loadProjectAndSubmission(newProj.id, null);
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
    applyCQResults(result);
    state.cqInferenceStatus = 'done';
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
