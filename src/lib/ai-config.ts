/**
 * AI Scheduler Configuration
 * Centralized configuration for AI scheduling behavior
 * These values can be made user-configurable in the future
 */

import {
  DEFAULT_WEEKDAY_WORK_START,
  DEFAULT_WEEKDAY_WORK_END,
  DEFAULT_WEEKDAY_PERSONAL_START,
  DEFAULT_WEEKDAY_PERSONAL_END,
  DEFAULT_WEEKDAY_PROJECTS_START,
  DEFAULT_WEEKDAY_PROJECTS_END,
  DEFAULT_WEEKEND_WORK_START,
  DEFAULT_WEEKEND_WORK_END,
  DEFAULT_WEEKEND_PERSONAL_START,
  DEFAULT_WEEKEND_PERSONAL_END,
  DEFAULT_WEEKEND_PROJECTS_START,
  DEFAULT_WEEKEND_PROJECTS_END,
} from './business-constants';

// Helper to parse time string to hour
const parseTimeToHour = (timeStr: string): number => {
  const [hours] = timeStr.split(':').map(Number);
  return hours;
};

// ============================================================================
// Daily Hours Configuration
// ============================================================================

/**
 * Daily hour limit options for AI scheduling
 */
export const AI_DAILY_HOUR_OPTIONS = {
  FIVE_HOURS: 5,
  EIGHT_HOURS: 8,
  TEN_HOURS: 10,
} as const;

/**
 * Daily hour option labels and descriptions for UI display
 */
export const AI_DAILY_HOUR_LABELS = {
  [AI_DAILY_HOUR_OPTIONS.FIVE_HOURS]: {
    label: '5 Hours',
    description: 'Standard work day limit',
  },
  [AI_DAILY_HOUR_OPTIONS.EIGHT_HOURS]: {
    label: '8 Hours',
    description: 'Full work day limit',
  },
  [AI_DAILY_HOUR_OPTIONS.TEN_HOURS]: {
    label: '10 Hours',
    description: 'Extended work day limit',
  },
} as const;

/**
 * Maximum hours per day for task scheduling
 * Default: 5 hours
 * This is now user-configurable through settings (5HR/8HR/10HR)
 */
export const MAX_HOURS_PER_DAY = AI_DAILY_HOUR_OPTIONS.FIVE_HOURS; // Default fallback

/**
 * Description Generation Configuration
 */
