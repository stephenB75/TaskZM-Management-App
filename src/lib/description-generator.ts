/**
 * Description Generator
 * 
 * Generates task descriptions based on task name using Browser AI
 * with domain-specific terminology, keywords, verbs, and action words.
 * Browser AI extracts terms directly from the task name.
 * Local Terminology acts as a cache/dictionary to enhance extracted terms.
 */

import { detectDomain, type Domain, getDomainTerminology, getDomainTerminologyAsync, saveNewTerminologyToLibrary, DOMAIN_TERMINOLOGIES } from './domain-terminology';
import { DESCRIPTION_GENERATION_CONFIG } from './ai-config';
import { logger } from './logger';
import { DEFAULT_TASK_DOMAIN } from './task-constants';

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
    // Remove CSS property fragments (more comprehensive)
    .replace(/\d+px;?/gi, '') // Remove any pixel values like "12px;", "10px", etc.
    .replace(/font-size\s*:\s*[^;]+;?/gi, '')
    .replace(/color\s*:\s*[^;]+;?/gi, '')
    .replace(/font-family\s*:\s*[^;]+;?/gi, '')
    .replace(/line-height\s*:\s*[^;]+;?/gi, '')
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
    .replace(/px;?/gi, '') // Remove any remaining px fragments
    .replace(/">/g, '') // Remove any remaining quote-bracket fragments
    .replace(/;\s*>/g, '') // Remove any remaining semicolon-bracket fragments
    .replace(/\s*>\s*/g, ' ') // Remove any standalone > characters
    .replace(/\s+/g, ' ') // Normalize whitespace again
    .trim();
  
  // Final validation: if the cleaned text is mostly fragments, return empty
  const fragmentPatterns = /(px|">|;>|font-size|color:)/gi;
  const fragmentMatches = (cleaned.match(fragmentPatterns) || []).length;
  const wordCount = cleaned.split(/\s+/).filter(w => w.length >= DESCRIPTION_GENERATION_CONFIG.minWordLength).length;
  if (fragmentMatches > wordCount) {
    return ''; // Too many fragments, likely invalid
  }
  
  return cleaned;
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
 * FLOW: Local Terminology extracts terms first, then provides them to Browser AI
 * 1. Local Terminology extracts keywords/phrases from task name using domain dictionary
 * 2. Local Terminology provides extracted terms to Browser AI
 * 3. Browser AI uses those terms to build contextual sentences
 */
export function extractTermsFromTaskNameWithBrowserAI(
  taskName: string,
  domainTerms: ReturnType<typeof getDomainTerminology>
): { 
  keywords: string[]; 
  phrases: string[];
  verbs: string[]; 
  nouns: string[];
  pronouns: string[];
  context: string;
} {
  // STEP 1: LOCAL TERMINOLOGY extracts keywords and phrases from task name
  // Local Terminology uses domain dictionary to extract relevant terms
  logger.debug(`🔍 Local Terminology: Extracting keywords and phrases from task name: "${taskName}"`);
  
  const localTerminologyExtracted = extractTermsFromTaskName(taskName, domainTerms);
  
  logger.debug(`✅ Local Terminology extraction COMPLETE: ${localTerminologyExtracted.keywords.length} keywords, ${localTerminologyExtracted.phrases.length} phrases, ${localTerminologyExtracted.verbs.length} verbs, ${localTerminologyExtracted.nouns.length} nouns`, {
    keywords: localTerminologyExtracted.keywords.slice(0, 10),
    phrases: localTerminologyExtracted.phrases.slice(0, 10),
    verbs: localTerminologyExtracted.verbs.slice(0, 10),
    nouns: localTerminologyExtracted.nouns.slice(0, 10),
  });
  
  // STEP 2: Browser AI receives extracted terms from Local Terminology
  // Browser AI will use these terms to build contextual sentences
  // Also extract additional keywords from task name for Browser AI context
  const taskKeywords = extractKeywordsFromTaskName(taskName);
  
  // STEP 3: Browser AI receives and uses Local Terminology extracted terms
  // Combine Local Terminology extracted terms with additional task name analysis
  // Browser AI will use these terms to build contextual sentences
  
  // Start with Local Terminology extracted terms (primary source)
  let foundKeywords = [...localTerminologyExtracted.keywords];
  let foundPhrases = [...localTerminologyExtracted.phrases];
  let foundVerbs = [...localTerminologyExtracted.verbs];
  let foundNouns = [...localTerminologyExtracted.nouns];
  let foundPronouns = [...localTerminologyExtracted.pronouns];
  
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
    context: taskName, // Task name as context for Browser AI
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
 */
function extractTermsFromTaskName(
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
  
  // Save new keywords and phrases to library
  if (newKeywords.length > 0 || newPhrases.length > 0) {
    // Extract verbs and nouns from task name for saving
    const extractedFromTask = extractTermsFromText(taskName, [...DESCRIPTION_GENERATION_CONFIG.stopWords]);
    const newVerbs = extractedFromTask.verbs.filter(verb => {
      const verbLower = verb.toLowerCase();
      return !foundVerbs.some(fv => fv.toLowerCase() === verbLower);
    });
    const newNouns = extractedFromTask.nouns.filter(noun => {
      const nounLower = noun.toLowerCase();
      return !foundNouns.some(fn => fn.toLowerCase() === nounLower);
    });
    
    saveNewTerminologyToLibrary(
      detectedDomain,
      newKeywords,
      newPhrases,
      newVerbs,
      newNouns
    );
  }
  
  return {
    keywords: foundKeywords.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedKeywords),
    phrases: foundPhrases.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPhrases),
    verbs: foundVerbs.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedVerbs),
    nouns: foundNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedNouns),
    pronouns: foundPronouns.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPronouns),
  };
}

