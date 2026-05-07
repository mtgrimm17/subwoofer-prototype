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

  content.push({ type: 'text', text: buildGeminiPrompt() });

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
    if (typeof confidence !== 'number' || confidence < 70) return;
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