export const DESCRIPTION_GENERATION_CONFIG = {
  maxContextLength: 500, // Maximum characters from context to use
  minSearchResults: 1, // Minimum results needed (legacy - not used with Browser AI)
  searchTimeout: 5000, // Timeout for async operations (ms)
  // Context processing thresholds
  minContextLength: 20, // Minimum context length to use in description (reduced to allow shorter but useful contexts)
  minSentenceLength: 10, // Minimum sentence length to extract (reduced to allow shorter useful sentences)
  maxSentenceLength: 500, // Maximum sentence length to extract (increased from 150 to allow longer, more complete descriptions)
  // Query processing
  minWordLength: 2, // Minimum word length to consider in task name
  maxQueriesPerSearch: 5, // Maximum number of queries to search in parallel
  resultsMultiplier: 2, // Multiplier for max results when combining multiple queries
  // Extraction limits
  maxTopKeywords: 2, // Maximum top keywords to use in queries
  maxTopPhrases: 2, // Maximum top phrases to use in queries
  maxTopVerbs: 2, // Maximum top verbs to use in queries
  maxTopNouns: 2, // Maximum top nouns to use in queries
  maxExtractedKeywords: 15, // Maximum extracted keywords to return (increased for better context and more comprehensive matching)
  maxExtractedPhrases: 10, // Maximum extracted phrases to return (increased for better context and more comprehensive matching)
  maxExtractedVerbs: 10, // Maximum extracted verbs to return (increased for better context and more comprehensive matching)
  maxExtractedNouns: 10, // Maximum extracted nouns to return (increased for better context and more comprehensive matching)
  maxExtractedPronouns: 5, // Maximum extracted pronouns to return (increased for better context)
  maxSnippetLength: 200, // Maximum snippet length for context extraction
  // Confidence calculation weights
  baseConfidence: 0.3, // Base confidence for fallback descriptions
  searchBaseConfidence: 0.6, // Base confidence for search-based descriptions
  keywordWeight: 0.03, // Weight per keyword in confidence calculation
  phraseWeight: 0.05, // Weight per phrase in confidence calculation (higher = more specific)
  verbWeight: 0.04, // Weight per verb in confidence calculation
  nounWeight: 0.03, // Weight per noun in confidence calculation
  pronounWeight: 0.01, // Weight per pronoun in confidence calculation
  resultCountWeight: 0.02, // Weight per search result in confidence calculation
  maxConfidence: 0.95, // Maximum confidence value
  highConfidenceThreshold: 0.7, // Confidence threshold for high-quality descriptions (used in UI to indicate source)
  // Fallback confidence weights
  fallbackKeywordWeight: 0.2, // Weight per keyword in fallback confidence
  fallbackVerbWeight: 0.15, // Weight per verb in fallback confidence
  fallbackMaxConfidence: 0.9, // Maximum confidence for fallback descriptions
  // Database cache
  cacheQueryLimit: 1, // Limit for cache query results
  initialHitCount: 1, // Initial hit count for new cache entries
  defaultHitCount: 0, // Default hit count if not set
  // Description display limits (for UI text generation)
  maxDisplayItemsSingle: 1, // Maximum items to display when showing single item
  maxDisplayItemsPair: 2, // Maximum items to display when showing pair
  // Domain context query modifiers for Instant Answer API searches
  domainContextModifiers: {
    business: 'professional work business',
    home: 'home maintenance household',
    personal: 'personal life self-care',
    world: 'global international travel',
    mixed: 'general',
  },
  // Text extraction from API results
  minPhraseLength: 2, // Minimum phrase length (words)
  maxPhraseLength: 5, // Maximum phrase length (words)
  minKeywordLength: 3, // Minimum keyword length (characters)
  maxKeywordLength: 20, // Maximum keyword length (characters)
  minWordFrequency: 2, // Minimum word frequency to be considered a keyword
  minWordLengthForFiltering: 3, // Minimum word length for filtering similar terms (to avoid matching very short words)
  stopWords: ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'where', 'when', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'now'],
  // Description template strings - Enhanced with more variety for better context
  descriptionTemplates: {
    involves: 'This task involves',
    focuses: 'This task focuses',
    requires: 'This task requires',
    entails: 'This task entails',
    includes: 'This task includes',
    centers: 'This task centers',
    consists: 'This task consists',
    aims: 'This task aims',
    targets: 'This task targets',
    addresses: 'This task addresses',
    covers: 'This task covers',
    encompasses: 'This task encompasses',
    concerns: 'This task concerns',
    relates: 'This task relates',
    revolves: 'This task revolves',
    emphasizes: 'This task emphasizes',
    prioritizes: 'This task prioritizes',
    concentrates: 'This task concentrates',
    specializes: 'This task specializes',
    deals: 'This task deals',
    handles: 'This task handles',
    manages: 'This task manages',
    organizes: 'This task organizes',
    coordinates: 'This task coordinates',
    facilitates: 'This task facilitates',
    supports: 'This task supports',
    enables: 'This task enables',
    ensures: 'This task ensures',
    maintains: 'This task maintains',
    improves: 'This task improves',
    enhances: 'This task enhances',
    optimizes: 'This task optimizes',
    streamlines: 'This task streamlines',
  },
  // Domain-specific guidance messages
  domainGuidance: {
    business: 'Apply professional standards, best practices, and ensure efficiency in execution.',
    home: 'Follow established home maintenance methods and organize your living space effectively.',
    personal: 'Take a thoughtful and personal approach, prioritizing your well-being and preferences.',
    world: 'Consider global perspectives, cultural contexts, and broader implications.',
    mixed: 'Balance multiple aspects and consider different perspectives.',
  },
  // Description separator for appending
  descriptionSeparator: '\n\n', // Separator when appending descriptions
  // Term priority weights for combining terms in descriptions
  termPriority: {
    phrase: 10, // Highest priority for phrases (most specific)
    keyword: 7, // Medium-high priority for keywords
    verb: 5, // Medium priority for verbs
    noun: 3, // Lower priority for nouns
  },
  // Maximum secondary terms to combine in description
  maxSecondaryTerms: 4, // Combine up to 4 terms (1 primary + 3 secondary)
  // Sentence scoring weights for context selection
  sentenceScoring: {
    phraseWeight: 3, // Highest weight for phrases in sentence scoring
    keywordWeight: 2, // Medium-high weight for keywords
    verbWeight: 1, // Medium weight for verbs
    nounWeight: 1, // Medium weight for nouns
  },
  // Truncation threshold for sentence truncation
  truncationThreshold: 0.8, // Use word boundary if truncation point is within 80% of max length
  // String separators for description building
  descriptionSeparators: {
    comma: ', ',
    commaAnd: ', and ',
    period: '. ',
    ellipsis: '...',
  },
  // Context extraction multipliers
  contextMultiplier: 2, // Multiplier for context length (allows more context for better sentence extraction)
  topTermsMultiplier: 2, // Multiplier for top terms when building search queries
  sentenceLengthMultiplier: 2, // Multiplier for max sentence length when extracting from context
  maxSearchResultsForContext: 15, // Maximum number of search results to use for context (increased for better coverage)
  maxDirectSearchResultsForContext: 5, // Maximum search results to use when building direct context from search results
  maxActionWordsForFiltering: 7, // Maximum action words to check when filtering verbs
  maxContextKeywordsForFallback: 2, // Maximum keywords to use as context in fallback descriptions
  // Sentence scoring bonuses and penalties
  sentenceScoringBonuses: {
    multipleKeywords2: 10, // Bonus for sentences with 2+ keywords
    multipleKeywords3: 15, // Bonus for sentences with 3+ keywords
    keywordsAndPhrases: 20, // Bonus for sentences with both keywords and phrases
    wellFormedSentence: 5, // Bonus for sentences 30-120 chars (well-formed)
    shortSentencePenalty: -5, // Penalty for sentences < 20 chars (fragments)
  },
  // Sentence length thresholds
  sentenceLengthThresholds: {
    wellFormedMin: 30, // Minimum length for well-formed sentence bonus
    wellFormedMax: 120, // Maximum length for well-formed sentence bonus
    fragmentMax: 20, // Maximum length to be considered a fragment (penalty)
    chunkMinWords: 5, // Minimum words for meaningful chunk extraction
    chunkMaxWords: 20, // Maximum words to extract as chunk
    minLenFallback: 10, // Fallback minimum length when reducing minSentenceLength
    minLenReduction: 5, // Amount to reduce minSentenceLength for lenient extraction
    contextBoostThreshold: 20, // Minimum context length for smaller confidence boost
    descriptionTooShortThreshold: 15, // Minimum description length to not be considered "too short" (reduced to allow concise but effective descriptions)
    directContextMinLength: 20, // Minimum length for using direct context from search results
    contextPreviewLength: 200, // Maximum length for context preview in logging
    searchResultPreviewLength: 100, // Maximum length for search result preview in logging
  },
  // Action words for task descriptions
  actionWords: {
    find: 'find',
    search: 'search',
    buy: 'buy',
    get: 'get',
    research: 'research',
    compare: 'compare',
    purchase: 'purchase',
    locate: 'locate',
    identify: 'identify',
    shop: 'shop',
    select: 'select',
  },
  // Action word detection list (for filtering verbs)
  actionWordList: ['find', 'search', 'research', 'compare', 'buy', 'purchase', 'get', 'locate', 'identify', 'shop', 'select'],
  // Context filtering stop words (words to exclude when adding context)
  contextFilterStopWords: ['a', 'an', 'the', 'our', 'for', 'auto'],
  // Preferred context words (words that add value when used as context)
  preferredContextWords: {
    home: ['home', 'house', 'household'],
    business: ['work', 'office', 'business'],
    personal: ['personal', 'self', 'individual'],
  },
  // Domain phrase matching thresholds
  domainPhraseMatching: {
    minKeywordsForMatch: 2, // Minimum keywords a phrase must contain to match
    minLengthForSingleKeyword: 12, // Minimum length if phrase has only 1 keyword
  },
  // Keyword extraction limits for fallback
  fallbackKeywordLimits: {
    maxKeywordsForDescription: 3, // Maximum keywords to use in fallback description
    maxKeywordsForContext: 2, // Maximum keywords to use as context
  },
  // Punctuation patterns
  sentenceEndPattern: /[.!?]$/, // Pattern to check if sentence ends with punctuation
  whitespacePattern: /\s+/g, // Pattern to match multiple whitespace
  // Description source labels (for UI display)
  sourceLabels: {
    browserAI: 'browser AI',
    localTerminology: 'local terminology',
  },
  // Description connector words - Enhanced with more natural connectors for better context flow
  // English articles for proper grammar
  articles: {
    indefinite: {
      a: 'a',
      an: 'an',
    },
    definite: 'the',
  },
  descriptionConnectors: {
    // Primary connectors
    involving: 'involving',
    relatedTo: 'related to',
    for: 'for',
    and: 'and',
    or: 'or',
    with: 'with',
    through: 'through',
    by: 'by',
    via: 'via',
    using: 'using',
    including: 'including',
    about: 'about',
    regarding: 'regarding',
    concerning: 'concerning',
    focusing: 'focusing',
    centered: 'centered',
    aimed: 'aimed',
    targeting: 'targeting',
    designed: 'designed',
    intended: 'intended',
    // Prepositions
    to: 'to',
    in: 'in',
    within: 'within',
    across: 'across',
    throughout: 'throughout',
    on: 'on',
    toward: 'toward',
    towards: 'towards',
    around: 'around',
    upon: 'upon',
    of: 'of',
    from: 'from',
    among: 'among',
    alongside: 'alongside',
    beside: 'beside',
    beyond: 'beyond',
    behind: 'behind',
    beneath: 'beneath',
    between: 'between',
    during: 'during',
    except: 'except',
    versus: 'versus',
    against: 'against',
    despite: 'despite',
    regardless: 'regardless',
    respecting: 'respecting',
    touching: 'touching',
    considering: 'considering',
    following: 'following',
    preceding: 'preceding',
    // Logical connectors
    together: 'together',
    separately: 'separately',
    independently: 'independently',
    collectively: 'collectively',
    individually: 'individually',
    respectively: 'respectively',
    alternatively: 'alternatively',
    additionally: 'additionally',
    furthermore: 'furthermore',
    moreover: 'moreover',
    likewise: 'likewise',
    similarly: 'similarly',
    conversely: 'conversely',
    nevertheless: 'nevertheless',
    nonetheless: 'nonetheless',
    however: 'however',
    therefore: 'therefore',
    thus: 'thus',
    hence: 'hence',
    consequently: 'consequently',
    accordingly: 'accordingly',
    subsequently: 'subsequently',
    previously: 'previously',
    initially: 'initially',
    finally: 'finally',
    ultimately: 'ultimately',
    eventually: 'eventually',
    // Emphasis modifiers (for context enhancement)
    specifically: 'specifically',
    particularly: 'particularly',
    especially: 'especially',
    primarily: 'primarily',
    mainly: 'mainly',
    mostly: 'mostly',
    largely: 'largely',
    entirely: 'entirely',
    completely: 'completely',
    fully: 'fully',
    partially: 'partially',
    somewhat: 'somewhat',
    rather: 'rather',
    quite: 'quite',
    very: 'very',
    extremely: 'extremely',
    highly: 'highly',
    significantly: 'significantly',
    substantially: 'substantially',
    considerably: 'considerably',
    relatively: 'relatively',
    comparatively: 'comparatively',
    differently: 'differently',
  },
  // Generic verbs that indicate low-quality descriptions
  genericVerbs: ['find', 'get', 'do', 'make', 'use', 'have'],
  // Contextual action words that add meaning to descriptions
  contextualActionWords: ['ensure', 'maintain', 'improve', 'create', 'develop', 'achieve', 'follow', 'use', 'optimize', 'enhance', 'resolve', 'implement', 'coordinate'],
  // Similarity detection thresholds
  similarityThresholds: {
    wordOverlapRatio: 0.8, // 80% word overlap indicates too similar
    maxWordDifference: 2, // Maximum word difference when checking similarity
    minPhraseLength: 10, // Minimum phrase length for domain phrases
    minKeywordLength: 3, // Minimum keyword length for filtering
    maxGenericWordCount: 3, // Maximum word count for generic descriptions
  },
  // Context boost values
  contextBoost: {
    high: 0.1, // Boost for high context length
    medium: 0.05, // Boost for medium context length
  },
  // Array slice limits for description building (increased to allow richer, more comprehensive descriptions)
  sliceLimits: {
    keywords: 5, // Maximum keywords to use in description parts (increased from 2 for richer context)
    keywordsExtended: 6, // Extended limit for keywords (increased from 3)
    keywordsLogging: 10, // Limit for logging/debugging (increased from 5)
    keywordsMaxJoin: 2, // Maximum keywords to join with "and" to avoid long chains (e.g., "keyword1 and keyword2")
    phrases: 4, // Maximum phrases to use in description parts (increased from 2 for richer context)
    phrasesLogging: 6, // Limit for logging/debugging (increased from 3)
    verbs: 4, // Maximum verbs to use in description parts (increased from 2 for richer context)
    verbsLogging: 6, // Limit for logging/debugging (increased from 3)
    nouns: 4, // Maximum nouns to use in description parts (increased from 2 for richer context)
    nounsSingle: 2, // Single noun limit (increased from 1)
    nounsMaxJoin: 2, // Maximum nouns to join with "and" to avoid long chains (e.g., "noun1 and noun2")
    nounsLogging: 6, // Limit for logging/debugging (increased from 3)
    domainTerms: 6, // Maximum domain terms to use (increased from 3 for richer context)
  },
  // Research task detection and phrase combination
  researchTask: {
    keywords: ['research', 'find', 'search', 'compare', 'purchase', 'buy', 'select', 'choose'], // Keywords that indicate research/comparison tasks
    phraseIndicators: ['research', 'compare', 'purchase', 'best options', 'quality and price', 'informed'], // Phrases that indicate research-related contextual phrases
    phraseConnectors: {
      researchCompare: ['research', 'compare'], // Phrases that connect research + compare
      comparePurchase: ['compare', 'purchase'], // Phrases that connect compare + purchase
    },
    minPhrasesForCombination: 2, // Minimum number of research phrases needed to combine
  },
  // Length thresholds for phrase/term matching
  lengthThresholds: {
    phraseKeywordBuffer: 2, // Buffer for phrase length vs keyword length
    minDirectSubstring: 3, // Minimum length for direct substring check
    minTaskNameSubstring: 5, // Minimum length for task name substring check
    minPhraseWords: 2, // Minimum words in phrase for context
    minPhraseSubstring: 5, // Minimum phrase length for substring check
  },
  // Word similarity thresholds for fuzzy matching
  wordSimilarity: {
    exactMatch: 1.0, // Exact word match similarity
    substringMatch: 0.8, // Substring match similarity (word contains another)
    exactStemMatch: 0.7, // Exact stem match similarity (same base word)
    partialStemMatch: 0.5, // Partial stem match similarity (stem contains another)
    relationshipThreshold: 0.6, // Minimum similarity threshold for word relationship
  },
  // Variation configuration for description generation
  variation: {
    threshold: 0.3, // Threshold for variation seed (70% chance to use variation when seed > 0.3)
  },
  // Sentence structure improvements
  sentenceStructure: {
    // Connector selection based on template type
    templateConnectors: {
      aims: ['to', 'toward', 'at'],
      targets: ['to', 'toward', 'at'],
      focuses: ['on', 'around', 'upon'],
      centers: ['on', 'around', 'upon'],
      requires: ['for', 'of', 'from'],
      entails: ['for', 'of', 'from'],
      includes: ['with', 'among', 'within'],
      consists: ['of', 'in', 'with'],
      addresses: ['regarding', 'concerning', 'about'],
      covers: ['including', 'encompassing', 'involving'],
      encompasses: ['including', 'covering', 'involving'],
      involves: ['in', 'with', 'through'],
      concerns: ['regarding', 'concerning', 'about'],
      relates: ['to', 'with', 'regarding'],
      revolves: ['around', 'about', 'concerning'],
      emphasizes: ['on', 'upon', 'regarding'],
      prioritizes: ['over', 'above', 'before'],
      concentrates: ['on', 'upon', 'around'],
      specializes: ['in', 'on', 'regarding'],
      deals: ['with', 'in', 'regarding'],
      handles: ['with', 'for', 'regarding'],
      manages: ['through', 'with', 'by'],
      organizes: ['for', 'around', 'by'],
      coordinates: ['with', 'among', 'between'],
      facilitates: ['through', 'by', 'with'],
      supports: ['through', 'by', 'with'],
      enables: ['through', 'by', 'via'],
      ensures: ['through', 'by', 'via'],
      maintains: ['through', 'by', 'via'],
      improves: ['through', 'by', 'via'],
      enhances: ['through', 'by', 'via'],
      optimizes: ['for', 'through', 'by'],
      streamlines: ['through', 'by', 'via'],
    },
    // Natural transitions for multi-clause sentences
    transitions: {
      addition: ['additionally', 'furthermore', 'moreover', 'also'],
      contrast: ['however', 'although', 'while', 'whereas'],
      cause: ['because', 'since', 'as', 'due to'],
      purpose: ['to', 'in order to', 'so as to', 'for'],
      result: ['resulting in', 'leading to', 'which results in'],
    },
    // Domain-specific sentence patterns
    domainPatterns: {
      business: {
        emphasis: ['professional', 'strategic', 'efficient', 'systematic'],
        outcomes: ['success', 'results', 'objectives', 'goals'],
      },
      home: {
        emphasis: ['practical', 'organized', 'maintained', 'comfortable'],
        outcomes: ['functionality', 'comfort', 'organization', 'maintenance'],
      },
      personal: {
        emphasis: ['meaningful', 'fulfilling', 'balanced', 'well-being'],
        outcomes: ['growth', 'satisfaction', 'wellness', 'development'],
      },
      world: {
        emphasis: ['global', 'international', 'cultural', 'diverse'],
        outcomes: ['understanding', 'coordination', 'communication', 'collaboration'],
      },
    },
  },
} as const;

