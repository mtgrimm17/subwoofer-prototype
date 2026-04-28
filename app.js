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
  computeInferences();

  if (state._newProjectMode) {
    // Creating a 2nd+ project
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
    state.activePlatforms    = new Set();
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
    state.activePlatforms    = new Set();
    state.platformStepStatus = makeEmptyPlatformSteps();
  }

  state.onboardingComplete = true;
  showMainApp();
}


/* ── Task modal ──────────────────────────────────────── */

function openTaskModal(platformId, stepId) {
  // Intercept submit/review steps → open content review modal instead
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


/* ── Submit (Content Review) Modal ───────────────────── */

function openSubmitModal(platformId) {
  state.submitModal.platformId = platformId;
  // For iOS, seed answers from onboarding where available (only if not yet set)
  if (platformId === 'ios') {
    state.submitModal.expanded = [];
    if (!state.iosSubmitAnswers.privacyPolicyUrl && state.formData.privacyUrl) {
      state.iosSubmitAnswers.privacyPolicyUrl = state.formData.privacyUrl;
    }
    if (state.iosSubmitAnswers.hasIAP === null && state.questionAnswers.inAppPurchases !== null) {
      state.iosSubmitAnswers.hasIAP = state.questionAnswers.inAppPurchases;
    }
  } else {
    state.submitModal.expanded = [];
  }
  renderSubmitModal();
  document.getElementById('submit-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeSubmitModal() {
  document.getElementById('submit-overlay').classList.add('hidden');
  document.body.style.overflow = '';
}

function submitOverlayClick(e) {
  if (e.target === document.getElementById('submit-overlay')) closeSubmitModal();
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
  const el = document.getElementById('ios-sec-' + sectionId);
  if (el) el.classList.toggle('is-expanded', state.submitModal.expanded.includes(sectionId));
}

/* ── iOS Submit Modal — answer handlers ──────────────── */

// Full re-render of the scroll area with scroll-position preservation
function reRenderIOSSubmitModal() {
  const scrollEl = document.getElementById('ios-submit-scroll');
  const scrollTop = scrollEl ? scrollEl.scrollTop : 0;

  if (scrollEl) scrollEl.innerHTML = buildIOSScrollContent();

  // Update footer button state
  const footer = document.querySelector('#submit-overlay .submit-modal-footer');
  if (footer) {
    const incomplete = IOS_SECTIONS.filter(s => !isIOSSectionComplete(s.id));
    const allComplete = incomplete.length === 0;
    const btn = footer.querySelector('.submit-confirm-btn');
    if (btn) {
      btn.textContent = allComplete ? 'Confirm & Submit →'
        : `${incomplete.length} section${incomplete.length > 1 ? 's' : ''} incomplete`;
      btn.classList.toggle('is-ios-incomplete', !allComplete);
      btn.setAttribute('onclick', allComplete ? "confirmAndSubmit('ios')" : '');
    }
  }

  // Restore scroll position
  const newScrollEl = document.getElementById('ios-submit-scroll');
  if (newScrollEl) newScrollEl.scrollTop = scrollTop;

  positionTooltips();
}

/* ── Tooltip edge-detection positioning ──────────────── */
function positionTooltips() {
  const container = document.getElementById('ios-submit-scroll') || document.getElementById('submit-overlay');
  if (!container) return;

  container.querySelectorAll('.tooltip-anchor').forEach(anchor => {
    const body = anchor.querySelector('.tooltip-body');
    if (!body) return;

    // Reset inline overrides
    body.style.cssText = '';

    anchor.addEventListener('mouseenter', () => {
      // Reset
      body.style.left = '';
      body.style.right = '';
      body.style.top = '';
      body.style.bottom = '';
      body.style.transform = '';

      const aRect  = anchor.getBoundingClientRect();
      const cRect  = container.getBoundingClientRect();
      const tipW   = 230;
      const tipH   = body.offsetHeight || 90;

      // Horizontal: default is centered on icon
      const centeredLeft = aRect.left + aRect.width / 2 - tipW / 2;
      if (centeredLeft < cRect.left + 8) {
        // Would overflow left — align left edge with anchor
        body.style.left = '0';
        body.style.transform = 'none';
      } else if (centeredLeft + tipW > cRect.right - 8) {
        // Would overflow right — align right edge with anchor
        body.style.left  = 'auto';
        body.style.right = '0';
        body.style.transform = 'none';
      }

      // Vertical: default is above; if near top of container, show below
      if (aRect.top - tipH - 10 < cRect.top + 8) {
        body.style.bottom = 'auto';
        body.style.top    = 'calc(100% + 10px)';
      }
    }, { capture: false });
  });
}

// Called by YES/NO and intensity/chip clicks — re-renders immediately
function answerIOSField(field, value) {
  state.iosSubmitAnswers[field] = value;
  reRenderIOSSubmitModal();
}

// Called by text oninput — updates state only, no re-render (prevents cursor jumping)
function updateIOSTextField(field, value) {
  state.iosSubmitAnswers[field] = value;
}

function toggleIOSDataType(typeId) {
  const types = state.iosSubmitAnswers.dataTypes;
  const idx = types.indexOf(typeId);
  if (idx === -1) types.push(typeId); else types.splice(idx, 1);
  reRenderIOSSubmitModal();
}

function toggleIOSIAPType(typeId) {
  const types = state.iosSubmitAnswers.iapTypes;
  const idx = types.indexOf(typeId);
  if (idx === -1) types.push(typeId); else types.splice(idx, 1);
  reRenderIOSSubmitModal();
}

function setIOSAllRegions(bool) {
  state.iosSubmitAnswers.allRegions = bool;
  if (bool) state.iosSubmitAnswers.selectedRegions = [];
  reRenderIOSSubmitModal();
}

function toggleIOSRegion(code) {
  const regions = state.iosSubmitAnswers.selectedRegions;
  const idx = regions.indexOf(code);
  if (idx === -1) regions.push(code); else regions.splice(idx, 1);
  reRenderIOSSubmitModal();
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

function activatePlatform(platformId) {
  state.activePlatforms.add(platformId);
  renderDashboard();
}

function deactivatePlatform(platformId) {
  state.activePlatforms.delete(platformId);
  renderDashboard();
}


/* ── Form helpers ────────────────────────────────────── */

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

function toggleLocalization() {
  state.formData.localized = !state.formData.localized;
  const toggle = document.getElementById('ob-locale-toggle');
  const picker = document.getElementById('ob-lang-picker');
  if (toggle) toggle.classList.toggle('is-on', state.formData.localized);
  if (picker) picker.classList.toggle('is-open', state.formData.localized);
  if (!state.formData.localized) {
    state.formData.localizations = [];
    document.querySelectorAll('.lang-chip').forEach(c => c.classList.remove('is-on'));
  }
}

function toggleLang(el, code) {
  const idx = state.formData.localizations.indexOf(code);
  if (idx === -1) { state.formData.localizations.push(code); el.classList.add('is-on'); }
  else            { state.formData.localizations.splice(idx, 1); el.classList.remove('is-on'); }
}

function pickTiming(radio) {
  state.formData.releaseTiming = radio.value;
  const dateRow = document.getElementById('ob-release-date-row');
  if (dateRow) dateRow.style.display = radio.value === 'specific_date' ? 'block' : 'none';
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
