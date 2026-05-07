/* ============================================================
   STATE — single source of truth
   ============================================================ */

/* ── Language → ISO 3166-1 numeric country codes ────── */
// Used by the world map to highlight countries where each language is primary
const LANG_COUNTRY_CODES = {
  // English: official language in English-speaking countries (S. Korea excluded)
  en:  [36, 84, 124, 288, 328, 356, 372, 376, 388, 404, 426, 454, 516, 524, 554,
        566, 694, 706, 710, 716, 800, 826, 834, 840, 894],
  fr:  [56, 108, 120, 140, 178, 180, 204, 250, 262, 266, 324, 384, 442, 450, 466,
        492, 562, 646, 686, 756, 768, 854],
  es:  [32, 68, 152, 170, 188, 192, 214, 218, 222, 320, 484, 558, 591, 600, 604,
        724, 740, 858, 862],
  pt:  [24, 76, 132, 508, 620, 624, 626, 678],
  de:  [40, 276, 438, 442, 756],
  ja:  [392],
  // Chinese: mainland + HK + Macau + Singapore (Taiwan excluded)
  zh:  [156, 344, 446, 702],
  // Korean: South Korea only (N. Korea excluded)
  ko:  [410],
  ru:  [51, 112, 398, 417, 643, 762],
  ar:  [12, 48, 174, 262, 275, 368, 400, 414, 422, 434, 478, 504, 512, 634, 682,
        706, 729, 760, 784, 818, 887],
  it:  [380, 674, 756],
  nl:  [528, 740],
};

/* ── Compliance Questions ────────────────────────────── */

const QUESTIONS = [
  {
    id: 'violence',
    label: 'Does your game contain violence or combat?',
    desc: 'Includes fighting, weapons, blood, or characters being harmed.',
    keywords: ['fight','combat','shoot','war','battle','gun','weapon','blood','kill',
               'death','violent','violence','sword','attack','enemy','enemies','shooter',
               'fps','rpg','arena','warrior','soldier'],
  },
  {
    id: 'sexualContent',
    label: 'Does your game contain sexual or mature content?',
    desc: 'Includes nudity, sexual themes, or suggestive material.',
    keywords: ['adult','sexual','nude','nudity','erotic','mature content','18+'],
  },
  {
    id: 'strongLanguage',
    label: 'Does your game contain strong language?',
    desc: 'Includes profanity, slurs, or offensive language in dialogue, text, or audio.',
    keywords: ['profanity','crude language','explicit language','strong language','adult language'],
  },
  {
    id: 'dataCollection',
    label: 'Does your game collect data from users?',
    desc: 'Includes accounts, analytics, gameplay data, device info, or third-party SDKs.',
    keywords: ['account','sign in','sign up','login','analytics','leaderboard',
               'online multiplayer','multiplayer','social','cloud save','achievements'],
  },
  {
    id: 'inAppPurchases',
    label: 'Does your game include in-app purchases?',
    desc: 'Includes upgrades, cosmetics, subscriptions, or virtual currency.',
    keywords: ['purchase','buy','shop','store','premium','subscription','dlc','paid',
               'currency','coins','gems','credits','unlock','upgrade','microtransaction'],
  },
];

/* ── Platform Icons (SVG paths, viewBox="0 0 24 24") ─── */

const PLATFORM_ICONS = {
  ios:      'M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11',
  android:  'M3.18 23.76c.35.2.8.19 1.22-.05l13.32-7.73-3.37-3.47zM.3 1.05C.1 1.39 0 1.8 0 2.24v19.53c0 .44.1.85.3 1.19l.07.07 10.94-10.94v-.26L.37.98zm22.44 9.47l-3.01-1.75-3.71 3.71 3.72 3.72 3.02-1.76c.86-.5.86-1.32-.02-1.92zM4.4.29L17.72 8.02l-3.37 3.47L4.4.29z',
  steam:    'M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.029 4.524 4.524s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.663 0-3.015 1.353-3.015 3.015 0 1.663 1.352 3.015 3.015 3.015 1.663 0 3.015-1.352 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z',
  egs:      'M0 0v16.021h6.241v2.088H12V24h12V0zm19.017 19.818h-4.776v-4.06H9.225V24H4.449V4.182h4.776v4.06h5.016V4.182h4.776z',
  psn:      'M8.985.001C7.078.001 5.108.344 5.108.344l-.003 17.717 4.388 1.151V4.645s2.038-.481 3.217.16c1.178.641 1.344 2.224 1.344 2.224v5.385s-.2 2.617-2.806 3.146c-2.606.528-3.2.238-3.2.238v1.71l5.606 1.483.002.001c2.05-.53 4.944-2.094 4.944-5.985V7.38C18.6 3.14 14.8.032 8.985.001zM3.048 19.02L.002 17.98l.003-16.94 3.045.945v17.035zm16.956-2.024l-5.75 2.01v-2.01l5.75-2.008v2.008z',
  xbox:     'M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zM7.272 5.663l4.714 5.065-4.638 5.266L3.6 12c0-2.729 1.547-5.115 3.672-6.337zm9.456 0C18.853 6.885 20.4 9.271 20.4 12l-3.748 3.994-4.638-5.266 4.714-5.065zM12 6.745l4.812 5.498-4.812 5.44-4.812-5.44L12 6.745zm0 11.726l-3.239-3.669.036-.022H12l3.203 3.691L12 18.471z',
  nintendo: 'M7.979 0C3.572 0 0 3.572 0 7.979v8.042C0 20.428 3.572 24 7.979 24h8.042C20.428 24 24 20.428 24 16.021V7.979C24 3.572 20.428 0 16.021 0H7.979zm-.47 4.75h2.16l5.21 8.093V4.75h2.592v14.5h-2.133l-5.237-8.118v8.118H7.509V4.75z',
};

/* ── Platforms ───────────────────────────────────────── */