/**
 * AI function explanation text
 */
export const AI_FUNCTION_EXPLANATION = {
  TITLE: "How AI Schedules Tasks:",
  getDescription: (maxHoursPerDay: number, schedulingPeriodDays: number) => {
    // Build description of daily hour limit options dynamically (no hardcode)
    const hourOptionsList = Object.values(AI_DAILY_HOUR_OPTIONS);
    const hourOptionsCount = hourOptionsList.length;
    const hourOptions = hourOptionsList.map(hours => {
      const labels = AI_DAILY_HOUR_LABELS[hours as keyof typeof AI_DAILY_HOUR_LABELS];
      return `${hours}hr (${labels.description.toLowerCase()})`;
    }).join(', ');
    
    return `The AI scheduler analyzes each task's action verbs, complexity, and priority to estimate duration, then sorts by priority and due dates—scheduling urgent tasks first while respecting your calendar and enforcing your daily work hour limit (currently ${maxHoursPerDay} hours). Tasks are scheduled within your defined category hours, separating weekday and weekend schedules, and you can choose from ${hourOptionsCount} daily hour limits: ${hourOptions}. Tasks are distributed across available days starting from tomorrow, finding optimal time slots within your configured work hours. If a day exceeds your limit, you'll be consulted before proceeding, and tasks that can't be scheduled within ${schedulingPeriodDays} days are flagged for manual scheduling. You can reschedule entire days, weeks, or months with one click, and all schedules can be manually adjusted anytime.`;
  },
  DEFAULT_WORK_HOURS_EXAMPLE: "9 AM-5 PM", // Example work hours for display
} as const;

