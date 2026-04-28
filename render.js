/* ============================================================
   RENDER — pure functions that build UI from state
   ============================================================ */

/* ── Shared: platform icon SVG ───────────────────────── */

// Icons that use multi-subpath "cutout" designs need evenodd winding rule.
// iOS and PSN are solid compound paths — nonzero (default) renders them correctly.
const EVENODD_ICONS = new Set(['android', 'steam', 'egs', 'xbox', 'nintendo']);

function platformIcon(id, size = 20) {
  const fillRule = EVENODD_ICONS.has(id) ? ' fill-rule="evenodd" clip-rule="evenodd"' : '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"${fillRule} aria-hidden="true"><path d="${PLATFORM_ICONS[id]}"/></svg>`;
}


/* ── Onboarding ──────────────────────────────────────── */

function renderOnboarding() {
  renderOnboardingTabs();
  renderOnboardingBody();
  renderOnboardingFooter();
}

function renderOnboardingTabs() {
  const tabs = document.querySelectorAll('.ob-tab');
  tabs.forEach((t, i) => t.classList.toggle('is-active', i === state.onboardingTab));
}

function renderOnboardingBody() {
  const el = document.getElementById('ob-body');
  if (!el) return;
  if (state.onboardingTab === 0) { el.innerHTML = buildGameDetailsTab(); requestAnimationFrame(() => initWorldMap()); }
  if (state.onboardingTab === 1) el.innerHTML = buildUploadAssetsTab();
  if (state.onboardingTab === 2) el.innerHTML = buildComplianceTab();
  // After rendering, hydrate form fields from state
  hydrateGameDetailsTab();
  hydrateUploadAssetsTab();
  renderOnboardingScreenshotGrid();
  renderOnboardingFeaturePreview();
  hydrateComplianceTab();
}

function renderOnboardingFooter() {
  const el = document.getElementById('ob-footer');
  if (!el) return;
  const isLast  = state.onboardingTab === 2;
  const isFirst = state.onboardingTab === 0;
  el.innerHTML = `
    <div class="ob-footer-inner">
      <button class="btn btn-ghost" onclick="prevOnboardingTab()" ${isFirst ? 'style="visibility:hidden"' : ''}>← Back</button>
      <div class="ob-step-dots">
        ${[0,1,2].map(i => `<span class="ob-dot ${i === state.onboardingTab ? 'is-active' : (i < state.onboardingTab ? 'is-done' : '')}"></span>`).join('')}
      </div>
      <button class="btn btn-primary" onclick="${isLast ? 'completeOnboarding()' : 'nextOnboardingTab()'}">
        ${isLast ? 'Select Platforms →' : 'Next →'}
      </button>
    </div>`;
}

/* Tab 1: Game Details */
function buildGameDetailsTab() {
  return `
    <div class="ob-form">
      <div class="ob-section-label">About your game</div>

      <div class="form-group">
        <label class="form-label" for="ob-title">Game Title</label>
        <input class="form-input" id="ob-title" type="text" maxlength="50"
               placeholder="e.g. Go Ape Ship!"
               oninput="syncField('title', this.value); charCount('ob-title-count', this.value, 30)">
        <div class="char-count" id="ob-title-count">0 / 30</div>
      </div>

      <div class="form-group">
        <label class="form-label" for="ob-desc">Description</label>
        <textarea class="form-input" id="ob-desc" rows="5"
                  placeholder="Tell players what makes your game worth their time..."
                  oninput="syncField('description', this.value); charCount('ob-desc-count', this.value, 4000)"></textarea>
        <div class="char-count" id="ob-desc-count">0 / 4000</div>
      </div>

      <div class="form-group">
        <label class="form-label" for="ob-price">
          Price (USD)
          <span class="tooltip-anchor">
            <span class="tooltip-icon">?</span>
            <span class="tooltip-body">Set your base price once. Subwoofer will automatically convert and localize it across every platform and region where you launch — no per-store pricing setup required.</span>
          </span>
        </label>
        <input class="form-input" id="ob-price" type="text" placeholder="4.99 (or 0 for free)"
               oninput="syncField('price', this.value)">
      </div>

      <div class="ob-section-label" style="margin-top:20px;">Localization</div>
      <div class="world-map-desc">This map shows the global coverage of your supported languages.</div>
      <div id="world-map-container" class="world-map-container"></div>
      <div class="form-group" style="margin-top:12px;">
        <label class="form-label" for="ob-lang">Primary Language</label>
        <select class="form-input" id="ob-lang" onchange="syncField('primaryLanguage', this.value); updateWorldMap()">
          <option value="en">English</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="es">Spanish</option>
          <option value="pt">Portuguese</option>
          <option value="it">Italian</option>
          <option value="ja">Japanese</option>
          <option value="zh">Chinese (Simplified)</option>
          <option value="ko">Korean</option>
          <option value="ru">Russian</option>
          <option value="ar">Arabic</option>
        </select>
      </div>
      <div class="form-label" style="margin-bottom:8px;">Additional languages</div>
      <div class="lang-chips" id="ob-lang-chips">
        <button class="lang-chip" onclick="toggleLang(this,'fr')">French</button>
        <button class="lang-chip" onclick="toggleLang(this,'de')">German</button>
        <button class="lang-chip" onclick="toggleLang(this,'es')">Spanish</button>
        <button class="lang-chip" onclick="toggleLang(this,'pt')">Portuguese</button>
        <button class="lang-chip" onclick="toggleLang(this,'it')">Italian</button>
        <button class="lang-chip" onclick="toggleLang(this,'ja')">Japanese</button>
        <button class="lang-chip" onclick="toggleLang(this,'zh')">Chinese (Simplified)</button>
        <button class="lang-chip" onclick="toggleLang(this,'ko')">Korean</button>
        <button class="lang-chip" onclick="toggleLang(this,'ru')">Russian</button>
        <button class="lang-chip" onclick="toggleLang(this,'ar')">Arabic</button>
      </div>

      <div class="ob-section-label" style="margin-top:20px;">Release Timing</div>
      <div class="option-cards" id="ob-release-timing">
        <label class="option-card">
          <input type="radio" name="ob-release" value="manual" onchange="pickTiming(this)">
          <div>
            <div class="option-card-title">I'll release manually</div>
            <div class="option-card-desc">You control when each platform goes live after approval.</div>
          </div>
        </label>
        <label class="option-card">
          <input type="radio" name="ob-release" value="as_approved" onchange="pickTiming(this)">
          <div>
            <div class="option-card-title">As soon as approved</div>
            <div class="option-card-desc">Each platform goes live automatically once it passes review.</div>
          </div>
        </label>
        <label class="option-card">
          <input type="radio" name="ob-release" value="specific_date" onchange="pickTiming(this)">
          <div>
            <div class="option-card-title">On a specific date</div>
            <div class="option-card-desc">All platforms launch on the same day.</div>
          </div>
        </label>
      </div>
      <div id="ob-release-date-row" class="form-group" style="display:none;margin-top:10px;">
        <label class="form-label" for="ob-date">Target Release Date</label>
        <input class="form-input" id="ob-date" type="date" oninput="syncField('releaseDate', this.value)">
      </div>
    </div>`;
}

