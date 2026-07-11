/* ============================================================
   AI — Claude-powered questionnaire auto-fill
   ============================================================ */

const CLAUDE_API_KEY  = (typeof CONFIG !== 'undefined' &&
                         CONFIG.CLAUDE_API_KEY &&
                         CONFIG.CLAUDE_API_KEY !== '__CLAUDE_API_KEY__')
                        ? CONFIG.CLAUDE_API_KEY : '';
const CLAUDE_MODEL    = 'claude-haiku-4-5-20251001';
const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';

/* ── Screenshot content blocks (shared across all inference calls) ── */
// Returns up to 3 screenshot image content blocks for the Claude API messages array.
// Returns [] if no screenshots are uploaded.
function _buildScreenshotContent() {
  const screenshots = ((state.uploads || {}).screenshots || []).slice(0, 3);
  const blocks = [];
  for (const sc of screenshots) {
    if (sc.dataUrl && sc.dataUrl.includes(',')) {
      const [meta, data] = sc.dataUrl.split(',');
      const mimeType = meta.split(':')[1]?.split(';')[0] || 'image/png';
      blocks.push({ type: 'image', source: { type: 'base64', media_type: mimeType, data } });
    }
  }
  return blocks;
}

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
// NOTE: Console IDs can be inaccurate in IGDB (cancelled ports, rumoured releases).
// We mitigate this by cross-referencing release_dates.status — consoles are only
// included when IGDB records a concrete release (status 4 = Released, 7 = Early Access).
const IGDB_PLATFORM_ID_TO_PID = {
  6:   'steam',    // PC (Windows)
  14:  'steam',    // Mac
  3:   'steam',    // Linux
  34:  'android',  // Android
  39:  'ios',      // iOS
  48:  'psn',      // PlayStation 4
  167: 'psn',      // PlayStation 5
  49:  'xbox',     // Xbox One
  169: 'xbox',     // Xbox Series X/S
  130: 'nintendo', // Nintendo Switch
};