/**
 * Minimum hours requirement per day
 * Default: 5 hours (same as max for efficient packing)
 * TODO: Make this user-configurable
 */
export const MIN_HOURS_PER_DAY = 5;

/**
 * Warning threshold for daily hours
 * Shows warning when hours reach this threshold
 * Default: 4 hours
 */
export const DAILY_HOURS_WARNING_THRESHOLD = 4;

// ============================================================================
// Date Range Configuration
// ============================================================================

/**
 * Default scheduling period in days
 * Default: 14 days (two weeks)
 * TODO: Make this user-configurable
 */
export const DEFAULT_SCHEDULING_PERIOD_DAYS = 14;

/**
 * Default rescheduling period for week view
 * Default: 7 days
 */
export const DEFAULT_WEEK_RESCHEDULE_DAYS = 7;

/**
 * Days to add for two-week period calculation
 * (tomorrow + 13 days = 14 days total)
 */
export const TWO_WEEK_DAYS_OFFSET = 13;

/**
 * Days to add for one week period calculation
 * (start date + 6 days = 7 days total)
 */
export const ONE_WEEK_DAYS_OFFSET = 6;

// ============================================================================
// Time Configuration
// ============================================================================

/**
 * Time rounding interval in minutes
 * All times are rounded to the nearest interval
 * Default: 15 minutes
 * TODO: Make this user-configurable
 */