const PLATFORMS = {
  ios: {
    id: 'ios', label: 'iOS App Store', color: '#007AFF',
    steps: [
      { id: 'privacy',       label: 'Data Privacy',      hasInference: false },
      { id: 'contentRating', label: 'Content Rating',    hasInference: true  },
      { id: 'business',      label: 'Business',          hasInference: true  },
      { id: 'distribution',  label: 'Distribution',      hasInference: false },
      { id: 'storePreview',  label: 'Store Page Preview',hasInference: false },
    ],
  },
  android: {
    id: 'android', label: 'Google Play', color: '#34A853',
    steps: [
      { id: 'reviewMetadata',     label: 'Review Metadata' },
      { id: 'confirmScreenshots', label: 'Confirm Screenshots & Feature Graphic' },
      { id: 'dataSafety',         label: 'Data Safety' },
      { id: 'releaseTrack',       label: 'Release Track' },
      { id: 'storePreview',       label: 'Store Page Preview' },
      { id: 'reviewSubmission',   label: 'Review Submission',     isReview: true },
      { id: 'submit',             label: 'Submit to Google Play', isSubmit: true },
    ],
  },
  steam: {
    id: 'steam', label: 'Steam', color: '#4c6b8a',
    steps: [
      { id: 'reviewStorePage',    label: 'Review Store Page' },
      { id: 'confirmMedia',       label: 'Confirm Media & Capsule Art' },
      { id: 'systemRequirements', label: 'System Requirements' },
      { id: 'releaseSettings',    label: 'Release Settings' },
      { id: 'storePreview',       label: 'Store Page Preview' },
      { id: 'reviewSubmission',   label: 'Review Submission',     isReview: true },
      { id: 'submit',             label: 'Submit for Review',     isSubmit: true },
    ],
  },
  egs: {
    id: 'egs', label: 'Epic Games Store', color: '#313131',
    steps: [
      { id: 'reviewStoreListing', label: 'Review Store Listing' },
      { id: 'confirmMedia',       label: 'Confirm Media & Key Art' },
      { id: 'ratings',            label: 'Ratings (IARC)' },
      { id: 'releaseSettings',    label: 'Release Settings' },
      { id: 'storePreview',       label: 'Store Page Preview' },
      { id: 'reviewSubmission',   label: 'Review Submission',     isReview: true },
      { id: 'submit',             label: 'Submit',                isSubmit: true },
    ],
  },
  psn: {
    id: 'psn', label: 'PlayStation Store', color: '#003791',
    steps: [
      { id: 'reviewStoreListing', label: 'Review Store Listing' },
      { id: 'confirmMedia',       label: 'Confirm Media & Key Art' },
      { id: 'ageRatings',         label: 'Age Ratings' },
      { id: 'releaseSettings',    label: 'Release Settings' },
      { id: 'storePreview',       label: 'Store Page Preview' },
      { id: 'reviewSubmission',   label: 'Review Submission',     isReview: true },
      { id: 'submit',             label: 'Submit to PlayStation', isSubmit: true },
    ],
  },
  xbox: {
    id: 'xbox', label: 'Xbox Store', color: '#107C10',
    steps: [
      { id: 'reviewStoreListing', label: 'Review Store Listing' },
      { id: 'confirmMedia',       label: 'Confirm Media' },
      { id: 'ageRatings',         label: 'Age Ratings (IARC)' },
      { id: 'certRequirements',   label: 'Certification Requirements' },
      { id: 'storePreview',       label: 'Store Page Preview' },
      { id: 'reviewSubmission',   label: 'Review Submission',     isReview: true },
      { id: 'submit',             label: 'Submit to Xbox',        isSubmit: true },
    ],
  },
  nintendo: {
    id: 'nintendo', label: 'Nintendo eShop', color: '#E4000F',
    steps: [
      { id: 'reviewStoreListing', label: 'Review Store Listing' },
      { id: 'confirmMedia',       label: 'Confirm Media & Key Art' },
      { id: 'ageRatings',         label: 'Age Ratings' },
      { id: 'releaseSettings',    label: 'Release Settings' },
      { id: 'storePreview',       label: 'Store Page Preview' },
      { id: 'reviewSubmission',   label: 'Review Submission',     isReview: true },
      { id: 'submit',             label: 'Submit to Nintendo',    isSubmit: true },
    ],
  },
};

/* ── Helpers ─────────────────────────────────────────── */

function makeEmptyPlatformSteps() {
  const out = {};
  for (const [pid, p] of Object.entries(PLATFORMS)) {
    out[pid] = {};
    for (const s of p.steps) out[pid][s.id] = 'not_started';
  }
  return out;
}

function platformStepCount(platformId) {
  const p = PLATFORMS[platformId];
  // iOS: completion is computed from submission answers, not manual task status
  if (platformId === 'ios') {
    const complete = p.steps.filter(s => isIOSSectionComplete(s.id)).length;
    return { total: p.steps.length, complete, submitDone: false, allRequired: complete === p.steps.length };
  }
  const required = p.steps.filter(s => !s.isSubmit);
  const statuses = state.platformStepStatus[platformId];
  const complete = required.filter(s => statuses[s.id] === 'complete').length;
  return {
    total:      required.length,
    complete,
    submitDone: statuses['submit'] === 'complete',
    allRequired: complete === required.length,
  };
}

/* ── iOS Submit Questionnaire ────────────────────────── */

