/**
 * Description Generator
 * 
 * Generates task descriptions based on task name using Browser AI
 * with domain-specific terminology, keywords, verbs, and action words.
 * Browser AI extracts terms directly from the task name.
 * Local Terminology acts as a cache/dictionary to enhance extracted terms.
 */

import { detectDomain, type Domain, getDomainTerminology, getDomainTerminologyAsync, saveNewTerminologyToLibrary, DOMAIN_TERMINOLOGIES } from './domain-terminology';
import { DESCRIPTION_GENERATION_CONFIG, DESCRIPTION_DEDUPLICATION_CONFIG, DESCRIPTION_OPTIONS_CONFIG, DOMAIN_EXCLUSION_TERMS } from './ai-config';
import { logger } from './logger';
import { DEFAULT_TASK_DOMAIN } from './task-constants';
import { API_BASE } from './api-base';

/**
 * Clean HTML/CSS fragments and invalid characters from text
 * Removes HTML tags, CSS properties, and other fragments that shouldn't be in descriptions
 */
function cleanText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  // Remove HTML tags and fragments - more aggressive cleaning
  let cleaned = text
    // Remove HTML tags first
    .replace(/<[^>]*>/g, '')
    // Remove style attributes and their values
    .replace(/style\s*=\s*["'][^"']*["']/gi, '')
    // Remove CSS property fragments (more comprehensive) - CRITICAL: Remove text-indent and other CSS properties
    .replace(/text-indent\s*:\s*[^;]+;?/gi, '') // Remove text-indent CSS property
    .replace(/text-indent\s*:\s*code/gi, '') // Remove "text-indent:code" specifically
    .replace(/text-indent[^;]*;?/gi, '') // Remove any text-indent variations
    .replace(/\d+px;?/gi, '') // Remove any pixel values like "12px;", "10px", etc.
    .replace(/font-size\s*:\s*[^;]+;?/gi, '')
    .replace(/color\s*:\s*[^;]+;?/gi, '')
    .replace(/font-family\s*:\s*[^;]+;?/gi, '')
    .replace(/line-height\s*:\s*[^;]+;?/gi, '')
    // Remove CSS property names that might appear as text
    .replace(/\btext-indent\b/gi, '') // Remove standalone "text-indent" word
    .replace(/\bcode\s*:\s*/gi, '') // Remove "code:" patterns
    // Remove quote and bracket fragments (more patterns)
    .replace(/["']>/g, '')
    .replace(/;\s*>/g, '')
    .replace(/">/g, '')
    .replace(/;">/g, '')
    .replace(/px;">/gi, '')
    .replace(/px;?">/gi, '')
    // Remove standalone quote-bracket fragments (catches ">involves" patterns)
    .replace(/\s*">\s*/g, ' ') // Remove ">" followed by text
    .replace(/\s*">/g, '') // Remove trailing ">
    .replace(/">\s*/g, ' ') // Remove leading ">
    // Remove any remaining HTML-like fragments
    .replace(/&[a-z]+;/gi, '') // Remove HTML entities
    .replace(/&#\d+;/g, '') // Remove numeric HTML entities
    // Remove duplicate fragments that might have been created
    .replace(/(12px;?\s*">?\s*)+/gi, '') // Remove repeated "12px;">" patterns
    .replace(/(px;?\s*">?\s*)+/gi, '') // Remove any repeated "px;">" patterns
    // Remove price range patterns that might have leaked through
    .replace(/\b\d+k-\d+k\b/gi, '') // Remove "10k-15k" patterns
    .replace(/\b\d+-\d+\s*k\b/gi, '') // Remove "10-15k" patterns
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
  
  // Additional pass to catch any remaining fragments
  cleaned = cleaned
    .replace(/text-indent[^;]*;?/gi, '') // Remove any remaining text-indent
    .replace(/\btext-indent\b/gi, '') // Remove standalone text-indent
    .replace(/px;?/gi, '') // Remove any remaining px fragments
    .replace(/">/g, '') // Remove any remaining quote-bracket fragments
    .replace(/;\s*>/g, '') // Remove any remaining semicolon-bracket fragments
    .replace(/\s*>\s*/g, ' ') // Remove any standalone > characters
    .replace(/\s+/g, ' ') // Normalize whitespace again
    .trim();
  
  // Remove duplicate words/phrases (fixes "tesing task involves tesing" issues)
  const words = cleaned.split(/\s+/);
  const uniqueWords: string[] = [];
  const seenWords = new Set<string>();
  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase();
    // Allow same word if it's more than 3 words apart (natural repetition)
    if (!seenWords.has(word) || (i > 0 && words[i-1]?.toLowerCase() !== word)) {
      uniqueWords.push(words[i]);
      seenWords.add(word);
    } else if (i > 0 && words[i-1]?.toLowerCase() === word) {
      // Skip immediate duplicates
      continue;
    } else {
      uniqueWords.push(words[i]);
    }
  }
  cleaned = uniqueWords.join(' ').trim();
  
  // Final validation: if the cleaned text is mostly fragments, return empty
  const fragmentPatterns = /(px|">|;>|font-size|color:|text-indent)/gi;
  const fragmentMatches = (cleaned.match(fragmentPatterns) || []).length;
  const wordCount = cleaned.split(/\s+/).filter(w => w.length >= DESCRIPTION_GENERATION_CONFIG.minWordLength).length;
  if (fragmentMatches > wordCount) {
    return ''; // Too many fragments, likely invalid
  }
  
  return cleaned;
}

/**
 * Fix run-ons only: leave well-structured descriptions (sentence or paragraph) as-is.
 * Only trim when a single "sentence" is clearly a run-on (e.g. 40+ words or 2+ " and " in one clause).
 */
function trimRunOnOnly(description: string): string {
  if (!description || typeof description !== 'string') return description;
  const trimmed = description.trim();
  if (!trimmed) return trimmed;
  const rules = DESCRIPTION_GENERATION_CONFIG.descriptionRules;
  const maxWordsPerSentence = rules?.maxWordsPerSentence ?? 25;

  const sentences = trimmed.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
  if (sentences.length === 0) return trimmed;
  const result: string[] = [];
  for (const sent of sentences) {
    const words = sent.split(/\s+/).filter(w => w.length > 0);
    if (words.length <= maxWordsPerSentence) {
      result.push(sent.endsWith('.') ? sent : sent + '.');
      continue;
    }
    const andMatches = sent.match(/\s+,?\s+and\s+/gi);
    const isRunOn = words.length > 40 || (andMatches && andMatches.length >= 2);
    if (!isRunOn) {
      result.push(sent.endsWith('.') ? sent : sent + '.');
      continue;
    }
    const firstAnd = sent.search(/\s+,?\s+and\s+/i);
    const firstClause = firstAnd > 0 ? sent.slice(0, firstAnd).trim() : sent;
    const clauseWords = firstClause.split(/\s+/).filter(w => w.length > 0);
    const capped = clauseWords.length > maxWordsPerSentence
      ? clauseWords.slice(0, maxWordsPerSentence).join(' ').trim()
      : firstClause;
    result.push(capped.endsWith('.') ? capped : capped + '.');
  }
  return result.join(' ').trim();
}

/**
 * Analyze task name structure to extract main action and object
 * This helps build more contextual sentences that relate directly to the task
 */
function analyzeTaskNameStructure(
  taskName: string,
  extractedVerbs: string[],
  extractedNouns: string[]
): {
  mainAction: string | null;
  mainObject: string | null;
  taskType: 'action' | 'noun' | 'phrase' | 'mixed';
  hasExplicitAction: boolean;
} {
  const taskNameLower = taskName.toLowerCase();
  const taskWords = taskNameLower.split(/\s+/).filter(w => w.length >= DESCRIPTION_GENERATION_CONFIG.minWordLength);
  
  // Check if task name starts with an action verb
  const actionVerbs = ['find', 'search', 'research', 'compare', 'buy', 'purchase', 'get', 'locate', 'identify', 'shop', 'select', 'create', 'update', 'delete', 'manage', 'organize', 'plan', 'schedule', 'review', 'analyze', 'evaluate', 'implement', 'develop', 'design', 'build', 'write', 'read', 'study', 'learn', 'teach', 'prepare', 'cook', 'clean', 'repair', 'fix', 'install', 'setup', 'configure'];
  const firstWord = taskWords[0];
  const hasExplicitAction = actionVerbs.some(verb => firstWord === verb || firstWord.startsWith(verb));
  
  // Extract main action from task name or extracted verbs
  let mainAction: string | null = null;
  if (hasExplicitAction) {
    mainAction = firstWord;
  } else if (extractedVerbs.length > 0) {
    // Use extracted verb that appears in task name
    const verbInTask = extractedVerbs.find(v => taskNameLower.includes(v.toLowerCase()));
    mainAction = verbInTask || extractedVerbs[0];
  }
  
  // Extract main object/noun from task name
  let mainObject: string | null = null;
  // Look for nouns in task name (words that aren't verbs or common words)
  const commonWords = ['the', 'a', 'an', 'for', 'to', 'of', 'in', 'on', 'at', 'by', 'with', 'from', 'and', 'or', 'but'];
  const potentialObjects = taskWords.filter(w => 
    !commonWords.includes(w) && 
    !actionVerbs.some(av => w === av || w.startsWith(av)) &&
    w.length >= 3
  );
  
  if (potentialObjects.length > 0) {
    // Prefer longer, more specific words
    mainObject = potentialObjects.sort((a, b) => b.length - a.length)[0];
  } else if (extractedNouns.length > 0) {
    // Use extracted noun that relates to task
    const nounInTask = extractedNouns.find(n => taskNameLower.includes(n.toLowerCase()));
    mainObject = nounInTask || extractedNouns[0];
  }
  
  // Determine task type
  let taskType: 'action' | 'noun' | 'phrase' | 'mixed' = 'mixed';
  if (hasExplicitAction && mainObject) {
    taskType = 'action';
  } else if (mainObject && !hasExplicitAction) {
    taskType = 'noun';
  } else if (taskWords.length > 2) {
    taskType = 'phrase';
  }
  
  return {
    mainAction,
    mainObject,
    taskType,
    hasExplicitAction,
  };
}

/**
 * US English: use "an" when the word starts with a vowel SOUND, "a" otherwise.
 * Covers common exceptions (e.g. "a used car", "an hour", "a one-time", "a European").
 */
const US_ENGLISH_AN_PREFIXES = new Set([
  'hour', 'honor', 'honest', 'heir', 'honorable', 'honorary', 'honored',
  'umbrella', 'umpire', 'uncle', 'urgent', 'usher', 'utter',
  'eulogy', 'eucalyptus', 'eulogize', 'eunuch', 'eureka',
]);
const US_ENGLISH_A_PREFIXES = new Set([
  'used', 'university', 'uniform', 'union', 'unique', 'unit', 'united', 'user', 'usual', 'universe',
  'european', 'euro', 'one', 'once', 'one-time', 'one-off', 'one-way', 'one-year', 'one-day',
  'ubiquitous', 'UK', 'U.S.', 'USA',
]);

/** Words that are prepositions or not used as standalone nouns — never use "a/an X" for these (e.g. "under 15k" → "under" must not become "an under"). */
const PREPOSITIONS_NOT_AS_NOUNS = new Set([
  'under', 'over', 'above', 'below', 'from', 'to', 'for', 'with', 'by', 'in', 'on', 'at',
  'between', 'through', 'during', 'before', 'after', 'into', 'onto', 'within', 'without',
  'since', 'until', 'till', 'up', 'down', 'off', 'out', 'past', 'per', 'via', 'amid', 'among',
]);

function addArticleIfNeeded(noun: string, useDefinite: boolean = false): string {
  if (!noun || noun.trim().length === 0) return noun;

  const trimmed = noun.trim();
  const lower = trimmed.toLowerCase();
  const lowerNorm = lower.replace(/[.,;:!?]$/, '');

  // If already has an article, return as-is
  if (/^(a|an|the)\s+/i.test(trimmed)) return trimmed;

  // Prepositions: never add article (e.g. "under" in "under 15k" must not become "an under")
  if (PREPOSITIONS_NOT_AS_NOUNS.has(lowerNorm) || PREPOSITIONS_NOT_AS_NOUNS.has(lower)) return trimmed;

  // Plurals and uncountable: no indefinite article in this context
  if (lower.endsWith('s') && !lower.endsWith('ss') && !lower.endsWith('us') && !lower.endsWith('is')) {
    return trimmed;
  }

  // Numbers and numeric-looking terms: no article (strip trailing punct so "15k." is treated as 15k)
  if (/^\d+[kKmM]?$/.test(lowerNorm) || /^\d+[-–]\d+/.test(trimmed)) return trimmed;

  if (useDefinite) {
    return `${DESCRIPTION_GENERATION_CONFIG.articles.definite} ${trimmed}`;
  }

  // US English: "an" before vowel-sound words (including "an hour", "an honest")
  for (const p of US_ENGLISH_AN_PREFIXES) {
    if (lower === p || lower.startsWith(p + ' ')) {
      return `${DESCRIPTION_GENERATION_CONFIG.articles.indefinite.an} ${trimmed}`;
    }
  }
  for (const p of US_ENGLISH_A_PREFIXES) {
    if (lower === p || lower.startsWith(p + ' ')) {
      return `${DESCRIPTION_GENERATION_CONFIG.articles.indefinite.a} ${trimmed}`;
    }
  }

  const firstChar = lower[0];
  const vowels = ['a', 'e', 'i', 'o', 'u'];
  const needsAn = vowels.includes(firstChar);
  return needsAn ? `${DESCRIPTION_GENERATION_CONFIG.articles.indefinite.an} ${trimmed}` : `${DESCRIPTION_GENERATION_CONFIG.articles.indefinite.a} ${trimmed}`;
}

/**
 * Detect descriptions that list two disjoint nouns (e.g. "a search and a car", "using a car and a search")
 * which misrepresent the task. Return true so caller can replace with task-name-based description.
 */
function isPoorNounListDescription(description: string, _taskName: string): boolean {
  if (!description) return false;
  const d = description.toLowerCase();
  // Pattern: "... (verb) (a|an) X and (a|an) Y." where X,Y are single words - wrong for "search for used car"
  if (/\b(using|continuing|involving|encompassing|enables?|covers?|includes?|requires?)\s+(a|an)\s+\w+\s+and\s+(a|an)\s+\w+[\s.]/i.test(d)) return true;
  if (/\band\s+(a|an)\s+search\s+and\s+(a|an)\s+car[\s.]/i.test(d)) return true;
  if (/\band\s+(a|an)\s+car\s+and\s+(a|an)\s+search[\s.]/i.test(d)) return true;
  if (/(a|an)\s+search\s+and\s+(a|an)\s+car[\s.]/i.test(d)) return true;
  if (/(a|an)\s+car\s+and\s+(a|an)\s+search[\s.]/i.test(d)) return true;
  return false;
}

/**
 * Normalize a single sentence for US English: sentence case (first letter cap), single spaces, one trailing period.
 * Does not lowercase the rest of the sentence so numbers (e.g. 15k) and existing caps are preserved.
 */
function normalizeSentenceUSEnglish(sentence: string): string {
  if (!sentence || typeof sentence !== 'string') return sentence;
  let s = sentence.replace(/\s+/g, ' ').trim();
  if (s.length === 0) return s;
  if (s.charAt(0) === s.charAt(0).toLowerCase()) {
    s = s.charAt(0).toUpperCase() + s.slice(1);
  }
  if (!s.match(/[.!?]$/)) s += '.';
  return s;
}

/**
 * Format a list of items with proper grammar (handles singular/plural, articles, and connectors)
 */
function formatItemList(items: string[], connector: string = DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and, addArticles: boolean = false): string {
  if (!items || items.length === 0) return '';
  if (items.length === 1) {
    return addArticles ? addArticleIfNeeded(items[0]) : items[0];
  }
  if (items.length === 2) {
    const item1 = addArticles ? addArticleIfNeeded(items[0]) : items[0];
    const item2 = addArticles ? addArticleIfNeeded(items[1]) : items[1];
    return `${item1} ${connector} ${item2}`;
  }
  
  // For 3+ items, use Oxford comma
  const formatted = items.map(item => addArticles ? addArticleIfNeeded(item) : item);
  const last = formatted.pop()!;
  return `${formatted.join(', ')}, ${connector} ${last}`;
}

/**
 * Build a complete, grammatically correct sentence from components
 */
function buildCompleteSentence(
  templateOpener: string,
  verbForm: string | null,
  phrase: string | null,
  nouns: string[],
  keywords: string[],
  connector: string
): string {
  const parts: string[] = [];
  
  // Start with template opener
  parts.push(templateOpener);
  
  // Add verb form if available
  if (verbForm) {
    parts.push(verbForm);
  }
  
  // Add phrase if available (lowercase it)
  if (phrase) {
    const cleanedPhrase = cleanText(phrase).toLowerCase();
    parts.push(cleanedPhrase);
  }
  
  // Add connector
  parts.push(connector);
  
  // Add nouns or keywords with proper formatting
  if (nouns.length > 0) {
    const formattedNouns = formatItemList(nouns, DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and, true);
    parts.push(formattedNouns);
  } else if (keywords.length > 0) {
    const formattedKeywords = formatItemList(keywords, DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and, false);
    parts.push(formattedKeywords);
  }
  
  // Join and ensure proper punctuation
  let sentence = parts.join(' ').trim();
  
  // Remove duplicate connectors
  sentence = sentence.replace(/\s+(and|or|with|for|to|in|on|at)\s+\1\s+/gi, ' $1 ');
  
  // Ensure sentence ends with period
  if (!sentence.match(/[.!?]$/)) {
    sentence += '.';
  }
  
  return sentence;
}

/**
 * Filter out invalid keywords (price ranges, numbers, HTML fragments, etc.)
 */
function isValidKeyword(keyword: string): boolean {
  if (!keyword || typeof keyword !== 'string') return false;
  
  const cleaned = cleanText(keyword);
  if (!cleaned || cleaned.length < DESCRIPTION_GENERATION_CONFIG.minKeywordLength) return false;
  
  // Filter out price ranges like "10k-15k", "20k-25k", "10-15k"
  if (/^\d+k-\d+k$/i.test(cleaned)) return false;
  if (/^\d+-\d+\s*k$/i.test(cleaned)) return false;
  // Filter out single price values (max length for prices like "10k", "100k" is typically 6 chars)
  const MAX_PRICE_LENGTH = 6;
  if (/^\d+k$/i.test(cleaned) && cleaned.length <= MAX_PRICE_LENGTH) return false; // Single price like "10k"
  
  // Filter out pure numbers
  if (/^\d+$/.test(cleaned)) return false;
  
  // Filter out HTML/CSS fragments (more comprehensive)
  if (/<|>|style|px|font-size|color:|">|;>|px;|12px/i.test(cleaned)) return false;
  
  // Filter out fragments that start or end with invalid characters
  if (/^[">;]|[">;]$/.test(cleaned)) return false;
  
  // Filter out very short fragments
  if (cleaned.length < DESCRIPTION_GENERATION_CONFIG.minKeywordLength) return false;
  
  // Filter out fragments that are mostly punctuation
  const letterCount = (cleaned.match(/[a-z]/gi) || []).length;
  const MIN_LETTER_RATIO = 0.5; // At least 50% letters
  if (letterCount < cleaned.length * MIN_LETTER_RATIO) return false;
  
  return true;
}

export interface GeneratedDescription {
  description: string;
  domain: Domain;
  confidence: number;
  /** Always 'local' — descriptions use only local and shared terminology. */
  source?: 'local';
}

/** Terms that must not appear in a description unless they appear in the task name (avoids off-topic drift). */
const DESCRIPTION_OFF_TOPIC_FORBIDDEN_TERMS = [
  'milestone', 'customer', 'forecast', 'report', 'deliverable', 'proposal', 'testing',
  'workout', 'fitness', 'gym', 'exercise', 'notifications', 're-occurring',
];

/**
 * Remove sentences that contain forbidden off-topic terms unless the term appears in the task name.
 * Used as a safety net so descriptions stay contextual.
 */
export function stripOffTopicSentences(description: string, taskName: string): string {
  if (!description || typeof description !== 'string') return description;
  const taskLower = taskName.toLowerCase().trim();
  const sentences = description.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
  const kept: string[] = [];
  for (const sentence of sentences) {
    const sentLower = sentence.toLowerCase();
    const hasForbidden = DESCRIPTION_OFF_TOPIC_FORBIDDEN_TERMS.some(term => {
      if (taskLower.includes(term)) return false;
      const wordBoundary = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return wordBoundary.test(sentLower);
    });
    if (!hasForbidden) kept.push(sentence);
  }
  if (kept.length === 0) return description.trim();
  const result = kept.join('. ').trim();
  return result ? (result.match(/[.!?]$/) ? result : `${result}.`) : description.trim();
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for better fuzzy matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // deletion
          dp[i][j - 1] + 1,     // insertion
          dp[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Enhanced word similarity with conceptual relationships
 * Maps common synonyms and related concepts for better context matching
 */
const CONCEPTUAL_RELATIONSHIPS: Record<string, string[]> = {
  // Vehicle concepts
  'car': ['vehicle', 'automobile', 'auto', 'sedan', 'coupe', 'suv', 'truck', 'van'],
  'vehicle': ['car', 'automobile', 'auto', 'sedan', 'coupe', 'suv', 'truck', 'van', 'motorcycle'],
  'automobile': ['car', 'vehicle', 'auto', 'sedan', 'coupe', 'suv', 'truck'],
  'suv': ['vehicle', 'car', 'automobile', 'truck'],
  'truck': ['vehicle', 'car', 'automobile', 'suv'],
  // Research concepts
  'research': ['study', 'investigate', 'explore', 'examine', 'analyze', 'review', 'evaluate'],
  'compare': ['evaluate', 'analyze', 'review', 'examine', 'assess', 'contrast'],
  'evaluate': ['compare', 'analyze', 'review', 'assess', 'examine', 'judge'],
  'analyze': ['evaluate', 'examine', 'review', 'study', 'investigate'],
  // Purchase concepts
  'purchase': ['buy', 'acquire', 'obtain', 'get', 'shop', 'select', 'choose'],
  'buy': ['purchase', 'acquire', 'obtain', 'get', 'shop', 'select', 'choose'],
  'shop': ['purchase', 'buy', 'browse', 'select', 'choose'],
  // Organization concepts
  'organize': ['arrange', 'sort', 'order', 'systematize', 'structure', 'tidy', 'clean'],
  'clean': ['organize', 'tidy', 'clear', 'sanitize', 'disinfect', 'maintain'],
  'tidy': ['organize', 'clean', 'arrange', 'order', 'neat'],
  // Work concepts
  'work': ['office', 'professional', 'business', 'job', 'task', 'project'],
  'office': ['work', 'workspace', 'professional', 'business', 'workplace'],
  'workspace': ['office', 'work', 'desk', 'area', 'environment'],
  // Technology concepts
  'code': ['programming', 'development', 'software', 'application', 'program'],
  'software': ['code', 'application', 'program', 'system', 'platform'],
  'application': ['software', 'app', 'program', 'system', 'platform'],
};

/**
 * Check if two words are conceptually related (synonyms or related concepts)
 */
function areConceptsRelated(word1: string, word2: string): boolean {
  const w1 = word1.toLowerCase();
  const w2 = word2.toLowerCase();
  
  // Direct match
  if (w1 === w2) return true;
  
  // Check conceptual relationships
  const w1Concepts = CONCEPTUAL_RELATIONSHIPS[w1] || [];
  const w2Concepts = CONCEPTUAL_RELATIONSHIPS[w2] || [];
  
  // Check if one word is in the other's concept list
  if (w1Concepts.includes(w2) || w2Concepts.includes(w1)) return true;
  
  // Check if they share common concepts
  const sharedConcepts = w1Concepts.filter(c => w2Concepts.includes(c));
  if (sharedConcepts.length > 0) return true;
  
  // Check if one word contains a concept from the other's list
  if (w1Concepts.some(c => w2.includes(c) || c.includes(w2))) return true;
  if (w2Concepts.some(c => w1.includes(c) || c.includes(w1))) return true;
  
  return false;
}

/**
 * Helper function for improved fuzzy matching
 * Calculates similarity score between two words using multiple algorithms
 */
function calculateWordSimilarity(word1: string, word2: string): number {
  const w1 = word1.toLowerCase();
  const w2 = word2.toLowerCase();
  if (w1 === w2) return DESCRIPTION_GENERATION_CONFIG.wordSimilarity.exactMatch;
  if (w1.includes(w2) || w2.includes(w1)) return DESCRIPTION_GENERATION_CONFIG.wordSimilarity.substringMatch;
  
  // Check conceptual relationships (synonyms, related concepts)
  if (areConceptsRelated(w1, w2)) {
    const RELATED_CONCEPT_SIMILARITY_MULTIPLIER = 0.9; // High similarity for related concepts
    return DESCRIPTION_GENERATION_CONFIG.wordSimilarity.exactMatch * RELATED_CONCEPT_SIMILARITY_MULTIPLIER;
  }
  
  // Levenshtein distance-based similarity
  const maxLen = Math.max(w1.length, w2.length);
  if (maxLen === 0) return 0;
  const distance = levenshteinDistance(w1, w2);
  const levenshteinSimilarity = 1 - (distance / maxLen);
  
  // Check for common prefixes/suffixes
  const minLen = Math.min(w1.length, w2.length);
  let commonChars = 0;
  for (let i = 0; i < minLen; i++) {
    if (w1[i] === w2[i]) commonChars++;
  }
  const prefixSimilarity = commonChars / Math.max(w1.length, w2.length);
  
  // Enhanced stem similarity (remove common suffixes and check)
  const stem1 = w1.replace(/(ing|ed|s|es|er|est|ly|tion|sion|ment|ness|ity|able|ible)$/, '');
  const stem2 = w2.replace(/(ing|ed|s|es|er|est|ly|tion|sion|ment|ness|ity|able|ible)$/, '');
  const stemMatch = stem1 === stem2 
    ? DESCRIPTION_GENERATION_CONFIG.wordSimilarity.exactStemMatch 
    : (stem1.includes(stem2) || stem2.includes(stem1) 
        ? DESCRIPTION_GENERATION_CONFIG.wordSimilarity.partialStemMatch 
        : 0);
  
  // Return the maximum similarity from all methods
  return Math.max(levenshteinSimilarity, prefixSimilarity, stemMatch);
}

/**
 * Helper function to check if words are semantically related
 * Uses fuzzy matching, conceptual relationships, and similarity algorithms
 */
function areWordsRelated(word1: string, word2: string): boolean {
  const w1 = word1.toLowerCase();
  const w2 = word2.toLowerCase();
  
  // Exact match or substring
  if (w1 === w2 || w1.includes(w2) || w2.includes(w1)) return true;
  
  // Check conceptual relationships (synonyms, related concepts)
  if (areConceptsRelated(w1, w2)) return true;
  
  // Enhanced stem matching (more suffix patterns)
  const stem1 = w1.replace(/(ing|ed|s|es|er|est|ly|tion|sion|ment|ness|ity|able|ible)$/, '');
  const stem2 = w2.replace(/(ing|ed|s|es|er|est|ly|tion|sion|ment|ness|ity|able|ible)$/, '');
  if (stem1 === stem2 || stem1.includes(stem2) || stem2.includes(stem1)) return true;
  
  // Check if stems are conceptually related
  if (stem1 !== w1 || stem2 !== w2) {
    if (areConceptsRelated(stem1, stem2)) return true;
  }
  
  // Similarity threshold (now with improved algorithm)
  return calculateWordSimilarity(w1, w2) >= DESCRIPTION_GENERATION_CONFIG.wordSimilarity.relationshipThreshold;
}

/**
 * Extract keywords and phrases directly from text using frequency analysis
 */
function extractTermsFromText(
  text: string,
  stopWords: string[]
): {
  keywords: string[];
  phrases: string[];
  verbs: string[];
  nouns: string[];
} {
  const keywords: string[] = [];
  const phrases: string[] = [];
  const verbs: string[] = [];
  const nouns: string[] = [];
  
  // Normalize text
  const normalizedText = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const words = normalizedText.split(/\s+/)
    .filter(w => w.length >= DESCRIPTION_GENERATION_CONFIG.minWordLength)
    .filter(w => !stopWords.includes(w));
  
  // Word frequency analysis for keywords
  const wordFreq = new Map<string, number>();
  words.forEach(word => {
    if (word.length >= DESCRIPTION_GENERATION_CONFIG.minKeywordLength && 
        word.length <= DESCRIPTION_GENERATION_CONFIG.maxKeywordLength) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
  });
  
  // Extract top keywords by frequency
  const sortedKeywords = Array.from(wordFreq.entries())
    .filter(([word, freq]) => freq >= DESCRIPTION_GENERATION_CONFIG.minWordFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedKeywords)
    .map(([word]) => word);
  
  keywords.push(...sortedKeywords);
  
  // Extract phrases (2-5 word combinations) with frequency analysis
  const phraseFreq = new Map<string, number>();
  
  for (let i = 0; i < words.length - 1; i++) {
    for (let len = DESCRIPTION_GENERATION_CONFIG.minPhraseLength; 
         len <= DESCRIPTION_GENERATION_CONFIG.maxPhraseLength && i + len <= words.length; 
         len++) {
      const phrase = words.slice(i, i + len).join(' ');
      if (phrase.length > DESCRIPTION_GENERATION_CONFIG.minKeywordLength) {
        // Filter out phrases that are just stop words
        const phraseWords = phrase.split(/\s+/);
        const hasContentWords = phraseWords.some(w => !stopWords.includes(w));
        
        if (hasContentWords) {
          phraseFreq.set(phrase, (phraseFreq.get(phrase) || 0) + 1);
        }
      }
    }
  }
  
  // Sort phrases by frequency and length (prioritize frequent, longer phrases)
  const sortedPhrases = Array.from(phraseFreq.entries())
    .filter(([phrase, freq]) => freq >= DESCRIPTION_GENERATION_CONFIG.minWordFrequency)
    .sort((a, b) => {
      // First sort by frequency (higher = better)
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      // Then by length (longer = more specific)
      return b[0].length - a[0].length;
    })
    .slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPhrases)
    .map(([phrase]) => phrase);
  
  phrases.push(...sortedPhrases);
  
  // Simple verb/noun detection (common patterns)
  // Verbs often end in -ing, -ed, -s, or are common action words
  const verbPatterns = /(ing|ed|s|es)$/;
  const commonVerbs = ['is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'get', 'got', 'make', 'made', 'take', 'took', 'go', 'went', 'come', 'came', 'see', 'saw', 'know', 'knew', 'think', 'thought', 'say', 'said', 'tell', 'told', 'give', 'gave', 'find', 'found', 'work', 'worked', 'call', 'called', 'try', 'tried', 'ask', 'asked', 'need', 'needed', 'want', 'wanted', 'use', 'used', 'help', 'helped', 'play', 'played', 'move', 'moved', 'like', 'liked', 'live', 'lived', 'believe', 'believed', 'bring', 'brought', 'happen', 'happened', 'write', 'wrote', 'sit', 'sat', 'stand', 'stood', 'lose', 'lost', 'pay', 'paid', 'meet', 'met', 'include', 'included', 'continue', 'continued', 'set', 'set', 'learn', 'learned', 'change', 'changed', 'lead', 'led', 'understand', 'understood', 'watch', 'watched', 'follow', 'followed', 'stop', 'stopped', 'create', 'created', 'speak', 'spoke', 'read', 'read', 'allow', 'allowed', 'add', 'added', 'spend', 'spent', 'grow', 'grew', 'open', 'opened', 'walk', 'walked', 'win', 'won', 'offer', 'offered', 'remember', 'remembered', 'love', 'loved', 'consider', 'considered', 'appear', 'appeared', 'buy', 'bought', 'wait', 'waited', 'serve', 'served', 'die', 'died', 'send', 'sent', 'build', 'built', 'stay', 'stayed', 'fall', 'fell', 'cut', 'cut', 'reach', 'reached', 'kill', 'killed', 'raise', 'raised', 'pass', 'passed', 'sell', 'sold', 'decide', 'decided', 'return', 'returned', 'explain', 'explained', 'develop', 'developed', 'carry', 'carried', 'break', 'broke', 'receive', 'received'];
  
  words.forEach(word => {
    const baseWord = word.replace(verbPatterns, '');
    if (commonVerbs.includes(word) || commonVerbs.includes(baseWord) || verbPatterns.test(word)) {
      if (!verbs.includes(word) && word.length >= DESCRIPTION_GENERATION_CONFIG.minWordLength) {
        verbs.push(word);
      }
    }
  });
  
  // Nouns are often capitalized or common objects (simplified detection)
  // In practice, we'll extract nouns that appear frequently and aren't verbs
  const nounCandidates = words.filter(w => 
    !verbs.includes(w) && 
    !stopWords.includes(w) &&
    w.length >= DESCRIPTION_GENERATION_CONFIG.minWordLength
  );
  
  nouns.push(...nounCandidates.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedNouns));
  
  return {
    keywords: keywords.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedKeywords),
    phrases: phrases.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPhrases),
    verbs: verbs.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedVerbs),
    nouns: nouns.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedNouns),
  };
}

/**
 * Extract keywords from task name (user input)
 * ENHANCED: Better identification of compound terms, numbers, research keywords, and phrases
 */
function extractKeywordsFromTaskName(taskName: string): string[] {
  const keywords: string[] = [];
  
  // Step 1: Extract compound terms and phrases first (before splitting)
  // Look for common patterns: "10K-15K", "SUV or car", "best X", "within X", etc.
  const compoundPatterns = [
    // Price ranges: "10K-15K", "$10K-$15K", "10K to 15K", "10-15K"
    /\b(\d+[Kk]?\s*[-–—]\s*\d+[Kk]?)\b/g,
    // Research patterns: "best X", "top X", "find best X", "research best X"
    /\b(best|top|find|research|compare|evaluate|review)\s+(\w+(?:\s+\w+){0,3})\b/gi,
      // Vehicle types: "SUV or car", "truck and SUV", etc.
      /\b(suv|car|truck|vehicle|automobile|sedan|coupe|convertible|motorcycle|bike)\s*(or|and|\/)\s*(suv|car|truck|vehicle|automobile|sedan|coupe|convertible|motorcycle|bike)\b/gi,
    // Within/under/over patterns: "within 10K", "under $15K", "over 10K"
    /\b(within|under|over|below|above|up to|less than|more than)\s+(\d+[Kk]?|\$\d+[Kk]?)\b/gi,
  ];
  
  compoundPatterns.forEach(pattern => {
    const matches = taskName.matchAll(pattern);
    for (const match of matches) {
      if (match[0]) {
        const compoundTerm = match[0].toLowerCase().trim();
        if (compoundTerm.length >= DESCRIPTION_GENERATION_CONFIG.minKeywordLength) {
          keywords.push(compoundTerm);
        }
      }
    }
  });
  
  // Step 2: Extract individual words (enhanced)
  const normalizedText = taskName
    .replace(/[^\w\s\-–—/]/g, ' ') // Keep hyphens, en-dash, em-dash, slashes
    .replace(/\s+/g, ' ')
    .trim();
  
  const taskWords = normalizedText.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length >= DESCRIPTION_GENERATION_CONFIG.minWordLength)
    .filter(w => !(DESCRIPTION_GENERATION_CONFIG.stopWords as readonly string[]).includes(w));
  
  // Step 3: Extract numbers with units (10K, $15K, etc.)
  const numberPattern = /\b(\d+[KkMm]?|\$\d+[KkMm]?)\b/g;
  const numberMatches = taskName.matchAll(numberPattern);
  for (const match of numberMatches) {
    if (match[0]) {
      const numberTerm = match[0].toLowerCase().trim();
      keywords.push(numberTerm);
    }
  }
  
  // Step 4: Prioritize words by frequency and length
  const wordFreq = new Map<string, number>();
  taskWords.forEach(word => {
    // Skip if already captured as part of compound term
    const isPartOfCompound = keywords.some(kw => kw.includes(word) && kw !== word);
    if (!isPartOfCompound) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
  });
  
  // Step 5: Add research/action keywords with higher priority
  const researchKeywords = ['research', 'find', 'search', 'compare', 'evaluate', 'review', 'analyze', 'study', 'investigate', 'explore', 'examine', 'assess', 'purchase', 'buy', 'shop', 'select', 'choose', 'decide'];
  researchKeywords.forEach(rk => {
    if (taskWords.includes(rk)) {
      wordFreq.set(rk, (wordFreq.get(rk) || 0) + 2); // Boost research keywords
    }
  });
  
  // Step 6: Add vehicle/automobile keywords with higher priority
  const vehicleKeywords = ['suv', 'car', 'truck', 'vehicle', 'automobile', 'sedan', 'coupe', 'convertible', 'motorcycle', 'bike', 'bicycle'];
  vehicleKeywords.forEach(vk => {
    if (taskWords.includes(vk)) {
      wordFreq.set(vk, (wordFreq.get(vk) || 0) + 2); // Boost vehicle keywords
    }
  });
  
  // Step 7: Sort by: 1) frequency, 2) length (longer = more specific), 3) research/vehicle keywords first
  const sortedKeywords = Array.from(wordFreq.entries())
    .sort((a, b) => {
      // Research/vehicle keywords get priority
      const aIsPriority = researchKeywords.includes(a[0]) || vehicleKeywords.includes(a[0]);
      const bIsPriority = researchKeywords.includes(b[0]) || vehicleKeywords.includes(b[0]);
      if (aIsPriority && !bIsPriority) return -1;
      if (!aIsPriority && bIsPriority) return 1;
      
      // Then by frequency
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      // Then by length
      return b[0].length - a[0].length;
    })
    .map(([word]) => word);
  
  // Step 8: Combine compound terms, numbers, and sorted words
  const allKeywords = [...keywords, ...sortedKeywords];
  
  // Remove duplicates and return (prioritize compound terms and numbers first)
  return Array.from(new Set(allKeywords));
}

/**
 * Find phrases in search results using keywords from task name
 * ENHANCED: Looks for phrases (2-5 words) that contain keywords, prioritizing multi-keyword phrases
 */
function findPhrasesUsingKeywords(
  searchResults: string[],
  keywords: string[]
): string[] {
  const foundPhrases: string[] = [];
  const combinedText = searchResults.join(' ').toLowerCase();
  
  // ENHANCED: Find phrases that contain multiple keywords (more relevant)
  // First pass: Find phrases with multiple keywords
  keywords.forEach(keyword => {
    const keywordLower = keyword.toLowerCase();
    
    // Extract phrases containing this keyword from search results
    searchResults.forEach(result => {
      const resultLower = result.toLowerCase();
      const words = resultLower.split(/\s+/);
      
      // Find all positions of the keyword in the text
      for (let i = 0; i < words.length; i++) {
        // Check if word contains keyword or keyword contains word (fuzzy matching)
        if (words[i].includes(keywordLower) || keywordLower.includes(words[i]) || 
            words[i].substring(0, Math.min(keywordLower.length, words[i].length)) === keywordLower.substring(0, Math.min(words[i].length, keywordLower.length))) {
          // Extract phrases of different lengths (2-5 words) starting from this position
          for (let len = DESCRIPTION_GENERATION_CONFIG.minPhraseLength; 
               len <= DESCRIPTION_GENERATION_CONFIG.maxPhraseLength && i + len <= words.length; 
               len++) {
            const phrase = words.slice(i, i + len).join(' ');
            
            // Count how many keywords this phrase contains (prioritize multi-keyword phrases)
            const keywordCount = keywords.filter(kw => phrase.toLowerCase().includes(kw.toLowerCase())).length;
            
            // Only add if phrase contains at least one keyword and is meaningful
            if (keywordCount > 0 && 
                phrase.length > keywordLower.length + DESCRIPTION_GENERATION_CONFIG.lengthThresholds.phraseKeywordBuffer && // Phrase should be longer than just the keyword
                !foundPhrases.some(p => p.toLowerCase() === phrase.toLowerCase())) {
              foundPhrases.push(phrase);
            }
          }
        }
      }
    });
  });
  
  // Sort phrases by number of keywords they contain (prioritize multi-keyword phrases)
  foundPhrases.sort((a, b) => {
    const aKeywords = keywords.filter(kw => a.toLowerCase().includes(kw.toLowerCase())).length;
    const bKeywords = keywords.filter(kw => b.toLowerCase().includes(kw.toLowerCase())).length;
    if (bKeywords !== aKeywords) {
      return bKeywords - aKeywords; // More keywords = higher priority
    }
    return b.length - a.length; // Longer phrases = more complete
  });
  
  // Also extract phrases from combined text using frequency analysis
  const words = combinedText.split(/\s+/)
    .filter(w => w.length >= DESCRIPTION_GENERATION_CONFIG.minWordLength)
    .filter(w => !(DESCRIPTION_GENERATION_CONFIG.stopWords as readonly string[]).includes(w));
  
  const phraseFreq = new Map<string, number>();
  
  for (let i = 0; i < words.length - 1; i++) {
    for (let len = DESCRIPTION_GENERATION_CONFIG.minPhraseLength; 
         len <= DESCRIPTION_GENERATION_CONFIG.maxPhraseLength && i + len <= words.length; 
         len++) {
      const phrase = words.slice(i, i + len).join(' ');
      
      // Check if phrase contains any of our keywords
      const containsKeyword = keywords.some(kw => phrase.includes(kw.toLowerCase()));
      
      if (containsKeyword && phrase.length > DESCRIPTION_GENERATION_CONFIG.minKeywordLength) {
        phraseFreq.set(phrase, (phraseFreq.get(phrase) || 0) + 1);
      }
    }
  }
  
  // Add top phrases by frequency, prioritizing those with more keywords
  const sortedPhrases = Array.from(phraseFreq.entries())
    .filter(([phrase, freq]) => freq >= DESCRIPTION_GENERATION_CONFIG.minWordFrequency)
    .map(([phrase, freq]) => {
      // Count keywords in phrase for better prioritization
      const keywordCount = keywords.filter(kw => phrase.toLowerCase().includes(kw.toLowerCase())).length;
      return { phrase, freq, keywordCount };
    })
    .sort((a, b) => {
      // First sort by keyword count (more keywords = better)
      if (b.keywordCount !== a.keywordCount) {
        return b.keywordCount - a.keywordCount;
      }
      // Then by frequency
      return b.freq - a.freq;
    })
    .slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPhrases)
    .map(({ phrase }) => phrase);
  
  sortedPhrases.forEach(phrase => {
    if (!foundPhrases.some(p => p.toLowerCase() === phrase.toLowerCase())) {
      foundPhrases.push(phrase);
    }
  });
  
  // Return phrases sorted by keyword count (multi-keyword phrases first)
  return foundPhrases
    .sort((a, b) => {
      const aKeywords = keywords.filter(kw => a.toLowerCase().includes(kw.toLowerCase())).length;
      const bKeywords = keywords.filter(kw => b.toLowerCase().includes(kw.toLowerCase())).length;
      if (bKeywords !== aKeywords) {
        return bKeywords - aKeywords;
      }
      return b.length - a.length;
    })
    .slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPhrases);
}

/**
 * Extract keywords, phrases, verbs, nouns, and pronouns from task name
 * ENHANCED: Now uses Browser AI API (window.ai) when available, with local processing as fallback
 * FLOW: 
 * 1. Try Browser AI API for enhanced term extraction (if available)
 * 2. Local Terminology extracts keywords/phrases from task name using domain dictionary
 * 3. Combine Browser AI results with Local Terminology results
 * 4. Browser AI uses combined terms to build contextual sentences
 */
export async function extractTermsFromTaskNameWithBrowserAI(
  taskName: string,
  domainTerms: ReturnType<typeof getDomainTerminology>
): Promise<{ 
  keywords: string[]; 
  phrases: string[];
  verbs: string[]; 
  nouns: string[];
  pronouns: string[];
  context: string;
}> {
  const domain = domainTerms.context || DEFAULT_TASK_DOMAIN;
  
  // Use local terminology only (no Browser AI)
  let browserAITerms: {
    keywords: string[];
    phrases: string[];
    verbs: string[];
    nouns: string[];
    summary: string;
  } | null = null;
  
  // STEP 2: LOCAL TERMINOLOGY extracts keywords and phrases from task name
  // Local Terminology uses domain dictionary to extract relevant terms
  logger.debug(`🔍 Local Terminology: Extracting keywords and phrases from task name: "${taskName}"`);
  
  const localTerminologyExtracted = extractTermsFromTaskName(taskName, domainTerms);
  
  logger.debug(`✅ Local Terminology extraction COMPLETE: ${localTerminologyExtracted.keywords.length} keywords, ${localTerminologyExtracted.phrases.length} phrases, ${localTerminologyExtracted.verbs.length} verbs, ${localTerminologyExtracted.nouns.length} nouns`, {
    keywords: localTerminologyExtracted.keywords.slice(0, 10),
    phrases: localTerminologyExtracted.phrases.slice(0, 10),
    verbs: localTerminologyExtracted.verbs.slice(0, 10),
    nouns: localTerminologyExtracted.nouns.slice(0, 10),
  });
  
  // STEP 3: Combine Browser AI API results with Local Terminology results
  // Browser AI provides enhanced understanding, Local Terminology provides domain-specific terms
  // Also extract additional keywords from task name for context
  const taskKeywords = extractKeywordsFromTaskName(taskName);
  
  // STEP 3: Combine Browser AI API results with Local Terminology results
  // Browser AI provides enhanced understanding, Local Terminology provides domain-specific terms
  // Priority: Browser AI terms (if available) + Local Terminology terms (domain-specific)
  
  // Start with Browser AI terms if available (enhanced understanding)
  let foundKeywords = browserAITerms ? [...browserAITerms.keywords] : [];
  let foundPhrases = browserAITerms ? [...browserAITerms.phrases] : [];
  let foundVerbs = browserAITerms ? [...browserAITerms.verbs] : [];
  let foundNouns = browserAITerms ? [...browserAITerms.nouns] : [];
  let foundPronouns = [...localTerminologyExtracted.pronouns]; // Pronouns from local only
  
  // Merge with Local Terminology terms (domain-specific, no duplicates)
  const mergeUnique = (arr1: string[], arr2: string[]) => {
    const combined = [...arr1, ...arr2];
    const seen = new Set<string>();
    return combined.filter(item => {
      const lower = item.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });
  };
  
  foundKeywords = mergeUnique(foundKeywords, localTerminologyExtracted.keywords);
  foundPhrases = mergeUnique(foundPhrases, localTerminologyExtracted.phrases);
  foundVerbs = mergeUnique(foundVerbs, localTerminologyExtracted.verbs);
  foundNouns = mergeUnique(foundNouns, localTerminologyExtracted.nouns);
  
  // Add task name keywords that aren't already in Local Terminology results
  taskKeywords.forEach(keyword => {
    if (!foundKeywords.some(k => k.toLowerCase() === keyword.toLowerCase())) {
      foundKeywords.push(keyword);
    }
  });
  
  // Extract additional phrases from task name that complement Local Terminology phrases
  const taskNameLower = taskName.toLowerCase();
  const taskWords = taskNameLower.split(/\s+/)
    .filter(w => w.length >= DESCRIPTION_GENERATION_CONFIG.minWordLength)
    .filter(w => !(DESCRIPTION_GENERATION_CONFIG.stopWords as readonly string[]).includes(w));
  
  // Extract phrases containing keywords from task name
  taskKeywords.forEach(keyword => {
    const keywordLower = keyword.toLowerCase();
    for (let i = 0; i < taskWords.length; i++) {
      if (taskWords[i].includes(keywordLower) || keywordLower.includes(taskWords[i])) {
        // Extract phrases of different lengths (2-5 words) starting from this position
        for (let len = DESCRIPTION_GENERATION_CONFIG.minPhraseLength; 
             len <= DESCRIPTION_GENERATION_CONFIG.maxPhraseLength && i + len <= taskWords.length; 
             len++) {
          const phrase = taskWords.slice(i, i + len).join(' ');
          if (phrase.includes(keywordLower) && 
              phrase.length > keywordLower.length + 2 &&
              !foundPhrases.some(p => p.toLowerCase() === phrase.toLowerCase())) {
            foundPhrases.push(phrase);
          }
        }
      }
    }
  });
  
  // Extract additional verbs and nouns from task name
  const extractedFromTask = extractTermsFromText(taskName, [...DESCRIPTION_GENERATION_CONFIG.stopWords]);
  
  // Add verbs and nouns that relate to keywords
  extractedFromTask.verbs.forEach(verb => {
    const verbLower = verb.toLowerCase();
    if (taskKeywords.some(kw => 
      verbLower.includes(kw.toLowerCase()) || kw.toLowerCase().includes(verbLower)
    ) && !foundVerbs.some(v => v.toLowerCase() === verb.toLowerCase())) {
      foundVerbs.push(verb);
    }
  });
  
  extractedFromTask.nouns.forEach(noun => {
    const nounLower = noun.toLowerCase();
    if (taskKeywords.some(kw => 
      nounLower.includes(kw.toLowerCase()) || kw.toLowerCase().includes(nounLower)
    ) && !foundNouns.some(n => n.toLowerCase() === noun.toLowerCase())) {
      foundNouns.push(noun);
    }
  });
  
  logger.debug(`✅ Browser AI: Received ${foundKeywords.length} keywords, ${foundPhrases.length} phrases, ${foundVerbs.length} verbs, ${foundNouns.length} nouns from Local Terminology`);
  
  // STEP 4: Browser AI now has all extracted terms from Local Terminology
  // Browser AI will use these terms to build contextual sentences in buildContextualDescription()
  
  // Return the extracted terms for Browser AI to use in sentence building
  const finalKeywords = foundKeywords.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedKeywords);
  const finalPhrases = foundPhrases.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPhrases);
  const finalVerbs = foundVerbs.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedVerbs);
  const finalNouns = foundNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedNouns);
  const finalPronouns = foundPronouns.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPronouns);
  
  logger.debug(`✅ Browser AI: Ready to build contextual sentences with ${finalKeywords.length} keywords, ${finalPhrases.length} phrases, ${finalVerbs.length} verbs, ${finalNouns.length} nouns`);
  
  // STEP 5: Save new keywords and phrases to Local Terminology library
  // Get domain from domainTerms (it has a 'context' property that is the domain)
  const detectedDomain = domainTerms.context;
  
  // Extract new terms that aren't in the library
  // Compare extracted terms with BASE terminology (not including user-learned terms) to find new ones
  const baseTerminology = DOMAIN_TERMINOLOGIES[detectedDomain] || DOMAIN_TERMINOLOGIES.personal;
  
  // Find new keywords (from task name keywords that aren't in library)
  const newKeywords = taskKeywords.filter(kw => {
    const kwLower = kw.toLowerCase();
    return !baseTerminology.keywords.some(bk => bk.toLowerCase() === kwLower);
  });
  
  // Find new phrases (from task name phrases that aren't in library)
  const newPhrases = foundPhrases.filter(phrase => {
    const phraseLower = phrase.toLowerCase();
    return !baseTerminology.phrases.some(bp => bp.toLowerCase() === phraseLower);
  });
  
  // Find new verbs (from extracted verbs that aren't in library)
  const newVerbs = foundVerbs.filter(verb => {
    const verbLower = verb.toLowerCase();
    return !baseTerminology.verbs.some(bv => bv.toLowerCase() === verbLower);
  });
  
  // Find new nouns (from extracted nouns that aren't in library)
  const newNouns = foundNouns.filter(noun => {
    const nounLower = noun.toLowerCase();
    return !baseTerminology.nouns.some(bn => bn.toLowerCase() === nounLower);
  });
  
  // Save new terms to library if any were found
  if (newKeywords.length > 0 || newPhrases.length > 0 || newVerbs.length > 0 || newNouns.length > 0) {
    saveNewTerminologyToLibrary(
      detectedDomain,
      newKeywords,
      newPhrases,
      newVerbs,
      newNouns
    );
  }
  
  return {
    keywords: finalKeywords,
    phrases: finalPhrases,
    verbs: finalVerbs,
    nouns: finalNouns,
    pronouns: finalPronouns,
    context: browserAITerms?.summary || taskName, // Use Browser AI summary if available, otherwise task name
  };
}

/**
 * Extract phrases, verbs (action words), nouns, pronouns, and keywords from search results using browser AI
 * NEW FLOW: Uses keywords from task name to find phrases in search results
 */
function extractKeywordsAndVerbsFromSearch(
  taskName: string,
  searchResults: string[],
  domainTerms: ReturnType<typeof getDomainTerminology>
): { 
  keywords: string[]; 
  phrases: string[];
  verbs: string[]; 
  nouns: string[];
  pronouns: string[];
  context: string;
} {
  // STEP 1: Extract keywords from task name (user input) and filter invalid ones
  const taskKeywords = extractKeywordsFromTaskName(taskName)
    .filter(kw => isValidKeyword(kw)) // Filter out HTML fragments, price ranges, etc.
    .map(kw => cleanText(kw)) // Clean any remaining HTML fragments
    .filter(kw => kw.length > 0); // Remove empty after cleaning
  
  // STEP 2: Find phrases in search results using keywords
  const foundPhrases = findPhrasesUsingKeywords(searchResults, taskKeywords);
  
  // STEP 3: Extract additional terms from search results for context
  const foundVerbs: string[] = [];
  const foundNouns: string[] = [];
  const foundPronouns: string[] = [];
  
  const combinedText = searchResults.join(' ').toLowerCase();
  
  // Extract verbs and nouns from search results that relate to keywords
  searchResults.forEach(result => {
    const extractedFromResult = extractTermsFromText(
      result,
      [...DESCRIPTION_GENERATION_CONFIG.stopWords]
    );
    
    // Only add verbs/nouns that relate to our keywords
    extractedFromResult.verbs.forEach(verb => {
      const verbLower = verb.toLowerCase();
      const relatesToKeyword = taskKeywords.some(kw => 
        verbLower.includes(kw.toLowerCase()) || kw.toLowerCase().includes(verbLower)
      );
      if (relatesToKeyword && !foundVerbs.some(v => v.toLowerCase() === verbLower)) {
        foundVerbs.push(verb);
      }
    });
    
    extractedFromResult.nouns.forEach(noun => {
      const nounLower = noun.toLowerCase();
      const relatesToKeyword = taskKeywords.some(kw => 
        nounLower.includes(kw.toLowerCase()) || kw.toLowerCase().includes(nounLower)
      );
      if (relatesToKeyword && !foundNouns.some(n => n.toLowerCase() === nounLower)) {
        foundNouns.push(noun);
      }
    });
  });
  
  // STEP 4: Find matching domain terminology terms that appear in search results
  const wordBoundaryRegex = (term: string) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  
  // Match domain phrases that contain our keywords
  domainTerms.phrases.forEach(phrase => {
    const phraseLower = phrase.toLowerCase();
    const phraseRegex = wordBoundaryRegex(phrase);
    const containsKeyword = taskKeywords.some(kw => phraseLower.includes(kw.toLowerCase()));
    
    if (phraseRegex.test(combinedText) && containsKeyword && 
        !foundPhrases.some(p => p.toLowerCase() === phraseLower)) {
      foundPhrases.push(phrase);
    }
  });
  
  // Match domain verbs that relate to keywords
  domainTerms.verbs.forEach(verb => {
    const verbLower = verb.toLowerCase();
    const verbBase = verbLower.replace(/(ing|ed|s|es)$/, '');
    const verbPatterns = [
      new RegExp(`\\b${verbBase}\\b`, 'i'),
      new RegExp(`\\b${verbBase}ing\\b`, 'i'),
      new RegExp(`\\b${verbBase}ed\\b`, 'i'),
      new RegExp(`\\b${verbBase}s\\b`, 'i'),
    ];
    
    const relatesToKeyword = taskKeywords.some(kw => 
      verbLower.includes(kw.toLowerCase()) || kw.toLowerCase().includes(verbLower) ||
      verbBase.includes(kw.toLowerCase()) || kw.toLowerCase().includes(verbBase)
    );
    
    if (verbPatterns.some(pattern => pattern.test(combinedText)) && relatesToKeyword &&
        !foundVerbs.some(v => v.toLowerCase() === verbLower)) {
      foundVerbs.push(verb);
    }
  });
  
  // Match domain nouns that relate to keywords
  domainTerms.nouns.forEach(noun => {
    const nounLower = noun.toLowerCase();
    const nounBase = nounLower.replace(/s$|es$/, '');
    const nounPatterns = [
      new RegExp(`\\b${nounBase}\\b`, 'i'),
      new RegExp(`\\b${nounBase}s\\b`, 'i'),
    ];
    
    const relatesToKeyword = taskKeywords.some(kw => 
      nounLower.includes(kw.toLowerCase()) || kw.toLowerCase().includes(nounLower) ||
      nounBase.includes(kw.toLowerCase()) || kw.toLowerCase().includes(nounBase)
    );
    
    if (nounPatterns.some(pattern => pattern.test(combinedText)) && relatesToKeyword &&
        !foundNouns.some(n => n.toLowerCase() === nounLower)) {
      foundNouns.push(noun);
    }
  });
  
  // STEP 5: Build context from search results using keywords and phrases
  // IMPORTANT: Use FULL search results as context, not just snippets
  // The sentence extraction will handle finding the best sentences
  let finalContext = '';
  
  if (searchResults.length > 0) {
    // Use all search results as context (up to max length)
    // This gives us the full text to extract sentences from
    finalContext = searchResults
      .slice(0, DESCRIPTION_GENERATION_CONFIG.maxSearchResultsForContext)
      .map(r => r && r.length > 0 ? r.trim() : '')
      .filter(r => r.length > 0)
      .join(' ')
      .substring(0, DESCRIPTION_GENERATION_CONFIG.maxContextLength * DESCRIPTION_GENERATION_CONFIG.contextMultiplier);
  }
  
  return {
    keywords: taskKeywords.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedKeywords),
    phrases: foundPhrases.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPhrases),
    verbs: foundVerbs.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedVerbs),
    nouns: foundNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedNouns),
    pronouns: foundPronouns.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPronouns),
    context: finalContext,
  };
}

