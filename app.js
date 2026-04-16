/* ============================================================
   APP — navigation, events, init
   ============================================================ */

/* ── Router ──────────────────────────────────────────── */

function navigate(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('is-active'));
  const target = document.getElementById('screen-' + screenId);
  if (target) target.classList.add('is-active');

  state.currentScreen = screenId;
  window.location.hash = screenId;

  if (screenId === 'provide-info')   populateProvideInfoForm();
  if (screenId === 'home')           renderDashboard();
  if (screenId === 'upload-assets')  renderUploadScreen();
  if (screenId === 'key-questions')  { computeInferences(); renderKeyQuestionsScreen(); }

  renderSidebar();
}


/* ── Platform selection ──────────────────────────────── */

function togglePlatform(platformId) {
  if (state.selectedPlatforms.has(platformId)) {
    state.selectedPlatforms.delete(platformId);
    state.expandedPlatforms.delete(platformId);
    if (state.activeDashboardCard === platformId) state.activeDashboardCard = null;
  } else {
    state.selectedPlatforms.add(platformId);
  }
  renderPlatformToggles();  // re-render toggles on Provide Info screen
  renderSidebar();
}

function togglePlatformExpand(platformId) {
  if (state.expandedPlatforms.has(platformId)) {
    state.expandedPlatforms.delete(platformId);
  } else {
    state.expandedPlatforms.add(platformId);
  }
  renderSidebar();
}

// Task drawer
function openTask(platformId, stepId) {
  const already = state.activeTask?.platformId === platformId && state.activeTask?.stepId === stepId;
  state.activeTask = already ? null : { platformId, stepId };
  renderPlatformGrid();   // updates active-task highlight on card row
  renderTaskDrawer();
  if (!already) {
    // Scroll drawer into view smoothly
    setTimeout(() => {
      const drawer = document.getElementById('task-drawer');
      if (drawer) drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }
}

function closeTask() {
  state.activeTask = null;
  renderPlatformGrid();
  renderTaskDrawer();
}

// Mark a task complete/incomplete (prototype shortcut; real flow will happen within drawer UI)
function markTaskDone(platformId, stepId) {
  state.platformStepStatus[platformId][stepId] = 'complete';
  renderPlatformGrid();
  renderTaskDrawer();
  renderSidebar();
  renderNextUpBanner();
}

function markTaskUndone(platformId, stepId) {
  state.platformStepStatus[platformId][stepId] = 'not_started';
  renderPlatformGrid();
  renderTaskDrawer();
  renderSidebar();
  renderNextUpBanner();
}


/* ── Form helpers ────────────────────────────────────── */

function syncField(field, value) {
  state.formData[field] = value;
  if (field === 'title') {
    const sidebarEl = document.getElementById('sidebar-project-name');
    if (sidebarEl) sidebarEl.textContent = value || 'Untitled Project';
    const topbarEl  = document.querySelector('#screen-home .topbar-title');
    if (topbarEl)  topbarEl.textContent  = value || 'Go Ape Ship!';
  }
}

function charCount(countId, value, max) {
  const el = document.getElementById(countId);
  if (!el) return;
  const len = (value || '').length;
  // Preserve inner .char-note span if present
  const note = el.querySelector('.char-note');
  el.textContent = `${len} / ${max} `;
  if (note) el.appendChild(note);
  el.className = 'char-count';
  if (len > max * 0.9) el.classList.add('is-warn');
  if (len > max)       el.classList.add('is-over');
}

function toggleLocalization() {
  state.formData.localized = !state.formData.localized;
  document.getElementById('locale-toggle').classList.toggle('is-on', state.formData.localized);
  document.getElementById('lang-picker').classList.toggle('is-open', state.formData.localized);
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
  const dateRow = document.getElementById('release-date-row');
  if (dateRow) dateRow.style.display = radio.value === 'specific_date' ? 'block' : 'none';
}

function togglePrivacyGen(checkbox) {
  state.formData.privacyGenerated = checkbox.checked;
  const note = document.getElementById('privacy-gen-note');
  if (note) note.style.display = checkbox.checked ? 'block' : 'none';
  // URL field stays enabled — dev still needs to paste the hosted URL
}


/* ── Upload Assets ───────────────────────────────────── */

function handleScreenshotDrop(e) {
  e.preventDefault();
  handleScreenshotFiles(e.dataTransfer.files);
}

function handleScreenshotFiles(files) {
  Array.from(files).forEach(file => {
    if (!file.type.startsWith('image/')) return;
    const id = 'ss_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const reader = new FileReader();
    reader.onload = ev => {
      state.uploads.screenshots.push({ id, name: file.name, dataUrl: ev.target.result });
      renderScreenshotGrid();
      renderUploadRequirements();
    };
    reader.readAsDataURL(file);
  });
}

function removeScreenshot(id) {
  state.uploads.screenshots = state.uploads.screenshots.filter(s => s.id !== id);
  renderScreenshotGrid();
  renderUploadRequirements();
}

function handleFeatureDrop(e) {
  e.preventDefault();
  handleFeatureFiles(e.dataTransfer.files);
}

function handleFeatureFiles(files) {
  const file = files[0];
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = ev => {
    state.uploads.featureGraphic = { name: file.name, dataUrl: ev.target.result };
    renderFeaturePreview();
  };
  reader.readAsDataURL(file);
}

function removeFeatureGraphic() {
  state.uploads.featureGraphic = null;
  renderFeaturePreview();
}

function handleTrailerDrop(e) {
  e.preventDefault();
  handleTrailerFiles(e.dataTransfer.files);
}

function handleTrailerFiles(files) {
  const file = files[0];
  if (!file) return;
  state.uploads.trailer = { name: file.name, size: file.size };
  const info = document.getElementById('trailer-file-info');
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
  const info = document.getElementById('trailer-file-info');
  if (info) { info.style.display = 'none'; info.innerHTML = ''; }
}


/* ── Key Questions ───────────────────────────────────── */

function computeInferences() {
  const text = (state.formData.description + ' ' + state.formData.title).toLowerCase();
  for (const q of QUESTIONS) {
    // Only auto-infer for still-unanswered questions
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
  renderKeyQuestionsScreen();
}

function changeInferredAnswer(key) {
  state.questionInferred[key] = false;
  state.questionAnswers[key]  = null;
  renderKeyQuestionsScreen();
}


/* ── Step completion ─────────────────────────────────── */

function saveAndContinue(stepId, nextScreen) {
  state.globalStepStatus[stepId] = 'complete';
  navigate(nextScreen);
}

function saveDraft(stepId) {
  if (state.globalStepStatus[stepId] === 'not_started') {
    state.globalStepStatus[stepId] = 'in_progress';
  }
  navigate('home');
}


/* ── Init ────────────────────────────────────────────── */

function init() {
  const hash = window.location.hash.replace('#', '') || 'home';
  navigate(hash);
}

window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '');
  if (hash && hash !== state.currentScreen) navigate(hash);
});

init();