/* Tab 2: Upload Assets */
function buildUploadAssetsTab() {
  const hasAndroid = state.activePlatforms.has('android');
  return `
    <div class="ob-form">
      <div class="ob-section-label">App Icon</div>
      <div class="asset-guidance">Required for all platforms. Upload without rounded corners — stores apply their own shape automatically.</div>
      <div class="asset-dropzone" id="ob-icon-dropzone"
           onclick="document.getElementById('ob-icon-input').click()"
           ondragover="event.preventDefault(); this.classList.add('is-over')"
           ondragleave="this.classList.remove('is-over')"
           ondrop="handleIconDrop(event)">
        <div id="ob-icon-preview">
          <div class="asset-dropzone-icon">↑</div>
          <div class="asset-dropzone-label">Drop icon here, or click to browse</div>
          <div class="asset-dropzone-hint">PNG · 1024×1024</div>
        </div>
        <input type="file" id="ob-icon-input" accept="image/*" style="display:none"
               onchange="handleIconFiles(this.files); this.value=''">
      </div>

      <div class="ob-section-label" style="margin-top:24px;">Screenshots</div>
      <div class="asset-guidance">Upload multiple. Stores will crop and adapt them to their required dimensions automatically.</div>
      <div class="asset-dropzone" id="ob-screenshot-dropzone"
           onclick="document.getElementById('ob-screenshot-input').click()"
           ondragover="event.preventDefault(); this.classList.add('is-over')"
           ondragleave="this.classList.remove('is-over')"
           ondrop="handleScreenshotDrop(event); this.classList.remove('is-over')">
        <div class="asset-dropzone-icon">↑</div>
        <div class="asset-dropzone-label">Drop screenshots here, or click to browse</div>
        <div class="asset-dropzone-hint">PNG or JPG · Multiple files accepted</div>
        <input type="file" id="ob-screenshot-input" multiple accept="image/*" style="display:none"
               onchange="handleScreenshotFiles(this.files); this.value=''">
      </div>
      <div class="asset-grid" id="ob-screenshot-grid"></div>

      ${hasAndroid ? `
      <div class="ob-section-label" style="margin-top:24px;">
        Feature Graphic
        <span class="platform-req-badge">Google Play</span>
      </div>
      <div class="asset-guidance">Required for Google Play listings. Used as the hero image at the top of your store page.</div>
      <div class="asset-dropzone" id="ob-feature-dropzone"
           onclick="document.getElementById('ob-feature-input').click()"
           ondragover="event.preventDefault(); this.classList.add('is-over')"
           ondragleave="this.classList.remove('is-over')"
           ondrop="handleFeatureDrop(event); this.classList.remove('is-over')">
        <div class="asset-dropzone-icon">↑</div>
        <div class="asset-dropzone-label">Drop feature graphic here, or click to browse</div>
        <div class="asset-dropzone-hint">PNG or JPG · 1024×500</div>
        <input type="file" id="ob-feature-input" accept="image/*" style="display:none"
               onchange="handleFeatureFiles(this.files); this.value=''">
      </div>
      <div id="ob-feature-preview"></div>` : ''}

      <div class="ob-section-label" style="margin-top:24px;">Trailer <span class="form-section-note">Optional</span></div>
      <div class="asset-guidance">A short gameplay trailer (60–90 seconds) shown on your store pages. Upload a video file or link a YouTube video below.</div>
      <div class="asset-dropzone asset-dropzone-sm" id="ob-trailer-dropzone"
           onclick="document.getElementById('ob-trailer-input').click()"
           ondragover="event.preventDefault(); this.classList.add('is-over')"
           ondragleave="this.classList.remove('is-over')"
           ondrop="handleTrailerDrop(event); this.classList.remove('is-over')">
        <div class="asset-dropzone-icon">↑</div>
        <div class="asset-dropzone-label">Drop video file here, or click to browse</div>
        <div class="asset-dropzone-hint">MP4 · Max 500 MB</div>
        <input type="file" id="ob-trailer-input" accept="video/*" style="display:none"
               onchange="handleTrailerFiles(this.files); this.value=''">
      </div>
      <div id="ob-trailer-file-info" style="display:none;"></div>
      <div class="asset-url-row">
        <label class="form-label" style="margin-bottom:6px;">Or paste a YouTube URL</label>
        <input class="form-input" id="ob-trailer-url" type="url" placeholder="https://youtube.com/watch?v=..."
               oninput="syncField('trailerUrl', this.value)">
      </div>
    </div>`;
}

/* Tab 3: Compliance */
function buildComplianceTab() {
  return `
    <div class="ob-form">
      <div class="ob-section-label">Links</div>

      <div class="form-group">
        <label class="form-label" for="ob-support">Support URL</label>
        <input class="form-input" id="ob-support" type="url" placeholder="https://yourgame.com/support"
               oninput="syncField('supportUrl', this.value)">
      </div>

      <div class="form-group">
        <label class="form-label" for="ob-privacy">Privacy Policy URL</label>
        <input class="form-input" id="ob-privacy" type="url" placeholder="https://yourgame.com/privacy"
               oninput="syncField('privacyUrl', this.value)">
      </div>

      <div class="ob-section-label" style="margin-top:20px;">Compliance Questions</div>
      <div class="asset-guidance">
        Answer once — Subwoofer uses your responses to pre-fill content declarations, age rating questionnaires, and privacy disclosures across every platform you submit to.
      </div>

      <div id="ob-questions-list"></div>
    </div>`;
}

/* Hydration helpers — fill form fields from state after render */
function hydrateGameDetailsTab() {
  const fd = state.formData;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('ob-title', fd.title);
  set('ob-desc',  fd.description);
  set('ob-price', fd.price);
  set('ob-lang',  fd.primaryLanguage);
  set('ob-date',  fd.releaseDate);
  if (fd.title)       charCount('ob-title-count', fd.title,       30);
  if (fd.description) charCount('ob-desc-count',  fd.description, 4000);

  // Restore language chips from state
  if (fd.localizations.length) {
    document.querySelectorAll('#ob-lang-chips .lang-chip').forEach(btn => {
      const code = btn.getAttribute('onclick')?.match(/'([^']+)'\)$/)?.[1];
      if (code && fd.localizations.includes(code)) btn.classList.add('is-on');
    });
  }

  // Release timing
  const radios = document.querySelectorAll('input[name="ob-release"]');
  radios.forEach(r => { if (r.value === fd.releaseTiming) r.checked = true; });
  const dateRow = document.getElementById('ob-release-date-row');
  if (dateRow) dateRow.style.display = fd.releaseTiming === 'specific_date' ? 'block' : 'none';
}

