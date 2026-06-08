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
   GAME SEARCH — find existing listing by title
   Chain: iTunes App Store → Steam → Claude knowledge fallback
══════════════════════════════════════════════════════════════ */

/* ── Shared helpers ─────────────────────────────────────────── */

function _fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const id   = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(id));
}

function _normTitle(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function _titleScore(query, candidate) {
  const q = _normTitle(query);
  const c = _normTitle(candidate);
  if (!c || !q) return 0;
  if (c === q)                               return 100;
  if (c.startsWith(q) || q.startsWith(c))   return 85;
  if (c.includes(q)   || q.includes(c))     return 70;
  return 0;
}

function _bestMatch(query, items, getName) {
  let best = null, bestScore = 0;
  for (const item of items) {
    const score = _titleScore(query, getName(item));
    if (score > bestScore) { bestScore = score; best = item; }
  }
  return bestScore >= 70 ? { item: best, score: bestScore } : null;
}

function _stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function _trimDesc(text, maxLen) {
  maxLen = maxLen || 600;
  const clean = _stripHtml(text);
  if (!clean) return '';
  if (clean.length <= maxLen) return clean;
  const cut     = clean.substring(0, maxLen);
  const lastDot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return lastDot > maxLen * 0.6 ? cut.substring(0, lastDot + 1) : cut + '…';
}

/* ── Source 1: iTunes App Store (CORS-friendly, no key needed) ── */

async function _searchITunes(title) {
  console.log('[Search] Trying iTunes App Store...');
  const url = 'https://itunes.apple.com/search?term=' + encodeURIComponent(title)
            + '&entity=software&media=software&limit=10&country=us';
  const res = await _fetchWithTimeout(url, 7000);
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data.results) || !data.results.length) return null;

  // Prefer results in the Games category
  const games = data.results.filter(r =>
    r.primaryGenreName && r.primaryGenreName.toLowerCase().includes('game'));
  const pool  = games.length ? games : data.results;

  const match = _bestMatch(title, pool, r => r.trackName);
  if (!match) return null;

  const r    = match.item;
  const desc = _trimDesc(r.description || r.longDescription || '');
  if (!desc) return null;

  console.log('[Search] iTunes hit:', r.trackName, '(score', match.score + ')');
  return {
    found:       true,
    title:       r.trackName,
    description: desc,
    source:      'iOS App Store',
    allStores:   ['iOS App Store'],
    confidence:  match.score,
  };
}

/* ── Source 2: Steam Store API (via CORS proxy) ─────────────── */
// Steam's API blocks direct browser requests from github.io (no CORS headers).
// Routing through corsproxy.io resolves this with no other changes required.

const CORS_PROXY = 'https://corsproxy.io/?';

async function _searchSteam(title) {
  console.log('[Search] Trying Steam (via CORS proxy)...');

  // Step 1: search by name
  const searchUrl = CORS_PROXY + encodeURIComponent(
    'https://store.steampowered.com/api/storesearch/?term='
    + encodeURIComponent(title) + '&l=english&cc=US'
  );
  const searchRes  = await _fetchWithTimeout(searchUrl, 10000);
  if (!searchRes.ok) return null;
  const searchData = await searchRes.json();
  if (!Array.isArray(searchData.items) || !searchData.items.length) return null;

  const match = _bestMatch(title, searchData.items, i => i.name);
  if (!match) return null;
  console.log('[Search] Steam search hit:', match.item.name, 'id:', match.item.id);

  // Step 2: fetch app details for description
  const detailUrl  = CORS_PROXY + encodeURIComponent(
    'https://store.steampowered.com/api/appdetails?appids='
    + match.item.id + '&l=english'
  );
  const detailRes  = await _fetchWithTimeout(detailUrl, 10000);
  if (!detailRes.ok) return null;
  const detailData = await detailRes.json();
  const appData    = detailData[match.item.id] && detailData[match.item.id].data;
  if (!appData) return null;

  const desc = _trimDesc(appData.short_description || appData.about_the_game || '');
  if (!desc) return null;

  console.log('[Search] Steam detail hit:', appData.name);
  return {
    found:       true,
    title:       appData.name,
    description: desc,
    source:      'Steam',
    allStores:   ['Steam'],
    confidence:  match.score,
  };
}

/* ── Source 3: Claude knowledge fallback ─────────────────────── */