/**
 * Validate and enhance Browser AI-extracted terms using Local Terminology as a dictionary
 * This function:
 * 1. Validates extracted terms are domain-appropriate
 * 2. Adds synonyms and related terms from domain dictionary
 * 3. Enhances terms with domain-specific context
 * 4. Fills gaps when search results are minimal
 */
export function validateAndEnhanceTermsWithDictionary(
  extracted: {
    keywords: string[];
    phrases: string[];
    verbs: string[];
    nouns: string[];
    pronouns: string[];
  },
  taskName: string,
  domainTerms: ReturnType<typeof getDomainTerminology>
): {
  keywords: string[];
  phrases: string[];
  verbs: string[];
  nouns: string[];
  pronouns: string[];
} {
  const taskNameLower = taskName.toLowerCase();
  const taskWords = taskNameLower.split(/\s+/).filter(w => w.length > DESCRIPTION_GENERATION_CONFIG.minWordLength);
  
  // Start with Browser AI-extracted terms
  const validatedKeywords = [...extracted.keywords];
  const validatedPhrases = [...extracted.phrases];
  const validatedVerbs = [...extracted.verbs];
  const validatedNouns = [...extracted.nouns];
  const validatedPronouns = [...extracted.pronouns];
  
  // VALIDATE: Check if extracted terms match domain dictionary
  // Add domain-appropriate synonyms and related terms
  
  // Validate and enhance keywords
  extracted.keywords.forEach(keyword => {
    const kwLower = keyword.toLowerCase();
    // Find related domain keywords (synonyms, related terms)
    domainTerms.keywords.forEach(dictKeyword => {
      const dictKwLower = dictKeyword.toLowerCase();
      // If extracted keyword relates to dictionary keyword, add dictionary version
      if ((kwLower.includes(dictKwLower) || dictKwLower.includes(kwLower)) &&
          !validatedKeywords.some(k => k.toLowerCase() === dictKeyword.toLowerCase())) {
        validatedKeywords.push(dictKeyword);
      }
    });
  });
  
  // Validate and enhance phrases
  extracted.phrases.forEach(phrase => {
    const phraseLower = phrase.toLowerCase();
    // Find related domain phrases
    domainTerms.phrases.forEach(dictPhrase => {
      const dictPhraseLower = dictPhrase.toLowerCase();
      // If extracted phrase relates to dictionary phrase, add dictionary version
      if ((phraseLower.includes(dictPhraseLower) || dictPhraseLower.includes(phraseLower)) &&
          !validatedPhrases.some(p => p.toLowerCase() === dictPhrase.toLowerCase())) {
        validatedPhrases.push(dictPhrase);
      }
    });
  });
  
  // Validate and enhance verbs
  extracted.verbs.forEach(verb => {
    const verbLower = verb.toLowerCase();
    const verbBase = verbLower.replace(/(ing|ed|s|es)$/, '');
    // Find related domain verbs
    domainTerms.verbs.forEach(dictVerb => {
      const dictVerbLower = dictVerb.toLowerCase();
      const dictVerbBase = dictVerbLower.replace(/(ing|ed|s|es)$/, '');
      // If extracted verb relates to dictionary verb, add dictionary version
      if ((verbLower.includes(dictVerbLower) || dictVerbLower.includes(verbLower) ||
           verbBase === dictVerbBase) &&
          !validatedVerbs.some(v => v.toLowerCase() === dictVerb.toLowerCase())) {
        validatedVerbs.push(dictVerb);
      }
    });
  });
  
  // Validate and enhance nouns
  extracted.nouns.forEach(noun => {
    const nounLower = noun.toLowerCase();
    const nounBase = nounLower.replace(/s$|es$/, '');
    // Find related domain nouns
    domainTerms.nouns.forEach(dictNoun => {
      const dictNounLower = dictNoun.toLowerCase();
      const dictNounBase = dictNounLower.replace(/s$|es$/, '');
      // If extracted noun relates to dictionary noun, add dictionary version
      if ((nounLower.includes(dictNounLower) || dictNounLower.includes(nounLower) ||
           nounBase === dictNounBase) &&
          !validatedNouns.some(n => n.toLowerCase() === dictNoun.toLowerCase())) {
        validatedNouns.push(dictNoun);
      }
    });
  });
  
  // ENHANCED: Local Terminology proactively provides additional keywords to assist Browser AI
  // This ensures Browser AI has a rich set of contextual terms to work with
  // Find domain phrases that match task name OR relate to extracted keywords
  domainTerms.phrases.forEach(phrase => {
    const phraseLower = phrase.toLowerCase();
    const phraseWords = phraseLower.split(/\s+/).filter(w => w.length >= DESCRIPTION_GENERATION_CONFIG.minWordLength);
    
    // Check if phrase matches task name
    const matchesTaskName = taskNameLower.includes(phraseLower) || 
           taskWords.some(word => phraseLower.includes(word) || word.includes(phraseLower));
    
    // Check if phrase relates to extracted keywords (conceptual relationships)
    const relatesToKeywords = extracted.keywords.some(kw => {
      const kwLower = kw.toLowerCase();
      if (phraseLower.includes(kwLower) || kwLower.includes(phraseLower)) return true;
      // Check conceptual relationships
      return phraseWords.some(pw => areConceptsRelated(pw, kwLower) || areWordsRelated(pw, kwLower));
    });
    
    if ((matchesTaskName || relatesToKeywords) &&
        !validatedPhrases.some(p => p.toLowerCase() === phrase.toLowerCase())) {
      validatedPhrases.push(phrase);
    }
  });
  
  // ENHANCED: Proactively add domain keywords that relate to task or extracted terms
  domainTerms.keywords.forEach(keyword => {
    const keywordLower = keyword.toLowerCase();
    const keywordWords = keywordLower.split(/\s+/);
    
    // Check if keyword matches task name
    const matchesTaskName = taskNameLower.includes(keywordLower) ||
           taskWords.some(word => keywordLower.includes(word) || word.includes(keywordLower));
    
    // Check if keyword relates to extracted keywords (conceptual relationships)
    const relatesToExtracted = extracted.keywords.some(ekw => {
      const ekwLower = ekw.toLowerCase();
      if (keywordLower.includes(ekwLower) || ekwLower.includes(keywordLower)) return true;
      // Check conceptual relationships
      return keywordWords.some(kw => areConceptsRelated(kw, ekwLower) || areWordsRelated(kw, ekwLower));
    });
    
    // Check if keyword relates to extracted phrases
    const relatesToPhrases = extracted.phrases.some(phrase => {
      const phraseLower = phrase.toLowerCase();
      return phraseLower.includes(keywordLower) || keywordLower.includes(phraseLower) ||
             keywordWords.some(kw => phraseLower.includes(kw) || areConceptsRelated(kw, phraseLower));
    });
    
    if ((matchesTaskName || relatesToExtracted || relatesToPhrases) &&
        !validatedKeywords.some(k => k.toLowerCase() === keyword.toLowerCase())) {
      validatedKeywords.push(keyword);
    }
  });
  
  // FILL GAPS: Add domain verbs/nouns if missing
  if (extracted.verbs.length === 0) {
    domainTerms.verbs.forEach(verb => {
      const verbLower = verb.toLowerCase();
      if ((taskNameLower.includes(verbLower) || 
           taskNameLower.includes(`${verbLower}ing`) ||
           taskNameLower.includes(`${verbLower}ed`)) &&
          !validatedVerbs.some(v => v.toLowerCase() === verb.toLowerCase())) {
        validatedVerbs.push(verb);
      }
    });
  }
  
  if (extracted.nouns.length === 0) {
    domainTerms.nouns.forEach(noun => {
      const nounLower = noun.toLowerCase();
      if ((taskNameLower.includes(nounLower) || 
           taskNameLower.includes(`${nounLower}s`)) &&
          !validatedNouns.some(n => n.toLowerCase() === noun.toLowerCase())) {
        validatedNouns.push(noun);
      }
    });
  }
  
  return {
    keywords: Array.from(new Set(validatedKeywords)).slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedKeywords),
    phrases: Array.from(new Set(validatedPhrases)).slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPhrases),
    verbs: Array.from(new Set(validatedVerbs)).slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedVerbs),
    nouns: Array.from(new Set(validatedNouns)).slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedNouns),
    pronouns: Array.from(new Set(validatedPronouns)).slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPronouns),
  };
}

