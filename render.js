/* ============================================================
   RENDER — pure functions that build UI from state
   ============================================================ */

/* ── Shared: HTML escape helper ──────────────────────── */
function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── i18n render helpers ─────────────────────────────── */
// These thin wrappers let render.js call PLATFORMS labels
// through the locale system without hard coupling to locale.js.

/** Platform display label — locale-aware */
function platLabel(pid) {
  if (typeof tPlat === 'function') return tPlat(pid);
  return PLATFORMS[pid]?.label || pid;
}

/** Step display label — locale-aware with PLATFORMS fallback */
function stepLabel(pid, step) {
  if (typeof tStep === 'function') return tStep(pid, step.id, step.label);
  return step.label;
}

/* ── Language menu ───────────────────────────────────── */
function renderLangMenu() {
  const el = document.getElementById('langMenu');
  if (!el || typeof getSupportedLanguages !== 'function') return;
  const current = typeof getCurrentLang === 'function' ? getCurrentLang() : 'en';
  el.innerHTML = getSupportedLanguages().map(l => {
    const isActive    = l.code === current;
    const isAvailable = l.code === 'en' || l.code === 'zh-CN';
    return `
    <button class="lang-menu-item${isActive ? ' is-active' : ''}${!isAvailable ? ' is-unavailable' : ''}"
            ${isAvailable ? `onclick="switchLanguage('${l.code}')"` : 'disabled'}
            ${!isAvailable ? 'title="Coming soon"' : ''}>
      <span class="lang-flag">${l.flag}</span>
      <span class="lang-name">${escHtml(l.label)}</span>
      ${isActive ? '<span class="lang-check">✓</span>' : ''}
      ${!isAvailable ? '<span class="lang-soon">Soon</span>' : ''}
    </button>`;
  }).join('');
}

/* ── Shared: platform icon SVG ───────────────────────── */

// Icons that use multi-subpath "cutout" designs need evenodd winding rule.
// iOS and PSN are solid compound paths — nonzero (default) renders them correctly.
const EVENODD_ICONS = new Set(['android', 'steam', 'egs', 'xbox', 'nintendo']);

// Color and white asset variants — keyed by platform ID.
// Missing entries fall back to the inline SVG from PLATFORM_ICONS.
const PLATFORM_ASSET = {
  ios:      'Assets/Platform_Icons/AppStore.png',
  android:  'Assets/Platform_Icons/GooglePlay.webp',
  steam:    'Assets/Platform_Icons/Steam.png',
  psn:      'Assets/Platform_Icons/PlayStation.jpg',
  xbox:     'Assets/Platform_Icons/Xbox.png',
  nintendo: 'Assets/Platform_Icons/Nintendo.png',
};
// White-variant: user's actual PNG files for platforms where the PNG has a
// transparent background — CSS filter whitens the opaque logo pixels.
// Platforms not listed here (ios, android, steam) fall back to inline SVG paths.
const PLATFORM_ASSET_WHITE = {
  psn:      'Assets/Platform_Icons/PlayStation_white.png', // pre-processed transparent bg
  xbox:     'Assets/Platform_Icons/Xbox.png',              // transparent bg → filter whitens
  nintendo: 'Assets/Platform_Icons/Nintendo.png',          // transparent bg → filter whitens
};

// Per-platform visual scale tweaks (applied on top of the requested size).
const PLATFORM_ICON_SCALE = {
  ios: 1.15,
  psn: 1.15,
};

// variant: 'color' (default) | 'white'
function platformIcon(id, size = 20, variant = 'color') {
  size = Math.round(size * (PLATFORM_ICON_SCALE[id] || 1));
  const map = variant === 'white' ? PLATFORM_ASSET_WHITE : PLATFORM_ASSET;
  if (map[id]) {
    return `<img src="${map[id]}" width="${size}" height="${size}" alt="${id}" class="plat-img" aria-hidden="true">`;
  }
  const fillRule = EVENODD_ICONS.has(id) ? ' fill-rule="evenodd" clip-rule="evenodd"' : '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" overflow="visible" fill="currentColor"${fillRule} aria-hidden="true"><path d="${PLATFORM_ICONS[id]}"/></svg>`;
}


/* ── Onboarding ──────────────────────────────────────── */

/* ── Tab icons: dot-grid SVGs (5×5, cell=3px, gap=1.5px, step=4.5) ── */
const OB_TAB_DEFS = [
  { labelKey: 'ob.tab.about',        icon: () => `<img src="Assets/Icon_About.png"        class="ob-tab-img" alt="">` },
  { labelKey: 'ob.tab.distribution', icon: () => `<img src="Assets/Icon_Distribution.png" class="ob-tab-img" alt="">` },
  { labelKey: 'ob.tab.assets',       icon: () => `<img src="Assets/Icon_Assets.png"       class="ob-tab-img" alt="">` },
];


/* Returns 0–1 completion fraction for a given tab index */
function getTabProgress(tabIdx) {
  const tabSections = [
    ['about', 'platforms'],   // About
    ['distribution'],         // Distribution (localization defaults to en, always answered)
    ['screenshots'],          // Assets
  ];
  const ids = tabSections[tabIdx] || [];
  if (!ids.length) return 0;
  const answered = ids.filter(id => OB_SECTION_ANSWERED[id]?.()).length;
  return answered / ids.length;
}

function renderOnboarding() {
  // Update static header text from locale
  const headline = document.querySelector('.ob-headline');
  const subline  = document.querySelector('.ob-subline');
  if (headline && typeof t === 'function') headline.textContent = t('ob.headline');
  if (subline  && typeof t === 'function') subline.textContent  = t('ob.subline');
  renderOnboardingTabs();
  renderOnboardingBody();
  renderOnboardingFooter();
  renderLangMenu();
}

function renderOnboardingTabs() {
  const tabsEl = document.getElementById('ob-tabs');
  if (!tabsEl) return;
  tabsEl.innerHTML = OB_TAB_DEFS.map((def, i) => {
    const isActive = i === state.onboardingTab;
    const progress = getTabProgress(i);
    const label    = (typeof t === 'function') ? t(def.labelKey) : def.labelKey;
    return `
      <button class="ob-tab${isActive ? ' is-active' : ''}"
              style="--tab-progress:${progress.toFixed(3)}"
              onclick="setOnboardingTab(${i})"
              aria-selected="${isActive}">
        <span class="ob-tab-icon">${def.icon()}</span>
        <span>${label}</span>
      </button>`;
  }).join('');
}

function renderOnboardingBody() {
  const el = document.getElementById('ob-body');
  if (!el) return;
  if (state.onboardingTab === 0) el.innerHTML = buildAboutTab();
  if (state.onboardingTab === 1) { el.innerHTML = buildDistributionTab(); requestAnimationFrame(() => initObDistMap()); }
  if (state.onboardingTab === 2) el.innerHTML = buildAssetsTab();
  // Hydrate form fields from state (each helper is a no-op if its elements aren't in the DOM)
  hydrateGameDetailsTab();
  hydrateUploadAssetsTab();
  renderOnboardingScreenshotGrid();
  renderOnboardingFeaturePreview();
  // Set amber rail state for all sections based on current form values
  updateObSectionStates();
}

function renderOnboardingFooter() {
  const el = document.getElementById('ob-footer');
  if (!el) return;
  const isLast  = state.onboardingTab === 2;
  const isFirst = state.onboardingTab === 0;
  const hasPlat = state.activePlatforms.size > 0;
  el.innerHTML = `
    <div class="ob-footer-inner">
      <button class="btn btn-ghost" onclick="prevOnboardingTab()" ${isFirst ? 'style="visibility:hidden"' : ''}>${t('ob.footer.back')}</button>
      <div class="ob-step-dots">
        ${[0,1,2,3].map(i => `<span class="ob-dot ${i === state.onboardingTab ? 'is-active' : (i < state.onboardingTab ? 'is-done' : '')}"></span>`).join('')}
      </div>
      <button class="btn btn-primary" onclick="${isLast ? 'completeOnboarding()' : 'nextOnboardingTab()'}">
        ${isLast ? t('ob.footer.launch') : t('ob.footer.next')}
      </button>
    </div>`;
}

/* Tab 0: About */
function buildAboutTab() {
  const fd = state.formData;
  return `
    <div class="ob-form">

      <!-- ── About your game ── -->
      <div class="ob-section" id="ob-sec-about">
        
        <div class="ob-q" id="ob-q-title" data-answered="${fd.title?.trim() ? '1' : '0'}">
          <label class="form-label" for="ob-title">${t('ob.field.title.label') || 'Game Title'}</label>
          <div class="title-search-wrap">
            <div class="form-group">
              <input class="form-input" id="ob-title" type="text" maxlength="50" required
                     placeholder="${t('ob.field.title.placeholder') || 'e.g. Go Ape Ship!'}"
                     autocomplete="off"
                     oninput="syncField('title', this.value); charCount('ob-title-count', this.value, 30); _onTitleInputScenario(this.value)"
                     onfocus="_onTitleFocus(this.value)"
                     onblur="_onTitleBlur()">
              <div class="char-count" id="ob-title-count">0 / 30</div>
            </div>
            <div id="ob-title-picklist" class="title-picklist"></div>
          </div>
        </div>

        <div id="ob-scenario-wrap">
          ${buildScenarioWidget()}
        </div>

        <div class="ob-q" id="ob-q-desc" data-answered="${fd.description?.trim() ? '1' : '0'}">
          <label class="form-label" for="ob-desc">${t('ob.field.desc.label') || 'Description'}</label>
          <div class="form-group">
            <textarea class="form-input" id="ob-desc" rows="5" required
                      placeholder="${t('ob.field.desc.placeholder') || 'Tell players what makes your game worth their time...'}"
                      oninput="syncField('description', this.value); charCount('ob-desc-count', this.value, 4000)"></textarea>
            <div class="char-count" id="ob-desc-count">0 / 4000</div>
          </div>
        </div>
      </div>

      <div class="ob-sec-divider"></div>

      <!-- ── Platforms ── -->
      <div class="ob-section" id="ob-sec-platforms">
        <div class="ob-section-hdr">${t('ob.section.about.platforms') || 'Target Platforms'}</div>
        <div class="ob-q" id="ob-q-platforms" data-answered="${state.activePlatforms.size > 0 ? '1' : '0'}">
          <div id="ob-plat-grid-wrap" class="ob-req-group ${state.activePlatforms.size === 0 ? 'is-req-empty' : ''}">${buildObPlatTilesHTML()}</div>
        </div>
      </div>

    </div>`;
}

/* Tab 1: Distribution */
function buildDistributionTab() {
  const fd = state.formData;
  const knownPresets = ['everywhere','english_only','minimize_regulation','custom'];
  const dPreset = knownPresets.includes(fd.distributionPreset) ? fd.distributionPreset : null;

  const distPresets = [
    { id:'everywhere',          label: t('ob.dist.preset.everywhere') || 'Everywhere' },
    { id:'english_only',        label: t('ob.dist.preset.english_only') || 'English only' },
    { id:'minimize_regulation', label: t('ob.dist.preset.minimize_reg') || 'Minimize regulation' },
    { id:'custom',              label: t('ob.dist.preset.custom') || 'Custom' },
  ];

  return `
    <div class="ob-form">

      <!-- ── Distribution ── -->
      <div class="ob-section" id="ob-sec-distribution">
        <div class="ob-section-hdr">${t('ob.section.distribution') || 'Distribution'}</div>

        <div id="ob-dist-map-container" class="world-map-container" style="margin-bottom:14px;"></div>

        <div class="ob-q" id="ob-q-distribution" data-answered="${dPreset ? '1' : '0'}">
          <span class="ob-dist-question">${t('ob.dist.question') || 'Where do you intend to make the game available?'}</span>

          <div id="ob-dist-preset-group" class="ob-req-group ${!dPreset ? 'is-req-empty' : ''}" style="margin-bottom:10px;">
            <div class="ob-preset-pills">
              ${distPresets.map(p => `
                <button class="ob-preset-pill ${dPreset === p.id ? 'is-active' : ''}"
                        data-preset="${p.id}"
                        onclick="setObDistPreset('${p.id}')">${p.label}</button>`).join('')}
            </div>
          </div>
        </div>

        <div class="sw-tip-box" style="margin-bottom:10px;">
          <img src="Assets/SubwooferIcon_Orange.png" class="sw-tip-logo" alt="">
          <span class="sw-tip-text"><strong class="sw-tip-bold">Shipmate Tip:</strong> ${t('tip.distribution.regions') || 'Gamer behavior varies significantly between regions. A successful launch carefully considers localization, culturalization, purchase behavior, and market fit in each region.'}</span>
        </div>

        <div id="ob-country-list-wrap">${buildObCountryChips()}</div>
      </div>

      <div class="ob-sec-divider"></div>

      <!-- ── Localization ── -->
      <div class="ob-section" id="ob-sec-localization">
        <div class="ob-section-hdr">${t('ob.section.localization') || 'Localization'}</div>

        <div class="sw-tip-box" style="margin-bottom:12px;">
          <img src="Assets/SubwooferIcon_Orange.png" class="sw-tip-logo" alt="">
          <span class="sw-tip-text"><strong class="sw-tip-bold">Shipmate Tip:</strong> ${t('tip.distribution.languages') || 'On average, games see 30–50% more revenue in markets where they support the local language vs. English-only releases. The highest-impact localization for your selected markets is highlighted below.'}</span>
        </div>

        <div id="ob-lang-list-wrap">${buildObLangList()}</div>
      </div>

    </div>`;
}

/* ── Release Timing — platform review data & helpers ─── */

const OB_PLATFORM_TIMING = {
  ios:      { days: 2.2, color: '#60a5fa', label: 'App Store'   },
  android:  { days: 4.3, color: '#4ade80', label: 'Google Play' },
  steam:    { days: 7.1, color: '#38bdf8', label: 'Steam Store' },
  egs:      { days: 3.0, color: '#e2e2e2', label: 'Epic Games'  },
  xbox:     { days: 5.0, color: '#22c55e', label: 'Xbox'        },
  nintendo: { days: 5.0, color: '#ef4444', label: 'Nintendo'    },
  psn:      { days: 4.0, color: '#818cf8', label: 'PlayStation' },
};

