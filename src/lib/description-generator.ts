/**
 * Description Generator
 * 
 * Generates task descriptions based on task name using Browser AI
 * with domain-specific terminology, keywords, verbs, and action words.
 * Browser AI extracts terms directly from the task name.
 * Local Terminology acts as a cache/dictionary to enhance extracted terms.
 */

import { detectDomain, type Domain, getDomainTerminology } from './domain-terminology';
import { DESCRIPTION_GENERATION_CONFIG } from './ai-config';
import { logger } from './logger';
import { DEFAULT_TASK_DOMAIN } from './task-constants';

export interface GeneratedDescription {
  description: string;
  domain: Domain;
  confidence: number;
}

/**
 * Helper function for improved fuzzy matching
 * Calculates similarity score between two words
 */
function calculateWordSimilarity(word1: string, word2: string): number {
  const w1 = word1.toLowerCase();
  const w2 = word2.toLowerCase();
  if (w1 === w2) return DESCRIPTION_GENERATION_CONFIG.wordSimilarity.exactMatch;
  if (w1.includes(w2) || w2.includes(w1)) return DESCRIPTION_GENERATION_CONFIG.wordSimilarity.substringMatch;
  
  // Check for common prefixes/suffixes
  const minLen = Math.min(w1.length, w2.length);
  let commonChars = 0;
  for (let i = 0; i < minLen; i++) {
    if (w1[i] === w2[i]) commonChars++;
  }
  const prefixSimilarity = commonChars / Math.max(w1.length, w2.length);
  
  // Check for stem similarity (remove common suffixes)
  const stem1 = w1.replace(/(ing|ed|s|es|er|est|ly)$/, '');
  const stem2 = w2.replace(/(ing|ed|s|es|er|est|ly)$/, '');
  const stemMatch = stem1 === stem2 
    ? DESCRIPTION_GENERATION_CONFIG.wordSimilarity.exactStemMatch 
    : (stem1.includes(stem2) || stem2.includes(stem1) 
        ? DESCRIPTION_GENERATION_CONFIG.wordSimilarity.partialStemMatch 
        : 0);
  
  return Math.max(prefixSimilarity, stemMatch);
}

/**
 * Helper function to check if words are semantically related
 * Uses fuzzy matching to determine word relationships
 */
