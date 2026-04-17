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

/* SVG paths are viewBox="0 0 24 24" from simple-icons / MDI */
const PLATFORM_ICONS = {
  ios:       'M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11',
  android:   'M3.18 23.76c.35.2.8.19 1.22-.05l13.32-7.73-3.37-3.47zM.3 1.05C.1 1.39 0 1.8 0 2.24v19.53c0 .44.1.85.3 1.19l.07.07 10.94-10.94v-.26L.37.98zm22.44 9.47l-3.01-1.75-3.71 3.71 3.72 3.72 3.02-1.76c.86-.5.86-1.32-.02-1.92zM4.4.29L17.72 8.02l-3.37 3.47L4.4.29z',
  steam:     'M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.029 4.524 4.524s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.663 0-3.015 1.353-3.015 3.015 0 1.663 1.352 3.015 3.015 3.015 1.663 0 3.015-1.352 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z',
  egs:       'M11.407 0C5.045 0 0 5.044 0 11.406c0 6.364 5.045 11.408 11.407 11.408 6.363 0 11.407-5.044 11.407-11.408C22.814 5.044 17.77 0 11.407 0zm4.02 16.408H8.105v-1.906h5.358v-2.196H8.105V9.51h5.358V7.405H8.105V5.5h7.322v10.908z',
  psn:       'M8.985.001C7.078.001 5.108.344 5.108.344l-.003 17.717 4.388 1.151V4.645s2.038-.481 3.217.16c1.178.641 1.344 2.224 1.344 2.224v5.385s-.2 2.617-2.806 3.146c-2.606.528-3.2.238-3.2.238v1.71l5.606 1.483.002.001c2.05-.53 4.944-2.094 4.944-5.985V7.38C18.6 3.14 14.8.032 8.985.001zM3.048 19.02L.002 17.98l.003-16.94 3.045.945v17.035zm16.956-2.024l-5.75 2.01v-2.01l5.75-2.008v2.008z',
  xbox:      'M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zM7.272 5.663l4.714 5.065-4.638 5.266L3.6 12c0-2.729 1.547-5.115 3.672-6.337zm9.456 0C18.853 6.885 20.4 9.271 20.4 12l-3.748 3.994-4.638-5.266 4.714-5.065zM12 6.745l4.812 5.498-4.812 5.44-4.812-5.44L12 6.745zm0 11.726l-3.239-3.669.036-.022H12l3.203 3.691L12 18.471z',
  nintendo:  'M7.979 0C3.572 0 0 3.572 0 7.979v8.042C0 20.428 3.572 24 7.979 24h8.042C20.428 24 24 20.428 24 16.021V7.979C24 3.572 20.428 0 16.021 0H7.979zm-.47 4.75h2.16l5.21 8.093V4.75h2.592v14.5h-2.133l-5.237-8.118v8.118H7.509V4.75z',
};

/* Coming Soon platforms — displayed grayed out, unselectable */
const COMING_SOON_PLATFORMS = [
  { id: 'psn',      label: 'PlayStation Store' },
  { id: 'xbox',     label: 'Xbox Store' },
  { id: 'nintendo', label: 'Nintendo eShop' },
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
  { id: 'provideInfo',  label: 'Game Details', screen: 'provide-info', desc: 'Title, description, platforms, links' },
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