export const TIME_ROUNDING_INTERVAL_MINUTES = 15;

/**
 * Default time slots for task distribution
 * Used when distributing tasks across available time windows
 * Default: 5 slots
 */
export const DEFAULT_TIME_SLOTS = 5;

/**
 * Maximum attempts when finding a conflict-free time slot for recurring tasks
 * This represents the maximum number of time slots to try when checking all occurrence days
 * Default: 48 slots (12 hours * 4 slots per hour at 15-minute intervals)
 * This ensures we try enough slots to find a valid time even in busy schedules
 */
export const MAX_RECURRING_TASK_SCHEDULING_ATTEMPTS = 48;

/**
 * Number of days to distribute high priority tasks across
 * High priority tasks are distributed across the first few days using round-robin
 * Default: 3 days
 */
export const HIGH_PRIORITY_DISTRIBUTION_DAYS = 3;

// ============================================================================
// Priority-Based Time Slots
// ============================================================================

/**
 * Default time slots based on task priority
 * These are fallback times when category hours are not available
 * Uses default work hours from business-constants.ts
 */
export const PRIORITY_TIME_SLOTS = {
  urgent: { hour: parseTimeToHour(DEFAULT_WEEKDAY_WORK_START), minute: 0 },   // Work start time
  high: { hour: 11, minute: 0 },     // 11:00 AM (mid-day) - between work start and end
  medium: { hour: 11, minute: 0 },    // 11:00 AM (mid-day) - between work start and end
  low: { hour: 14, minute: 0 },     // 2:00 PM (afternoon) - between work start and end
} as const;