function areWordsRelated(word1: string, word2: string): boolean {
  const w1 = word1.toLowerCase();
  const w2 = word2.toLowerCase();
  
  // Exact match or substring
  if (w1 === w2 || w1.includes(w2) || w2.includes(w1)) return true;
  
  // Stem matching
  const stem1 = w1.replace(/(ing|ed|s|es|er|est|ly)$/, '');
  const stem2 = w2.replace(/(ing|ed|s|es|er|est|ly)$/, '');
  if (stem1 === stem2 || stem1.includes(stem2) || stem2.includes(stem1)) return true;
  
  // Similarity threshold
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
 * Returns significant words that are not stop words
 */
function extractKeywordsFromTaskName(taskName: string): string[] {
  // ENHANCED: Extract meaningful keywords from task name, prioritizing longer words
  const taskWords = taskName.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length >= DESCRIPTION_GENERATION_CONFIG.minWordLength)
    .filter(w => !DESCRIPTION_GENERATION_CONFIG.stopWords.includes(w));
  
  // Prioritize longer words (more specific) and words that appear multiple times
  const wordFreq = new Map<string, number>();
  taskWords.forEach(word => {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
  });
  
  // Sort by: 1) frequency, 2) length (longer = more specific)
  const sortedKeywords = Array.from(wordFreq.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1]; // Higher frequency first
      }
      return b[0].length - a[0].length; // Longer words first
    })
    .map(([word]) => word);
  
  // Remove duplicates and return (already sorted by importance)
  return Array.from(new Set(sortedKeywords));
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
    .filter(w => !DESCRIPTION_GENERATION_CONFIG.stopWords.includes(w));
  
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
 * Extract keywords, phrases, verbs, nouns, and pronouns directly from task name using Browser AI
 * Browser AI-only approach: Analyzes user input directly without external search
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
  // STEP 1: Extract keywords from task name (user input)
  const taskKeywords = extractKeywordsFromTaskName(taskName);
  
  // STEP 2: Extract phrases directly from task name using keywords
  // Find phrases (2-5 words) that contain keywords from the task name itself
  const foundPhrases: string[] = [];
  const taskNameLower = taskName.toLowerCase();
  const taskWords = taskNameLower.split(/\s+/)
    .filter(w => w.length >= DESCRIPTION_GENERATION_CONFIG.minWordLength)
    .filter(w => !DESCRIPTION_GENERATION_CONFIG.stopWords.includes(w));
  
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
  
  // Also extract phrases using frequency analysis from task name
  const phraseFreq = new Map<string, number>();
  for (let i = 0; i < taskWords.length - 1; i++) {
    for (let len = DESCRIPTION_GENERATION_CONFIG.minPhraseLength; 
         len <= DESCRIPTION_GENERATION_CONFIG.maxPhraseLength && i + len <= taskWords.length; 
         len++) {
      const phrase = taskWords.slice(i, i + len).join(' ');
      const containsKeyword = taskKeywords.some(kw => phrase.includes(kw.toLowerCase()));
      if (containsKeyword && phrase.length > DESCRIPTION_GENERATION_CONFIG.minKeywordLength) {
        phraseFreq.set(phrase, (phraseFreq.get(phrase) || 0) + 1);
      }
    }
  }
  
  // Add top phrases by frequency
  const sortedPhrases = Array.from(phraseFreq.entries())
    .filter(([phrase, freq]) => freq >= DESCRIPTION_GENERATION_CONFIG.minWordFrequency)
    .map(([phrase, freq]) => {
      const keywordCount = taskKeywords.filter(kw => phrase.toLowerCase().includes(kw.toLowerCase())).length;
      return { phrase, freq, keywordCount };
    })
    .sort((a, b) => {
      if (b.keywordCount !== a.keywordCount) {
        return b.keywordCount - a.keywordCount;
      }
      return b.freq - a.freq;
    })
    .slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPhrases)
    .map(({ phrase }) => phrase);
  
  sortedPhrases.forEach(phrase => {
    if (!foundPhrases.some(p => p.toLowerCase() === phrase.toLowerCase())) {
      foundPhrases.push(phrase);
    }
  });
  
  // Sort phrases by keyword count
  const finalPhrases = foundPhrases
    .sort((a, b) => {
      const aKeywords = taskKeywords.filter(kw => a.toLowerCase().includes(kw.toLowerCase())).length;
      const bKeywords = taskKeywords.filter(kw => b.toLowerCase().includes(kw.toLowerCase())).length;
      if (bKeywords !== aKeywords) {
        return bKeywords - aKeywords;
      }
      return b.length - a.length;
    })
    .slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPhrases);
  
  // STEP 3: Extract verbs and nouns directly from task name using Browser AI
  const extractedFromTask = extractTermsFromText(taskName, DESCRIPTION_GENERATION_CONFIG.stopWords);
  
  // Filter verbs and nouns that relate to keywords
  const foundVerbs = extractedFromTask.verbs.filter(verb => {
    const verbLower = verb.toLowerCase();
    return taskKeywords.some(kw => 
      verbLower.includes(kw.toLowerCase()) || kw.toLowerCase().includes(verbLower)
    );
  });
  
  const foundNouns = extractedFromTask.nouns.filter(noun => {
    const nounLower = noun.toLowerCase();
    return taskKeywords.some(kw => 
      nounLower.includes(kw.toLowerCase()) || kw.toLowerCase().includes(nounLower)
    );
  });
  
  // STEP 4: Find matching domain terminology terms that relate to task name
  // LOCAL TERMINOLOGY: Use domain-specific phrases, verbs, and nouns to enhance extracted terms
  logger.debug(`Using Local Terminology (domain: ${domainTerms ? 'loaded' : 'missing'}) to enhance Browser AI extracted terms`);
  
  const wordBoundaryRegex = (term: string) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  
  let matchedDomainPhrases = 0;
  let matchedDomainVerbs = 0;
  let matchedDomainNouns = 0;
  
  // Match domain phrases that contain our keywords OR task name words (improved intuitive matching)
  // ENHANCED: More lenient matching that checks both extracted keywords AND task name words directly
  domainTerms.phrases.forEach(phrase => {
    const phraseLower = phrase.toLowerCase();
    const phraseWords = phraseLower.split(/\s+/).filter(w => w.length >= 2);
    
    // ENHANCED: Check if phrase contains keywords OR task name words using improved fuzzy matching
    // Accept if ANY keyword OR task word matches (even partially) or if phrase words relate to them
    const containsKeyword = taskKeywords.some(kw => {
      const kwLower = kw.toLowerCase();
      const kwWords = kwLower.split(/\s+/);
      
      // Direct match (full keyword in phrase or vice versa)
      if (phraseLower.includes(kwLower) || kwLower.includes(phraseLower)) return true;
      
      // Word-level fuzzy matching - check if any keyword word relates to any phrase word
      const hasWordMatch = kwWords.some(kwWord => 
        phraseWords.some(pw => {
          // Direct word match
          if (pw.includes(kwWord) || kwWord.includes(pw)) return true;
          // Fuzzy word relationship
          return areWordsRelated(kwWord, pw);
        })
      );
      
      // Also check reverse: phrase words that relate to keyword words
      const hasReverseMatch = phraseWords.some(pw => 
        kwWords.some(kwWord => {
          if (pw.includes(kwWord) || kwWord.includes(pw)) return true;
          return areWordsRelated(pw, kwWord);
        })
      );
      
      return hasWordMatch || hasReverseMatch;
    });
    
    // ENHANCED: Also check if phrase contains task name words directly (not just extracted keywords)
    // This ensures we match phrases even if keyword extraction missed important words
    const containsTaskWords = taskWords.some(tw => {
      // Direct match
      if (phraseLower.includes(tw) || tw.includes(phraseLower)) return true;
      // Check if any phrase word relates to task word
      return phraseWords.some(pw => {
        if (pw.includes(tw) || tw.includes(pw)) return true;
        return areWordsRelated(pw, tw);
      });
    });
    
    // ENHANCED: More lenient check if phrase relates to task name
    // Accept if ANY phrase word appears in task name (even if not exact match)
    const phraseRegex = wordBoundaryRegex(phrase);
    const exactMatch = phraseRegex.test(taskNameLower);
    
    // Check if any phrase words appear in task name (fuzzy)
    const hasOverlappingWords = phraseWords.some(pw => {
      // Direct substring match
      if (taskNameLower.includes(pw)) return true;
      // Fuzzy match: check if any task word is similar to phrase word
      return taskWords.some(tw => {
        if (tw.includes(pw) || pw.includes(tw)) return true;
        return areWordsRelated(pw, tw);
      });
    });
    
    // ENHANCED: Check if task keywords OR task words relate to phrase words (more lenient)
    const hasRelatedKeywords = taskKeywords.some(kw => {
      const kwLower = kw.toLowerCase();
      const kwWords = kwLower.split(/\s+/);
      return kwWords.some(kwWord => 
        phraseWords.some(pw => {
          // Direct match
          if (pw.includes(kwWord) || kwWord.includes(pw)) return true;
          // Fuzzy relationship
          return areWordsRelated(kwWord, pw);
        })
      );
    }) || taskWords.some(tw => 
      phraseWords.some(pw => {
        if (pw.includes(tw) || tw.includes(pw)) return true;
        return areWordsRelated(pw, tw);
      })
    );
    
    // ENHANCED: Also check if phrase contains contextual action words that indicate elaboration
    // These phrases explain tasks even if they don't directly match keywords
    const contextualActionWords = DESCRIPTION_GENERATION_CONFIG.contextualActionWords;
    const hasContextualWords = phraseWords.some(pw => contextualActionWords.includes(pw));
    
    // ENHANCED: Accept phrase if:
    // 1. Contains keywords OR task words AND (exact match OR has overlapping words OR has related keywords/words)
    // 2. OR has contextual words that explain tasks (even without direct keyword match)
    const shouldAccept = ((containsKeyword || containsTaskWords) && (exactMatch || hasOverlappingWords || hasRelatedKeywords)) ||
                        (hasContextualWords && hasOverlappingWords);
    
    if (shouldAccept && !finalPhrases.some(p => p.toLowerCase() === phraseLower)) {
      finalPhrases.push(phrase);
      matchedDomainPhrases++;
    }
  });
  
  // Match domain verbs that relate to keywords OR task name words (improved intuitive matching)
  domainTerms.verbs.forEach(verb => {
    const verbLower = verb.toLowerCase();
    const verbBase = verbLower.replace(/(ing|ed|s|es|er|est|ly)$/, '');
    const verbPatterns = [
      new RegExp(`\\b${verbBase}\\b`, 'i'),
      new RegExp(`\\b${verbBase}ing\\b`, 'i'),
      new RegExp(`\\b${verbBase}ed\\b`, 'i'),
      new RegExp(`\\b${verbBase}s\\b`, 'i'),
      new RegExp(`\\b${verbBase}er\\b`, 'i'),
      new RegExp(`\\b${verbBase}est\\b`, 'i'),
    ];
    
    // IMPROVED: Check if verb relates to keywords using fuzzy matching
    const relatesToKeyword = taskKeywords.some(kw => {
      const kwLower = kw.toLowerCase();
      const kwWords = kwLower.split(/\s+/);
      
      // Direct match
      if (verbLower.includes(kwLower) || kwLower.includes(verbLower)) return true;
      if (verbBase.includes(kwLower) || kwLower.includes(verbBase)) return true;
      
      // Fuzzy word-level matching
      return kwWords.some(kwWord => {
        const kwStem = kwWord.replace(/(ing|ed|s|es|er|est|ly)$/, '');
        return areWordsRelated(kwWord, verbLower) || 
               areWordsRelated(kwStem, verbBase) ||
               verbBase.includes(kwStem) || kwStem.includes(verbBase);
      });
    });
    
    // ENHANCED: Also check if verb relates to task name words directly (not just extracted keywords)
    const relatesToTaskWords = taskWords.some(tw => {
      const twStem = tw.replace(/(ing|ed|s|es|er|est|ly)$/, '');
      return areWordsRelated(tw, verbLower) || 
             areWordsRelated(twStem, verbBase) ||
             verbBase.includes(twStem) || twStem.includes(verbBase) ||
             tw.includes(verbBase) || verbBase.includes(tw);
    });
    
    // IMPROVED: Check if verb appears in task name (fuzzy)
    const appearsInTask = verbPatterns.some(pattern => pattern.test(taskNameLower)) ||
      taskWords.some(tw => areWordsRelated(tw, verbLower) || areWordsRelated(tw, verbBase));
    
    // ENHANCED: Accept verb if it appears in task OR relates to keywords OR relates to task words
    // This is more lenient - doesn't require both conditions
    if ((appearsInTask || relatesToKeyword || relatesToTaskWords) &&
        !foundVerbs.some(v => v.toLowerCase() === verbLower)) {
      foundVerbs.push(verb);
      matchedDomainVerbs++;
    }
  });
  
  // Match domain nouns that relate to keywords OR task name words (improved intuitive matching)
  domainTerms.nouns.forEach(noun => {
    const nounLower = noun.toLowerCase();
    const nounBase = nounLower.replace(/s$|es$|ies$/, '').replace(/y$/, 'i');
    const nounPatterns = [
      new RegExp(`\\b${nounBase}\\b`, 'i'),
      new RegExp(`\\b${nounBase}s\\b`, 'i'),
      new RegExp(`\\b${nounBase}es\\b`, 'i'),
      new RegExp(`\\b${nounBase}ies\\b`, 'i'),
    ];
    
    // IMPROVED: Check if noun relates to keywords using fuzzy matching
    const relatesToKeyword = taskKeywords.some(kw => {
      const kwLower = kw.toLowerCase();
      const kwWords = kwLower.split(/\s+/);
      
      // Direct match
      if (nounLower.includes(kwLower) || kwLower.includes(nounLower)) return true;
      if (nounBase.includes(kwLower) || kwLower.includes(nounBase)) return true;
      
      // Fuzzy word-level matching
      return kwWords.some(kwWord => {
        const kwStem = kwWord.replace(/s$|es$|ies$/, '').replace(/y$/, 'i');
        return areWordsRelated(kwWord, nounLower) || 
               areWordsRelated(kwStem, nounBase) ||
               nounBase.includes(kwStem) || kwStem.includes(nounBase);
      });
    });
    
    // ENHANCED: Also check if noun relates to task name words directly (not just extracted keywords)
    const relatesToTaskWords = taskWords.some(tw => {
      const twStem = tw.replace(/s$|es$|ies$/, '').replace(/y$/, 'i');
      return areWordsRelated(tw, nounLower) || 
             areWordsRelated(twStem, nounBase) ||
             nounBase.includes(twStem) || twStem.includes(nounBase) ||
             tw.includes(nounBase) || nounBase.includes(tw);
    });
    
    // IMPROVED: Check if noun appears in task name (fuzzy)
    const appearsInTask = nounPatterns.some(pattern => pattern.test(taskNameLower)) ||
      taskWords.some(tw => areWordsRelated(tw, nounLower) || areWordsRelated(tw, nounBase));
    
    // ENHANCED: Accept noun if it appears in task OR relates to keywords OR relates to task words
    // This is more lenient - doesn't require both conditions
    if ((appearsInTask || relatesToKeyword || relatesToTaskWords) &&
        !foundNouns.some(n => n.toLowerCase() === nounLower)) {
      foundNouns.push(noun);
      matchedDomainNouns++;
    }
  });
  
  // STEP 5: Use task name as context (no external search results)
  const taskContext = taskName.trim();
  
  // Log Local Terminology contribution
  logger.debug(`Local Terminology matched: ${matchedDomainPhrases} phrases, ${matchedDomainVerbs} verbs, ${matchedDomainNouns} nouns from domain dictionary`);
  
  const browserAIResults = {
    keywords: taskKeywords.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedKeywords),
    phrases: finalPhrases.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPhrases),
    verbs: foundVerbs.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedVerbs),
    nouns: foundNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedNouns),
    pronouns: [] as string[], // Pronouns not typically extracted from task name alone
    context: taskContext,
  };
  
  logger.debug(`✅ Browser AI + Local Terminology results: ${browserAIResults.keywords.length} keywords, ${browserAIResults.phrases.length} phrases (${matchedDomainPhrases} from domain), ${browserAIResults.verbs.length} verbs (${matchedDomainVerbs} from domain), ${browserAIResults.nouns.length} nouns (${matchedDomainNouns} from domain)`, {
    keywords: browserAIResults.keywords,
    phrases: browserAIResults.phrases,
    verbs: browserAIResults.verbs,
    nouns: browserAIResults.nouns,
    domainPhrasesMatched: matchedDomainPhrases,
    domainVerbsMatched: matchedDomainVerbs,
    domainNounsMatched: matchedDomainNouns,
  });
  
  return browserAIResults;
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
  // STEP 1: Extract keywords from task name (user input)
  const taskKeywords = extractKeywordsFromTaskName(taskName);
  
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
      DESCRIPTION_GENERATION_CONFIG.stopWords
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
function validateAndEnhanceTermsWithDictionary(
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
  
  // FILL GAPS: If search results are minimal, add relevant terms from dictionary based on task name
  // This ensures we have domain-appropriate terms from Browser AI extraction
  if (extracted.keywords.length === 0 || extracted.phrases.length === 0) {
    // Find domain phrases that match task name
    domainTerms.phrases.forEach(phrase => {
      const phraseLower = phrase.toLowerCase();
      if ((taskNameLower.includes(phraseLower) || 
           taskWords.some(word => phraseLower.includes(word) || word.includes(phraseLower))) &&
          !validatedPhrases.some(p => p.toLowerCase() === phrase.toLowerCase())) {
        validatedPhrases.push(phrase);
      }
    });
    
    // Find domain keywords that match task name
    domainTerms.keywords.forEach(keyword => {
      const keywordLower = keyword.toLowerCase();
      if ((taskNameLower.includes(keywordLower) ||
           taskWords.some(word => keywordLower.includes(word) || word.includes(keywordLower))) &&
          !validatedKeywords.some(k => k.toLowerCase() === keyword.toLowerCase())) {
        validatedKeywords.push(keyword);
      }
    });
  }
  
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
  domainTerms.phrases.forEach(phrase => {
    const phraseLower = phrase.toLowerCase();
    if (taskNameLower.includes(phraseLower) || 
        taskWords.some(word => phraseLower.includes(word) || word.includes(phraseLower))) {
      foundPhrases.push(phrase);
    }
  });
  
  // Find matching verbs (action words) from domain terminology
  domainTerms.verbs.forEach(verb => {
    const verbLower = verb.toLowerCase();
    // Check for verb in various forms (verb, verb+ing, verb+ed, etc.)
    if (taskNameLower.includes(verbLower) || 
        taskNameLower.includes(`${verbLower}ing`) ||
        taskNameLower.includes(`${verbLower}ed`) ||
        taskNameLower.includes(`${verbLower}s`) ||
        taskWords.some(word => verbLower.includes(word) || word.includes(verbLower))) {
      foundVerbs.push(verb);
    }
  });
  
  // Find matching nouns from domain terminology
  domainTerms.nouns.forEach(noun => {
    const nounLower = noun.toLowerCase();
    if (taskNameLower.includes(nounLower) || 
        taskNameLower.includes(`${nounLower}s`) ||
        taskNameLower.includes(`${nounLower}es`) ||
        taskWords.some(word => nounLower.includes(word) || word.includes(nounLower))) {
      foundNouns.push(noun);
    }
  });
  
  // Find matching pronouns from domain terminology
  domainTerms.pronouns.forEach(pronoun => {
    if (taskNameLower.includes(pronoun.toLowerCase()) ||
        taskWords.some(word => pronoun.toLowerCase().includes(word) || word.includes(pronoun.toLowerCase()))) {
      foundPronouns.push(pronoun);
    }
  });
  
  // Find matching keywords from domain terminology
  domainTerms.keywords.forEach(keyword => {
    const keywordLower = keyword.toLowerCase();
    if (taskNameLower.includes(keywordLower) ||
        taskWords.some(word => keywordLower.includes(word) || word.includes(keywordLower))) {
      foundKeywords.push(keyword);
    }
  });
  
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
  
  // STEP 1: Find domain phrases that elaborate on the task (not just repeat it)
  // These provide context about what the task involves
  const taskKeywordsLower = keywords.map(kw => kw.toLowerCase());
  const elaboratingPhrases: string[] = [];
  
  // Find domain phrases that relate to keywords OR task name words but add elaboration
  // PRIORITY: Look for phrases that contain keywords/task words but are NOT in the task name
  // This ensures we get contextual information, not just repetition
  domainTerms.phrases.forEach(phrase => {
    const phraseLower = phrase.toLowerCase();
    const phraseWords = phraseLower.split(/\s+/).filter(w => w.length >= 2);
    
    // ENHANCED: Check if phrase contains keywords OR task name words (improved matching - check word-level matches)
    // Also check if any word in the phrase relates to any keyword/task word (more lenient)
    // Accept if ANY keyword OR task word matches (even partially) or if phrase words relate to them
    const containsKeywords = taskKeywordsLower.some(kw => {
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
      return taskKeywordsLower.some(tkw => {
        const tkwLower = tkw.toLowerCase();
        const tkwWords = tkwLower.split(/\s+/);
        
        // Direct match
        if (pw.includes(tkwLower) || tkwLower.includes(pw)) return true;
        
        // Fuzzy match
        return tkwWords.some(tkwWord => areWordsRelated(pw, tkwWord));
      });
    });
    
    // ENHANCED: Also check if phrase contains task name words directly (not just extracted keywords)
    // This ensures we match phrases even if keyword extraction missed important words
    const containsTaskWords = taskWords.some(tw => {
      // Direct match
      if (phraseLower.includes(tw) || tw.includes(phraseLower)) return true;
      // Check if any phrase word relates to task word
      return phraseWords.some(pw => {
        if (pw.includes(tw) || tw.includes(pw)) return true;
        return areWordsRelated(pw, tw);
      });
    });
    
    // More lenient check: phrase should NOT be a direct substring of task name
    // Allow partial matches if they add context
    const isDirectSubstring = taskNameLower.includes(phraseLower) && phraseLower.length > DESCRIPTION_GENERATION_CONFIG.lengthThresholds.minDirectSubstring;
    const isTaskNameSubstring = phraseLower.includes(taskNameLower) && taskNameLower.length > DESCRIPTION_GENERATION_CONFIG.lengthThresholds.minTaskNameSubstring;
    
    // Also check if phrase is too similar to task name (all words in phrase are in task name)
    const allWordsInTaskName = phraseWords.length > 0 && 
      phraseWords.every(word => taskNameLower.includes(word));
    
    // Accept phrase if it contains keywords OR task words and adds new context
    // More lenient: accept if phrase relates to keywords/task words even if not all words match
    if ((containsKeywords || containsTaskWords) && !isDirectSubstring && !isTaskNameSubstring && !allWordsInTaskName) {
      // Count how many keywords the phrase contains (more = more relevant)
      const keywordCount = taskKeywordsLower.filter(kw => {
          const kwLower = kw.toLowerCase();
        return phraseLower.includes(kwLower) || 
               phraseWords.some(pw => pw.includes(kwLower) || kwLower.includes(pw));
        }).length;
        
      // Also check if phrase adds new words not in task name
      const newWords = phraseWords.filter(word => !taskNameLower.includes(word));
      // More lenient: accept if phrase has keywords OR adds new words OR is a contextual phrase
      const contextualActionWords = DESCRIPTION_GENERATION_CONFIG.contextualActionWords;
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
  const elaboratingVerbs: string[] = [];
  domainTerms.verbs.forEach(verb => {
    const verbLower = verb.toLowerCase();
    const verbBase = verbLower.replace(/(ing|ed|s|es)$/, '');
    
    // Check if verb relates to task keywords or extracted verbs
    const relatesToKeywords = taskKeywordsLower.some(kw => 
      verbLower.includes(kw) || kw.includes(verbLower) ||
      verbBase.includes(kw) || kw.includes(verbBase)
    );
    
    const relatesToExtractedVerbs = verbs.some(v => {
          const vLower = v.toLowerCase();
          const vBase = vLower.replace(/(ing|ed|s|es)$/, '');
      return verbLower.includes(vLower) || vLower.includes(verbLower) ||
             verbBase.includes(vBase) || vBase.includes(verbBase);
    });
    
    // Also check if verb appears in task name (even if not extracted)
    const appearsInTaskName = taskNameLower.includes(verbLower) || 
                             taskNameLower.includes(verbBase) ||
                             taskNameLower.includes(`${verbBase}ing`) ||
                             taskNameLower.includes(`${verbBase}ed`);
    
    if ((relatesToKeywords || relatesToExtractedVerbs || appearsInTaskName) && 
        !elaboratingVerbs.some(v => v.toLowerCase() === verbLower)) {
      elaboratingVerbs.push(verb);
    }
  });
  
  // STEP 3: Find domain nouns that add context
  const elaboratingNouns: string[] = [];
  domainTerms.nouns.forEach(noun => {
    const nounLower = noun.toLowerCase();
    const nounBase = nounLower.replace(/s$|es$/, '');
    
    // Check if noun relates to task keywords or extracted nouns
    const relatesToKeywords = taskKeywordsLower.some(kw => 
      nounLower.includes(kw) || kw.includes(nounLower) ||
      nounBase.includes(kw) || kw.includes(nounBase)
    );
    
    const relatesToExtractedNouns = nouns.some(n => {
      const nLower = n.toLowerCase();
      const nBase = nLower.replace(/s$|es$/, '');
      return nounLower.includes(nLower) || nLower.includes(nounLower) ||
             nounBase.includes(nBase) || nBase.includes(nounBase);
    });
    
    // Also check if noun appears in task name (even if not extracted)
    const appearsInTaskName = taskNameLower.includes(nounLower) || 
                              taskNameLower.includes(nounBase) ||
                              taskNameLower.includes(`${nounBase}s`);
    
    if ((relatesToKeywords || relatesToExtractedNouns || appearsInTaskName) && 
        !elaboratingNouns.some(n => n.toLowerCase() === nounLower)) {
      elaboratingNouns.push(noun);
    }
  });
  
  // STEP 4: Build elaborate description using extracted terms and domain terminology
  // Priority: Use domain phrases > domain verbs+nouns > extracted phrases > extracted verbs+nouns > keywords
  // Goal: Build complete contextual sentences that explain what the task involves
  
  let description = '';
  
  // PRIORITY 1: Build complete contextual sentence using domain phrases + keywords + verbs/nouns
  if (elaboratingPhrases.length > 0) {
    // For research/comparison tasks, try to combine multiple related phrases for more elaborate descriptions
    const researchKeywords = DESCRIPTION_GENERATION_CONFIG.researchTask.keywords;
    const isResearchTask = taskKeywordsLower.some(kw => researchKeywords.some(rk => kw.includes(rk) || rk.includes(kw)));
    
    let bestPhrase = elaboratingPhrases[0];
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
        bestPhrase = elaboratingPhrases[0];
        bestPhraseLower = bestPhrase.toLowerCase();
      }
    }
    
    // If description not built yet, build it with single phrase
    if (!description) {
      // Get action verb (prefer extracted, fallback to domain)
      const actionVerb = verbs.length > 0 ? verbs[0] : (elaboratingVerbs.length > 0 ? elaboratingVerbs[0] : '');
      
      // Check if phrase is action-oriented (contains action words from domain terminology)
      const domainActionVerbs = domainTerms.verbs.map(v => v.toLowerCase());
      const phraseHasAction = elaboratingVerbs.some(v => bestPhraseLower.includes(v.toLowerCase())) ||
                             domainActionVerbs.some(av => bestPhraseLower.includes(av));
      
      // Get relevant keywords that relate to the phrase but aren't already in it
      const relevantKeywords = keywords.filter(kw => {
        const kwLower = kw.toLowerCase();
        return !bestPhraseLower.includes(kwLower) && 
               !taskNameLower.includes(kwLower) &&
               taskKeywordsLower.some(tkw => bestPhraseLower.includes(tkw.toLowerCase()) || kwLower.includes(tkw.toLowerCase()));
      }).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywords);
      
      // Get context nouns that add value
      const contextNouns = elaboratingNouns.filter(n => 
        !bestPhraseLower.includes(n.toLowerCase()) &&
        !taskNameLower.includes(n.toLowerCase())
      ).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nouns);
      
      // Build complete contextual sentence
      if (phraseHasAction) {
        // Phrase already has action - build sentence around it with keywords and nouns
        const parts: string[] = [];
        parts.push(bestPhrase.charAt(0).toUpperCase() + bestPhrase.slice(1));
        
        if (contextNouns.length > 0) {
          parts.push(`${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.involving} ${contextNouns.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}`);
        }
        
        if (relevantKeywords.length > 0) {
          parts.push(`${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}`);
        }
        
        description = parts.join(' ');
      } else if (actionVerb) {
        // Need to add action verb - build sentence with verb + phrase + context
        const parts: string[] = [];
        parts.push(`${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${bestPhrase}`);
        
        if (contextNouns.length > 0) {
          parts.push(`${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.for} ${contextNouns[0]}`);
        } else if (relevantKeywords.length > 0) {
          parts.push(`${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${relevantKeywords[0]}`);
        }
        
        description = parts.join(' ');
      } else {
        // No action verb available - use phrase with context
        const parts: string[] = [];
        parts.push(bestPhrase.charAt(0).toUpperCase() + bestPhrase.slice(1));
        
        if (contextNouns.length > 0) {
          parts.push(`${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.involving} ${contextNouns.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}`);
        } else if (relevantKeywords.length > 0) {
          parts.push(`${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}`);
        }
        
        description = parts.join(' ');
      }
    }
  } 
  // PRIORITY 2: Build sentence using domain verbs + nouns + keywords
  else if (elaboratingVerbs.length > 0 && elaboratingNouns.length > 0) {
    const actionVerb = elaboratingVerbs[0];
    const contextNouns = elaboratingNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nouns);
    
    // Get relevant keywords that add context
    const relevantKeywords = keywords.filter(kw => {
          const kwLower = kw.toLowerCase();
      return !contextNouns.some(n => n.toLowerCase().includes(kwLower)) &&
             !taskNameLower.includes(kwLower);
    }).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywords);
    
    // Build complete sentence
    const parts: string[] = [];
    parts.push(`${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${contextNouns.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}`);
    
    if (relevantKeywords.length > 0) {
      parts.push(`${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}`);
    }
    
    description = parts.join(' ');
  }
  // PRIORITY 3: Build sentence using extracted phrases + domain terminology + keywords
  else if (phrases.length > 0) {
    // Filter out phrases that are too similar to task name
    const contextualPhrases = phrases.filter(phrase => {
      const phraseLower = phrase.toLowerCase();
      const phraseWords = phraseLower.split(/\s+/).filter(w => w.length >= 2);
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
      
      // Get relevant keywords and domain nouns
      const relevantKeywords = keywords.filter(kw => 
        !bestPhraseLower.includes(kw.toLowerCase()) &&
        !taskNameLower.includes(kw.toLowerCase())
      ).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywords);
      
      const contextNouns = elaboratingNouns.filter(n => 
        !bestPhraseLower.includes(n.toLowerCase())
      ).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywords);
      
      // Build complete sentence
      if (actionVerb && !bestPhraseLower.includes(actionVerb.toLowerCase())) {
        const parts: string[] = [];
        parts.push(`${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${bestPhrase}`);
        
        if (contextNouns.length > 0) {
          parts.push(`${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.for} ${contextNouns[0]}`);
        } else if (relevantKeywords.length > 0) {
          parts.push(`${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${relevantKeywords[0]}`);
        }
        
        description = parts.join(' ');
      } else {
        const parts: string[] = [];
        parts.push(bestPhrase.charAt(0).toUpperCase() + bestPhrase.slice(1));
        
        if (contextNouns.length > 0) {
          parts.push(`${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.involving} ${contextNouns.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}`);
        } else if (relevantKeywords.length > 0) {
          parts.push(`${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}`);
        }
        
        description = parts.join(' ');
      }
    }
  }
  // PRIORITY 4: Build sentence using extracted verbs + nouns + keywords
  else if (verbs.length > 0 && nouns.length > 0) {
    const actionVerb = verbs[0];
    const contextNouns = nouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nouns);
    const relevantKeywords = keywords.filter(kw => 
      !contextNouns.some(n => n.toLowerCase().includes(kw.toLowerCase())) &&
      !taskNameLower.includes(kw.toLowerCase())
    ).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywords);
    
    // Build complete sentence
    const parts: string[] = [];
    parts.push(`${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${contextNouns.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}`);
    
    if (relevantKeywords.length > 0) {
      parts.push(`${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}`);
    }
    
    description = parts.join(' ');
  }
  // PRIORITY 5: Build sentence using verbs + keywords
  else if (verbs.length > 0 && keywords.length > 0) {
    const actionVerb = verbs[0];
    const relevantKeywords = keywords.filter(kw => 
      !actionVerb.toLowerCase().includes(kw.toLowerCase()) &&
      !taskNameLower.includes(kw.toLowerCase())
    ).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywords);
    
    if (relevantKeywords.length > 0) {
      description = `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}`;
        } else {
      // Use domain nouns if available
      if (elaboratingNouns.length > 0) {
        description = `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${elaboratingNouns[0]}`;
          } else {
        description = actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1);
      }
    }
  }
  // PRIORITY 6: Build sentence using nouns + keywords
  else if (nouns.length > 0 && keywords.length > 0) {
    const contextNouns = nouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsSingle);
    const relevantKeywords = keywords.filter(kw => 
      !contextNouns.some(n => n.toLowerCase().includes(kw.toLowerCase())) &&
      !taskNameLower.includes(kw.toLowerCase())
    ).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywords);
    
    // Use action verb from extracted verbs or domain terminology
    const actionVerb = verbs.length > 0 ? verbs[0] : (elaboratingVerbs.length > 0 ? elaboratingVerbs[0] : '');
    
    if (relevantKeywords.length > 0) {
      if (actionVerb) {
        description = `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${contextNouns[0]} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}`;
        } else {
        description = `${contextNouns[0]} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}`;
      }
    } else {
      if (actionVerb) {
        description = `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${contextNouns[0]}`;
      } else {
        description = contextNouns[0].charAt(0).toUpperCase() + contextNouns[0].slice(1);
      }
    }
  }
  // PRIORITY 7: Build sentence using keywords + domain terminology
  else if (keywords.length > 0) {
    const relevantKeywords = keywords.filter(kw => !taskNameLower.includes(kw.toLowerCase())).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsExtended);
    const actionVerb = verbs.length > 0 ? verbs[0] : (elaboratingVerbs.length > 0 ? elaboratingVerbs[0] : '');
    
    if (actionVerb && relevantKeywords.length > 0) {
      description = `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}`;
    } else if (relevantKeywords.length > 0) {
      // Try to add domain nouns for context
      if (elaboratingNouns.length > 0) {
        description = `${relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.involving} ${elaboratingNouns[0]}`;
        } else {
        description = relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `);
      }
    } else if (actionVerb) {
      description = actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1);
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
      
      if (actionVerb && contextNouns.length > 0) {
        description = `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${bestPhrase} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.for} ${contextNouns[0]}`;
      } else if (actionVerb) {
        description = `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${bestPhrase}`;
      } else if (contextNouns.length > 0) {
        description = `${bestPhrase.charAt(0).toUpperCase() + bestPhrase.slice(1)} ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.involving} ${contextNouns[0]}`;
        } else {
        description = bestPhrase.charAt(0).toUpperCase() + bestPhrase.slice(1);
      }
    } else if (elaboratingVerbs.length > 0 && elaboratingNouns.length > 0) {
      const actionVerb = elaboratingVerbs[0];
      const contextNouns = elaboratingNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nouns);
      description = `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${contextNouns.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}`;
    } else if (elaboratingVerbs.length > 0) {
      const actionVerb = elaboratingVerbs[0];
      const domainGuidance = DESCRIPTION_GENERATION_CONFIG.domainGuidance[domain];
      description = `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${domainGuidance.toLowerCase()}`;
    } else if (elaboratingNouns.length > 0) {
      const contextNouns = elaboratingNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsSingle);
      const domainGuidance = DESCRIPTION_GENERATION_CONFIG.domainGuidance[domain];
      description = `${contextNouns[0].charAt(0).toUpperCase() + contextNouns[0].slice(1)} ${domainGuidance.toLowerCase()}`;
      } else {
      // Last resort: use domain guidance as description
      const domainGuidance = DESCRIPTION_GENERATION_CONFIG.domainGuidance[domain];
      description = domainGuidance;
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
      
      // Get relevant keywords and nouns that add context
        const relevantKeywords = keywords.filter(kw => {
          const kwLower = kw.toLowerCase();
        return !bestPhraseLower.includes(kwLower) && 
               !taskNameLower.includes(kwLower);
      }).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywords);
      
      const contextNouns = elaboratingNouns.filter(n => 
        !bestPhraseLower.includes(n.toLowerCase())
      ).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywords);
      
      // Build complete sentence
      const parts: string[] = [];
      if (actionVerb && !bestPhraseLower.includes(actionVerb.toLowerCase())) {
        parts.push(`${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${bestPhrase}`);
      } else {
        parts.push(bestPhrase.charAt(0).toUpperCase() + bestPhrase.slice(1));
      }
      
      if (contextNouns.length > 0) {
        parts.push(`${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.involving} ${contextNouns.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}`);
      } else if (relevantKeywords.length > 0) {
        parts.push(`${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}`);
      }
      
      description = parts.join(' ');
    } else if (elaboratingVerbs.length > 0 && elaboratingNouns.length > 0) {
      // Use domain verbs and nouns with keywords
      const actionVerb = elaboratingVerbs[0];
      const contextNouns = elaboratingNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nouns);
      const relevantKeywords = keywords.filter(kw => 
        !contextNouns.some(n => n.toLowerCase().includes(kw.toLowerCase())) &&
        !taskNameLower.includes(kw.toLowerCase())
      ).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywords);
      
      const parts: string[] = [];
      parts.push(`${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${contextNouns.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}`);
        
        if (relevantKeywords.length > 0) {
        parts.push(`${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}`);
      }
      
      description = parts.join(' ');
        } else {
      // Build sentence using available terms
      const actionVerb = verbs.length > 0 ? verbs[0] : (elaboratingVerbs.length > 0 ? elaboratingVerbs[0] : '');
      const contextNouns = nouns.length > 0 ? nouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsSingle) : (elaboratingNouns.length > 0 ? elaboratingNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsSingle) : []);
      const relevantKeywords = keywords.filter(kw => !taskNameLower.includes(kw.toLowerCase())).slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywords);
      
      const parts: string[] = [];
      if (actionVerb) {
        if (contextNouns.length > 0) {
          parts.push(`${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${contextNouns[0]}`);
        } else if (relevantKeywords.length > 0) {
          parts.push(`${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}`);
        } else {
          parts.push(actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1));
        }
      } else if (contextNouns.length > 0) {
        parts.push(contextNouns[0].charAt(0).toUpperCase() + contextNouns[0].slice(1));
        if (relevantKeywords.length > 0) {
          parts.push(`${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.relatedTo} ${relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}`);
        }
      } else if (relevantKeywords.length > 0) {
        parts.push(relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `));
      }
      
      if (parts.length > 0) {
        description = parts.join(' ');
    } else {
        // Last resort: use domain guidance
        const domainGuidance = DESCRIPTION_GENERATION_CONFIG.domainGuidance[domain];
        if (domainGuidance) {
          description = domainGuidance;
        }
      }
    }
  }
  
  // Ensure proper capitalization and punctuation
  description = description.trim();
  if (description.length > 0) {
    description = description.charAt(0).toUpperCase() + description.slice(1);
    if (!DESCRIPTION_GENERATION_CONFIG.sentenceEndPattern.test(description)) {
      description += '.';
    }
  }
  
  return description;
}