/**
 * Extract keywords, phrases, verbs, nouns, and pronouns from task name using domain terminology
 * NOTE: This is now primarily used as a fallback when search results are completely unavailable
 * Exported for use in sync contexts where async Browser AI API cannot be used
 */
export function extractTermsFromTaskName(
  taskName: string,
  domainTerms: ReturnType<typeof getDomainTerminology>
): {
  keywords: string[];
  phrases: string[];
  verbs: string[];
  nouns: string[];
  pronouns: string[];
} {
  const foundKeywords: string[] = [];
  const foundPhrases: string[] = [];
  const foundVerbs: string[] = [];
  const foundNouns: string[] = [];
  const foundPronouns: string[] = [];
  
  const taskNameLower = taskName.toLowerCase();
  const taskWords = taskNameLower.split(/\s+/).filter(w => w.length > DESCRIPTION_GENERATION_CONFIG.minWordLength);
  
  // Find matching phrases from domain terminology (check first as they're most specific)
  // ENHANCED: Require word boundary matching to prevent false matches (e.g., "part" matching "partnership")
  domainTerms.phrases.forEach(phrase => {
    const phraseLower = phrase.toLowerCase();
    const phraseWords = phraseLower.split(/\s+/).filter(w => w.length >= DESCRIPTION_GENERATION_CONFIG.minWordLength);
    
    // Require exact phrase match OR all phrase words appear in task name with word boundaries
    const exactMatch = taskNameLower.includes(phraseLower);
    const allWordsMatch = phraseWords.length > 0 && phraseWords.every(pw => {
      // Use word boundary regex for accurate matching
      const wordBoundaryRegex = new RegExp(`\\b${pw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return wordBoundaryRegex.test(taskNameLower);
    });
    
    if (exactMatch || allWordsMatch) {
      foundPhrases.push(phrase);
    }
  });
  
  // Find matching verbs (action words) from domain terminology
  // ENHANCED: Require word boundary matching to prevent false matches
  domainTerms.verbs.forEach(verb => {
    const verbLower = verb.toLowerCase();
    const verbBase = verbLower.replace(/(ing|ed|s|es|er|est|ly)$/, '');
    
    // Use word boundary regex for accurate matching
    const verbRegex = new RegExp(`\\b${verbBase}\\w*\\b`, 'i');
    const verbBaseRegex = new RegExp(`\\b${verbBase}\\b`, 'i');
    
    // Check for verb in various forms with word boundaries
    if (verbRegex.test(taskNameLower) || verbBaseRegex.test(taskNameLower)) {
      foundVerbs.push(verb);
    }
  });
  
  // Find matching nouns from domain terminology
  // ENHANCED: Require word boundary matching to prevent false matches
  domainTerms.nouns.forEach(noun => {
    const nounLower = noun.toLowerCase();
    const nounBase = nounLower.replace(/s$|es$|ies$/, '').replace(/y$/, 'i');
    
    // Use word boundary regex for accurate matching
    const nounRegex = new RegExp(`\\b${nounBase}\\w*\\b`, 'i');
    const nounBaseRegex = new RegExp(`\\b${nounBase}\\b`, 'i');
    
    if (nounRegex.test(taskNameLower) || nounBaseRegex.test(taskNameLower)) {
      foundNouns.push(noun);
    }
  });
  
  // Find matching pronouns from domain terminology
  // ENHANCED: Require word boundary matching
  domainTerms.pronouns.forEach(pronoun => {
    const pronounLower = pronoun.toLowerCase();
    const pronounRegex = new RegExp(`\\b${pronounLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (pronounRegex.test(taskNameLower)) {
      foundPronouns.push(pronoun);
    }
  });
  
  // Find matching keywords from domain terminology
  // ENHANCED: Require word boundary matching to prevent false matches (e.g., "part" matching "partnership")
  domainTerms.keywords.forEach(keyword => {
    const keywordLower = keyword.toLowerCase();
    const keywordWords = keywordLower.split(/\s+/).filter(w => w.length >= DESCRIPTION_GENERATION_CONFIG.minWordLength);
    
    // For single-word keywords, use word boundary regex
    if (keywordWords.length === 1) {
      const keywordRegex = new RegExp(`\\b${keywordWords[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (keywordRegex.test(taskNameLower)) {
        foundKeywords.push(keyword);
      }
    } else {
      // For multi-word keywords, require all words to match with word boundaries
      const allWordsMatch = keywordWords.every(kw => {
        const wordRegex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return wordRegex.test(taskNameLower);
      });
      if (allWordsMatch) {
        foundKeywords.push(keyword);
      }
    }
  });
  
  // Extract new keywords and phrases from task name that aren't in the library
  // These will be saved to the library for future use
  const extractedKeywords = extractKeywordsFromTaskName(taskName);
  const newKeywords: string[] = [];
  const newPhrases: string[] = [];
  
  // Check for new keywords (from task name that aren't in library)
  extractedKeywords.forEach(keyword => {
    const keywordLower = keyword.toLowerCase();
    const existsInLibrary = foundKeywords.some(fk => fk.toLowerCase() === keywordLower);
    if (!existsInLibrary && keywordLower.length >= DESCRIPTION_GENERATION_CONFIG.minWordLength) {
      newKeywords.push(keyword);
    }
  });
  
  // Extract phrases from task name (2-5 words)
  const taskWordsArray = taskNameLower.split(/\s+/).filter(w => w.length >= DESCRIPTION_GENERATION_CONFIG.minWordLength);
  for (let i = 0; i < taskWordsArray.length - 1; i++) {
    for (let len = DESCRIPTION_GENERATION_CONFIG.minPhraseLength; 
         len <= DESCRIPTION_GENERATION_CONFIG.maxPhraseLength && i + len <= taskWordsArray.length; 
         len++) {
      const phrase = taskWordsArray.slice(i, i + len).join(' ');
      const phraseLower = phrase.toLowerCase();
      
      // Check if phrase already exists in library
      const existsInLibrary = foundPhrases.some(fp => fp.toLowerCase() === phraseLower);
      if (!existsInLibrary && phraseLower.length >= DESCRIPTION_GENERATION_CONFIG.minKeywordLength) {
        newPhrases.push(phrase);
      }
    }
  }
  
  // Get domain from domainTerms (it has a 'context' property that is the domain)
  const detectedDomain = domainTerms.context;

  // Extract verbs and nouns from task name so we can use them in descriptions even when domain terminology is empty (e.g. mixed) or doesn't match
  const extractedFromTask = extractTermsFromText(taskName, [...DESCRIPTION_GENERATION_CONFIG.stopWords]);
  const newVerbs = extractedFromTask.verbs.filter(verb => {
    const verbLower = verb.toLowerCase();
    return !foundVerbs.some(fv => fv.toLowerCase() === verbLower);
  });
  const newNouns = extractedFromTask.nouns.filter(noun => {
    const nounLower = noun.toLowerCase();
    return !foundNouns.some(fn => fn.toLowerCase() === nounLower);
  });

  // Save new keywords and phrases to library
  if (newKeywords.length > 0 || newPhrases.length > 0) {
    saveNewTerminologyToLibrary(
      detectedDomain,
      newKeywords,
      newPhrases,
      newVerbs,
      newNouns
    );
  }

  // Merge domain-matched terms with task-name-derived terms so descriptions always reflect user input (e.g. "used car", "15k")
  const dedupeByLower = <T extends string>(arr: T[], max: number): T[] => {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const x of arr) {
      const lower = x.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);
      out.push(x);
      if (out.length >= max) break;
    }
    return out;
  };
  const maxK = DESCRIPTION_GENERATION_CONFIG.maxExtractedKeywords;
  const maxP = DESCRIPTION_GENERATION_CONFIG.maxExtractedPhrases;
  const maxV = DESCRIPTION_GENERATION_CONFIG.maxExtractedVerbs;
  const maxN = DESCRIPTION_GENERATION_CONFIG.maxExtractedNouns;

  return {
    keywords: dedupeByLower([...foundKeywords, ...newKeywords], maxK),
    phrases: dedupeByLower([...foundPhrases, ...newPhrases], maxP),
    verbs: dedupeByLower([...foundVerbs, ...newVerbs], maxV),
    nouns: dedupeByLower([...foundNouns, ...newNouns], maxN),
    pronouns: foundPronouns.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPronouns),
  };
}

/**
 * Build elaborate contextual description that explains the task without repeating the task name
 * Uses Browser AI extracted terms and domain terminology to create actionable descriptions
 * for the AI Action Plan to use when building steps
 */
/** Verbs that end in 's' (so we don't treat plural nouns like "articles" or "reports" as verbs). */
const KNOWN_VERBS_ENDING_S = new Set(['focus', 'address', 'discuss', 'process', 'access', 'progress', 'assess', 'express', 'compress']);

/**
 * Get proper verb form based on template type
 * Templates like "enables", "requires", "allows" can use gerund (preferred) or "to" + infinitive
 * Templates like "involves", "includes" use gerund
 * This ensures grammatically correct sentences. Does not gerundize nouns (e.g. "articles" -> avoid "articlesing").
 */
function getVerbFormForTemplate(verb: string, template: string): string {
  if (!verb) return '';
  const trimmed = verb.toLowerCase().trim();
  // Avoid turning plural nouns (articles, reports, forecasts) into fake verbs like "articlesing"
  if (trimmed.endsWith('s') && !KNOWN_VERBS_ENDING_S.has(trimmed)) {
    return '';
  }
  
  // Get base verb form (handle -ing, -ed endings)
  let baseVerb = trimmed;
  
  // If already in gerund form, extract base
  if (baseVerb.endsWith('ing')) {
    baseVerb = baseVerb.slice(0, -3);
    // Handle double consonants: running -> run
    if (baseVerb.length > 1 && baseVerb[baseVerb.length - 1] === baseVerb[baseVerb.length - 2]) {
      baseVerb = baseVerb.slice(0, -1);
    }
    // Add 'e' back if it was removed: writing -> write
    if (baseVerb.length > 0 && !baseVerb.endsWith('e')) {
      // Check if adding 'e' makes sense (not all verbs end in 'e')
      const withE = baseVerb + 'e';
      // Common verbs that end in 'e': create, update, make, use, etc.
      if (['creat', 'updat', 'mak', 'us', 'writ', 'tak', 'giv', 'mov', 'sav', 'lov', 'liv', 'com', 'becom'].some(prefix => baseVerb.startsWith(prefix))) {
        baseVerb = withE;
      }
    }
  } else if (baseVerb.endsWith('ed')) {
    baseVerb = baseVerb.slice(0, -2);
    // Handle double consonants: planned -> plan
    if (baseVerb.length > 1 && baseVerb[baseVerb.length - 1] === baseVerb[baseVerb.length - 2]) {
      baseVerb = baseVerb.slice(0, -1);
    }
    // Add 'e' back if needed
    if (baseVerb.length > 0 && !baseVerb.endsWith('e')) {
      const withE = baseVerb + 'e';
      if (['creat', 'updat', 'mak', 'us', 'writ', 'tak', 'giv', 'mov', 'sav', 'lov', 'liv', 'com', 'becom'].some(prefix => baseVerb.startsWith(prefix))) {
        baseVerb = withE;
      }
    }
  }
  
  // Convert to gerund form (works for all templates)
  // Most templates can use gerund: "enables performing", "requires updating", "involves creating"
  if (baseVerb.endsWith('e')) {
    return baseVerb.slice(0, -1) + 'ing';
  }
  
  // Handle double consonants for gerund: run -> running, plan -> planning
  const lastChar = baseVerb[baseVerb.length - 1];
  const doubleConsonantVerbs = ['run', 'plan', 'stop', 'get', 'put', 'set', 'sit', 'hit', 'cut', 'let', 'bet', 'fit', 'spit', 'split', 'shut', 'shut', 'spread', 'read', 'lead'];
  if (doubleConsonantVerbs.includes(baseVerb)) {
    return baseVerb + lastChar + 'ing';
  }
  
  // Default: add 'ing'
  return baseVerb + 'ing';
}

function buildElaborateContextualDescription(
  taskName: string,
  keywords: string[],
  phrases: string[],
  verbs: string[],
  nouns: string[],
  pronouns: string[],
  context: string,
  domain: Domain,
  domainTerms: ReturnType<typeof getDomainTerminology>,
  effortScore: number = 2.5
): string {
  // Ensure domain is always in scope for nested blocks (avoids ReferenceError: domain is not defined)
  const domainForGuidance: Domain = domain ?? (domainTerms?.context ?? DEFAULT_TASK_DOMAIN);
  const domainSafe: Domain = domainForGuidance;
  // Determine detail level based on effort score
  // Low effort (1-2): Concise, simple descriptions (1-2 sentences)
  // Medium effort (2-3): Moderate detail (2-3 sentences)
  // High effort (3-4): Detailed, comprehensive descriptions (3-4 sentences)
  // Very high effort (4-5): Extensive, step-by-step descriptions (4-5 sentences)
  const targetSentences = effortScore <= 2 ? 1 : 
                          effortScore <= 3 ? 2 : 
                          effortScore <= 4 ? 3 : 4;
  
  // Adjust slice limits based on effort - higher effort uses more terms
  const keywordLimit = effortScore <= 2 ? DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywords :
                       effortScore <= 3 ? DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsExtended :
                       DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsExtended * 1.5;
  const phraseLimit = effortScore <= 2 ? DESCRIPTION_GENERATION_CONFIG.sliceLimits.phrases :
                      effortScore <= 3 ? DESCRIPTION_GENERATION_CONFIG.sliceLimits.phrases * 1.5 :
                      DESCRIPTION_GENERATION_CONFIG.sliceLimits.phrases * 2;
  const verbLimit = effortScore <= 2 ? DESCRIPTION_GENERATION_CONFIG.sliceLimits.verbs :
                    effortScore <= 3 ? DESCRIPTION_GENERATION_CONFIG.sliceLimits.verbs * 1.5 :
                    DESCRIPTION_GENERATION_CONFIG.sliceLimits.verbs * 2;
  const nounLimit = effortScore <= 2 ? DESCRIPTION_GENERATION_CONFIG.sliceLimits.nouns :
                    effortScore <= 3 ? DESCRIPTION_GENERATION_CONFIG.sliceLimits.nouns * 1.5 :
                    DESCRIPTION_GENERATION_CONFIG.sliceLimits.nouns * 2;
  const taskNameLower = taskName.toLowerCase();
  const taskWords = taskNameLower.split(/\s+/).filter(w => w.length >= DESCRIPTION_GENERATION_CONFIG.minWordLength);
  
  // ENHANCED: Analyze task name structure to inform sentence building
  // Extract the main action and object from task name for better contextual sentences
  const taskNameAnalysis = analyzeTaskNameStructure(taskName, verbs, nouns);
  
  // STEP 0: Extract primary topic from task name to filter irrelevant keywords
  // This helps identify the main subject (e.g., "vehicles", "research", "price range")
  // and filter out keywords that don't relate to this topic
  const primaryTopics: string[] = [];
  const taskKeywordsLower = keywords.map(kw => kw.toLowerCase());
  
  // Identify primary topics from task name (longer, more specific words)
  const taskWordsByLength = taskWords
    .filter(w => w.length >= 4) // Focus on longer, more specific words
    .sort((a, b) => b.length - a.length)
    .slice(0, 5); // Top 5 longest words as primary topics
  
  primaryTopics.push(...taskWordsByLength);
  
  // Also add compound keywords and research/vehicle keywords as primary topics
  keywords.forEach(kw => {
    const kwLower = kw.toLowerCase();
    // Include compound terms, research keywords, vehicle keywords
    if (kwLower.includes('-') || kwLower.includes(' or ') || kwLower.includes(' and ') ||
        ['research', 'compare', 'evaluate', 'find', 'search', 'purchase', 'buy', 'suv', 'car', 'vehicle', 'truck', 'automobile'].some(topic => kwLower.includes(topic))) {
      if (!primaryTopics.some(t => t.toLowerCase() === kwLower)) {
        primaryTopics.push(kw);
      }
    }
  });
  
  // Helper function to check if a keyword/noun is semantically relevant to the task
  // ENHANCED: Better context understanding with conceptual relationships
  // CRITICAL: Filters out irrelevant terms from wrong domains (e.g., workout/fitness in coding tasks)
  const isSemanticallyRelevant = (term: string): boolean => {
    const termLower = term.toLowerCase();
    const termWords = termLower.split(/\s+/);
    
    // CRITICAL: Explicit exclusion of irrelevant terms based on detected domain
    // If domain is business/technical, exclude personal/health terms
    if (domainSafe === 'business') {
      if (DOMAIN_EXCLUSION_TERMS.BUSINESS_EXCLUDE_PERSONAL.some(irrelevant => 
        termLower.includes(irrelevant) || irrelevant.includes(termLower)
      )) {
        // Only exclude if task doesn't relate to these terms
        const taskHasHealthTerms = DOMAIN_EXCLUSION_TERMS.HEALTH_TASK_INDICATORS.some(indicator => 
          taskNameLower.includes(indicator)
        );
        if (!taskHasHealthTerms) {
          return false; // Exclude irrelevant personal/health terms from business domain
        }
      }
    }
    
    // If domain is personal, exclude technical terms unless task relates to them
    if (domainSafe === 'personal') {
      if (DOMAIN_EXCLUSION_TERMS.PERSONAL_EXCLUDE_TECHNICAL.some(tech => 
        termLower.includes(tech) || tech.includes(termLower)
      )) {
        const taskHasTechTerms = DOMAIN_EXCLUSION_TERMS.TECHNICAL_TASK_INDICATORS.some(indicator => 
          taskNameLower.includes(indicator)
        );
        if (!taskHasTechTerms) {
          return false; // Exclude irrelevant technical terms from personal domain
        }
      }
    }
    
    // Check if term relates to primary topics (with conceptual relationships)
    const relatesToPrimaryTopic = primaryTopics.some(topic => {
      const topicLower = topic.toLowerCase();
      // Direct match
      if (termLower.includes(topicLower) || topicLower.includes(termLower)) return true;
      // Conceptual relationship (synonyms, related concepts)
      if (areConceptsRelated(termLower, topicLower)) return true;
      // Word-level match with conceptual relationships
      return termWords.some(tw => {
        if (topicLower.includes(tw) || tw.includes(topicLower)) return true;
        return areConceptsRelated(tw, topicLower) || areWordsRelated(tw, topicLower);
      }) || topicLower.split(/\s+/).some(tw => 
        termWords.some(termWord => areConceptsRelated(termWord, tw) || areWordsRelated(termWord, tw))
      );
    });
    
    // Check if term relates to task keywords (with conceptual relationships)
    const relatesToTaskKeywords = taskKeywordsLower.some(tkw => {
      const tkwLower = tkw.toLowerCase();
      // Direct match
      if (termLower.includes(tkwLower) || tkwLower.includes(termLower)) return true;
      // Conceptual relationship
      if (areConceptsRelated(termLower, tkwLower)) return true;
      // Word-level match with conceptual relationships
      return termWords.some(tw => {
        if (tkwLower.includes(tw) || tw.includes(tkwLower)) return true;
        return areConceptsRelated(tw, tkwLower) || areWordsRelated(tw, tkwLower);
      }) || areConceptsRelated(termLower, tkwLower) || areWordsRelated(termLower, tkwLower);
    });
    
    // Check if term relates to task name words (with conceptual relationships)
    const relatesToTaskWords = taskWords.some(tw => {
      if (termLower.includes(tw) || tw.includes(termLower)) return true;
      // Conceptual relationship
      if (areConceptsRelated(termLower, tw)) return true;
      return termWords.some(termWord => areConceptsRelated(termWord, tw) || areWordsRelated(termWord, tw));
    });
    
    // Check if term is in domain terminology (domain-specific relevance)
    // ENHANCED: Also check conceptual relationships with domain terms
    const isInDomainTerminology = domainTerms.keywords.some(dk => {
      const dkLower = dk.toLowerCase();
      if (termLower.includes(dkLower) || dkLower.includes(termLower)) return true;
      if (areConceptsRelated(termLower, dkLower)) return true;
      return termWords.some(tw => {
        if (dkLower.includes(tw) || tw.includes(dkLower)) return true;
        return areConceptsRelated(tw, dkLower) || areWordsRelated(tw, dkLower);
      });
    }) || domainTerms.nouns.some(dn => {
      const dnLower = dn.toLowerCase();
      if (termLower.includes(dnLower) || dnLower.includes(termLower)) return true;
      if (areConceptsRelated(termLower, dnLower)) return true;
      return termWords.some(tw => {
        if (dnLower.includes(tw) || tw.includes(dnLower)) return true;
        return areConceptsRelated(tw, dnLower) || areWordsRelated(tw, dnLower);
      });
    });
    
    // ENHANCED: Stricter relevance check - prioritize task-specific terms
    // Term is relevant if it relates to primary topics OR task keywords OR task words
    // AND (is in domain terminology OR relates conceptually to domain terms)
    const hasTaskRelevance = relatesToPrimaryTopic || relatesToTaskKeywords || relatesToTaskWords;
    const hasDomainRelevance = isInDomainTerminology || 
      domainTerms.keywords.some(dk => areConceptsRelated(termLower, dk.toLowerCase())) ||
      domainTerms.nouns.some(dn => areConceptsRelated(termLower, dn.toLowerCase()));
    
    // STRICTER: Require BOTH task relevance AND domain relevance
    // This prevents generic domain terms from being used when they don't match the task
    // Only allow conceptual matches if there's strong task relevance
    const hasStrongTaskRelevance = relatesToPrimaryTopic || (relatesToTaskKeywords && relatesToTaskWords);
    
    // Accept if:
    // 1. Has task relevance AND domain relevance (both required)
    // 2. OR has strong task relevance with conceptual domain match
    return (hasTaskRelevance && hasDomainRelevance) || (hasStrongTaskRelevance && (isInDomainTerminology || relatesToPrimaryTopic));
  };
  
  // STEP 1: Find domain phrases that elaborate on the task (not just repeat it)
  // These provide context about what the task involves
  // IMPROVED: Uses fuzzy matching for better phrase detection
  const elaboratingPhrases: string[] = [];
  
  // Helper function for improved phrase matching with fuzzy word-level matching
  const matchesPhraseContextual = (phrase: string, keywords: string[], taskWords: string[]): boolean => {
          const phraseLower = phrase.toLowerCase();
    const phraseWords = phraseLower.split(/\s+/).filter(w => w.length >= DESCRIPTION_GENERATION_CONFIG.minWordLength);
    
    // Check if phrase contains keywords with fuzzy matching
    const containsKeywords = keywords.some(kw => {
      const kwLower = kw.toLowerCase();
      const kwWords = kwLower.split(/\s+/);
      
      // Direct match (full keyword in phrase or vice versa)
      if (phraseLower.includes(kwLower) || kwLower.includes(phraseLower)) {
        return true;
      }
      
      // Word-level match - check if any phrase word contains or is contained by keyword
      const hasDirectWordMatch = phraseWords.some(pw => 
        pw.includes(kwLower) || kwLower.includes(pw) ||
        kwWords.some(kwWord => pw.includes(kwWord) || kwWord.includes(pw))
      );
      
      // Fuzzy word relationship matching
      const hasFuzzyMatch = phraseWords.some(pw => 
        kwWords.some(kwWord => areWordsRelated(pw, kwWord))
      ) || kwWords.some(kwWord =>
        phraseWords.some(pw => areWordsRelated(kwWord, pw))
      );
      
      return hasDirectWordMatch || hasFuzzyMatch;
    }) || phraseWords.some(pw => {
      // Reverse check: phrase words that relate to keywords
      return keywords.some(tkw => {
        const tkwLower = tkw.toLowerCase();
        const tkwWords = tkwLower.split(/\s+/);
        
        // Direct match
        if (pw.includes(tkwLower) || tkwLower.includes(pw)) return true;
        
        // Fuzzy match
        return tkwWords.some(tkwWord => areWordsRelated(pw, tkwWord));
      });
    });
    
    // Check if phrase contains task name words directly with fuzzy matching
    const containsTaskWords = taskWords.some(tw => {
      // Direct match
      if (phraseLower.includes(tw) || tw.includes(phraseLower)) return true;
      // Check if any phrase word relates to task word (fuzzy)
      return phraseWords.some(pw => {
        if (pw.includes(tw) || tw.includes(pw)) return true;
        return areWordsRelated(pw, tw);
      });
    });
    
    return containsKeywords || containsTaskWords;
  };
  
  // Find domain phrases that relate to keywords OR task name words but add elaboration
  // PRIORITY: Look for phrases that contain keywords/task words but are NOT in the task name
  // This ensures we get contextual information, not just repetition
  domainTerms.phrases.forEach(phrase => {
    const phraseLower = phrase.toLowerCase();
    const phraseWords = phraseLower.split(/\s+/).filter(w => w.length >= DESCRIPTION_GENERATION_CONFIG.minWordLength);
    
    // IMPROVED: Use contextual phrase matching function
    const matchesContext = matchesPhraseContextual(phrase, taskKeywordsLower, taskWords);
    
    // More lenient check: phrase should NOT be a direct substring of task name
    // Allow partial matches if they add context
    const isDirectSubstring = taskNameLower.includes(phraseLower) && phraseLower.length > DESCRIPTION_GENERATION_CONFIG.lengthThresholds.minDirectSubstring;
    const isTaskNameSubstring = phraseLower.includes(taskNameLower) && taskNameLower.length > DESCRIPTION_GENERATION_CONFIG.lengthThresholds.minTaskNameSubstring;
    
    // Also check if phrase is too similar to task name (all words in phrase are in task name)
    // IMPROVED: Use fuzzy matching to check if words are in task name
    const allWordsInTaskName = phraseWords.length > 0 && 
      phraseWords.every(word => {
        // Direct match
        if (taskNameLower.includes(word)) return true;
        // Fuzzy match: check if any task word relates to phrase word
        return taskWords.some(tw => areWordsRelated(tw, word));
      });
    
    // Accept phrase if it matches contextually and adds new context
    // More lenient: accept if phrase relates to keywords/task words even if not all words match
    if (matchesContext && !isDirectSubstring && !isTaskNameSubstring && !allWordsInTaskName) {
      // Count how many keywords the phrase contains (more = more relevant)
      const keywordCount = taskKeywordsLower.filter(kw => {
          const kwLower = kw.toLowerCase();
        return phraseLower.includes(kwLower) || 
               phraseWords.some(pw => pw.includes(kwLower) || kwLower.includes(pw));
        }).length;
        
      // Also check if phrase adds new words not in task name
      const newWords = phraseWords.filter(word => !taskNameLower.includes(word));
      // More lenient: accept if phrase has keywords OR adds new words OR is a contextual phrase
      const contextualActionWords = DESCRIPTION_GENERATION_CONFIG.contextualActionWords as readonly string[];
      const addsContext = newWords.length > 0 || phraseWords.length > DESCRIPTION_GENERATION_CONFIG.lengthThresholds.minPhraseWords || keywordCount >= 1 ||
                        // Accept contextual phrases that explain tasks
                        phraseWords.some(pw => contextualActionWords.includes(pw));
      
      if (addsContext) {
        elaboratingPhrases.push(phrase);
      }
    }
  });
  
  // Sort by keyword count and length (prioritize phrases with more keywords and longer phrases)
  elaboratingPhrases.sort((a, b) => {
        const aKeywords = taskKeywordsLower.filter(kw => a.toLowerCase().includes(kw)).length;
        const bKeywords = taskKeywordsLower.filter(kw => b.toLowerCase().includes(kw)).length;
        if (bKeywords !== aKeywords) {
          return bKeywords - aKeywords;
        }
        return b.length - a.length;
      });
      
  // STEP 2: Find domain verbs that elaborate on actions
  // IMPROVED: Uses fuzzy matching for better verb detection
  const elaboratingVerbs: string[] = [];
  domainTerms.verbs.forEach(verb => {
    const verbLower = verb.toLowerCase();
    const verbBase = verbLower.replace(/(ing|ed|s|es|er|est|ly)$/, '');
    
    // IMPROVED: Check if verb relates to task keywords with fuzzy matching
    const relatesToKeywords = taskKeywordsLower.some(kw => {
          const kwLower = kw.toLowerCase();
      // Direct match
      if (verbLower.includes(kwLower) || kwLower.includes(verbLower) ||
          verbBase.includes(kwLower) || kwLower.includes(verbBase)) {
        return true;
      }
      // Fuzzy match
      return areWordsRelated(verbLower, kwLower) || areWordsRelated(verbBase, kwLower);
    });
    
    // IMPROVED: Check if verb relates to extracted verbs with fuzzy matching
    const relatesToExtractedVerbs = verbs.some(v => {
      const vLower = v.toLowerCase();
      const vBase = vLower.replace(/(ing|ed|s|es|er|est|ly)$/, '');
      // Direct match
      if (verbLower.includes(vLower) || vLower.includes(verbLower) ||
          verbBase.includes(vBase) || vBase.includes(verbBase)) {
        return true;
      }
      // Fuzzy match
      return areWordsRelated(verbLower, vLower) || areWordsRelated(verbBase, vBase);
    });
    
    // IMPROVED: Check if verb appears in task name with fuzzy matching
    const appearsInTaskName = taskNameLower.includes(verbLower) || 
                             taskNameLower.includes(verbBase) ||
                             taskNameLower.includes(`${verbBase}ing`) ||
                             taskNameLower.includes(`${verbBase}ed`) ||
                             taskWords.some(tw => {
                               const twBase = tw.replace(/(ing|ed|s|es|er|est|ly)$/, '');
                               return areWordsRelated(tw, verbLower) || areWordsRelated(twBase, verbBase);
                             });
    
    if ((relatesToKeywords || relatesToExtractedVerbs || appearsInTaskName) && 
        !elaboratingVerbs.some(v => v.toLowerCase() === verbLower)) {
      elaboratingVerbs.push(verb);
    }
  });
  
  // STEP 3: Find domain nouns that add context
  // IMPROVED: Uses fuzzy matching for better noun detection
  const elaboratingNouns: string[] = [];
  domainTerms.nouns.forEach(noun => {
    const nounLower = noun.toLowerCase();
    const nounBase = nounLower.replace(/s$|es$|ies$/, '').replace(/y$/, 'i');
    
    // IMPROVED: Check if noun relates to task keywords with fuzzy matching
    const relatesToKeywords = taskKeywordsLower.some(kw => {
      const kwLower = kw.toLowerCase();
      // Direct match
      if (nounLower.includes(kwLower) || kwLower.includes(nounLower) ||
          nounBase.includes(kwLower) || kwLower.includes(nounBase)) {
        return true;
      }
      // Fuzzy match
      return areWordsRelated(nounLower, kwLower) || areWordsRelated(nounBase, kwLower);
    });
    
    // IMPROVED: Check if noun relates to extracted nouns with fuzzy matching
    const relatesToExtractedNouns = nouns.some(n => {
        const nLower = n.toLowerCase();
      const nBase = nLower.replace(/s$|es$|ies$/, '').replace(/y$/, 'i');
      // Direct match
      if (nounLower.includes(nLower) || nLower.includes(nounLower) ||
          nounBase.includes(nBase) || nBase.includes(nounBase)) {
        return true;
      }
      // Fuzzy match
      return areWordsRelated(nounLower, nLower) || areWordsRelated(nounBase, nBase);
    });
    
    // IMPROVED: Check if noun appears in task name with fuzzy matching
    const appearsInTaskName = taskNameLower.includes(nounLower) || 
                              taskNameLower.includes(nounBase) ||
                              taskNameLower.includes(`${nounBase}s`) ||
                              taskWords.some(tw => {
                                const twBase = tw.replace(/s$|es$|ies$/, '').replace(/y$/, 'i');
                                return areWordsRelated(tw, nounLower) || areWordsRelated(twBase, nounBase);
                              });
    
    if ((relatesToKeywords || relatesToExtractedNouns || appearsInTaskName) && 
        !elaboratingNouns.some(n => n.toLowerCase() === nounLower)) {
      elaboratingNouns.push(noun);
    }
  });
  
  // STEP 4: Build elaborate description using extracted terms and domain terminology
  // Priority: Use domain phrases > domain verbs+nouns > extracted phrases > extracted verbs+nouns > keywords
  // Goal: Build complete contextual sentences that explain what the task involves
  // ENHANCED: Adds variation by randomly selecting different sentence structures and term combinations
  // ENHANCED: Detects and handles multi-part tasks (e.g., fix + presentation + report)
  
  let description = '';
  
  // ENHANCED: Detect multi-part tasks by identifying distinct action groups
  // For example: "fix recurring task issue" + "presentation" + "report"
  const multiPartIndicators = ['and', 'plus', 'also', 'including', 'along with', 'as well as'];
  const hasMultipleParts = multiPartIndicators.some(indicator => 
    context.toLowerCase().includes(` ${indicator} `) || 
    taskNameLower.includes(` ${indicator} `)
  ) || (phrases.length >= 2 && verbs.length >= 2);
  
  // ENHANCED: Add variation - randomly select which priority to start with (for different results each time)
  // This ensures descriptions change each time the button is pressed
  // Use timestamp-based seed for additional variation to ensure refresh always produces different results
  const timestampSeed = Date.now() % 10000; // Use timestamp for variation
  const variationSeed = (Math.random() + timestampSeed / 10000) % 1; // Combine random and timestamp
  const useVariation = variationSeed > DESCRIPTION_GENERATION_CONFIG.variation.threshold; // 70% chance to use variation
  
  // PRIORITY 1: Build complete contextual sentence using domain phrases + keywords + verbs/nouns
  // IMPROVED: Better prioritization of domain phrases and more natural sentence construction
  if (elaboratingPhrases.length > 0) {
    // For research/comparison tasks, try to combine multiple related phrases for more elaborate descriptions
    const researchKeywords = DESCRIPTION_GENERATION_CONFIG.researchTask.keywords;
    const isResearchTask = taskKeywordsLower.some(kw => researchKeywords.some(rk => kw.includes(rk) || rk.includes(kw)));
    
    // IMPROVED: Select the most relevant phrase (longer phrases are usually more descriptive)
    // Sort phrases by length and relevance to task keywords
    const sortedPhrases = elaboratingPhrases
      .map(phrase => ({
        phrase,
        cleaned: cleanText(phrase),
        relevance: taskKeywordsLower.reduce((score, kw) => {
          const phraseLower = phrase.toLowerCase();
          if (phraseLower.includes(kw)) score += 2;
          if (kw.includes(phraseLower.split(' ')[0])) score += 1;
          return score;
        }, 0),
        length: phrase.length
      }))
      .filter(p => p.cleaned.length > 0 && isValidKeyword(p.cleaned))
      .sort((a, b) => {
        // Prioritize by relevance, then by length
        if (a.relevance !== b.relevance) return b.relevance - a.relevance;
        return b.length - a.length;
      });
    
    if (sortedPhrases.length === 0) {
      // No valid phrases after cleaning, fall through to next priority
    } else {
      let bestPhrase = sortedPhrases[0].cleaned;
      let bestPhraseLower = bestPhrase.toLowerCase();
      
      // If this is a research task, try to combine multiple contextual phrases
    if (isResearchTask && elaboratingPhrases.length >= DESCRIPTION_GENERATION_CONFIG.researchTask.minPhrasesForCombination) {
      // Find phrases that work well together (research + compare + purchase)
      const phraseIndicators = DESCRIPTION_GENERATION_CONFIG.researchTask.phraseIndicators;
      const researchPhrases = elaboratingPhrases.filter(p => {
        const pLower = p.toLowerCase();
        return phraseIndicators.some(indicator => pLower.includes(indicator));
      });
      
      if (researchPhrases.length >= DESCRIPTION_GENERATION_CONFIG.researchTask.minPhrasesForCombination) {
        // Combine first two research-related phrases
        const phrase1 = researchPhrases[0];
        const phrase2 = researchPhrases[1];
        const phrase1Lower = phrase1.toLowerCase();
        const phrase2Lower = phrase2.toLowerCase();
        
        // Build elaborate sentence combining both phrases
        const parts: string[] = [];
        
        // Start with first phrase
        parts.push(phrase1.charAt(0).toUpperCase() + phrase1.slice(1));
        
        // Add second phrase if it adds new information
        if (!phrase1Lower.includes(phrase2Lower) && !phrase2Lower.includes(phrase1Lower)) {
          // Check if we need a connector using config values
          const researchCompare = DESCRIPTION_GENERATION_CONFIG.researchTask.phraseConnectors.researchCompare;
          const comparePurchase = DESCRIPTION_GENERATION_CONFIG.researchTask.phraseConnectors.comparePurchase;
          
          const hasResearchCompare = researchCompare.every(conn => phrase1Lower.includes(conn) || phrase2Lower.includes(conn));
          const hasComparePurchase = comparePurchase.every(conn => phrase1Lower.includes(conn) || phrase2Lower.includes(conn));
          
          if (hasResearchCompare || hasComparePurchase) {
            parts.push(phrase2);
          } else {
            parts.push(`${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} ${phrase2}`);
          }
        }
        
        // Get relevant keywords and nouns
        const relevantKeywords = keywords.filter(kw => {
          const kwLower = kw.toLowerCase();
          return !phrase1Lower.includes(kwLower) && !phrase2Lower.includes(kwLower) &&
                 !taskNameLower.includes(kwLower);
        }).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywords);
        
        const contextNouns = elaboratingNouns.filter(n => {
          const nLower = n.toLowerCase();
          return !phrase1Lower.includes(nLower) && !phrase2Lower.includes(nLower) &&
                 !taskNameLower.includes(nLower);
        }).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nouns);
        
        // Add context nouns or keywords
        if (contextNouns.length > 0) {
          parts.push(`${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.for} ${contextNouns.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}`);
        } else if (relevantKeywords.length > 0) {
          parts.push(`${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}`);
        }
        
        description = parts.join(' ');
        } else {
        // Use single phrase but make it more elaborate
        bestPhrase = cleanText(elaboratingPhrases[0]); // Clean HTML fragments
        bestPhraseLower = bestPhrase.toLowerCase();
      }
    }
    
    // If description not built yet, build it with single phrase
    if (!description) {
      // ENHANCED: Build complete sentences from keywords and phrases
      // Use sentence templates to construct natural, contextual descriptions
      // ENHANCED: For multi-part tasks, build sentences that properly combine all parts
      
      // Get action verb (prefer extracted, fallback to domain)
      const actionVerb = verbs.length > 0 ? verbs[0] : (elaboratingVerbs.length > 0 ? elaboratingVerbs[0] : '');
      
      // ENHANCED: For multi-part tasks, identify distinct parts and build combined sentences
      if (hasMultipleParts && phrases.length >= 2) {
        // Build a sentence that combines multiple parts
        const primaryPhrase = cleanText(elaboratingPhrases[0] || phrases[0]);
        const secondaryPhrase = cleanText(elaboratingPhrases[1] || phrases[1]);
        
        // Get relevant keywords for context
        const relevantKeywords = keywords
          .filter(kw => {
            if (!isValidKeyword(kw)) return false;
            const kwLower = cleanText(kw).toLowerCase();
            return !primaryPhrase.toLowerCase().includes(kwLower) && 
                   !secondaryPhrase.toLowerCase().includes(kwLower) &&
                   !taskNameLower.includes(kwLower) &&
                   isSemanticallyRelevant(kw);
          })
          .map(kw => cleanText(kw))
          .filter(kw => kw.length > 0)
          .slice(0, 2);
        
        // Build combined sentence
        const templateKeys = Object.keys(DESCRIPTION_GENERATION_CONFIG.descriptionTemplates);
        const selectedTemplate = templateKeys[Math.floor(variationSeed * templateKeys.length)];
        const templateOpener = DESCRIPTION_GENERATION_CONFIG.descriptionTemplates[selectedTemplate as keyof typeof DESCRIPTION_GENERATION_CONFIG.descriptionTemplates] || DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves;
        
        if (actionVerb) {
          const verbForm = getVerbFormForTemplate(actionVerb, selectedTemplate);
          if (relevantKeywords.length > 0) {
            description = `${templateOpener} ${verbForm} ${primaryPhrase.toLowerCase()} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} ${secondaryPhrase.toLowerCase()} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}.`;
          } else {
            description = `${templateOpener} ${verbForm} ${primaryPhrase.toLowerCase()} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} ${secondaryPhrase.toLowerCase()}.`;
          }
        } else {
          if (relevantKeywords.length > 0) {
            description = `${templateOpener} ${primaryPhrase.toLowerCase()} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} ${secondaryPhrase.toLowerCase()} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}.`;
          } else {
            description = `${templateOpener} ${primaryPhrase.toLowerCase()} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} ${secondaryPhrase.toLowerCase()}.`;
          }
        }
      }
      
      // Check if phrase is action-oriented (contains action words from domain terminology)
      const domainActionVerbs = domainTerms.verbs.map(v => v.toLowerCase());
      const phraseHasAction = elaboratingVerbs.some(v => bestPhraseLower.includes(v.toLowerCase())) ||
                             domainActionVerbs.some(av => bestPhraseLower.includes(av));
      
      // Get relevant keywords that relate to the phrase but aren't already in it
      // IMPROVED: Only include semantically relevant keywords, filter HTML fragments, limit to 2-3 keywords
      const relevantKeywords = keywords
        .filter(kw => {
          // First validate keyword is clean and valid
          if (!isValidKeyword(kw)) return false;
          
          const kwLower = cleanText(kw).toLowerCase();
          // Must not be in phrase or task name
          if (bestPhraseLower.includes(kwLower) || taskNameLower.includes(kwLower)) {
            return false;
          }
          // Must relate to phrase keywords
          if (!taskKeywordsLower.some(tkw => bestPhraseLower.includes(tkw.toLowerCase()) || kwLower.includes(tkw.toLowerCase()))) {
            return false;
          }
          // Must be semantically relevant to the task
          return isSemanticallyRelevant(kw);
        })
        .map(kw => cleanText(kw)) // Clean HTML fragments
        .filter(kw => kw.length > 0) // Remove empty after cleaning
        .slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsMaxJoin); // Limit keywords to avoid "and and and" chains
      
      // Get context nouns that add value - IMPROVED: Only include semantically relevant nouns, filter HTML fragments
      const contextNouns = elaboratingNouns
        .filter(n => {
          // First validate noun is clean and valid
          if (!isValidKeyword(n)) return false;
          
          const nLower = cleanText(n).toLowerCase();
          // Must not be in phrase or task name
          if (bestPhraseLower.includes(nLower) || taskNameLower.includes(nLower)) {
            return false;
          }
          // Must be semantically relevant to the task
          return isSemanticallyRelevant(n);
        })
        .map(n => cleanText(n)) // Clean HTML fragments
        .filter(n => n.length > 0) // Remove empty after cleaning
        .slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsMaxJoin); // Limit nouns to avoid long chains
      
      // ENHANCED: Build complete, natural sentences with proper sentence structure and context awareness
      // This ensures we write complete sentences from keywords and phrases, not just fragments
      // Clean the best phrase first
      const cleanedPhrase = cleanText(bestPhrase);
      
      // ENHANCED: Use task name analysis to select more contextual sentence structure
      // If task has explicit action, use action-oriented templates
      // If task is noun-based, use descriptive templates
      const templateKeys = Object.keys(DESCRIPTION_GENERATION_CONFIG.descriptionTemplates);
      let selectedTemplate: string;
      let templateOpener: string;
      
      if (templateKeys.length === 0) {
        selectedTemplate = 'involves';
        templateOpener = DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves;
      } else {
        // ENHANCED: Select template based on task name structure for better context
        if (taskNameAnalysis.hasExplicitAction && taskNameAnalysis.mainAction) {
          // Action-oriented tasks: use dynamic templates
          const actionTemplates = ['requires', 'entails', 'involves', 'includes', 'focuses'];
          const availableActionTemplates = actionTemplates.filter(t => templateKeys.includes(t));
          selectedTemplate = availableActionTemplates.length > 0
            ? availableActionTemplates[Math.floor(variationSeed * availableActionTemplates.length)]
            : templateKeys[Math.floor(variationSeed * templateKeys.length)];
        } else if (taskNameAnalysis.taskType === 'noun' && taskNameAnalysis.mainObject) {
          // Noun-based tasks: use descriptive templates
          const descriptiveTemplates = ['involves', 'concerns', 'relates', 'covers', 'addresses'];
          const availableDescriptiveTemplates = descriptiveTemplates.filter(t => templateKeys.includes(t));
          selectedTemplate = availableDescriptiveTemplates.length > 0
            ? availableDescriptiveTemplates[Math.floor(variationSeed * availableDescriptiveTemplates.length)]
            : templateKeys[Math.floor(variationSeed * templateKeys.length)];
        } else {
          // Mixed/phrase tasks: use varied templates
          selectedTemplate = templateKeys[Math.floor(variationSeed * templateKeys.length)];
        }
        templateOpener = DESCRIPTION_GENERATION_CONFIG.descriptionTemplates[selectedTemplate as keyof typeof DESCRIPTION_GENERATION_CONFIG.descriptionTemplates] || DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves;
      }
      
      // IMPROVED: Build complete, grammatically correct sentences with proper structure
      const verbForm = actionVerb ? getVerbFormForTemplate(actionVerb, selectedTemplate) : null;
      const limitedNouns = contextNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsMaxJoin);
      const limitedKeywords = relevantKeywords.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsMaxJoin);
      
      // Determine appropriate connector based on template
      let connector: string;
      if (selectedTemplate === 'aims' || selectedTemplate === 'targets') {
        connector = DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.to;
      } else if (selectedTemplate === 'focuses' || selectedTemplate === 'centers') {
        connector = DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.on;
      } else if (selectedTemplate === 'requires' || selectedTemplate === 'entails') {
        connector = DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.for;
      } else {
        connector = DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.for;
      }
      
      // ENHANCED: Build more contextual sentences that relate to task name structure
      // Use task name analysis to create sentences that feel more natural and task-specific
      if (verbForm && limitedNouns.length > 0) {
        // Template: "This task [verb] [phrase] for [nouns with articles]"
        // ENHANCED: If task has main object, incorporate it naturally
        const formattedNouns = formatItemList(limitedNouns, DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and, true);
        if (taskNameAnalysis.mainObject && !cleanedPhrase.toLowerCase().includes(taskNameAnalysis.mainObject.toLowerCase())) {
          // Add task object for better context
          description = `${templateOpener} ${verbForm} ${cleanedPhrase.toLowerCase()} ${connector} ${taskNameAnalysis.mainObject} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} ${formattedNouns}.`;
        } else {
          description = `${templateOpener} ${verbForm} ${cleanedPhrase.toLowerCase()} ${connector} ${formattedNouns}.`;
        }
      } else if (verbForm && limitedKeywords.length > 0) {
        // Template: "This task [verb] [phrase] related to [keywords]"
        // ENHANCED: Incorporate task-specific keywords more naturally
        const formattedKeywords = formatItemList(limitedKeywords, DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and, false);
        const keywordConnector = selectedTemplate === 'aims' || selectedTemplate === 'targets'
          ? DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.aimed
          : DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo;
        
        // If task has main action, use it to create more contextual sentence
        if (taskNameAnalysis.mainAction && taskNameAnalysis.mainAction !== verbForm) {
          description = `${templateOpener} ${verbForm} ${cleanedPhrase.toLowerCase()} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.through} ${taskNameAnalysis.mainAction} ${keywordConnector} ${formattedKeywords}.`;
        } else {
          description = `${templateOpener} ${verbForm} ${cleanedPhrase.toLowerCase()} ${keywordConnector} ${formattedKeywords}.`;
        }
      } else if (limitedNouns.length > 0) {
        // Template: "This task [phrase] for [nouns with articles]"
        const formattedNouns = formatItemList(limitedNouns, DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and, true);
        // ENHANCED: If task has main object, use it for better context
        if (taskNameAnalysis.mainObject && !cleanedPhrase.toLowerCase().includes(taskNameAnalysis.mainObject.toLowerCase())) {
          description = `${templateOpener} ${cleanedPhrase.toLowerCase()} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.for} ${taskNameAnalysis.mainObject} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} ${formattedNouns}.`;
        } else {
          description = `${templateOpener} ${cleanedPhrase.toLowerCase()} ${connector} ${formattedNouns}.`;
        }
      } else if (limitedKeywords.length > 0) {
        // Template: "This task [phrase] related to [keywords]"
        const formattedKeywords = formatItemList(limitedKeywords, DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and, false);
        const keywordConnector = selectedTemplate === 'aims' || selectedTemplate === 'targets'
          ? DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.aimed
          : selectedTemplate === 'focuses' || selectedTemplate === 'centers'
          ? DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.on
          : DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo;
        
        // ENHANCED: Create more natural sentence structure
        if (taskNameAnalysis.mainObject) {
          description = `${templateOpener} ${cleanedPhrase.toLowerCase()} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.for} ${taskNameAnalysis.mainObject} ${keywordConnector} ${formattedKeywords}.`;
        } else {
          description = `${templateOpener} ${cleanedPhrase.toLowerCase()} ${keywordConnector} ${formattedKeywords}.`;
        }
      } else if (verbForm) {
        // Template: "This task [verb] [phrase]"
        // ENHANCED: Add task object if available for better context
        if (taskNameAnalysis.mainObject && !cleanedPhrase.toLowerCase().includes(taskNameAnalysis.mainObject.toLowerCase())) {
          description = `${templateOpener} ${verbForm} ${cleanedPhrase.toLowerCase()} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.for} ${taskNameAnalysis.mainObject}.`;
        } else {
          description = `${templateOpener} ${verbForm} ${cleanedPhrase.toLowerCase()}.`;
        }
      } else {
        // Template: "This task [phrase]"
        // ENHANCED: Add task context for better specificity
        const finalConnector = selectedTemplate === 'focuses' || selectedTemplate === 'centers'
          ? DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.on
          : '';
        
        if (taskNameAnalysis.mainObject && !cleanedPhrase.toLowerCase().includes(taskNameAnalysis.mainObject.toLowerCase())) {
          description = finalConnector
            ? `${templateOpener} ${finalConnector} ${cleanedPhrase.toLowerCase()} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.for} ${taskNameAnalysis.mainObject}.`
            : `${templateOpener} ${cleanedPhrase.toLowerCase()} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.for} ${taskNameAnalysis.mainObject}.`;
        } else {
          description = finalConnector
            ? `${templateOpener} ${finalConnector} ${cleanedPhrase.toLowerCase()}.`
            : `${templateOpener} ${cleanedPhrase.toLowerCase()}.`;
        }
      }
    }
    } // Close else block for sortedPhrases
  } 
  // PRIORITY 2: Build sentence using domain verbs + nouns + keywords
  if (!description && elaboratingVerbs.length > 0 && elaboratingNouns.length > 0) {
    const actionVerb = elaboratingVerbs[0];
    // IMPROVED: Filter nouns by semantic relevance, filter HTML fragments, limit to 2
    const contextNouns = elaboratingNouns
      .filter(n => {
        // First validate noun is clean and valid
        if (!isValidKeyword(n)) return false;
        return isSemanticallyRelevant(n);
      })
      .map(n => cleanText(n)) // Clean HTML fragments
      .filter(n => n.length > 0) // Remove empty after cleaning
      .slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsMaxJoin); // Limit nouns to avoid long chains
    
    // Get relevant keywords that add context - IMPROVED: Only include semantically relevant keywords, filter HTML fragments, limit to 2
    const relevantKeywords = keywords
      .filter(kw => {
        // First validate keyword is clean and valid
        if (!isValidKeyword(kw)) return false;
        
        const kwLower = cleanText(kw).toLowerCase();
        // Must not be in context nouns or task name
        if (contextNouns.some(n => cleanText(n).toLowerCase().includes(kwLower)) || taskNameLower.includes(kwLower)) {
          return false;
        }
        // Must be semantically relevant to the task
        return isSemanticallyRelevant(kw);
      })
      .map(kw => cleanText(kw)) // Clean HTML fragments
      .filter(kw => kw.length > 0) // Remove empty after cleaning
      .slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsMaxJoin); // Limit keywords to avoid long chains
    
    // ENHANCED: Build complete sentence with context-aware template selection
    const templateKeys = Object.keys(DESCRIPTION_GENERATION_CONFIG.descriptionTemplates);
    const selectedTemplate = templateKeys[Math.floor(variationSeed * templateKeys.length)];
    const templateOpener = DESCRIPTION_GENERATION_CONFIG.descriptionTemplates[selectedTemplate as keyof typeof DESCRIPTION_GENERATION_CONFIG.descriptionTemplates] || DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves;
    
    const verbForm = getVerbFormForTemplate(actionVerb, selectedTemplate);
    
    // IMPROVED: Build grammatically correct sentences with proper formatting
    const formattedNouns = formatItemList(contextNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsMaxJoin), DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and, true);
    const formattedKeywords = relevantKeywords.length > 0 
      ? formatItemList(relevantKeywords.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsMaxJoin), DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and, false)
      : '';
    
    // Only use verb form if it's valid (not empty - meaning it's actually a verb)
    if (verbForm) {
      if (formattedKeywords) {
        const connector = selectedTemplate === 'aims' || selectedTemplate === 'targets'
          ? DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.aimed
          : DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo;
        description = `${templateOpener} ${verbForm} ${formattedNouns} ${connector} ${formattedKeywords}.`;
      } else {
        description = `${templateOpener} ${verbForm} ${formattedNouns}.`;
      }
    } else {
      // If verb form is empty (was a noun), build sentence without verb form
      if (formattedKeywords) {
        const connector = selectedTemplate === 'aims' || selectedTemplate === 'targets'
          ? DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.aimed
          : DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo;
        description = `${templateOpener} ${formattedNouns} ${connector} ${formattedKeywords}.`;
      } else {
        description = `${templateOpener} ${formattedNouns}.`;
      }
    }
  }
  // PRIORITY 4: Build sentence using extracted phrases + domain terminology + keywords
  if (!description && phrases.length > 0) {
    // Filter out phrases that are too similar to task name
    const contextualPhrases = phrases.filter(phrase => {
      const phraseLower = phrase.toLowerCase();
      const phraseWords = phraseLower.split(/\s+/).filter(w => w.length >= DESCRIPTION_GENERATION_CONFIG.minWordLength);
      // Reject if all words in phrase are in task name (too similar)
      const allWordsInTaskName = phraseWords.length > 0 && 
        phraseWords.every(word => taskNameLower.includes(word));
      // Reject if phrase is a direct substring
      const isDirectSubstring = taskNameLower.includes(phraseLower) && phraseLower.length > DESCRIPTION_GENERATION_CONFIG.lengthThresholds.minPhraseSubstring;
      return !allWordsInTaskName && !isDirectSubstring;
    });
    
    if (contextualPhrases.length > 0) {
      const bestPhrase = contextualPhrases[0];
      const bestPhraseLower = bestPhrase.toLowerCase();
      const actionVerb = verbs.length > 0 ? verbs[0] : (elaboratingVerbs.length > 0 ? elaboratingVerbs[0] : '');
      
      // Get relevant keywords and domain nouns - IMPROVED: Only include semantically relevant terms, filter HTML fragments, limit to 2
      const relevantKeywords = keywords
        .filter(kw => {
          // First validate keyword is clean and valid
          if (!isValidKeyword(kw)) return false;
          
          const kwLower = cleanText(kw).toLowerCase();
          // Must not be in phrase or task name
          if (bestPhraseLower.includes(kwLower) || taskNameLower.includes(kwLower)) {
            return false;
          }
          // Must be semantically relevant to the task
          return isSemanticallyRelevant(kw);
        })
        .map(kw => cleanText(kw)) // Clean HTML fragments
        .filter(kw => kw.length > 0) // Remove empty after cleaning
        .slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsMaxJoin); // Limit keywords to avoid long chains
      
      const contextNouns = elaboratingNouns
        .filter(n => {
          // First validate noun is clean and valid
          if (!isValidKeyword(n)) return false;
          
          const nLower = cleanText(n).toLowerCase();
          // Must not be in phrase
          if (bestPhraseLower.includes(nLower)) {
            return false;
          }
          // Must be semantically relevant to the task
          return isSemanticallyRelevant(n);
        })
        .map(n => cleanText(n)) // Clean HTML fragments
        .filter(n => n.length > 0) // Remove empty after cleaning
        .slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsMaxJoin); // Limit nouns to avoid long chains
      
      // ENHANCED: Build complete sentence with context-aware template selection
      const templateKeys = Object.keys(DESCRIPTION_GENERATION_CONFIG.descriptionTemplates);
      const selectedTemplate = templateKeys[Math.floor(variationSeed * templateKeys.length)];
      const templateOpener = DESCRIPTION_GENERATION_CONFIG.descriptionTemplates[selectedTemplate as keyof typeof DESCRIPTION_GENERATION_CONFIG.descriptionTemplates] || DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves;
      
      const cleanedBestPhrase = cleanText(bestPhrase);
      if (actionVerb && !bestPhraseLower.includes(actionVerb.toLowerCase())) {
        const verbForm = getVerbFormForTemplate(actionVerb, selectedTemplate);
        
        // Only use verb form if it's valid (not empty - meaning it's actually a verb)
        if (verbForm) {
          if (contextNouns.length > 0) {
            const connector = selectedTemplate === 'aims' || selectedTemplate === 'targets'
              ? DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.to
              : DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.for;
            description = `${templateOpener} ${verbForm} ${cleanedBestPhrase.toLowerCase()} ${connector} ${contextNouns[0]}.`;
          } else if (relevantKeywords.length > 0) {
            const connector = selectedTemplate === 'aims' || selectedTemplate === 'targets'
              ? DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.aimed
              : DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo;
            description = `${templateOpener} ${verbForm} ${cleanedBestPhrase.toLowerCase()} ${connector} ${relevantKeywords[0]}.`;
          } else {
            description = `${templateOpener} ${verbForm} ${cleanedBestPhrase.toLowerCase()}.`;
          }
        } else {
          // If verb form is empty (was a noun), build sentence without verb form
          if (contextNouns.length > 0) {
            const connector = selectedTemplate === 'aims' || selectedTemplate === 'targets'
              ? DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.to
              : DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.for;
            description = `${templateOpener} ${cleanedBestPhrase.toLowerCase()} ${connector} ${contextNouns[0]}.`;
          } else if (relevantKeywords.length > 0) {
            const connector = selectedTemplate === 'aims' || selectedTemplate === 'targets'
              ? DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.aimed
              : DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo;
            description = `${templateOpener} ${cleanedBestPhrase.toLowerCase()} ${connector} ${relevantKeywords[0]}.`;
          } else {
            description = `${templateOpener} ${cleanedBestPhrase.toLowerCase()}.`;
          }
        }
      } else {
        if (contextNouns.length > 0) {
          const nounsList = contextNouns.length === 1 ? contextNouns[0] : 
                           contextNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsMaxJoin).join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
          const connector = selectedTemplate === 'aims' || selectedTemplate === 'targets'
            ? DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.to
            : DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.for;
          description = `${templateOpener} ${cleanedBestPhrase.toLowerCase()} ${connector} ${nounsList}.`;
        } else if (relevantKeywords.length > 0) {
          const keywordsList = relevantKeywords.length === 1 ? relevantKeywords[0] : 
                              relevantKeywords.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsMaxJoin).join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
          const connector = selectedTemplate === 'aims' || selectedTemplate === 'targets'
            ? DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.aimed
            : selectedTemplate === 'focuses' || selectedTemplate === 'centers'
            ? DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.on
            : DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo;
          description = `${templateOpener} ${cleanedBestPhrase.toLowerCase()} ${connector} ${keywordsList}.`;
        } else {
          const connector = selectedTemplate === 'focuses' || selectedTemplate === 'centers'
            ? DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.on
            : '';
          description = connector
            ? `${templateOpener} ${connector} ${cleanedBestPhrase.toLowerCase()}.`
            : `${templateOpener} ${cleanedBestPhrase.toLowerCase()}.`;
        }
      }
    }
  }
  // PRIORITY 4: Build sentence using extracted verbs + nouns + keywords
  if (!description && verbs.length > 0 && nouns.length > 0) {
    const actionVerb = verbs[0];
    const contextNouns = nouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nouns);
    const relevantKeywords = keywords.filter(kw => 
      !contextNouns.some(n => n.toLowerCase().includes(kw.toLowerCase())) &&
      !taskNameLower.includes(kw.toLowerCase())
    ).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywords);
    
    // ENHANCED: Build complete sentence with context-aware template selection
    const templateKeys = Object.keys(DESCRIPTION_GENERATION_CONFIG.descriptionTemplates);
    const selectedTemplate = templateKeys[Math.floor(variationSeed * templateKeys.length)];
    const templateOpener = DESCRIPTION_GENERATION_CONFIG.descriptionTemplates[selectedTemplate as keyof typeof DESCRIPTION_GENERATION_CONFIG.descriptionTemplates] || DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves;
    
    const verbForm = getVerbFormForTemplate(actionVerb, selectedTemplate);
    
    // IMPROVED: Build grammatically correct sentences with proper formatting
    const formattedNouns = formatItemList(contextNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsMaxJoin), DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and, true);
    const formattedKeywords = relevantKeywords.length > 0 
      ? formatItemList(relevantKeywords.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsMaxJoin), DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and, false)
      : '';
    
    // Only use verb form if it's valid (not empty - meaning it's actually a verb)
    if (verbForm) {
      if (formattedKeywords) {
        const connector = selectedTemplate === 'aims' || selectedTemplate === 'targets'
          ? DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.aimed
          : DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo;
        description = `${templateOpener} ${verbForm} ${formattedNouns} ${connector} ${formattedKeywords}.`;
      } else {
        description = `${templateOpener} ${verbForm} ${formattedNouns}.`;
      }
    } else {
      // If verb form is empty (was a noun), build sentence without verb form
      if (formattedKeywords) {
        const connector = selectedTemplate === 'aims' || selectedTemplate === 'targets'
          ? DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.aimed
          : DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo;
        description = `${templateOpener} ${formattedNouns} ${connector} ${formattedKeywords}.`;
      } else {
        description = `${templateOpener} ${formattedNouns}.`;
      }
    }
  }
  // PRIORITY 5: Build sentence using verbs + keywords
  if (!description && verbs.length > 0 && keywords.length > 0) {
    const actionVerb = verbs[0];
    // IMPROVED: Only include semantically relevant keywords
    const relevantKeywords = keywords.filter(kw => {
      const kwLower = kw.toLowerCase();
      // Must not be in action verb or task name
      if (actionVerb.toLowerCase().includes(kwLower) || taskNameLower.includes(kwLower)) {
        return false;
      }
      // Must be semantically relevant to the task
      return isSemanticallyRelevant(kw);
    }).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywords);
    
    // ENHANCED: Build complete sentence with context-aware template selection
    const templateKeys = Object.keys(DESCRIPTION_GENERATION_CONFIG.descriptionTemplates);
    const selectedTemplate = templateKeys[Math.floor(variationSeed * templateKeys.length)];
    const templateOpener = DESCRIPTION_GENERATION_CONFIG.descriptionTemplates[selectedTemplate as keyof typeof DESCRIPTION_GENERATION_CONFIG.descriptionTemplates] || DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves;
    
    const verbForm = getVerbFormForTemplate(actionVerb, selectedTemplate);
    // Only use verb form if it's valid (not empty - meaning it's actually a verb)
    if (verbForm) {
      if (relevantKeywords.length > 0) {
        const keywordsList = relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
        description = `${templateOpener} ${verbForm} ${keywordsList}.`;
      } else {
        // Use domain nouns if available
        if (elaboratingNouns.length > 0) {
          description = `${templateOpener} ${verbForm} ${elaboratingNouns[0]}.`;
        } else {
          description = `${templateOpener} ${verbForm}.`;
        }
      }
    } else {
      // If verb form is empty (was a noun), build sentence without verb form
      if (relevantKeywords.length > 0) {
        const keywordsList = relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
        description = `${templateOpener} ${keywordsList}.`;
      } else {
        // Use domain nouns if available
        if (elaboratingNouns.length > 0) {
          description = `${templateOpener} ${elaboratingNouns[0]}.`;
        } else {
          // Fallback: use domain guidance
          const domainGuidance = DESCRIPTION_GENERATION_CONFIG.domainGuidance[domainForGuidance];
          description = `${templateOpener} ${domainGuidance.toLowerCase()}.`;
        }
      }
    }
  }
  // PRIORITY 6: Build sentence using nouns + keywords
  if (!description && nouns.length > 0 && keywords.length > 0) {
    // IMPROVED: Filter nouns by semantic relevance
    const contextNouns = nouns
      .filter(n => isSemanticallyRelevant(n))
      .slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsSingle);
    // IMPROVED: Only include semantically relevant keywords
    const relevantKeywords = keywords.filter(kw => {
      const kwLower = kw.toLowerCase();
      // Must not be in context nouns or task name
      if (contextNouns.some(n => n.toLowerCase().includes(kwLower)) || taskNameLower.includes(kwLower)) {
        return false;
      }
      // Must be semantically relevant to the task
      return isSemanticallyRelevant(kw);
    }).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywords);
    
    // ENHANCED: Build complete sentence with context-aware template selection
    const templateKeys = Object.keys(DESCRIPTION_GENERATION_CONFIG.descriptionTemplates);
    const selectedTemplate = templateKeys[Math.floor(variationSeed * templateKeys.length)];
    const templateOpener = DESCRIPTION_GENERATION_CONFIG.descriptionTemplates[selectedTemplate as keyof typeof DESCRIPTION_GENERATION_CONFIG.descriptionTemplates] || DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves;
    
    // Use action verb from extracted verbs or domain terminology
    const actionVerb = verbs.length > 0 ? verbs[0] : (elaboratingVerbs.length > 0 ? elaboratingVerbs[0] : '');
    
    const verbForm = actionVerb ? (actionVerb.endsWith('e') ? actionVerb.slice(0, -1) + 'ing' : actionVerb + 'ing') : '';
    if (relevantKeywords.length > 0) {
      const keywordsList = relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
      const connector = selectedTemplate === 'aims' || selectedTemplate === 'targets'
        ? DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.aimed
        : DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo;
      if (actionVerb) {
        description = `${templateOpener} ${verbForm} ${contextNouns[0]} ${connector} ${keywordsList}.`;
      } else {
        description = `${templateOpener} ${contextNouns[0]} ${connector} ${keywordsList}.`;
      }
    } else {
      const connector = selectedTemplate === 'aims' || selectedTemplate === 'targets'
        ? DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.to
        : selectedTemplate === 'focuses' || selectedTemplate === 'centers'
        ? DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.on
        : '';
      if (actionVerb) {
        description = connector
          ? `${templateOpener} ${verbForm} ${contextNouns[0]} ${connector}.`
          : `${templateOpener} ${verbForm} ${contextNouns[0]}.`;
      } else {
        description = connector
          ? `${templateOpener} ${contextNouns[0]} ${connector}.`
          : `${templateOpener} ${contextNouns[0]}.`;
      }
    }
  }
  // PRIORITY 7: Build sentence using keywords + domain terminology
  if (!description && keywords.length > 0) {
    // IMPROVED: Only include semantically relevant keywords
    const relevantKeywords = keywords
      .filter(kw => {
        const kwLower = kw.toLowerCase();
        // Must not be in task name
        if (taskNameLower.includes(kwLower)) {
          return false;
        }
        // Must be semantically relevant to the task
        return isSemanticallyRelevant(kw);
      })
      .slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsExtended);
    const actionVerb = verbs.length > 0 ? verbs[0] : (elaboratingVerbs.length > 0 ? elaboratingVerbs[0] : '');
    
    const verbForm = actionVerb ? (actionVerb.endsWith('e') ? actionVerb.slice(0, -1) + 'ing' : actionVerb + 'ing') : '';
    if (actionVerb && relevantKeywords.length > 0) {
      const keywordsList = relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
      description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${keywordsList}.`;
    } else if (relevantKeywords.length > 0) {
      // Try to add domain nouns for context
      const keywordsList = relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
      if (elaboratingNouns.length > 0) {
        description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${keywordsList} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.for} ${elaboratingNouns[0]}.`;
      } else {
        description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${keywordsList}.`;
      }
    } else if (actionVerb) {
      description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm}.`;
    }
  }
  
  // PRIORITY 8: If description is still empty, build using domain terminology only
  // This ensures we always return a contextual description, never empty
  if (!description || description.trim().length === 0) {
    // Use domain phrases, verbs, and nouns to build a contextual sentence
    if (elaboratingPhrases.length > 0) {
      const bestPhrase = elaboratingPhrases[0];
      const actionVerb = elaboratingVerbs.length > 0 ? elaboratingVerbs[0] : '';
      const contextNouns = elaboratingNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsSingle);
      
      const cleanedBestPhrase = cleanText(bestPhrase);
      const verbForm = actionVerb ? (actionVerb.endsWith('e') ? actionVerb.slice(0, -1) + 'ing' : actionVerb + 'ing') : '';
      if (actionVerb && contextNouns.length > 0) {
        description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${cleanedBestPhrase.toLowerCase()} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.for} ${contextNouns[0]}.`;
      } else if (actionVerb) {
        description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${cleanedBestPhrase.toLowerCase()}.`;
      } else if (contextNouns.length > 0) {
        description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${cleanedBestPhrase.toLowerCase()} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.for} ${contextNouns[0]}.`;
      } else {
        description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${cleanedBestPhrase.toLowerCase()}.`;
      }
    } else if (elaboratingVerbs.length > 0 && elaboratingNouns.length > 0) {
      const actionVerb = elaboratingVerbs[0];
      const verbForm = actionVerb.endsWith('e') ? actionVerb.slice(0, -1) + 'ing' : actionVerb + 'ing';
      const contextNouns = elaboratingNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nouns);
      const nounsList = contextNouns.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
      description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${nounsList}.`;
    } else if (elaboratingVerbs.length > 0) {
      const actionVerb = elaboratingVerbs[0];
      const verbForm = actionVerb.endsWith('e') ? actionVerb.slice(0, -1) + 'ing' : actionVerb + 'ing';
      const domainGuidance = DESCRIPTION_GENERATION_CONFIG.domainGuidance[domainForGuidance];
      description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${domainGuidance.toLowerCase()}.`;
    } else if (elaboratingNouns.length > 0) {
      const contextNouns = elaboratingNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsSingle);
      const domainGuidance = DESCRIPTION_GENERATION_CONFIG.domainGuidance[domainForGuidance];
      description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${contextNouns[0]} ${domainGuidance.toLowerCase()}.`;
    } else {
      // Last resort: use domain guidance as description
      const domainGuidance = DESCRIPTION_GENERATION_CONFIG.domainGuidance[domainForGuidance];
      description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${domainGuidance.toLowerCase()}.`;
    }
  }
  
  // Ensure description doesn't just repeat the task name
  // Check multiple similarity conditions to catch more cases
  const descriptionLower = description.toLowerCase().trim();
  const taskWordsForComparison = taskNameLower.split(/\s+/).filter(w => w.length >= 2);
  const descriptionWords = descriptionLower.split(/\s+/).filter(w => w.length >= 2);
  
  // Check if description is identical or contains all task words
  const isIdentical = descriptionLower === taskNameLower.trim();
  const containsAllTaskWords = taskWordsForComparison.length > 0 && 
    taskWordsForComparison.every(word => descriptionLower.includes(word));
  
  // Check if description is mostly task name words (80%+ overlap)
  const commonWords = taskWordsForComparison.filter(word => descriptionWords.includes(word));
  const wordOverlapRatio = taskWordsForComparison.length > 0 ? commonWords.length / taskWordsForComparison.length : 0;
  const isTooSimilar = wordOverlapRatio >= DESCRIPTION_GENERATION_CONFIG.similarityThresholds.wordOverlapRatio && 
    descriptionWords.length <= taskWordsForComparison.length + DESCRIPTION_GENERATION_CONFIG.similarityThresholds.maxWordDifference;
  
  if (isIdentical || containsAllTaskWords || isTooSimilar) {
    // If description is too similar to task name, rebuild with more elaboration
    // Build a complete contextual sentence using domain terminology
    if (elaboratingPhrases.length > 0) {
      // Use best elaborating phrase with action verb and context
      const bestPhrase = elaboratingPhrases[0];
      const bestPhraseLower = bestPhrase.toLowerCase();
      const actionVerb = verbs.length > 0 ? verbs[0] : (elaboratingVerbs.length > 0 ? elaboratingVerbs[0] : '');
      
      // Get relevant keywords and nouns that add context - IMPROVED: Only include semantically relevant terms
        const relevantKeywords = keywords.filter(kw => {
          const kwLower = kw.toLowerCase();
        // Must not be in phrase or task name
        if (bestPhraseLower.includes(kwLower) || taskNameLower.includes(kwLower)) {
          return false;
        }
        // Must be semantically relevant to the task
        return isSemanticallyRelevant(kw);
      }).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywords);
      
      const contextNouns = elaboratingNouns.filter(n => {
        const nLower = n.toLowerCase();
        // Must not be in phrase
        if (bestPhraseLower.includes(nLower)) {
          return false;
        }
        // Must be semantically relevant to the task
        return isSemanticallyRelevant(n);
      }).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywords);
      
      // Build complete sentence with proper sentence opener
      const cleanedBestPhrase = cleanText(bestPhrase);
      const verbForm = actionVerb ? (actionVerb.endsWith('e') ? actionVerb.slice(0, -1) + 'ing' : actionVerb + 'ing') : '';
      
      if (actionVerb && !bestPhraseLower.includes(actionVerb.toLowerCase())) {
        if (contextNouns.length > 0) {
          const nounsList = contextNouns.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
          description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${cleanedBestPhrase.toLowerCase()} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.for} ${nounsList}.`;
        } else if (relevantKeywords.length > 0) {
          const keywordsList = relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
          description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${cleanedBestPhrase.toLowerCase()} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${keywordsList}.`;
        } else {
          description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${cleanedBestPhrase.toLowerCase()}.`;
        }
      } else {
        if (contextNouns.length > 0) {
          const nounsList = contextNouns.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
          description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${cleanedBestPhrase.toLowerCase()} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.for} ${nounsList}.`;
        } else if (relevantKeywords.length > 0) {
          const keywordsList = relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
          description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${cleanedBestPhrase.toLowerCase()} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${keywordsList}.`;
        } else {
          description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${cleanedBestPhrase.toLowerCase()}.`;
        }
      }
    } else if (elaboratingVerbs.length > 0 && elaboratingNouns.length > 0) {
      // Use domain verbs and nouns with keywords
      const actionVerb = elaboratingVerbs[0];
      const contextNouns = elaboratingNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nouns);
      const relevantKeywords = keywords.filter(kw => 
        !contextNouns.some(n => n.toLowerCase().includes(kw.toLowerCase())) &&
        !taskNameLower.includes(kw.toLowerCase())
      ).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywords);
      
      const verbForm = actionVerb.endsWith('e') ? actionVerb.slice(0, -1) + 'ing' : actionVerb + 'ing';
      const nounsList = contextNouns.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
      
      if (relevantKeywords.length > 0) {
        const keywordsList = relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
        description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${nounsList} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${keywordsList}.`;
      } else {
        description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${nounsList}.`;
      }
        } else {
      // Build sentence using available terms
      const actionVerb = verbs.length > 0 ? verbs[0] : (elaboratingVerbs.length > 0 ? elaboratingVerbs[0] : '');
      const contextNouns = nouns.length > 0 ? nouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsSingle) : (elaboratingNouns.length > 0 ? elaboratingNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsSingle) : []);
      const relevantKeywords = keywords.filter(kw => !taskNameLower.includes(kw.toLowerCase())).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywords);
      
      const verbForm = actionVerb ? (actionVerb.endsWith('e') ? actionVerb.slice(0, -1) + 'ing' : actionVerb + 'ing') : '';
      
      if (actionVerb) {
        if (contextNouns.length > 0) {
          description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${contextNouns[0]}.`;
        } else if (relevantKeywords.length > 0) {
          const keywordsList = relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
          description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${keywordsList}.`;
        } else {
          description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm}.`;
        }
      } else if (contextNouns.length > 0) {
        if (relevantKeywords.length > 0) {
          const keywordsList = relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
          description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${contextNouns[0]} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${keywordsList}.`;
        } else {
          description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${contextNouns[0]}.`;
        }
      } else if (relevantKeywords.length > 0) {
        const keywordsList = relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
        description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${keywordsList}.`;
      } else {
        // Last resort: use domain guidance
        const domainGuidance = DESCRIPTION_GENERATION_CONFIG.domainGuidance[domainForGuidance];
        if (domainGuidance) {
          description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${domainGuidance.toLowerCase()}.`;
        }
      }
    }
  }
  
  // Clean HTML fragments and ensure proper capitalization and punctuation
  description = cleanText(description).trim();
  
  // Remove duplicate words/phrases within sentences (fixes "tesing task involves tesing" issues)
  const words = description.split(/\s+/);
  const deduplicatedWords: string[] = [];
  const recentWords = new Set<string>();
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase();
    const isDuplicate = recentWords.has(word);
    
    // Skip if it's an immediate duplicate (same word repeated within last few words)
    if (isDuplicate && i > 0 && words[i-1]?.toLowerCase() === word) {
      continue; // Skip immediate duplicate
    }
    
    // Add word if not a recent duplicate
    if (!isDuplicate || (i > DESCRIPTION_DEDUPLICATION_CONFIG.MIN_WORD_DISTANCE && words[i - DESCRIPTION_DEDUPLICATION_CONFIG.MIN_WORD_DISTANCE]?.toLowerCase() !== word)) {
      deduplicatedWords.push(words[i]);
      recentWords.add(word);
      // Keep only recent words in set
      if (recentWords.size > DESCRIPTION_DEDUPLICATION_CONFIG.MAX_RECENT_WORDS) {
        const oldestWord = Array.from(recentWords)[0];
        recentWords.delete(oldestWord);
      }
    }
  }
  
  description = deduplicatedWords.join(' ').trim();
  
  // Remove duplicate sentences (check for repeated patterns)
  const sentences = description.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const uniqueSentences: string[] = [];
  const seenSentences = new Set<string>();
  
  for (const sentence of sentences) {
    const cleanedSentence = sentence.trim().toLowerCase();
    // More aggressive duplicate detection - check for similar sentences
    const isSimilar = Array.from(seenSentences).some(seen => {
      const similarity = calculateSentenceSimilarity(cleanedSentence, seen);
      return similarity > DESCRIPTION_DEDUPLICATION_CONFIG.SENTENCE_SIMILARITY_THRESHOLD;
    });
    
    if (!isSimilar && cleanedSentence.length > DESCRIPTION_DEDUPLICATION_CONFIG.MIN_SENTENCE_LENGTH) {
      seenSentences.add(cleanedSentence);
      uniqueSentences.push(sentence.trim());
    }
  }
  
  description = uniqueSentences.join('. ').trim();
  
  if (description.length > 0) {
    description = description.charAt(0).toUpperCase() + description.slice(1);
    if (!DESCRIPTION_GENERATION_CONFIG.sentenceEndPattern.test(description)) {
      description += '.';
    }
  }
  
  return description;
}