function fmtDateShort(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Add fractional days to a date (uses floor for display)
function _addDays(base, days) {
  return new Date(base.getTime() + days * 86400000);
}

function buildReleaseTimingContent() {
  const fd = state.formData;
  const rt = fd.releaseTiming || 'manual';

  if (rt === 'manual') {
    return `<div class="ob-timing-manual-msg">Each platform sits at <strong>Ready</strong> after review. You press go per platform.</div>`;
  }

  // Build sorted review data from active platforms
  const reviewData = [...state.activePlatforms]
    .filter(p => OB_PLATFORM_TIMING[p])
    .map(p => ({ id: p, ...OB_PLATFORM_TIMING[p] }))
    .sort((a, b) => a.days - b.days);

  if (!reviewData.length) {
    return `<div class="ob-timing-manual-msg">Select at least one platform above to see your submission timeline.</div>`;
  }

  if (rt === 'as_approved') {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const maxDays = Math.max(...reviewData.map(r => r.days));
    const minDays = Math.min(...reviewData.map(r => r.days));
    const stagger = (maxDays - minDays).toFixed(1);

    const rows = reviewData.map(r => {
      const pct      = (r.days / maxDays) * 100;
      const midPct   = pct / 2;
      const liveDate = fmtDateShort(_addDays(today, r.days));
      // Right-align date label for the max-days bar to prevent bleeding past the track edge
      const isMaxBar     = r.days === maxDays;
      const dateLblStyle = isMaxBar
        ? 'right:0;transform:none;text-align:right;'
        : `left:${pct.toFixed(1)}%;transform:translateX(-50%);`;
      return `
        <div class="ob-timing-row">
          <div class="ob-timing-label">
            <span class="ob-timing-plat-dot" style="background:${r.color}"></span>
            <span>${r.label}</span>
          </div>
          <div class="ob-timing-track">
            <div class="ob-timing-bar-line" style="width:${pct.toFixed(1)}%;background:${r.color}"></div>
            <div class="ob-timing-hdot" style="left:0"></div>
            <div class="ob-timing-fdot" style="left:${pct.toFixed(1)}%;background:${r.color};border-color:${r.color}"></div>
            <div class="ob-timing-lead-lbl" style="left:${midPct.toFixed(1)}%">${r.days} day average</div>
            <div class="ob-timing-date-lbl" style="${dateLblStyle}">${liveDate}</div>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="ob-timing-panel">
        ${rows}
        <div class="ob-timing-ruler"><span>Today</span></div>
      </div>
      <div class="ob-timing-footer">For a coordinated launch, pick a specific date.</div>`;
  }

  if (rt === 'specific_date') {
    const dateVal  = fd.releaseDate;
    const liveDate = dateVal ? new Date(dateVal + 'T00:00:00') : null;

    let panelHtml  = '';
    let footerHtml = '';

    if (liveDate && !isNaN(liveDate)) {
      // RECOMMENDED = LIVE − reviewDays × 2  (doubled buffer, matches published platform guidance)
      // SUBMIT BY   = LIVE − reviewDays
      const maxLead = Math.max(...reviewData.map(r => r.days * 2));
      const spanDays = maxLead + 1; // +1d left-side breathing room

      const rows = reviewData.map(r => {
        const recDate    = _addDays(liveDate, -(r.days * 2));
        const subDate    = _addDays(liveDate, -r.days);
        const recPct     = ((spanDays - r.days * 2) / spanDays) * 100;
        const subPct     = ((spanDays - r.days)     / spanDays) * 100;
        const solidW     = 100 - subPct;
        const dashW      = subPct - recPct;
        const leadMidPct = subPct + solidW / 2;

        return `
          <div class="ob-timing-row">
            <div class="ob-timing-label">
              <span class="ob-timing-plat-dot" style="background:${r.color}"></span>
              <span>${r.label}</span>
            </div>
            <div class="ob-timing-track ob-timing-track--sd">
              <!-- 1. Faint gray line: left edge → recommended date -->
              <div class="ob-timing-faint-line" style="width:${recPct.toFixed(1)}%"></div>
              <!-- 2. Dotted line: recommended → submit-by -->
              <div class="ob-timing-dash-line" style="left:${recPct.toFixed(1)}%;width:${dashW.toFixed(1)}%"></div>
              <!-- 3. Solid colored line: submit-by → live -->
              <div class="ob-timing-solid-line" style="left:${subPct.toFixed(1)}%;width:${solidW.toFixed(1)}%;background:${r.color}"></div>
              <!-- Open dot at recommended (dashed border) -->
              <div class="ob-timing-hdot ob-timing-hdot--rec" style="left:${recPct.toFixed(1)}%"></div>
              <!-- Open dot at submit-by -->
              <div class="ob-timing-hdot" style="left:${subPct.toFixed(1)}%"></div>
              <!-- Filled dot at live -->
              <div class="ob-timing-fdot" style="left:100%;background:${r.color};border-color:${r.color}"></div>
              <!-- Label above solid section -->
              <div class="ob-timing-lead-lbl" style="left:${leadMidPct.toFixed(1)}%">${r.days}d lead</div>
              <!-- Labels below line -->
              <div class="ob-timing-rec-lbl" style="left:${recPct.toFixed(1)}%"><span class="ob-timing-rec-tag">RECOMMENDED</span><br>${fmtDateShort(recDate)}</div>
              <div class="ob-timing-date-lbl" style="left:${subPct.toFixed(1)}%">${fmtDateShort(subDate)}</div>
            </div>
          </div>`;
      }).join('');

      // "Minimum submit by" = latest submit-by date (shortest review platform)
      const minSubmitBy = fmtDateShort(_addDays(liveDate, -reviewData[0].days));

      panelHtml = `
        <div class="ob-timing-panel">
          ${rows}
          <div class="ob-timing-live-label">LIVE &middot; ${fmtDateShort(liveDate)}</div>
        </div>`;
      footerHtml = `<div class="ob-timing-footer"><strong>Recommended</strong> dates include each platform&rsquo;s published buffer for re-reviews &amp; propagation.</div>`;
    } else {
      panelHtml = `<div class="ob-timing-manual-msg" style="margin-top:4px;">Enter a launch date to see your submission timeline.</div>`;
    }

    return `
      <div class="ob-timing-launch-row" style="margin-bottom:12px;">
        <span class="ob-timing-launch-tag">Launch</span>
        <input class="form-input ob-timing-date-input" id="ob-date" type="date" value="${escHtml(dateVal || '')}"
               onchange="syncField('releaseDate', this.value); _refreshTimingContent()">
      </div>
      ${panelHtml}
      ${footerHtml}`;
  }

  return '';
}

/* ── Onboarding list helpers ─────────────────────────── */

const OB_LANG_NAMES = {
  en:'English', zh:'Chinese (Simplified)', 'zh-TW':'Chinese (Traditional)',
  ja:'Japanese', ko:'Korean',
  pt:'Portuguese', 'pt-BR':'Portuguese (Brazilian)', es:'Spanish',
  'es-419':'Spanish (Latin America)', de:'German', fr:'French',
  ru:'Russian', ar:'Arabic', tr:'Turkish', id:'Indonesian',
  th:'Thai', nl:'Dutch', pl:'Polish', it:'Italian', sv:'Swedish',
  nb:'Norwegian', da:'Danish', fi:'Finnish', cs:'Czech',
  hu:'Hungarian', ro:'Romanian', uk:'Ukrainian', vi:'Vietnamese',
  ms:'Malay', he:'Hebrew', el:'Greek',
};

function _obFmtGamers(n) { return n >= 1 ? `${n}M` : '<1M'; }

function _obListHeader(leftLabel) {
  return `
    <div class="ob-list-header">
      <span class="ob-list-col-name">${leftLabel}</span>
      <span class="ob-list-col-count">iOS Gamers</span>
    </div>`;
}

/* Regulatory extra-steps tooltip map — countries requiring non-standard compliance */
const OB_REG_TIPS = {
  CN: 'Requires an ISBN game license from China\'s NPPA and a licensed local publishing partner. Foreign companies cannot self-publish.',
  KR: 'Mandatory age rating from Korea\'s Game Rating and Administration Committee (GRAC) before any distribution.',
  JP: 'CERO age rating required. Some content categories (extreme violence, adult themes) may be rejected or require edits.',
  DE: 'USK age rating required. Certain content (hate symbols, excessive gore) is banned. USK-18 titles face advertising restrictions.',
  AU: 'ACB classification required. Games refused classification cannot be sold. Content thresholds differ from US/EU standards.',
  BR: 'CLASSIND age rating required for Brazilian app stores. Content descriptors must match local rating system.',
  SA: 'Content must be approved by the General Authority for Audiovisual Media. Religious and political content is strictly restricted.',
  ID: 'Ministry of Communication and Information Technology registration required. Local content rules apply.',
  VN: 'Ministry of Information and Communications approval required before launch. Foreign games need a licensed local partner.',
  NL: 'Paid loot boxes face gambling-law scrutiny; some mechanics may require modification or legal review.',
  BE: 'Paid loot boxes are classified as illegal gambling. Games with paid randomized rewards risk fines or a sales ban.',
  RU: 'Roskomnadzor content oversight applies. Geopolitical sanctions may complicate payment processing and distribution.',
  ZA: 'Film and Publication Board (FPB) classification required. Unclassified games may not be sold commercially.',
};

/** Regulatory tip: prefers locale key, falls back to OB_REG_TIPS const.
 *  Guards against locale returning the key string itself (meaning "not found"). */
function regTip(code) {
  const key = `reg.tip.${code.toLowerCase()}`;
  const localeVal = typeof t === 'function' ? t(key) : null;
  return (localeVal && localeVal !== key ? localeVal : null) || OB_REG_TIPS[code] || '';
}

const _chevDown = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
const _chevUp   = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`;

/* ── IGDB title picklist ─────────────────────────────── */

// Canonical sort order for platform icons in the picklist
const _PLAT_ORDER = ['steam', 'ios', 'android', 'psn', 'xbox', 'nintendo'];

function buildTitlePicklist() {
  const items = state.titlePicklist || [];
  if (!items.length) return '';
  return items.map(item => {
    const thumb = item.coverUrl
      ? `<img src="${escHtml(item.coverUrl)}" alt="" class="picklist-thumb" loading="lazy">`
      : `<div class="picklist-thumb picklist-thumb-empty"></div>`;
    // Sort found platforms into canonical order, then cap at 6
    const platSet   = new Set(item.platforms);
    const sorted    = _PLAT_ORDER.filter(p => platSet.has(p));
    // Any platforms not in canonical order go at the end
    item.platforms.forEach(p => { if (!_PLAT_ORDER.includes(p)) sorted.push(p); });
    const tiles = sorted.slice(0, 6).map(pid => {
      const label = (PLATFORMS[pid] && PLATFORMS[pid].label) || pid;
      const icon  = platformIcon(pid, 14, 'white');
      return `<div class="plat-tile active" title="${escHtml(label)}">${icon}</div>`;
    }).join('');
    const grid = tiles ? `<div class="picklist-plat-grid">${tiles}</div>` : '';
    const desc = item.summary
      ? (item.summary.length > 90 ? item.summary.slice(0, 90) + '…' : item.summary)
      : '';
    return `
      <div class="picklist-row" onmousedown="_cancelPicklistClose()" onclick="selectPicklistItem(${item.id})">
        ${thumb}
        <div class="picklist-info">
          <div class="picklist-name">${escHtml(item.name)}</div>
          ${desc ? `<div class="picklist-desc">${escHtml(desc)}</div>` : ''}
        </div>
        ${grid}
      </div>`;
  }).join('');
}

/* ── Store search result widget ──────────────────────── */
function buildScenarioWidget() {
  const ls = state.liveSearch;

  // Loading
  if (ls && ls.status === 'loading') {
    const title = state.formData.title || 'your game';
    return `
      <div class="ob-live-loading">
        <div class="ob-live-spinner"></div>
        <span>Searching stores for &ldquo;${escHtml(title)}&rdquo;&hellip;</span>
      </div>`;
  }

  // Confirmed import — compact success note
  if (ls && ls.status === 'done' && ls.confirmed) {
    const storeLabels = { ios: 'App Store', steam: 'Steam', android: 'Google Play', egs: 'Epic', xbox: 'Xbox', nintendo: 'Nintendo', psn: 'PlayStation' };
    const stores = (ls.allStores || []).map(pid => storeLabels[pid] || pid);
    return `
      <div class="ob-search-confirm">
        <svg viewBox="0 0 16 16" fill="none" width="13" height="13" aria-hidden="true" style="flex-shrink:0">
          <path d="M3 8l3.5 3.5L13 5" stroke="var(--green)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Imported from ${escHtml(stores.join(' · '))} — description and platforms filled in.</span>
      </div>`;
  }

  // Found — result card
  if (ls && ls.status === 'done' && ls.found) {
    const storeLabels = { ios: 'App Store', steam: 'Steam', android: 'Google Play', egs: 'Epic', xbox: 'Xbox', nintendo: 'Nintendo', psn: 'PlayStation' };
    const stores = (ls.allStores || []).map(pid => storeLabels[pid] || pid);
    const desc = ls.description
      ? (ls.description.length > 220 ? ls.description.slice(0, 220) + '…' : ls.description)
      : '';
    return `
      <div class="ob-search-result">
        <div class="ob-search-result-name">${escHtml(ls.title || state.formData.title || '')}</div>
        ${desc ? `<div class="ob-search-result-desc">${escHtml(desc)}</div>` : ''}
        ${stores.length ? `
          <div class="ob-search-result-stores">
            ${stores.map(n => `<span class="ob-search-store-chip">${escHtml(n)}</span>`).join('')}
          </div>` : ''}
        <div class="ob-search-result-actions">
          <button class="btn btn-primary" onclick="confirmGameImport()">That&rsquo;s it!</button>
          <button class="btn btn-ghost" onclick="rejectGameImport()">Nope</button>
        </div>
      </div>`;
  }

  // Not found — quiet note
  if (ls && ls.status === 'done' && !ls.found) {
    return `<div class="ob-live-not-found">${t('ob.scenario.not_found') || 'Couldn’t find your game in stores — fill in the description below.'}</div>`;
  }

  // No result yet (null) or error — show nothing
  return '';
}

/* ── Scenario widget (dead code, kept to avoid reference errors) ── */
function _legacyScenarioWidget_unused() {
  const gs = state.formData.gameScenario;
  const ls = state.liveSearch;
  const needsSearch = gs === 'new_platform' || gs === 'update';

  const scenarios = [
    { v: 'new',          label: 'New Game'     },
    { v: 'new_platform', label: 'New Platform' },
    { v: 'update',       label: 'New Update'   },
  ];

  const chips = scenarios.map(s => `
    <button class="ob-scenario-chip${gs === s.v ? ' is-on' : ''}"
            onclick="setGameScenario('${s.v}')">${escHtml(s.label)}</button>
  `).join('');

  let resultHtml = '';
  if (needsSearch) {
    if (!ls || ls.status === 'loading') {
      const title = state.formData.title || 'your game';
      resultHtml = `
        <div class="ob-live-loading">
          <div class="ob-live-spinner"></div>
          <span>Searching stores for &ldquo;${escHtml(title)}&rdquo;&hellip;</span>
        </div>`;
    } else if (ls.status === 'done' && ls.confirmed) {
      const storeMap = { ios: 'iOS App Store', steam: 'Steam', android: 'Google Play' };
      const storeNames = (ls.allStores || []).map(pid => storeMap[pid] || pid);
      const sourceStr  = storeNames.length ? storeNames.join(' & ') : (ls.source || 'store listing');
      const platNote   = storeNames.length ? ' &mdash; platforms pre-selected.' : '.';
      resultHtml = `
        <div class="sw-tip-box" style="margin-bottom:0;align-items:center;">
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14" aria-hidden="true" style="flex-shrink:0">
            <path d="M3 8l3.5 3.5L13 5" stroke="#4ade80" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="sw-tip-text"><strong class="sw-tip-bold">Found on ${escHtml(sourceStr)}</strong>${platNote}</span>
        </div>`;
    } else if (ls.status === 'done' && ls.found) {
      resultHtml = `
        <div class="sw-tip-box" style="margin-bottom:0;">
          <img src="Assets/SubwooferIcon_Orange.png" class="sw-tip-logo" alt="">
          <div class="sw-tip-text">
            <div><strong class="sw-tip-bold">Shipmate Tip:</strong> We found this on ${escHtml(ls.source || 'the store')}.</div>
            <div class="ob-live-found-desc" style="margin-top:6px;">${escHtml(ls.description || '')}</div>
            <div class="ob-live-found-actions" style="margin-top:8px;">
              <button class="btn btn-primary" style="font-size:12px;padding:5px 14px;" onclick="confirmGameImport()">That&rsquo;s mine!</button>
              <button class="btn btn-ghost" style="font-size:12px;padding:5px 14px;" onclick="rejectGameImport()">Not me</button>
            </div>
          </div>
        </div>`;
    } else if (ls.status === 'done' && !ls.found) {
      resultHtml = `
        <div class="ob-live-not-found">
          We couldn&rsquo;t find &ldquo;${escHtml(state.formData.title || 'your game')}&rdquo; in our stores database — fill in the description below.
        </div>`;
    } else if (ls.status === 'error') {
      resultHtml = `
        <div class="ob-live-not-found">
          Search unavailable — fill in the description below.
        </div>`;
    }
  }

  return `
    <div class="ob-scenario">
      <div class="ob-scenario-chips">${chips}</div>
      ${resultHtml}
    </div>`;
}

/* ── Country row list ── first 10 always visible, rest collapsible ── */
function buildObCountryChips() {
  const fd         = state.formData;
  const selected   = new Set(fd.selectedCountries || []);
  const maxGamers  = IOS_COUNTRIES[0]?.iosGamers || 1;
  const extraCount = Math.max(0, IOS_COUNTRIES.length - 10);

  const buildRow = (c, i) => {
    const isOn   = selected.has(c.code);
    const barPct = Math.round((c.iosGamers / maxGamers) * 100);
    const regTipText = regTip(c.code);
    const regTipHtml = regTipText
      ? `<span class="tooltip-anchor" data-tip="${regTipText}" onclick="event.stopPropagation()"><span class="tooltip-icon${isOn ? ' is-warned' : ''}">?</span></span>`
      : '';
    return `
      <div class="ob-dist-row${isOn ? ' is-on' : ''}"
           data-code="${c.code}"
           onclick="toggleObCountry('${c.code}')">
        <div class="ob-dist-row-chip${isOn ? ' is-on' : ''}" id="ob-dist-chip-${c.code}">
          ${c.name}${regTipHtml}
        </div>
        <div class="ob-dist-row-bar-wrap">
          <div class="ob-dist-row-bar-fill" style="width:${barPct}%"></div>
        </div>
        <span class="ob-dist-row-count">${_obFmtGamers(c.iosGamers)}</span>
      </div>`;
  };

  const topRows   = IOS_COUNTRIES.slice(0, 10).map(buildRow).join('');
  const extraRows = IOS_COUNTRIES.slice(10).map(buildRow).join('');

  return `
    <div class="ob-dist-table-header">
      <span class="ob-dist-col-market">Market</span>
      <span class="ob-dist-col-count">iOS Gamers (approx)</span>
    </div>
    <div class="ob-dist-country-list" id="ob-dist-country-list">${topRows}</div>
    ${extraCount > 0 ? (() => {
      const hiddenSelected = IOS_COUNTRIES.slice(10).filter(c => selected.has(c.code)).length;
      const badge = hiddenSelected > 0
        ? `<span class="ob-dist-hidden-badge" title="${hiddenSelected} selected market${hiddenSelected > 1 ? 's' : ''} below — expand to review">${hiddenSelected} selected ↓</span>`
        : '';
      return `
    <button class="ob-dist-expand-btn" id="ob-dist-expand-btn" onclick="toggleObDistExpand(this)">
      ${_chevDown} Show ${extraCount} more markets${badge}
    </button>
    <div class="ob-dist-country-list hidden" id="ob-dist-country-list-extra">${extraRows}</div>`;
    })() : ''}`;
}

/* ── Legacy alias ── */
function buildObCountryList() { return buildObCountryChips(); }

/* ── Platform chips (text-only multi-select, same style as lang chips) ── */
function buildObPlatTilesHTML() {
  const PLATFORMS_OB = [
    { id:'ios',      label:'App Store',         comingSoon: false },
    { id:'android',  label:'Google Play',        comingSoon: false },
    { id:'steam',    label:'Steam',              comingSoon: false },
    { id:'egs',      label:'Epic Games Store',   comingSoon: true  },
    { id:'nintendo', label:'Nintendo eShop',     comingSoon: true  },
    { id:'psn',      label:'PlayStation Store',  comingSoon: true  },
    { id:'xbox',     label:'Xbox Store',         comingSoon: true  },
  ];
  const lockSVG = `<svg class="ob-plat-lock" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="6" width="8" height="7" rx="1.5" fill="currentColor" opacity="0.5"/><path d="M4 6V4a2 2 0 1 1 4 0v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity="0.5"/></svg>`;
  const tiles = PLATFORMS_OB.map(({ id, label, comingSoon }) => {
    if (comingSoon) {
      return `<button class="ob-plat-tile ob-plat-tile-cs" disabled title="${label} — coming soon">
        ${platformIcon(id, 28, 'color')}
        ${lockSVG}
      </button>`;
    }
    const isOn = state.activePlatforms.has(id);
    return `<button class="ob-plat-tile${isOn ? ' is-on' : ''}"
                    onclick="toggleOnboardingPlatform('${id}')"
                    title="${label}">
      ${platformIcon(id, 28, 'white')}
    </button>`;
  }).join('');
  return `<div class="ob-plat-tile-row">${tiles}</div>`;
}

/* ── Language picker ── two-row: primary (amber dropdown) + supported (green chips) */
// Industry-standard localization set (EFIGS + CJK + PT) — always shown
const OB_LANG_FEATURED = ['en','zh','ja','ko','es','pt','fr','de','it'];

// Region labels for each language code
const OB_LANG_REGIONS = {
  en:'Global', zh:'CN', 'zh-TW':'TW', ja:'JP', ko:'KR',
  es:'ES', 'es-419':'LATAM', pt:'PT', 'pt-BR':'BR', fr:'FR', de:'DE', it:'IT',
  ru:'RU', ar:'MENA', tr:'TR', id:'ID', th:'TH',
  nl:'NL', pl:'PL', sv:'SE', nb:'NO', da:'DK', fi:'FI',
  cs:'CZ', hu:'HU', ro:'RO', uk:'UA', vi:'VN',
  ms:'MY', he:'IL', el:'GR',
};

/* ── Find highest-impact unselected featured language ── */
function _highestImpactUnselectedLang() {
  const fd = state.formData;
  const primary  = fd.primaryLanguage || 'en';
  const selected = new Set(fd.localizations || []);
  // Use selected countries, or fall back to all countries if none chosen yet
  const countries = new Set(
    (fd.selectedCountries && fd.selectedCountries.length > 0)
      ? fd.selectedCountries
      : IOS_COUNTRIES.map(c => c.code)
  );

  const candidates = OB_LANG_FEATURED.filter(l => l !== primary && !selected.has(l));

  let best = null, bestTotal = 0;
  for (const lang of candidates) {
    const total = IOS_COUNTRIES
      .filter(c => countries.has(c.code) && c.lang === lang)
      .reduce((sum, c) => sum + (c.iosGamers || 0), 0);
    if (total > bestTotal) { bestTotal = total; best = lang; }
  }
  return { lang: best, total: bestTotal };
}

function buildObLangList() {
  const fd       = state.formData;
  const primary  = fd.primaryLanguage || 'en';
  const selected = new Set(fd.localizations || []);
  const count    = selected.size;
  const primaryName = OB_LANG_NAMES[primary] || primary;

  // Find the highest-impact unselected lang for the Shipmate tip
  const { lang: tipLang, total: tipTotal } = _highestImpactUnselectedLang();

  // Primary language dropdown items
  const allLangCodes = Object.keys(OB_LANG_NAMES);
  const ddItems = allLangCodes.map(lang => {
    const isCur = lang === primary;
    return `
      <button class="loc-dd-item${isCur ? ' is-current' : ''}"
              onclick="selectLocPrimary('${lang}')">
        <span class="loc-dd-name">${OB_LANG_NAMES[lang] || lang}</span>
      </button>`;
  }).join('');

  // Featured chips (minus primary)
  const featuredSet = new Set(OB_LANG_FEATURED);
  const chipLangs = OB_LANG_FEATURED.filter(l => l !== primary);

  // Non-featured langs that were added via [+]
  const extraSelected = [...selected].filter(l => !featuredSet.has(l) && l !== primary);

  const buildChip = (lang) => {
    const isOn = selected.has(lang);
    const isTipVisible = lang === tipLang && !isOn && tipTotal > 0;
    const tipBadge = isTipVisible
      ? `<span class="sw-tip-chip-badge tooltip-anchor" data-tip="${t('tip.lang.reach', { lang: OB_LANG_NAMES[lang], total: tipTotal }) || ('Shipmate Tip: adding ' + OB_LANG_NAMES[lang] + ' support could reach ~' + tipTotal + 'M gamers in their native language across your selected countries.')}" onclick="event.stopPropagation()">!</span>`
      : '';
    return `
      <button class="loc-chip${isOn ? ' is-on' : ''}${isTipVisible ? ' has-sw-tip' : ''}"
              onclick="toggleObLang('${lang}')">
        <span class="loc-chip-name">${OB_LANG_NAMES[lang] || lang}</span>${tipBadge}
      </button>`;
  };

  const featuredChips = chipLangs.map(buildChip).join('');
  const extraChips    = extraSelected.map(buildChip).join('');
  const addBtn = `<button class="loc-chip loc-chip-add" onclick="toggleLangSearch(event)" title="Add another language">+</button>`;

  const chevSvg = `<svg class="loc-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

  return `
    <div class="loc-picker">
      <div class="loc-row">
        <div class="loc-label-col">
          <div class="loc-label">${t('ob.loc.primary')}</div>
        </div>
        <div class="loc-control-col">
          <div class="loc-primary-wrap" id="loc-primary-wrap">
            <button class="loc-primary-pill" onclick="toggleLocPrimaryDropdown(event)">
              <span class="loc-primary-name">${primaryName}</span>
              ${chevSvg}
            </button>
            <div class="loc-dropdown" id="loc-dropdown">${ddItems}</div>
          </div>
        </div>
      </div>

      <div class="loc-divider"></div>

      <div class="loc-row">
        <div class="loc-label-col">
          <div class="loc-label">${t('ob.loc.supported')}</div>
        </div>
        <div class="loc-control-col">
          <div class="loc-chips" id="loc-chips">
            ${featuredChips}
            ${extraChips}
            ${addBtn}
          </div>
          <div class="lang-search-wrap hidden" id="lang-search-wrap">
            <input class="lang-search-input" id="lang-search-input" type="text"
                   placeholder="${t('ob.field.lang_search.placeholder')}"
                   oninput="filterLangSearch(this.value)"
                   onclick="event.stopPropagation()">
            <div class="lang-search-list" id="lang-search-list"></div>
          </div>
        </div>
      </div>
    </div>`;
}

/* Tab 2: Assets */
function buildAssetsTab() {
  const hasAndroid = state.activePlatforms.has('android');
  return `
    <div class="ob-form">

      <!-- ── Screenshots ── -->
      <div class="ob-section" id="ob-sec-screenshots">
        <div class="ob-section-hdr">${t('ob.section.screenshots') || 'Screenshots'}</div>
        <div class="asset-guidance">${t('ob.screenshots.guidance')}</div>
        <div class="ob-q ob-q--rail-only" id="ob-q-screenshots" data-answered="${state.uploads.screenshots.length > 0 ? '1' : '0'}">
          <div id="ob-screenshot-req-wrap" class="ob-req-group ${state.uploads.screenshots.length === 0 ? 'is-req-empty' : ''}">
            <div class="asset-dropzone" id="ob-screenshot-dropzone"
                 onclick="document.getElementById('ob-screenshot-input').click()"
                 ondragover="event.preventDefault(); this.classList.add('is-over')"
                 ondragleave="this.classList.remove('is-over')"
                 ondrop="handleScreenshotDrop(event); this.classList.remove('is-over')">
              <div class="asset-dropzone-icon">↑</div>
              <div class="asset-dropzone-label">${t('ob.screenshots.drop_label')}</div>
              <div class="asset-dropzone-hint">${t('ob.screenshots.drop_hint')}</div>
              <input type="file" id="ob-screenshot-input" multiple accept="image/*" style="display:none"
                     onchange="handleScreenshotFiles(this.files); this.value=''">
            </div>
          </div>
          <div class="asset-grid" id="ob-screenshot-grid"></div>
        </div><!-- /ob-q-screenshots -->
      </div>

      <div class="ob-sec-divider"></div>

      <!-- ── Trailer (optional) ── -->
      <div class="ob-section" id="ob-sec-trailer">
        <div class="ob-section-hdr">${t('ob.section.trailer') || 'Trailer'} <span class="form-optional-tag">${t('ob.field.optional_tag') || 'Optional'}</span></div>
        <div class="asset-guidance">${t('ob.trailer.guidance')}</div>
        <div class="asset-dropzone asset-dropzone-sm" id="ob-trailer-dropzone"
             onclick="document.getElementById('ob-trailer-input').click()"
             ondragover="event.preventDefault(); this.classList.add('is-over')"
             ondragleave="this.classList.remove('is-over')"
             ondrop="handleTrailerDrop(event); this.classList.remove('is-over')">
          <div class="asset-dropzone-icon">↑</div>
          <div class="asset-dropzone-label">${t('ob.trailer.drop_label')}</div>
          <div class="asset-dropzone-hint">${t('ob.trailer.drop_hint')}</div>
          <input type="file" id="ob-trailer-input" accept="video/*" style="display:none"
                 onchange="handleTrailerFiles(this.files); this.value=''">
        </div>
        <div id="ob-trailer-file-info" style="display:none;"></div>
        <div class="asset-url-row">
          <label class="form-label" style="margin-bottom:6px;">${t('ob.field.trailer_url.label') || 'Or paste a YouTube URL'}</label>
          <input class="form-input" id="ob-trailer-url" type="url" placeholder="${t('ob.field.trailer_url.placeholder') || 'https://youtube.com/watch?v=…'}"
                 oninput="syncField('trailerUrl', this.value)">
        </div>
      </div>

    </div>`;
}

/* Tab 3: Compliance (unchanged) */
function buildComplianceTab() {
  return `
    <div class="ob-form">

      <!-- ── Compliance Questions ── -->
      <div class="ob-section" id="ob-sec-compliance">
        <div class="ob-section-hdr">${t('ob.section.compliance') || 'Compliance Questions'}</div>
        <div class="asset-guidance">${t('ob.compliance.guidance')}</div>
        <div id="ob-questions-list"></div>
      </div>

    </div>`;
}

/* buildPlatformSelectTab() removed — platforms are in buildAboutTab() */

/* Hydration helpers — fill form fields from state after render */
function hydrateGameDetailsTab() {
  const fd = state.formData;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('ob-title', fd.title);
  set('ob-desc',  fd.description);
  if (fd.title)       charCount('ob-title-count', fd.title,       30);
  if (fd.description) charCount('ob-desc-count',  fd.description, 4000);
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
  // Sync required-empty indicator on wrapper, and section rail
  const reqWrap = document.getElementById('ob-screenshot-req-wrap');
  if (reqWrap) reqWrap.classList.toggle('is-req-empty', !state.uploads.screenshots.length);
  updateObSectionStates();
  if (!state.uploads.screenshots.length) { grid.innerHTML = ''; return; }
  grid.innerHTML = state.uploads.screenshots.map(shot => `
    <div class="asset-thumb">
      <img src="${_screenshotSrc(shot)}" alt="${escHtml(shot.name)}">
      <button class="asset-remove" onclick="removeScreenshot('${shot.id}')" title="Remove">×</button>
      <div class="asset-name">${escHtml(shot.name)}</div>
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
  let h = '';
  for (const q of QUESTIONS) {
    const answer = state.questionAnswers[q.id];
    const qLabel = t(`q.${q.id}.label`) || q.label;
    const qDesc  = t(`q.${q.id}.desc`)  || q.desc;
    const qTitle = t(`q.${q.id}.title`) || q.title;
    const tipText = escHtml(qLabel + (qDesc ? ' ' + qDesc : ''));
    const ttHTML = `<span class="tooltip-anchor"><span class="tooltip-icon">?</span><span class="tooltip-body">${tipText}</span></span>`;
    h += `
      <div class="ios-q-row" data-answered="${answer !== null ? '1' : '0'}">
        <div class="ios-q-left">
          <div class="ios-q-label">${escHtml(qTitle)}${ttHTML}</div>
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
  const verTitle = document.getElementById('versionSelectorTitle');
  const activeVer = proj?.versions.find(v => v.id === state.activeVersionId);
  if (verTitle) verTitle.textContent = 'v' + (activeVer?.versionNumber || '1.0');

  // Render project dropdown items
  const projDD = document.getElementById('projectDropdown');
  if (projDD) {
    projDD.innerHTML = state.projects.map(p => `
      <div class="project-item ${p.id === state.activeProjectId ? 'active' : ''}"
           onclick="switchProject('${p.id}')">
        ${p.name || t('bar.untitled_game')}
      </div>`).join('') + `
      <div class="project-dropdown-divider"></div>
      <div class="project-item new-project" onclick="createNewProject()">
        <span>${t('bar.new_project')}</span><span class="plus">+</span>
      </div>
      <div class="project-item danger" onclick="deleteCurrentProject()">
        <span>${t('bar.delete_project')}</span>
      </div>`;
  }

  // Render release dropdown items
  const verDD = document.getElementById('versionDropdown');
  if (verDD && proj) {
    verDD.innerHTML = proj.versions.map(v => {
      const label = v.name ? `v${v.versionNumber} <span class="ver-drop-name">${escHtml(v.name)}</span>` : `v${v.versionNumber}`;
      return `
        <div class="project-item ${v.id === state.activeVersionId ? 'active' : ''}"
             onclick="switchVersion('${v.id}')">
          ${label}
        </div>`;
    }).join('') + `
      <div class="project-item new-project" onclick="openNewReleaseModal()">
        <span>${t('bar.new_release')}</span><span class="plus">+</span>
      </div>`;
  }

  // Update profile name display
  const profName = document.getElementById('profile-name');
  if (profName) profName.textContent = t('bar.developer');
  renderLangMenu();
}


/* ── Dashboard Timeline ──────────────────────────────── */

function buildDashboardTimeline() {
  const fd = state.formData;
  const rt = fd.releaseTiming || 'manual';

  // Short display names for the compact timeline label column
  const DASH_TL_LABEL = {
    ios: 'Apple', android: 'Google', steam: 'Steam',
    egs: 'Epic', xbox: 'Xbox', nintendo: 'Nintendo', psn: 'PSN',
  };

  // Active platforms with timing data, sorted shortest → longest review time
  const reviewData = [...state.activePlatforms]
    .filter(p => OB_PLATFORM_TIMING[p])
    .map(p => ({ id: p, ...OB_PLATFORM_TIMING[p], shortLabel: DASH_TL_LABEL[p] || OB_PLATFORM_TIMING[p].label }))
    .sort((a, b) => a.days - b.days);

  /* ── Mode chips + optional date input ── */
  const modes = [
    { v: 'manual',        label: t('tl.manual')        },
    { v: 'as_approved',   label: t('tl.when_approved') },
    { v: 'specific_date', label: t('tl.on_a_date')     },
  ];
  const modeChips = modes.map(m =>
    `<button class="dash-tl-chip${rt === m.v ? ' is-on' : ''}" onclick="dashPickTiming('${m.v}')">${m.label}</button>`
  ).join('');

  const dateVal   = fd.releaseDate || '';
  const dateInput = rt === 'specific_date'
    ? `<input class="form-input dash-tl-date-input" type="date" value="${escHtml(dateVal)}" onblur="dashSetDate(this.value)">`
    : '';

  /* ── Days-to-launch counter ── */
  let counterHtml = '';
  if (rt === 'specific_date' && dateVal) {
    const live  = new Date(dateVal + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days  = Math.round((live - today) / 86400000);
    if (days >= 0) {
      counterHtml = `
        <div class="dash-tl-counter">
          <span class="dash-tl-days-num">${days}</span>
          <span class="dash-tl-days-lbl">${t('tl.days')}</span>
        </div>`;
    }
  }

  /* ── Right panel: platform track rows ── */
  let rightHtml = '';

  if (rt === 'specific_date' && dateVal && reviewData.length) {
    const liveDate = new Date(dateVal + 'T00:00:00');
    if (!isNaN(liveDate)) {
      const maxLead  = Math.max(...reviewData.map(r => r.days * 2));
      const spanDays = maxLead + 1;

      // Column headers anchored at the FIRST (shortest) platform's dot positions
      const first    = reviewData[0];
      const hdrRec   = ((spanDays - first.days * 2) / spanDays * 100).toFixed(1);
      const hdrSub   = ((spanDays - first.days)     / spanDays * 100).toFixed(1);

      const colHeaders = `
        <div class="dash-tl-col-hdrs">
          <div class="dash-tl-plat-spacer"></div>
          <div class="dash-tl-track-hdrs">
            <span class="dash-tl-col-hdr" style="left:${hdrRec}%">${t('tl.rec')}</span>
            <span class="dash-tl-col-hdr" style="left:${hdrSub}%">${t('tl.submit_by')}</span>
            <span class="dash-tl-col-hdr dash-tl-col-hdr--live" style="left:100%">${t('tl.live')}</span>
          </div>
        </div>`;

      const rows = reviewData.map(r => {
        const recDate = _addDays(liveDate, -(r.days * 2));
        const subDate = _addDays(liveDate, -r.days);
        const recPct  = ((spanDays - r.days * 2) / spanDays * 100).toFixed(1);
        const subPct  = ((spanDays - r.days)     / spanDays * 100).toFixed(1);
        const dashW   = (subPct - recPct).toFixed(1);
        const solidW  = (100 - subPct).toFixed(1);
        return `
          <div class="dash-tl-row">
            <div class="dash-tl-plat-name">${platformIcon(r.id, 18, 'white')}</div>
            <div class="dash-tl-track">
              <div class="dash-tl-faint-line" style="width:${recPct}%"></div>
              <div class="dash-tl-dash-line"  style="left:${recPct}%;width:${dashW}%"></div>
              <div class="dash-tl-solid-line" style="left:${subPct}%;width:${solidW}%;background:${r.color}"></div>
              <div class="dash-tl-dot dash-tl-dot--rec"  style="left:${recPct}%"></div>
              <div class="dash-tl-dot dash-tl-dot--sub"  style="left:${subPct}%;border:2px solid ${r.color}"></div>
              <div class="dash-tl-dot dash-tl-dot--live" style="left:100%;background:${r.color};border-color:${r.color}"></div>
              <div class="dash-tl-date-lbl" style="left:${recPct}%">${fmtDateShort(recDate)}</div>
              <div class="dash-tl-date-lbl" style="left:${subPct}%">${fmtDateShort(subDate)}</div>
            </div>
          </div>`;
      }).join('');

      rightHtml = `<div class="dash-tl-right">${colHeaders}${rows}</div>`;
    }
  } else if (rt === 'as_approved' && reviewData.length) {
    const today   = new Date(); today.setHours(0, 0, 0, 0);
    const maxDays = Math.max(...reviewData.map(r => r.days));

    const colHeaders = `
      <div class="dash-tl-col-hdrs">
        <div class="dash-tl-plat-spacer"></div>
        <div class="dash-tl-track-hdrs">
          <span class="dash-tl-col-hdr" style="left:0%">TODAY</span>
          <span class="dash-tl-col-hdr dash-tl-col-hdr--live" style="left:100%">LIVE</span>
        </div>
      </div>`;

    const rows = reviewData.map(r => {
      const pct        = (r.days / maxDays * 100).toFixed(1);
      const liveDateSt = fmtDateShort(_addDays(today, r.days));
      return `
        <div class="dash-tl-row">
          <div class="dash-tl-plat-name" style="color:${r.color}">${escHtml(r.shortLabel)}</div>
          <div class="dash-tl-track">
            <div class="dash-tl-faint-line" style="width:100%"></div>
            <div class="dash-tl-solid-line" style="width:${pct}%;background:${r.color}"></div>
            <div class="dash-tl-dot dash-tl-dot--rec"  style="left:0%"></div>
            <div class="dash-tl-dot dash-tl-dot--live" style="left:${pct}%;background:${r.color};border-color:${r.color}"></div>
            <div class="dash-tl-date-lbl" style="left:${pct}%">${liveDateSt}</div>
          </div>
        </div>`;
    }).join('');

    rightHtml = `<div class="dash-tl-right">${colHeaders}${rows}</div>`;
  }

  return `
    <div class="dash-timeline" id="dash-timeline">
      <div class="dash-tl-bar">
        <div class="dash-tl-left">
          <span class="dash-tl-launch-lbl">LAUNCH</span>
          <div class="dash-tl-chips">${modeChips}${dateInput}</div>
        </div>
        ${counterHtml}
        ${rightHtml}
      </div>
    </div>`;
}

/* ── Dashboard ───────────────────────────────────────── */

function buildConsolidatedBanner() {
  const hasActive = state.activePlatforms.size > 0;
  const { total, answered } = cqProgress();
  const pct  = total ? Math.round(answered / total * 100) : 0;
  const done = answered === total && total > 0;
  const loading = state.cqInferenceStatus === 'loading';
  const checkSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`;

  if (!hasActive) {
    return `
      <div class="cq-banner cq-banner-empty">
        <div class="cq-banner-icon">${checkSvg}</div>
        <div class="cq-banner-content">
          <div class="cq-banner-title">Consolidated Questionnaire</div>
          <div class="cq-banner-sub">Please select platforms to continue.</div>
        </div>
      </div>`;
  }

  if (loading) {
    return `
      <div class="cq-banner cq-banner-loading">
        <div class="cq-banner-icon"><span class="cq-spinner"></span></div>
        <div class="cq-banner-content">
          <div class="cq-banner-title">Consolidated Questionnaire</div>
          <div class="cq-banner-sub">AI is reviewing your game data…</div>
        </div>
        <div class="cq-banner-right">
          <div class="cq-banner-pct" style="color:var(--text-dim)">—</div>
        </div>
      </div>`;
  }

  const aiCount = Object.values(state.cqAnswerMeta).filter(m => !m.humanConfirmed).length;
  const subLabel = done
    ? 'All questions answered ✓'
    : answered > 0
      ? `${answered} of ${total} answered${aiCount > 0 ? ` · ${aiCount} AI-suggested` : ''}`
      : `${total} questions · click to begin`;

  return `
    <div class="cq-banner ${done ? 'cq-banner-done' : ''}" onclick="openCQModal()">
      <div class="cq-banner-icon">${checkSvg}</div>
      <div class="cq-banner-content">
        <div class="cq-banner-title">Consolidated Questionnaire</div>
        <div class="cq-banner-sub">${subLabel}</div>
      </div>
      <div class="cq-banner-right">
        <div class="cq-banner-pct">${pct}%</div>
        <div class="cq-banner-bar"><div class="cq-banner-bar-fill" style="width:${pct}%"></div></div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.4;flex-shrink:0;" class="cq-banner-chevron"><path d="M9 18l6-6-6-6"/></svg>
      </div>
    </div>`;
}

function renderDashboard() {
  const el = document.getElementById('dashboard');
  if (!el) return;

  renderProjectBar();

  const active   = [...state.activePlatforms];
  const inactive = Object.keys(PLATFORMS).filter(pid => !state.activePlatforms.has(pid));

  let h = '';

  if (active.length > 0) {
    h += `<div id="dash-timeline-wrap">${buildDashboardTimeline()}</div>`;
  }

  if (active.length === 0) {
    h += `
      <div class="dash-empty">
        <div class="dash-empty-title">${t('dash.empty.title')}</div>
        <div class="dash-empty-desc">${t('dash.empty.desc')}</div>
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
        <div class="inactive-section-label">${active.length > 0 ? t('dash.more_platforms') : t('dash.available_platforms')}</div>
        <div class="inactive-cards-grid">
          ${inactive.map(pid => buildInactiveCard(pid)).join('')}
        </div>
      </div>`;
  }

  el.innerHTML = h;
}

// Track selector + drift-visibility status pills for platforms that support
// pre-release tracks (iOS/Android/Steam — the platforms actually submittable
// today). The dropdown defaults to whatever track this platform last shipped
// to; nothing here is required input, just a visible, overridable default.
// Console platforms don't have an entry in PLATFORM_TRACKS yet, so this
// returns '' for them — the data model already supports it when they're ready.
// Drift pills shown on the platform card — most recent production build + most recent
// pre-release build (if it's ahead of production). Capped at two pills.
// The track selector itself lives in the submit modal, not on the card.
function buildReleasePills(pid) {
  const proj = state.projects.find(p => p.id === state.activeProjectId);
  if (!proj) return '';
  const summary = getPlatformReleaseSummary(proj, pid);
  const pills = [];
  if (summary.production) {
    pills.push(`<span class="release-pill is-prod">${t('pill.prod')} v${escHtml(summary.production.versionNumber)}</span>`);
  }
  if (summary.latest && summary.latest.track !== 'production') {
    pills.push(`<span class="release-pill is-pre">${escHtml(tTrack(pid, summary.latest.track))}: v${escHtml(summary.latest.versionNumber)}</span>`);
  }
  return pills.length ? `<div class="card-release-status">${pills.join('')}</div>` : '';
}

function buildActiveCard(pid) {
  if (pid === 'ios')     return buildIOSActiveCard(pid);
  if (pid === 'android') return buildAndroidActiveCard(pid);
  if (pid === 'steam')   return buildSteamActiveCard(pid);

  const p      = PLATFORMS[pid];
  const counts = platformStepCount(pid);
  const locked = !counts.allRequired;
  const submitDone = state.platformStepStatus?.[pid]?.['submit'] === 'complete';

  const steps = p.steps.filter(s => !s.isSubmit).map(step => {
    const done = state.platformStepStatus[pid][step.id] === 'complete';
    return `
      <div class="card-task ${done ? 'is-done' : ''}" onclick="openTaskModal('${pid}','${step.id}')">
        <div class="task-dot ${done ? 'is-complete' : ''}" id="dot-${pid}-${step.id}"></div>
        <span class="task-label">${stepLabel(pid, step)}</span>
        <span class="task-arrow">›</span>
      </div>`;
  }).join('');

  const submitStepCard = buildSubmitStepCard(pid, p.steps.length, locked, submitDone);

  return `
    <div class="active-card" id="active-card-${pid}">
      <div class="active-card-head" onclick="deactivatePlatform('${pid}')" title="Click to deactivate" style="cursor:pointer;">
        <div class="active-card-platform">
          <div class="active-card-icon">${platformIcon(pid, 28, 'white')}</div>
          <div>
            <div class="active-card-name">${platLabel(pid)}</div>
          </div>
        </div>
      </div>
      <div class="card-tasks">${steps}</div>
      <div class="ios-step-cards">${submitStepCard}</div>
    </div>`;
}

/* ── Submit step card (shared across all platform card builders) ─────────────
   Shows as the last step in every platform card.
   • locked=true  → grayed-out row, no track controls
   • locked=false → row is active with inline track dropdown + Submit button
   ─────────────────────────────────────────────────────────────────────────── */
function buildSubmitStepCard(pid, stepCount, locked, submitDone) {
  const checkSVG = `<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const num = stepCount + 1;
  const numClass = 'ios-step-num' + (submitDone ? ' is-done' : '');

  const tracks = PLATFORM_TRACKS[pid] || [{ id: 'production', label: 'Production' }];
  // null until the user explicitly selects one — forces an intentional choice
  const selTrack = (state.selectedTracks || {})[pid] ?? null;

  // Track dropdown is always visible so the user can pre-select a track.
  // The rest of the card is the submit action — no separate button needed.
  const trackSelect = `
    <select class="submit-track-select ${!selTrack ? 'no-track' : ''}"
            id="track-sel-${pid}"
            onclick="event.stopPropagation()"
            onchange="selectTrack('${pid}', this.value)">
      <option value="" disabled ${!selTrack ? 'selected' : ''}>Choose Track</option>
      ${tracks.map(tr => `<option value="${tr.id}"${selTrack === tr.id ? ' selected' : ''}>${escHtml(tr.label)}</option>`).join('')}
    </select>`;

  // When not locked the whole card (except dropdown) is clickable.
  const cardClick = !locked ? `onclick="confirmSubmit('${pid}')"` : '';

  return `
    <div class="ios-step-card submit-step-card ${submitDone ? 'is-complete' : ''} ${locked ? 'submit-step-locked' : 'submit-step-ready'}"
         id="${pid}-step-card-submit" ${cardClick}>
      <div class="${numClass}">${submitDone ? checkSVG : num}</div>
      <div class="ios-step-info">
        <div class="ios-step-name">Submit</div>
      </div>
      ${trackSelect}
    </div>`;
}

function buildIOSActiveCard(pid) {
  const p      = PLATFORMS[pid];
  const counts = platformStepCount(pid);
  const locked = !counts.allRequired;
  const submitDone = state.platformStepStatus?.[pid]?.['submit'] === 'complete';

  const checkSVG = `<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const stepCards = p.steps.map((step, i) => {
    const done = isIOSSectionComplete(step.id);
    const risk = computeIOSSectionRisk(step.id);
    const numClass = 'ios-step-num' + (done ? ' is-done' : '');
    const riskDot  = (done || risk === 'LOW' || risk === 'NONE') ? '' : `<span class="ios-step-risk ios-step-risk-${risk.toLowerCase()}"></span>`;
    return `
      <div class="ios-step-card ${done ? 'is-complete' : ''}" id="ios-step-card-${step.id}"
           onclick="openStepModal('${pid}','${step.id}')">
        <div class="${numClass}">${done ? checkSVG : i + 1}</div>
        <div class="ios-step-info">
          <div class="ios-step-name">${stepLabel(pid, step)}</div>
        </div>
        ${riskDot}
        <span class="ios-step-arrow">›</span>
      </div>`;
  }).join('');

  const submitStepCard = buildSubmitStepCard(pid, p.steps.length, locked, submitDone);

  return `
    <div class="active-card" id="active-card-${pid}">
      <div class="active-card-head" onclick="deactivatePlatform('${pid}')" title="Click to deactivate" style="cursor:pointer;">
        <div class="active-card-platform">
          <div class="active-card-icon">${platformIcon(pid, 28, 'white')}</div>
          <div class="active-card-name-row">
            <div class="active-card-name">${platLabel(pid)}</div>
            ${buildBuildDropdown(pid)}
          </div>
        </div>
      </div>
      ${buildReleasePills(pid)}
      <div class="ios-step-cards">${stepCards}${submitStepCard}</div>
    </div>`;
}

function buildAndroidActiveCard(pid) {
  const p      = PLATFORMS[pid];
  const counts = platformStepCount(pid);
  const locked = !counts.allRequired;
  const submitDone = state.platformStepStatus?.[pid]?.['submit'] === 'complete';

  const checkSVG = `<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const stepCards = p.steps.map((step, i) => {
    const done = isAndroidSectionComplete(step.id);
    const risk = computeAndroidSectionRisk(step.id);
    const numClass = 'ios-step-num' + (done ? ' is-done' : '');
    const riskDot  = (done || risk === 'LOW' || risk === 'NONE') ? '' : `<span class="ios-step-risk ios-step-risk-${risk.toLowerCase()}"></span>`;
    return `
      <div class="ios-step-card ${done ? 'is-complete' : ''}" id="android-step-card-${step.id}"
           onclick="openStepModal('${pid}','${step.id}')">
        <div class="${numClass}">${done ? checkSVG : i + 1}</div>
        <div class="ios-step-info">
          <div class="ios-step-name">${stepLabel(pid, step)}</div>
        </div>
        ${riskDot}
        <span class="ios-step-arrow">›</span>
      </div>`;
  }).join('');

  const submitStepCard = buildSubmitStepCard(pid, p.steps.length, locked, submitDone);

  return `
    <div class="active-card" id="active-card-${pid}">
      <div class="active-card-head" onclick="deactivatePlatform('${pid}')" title="Click to deactivate" style="cursor:pointer;">
        <div class="active-card-platform">
          <div class="active-card-icon">${platformIcon(pid, 28, 'white')}</div>
          <div class="active-card-name-row">
            <div class="active-card-name">${platLabel(pid)}</div>
            ${buildBuildDropdown(pid)}
          </div>
        </div>
      </div>
      ${buildReleasePills(pid)}
      <div class="ios-step-cards">${stepCards}${submitStepCard}</div>
    </div>`;
}

const COMING_SOON_PLATFORMS = new Set(['egs', 'psn', 'xbox', 'nintendo']);

function buildInactiveCard(pid) {
  const p          = PLATFORMS[pid];
  const counts     = platformStepCount(pid);
  const pct        = counts.total ? Math.round((counts.complete / counts.total) * 100) : 0;
  const label      = counts.complete > 0 ? t('dash.steps_count', {complete: counts.complete, total: counts.total}) : 'Inactive';
  const isCS       = COMING_SOON_PLATFORMS.has(pid);
  const clickAttr  = isCS
    ? `onclick="blinkComingSoon('${pid}')" title="${platLabel(pid)} — coming soon"`
    : `onclick="activatePlatform('${pid}')" role="button" tabindex="0" title="Click to activate ${platLabel(pid)}"`;
  return `
    <div class="inactive-card ${isCS ? 'is-coming-soon' : ''}" ${clickAttr} style="cursor:${isCS ? 'default' : 'pointer'};">
      <div class="inactive-card-head">
        <div class="inactive-card-platform">
          <div class="inactive-card-icon">${platformIcon(pid, 20, 'white')}</div>
          <span class="inactive-card-name">${platLabel(pid)}</span>
        </div>
        ${isCS ? `<span class="coming-soon-badge" id="cs-badge-${pid}">Coming Soon</span>` : ''}
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
        <div class="task-modal-platform-icon">
          ${platformIcon(platformId, 28, 'white')}
        </div>
        <span class="task-modal-platform-name">${platLabel(platformId)}</span>
        <span class="task-modal-sep">›</span>
        <span class="task-modal-step-name">${stepLabel(platformId, step)}</span>
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
      ? `<div class="task-thumb-row">${shots.slice(0, 6).map(s => `<img src="${_screenshotSrc(s)}" class="task-thumb" alt="${escHtml(s.name)}">`).join('')}${shots.length > 6 ? `<div class="task-thumb-more">+${shots.length - 6}</div>` : ''}</div>`
      : `<p class="task-stub-note">No screenshots uploaded yet. Add them via <strong>Game Details → Upload Assets</strong>.</p>`;
    return `<p style="margin-bottom:14px;color:#555;font-size:13px;">Confirm these screenshots look correct for <strong>${p.label}</strong>.</p>${thumbs}`;
  }

  // Generic stub
  return `
    <p class="task-stub-copy">Complete the <strong>${step.label}</strong> step for ${p.label}.</p>
    <p class="task-stub-note">Full task UI coming in the next iteration. Mark complete to continue.</p>`;
}

/* ── Inference loading messages (per platform + step) ─── */
function _getInferenceMsgs(platformId, stepId) {
  if (stepId === 'questionnaire' && platformId === 'ios')
    return ['Scanning for content signals…','Checking violence, language & mature themes…','Reviewing data collection & business model…','Preparing your questionnaire…'];
  if (stepId === 'questionnaire' && platformId === 'android')
    return ['Scanning for IARC content signals…','Identifying data collection & safety requirements…','Checking Google Play policy compliance…','Preparing your questionnaire…'];
  if (stepId === 'questionnaire' && platformId === 'steam')
    return ['Scanning game content for Steam requirements…','Reviewing genres, features & technical specs…','Checking Steam content policies…','Preparing your questionnaire…'];
  if (stepId === 'distribution')
    return ['Analyzing market selection options…','Checking regional availability…','Applying distribution strategy…','Finalizing territorial availability…'];
  return ['Reading your game details…','Cross-referencing platform requirements…','Inferring answers from your submission…','Preparing recommendations…'];
}

/* ── Inference answer counter ────────────────────────── */
function _countInferenceAnswers(platformId, stepId) {
  if (platformId === 'ios' && stepId === 'questionnaire') {
    const a = state.iosSubmitAnswers;
    const fields = [
      'parentalControls','ageAssurance','unrestrictedInternet','userGenContent',
      'messagingChat','advertising',
      'profanity','horrorFear','substancesAlcohol',
      'matureSuggestive','sexualContent','graphicSexual',
      'cartoonViolence','realisticViolence','extendedViolence','gunsWeapons',
      'simulatedGambling','contests','realMoneyGambling','lootBoxes',
      'ageCategory',
      'hasIAP','usesEncryption',
    ];
    const total    = fields.length;
    const answered = fields.filter(f => a[f] != null).length;
    return { answered, total };
  }
  // Android / Steam — use CQ_QUESTIONS root questions for that platform
  const platKey = platformId === 'steam' ? 'steam' : 'android';
  const rootQs  = CQ_QUESTIONS.filter(q => q.platforms.includes(platKey) && !q.parent);
  const total   = rootQs.length;
  const answered = rootQs.filter(q => {
    const v = state.cqAnswers[q.id];
    if (q.type === 'multi') return Array.isArray(v) && v.length > 0;
    return v != null && v !== '';
  }).length;
  return { answered, total };
}

/* ── Step Modal (iOS per-step) ───────────────────────── */

function renderStepModal() {
  const modal = document.getElementById('submit-modal');
  if (!modal) return;
  const { platformId, stepId, inferenceStatus, inferenceError } = state.stepModal || {};
  // Questionnaire contains privacy matrix — needs extra width for iOS and Android
  const isWide = stepId === 'questionnaire' && (platformId === 'ios' || platformId === 'android');
  modal.className = 'submit-modal' + (isWide ? ' submit-modal-wide' : '') + (state.showHighlights ? ' is-validating' : '');
  if (!platformId || !stepId) return;

  const p    = PLATFORMS[platformId];
  const step = p.steps.find(s => s.id === stepId);

  // Inference banners — success note goes to footer; error stays in scroll area
  let inferenceBanner     = '';
  let inferenceFooterNote = '';
  if (step?.hasInference) {
    const hasRun  = stepId === 'questionnaire'
      ? !!state.platformInferenceCache['unified:questionnaire']
      : !!state.platformInferenceCache[platformId + ':' + stepId];
    const retryFn = `_retryInference('${platformId}','${stepId}')`;
    if (inferenceStatus === 'loading') {
      // loading screen replaces the banner during loading
    } else if (inferenceStatus === 'error') {
      inferenceBanner = `
        <div class="ai-banner ai-banner-error">
          <span class="ai-banner-icon">⚠</span>
          <div class="ai-banner-text"><strong>Analysis failed:</strong> ${inferenceError || 'Unknown error'}</div>
          <button class="ai-autofill-btn" onclick="${retryFn}">Retry</button>
        </div>`;
    } else if (hasRun && stepId === 'questionnaire') {
      const { answered: infAns, total: infTotal } = _countInferenceAnswers(platformId, stepId);
      inferenceFooterNote = `
        <div class="inf-footer-note">
          <span class="inf-footer-icon">✦</span>
          <span>Shipmate pre-filled ${infAns} of ${infTotal} questions —<br>Please review ALL answers before submitting</span>
        </div>`;
    }
  }

  // Step body
  let body = '';
  if (inferenceStatus === 'loading') {
    const msgs = _getInferenceMsgs(platformId, stepId);
    body = `
      <div class="inf-loading-screen">
        <div class="inf-rings-wrap">
          <div class="inf-ring inf-ring-1"></div>
          <div class="inf-ring inf-ring-2"></div>
          <div class="inf-ring inf-ring-3"></div>
          <img src="Assets/SubwooferIcon_Orange.png" class="inf-logo" onerror="this.style.display='none'">
        </div>
        <div class="inf-headline">Shipmate is working…</div>
        <div class="inf-steps">
          ${msgs.map((m, i) => `<div class="inf-step" style="animation-delay:${i * 1.3}s"><div class="inf-dot"></div><span>${m}</span></div>`).join('')}
        </div>
      </div>`;
  } else if (stepId === 'improveSubmission' && (state.storePageInsights?.loading || state.improveSubmissionAnalysis?.loading)) {
    const iaMsgs = [
      'Comparing store page to best in class…',
      'Reviewing assets to maximize conversion…',
      'Analyzing binary to gauge compliance risk…',
      'Preparing your personalized report…',
    ];
    body = `
      <div class="inf-loading-screen">
        <div class="inf-rings-wrap">
          <div class="inf-ring inf-ring-1"></div>
          <div class="inf-ring inf-ring-2"></div>
          <div class="inf-ring inf-ring-3"></div>
          <img src="Assets/SubwooferIcon_Orange.png" class="inf-logo" onerror="this.style.display='none'">
        </div>
        <div class="inf-headline">Shipmate is working…</div>
        <div class="inf-steps">
          ${iaMsgs.map((m, i) => `<div class="inf-step" style="animation-delay:${i * 1.3}s"><div class="inf-dot"></div><span>${m}</span></div>`).join('')}
        </div>
      </div>`;
  } else if (platformId === 'android') {
    if (stepId === 'questionnaire')           body = buildQuestionnaireSection(platformId);
    else if (stepId === 'screenshots')        body = buildScreenshotsSection(platformId);
    else if (stepId === 'storePreview')       body = buildAndroidStorePreviewSection();
    else if (stepId === 'improveSubmission')  body = buildImproveSubmissionSection(platformId);
    // Legacy individual step fallbacks (for backward-compat with saved state)
    else if (stepId === 'contentRating')      body = buildAndroidContentRatingSection();
    else if (stepId === 'dataSafety')         body = buildAndroidDataSafetySection();
    else if (stepId === 'business')           body = buildAndroidBusinessSection();
  } else if (platformId === 'steam') {
    if (stepId === 'questionnaire')           body = buildQuestionnaireSection(platformId);
    else if (stepId === 'screenshots')        body = buildScreenshotsSection(platformId);
    else if (stepId === 'storePreview')       body = buildSteamStorePreviewSection();
    else if (stepId === 'improveSubmission')  body = buildImproveSubmissionSection(platformId);
    // Legacy fallbacks
    else if (stepId === 'contentRating')      body = buildSteamContentRatingSection();
    else if (stepId === 'storeTags')          body = buildSteamStoreTagsSection();
    else if (stepId === 'technical')          body = buildSteamTechnicalSection();
  } else if (stepId === 'questionnaire')      body = buildQuestionnaireSection(platformId);
  else if (stepId === 'screenshots')          body = buildScreenshotsSection(platformId);
  else if (stepId === 'distribution')         body = buildDistributionSection();
  else if (stepId === 'storePreview')         body = buildStorePreviewSection();
  else if (stepId === 'improveSubmission')    body = buildImproveSubmissionSection(platformId);
  // iOS legacy fallbacks
  else if (stepId === 'contentRating')        body = buildContentRatingSection();
  else if (stepId === 'privacy')              body = buildPrivacySection();
  else if (stepId === 'business')             body = buildBusinessSection() + buildExportComplianceSection();

  const complete = platformId === 'android' ? isAndroidSectionComplete(stepId)
               : platformId === 'steam'   ? isSteamSectionComplete(stepId)
               : isIOSSectionComplete(stepId);

  modal.innerHTML = `
    <div class="submit-modal-header" style="border-top-color:${p.color};">
      <div class="submit-modal-title-row">
        <div class="submit-modal-hicon">${platformIcon(platformId, 30, 'white')}</div>
        <div>
          <div class="submit-modal-title">${step?.label || ''}</div>
          <div class="submit-modal-subtitle">${p.label}</div>
        </div>
      </div>
      <button class="task-modal-close" onclick="closeStepModal()">×</button>
    </div>
    <div class="submit-modal-scroll" id="step-modal-body">
      ${inferenceBanner}
      <div class="ios-step-body-content">
        ${body}
      </div>
    </div>
    <div class="submit-modal-footer">
      ${inferenceFooterNote}
      <button class="btn btn-primary" onclick="closeStepModal()">
        ${complete ? 'Done' : 'Save & Close'}
      </button>
    </div>`;

  // Init distribution map after render if this is the distribution step
  if (stepId === 'distribution') requestAnimationFrame(() => initDistributionMap());
}

/* ── Store Page AI Insights panel ───────────────────── */
function buildStoreInsightsPanel() {
  const ins = state.storePageInsights;

  // ── Idle ────────────────────────────────────────────
  if (!ins) return `
    <div class="sp-insights-panel sp-insights-idle">
      <div class="sp-insights-badge">
        <img src="Assets/SubwooferIcon_Orange.png" class="sp-ins-logo" onerror="this.style.display='none'">
        <span>Shipmate AI</span>
      </div>
      <p class="sp-insights-prompt">Get an AI-powered evaluation of your store page listing with one-click fixes.</p>
      <button class="btn btn-primary sp-ins-btn" onclick="runStorePageInsights()">Analyze my listing →</button>
    </div>`;

  // ── Loading ─────────────────────────────────────────
  if (ins.loading) return `
    <div class="sp-insights-panel sp-insights-loading">
      <div class="sp-insights-badge">
        <img src="Assets/SubwooferIcon_Orange.png" class="sp-ins-logo" onerror="this.style.display='none'">
        <span>Shipmate AI</span>
      </div>
      <div class="sp-ins-spinner-row"><span class="ai-spinner"></span> Evaluating your listing…</div>
    </div>`;

  // ── Error ───────────────────────────────────────────
  if (ins.error) return `
    <div class="sp-insights-panel sp-insights-error">
      <div class="sp-insights-badge">
        <img src="Assets/SubwooferIcon_Orange.png" class="sp-ins-logo" onerror="this.style.display='none'">
        <span>Shipmate AI</span>
      </div>
      <div class="sp-ins-error-msg">${escHtml(ins.error)}</div>
      <div class="sp-ins-footer-row">
        <button class="btn btn-ghost btn-sm" onclick="runStorePageInsights()">Retry</button>
        <button class="btn btn-ghost btn-sm" onclick="state.storePageInsights=null;renderStepModal()">Dismiss</button>
      </div>
    </div>`;

  // ── All done ────────────────────────────────────────
  if (ins.done) return `
    <div class="sp-insights-panel sp-insights-done">
      <div class="sp-insights-badge">
        <img src="Assets/SubwooferIcon_Orange.png" class="sp-ins-logo" onerror="this.style.display='none'">
        <span>Shipmate AI</span>
      </div>
      <div class="sp-ins-applied">
        <svg viewBox="0 0 16 16" fill="none" width="14" height="14"><circle cx="8" cy="8" r="7" stroke="var(--green)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--green)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        All suggestions reviewed.
      </div>
      <div class="sp-ins-footer-row">
        <button class="btn btn-ghost btn-sm" onclick="runStorePageInsights()">Analyze again</button>
        <button class="btn btn-ghost btn-sm" onclick="state.storePageInsights=null;renderStepModal()">Close</button>
      </div>
    </div>`;

  // ── Active issue ────────────────────────────────────
  if (ins.issues && ins.issues.length > 0) {
    const issue  = ins.issues[ins.index];
    const total  = ins.issues.length;
    const current = ins.index + 1;
    const fieldLabel = { subtitle: 'Subtitle', description: 'Description', title: 'Title' }[issue.field] || (issue.field || 'Listing');
    const progress = total > 1 ? `<span class="sp-ins-progress">${current} / ${total}</span>` : '';
    return `
      <div class="sp-insights-panel sp-insights-result">
        <div class="sp-insights-badge">
          <img src="Assets/SubwooferIcon_Orange.png" class="sp-ins-logo" onerror="this.style.display='none'">
          <span>Shipmate AI</span>
          <span class="sp-ins-field-tag">${escHtml(fieldLabel)}</span>
          ${progress}
        </div>
        <div class="sp-ins-issue">${escHtml(issue.issue || '')}</div>
        <div class="sp-ins-suggestion">${escHtml(issue.suggestion || '')}</div>
        ${issue.fixedValue ? `
          <div class="sp-ins-preview">
            <div class="sp-ins-preview-label">Suggested fix</div>
            <div class="sp-ins-preview-text">${escHtml(issue.fixedValue)}</div>
          </div>` : ''}
        <div class="sp-ins-footer-row">
          <button class="btn btn-primary" onclick="applyStorePageFix()" ${!issue.fixedValue ? 'disabled style="opacity:.4"' : ''}>✦ Fix it</button>
          <button class="btn btn-ghost btn-sm" onclick="dismissStorePageInsights()">Dismiss</button>
        </div>
      </div>`;
  }

  return '';
}

/* ── Improve Your Submission ─────────────────────────── */
function buildImproveSubmissionSection(platformId) {
  const isIos     = platformId === 'ios';
  const isAndroid = platformId === 'android';

  // Mark as seen on first render — triggers step completion in dashboard
  if (isIos)          state.iosSubmitAnswers.improveSubmissionSeen     = true;
  else if (isAndroid) state.androidSubmitAnswers.improveSubmissionSeen = true;
  else                state.steamSubmitAnswers.improveSubmissionSeen   = true;

  const spi = state.storePageInsights;
  const ana = state.improveSubmissionAnalysis;
  const idx = state.improveSubmissionIdx || { storePage: 0 };

  // ── Shared helpers ───────────────────────────────────
  function _gradeBadge(grade) {
    const cls = grade && /^[A-D]$/.test(grade)
      ? `iys-grade-badge iys-grade-badge-${grade}`
      : 'iys-grade-badge iys-grade-badge-na';
    return `<span class="${cls}">${escHtml(grade || 'N/A')}</span>`;
  }

  function _filterItems(items, ...keys) {
    const lc = keys.map(k => k.toLowerCase());
    return (items || []).filter(t => lc.some(k => (t.area || '').toLowerCase().includes(k)));
  }

  function _allGood(msg) {
    return `<div class="iys-issue-content iys-all-good-inline">
      <svg viewBox="0 0 16 16" fill="none" width="13" height="13"><circle cx="8" cy="8" r="7" stroke="var(--green)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--green)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>${msg || 'Looking good'}</span>
    </div>`;
  }

  function _loadingBody() {
    return `<div class="iys-issue-content iys-section-loading">Analyzing…</div>`;
  }

  // Section card: fixed-height card with content area + footer pinned to bottom
  function _section(title, grade, contentHTML, footerHTML) {
    return `
      <div class="iys-section">
        <div class="iys-section-body">
          <div class="iys-section-title">${title}</div>
          ${contentHTML}
          ${footerHTML ? `<div class="iys-section-footer">${footerHTML}</div>` : ''}
        </div>
        <div class="iys-section-grade">${_gradeBadge(grade)}</div>
      </div>`;
  }

  // ── Grade ordering helper ─────────────────────────────
  function _worseGrade(a, b) {
    const ORD = { D:3, C:2, B:1, A:0 };
    if (!a) return b; if (!b) return a;
    return (ORD[a] ?? -1) >= (ORD[b] ?? -1) ? a : b;
  }

  // ── MERGED STORE PAGE SECTION ─────────────────────────
  // Combines: Store Page text issues (spi) + Assets + Metadata (ana) — max 5 total.
  // _getCurrentMergedStoreItems() is defined in app.js and shared with applyStorePageFix().
  const loading  = (spi?.loading || !spi) && (ana?.loading || !ana);
  const hasError = spi?.error || ana?.error;

  // Compute merged items first so the grade reflects fixes already applied
  const mergedItems = (typeof _getCurrentMergedStoreItems === 'function')
    ? _getCurrentMergedStoreItems() : [];
  const idxNow  = idx.storePage || 0;
  const remaining = Math.max(0, mergedItems.length - idxNow);

  // Grade reflects REMAINING issues (drops as the user applies Shipmate Fixes)
  const spGrade  = (!spi?.loading && !spi?.error)
    ? (remaining === 0 ? 'A' : remaining === 1 ? 'B' : remaining <= 3 ? 'C' : 'D')
    : null;
  const assGrade = ana?.scores?.assets   || null;
  const metGrade = ana?.scores?.metadata || null;
  const mergedGrade = _worseGrade(spGrade, _worseGrade(assGrade, metGrade));

  let spPageContent = '', spPageFooter = '';
  if (loading) {
    spPageContent = _loadingBody();
  } else if (hasError) {
    spPageContent = `<div class="iys-issue-content"><div class="iys-issue-title">Analysis failed</div><div class="iys-issue-body">${escHtml(spi?.error || ana?.error)}</div></div>`;
    spPageFooter  = `<button class="iys-fix-btn" onclick="state.storePageInsights=null;state.improveSubmissionAnalysis=null;_autoRunImproveSubmission('${platformId}')"><img src="Assets/SubwooferIcon_Orange.png" onerror="this.style.display='none'">Retry</button>`;
  } else {
    const n = mergedItems.length;
    const i = idxNow;

    if (!n || i >= n) {
      spPageContent = _allGood('Store page, assets & metadata all look strong');
    } else {
      const cur = mergedItems[i];
      spPageContent = `
        <div class="iys-issue-content">
          ${cur.tag ? `<div class="iys-issue-field-tag">${escHtml(cur.tag)}</div>` : ''}
          <div class="iys-issue-title">${escHtml(cur.title)}</div>
          <div class="iys-issue-body">${escHtml(cur.body)}</div>
        </div>`;
      const hasFix  = cur.type === 'sp' && !!cur.fixedValue;
      const hasNext = i < n - 1;
      spPageFooter = `
        <span class="iys-section-counter">${i + 1} / ${n}</span>
        <div class="iys-section-actions">
          ${hasFix ? `<button class="iys-fix-btn" onclick="applyStorePageFix()"><img src="Assets/SubwooferIcon_Orange.png" onerror="this.style.display='none'">Shipmate Fix</button>` : ''}
          ${hasNext ? `<button class="btn btn-ghost btn-sm" onclick="_nextImprovementItem('storePage')">Next</button>` : ''}
        </div>`;
    }
  }
  const spPageSection = _section('Store Page', mergedGrade, spPageContent, spPageFooter);

  // ── LOCALIZATION SECTION ──────────────────────────────
  const langRec  = _highestImpactUnselectedLang();
  const langName = langRec.lang ? (OB_LANG_NAMES[langRec.lang] || langRec.lang) : null;
  const locGrade = langRec.lang ? (langRec.total > 50_000_000 ? 'C' : 'B') : 'A';
  const locContent = langName
    ? `<div class="iys-issue-content">
         <div class="iys-issue-field-tag">${escHtml(langName)}</div>
         <div class="iys-issue-title">Localize into ${escHtml(langName)}</div>
         <div class="iys-issue-body">~${_obFmtGamers(langRec.total)} potential players in your selected markets speak ${escHtml(langName)} as their primary language. Games localized into the local language see 30–50% more revenue on average vs. English-only releases.</div>
       </div>`
    : _allGood('Localization looks strong for your target markets');
  const locSection = _section('Localization', locGrade, locContent, '');

  // ── BINARY SECTION ────────────────────────────────────
  const binContent = `
    <div class="iys-issue-content">
      <div class="iys-issue-title">Pending binary upload</div>
      <div class="iys-issue-body">Shipmate will scan for undeclared SDKs, missing privacy manifests, deprecated APIs, and permission mismatches.</div>
    </div>`;
  const binSection = _section('Binary', 'N/A', binContent, '');

  // ── Re-analyze footer ─────────────────────────────────
  const hasResults = (spi && !spi.loading) || (ana && !ana.loading);
  const reanalyzeRow = hasResults ? `
    <div class="iys-reanalyze-row">
      <button class="btn btn-ghost btn-sm" onclick="state.storePageInsights=null;state.improveSubmissionAnalysis=null;_autoRunImproveSubmission('${platformId}')">Re-analyze all</button>
    </div>` : '';

  // ── Chunk 2: Recommended Partners — 3 columns (QA · Press · Marketing) ──
  // One top pick per category, selected based on platform and game profile.
  const partners = [
    {
      cat: 'QA',
      p: isIos || isAndroid
        ? { name: 'PlaytestCloud', tagline: 'Real-device playtesting with real players — ideal for pre-launch validation.', url: 'https://playtestcloud.com', highlight: true }
        : { name: 'Global App Testing', tagline: 'Professional QA at scale — functional, performance, and compatibility testing.', url: 'https://www.globalapptesting.com' },
    },
    {
      cat: 'Press',
      p: { name: 'Impress', tagline: 'Indie PR with strong outlet relationships — best cost/coverage ratio for small studios.', url: 'https://impress.games', highlight: true },
    },
    {
      cat: 'Marketing',
      p: isIos || isAndroid
        ? { name: 'Chartboost', tagline: 'Mobile-first UA with direct deal network and strong ROAS for casual and mid-core games.', url: 'https://www.chartboost.com' }
        : { name: 'Keymailer', tagline: 'Connect with creators and streamers — efficient key distribution and campaign tracking.', url: 'https://www.keymailer.co' },
    },
  ];

  const partnerHTML = `<div class="iys-partner-row">${partners.map(({ cat, p }) => `
    <div class="iys-partner-cat">
      <div class="iys-partner-cat-label">${escHtml(cat)}</div>
      <div class="iys-partner-cards">
        <a href="${escHtml(p.url)}" target="_blank" rel="noopener" class="iys-partner-card${p.highlight ? ' iys-partner-highlight' : ''}">
          <div style="display:flex;align-items:center;gap:8px;width:100%;margin-bottom:4px;">
            <div class="iys-partner-avatar">${escHtml(p.name[0])}</div>
            <div class="iys-partner-name">${escHtml(p.name)}</div>
          </div>
          <div class="iys-partner-tagline">${escHtml(p.tagline)}</div>
        </a>
      </div>
    </div>`).join('')}</div>`;

  return `
    <div class="iys-wrap">
      <div class="iys-chunk">
        <div class="iys-chunk-label">Shipmate Guidance</div>
        <div class="iys-sections-grid">
          ${spPageSection}
          ${locSection}
          ${binSection}
        </div>
        ${reanalyzeRow}
      </div>
      <div class="iys-chunk">
        <div class="iys-chunk-label">Recommended Partners</div>
        ${partnerHTML}
      </div>
    </div>`;
}

function buildStorePreviewSection() {
  const fd    = state.formData;
  const ups   = state.uploads;
  const a     = state.iosSubmitAnswers;
  const icon  = ups.appIcon;
  const shots = ups.screenshots || [];

  const title     = escHtml(fd.title || 'Your Game Title');
  const category  = escHtml(fd.genre || 'Games');
  const price     = (fd.price && fd.price !== '0') ? `$${fd.price}` : 'GET';
  const priceText = (fd.price && fd.price !== '0') ? `$${fd.price}` : 'Free';
  const iapNote   = (a.hasIAP === 'yes') ? 'In-App Purchases' : '';
  const langCode  = (fd.primaryLanguage || 'EN').toUpperCase().slice(0, 2);
  const activeProj = state.projects.find(p => p.id === state.activeProjectId);
  const activeVer  = activeProj?.versions.find(v => v.id === state.activeVersionId);
  const version    = escHtml(activeVer?.versionNumber || fd.appVersion || '1.0');

  // Subtitle = first sentence of description or placeholder
  const descRaw   = fd.description || '';
  const firstDot  = descRaw.search(/[.!?]/);
  const subtitle  = escHtml(firstDot > 10 && firstDot < 120
    ? descRaw.slice(0, firstDot + 1)
    : descRaw.slice(0, 80) + (descRaw.length > 80 ? '…' : '') || 'Short subtitle');

  const descFull  = descRaw ? escHtml(descRaw) : 'Your game description will appear here once you fill in the Description field in Game Details.';
  const descShort = descRaw.length > 240
    ? escHtml(descRaw.slice(0, 240)) + '…'
    : descFull;

  // Age rating from questionnaire
  const ageRating = (function() {
    const cat = a.ageCategory;
    if (cat === 'made_for_kids') return '4+';
    const intense = state.iosSubmitAnswers;
    const hasAdult = intense.graphicSexual === 'frequent' || intense.extendedViolence === 'frequent';
    const hasTeen  = intense.realisticViolence && intense.realisticViolence !== 'none';
    return hasAdult ? '17+' : hasTeen ? '12+' : '4+';
  })();

  // Privacy section content — mirrors Apple's actual Nutrition Label format
  const privacyHtml = (function() {
    if (a.collectsData === 'no') {
      return `
        <div class="ias-privacy-card ias-privacy-clean">
          <svg viewBox="0 0 28 28" fill="none" width="32" height="32">
            <circle cx="14" cy="14" r="13" stroke="#0a84ff" stroke-width="1.5"/>
            <path d="M9 14l3.5 3.5L19 10" stroke="#0a84ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div class="ias-privacy-clean-title">Data Not Collected</div>
          <div class="ias-privacy-clean-sub">The developer does not collect any data from this app.</div>
        </div>`;
    }

    const dataPerType = a.dataPerType || {};
    const typeEntries = Object.entries(dataPerType);

    if (a.collectsData !== 'yes' || typeEntries.length === 0) {
      return `
        <div class="ias-privacy-card ias-privacy-pending">
          <div class="ias-privacy-pending-msg">Complete the Data Privacy step to populate this section.</div>
        </div>`;
    }

    // Split collected types into Apple's three buckets
    const tracking  = []; // tracking === 'yes'
    const linked    = []; // identity === 'yes' AND tracking !== 'yes'
    const notLinked = []; // neither tracking nor identity linked

    typeEntries.forEach(([id, td]) => {
      if (td.tracking === 'yes')       tracking.push(id);
      else if (td.identity === 'yes')  linked.push(id);
      else                             notLinked.push(id);
    });

    // Get unique Apple group names for a list of typeIds
    function _groups(ids) {
      const seen = new Set();
      return ids.map(id => IOS_DATA_TYPE_LOOKUP[id]?.group || id.replace(/_/g,' ')).filter(g => {
        if (seen.has(g)) return false; seen.add(g); return true;
      });
    }

    // Render one label bucket
    function _bucket(label, ids) {
      if (!ids.length) return '';
      const groups = _groups(ids);
      const shown  = groups.slice(0, 4);
      const extra  = groups.length - 4;
      return `
        <div class="ias-nl-bucket">
          <div class="ias-nl-bucket-label">${label}</div>
          <div class="ias-nl-tags">
            ${shown.map(g => `<span class="ias-nl-tag">${escHtml(g)}</span>`).join('')}
            ${extra > 0 ? `<span class="ias-nl-tag ias-nl-tag-more">+${extra} more</span>` : ''}
          </div>
        </div>`;
    }

    const bucketsHtml = _bucket('Data Used to Track You', tracking)
                      + _bucket('Data Linked to You',     linked)
                      + _bucket('Data Not Linked to You', notLinked);

    return `<div class="ias-nl-card">${bucketsHtml}</div>`;
  })();

  // What's New section
  const releaseNotes = fd.releaseNotes || '';
  const notesHtml = releaseNotes
    ? releaseNotes.split('\n').filter(l => l.trim()).map(l => `<div class="ias-wn-line">- ${escHtml(l.trim().replace(/^[-–•]\s*/, ''))}</div>`).join('')
    : `<div class="ias-wn-line ias-wn-placeholder">Add release notes to your submission to populate this section.</div>`;

  const iconHtml = icon
    ? `<img src="${icon.dataUrl}" class="ias-icon" alt="App icon">`
    : `<div class="ias-icon ias-icon-empty">
        <svg viewBox="0 0 40 40" fill="none" width="24" height="24">
          <rect x="4" y="14" width="32" height="22" rx="3" fill="#555"/>
          <polygon points="20,3 32,14 8,14" fill="#666"/>
        </svg>
      </div>`;

  const shotHtml = shots.length > 0
    ? shots.slice(0, 5).map(s =>
        `<div class="ias-shot-frame"><img src="${_screenshotSrc(s)}" class="ias-shot-img" alt="Screenshot"></div>`
      ).join('')
    : ['Gameplay','Gameplay','Menu'].map(lbl =>
        `<div class="ias-shot-frame ias-shot-empty"><span>${lbl}</span></div>`
      ).join('');

  const infoRows = [
    { label: 'Seller',        value: 'Your Company'      },
    { label: 'Size',          value: '—'                 },
    { label: 'Category',      value: category            },
    { label: 'Compatibility', value: 'iPhone, iPad'      },
    { label: 'Languages',     value: langCode            },
    { label: 'Age Rating',    value: ageRating           },
    { label: 'Copyright',     value: `© ${new Date().getFullYear()}` },
  ].map(r => `
    <div class="ias-info-row">
      <span class="ias-info-label">${r.label}</span>
      <span class="ias-info-value">${r.value}</span>
    </div>`).join('');

  return `
    <div class="ias-device-wrap">
      <div class="ias-label-row">
        <span class="ias-label-badge">
          <svg viewBox="0 0 16 16" fill="none" width="11" height="11" style="margin-right:4px;vertical-align:-1px;"><path d="M8 1.5C4.41 1.5 1.5 4.41 1.5 8S4.41 14.5 8 14.5 14.5 11.59 14.5 8 11.59 1.5 8 1.5zm.75 10.25h-1.5v-5h1.5v5zm0-6.5h-1.5v-1.5h1.5v1.5z" fill="currentColor"/></svg>
          App Store Preview
        </span>
        <span class="ias-label-note">Reflects your submission data</span>
      </div>

      <div class="ias-page">

        <!-- ── Header ── -->
        <div class="ias-header">
          ${iconHtml}
          <div class="ias-header-meta">
            <div class="ias-app-name">${title}</div>
            <div class="ias-app-subtitle">${subtitle}</div>
            ${iapNote ? `<div class="ias-iap-note">${iapNote}</div>` : ''}
          </div>
          <div class="ias-header-cta">
            <button class="ias-get-btn">${price}</button>
          </div>
        </div>

        <!-- ── Meta strip ── -->
        <div class="ias-meta-strip">
          <div class="ias-meta-cell">
            <div class="ias-meta-top">—</div>
            <div class="ias-meta-bot">Ratings</div>
          </div>
          <div class="ias-meta-divider"></div>
          <div class="ias-meta-cell">
            <div class="ias-meta-top ias-meta-age">${ageRating}</div>
            <div class="ias-meta-bot">Age</div>
          </div>
          <div class="ias-meta-divider"></div>
          <div class="ias-meta-cell">
            <div class="ias-meta-top">${priceText}</div>
            <div class="ias-meta-bot">Price</div>
          </div>
          <div class="ias-meta-divider"></div>
          <div class="ias-meta-cell ias-meta-cell-wide">
            <div class="ias-meta-top">${category}</div>
            <div class="ias-meta-bot">Category</div>
          </div>
        </div>

        <!-- ── Screenshots ── -->
        <div class="ias-shots-scroll">
          ${shotHtml}
        </div>
        <div class="ias-device-compat">
          <svg viewBox="0 0 20 20" fill="none" width="14" height="14"><rect x="2" y="4" width="10" height="13" rx="1.5" stroke="currentColor" stroke-width="1.3"/><rect x="14" y="6" width="4" height="9" rx="1" stroke="currentColor" stroke-width="1.3"/></svg>
          <span>iPhone, iPad</span>
          <svg viewBox="0 0 8 14" fill="none" width="6" height="10" style="margin-left:auto;"><path d="M1 1l6 6-6 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>

        <!-- ── Description ── -->
        <div class="ias-section">
          <div class="ias-desc-text" id="ias-desc-text">${descShort}${descRaw.length > 240
            ? ` <button class="ias-more-btn" onclick="
                var el=document.getElementById('ias-desc-text');
                var full=${JSON.stringify(descFull + ' ')};
                var short=${JSON.stringify(descShort + ' ')};
                if(this.textContent==='more'){el.innerHTML=full;this.textContent='less';}
                else{el.innerHTML=short;this.textContent='more';}
              ">more</button>` : ''}</div>
          <div class="ias-dev-row">
            <span class="ias-dev-name">Developer</span>
            <svg viewBox="0 0 8 14" fill="none" width="5" height="9"><path d="M1 1l6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
        </div>

        <div class="ias-section-divider"></div>

        <!-- ── What's New ── -->
        <div class="ias-section">
          <div class="ias-section-head-row">
            <span class="ias-section-head">What's New</span>
            <svg viewBox="0 0 8 14" fill="none" width="5" height="9"><path d="M1 1l6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="ias-wn-version">Version ${version}</div>
          <div class="ias-wn-notes">${notesHtml}</div>
          <div class="ias-wn-edit-hint">
            <svg viewBox="0 0 16 16" fill="none" width="11" height="11"><path d="M11 2.5a1.5 1.5 0 012 2L5.5 12 3 12.5l.5-2.5L11 2.5z" stroke="currentColor" stroke-width="1.3"/></svg>
            Edit in submission details
          </div>
        </div>

        <div class="ias-section-divider"></div>

        <!-- ── App Privacy ── -->
        <div class="ias-section">
          <div class="ias-section-head-row">
            <span class="ias-section-head">App Privacy</span>
            <svg viewBox="0 0 8 14" fill="none" width="5" height="9"><path d="M1 1l6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          ${privacyHtml}
          <div class="ias-privacy-footer">Privacy practices may vary based on features you use or your age.</div>
        </div>

        <div class="ias-section-divider"></div>

        <!-- ── Information ── -->
        <div class="ias-section">
          <div class="ias-section-head">Information</div>
          <div class="ias-info-grid">${infoRows}</div>
          <div class="ias-info-link">Developer Website <svg viewBox="0 0 8 14" fill="none" width="5" height="9" style="margin-left:auto;"><path d="M1 1l6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <div class="ias-info-link">Privacy Policy <svg viewBox="0 0 8 14" fill="none" width="5" height="9" style="margin-left:auto;"><path d="M1 1l6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        </div>

      </div><!-- /ias-page -->
    </div><!-- /ias-device-wrap -->
  `;
}

/* ── Submit Modal (non-iOS legacy) ──────────────────── */

function renderSubmitModal() {
  const modal = document.getElementById('submit-modal');
  if (!modal) return;
  renderGenericSubmitModal(modal);
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


/* ── Track selection modal (shown before final submit for ios/android/steam) ── */
// Renders into the existing submit-overlay / submit-modal so we don't need a new overlay.
function renderTrackSubmitModal(pid) {
  const modal = document.getElementById('submit-modal');
  if (!modal) return;
  const p        = PLATFORMS[pid];
  const tracks   = PLATFORM_TRACKS[pid] || [];
  const proj     = state.projects.find(pr => pr.id === state.activeProjectId);
  const activeVer = proj?.versions.find(v => v.id === state.activeVersionId);
  const versionNum  = activeVer?.versionNumber || '1.0';
  const releaseName = activeVer?.name ? ` — ${escHtml(activeVer.name)}` : '';
  const defaultTrack = proj ? getLastUsedTrack(proj, pid) : (tracks[0]?.id || 'production');

  const trackRows = tracks.map(tr => {
    const liveVer = proj ? getTrackLiveVersion(proj, pid, tr.id) : null;
    const liveLabel = liveVer ? t('track.submit.live', {ver: liveVer}) : t('track.submit.no_live');
    return `
      <label class="track-opt-row">
        <input type="radio" class="track-opt-radio" name="track-sel-${pid}" value="${escHtml(tr.id)}"
               ${tr.id === defaultTrack ? 'checked' : ''}>
        <div class="track-opt-info">
          <span class="track-opt-label">${escHtml(tTrack(pid, tr.id))}</span>
          <span class="track-opt-live">${liveLabel}</span>
        </div>
      </label>`;
  }).join('');

  modal.innerHTML = `
    <div class="submit-modal-header" style="border-top-color:${p.color};">
      <div class="submit-modal-title-row">
        <div class="submit-modal-hicon" style="color:${p.color};">${platformIcon(pid, 22)}</div>
        <div>
          <div class="submit-modal-title">${t('track.submit.title', {platform: platLabel(pid)})}</div>
          <div class="submit-modal-subtitle">v${escHtml(versionNum)}${releaseName}</div>
        </div>
      </div>
      <button class="task-modal-close" onclick="closeSubmitModal()">×</button>
    </div>
    <div class="submit-modal-scroll track-submit-body">
      <div class="track-submit-prompt">${t('track.submit.prompt')}</div>
      <div class="track-opts">
        ${trackRows}
      </div>
    </div>
    <div class="submit-modal-footer">
      <button class="btn btn-ghost" onclick="closeSubmitModal()">${t('btn.cancel')}</button>
      <button class="btn btn-primary" onclick="_confirmTrackSubmit('${pid}')">${t('track.submit.btn')}</button>
    </div>`;
}

/* ── AI inference badge helper ───────────────────────── */
/* ══════════════════════════════════════════════════════════════
   SHARED AI BADGE HELPERS — used by all platforms
   ══════════════════════════════════════════════════════════════ */

// Get answer metadata for any platform.
function _getAnswerMeta(platformId, qid) {
  if (platformId === 'ios')     return state.iosAnswerMeta[qid];
  if (platformId === 'android') return state.cqAnswerMeta[qid];
  if (platformId === 'steam')   return state.steamAnswerMeta[qid];
  return null;
}

// Get the live (current) answer value for any platform.
function _getLiveAnswer(platformId, qid) {
  if (platformId === 'ios')     return state.iosSubmitAnswers[qid];
  if (platformId === 'android') return state.cqAnswers[qid];
  if (platformId === 'steam')   return (state.steamSubmitAnswers.steamContentAnswers || {})[qid];
  return null;
}

/**
 * Returns ' ai-confident' CSS class suffix when the question was answered by AI
 * and the current value matches `val` (if provided).
 * Pass val=undefined to skip the value check (e.g. Steam caller already checks externally).
 */
function _platformAIClass(platformId, qid, val) {
  const meta = _getAnswerMeta(platformId, qid);
  if (!meta || meta.humanConfirmed) return '';
  if (val !== undefined) {
    const ans   = _getLiveAnswer(platformId, qid);
    const match = Array.isArray(ans) ? ans.includes(val) : ans === val;
    if (!match) return '';
  }
  return ' ai-confident';
}

/** Returns AI badge HTML or empty string. */
function _platformAIBadge(platformId, qid, val) {
  return _platformAIClass(platformId, qid, val) ? '<span class="ai-badge">✦</span>' : '';
}

/* ── Shared toggle pill for Unanswered / All filter ─────── */
// Returns toggle pill HTML if collapseMode is active, empty string otherwise.
// offFn / onFn are onclick strings (e.g. 'toggleContentRatingExpanded(false)')
function buildCRTogglePill(collapseMode, showAll, offFn, onFn) {
  if (!collapseMode) return '';
  return `
    <div class="cr-toggle-bar">
      <button class="cr-toggle-btn${!showAll ? ' cr-toggle-active' : ''}"
              onclick="${offFn}">Unanswered</button>
      <button class="cr-toggle-btn${showAll ? ' cr-toggle-active' : ''}"
              onclick="${onFn}">All</button>
    </div>`;
}

/* ── Snapshot helper — captures answered IDs at filter time ─ */
// Called when inference completes or when user clicks "Unanswered".
// Stores a frozen Set so re-answering questions doesn't auto-disappear them.
function takeFilterSnapshot(platformId) {
  if (platformId === 'ios') {
    const a = state.iosSubmitAnswers;
    const s = new Set();
    IOS_INTENSITY_QUESTIONS.forEach(q => { if (a[q.id] !== null && a[q.id] !== undefined) s.add(q.id); });
    IOS_CONTENT_YN_QUESTIONS.forEach(q => { if (a[q.id] !== null && a[q.id] !== undefined) s.add(q.id); });
    state.iosAnsweredAtInference = s;
  } else if (platformId === 'android') {
    const androidQs = CQ_QUESTIONS.filter(q => q.platforms.includes('android'));
    state.androidAnswerSnapshot = new Set(
      androidQs.map(q => q.id).filter(id => _isCurrentlyAnswered('android', id))
    );
  } else if (platformId === 'steam') {
    const sca = state.steamSubmitAnswers.steamContentAnswers || {};
    state.steamAnsweredAtInference = new Set(
      Object.keys(sca).filter(id => sca[id] === 'yes' || sca[id] === 'no')
    );
  }
}

/* ══════════════════════════════════════════════════════
   SHARED UI PRIMITIVES
   These are app-level building blocks used by every platform.
   Add new question types here — never per-platform.
   ══════════════════════════════════════════════════════ */

/**
 * ynRow — YES/NO question row.
 * Shared across all platforms. Handles toggle, amber rail, and tooltip.
 *
 * @param {string}  label         Question text (may include HTML)
 * @param {*}       value         Current value: 'yes' | 'no' | null
 * @param {string}  onYes         onclick expression for YES button
 * @param {string}  onNo          onclick expression for NO button
 * @param {string}  [tooltip]     Tooltip body text
 * @param {boolean} [inverted]    Swap yes/no visual styling (NO = safe answer)
 * @param {string}  [yesClassXtra] Extra CSS classes on YES button (e.g. AI confidence)
 * @param {string}  [noClassXtra]  Extra CSS classes on NO button
 * @param {string}  [yesContent]  Full button inner HTML (default: 'YES')
 * @param {string}  [noContent]   Full button inner HTML (default: 'NO')
 */
function ynRow(label, value, onYes, onNo,
               tooltip = '', inverted = false,
               yesClassXtra = '', noClassXtra = '',
               yesContent = 'YES', noContent = 'NO') {
  const ttHTML  = tooltip
    ? `<span class="tooltip-anchor"><span class="tooltip-icon">?</span><span class="tooltip-body">${tooltip}</span></span>`
    : '';
  const yesBase = inverted ? 'yn-btn yn-no' : 'yn-btn yn-yes';
  const noBase  = inverted ? 'yn-btn yn-yes' : 'yn-btn yn-no';
  const yesClass = `${yesBase}${value === 'yes' ? ' is-selected' : ''}${yesClassXtra ? ' ' + yesClassXtra : ''}`;
  const noClass  = `${noBase}${value === 'no'  ? ' is-selected' : ''}${noClassXtra  ? ' ' + noClassXtra  : ''}`;
  const yesBtn = `<button class="${yesClass}" onclick="${onYes}">${yesContent}</button>`;
  const noBtn  = `<button class="${noClass}"  onclick="${onNo}">${noContent}</button>`;
  return `
    <div class="ios-q-row" data-answered="${value !== null && value !== undefined ? '1' : '0'}">
      <div class="ios-q-left">
        <div class="ios-q-label">${label}${ttHTML}</div>
      </div>
      <div class="question-yn">
        ${inverted ? noBtn + yesBtn : yesBtn + noBtn}
      </div>
    </div>`;
}

/**
 * singleSelectRow — horizontal button group, single selection.
 * Shared across all platforms. Handles toggle and amber rail.
 * Use for intensity (None/Infrequent/Frequent), 3-way choices, etc.
 *
 * @param {string} label    Question text
 * @param {*}      value    Current selected value (null = unanswered)
 * @param {Array}  options  [{value, label, selectedClass, onSelect, extraClass, content}]
 *                          - selectedClass: CSS class added when this option is selected
 *                          - onSelect: onclick expression string
 *                          - content: optional override HTML inside button
 * @param {string} [tooltip]
 */
function singleSelectRow(label, value, options, tooltip = '') {
  const ttHTML  = tooltip
    ? `<span class="tooltip-anchor"><span class="tooltip-icon">?</span><span class="tooltip-body">${tooltip}</span></span>`
    : '';
  const answered = value !== null && value !== undefined;
  const btns = options.map(o => {
    const sel = value === o.value;
    const cls = `intensity-btn${sel && o.selectedClass ? ' ' + o.selectedClass : ''}${sel && o.extraClass ? ' ' + o.extraClass : ''}`;
    return `<button class="${cls}" onclick="${o.onSelect}">${o.content || o.label}</button>`;
  }).join('');
  return `
    <div class="ios-q-row ios-q-row-intensity" data-answered="${answered ? '1' : '0'}">
      <div class="ios-q-label ios-q-label-sm">${label}${ttHTML}</div>
      <div class="intensity-group">${btns}</div>
    </div>`;
}

/**
 * _isCurrentlyAnswered — real-time answer check for the Unanswered/All toggle.
 * All three platforms' questionnaire filters funnel through this one function
 * so changes to "what counts as answered" apply everywhere at once.
 */
function _isCurrentlyAnswered(platformId, qid) {
  if (platformId === 'ios') {
    const v = state.iosSubmitAnswers[qid];
    return v !== null && v !== undefined && v !== '';
  }
  if (platformId === 'android') {
    const v = state.cqAnswers[qid];
    if (Array.isArray(v)) return v.length > 0;
    return v !== null && v !== undefined && v !== '';
  }
  if (platformId === 'steam') {
    const sca = state.steamSubmitAnswers.steamContentAnswers || {};
    const v   = sca[qid];
    return v !== null && v !== undefined;
  }
  return false;
}

/* ── iOS wrappers — add AI inference decoration on top of shared primitives ── */

// iOS YES/NO row: injects AI confidence classes and badge content
function iosYNRow(label, fieldId, desc, tooltip, inverted = false) {
  const val    = state.iosSubmitAnswers[fieldId];
  const ttText = tooltip || desc || '';
  return ynRow(
    label, val,
    `answerIOSField('${fieldId}','yes')`,
    `answerIOSField('${fieldId}','no')`,
    ttText, inverted,
    _platformAIClass('ios', fieldId, 'yes').trim(),
    _platformAIClass('ios', fieldId, 'no').trim(),
    'YES' + _platformAIBadge('ios', fieldId, 'yes'),
    'NO'  + _platformAIBadge('ios', fieldId, 'no')
  );
}

// iOS intensity row (None / Infrequent / Frequent): injects AI decoration
function iosIntensityRow(label, fieldId, tooltip) {
  const val  = state.iosSubmitAnswers[fieldId];
  const opts = [
    { value: 'frequent',   label: 'Frequent',   selectedClass: 'is-sel-frequent',
      extraClass: _platformAIClass('ios', fieldId, 'frequent').trim(),
      content: 'Frequent'   + _platformAIBadge('ios', fieldId, 'frequent'),
      onSelect: `answerIOSField('${fieldId}','frequent')` },
    { value: 'infrequent', label: 'Infrequent', selectedClass: 'is-sel-infrequent',
      extraClass: _platformAIClass('ios', fieldId, 'infrequent').trim(),
      content: 'Infrequent' + _platformAIBadge('ios', fieldId, 'infrequent'),
      onSelect: `answerIOSField('${fieldId}','infrequent')` },
    { value: 'none',       label: 'None',       selectedClass: 'is-sel-none',
      extraClass: _platformAIClass('ios', fieldId, 'none').trim(),
      content: 'None'       + _platformAIBadge('ios', fieldId, 'none'),
      onSelect: `answerIOSField('${fieldId}','none')` },
  ];
  return singleSelectRow(label, val, opts, tooltip);
}

/* ── Privacy ─────────────────────────────────────────── */
/* ── Questionnaire: combined Content Rating + Data + Business ─ */
function buildQuestionnaireSection(platformId) {
  // ── Debug: natural language content summary (temporary — won't ship) ──────
  // Sources use the pre-inference snapshot (state.lastInferenceSources) so they show
  // what actually went INTO the prompt, not what inference produced as output.
  let debugSummaryBlock = '';
  if (typeof buildNaturalLanguageSummary === 'function') {
    const summary = buildNaturalLanguageSummary();
    // Use the stored pre-inference snapshot; fall back to live only before first inference run
    const sources = state.lastInferenceSources !== null
      ? state.lastInferenceSources
      : (typeof buildContextSources === 'function' ? buildContextSources() : []);
    if (summary || sources.length) {
      const safe = (summary || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const seePromptBtn = state.lastInferencePrompt
        ? '<button class="see-prompt-btn" onclick="showInferencePrompt()">See Prompt</button>'
        : '';
      const sourcesHtml = sources.length
        ? `<div class="csd-sources"><span class="csd-sources-label">This prompt was constructed using:</span><ul class="csd-sources-list">${sources.map(s => `<li>${escHtml(s)}</li>`).join('')}</ul></div>`
        : '';
      debugSummaryBlock = `
        <div class="content-summary-debug">
          <div class="csd-header">🔍 Content Profile Summary <span class="csd-tag">DEBUG</span>${seePromptBtn}</div>
          ${sourcesHtml}
          ${safe ? `<div class="csd-body">${safe}</div>` : ''}
        </div>`;
    }
  }

  const sections = [];

  if (platformId === 'ios') {
    sections.push({ label: 'Content Rating',  body: buildContentRatingSection() });
    sections.push({ label: 'Data Privacy',    body: buildPrivacySection() });
    sections.push({ label: 'Business',        body: buildBusinessSection() + buildExportComplianceSection() });
  } else if (platformId === 'android') {
    sections.push({ label: 'Content Rating',  body: buildAndroidContentRatingSection() });
    sections.push({ label: 'Data Safety',     body: buildAndroidDataSafetySection() });
    sections.push({ label: 'Business',        body: buildAndroidBusinessSection() });
  } else if (platformId === 'steam') {
    sections.push({ label: 'Content Rating',  body: buildSteamContentRatingSection() });
    sections.push({ label: 'Store Tags',      body: buildSteamStoreTagsSection() });
    sections.push({ label: 'Technical',       body: buildSteamTechnicalSection() });
  }

  return debugSummaryBlock + sections.map((s, i) => `
    <div class="qs-section${i > 0 ? ' qs-section-divided' : ''}">
      <div class="qs-section-header">${s.label}</div>
      ${s.body}
    </div>`).join('');
}

/* ── Privacy / Data Safety preset chips ─────────────── */
function _buildPrivacyPresetChips() {
  const selected = new Set(state.privacyPresets || []);
  const chips = PRIVACY_PRESETS.map(p => {
    const active = selected.has(p.id);
    return `
      <button class="prv-preset-chip${active ? ' is-active' : ''}"
              onclick="togglePrivacyPreset('${p.id}')">
        <span class="prv-preset-chip-label">${escHtml(p.label)}</span>
        <span class="prv-preset-chip-sub">${escHtml(p.sub)}</span>
      </button>`;
  }).join('');
  return `
    <div class="prv-preset-wrap">
      <div class="prv-preset-heading">Quick setup — select everything that applies:</div>
      <div class="prv-preset-chips">${chips}</div>
    </div>`;
}

function buildPrivacySection() {
  const a = state.iosSubmitAnswers;
  const noUrl = !a.privacyPolicyUrl.trim();

  let collectBlock = '';
  if (a.collectsData === 'yes') {
    const descVal = (a.privacyDescription || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const statusHtml = state.privacyAIStatus === 'loading'
      ? `<div class="prv-nlp-status loading"><span class="ai-spinner"></span> Translating to privacy labels…</div>`
      : state.privacyAIStatus === 'complete'
      ? `<div class="prv-nlp-status done">✓ Privacy labels updated — expand below to review or adjust</div>`
      : state.privacyAIStatus === 'error'
      ? `<div class="prv-nlp-status error">Translation failed. <button class="btn-inline" onclick="_triggerPrivacyAI()">Try again</button></div>`
      : '';
    collectBlock = `
      <div class="prv-nlp-wrap">
        <label class="form-label">${t('ios.privacy.desc.label') || 'Describe your data collection'}
          <span class="tooltip-anchor"><span class="tooltip-icon">?</span><span class="tooltip-body">${t('ios.privacy.desc.tooltip') || 'Describe every data type your app collects and why. Shipmate will translate this into the required Apple privacy label selections.'}</span></span>
        </label>
        <textarea class="form-input prv-nlp-textarea"
                  placeholder="${t('ios.privacy.desc.placeholder') || 'e.g. We collect email addresses for account creation, device crash reports to fix bugs, and advertising IDs to serve relevant ads through our ad network.'}"
                  onblur="updatePrivacyDescription(this.value)">${descVal}</textarea>
        ${statusHtml}
        ${buildPrivacyMatrix(a)}
      </div>`;
  }

  return `
    <div class="form-group">
      <label class="form-label">${t('ios.privacy.url.label') || 'Privacy Policy URL'}
        <span class="tooltip-anchor">
          <span class="tooltip-icon">?</span>
          <span class="tooltip-body">${t('ios.privacy.url.tooltip') || 'Apple requires a live, reachable URL. A missing or broken link is an automatic rejection reason.'}</span>
        </span>
      </label>
      <input class="form-input" type="url" id="ios-privacy-url" value="${a.privacyPolicyUrl}"
             placeholder="${t('ob.field.privacy_url.placeholder') || 'https://yourgame.com/privacy'}"
             oninput="setPrivacyUrl(this.value)"
             onblur="reRenderStepModal()">
      ${noUrl ? '<div class="ios-risk-note risk-HIGH">Required. A missing privacy policy URL is an automatic App Review rejection.</div>' : ''}
    </div>
    ${_buildPrivacyPresetChips()}
    ${a.collectsData === null ? iosYNRow(t('ios.privacy.collects.label') || 'Does your app collect any data from users?', 'collectsData',
      t('ios.privacy.collects.tooltip') || 'Includes analytics SDKs, crash reporters, accounts, device IDs, or any third-party SDK that collects data.') : ''}
    ${collectBlock}`;
}

function buildPrivacyMatrix(a) {
  const cols = IOS_PURPOSES;
  const META_COLS = [
    { id: 'linked_identity', label: t('ios.privacy.linked.label') || 'Linked to Identity' },
    { id: 'used_tracking',   label: t('ios.privacy.tracking.label') || 'Used for Tracking' },
  ];
  const META_COL_TIPS = {
    linked_identity: t('ios.privacy.linked.tooltip') || "Data directly linked to the user's identity — such as their account, name, or email address.",
    used_tracking:   t('ios.privacy.tracking.tooltip') || "Data used to track the user across third-party apps or websites for advertising or analytics.",
  };

  const expanded        = state.privacyMatrixExpanded;
  const selectedTypeIds = new Set(Object.keys(a.dataPerType));
  const selectedCount   = Object.keys(a.dataPerType).length;

  // Header row with inline tooltips
  const purposeHeaders = cols.map(c => {
    const cLabel = t(`ios.purpose.${c.id}.label`) || c.label;
    const cDesc  = t(`ios.purpose.${c.id}.desc`)  || c.desc;
    return `<th class="prv-col-hd"><span class="tooltip-anchor" data-tip="${cDesc}">${cLabel} <span class="tooltip-icon">?</span><span class="tooltip-body">${cDesc}</span></span></th>`;
  }).join('');
  const metaHeaders = META_COLS.map(c =>
    `<th class="prv-col-hd prv-meta-col"><span class="tooltip-anchor" data-tip="${META_COL_TIPS[c.id]}">${c.label} <span class="tooltip-icon">?</span><span class="tooltip-body">${META_COL_TIPS[c.id]}</span></span></th>`).join('');

  // Build rows — all types shown when expanded (grouped); none when collapsed
  let bodyHtml = '';
  if (expanded) {
    IOS_DATA_TYPES.forEach(group => {
      bodyHtml += `<tr class="prv-group-row"><td colspan="${1 + cols.length + META_COLS.length}">${group.group}</td></tr>`;
      group.types.forEach(t => {
        const isOn = !!a.dataPerType[t.id];
        const td   = a.dataPerType[t.id] || { purposes: [], identity: null, tracking: null };
        const purposeCells = cols.map(c => {
          const checked = td.purposes.includes(c.id);
          return `<td class="prv-check-cell">
            <input type="checkbox" class="prv-cb" ${isOn ? '' : 'disabled'}
                   data-type="${t.id}" data-col="${c.id}"
                   ${checked ? 'checked' : ''}
                   onclick="event.stopPropagation()"
                   onchange="togglePrivacyPurpose('${t.id}','${c.id}',this.checked)">
          </td>`;
        }).join('');
        const metaCells = META_COLS.map(c => {
          const isChecked = c.id === 'linked_identity' ? td.identity === 'yes' : td.tracking === 'yes';
          const field     = c.id === 'linked_identity' ? 'identity' : 'tracking';
          return `<td class="prv-check-cell prv-meta-col">
            <input type="checkbox" class="prv-cb" ${isOn ? '' : 'disabled'}
                   data-type="${t.id}" data-meta="${field}"
                   ${isChecked ? 'checked' : ''}
                   onclick="event.stopPropagation()"
                   onchange="setPrivacyMeta('${t.id}','${field}',this.checked)">
          </td>`;
        }).join('');
        bodyHtml += `
          <tr class="prv-data-row ${isOn ? 'is-on' : ''}" onclick="togglePrivacyDataType('${t.id}')">
            <td class="prv-type-cell">
              <span class="prv-type-name tooltip-anchor" data-tip="${t.desc}">${t.label}</span>
            </td>
            ${purposeCells}
            ${metaCells}
          </tr>`;
      });
    });
  }

  const tableHtml = expanded ? `
    <div class="prv-matrix-wrap">
      <table class="prv-matrix">
        <thead>
          <tr>
            <th class="prv-type-hd">Data Type</th>
            ${purposeHeaders}
            ${metaHeaders}
          </tr>
        </thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    </div>
    ${Object.values(a.dataPerType).some(t => t.tracking === 'yes') ?
      `<div class="dist-tip-box" style="margin-top:10px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span><strong>Tracking:</strong> You must implement Apple's AppTrackingTransparency framework and request user permission before collecting any data used for tracking.</span>
      </div>` : ''}` : '';

  return `
    <div class="ios-subsection" style="margin-top:10px;">
      <div class="prv-matrix-header">
        ${selectedCount > 0 ? `<span class="prv-count-badge">${selectedCount} type${selectedCount !== 1 ? 's' : ''} selected</span>` : ''}
        <button class="prv-expand-btn" onclick="togglePrivacyMatrix()">
          ${expanded ? `${_chevUp} Hide data types` : `${_chevDown} Show all data types`}
        </button>
      </div>
      ${tableHtml}
    </div>`;
}

/* ── Content Rating ──────────────────────────────────── */
// Category structure for iOS Content Rating — used by buildContentRatingSection to
// render questions and to separate answered vs unanswered after AI inference.
const IOS_CR_CATEGORIES = [
  { id: 'features',    label: 'Features', questions: [
    { type: 'yn',        id: 'parentalControls' },
    { type: 'yn',        id: 'ageAssurance' },
    { type: 'yn',        id: 'unrestrictedInternet' },
    { type: 'yn',        id: 'userGenContent' },
    { type: 'yn',        id: 'messagingChat' },
    { type: 'yn',        id: 'advertising' },
  ]},
  { id: 'mature',      label: 'Mature Themes', questions: [
    { type: 'intensity', id: 'profanity' },
    { type: 'intensity', id: 'horrorFear' },
    { type: 'intensity', id: 'substancesAlcohol' },
  ]},
  { id: 'medical',     label: 'Medical or Wellness', questions: [
    { type: 'intensity', id: 'medicalTreatment' },
    { type: 'yn',        id: 'healthWellness' },
  ]},
  { id: 'sexuality',   label: 'Sexuality or Nudity', questions: [
    { type: 'intensity', id: 'matureSuggestive' },
    { type: 'intensity', id: 'sexualContent' },
    { type: 'intensity', id: 'graphicSexual' },
  ]},
  { id: 'violence',    label: 'Violence', questions: [
    { type: 'intensity', id: 'cartoonViolence' },
    { type: 'intensity', id: 'realisticViolence' },
    { type: 'intensity', id: 'extendedViolence' },
    { type: 'intensity', id: 'gunsWeapons' },
  ]},
  { id: 'gambling',    label: 'Chance-Based Activities', questions: [
    { type: 'intensity', id: 'simulatedGambling' },
    { type: 'intensity', id: 'contests' },
    { type: 'yn',        id: 'realMoneyGambling' },
    { type: 'yn',        id: 'lootBoxes' },
  ]},
];

// Risk notes that follow specific questions wherever they're rendered
const IOS_CR_RISK_NOTES = {
  realMoneyGambling: a => a.realMoneyGambling === 'yes'
    ? '<div class="ios-risk-note risk-HIGH">Real-money gambling requires a special Apple entitlement and proof of licensing in every territory where it is offered. Apple will ask for documentation during review.</div>'
    : '',
  lootBoxes: a => a.lootBoxes === 'yes'
    ? '<div class="ios-risk-note risk-MEDIUM">Apps with loot boxes must clearly disclose the odds of receiving each item type before a player makes a purchase.</div>'
    : '',
};

function buildContentRatingSection() {
  const a = state.iosSubmitAnswers;

  // Quick lookups
  const iq = id => { const q = IOS_INTENSITY_QUESTIONS.find(q => q.id === id); return { ...q, label: t(`iosint.${q.id}.label`) || q.label, tooltip: t(`iosint.${q.id}.tooltip`) || q.tooltip }; };
  const yq = id => { const q = IOS_CONTENT_YN_QUESTIONS.find(q => q.id === id); return { ...q, label: t(`iosyn.${q.id}.label`) || q.label, tooltip: t(`iosyn.${q.id}.tooltip`) || q.tooltip }; };

  // Render one question row (intensity or Y/N)
  const renderQ = q => {
    const html = q.type === 'intensity'
      ? (() => { const d = iq(q.id); return iosIntensityRow(d.label, d.id, d.tooltip); })()
      : (() => { const d = yq(q.id); return iosYNRow(d.label, q.id, '', d.tooltip); })();
    return html + (IOS_CR_RISK_NOTES[q.id] ? IOS_CR_RISK_NOTES[q.id](a) : '');
  };

  // Whether a question was answered at inference time (determines collapse eligibility)
  const answered     = state.iosAnsweredAtInference; // null = pre-inference, Set = post-inference
  const showAll      = state.iosContentRatingExpanded; // false = "Unanswered", true = "All"
  const collapseMode = answered !== null;

  // "Unanswered / All" toggle pill — shown only after AI inference has run
  const togglePill = buildCRTogglePill(collapseMode, showAll,
    'toggleContentRatingExpanded(false)', 'toggleContentRatingExpanded(true)');

  // Build question rows — filter by answered/unanswered when in collapseMode + "Unanswered" view
  // Uses snapshot (answered) not live state so questions don't vanish mid-session
  let questionsHtml = '';
  for (const cat of IOS_CR_CATEGORIES) {
    const qsToShow = (collapseMode && !showAll)
      ? cat.questions.filter(q => !answered.has(q.id))
      : cat.questions;

    if (qsToShow.length > 0) {
      questionsHtml += `<div class="ios-q-divider"></div>
        <div class="ios-content-step-label">${cat.label}</div>
        ${qsToShow.map(renderQ).join('')}`;
    }
  }

  // Additional Information section — always visible (it's a categorisation choice, not content Q)
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

  const additionalSection = `
    <div class="ios-q-divider"></div>
    <div class="ios-content-step-label">Additional Information</div>
    <div class="ios-q-row" style="align-items:center;gap:12px;">
      <div class="ios-q-left">
        <div class="ios-q-label">${t('ios.age.category.label') || 'Age Category'}
          <span class="tooltip-anchor"><span class="tooltip-icon">?</span><span class="tooltip-body">${t('ios.age.category.tooltip') || 'Override the calculated rating for apps targeting a specific age group or with EULA age requirements.'}</span></span>
        </div>
      </div>
      <select class="form-input" style="width:auto;min-width:220px;font-size:12px;" onchange="answerIOSField('ageCategory',this.value)">
        <option value="">Select…</option>
        <option value="not_applicable"  ${a.ageCategory==='not_applicable' ?'selected':''}>${t('ios.age.category.not_applicable') || 'Not Applicable'}</option>
        <option value="made_for_kids"   ${a.ageCategory==='made_for_kids'  ?'selected':''}>${t('ios.age.category.made_for_kids') || 'Made for Kids'}</option>
        <option value="override_higher" ${a.ageCategory==='override_higher'?'selected':''}>${t('ios.age.category.override_higher') || 'Override to Higher Rating'}</option>
      </select>
    </div>
    ${kidsFollowUp}
    ${overrideFollowUp}
    <div class="form-group" style="margin-top:14px;">
      <label class="form-label">${t('ios.age.suitability.label') || 'Age Suitability URL'} <span class="form-section-note">${t('ob.field.optional_tag') || 'Optional'}</span>
        <span class="tooltip-anchor"><span class="tooltip-icon">?</span><span class="tooltip-body">${t('ios.age.suitability.tooltip') || 'A URL with additional age suitability information for Apple reviewers.'}</span></span>
      </label>
      <input class="form-input" type="url" value="${a.ageSuitabilityUrl}"
             placeholder="${t('ios.age.suitability.placeholder') || 'https://yourgame.com/age-suitability'}"
             oninput="updateIOSTextField('ageSuitabilityUrl', this.value)"
             onblur="reRenderStepModal()">
    </div>`;

  return togglePill + questionsHtml + additionalSection;
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
              <label class="form-label">${t('ios.export.ern.label') || 'ERN Number'}</label>
              <input class="form-input" type="text" value="${a.ernNumber}" placeholder="${t('ios.export.ern.placeholder') || 'ENC-XXXXXXXX'}"
                     oninput="updateIOSTextField('ernNumber', this.value)"
                     onblur="reRenderStepModal()">
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

  const fd = state.formData;
  const priceVal = fd.price || '';

  return `
    <div class="form-group">
      <label class="form-label">Price (USD)
        <span class="tooltip-anchor">
          <span class="tooltip-icon">?</span>
          <span class="tooltip-body">Your base price for iOS. Leave blank or enter 0 for free. Shipmate will convert to local currencies across all regions.</span>
        </span>
      </label>
      <input class="form-input" id="ios-price" type="text" placeholder="4.99 (or 0 for free)"
             value="${priceVal}"
             oninput="syncField('price', this.value)"
             onblur="roundPrice(this)">
    </div>
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
  const MAX_GAMERS = 140; // China, for bar scaling
  const VISIBLE = 10;

  function fmtGamers(n) {
    if (n >= 100) return n + 'M';
    if (n >= 10)  return n + 'M';
    return n + 'M';
  }

  const extraCount = IOS_COUNTRIES.length - VISIBLE;

  // Build rows; inject the expand button between row VISIBLE-1 and row VISIBLE
  const rows = IOS_COUNTRIES.map((c, i) => {
    const isOn  = a.selectedCountries.includes(c.code);
    const pct   = Math.round((c.iosGamers / MAX_GAMERS) * 100);
    const label = fmtGamers(c.iosGamers);
    const hidden = i >= VISIBLE ? ' dist-row-extra' : '';

    // Inject the expand toggle as a pseudo-row right after the 10th entry
    const expandBtn = i === VISIBLE ? `
      <div class="dist-expand-row" id="dist-expand-btn" onclick="toggleDistExpand()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        ${t('ob.dist.show_more', { count: extraCount })}
      </div>` : '';

    return `${expandBtn}
      <div class="dist-country-row${hidden}">
        <button class="dist-country-chip ${isOn ? 'is-on' : ''}"
                id="dist-chip-${c.code}"
                onclick="toggleIOSCountry('${c.code}')">${c.name}</button>
        <div class="dist-bar-wrap">
          <div class="dist-bar-fill" id="dist-bar-${c.code}" style="width:${pct}%; background:${isOn ? 'rgba(59,130,246,0.5)' : 'var(--border-hover)'}"></div>
        </div>
        <span class="dist-gamer-count">${label}</span>
      </div>`;
  }).join('');

  const preset = a.distPreset || 'custom';

  return `
    <div id="distribution-map-container" class="world-map-container" style="margin-bottom:14px;"></div>
    <div class="ios-q-label" style="margin-bottom:8px;">${t('ob.dist.question') || 'Where do you intend to make the game available?'}</div>
    <div class="dist-preset-row">
      <button class="dist-preset-btn ${preset === 'everywhere' ? 'is-active' : ''}" onclick="setDistPreset('everywhere')">${t('ob.dist.preset.everywhere') || 'Everywhere'}</button>
      <button class="dist-preset-btn ${preset === 'everywhere_except_cn' ? 'is-active' : ''}" onclick="setDistPreset('everywhere_except_cn')">${t('ob.dist.preset.everywhere_except_cn')}</button>
      <button class="dist-preset-btn ${preset === 'english_only' ? 'is-active' : ''}" onclick="setDistPreset('english_only')">${t('ob.dist.preset.english_only') || 'English only'}</button>
      <button class="dist-preset-btn ${preset === 'custom' ? 'is-active' : ''}" onclick="setDistPreset('custom')">${t('ob.dist.preset.custom') || 'Custom'}</button>
    </div>
    <div class="dist-tip-box">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span>${t('tip.distribution.regions') || 'Gamer behavior varies significantly between regions. A successful launch carefully considers localization, culturalization, purchase behavior, and market fit in each region.'}</span>
    </div>
    <div class="dist-list-header">
      <span class="dist-list-col-country">Market</span>
      <span class="dist-list-col-bar"></span>
      <span class="dist-list-col-count">iOS Gamers (Approx)</span>
    </div>
    <div class="dist-country-list" id="dist-country-list">
      ${rows}
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

/* ── Consolidated Questionnaire Modal ────────────────── */

function buildCQQuestion(q) {
  const answer      = state.cqAnswers[q.id];
  const meta        = state.cqAnswerMeta[q.id];
  const isAI        = meta && !meta.humanConfirmed;
  const isAIHigh    = isAI && meta.confidence >= 90;   // auto-confirmed look
  const isAILow     = isAI && meta.confidence < 90;    // badge + dim
  const activePlats = q.platforms.filter(p => state.activePlatforms.has(p));
  const platColors  = { ios:'#007AFF', android:'#34A853', egs:'#888', steam:'#4c6b8a' };
  const platLabels  = { ios:'iOS', android:'Android', egs:'EGS', steam:'Steam' };

  const badges = activePlats.map(p =>
    `<span class="cq-plat-badge" style="color:${platColors[p]};border-color:${platColors[p]}40;background:${platColors[p]}12;">${platLabels[p]}</span>`
  ).join('');

  const aiBadge = isAILow
    ? `<span class="cq-ai-badge" title="AI suggestion — ${meta.confidence}% confidence. Click any answer to confirm.">AI · ${meta.confidence}%</span>`
    : '';

  const indentStyle = q.indent
    ? `margin-left:${q.indent * 22}px;padding-left:12px;border-left:2px solid var(--border);`
    : '';

  // Dim the entire question if AI-suggested at lower confidence
  const dimClass = isAILow ? 'cq-question-ai-unconfirmed' : '';

  let inputHTML = '';

  if (q.type === 'yn') {
    inputHTML = `
      <div class="cq-yn">
        <button class="cq-yn-btn ${answer === 'yes' ? 'is-active' : ''} ${isAIHigh && answer === 'yes' ? 'is-ai-confirmed' : ''}"
                onclick="setCQAnswer('${q.id}','yes')">Yes</button>
        <button class="cq-yn-btn ${answer === 'no' ? 'is-active' : ''} ${isAIHigh && answer === 'no' ? 'is-ai-confirmed' : ''}"
                onclick="setCQAnswer('${q.id}','no')">No</button>
      </div>`;

  } else if (q.type === 'single') {
    inputHTML = `<div class="cq-single">` +
      (q.options || []).map((opt, i) => `
        <button class="cq-single-btn ${answer === opt ? 'is-active' : ''} ${isAIHigh && answer === opt ? 'is-ai-confirmed' : ''}"
                data-qid="${q.id}" data-oidx="${i}"
                onclick="setCQSingle('${q.id}',${i})">${t(`${q.id}.opt.${i}`) || opt}</button>`
      ).join('') +
      `</div>`;

  } else if (q.type === 'multi') {
    const arr = Array.isArray(answer) ? answer : [];
    inputHTML = `<div class="cq-checkboxes">` +
      (q.options || []).map((opt, i) => `
        <label class="cq-check-row ${isAI && arr.includes(opt) ? 'is-ai-checked' : ''}">
          <input type="checkbox" ${arr.includes(opt) ? 'checked' : ''}
                 data-qid="${q.id}" data-oidx="${i}"
                 onchange="handleCQMulti(this)">
          <span>${t(`${q.id}.opt.${i}`) || opt}</span>
        </label>`
      ).join('') +
      `</div>`;

  } else if (q.type === 'text') {
    const val = typeof answer === 'string' ? answer : '';
    const placeholderText = t(`${q.id}.placeholder`) || (q.placeholder || '');
    inputHTML = `<textarea class="cq-textarea" rows="3"
                  placeholder="${placeholderText.replace(/"/g,'&quot;')}"
                  onblur="setCQAnswer('${q.id}',this.value)">${val}</textarea>`;
  }

  return `
    <div class="cq-question ${dimClass}" style="${indentStyle}">
      <div class="cq-question-top">
        <div class="cq-plat-badges">${badges}</div>
        <div class="cq-q-text">${t(`${q.id}.text`) || q.text}</div>
        ${aiBadge}
      </div>
      ${inputHTML}
    </div>`;
}

function renderCQModal() {
  const modal = document.getElementById('cq-modal');
  if (!modal) return;
  modal.classList.toggle('is-validating', !!state.showHighlights);

  const { total, answered } = cqProgress();
  const pct = total ? Math.round(answered / total * 100) : 0;

  // Gather visible questions preserving definition order
  const sectionOrder = [];
  const sectionMap   = {};
  for (const q of CQ_QUESTIONS) {
    if (!cqIsVisible(q)) continue;
    if (!sectionMap[q.section]) {
      sectionMap[q.section] = [];
      sectionOrder.push(q.section);
    }
    sectionMap[q.section].push(q);
  }

  // Active platform names for subtitle
  const platNames = [...state.activePlatforms].map(p => PLATFORMS[p]?.label).join(' · ');

  let body = '';
  if (sectionOrder.length === 0) {
    body = `<div class="cq-empty">Please select platforms to continue.</div>`;
  } else {
    for (const sec of sectionOrder) {
      body += `<div class="cq-section-header">${sec}</div>`;
      let lastSub = null;
      for (const q of sectionMap[sec]) {
        if (q.subsection && q.subsection !== lastSub) {
          body += `<div class="cq-subsection-label">${q.subsection}</div>`;
          lastSub = q.subsection;
        } else if (!q.subsection) {
          lastSub = null;
        }
        body += buildCQQuestion(q);
      }
    }
  }

  modal.innerHTML = `
    <div class="cq-modal-header">
      <div>
        <div class="cq-modal-title">Consolidated Questionnaire</div>
        <div class="cq-modal-subtitle">${platNames || 'No platforms selected'}</div>
      </div>
      <button class="task-modal-close" onclick="closeCQModal()">×</button>
    </div>
    <div class="cq-modal-progress-bar">
      <div class="cq-modal-progress-fill" style="width:${pct}%"></div>
    </div>
    <div class="cq-modal-body" id="cq-modal-body">${body}</div>
    <div class="cq-modal-footer">
      <span class="cq-footer-count">${answered} of ${total} answered</span>
      <button class="btn btn-primary" onclick="closeCQModal()">Save &amp; Close</button>
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

/* ═══════════════════════════════════════════════════
   ANDROID STEP SECTIONS
   ═══════════════════════════════════════════════════ */

/**
 * swSelect — reusable styled dropdown (matches Primary Language picker aesthetic).
 * @param {string}   id          Unique DOM id suffix — element gets id="swsel-{id}"
 * @param {string}   currentValue  Currently selected value, or null
 * @param {Array}    options      [{value, label}, ...]
 * @param {string}   onChangeFn  Name of a global function called with the chosen value
 */
function swSelect(id, currentValue, options, onChangeFn, width = '100%') {
  const chevSvg = `<svg class="loc-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
  const isNull  = currentValue === null || currentValue === undefined || currentValue === '';
  const currentLabel = isNull ? 'Select…' : (options.find(o => o.value === currentValue)?.label || 'Select…');

  const ddItems = options.map(o => `
    <button class="loc-dd-item${o.value === currentValue ? ' is-current' : ''}"
            onclick="swSelectChoose('${id}','${o.value}','${onChangeFn}')">
      <span class="loc-dd-name">${escHtml(o.label)}</span>
    </button>`).join('');

  return `
    <div class="loc-primary-wrap sw-select-wrap" id="swsel-${id}" style="min-width:0;max-width:100%;width:${width};">
      <button class="loc-primary-pill" onclick="toggleSwSelect(event,'${id}')">
        <span class="loc-primary-name${isNull ? ' is-placeholder' : ''}">${currentLabel}</span>
        ${chevSvg}
      </button>
      <div class="loc-dropdown">${ddItems}</div>
    </div>`;
}

/* Android YES/NO row — thin wrapper over shared ynRow primitive */
function androidYNRow(label, fieldId, desc) {
  const val = state.androidSubmitAnswers[fieldId];
  return ynRow(label, val,
    `answerAndroidField('${fieldId}','yes')`,
    `answerAndroidField('${fieldId}','no')`,
    desc);
}

/* Android Content Rating */
function buildAndroidContentRatingSection() {
  const { total, answered } = androidCqProgress();

  /* Short labels and section name overrides for IARC/Google Play questions */
  const SECTION_NAMES = {
    'Blood, Violence, or Gory Images':                          'Violence & Gore',
    'Fear':                                                     'Fear & Horror',
    'Language':                                                 'Language',
    'Crude Humor':                                              'Crude Humor',
    'Nudity or Sexual Content':                                 'Nudity & Sexual Content',
    'Controlled Substances':                                    'Controlled Substances',
    'Gambling & Speculative Acts':                              'Gambling',
    'Digital Purchases, Cash Convertible Rewards, or NFTs':     'Digital Purchases',
    'Interactive Elements':                                     'Interactive Elements',
    'Elements of Extremism':                                    'Extremism',
  };

  const Q_LABELS = {
    cq_violence:          'Violence or gory images',
    cq_violence_types:    'Types of violence',
    cq_violence_setting:  'Setting',
    cq_violence_pixelated:'Art style',
    cq_vh_reactions:      'Reactions to violence',
    cq_vh_presentation:   'How violence is shown',
    cq_vh_gore_level:     'Blood & gore level',
    cq_vh_war:            'Realistic war setting',
    cq_vh_innocents:      'Harm to innocents',
    cq_vh_fierce:         'Intense or sinister elements',
    cq_vnh_reactions:     'Reactions to non-human violence',
    cq_vnh_gore_level:    'Non-human blood & gore level',
    cq_vnh_human_like:    'Human-like creatures',
    cq_vnh_real_animals:  'Violence against real animals',
    cq_gore_assoc:        'Associated with violent acts',
    cq_gore_explicitness: 'Explicitness',
    cq_fear:              'Scary or horrifying content',
    cq_fear_types:        'Types of fear content',
    cq_fear_scary_freq:   'Frequency of scary elements',
    cq_fear_horror_freq:  'Frequency of horrifying elements',
    cq_fear_imminent:     'Intense unrelenting threat',
    cq_language:          'Offensive language',
    cq_language_types:    'Types of language',
    cq_lang_minor_freq:   'Minor profanity frequency',
    cq_lang_moderate_freq:'Moderate swearing frequency',
    cq_lang_discrim_freq: 'Discriminatory language frequency',
    cq_lang_sexual_freq:  'Sexual expletive frequency',
    cq_crude:             'Crude humor',
    cq_crude_bodily:      'Bodily humor types',
    cq_sexual:            'Sexual or nudity content',
    cq_sexual_types:      'Types of sexual content',
    cq_sex_act_freq:      'Frequency of sexual acts',
    cq_sex_act_depiction: 'How sexual acts are depicted',
    cq_sex_act_minors:    'Characters under 18',
    cq_sex_nudity_types:  'Nudity or revealing attire',
    cq_sex_suggestive_desc:'Suggestive content description',
    cq_sex_dating_focus:  'Dating games as primary focus',
    cq_sex_violence_pres: 'Sexual violence depiction',
    cq_substances:        'Drugs, alcohol, or tobacco',
    cq_sub_types:         'Substance types',
    cq_sub_drugs:         'Illegal drug depiction',
    cq_sub_fantasy:       'Fantasy drug depiction',
    cq_sub_medical:       'Medical drug depiction',
    cq_sub_alcohol:       'Alcohol depiction',
    cq_sub_tobacco:       'Tobacco depiction',
    cq_gambling:          'Gambling or speculative acts',
    cq_gamb_types:        'Gambling types',
    cq_gamb_themes_focus: 'Gambling as primary focus',
    cq_gamb_bingo_cash:   'Bingo with cash payouts',
    cq_gamb_casino_cash:  'Casino with cash payouts',
    cq_digital:           'Digital purchases',
    cq_digital_types:     'Purchase types',
    cq_digital_lootbox:   'Chance-based (loot boxes)',
    cq_location:          'Live location sharing',
    cq_user_interact:     'User-to-user interaction',
    cq_interact_types:    'Interaction safeguards',
    cq_extremism:         'Extremist content',
  };

  /* Render a single CQ question in Content Rating style */
  function renderCRQuestion(q) {
    const label   = Q_LABELS[q.id] || q.text;
    const tooltip = q.text;
    const ans     = state.cqAnswers[q.id];
    const ttHTML  = `<span class="tooltip-anchor"><span class="tooltip-icon">?</span><span class="tooltip-body">${escHtml(tooltip)}</span></span>`;

    if (q.type === 'yn') {
      const yc2 = _platformAIClass('android', q.id, 'yes').trim();
      const nc2 = _platformAIClass('android', q.id, 'no').trim();
      const yb2 = 'YES' + _platformAIBadge('android', q.id, 'yes');
      const nb2 = 'NO'  + _platformAIBadge('android', q.id, 'no');
      // Ensure label is one line (long text → tooltip)
      const qShort = label.length > 52 ? label.slice(0, 52).replace(/[;,]?\s*$/, '') + '…' : label;
      return ynRow(qShort + ttHTML, ans,
        `answerAndroidCR('${q.id}','yes')`,
        `answerAndroidCR('${q.id}','no')`,
        '', false, yc2.trim(), nc2.trim(), yb2, nb2);
    }

    if (q.type === 'single') {
      const opts = q.options;
      if (opts.length <= 4) {
        // Intensity-style buttons — map options to None/mild/etc via index
        const selClasses = ['is-sel-none','is-sel-infrequent','is-sel-frequent','is-sel-frequent'];
        const answered = ans !== null && ans !== undefined && ans !== '';
        const btns = opts.map((o, i) => {
          const sel = ans === o;
          return `<button class="intensity-btn${sel ? ' ' + selClasses[i] : ''}"
                          onclick="answerAndroidCRSingle('${q.id}',${i})">${escHtml(o)}</button>`;
        }).join('');
        return `
          <div class="ios-q-row ios-q-row-intensity" data-answered="${answered ? '1' : '0'}">
            <div class="ios-q-label ios-q-label-sm">${label}${ttHTML}</div>
            <div class="intensity-group">${btns}</div>
          </div>`;
      } else {
        // Dropdown for many options
        const isNull = ans === null || ans === undefined || ans === '';
        const currentLabel = isNull ? 'Select…' : escHtml(ans);
        const ddItems = opts.map((o, i) => `
          <button class="loc-dd-item${ans === o ? ' is-current' : ''}"
                  onclick="answerAndroidCRSingle('${q.id}',${i}); closeAllDropdowns()">
            <span class="loc-dd-name">${escHtml(o)}</span>
          </button>`).join('');
        const chevSvg = `<svg class="loc-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
        const answered = !isNull;
        return `
          <div class="ios-q-row" data-answered="${answered ? '1' : '0'}">
            <div class="ios-q-left"><div class="ios-q-label">${label}${ttHTML}</div></div>
            <div class="loc-primary-wrap sw-select-wrap" id="swsel-cr-${q.id}" style="width:220px;flex-shrink:0;">
              <button class="loc-primary-pill" onclick="toggleSwSelect(event,'cr-${q.id}')">
                <span class="loc-primary-name${isNull ? ' is-placeholder' : ''}">${currentLabel}</span>
                ${chevSvg}
              </button>
              <div class="loc-dropdown" style="right:0;left:auto;">${ddItems}</div>
            </div>
          </div>`;
      }
    }

    if (q.type === 'multi') {
      const current = Array.isArray(ans) ? ans : [];
      const answered = current.length > 0;
      // Render each option as its own ynRow — skip "None" option since not-selected = none
      const checks = q.options.filter(o => !/^none$/i.test(o.trim())).map((o, optIdx) => {
        const val   = current.includes(o) ? 'yes' : null;
        const short = o.length > 48 ? o.slice(0, 48).replace(/[;,]?\s*$/, '') + '…' : o;
        const tip   = o.length > 48 ? o : '';
        const yc    = _platformAIClass('android', q.id, o).trim();
        const nb2   = 'YES' + _platformAIBadge('android', q.id, o);
        return ynRow(escHtml(short), val,
          `answerAndroidCRMultiOpt('${q.id}',${optIdx},'yes')`,
          `answerAndroidCRMultiOpt('${q.id}',${optIdx},'no')`,
          tip, false, yc.trim(), '', nb2);
      }).join('');
      return `
        <div class="ios-q-row" data-answered="${answered ? '1' : '0'}" style="flex-direction:column;">
          <div class="ios-q-label" style="margin-bottom:8px;">${label}${ttHTML}</div>
          <div class="cq-check-list">${checks}</div>
        </div>`;
    }

    return '';
  }

  /* Group android-visible questions by section and render */
  const androidQs    = CQ_QUESTIONS.filter(q => q.platforms.includes('android'));
  const sections     = [...new Set(androidQs.map(q => q.section))];
  const showAll      = state.androidContentRatingExpanded;
  const collapseMode = state.androidAnswerSnapshot !== null;

  const togglePill = buildCRTogglePill(collapseMode, showAll,
    'toggleAndroidContentRatingExpanded(false)', 'toggleAndroidContentRatingExpanded(true)');

  let html = togglePill;

  sections.forEach(section => {
    const visibleQs = androidQs.filter(q => q.section === section && cqIsVisible(q));
    if (!visibleQs.length) return;

    // Use snapshot so questions don't vanish while the user is actively answering
    const filteredQs = (collapseMode && !showAll)
      ? visibleQs.filter(q => !state.androidAnswerSnapshot?.has(q.id))
      : visibleQs;
    if (!filteredQs.length) return;

    // no divider between sections — section label underline is sufficient
    html += `<div class="ios-content-step-label">${SECTION_NAMES[section] || section}</div>`;
    firstSection = false;

    filteredQs.forEach(q => {
      const wrap = q.indent > 0
        ? `<div class="ios-followup">${renderCRQuestion(q)}</div>`
        : renderCRQuestion(q);
      html += wrap;
    });
  });

  if (!html) {
    html = `<div class="ios-risk-note risk-HIGH">No questions applicable. Make sure Google Play is activated as a platform.</div>`;
  }

  return html;
}

