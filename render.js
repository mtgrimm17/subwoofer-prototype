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
  if (state.onboardingTab === 0) el.innerHTML = buildGameDetailsTab();
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
        <div class="char-count" id="ob-title-count">0 / 30 <span class="char-note">(Apple limit)</span></div>
      </div>

      <div class="form-group">
        <label class="form-label" for="ob-desc">Description</label>
        <textarea class="form-input" id="ob-desc" rows="5"
                  placeholder="Tell players what makes your game worth their time..."
                  oninput="syncField('description', this.value); charCount('ob-desc-count', this.value, 4000)"></textarea>
        <div class="char-count" id="ob-desc-count">0 / 4000</div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="ob-price">Price (USD)</label>
          <input class="form-input" id="ob-price" type="text" placeholder="4.99 (free = 0)"
                 oninput="syncField('price', this.value)">
        </div>
        <div class="form-group">
          <label class="form-label" for="ob-lang">Primary Language</label>
          <select class="form-input" id="ob-lang" onchange="syncField('primaryLanguage', this.value)">
            <option value="en">English</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="es">Spanish</option>
            <option value="pt">Portuguese</option>
            <option value="ja">Japanese</option>
            <option value="zh">Chinese (Simplified)</option>
            <option value="ko">Korean</option>
          </select>
        </div>
      </div>

      <div class="ob-section-label" style="margin-top:20px;">Localization</div>
      <div class="toggle-row">
        <button class="toggle" id="ob-locale-toggle" onclick="toggleLocalization()" aria-pressed="false"></button>
        <div>
          <div class="toggle-label">Available in multiple languages</div>
          <div class="toggle-sublabel">Add localized metadata per platform later</div>
        </div>
      </div>
      <div class="lang-picker" id="ob-lang-picker">
        <div class="form-label" style="margin-top:10px;margin-bottom:8px;">Additional languages</div>
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
      </div>

      <div class="ob-section-label" style="margin-top:20px;">Release Timing</div>
      <div class="option-cards" id="ob-release-timing">
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
        <label class="option-card">
          <input type="radio" name="ob-release" value="manual" onchange="pickTiming(this)">
          <div>
            <div class="option-card-title">I'll release manually</div>
            <div class="option-card-desc">You control when each platform goes live after approval.</div>
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
      <div class="icon-upload-row">
        <div class="icon-dropzone" id="ob-icon-dropzone"
             onclick="document.getElementById('ob-icon-input').click()"
             ondragover="event.preventDefault(); this.classList.add('is-over')"
             ondragleave="this.classList.remove('is-over')"
             ondrop="handleIconDrop(event)">
          <div id="ob-icon-preview">
            <div style="font-size:24px;margin-bottom:6px;">🎮</div>
            <div style="font-size:11px;font-weight:600;color:#888;">Drop icon</div>
            <div style="font-size:10px;color:#bbb;margin-top:2px;">1024×1024</div>
          </div>
          <input type="file" id="ob-icon-input" accept="image/*" style="display:none"
                 onchange="handleIconFiles(this.files); this.value=''">
        </div>
        <div class="icon-upload-info">
          <div class="icon-upload-title">App Icon</div>
          <div class="icon-upload-desc">PNG · 1024×1024 · Required for all platforms. No rounded corners — stores apply them automatically.</div>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('ob-icon-input').click()" style="margin-top:8px;">Choose file…</button>
        </div>
      </div>

      <div class="ob-section-label" style="margin-top:20px;">Screenshots</div>
      <div class="form-hint" style="margin-bottom:10px;">PNG or JPG · At least 1280×720 · Multiple files accepted</div>

      <div class="dropzone" id="ob-screenshot-dropzone"
           onclick="document.getElementById('ob-screenshot-input').click()"
           ondragover="event.preventDefault(); this.classList.add('is-over')"
           ondragleave="this.classList.remove('is-over')"
           ondrop="handleScreenshotDrop(event); this.classList.remove('is-over')">
        <div class="dropzone-icon">🖼</div>
        <div class="dropzone-label">Drop screenshots here, or click to browse</div>
        <div class="dropzone-hint">PNG or JPG · Multiple files accepted</div>
        <input type="file" id="ob-screenshot-input" multiple accept="image/*" style="display:none"
               onchange="handleScreenshotFiles(this.files); this.value=''">
      </div>
      <div class="asset-grid" id="ob-screenshot-grid"></div>

      ${hasAndroid ? `
      <div class="ob-section-label" style="margin-top:20px;">
        Feature Graphic
        <span class="platform-req-badge" style="background:#34A853;">Google Play</span>
      </div>
      <div class="form-hint" style="margin-bottom:10px;">Exactly 1024×500 JPG or PNG — required for Google Play.</div>
      <div class="dropzone dropzone-sm" id="ob-feature-dropzone"
           onclick="document.getElementById('ob-feature-input').click()"
           ondragover="event.preventDefault(); this.classList.add('is-over')"
           ondragleave="this.classList.remove('is-over')"
           ondrop="handleFeatureDrop(event); this.classList.remove('is-over')">
        <div class="dropzone-label">Drop feature graphic here, or click to browse</div>
        <div class="dropzone-hint">1024×500 · PNG or JPG</div>
        <input type="file" id="ob-feature-input" accept="image/*" style="display:none"
               onchange="handleFeatureFiles(this.files); this.value=''">
      </div>
      <div id="ob-feature-preview"></div>` : ''}

      <div class="ob-section-label" style="margin-top:20px;">Trailer <span class="form-section-note">Optional</span></div>
      <div class="trailer-options">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">YouTube URL</label>
          <input class="form-input" id="ob-trailer-url" type="url" placeholder="https://youtube.com/watch?v=..."
                 oninput="syncField('trailerUrl', this.value)">
        </div>
        <div class="trailer-divider">or upload a file</div>
        <div class="dropzone dropzone-sm" id="ob-trailer-dropzone"
             onclick="document.getElementById('ob-trailer-input').click()"
             ondragover="event.preventDefault(); this.classList.add('is-over')"
             ondragleave="this.classList.remove('is-over')"
             ondrop="handleTrailerDrop(event); this.classList.remove('is-over')">
          <div class="dropzone-label">Upload video file</div>
          <div class="dropzone-hint">MP4 · Max 500 MB</div>
          <input type="file" id="ob-trailer-input" accept="video/*" style="display:none"
                 onchange="handleTrailerFiles(this.files); this.value=''">
        </div>
        <div id="ob-trailer-file-info" style="display:none;"></div>
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
      <div class="questions-intro">
        Your answers populate iOS Privacy Nutrition Labels, Google Play Data Safety, and IARC ratings — so you don't fill them out separately per platform.
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

  // Localization toggle
  const toggle = document.getElementById('ob-locale-toggle');
  if (toggle) {
    toggle.classList.toggle('is-on', fd.localized);
    const picker = document.getElementById('ob-lang-picker');
    if (picker) picker.classList.toggle('is-open', fd.localized);
    // Restore chips
    if (fd.localizations.length) {
      document.querySelectorAll('#ob-lang-chips .lang-chip').forEach(btn => {
        const code = btn.getAttribute('onclick')?.match(/'([^']+)'\)$/)?.[1];
        if (code && fd.localizations.includes(code)) btn.classList.add('is-on');
      });
    }
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
        <div class="question-text">${q.label}</div>
        <div class="question-desc">${q.desc}</div>
        ${inferred && answer !== null ? `
          <div class="question-inferred">
            <span class="inferred-badge">Detected</span>
            <span class="inferred-answer">${answer === 'yes' ? 'Yes' : 'No'}</span>
            <button class="btn btn-ghost btn-sm" onclick="changeInferredAnswer('${q.id}')">Change</button>
          </div>` : `
          <div class="question-toggles">
            <button class="yn-btn ${answer === 'yes' ? 'is-yes' : ''}" onclick="answerQuestion('${q.id}','yes')">Yes</button>
            <button class="yn-btn ${answer === 'no'  ? 'is-no'  : ''}" onclick="answerQuestion('${q.id}','no')">No</button>
          </div>`}
      </div>`;
  }
  container.innerHTML = h;
}

/* re-exported so answerQuestion/changeInferredAnswer can call it */
function renderKeyQuestionsScreen() { renderComplianceQuestions(); }


/* ── Dashboard ───────────────────────────────────────── */

function renderDashboard() {
  const el = document.getElementById('dashboard');
  if (!el) return;

  // Update header game name
  const nameEl = document.getElementById('app-game-name');
  if (nameEl) nameEl.textContent = state.formData.title || 'Untitled Game';

  const active   = [...state.activePlatforms];
  const inactive = Object.keys(PLATFORMS).filter(pid => !state.activePlatforms.has(pid));

  let h = '';

  if (active.length === 0) {
    h += `
      <div class="dash-empty">
        <div class="dash-empty-icon">🎮</div>
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
}