/**
 * Calculate similarity between two sentences (0-1 scale)
 * Used to detect duplicate or very similar sentences
 */
function calculateSentenceSimilarity(sentence1: string, sentence2: string): number {
  const words1 = sentence1.split(/\s+/).filter(w => w.length >= 2);
  const words2 = sentence2.split(/\s+/).filter(w => w.length >= 2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = new Set([...set1].filter(w => set2.has(w)));
  const union = new Set([...set1, ...set2]);
  
  // Jaccard similarity
  return intersection.size / union.size;
}

/**
 * Shuffle array using Fisher-Yates algorithm for variation
 * Optional seed parameter ensures different shuffles for refresh button
 */
function shuffleArray<T>(array: T[], seed?: number): T[] {
  const shuffled = [...array];
  // Use seed-based random if provided, otherwise use Math.random for variation
  let seedValue = seed;
  const random = seedValue !== undefined 
    ? () => {
        // Simple seeded random function for consistent but varied shuffling
        seedValue = ((seedValue! * 9301 + 49297) % 233280);
        return seedValue! / 233280;
      }
    : () => Math.random();
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Build complete sentences from keywords and phrases
 * Uses sentence templates to construct natural, contextual descriptions
 */
function buildCompleteSentences(
  keywords: string[],
  phrases: string[],
  verbs: string[],
  nouns: string[],
  domainTerms: ReturnType<typeof getDomainTerminology>,
  taskName: string
): string[] {
  const sentences: string[] = [];
  const taskNameLower = taskName.toLowerCase();
  
  // Sentence templates for different combinations
  type SentenceTemplate = 
    | ((v: string, n: string, k: string) => string)
    | ((p: string, k: string) => string)
    | ((v: string, k: string[]) => string)
    | ((p: string, k: string[]) => string)
    | ((v: string, n: string, k: string[]) => string);
  
  const sentenceTemplates: SentenceTemplate[] = [
    // Template 1: Verb + Noun + Context
    (v: string, n: string, k: string | string[]) => {
      const keyword = typeof k === 'string' ? k : k[0];
      return `${v.charAt(0).toUpperCase() + v.slice(1)} ${n} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${keyword}.`;
    },
    // Template 2: Phrase + Context
    (p: string, k: string | string[]) => {
      const keyword = typeof k === 'string' ? k : k[0];
      return `${p.charAt(0).toUpperCase() + p.slice(1)} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.involving} ${keyword}.`;
    },
    // Template 3: Verb + Keywords
    (v: string, k: string | string[]) => {
      const keywords = typeof k === 'string' ? [k] : k;
      return `${v.charAt(0).toUpperCase() + v.slice(1)} ${keywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}.`;
    },
    // Template 4: Phrase + Keywords
    (p: string, k: string | string[]) => {
      const keywords = typeof k === 'string' ? [k] : k;
      return `${p.charAt(0).toUpperCase() + p.slice(1)} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${keywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}.`;
    },
    // Template 5: Complete contextual sentence
    (v: string, n: string, k: string | string[]) => {
      const keywords = typeof k === 'string' ? [k] : k;
      return `${v.charAt(0).toUpperCase() + v.slice(1)} ${n} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${keywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}.`;
    },
  ];
  
  // Build sentences using available terms
  if (verbs.length > 0 && nouns.length > 0 && keywords.length > 0) {
    const verb = verbs[0];
    const noun = nouns[0];
    const keyword = keywords[0];
    if (!taskNameLower.includes(verb.toLowerCase()) && 
        !taskNameLower.includes(noun.toLowerCase()) && 
        !taskNameLower.includes(keyword.toLowerCase())) {
      const template = sentenceTemplates[0] as (v: string, n: string, k: string | string[]) => string;
      sentences.push(template(verb, noun, keyword));
    }
  }
  
  if (phrases.length > 0 && keywords.length > 0) {
    const phrase = phrases[0];
    const keyword = keywords[0];
    if (!taskNameLower.includes(phrase.toLowerCase()) && 
        !taskNameLower.includes(keyword.toLowerCase())) {
      const template = sentenceTemplates[1] as (p: string, k: string | string[]) => string;
      sentences.push(template(phrase, keyword));
    }
  }
  
  if (verbs.length > 0 && keywords.length > 1) {
    const verb = verbs[0];
    const relevantKeywords = keywords
      .filter(k => !taskNameLower.includes(k.toLowerCase()))
      .slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsMaxJoin);
    if (relevantKeywords.length > 0 && !taskNameLower.includes(verb.toLowerCase())) {
      const template = sentenceTemplates[2] as (v: string, k: string | string[]) => string;
      sentences.push(template(verb, relevantKeywords));
    }
  }
  
  if (phrases.length > 0 && keywords.length > 1) {
    const phrase = phrases[0];
    const relevantKeywords = keywords
      .filter(k => !taskNameLower.includes(k.toLowerCase()))
      .slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsMaxJoin);
    if (relevantKeywords.length > 0 && !taskNameLower.includes(phrase.toLowerCase())) {
      const template = sentenceTemplates[3] as (p: string, k: string | string[]) => string;
      sentences.push(template(phrase, relevantKeywords));
    }
  }
  
  return sentences;
}