/**
 * Default hours for category-based scheduling when category hours are disabled
 * Uses default category hours from business-constants.ts
 */
export const DEFAULT_CATEGORY_HOURS = {
  work: parseTimeToHour(DEFAULT_WEEKDAY_WORK_START),        // Work start hour
  personal: parseTimeToHour(DEFAULT_WEEKDAY_PERSONAL_START),   // Personal start hour
  projects: parseTimeToHour(DEFAULT_WEEKDAY_PROJECTS_START),    // Projects start hour
} as const;

/**
 * Default category for tasks when category cannot be determined
 * Used as fallback when forceCategoryHours is true but task has no category tags
 */
export const DEFAULT_TASK_CATEGORY: 'work' | 'personal' | 'projects' = 'work';

// ============================================================================
// Priority Weights (for sorting)
// ============================================================================

/**
 * Priority weights for task sorting
 * Higher weight = higher priority in scheduling
 */
export const PRIORITY_WEIGHTS = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
} as const;

/**
 * Status weights for task sorting
 * Higher weight = higher priority in scheduling
 */
export const STATUS_WEIGHTS = {
  'on-hold': 1,
  todo: 2,
  'in-progress': 3,
  done: 0,
} as const;

// ============================================================================
// Duration Estimation Configuration
// ============================================================================