// Full Apple App Privacy data type taxonomy (matches App Store Connect questionnaire)
const IOS_DATA_TYPES = [
  { group: 'Contact Info', types: [
    { id: 'name',            label: 'Name',                   desc: 'Including first or last name' },
    { id: 'email',           label: 'Email Address',          desc: 'Including but not limited to a hashed email address', common: true },
    { id: 'phone',           label: 'Phone Number',           desc: 'Including but not limited to a hashed phone number' },
    { id: 'address',         label: 'Physical Address',       desc: 'Such as a home address, physical address, or mailing address' },
    { id: 'other_contact',   label: 'Other Contact Info',     desc: 'Any other information that can be used to contact the user outside the app' },
  ]},
  { group: 'Health & Fitness', types: [
    { id: 'health',          label: 'Health',                 desc: 'Health and medical data, including but not limited to from the Clinical Health Records API, HealthKit API, or user provided health data' },
    { id: 'fitness',         label: 'Fitness',                desc: 'Fitness and exercise data, including but not limited to the Motion and Fitness API' },
  ]},
  { group: 'Financial Info', types: [
    { id: 'payment_info',    label: 'Payment Info',           desc: 'Such as form of payment, payment card number, or bank account number' },
    { id: 'credit_info',     label: 'Credit Info',            desc: 'Such as credit score' },
    { id: 'other_financial', label: 'Other Financial Info',   desc: 'Such as salary, income, assets, debts, or any other financial information' },
  ]},
  { group: 'Location', types: [
    { id: 'precise_loc',     label: 'Precise Location',       desc: 'Location with the same or greater resolution as latitude/longitude with three or more decimal places' },
    { id: 'coarse_loc',      label: 'Coarse Location',        desc: 'Approximate location, such as city-level or approximate location services' },
  ]},
  { group: 'Sensitive Info', types: [
    { id: 'sensitive',       label: 'Sensitive Info',         desc: 'Such as racial or ethnic data, sexual orientation, religious beliefs, political opinion, biometric data, or similar' },
  ]},
  { group: 'Contacts', types: [
    { id: 'contacts',        label: 'Contacts',               desc: "Such as a list of contacts in the user's phone, address book, or social graph" },
  ]},
  { group: 'User Content', types: [
    { id: 'messages',        label: 'Emails or Messages',     desc: 'Including subject line, sender, recipients, and contents of the email or message' },
    { id: 'photos_videos',   label: 'Photos or Videos',       desc: "The user's photos or videos" },
    { id: 'audio',           label: 'Audio Data',             desc: "The user's voice or sound recordings" },
    { id: 'gameplay',        label: 'Gameplay Content',       desc: 'Such as user-generated content in-game', common: true },
    { id: 'customer_support',label: 'Customer Support',       desc: 'Data generated by the user during a customer support request' },
    { id: 'other_uc',        label: 'Other User Content',     desc: 'Any other user-generated content' },
  ]},
  { group: 'Browsing History', types: [
    { id: 'browsing',        label: 'Browsing History',       desc: 'Information about content the user has viewed outside the app, such as websites' },
  ]},
  { group: 'Search History', types: [
    { id: 'search',          label: 'Search History',         desc: 'Information about searches performed in the app' },
  ]},
  { group: 'Identifiers', types: [
    { id: 'user_id',         label: 'User ID',                desc: 'Such as screen name, account ID, customer number, or other user-level ID', common: true },
    { id: 'device_id',       label: 'Device ID',              desc: "Such as the device's advertising identifier or other device-level ID", common: true },
  ]},
  { group: 'Purchases', types: [
    { id: 'purchases',       label: 'Purchase History',       desc: "An account's or individual's purchases or purchase tendencies", common: true },
  ]},
  { group: 'Usage Data', types: [
    { id: 'product_use',     label: 'Product Interaction',    desc: 'Such as app launches, taps, clicks, scrolling, saved place in a game, or other interaction data', common: true },
    { id: 'ad_data',         label: 'Advertising Data',       desc: 'Such as information about the advertisements the user has seen', common: true },
    { id: 'other_usage',     label: 'Other Usage Data',       desc: 'Any other data about user activity in the app' },
  ]},
  { group: 'Diagnostics', types: [
    { id: 'crash',           label: 'Crash Data',             desc: 'Such as crash logs', common: true },
    { id: 'performance',     label: 'Performance Data',       desc: 'Such as launch time, hang rate, or energy use', common: true },
    { id: 'other_diag',      label: 'Other Diagnostic Data',  desc: 'Any other data collected for measuring technical diagnostics' },
  ]},
  { group: 'Surroundings', types: [
    { id: 'env_scan',        label: 'Environment Scanning',   desc: "Such as mesh, planes, scene classification, and/or image detection of the user's surroundings" },
  ]},
  { group: 'Body', types: [
    { id: 'hands',           label: 'Hands',                  desc: "The user's hand structure and hand movements" },
    { id: 'head',            label: 'Head',                   desc: "The user's head movement" },
  ]},
  { group: 'Other Data', types: [
    { id: 'other',           label: 'Other Data',             desc: 'Any other data types not mentioned' },
  ]},
];

// Flat type lookup: typeId → { id, label, desc, group }
const IOS_DATA_TYPE_LOOKUP = {};
IOS_DATA_TYPES.forEach(g => g.types.forEach(t => { IOS_DATA_TYPE_LOOKUP[t.id] = { ...t, group: g.group }; }));

// How each collected data type is used (per-type selection)
const IOS_PURPOSES = [
  { id: 'first_party_ads',  label: 'Ads & Marketing',       desc: "Displaying first-party ads, sending marketing communications, or sharing data with entities who will display your ads" },
  { id: 'third_party_ads',  label: '3rd-Party Advertising', desc: "Displaying third-party ads in your app, or sharing data with entities who display third-party ads" },
  { id: 'analytics',        label: 'Analytics',             desc: "Evaluating user behavior, including to understand effectiveness of existing features, plan new features, or measure audience size" },
  { id: 'personalization',  label: 'Personalization',       desc: "Customizing what the user sees, such as a list of recommended products, posts, or suggestions" },
  { id: 'app_function',     label: 'App Functionality',     desc: "Such as to authenticate the user, enable features, prevent fraud, implement security measures, or perform customer support" },
  { id: 'other_purpose',    label: 'Other Purposes',        desc: "Any other purpose not listed" },
];

const IOS_INTENSITY_QUESTIONS = [
  // Step 2: Mature Themes
  { id: 'profanity',         label: 'Profanity or Crude Humor',
    tooltip: 'Offensive or vulgar language considered rude, obscene, or inappropriate. Includes swearing, slurs, insult-based humor, or jokes about bodily functions.' },
  { id: 'horrorFear',        label: 'Horror/Fear Themes',
    tooltip: 'Content evoking anxiety, dread, or terror. Includes supernatural elements, body horror, or fear of isolation and death.' },
  { id: 'substancesAlcohol', label: 'Alcohol, Tobacco, or Drug Use',
    tooltip: 'Depictions of alcohol, tobacco, or drug use. Includes drunken behavior, smoking, or illegal drug consumption.' },
  // Step 3: Medical or Wellness
  { id: 'medicalTreatment',  label: 'Medical or Treatment Information',
    tooltip: 'Diagnoses or guidance on medical conditions or health. Includes medication guidance, emergency care, or treatment information.' },
  // Step 4: Sexuality or Nudity
  { id: 'matureSuggestive',  label: 'Mature or Suggestive Themes',
    tooltip: 'Implicit sexual references or mature topics for older audiences. Includes innuendo, suggestive imagery, implied nudity, trauma, or political strife.' },
  { id: 'sexualContent',     label: 'Sexual Content or Nudity',
    tooltip: 'Non-explicit depictions of sexual behavior or partial nudity. Includes mild romantic intimacy, implied sexual activity, or sensual dialog.' },
  { id: 'graphicSexual',     label: 'Graphic Sexual Content and Nudity',
    tooltip: 'Explicit depictions of sexual activity or nudity. Includes full-frontal nudity or pornographic portrayals of sex.' },
  // Step 5: Violence
  { id: 'cartoonViolence',   label: 'Cartoon or Fantasy Violence',
    tooltip: 'Exaggerated or fantastical conflict easily distinguished from real life. Includes animated combat, magic used to cause harm, or cartoon violence.' },
  { id: 'realisticViolence', label: 'Realistic Violence',
    tooltip: 'Physical conflict or harm involving humans in lifelike situations. Includes injuries from punches, shoot-outs, or combat between characters.' },
  { id: 'extendedViolence',  label: 'Extended Graphic or Sadistic Violence',
    tooltip: 'Prolonged realistic depictions of physical conflict. Includes extreme gore, human injury, or death.' },
  { id: 'gunsWeapons',       label: 'Guns or Other Weapons',
    tooltip: 'References to or depictions of guns, weapons, or objects that may cause bodily harm. Includes guns, swords, or knives.' },
  // Step 6: Chance-Based Activities
  { id: 'simulatedGambling', label: 'Simulated Gambling',
    tooltip: 'Wagering without real money. Includes simulated casino games, sports betting, or other wagering with no monetary value.' },
  { id: 'contests',          label: 'Contests',
    tooltip: 'Users compete for rankings or rewards. Includes skill-based competitions, trivia quizzes, or sport and fitness challenges.' },
];