/**
 * Build contextual description from search results using keywords and phrases
 * NEW FLOW: Constructs natural description from search results that contain keywords and phrases
 * UPDATED: Now uses elaborate description builder to avoid repeating task name
 * ENHANCED: Adds variation by shuffling terms and using different sentence structures
 * ENHANCED: Now accepts effortScore parameter for better detail control
 */
function buildContextualDescription(
  taskName: string,
  keywords: string[],
  phrases: string[],
  verbs: string[],
  nouns: string[],
  pronouns: string[],
  context: string,
  domain: Domain,
  domainTerms: ReturnType<typeof getDomainTerminology>,
  effortScore: number = 2.5
): string {
  // ENHANCED: Add variation - shuffle terms to get different results each time
  // Use timestamp-based seed for additional variation to ensure refresh always produces different results
  const variationSeed = Date.now() % 1000; // Use timestamp for additional variation
  const shuffledKeywords = shuffleArray(keywords, variationSeed);
  const shuffledPhrases = shuffleArray(phrases, variationSeed + 1);
  const shuffledVerbs = shuffleArray(verbs, variationSeed + 2);
  const shuffledNouns = shuffleArray(nouns, variationSeed + 3);
  
  // Use the elaborate description builder with shuffled terms for variation
  return buildElaborateContextualDescription(
    taskName,
    shuffledKeywords,
    shuffledPhrases,
    shuffledVerbs,
    shuffledNouns,
    pronouns,
    context,
    domain,
    domainTerms,
    effortScore
  );
}