/**
 * Base task duration in minutes
 * Used in duration estimation formula
 * Default: 30 minutes
 */
export const BASE_TASK_DURATION_MINUTES = 30;

/**
 * Minimum task duration in minutes
 * Default: 15 minutes
 */
export const MIN_TASK_DURATION_MINUTES = 15;

/**
 * Maximum task duration in minutes
 * Default: 300 minutes (5 hours)
 */
export const MAX_TASK_DURATION_MINUTES = 300;

/**
 * Effort score normalization divisor
 * Used to normalize effort scores (1-5 scale)
 * Default: 2.5 (middle of 1-5 scale)
 */
export const EFFORT_NORMALIZATION_DIVISOR = 2.5;

/**
 * Effort score thresholds for action plan and description generation
 * Used to determine detail level and complexity based on effort
 */
export const EFFORT_SCORE_THRESHOLDS = {
  // Default effort score when not provided
  DEFAULT: 2.5,
  // Minimum valid effort score
  MIN: 1,
  // Maximum valid effort score
  MAX: 5,
  // High effort threshold (3+) - uses keywords + nouns for context
  HIGH: 3,
  // Very high effort threshold (4+) - uses contextual phrases for detailed actions
  VERY_HIGH: 4,
  // Low effort threshold (2-) - uses simple verb + noun
  LOW: 2,
  // Medium effort threshold (3-) - uses verb + noun
  MEDIUM: 3,
} as const;

/**
 * Complexity score normalization divisor
 * Used to normalize complexity scores (1-5 scale)
 * Default: 2.5 (middle of 1-5 scale)
 */
export const COMPLEXITY_NORMALIZATION_DIVISOR = 2.5;

/**
 * Priority multipliers for duration estimation
 * Applied to base duration based on task priority
 */
export const PRIORITY_MULTIPLIERS = {
  urgent: 0.7,
  high: 1.0,
  medium: 1.5,
  low: 2.0,
} as const;

// ============================================================================
// Category Tags Configuration
// ============================================================================

/**
 * Category tag names used for task categorization
 * TODO: These should be dynamic based on user's actual tags
 */
export const CATEGORY_TAGS = {
  work: ['work'],
  personal: ['personal'],
  projects: ['projects', 'project'],
} as const;

// ============================================================================
// Weekend Configuration
// ============================================================================

/**
 * Weekend day indices (JavaScript Date.getDay() values)
 * Sunday = 0, Saturday = 6
 */
export const WEEKEND_DAYS = {
  sunday: 0,
  saturday: 6,
} as const;

// ============================================================================
// AI Usage Limits
// ============================================================================

/**
 * Weekly limit for AI scheduler usage (free tier)
 * Default: 3 suggestions per week
 * TODO: This should come from subscription tier configuration
 */
export const FREE_TIER_WEEKLY_AI_LIMIT = 3;

/**
 * LocalStorage key for AI scheduler usage tracking
 */
export const AI_USAGE_STORAGE_KEY = 'ai_scheduler_usage';

// ============================================================================
// Browser AI Task Breakdown Configuration
// ============================================================================

/**
 * Debounce delay for real-time task breakdown analysis (milliseconds)
 */
export const TASK_BREAKDOWN_DEBOUNCE_MS = 300;
export const DESCRIPTION_OPTIONS_DEBOUNCE_MS = 500; // Debounce delay for generating description options after breakdown is ready

/**
 * Maximum cache size for task breakdown results
 */
export const TASK_BREAKDOWN_CACHE_SIZE = 100;