function hydrateUploadAssetsTab() {
  // App icon
  if (state.uploads.appIcon) {
    const preview = document.getElementById('ob-icon-preview');
    if (preview) {
      preview.innerHTML = `<img src="${state.uploads.appIcon.dataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:14px;" alt="App Icon">`;
    }
  }
  const el = document.getElementById('ob-trailer-url');
  if (el) el.value = state.formData.trailerUrl || '';
  if (state.uploads.trailer) {
    const info = document.getElementById('ob-trailer-file-info');
    if (info) {
      const mb = (state.uploads.trailer.size / 1024 / 1024).toFixed(1);
      info.style.display = 'block';
      info.innerHTML = trailerFileRowHTML(state.uploads.trailer.name, mb, 'ob-');
    }
  }
}

function hydrateComplianceTab() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('ob-support', state.formData.supportUrl);
  set('ob-privacy', state.formData.privacyUrl);
  if (state.formData.privacyGenerated) {
    const cb = document.getElementById('ob-privacy-gen-check');
    if (cb) cb.checked = true;
    const note = document.getElementById('ob-privacy-gen-note');
    if (note) note.style.display = 'block';
  }
  renderComplianceQuestions();
}

function renderOnboardingScreenshotGrid() {
  const grid = document.getElementById('ob-screenshot-grid');
  if (!grid) return;
  if (!state.uploads.screenshots.length) { grid.innerHTML = ''; return; }
  grid.innerHTML = state.uploads.screenshots.map(shot => `
    <div class="asset-thumb">
      <img src="${shot.dataUrl}" alt="${shot.name}">
      <button class="asset-remove" onclick="removeScreenshot('${shot.id}')" title="Remove">×</button>
      <div class="asset-name">${shot.name}</div>
    </div>`).join('');
}

function renderOnboardingFeaturePreview() {
  const preview = document.getElementById('ob-feature-preview');
  if (!preview) return;
  const dz = document.getElementById('ob-feature-dropzone');
  if (!state.uploads.featureGraphic) {
    preview.innerHTML = '';
    if (dz) dz.style.display = '';
    return;
  }
  if (dz) dz.style.display = 'none';
  const fg = state.uploads.featureGraphic;
  preview.innerHTML = `
    <div class="feature-preview-wrap">
      <img src="${fg.dataUrl}" alt="${fg.name}" class="feature-img">
      <div class="feature-preview-meta">
        <span class="feature-preview-name">${fg.name}</span>
        <button class="btn btn-ghost btn-sm" onclick="removeFeatureGraphic()">Replace</button>
      </div>
    </div>`;
}

function renderComplianceQuestions() {
  const container = document.getElementById('ob-questions-list');
  if (!container) return;
  computeInferences();
  let h = '';
  for (const q of QUESTIONS) {
    const answer   = state.questionAnswers[q.id];
    const inferred = state.questionInferred[q.id];
    h += `
      <div class="question-card ${answer !== null ? 'is-answered' : ''}">
        <div class="question-body">
          <div class="question-text">
            ${q.label}
            ${inferred && answer !== null ? '<span class="inferred-badge">Auto-detected</span>' : ''}
          </div>
          <div class="question-desc">${q.desc}</div>
          ${inferred && answer !== null ? `
            <button class="inferred-change-link" onclick="changeInferredAnswer('${q.id}')">Change answer</button>` : ''}
        </div>
        <div class="question-yn">
          <button class="yn-btn yn-yes ${answer === 'yes' ? 'is-selected' : ''}"
                  onclick="answerQuestion('${q.id}','yes')">YES</button>
          <button class="yn-btn yn-no ${answer === 'no' ? 'is-selected' : ''}"
                  onclick="answerQuestion('${q.id}','no')">NO</button>
        </div>
      </div>`;
  }
  container.innerHTML = h;
}

/* re-exported so answerQuestion/changeInferredAnswer can call it */
function renderKeyQuestionsScreen() { renderComplianceQuestions(); }


/* ── Project bar ─────────────────────────────────────── */

function renderProjectBar() {
  const proj = state.projects.find(p => p.id === state.activeProjectId);
  const gameTitle = state.formData.title || proj?.name || 'My Game';

  // Update selector button titles
  const selTitle = document.getElementById('projectSelectorTitle');
  if (selTitle) selTitle.textContent = gameTitle;
  const subTitle = document.getElementById('submissionSelectorTitle');
  const activeSub = proj?.submissions.find(s => s.id === state.activeSubmissionId);
  if (subTitle) subTitle.textContent = activeSub?.name || 'Submission 1.0';

  // Render project dropdown items
  const projDD = document.getElementById('projectDropdown');
  if (projDD) {
    projDD.innerHTML = state.projects.map(p => `
      <div class="project-item ${p.id === state.activeProjectId ? 'active' : ''}"
           onclick="switchProject('${p.id}')">
        ${p.name || 'Untitled Game'}
      </div>`).join('') + `
      <div class="project-dropdown-divider"></div>
      <div class="project-item new-project" onclick="createNewProject()">
        <span>New project</span><span class="plus">+</span>
      </div>
      <div class="project-item danger" onclick="deleteCurrentProject()">
        <span>Delete project</span>
      </div>`;
  }

  // Render submission dropdown items
  const subDD = document.getElementById('submissionDropdown');
  if (subDD && proj) {
    subDD.innerHTML = proj.submissions.map(s => `
      <div class="project-item ${s.id === state.activeSubmissionId ? 'active' : ''}"
           onclick="switchSubmission('${s.id}')">
        ${s.name}
      </div>`).join('') + `
      <div class="project-item new-project" onclick="createNewSubmission()">
        <span>New submission</span><span class="plus">+</span>
      </div>`;
  }

  // Update profile name display
  const profName = document.getElementById('profile-name');
  if (profName) profName.textContent = 'Developer';
}


/* ── Dashboard ───────────────────────────────────────── */