// forDisplay=true  → show every platform IGDB lists (for picklist icons)
// forDisplay=false → strict: consoles need a confirmed release status (for auto-activation)
function _igdbPlatforms(platforms, websites, releaseDates, forDisplay = false) {
  const pids = new Set();

  // Primary: website/storefront links (most reliable — real store listings)
  for (const w of (websites || [])) {
    const pid = IGDB_WEBSITE_TO_PID[w.category];
    if (pid) pids.add(pid);
  }

  // Build confirmed-released set (status 4 = Released, 7 = Early Access)
  const releasedIds = new Set();
  const hasRdData   = (releaseDates || []).length > 0;
  if (hasRdData) {
    for (const rd of releaseDates) {
      if ((rd.status === 4 || rd.status === 7) && rd.platform) releasedIds.add(rd.platform);
    }
  }

  // Map IGDB platform IDs to our PIDs.
  // For display: include every mapped platform.
  // For activation: require console platforms to have a confirmed release to avoid
  // auto-enabling platforms the developer hasn't shipped on.
  const CONSOLE_PIDS = new Set(['psn', 'xbox', 'nintendo']);
  for (const p of (platforms || [])) {
    const pid = IGDB_PLATFORM_ID_TO_PID[p];
    if (!pid) continue;
    if (!forDisplay && CONSOLE_PIDS.has(pid) && hasRdData && !releasedIds.has(p)) continue;
    pids.add(pid);
  }

  return [...pids].filter(pid => !!PLATFORMS[pid]);
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
    `fields name, cover.url, screenshots.url, platforms, release_dates.platform, release_dates.status, summary, websites.url, websites.category;`,
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
  console.log('[IGDB raw]', JSON.stringify(games.map(g => ({ id: g.id, name: g.name, platforms: g.platforms, websites: (g.websites||[]).map(w=>w.category), cover: g.cover?.url }))));
  return games.map(g => ({
    id:        g.id,
    name:      g.name || '',
    // Upgrade thumbnail from t_thumb (32px) to t_cover_small (90×128),
    // then proxy through wsrv.nl so the image loads cross-origin in the browser.
    coverUrl: (() => {
      if (!g.cover?.url) return null;
      const direct = (g.cover.url.startsWith('//') ? 'https:' : '') + g.cover.url.replace('t_thumb', 't_cover_small');
      const clean  = direct.replace(/^https?:\/\//, '');
      return 'https://wsrv.nl/?url=' + encodeURIComponent(clean) + '&output=jpg';
    })(),
    // forDisplay=true → consoles shown without requiring confirmed release status
    platforms:   _igdbPlatforms(g.platforms, g.websites, g.release_dates, true),
    // Strict activation list stored separately for selectPicklistItem
    activationPlatforms: _igdbPlatforms(g.platforms, g.websites, g.release_dates, false),
    summary:     g.summary || '',
    // Up to 6 screenshots upgraded from t_thumb to t_screenshot_big (889×500)
    // also proxied through wsrv.nl for the same reason.
    screenshots: (g.screenshots || []).slice(0, 6)
      .filter(s => s && s.url)
      .map(s => {
        const abs   = s.url.startsWith('//') ? 'https:' + s.url : s.url;
        const sized = abs.replace('/t_thumb/', '/t_screenshot_big/');
        const clean = sized.replace(/^https?:\/\//, '');
        return 'https://wsrv.nl/?url=' + encodeURIComponent(clean) + '&output=jpg';
      }),
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

/* ── Natural language game summary ──────────────────────────── */
// Generates a compact prose paragraph from all known game state so
// the LLM has an easy-to-reason-about narrative rather than raw K/V pairs.
// Called at the top of buildSharedContext() and shown in the debug UI.

function buildNaturalLanguageSummary() {
  const fd  = state.formData;
  const qa  = state.questionAnswers;
  const a   = state.iosSubmitAnswers;

  const parts = [];

  // ── Title + genre + price ─────────────────────────────────────────────────
  const title = fd.title || '(untitled)';
  const genre = fd.genre ? ` ${fd.genre}` : '';
  const price = fd.price ? `$${fd.price}` : 'free';
  parts.push(`"${title}" is a${genre} game priced at ${price}.`);

  // ── Description snippet (up to 300 chars) ────────────────────────────────
  if (fd.description && fd.description.trim()) {
    const d = fd.description.trim();
    parts.push(`Description: ${d.slice(0, 300)}${d.length > 300 ? '…' : ''}`);
  }

  // ── Active platforms ──────────────────────────────────────────────────────
  const pids = [...state.activePlatforms];
  if (pids.length) {
    const names = { ios:'iOS App Store', android:'Google Play', steam:'Steam',
                    egs:'Epic Games Store', psn:'PlayStation', xbox:'Xbox', nintendo:'Nintendo' };
    parts.push(`Targeting: ${pids.map(p => names[p] || p).join(', ')}.`);
  }

  // ── Synthesize content profile from onboarding + iOS answers ─────────────
  // Determine what content IS present (positive flags only)
  const hasViolence = qa.violence === 'yes' ||
    ['cartoonViolence','realisticViolence','extendedViolence','gunsWeapons']
      .some(id => a[id] && a[id] !== 'none');
  const hasSexual   = qa.sexualContent === 'yes' ||
    ['sexualContent','graphicSexual','matureSuggestive'].some(id => a[id] && a[id] !== 'none');
  const hasLanguage = qa.strongLanguage === 'yes' || (a.profanity && a.profanity !== 'none');
  const hasGambling = a.simulatedGambling && a.simulatedGambling !== 'none';
  const hasHorror   = a.horrorFear && a.horrorFear !== 'none';
  const hasDrugs    = a.substancesAlcohol && a.substancesAlcohol !== 'none';
  const hasIAP      = qa.inAppPurchases === 'yes' || a.hasIAP === 'yes';
  const hasChat     = a.messagingChat === 'yes';
  const hasUGC      = a.userGenContent === 'yes';
  const hasAds      = a.advertising === 'yes';
  const hasInternet = a.unrestrictedInternet === 'yes';

  const contentFlags = [];
  if (hasViolence) contentFlags.push('violence or combat');
  if (hasSexual)   contentFlags.push('sexual or mature content');
  if (hasLanguage) contentFlags.push('strong language or profanity');
  if (hasGambling) contentFlags.push('simulated gambling');
  if (hasHorror)   contentFlags.push('horror or fear themes');
  if (hasDrugs)    contentFlags.push('drug or alcohol references');

  const anyIosAnswered = [...IOS_INTENSITY_QUESTIONS, ...IOS_CONTENT_YN_QUESTIONS]
    .some(q => a[q.id] !== null && a[q.id] !== undefined);

  if (contentFlags.length) {
    parts.push(`Content flags: ${contentFlags.join(', ')}.`);
  } else if (anyIosAnswered || qa.violence === 'no' || qa.sexualContent === 'no') {
    parts.push('Content review: no significant mature content flagged.');
  }

  // Features
  const features = [];
  if (hasIAP)      features.push('in-app purchases');
  if (hasChat)     features.push('messaging or chat');
  if (hasUGC)      features.push('user-generated content');
  if (hasAds)      features.push('advertising');
  if (hasInternet) features.push('unrestricted internet access');
  if (features.length) parts.push(`Features: ${features.join(', ')}.`);

  // ── iOS intensity detail for non-"none" items ─────────────────────────────
  // These are the most specific signals we have — describe them fully.
  const intensityItems = IOS_INTENSITY_QUESTIONS
    .filter(q => a[q.id] && a[q.id] !== 'none')
    .map(q => `${q.label} (${a[q.id]})`);
  if (intensityItems.length) {
    parts.push(`iOS intensity ratings: ${intensityItems.join('; ')}.`);
  }

  // Note: full CQ question/answer data is included separately in buildSharedContext()
  // as CONTENT QUESTIONNAIRE ANSWERS. We don't echo it here because the question
  // text is long and doesn't truncate cleanly — the raw data is more useful as-is.

  return parts.join(' ');
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

  // ── Natural language content summary (easiest for LLM to reason about) ──
  const nlSummary = buildNaturalLanguageSummary();
  if (nlSummary) parts.push(`CONTENT PROFILE SUMMARY:\n${nlSummary}`);

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

/* ── Apply Steam inference results to state ──────────────────── */
// Extracted so both inferSteamCR() and inferAllQuestionnaires() can reuse it.
// steamData = { items: { <id>: { value, confidence } }, mature: { <id>: { value, confidence } } }

function applySteamResults(steamData) {
  const validItems = new Set(STEAM_CONTENT_CATEGORIES.flatMap(g => g.items.map(i => i.id)));
  const MATURE_SET = new Set(['gen_mature','freq_violence','some_nudity','freq_nudity','adult_sexual']);
  if (!state.steamSubmitAnswers.steamContentAnswers) state.steamSubmitAnswers.steamContentAnswers = {};
  const sca  = state.steamSubmitAnswers.steamContentAnswers;
  const meta = state.steamAnswerMeta;
  let applied = 0;

  for (const [id, entry] of Object.entries(steamData.items || {})) {
    if (!validItems.has(id)) continue;
    if (meta[id]?.humanConfirmed) continue;
    const { value, confidence } = entry;
    if (typeof confidence !== 'number' || confidence < 65) continue;
    if (value === 'yes' || value === 'no') {
      sca[id]  = value;
      meta[id] = { confidence, humanConfirmed: false };
      applied++;
    }
  }
  for (const [id, entry] of Object.entries(steamData.mature || {})) {
    if (!MATURE_SET.has(id)) continue;
    if (meta[id]?.humanConfirmed) continue;
    const { value, confidence } = entry;
    if (typeof confidence !== 'number' || confidence < 65) continue;
    if (value === 'yes' || value === 'no') {
      sca[id]  = value;
      meta[id] = { confidence, humanConfirmed: false };
      applied++;
    }
  }
  console.log(`[Steam] Applied ${applied} answers`);
  return applied;
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

CROSS-PLATFORM INFERENCE RULES (apply these first using the context above):
When the context contains iOS App Store Content Rating answers, use them as direct evidence:
- "Realistic Violence: none" → rv_blood=no, rv_killing=no, rv_minorities=no (confidence ≥90)
- "Realistic Violence: infrequent" → rv_blood=yes, rv_killing=no (confidence ≥85)
- "Realistic Violence: frequent" → rv_blood=yes, rv_killing=yes (confidence ≥85)
- "Cartoon or Fantasy Violence: none" → fmv_cartoon=no, fmv_fights=no (confidence ≥90)
- "Cartoon or Fantasy Violence: infrequent/frequent" → fmv_cartoon=yes (confidence ≥85)
- "Extended Graphic or Sadistic Violence: infrequent/frequent" → hiv_extreme=yes, hiv_gratuitous=yes (confidence ≥85)
- "Profanity or Crude Humor: none" → lang_mild=no, lang_moderate=no (confidence ≥90)
- "Profanity or Crude Humor: infrequent" → lang_mild=yes (confidence ≥85)
- "Profanity or Crude Humor: frequent" → lang_moderate=yes (confidence ≥85)
- "Horror/Fear Themes: none" → hor_bleak=no, hor_frightening=no (confidence ≥90)
- "Horror/Fear Themes: infrequent" → hor_bleak=yes (confidence ≥85)
- "Horror/Fear Themes: frequent" → hor_frightening=yes (confidence ≥85)
- "Alcohol, Tobacco, or Drug Use: infrequent/frequent" → drug_legal=yes (confidence ≥85)
- "Sexual Content or Nudity: infrequent" → sex_nonexplicit=yes (confidence ≥85)
- "Sexual Content or Nudity: frequent" → sex_nonexplicit=yes, some_nudity (confidence ≥85)
- "Simulated Gambling: infrequent/frequent" → gamb_interaction=yes, gamb_refs=yes (confidence ≥85)
- "In-App Purchases: yes" OR onboarding "In-app purchases: yes" → int_purchases=yes (confidence ≥95)
- "Messaging and Chat: yes" → int_chat=yes (confidence ≥90)

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
- Include items where confidence >= 65 (be willing to answer based on iOS/Android cross-references above)
- Be conservative for items with no prior-platform evidence — prefer "no" when uncertain
- IMPORTANT: When iOS/Android context clearly answers an equivalent question, use it with high confidence
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
  applySteamResults(parsed);
}

/* ── Unified inference prompt (all active platforms in one call) ── */

function buildUnifiedInferencePrompt() {
  const activePids = [...state.activePlatforms].filter(p => ['ios','android','steam'].includes(p));
  const ctx        = buildSharedContext();   // includes natural-language summary at top

  // ── iOS schema ───────────────────────────────────────────────────────────────
  const iosSchema = activePids.includes('ios') ? `
  "ios": {
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
    "business":        { "hasIAP": { "value": "yes|no", "confidence": 0-100 }, "iapTypes": [] },
    "exportCompliance": {
      "usesEncryption":   { "value": "yes|no", "confidence": 0-100 },
      "encryptionExempt": { "value": "yes|no", "confidence": 0-100 }
    },
    "ageCategory": { "value": "not_applicable|made_for_kids|override_higher", "confidence": 0-100 }
  }` : '';

  // ── Android schema ───────────────────────────────────────────────────────────
  let androidSchema = '';
  if (activePids.includes('android')) {
    const visibleQ = CQ_QUESTIONS.filter(q =>
      q.platforms.includes('android') && !q.parent && cqIsVisible(q)
    );
    const qLines = visibleQ.map(q => {
      const typeHint = q.type === 'yn'     ? '"yes" or "no"'
                     : q.type === 'single' ? `one of: ${(q.options||[]).map(o=>`"${o}"`).join(', ')}`
                     : q.type === 'multi'  ? `array of: ${(q.options||[]).map(o=>`"${o}"`).join(', ')}`
                     : 'string';
      return `      "${q.id}": { "value": <${typeHint}>, "confidence": 0-100 }`;
    }).join(',\n');
    androidSchema = `
  "android": {
    "answers": {
${qLines}
    }
  }`;
  }

  // ── Steam schema ─────────────────────────────────────────────────────────────
  let steamSchema = '';
  if (activePids.includes('steam')) {
    const allItems  = STEAM_CONTENT_CATEGORIES.flatMap(g => g.items.map(i => `      "${i.id}": { "value": "yes|no", "confidence": 0-100 }`));
    const matureIds = ['gen_mature','freq_violence','some_nudity','freq_nudity','adult_sexual']
      .map(id => `      "${id}": { "value": "yes|no", "confidence": 0-100 }`);
    steamSchema = `
  "steam": {
    "items": {
${allItems.join(',\n')}
    },
    "mature": {
${matureIds.join(',\n')}
    }
  }`;
  }

  const schemaSections = [iosSchema, androidSchema, steamSchema].filter(Boolean).join(',\n');

  return `You are an expert game content analyst pre-filling platform questionnaires for a game submission tool.

${ctx}

Using ALL of the above information, fill out the content questionnaires for the active platforms: ${activePids.join(', ')}.

CROSS-PLATFORM INFERENCE RULES — when iOS answers are present, use them as direct evidence for equivalent Android/Steam fields:
- iOS "Realistic Violence: none"       → Steam rv_blood=no, rv_killing=no, rv_minorities=no (confidence ≥90); Android violence questions: no
- iOS "Realistic Violence: infrequent" → Steam rv_blood=yes (confidence ≥85)
- iOS "Realistic Violence: frequent"   → Steam rv_blood=yes, rv_killing=yes (confidence ≥85)
- iOS "Cartoon or Fantasy Violence: none" → Steam fmv_cartoon=no, fmv_fights=no (confidence ≥90)
- iOS "Cartoon or Fantasy Violence: infrequent|frequent" → Steam fmv_cartoon=yes (confidence ≥85)
- iOS "Extended Graphic Violence: infrequent|frequent" → Steam hiv_extreme=yes, hiv_gratuitous=yes (confidence ≥85)
- iOS "Profanity: none" → Steam lang_mild=no, lang_moderate=no (confidence ≥90)
- iOS "Profanity: infrequent" → Steam lang_mild=yes (confidence ≥85); iOS "Profanity: frequent" → Steam lang_moderate=yes (confidence ≥85)
- iOS "Horror/Fear Themes: none" → Steam hor_bleak=no, hor_frightening=no (confidence ≥90)
- iOS "Horror/Fear Themes: infrequent|frequent" → Steam hor_bleak=yes (confidence ≥85)
- iOS "Alcohol/Drugs: infrequent|frequent" → Steam drug_legal=yes (confidence ≥85)
- iOS "Sexual Content: infrequent" → Steam sex_nonexplicit=yes (confidence ≥85)
- iOS "Simulated Gambling: infrequent|frequent" → Steam gamb_interaction=yes, gamb_refs=yes (confidence ≥85)
- iOS "hasIAP: yes" OR onboarding "In-app purchases: yes" → Steam int_purchases=yes (confidence ≥95); Android in-app-purchase questions: yes
- iOS "messagingChat: yes" → Steam int_chat=yes (confidence ≥90)

iOS INFERENCE GUIDELINES:
- Nearly all networked mobile games use HTTPS → usesEncryption: "yes" (confidence 95), encryptionExempt: "yes" (confidence 90)
- Default intensity to "none" and yn to "no" for content not confirmed
- "infrequent" = present but not central; "frequent" = a primary element
- ageCategory "not_applicable" for most games; "made_for_kids" only if explicitly child-targeted
- business.iapTypes: array from [consumable, non-consumable, auto-renewable, non-renewing]

ANDROID/STEAM CONFIDENCE THRESHOLDS:
- Answer Android questions when confidence >= 80
- Answer Steam questions when confidence >= 65 (cross-platform evidence lowers uncertainty)
- Include empty arrays [] for Android multi-select when no options apply

Return ONLY a valid JSON object — no markdown fences, no explanation:
{
${schemaSections}
}`;
}

/* ── Single unified API call for all questionnaire platforms ─── */

async function inferAllQuestionnaires() {
  if (!CLAUDE_API_KEY) throw new Error('NO_KEY');
  const activePids = [...state.activePlatforms].filter(p => ['ios','android','steam'].includes(p));
  if (!activePids.length) return;

  // Clear stale AI-inferred meta (preserve human-confirmed answers)
  state.iosAnswerMeta   = Object.fromEntries(Object.entries(state.iosAnswerMeta).filter(([,v])   => v.humanConfirmed));
  state.cqAnswerMeta    = Object.fromEntries(Object.entries(state.cqAnswerMeta).filter(([,v])    => v.humanConfirmed));
  state.steamAnswerMeta = Object.fromEntries(Object.entries(state.steamAnswerMeta).filter(([,v]) => v.humanConfirmed));

  const prompt     = buildUnifiedInferencePrompt();
  const scrshots   = _buildScreenshotContent();

  // Store full prompt for "See Prompt" debug button
  state.lastInferencePrompt = (scrshots.length
    ? `[${scrshots.length} screenshot(s) included in API call]\n\n`
    : '') + prompt;

  const content = [...scrshots, { type: 'text', text: prompt }];

  console.log('[Unified] Calling Claude for platforms:', activePids.join(', '));
  const res = await fetch(CLAUDE_ENDPOINT, {
    method: 'POST',
    headers: {
      'x-api-key':                                 CLAUDE_API_KEY,
      'anthropic-version':                         '2023-06-01',
      'content-type':                              'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model:      CLAUDE_MODEL,
      max_tokens: 8000,
      messages:   [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    let rawBody = {};
    try { rawBody = await res.json(); } catch (_) {}
    console.error('[Unified] HTTP', res.status, JSON.stringify(rawBody, null, 2));
    const raw = rawBody.error?.message || '';
    let msg = `Request failed (${res.status})`;
    if (res.status === 429) msg = 'Rate limit reached — please retry in a moment.';
    else if (res.status === 401) msg = 'API key rejected — check the key is valid.';
    else if (res.status === 500 || res.status === 529) msg = 'Claude is temporarily overloaded — please retry.';
    else msg = raw || msg;
    throw new Error(msg);
  }

  const apiData = await res.json();
  console.log('[Unified] Success — tokens:', apiData.usage?.input_tokens, '+', apiData.usage?.output_tokens);

  const text    = apiData.content?.[0]?.text;
  if (!text) throw new Error('Empty response from Claude');

  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const parsed  = JSON.parse(cleaned);

  // Apply iOS results
  if (activePids.includes('ios') && parsed.ios) {
    applyClaudeResults(parsed.ios);
    state.claudeCache = { result: parsed.ios }; // backward compat
  }

  // Apply Android results
  if (activePids.includes('android') && parsed.android?.answers) {
    applyCQResults(parsed.android.answers);
  }

  // Apply Steam results
  if (activePids.includes('steam') && parsed.steam) {
    applySteamResults(parsed.steam);
  }
}

/* ── Public dispatcher ───────────────────────────────────────── */

async function runInference(pid, stepId) {
  if (!CLAUDE_API_KEY) throw new Error('NO_KEY');

  // Questionnaire: one unified call answers all active platforms
  if (stepId === 'questionnaire') {
    const uKey = 'unified:questionnaire';
    if (state.platformInferenceCache[uKey]) return; // already ran
    await inferAllQuestionnaires();
    state.platformInferenceCache[uKey] = true;
    return;
  }

  // Legacy per-platform steps (contentRating etc.)
  const key = pid + ':' + stepId;
  if (state.platformInferenceCache[key]) return;
  if (pid === 'android') await inferAndroidCR();
  else if (pid === 'steam') await inferSteamCR();
  state.platformInferenceCache[key] = true;
}