/**
 * Domain detection confidence thresholds
 */
export const DOMAIN_DETECTION_THRESHOLDS = {
  MIN_CONFIDENCE: 0.1, // Minimum confidence to return a domain
  MIXED_THRESHOLD: 0.5, // Below this, mark as mixed if multiple domains are close (increased from 0.4)
  MIXED_SIMILARITY: 0.7, // Second domain must be at least this % of top domain to be mixed
  CONTEXT_PROXIMITY: 3, // Maximum word distance for context scoring (words within 3 positions get bonus)
  CONTEXT_BONUS: 0.5, // Bonus multiplier for context-aware matches
} as const;

/**
 * Domain detection scoring weights
 */
export const DOMAIN_SCORING_WEIGHTS = {
  KEYWORD: 1.0, // Weight for keyword matches
  PHRASE: 2.0, // Weight for phrase matches (more specific)
  VERB: 1.5, // Weight for verb matches (action-oriented)
  CONTEXT_KEYWORD: 1.5, // Weight for context-specific keywords (higher priority)
  CONTEXT_PHRASE: 3.0, // Weight for context-specific phrases (highest priority)
} as const;

/**
 * Sequential indicators for detecting step-by-step tasks in descriptions
 * Used to identify tasks that have natural sequential structure
 */
export const SEQUENTIAL_INDICATORS = [
  'first', 'then', 'next', 'after', 'before', 'finally', 'last',
  'step 1', 'step 2', 'step 3', 'phase 1', 'phase 2',
  'start with', 'begin by', 'end with', 'finish by'
] as const;

/**
 * Action plan time distribution percentages
 */
export const ACTION_PLAN_TIME_DISTRIBUTION = {
  PREPARATION: {
    BUSINESS_MEETING: 0.2,
    BUSINESS_REPORT: 0.25,
    HOME_REPAIR: 0.15,
    HOME_CLEANING: 0.1,
    PERSONAL_EXERCISE: 0.1,
    PERSONAL_TRAVEL: 0.3,
    WORLD_TRAVEL: 0.2,
    WORLD_CALL: 0.15,
    GENERIC: 0.2,
  },
  EXECUTION: {
    BUSINESS: 0.6,
    HOME: 0.7,
    PERSONAL: 0.7,
    WORLD: 0.6,
    GENERIC: 0.6,
  },
  FOLLOW_UP: {
    BUSINESS_MEETING: 0.15,
    BUSINESS_REPORT: 0.15,
    HOME_CLEANING: 0.15,
    PERSONAL_EXERCISE: 0.2,
    GENERIC: 0.2,
  },
} as const;

/**
 * Action plan configuration
 */
export const ACTION_PLAN_CONFIG = {
  // Default minutes for empty tasks or when time estimation is 0
  DEFAULT_MINUTES: MIN_TASK_DURATION_MINUTES, // 15 minutes (uses existing constant)
  // Minimum minutes per step when totalMinutes is 0
  MIN_MINUTES_PER_STEP: 1,
  // Maximum steps to display in task card
  MAX_STEPS_DISPLAY: {
    SHORT_TASK: 1, // For tasks <= 15 minutes
    NORMAL_TASK: 3, // For tasks > 15 minutes
  },
  // Threshold for short tasks (in minutes)
  SHORT_TASK_THRESHOLD_MINUTES: MIN_TASK_DURATION_MINUTES, // 15 minutes
} as const;

/**
 * Description analysis complexity thresholds
 */
export const DESCRIPTION_COMPLEXITY_THRESHOLDS = {
  COMPLEX: {
    WORD_COUNT: 50,
    CHAR_COUNT: 300,
  },
  MODERATE: {
    WORD_COUNT: 20,
    CHAR_COUNT: 100,
  },
  MIN_DESCRIPTION_LENGTH: 20, // Minimum chars to suggest enhancement
  MIN_PHRASE_LENGTH: 5, // Minimum chars for phrase extraction
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a date is a weekend
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === WEEKEND_DAYS.sunday || day === WEEKEND_DAYS.saturday;
}

/**
 * Get category from task tags
 */
export function getCategoryFromTags(tags: string[]): 'work' | 'personal' | 'projects' | null {
  if (!tags || tags.length === 0) return null;
  
  const tagLower = tags.map(t => t.toLowerCase());
  
  if (CATEGORY_TAGS.work.some(tag => tagLower.includes(tag))) return 'work';
  if (CATEGORY_TAGS.personal.some(tag => tagLower.includes(tag))) return 'personal';
  if (CATEGORY_TAGS.projects.some(tag => tagLower.includes(tag))) return 'projects';
  
  return null;
}