const IOS_CONTENT_YN_QUESTIONS = [
  // Step 1: In-App Controls
  { id: 'parentalControls',    label: 'Parental Controls',
    tooltip: 'Tools allowing parents to monitor or restrict a child\'s in-app access. Includes content filtering, usage limits, or purchase restrictions.' },
  { id: 'ageAssurance',        label: 'Age Assurance',
    tooltip: 'Confirms a user\'s age meets requirements for specific content. Includes API checks, age estimation, or government ID verification.' },
  // Step 1: Capabilities
  { id: 'unrestrictedInternet', label: 'Unrestricted Web Access',
    tooltip: 'Users can navigate to any webpage or freely browse the web. Includes embedded browser functionality or browser app.' },
  { id: 'userGenContent',      label: 'User-Generated Content',
    tooltip: 'User-created content broadly distributed as part of the app experience. Includes videos, photos, text, or audio shared by users.' },
  { id: 'messagingChat',       label: 'Messaging and Chat',
    tooltip: 'Direct user-to-user communication within the app. Includes text, voice, or video chat, group messaging, or public posting.' },
  { id: 'advertising',         label: 'Advertising',
    tooltip: 'Paid promotion of products or services within the app. Includes banner ads, video ads, rich media, or native ad formats.' },
  // Step 3: Medical or Wellness
  { id: 'healthWellness',      label: 'Health or Wellness Topics',
    tooltip: 'Self-care or lifestyle recommendations. Includes calorie tracking, dieting advice, or exercise recommendations.' },
  // Step 6: Chance-Based Activities (Yes/No)
  { id: 'realMoneyGambling',   label: 'Gambling',
    tooltip: 'Wagering using real money or currency exchangeable for real money. Includes casino games, sports betting, lotteries, and raffles.' },
  { id: 'lootBoxes',           label: 'Loot Boxes',
    tooltip: 'Randomized virtual item containers available for purchase. Includes randomized functional cards or cosmetic items.' },
];

// Apple-distributable countries, sorted by approximate iOS user count (millions)
// iosGamers = estimated iOS mobile gamers in millions (2024)
const IOS_COUNTRIES = [
  { code: 'CN', name: 'China',            lang: 'zh', num: 156, iosGamers: 140 },
  { code: 'US', name: 'United States',    lang: 'en', num: 840, iosGamers: 100 },
  { code: 'IN', name: 'India',            lang: 'en', num: 356, iosGamers: 52  },
  { code: 'JP', name: 'Japan',            lang: 'ja', num: 392, iosGamers: 42  },
  { code: 'BR', name: 'Brazil',           lang: 'pt', num: 76,  iosGamers: 22  },
  { code: 'KR', name: 'South Korea',      lang: 'ko', num: 410, iosGamers: 18  },
  { code: 'CA', name: 'Canada',           lang: 'en', num: 124, iosGamers: 18  },
  { code: 'GB', name: 'United Kingdom',   lang: 'en', num: 826, iosGamers: 17  },
  { code: 'DE', name: 'Germany',          lang: 'de', num: 276, iosGamers: 14  },
  { code: 'AU', name: 'Australia',        lang: 'en', num: 36,  iosGamers: 12  },
  { code: 'TW', name: 'Taiwan',           lang: 'zh', num: 158, iosGamers: 11  },
  { code: 'SA', name: 'Saudi Arabia',     lang: 'ar', num: 682, iosGamers: 11  },
  { code: 'FR', name: 'France',           lang: 'fr', num: 250, iosGamers: 11  },
  { code: 'MX', name: 'Mexico',           lang: 'es', num: 484, iosGamers: 10  },
  { code: 'TR', name: 'Turkey',           lang: 'tr', num: 792, iosGamers: 10  },
  { code: 'ID', name: 'Indonesia',        lang: 'id', num: 360, iosGamers: 10  },
  { code: 'VN', name: 'Vietnam',          lang: 'vi', num: 704, iosGamers: 9   },
  { code: 'PH', name: 'Philippines',      lang: 'en', num: 608, iosGamers: 8   },
  { code: 'IT', name: 'Italy',            lang: 'it', num: 380, iosGamers: 8   },
  { code: 'MY', name: 'Malaysia',         lang: 'ms', num: 458, iosGamers: 7   },
  { code: 'ES', name: 'Spain',            lang: 'es', num: 724, iosGamers: 7   },
  { code: 'TH', name: 'Thailand',         lang: 'th', num: 764, iosGamers: 7   },
  { code: 'HK', name: 'Hong Kong',        lang: 'zh', num: 344, iosGamers: 5   },
  { code: 'SG', name: 'Singapore',        lang: 'en', num: 702, iosGamers: 5   },
  { code: 'PK', name: 'Pakistan',         lang: 'ur', num: 586, iosGamers: 5   },
  { code: 'EG', name: 'Egypt',            lang: 'ar', num: 818, iosGamers: 5   },
  { code: 'AE', name: 'UAE',              lang: 'ar', num: 784, iosGamers: 5   },
  { code: 'NL', name: 'Netherlands',      lang: 'nl', num: 528, iosGamers: 5   },
  { code: 'RU', name: 'Russia',           lang: 'ru', num: 643, iosGamers: 4   },
  { code: 'SE', name: 'Sweden',           lang: 'sv', num: 752, iosGamers: 4   },
  { code: 'PL', name: 'Poland',           lang: 'pl', num: 616, iosGamers: 4   },
  { code: 'AR', name: 'Argentina',        lang: 'es', num: 32,  iosGamers: 4   },
  { code: 'CO', name: 'Colombia',         lang: 'es', num: 170, iosGamers: 4   },
  { code: 'CH', name: 'Switzerland',      lang: 'de', num: 756, iosGamers: 4   },
  { code: 'UA', name: 'Ukraine',          lang: 'uk', num: 804, iosGamers: 3   },
  { code: 'NO', name: 'Norway',           lang: 'no', num: 578, iosGamers: 3   },
  { code: 'DK', name: 'Denmark',          lang: 'da', num: 208, iosGamers: 3   },
  { code: 'ZA', name: 'South Africa',     lang: 'en', num: 710, iosGamers: 3   },
  { code: 'BE', name: 'Belgium',          lang: 'fr', num: 56,  iosGamers: 3   },
  { code: 'FI', name: 'Finland',          lang: 'fi', num: 246, iosGamers: 3   },
  { code: 'AT', name: 'Austria',          lang: 'de', num: 40,  iosGamers: 3   },
  { code: 'IL', name: 'Israel',           lang: 'he', num: 376, iosGamers: 3   },
  { code: 'CL', name: 'Chile',            lang: 'es', num: 152, iosGamers: 2   },
  { code: 'KW', name: 'Kuwait',           lang: 'ar', num: 414, iosGamers: 2   },
  { code: 'QA', name: 'Qatar',            lang: 'ar', num: 634, iosGamers: 2   },
  { code: 'GR', name: 'Greece',           lang: 'el', num: 300, iosGamers: 2   },
  { code: 'RO', name: 'Romania',          lang: 'ro', num: 642, iosGamers: 2   },
  { code: 'CZ', name: 'Czech Republic',   lang: 'cs', num: 203, iosGamers: 2   },
  { code: 'PT', name: 'Portugal',         lang: 'pt', num: 620, iosGamers: 2   },
  { code: 'PE', name: 'Peru',             lang: 'es', num: 604, iosGamers: 2   },
  { code: 'HU', name: 'Hungary',          lang: 'hu', num: 348, iosGamers: 2   },
  { code: 'KZ', name: 'Kazakhstan',       lang: 'ru', num: 398, iosGamers: 2   },
  { code: 'NG', name: 'Nigeria',          lang: 'en', num: 566, iosGamers: 2   },
  { code: 'NZ', name: 'New Zealand',      lang: 'en', num: 554, iosGamers: 2   },
  { code: 'IQ', name: 'Iraq',             lang: 'ar', num: 368, iosGamers: 2   },
];