/**
 * Build elaborate contextual description that explains the task without repeating the task name
 * Uses Browser AI extracted terms and domain terminology to create actionable descriptions
 * for the AI Action Plan to use when building steps
 */
function buildElaborateContextualDescription(
  taskName: string,
  keywords: string[],
  phrases: string[],
  verbs: string[],
  nouns: string[],
  pronouns: string[],
  context: string,
  domain: Domain,
  domainTerms: ReturnType<typeof getDomainTerminology>
): string {
  const taskNameLower = taskName.toLowerCase();
  const taskWords = taskNameLower.split(/\s+/).filter(w => w.length >= DESCRIPTION_GENERATION_CONFIG.minWordLength);
  
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
  const isSemanticallyRelevant = (term: string): boolean => {
    const termLower = term.toLowerCase();
    const termWords = termLower.split(/\s+/);
    
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
  
  let description = '';
  
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
      
      // Get action verb (prefer extracted, fallback to domain)
      const actionVerb = verbs.length > 0 ? verbs[0] : (elaboratingVerbs.length > 0 ? elaboratingVerbs[0] : '');
      
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
      
      // ENHANCED: Randomly select sentence template for variation (using variation seed)
      const templateKeys = Object.keys(DESCRIPTION_GENERATION_CONFIG.descriptionTemplates);
      // Ensure we have valid template keys and variation seed
      let selectedTemplate: string;
      let templateOpener: string;
      if (templateKeys.length === 0) {
        // Fallback to default template if no templates available
        selectedTemplate = 'involves';
        templateOpener = DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves;
      } else {
        selectedTemplate = templateKeys[Math.floor(variationSeed * templateKeys.length)];
        templateOpener = DESCRIPTION_GENERATION_CONFIG.descriptionTemplates[selectedTemplate as keyof typeof DESCRIPTION_GENERATION_CONFIG.descriptionTemplates] || DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves;
      }
      
      // Build complete sentences with proper sentence openers and structure
      if (phraseHasAction && contextNouns.length > 0) {
        const nounsList = contextNouns.length === 1 ? contextNouns[0] : 
                         contextNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsMaxJoin).join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
        const connector = selectedTemplate === 'aims' || selectedTemplate === 'targets' 
          ? DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.to 
          : DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.for;
        description = `${templateOpener} ${cleanedPhrase.toLowerCase()} ${connector} ${nounsList}.`;
      } else if (phraseHasAction && relevantKeywords.length > 0) {
        const keywordsList = relevantKeywords.length === 1 ? relevantKeywords[0] : 
                            relevantKeywords.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsMaxJoin).join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
        const connector = selectedTemplate === 'aims' || selectedTemplate === 'targets'
          ? DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.aimed
          : DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo;
        description = `${templateOpener} ${cleanedPhrase.toLowerCase()} ${connector} ${keywordsList}.`;
      } else if (actionVerb && contextNouns.length > 0) {
        const verbForm = actionVerb.endsWith('e') ? actionVerb.slice(0, -1) + 'ing' : actionVerb + 'ing';
        description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${cleanedPhrase.toLowerCase()} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.for} ${contextNouns[0]}.`;
      } else if (actionVerb && relevantKeywords.length > 0) {
        const verbForm = actionVerb.endsWith('e') ? actionVerb.slice(0, -1) + 'ing' : actionVerb + 'ing';
        description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${cleanedPhrase.toLowerCase()} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${relevantKeywords[0]}.`;
      } else if (phraseHasAction) {
        const connector = selectedTemplate === 'aims' || selectedTemplate === 'targets'
          ? DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.to
          : selectedTemplate === 'focuses' || selectedTemplate === 'centers'
          ? DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.on
          : '';
        description = connector 
          ? `${templateOpener} ${connector} ${cleanedPhrase.toLowerCase()}.`
          : `${templateOpener} ${cleanedPhrase.toLowerCase()}.`;
      } else if (actionVerb) {
        const verbForm = actionVerb.endsWith('e') ? actionVerb.slice(0, -1) + 'ing' : actionVerb + 'ing';
        description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${cleanedPhrase.toLowerCase()}.`;
      } else if (contextNouns.length > 0) {
        const nounsList = contextNouns.length === 1 ? contextNouns[0] : 
                         contextNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsMaxJoin).join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
        description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${cleanedPhrase.toLowerCase()} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.for} ${nounsList}.`;
      } else if (relevantKeywords.length > 0) {
        const keywordsList = relevantKeywords.length === 1 ? relevantKeywords[0] : 
                            relevantKeywords.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsMaxJoin).join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
        description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${cleanedPhrase.toLowerCase()} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${keywordsList}.`;
      } else {
        description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${cleanedPhrase.toLowerCase()}.`;
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
    
    // Build complete sentence with proper sentence opener
    const verbForm = actionVerb.endsWith('e') ? actionVerb.slice(0, -1) + 'ing' : actionVerb + 'ing';
    const nounsList = contextNouns.length === 1 ? contextNouns[0] : 
                     contextNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsMaxJoin).join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
    
    if (relevantKeywords.length > 0) {
      const keywordsList = relevantKeywords.length === 1 ? relevantKeywords[0] : 
                          relevantKeywords.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsMaxJoin).join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
      description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${nounsList} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${keywordsList}.`;
    } else {
      description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${nounsList}.`;
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
      
      // Build complete sentence with proper sentence opener
      const cleanedBestPhrase = cleanText(bestPhrase);
      if (actionVerb && !bestPhraseLower.includes(actionVerb.toLowerCase())) {
        const verbForm = actionVerb.endsWith('e') ? actionVerb.slice(0, -1) + 'ing' : actionVerb + 'ing';
        
        if (contextNouns.length > 0) {
          description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${cleanedBestPhrase.toLowerCase()} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.for} ${contextNouns[0]}.`;
        } else if (relevantKeywords.length > 0) {
          description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${cleanedBestPhrase.toLowerCase()} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${relevantKeywords[0]}.`;
        } else {
          description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${cleanedBestPhrase.toLowerCase()}.`;
        }
      } else {
        if (contextNouns.length > 0) {
          const nounsList = contextNouns.length === 1 ? contextNouns[0] : 
                           contextNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsMaxJoin).join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
          description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${cleanedBestPhrase.toLowerCase()} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.for} ${nounsList}.`;
        } else if (relevantKeywords.length > 0) {
          const keywordsList = relevantKeywords.length === 1 ? relevantKeywords[0] : 
                              relevantKeywords.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsMaxJoin).join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
          description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${cleanedBestPhrase.toLowerCase()} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${keywordsList}.`;
        } else {
          description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${cleanedBestPhrase.toLowerCase()}.`;
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
    
    // Build complete sentence with proper sentence opener
    const verbForm = actionVerb.endsWith('e') ? actionVerb.slice(0, -1) + 'ing' : actionVerb + 'ing';
    const nounsList = contextNouns.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
    
    if (relevantKeywords.length > 0) {
      const keywordsList = relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
      description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${nounsList} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${keywordsList}.`;
    } else {
      description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${nounsList}.`;
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
    
    const verbForm = actionVerb.endsWith('e') ? actionVerb.slice(0, -1) + 'ing' : actionVerb + 'ing';
    if (relevantKeywords.length > 0) {
      const keywordsList = relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
      description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${keywordsList}.`;
    } else {
      // Use domain nouns if available
      if (elaboratingNouns.length > 0) {
        description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${elaboratingNouns[0]}.`;
      } else {
        description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm}.`;
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
    
    // Use action verb from extracted verbs or domain terminology
    const actionVerb = verbs.length > 0 ? verbs[0] : (elaboratingVerbs.length > 0 ? elaboratingVerbs[0] : '');
    
    const verbForm = actionVerb ? (actionVerb.endsWith('e') ? actionVerb.slice(0, -1) + 'ing' : actionVerb + 'ing') : '';
    if (relevantKeywords.length > 0) {
      const keywordsList = relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
      if (actionVerb) {
        description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${contextNouns[0]} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${keywordsList}.`;
      } else {
        description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${contextNouns[0]} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${keywordsList}.`;
      }
    } else {
      if (actionVerb) {
        description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${contextNouns[0]}.`;
      } else {
        description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${contextNouns[0]}.`;
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
      const domainGuidance = DESCRIPTION_GENERATION_CONFIG.domainGuidance[domain];
      description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${domainGuidance.toLowerCase()}.`;
    } else if (elaboratingNouns.length > 0) {
      const contextNouns = elaboratingNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsSingle);
      const domainGuidance = DESCRIPTION_GENERATION_CONFIG.domainGuidance[domain];
      description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${contextNouns[0]} ${domainGuidance.toLowerCase()}.`;
    } else {
      // Last resort: use domain guidance as description
      const domainGuidance = DESCRIPTION_GENERATION_CONFIG.domainGuidance[domain];
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
        const domainGuidance = DESCRIPTION_GENERATION_CONFIG.domainGuidance[domain];
        if (domainGuidance) {
          description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${domainGuidance.toLowerCase()}.`;
        }
      }
    }
  }
  
  // Clean HTML fragments and ensure proper capitalization and punctuation
  description = cleanText(description).trim();
  
  // Remove duplicate sentences (check for repeated patterns)
  const sentences = description.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const uniqueSentences: string[] = [];
  const seenSentences = new Set<string>();
  
  for (const sentence of sentences) {
    const cleanedSentence = sentence.trim().toLowerCase();
    if (!seenSentences.has(cleanedSentence) && cleanedSentence.length > 5) {
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
  const sentenceTemplates = [
    // Template 1: Verb + Noun + Context
    (v: string, n: string, k: string) => 
      `${v.charAt(0).toUpperCase() + v.slice(1)} ${n} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${k}.`,
    // Template 2: Phrase + Context
    (p: string, k: string) => 
      `${p.charAt(0).toUpperCase() + p.slice(1)} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.involving} ${k}.`,
    // Template 3: Verb + Keywords
    (v: string, k: string[]) => 
      `${v.charAt(0).toUpperCase() + v.slice(1)} ${k.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}.`,
    // Template 4: Phrase + Keywords
    (p: string, k: string[]) => 
      `${p.charAt(0).toUpperCase() + p.slice(1)} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${k.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}.`,
    // Template 5: Complete contextual sentence
    (v: string, n: string, k: string[]) => 
      `${v.charAt(0).toUpperCase() + v.slice(1)} ${n} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${k.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}.`,
  ];
  
  // Build sentences using available terms
  if (verbs.length > 0 && nouns.length > 0 && keywords.length > 0) {
    const verb = verbs[0];
    const noun = nouns[0];
    const keyword = keywords[0];
    if (!taskNameLower.includes(verb.toLowerCase()) && 
        !taskNameLower.includes(noun.toLowerCase()) && 
        !taskNameLower.includes(keyword.toLowerCase())) {
      sentences.push(sentenceTemplates[0](verb, noun, keyword));
    }
  }
  
  if (phrases.length > 0 && keywords.length > 0) {
    const phrase = phrases[0];
    const keyword = keywords[0];
    if (!taskNameLower.includes(phrase.toLowerCase()) && 
        !taskNameLower.includes(keyword.toLowerCase())) {
      sentences.push(sentenceTemplates[1](phrase, keyword));
    }
  }
  
  if (verbs.length > 0 && keywords.length > 1) {
    const verb = verbs[0];
    const relevantKeywords = keywords
      .filter(k => !taskNameLower.includes(k.toLowerCase()))
      .slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsMaxJoin);
    if (relevantKeywords.length > 0 && !taskNameLower.includes(verb.toLowerCase())) {
      sentences.push(sentenceTemplates[2](verb, relevantKeywords));
    }
  }
  
  if (phrases.length > 0 && keywords.length > 1) {
    const phrase = phrases[0];
    const relevantKeywords = keywords
      .filter(k => !taskNameLower.includes(k.toLowerCase()))
      .slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsMaxJoin);
    if (relevantKeywords.length > 0 && !taskNameLower.includes(phrase.toLowerCase())) {
      sentences.push(sentenceTemplates[3](phrase, relevantKeywords));
    }
  }
  
  return sentences;
}

