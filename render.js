/* ============================================================
   RENDER — builds UI from state
   ============================================================ */

/* ── Sidebar ─────────────────────────────────────────── */

function renderSidebar() {
  const nav  = document.getElementById('checklist');
  const next = nextStep();
  let h = '';

  // Dashboard link
  const dashActive = state.currentScreen === 'home';
  h += `
    <div class="step-row ${dashActive ? 'is-active' : ''}" onclick="navigate('home')">
      <div class="step-circle" style="font-size:11px; border-color:#2e3e60; color:#3a5080;">⌂</div>
      <span class="step-label">Dashboard</span>
    </div>
    <div class="sidebar-divider" style="margin:4px 0 0;"></div>
    <div class="checklist-label">Submission Checklist</div>`;

  // Global steps
  let stepNum = 1;
  for (const step of visibleGlobalSteps()) {
    const status   = state.globalStepStatus[step.id];
    const isActive = state.currentScreen === step.screen;
    const isNext   = next?.type === 'global' && next.id === step.id;

    let circleClass   = '';
    let circleContent = stepNum;
    if (status === 'complete')    { circleClass = 'is-complete';    circleContent = '✓'; }
    if (status === 'in_progress') { circleClass = 'is-in-progress'; circleContent = stepNum; }

    h += `
      <div class="step-row ${isActive ? 'is-active' : ''} ${isNext ? 'is-next' : ''}"
           onclick="navigate('${step.screen}')">
        <div class="step-circle ${circleClass}">${circleContent}</div>
        <span class="step-label ${status === 'complete' ? 'is-complete' : ''}">${step.label}</span>
        ${isNext ? '<span class="next-badge">Next</span>' : ''}
      </div>`;
    stepNum++;
  }

  // Platform steps — unified, no divider
  for (const pid of state.selectedPlatforms) {
    const p = PLATFORMS[pid];
    const { complete, total, allRequired, submitDone } = platformStepCount(pid);
    const expanded = state.expandedPlatforms.has(pid);
    const isActive = state.currentScreen === pid;
    const allDone  = submitDone;
    const isNext   = next?.type === 'platform' && next.platformId === pid && !expanded;

    let circleContent = allDone
      ? '✓'
      : `<span style="font-size:7px;font-weight:800;">${p.abbr}</span>`;

    h += `
      <div class="step-row ${expanded ? 'is-expanded' : ''} ${isActive ? 'is-active' : ''} ${isNext ? 'is-next' : ''}"
           onclick="togglePlatformExpand('${pid}')">
        <div class="step-circle ${allDone ? 'is-complete' : ''}"
             style="${!allDone ? `border-color:${p.color}40; color:${p.color};` : ''}">${circleContent}</div>
        <span class="step-label ${allDone ? 'is-complete' : ''}">Submit to ${p.label}</span>
        ${complete > 0 && !allDone ? `<span class="step-count">${complete}/${total}</span>` : ''}
        ${isNext ? '<span class="next-badge">Next</span>' : ''}
        <span class="step-expand">›</span>
      </div>`;

    if (expanded) {
      h += `<div class="sub-steps is-open">`;
      for (const step of p.steps) {
        const s      = state.platformStepStatus[pid][step.id];
        const isSub  = next?.type === 'platform' && next.platformId === pid && next.id === step.id;
        h += `
          <div class="sub-step-row ${isSub && !step.isSubmit ? 'is-next-sub' : ''}"
               onclick="${step.isSubmit ? `navigate('${pid}')` : `openTask('${pid}','${step.id}')`}">
            <div class="sub-dot ${s === 'complete' ? 'is-complete' : ''}"></div>
            <span>${step.label}</span>
            ${isSub && !step.isSubmit ? '<span class="next-badge next-badge-sm">Next</span>' : ''}
          </div>`;
      }
      h += `</div>`;
    }
    stepNum++;
  }

  nav.innerHTML = h;

  const el = document.getElementById('sidebar-project-name');
  if (el) el.textContent = state.formData.title || 'Untitled Project';
}


/* ── Dashboard ───────────────────────────────────────── */

function renderDashboard() {
  renderNextUpBanner();
  renderPlatformGrid();
  renderTaskDrawer();
}