async function _searchClaudeKnowledge(title) {
  // Gracefully degrade when no API key — don't throw, just return not found
  if (!CLAUDE_API_KEY) {
    console.warn('[Search] No Claude API key — skipping knowledge fallback.');
    return { found: false, title: null, description: null, source: null, allStores: [], confidence: 0 };
  }

  console.log('[Search] Falling back to Claude knowledge...');

  const prompt = `You are a game store database expert with knowledge of published game listings. Search your knowledge for a game titled: "${title}"

Return ONLY a valid JSON object — no markdown fences, no explanation.

If you find this game:
{
  "found": true,
  "title": "<exact store title>",
  "description": "<3-5 sentences suitable for a store submission form>",
  "source": "<human-readable store name, e.g. 'PlayStation Store'>",
  "allStores": ["<platform IDs>"],
  "confidence": <0-100>
}

CRITICAL: In the allStores array, use ONLY these exact platform ID strings (lowercase):
  "ios"       → Apple App Store / iOS
  "android"   → Google Play Store
  "steam"     → Steam (PC/Mac)
  "nintendo"  → Nintendo Switch eShop
  "psn"       → PlayStation Store (PS4/PS5)
  "xbox"      → Xbox / Microsoft Store
  "egs"       → Epic Games Store

Example: a game on Switch and PlayStation would be: "allStores": ["nintendo", "psn"]

If not found or uncertain:
{
  "found": false,
  "title": null,
  "description": null,
  "source": null,
  "allStores": [],
  "confidence": 0
}

Rules:
- Return found:true if confidence ≥ 60.
- In allStores, include EVERY platform you know this game is on — be inclusive, not conservative.
- Steam games are frequently missed by other APIs, so if you know the game is on Steam, always include "steam".
- Do NOT fabricate descriptions — use only what you know from published store listings.`;

  const res = await fetch(CLAUDE_ENDPOINT, {
    method:  'POST',
    headers: {
      'x-api-key':                                 CLAUDE_API_KEY,
      'anthropic-version':                         '2023-06-01',
      'content-type':                              'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model:      CLAUDE_MODEL,
      max_tokens: 600,
      messages:   [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    }),
  });

  if (!res.ok) {
    let rawBody = {};
    try { rawBody = await res.json(); } catch (_) {}
    const raw = rawBody.error?.message || '';
    let msg = 'Request failed (' + res.status + ')';
    if (res.status === 429) msg = 'Rate limit reached — please retry in a moment.';
    else if (res.status === 401) msg = 'API key rejected.';
    else msg = raw || msg;
    throw new Error(msg);
  }

  const apiData = await res.json();
  const text    = apiData.content && apiData.content[0] && apiData.content[0].text;
  if (!text) throw new Error('Empty response');

  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(cleaned);
}

/* ── Orchestrator ────────────────────────────────────────────── */

// Canonical ID lookup shared between searchGameByTitle and confirmGameImport
const STORE_NAME_TO_PID = {
  'ios': 'ios', 'app store': 'ios', 'apple app store': 'ios', 'itunes': 'ios',
  'android': 'android', 'google play': 'android', 'google play store': 'android',
  'steam': 'steam',
  'nintendo': 'nintendo', 'nintendo switch': 'nintendo', 'nintendo eshop': 'nintendo',
  'nintendo switch eshop': 'nintendo', 'eshop': 'nintendo',
  'psn': 'psn', 'playstation': 'psn', 'playstation store': 'psn',
  'ps4': 'psn', 'ps5': 'psn', 'playstation 4': 'psn', 'playstation 5': 'psn',
  'xbox': 'xbox', 'xbox one': 'xbox', 'xbox series x': 'xbox', 'microsoft store': 'xbox',
  'egs': 'egs', 'epic': 'egs', 'epic games': 'egs', 'epic games store': 'egs',
};

async function searchGameByTitle(title) {
  if (!title || !title.trim()) throw new Error('NO_TITLE');
  const t = title.trim();

  // Run all three sources in parallel — Claude knowledge fills store gaps iTunes/Steam can't cover
  const [itunesSettled, steamSettled, claudeSettled] = await Promise.allSettled([
    _searchITunes(t),
    _searchSteam(t),
    _searchClaudeKnowledge(t),
  ]);

  if (itunesSettled.status === 'rejected') console.warn('[Search] iTunes failed:', itunesSettled.reason?.message);
  if (steamSettled.status  === 'rejected') console.warn('[Search] Steam failed:',  steamSettled.reason?.message);
  if (claudeSettled.status === 'rejected') console.warn('[Search] Claude failed:', claudeSettled.reason?.message);

  const itunes = itunesSettled.status === 'fulfilled' ? itunesSettled.value : null;
  const steam  = steamSettled.status  === 'fulfilled' ? steamSettled.value  : null;
  const claude = claudeSettled.status === 'fulfilled' ? claudeSettled.value : null;

  // Merge all platform IDs from every source
  const storeSet = new Set();
  if (itunes?.found) storeSet.add('ios');
  if (steam?.found)  storeSet.add('steam');
  if (claude?.found && Array.isArray(claude.allStores)) {
    claude.allStores.forEach(s => {
      const pid = STORE_NAME_TO_PID[(s || '').toLowerCase().trim()] || s;
      if (pid) storeSet.add(pid);
    });
  }

  const allStores = [...storeSet];

  // Nothing found anywhere
  if (!itunes?.found && !steam?.found && !claude?.found) {
    return { found: false, title: null, description: null, source: null, allStores: [], confidence: 0 };
  }

  // Prefer real store description (Steam > iTunes) over Claude knowledge
  const primary = steam?.found ? steam : itunes?.found ? itunes : claude;

  const sourceLabels = [];
  if (itunes?.found) sourceLabels.push('iOS App Store');
  if (steam?.found)  sourceLabels.push('Steam');
  if (claude?.found && !itunes?.found && !steam?.found) sourceLabels.push(claude.source || 'Claude Knowledge');

  return {
    found:       true,
    title:       primary.title,
    description: primary.description,
    source:      sourceLabels.join(' & ') || 'Store',
    allStores,
    confidence:  primary.confidence,
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