/* Stub section for steps not yet implemented */
function buildAndroidStubSection(title, note) {
  return `
    <div class="ios-section-head">${title}</div>
    <div class="sw-tip-box" style="margin-bottom:16px;">
      <div class="sw-tip-box-row">
        <img src="Assets/SubwooferIcon_Orange.png" class="sw-tip-logo" alt="">
        <span class="sw-tip-text">${note}</span>
      </div>
    </div>`;
}

/* Android Store Listing — review metadata */
function buildAndroidBusinessSection() {
  const fd      = state.formData;
  const a       = state.androidSubmitAnswers;
  const titleOk = !!(fd.title?.trim());
  const descOk  = !!(fd.description?.trim());
  return `
    <div class="ios-section-head">Business</div>
    <p class="ios-section-desc">Review the metadata that will appear on your Google Play store listing. Additional business details (pricing, in-app purchases) are configured directly in the Google Play Console. Edit via <strong>Game Details</strong> if anything needs to change.</p>
    <div class="form-group" style="margin-bottom:14px;">
      <label class="form-label">Title</label>
      <div class="form-input is-complete" style="background:var(--bg-2);cursor:default;color:var(--text);">${escHtml(fd.title || '')}</div>
      ${!titleOk ? '<div class="ios-risk-note risk-HIGH">Title is required — add it in Game Details.</div>' : ''}
    </div>
    <div class="form-group" style="margin-bottom:14px;">
      <label class="form-label">Short description <span style="color:var(--text-faint);font-weight:400;">(first 80 chars of description)</span></label>
      <div class="form-input is-complete" style="background:var(--bg-2);cursor:default;color:var(--text);min-height:36px;">${escHtml((fd.description || '').slice(0, 80))}</div>
    </div>
    <div class="form-group" style="margin-bottom:14px;">
      <label class="form-label">Full description</label>
      <div class="form-input is-complete" style="background:var(--bg-2);cursor:default;color:var(--text);min-height:72px;white-space:pre-wrap;">${escHtml(fd.description || '')}</div>
      ${!descOk ? '<div class="ios-risk-note risk-HIGH">Description is required — add it in Game Details.</div>' : ''}
    </div>`;
}