const IOS_SECTIONS = [
  { id: 'privacy',       label: 'Data Privacy'      },
  { id: 'contentRating', label: 'Content Rating'    },
  { id: 'business',      label: 'Business'          },
  { id: 'distribution',  label: 'Distribution'      },
  { id: 'storePreview',  label: 'Store Page Preview'},
];

function makeBlankIOSAnswers() {
  return {
    // Privacy
    privacyPolicyUrl:       '',
    collectsData:           null,   // 'yes' / 'no'
    // dataPerType: { [typeId]: { purposes: [], identity: null, tracking: null } }
    dataPerType:            {},
    // Content Rating — Step 1: Features (Yes/No)
    parentalControls:       null,
    ageAssurance:           null,
    unrestrictedInternet:   null,
    userGenContent:         null,
    messagingChat:          null,
    advertising:            null,
    // Content Rating — Step 2: Mature Themes (intensity: null / 'none' / 'infrequent' / 'frequent')
    profanity:              null,
    horrorFear:             null,
    substancesAlcohol:      null,
    // Content Rating — Step 3: Medical or Wellness (pre-populated for most games)
    medicalTreatment:       'none',
    healthWellness:         'no',
    // Content Rating — Step 4: Sexuality or Nudity (intensity)
    matureSuggestive:       null,
    sexualContent:          null,
    graphicSexual:          null,
    // Content Rating — Step 5: Violence (intensity)
    cartoonViolence:        null,
    realisticViolence:      null,
    extendedViolence:       null,
    gunsWeapons:            null,
    // Content Rating — Step 6: Chance-Based Activities
    simulatedGambling:      null,
    contests:               null,
    realMoneyGambling:      null,
    lootBoxes:              null,
    // Content Rating — Step 7: Additional Information
    ageCategory:            null,   // 'not_applicable' / 'made_for_kids' / 'override_higher'
    kidsAgeRange:           null,   // 'under5' / '6to8' / '9to11'
    overrideRating:         null,   // '9' / '13' / '16' / '18'
    ageSuitabilityUrl:      '',
    // Export Compliance
    usesEncryption:         null,
    encryptionExempt:       null,
    hasERN:                 null,
    ernNumber:              '',
    // Business
    hasIAP:                 null,
    iapTypes:               [],
    hasFreeTrial:           null,
    taxCategory:            'games',
    // Distribution
    selectedCountries:      [],
    distPreset:             'everywhere',
  };
}

function computeIOSSectionRisk(sectionId) {
  const a    = state.iosSubmitAnswers;
  const meta = state.iosAnswerMeta;

  function fieldStatus(fieldId) {
    if (a[fieldId] === null || a[fieldId] === undefined) return 'missing';
    const m = meta[fieldId];
    if (!m) return 'human';
    if (m.humanConfirmed) return 'human';
    if (m.confidence >= 90) return 'certain';
    return 'confident';
  }

  function evalFields(fieldIds) {
    const statuses = fieldIds.map(fieldStatus);
    if (statuses.includes('missing'))   return 'HIGH';
    if (statuses.includes('confident')) return 'MEDIUM';
    return 'LOW';
  }

  if (sectionId === 'privacy') {
    if (!a.privacyPolicyUrl.trim()) return 'HIGH';
    return evalFields(['collectsData']);
  }

  if (sectionId === 'contentRating') {
    const fields = [
      ...IOS_INTENSITY_QUESTIONS.map(q => q.id),
      ...IOS_CONTENT_YN_QUESTIONS.map(q => q.id),
      'ageCategory',
    ];
    return evalFields(fields);
  }

  if (sectionId === 'business') {
    if (a.usesEncryption === null) return 'HIGH';
    const fields = ['hasIAP', 'usesEncryption'];
    if (a.usesEncryption === 'yes') fields.push('encryptionExempt');
    return evalFields(fields);
  }

  if (sectionId === 'distribution') {
    if (a.selectedCountries.length === 0) return 'NONE';
    if (a.selectedCountries.includes('CN')) return 'MEDIUM';
    return 'LOW';
  }

  return 'NONE';
}

