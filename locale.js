/* ============================================================
   LOCALE — i18n infrastructure
   Loaded FIRST (before state.js / render.js / app.js).

   Usage:
     await loadLocale('ja');          // load Japanese
     t('dash.empty.title')            // look up a key
     t('track.submit.title', { platform: 'Steam' })   // with interpolation
     tStep('ios', 'contentRating', 'Content Rating')   // step label with fallback
     tPlat('android')                 // platform label with PLATFORMS fallback

   Spreadsheet workflow:
     The MetadataIngestion sheets own questionnaire content.
     Add title_[lang] / tooltip_[lang] columns there.
     Run locales/generate.py to produce/update locale JSON from the spreadsheet.
     This file handles UI chrome only — buttons, modals, topbar, dashboard copy.
   ============================================================ */

const SUPPORTED_LANGUAGES = [
  { code: 'en',    label: 'English',          flag: '🇺🇸' },
  { code: 'ja',    label: '日本語',             flag: '🇯🇵' },
  { code: 'zh-CN', label: '中文 (简体)',        flag: '🇨🇳' },
  { code: 'de',    label: 'Deutsch',           flag: '🇩🇪' },
  { code: 'fr',    label: 'Français',          flag: '🇫🇷' },
  { code: 'es',    label: 'Español',           flag: '🇪🇸' },
  { code: 'ko',    label: '한국어',             flag: '🇰🇷' },
  { code: 'pt-BR', label: 'Português (BR)',    flag: '🇧🇷' },
  { code: 'ru',    label: 'Русский',           flag: '🇷🇺' },
  { code: 'pl',    label: 'Polski',            flag: '🇵🇱' },
];

// Languages with actual locale files deployed.
// Update this list whenever a new locale JSON is added or removed.
const AVAILABLE_LANGUAGES = ['en', 'zh-CN'];

let _locale   = {};   // active language strings
let _fallback = {};   // English strings (always loaded as base)
let _activeLang = 'en';

/* ── Load ─────────────────────────────────────────────── */

async function loadLocale(lang) {
  // Resolve lang: stored preference → browser default → 'en'
  if (!lang) {
    const stored  = localStorage.getItem('sw_lang');
    const browser = navigator.language || 'en';
    // Normalise browser tag before testing (zh-CN stays zh-CN, es-MX → es, etc.)
    const browserNorm = browser === 'zh-CN' || browser === 'zh-TW' ? browser
                      : browser.split('-')[0];
    lang = stored || browserNorm;
  }
  // Normalise: zh → zh-CN
  if (lang === 'zh') lang = 'zh-CN';
  // Restrict to supported codes
  const supported = SUPPORTED_LANGUAGES.map(l => l.code);
  if (!supported.includes(lang)) lang = 'en';
  // Restrict further to locales that are actually deployed
  if (!AVAILABLE_LANGUAGES.includes(lang)) lang = 'en';

  // Always load English as fallback layer first
  if (!Object.keys(_fallback).length) {
    try {
      const r = await fetch('locales/en.json');
      if (r.ok) _fallback = await r.json();
    } catch (e) {
      console.warn('[i18n] Could not load en.json fallback:', e.message);
    }
  }

  if (lang === 'en') {
    _locale = _fallback;
    _activeLang = 'en';
    _applyLang('en');
    return;
  }

  try {
    const r = await fetch(`locales/${lang}.json`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    _locale = await r.json();
    _activeLang = lang;
    _applyLang(lang);
    localStorage.setItem('sw_lang', lang);
  } catch (e) {
    console.warn(`[i18n] Could not load locale "${lang}":`, e.message, '— falling back to English');
    _locale = _fallback;
    _activeLang = 'en';
    _applyLang('en');
    localStorage.removeItem('sw_lang'); // clear stale preference so next load uses default
  }
}

function _applyLang(lang) {
  document.documentElement.lang = lang;
  // RTL support placeholder — none of the 10 launch languages are RTL
}

/* ── Lookup ───────────────────────────────────────────── */

/**
 * Look up a UI-chrome key, with optional {var} interpolation.
 * Falls back to English, then to the key string itself.
 *
 * @param {string} key   Dotted key e.g. 'dash.empty.title'
 * @param {object} vars  Optional substitution map e.g. { platform: 'Steam' }
 */
function t(key, vars) {
  let str = _locale[key] ?? _fallback[key];
  if (str === undefined || str === null) return key;   // key string as last resort
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return str;
}

/**
 * Step label: try platform-specific key first, then generic, then fallback.
 * e.g. tStep('psn', 'submit', 'Submit') → 'Submit to PlayStation'
 */
function tStep(pid, stepId, fallback) {
  const platKey    = `step.${pid}.${stepId}`;
  const genericKey = `step.${stepId}`;
  const v = _locale[platKey] ?? _fallback[platKey] ??
            _locale[genericKey] ?? _fallback[genericKey];
  return (v !== undefined && v !== null) ? v : (fallback || stepId);
}

/**
 * Platform label: try locale key, fallback to PLATFORMS const (loaded after us).
 * Safe to call before PLATFORMS is defined — returns pid as last resort.
 */
function tPlat(pid) {
  const key = `plat.${pid}`;
  const v = _locale[key] ?? _fallback[key];
  if (v !== undefined && v !== null) return v;
  return (typeof PLATFORMS !== 'undefined' && PLATFORMS[pid]?.label) || pid;
}

/**
 * Track label: look up 'track.{pid}.{trackId}', fallback to
 * platformTrackLabel() if defined, then to trackId string.
 */
function tTrack(pid, trackId) {
  const key = `track.${pid}.${trackId}`;
  const v = _locale[key] ?? _fallback[key];
  if (v !== undefined && v !== null) return v;
  if (typeof platformTrackLabel === 'function') return platformTrackLabel(pid, trackId);
  return trackId;
}

/* ── Language management ──────────────────────────────── */

function getCurrentLang()        { return _activeLang; }
function getSupportedLanguages() { return SUPPORTED_LANGUAGES; }

async function switchLanguage(lang) {
  // Only switch to languages that actually have locale files
  if (!AVAILABLE_LANGUAGES.includes(lang)) return;
  await loadLocale(lang);
  // Re-render whatever is currently visible
  if (typeof state !== 'undefined') {
    if (state.onboardingComplete) {
      if (typeof renderDashboard === 'function')  renderDashboard();
    } else {
      if (typeof renderOnboarding === 'function') renderOnboarding();
    }
  }
  // Refresh lang menu highlight
  if (typeof renderLangMenu === 'function') renderLangMenu();
  // Close the menu
  document.getElementById('langMenu')?.classList.add('hidden');
}