/* Android Store Preview — simple placeholder */
function buildAndroidStorePreviewSection() {
  const fd   = state.formData;
  const ups  = state.uploads;
  const icon = ups.appIcon;
  const shots = ups.screenshots || [];
  const title = escHtml(fd.title || 'Your Game Title');
  const descRaw = fd.description || '';
  const descShort = escHtml(descRaw.slice(0, 120) + (descRaw.length > 120 ? '…' : ''));

  const iconHtml = icon
    ? `<img src="${icon.dataUrl}" style="width:60px;height:60px;border-radius:14px;object-fit:cover;">`
    : `<div style="width:60px;height:60px;border-radius:14px;background:var(--bg-2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--text-faint);font-size:10px;">Icon</div>`;

  const screenshotStrip = shots.length
    ? `<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-top:10px;">${shots.slice(0,5).map(s => `<img src="${_screenshotSrc(s)}" style="height:120px;border-radius:8px;flex-shrink:0;">`).join('')}</div>`
    : `<div style="height:80px;background:var(--bg-2);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--text-faint);font-size:12px;margin-top:10px;">No screenshots uploaded</div>`;

  // Mark as seen
  state.androidSubmitAnswers.storePreviewSeen = true;

  return `
    <div class="ios-section-head">Store Page Preview</div>
    <p class="ios-section-desc" style="margin-bottom:14px;">This is an approximation of how your game will appear on Google Play.</p>
    <div style="background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:14px;">
      <div style="display:flex;gap:12px;align-items:flex-start;">
        ${iconHtml}
        <div>
          <div style="font-size:15px;font-weight:600;color:var(--text);">${title}</div>
          <div style="font-size:12px;color:var(--text-faint);margin-top:2px;">Games</div>
          <div style="display:flex;gap:6px;margin-top:8px;">
            <button style="background:#01875f;color:#fff;border:none;border-radius:20px;padding:6px 20px;font-size:13px;font-weight:500;cursor:pointer;">Install</button>
          </div>
        </div>
      </div>
      ${screenshotStrip}
      <div style="font-size:12px;color:var(--text-faint);margin-top:12px;line-height:1.5;">${descShort}</div>
    </div>`;
}