function renderDashboard() {
  const el = document.getElementById('dashboard');
  if (!el) return;

  renderProjectBar();

  const active   = [...state.activePlatforms];
  const inactive = Object.keys(PLATFORMS).filter(pid => !state.activePlatforms.has(pid));

  let h = '';

  if (active.length === 0) {
    h += `
      <div class="dash-empty">
        <div class="dash-empty-title">No platforms activated yet</div>
        <div class="dash-empty-desc">Activate a platform below to start your submission checklist.</div>
      </div>`;
  } else {
    h += `<div class="active-cards-grid">`;
    for (const pid of active) {
      h += buildActiveCard(pid);
    }
    h += `</div>`;
  }

  if (inactive.length > 0) {
    h += `
      <div class="inactive-section">
        <div class="inactive-section-label">${active.length > 0 ? 'More platforms' : 'Available platforms'}</div>
        <div class="inactive-cards-grid">
          ${inactive.map(pid => buildInactiveCard(pid)).join('')}
        </div>
      </div>`;
  }

  el.innerHTML = h;

  // Animate active platform progress bars from 0% → actual width after first paint
  requestAnimationFrame(() => {
    for (const pid of active) {
      const counts = platformStepCount(pid);
      const pct = counts.total ? Math.round((counts.complete / counts.total) * 100) : 0;
      const barFill = document.getElementById(`bar-fill-${pid}`);
      if (barFill) barFill.style.width = pct + '%';
    }
  });
}

function buildActiveCard(pid) {
  const p      = PLATFORMS[pid];
  const counts = platformStepCount(pid);
  const locked = !counts.allRequired;
  const submitDone = counts.submitDone;

  // Only non-submit steps in the task list
  const steps = p.steps.filter(s => !s.isSubmit).map(step => {
    const done = state.platformStepStatus[pid][step.id] === 'complete';
    return `
      <div class="card-task ${done ? 'is-done' : ''}" onclick="openTaskModal('${pid}','${step.id}')">
        <div class="task-dot ${done ? 'is-complete' : ''}" id="dot-${pid}-${step.id}"></div>
        <span class="task-label">${step.label}</span>
        <span class="task-arrow">›</span>
      </div>`;
  }).join('');

  // Bar starts at 0% — renderDashboard() animates it to actual width via rAF
  return `
    <div class="active-card" id="active-card-${pid}">
      <div class="active-card-head">
        <div class="active-card-platform">
          <div class="active-card-icon">
            ${platformIcon(pid, 18)}
          </div>
          <div>
            <div class="active-card-name">${p.label}</div>
            <div class="active-card-progress-label" id="step-count-${pid}">${counts.complete} / ${counts.total} steps</div>
          </div>
        </div>
        <button class="platform-toggle is-on" onclick="deactivatePlatform('${pid}')" title="Deactivate platform" aria-label="Toggle off"></button>
      </div>
      <div class="card-bar-wrap">
        <div class="card-bar">
          <div class="card-bar-fill" id="bar-fill-${pid}" style="width:0%;"></div>
        </div>
        <button class="card-submit-btn ${submitDone ? 'is-done' : locked ? 'is-locked' : ''}"
                id="submit-btn-${pid}"
                onclick="${submitDone || locked ? '' : `finalSubmit('${pid}')`}"
                title="${locked ? 'Complete all steps first' : submitDone ? 'Submitted' : 'Submit for review'}"
                ${locked && !submitDone ? 'disabled' : ''}>
          ${submitDone ? '✓' : 'Submit'}
        </button>
      </div>
      <div class="card-tasks">${steps}</div>
    </div>`;
}

function buildInactiveCard(pid) {
  const p      = PLATFORMS[pid];
  const counts = platformStepCount(pid);
  const pct    = counts.total ? Math.round((counts.complete / counts.total) * 100) : 0;
  const label  = counts.complete > 0 ? `${counts.complete} / ${counts.total} steps` : 'Inactive';
  return `
    <div class="inactive-card">
      <div class="inactive-card-head">
        <div class="inactive-card-platform">
          <div class="inactive-card-icon">${platformIcon(pid, 16)}</div>
          <span class="inactive-card-name">${p.label}</span>
        </div>
        <button class="platform-toggle" onclick="activatePlatform('${pid}')" title="Activate platform" aria-label="Toggle on"></button>
      </div>
      <div class="inactive-bar-wrap">
        <div class="inactive-bar">
          <div class="inactive-bar-fill" style="width:${pct}%;"></div>
        </div>
        <span class="inactive-status-label">${label}</span>
      </div>
    </div>`;
}


/* ── Task Modal ──────────────────────────────────────── */

function renderTaskModal() {
  const modal = document.getElementById('task-modal');
  if (!modal || !state.activeModal) return;

  const { platformId, stepId } = state.activeModal;
  const p      = PLATFORMS[platformId];
  const step   = p.steps.find(s => s.id === stepId);
  const status = state.platformStepStatus[platformId][stepId];
  const done   = status === 'complete';

  modal.innerHTML = `
    <div class="task-modal-header" style="border-top-color:${p.color};">
      <div class="task-modal-context">
        <div class="task-modal-platform-icon" style="color:${p.color};">
          ${platformIcon(platformId, 16)}
        </div>
        <span class="task-modal-platform-name">${p.label}</span>
        <span class="task-modal-sep">›</span>
        <span class="task-modal-step-name">${step.label}</span>
      </div>
      <button class="task-modal-close" onclick="closeTaskModal()">×</button>
    </div>
    <div class="task-modal-body">
      ${buildTaskContent(platformId, stepId, done)}
    </div>
    <div class="task-modal-footer">
      ${done
        ? `<button class="btn btn-ghost" onclick="markTaskUndone('${platformId}','${stepId}')">Mark incomplete</button>
           <button class="btn btn-primary" onclick="closeTaskModal()">Done</button>`
        : `<button class="btn btn-ghost" onclick="closeTaskModal()">Cancel</button>
           <button class="btn btn-primary" onclick="markTaskDone('${platformId}','${stepId}')">Mark complete ✓</button>`
      }
    </div>`;
}

function buildTaskContent(platformId, stepId, done) {
  const p    = PLATFORMS[platformId];
  const step = p.steps.find(s => s.id === stepId);
  const fd   = state.formData;

  // Review Metadata — show their actual content
  if (stepId === 'reviewMetadata' || stepId === 'reviewStorePage' || stepId === 'reviewStoreListing') {
    return `
      <div class="task-content-section">
        <div class="task-content-label">Title</div>
        <div class="task-content-value">${fd.title || '<em style="color:#aaa">Not set</em>'}</div>
      </div>
      <div class="task-content-section">
        <div class="task-content-label">Description</div>
        <div class="task-content-value task-content-desc">${fd.description || '<em style="color:#aaa">Not set</em>'}</div>
      </div>
      <div class="task-content-section">
        <div class="task-content-label">Price</div>
        <div class="task-content-value">${fd.price ? `$${fd.price}` : '<em style="color:#aaa">Not set</em>'}</div>
      </div>
      <p class="task-stub-note">Review the metadata above. Make any edits via <strong>Game Details</strong>, then mark complete.</p>`;
  }

  // Confirm Screenshots — show their thumbnails
  if (stepId === 'confirmScreenshots' || (stepId === 'confirmMedia' && state.uploads.screenshots.length)) {
    const shots = state.uploads.screenshots;
    const thumbs = shots.length
      ? `<div class="task-thumb-row">${shots.slice(0, 6).map(s => `<img src="${s.dataUrl}" class="task-thumb" alt="${s.name}">`).join('')}${shots.length > 6 ? `<div class="task-thumb-more">+${shots.length - 6}</div>` : ''}</div>`
      : `<p class="task-stub-note">No screenshots uploaded yet. Add them via <strong>Game Details → Upload Assets</strong>.</p>`;
    return `<p style="margin-bottom:14px;color:#555;font-size:13px;">Confirm these screenshots look correct for <strong>${p.label}</strong>.</p>${thumbs}`;
  }

  // Generic stub
  return `
    <p class="task-stub-copy">Complete the <strong>${step.label}</strong> step for ${p.label}.</p>
    <p class="task-stub-note">Full task UI coming in the next iteration. Mark complete to continue.</p>`;
}

