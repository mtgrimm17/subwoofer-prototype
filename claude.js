/* ============================================================
   AI — Claude-powered questionnaire auto-fill
   ============================================================ */

const CLAUDE_API_KEY  = (typeof CONFIG !== 'undefined' &&
                         CONFIG.CLAUDE_API_KEY &&
                         CONFIG.CLAUDE_API_KEY !== '__CLAUDE_API_KEY__')
                        ? CONFIG.CLAUDE_API_KEY : '';
const CLAUDE_MODEL    = 'claude-haiku-4-5-20251001';
const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';

/* ── Prompt builder ───────────────────────────────────────── */

function buildGeminiPrompt() {
  const fd  = state.formData;
  const ups = state.uploads;
  const hasScreenshots = (ups.screenshots || []).length > 0;
  const hasIAP = state.questionAnswers.inAppPurchases;

  return `You are an expert Apple App Store submission consultant analyzing a mobile game. Based on the game data below${hasScreenshots ? ' and the provided screenshots' : ''}, return a single JSON object with your best inferences for the App Store questionnaire.

GAME DATA:
Title: ${fd.title || '(untitled)'}
Description: ${fd.description || '(none provided)'}
Price: ${fd.price ? `$${fd.price}` : 'Free'}
Primary Language: ${fd.primaryLanguage || 'en'}
In-App Purchases (from developer): ${hasIAP === 'yes' ? 'Yes' : hasIAP === 'no' ? 'No' : 'Unknown'}
${hasScreenshots ? `Screenshots provided: ${ups.screenshots.length} image(s) — analyze visual content carefully.` : 'No screenshots provided.'}

Return ONLY a valid JSON object — no markdown fences, no explanation outside the JSON.

Each answer must include a "confidence" integer from 0–100 indicating how certain you are based on the available information:
- 90–100: Very certain (strong evidence from description/screenshots)
- 70–89: Reasonably confident (some evidence, plausible inference)
- Below 70: Uncertain (insufficient information — still provide your best guess)

SCHEMA (every field required — no nulls):
{
  "intensityQuestions": {
    "profanity":          { "value": "none|infrequent|frequent", "confidence": 0-100 },
    "horrorFear":         { "value": "none|infrequent|frequent", "confidence": 0-100 },
    "substancesAlcohol":  { "value": "none|infrequent|frequent", "confidence": 0-100 },
    "medicalTreatment":   { "value": "none|infrequent|frequent", "confidence": 0-100 },
    "matureSuggestive":   { "value": "none|infrequent|frequent", "confidence": 0-100 },
    "sexualContent":      { "value": "none|infrequent|frequent", "confidence": 0-100 },
    "graphicSexual":      { "value": "none|infrequent|frequent", "confidence": 0-100 },
    "cartoonViolence":    { "value": "none|infrequent|frequent", "confidence": 0-100 },
    "realisticViolence":  { "value": "none|infrequent|frequent", "confidence": 0-100 },
    "extendedViolence":   { "value": "none|infrequent|frequent", "confidence": 0-100 },
    "gunsWeapons":        { "value": "none|infrequent|frequent", "confidence": 0-100 },
    "simulatedGambling":  { "value": "none|infrequent|frequent", "confidence": 0-100 },
    "contests":           { "value": "none|infrequent|frequent", "confidence": 0-100 }
  },
  "ynQuestions": {
    "parentalControls":     { "value": "yes|no", "confidence": 0-100 },
    "ageAssurance":         { "value": "yes|no", "confidence": 0-100 },
    "unrestrictedInternet": { "value": "yes|no", "confidence": 0-100 },
    "userGenContent":       { "value": "yes|no", "confidence": 0-100 },
    "messagingChat":        { "value": "yes|no", "confidence": 0-100 },
    "advertising":          { "value": "yes|no", "confidence": 0-100 },
    "healthWellness":       { "value": "yes|no", "confidence": 0-100 },
    "realMoneyGambling":    { "value": "yes|no", "confidence": 0-100 },
    "lootBoxes":            { "value": "yes|no", "confidence": 0-100 }
  },
  "privacy": {
    "collectsData": { "value": "yes|no", "confidence": 0-100 },
    "dataTypes": [
      { "id": "crash", "confidence": 0-100, "purposes": ["analytics","app_function"], "identity": "no", "tracking": "no" }
    ]
  },
  "business": {
    "hasIAP": { "value": "yes|no", "confidence": 0-100 },
    "iapTypes": []
  },
  "exportCompliance": {
    "usesEncryption":   { "value": "yes|no", "confidence": 0-100 },
    "encryptionExempt": { "value": "yes|no", "confidence": 0-100 }
  },
  "ageCategory": { "value": "not_applicable|made_for_kids|override_higher", "confidence": 0-100 }
}

VALID IDs — only use these exact strings:
privacy.dataTypes[].id: name, email, phone, address, other_contact, health, fitness, payment_info, credit_info, other_financial, precise_loc, coarse_loc, sensitive, contacts, messages, photos_videos, audio, gameplay, customer_support, other_uc, browsing, search, user_id, device_id, purchases, product_use, ad_data, other_usage, crash, performance, other_diag, env_scan, hands, head, other

privacy.dataTypes[].purposes (array): first_party_ads, third_party_ads, analytics, personalization, app_function, other_purpose

business.iapTypes (array): consumable, non-consumable, auto-renewable, non-renewing

ageCategory: "not_applicable" for most games; "made_for_kids" only if explicitly designed for children under 13; "override_higher" only if a manual rating bump is needed.

INFERENCE GUIDELINES:
- Nearly all networked mobile games use HTTPS → usesEncryption: "yes" (confidence: 95), encryptionExempt: "yes" (confidence: 90)
- Most games collect crash and performance data → include crash + performance with purposes: ["analytics","app_function"], confidence 90
- Games with accounts/login → add user_id
- Games with analytics → add product_use with purposes: ["analytics"]
- Be conservative: default to "no" / "none" for content you cannot confirm
- "infrequent" = present but not central; "frequent" = a primary element of the experience
- Set confidence < 70 for fields where you genuinely cannot determine the answer from the game data`;
}