/** Filtered terminology shape returned by filterTerminologyRelevantToTask (for description and action plan). */
export interface FilteredTerminology {
  keywords: string[];
  phrases: string[];
  verbs: string[];
  nouns: string[];
}

/**
 * Relevance score: 2 = full phrase in task, 1 = two+ words match, 0 = single word only.
 * Only terms with score >= TERMINOLOGY_RELEVANCE_MIN_SCORE are kept.
 */
function relevanceScore(term: string, taskLower: string, taskWords: string[]): number {
  if (!term || typeof term !== 'string') return 0;
  const t = term.toLowerCase().trim();
  if (t.length < 2) return 0;
  if (taskLower.includes(t)) return 2;
  const termWords = t.split(/\s+/).filter(w => w.length >= 2);
  if (termWords.length === 0) return taskLower.includes(t) ? 2 : 0;
  const matchedWords = termWords.filter(tw => taskLower.includes(tw) || taskWords.some(tw2 => tw2.includes(tw) || tw.includes(tw2)));
  if (matchedWords.length >= 2 || matchedWords.length === termWords.length) return 1;
  if (matchedWords.length === 1) return 0;
  return 0;
}

/**
 * Filter domain terminology to only terms relevant to the task name and situation.
 * Uses stricter matching (phrase/substring or two+ words) and excludes wrong-context terms.
 * Exported for use by action-plan-generator so description and action plan share one vocabulary.
 */