/* ── Submit Modal ────────────────────────────────────── */

function renderSubmitModal() {
  const modal = document.getElementById('submit-modal');
  if (!modal) return;
  const { platformId } = state.submitModal;
  if (platformId === 'ios') {
    renderIOSSubmitModal(modal);
  } else {
    renderGenericSubmitModal(modal);
  }
  // Re-run after DOM settles so tooltip bounds can be measured
  requestAnimationFrame(() => positionTooltips());
}

/* Generic (non-iOS) content-review modal — existing risk-summary approach */
function renderGenericSubmitModal(modal) {
  const { platformId } = state.submitModal;
  const p        = PLATFORMS[platformId];
  const riskData = computeSubmitRisk();

  const RISK_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 };
  const sorted = [...RISK_CATEGORIES].sort((a, b) =>
    RISK_ORDER[riskData[a.id]?.risk || 'NONE'] - RISK_ORDER[riskData[b.id]?.risk || 'NONE']
  );

  const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  RISK_CATEGORIES.forEach(cat => counts[riskData[cat.id]?.risk || 'LOW']++);

  modal.innerHTML = `
    <div class="submit-modal-header" style="border-top-color:${p.color};">
      <div class="submit-modal-title-row">
        <div class="submit-modal-hicon" style="color:${p.color};">${platformIcon(platformId, 22)}</div>
        <div>
          <div class="submit-modal-title">Content Review</div>
          <div class="submit-modal-subtitle">${p.label} · Before you submit</div>
        </div>
      </div>
      <button class="task-modal-close" onclick="closeSubmitModal()">×</button>
    </div>

    <div class="submit-modal-scroll">
      <div class="submit-modal-intro">
        We've evaluated your game against platform content requirements using your onboarding answers and description. Review each category — expand any row for signals and risk justification.
      </div>
      <div class="submit-risk-summary">
        ${counts.HIGH   > 0 ? `<span class="risk-pill risk-HIGH">${counts.HIGH} HIGH</span>` : ''}
        ${counts.MEDIUM > 0 ? `<span class="risk-pill risk-MEDIUM">${counts.MEDIUM} MEDIUM</span>` : ''}
        ${counts.LOW    > 0 ? `<span class="risk-pill risk-LOW">${counts.LOW} LOW</span>` : ''}
      </div>
      <div class="submit-categories">
        ${sorted.map(cat => buildRiskCategoryRow(cat, riskData[cat.id])).join('')}
      </div>
    </div>

    <div class="submit-modal-footer">
      <button class="btn btn-ghost" onclick="closeSubmitModal()">Save Draft</button>
      <button class="btn btn-primary submit-confirm-btn" onclick="confirmAndSubmit('${platformId}')">
        Confirm & Submit →
      </button>
    </div>`;
}

/* iOS questionnaire submit modal */
function renderIOSSubmitModal(modal) {
  const p = PLATFORMS['ios'];
  const incomplete = IOS_SECTIONS.filter(s => !isIOSSectionComplete(s.id));
  const allComplete = incomplete.length === 0;

  modal.innerHTML = `
    <div class="submit-modal-header" style="border-top-color:${p.color};">
      <div class="submit-modal-title-row">
        <div class="submit-modal-hicon" style="color:${p.color};">${platformIcon('ios', 22)}</div>
        <div>
          <div class="submit-modal-title">Submit to App Store</div>
          <div class="submit-modal-subtitle">iOS App Store · Build 1.0.0 (1)</div>
        </div>
      </div>
      <button class="task-modal-close" onclick="closeSubmitModal()">×</button>
    </div>

    <div class="submit-modal-scroll" id="ios-submit-scroll">
      ${buildIOSScrollContent()}
    </div>

    <div class="submit-modal-footer">
      <button class="btn btn-ghost" onclick="closeSubmitModal()">Save Draft</button>
      <button class="btn submit-confirm-btn ${allComplete ? '' : 'is-ios-incomplete'}"
              onclick="${allComplete ? "confirmAndSubmit('ios')" : ''}"
              title="${allComplete ? 'Submit to App Store' : 'Complete all sections first'}">
        ${allComplete ? 'Confirm & Submit →' : `${incomplete.length} section${incomplete.length > 1 ? 's' : ''} incomplete`}
      </button>
    </div>`;
}

function buildIOSScrollContent() {
  return `
    <div class="ios-submit-intro">
      Complete each section. Subwoofer pre-fills answers from your onboarding responses — review and confirm before submitting.
    </div>
    <div class="ios-sections">
      ${IOS_SECTIONS.map(section => buildIOSSectionRow(section)).join('')}
    </div>`;
}