/* ── Android Data Safety ─────────────────────────────── */
function buildAndroidDataSafetySection() {
  const a = state.androidSubmitAnswers;
  const collectsYes = a.collectsOrSharesData === 'yes';

  const hasAccountCreation = a.accountMethod && a.accountMethod !== 'none';

  const deleteAccountField = hasAccountCreation ? `
    <div class="form-group" style="margin-top:10px;">
      <label class="form-label">Account deletion URL</label>
      <input class="form-input" type="url" id="android-delete-acct-url"
             value="${escHtml(a.deleteAccountUrl)}"
             placeholder="https://yourgame.com/delete-account"
             oninput="answerAndroidTextField('deleteAccountUrl', this.value)">
      ${!a.deleteAccountUrl.trim() ? '<div class="ios-risk-note risk-HIGH">Required. Provide a URL where users can request account deletion.</div>' : ''}
    </div>` : '';

  const otherField = a.accountMethod === 'other' ? `
    <div class="form-group" style="margin-top:8px;">
      <label class="form-label">Describe your authentication method</label>
      <input class="form-input" type="text" value="${escHtml(a.accountMethodOther)}"
             placeholder="e.g. Biometric login, SSO"
             oninput="answerAndroidTextField('accountMethodOther', this.value)">
    </div>` : '';

  const delDataField = a.providesDataDeletion === 'yes' ? `
    <div class="form-group" style="margin-top:8px;">
      <label class="form-label">Data deletion URL</label>
      <input class="form-input" type="url" value="${escHtml(a.deleteDataUrl)}"
             placeholder="https://yourgame.com/delete-data"
             oninput="answerAndroidTextField('deleteDataUrl', this.value)">
    </div>` : '';

  const familiesWarning = a.targetsFamilies === 'yes' ? `
    <div class="ios-risk-note risk-HIGH" style="margin-top:8px;">
      <strong>Families Policy applies.</strong> Your app will be subject to strict Google Play Families Policy requirements: no behavioural advertising, no data collection beyond core functionality, content must meet ESRB Everyone or equivalent, and you may need to participate in the Teacher Approved program.
    </div>` : '';

  const aiStatus = state.androidDataAIStatus;
  const descVal  = (a.androidDataDescription || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const statusHtml = aiStatus === 'loading'
    ? `<div class="prv-nlp-status loading"><span class="ai-spinner"></span> Translating to data safety labels…</div>`
    : aiStatus === 'complete'
    ? `<div class="prv-nlp-status done">✓ Data types updated — expand below to review or adjust</div>`
    : aiStatus === 'error'
    ? `<div class="prv-nlp-status error">Translation failed. <button class="btn-inline" onclick="_triggerAndroidDataAI()">Try again</button></div>`
    : '';

  const detailsBlock = collectsYes ? `
    ${androidYNRow('Encrypted in transit', 'encryptedInTransit',
      'All user data transmitted between the app and your servers is encrypted (e.g. HTTPS/TLS).')}
    <div class="form-group" style="margin-top:2px;">
      <label class="form-label">Sign-in method
        <span class="tooltip-anchor"><span class="tooltip-icon">?</span><span class="tooltip-body">The authentication method your app uses when users create an account.</span></span>
      </label>
      <div class="${!a.accountMethod ? 'sw-select-incomplete' : ''}">
        ${swSelect('android-account-method', a.accountMethod,
          ANDROID_ACCOUNT_METHODS.map(m => ({value: m.id, label: m.label})),
          'setAndroidAccountMethod', '280px')}
      </div>
    </div>
    ${otherField}
    ${deleteAccountField}
    ${singleSelectRow(
      'Data deletion without account deletion',
      a.providesDataDeletion,
      [
        { value: 'yes',    label: 'Yes',           selectedClass: 'is-sel-none',
          onSelect: "answerAndroidField('providesDataDeletion','yes')" },
        { value: 'auto90', label: 'Auto (90 days)', selectedClass: 'is-sel-infrequent',
          onSelect: "answerAndroidField('providesDataDeletion','auto90')" },
        { value: 'no',     label: 'No',             selectedClass: 'is-sel-frequent',
          onSelect: "answerAndroidField('providesDataDeletion','no')" },
      ],
      'Do you provide a way for users to request deletion of their data without deleting their account? "Auto" means all data is automatically deleted within 90 days.'
    )}
    ${delDataField}
    ${androidYNRow('Primarily targets children under 13', 'targetsFamilies',
      'Select Yes ONLY if children under 13 are the primary intended audience of your app — not merely because children might also play it. This is a meaningful legal and policy distinction.')}
    <div class="sw-tip-box" style="margin-top:6px;margin-bottom:4px;">
      <div class="sw-tip-box-row">
        <img src="Assets/SubwooferIcon_Orange.png" class="sw-tip-logo" alt="">
        <span class="sw-tip-text"><strong class="sw-tip-bold">Shipmate Tip:</strong> ${t('tip.ios.kids_audience') || 'Many developers select this by mistake — choose Yes only if children under 13 are your primary intended audience.'}</span>
      </div>
    </div>
    ${familiesWarning}
    <div class="prv-nlp-wrap" style="margin-top:2px;">
      <label class="form-label">Describe your data collection and sharing
        <span class="tooltip-anchor"><span class="tooltip-icon">?</span><span class="tooltip-body">Describe every data type your app collects or shares and why. Shipmate will translate this into the required Google Play Data Safety selections.</span></span>
      </label>
      <textarea class="form-input prv-nlp-textarea"
                placeholder="e.g. We collect email addresses for account creation, device crash reports to fix bugs, and advertising IDs to serve relevant ads through our ad network."
                onblur="updateAndroidDataDescription(this.value)">${descVal}</textarea>
      ${statusHtml}
      ${buildAndroidDataMatrix(a)}
    </div>` : '';

  const privUrl = (a.privacyPolicyUrl || state.formData.privacyUrl || '').trim();

  return `
    <div class="form-group" style="margin-bottom:18px;">
      <label class="form-label">Privacy Policy URL
        <span class="tooltip-anchor">
          <span class="tooltip-icon">?</span>
          <span class="tooltip-body">Google Play requires a valid, publicly accessible privacy policy URL. Setting it here syncs across all platforms.</span>
        </span>
      </label>
      <input class="form-input" type="url" id="android-privacy-url"
             value="${escHtml(privUrl)}"
             placeholder="https://yourgame.com/privacy"
             oninput="setPrivacyUrl(this.value)"
             onblur="reRenderStepModal()">
      ${!privUrl ? '<div class="ios-risk-note risk-HIGH">Required. A missing privacy policy URL will block your submission.</div>' : ''}
    </div>
    ${_buildPrivacyPresetChips()}
    ${a.collectsOrSharesData === null ? androidYNRow('Collects or shares user data', 'collectsOrSharesData',
      'Includes location, personal info, financial info, health data, messages, files, contacts, app activity, identifiers, and similar required disclosures.') : ''}
    ${detailsBlock}`;
}

function buildAndroidDataMatrix(a) {
  const USAGE_COLS = [
    { id: 'collected', label: 'Collected',  tip: 'Data is collected by your app from the user' },
    { id: 'shared',    label: 'Shared',     tip: 'Data is shared with third parties' },
    { id: 'ephemeral', label: 'Ephemeral',  tip: 'Data is only processed temporarily — never stored' },
    { id: 'required',  label: 'Required',   tip: 'Collection is required; users cannot opt out' },
  ];

  const expanded        = state.androidMatrixExpanded;
  const selectedTypeIds = new Set(Object.keys(a.dataPerType));
  const selectedCount   = selectedTypeIds.size;

  const usageHeaders   = USAGE_COLS.map(c =>
    `<th class="prv-col-hd"><span class="tooltip-anchor" data-tip="${c.tip}">${c.label} <span class="tooltip-icon">?</span><span class="tooltip-body">${c.tip}</span></span></th>`
  ).join('');
  const purposeHeaders = ANDROID_PURPOSES.map(c =>
    `<th class="prv-col-hd"><span class="tooltip-anchor" data-tip="${c.desc}">${c.label} <span class="tooltip-icon">?</span><span class="tooltip-body">${c.desc}</span></span></th>`
  ).join('');

  let bodyHtml = '';
  if (expanded) {
    ANDROID_DATA_TYPES.forEach(group => {
      bodyHtml += `<tr class="prv-group-row"><td colspan="${1 + USAGE_COLS.length + ANDROID_PURPOSES.length}">${group.group}</td></tr>`;
      group.types.forEach(t => {
        const isOn = selectedTypeIds.has(t.id);
        const td   = a.dataPerType[t.id] || {};

        const usageCells = USAGE_COLS.map(col => {
          const epOrReq   = col.id === 'ephemeral' || col.id === 'required';
          const isDisabled = !isOn || (epOrReq && !td.collected);
          const checked = isOn && (
            col.id === 'collected' ? !!td.collected :
            col.id === 'shared'    ? !!td.shared    :
            col.id === 'ephemeral' ? !!td.ephemeral :
            !!td.required
          );
          return `<td class="prv-check-cell${isDisabled ? ' prv-disabled' : ''}">
            <input type="checkbox" class="prv-cb" ${isDisabled ? 'disabled' : ''}
                   ${checked ? 'checked' : ''}
                   onclick="event.stopPropagation()"
                   onchange="setAndroidTypeFlag('${t.id}','${col.id}',this.checked)">
          </td>`;
        }).join('');

        const purposeCells = ANDROID_PURPOSES.map(p => {
          const checked = isOn && (td.purposes || []).includes(p.id);
          return `<td class="prv-check-cell">
            <input type="checkbox" class="prv-cb" ${isOn ? '' : 'disabled'}
                   ${checked ? 'checked' : ''}
                   onclick="event.stopPropagation()"
                   onchange="toggleAndroidPurpose('${t.id}','${p.id}',this.checked)">
          </td>`;
        }).join('');

        bodyHtml += `
          <tr class="prv-data-row ${isOn ? 'is-on' : ''}" onclick="toggleAndroidDataType('${t.id}')">
            <td class="prv-type-cell">
              <span class="prv-type-name tooltip-anchor" data-tip="${t.desc}">${t.label}</span>
            </td>
            ${usageCells}
            ${purposeCells}
          </tr>`;
      });
    });
  }

  const tableHtml = expanded ? `
    <div class="prv-matrix-wrap">
      <table class="prv-matrix">
        <thead>
          <tr>
            <th class="prv-type-hd">Data Type</th>
            ${usageHeaders}
            ${purposeHeaders}
          </tr>
        </thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    </div>` : '';

  return `
    <div class="ios-subsection" style="margin-top:10px;">
      <div class="prv-matrix-header">
        ${selectedCount > 0 ? `<span class="prv-count-badge">${selectedCount} type${selectedCount !== 1 ? 's' : ''} selected</span>` : ''}
        <button class="prv-expand-btn" onclick="toggleAndroidMatrix()">
          ${expanded ? `${_chevUp} Hide data types` : `${_chevDown} Show all data types`}
        </button>
      </div>
      ${tableHtml}
    </div>`;
}

/* ═══════════════════════════════════════════════════
   STEAM STEP SECTIONS
   ═══════════════════════════════════════════════════ */

function buildSteamActiveCard(pid) {
  const p      = PLATFORMS[pid];
  const counts = platformStepCount(pid);
  const locked = !counts.allRequired;
  const submitDone = state.platformStepStatus?.[pid]?.['submit'] === 'complete';
  const checkSVG = `<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const stepCards = p.steps.map((step, i) => {
    const done = isSteamSectionComplete(step.id);
    const risk = computeSteamSectionRisk(step.id);
    const numClass = 'ios-step-num' + (done ? ' is-done' : '');
    const riskDot  = (done || risk === 'LOW' || risk === 'NONE') ? '' : `<span class="ios-step-risk ios-step-risk-${risk.toLowerCase()}"></span>`;
    return `
      <div class="ios-step-card ${done ? 'is-complete' : ''}" id="steam-step-card-${step.id}"
           onclick="openStepModal('${pid}','${step.id}')">
        <div class="${numClass}">${done ? checkSVG : i + 1}</div>
        <div class="ios-step-info">
          <div class="ios-step-name">${stepLabel(pid, step)}</div>
        </div>
        ${riskDot}
        <span class="ios-step-arrow">›</span>
      </div>`;
  }).join('');

  const submitStepCard = buildSubmitStepCard(pid, p.steps.length, locked, submitDone);

  return `
    <div class="active-card" id="active-card-${pid}">
      <div class="active-card-head" onclick="deactivatePlatform('${pid}')" title="Click to deactivate" style="cursor:pointer;">
        <div class="active-card-platform">
          <div class="active-card-icon">${platformIcon(pid, 28, 'white')}</div>
          <div class="active-card-name-row">
            <div class="active-card-name">${platLabel(pid)}</div>
            ${buildBuildDropdown(pid)}
          </div>
        </div>
      </div>
      ${buildReleasePills(pid)}
      <div class="ios-step-cards">${stepCards}${submitStepCard}</div>
    </div>`;
}

/* ── (AI badge helpers moved to shared section above buildContentRatingSection) ── */

/* ── Steam: Content Rating (PDF 7) ──────────────────── */
function buildSteamContentRatingSection() {
  const a   = state.steamSubmitAnswers;
  const sca = a.steamContentAnswers || {};

  // Helper: ynRow for a Steam content item with AI badge support
  function steamItemRow(itemId, label, tooltip) {
    const val  = sca[itemId] || null;
    const yc   = _platformAIClass('steam', itemId, 'yes').trim();
    const nc   = _platformAIClass('steam', itemId, 'no').trim();
    const yb   = 'YES' + _platformAIBadge('steam', itemId, 'yes');
    const nb   = 'NO'  + _platformAIBadge('steam', itemId, 'no');
    // Ensure label fits one line (truncate at 50 chars, rest goes to tooltip)
    const shortLabel = label.length > 50 ? label.slice(0, 50).replace(/[;,]?\s*$/, '') + '…' : label;
    const fullTip    = tooltip && tooltip !== label ? tooltip : (label.length > 50 ? label : '');
    return ynRow(shortLabel, val,
      `answerSteamContentItem('${itemId}','yes')`,
      `answerSteamContentItem('${itemId}','no')`,
      fullTip, false, yc.trim(), nc.trim(), yb, nb);
  }

  // Unanswered/All toggle (shown after AI inference has run)
  const steamShowAll     = state.steamContentRatingExpanded;
  const steamAnsweredSet = state.steamAnsweredAtInference; // snapshot — not updated live
  const steamCollapse    = steamAnsweredSet !== null;
  const steamTogglePill  = buildCRTogglePill(steamCollapse, steamShowAll,
    'toggleSteamContentRatingExpanded(false)', 'toggleSteamContentRatingExpanded(true)');

  // Content categories — each item is a ynRow
  // Filter uses snapshot so questions don't vanish while actively answering
  let catHtml = steamTogglePill;
  STEAM_CONTENT_CATEGORIES.forEach(grp => {
    const items = (steamCollapse && !steamShowAll)
      ? grp.items.filter(item => !steamAnsweredSet?.has(item.id))
      : grp.items;
    if (!items.length) return;
    catHtml += `<div class="ios-content-step-label">${escHtml(grp.group)}</div>`;
    items.forEach(item => {
      catHtml += steamItemRow(item.id, item.label, item.label);
    });
  });

  // Mature declarations — each option is a ynRow with cascade
  const MATURE_OPTS = [
    { id: 'gen_mature',    label: 'General mature content',               tip: 'Content that deals with mature topics and may not be appropriate for all audiences' },
    { id: 'freq_violence', label: 'Frequent violence or gore',            tip: 'Contains extremely violent or gory content that may not be appropriate for all audiences' },
    { id: 'some_nudity',   label: 'Some nudity or sexual content',        tip: 'Contains occasional nudity or sexual content — auto-selects General mature content' },
    { id: 'freq_nudity',   label: 'Frequent nudity or sexual content',    tip: 'Primarily about explicit or frequent nudity/sexual content — auto-selects preceding categories' },
    { id: 'adult_sexual',  label: 'Adult only sexual content',            tip: 'Explicit or graphic sexual content for adults only — auto-selects all preceding categories' },
  ];

  // Apply the same Unanswered/All filter to Mature Content rows
  const filteredMatureOpts = (steamCollapse && !steamShowAll)
    ? MATURE_OPTS.filter(opt => !steamAnsweredSet?.has(opt.id))
    : MATURE_OPTS;
  let matureHtml = filteredMatureOpts.map(opt => steamItemRow(opt.id, opt.label, opt.tip)).join('');

  // Track which mature parent rows are actually visible (not filtered out)
  const freqViolenceVisible = !steamCollapse || steamShowAll || !steamAnsweredSet?.has('freq_violence');
  const freqNudityVisible   = !steamCollapse || steamShowAll || !steamAnsweredSet?.has('freq_nudity');
  const genMatureVisible    = !steamCollapse || steamShowAll || !steamAnsweredSet?.has('gen_mature');

  // Violent tag sub-rows (if freq_violence = yes AND parent row is visible)
  const violentSub = (sca['freq_violence'] === 'yes' && freqViolenceVisible) ? `
    <div class="ios-followup">
      <div style="font-size:12px;color:var(--text-faint);margin-bottom:4px;">Specify for store tags:</div>
      ${steamItemRow('violent_tag', 'Violent', 'Adds the "Violent" store tag to your game')}
      ${steamItemRow('gore_tag',    'Gore',    'Adds the "Gore" store tag to your game')}
    </div>` : '';

  // Nudity tag sub-rows (if freq_nudity = yes AND parent row is visible)
  const nuditySub = (sca['freq_nudity'] === 'yes' && freqNudityVisible) ? `
    <div class="ios-followup">
      <div style="font-size:12px;color:var(--text-faint);margin-bottom:4px;">Specify for store tags:</div>
      ${steamItemRow('nudity_tag',         'Nudity',         'Adds the "Nudity" store tag to your game')}
      ${steamItemRow('sexual_content_tag', 'Sexual Content', 'Adds the "Sexual Content" store tag to your game')}
    </div>` : '';

  // Mature text fields (if gen_mature = yes AND parent row is visible)
  const matureFieldBlock = (sca['gen_mature'] === 'yes' && genMatureVisible) ? `
    <div class="ios-followup">
      <div class="form-group" style="margin-bottom:10px;">
        <label class="form-label">What should customers know about the mature content?
          <span class="tooltip-anchor"><span class="tooltip-icon">?</span><span class="tooltip-body">Visible on your store page. Describe depictions of violence, sexual acts, or other topics players should know about.</span></span>
        </label>
        <textarea class="form-input" rows="3"
                  placeholder="Describe the mature content players will encounter…"
                  oninput="answerSteamTextField('matureDescription', this.value)">${escHtml(a.matureDescription)}</textarea>
        ${!a.matureDescription.trim() ? '<div class="ios-risk-note risk-HIGH">Required when General mature content is selected.</div>' : ''}
      </div>
      <div class="form-group">
        <label class="form-label">How do we access the mature content? <span style="color:var(--text-faint);font-weight:400;">(Review team only)</span>
          <span class="tooltip-anchor"><span class="tooltip-icon">?</span><span class="tooltip-body">Not visible to customers. Is the content on a specific map? Does the player need to reach a certain level?</span></span>
        </label>
        <textarea class="form-input" rows="2"
                  placeholder="e.g. Content is accessible after reaching level 10…"
                  oninput="answerSteamTextField('matureAccess', this.value)">${escHtml(a.matureAccess)}</textarea>
        ${!a.matureAccess.trim() ? '<div class="ios-risk-note risk-HIGH">Required when General mature content is selected.</div>' : ''}
      </div>
    </div>` : '';

  // Generative AI
  const AI_LIVE_TYPES = STEAM_AI_LIVE_TYPES;
  const aiLiveBlock = a.usesAI === 'yes' ? `
    <div style="margin-top:10px;">
      <div class="form-group" style="margin-bottom:10px;">
        <label class="form-label">Describe to players how this game uses generative AI
          <span class="tooltip-anchor"><span class="tooltip-icon">?</span><span class="tooltip-body">Shown under "About This Game" on your store page.</span></span>
        </label>
        <textarea class="form-input" rows="2"
                  placeholder="Describe how AI is used in your game…"
                  oninput="answerSteamTextField('aiDescription', this.value)">${escHtml(a.aiDescription)}</textarea>
      </div>
      ${ynRow('Generates content or code during gameplay', a.aiLiveGenerated,
        "answerSteamField('aiLiveGenerated','yes')",
        "answerSteamField('aiLiveGenerated','no')",
        'Does this game use AI to generate content or code during active gameplay?')}
      ${a.aiLiveGenerated === 'yes' ? `
        <div class="ios-followup">
          <div class="ios-content-step-label" style="margin-top:6px;">Types of live-generated content</div>
          ${AI_LIVE_TYPES.map(t => {
            const id = t.toLowerCase().replace(/[^a-z0-9]/g,'_');
            const val = (a.aiLiveTypes || []).includes(id) ? 'yes' : null;
            return ynRow(t, val,
              `toggleSteamAIType('${id}', true)`,
              `toggleSteamAIType('${id}', false)`);
          }).join('')}
          ${(a.aiLiveTypes||[]).includes('code') ? `<div class="form-group" style="margin-top:8px;"><label class="form-label">Describe code generation and safeguards</label>
            <textarea class="form-input" rows="2" oninput="answerSteamTextField('aiCodeDesc', this.value)">${escHtml(a.aiCodeDesc)}</textarea></div>` : ''}
          <div class="form-group" style="margin-top:8px;"><label class="form-label">Copyright protection measures</label>
            <textarea class="form-input" rows="2"
                      placeholder="What steps ensure users can't generate copyrighted material?"
                      oninput="answerSteamTextField('aiCopyrightDesc', this.value)">${escHtml(a.aiCopyrightDesc)}</textarea></div>
          <div class="form-group" style="margin-top:8px;"><label class="form-label">Content moderation strategy</label>
            <textarea class="form-input" rows="2"
                      placeholder="How do you ensure generated content adheres to Steam's guidelines?"
                      oninput="answerSteamTextField('aiModerationDesc', this.value)">${escHtml(a.aiModerationDesc)}</textarea></div>
          ${sca['adult_sexual'] === 'yes' ? '<div class="ios-risk-note risk-HIGH" style="margin-top:8px;"><strong>Warning:</strong> Steam cannot support Adult Only Sexual Content created with live-generated AI.</div>' : ''}
        </div>` : ''}
      ${ynRow('Connects to external third-party AI service during gameplay', a.aiThirdParty,
        "answerSteamField('aiThirdParty','yes')",
        "answerSteamField('aiThirdParty','no')")}
      ${a.aiThirdParty === 'yes' ? `
        <div class="ios-followup">
          <div class="form-group" style="margin-bottom:8px;"><label class="form-label">Service name <span style="color:var(--text-faint);">(shown on store page)</span></label>
            <input class="form-input" type="text" value="${escHtml(a.aiThirdPartyName)}"
                   placeholder="e.g. OpenAI" oninput="answerSteamTextField('aiThirdPartyName', this.value)"></div>
          <div class="form-group" style="margin-bottom:8px;"><label class="form-label">Service URL <span style="color:var(--text-faint);">(shown on store page)</span></label>
            <input class="form-input" type="url" value="${escHtml(a.aiThirdPartyUrl)}"
                   placeholder="https://" oninput="answerSteamTextField('aiThirdPartyUrl', this.value)"></div>
          <div class="form-group" style="margin-bottom:8px;"><label class="form-label">How is generative content made available to players?</label>
            <textarea class="form-input" rows="2" oninput="answerSteamTextField('aiAvailabilityDesc', this.value)">${escHtml(a.aiAvailabilityDesc)}</textarea></div>
          <div class="form-group"><label class="form-label">Monetization strategy for live AI services</label>
            <textarea class="form-input" rows="2" oninput="answerSteamTextField('aiMonetizationDesc', this.value)">${escHtml(a.aiMonetizationDesc)}</textarea></div>
        </div>` : ''}
    </div>` : '';

  return `
    ${catHtml}
    <div class="ios-q-divider"></div>
    <div class="ios-content-step-label">Mature Content</div>
    ${matureHtml}
    ${violentSub}
    ${nuditySub}
    ${matureFieldBlock}
    <div class="ios-q-divider"></div>
    <div class="ios-content-step-label">Generative AI</div>
    ${ynRow('Uses generative AI', a.usesAI,
      "answerSteamField('usesAI','yes')",
      "answerSteamField('usesAI','no')",
      'Does this game use generative AI to create content — including the game, store page, or marketing materials?')}
    ${aiLiveBlock}`;
}

/* ── Steam: Store Tags (PDF 9) ──────────────────────── */
function buildSteamStoreTagsSection() {
  const a = state.steamSubmitAnswers;

  const topGenreChecks = STEAM_TOP_GENRES.map(g => {
    const checked = a.topGenres.includes(g);
    return `<label class="cq-check-row${checked ? ' is-checked' : ''}">
      <input type="checkbox" ${checked ? 'checked' : ''}
             onchange="toggleSteamTag('topGenres','${g}',this.checked,2)">
      <span>${escHtml(g)}</span></label>`;
  }).join('');

  const genreChecks = STEAM_GENRES.map(g => {
    const checked = a.genres.includes(g);
    return `<label class="cq-check-row${checked ? ' is-checked' : ''}">
      <input type="checkbox" ${checked ? 'checked' : ''}
             onchange="toggleSteamTag('genres','${g}',this.checked,2)">
      <span>${escHtml(g)}</span></label>`;
  }).join('');

  const subGenreChecks = STEAM_SUB_GENRES.map(g => {
    const checked = a.subGenres.includes(g);
    return `<label class="cq-check-row${checked ? ' is-checked' : ''}">
      <input type="checkbox" ${checked ? 'checked' : ''}
             onchange="toggleSteamTag('subGenres','${g}',this.checked,3)">
      <span>${escHtml(g)}</span></label>`;
  }).join('');

  const topCount   = a.topGenres.length;
  const genreCount = a.genres.length;
  const subCount   = a.subGenres.length;

  return `
    <div class="ios-content-step-label" style="margin-top:0;">Top-Level Genre
      <span class="tooltip-anchor"><span class="tooltip-icon">?</span><span class="tooltip-body">Required. Choose one or two top-level genres to categorize your title on Steam.</span></span>
    </div>
    ${topCount === 0 ? '<div class="ios-risk-note risk-HIGH" style="margin-bottom:8px;">Required — select at least one.</div>' : ''}
    <div class="cq-check-list">${topGenreChecks}</div>

    <div class="ios-q-divider"></div>
    <div class="ios-content-step-label">Genre <span style="font-weight:400;text-transform:none;font-size:11px;letter-spacing:0;">(Optional — up to 2${genreCount > 0 ? ', ' + genreCount + ' selected' : ''})</span></div>
    <div class="cq-check-list" style="max-height:200px;overflow-y:auto;">${genreChecks}</div>

    <div class="ios-q-divider"></div>
    <div class="ios-content-step-label">Sub-genre <span style="font-weight:400;text-transform:none;font-size:11px;letter-spacing:0;">(Optional — up to 3${subCount > 0 ? ', ' + subCount + ' selected' : ''})</span></div>
    <div class="cq-check-list" style="max-height:200px;overflow-y:auto;">${subGenreChecks}</div>`;
}

/* ── Steam: Technical (PDFs 10 + 11) ───────────────── */
function buildSteamTechnicalSection() {
  const a = state.steamSubmitAnswers;

  const INPUT_OPTS = [
    { id: 'keyboard_only',     label: 'Mouse and keyboard only' },
    { id: 'keyboard_plus',     label: 'Mouse and keyboard, plus gamepads' },
    { id: 'gamepad_preferred', label: 'Mouse and keyboard, but gamepad is preferred' },
    { id: 'gamepad_required',  label: 'Gamepad required; no support for mouse and keyboard' },
  ];

  const inputHtml = singleSelectRow(
    'Input devices',
    a.inputSupport,
    INPUT_OPTS.map(o => ({
      value: o.id, label: o.label,
      selectedClass: 'is-sel-none',
      onSelect: `answerSteamField('inputSupport','${o.id}')`,
    })),
    'What kind of devices can be used to comfortably play your game?'
  );

  const gamepadBlock = a.inputSupport && a.inputSupport !== 'keyboard_only' ? `
    <div class="cond-block">
      <div class="ios-content-step-label" style="margin-top:0;">Controller Support</div>
      ${ynRow('Full Xbox Controller support', a.xboxFullSupport,
        "answerSteamField('xboxFullSupport','yes')",
        "answerSteamField('xboxFullSupport','no')",
        'Player can launch, configure, play, and exit using only an Xbox controller. Game displays correct glyphs and any text prompts open an on-screen keyboard.')}

      <div style="margin-top:12px;">
        <div class="form-label" style="margin-bottom:6px;">PlayStation Controller support <span style="color:var(--text-faint);font-weight:400;">(select all that apply)</span></div>
        <div class="ms-chip-group">${[
          {id:'ps_dualshock_usb',   label:'DualShock (USB)'},
          {id:'ps_dualshock_bt',    label:'DualShock (USB + BT)'},
          {id:'ps_dualsense_usb',   label:'DualSense (USB)'},
          {id:'ps_dualsense_bt',    label:'DualSense (USB + BT)'},
          {id:'ps_none',            label:'No PS support'},
        ].map(c => {
          const on = a.psControllers.includes(c.id);
          return `<button class="ms-chip${on ? ' is-on' : ''}"
                          onclick="toggleSteamPS('${c.id}', ${!on})">${escHtml(c.label)}</button>`;
        }).join('')}</div>
      </div>

      <div style="margin-top:12px;">
        ${ynRow('Full Steam Input API integration', a.steamInputAPI,
          "answerSteamField('steamInputAPI','yes')",
          "answerSteamField('steamInputAPI','no')",
          'Game fully integrates the Steam Input API, implements action bindings, queries action origins for correct glyph display, and allows button remapping through the Steam configurator.')}
      </div>
    </div>
  ` : '';

  const accessChecks = STEAM_ACCESSIBILITY_FEATURES.map(f => {
    const checked = a.accessibilityFeatures.includes(f.id);
    return `<label class="cq-check-row${checked ? ' is-checked' : ''}" title="${escHtml(f.desc)}">
      <input type="checkbox" ${checked ? 'checked' : ''}
             onchange="toggleSteamAccessibility('${f.id}', this.checked)">
      <span>${escHtml(f.label)}</span></label>`;
  }).join('');

  return `
    <div class="ios-content-step-label" style="margin-top:0;">Input Support</div>
    ${inputHtml}
    ${gamepadBlock}
    <div class="ios-q-divider"></div>
    <div class="ios-content-step-label">Accessibility Features <span style="font-weight:400;text-transform:none;font-size:11px;letter-spacing:0;">(Optional — select all that apply)</span></div>
    <div class="cq-check-list">${accessChecks}</div>`;
}

/* ── Steam: Store Page Preview ──────────────────────── */
function buildSteamStorePreviewSection() {
  const fd   = state.formData;
  const ups  = state.uploads;
  const icon = ups.appIcon;
  const shots = ups.screenshots || [];
  const title = escHtml(fd.title || 'Your Game Title');
  const descRaw = fd.description || '';
  const descShort = escHtml(descRaw.slice(0, 160) + (descRaw.length > 160 ? '…' : ''));
  const topGenres = state.steamSubmitAnswers.topGenres.slice(0, 2).join(', ') || 'Game';

  const iconHtml = icon
    ? `<img src="${icon.dataUrl}" style="width:108px;height:50px;border-radius:4px;object-fit:cover;">`
    : `<div style="width:108px;height:50px;border-radius:4px;background:var(--bg-2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--text-faint);font-size:9px;">Capsule</div>`;

  const screenshotStrip = shots.length
    ? `<div style="display:flex;gap:4px;overflow-x:auto;margin-top:10px;">${shots.slice(0,5).map(s => `<img src="${s.url || s.dataUrl}" style="height:90px;border-radius:4px;flex-shrink:0;">`).join('')}</div>`
    : `<div style="height:60px;background:var(--bg-2);border-radius:4px;display:flex;align-items:center;justify-content:center;color:var(--text-faint);font-size:12px;margin-top:10px;">No screenshots uploaded</div>`;

  state.steamSubmitAnswers.storePreviewSeen = true;

  const privUrl = (state.steamSubmitAnswers.privacyPolicyUrl || state.formData.privacyUrl || '').trim();

  return `
    <div class="form-group" style="margin-bottom:18px;">
      <label class="form-label">Privacy Policy URL
        <span class="tooltip-anchor">
          <span class="tooltip-icon">?</span>
          <span class="tooltip-body">Steam requires a privacy policy URL in your store page settings. Setting it here syncs across all platforms.</span>
        </span>
      </label>
      <input class="form-input" type="url" id="steam-privacy-url"
             value="${escHtml(privUrl)}"
             placeholder="https://yourgame.com/privacy"
             oninput="setPrivacyUrl(this.value)"
             onblur="reRenderStepModal()">
      ${!privUrl ? '<div class="ios-risk-note risk-HIGH">Required. Add your privacy policy URL before submitting to Steam.</div>' : ''}
    </div>
    <p style="font-size:12px;color:var(--text-faint);margin:0 0 14px;">Approximate Steam store listing appearance.</p>
    <div style="background:#1b2838;border-radius:6px;padding:14px;font-family:inherit;">
      <div style="display:flex;gap:12px;align-items:flex-start;">
        ${iconHtml}
        <div>
          <div style="font-size:15px;font-weight:600;color:#c6d4df;">${title}</div>
          <div style="font-size:11px;color:#8f98a0;margin-top:3px;">${escHtml(topGenres)}</div>
          <div style="margin-top:8px;display:flex;gap:6px;">
            <button style="background:#4c7b8a;color:#c6d4df;border:none;border-radius:2px;padding:5px 16px;font-size:12px;cursor:pointer;">Add to Cart</button>
            <button style="background:#5c7e10;color:#fff;border:none;border-radius:2px;padding:5px 16px;font-size:12px;cursor:pointer;">Play Game</button>
          </div>
        </div>
      </div>
      ${screenshotStrip}
      <div style="font-size:12px;color:#8f98a0;margin-top:10px;line-height:1.5;">${descShort}</div>
    </div>`;
}


/* ══════════════════════════════════════════════════════
   BUILD DROPDOWN  (platform card header)
   ══════════════════════════════════════════════════════ */
function buildBuildDropdown(pid) {
  const build  = state.platformBuilds?.[pid] || null;
  const accept = pid === 'ios'     ? '.ipa'
               : pid === 'android' ? '.apk,.aab'
               :                     '.exe,.zip';
  const noBuild = !build;
  const uploadSVG = `<svg width="11" height="11" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;opacity:0.6"><path d="M8 11V2M4 5l4-4 4 4M2 13v1a1 1 0 001 1h10a1 1 0 001-1v-1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const checkSVG = `<svg width="11" height="11" viewBox="0 0 12 12" fill="none" style="flex-shrink:0;color:var(--accent-green,#2FDC80)"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return `
    <div class="build-pill ${noBuild ? 'no-build' : 'has-build'}"
         onclick="event.stopPropagation();document.getElementById('build-file-${pid}').click()" title="${noBuild ? 'Upload build' : 'Change build'}">
      <input type="file" id="build-file-${pid}" accept="${accept}" hidden
             onchange="handleBuildUpload('${pid}', this.files)">
      ${noBuild ? uploadSVG : checkSVG}
      <span class="build-pill-label">${noBuild ? 'Upload Build' : escHtml(build.name)}</span>
    </div>`;
}

/* ══════════════════════════════════════════════════════
   SCREENSHOTS STEP  (per-platform, inside step modal)
   ══════════════════════════════════════════════════════ */
function buildScreenshotsSection(pid) {
  const onboardingShots = state.uploads?.screenshots || [];
  const ps = state.platformScreenshots?.[pid] || { selected: [], custom: [] };
  const selectedSet = new Set(ps.selected);

  const checkMark = `<div class="shot-check">✓</div>`;

  // Onboarding screenshots row
  let onboardingHtml;
  if (onboardingShots.length > 0) {
    onboardingHtml = onboardingShots.map(s => {
      const src = _screenshotSrc(s);
      const sel = selectedSet.has(s.id);
      return `
        <div class="shot-thumb${sel ? ' is-selected' : ''}"
             onclick="togglePlatformScreenshot('${pid}','${s.id}')" title="${escHtml(s.name)}">
          <img src="${src}" alt="${escHtml(s.name)}">
          ${sel ? checkMark : ''}
        </div>`;
    }).join('');
  } else {
    onboardingHtml = `<p class="shot-empty-msg">No screenshots in your uploads yet — add them under Assets during onboarding.</p>`;
  }

  // Platform-specific custom uploads
  let customHtml = '';
  if (ps.custom && ps.custom.length > 0) {
    customHtml = `
      <div class="shot-group-label">Platform-specific uploads</div>
      <div class="shot-grid">
        ${ps.custom.map(s => `
          <div class="shot-thumb is-selected is-custom" title="${escHtml(s.name)}">
            <img src="${s.dataUrl}" alt="${escHtml(s.name)}">
            ${checkMark}
            <button class="shot-remove" onclick="removePlatformScreenshot('${pid}','${s.id}')" title="Remove">×</button>
          </div>`).join('')}
      </div>`;
  }

  const total = ps.selected.length + (ps.custom?.length || 0);

  return `
    <div class="screenshots-step">
      <p class="shot-intro">
        Select screenshots to include with your ${platLabel(pid)} submission.
        ${total > 0 ? `<strong>${total} selected.</strong>` : ''}
      </p>

      <div class="shot-group-label">From your uploads</div>
      <div class="shot-grid" id="shot-grid-${pid}">${onboardingHtml}</div>

      ${customHtml}

      <div class="shot-actions">
        <label class="btn btn-ghost btn-sm shot-upload-btn" style="cursor:pointer;">
          <input type="file" accept="image/*" multiple hidden
                 onchange="handlePlatformScreenshotFiles('${pid}', this.files)">
          + Upload New
        </label>
        <a href="screenshot-tool.html" target="_blank" class="btn btn-ghost btn-sm">
          Crop &amp; Adjust ↗
        </a>
      </div>
    </div>`;
}