function renderNextUpBanner() {
  const container = document.getElementById('next-up-banner');
  if (!container) return;

  const next = nextStep();

  if (!next) {
    container.innerHTML = `
      <div class="next-up-banner next-up-done">
        <div class="next-up-icon">🎉</div>
        <div class="next-up-body">
          <div class="next-up-label">All done</div>
          <div class="next-up-title">Everything is submitted</div>
        </div>
      </div>`;
    return;
  }

  let title, desc, action;

  if (next.type === 'global') {
    const step = visibleGlobalSteps().find(s => s.id === next.id);
    title  = step.label;
    desc   = step.desc;
    action = `navigate('${step.screen}')`;
  } else {
    const p = PLATFORMS[next.platformId];
    title  = `${p.label} — ${next.label}`;
    desc   = '';
    action = `openTask('${next.platformId}','${next.id}')`;
  }

  container.innerHTML = `
    <div class="next-up-banner">
      <div class="next-up-icon">→</div>
      <div class="next-up-body">
        <div class="next-up-label">Suggested next</div>
        <div class="next-up-title">${title}</div>
        ${desc ? `<div class="next-up-desc">${desc}</div>` : ''}
      </div>
      <button class="btn btn-primary" onclick="${action}">Start →</button>
    </div>`;
}


/* ── Platform grid: cards with inline task lists ─────── */

function renderPlatformGrid() {
  const grid = document.getElementById('platform-grid');
  if (!grid) return;

  if (state.selectedPlatforms.size === 0) {
    grid.innerHTML = `
      <div class="no-platforms">
        <div class="no-platforms-text">No platforms selected yet.</div>
        <button class="btn btn-ghost btn-sm" onclick="navigate('provide-info')">
          Add platforms in Game Details →
        </button>
      </div>`;
    return;
  }

  let cards = '';

  for (const pid of state.selectedPlatforms) {
    const p        = PLATFORMS[pid];
    const statuses = state.platformStepStatus[pid];
    const { complete, total, allRequired, submitDone } = platformStepCount(pid);
    const pct      = total > 0 ? Math.round(complete / total * 100) : 0;

    let statusLabel = 'Not started';
    if (submitDone)        statusLabel = 'Submitted';
    else if (allRequired)  statusLabel = 'Ready to submit';
    else if (complete > 0) statusLabel = `${complete} of ${total} required`;

    // Build task rows
    let taskRows = '';
    const required = p.steps.filter(s => !s.isSubmit);
    const submitStep = p.steps.find(s => s.isSubmit);

    for (const step of required) {
      const isDone   = statuses[step.id] === 'complete';
      const isActive = state.activeTask?.platformId === pid && state.activeTask?.stepId === step.id;
      taskRows += `
        <div class="card-task ${isDone ? 'is-done' : ''} ${isActive ? 'is-active-task' : ''}"
             onclick="openTask('${pid}','${step.id}')">
          <div class="task-dot ${isDone ? 'is-complete' : ''}"></div>
          <span class="task-label">${step.label}</span>
          <span class="task-arrow">›</span>
        </div>`;
    }

    // Submit row
    if (submitStep) {
      const submitStatus = statuses[submitStep.id];
      const isActive     = state.activeTask?.platformId === pid && state.activeTask?.stepId === submitStep.id;

      if (allRequired || submitDone) {
        // Unlocked
        taskRows += `
          <div class="card-task card-task-submit ${submitDone ? 'is-done' : ''} ${isActive ? 'is-active-task' : ''}"
               onclick="openTask('${pid}','${submitStep.id}')">
            <div class="task-dot ${submitDone ? 'is-complete' : 'is-submit'}"></div>
            <span class="task-label">${submitStep.label}</span>
            <span class="task-arrow">›</span>
          </div>`;
      } else {
        // Locked
        taskRows += `
          <div class="card-task card-task-locked" title="${total - complete} required task${total - complete !== 1 ? 's' : ''} remaining">
            <div class="task-dot is-locked"></div>
            <span class="task-label">${submitStep.label}</span>
            <span class="task-lock">🔒</span>
          </div>`;
      }
    }

    cards += `
      <div class="platform-card">
        <div class="card-head">
          <div class="card-abbr" style="background:${p.color};">${p.abbr}</div>
          <div>
            <div class="card-name">${p.label}</div>
            <div class="card-status-label">${statusLabel}</div>
          </div>
        </div>
        <div class="card-bar-wrap">
          <div class="card-bar"><div class="card-bar-fill" style="width:${pct}%; background:${p.color};"></div></div>
        </div>
        <div class="card-tasks">${taskRows}</div>
      </div>`;
  }

  grid.innerHTML = `<div class="platform-cards-grid">${cards}</div>`;
}


/* ── Task drawer ─────────────────────────────────────── */