function isIOSSectionComplete(sectionId) {
  const a = state.iosSubmitAnswers;

  if (sectionId === 'privacy') {
    if (!a.privacyPolicyUrl.trim()) return false;
    if (a.collectsData === null) return false;
    if (a.collectsData === 'yes') {
      const types = Object.entries(a.dataPerType);
      if (types.length === 0) return false;
      for (const [, t] of types) {
        if (t.purposes.length === 0 || t.identity === null || t.tracking === null) return false;
      }
    }
    return true;
  }

  if (sectionId === 'contentRating') {
    if (!IOS_INTENSITY_QUESTIONS.every(q => a[q.id] !== null)) return false;
    if (!IOS_CONTENT_YN_QUESTIONS.every(q => a[q.id] !== null)) return false;
    if (a.ageCategory === null) return false;
    if (a.ageCategory === 'made_for_kids'   && a.kidsAgeRange  === null) return false;
    if (a.ageCategory === 'override_higher' && a.overrideRating === null) return false;
    return true;
  }

  if (sectionId === 'business') {
    // IAP
    if (a.hasIAP === null) return false;
    if (a.hasIAP === 'yes' && a.iapTypes.length === 0) return false;
    // Export compliance (merged into business step)
    if (a.usesEncryption === null) return false;
    if (a.usesEncryption === 'yes') {
      if (a.encryptionExempt === null) return false;
      if (a.encryptionExempt === 'no') {
        if (a.hasERN === null) return false;
        if (a.hasERN === 'yes' && !a.ernNumber.trim()) return false;
      }
    }
    return true;
  }

  if (sectionId === 'distribution') {
    return a.selectedCountries.length > 0;
  }

  if (sectionId === 'storePreview') {
    // Complete once the user has visited the preview and all other steps are done
    return !!(state.iosStorePreviewSeen &&
      isIOSSectionComplete('privacy') &&
      isIOSSectionComplete('contentRating') &&
      isIOSSectionComplete('business') &&
      isIOSSectionComplete('distribution'));
  }

  return false;
}

/* ── Risk Categories (Submit Modal) ─────────────────── */

const RISK_CATEGORIES = [
  { id: 'violence',   label: 'Violence & Combat' },
  { id: 'sexual',     label: 'Sexual Content & Nudity' },
  { id: 'language',   label: 'Language & Crude Humor' },
  { id: 'substances', label: 'Controlled Substances' },
  { id: 'gambling',   label: 'Gambling & Monetization' },
  { id: 'privacy',    label: 'Data Privacy' },
  { id: 'online',     label: 'Online Safety & Communication' },
];