export function filterTerminologyRelevantToTask(
  taskName: string,
  domain: Domain,
  domainTerms: ReturnType<typeof getDomainTerminology>,
  maxPerCategory: number
): FilteredTerminology {
  const taskLower = taskName.toLowerCase().replace(/\bappt\.?\b/gi, 'appointment').replace(/\bdr\.?\b/gi, 'doctor');
  const taskWords = taskLower.split(/\W+/).filter(w => w.length >= 2);
  const minScore = DOMAIN_EXCLUSION_TERMS.TERMINOLOGY_RELEVANCE_MIN_SCORE ?? 1;
  const wrongContext: readonly string[] = (DOMAIN_EXCLUSION_TERMS.TERMINOLOGY_WRONG_CONTEXT as Record<string, readonly string[]>)[domain] ?? [];

  const isWrongContext = (term: string): boolean => {
    const t = term.toLowerCase().trim();
    if (taskLower.includes(t)) return false;
    return wrongContext.some(wc => t.includes(wc) || wc.includes(t) || t === wc);
  };

  const filterAndCap = (arr: string[]): string[] => {
    return (arr || [])
      .filter(term => !isWrongContext(term))
      .map(term => ({ term, score: relevanceScore(term, taskLower, taskWords) }))
      .filter(({ score }) => score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxPerCategory)
      .map(({ term }) => term);
  };

  return {
    keywords: filterAndCap(domainTerms.keywords || []),
    phrases: filterAndCap(domainTerms.phrases || []),
    verbs: filterAndCap(domainTerms.verbs || []),
    nouns: filterAndCap(domainTerms.nouns || []),
  };
}

/**
 * Generates a task description based on task name using Browser AI
 * Browser AI extracts keywords, phrases, verbs, and nouns directly from the task name
 * Local Terminology acts as a cache/dictionary to enhance extracted terms
 * 
 * @param taskName - The task title/name
 * @param accessToken - Optional access token for API calls
 * @param existingDescription - Optional existing description to use for domain detection
 * @param effortScore - Optional effort score (1-5) to adjust description detail level
 * @param actionPlanSteps - Optional action plan step titles to weave into descriptions
 * @param breakdownContext - Optional domain + filtered terminology from breakdown (use same context as action plan)
 */