function renderTaskDrawer() {
  const drawer = document.getElementById('task-drawer');
  if (!drawer) return;

  if (!state.activeTask) {
    drawer.className = 'task-drawer';
    drawer.innerHTML = '';
    return;
  }

  const { platformId, stepId } = state.activeTask;
  const p    = PLATFORMS[platformId];
  const step = p.steps.find(s => s.id === stepId);
  if (!p || !step) { state.activeTask = null; drawer.innerHTML = ''; return; }

  const isDone = state.platformStepStatus[platformId][stepId] === 'complete';

  drawer.className = 'task-drawer is-open';
  drawer.innerHTML = `
    <div class="drawer-header" style="border-top-color: ${p.color};">
      <div class="drawer-context">
        <div class="drawer-platform-badge" style="background:${p.color};">${p.abbr}</div>
        <span class="drawer-task-name">${step.label}</span>
      </div>
      <div class="drawer-actions">
        ${!isDone && !step.isSubmit
          ? `<button class="btn btn-primary btn-sm" onclick="markTaskDone('${platformId}','${stepId}')">Mark complete</button>`
          : isDone
          ? `<button class="btn btn-ghost btn-sm" onclick="markTaskUndone('${platformId}','${stepId}')">Mark incomplete</button>`
          : ''}
        <button class="drawer-close" onclick="closeTask()">×</button>
      </div>
    </div>
    <div class="drawer-body">
      <p class="drawer-stub">🚧 ${step.label} task UI — coming soon</p>
    </div>`;
}


/* ── Upload Assets ───────────────────────────────────── */

const UPLOAD_REQS = {
  ios:     { abbr: 'iOS', color: '#007AFF', min: 2, desc: '2–10 screenshots per device size' },
  android: { abbr: 'GP',  color: '#34A853', min: 2, desc: '2–8 screenshots + 1 feature graphic' },
  steam:   { abbr: 'ST',  color: '#4c6b8a', min: 5, desc: 'At least 5 screenshots' },
  egs:     { abbr: 'EGS', color: '#2d2d2d', min: 3, desc: '3–10 screenshots' },
};

function renderUploadScreen() {
  // Show/hide Feature Graphic section (Android only)
  const featureSection = document.getElementById('feature-graphic-section');
  if (featureSection) {
    featureSection.style.display = state.selectedPlatforms.has('android') ? 'block' : 'none';
  }
  // Restore trailer URL field
  const trailerUrlEl = document.getElementById('trailer-url');
  if (trailerUrlEl) trailerUrlEl.value = state.formData.trailerUrl || '';
  // Restore trailer file info
  if (state.uploads.trailer) {
    const info = document.getElementById('trailer-file-info');
    if (info) {
      const mb = (state.uploads.trailer.size / 1024 / 1024).toFixed(1);
      info.style.display = 'block';
      info.innerHTML = `
        <div class="trailer-file-row">
          <span class="trailer-file-name">🎬 ${state.uploads.trailer.name}</span>
          <span class="trailer-file-size">${mb} MB</span>
          <button class="btn btn-ghost btn-sm" onclick="removeTrailer()">Remove</button>
        </div>`;
    }
  }
  renderUploadRequirements();
  renderScreenshotGrid();
  renderFeaturePreview();
}

function renderUploadRequirements() {
  const container = document.getElementById('upload-requirements');
  if (!container) return;

  if (state.selectedPlatforms.size === 0) {
    container.innerHTML = `
      <div class="upload-reqs-empty">
        No platforms selected. <a onclick="navigate('provide-info')" style="cursor:pointer;color:#4a9eff;">Add platforms →</a>
      </div>`;
    return;
  }

  const count = state.uploads.screenshots.length;
  let h = '<div class="upload-reqs">';
  for (const pid of state.selectedPlatforms) {
    const req = UPLOAD_REQS[pid];
    const met = count >= req.min;
    h += `
      <div class="upload-req-row">
        <div class="upload-req-badge" style="background:${req.color};">${req.abbr}</div>
        <span class="upload-req-label">${req.desc}</span>
        <span class="upload-req-status ${met ? 'is-met' : ''}">${met ? '✓' : `${count}/${req.min}`}</span>
      </div>`;
  }
  h += '</div>';
  container.innerHTML = h;
}

function renderScreenshotGrid() {
  const grid = document.getElementById('screenshot-grid');
  if (!grid) return;

  if (state.uploads.screenshots.length === 0) {
    grid.innerHTML = '';
    return;
  }

  let h = '';
  for (const shot of state.uploads.screenshots) {
    h += `
      <div class="asset-thumb">
        <img src="${shot.dataUrl}" alt="${shot.name}">
        <button class="asset-remove" onclick="removeScreenshot('${shot.id}')" title="Remove">×</button>
        <div class="asset-name">${shot.name}</div>
      </div>`;
  }
  grid.innerHTML = h;
}

function renderFeaturePreview() {
  const preview = document.getElementById('feature-preview');
  if (!preview) return;

  if (!state.uploads.featureGraphic) {
    preview.innerHTML = '';
    const dz = document.getElementById('feature-dropzone');
    if (dz) dz.style.display = '';
    return;
  }

  const fg = state.uploads.featureGraphic;
  const dz = document.getElementById('feature-dropzone');
  if (dz) dz.style.display = 'none';

  preview.innerHTML = `
    <div class="feature-preview-wrap">
      <img src="${fg.dataUrl}" alt="${fg.name}" class="feature-img">
      <div class="feature-preview-meta">
        <span class="feature-preview-name">${fg.name}</span>
        <button class="btn btn-ghost btn-sm" onclick="removeFeatureGraphic()">Replace</button>
      </div>
    </div>`;
}