/**
 * Build contextual description from search results using keywords and phrases
 * NEW FLOW: Constructs natural description from search results that contain keywords and phrases
 * UPDATED: Now uses elaborate description builder to avoid repeating task name
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
  // Use the new elaborate description builder that explains the task without repeating it
  return buildElaborateContextualDescription(
    taskName,
    keywords,
    phrases,
    verbs,
    nouns,
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
  const domainTerms = getDomainTerminology(domain);

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
  let confidence = DESCRIPTION_GENERATION_CONFIG.baseConfidence;
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
  
  logger.debug(`✅ Browser AI extraction COMPLETE: ${searchExtracted.keywords.length} keywords, ${searchExtracted.phrases.length} phrases, ${searchExtracted.verbs.length} verbs, ${searchExtracted.nouns.length} nouns`, {
    keywords: searchExtracted.keywords,
    phrases: searchExtracted.phrases,
    verbs: searchExtracted.verbs,
    nouns: searchExtracted.nouns,
    hasResults: searchExtracted.keywords.length > 0 || searchExtracted.phrases.length > 0 || searchExtracted.verbs.length > 0 || searchExtracted.nouns.length > 0
  });
  
  // Verify results are being sent
  if (searchExtracted.keywords.length === 0 && searchExtracted.phrases.length === 0 && 
      searchExtracted.verbs.length === 0 && searchExtracted.nouns.length === 0) {
    logger.warn(`⚠️ WARNING: Browser AI extraction returned NO results for task: "${taskName}"`);
  }

  // STEP 2: Use Browser AI-extracted terms as PRIMARY source
  // Local Terminology is used as a cache/dictionary to enhance terms
  let finalKeywords: string[];
  let finalPhrases: string[];
  let finalVerbs: string[];
  let finalNouns: string[];
  let finalPronouns: string[];
  
  // PRIMARY: Use Browser AI-extracted terms directly
  finalKeywords = searchExtracted.keywords;
  finalPhrases = searchExtracted.phrases;
  finalVerbs = searchExtracted.verbs;
  finalNouns = searchExtracted.nouns;
  finalPronouns = searchExtracted.pronouns;
  
  logger.debug(`✅ Using Browser AI + Local Terminology as PRIMARY source: ${finalKeywords.length} keywords, ${finalPhrases.length} phrases, ${finalVerbs.length} verbs, ${finalNouns.length} nouns`, {
    keywords: finalKeywords.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsLogging),
    phrases: finalPhrases.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.phrasesLogging),
    verbs: finalVerbs.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.verbsLogging),
    nouns: finalNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsLogging),
    hasResults: finalKeywords.length > 0 || finalPhrases.length > 0 || finalVerbs.length > 0 || finalNouns.length > 0,
    domainTermsLoaded: !!domainTerms && (domainTerms.phrases.length > 0 || domainTerms.verbs.length > 0 || domainTerms.nouns.length > 0)
  });

  // STEP 3: Build description using Browser AI-extracted terms
  logger.debug(`Building description with Browser AI:`, {
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
    
    // Build contextual sentence using available terms
    if (domainPhrases.length > 0) {
      const bestPhrase = domainPhrases[0];
      if (actionVerb) {
        description = `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${bestPhrase}`;
      } else {
        description = bestPhrase.charAt(0).toUpperCase() + bestPhrase.slice(1);
      }
    } else if (actionVerb && contextNouns.length > 0) {
      description = `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${contextNouns[0]}`;
    } else if (actionVerb && relevantKeywords.length > 0) {
      description = `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)}`;
    } else if (actionVerb) {
      description = `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${domainGuidance.toLowerCase()}`;
    } else if (contextNouns.length > 0) {
      description = `${contextNouns[0].charAt(0).toUpperCase() + contextNouns[0].slice(1)} ${domainGuidance.toLowerCase()}`;
    } else if (relevantKeywords.length > 0) {
      description = `${relevantKeywords.join(` ${DESCRIPTION_GENERATION_CONFIG.descriptionConnectors.and} `)} ${domainGuidance.toLowerCase()}`;
    } else {
      // Use domain guidance as base description
      description = domainGuidance;
    }
    
    logger.debug(`Rebuilt description using domain terminology: "${description.substring(0, 50)}..."`);
  }

  // STEP 4: Calculate confidence based on Browser AI-extracted terms
  const hasBrowserAITerms = finalKeywords.length > 0 || finalPhrases.length > 0 || 
                             finalVerbs.length > 0 || finalNouns.length > 0;
  
  // Base confidence for Browser AI extraction
  const baseConf = DESCRIPTION_GENERATION_CONFIG.searchBaseConfidence;
  
  // Boost for Browser AI-extracted terms
  const browserAIBoost = hasBrowserAITerms ? 
    (finalKeywords.length * DESCRIPTION_GENERATION_CONFIG.keywordWeight) + 
    (finalPhrases.length * DESCRIPTION_GENERATION_CONFIG.phraseWeight) +
    (finalVerbs.length * DESCRIPTION_GENERATION_CONFIG.verbWeight) + 
    (finalNouns.length * DESCRIPTION_GENERATION_CONFIG.nounWeight) : 0;
  
  // Context boost if we have meaningful task name context
  const contextBoost = searchContext.length >= DESCRIPTION_GENERATION_CONFIG.minContextLength ? DESCRIPTION_GENERATION_CONFIG.contextBoost.high : 
                      searchContext.length >= DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.contextBoostThreshold ? DESCRIPTION_GENERATION_CONFIG.contextBoost.medium : 0;
  
      confidence = Math.min(
    baseConf + browserAIBoost + contextBoost,
        DESCRIPTION_GENERATION_CONFIG.maxConfidence
      );
      
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

  // Ensure we always return a non-empty description
  const finalDescription = description.trim();
  
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
