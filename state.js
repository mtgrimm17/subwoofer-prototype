/* ============================================================
   STATE — single source of truth
   ============================================================ */

/* ── Key Questions ───────────────────────────────────── */

const QUESTIONS = [
  {
    id: 'violence',
    label: 'Does your game contain violence or combat?',
    desc: 'Includes fighting, weapons, blood, or characters being harmed.',
    keywords: ['fight', 'combat', 'shoot', 'war', 'battle', 'gun', 'weapon', 'blood', 'kill',
               'death', 'violent', 'violence', 'sword', 'attack', 'enemy', 'enemies', 'shooter',
               'fps', 'rpg', 'arena', 'warrior', 'soldier'],
  },
  {
    id: 'sexualContent',
    label: 'Does your game contain sexual or mature content?',
    desc: 'Includes nudity, sexual themes, or suggestive material.',
    keywords: ['adult', 'sexual', 'nude', 'nudity', 'erotic', 'mature content', '18+'],
  },
  {
    id: 'strongLanguage',
    label: 'Does your game contain strong language?',
    desc: 'Includes profanity, slurs, or offensive language in dialogue, text, or audio.',
    keywords: ['profanity', 'crude language', 'explicit language', 'strong language', 'adult language'],
  },
  {
    id: 'dataCollection',
    label: 'Does your game collect data from users?',
    desc: 'Includes accounts, analytics, gameplay data, device info, or third-party SDKs.',
    keywords: ['account', 'sign in', 'sign up', 'login', 'analytics', 'leaderboard',
               'online multiplayer', 'multiplayer', 'social', 'cloud save', 'achievements'],
  },
  {
    id: 'inAppPurchases',
    label: 'Does your game include in-app purchases?',
    desc: 'Includes upgrades, cosmetics, subscriptions, or virtual currency.',
    keywords: ['purchase', 'buy', 'shop', 'store', 'premium', 'subscription', 'dlc', 'paid',
               'currency', 'coins', 'gems', 'credits', 'unlock', 'upgrade', 'microtransaction'],
  },
];

const PLATFORMS = {
  ios: {
    id: 'ios', label: 'iOS App Store', abbr: 'iOS', color: '#007AFF',
    steps: [
      { id: 'reviewMetadata',     label: 'Review Metadata' },
      { id: 'confirmScreenshots', label: 'Confirm Screenshots' },
      { id: 'exportCompliance',   label: 'Export Compliance' },
      { id: 'releaseType',        label: 'Select Release Type' },
      { id: 'storePreview',       label: 'Store Page Preview' },
      { id: 'submit',             label: 'Submit to App Store',  isSubmit: true },
    ],
  },
  android: {
    id: 'android', label: 'Google Play', abbr: 'GP', color: '#34A853',
    steps: [
      { id: 'reviewMetadata',     label: 'Review Metadata' },
      { id: 'confirmScreenshots', label: 'Confirm Screenshots & Feature Graphic' },
      { id: 'dataSafety',         label: 'Data Safety' },
      { id: 'releaseTrack',       label: 'Release Track' },
      { id: 'storePreview',       label: 'Store Page Preview' },
      { id: 'submit',             label: 'Submit to Google Play', isSubmit: true },
    ],
  },
  steam: {
    id: 'steam', label: 'Steam', abbr: 'ST', color: '#4c6b8a',
    steps: [
      { id: 'reviewStorePage',    label: 'Review Store Page' },
      { id: 'confirmMedia',       label: 'Confirm Media & Capsule Art' },
      { id: 'systemRequirements', label: 'System Requirements' },
      { id: 'releaseSettings',    label: 'Release Settings' },
      { id: 'storePreview',       label: 'Store Page Preview' },
      { id: 'submit',             label: 'Submit for Review',     isSubmit: true },
    ],
  },
  egs: {
    id: 'egs', label: 'Epic Games Store', abbr: 'EGS', color: '#2d2d2d',
    steps: [
      { id: 'reviewStoreListing', label: 'Review Store Listing' },
      { id: 'confirmMedia',       label: 'Confirm Media & Key Art' },
      { id: 'ratings',            label: 'Ratings (IARC)' },
      { id: 'releaseSettings',    label: 'Release Settings' },
      { id: 'storePreview',       label: 'Store Page Preview' },
      { id: 'submit',             label: 'Submit',                isSubmit: true },
    ],
  },
};

