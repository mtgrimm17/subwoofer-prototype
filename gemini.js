/* ============================================================
   GEMINI — AI-powered questionnaire auto-fill
   ============================================================ */

const GEMINI_API_KEY  = 'AIzaSyCvFKPwJcPMeZqnPZPajgHIiVUTHD0OTl0';
const GEMINI_BASE     = 'https://generativelanguage.googleapis.com/v1beta/models';

// Tried in order — first one that responds successfully wins
const GEMINI_MODELS = [
  'gemini-2.5-flash-preview-05-20',
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash-latest',
];

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

Return ONLY valid JSON. No markdown, no explanation outside the JSON. Use exactly these value constraints:
- Intensity fields: "none", "infrequent", or "frequent"
- Boolean fields: "yes" or "no"

SCHEMA (fill in every field — no nulls):
{
  "intensityQuestions": {
    "profanity":          "none|infrequent|frequent",
    "horrorFear":         "none|infrequent|frequent",
    "substancesAlcohol":  "none|infrequent|frequent",
    "medicalTreatment":   "none|infrequent|frequent",
    "matureSuggestive":   "none|infrequent|frequent",
    "sexualContent":      "none|infrequent|frequent",
    "graphicSexual":      "none|infrequent|frequent",
    "cartoonViolence":    "none|infrequent|frequent",
    "realisticViolence":  "none|infrequent|frequent",
    "extendedViolence":   "none|infrequent|frequent",
    "gunsWeapons":        "none|infrequent|frequent",
    "simulatedGambling":  "none|infrequent|frequent",
    "contests":           "none|infrequent|frequent"
  },
  "ynQuestions": {
    "parentalControls":     "yes|no",
    "ageAssurance":         "yes|no",
    "unrestrictedInternet": "yes|no",
    "userGenContent":       "yes|no",
    "messagingChat":        "yes|no",
    "advertising":          "yes|no",
    "healthWellness":       "yes|no",
    "realMoneyGambling":    "yes|no",
    "lootBoxes":            "yes|no"
  },
  "privacy": {
    "collectsData": "yes|no",
    "dataTypes": [
      { "id": "crash", "purposes": ["analytics","app_function"], "identity": "no", "tracking": "no" }
    ]
  },
  "business": {
    "hasIAP": "yes|no",
    "iapTypes": []
  },
  "exportCompliance": {
    "usesEncryption":  "yes|no",
    "encryptionExempt": "yes|no"
  },
  "ageCategory": "not_applicable|made_for_kids|override_higher",
  "confidence": "low|medium|high",
  "reasoning": "2-3 sentence explanation of your key inferences"
}

VALID IDs — only use these exact strings:
privacy.dataTypes[].id: name, email, phone, address, other_contact, health, fitness, payment_info, credit_info, other_financial, precise_loc, coarse_loc, sensitive, contacts, messages, photos_videos, audio, gameplay, customer_support, other_uc, browsing, search, user_id, device_id, purchases, product_use, ad_data, other_usage, crash, performance, other_diag, env_scan, hands, head, other

privacy.dataTypes[].purposes (array): first_party_ads, third_party_ads, analytics, personalization, app_function, other_purpose

business.iapTypes (array): consumable, non-consumable, auto-renewable, non-renewing

ageCategory: "not_applicable" for most games; "made_for_kids" only if explicitly designed for children under 13; "override_higher" only if a manual rating bump is needed.