/**
 * Build contextual description from search results using keywords and phrases
 * NEW FLOW: Constructs natural description from search results that contain keywords and phrases
 * UPDATED: Now uses elaborate description builder to avoid repeating task name
 * ENHANCED: Adds variation by shuffling terms and using different sentence structures
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
  domainTerms: ReturnType<typeof getDomainTerminology>
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
    domainTerms
  );
}

/**
 * Generates a task description based on task name using Browser AI
 * Browser AI extracts keywords, phrases, verbs, and nouns directly from the task name
 * Local Terminology acts as a cache/dictionary to enhance extracted terms
 * 
 * @param taskName - The task title/name
 * @param accessToken - Optional access token for API calls
 * @param existingDescription - Optional existing description to use for domain detection
 */
export async function generateDescription(
  taskName: string, 
  accessToken?: string | null,
  existingDescription?: string | null
): Promise<GeneratedDescription> {
  try {
  if (!taskName || taskName.trim().length === 0) {
    return {
      description: '',
      domain: DEFAULT_TASK_DOMAIN,
      confidence: 0,
    };
  }

    // Detect domain from task name AND description (if available) for better accuracy
    const descriptionForDetection = existingDescription?.trim() || '';
    const domainResult = detectDomain(taskName, descriptionForDetection);
    const domain = domainResult.domain;
    // Use async version to fetch shared terminology from database
    const domainTerms = await getDomainTerminologyAsync(domain);

  logger.debug(`📝 Description Generation: Using domain detection with description`, {
    taskName,
    hasDescription: !!descriptionForDetection,
    descriptionLength: descriptionForDetection.length,
    detectedDomain: domain,
    confidence: domainResult.confidence,
  });

  // BROWSER AI APPROACH: Browser AI + Local Terminology Dictionary
  // 1. Browser AI: Extracts keywords, phrases, verbs, and nouns directly from task name
  // 2. Local Terminology: Acts as a cache/dictionary to:
  //    - Enhance extracted terms with domain-specific context
  //    - Provide contextual phrases that explain tasks
  //    - Add domain-appropriate verbs and nouns
  //    - Build complete contextual sentences
  
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

  // STEP 1: Use Browser AI to extract terms directly from task name
  // Browser AI analyzes user input and extracts keywords, phrases, verbs, nouns
  // Local Terminology acts as a cache/dictionary to enhance extracted terms
  logger.debug(`Using Browser AI to extract terms from task name: "${taskName}", domain: ${domain}`);
  
  // Extract terms directly from task name using Browser AI
  searchExtracted = extractTermsFromTaskNameWithBrowserAI(taskName, domainTerms);
  searchContext = searchExtracted.context; // Task name itself as context
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

  // STEP 2: Browser AI receives extracted terms from Local Terminology
  // Browser AI will use these terms to build contextual sentences
  let finalKeywords: string[];
  let finalPhrases: string[];
  let finalVerbs: string[];
  let finalNouns: string[];
  let finalPronouns: string[];
  
  // Browser AI uses terms provided by Local Terminology
  finalKeywords = searchExtracted.keywords;
  finalPhrases = searchExtracted.phrases;
  finalVerbs = searchExtracted.verbs;
  finalNouns = searchExtracted.nouns;
  finalPronouns = searchExtracted.pronouns;
  
  logger.debug(`✅ Browser AI: Received terms from Local Terminology: ${finalKeywords.length} keywords, ${finalPhrases.length} phrases, ${finalVerbs.length} verbs, ${finalNouns.length} nouns`, {
    keywords: finalKeywords.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsLogging),
    phrases: finalPhrases.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.phrasesLogging),
    verbs: finalVerbs.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.verbsLogging),
    nouns: finalNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsLogging),
    hasResults: finalKeywords.length > 0 || finalPhrases.length > 0 || finalVerbs.length > 0 || finalNouns.length > 0,
    domainTermsLoaded: !!domainTerms && (domainTerms.phrases.length > 0 || domainTerms.verbs.length > 0 || domainTerms.nouns.length > 0)
  });

  // STEP 3: Browser AI builds contextual sentences using terms from Local Terminology
  logger.debug(`🤖 Browser AI: Building contextual sentences with terms from Local Terminology:`, {
    keywords: finalKeywords.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsLogging),
    phrases: finalPhrases.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.phrasesLogging),
    verbs: finalVerbs.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.verbsLogging),
    nouns: finalNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsLogging),
    hasContext: searchContext.length > 0,
    contextLength: searchContext.length,
    contextPreview: searchContext.substring(0, 100)
  });
  
      description = buildContextualDescription(
        taskName,
    finalKeywords,
    finalPhrases,
    finalVerbs,
    finalNouns,
    finalPronouns,
    searchContext, // Use task name as context
        domain,
        domainTerms
      );
      
  logger.debug(`Description after buildContextualDescription:`, {
    description,
    descriptionLength: description.length,
    hasContext: searchContext.length > 0,
    usedContext: description.length > 0 && searchContext.length > 0
  });

  // STEP 5: Check if description is too similar to task name or needs improvement
  const taskNameLower = taskName.toLowerCase().trim();
  const descriptionLower = description ? description.toLowerCase().trim() : '';
  
  // Check if description is identical to task name
  const isIdenticalToTaskName = descriptionLower === taskNameLower;
  
  // Check if description contains all task name words (too similar)
  const taskWords = taskNameLower.split(/\s+/).filter(w => w.length >= 2);
  const descriptionWords = descriptionLower.split(/\s+/).filter(w => w.length >= 2);
  const containsAllTaskWords = taskWords.length > 0 && 
    taskWords.every(word => descriptionLower.includes(word));
  
  // Check if description is mostly task name words (80%+ overlap)
  const commonWords = taskWords.filter(word => descriptionWords.includes(word));
  const wordOverlapRatio = taskWords.length > 0 ? commonWords.length / taskWords.length : 0;
  const isTooSimilarToTaskName = wordOverlapRatio >= DESCRIPTION_GENERATION_CONFIG.similarityThresholds.wordOverlapRatio && 
    descriptionWords.length <= taskWords.length + DESCRIPTION_GENERATION_CONFIG.similarityThresholds.maxWordDifference;
  
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
    
    const taskNameLower = taskName.toLowerCase();
    const domainGuidance = DESCRIPTION_GENERATION_CONFIG.domainGuidance[domain];
    
    // Get domain phrases, verbs, and nouns for building contextual description
    const domainPhrases = domainTerms.phrases.filter(phrase => {
      const phraseLower = phrase.toLowerCase();
      // Use phrases that add context, not just repeat task name
      return !taskNameLower.includes(phraseLower) && phraseLower.length > DESCRIPTION_GENERATION_CONFIG.similarityThresholds.minPhraseLength;
    }).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.domainTerms);
    
    const domainVerbs = domainTerms.verbs.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.domainTerms);
    const domainNouns = domainTerms.nouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.domainTerms);
    
    // Get extracted terms
    const actionVerb = finalVerbs.length > 0 ? finalVerbs[0] : (domainVerbs.length > 0 ? domainVerbs[0] : '');
    const contextNouns = finalNouns.length > 0 ? finalNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsSingle) : (domainNouns.length > 0 ? domainNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsSingle) : []);
    const relevantKeywords = finalKeywords.filter(kw => {
      const kwLower = kw.toLowerCase();
      return !taskNameLower.includes(kwLower) && kwLower.length >= DESCRIPTION_GENERATION_CONFIG.similarityThresholds.minKeywordLength;
    }).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywords);
    
    // Build contextual sentence using available terms - clean all inputs first
    const cleanedActionVerb = actionVerb ? cleanText(actionVerb) : '';
    const cleanedContextNouns = contextNouns.map(n => cleanText(n)).filter(n => n.length > 0 && isValidKeyword(n));
    const cleanedRelevantKeywords = relevantKeywords.map(kw => cleanText(kw)).filter(kw => kw.length > 0 && isValidKeyword(kw));
    
    const verbForm = cleanedActionVerb ? (cleanedActionVerb.endsWith('e') ? cleanedActionVerb.slice(0, -1) + 'ing' : cleanedActionVerb + 'ing') : '';
    
    if (domainPhrases.length > 0) {
      const bestPhrase = cleanText(domainPhrases[0]);
      if (cleanedActionVerb) {
        description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${bestPhrase.toLowerCase()}.`;
      } else {
        description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${bestPhrase.toLowerCase()}.`;
      }
    } else if (cleanedActionVerb && cleanedContextNouns.length > 0) {
      description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${cleanedContextNouns[0]}.`;
    } else if (cleanedActionVerb && cleanedRelevantKeywords.length > 0) {
      const keywordsList = cleanedRelevantKeywords.length === 1 ? cleanedRelevantKeywords[0] : 
                          cleanedRelevantKeywords.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsMaxJoin).join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
      description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${keywordsList}.`;
    } else if (cleanedActionVerb) {
      description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${verbForm} ${domainGuidance.toLowerCase()}.`;
    } else if (cleanedContextNouns.length > 0) {
      description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${cleanedContextNouns[0]} ${domainGuidance.toLowerCase()}.`;
    } else if (cleanedRelevantKeywords.length > 0) {
      const keywordsList = cleanedRelevantKeywords.length === 1 ? cleanedRelevantKeywords[0] : 
                          cleanedRelevantKeywords.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsMaxJoin).join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
      description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${keywordsList} ${domainGuidance.toLowerCase()}.`;
    } else {
      // Use domain guidance as base description
      description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${domainGuidance.toLowerCase()}.`;
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
    // Ultimate fallback: use hardcoded template (only when everything else fails)
    logger.warn(`Browser AI and local terminology cache failed for "${taskName}", using ultimate fallback`);
      description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${taskName.toLowerCase()}. ${DESCRIPTION_GENERATION_CONFIG.domainGuidance[domain]}`;
      confidence = DESCRIPTION_GENERATION_CONFIG.baseConfidence;
  }

  // Clean HTML fragments and ensure we always return a non-empty description
  // Apply multiple passes of cleaning to catch all fragments
  let finalDescription = cleanText(description).trim();
  
  // Additional cleaning pass: remove any remaining fragments that might have been missed
  finalDescription = cleanText(finalDescription).trim();
  
  // Remove duplicate words/phrases that might have been created during cleaning
  const words = finalDescription.split(/\s+/);
  const uniqueWords: string[] = [];
  const seenWords = new Set<string>();
  for (const word of words) {
    const wordLower = word.toLowerCase();
    if (!seenWords.has(wordLower) && word.length > 0) {
      seenWords.add(wordLower);
      uniqueWords.push(word);
    }
  }
  finalDescription = uniqueWords.join(' ').trim();
  
  // Final validation: ensure description is meaningful
  if (!finalDescription || finalDescription.length === 0) {
    // Ultimate fallback: create a basic description from task name
    const fallbackDescription = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${taskName.toLowerCase()}.`;
    logger.warn(`Generated description is empty for "${taskName}", using fallback`);
    return {
      description: fallbackDescription,
      domain,
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

    logger.debug(`Generated description for "${taskName}": domain=${domain}, confidence=${confidence.toFixed(2)}, usedBrowserAI=true, descriptionLength=${finalDescription.length}, preview="${finalDescription.substring(0, 50)}..."`);
    
    // FINAL CHECK: If Browser AI extraction failed and got a fallback description, log warning
    if (finalDescription.includes(DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves)) {
      logger.warn(`WARNING: Browser AI extraction produced fallback description for "${taskName}". This indicates extraction from task name wasn't sufficient.`);
  }

  return {
    description: finalDescription,
    domain,
    confidence,
  };
  } catch (error) {
    // Error handling: ensure we always return a valid result
    logger.error(`Error generating description for "${taskName}":`, error);
    const domainResult = detectDomain(taskName, existingDescription?.trim() || '');
    const domain = domainResult.domain;
    const domainGuidance = DESCRIPTION_GENERATION_CONFIG.domainGuidance[domain];
    const fallbackDescription = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${taskName.toLowerCase()}. ${domainGuidance}`;
    
    return {
      description: fallbackDescription,
      domain,
      confidence: DESCRIPTION_GENERATION_CONFIG.baseConfidence,
    };
  }
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

    // Extract terms using Browser AI
    const extracted = extractTermsFromTaskNameWithBrowserAI(taskName, domainTerms);
    
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