const GLOBAL_STEPS = [
  { id: 'provideInfo',  label: 'Provide Information', screen: 'provide-info', desc: 'Title, description, platforms, links' },
  { id: 'uploadAssets', label: 'Upload Assets',        screen: 'upload-assets', desc: 'Screenshots and video' },
  { id: 'keyQuestions', label: 'Answer Key Questions', screen: 'key-questions', desc: 'Up to 5 adaptive questions' },
  { id: 'pcDetails',    label: 'PC Details',           screen: 'pc-details',    desc: 'System requirements', pcOnly: true },
];

function makeEmptyPlatformSteps() {
  const out = {};
  for (const [pid, p] of Object.entries(PLATFORMS)) {
    out[pid] = {};
    for (const s of p.steps) out[pid][s.id] = 'not_started';
  }
  return out;
}

const state = {
  currentScreen: 'home',

  // Platforms selected in Provide Information — drive both sidebar and dashboard
  selectedPlatforms: new Set(),

  // Which platform is expanded in the sidebar sub-list
  expandedPlatforms: new Set(),

  // Which task is currently open in the drawer: { platformId, stepId } | null
  activeTask: null,

  globalStepStatus: {
    provideInfo:  'not_started',
    uploadAssets: 'not_started',
    keyQuestions: 'not_started',
    pcDetails:    'not_started',
  },

  platformStepStatus: makeEmptyPlatformSteps(),

  formData: {
    title:            '',
    description:      '',
    price:            '',
    supportUrl:       '',
    privacyUrl:       '',
    primaryLanguage:  'en',
    localized:        false,
    localizations:    [],
    releaseTiming:    'as_approved',
    releaseDate:      '',
    privacyGenerated: false,
    trailerUrl:       '',
  },

  uploads: {
    screenshots:    [],      // [{ id, name, dataUrl }]
    featureGraphic: null,    // { name, dataUrl }
    trailer:        null,    // { name, size }
  },

  // null = unanswered, 'yes' | 'no' = answered
  questionAnswers: {
    violence:        null,
    sexualContent:   null,
    strongLanguage:  null,
    dataCollection:  null,
    inAppPurchases:  null,
  },

  // true = answer was set by inference; false = user-set
  questionInferred: {
    violence:        false,
    sexualContent:   false,
    strongLanguage:  false,
    dataCollection:  false,
    inAppPurchases:  false,
  },
};

/* ── Helpers ─────────────────────────────────────────── */

function platformStepCount(platformId) {
  const p            = PLATFORMS[platformId];
  const required     = p.steps.filter(s => !s.isSubmit);
  const statuses     = state.platformStepStatus[platformId];
  const complete     = required.filter(s => statuses[s.id] === 'complete').length;
  const submitDone   = statuses['submit'] === 'complete';
  return {
    total:      required.length,
    complete,
    submitDone,
    allRequired: complete === required.length,
  };
}

function hasPcPlatform() {
  return state.selectedPlatforms.has('steam') || state.selectedPlatforms.has('egs');
}

function visibleGlobalSteps() {
  return GLOBAL_STEPS.filter(s => !s.pcOnly || hasPcPlatform());
}

// Returns { type: 'global'|'platform', id, screen } for the first incomplete step
function nextStep() {
  for (const step of visibleGlobalSteps()) {
    if (state.globalStepStatus[step.id] !== 'complete') return { type: 'global', ...step };
  }
  for (const pid of state.selectedPlatforms) {
    const p = PLATFORMS[pid];
    for (const step of p.steps) {
      if (state.platformStepStatus[pid][step.id] !== 'complete') {
        return { type: 'platform', platformId: pid, id: step.id, label: step.label, screen: pid };
      }
    }
  }
  return null; // all done
}