INFERENCE GUIDELINES:
- Nearly all networked mobile games use HTTPS → usesEncryption: "yes", encryptionExempt: "yes" (standard TLS is exempt)
- Most games collect crash and performance data → include crash + performance in dataTypes with purposes: ["analytics","app_function"]
- Games with accounts/login → add user_id
- Games with analytics SDKs → add product_use with purposes: ["analytics"]
- Be conservative: default to "no" / "none" for content you cannot confirm from the description or screenshots
- "infrequent" = present but not central; "frequent" = a primary element of the game experience`;
}

/* ── API call ─────────────────────────────────────────────── */

async function analyzeGameWithGemini(modelIndex = 0) {
  if (modelIndex >= GEMINI_MODELS.length) {
    throw new Error('All models unavailable right now — please retry in a minute.');
  }

  const model = GEMINI_MODELS[modelIndex];
  const ups   = state.uploads;
  console.log('[Gemini] Trying model:', model);

  // Build content parts: text prompt + up to 3 screenshots
  const parts = [{ text: buildGeminiPrompt() }];
  const screenshots = (ups.screenshots || []).slice(0, 3);
  for (const sc of screenshots) {
    if (sc.dataUrl && sc.dataUrl.includes(',')) {
      const [meta, data] = sc.dataUrl.split(',');
      const mimeType = meta.split(':')[1]?.split(';')[0] || 'image/png';
      parts.push({ inline_data: { mime_type: mimeType, data } });
    }
  }

  const url = `${GEMINI_BASE}/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.1,
      },
    }),
  });

  if (!res.ok) {
    let rawBody = {};
    try { rawBody = await res.json(); } catch (_) {}
    console.warn(`[Gemini] ${model} → HTTP ${res.status}`, rawBody.error?.message || '');

    // Overloaded or rate-limited → try next model after a brief pause
    const tryNext = res.status === 503 || res.status === 529 || res.status === 429;
    // Deprecated/not-found → try next model immediately
    const tryNextNow = res.status === 404;

    if (tryNext) {
      await new Promise(r => setTimeout(r, 2000));
      return analyzeGameWithGemini(modelIndex + 1);
    }
    if (tryNextNow) {
      return analyzeGameWithGemini(modelIndex + 1);
    }

    // Hard errors — surface immediately
    const raw = rawBody.error?.message || '';
    let msg = `Request failed (${res.status})`;
    if (res.status === 403) msg = `Auth error — check API key is valid.`;
    else if (res.status === 400) msg = `Bad request: ${raw}`;
    else msg = raw || msg;
    throw new Error(msg);
  }

  const data = await res.json();
  console.log('[Gemini] Success with', model, '— tokens used:', data.usageMetadata?.totalTokenCount);

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');

  return JSON.parse(text);
}

/* ── Apply results to state ───────────────────────────────── */

function applyGeminiResults(result) {
  const a = state.iosSubmitAnswers;
  let filled = 0;

  // Intensity questions (none / infrequent / frequent)
  if (result.intensityQuestions) {
    IOS_INTENSITY_QUESTIONS.forEach(q => {
      const val = result.intensityQuestions[q.id];
      if (['none', 'infrequent', 'frequent'].includes(val)) {
        a[q.id] = val;
        filled++;
      }
    });
  }

  // Boolean content questions (yes / no)
  if (result.ynQuestions) {
    IOS_CONTENT_YN_QUESTIONS.forEach(q => {
      const val = result.ynQuestions[q.id];
      if (val === 'yes' || val === 'no') {
        a[q.id] = val;
        filled++;
      }
    });
  }

  // Privacy
  if (result.privacy) {
    const cd = result.privacy.collectsData;
    if (cd === 'yes' || cd === 'no') { a.collectsData = cd; filled++; }

    if (cd === 'yes' && Array.isArray(result.privacy.dataTypes)) {
      result.privacy.dataTypes.forEach(dt => {
        if (!IOS_DATA_TYPE_LOOKUP[dt.id]) return; // guard unknown ids
        const validPurposes = (dt.purposes || []).filter(p => IOS_PURPOSES.some(ip => ip.id === p));
        const identity = (dt.identity === 'yes' || dt.identity === 'no') ? dt.identity : 'no';
        const tracking = (dt.tracking === 'yes' || dt.tracking === 'no') ? dt.tracking : 'no';
        a.dataPerType[dt.id] = { purposes: validPurposes, identity, tracking };
        filled++;
      });
    }
  }

  // Business
  if (result.business) {
    const hi = result.business.hasIAP;
    if (hi === 'yes' || hi === 'no') { a.hasIAP = hi; filled++; }
    if (Array.isArray(result.business.iapTypes)) {
      const valid = ['consumable', 'non-consumable', 'auto-renewable', 'non-renewing'];
      a.iapTypes = result.business.iapTypes.filter(t => valid.includes(t));
    }
  }

  // Export compliance
  if (result.exportCompliance) {
    const ue = result.exportCompliance.usesEncryption;
    const ee = result.exportCompliance.encryptionExempt;
    if (ue === 'yes' || ue === 'no') { a.usesEncryption = ue; filled++; }
    if (ee === 'yes' || ee === 'no') { a.encryptionExempt = ee; filled++; }
  }

  // Age category
  const validAgeCategories = ['not_applicable', 'made_for_kids', 'override_higher'];
  if (validAgeCategories.includes(result.ageCategory)) {
    a.ageCategory = result.ageCategory;
    filled++;
  }

  return {
    filled,
    confidence: result.confidence || 'medium',
    reasoning:  result.reasoning  || '',
  };
}