function computeSubmitRisk() {
  const fd   = state.formData;
  const qa   = state.questionAnswers;
  const qi   = state.questionInferred;
  const desc = (fd.description + ' ' + fd.title).toLowerCase();
  const has  = ks => ks.some(k => desc.includes(k));
  const results = {};

  // ── Violence & Combat ─────────────────────────────────
  {
    const ansYes   = qa.violence === 'yes';
    const ansNo    = qa.violence === 'no';
    const answered = qa.violence !== null;
    const hasGore  = has(['blood','gore','brutal','gruesome','slaughter','dismember']);
    const hasCombat= has(['fight','combat','battle','shoot','kill','war','weapon','sword','gun','fps','arena']);
    let risk, signals = [], justification;

    if (ansYes && hasGore) {
      risk = 'HIGH';
      justification = 'Your game contains violence and descriptions suggest blood or gore. This requires a Mature age rating (17+ on iOS, M on ESRB) and may trigger additional manual review. Platforms will prominently display violence and gore content descriptors on your store page.';
    } else if (ansYes) {
      risk = 'MEDIUM';
      justification = 'Your game contains violence or combat. Platforms will apply a violence content descriptor. Expect a rating of 12+/Teen or higher. If combat is cartoonish or consequence-free, document this in your content notes to support a lower descriptor.';
    } else if (!answered && hasCombat) {
      risk = 'MEDIUM';
      justification = 'Combat-related terms were detected in your description but violence hasn\'t been confirmed. Undisclosed violence is one of the most common reasons for rejection on first submission — confirm your answer before submitting.';
    } else if (ansNo) {
      risk = 'LOW';
      justification = 'You\'ve confirmed your game contains no violence. No violence-related content descriptors will be applied to your store listing.';
    } else {
      risk = 'LOW';
      justification = 'No violence signals detected. This section of platform content questionnaires can be answered "No" for all questions.';
    }

    if (answered) signals.push({ label: 'Violence / Combat', value: ansYes ? 'Yes — declared' : 'No — declared', source: qi.violence ? 'Auto-detected, confirmed' : 'Your answer' });
    if (!answered && hasCombat) signals.push({ label: 'Combat keywords', value: 'Detected in description', source: 'Description analysis' });
    if (hasGore) signals.push({ label: 'Gore / blood language', value: 'Detected in description', source: 'Description analysis' });
    results.violence = { risk, signals, justification };
  }

  // ── Sexual Content & Nudity ───────────────────────────
  {
    const ansYes   = qa.sexualContent === 'yes';
    const ansNo    = qa.sexualContent === 'no';
    const answered = qa.sexualContent !== null;
    const hasSex   = has(['adult','sexual','nude','nudity','erotic','mature','18+','dating','romantic']);
    let risk, signals = [], justification;

    if (ansYes) {
      risk = 'HIGH';
      justification = 'Your game contains sexual or mature content. This restricts your game to adults-only storefronts or requires age-gating. Steam requires a special developer agreement to list adult content. Nintendo eShop and some Xbox store regions do not allow explicit content regardless of rating.';
    } else if (!answered && hasSex) {
      risk = 'MEDIUM';
      justification = 'Adult-themed keywords were detected in your description. If your game includes suggestive content, dating mechanics, or revealing character designs, these must be disclosed. Failure to declare adult content is a leading cause of post-launch removal from stores.';
    } else if (ansNo) {
      risk = 'LOW';
      justification = 'You\'ve confirmed no sexual or mature content. No adult content restrictions will be applied to your listing.';
    } else {
      risk = 'LOW';
      justification = 'No sexual content signals detected. Adult content sections of platform questionnaires can be answered "No."';
    }

    if (answered) signals.push({ label: 'Sexual / Mature content', value: ansYes ? 'Yes — declared' : 'No — declared', source: 'Your answer' });
    if (!answered && hasSex) signals.push({ label: 'Adult keywords', value: 'Detected in description', source: 'Description analysis' });
    results.sexual = { risk, signals, justification };
  }

  // ── Language & Crude Humor ────────────────────────────
  {
    const ansYes   = qa.strongLanguage === 'yes';
    const ansNo    = qa.strongLanguage === 'no';
    const answered = qa.strongLanguage !== null;
    const hasLang  = has(['profanity','crude','explicit','swear','cursing','offensive language']);
    let risk, signals = [], justification;

    if (ansYes) {
      risk = 'MEDIUM';
      justification = 'Your game contains strong language. A language content descriptor will appear on your store page, typically raising the minimum age rating to 12+/Teen. Nintendo eShop applies stricter standards — consider offering a censored text option if targeting that platform.';
    } else if (!answered && hasLang) {
      risk = 'LOW';
      justification = 'Language-related terms were found in your description. If any characters use profanity in dialogue, text, or audio, this must be declared. Undeclared language typically results in a retroactive rating change rather than outright rejection.';
    } else if (ansNo) {
      risk = 'LOW';
      justification = 'No strong language declared. Your game will not receive language-related content descriptors.';
    } else {
      risk = 'LOW';
      justification = 'No language signals detected. Language sections of platform questionnaires can be answered "No."';
    }

    if (answered) signals.push({ label: 'Strong language', value: ansYes ? 'Yes — declared' : 'No — declared', source: 'Your answer' });
    if (!answered && hasLang) signals.push({ label: 'Language keywords', value: 'Detected in description', source: 'Description analysis' });
    results.language = { risk, signals, justification };
  }

  // ── Controlled Substances ─────────────────────────────
  {
    const subKW   = ['drug','alcohol','beer','wine','whiskey','vodka','cannabis','marijuana','tobacco','smoke','cocaine','heroin','pills','narcotic'];
    const matched = subKW.filter(k => desc.includes(k));
    const hasSub  = matched.length > 0;
    let risk, signals = [], justification;

    if (hasSub) {
      risk = 'MEDIUM';
      justification = 'References to controlled substances or alcohol were detected in your description. Platforms require you to specify whether substances can be used interactively and whether their use is presented favorably or glamorized. Interactive drug/alcohol use typically adds a descriptor and raises the age rating.';
      signals.push({ label: 'Substance keywords', value: matched.slice(0, 3).join(', '), source: 'Description analysis' });
    } else {
      risk = 'LOW';
      justification = 'No controlled substance references detected. This section of platform content questionnaires can be answered "No" for all questions.';
    }
    results.substances = { risk, signals, justification };
  }

  // ── Gambling & Monetization ───────────────────────────
  {
    const ansYes   = qa.inAppPurchases === 'yes';
    const ansNo    = qa.inAppPurchases === 'no';
    const answered = qa.inAppPurchases !== null;
    const lootKW   = ['loot box','lootbox','gacha','casino','slot machine','poker','blackjack','roulette','bet','wager','gambling','jackpot'];
    const hasLoot  = has(lootKW);
    const isFree   = fd.price === '0' || fd.price === '0.00' || fd.price === '' || fd.price === 'free';
    let risk, signals = [], justification;

    if (ansYes && hasLoot) {
      risk = 'HIGH';
      justification = 'Your game includes in-app purchases and gambling-style mechanics (loot boxes, gacha, or randomized rewards). Apple requires disclosure of the odds of receiving each item. Belgium, Netherlands, and other regions prohibit loot boxes entirely — you\'ll need region-specific restrictions and a clear odds disclosure UI before submitting.';
    } else if (ansYes) {
      risk = 'MEDIUM';
      justification = 'Your game includes in-app purchases. All platforms require these to be configured and disclosed before submission. Apple requires subscription terms links; Google Play requires pricing confirmation in 170+ markets. Budget extra time for pricing setup across platforms.';
    } else if (!answered && isFree) {
      risk = 'LOW';
      justification = 'Your game appears to be free and in-app purchase status wasn\'t confirmed. Free games are more closely scrutinized for undisclosed monetization. Even cosmetic items or tip jars count — confirm your answer before submitting.';
    } else if (ansNo) {
      risk = 'LOW';
      justification = 'No in-app purchases declared. Your game will be listed as a paid title with no monetization warnings. Note that adding IAP later requires re-submission on most platforms.';
    } else {
      risk = 'LOW';
      justification = 'No monetization signals detected. Monetization sections can be answered conservatively.';
    }

    if (answered) signals.push({ label: 'In-app purchases', value: ansYes ? 'Yes — declared' : 'No — declared', source: 'Your answer' });
    if (hasLoot) signals.push({ label: 'Randomized reward mechanics', value: 'Detected in description', source: 'Description analysis' });
    if (isFree) signals.push({ label: 'Game price', value: 'Free — monetization scrutiny applies', source: 'Price field' });
    results.gambling = { risk, signals, justification };
  }

  // ── Data Privacy ──────────────────────────────────────
  {
    const ansYes     = qa.dataCollection === 'yes';
    const ansNo      = qa.dataCollection === 'no';
    const answered   = qa.dataCollection !== null;
    const hasPrivacy = !!(fd.privacyUrl && fd.privacyUrl.trim());
    const onlineKW   = ['account','sign in','login','multiplayer','leaderboard','cloud save','analytics','achievements','profile','user data'];
    const hasOnline  = has(onlineKW);
    let risk, signals = [], justification;

    if (ansYes) {
      risk = 'HIGH';
      justification = 'Your game collects user data. Apple requires a fully completed Privacy Nutrition Label specifying every data type and its purpose. Google Play requires a Data Safety form with similar detail. If any data is linked to user identity or used for tracking, special entitlements and user consents are required. Ensure your privacy policy is current and hosted at the URL you provided.';
    } else if (!answered && hasOnline) {
      risk = 'MEDIUM';
      justification = 'Online features (accounts, leaderboards, multiplayer) were detected in your description. These features almost always involve data collection — even session tokens or device identifiers count. Confirm your data collection status and ensure your privacy policy covers all use cases.';
    } else if (!hasPrivacy) {
      risk = 'LOW';
      justification = 'A privacy policy URL has not been provided. All major platforms require a valid, live privacy policy link — even for games that collect no data. Without this, your submission will be rejected on first review.';
    } else if (ansNo) {
      risk = 'LOW';
      justification = 'No data collection declared and a privacy policy is provided. You\'ll still complete brief data safety forms, but all data type questions can be answered "not collected." Some platforms may cross-check this against your listed SDKs.';
    } else {
      risk = 'LOW';
      justification = 'No data collection signals detected. Privacy questionnaires can be answered conservatively.';
    }

    if (answered) signals.push({ label: 'Data collection', value: ansYes ? 'Yes — declared' : 'No — declared', source: 'Your answer' });
    signals.push({ label: 'Privacy policy URL', value: hasPrivacy ? 'Provided ✓' : 'Missing ✗', source: 'Compliance tab' });
    if (!answered && hasOnline) signals.push({ label: 'Online features', value: 'Detected in description', source: 'Description analysis' });
    results.privacy = { risk, signals, justification };
  }

  // ── Online Safety & Communication ─────────────────────
  {
    const chatKW     = ['chat','voice chat','text chat','message','communicate','ugc','user-generated','user generated','community','forum','voice'];
    const multiKW    = ['multiplayer','online multiplayer','co-op','cooperative','pvp','mmo','massively multiplayer'];
    const locationKW = ['location','gps','nearby','geo-location'];
    const hasChat    = has(chatKW);
    const hasMulti   = has(multiKW);
    const hasLoc     = has(locationKW);
    let risk, signals = [], justification;

    if (hasChat || hasLoc) {
      risk = 'HIGH';
      justification = 'Your game appears to include real-time user communication (chat, voice) or location sharing. Platforms require specific Interactive Elements disclosures, and child-safety compliance is mandatory — moderation tools, content filtering, and parental controls may be required. COPPA/GDPR-K compliance is essential if players under 13 can access these features.';
    } else if (hasMulti) {
      risk = 'MEDIUM';
      justification = 'Online multiplayer was detected in your description. This must be declared as an Interactive Element on all platform questionnaires. Even indirect player interaction (shared world state, shared leaderboards) counts. Confirm what data is exchanged between players and ensure your privacy policy addresses it.';
    } else {
      risk = 'LOW';
      justification = 'No real-time social or communication features detected. Interactive Elements sections of platform questionnaires can largely be answered "None."';
    }

    if (hasChat) signals.push({ label: 'Real-time communication', value: 'Chat / voice detected', source: 'Description analysis' });
    if (hasMulti) signals.push({ label: 'Online multiplayer', value: 'Detected in description', source: 'Description analysis' });
    if (hasLoc) signals.push({ label: 'Location features', value: 'Detected in description', source: 'Description analysis' });
    results.online = { risk, signals, justification };
  }

  return results;
}