export async function generateDescription(
  taskName: string, 
  accessToken?: string | null,
  existingDescription?: string | null,
  effortScore?: number,
  actionPlanSteps?: string[],
  breakdownContext?: { domain: Domain; filteredTerminology: FilteredTerminology }
): Promise<GeneratedDescription> {
  try {
  if (!taskName || taskName.trim().length === 0) {
    return {
      description: '',
      domain: DEFAULT_TASK_DOMAIN,
      confidence: 0,
      source: 'local',
    };
  }

  const taskNameLower = taskName.toLowerCase().trim();
  let domainRef: Domain;
  let terminology: FilteredTerminology;
  let domainTerms: ReturnType<typeof getDomainTerminology>;

  if (breakdownContext?.domain && breakdownContext?.filteredTerminology) {
    domainRef = breakdownContext.domain;
    terminology = breakdownContext.filteredTerminology;
    domainTerms = getDomainTerminology(domainRef);
    logger.debug('📝 Description Generation: Using breakdown context (same as action plan)', { domain: domainRef });
  } else {
    // Detect domain from task name AND description (if available) for better accuracy
    const descriptionForDetection = existingDescription?.trim() || '';
    const taskNameLower = taskName.toLowerCase();
    const descriptionLower = descriptionForDetection.toLowerCase();
    const technicalIndicators = DOMAIN_EXCLUSION_TERMS.TECHNICAL_TASK_INDICATORS;
    const isTechnicalTask = technicalIndicators.some(indicator => taskNameLower.includes(indicator)) ||
                           taskNameLower.includes('prd') || taskNameLower.includes('bug') ||
                           taskNameLower.includes('issue') || taskNameLower.includes('fix') ||
                           taskNameLower.includes('recurring') || taskNameLower.includes('re-occurring');
    const personalExcludeTerms = DOMAIN_EXCLUSION_TERMS.BUSINESS_EXCLUDE_PERSONAL;
    const hasWrongPersonalTerms = personalExcludeTerms.some(term => descriptionLower.includes(term)) ||
                                  descriptionLower.includes('purchase') || descriptionLower.includes('travel') ||
                                  (descriptionLower.includes('personal') && !taskNameLower.includes('personal'));
    const domainResult = detectDomain(taskName, isTechnicalTask && hasWrongPersonalTerms ? '' : descriptionForDetection);
    domainRef = domainResult.domain;

    domainTerms = await new Promise<ReturnType<typeof getDomainTerminology>>((resolve) => {
      setTimeout(async () => {
        try {
          const terms = await getDomainTerminologyAsync(domainRef);
          resolve(terms);
        } catch (error) {
          logger.warn('Error fetching domain terminology, using sync version:', error);
          resolve(getDomainTerminology(domainRef));
        }
      }, 0);
    });

    const maxTerms = DESCRIPTION_GENERATION_CONFIG.maxTerminologyTermsForServer;
    // Terminology for server: filter by task name only so the aid set is task-relevant (description used only for domain detection above)
    terminology = filterTerminologyRelevantToTask(taskName, domainRef, domainTerms, maxTerms);
    logger.debug('📝 Description Generation: Using domain detection with description; terminology filtered to task name only', {
      taskName,
      detectedDomain: domainRef,
      confidence: domainResult.confidence,
    });
  }

  // Create/save: add new keywords or phrases from description when present (runs for both server and fallback paths)
  if (existingDescription && existingDescription.trim().length > 0 && domainRef !== 'mixed') {
    const descExtracted = extractTermsFromTaskName(existingDescription.trim(), domainTerms);
    const hasDescTerms =
      descExtracted.keywords.length > 0 ||
      descExtracted.phrases.length > 0 ||
      descExtracted.verbs.length > 0 ||
      descExtracted.nouns.length > 0;
    if (hasDescTerms) {
      saveNewTerminologyToLibrary(
        domainRef,
        descExtracted.keywords,
        descExtracted.phrases,
        descExtracted.verbs,
        descExtracted.nouns
      );
    }
  }

  // Use only local and shared terminology (no OpenAI). Extract terms and build description.
  let description = '';
  let confidence: number = DESCRIPTION_GENERATION_CONFIG.baseConfidence;
  let usedSearchResults = false;
  let searchContext = '';
  let searchExtracted = {
    keywords: [] as string[],
    phrases: [] as string[],
    verbs: [] as string[],
    nouns: [] as string[],
    pronouns: [] as string[],
    context: ''
  };

  logger.debug(`Extracting terms from task name: "${taskName}", domain: ${domainRef}`);
  const taskNameExtracted = extractTermsFromTaskName(taskName, domainTerms);
  let descriptionExtracted = {
    keywords: [] as string[],
    phrases: [] as string[],
    verbs: [] as string[],
    nouns: [] as string[],
    pronouns: [] as string[],
    context: ''
  };
  if (existingDescription && existingDescription.trim().length > 0) {
    descriptionExtracted = extractTermsFromTaskName(existingDescription.trim(), domainTerms);
    logger.debug(`Extracted terms from existing description: ${descriptionExtracted.keywords.length} keywords, ${descriptionExtracted.phrases.length} phrases`);
  }
  
  // Fallback: task name = basis, terminology = aid. Use only task-name-derived terms so we don't inject description-only topics.
  const combinedKeywords = taskNameExtracted.keywords;
  const combinedPhrases = taskNameExtracted.phrases;
  const combinedVerbs = taskNameExtracted.verbs;
  const combinedNouns = taskNameExtracted.nouns;
  const combinedPronouns = taskNameExtracted.pronouns;
  const combinedContext = taskName.trim();
  
  searchExtracted = {
    keywords: combinedKeywords,
    phrases: combinedPhrases,
    verbs: combinedVerbs,
    nouns: combinedNouns,
    pronouns: combinedPronouns,
    context: combinedContext
  };
  
  searchContext = combinedContext;
  usedSearchResults = false; // Not using external search, using Browser AI only
  
  logger.debug(`✅ Local Terminology extraction COMPLETE: ${searchExtracted.keywords.length} keywords, ${searchExtracted.phrases.length} phrases, ${searchExtracted.verbs.length} verbs, ${searchExtracted.nouns.length} nouns`, {
    keywords: searchExtracted.keywords,
    phrases: searchExtracted.phrases,
    verbs: searchExtracted.verbs,
    nouns: searchExtracted.nouns,
    hasResults: searchExtracted.keywords.length > 0 || searchExtracted.phrases.length > 0 || searchExtracted.verbs.length > 0 || searchExtracted.nouns.length > 0
  });
  
  // Verify results are being sent
  if (searchExtracted.keywords.length === 0 && searchExtracted.phrases.length === 0 && 
      searchExtracted.verbs.length === 0 && searchExtracted.nouns.length === 0) {
    logger.warn(`⚠️ WARNING: Local Terminology extraction returned NO results for task: "${taskName}"`);
  }

  // STEP 2: Prefer terms that appear in the task name so description stays on-topic (avoids irrelevant topics from bad prior descriptions)
  const inTaskName = (term: string) => taskNameLower.includes((term || '').toLowerCase());
  let finalKeywords: string[] = searchExtracted.keywords.filter(inTaskName);
  let finalPhrases: string[] = searchExtracted.phrases.filter(inTaskName);
  let finalVerbs: string[] = searchExtracted.verbs.filter(inTaskName);
  let finalNouns: string[] = searchExtracted.nouns.filter(inTaskName);
  if (finalKeywords.length === 0) finalKeywords = searchExtracted.keywords;
  if (finalPhrases.length === 0) finalPhrases = searchExtracted.phrases;
  if (finalVerbs.length === 0) finalVerbs = searchExtracted.verbs;
  if (finalNouns.length === 0) finalNouns = searchExtracted.nouns;
  const finalPronouns = searchExtracted.pronouns;

  // Exclude prepositions and number-only terms from noun/keyword lists so we don't produce "an under and a car" or "a 15k"
  const notStandaloneInDescription = (term: string): boolean => {
    const t = (term || '').trim().toLowerCase().replace(/[.,;:!?]$/, '');
    if (PREPOSITIONS_NOT_AS_NOUNS.has(t)) return true;
    if (/^\d+[kKmM]?$/.test(t)) return true;
    return false;
  };
  finalKeywords = finalKeywords.filter(t => !notStandaloneInDescription(t));
  finalNouns = finalNouns.filter(t => !notStandaloneInDescription(t));

  logger.debug(`✅ Local terminology: ${finalKeywords.length} keywords, ${finalPhrases.length} phrases, ${finalVerbs.length} verbs, ${finalNouns.length} nouns`);

  // Use local sentence building when server AI was not used or didn't return a valid description
  if (!description || description.trim().length === 0) {
    const hasMultiWordPhrase = finalPhrases.some(p => (p || '').trim().split(/\s+/).length >= 2);
    const onlySingleWordNouns = finalNouns.length >= 2 && finalNouns.every(n => (n || '').trim().split(/\s+/).length === 1);
    // When we only have single-word nouns (e.g. "car", "search") and no multi-word phrase, building would produce "a car and a search". Use task name instead.
    if (!hasMultiWordPhrase && onlySingleWordNouns && taskName.trim().length > 0) {
      const taskNameLower = taskName.toLowerCase().trim();
      description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${taskNameLower.endsWith('.') ? taskNameLower : taskNameLower + '.'}`;
      logger.debug('Using task-name-based description (no multi-word phrase; would produce poor noun list)');
    } else {
      logger.debug(`🔧 Using local sentence building`);
      const normalizedEffortScore = effortScore !== undefined && effortScore >= 1 && effortScore <= 5 
        ? effortScore 
        : 2.5;
      description = buildContextualDescription(
        taskName,
        finalKeywords,
        finalPhrases,
        finalVerbs,
        finalNouns,
        finalPronouns,
        searchContext,
        domainRef,
        domainTerms,
        normalizedEffortScore
      );
    }
  }
      
  logger.debug(`Description after buildContextualDescription:`, {
    description,
    descriptionLength: description.length,
    hasContext: searchContext.length > 0,
    usedContext: description.length > 0 && searchContext.length > 0
  });

  // Replace poor "X and Y" noun-list descriptions (e.g. "using a car and a search") with task-name-based description
  if (description && isPoorNounListDescription(description, taskName)) {
    const taskNameLower = taskName.toLowerCase().trim();
    const opener = DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves;
    description = `${opener} ${taskNameLower.endsWith('.') ? taskNameLower : taskNameLower + '.'}`;
    logger.debug('Replaced poor noun-list description with task-name-based description');
  }

  // STEP 5: Check if description is too similar to task name or needs improvement
  // Use taskNameLower and descriptionLower already declared above for domain detection
  const taskNameLowerForComparison = taskName.toLowerCase().trim();
  const descriptionLowerForComparison = description ? description.toLowerCase().trim() : '';
  
  // Check if description is identical to task name
  const isIdenticalToTaskName = descriptionLowerForComparison === taskNameLowerForComparison;
  
  // Check if description contains all task name words (too similar)
  const taskWordsForComparison = taskNameLowerForComparison.split(/\s+/).filter(w => w.length >= 2);
  const descriptionWordsForComparison = descriptionLowerForComparison.split(/\s+/).filter(w => w.length >= 2);
  const containsAllTaskWords = taskWordsForComparison.length > 0 && 
    taskWordsForComparison.every(word => descriptionLowerForComparison.includes(word));
  
  // Check if description is mostly task name words (80%+ overlap)
  const commonWordsForComparison = taskWordsForComparison.filter(word => descriptionWordsForComparison.includes(word));
  const wordOverlapRatio = taskWordsForComparison.length > 0 ? commonWordsForComparison.length / taskWordsForComparison.length : 0;
  const isTooSimilarToTaskName = wordOverlapRatio >= DESCRIPTION_GENERATION_CONFIG.similarityThresholds.wordOverlapRatio && 
    descriptionWordsForComparison.length <= taskWordsForComparison.length + DESCRIPTION_GENERATION_CONFIG.similarityThresholds.maxWordDifference;
  
      const isDescriptionTooShort = description && description.trim().length < DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.descriptionTooShortThreshold;
  // Check if description is too generic (very short or uses common generic verbs)
  const genericVerbs = DESCRIPTION_GENERATION_CONFIG.genericVerbs;
      const isDescriptionTooGeneric = description && (
    description.split(' ').length <= DESCRIPTION_GENERATION_CONFIG.similarityThresholds.maxGenericWordCount && 
    genericVerbs.some(verb => description.toLowerCase().includes(verb))
  );

  // Check if description needs improvement (too short, generic, identical to task name, or too similar)
  if ((!description || description.trim().length === 0 || isDescriptionTooShort || isDescriptionTooGeneric || 
       isIdenticalToTaskName || containsAllTaskWords || isTooSimilarToTaskName)) {
    // Rebuild description using domain terminology to ensure it's contextual
    // Never use task name directly - always build a contextual sentence
    logger.debug(`Description is empty/short/generic, rebuilding with domain terminology`);
    
    // Use the already declared taskNameLower from domain detection above
    const taskNameLowerForRebuild = taskName.toLowerCase();
    const domainGuidance = DESCRIPTION_GENERATION_CONFIG.domainGuidance[domainRef];
    
    // Get domain phrases that relate to the task name (share at least one word) so we don't insert unrelated terms like "report" or "forecast"
    const taskWordsForRebuild = taskNameLowerForRebuild.split(/\s+/).filter(w => w.length >= 2);
    const domainPhrases = domainTerms.phrases.filter(phrase => {
      const phraseLower = phrase.toLowerCase();
      if (taskNameLowerForRebuild.includes(phraseLower) || phraseLower.length <= DESCRIPTION_GENERATION_CONFIG.similarityThresholds.minPhraseLength) return false;
      const phraseWords = phraseLower.split(/\s+/);
      const relatesToTask = phraseWords.some(pw => taskWordsForRebuild.some(tw => tw.includes(pw) || pw.includes(tw)));
      return relatesToTask;
    }).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.domainTerms);
    
    const domainVerbs = domainTerms.verbs.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.domainTerms);
    const domainNounsForFallback = domainTerms.nouns.filter(noun => {
      const n = noun.toLowerCase();
      return taskWordsForRebuild.some(tw => tw.includes(n) || n.includes(tw));
    }).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.domainTerms);
    
    // Get extracted terms; prefer task-relevant final terms over generic domain lists
    const actionVerb = finalVerbs.length > 0 ? finalVerbs[0] : (domainVerbs.length > 0 ? domainVerbs[0] : '');
    const contextNouns = finalNouns.length > 0 ? finalNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsSingle) : (domainNounsForFallback.length > 0 ? domainNounsForFallback.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsSingle) : []);
    // Only use keywords that relate to the task name (share at least one word) so we don't insert "milestone", "customer", "forecast", etc.
    const relevantKeywords = finalKeywords.filter(kw => {
      const kwLower = kw.toLowerCase();
      if (taskNameLowerForRebuild.includes(kwLower) || kwLower.length < DESCRIPTION_GENERATION_CONFIG.similarityThresholds.minKeywordLength) return false;
      const kwWords = kwLower.split(/\s+/).filter(w => w.length >= 2);
      const relatesToTask = kwWords.some(pw => taskWordsForRebuild.some(tw => tw.includes(pw) || pw.includes(tw)));
      return relatesToTask;
    }).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywords);
    
    // Build contextual sentence using available terms - clean all inputs first
    const cleanedActionVerb = actionVerb ? cleanText(actionVerb) : '';
    const cleanedContextNouns = contextNouns.map(n => cleanText(n)).filter(n => n.length > 0 && isValidKeyword(n));
    const cleanedRelevantKeywords = relevantKeywords.map(kw => cleanText(kw)).filter(kw => kw.length > 0 && isValidKeyword(kw));
    
    // ENHANCED: Build contextual sentence with template variation
    const templateKeys = Object.keys(DESCRIPTION_GENERATION_CONFIG.descriptionTemplates);
    const fallbackVariationSeed = Math.random();
    const selectedTemplate = templateKeys[Math.floor(fallbackVariationSeed * templateKeys.length)];
    const templateOpener = DESCRIPTION_GENERATION_CONFIG.descriptionTemplates[selectedTemplate as keyof typeof DESCRIPTION_GENERATION_CONFIG.descriptionTemplates] || DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves;
    
    const verbForm = cleanedActionVerb ? getVerbFormForTemplate(cleanedActionVerb, selectedTemplate) : '';
    
    if (domainPhrases.length > 0) {
      const bestPhrase = cleanText(domainPhrases[0]);
      if (cleanedActionVerb) {
        description = `${templateOpener} ${verbForm} ${bestPhrase.toLowerCase()}.`;
      } else {
        const connector = selectedTemplate === 'focuses' || selectedTemplate === 'centers'
          ? DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.on
          : '';
        description = connector
          ? `${templateOpener} ${connector} ${bestPhrase.toLowerCase()}.`
          : `${templateOpener} ${bestPhrase.toLowerCase()}.`;
      }
    } else if (cleanedActionVerb && cleanedContextNouns.length > 0) {
      const formattedNouns = formatItemList(cleanedContextNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsMaxJoin), DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and, true);
      description = `${templateOpener} ${verbForm} ${formattedNouns}.`;
    } else if (cleanedActionVerb && cleanedRelevantKeywords.length > 0) {
      const formattedKeywords = formatItemList(cleanedRelevantKeywords.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsMaxJoin), DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and, false);
      description = `${templateOpener} ${verbForm} ${formattedKeywords}.`;
    } else if (cleanedActionVerb) {
      description = `${templateOpener} ${verbForm} ${domainGuidance.toLowerCase()}.`;
    } else if (cleanedContextNouns.length > 0) {
      const formattedNouns = formatItemList(cleanedContextNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsMaxJoin), DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and, true);
      const connector = selectedTemplate === 'aims' || selectedTemplate === 'targets'
        ? DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.to
        : DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.for;
      description = `${templateOpener} ${formattedNouns} ${connector} ${domainGuidance.toLowerCase()}.`;
    } else if (cleanedRelevantKeywords.length > 0) {
      const formattedKeywords = formatItemList(cleanedRelevantKeywords.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsMaxJoin), DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and, false);
      const connector = selectedTemplate === 'aims' || selectedTemplate === 'targets'
        ? DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.aimed
        : DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo;
      description = `${templateOpener} ${formattedKeywords} ${connector} ${domainGuidance.toLowerCase()}.`;
    } else {
      // No task-specific terms: always include task name so description reflects user input
      description = `${templateOpener} ${taskNameLowerForRebuild}. ${domainGuidance.toLowerCase()}`;
    }
    
    logger.debug(`Rebuilt description using domain terminology: "${description.substring(0, 50)}..."`);
  }

  // STEP 4: Calculate confidence based on Browser AI-extracted terms
  const hasBrowserAITerms = finalKeywords.length > 0 || finalPhrases.length > 0 || 
                             finalVerbs.length > 0 || finalNouns.length > 0;
  
  // Base confidence for Browser AI extraction
  const baseConf: number = DESCRIPTION_GENERATION_CONFIG.searchBaseConfidence;
  
  // Boost for Browser AI-extracted terms
  const browserAIBoost: number = hasBrowserAITerms ? 
    (finalKeywords.length * DESCRIPTION_GENERATION_CONFIG.keywordWeight) + 
    (finalPhrases.length * DESCRIPTION_GENERATION_CONFIG.phraseWeight) +
    (finalVerbs.length * DESCRIPTION_GENERATION_CONFIG.verbWeight) + 
    (finalNouns.length * DESCRIPTION_GENERATION_CONFIG.nounWeight) : 0;
  
  // Context boost if we have meaningful task name context
  const contextBoost: number = searchContext.length >= DESCRIPTION_GENERATION_CONFIG.minContextLength ? DESCRIPTION_GENERATION_CONFIG.contextBoost.high : 
                      searchContext.length >= DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.contextBoostThreshold ? DESCRIPTION_GENERATION_CONFIG.contextBoost.medium : 0;
  
      confidence = Math.min(
    baseConf + browserAIBoost + contextBoost,
        DESCRIPTION_GENERATION_CONFIG.maxConfidence
      ) as number;
      
  logger.debug(`✅ Browser AI: description length=${description.length}, confidence=${confidence.toFixed(2)}, hasBrowserAITerms=${hasBrowserAITerms}, contextLength=${searchContext.length}`, {
    finalDescription: description.substring(0, 100),
    browserAITermsCount: finalKeywords.length + finalPhrases.length + finalVerbs.length,
    finalKeywords: finalKeywords.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsLogging),
    finalPhrases: finalPhrases.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.phrasesLogging),
    finalVerbs: finalVerbs.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.verbsLogging),
    finalNouns: finalNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsLogging),
    contextPreview: searchContext.substring(0, 100)
  });
  
  // VERIFICATION: Log Browser AI extraction results
  logger.debug(`✅ Using Browser AI to extract terms from task name:`, {
    extractedKeywords: finalKeywords.length,
    extractedPhrases: finalPhrases.length,
    extractedVerbs: finalVerbs.length,
    extractedNouns: finalNouns.length,
    taskName: taskName,
    contextLength: searchContext.length
  });

  // STEP 5: Ultimate fallback if still empty (only if Browser AI and cache failed)
  if (!description || description.trim().length === 0) {
    // Ultimate fallback: use template variation (only when everything else fails)
    logger.warn(`Browser AI and local terminology cache failed for "${taskName}", using ultimate fallback`);
    const templateKeys = Object.keys(DESCRIPTION_GENERATION_CONFIG.descriptionTemplates);
    const fallbackTemplate = templateKeys[Math.floor(Math.random() * templateKeys.length)];
    const fallbackOpener = DESCRIPTION_GENERATION_CONFIG.descriptionTemplates[fallbackTemplate as keyof typeof DESCRIPTION_GENERATION_CONFIG.descriptionTemplates] || DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves;
    description = `${fallbackOpener} ${taskName.toLowerCase()}. ${DESCRIPTION_GENERATION_CONFIG.domainGuidance[domainRef]}`;
    confidence = DESCRIPTION_GENERATION_CONFIG.baseConfidence;
  }

  // Clean HTML fragments and ensure we always return a non-empty description
  // Apply multiple passes of cleaning to catch all fragments
  let finalDescription = cleanText(description).trim();
  
  // Additional cleaning pass: remove any remaining fragments that might have been missed
  finalDescription = cleanText(finalDescription).trim();
  
  // ENHANCED: Remove only truly duplicate consecutive words/phrases, not all duplicates
  // This preserves sentence structure while removing actual duplicates
  // Split into sentences first to preserve sentence boundaries
  const sentences = finalDescription.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const cleanedSentences: string[] = [];
  
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/);
    const cleanedWords: string[] = [];
    let lastWord = '';
    
    // Only remove consecutive duplicate words (e.g., "the the" -> "the")
    for (const word of words) {
      const wordLower = word.toLowerCase();
      // Only skip if it's the same as the previous word (consecutive duplicate)
      if (wordLower !== lastWord.toLowerCase() || word.length === 0) {
        cleanedWords.push(word);
        lastWord = word;
      }
    }
    
    let cleanedSentence = cleanedWords.join(' ').replace(/\s+/g, ' ').trim();
    if (cleanedSentence.length > 0) {
      cleanedSentences.push(normalizeSentenceUSEnglish(cleanedSentence));
    }
  }

  // Rejoin with proper punctuation (US English: period-space between sentences)
  finalDescription = cleanedSentences.join('. ').trim();
  if (finalDescription.length > 0 && finalDescription.charAt(0) === finalDescription.charAt(0).toLowerCase()) {
    finalDescription = finalDescription.charAt(0).toUpperCase() + finalDescription.slice(1);
  }
  finalDescription = trimRunOnOnly(finalDescription);

  // Final validation: ensure description is meaningful
  if (!finalDescription || finalDescription.length === 0) {
    // Ultimate fallback: create a basic description from task name
    const fallbackDescription = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${taskName.toLowerCase()}.`;
    logger.warn(`Generated description is empty for "${taskName}", using fallback`);
    return {
      description: fallbackDescription,
      domain: domainRef,
      confidence: DESCRIPTION_GENERATION_CONFIG.baseConfidence,
    };
  }
  
  // Remove any trailing fragments that might have been left
  finalDescription = finalDescription.replace(/\s*[">;]\s*$/, '').trim();
  
  // Remove leading whitespace and ensure sentences start at first line
  finalDescription = finalDescription.replace(/^\s+/, '').replace(/\n\s+/g, '\n');
  
  // Ensure description ends with proper punctuation
  if (!finalDescription.match(/[.!?]$/)) {
    finalDescription = finalDescription + '.';
  }

    logger.debug(`Generated description for "${taskName}": domain=${domainRef}, confidence=${confidence.toFixed(2)}, usedBrowserAI=true, descriptionLength=${finalDescription.length}, preview="${finalDescription.substring(0, 50)}..."`);
    
    // FINAL CHECK: If Browser AI extraction failed and got a fallback description, log warning
    if (finalDescription.includes(DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves)) {
      logger.warn(`WARNING: Browser AI extraction produced fallback description for "${taskName}". This indicates extraction from task name wasn't sufficient.`);
    }

  return {
    description: stripOffTopicSentences(finalDescription, taskName),
    domain: domainRef,
    confidence,
    source: 'local',
  };
  } catch (error) {
    // Error handling: ensure we always return a valid result
    logger.error(`Error generating description for "${taskName}":`, error);
    const domainResult = detectDomain(taskName, existingDescription?.trim() || '');
    const domain = domainResult.domain;
    const domainGuidance = DESCRIPTION_GENERATION_CONFIG.domainGuidance[domain];
    const fallbackDescription = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${taskName.toLowerCase()}. ${domainGuidance}`;
    
    return {
      description: stripOffTopicSentences(fallbackDescription, taskName),
      domain,
      confidence: DESCRIPTION_GENERATION_CONFIG.baseConfidence,
      source: 'local',
    };
  }
}

/**
 * Generate multiple description options based on task name and effort score
 * Creates 3-5 variations with different levels of detail/complexity
 * 
 * @param taskName - The task title/name
 * @param effortScore - Effort score (1-5) to adjust description detail level
 * @param accessToken - Optional access token for API calls
 * @param existingDescription - Optional existing description to use for domain detection
 * @param actionPlanSteps - Optional action plan step titles to weave into descriptions
 */
export async function generateDescriptionOptions(
  taskName: string,
  effortScore: number,
  accessToken?: string | null,
  existingDescription?: string | null,
  actionPlanSteps?: string[],
  breakdownContext?: { domain: Domain; filteredTerminology: FilteredTerminology }
): Promise<GeneratedDescription[]> {
  try {
    if (!taskName || taskName.trim().length === 0) {
      return [];
    }

    // Normalize effort score
    const normalizedEffortScore = effortScore >= 1 && effortScore <= 5 
      ? effortScore 
      : 2.5;

    // Use only local and shared terminology (no OpenAI). Generate 3-5 options with varying detail levels.
    const numOptions = normalizedEffortScore <= DESCRIPTION_OPTIONS_CONFIG.LOW_EFFORT_THRESHOLD 
      ? DESCRIPTION_OPTIONS_CONFIG.MIN_OPTIONS
      : normalizedEffortScore <= DESCRIPTION_OPTIONS_CONFIG.MEDIUM_EFFORT_THRESHOLD 
      ? DESCRIPTION_OPTIONS_CONFIG.MID_OPTIONS 
      : DESCRIPTION_OPTIONS_CONFIG.MAX_OPTIONS;

    const options: GeneratedDescription[] = [];

    // Defer heavy async operations to avoid blocking UI
    // Use setTimeout(0) to yield to the event loop between operations
    const generateWithDelay = async (index: number, variantEffortScore: number): Promise<void> => {
      return new Promise((resolve) => {
        // Yield to event loop before each async operation
        setTimeout(async () => {
          try {
            const generated = await generateDescription(
              taskName,
              accessToken,
              existingDescription,
              variantEffortScore,
              actionPlanSteps,
              breakdownContext
            );

            // Only add if description is not empty and not duplicate
            if (generated.description && generated.description.trim().length > 0) {
              // Check for duplicates (similar descriptions)
              const isDuplicate = options.some(opt => {
                const similarity = calculateDescriptionSimilarity(
                  opt.description,
                  generated.description
                );
                return similarity > DESCRIPTION_OPTIONS_CONFIG.DUPLICATE_SIMILARITY_THRESHOLD;
              });

              if (!isDuplicate) {
                options.push(generated);
              }
            }
          } catch (error) {
            logger.warn(`Error generating description option ${index}:`, error);
          }
          resolve();
        }, DESCRIPTION_OPTIONS_CONFIG.EVENT_LOOP_YIELD_DELAY);
      });
    };

    // Generate options with slight variations in effort score to get different detail levels
    // Process sequentially but yield to event loop between operations
    for (let i = 0; i < numOptions; i++) {
      // Vary the effort score slightly for each option to get different detail levels
      // Option 0: Base effort score
      // Option 1: Slightly lower (more concise)
      // Option 2: Slightly higher (more detailed)
      // Option 3+: Alternate between base and variations
      let variantEffortScore = normalizedEffortScore;
      if (i === 1 && normalizedEffortScore > 1.5) {
        variantEffortScore = Math.max(1, normalizedEffortScore - DESCRIPTION_OPTIONS_CONFIG.VARIATION_MEDIUM);
      } else if (i === 2 && normalizedEffortScore < 4.5) {
        variantEffortScore = Math.min(5, normalizedEffortScore + DESCRIPTION_OPTIONS_CONFIG.VARIATION_MEDIUM);
      } else if (i >= 3) {
        // Alternate between base and variations for remaining options
        variantEffortScore = i % 2 === 0 
          ? Math.min(5, normalizedEffortScore + DESCRIPTION_OPTIONS_CONFIG.VARIATION_SMALL)
          : Math.max(1, normalizedEffortScore - DESCRIPTION_OPTIONS_CONFIG.VARIATION_SMALL);
      }

      // Generate with delay to avoid blocking
      await generateWithDelay(i, variantEffortScore);
    }

    // If we didn't get enough unique options, generate more with different variations
    // Limit iterations to prevent infinite loops
    let retryCount = 0;
    while (options.length < numOptions && options.length < DESCRIPTION_OPTIONS_CONFIG.MAX_OPTIONS && retryCount < DESCRIPTION_OPTIONS_CONFIG.MAX_RETRIES) {
      // Try with more extreme effort score variations
      const extremeEffortScore = options.length % 2 === 0
        ? Math.min(5, normalizedEffortScore + DESCRIPTION_OPTIONS_CONFIG.VARIATION_LARGE)
        : Math.max(1, normalizedEffortScore - DESCRIPTION_OPTIONS_CONFIG.VARIATION_LARGE);

      // Generate with delay to avoid blocking
      await generateWithDelay(options.length, extremeEffortScore);
      
      retryCount++;
      
      // Safety check to prevent infinite loop
      if (options.length >= DESCRIPTION_OPTIONS_CONFIG.MAX_OPTIONS) break;
    }

    // Sort by confidence (highest first) and return
    return options.sort((a, b) => b.confidence - a.confidence);
  } catch (error) {
    logger.error(`Error generating description options for "${taskName}":`, error);
    // Return at least one fallback option (defer to avoid blocking)
    return new Promise((resolve) => {
      setTimeout(async () => {
        try {
          const fallback = await generateDescription(
            taskName,
            accessToken,
            existingDescription,
            effortScore,
            actionPlanSteps
          );
          resolve(fallback.description ? [fallback] : []);
        } catch (fallbackError) {
          logger.error('Error generating fallback description:', fallbackError);
          resolve([]);
        }
      }, DESCRIPTION_OPTIONS_CONFIG.EVENT_LOOP_YIELD_DELAY);
    });
  }
}

/**
 * Calculate similarity between two descriptions (0-1 scale)
 * Uses simple word overlap ratio
 */
function calculateDescriptionSimilarity(desc1: string, desc2: string): number {
  if (!desc1 || !desc2) return 0;
  
  const words1 = new Set(desc1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(desc2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Build an accurate description (sentence or short paragraph) from suggested phrases/keywords.
 * Used when the user has seen the action plan and optional phrases and asks to "develop a complete description".
 * Uses whatever length is needed to accurately describe the task (one sentence or multiple).
 *
 * @param taskName - The task title (for context)
 * @param phrases - Suggested phrases from getSuggestivePhrases
 * @param keywords - Suggested keywords
 * @param verbs - Suggested verbs
 * @param nouns - Suggested nouns
 * @returns A contextual sentence or short paragraph, or empty string if no usable terms
 */
export function buildCompleteDescriptionFromPhrases(
  taskName: string,
  phrases: string[],
  keywords: string[],
  verbs: string[],
  nouns: string[]
): string {
  const rules = DESCRIPTION_GENERATION_CONFIG.descriptionRules;
  const maxSentences = rules?.maxSentences ?? 5;
  const maxCharsTotal = rules?.maxCharsTotal ?? 400;
  const maxWordsPerSentence = rules?.maxWordsPerSentence ?? 25;
  const templateOpener = DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves;
  const taskNameLower = (taskName || '').toLowerCase().trim();
  const phrase1 = (phrases[0] || '').trim();
  const phrase2 = (phrases[1] || '').trim();
  const keyword1 = (keywords[0] || '').trim();
  const verb = (verbs[0] || '').trim();
  const noun = (nouns[0] || '').trim();

  if (!phrase1 && !keyword1 && !verb) return '';

  const verbForm = verb ? (verb.endsWith('e') ? verb + 'ing' : verb + 'ing') : '';
  const sentences: string[] = [];

  if (phrase1 && !taskNameLower.includes(phrase1.toLowerCase())) {
    if (verbForm) {
      sentences.push(`${templateOpener} ${verbForm} ${phrase1.toLowerCase()}.`);
    } else {
      sentences.push(`${templateOpener} ${phrase1.toLowerCase()}.`);
    }
  } else if (keyword1 && !taskNameLower.includes(keyword1.toLowerCase())) {
    if (verbForm) {
      sentences.push(`${templateOpener} ${verbForm} ${keyword1.toLowerCase()}.`);
    } else {
      sentences.push(`${templateOpener} ${keyword1.toLowerCase()}.`);
    }
  } else if (verbForm) {
    sentences.push(noun
      ? `${templateOpener} ${verbForm} ${noun.toLowerCase()}.`
      : `${templateOpener} ${verbForm} the task.`);
  } else {
    return '';
  }

  if (phrase2 && phrase2 !== phrase1 && !taskNameLower.includes(phrase2.toLowerCase()) && sentences.length < maxSentences) {
    const second = `It also covers ${phrase2.toLowerCase()}.`;
    if ((sentences.join(' ').length + second.length) <= maxCharsTotal) sentences.push(second);
  } else if (keyword1 && phrase1 && sentences.length === 1 && (keywords[1] || '').trim() && sentences[0].length < 120) {
    const kw2 = (keywords[1] || '').trim();
    if (kw2 && !taskNameLower.includes(kw2.toLowerCase()) && !phrase1.toLowerCase().includes(kw2.toLowerCase())) {
      const second = `This includes ${kw2}.`;
      if ((sentences.join(' ').length + second.length) <= maxCharsTotal) sentences.push(second);
    }
  }

  let out = sentences.join(' ');
  const words = out.split(/\s+/).filter(w => w.length > 0);
  if (words.length > maxWordsPerSentence * maxSentences) {
    out = words.slice(0, maxWordsPerSentence * maxSentences).join(' ').trim();
    if (!out.endsWith('.')) out += '.';
  }
  if (out.length > maxCharsTotal) {
    out = out.slice(0, maxCharsTotal).trim();
    const lastPeriod = out.lastIndexOf('.');
    if (lastPeriod > maxCharsTotal * 0.7) out = out.slice(0, lastPeriod + 1);
    else if (!out.endsWith('.')) out += '.';
  }
  return out;
}

/**
 * AI Analysis: Provides suggestive phrases for manual description writing
 * Returns contextual phrases, keywords, verbs, and nouns that users can use to write their own descriptions
 * This function is called when users want to manually write descriptions with AI assistance
 * 
 * @param taskName - The task title/name
 * @param existingDescription - Optional existing description
 */
export function getSuggestivePhrases(
  taskName: string,
  existingDescription?: string | null
): {
  phrases: string[];
  keywords: string[];
  verbs: string[];
  nouns: string[];
  domain: Domain;
} {
  try {
    if (!taskName || taskName.trim().length === 0) {
      return {
        phrases: [],
        keywords: [],
        verbs: [],
        nouns: [],
        domain: DEFAULT_TASK_DOMAIN,
      };
    }

    // Detect domain
    const descriptionForDetection = existingDescription?.trim() || '';
    const domainResult = detectDomain(taskName, descriptionForDetection);
    const domain = domainResult.domain;
    const domainTerms = getDomainTerminology(domain);

    // Extract terms using Browser AI (async, but this function needs to be sync for now)
    // Use local extraction as fallback for sync version
    const localExtracted = extractTermsFromTaskName(taskName, domainTerms);
    const extracted = {
      keywords: localExtracted.keywords,
      phrases: localExtracted.phrases,
      verbs: localExtracted.verbs,
      nouns: localExtracted.nouns,
      pronouns: localExtracted.pronouns,
      context: taskName,
    };
    
    // Enhance with Local Terminology (proactively provides additional keywords)
    const enhanced = validateAndEnhanceTermsWithDictionary(extracted, taskName, domainTerms);
    
    // Return suggestive phrases, keywords, verbs, and nouns for manual writing
    return {
      phrases: enhanced.phrases.slice(0, 10), // Top 10 phrases
      keywords: enhanced.keywords.slice(0, 15), // Top 15 keywords
      verbs: enhanced.verbs.slice(0, 10), // Top 10 verbs
      nouns: enhanced.nouns.slice(0, 10), // Top 10 nouns
      domain,
    };
  } catch (error) {
    logger.error(`Error getting suggestive phrases for "${taskName}":`, error);
    return {
      phrases: [],
      keywords: [],
      verbs: [],
      nouns: [],
      domain: DEFAULT_TASK_DOMAIN,
    };
  }
}
