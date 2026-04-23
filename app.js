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
  }
}

function prevOnboardingTab() {
  if (state.onboardingTab > 0) {
    state.onboardingTab--;
    renderOnboarding();
  }
}

function completeOnboarding() {
  if (!state.formData.title.trim()) {
    alert('Please enter your game title before continuing.');
    setOnboardingTab(0);
    return;
  }
  state.onboardingComplete = true;
  computeInferences();
  showMainApp();
}


/* ── Task modal ──────────────────────────────────────── */

function openTaskModal(platformId, stepId) {
  // Intercept submit steps → open content review modal instead
  const step = PLATFORMS[platformId].steps.find(s => s.id === stepId);
  if (step && step.isSubmit) {
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
  renderDashboard();
}

function taskOverlayClick(e) {
  if (e.target === document.getElementById('task-overlay')) {
    closeTaskModal();
  }
}

function markTaskDone(platformId, stepId) {
  state.platformStepStatus[platformId][stepId] = 'complete';
  closeTaskModal();
}

function markTaskUndone(platformId, stepId) {
  state.platformStepStatus[platformId][stepId] = 'not_started';
  closeTaskModal();
}


/* ── Submit (Content Review) Modal ───────────────────── */

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

function confirmAndSubmit(platformId) {
  state.platformStepStatus[platformId]['submit'] = 'complete';
  closeSubmitModal();
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
    const nameEl = document.getElementById('app-game-name');
    if (nameEl) nameEl.textContent = value || '—';
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
      <div style="font-size:24px;margin-bottom:6px;">🎮</div>
      <div style="font-size:11px;font-weight:600;color:#888;">Drop icon</div>
      <div style="font-size:10px;color:#bbb;margin-top:2px;">1024×1024</div>`;
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