function buildIOSSectionRow(section) {
  const expanded = state.submitModal.expanded.includes(section.id);
  const complete  = isIOSSectionComplete(section.id);
  const risk      = computeIOSSectionRisk(section.id);

  const checkSVG = `<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  return `
    <div class="ios-section ${expanded ? 'is-expanded' : ''} ${complete ? 'is-complete' : ''}" id="ios-sec-${section.id}">
      <div class="ios-section-head" onclick="toggleIOSSection('${section.id}')">
        <div class="ios-section-left">
          <div class="ios-section-num ${complete ? 'is-done' : ''}">
            ${complete ? checkSVG : section.num}
          </div>
          <span class="ios-section-label">${section.label}</span>
        </div>
        <div class="ios-section-right">
          ${!complete
            ? '<span class="ios-section-incomplete">Incomplete</span>'
            : (risk !== 'NONE' ? `<span class="risk-badge risk-badge-${risk}">${risk}</span>` : '')}
          <span class="ios-section-chevron">›</span>
        </div>
      </div>
      <div class="ios-section-body">
        <div class="ios-section-content">
          ${buildIOSSectionBody(section.id)}
        </div>
      </div>
    </div>`;
}

function buildIOSSectionBody(sectionId) {
  if (sectionId === 'ios-privacy')      return buildPrivacySection();
  if (sectionId === 'ios-content')      return buildContentRatingSection();
  if (sectionId === 'ios-compliance')   return buildExportComplianceSection();
  if (sectionId === 'ios-business')     return buildBusinessSection();
  if (sectionId === 'ios-distribution') return buildDistributionSection();
  return '';
}

/* ── iOS section helper: YES/NO question row ─────────── */
function iosYNRow(label, fieldId, desc, tooltip) {
  const val = state.iosSubmitAnswers[fieldId];
  // desc and tooltip both render as a ? icon tooltip; desc takes priority if tooltip not provided
  const ttText = tooltip || desc || '';
  const ttHTML = ttText ? `<span class="tooltip-anchor"><span class="tooltip-icon">?</span><span class="tooltip-body">${ttText}</span></span>` : '';
  return `
    <div class="ios-q-row">
      <div class="ios-q-left">
        <div class="ios-q-label">${label}${ttHTML}</div>
      </div>
      <div class="question-yn">
        <button class="yn-btn yn-yes ${val === 'yes' ? 'is-selected' : ''}"
                onclick="answerIOSField('${fieldId}','yes')">YES</button>
        <button class="yn-btn yn-no ${val === 'no' ? 'is-selected' : ''}"
                onclick="answerIOSField('${fieldId}','no')">NO</button>
      </div>
    </div>`;
}

/* ── iOS section helper: None / Infrequent / Frequent row */
function iosIntensityRow(label, fieldId, tooltip) {
  const val = state.iosSubmitAnswers[fieldId];
  const ttHTML = tooltip ? `<span class="tooltip-anchor"><span class="tooltip-icon">?</span><span class="tooltip-body">${tooltip}</span></span>` : '';
  return `
    <div class="ios-q-row ios-q-row-intensity">
      <div class="ios-q-label ios-q-label-sm">${label}${ttHTML}</div>
      <div class="intensity-group">
        <button class="intensity-btn ${val === 'none'       ? 'is-sel-none'       : ''}" onclick="answerIOSField('${fieldId}','none')">None</button>
        <button class="intensity-btn ${val === 'infrequent' ? 'is-sel-infrequent' : ''}" onclick="answerIOSField('${fieldId}','infrequent')">Infrequent</button>
        <button class="intensity-btn ${val === 'frequent'   ? 'is-sel-frequent'   : ''}" onclick="answerIOSField('${fieldId}','frequent')">Frequent</button>
      </div>
    </div>`;
}

/* ── Privacy ─────────────────────────────────────────── */
function buildPrivacySection() {
  const a = state.iosSubmitAnswers;
  const noUrl = !a.privacyPolicyUrl.trim();

  const dataTypeBlock = a.collectsData === 'yes' ? `
    <div class="ios-subsection">
      <div class="ios-subsection-label">What types of data does your app collect?</div>
      <div class="data-type-chips">
        ${IOS_DATA_TYPES.map(dt => `
          <button class="data-type-chip ${a.dataTypes.includes(dt.id) ? 'is-on' : ''}"
                  onclick="toggleIOSDataType('${dt.id}')" title="${dt.desc}">${dt.label}</button>`).join('')}
      </div>
      ${a.dataTypes.length > 0 ? `
        <div style="margin-top:14px;">
          ${iosYNRow('Is any collected data linked to the user\'s identity?',
            'dataLinkedToUser',
            'Includes data tied to accounts, names, or email addresses.')}
          ${iosYNRow('Is any collected data used for tracking across other apps or websites?',
            'dataForTracking',
            'Tracking means linking data from your app with data from other apps for advertising.')}
          ${a.dataForTracking === 'yes' ? '<div class="ios-risk-note risk-MEDIUM">Tracking requires implementing Apple\'s AppTrackingTransparency framework and requesting user permission before data is collected.</div>' : ''}
        </div>` : ''}
    </div>` : '';

  return `
    <div class="form-group">
      <label class="form-label">Privacy Policy URL
        <span class="tooltip-anchor">
          <span class="tooltip-icon">?</span>
          <span class="tooltip-body">Apple requires a live, reachable URL. A missing or broken link is an automatic rejection reason.</span>
        </span>
      </label>
      <input class="form-input" type="url" value="${a.privacyPolicyUrl}"
             placeholder="https://yourgame.com/privacy"
             oninput="updateIOSTextField('privacyPolicyUrl', this.value)"
             onblur="reRenderIOSSubmitModal()">
      ${noUrl ? '<div class="ios-risk-note risk-HIGH">Required. A missing privacy policy URL is an automatic App Review rejection.</div>' : ''}
    </div>
    ${iosYNRow('Does your app collect any data from users?', 'collectsData',
      'Includes analytics SDKs, crash reporters, accounts, device IDs, or any third-party SDK that collects data.')}
    ${dataTypeBlock}`;
}

/* ── Content Rating ──────────────────────────────────── */
function buildContentRatingSection() {
  const a = state.iosSubmitAnswers;

  // Quick lookups
  const iq = id => IOS_INTENSITY_QUESTIONS.find(q => q.id === id);
  const yq = id => IOS_CONTENT_YN_QUESTIONS.find(q => q.id === id);

  // Progress
  const totalQ    = IOS_INTENSITY_QUESTIONS.length + IOS_CONTENT_YN_QUESTIONS.length + 1; // +1 for ageCategory
  const answeredQ = IOS_INTENSITY_QUESTIONS.filter(q => a[q.id] !== null).length
                  + IOS_CONTENT_YN_QUESTIONS.filter(q => a[q.id] !== null).length
                  + (a.ageCategory !== null ? 1 : 0);
  const rating = computeIOSAgeRating();

  // Step 7 follow-ups
  const kidsFollowUp = a.ageCategory === 'made_for_kids' ? `
    <div class="ios-followup">
      <div class="ios-q-label" style="margin-bottom:8px;">Kids age range</div>
      <div class="ios-radio-group">
        ${[['under5','Ages 5 and under'],['6to8','Ages 6–8'],['9to11','Ages 9–11']].map(([val,lbl]) => `
          <label class="ios-radio-label">
            <input type="radio" name="ios-kids-age" value="${val}" ${a.kidsAgeRange === val ? 'checked' : ''}
                   onchange="answerIOSField('kidsAgeRange','${val}')"> ${lbl}
          </label>`).join('')}
      </div>
    </div>` : '';

  const overrideFollowUp = a.ageCategory === 'override_higher' ? `
    <div class="ios-followup">
      <div class="ios-q-label" style="margin-bottom:8px;">Override to rating</div>
      <div class="ios-radio-group">
        ${[['9','Age 9+'],['13','Age 13+'],['16','Age 16+'],['18','Age 18+']].map(([val,lbl]) => `
          <label class="ios-radio-label">
            <input type="radio" name="ios-override-rating" value="${val}" ${a.overrideRating === val ? 'checked' : ''}
                   onchange="answerIOSField('overrideRating','${val}')"> ${lbl}
          </label>`).join('')}
      </div>
    </div>` : '';

  return `
    <div class="ios-rating-progress">
      ${answeredQ} / ${totalQ} questions answered
      ${rating ? ` · Estimated rating: <strong>${rating}</strong>` : ''}
    </div>

    <div class="ios-content-step-label">Step 1 — Features</div>
    ${iosYNRow(yq('parentalControls').label,    'parentalControls',    '', yq('parentalControls').tooltip)}
    ${iosYNRow(yq('ageAssurance').label,         'ageAssurance',        '', yq('ageAssurance').tooltip)}
    ${iosYNRow(yq('unrestrictedInternet').label, 'unrestrictedInternet','', yq('unrestrictedInternet').tooltip)}
    ${iosYNRow(yq('userGenContent').label,       'userGenContent',      '', yq('userGenContent').tooltip)}
    ${iosYNRow(yq('messagingChat').label,        'messagingChat',       '', yq('messagingChat').tooltip)}
    ${iosYNRow(yq('advertising').label,          'advertising',         '', yq('advertising').tooltip)}

    <div class="ios-q-divider"></div>
    <div class="ios-content-step-label">Step 2 — Mature Themes</div>
    <div class="ios-intensity-list">
      ${['profanity','horrorFear','substancesAlcohol'].map(id => { const q=iq(id); return iosIntensityRow(q.label,q.id,q.tooltip); }).join('')}
    </div>

    <div class="ios-q-divider"></div>
    <div class="ios-content-step-label">Step 3 — Medical or Wellness</div>
    <div class="ios-intensity-list">
      ${(() => { const q=iq('medicalTreatment'); return iosIntensityRow(q.label,q.id,q.tooltip); })()}
    </div>
    ${iosYNRow(yq('healthWellness').label, 'healthWellness', '', yq('healthWellness').tooltip)}

    <div class="ios-q-divider"></div>
    <div class="ios-content-step-label">Step 4 — Sexuality or Nudity</div>
    <div class="ios-intensity-list">
      ${['matureSuggestive','sexualContent','graphicSexual'].map(id => { const q=iq(id); return iosIntensityRow(q.label,q.id,q.tooltip); }).join('')}
    </div>

    <div class="ios-q-divider"></div>
    <div class="ios-content-step-label">Step 5 — Violence</div>
    <div class="ios-intensity-list">
      ${['cartoonViolence','realisticViolence','extendedViolence','gunsWeapons'].map(id => { const q=iq(id); return iosIntensityRow(q.label,q.id,q.tooltip); }).join('')}
    </div>

    <div class="ios-q-divider"></div>
    <div class="ios-content-step-label">Step 6 — Chance-Based Activities</div>
    <div class="ios-intensity-list">
      ${['simulatedGambling','contests'].map(id => { const q=iq(id); return iosIntensityRow(q.label,q.id,q.tooltip); }).join('')}
    </div>
    ${iosYNRow(yq('realMoneyGambling').label, 'realMoneyGambling', '', yq('realMoneyGambling').tooltip)}
    ${a.realMoneyGambling === 'yes' ? '<div class="ios-risk-note risk-HIGH">Real-money gambling requires a special Apple entitlement and proof of licensing in every territory where it is offered. Apple will ask for documentation during review.</div>' : ''}
    ${iosYNRow(yq('lootBoxes').label, 'lootBoxes', '', yq('lootBoxes').tooltip)}
    ${a.lootBoxes === 'yes' ? '<div class="ios-risk-note risk-MEDIUM">Apps with loot boxes must clearly disclose the odds of receiving each item type before a player makes a purchase.</div>' : ''}

    <div class="ios-q-divider"></div>
    <div class="ios-content-step-label">Step 7 — Additional Information</div>
    <div class="ios-q-row" style="align-items:center;gap:12px;">
      <div class="ios-q-left">
        <div class="ios-q-label">Age Category
          <span class="tooltip-anchor"><span class="tooltip-icon">?</span><span class="tooltip-body">Override the calculated rating for apps targeting a specific age group or with EULA age requirements.</span></span>
        </div>
      </div>
      <select class="form-input" style="width:auto;min-width:220px;font-size:12px;" onchange="answerIOSField('ageCategory',this.value)">
        <option value="">Select…</option>
        <option value="not_applicable"  ${a.ageCategory==='not_applicable' ?'selected':''}>Not Applicable</option>
        <option value="made_for_kids"   ${a.ageCategory==='made_for_kids'  ?'selected':''}>Made for Kids</option>
        <option value="override_higher" ${a.ageCategory==='override_higher'?'selected':''}>Override to Higher Rating</option>
      </select>
    </div>
    ${kidsFollowUp}
    ${overrideFollowUp}
    <div class="form-group" style="margin-top:14px;">
      <label class="form-label">Age Suitability URL <span class="form-section-note">Optional</span>
        <span class="tooltip-anchor"><span class="tooltip-icon">?</span><span class="tooltip-body">A URL with additional age suitability information for Apple reviewers.</span></span>
      </label>
      <input class="form-input" type="url" value="${a.ageSuitabilityUrl}"
             placeholder="https://yourgame.com/age-suitability"
             oninput="updateIOSTextField('ageSuitabilityUrl', this.value)"
             onblur="reRenderIOSSubmitModal()">
    </div>`;
}

function computeIOSAgeRating() {
  const a = state.iosSubmitAnswers;

  // Step 7 override takes precedence
  if (a.ageCategory === 'made_for_kids') {
    const map = { under5: '4+', '6to8': '4+', '9to11': '9+' };
    return a.kidsAgeRange ? map[a.kidsAgeRange] : null;
  }
  if (a.ageCategory === 'override_higher') {
    const map = { '9': '9+', '13': '13+', '16': '16+', '18': '18+' };
    return a.overrideRating ? map[a.overrideRating] : null;
  }

  // Compute from content answers
  if (a.graphicSexual === 'frequent' || a.sexualContent === 'frequent' ||
      a.realisticViolence === 'frequent' || a.extendedViolence === 'frequent' ||
      a.realMoneyGambling === 'yes') return '17+';
  const hasInfrequent = IOS_INTENSITY_QUESTIONS.some(q => a[q.id] === 'infrequent' || a[q.id] === 'frequent');
  if (hasInfrequent || a.userGenContent === 'yes' || a.unrestrictedInternet === 'yes' ||
      a.messagingChat === 'yes') return '12+';
  if (IOS_INTENSITY_QUESTIONS.every(q => a[q.id] !== null)) return '4+';
  return null;
}

/* ── Export Compliance ───────────────────────────────── */
function buildExportComplianceSection() {
  const a = state.iosSubmitAnswers;

  let followUp = '';
  if (a.usesEncryption === 'yes') {
    followUp = `<div class="ios-followup">
      ${iosYNRow('Is the encryption exempt from US export regulations?', 'encryptionExempt',
        'Exempt: standard HTTPS/TLS for data in transit, standard auth only, no custom algorithms.')}
      ${a.encryptionExempt === 'no' ? `
        <div class="ios-followup">
          ${iosYNRow('Do you have an Encryption Registration Number (ERN) from the US Bureau of Industry and Security?', 'hasERN', '')}
          ${a.hasERN === 'yes' ? `
            <div class="form-group" style="margin-top:8px;">
              <label class="form-label">ERN Number</label>
              <input class="form-input" type="text" value="${a.ernNumber}" placeholder="ENC-XXXXXXXX"
                     oninput="updateIOSTextField('ernNumber', this.value)"
                     onblur="reRenderIOSSubmitModal()">
            </div>` : ''}
          ${a.hasERN === 'no' ? '<div class="ios-risk-note risk-HIGH">An ERN is required before submitting apps with non-exempt encryption. Apply at bis.doc.gov.</div>' : ''}
        </div>` : ''}
    </div>`;
  }

  return `
    ${iosYNRow('Does your app use, contain, or incorporate cryptography or encryption?', 'usesEncryption',
      'Includes HTTPS, SSL/TLS, data-at-rest encryption, and any third-party SDK that uses encryption (AWS, Firebase, etc.).')}
    ${followUp}
    ${a.usesEncryption === 'no' ? '<div class="ios-note">No encryption — your app qualifies as exempt. No ERN required.</div>' : ''}`;
}

/* ── Business ────────────────────────────────────────── */
function buildBusinessSection() {
  const a = state.iosSubmitAnswers;
  const IAP_TYPES = [
    { id: 'consumable',     label: 'Consumable',         desc: 'Coins, lives, boosts' },
    { id: 'non-consumable', label: 'Non-consumable',     desc: 'Unlock levels, remove ads' },
    { id: 'auto-renewable', label: 'Auto-renewable sub', desc: 'Monthly/yearly subscription' },
    { id: 'non-renewing',   label: 'Non-renewing sub',   desc: 'Season pass, time-limited' },
  ];
  const TAX_CATS = ['Games', 'Software', 'Books', 'News', 'Music', 'Podcasts', 'Video'];

  const iapFollowUp = a.hasIAP === 'yes' ? `
    <div class="ios-followup">
      <div class="ios-q-label" style="margin-bottom:8px;">Which IAP types does your app include?</div>
      <div class="data-type-chips">
        ${IAP_TYPES.map(t => `
          <button class="data-type-chip ${a.iapTypes.includes(t.id) ? 'is-on' : ''}"
                  onclick="toggleIOSIAPType('${t.id}')" title="${t.desc}">${t.label}</button>`).join('')}
      </div>
      <div style="margin-top:12px;">
        ${iosYNRow('Does any subscription include a free trial?', 'hasFreeTrial', '')}
      </div>
    </div>` : '';

  return `
    ${iosYNRow('Does your app include in-app purchases?', 'hasIAP',
      'Includes any paid upgrades, cosmetics, virtual currency, or subscriptions.')}
    ${iapFollowUp}
    <div class="form-group" style="margin-top:14px;">
      <label class="form-label">Tax Category
        <span class="tooltip-anchor">
          <span class="tooltip-icon">?</span>
          <span class="tooltip-body">Determines how Apple handles VAT and GST in each country. Choose the category that best describes your app.</span>
        </span>
      </label>
      <select class="form-input" onchange="answerIOSField('taxCategory', this.value)">
        <option value="">Select a category</option>
        ${TAX_CATS.map(c => `<option value="${c.toLowerCase()}" ${a.taxCategory === c.toLowerCase() ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
    </div>`;
}

/* ── Distribution ────────────────────────────────────── */
function buildDistributionSection() {
  const a = state.iosSubmitAnswers;
  const MAX_USERS = 250; // China, for bar scaling

  return `
    <div id="distribution-map-container" class="world-map-container" style="margin-bottom:14px;"></div>
    <div class="ios-q-label" style="margin-bottom:12px;">Where do you intend to make the game available?</div>
    <div class="dist-country-list">
      ${IOS_COUNTRIES.map(c => {
        const isOn = a.selectedCountries.includes(c.code);
        const pct  = Math.round((c.iosUsers / MAX_USERS) * 100);
        return `
          <div class="dist-country-row">
            <button class="dist-country-chip ${isOn ? 'is-on' : ''}"
                    id="dist-chip-${c.code}"
                    onclick="toggleIOSCountry('${c.code}')">${c.name}</button>
            <div class="dist-bar-wrap">
              <div class="dist-bar-fill" style="width:${pct}%; background:${isOn ? 'rgba(59,130,246,0.5)' : 'var(--border-hover)'}"></div>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

function buildRiskCategoryRow(cat, data) {
  const risk        = data?.risk || 'NONE';
  const signals     = data?.signals || [];
  const justification = data?.justification || '';
  const expanded    = state.submitModal.expanded.includes(cat.id);

  const signalsHTML = signals.length ? `
    <div class="risk-signals">
      ${signals.map(s => `
        <div class="risk-signal">
          <span class="signal-label">${s.label}</span>
          <span class="signal-value">${s.value}</span>
          <span class="signal-source">${s.source}</span>
        </div>`).join('')}
    </div>` : '';

  return `
    <div class="risk-cat${expanded ? ' is-expanded' : ''}" id="risk-cat-${cat.id}">
      <div class="risk-cat-head" onclick="toggleRiskCategory('${cat.id}')">
        <div class="risk-cat-left">
          <span class="risk-cat-label">${cat.label}</span>
        </div>
        <div class="risk-cat-right">
          <span class="risk-badge risk-badge-${risk}">${risk}</span>
          <span class="risk-cat-chevron">›</span>
        </div>
      </div>
      <div class="risk-cat-body">
        ${signalsHTML}
        <p class="risk-justification">${justification}</p>
      </div>
    </div>`;
}

function trailerFileRowHTML(name, mb, prefix = '') {
  return `
    <div class="trailer-file-row">
      <span class="trailer-file-name">🎬 ${name}</span>
      <span class="trailer-file-size">${mb} MB</span>
      <button class="btn btn-ghost btn-sm" onclick="removeTrailer('${prefix}')">Remove</button>
    </div>`;
}