/* ── API call ─────────────────────────────────────────────── */

async function analyzeGameWithClaude() {
  if (!CLAUDE_API_KEY) throw new Error('NO_KEY');
  const ups = state.uploads;
  console.log('[Claude] Calling model:', CLAUDE_MODEL);

  // Build message content: text prompt + up to 3 screenshots
  const content = [];

  const screenshots = (ups.screenshots || []).slice(0, 3);
  for (const sc of screenshots) {
    if (sc.dataUrl && sc.dataUrl.includes(',')) {
      const [meta, data] = sc.dataUrl.split(',');
      const mimeType = meta.split(':')[1]?.split(';')[0] || 'image/png';
      content.push({ type: 'image', source: { type: 'base64', media_type: mimeType, data } });
    }
  }

  const promptText = buildGeminiPrompt();
  state.claudeLastPrompt = promptText;  // store for "See prompt" debug view
  content.push({ type: 'text', text: promptText });

  const res = await fetch(CLAUDE_ENDPOINT, {
    method: 'POST',
    headers: {
      'x-api-key':                              CLAUDE_API_KEY,
      'anthropic-version':                      '2023-06-01',
      'content-type':                           'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model:      CLAUDE_MODEL,
      max_tokens: 3000,
      messages:   [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    let rawBody = {};
    try { rawBody = await res.json(); } catch (_) {}
    console.error('[Claude] HTTP', res.status, JSON.stringify(rawBody, null, 2));
    const raw = rawBody.error?.message || '';
    let msg = `Request failed (${res.status})`;
    if (res.status === 429) msg = 'Rate limit reached — please retry in a moment.';
    else if (res.status === 401) msg = 'API key rejected — check the key is valid.';
    else if (res.status === 500 || res.status === 529) msg = 'Claude is temporarily overloaded — please retry.';
    else msg = raw || msg;
    throw new Error(msg);
  }

  const apiData = await res.json();
  console.log('[Claude] Success — tokens used:', apiData.usage?.input_tokens, '+', apiData.usage?.output_tokens);

  const text = apiData.content?.[0]?.text;
  if (!text) throw new Error('Empty response from Claude');

  // Strip markdown fences if present, then parse
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(cleaned);
}

/* ── Apply results to state ───────────────────────────────── */

function applyClaudeResults(result) {
  const a    = state.iosSubmitAnswers;
  const meta = state.iosAnswerMeta;
  let filled = 0;
  let total  = 0;

  // Helper: apply a field if valid value, confidence >= 70, and not human-confirmed
  function tryApply(fieldId, entry, validValues) {
    total++;
    if (!entry || typeof entry !== 'object') return;
    const { value, confidence } = entry;
    if (!validValues.includes(value)) return;
    if (typeof confidence !== "number" || confidence < 80) return;
    // Precedence: human answer (direct click or onboarding seed) always wins
    if (meta[fieldId]?.humanConfirmed) { filled++; return; }
    a[fieldId] = value;
    meta[fieldId] = { confidence, humanConfirmed: false };
    filled++;
  }

  // Intensity questions (none / infrequent / frequent)
  if (result.intensityQuestions) {
    IOS_INTENSITY_QUESTIONS.forEach(q => {
      tryApply(q.id, result.intensityQuestions[q.id], ['none', 'infrequent', 'frequent']);
    });
  }

  // Boolean content questions (yes / no)
  if (result.ynQuestions) {
    IOS_CONTENT_YN_QUESTIONS.forEach(q => {
      tryApply(q.id, result.ynQuestions[q.id], ['yes', 'no']);
    });
  }

  // Privacy — not inferred by AI; user must fill manually via the matrix

  // Business
  if (result.business) {
    tryApply('hasIAP', result.business.hasIAP, ['yes', 'no']);
    // Only suggest iapTypes if hasIAP wasn't human-confirmed — avoids overwriting
    // user's explicit IAP type selections when they've already answered this section
    if (Array.isArray(result.business.iapTypes) && !meta.hasIAP?.humanConfirmed) {
      const valid = ['consumable', 'non-consumable', 'auto-renewable', 'non-renewing'];
      a.iapTypes = result.business.iapTypes.filter(t => valid.includes(t));
    }
  }

  // Export compliance
  if (result.exportCompliance) {
    tryApply('usesEncryption',   result.exportCompliance.usesEncryption,   ['yes', 'no']);
    tryApply('encryptionExempt', result.exportCompliance.encryptionExempt, ['yes', 'no']);
  }

  // Age category
  tryApply('ageCategory', result.ageCategory, ['not_applicable', 'made_for_kids', 'override_higher']);

  const pct = total > 0 ? Math.min(100, Math.round((filled / total) * 100)) : 0;
  console.log(`[Claude] Applied ${filled}/${total} fields (${pct}%)`);
  return { filled, total, pct };
}


/* ══════════════════════════════════════════════════════════════
   CONSOLIDATED QUESTIONNAIRE — AI Inference
══════════════════════════════════════════════════════════════ */

/* ── Build a summary of any existing human-confirmed iOS answers ── */
function _summarizeKnownAnswers() {
  const a    = state.iosSubmitAnswers;
  const meta = state.iosAnswerMeta;
  const lines = [];

  // Intensity answers the human has confirmed
  IOS_INTENSITY_QUESTIONS.forEach(q => {
    const m = meta[q.id];
    if (m?.humanConfirmed && a[q.id]) {
      lines.push(`${q.label}: ${a[q.id]}`);
    }
  });

  // Boolean content answers
  IOS_CONTENT_YN_QUESTIONS.forEach(q => {
    const m = meta[q.id];
    if (m?.humanConfirmed && a[q.id]) {
      lines.push(`${q.label}: ${a[q.id]}`);
    }
  });

  // CQ answers already confirmed by human (e.g. from a previous pass)
  Object.entries(state.cqAnswers).forEach(([qid, ans]) => {
    const m = state.cqAnswerMeta[qid];
    if (m?.humanConfirmed) {
      const q = CQ_QUESTIONS.find(x => x.id === qid);
      if (q) lines.push(`${q.text}: ${Array.isArray(ans) ? ans.join(', ') : ans}`);
    }
  });

  return lines.length ? lines.join('\n') : 'None yet.';
}

/* ── Build the CQ prompt ─────────────────────────────────────── */
function buildCQPrompt() {
  const fd = state.formData;

  // Collect visible question IDs and their text/type for the prompt
  const visible = CQ_QUESTIONS.filter(q => {
    // Only include top-level visible questions (skip deep conditionals for brevity)
    if (!q.platforms.some(p => state.activePlatforms.has(p))) return false;
    return !q.parent; // top-level only; Claude can infer children via context
  });

  const questionList = visible.map(q => {
    const typeHint = q.type === 'yn' ? '"yes" or "no"'
      : q.type === 'single' ? `one of: ${(q.options || []).map(o => `"${o}"`).join(', ')}`
      : q.type === 'multi'  ? `array of: ${(q.options || []).map(o => `"${o}"`).join(', ')}`
      : 'free text string';
    return `  "${q.id}": { "value": <${typeHint}>, "confidence": 0-100 }`;
  }).join(',\n');

  return `You are an expert game content classifier. Based on the game data below, answer the consolidated platform content questionnaire used for iOS, Google Play, Steam, and Epic Games Store submissions.

GAME DATA:
Title: ${fd.title || '(untitled)'}
Description: ${fd.description || '(none provided)'}
Price: ${fd.price ? `$${fd.price}` : 'Free'}
Active platforms: ${[...state.activePlatforms].join(', ')}
${state.formData.genre ? `Genre: ${state.formData.genre}` : ''}

PREVIOUSLY CONFIRMED ANSWERS (treat these as ground truth — do not contradict them):
${_summarizeKnownAnswers()}

Return ONLY a valid JSON object — no markdown fences, no explanation. Confidence 0–100:
- 90–100: Very certain (clear evidence from title/description)
- 70–89: Reasonably confident (plausible inference)
- Below 70: Uncertain — still provide your best guess but flag it

SCHEMA (answer every question that appears below; omit unknown questions):
{
${questionList}
}

GUIDELINES:
- Default to "no" / "none" / "None of the above" for content you cannot confirm
- Be conservative — only flag content if it is clearly present or strongly implied
- For multi-select, return an array of the exact option strings
- For yn questions, return "yes" or "no"`;
}

/* ── API call ────────────────────────────────────────────────── */
async function analyzeCQWithClaude() {
  if (!CLAUDE_API_KEY) throw new Error('NO_KEY');
  console.log('[Claude CQ] Running CQ inference...');

  const res = await fetch(CLAUDE_ENDPOINT, {
    method: 'POST',
    headers: {
      'x-api-key':                              CLAUDE_API_KEY,
      'anthropic-version':                      '2023-06-01',
      'content-type':                           'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model:      CLAUDE_MODEL,
      max_tokens: 4000,
      messages:   [{ role: 'user', content: [{ type: 'text', text: buildCQPrompt() }] }],
    }),
  });

  if (!res.ok) {
    let rawBody = {};
    try { rawBody = await res.json(); } catch (_) {}
    console.error('[Claude CQ] HTTP', res.status, JSON.stringify(rawBody, null, 2));
    const raw = rawBody.error?.message || '';
    let msg = `Request failed (${res.status})`;
    if (res.status === 429) msg = 'Rate limit reached — please retry in a moment.';
    else if (res.status === 401) msg = 'API key rejected — check the key is valid.';
    else if (res.status === 500 || res.status === 529) msg = 'Claude is temporarily overloaded — please retry.';
    else msg = raw || msg;
    throw new Error(msg);
  }

  const apiData = await res.json();
  console.log('[Claude CQ] Success — tokens:', apiData.usage?.input_tokens, '+', apiData.usage?.output_tokens);

  const text = apiData.content?.[0]?.text;
  if (!text) throw new Error('Empty response from Claude');

  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(cleaned);
}

/* ══════════════════════════════════════════════════════════════
   GAME SEARCH — IGDB (Internet Game Database, powered by Twitch)
   Replaces the old iTunes + Steam + Claude-knowledge waterfall.
   IGDB covers Steam, iOS, Android, console, and indie games in
   a single API with cover art and platform metadata.
══════════════════════════════════════════════════════════════ */

const IGDB_CLIENT_ID     = (typeof CONFIG !== 'undefined' &&
                            CONFIG.IGDB_CLIENT_ID &&
                            CONFIG.IGDB_CLIENT_ID !== '__IGDB_CLIENT_ID__')
                           ? CONFIG.IGDB_CLIENT_ID : '';
const IGDB_CLIENT_SECRET = (typeof CONFIG !== 'undefined' &&
                            CONFIG.IGDB_CLIENT_SECRET &&
                            CONFIG.IGDB_CLIENT_SECRET !== '__IGDB_CLIENT_SECRET__')
                           ? CONFIG.IGDB_CLIENT_SECRET : '';
const IGDB_ENDPOINT      = 'https://corsproxy.io/?https://api.igdb.com/v4/games';
const TWITCH_TOKEN_URL   = 'https://id.twitch.tv/oauth2/token';

// Cached for the page session (token is valid ~60 days)
let _igdbAccessToken = null;

async function _getIgdbToken() {
  if (_igdbAccessToken) return _igdbAccessToken;
  if (!IGDB_CLIENT_ID || !IGDB_CLIENT_SECRET) throw new Error('NO_IGDB_KEY');
  const res = await fetch(
    `${TWITCH_TOKEN_URL}?client_id=${IGDB_CLIENT_ID}&client_secret=${IGDB_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: 'POST' }
  );
  if (!res.ok) throw new Error('IGDB auth failed (' + res.status + ')');
  const data = await res.json();
  _igdbAccessToken = data.access_token;
  return _igdbAccessToken;
}

// IGDB website category IDs → our platform IDs
const IGDB_WEBSITE_TO_PID = { 10: 'ios', 11: 'ios', 12: 'android', 13: 'steam', 16: 'egs' };

// IGDB platform IDs → our platform IDs (IDs are stable; slugs can vary)
// Source: https://api.igdb.com/v4/platforms
const IGDB_PLATFORM_ID_TO_PID = {
  6:   'steam',    // PC (Windows)
  14:  'steam',    // Mac
  3:   'steam',    // Linux
  34:  'android',  // Android
  39:  'ios',      // iOS
  48:  'psn',      // PlayStation 4
  167: 'psn',      // PlayStation 5
  49:  'xbox',     // Xbox One
  169: 'xbox',     // Xbox Series X|S
  130: 'nintendo', // Nintendo Switch
};

function _igdbPlatforms(platforms, websites) {
  const pids = new Set();
  // Primary: website-based detection (most accurate for storefronts)
  for (const w of (websites || [])) {
    const pid = IGDB_WEBSITE_TO_PID[w.category];
    if (pid) pids.add(pid);
  }
  // Secondary: platform ID mapping — IGDB returns raw integers when
  // `platforms` (no subfield) is requested, e.g. [6, 48, 49, 130]
  for (const p of (platforms || [])) {
    const pid = IGDB_PLATFORM_ID_TO_PID[p];
    if (pid) pids.add(pid);
  }
  return [...pids].filter(pid => !!PLATFORMS[pid] && !COMING_SOON_PLATFORMS.has(pid));
}

/* ── IGDB picklist search — returns up to 5 results ─────────── */

async function igdbSearch(title) {
  const token = await _getIgdbToken();
  const safe  = title.replace(/"/g, '');   // prevent query injection
  // Use case-insensitive substring match (~~ *"..."*) instead of IGDB's
  // full-text `search` so partial input like "Monument Val" matches
  // "Monument Valley". Sort by popularity so the most relevant games
  // surface first even without relevance ranking.
  const body  = [
    `fields name, cover.url, platforms, summary, websites.url, websites.category;`,
    `where name ~ *"${safe}"* & version_parent = null;`,
    `sort aggregated_rating_count desc;`,
    `limit 5;`,
  ].join('\n');

  const res = await fetch(IGDB_ENDPOINT, {
    method: 'POST',
    headers: {
      'Client-ID':     IGDB_CLIENT_ID,
      'Authorization': 'Bearer ' + token,
      'Content-Type':  'text/plain',
    },
    body,
  });

  if (res.status === 401) {
    _igdbAccessToken = null;               // invalidate and let caller retry
    throw new Error('IGDB auth expired — please retry');
  }
  if (!res.ok) throw new Error('IGDB search failed (' + res.status + ')');

  const games = await res.json();
  return games.map(g => ({
    id:        g.id,
    name:      g.name || '',
    // Upgrade thumbnail from t_thumb (32px) to t_cover_small (90×128)
    coverUrl:  g.cover?.url
                 ? 'https:' + g.cover.url.replace('t_thumb', 't_cover_small')
                 : null,
    platforms: _igdbPlatforms(g.platforms, g.websites),
    summary:   g.summary || '',
  }));
}

/* ── Backward-compat wrapper (used by _triggerScenarioSearch) ── */
// STORE_NAME_TO_PID is kept so confirmGameImport still works if called
// via the old scenario path; IGDB returns our PIDs directly so the
// mapping is an identity pass-through for all known IDs.
const STORE_NAME_TO_PID = {
  ios: 'ios', android: 'android', steam: 'steam', egs: 'egs',
  psn: 'psn', xbox: 'xbox', nintendo: 'nintendo',
};

async function searchGameByTitle(title) {
  if (!title || !title.trim()) throw new Error('NO_TITLE');
  const results = await igdbSearch(title.trim());
  if (!results.length) {
    return { found: false, title: null, description: null, source: null, allStores: [], confidence: 0 };
  }
  const top = results[0];
  return {
    found:       true,
    title:       top.name,
    description: top.summary,
    source:      'IGDB',
    allStores:   top.platforms,
    confidence:  90,
  };
}

/* ── Apply CQ results to state ───────────────────────────────── */
function applyCQResults(result) {
  let applied = 0;
  let skipped = 0;

  CQ_QUESTIONS.forEach(q => {
    const entry = result[q.id];
    if (!entry || typeof entry !== 'object') { skipped++; return; }

    const { value, confidence } = entry;
    if (value === undefined || value === null) { skipped++; return; }
    if (typeof confidence !== 'number' || confidence < 80) { skipped++; return; }

    // Never overwrite a human-confirmed answer
    if (state.cqAnswerMeta[q.id]?.humanConfirmed) { applied++; return; }

    // Validate value type
    if (q.type === 'yn') {
      if (!['yes', 'no'].includes(value)) { skipped++; return; }
    } else if (q.type === 'single') {
      if (!q.options?.includes(value)) { skipped++; return; }
    } else if (q.type === 'multi') {
      if (!Array.isArray(value)) { skipped++; return; }
      const valid = value.filter(v => q.options?.includes(v));
      if (!valid.length) { skipped++; return; }
      state.cqAnswers[q.id]   = valid;
      state.cqAnswerMeta[q.id] = { confidence, humanConfirmed: false };
      applied++;
      return;
    }
    // yn, single, text
    state.cqAnswers[q.id]   = value;
    state.cqAnswerMeta[q.id] = { confidence, humanConfirmed: false };
    applied++;
  });

  console.log(`[Claude CQ] Applied ${applied}, skipped ${skipped}`);
  return { applied, skipped };
}

/* ═══════════════════════════════════════════════════════════════
   ABSTRACTED AI INFERENCE — shared across all platforms/steps
   ═══════════════════════════════════════════════════════════════

   runInference(pid, stepId) is the public entry point.
   It gathers all accumulated game knowledge (onboarding + prior
   platform answers), builds a platform-specific prompt, calls
   Claude, and applies results to the right answer store.
   ═══════════════════════════════════════════════════════════════ */

/* ── Per-platform context extractors ─────────────────────────── */
// Returns a formatted string block for the given platform's filled
// content-rating answers, or null if the platform has no answers yet.
// Add a new case here whenever a platform gets its own answer store.

function _extractPlatformContext(pid) {
  if (pid === 'ios') {
    const ios    = state.iosSubmitAnswers;
    const fields = [...IOS_INTENSITY_QUESTIONS, ...IOS_CONTENT_YN_QUESTIONS];
    const filled = fields.filter(q => ios[q.id] !== null && ios[q.id] !== undefined);
    if (!filled.length) return null;
    const lines  = filled.map(q => `  ${q.label}: ${ios[q.id]}`);
    return `iOS APP STORE CONTENT RATING:\n${lines.join('\n')}`;
  }

  if (pid === 'steam') {
    const sca    = (state.steamSubmitAnswers || {}).steamContentAnswers || {};
    const filled = Object.entries(sca).filter(([, v]) => v === 'yes' || v === 'no');
    if (!filled.length) return null;
    const yesItems = filled.filter(([, v]) => v === 'yes').map(([k]) => k);
    if (!yesItems.length) return null;
    return `STEAM CONTENT SURVEY — categories marked YES: ${yesItems.join(', ')}`;
  }

  // android: content-rating answers live in state.cqAnswers (the shared IARC
  // store), which buildSharedContext() already includes as its own section.
  // egs, psn, xbox, nintendo: coming-soon — no answer stores yet.
  return null;
}

/* ── Shared context builder ──────────────────────────────────── */
// Gathers all accumulated game knowledge regardless of which platforms
// the user filled first. Iterates state.activePlatforms so inference
// is always order-agnostic: Steam→Android is identical to Android→Steam.

function buildSharedContext() {
  const fd  = state.formData;
  const qa  = state.questionAnswers;
  const cq  = state.cqAnswers;
  const parts = [];

  // ── Game basics ──────────────────────────────────────────────
  parts.push(`GAME TITLE: ${fd.title || '(not provided)'}`);
  parts.push(`DESCRIPTION: ${fd.description || '(none provided)'}`);
  if (fd.genre) parts.push(`GENRE: ${fd.genre}`);

  // ── Onboarding compliance answers ────────────────────────────
  const qaMap = { violence:'Violence or combat', sexualContent:'Sexual or mature content',
                  strongLanguage:'Strong language', dataCollection:'Data collection',
                  inAppPurchases:'In-app purchases' };
  const qaLines = Object.entries(qaMap)
    .filter(([k]) => qa[k] !== null)
    .map(([k, label]) => `  ${label}: ${qa[k]}`);
  if (qaLines.length) parts.push(`ONBOARDING COMPLIANCE:\n${qaLines.join('\n')}`);

  // ── CQ/IARC answers (platform-agnostic shared questionnaire) ─
  // These are gathered independently of active-platform iteration because
  // the IARC questionnaire is shared across iOS and Android and has its own store.
  const filledCQ = Object.entries(cq)
    .filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0));
  if (filledCQ.length) {
    const cqLines = filledCQ.slice(0, 40).map(([k, v]) => {
      const q     = CQ_QUESTIONS.find(x => x.id === k);
      const label = q ? q.text.slice(0, 60) : k;
      return `  ${label}: ${Array.isArray(v) ? v.join(', ') : v}`;
    });
    parts.push(`CONTENT QUESTIONNAIRE ANSWERS (IARC/Google):\n${cqLines.join('\n')}`);
  }

  // ── Per-platform content answers (all active platforms) ──────
  // Iterate every active platform so inference always has full context
  // regardless of the order the user filled them in.
  for (const pid of state.activePlatforms) {
    const section = _extractPlatformContext(pid);
    if (section) parts.push(section);
  }

  return parts.join('\n\n');
}

/* ── Android Content Rating inference ───────────────────────── */

async function inferAndroidCR() {
  const ctx = buildSharedContext();
  // Build the question list for android-visible CQ questions (top-level only for brevity)
  const visibleQ = CQ_QUESTIONS.filter(q =>
    q.platforms.includes('android') && !q.parent && cqIsVisible(q)
  );

  const qLines = visibleQ.map(q => {
    const opts = q.type === 'multi' ? `Options: ${(q.options||[]).slice(0,6).join(' | ')}` : '';
    return `id: ${q.id} | type: ${q.type} | question: ${q.text.slice(0,100)}${opts ? ' | ' + opts : ''}`;
  }).join('\n');

  const prompt = `You are an expert game content analyst helping pre-fill a Google Play IARC content questionnaire.

${ctx}

Based on ALL of the above information, answer these Google Play content questions. Be conservative — only mark "yes" if clearly supported by the game data.

QUESTIONS TO ANSWER:
${qLines}

Return ONLY valid JSON — no markdown, no explanation:
{
  "answers": {
    "<question_id>": {
      "value": "<yes|no|option_text|[\"option1\",\"option2\"]>",
      "confidence": <0-100>
    }
  }
}

Rules:
- For yn: value is "yes" or "no"
- For single: value is the exact option text
- For multi: value is an array of matching option strings (empty array [] if none apply)
- Only include questions where confidence >= 80
- Be conservative — prefer "no" or empty arrays when uncertain`;

  const res = await fetch(CLAUDE_ENDPOINT, {
    method: 'POST',
    headers: {
      'x-api-key':                                 CLAUDE_API_KEY,
      'anthropic-version':                         '2023-06-01',
      'content-type':                              'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL, max_tokens: 2000,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    }),
  });
  if (!res.ok) throw new Error('API ' + res.status);
  const data    = await res.json();
  const text    = (data.content?.[0]?.text || '').trim();
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const parsed  = JSON.parse(cleaned);

  const validQIds    = new Set(CQ_QUESTIONS.map(q => q.id));
  const answers      = parsed.answers || {};
  let applied = 0;

  for (const [qid, entry] of Object.entries(answers)) {
    if (!validQIds.has(qid)) continue;
    if (state.cqAnswerMeta[qid]?.humanConfirmed) continue;
    const { value, confidence } = entry;
    if (typeof confidence !== 'number' || confidence < 80) continue;
    const q = CQ_QUESTIONS.find(x => x.id === qid);
    if (!q) continue;

    if (q.type === 'yn' && (value === 'yes' || value === 'no')) {
      state.cqAnswers[qid] = value;
      state.cqAnswerMeta[qid] = { confidence, humanConfirmed: false };
      applied++;
    } else if (q.type === 'single' && typeof value === 'string' && q.options.includes(value)) {
      state.cqAnswers[qid] = value;
      state.cqAnswerMeta[qid] = { confidence, humanConfirmed: false };
      applied++;
    } else if (q.type === 'multi' && Array.isArray(value)) {
      const valid = value.filter(v => q.options.includes(v));
      if (valid.length > 0 || value.length === 0) {
        state.cqAnswers[qid] = valid;
        state.cqAnswerMeta[qid] = { confidence, humanConfirmed: false };
        applied++;
      }
    }
  }
  console.log(`[Android CR inference] Applied ${applied} answers`);
}

/* ── Steam Content Rating inference ─────────────────────────── */

async function inferSteamCR() {
  const ctx = buildSharedContext();
  const allItems = STEAM_CONTENT_CATEGORIES.flatMap(g => g.items.map(i => ({...i, group: g.group})));
  const itemLines = allItems.map(i => `  ${i.id}: ${i.label}`).join('\n');

  const MATURE_OPTS = ['gen_mature','freq_violence','some_nudity','freq_nudity','adult_sexual'];
  const matureLines = [
    'gen_mature: General mature content',
    'freq_violence: Frequent violence or gore',
    'some_nudity: Some nudity or sexual content',
    'freq_nudity: Frequent nudity or sexual content',
    'adult_sexual: Adult only sexual content',
  ].join('\n  ');

  const prompt = `You are an expert game content analyst helping pre-fill a Steam content questionnaire.

${ctx}

Answer each Steam content survey item with yes or no, and provide a confidence score.

CONTENT CATEGORY ITEMS (answer yes if it applies to this game):
${itemLines}

MATURE CONTENT DECLARATIONS (answer yes if applicable):
  ${matureLines}

Return ONLY valid JSON — no markdown, no explanation:
{
  "items": {
    "<item_id>": { "value": "yes|no", "confidence": <0-100> }
  },
  "mature": {
    "<mature_id>": { "value": "yes|no", "confidence": <0-100> }
  }
}

Rules:
- Only include items where confidence >= 80
- Be conservative — prefer "no" when uncertain
- Cascade: if adult_sexual=yes → freq_nudity, some_nudity, gen_mature also yes
- If freq_violence=yes → gen_mature also yes`;

  const res = await fetch(CLAUDE_ENDPOINT, {
    method: 'POST',
    headers: {
      'x-api-key':                                 CLAUDE_API_KEY,
      'anthropic-version':                         '2023-06-01',
      'content-type':                              'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL, max_tokens: 2000,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    }),
  });
  if (!res.ok) throw new Error('API ' + res.status);
  const data    = await res.json();
  const text    = (data.content?.[0]?.text || '').trim();
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const parsed  = JSON.parse(cleaned);

  const validItems = new Set(STEAM_CONTENT_CATEGORIES.flatMap(g => g.items.map(i => i.id)));
  const MATURE_SET = new Set(['gen_mature','freq_violence','some_nudity','freq_nudity','adult_sexual']);
  if (!state.steamSubmitAnswers.steamContentAnswers) state.steamSubmitAnswers.steamContentAnswers = {};
  const sca  = state.steamSubmitAnswers.steamContentAnswers;
  const meta = state.steamAnswerMeta;
  let applied = 0;

  for (const [id, entry] of Object.entries(parsed.items || {})) {
    if (!validItems.has(id)) continue;
    if (meta[id]?.humanConfirmed) continue;
    const { value, confidence } = entry;
    if (typeof confidence !== 'number' || confidence < 80) continue;
    if (value === 'yes' || value === 'no') {
      sca[id]  = value;
      meta[id] = { confidence, humanConfirmed: false };
      applied++;
    }
  }
  for (const [id, entry] of Object.entries(parsed.mature || {})) {
    if (!MATURE_SET.has(id)) continue;
    if (meta[id]?.humanConfirmed) continue;
    const { value, confidence } = entry;
    if (typeof confidence !== 'number' || confidence < 80) continue;
    if (value === 'yes' || value === 'no') {
      sca[id]  = value;
      meta[id] = { confidence, humanConfirmed: false };
      applied++;
    }
  }
  console.log(`[Steam CR inference] Applied ${applied} answers`);
}

/* ── Public dispatcher ───────────────────────────────────────── */

async function runInference(pid, stepId) {
  if (!CLAUDE_API_KEY) throw new Error('NO_KEY');
  const key = pid + ':' + stepId;
  if (state.platformInferenceCache[key]) return; // already ran

  if (pid === 'android' && stepId === 'contentRating') {
    await inferAndroidCR();
  } else if (pid === 'steam' && stepId === 'contentRating') {
    await inferSteamCR();
  }
  // ios:contentRating is handled by existing analyzeGameWithClaude() flow

  state.platformInferenceCache[key] = true;
}