/* ── Project / Submission helpers ────────────────────── */

function generateId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

function makeBlankFormData() {
  return {
    title:            '',
    description:      '',
    price:            '',
    supportUrl:       '',
    privacyUrl:       '',
    primaryLanguage:  'en',
    localized:        false,
    localizations:    [],
    releaseTiming:    'manual',
    releaseDate:      '',
    trailerUrl:       '',
  };
}

function makeBlankUploads() {
  return {
    appIcon:        null,
    screenshots:    [],
    featureGraphic: null,
    trailer:        null,
  };
}

function makeBlankAnswers() {
  return { violence: null, sexualContent: null, strongLanguage: null, dataCollection: null, inAppPurchases: null };
}

function makeBlankInferred() {
  return { violence: false, sexualContent: false, strongLanguage: false, dataCollection: false, inAppPurchases: false };
}

function makeEmptySubmission(name) {
  return {
    id:                  generateId('sub'),
    name,
    activePlatforms:     [],            // serialized as array (converted to Set in flat state)
    platformStepStatus:  makeEmptyPlatformSteps(),
  };
}

// Save the current flat state back into the active project/submission record
function saveCurrentToProject() {
  const proj = state.projects.find(p => p.id === state.activeProjectId);
  if (!proj) return;
  proj.name             = state.formData.title || proj.name;
  proj.formData         = JSON.parse(JSON.stringify(state.formData));
  proj.uploads          = JSON.parse(JSON.stringify(state.uploads));
  proj.questionAnswers  = JSON.parse(JSON.stringify(state.questionAnswers));
  proj.questionInferred = JSON.parse(JSON.stringify(state.questionInferred));
  const sub = proj.submissions.find(s => s.id === state.activeSubmissionId);
  if (!sub) return;
  sub.activePlatforms    = [...state.activePlatforms];
  sub.platformStepStatus = JSON.parse(JSON.stringify(state.platformStepStatus));
}

// Load a project + optional submission into flat state (saves current first)
function loadProjectAndSubmission(projectId, submissionId) {
  saveCurrentToProject();
  const proj = state.projects.find(p => p.id === projectId);
  if (!proj) return;
  state.activeProjectId   = projectId;
  state.formData          = JSON.parse(JSON.stringify(proj.formData));
  state.uploads           = JSON.parse(JSON.stringify(proj.uploads));
  state.questionAnswers   = JSON.parse(JSON.stringify(proj.questionAnswers));
  state.questionInferred  = JSON.parse(JSON.stringify(proj.questionInferred));
  const sub = submissionId
    ? proj.submissions.find(s => s.id === submissionId) || proj.submissions[0]
    : proj.submissions[0];
  if (!sub) return;
  state.activeSubmissionId   = sub.id;
  state.activePlatforms      = new Set(sub.activePlatforms);
  state.platformStepStatus   = JSON.parse(JSON.stringify(sub.platformStepStatus));
}


/* ── Application State ───────────────────────────────── */

const state = {
  // Onboarding
  onboardingComplete: false,
  onboardingTab: 0,          // 0 = Game Details, 1 = Upload Assets, 2 = Compliance
  _newProjectMode: false,    // true when onboarding is creating a 2nd+ project

  // Modal
  activeModal: null,

  // Activated platforms (shown with full task list on dashboard)
  activePlatforms: new Set(),

  // Per-platform step completion
  platformStepStatus: makeEmptyPlatformSteps(),

  // Form data (collected during onboarding)
  formData: makeBlankFormData(),

  uploads: makeBlankUploads(),

  questionAnswers: makeBlankAnswers(),

  questionInferred: makeBlankInferred(),

  // Projects list — each entry mirrors a saved snapshot
  projects: [],
  activeProjectId:    null,
  activeSubmissionId: null,

  // Legacy generic submit modal (non-iOS platforms)
  submitModal: {
    platformId: null,
    expanded: [],
  },

  // iOS step modal — which step is currently open
  stepModal: {},

  // iOS App Store submission questionnaire answers
  iosSubmitAnswers: makeBlankIOSAnswers(),

  // Per-field AI inference metadata: { [fieldId]: { confidence: 0-100, humanConfirmed: bool } }
  iosAnswerMeta: {},

  // Cached Claude analysis result — populated on first inference step open, reused thereafter
  claudeCache: null,

  // Whether the user has visited Store Page Preview (makes it count as complete)
  iosStorePreviewSeen: false,

  // Claude AI UI state (not persisted)
  claudeUI: {},
};