/* ── Key Questions ───────────────────────────────────── */

function renderKeyQuestionsScreen() {
  const container = document.getElementById('questions-list');
  if (!container) return;

  let h = '';
  for (const q of QUESTIONS) {
    const answer   = state.questionAnswers[q.id];
    const inferred = state.questionInferred[q.id];
    const answered = answer !== null;

    h += `
      <div class="question-card ${answered ? 'is-answered' : ''}">
        <div class="question-text">${q.label}</div>
        <div class="question-desc">${q.desc}</div>`;

    if (inferred && answered) {
      // Auto-detected — show badge + answer + Change button
      h += `
        <div class="question-inferred">
          <span class="inferred-badge">Detected</span>
          <span class="inferred-answer">${answer === 'yes' ? 'Yes' : 'No'}</span>
          <button class="btn btn-ghost btn-sm" onclick="changeInferredAnswer('${q.id}')">Change</button>
        </div>`;
    } else {
      // User picks Yes / No
      h += `
        <div class="question-toggles">
          <button class="yn-btn ${answer === 'yes' ? 'is-yes' : ''}" onclick="answerQuestion('${q.id}', 'yes')">Yes</button>
          <button class="yn-btn ${answer === 'no'  ? 'is-no'  : ''}" onclick="answerQuestion('${q.id}', 'no')">No</button>
        </div>`;
    }

    h += `</div>`;
  }

  container.innerHTML = h;
}


/* ── Provide Information: populate form ──────────────── */

function renderPlatformToggles() {
  const container = document.getElementById('platform-toggles');
  if (!container) return;

  const icon = (id) => `
    <svg class="ptc-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="${PLATFORM_ICONS[id]}"/>
    </svg>`;

  let h = '';

  // Active platforms
  for (const [pid, p] of Object.entries(PLATFORMS)) {
    const selected = state.selectedPlatforms.has(pid);
    h += `
      <button class="platform-toggle-btn ${selected ? 'is-selected' : ''}"
              onclick="togglePlatform('${pid}')">
        ${icon(pid)}
        <span class="ptc-name">${p.label}</span>
        ${selected ? `<span class="ptc-tick">✓</span>` : ''}
      </button>`;
  }

  // Coming Soon platforms
  for (const p of COMING_SOON_PLATFORMS) {
    h += `
      <button class="platform-toggle-btn is-coming-soon" disabled>
        ${icon(p.id)}
        <span class="ptc-name">${p.label}</span>
        <span class="ptc-coming-soon">Soon</span>
      </button>`;
  }

  container.innerHTML = h;
}

function populateProvideInfoForm() {
  const fd = state.formData;
  const $  = id => document.getElementById(id);

  if ($('f-title'))   $('f-title').value   = fd.title;
  if ($('f-desc'))    $('f-desc').value    = fd.description;
  if ($('f-price'))   $('f-price').value   = fd.price;
  if ($('f-support')) $('f-support').value = fd.supportUrl;
  if ($('f-privacy')) $('f-privacy').value = fd.privacyUrl;
  if ($('f-lang'))    $('f-lang').value    = fd.primaryLanguage;
  if ($('f-date'))    $('f-date').value    = fd.releaseDate;

  charCount('f-title-count', fd.title, 30);
  charCount('f-desc-count',  fd.description, 4000);

  document.querySelectorAll('[name="release"]').forEach(radio => {
    radio.checked = radio.value === fd.releaseTiming;
  });
  const dateRow = $('release-date-row');
  if (dateRow) dateRow.style.display = fd.releaseTiming === 'specific_date' ? 'block' : 'none';

  const privCheck = $('privacy-gen-check');
  const privNote  = $('privacy-gen-note');
  if (privCheck) privCheck.checked = !!fd.privacyGenerated;
  if (privNote)  privNote.style.display = fd.privacyGenerated ? 'block' : 'none';

  const toggle = $('locale-toggle');
  const picker = $('lang-picker');
  if (toggle) toggle.classList.toggle('is-on', fd.localized);
  if (picker) picker.classList.toggle('is-open', fd.localized);
  document.querySelectorAll('.lang-chip').forEach(chip => {
    const match = chip.getAttribute('onclick').match(/'([^']+)'\)/);
    const code  = match ? match[1] : null;
    if (code) chip.classList.toggle('is-on', fd.localizations.includes(code));
  });

  renderPlatformToggles();
}