function buildActiveCard(pid) {
  const p      = PLATFORMS[pid];
  const counts = platformStepCount(pid);
  const pct    = counts.total ? Math.round((counts.complete / counts.total) * 100) : 0;

  const steps = p.steps.map(step => {
    const status = state.platformStepStatus[pid][step.id];
    const done   = status === 'complete';

    if (step.isSubmit) {
      const locked = !counts.allRequired;
      return `
        <div class="card-task ${locked ? 'card-task-locked' : ''} ${done ? 'is-done' : ''}"
             onclick="${locked ? '' : `openTaskModal('${pid}','${step.id}')`}"
             ${locked ? 'title="Complete all tasks first"' : ''}>
          <div class="task-dot ${done ? 'is-complete' : 'is-submit'} ${locked ? 'is-locked' : ''}">
            ${done ? '✓' : ''}
          </div>
          <span class="task-label">${step.label}</span>
          ${locked ? '<span class="task-lock">🔒</span>' : '<span class="task-arrow">›</span>'}
        </div>`;
    }

    return `
      <div class="card-task ${done ? 'is-done' : ''}" onclick="openTaskModal('${pid}','${step.id}')">
        <div class="task-dot ${done ? 'is-complete' : ''}">
          ${done ? '✓' : ''}
        </div>
        <span class="task-label">${step.label}</span>
        <span class="task-arrow">›</span>
      </div>`;
  }).join('');

  return `
    <div class="active-card">
      <div class="active-card-head">
        <div class="active-card-platform">
          <div class="active-card-icon" style="color:${p.color};">
            ${platformIcon(pid, 18)}
          </div>
          <div>
            <div class="active-card-name">${p.label}</div>
            <div class="active-card-progress-label">${counts.complete} / ${counts.total} tasks</div>
          </div>
        </div>
        <button class="platform-toggle is-on" onclick="deactivatePlatform('${pid}')" title="Deactivate platform" aria-label="Toggle off"></button>
      </div>
      <div class="card-bar-wrap">
        <div class="card-bar">
          <div class="card-bar-fill" style="width:${pct}%; background:${p.color};"></div>
        </div>
      </div>
      <div class="card-tasks">${steps}</div>
    </div>`;
}

function buildInactiveCard(pid) {
  const p = PLATFORMS[pid];
  return `
    <div class="inactive-card">
      <div class="inactive-card-icon" style="color:${p.color};">
        ${platformIcon(pid, 16)}
      </div>
      <span class="inactive-card-name">${p.label}</span>
      <button class="platform-toggle" onclick="activatePlatform('${pid}')" title="Activate platform" aria-label="Toggle on"></button>
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
  const p        = PLATFORMS[platformId];
  const riskData = computeSubmitRisk();

  // Risk level order for sorting (worst first)
  const RISK_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 };
  const sorted = [...RISK_CATEGORIES].sort((a, b) =>
    RISK_ORDER[riskData[a.id]?.risk || 'NONE'] - RISK_ORDER[riskData[b.id]?.risk || 'NONE']
  );

  // Summary counts
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
      <button class="btn btn-ghost" onclick="closeSubmitModal()">Cancel</button>
      <button class="btn btn-primary submit-confirm-btn" onclick="confirmAndSubmit('${platformId}')">
        Confirm & Submit →
      </button>
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
