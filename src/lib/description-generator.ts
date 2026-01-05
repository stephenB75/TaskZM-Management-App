/**
 * Description Generator
 * 
 * Generates task descriptions based on task name using DuckDuckGo Instant Answer API + browser AI
 * with domain-specific terminology, keywords, verbs, and action words.
 * Uses local terminology database for business, home, personal, and world scenarios as fallback.
 */

import { detectDomain, type Domain, getDomainTerminology } from './domain-terminology';
import { DUCKDUCKGO_CONFIG, DESCRIPTION_GENERATION_CONFIG } from './ai-config';
import { logger } from './logger';
import { DEFAULT_TASK_DOMAIN } from './task-constants';

export interface GeneratedDescription {
  description: string;
  domain: Domain;
  confidence: number;
}

/**
 * Search DuckDuckGo Instant Answer API for context about the task
 * Uses Supabase Edge Function to proxy requests to DuckDuckGo's Instant Answer API (bypasses CORS)
 */
async function searchDuckDuckGoInstantAnswer(query: string, accessToken?: string | null): Promise<string[]> {
  try {
    // Import project info dynamically to avoid circular dependencies
    const { projectId } = await import('../utils/supabase/info');
    const BASE_URL = `https://${projectId}.supabase.co/functions/v1/taskzm-database-function`;
    
    const searchQuery = encodeURIComponent(query);
    const proxyUrl = `${BASE_URL}/duckduckgo/search?q=${searchQuery}`;
    
    // Log request details for debugging
    logger.debug(`DuckDuckGo search request:`, { 
      query, 
      proxyUrl, 
      hasAccessToken: !!accessToken,
      timeout: DESCRIPTION_GENERATION_CONFIG.searchTimeout 
    });
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DESCRIPTION_GENERATION_CONFIG.searchTimeout);
    
    try {
      // Fetch from Supabase Edge Function (which proxies to DuckDuckGo)
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        },
        signal: controller.signal,
      });
      
      logger.debug(`DuckDuckGo proxy response status for "${query}":`, { 
        status: response.status, 
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        
        // Log response structure for debugging
        logger.debug(`DuckDuckGo proxy response for "${query}":`, { 
          hasSuccess: !!data.success, 
          hasResults: !!data.results, 
          resultsType: Array.isArray(data.results) ? 'array' : typeof data.results,
          resultsLength: Array.isArray(data.results) ? data.results.length : 0,
          responseKeys: Object.keys(data),
          resultsPreview: Array.isArray(data.results) ? data.results.slice(0, 2) : 'not an array'
        });
        
        if (data.success && Array.isArray(data.results)) {
          const results = data.results.filter((r: any): r is string => typeof r === 'string' && r.length > 0);
          
          logger.debug(`DuckDuckGo proxy filtered results for "${query}": ${results.length} valid results (from ${data.results.length} total)`, {
            results: results.slice(0, 3).map(r => r.substring(0, DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.searchResultPreviewLength))
          });
          
          // Use results even if they're below minSearchResults threshold
          // This ensures we use search results when available, even if minimal
          if (results.length > 0) {
            logger.debug(`DuckDuckGo Instant Answer API successful (via Supabase proxy): ${results.length} results for "${query}"`);
            return results;
          } else {
            logger.warn(`DuckDuckGo proxy returned empty results after filtering for "${query}". Raw results:`, data.results);
          }
        } else {
          logger.warn(`DuckDuckGo proxy response invalid structure for "${query}":`, { 
            success: data.success, 
            hasResults: !!data.results, 
            resultsIsArray: Array.isArray(data.results),
            dataKeys: Object.keys(data),
            data 
          });
        }
      } else {
        // If proxy returns error, log it but don't throw - fall back to local terminology
        const errorData = await response.json().catch(() => ({}));
        logger.warn(`DuckDuckGo proxy API error for "${query}":`, { 
          status: response.status, 
          statusText: response.statusText,
          error: errorData 
        });
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn(`DuckDuckGo proxy API timeout for "${query}" (${DESCRIPTION_GENERATION_CONFIG.searchTimeout}ms)`);
      } else {
        logger.warn(`DuckDuckGo proxy API failed for "${query}":`, error);
      }
    }

    // Return empty array if search failed (will fall back to local terminology)
    return [];
  } catch (error) {
    logger.warn(`DuckDuckGo proxy API error for "${query}":`, error);
    return [];
  }
}

/**
 * Search DuckDuckGo Instant Answer API for domain-specific context
 * Creates multiple search queries to gather comprehensive context
 */
async function searchDomainContext(
  taskName: string,
  domain: Domain,
  domainTerms: ReturnType<typeof getDomainTerminology>,
  accessToken?: string | null
): Promise<string[]> {
  const allResults: string[] = [];
  
  // Extract key terms from task name
  const taskWords = taskName.toLowerCase().split(/\s+/).filter(w => w.length > DESCRIPTION_GENERATION_CONFIG.minWordLength);
  
  // Build domain-specific search queries
  const searchQueries: string[] = [];
  
  // 1. Main task query
  searchQueries.push(taskName);
  
  // 2. Domain-specific queries with phrases, verbs (action words), nouns, and pronouns
  // Use domain terms that are relevant to the domain, not just ones matching task name
  // This provides better context by searching for domain-specific concepts related to the task
  const topKeywords = domainTerms.keywords.slice(0, DESCRIPTION_GENERATION_CONFIG.maxTopKeywords * DESCRIPTION_GENERATION_CONFIG.topTermsMultiplier);
  const topPhrases = domainTerms.phrases.slice(0, DESCRIPTION_GENERATION_CONFIG.maxTopPhrases * DESCRIPTION_GENERATION_CONFIG.topTermsMultiplier);
  const topVerbs = domainTerms.verbs.slice(0, DESCRIPTION_GENERATION_CONFIG.maxTopVerbs * DESCRIPTION_GENERATION_CONFIG.topTermsMultiplier);
  const topNouns = domainTerms.nouns.slice(0, DESCRIPTION_GENERATION_CONFIG.maxTopNouns * DESCRIPTION_GENERATION_CONFIG.topTermsMultiplier);
  
  // Prioritize domain terms that relate to task name, but also include general domain terms
  // This ensures we get both task-specific and domain-general context
  const relevantPhrases = topPhrases.filter(phrase => {
    const phraseLower = phrase.toLowerCase();
    return taskWords.some(word => phraseLower.includes(word) || word.includes(phraseLower)) ||
           taskName.toLowerCase().includes(phraseLower);
  });
  const relevantVerbs = topVerbs.filter(v => {
    const vLower = v.toLowerCase();
    return taskWords.some(word => vLower.includes(word) || word.includes(vLower)) ||
           taskName.toLowerCase().includes(vLower);
  });
  const relevantNouns = topNouns.filter(noun => {
    const nounLower = noun.toLowerCase();
    return taskWords.some(word => nounLower.includes(word) || word.includes(nounLower)) ||
           taskName.toLowerCase().includes(nounLower);
  });
  const relevantKeywords = topKeywords.filter(kw => {
    const kwLower = kw.toLowerCase();
    return taskWords.some(word => kwLower.includes(word) || word.includes(kwLower)) ||
           taskName.toLowerCase().includes(kwLower);
  });
  
  // Add queries with phrases (action phrases) - prioritize relevant ones
  if (relevantPhrases.length > 0) {
    searchQueries.push(`${taskName} ${relevantPhrases[0]}`);
    if (relevantPhrases.length > 1) {
      searchQueries.push(`${taskName} ${relevantPhrases[1]}`);
    }
  } else if (topPhrases.length > 0) {
    // Fallback to general domain phrases if no relevant ones found
    searchQueries.push(`${taskName} ${topPhrases[0]}`);
  }
  
  // Add queries with verbs (action words) - prioritize relevant ones
  if (relevantVerbs.length > 0) {
    searchQueries.push(`${relevantVerbs[0]} ${taskName}`);
    if (relevantVerbs.length > 1) {
      searchQueries.push(`${taskName} ${relevantVerbs[1]}`);
    }
  } else if (topVerbs.length > 0) {
    // Fallback to general domain verbs if no relevant ones found
    searchQueries.push(`${topVerbs[0]} ${taskName}`);
  }
  
  // Add queries with nouns - prioritize relevant ones
  if (relevantNouns.length > 0) {
    searchQueries.push(`${taskName} ${relevantNouns[0]}`);
  } else if (topNouns.length > 0) {
    // Fallback to general domain nouns if no relevant ones found
    searchQueries.push(`${taskName} ${topNouns[0]}`);
  }
  
  // Add queries with keywords - prioritize relevant ones
  if (relevantKeywords.length > 0) {
    searchQueries.push(`${taskName} ${relevantKeywords[0]}`);
  } else if (topKeywords.length > 0) {
    // Fallback to general domain keywords if no relevant ones found
    searchQueries.push(`${taskName} ${topKeywords[0]}`);
  }
  
  // 3. Domain context query
  searchQueries.push(`${taskName} ${DESCRIPTION_GENERATION_CONFIG.domainContextModifiers[domain]}`);
  
  // Search all queries in parallel (with limit to avoid too many requests)
  const queriesToSearch = searchQueries.slice(0, DESCRIPTION_GENERATION_CONFIG.maxQueriesPerSearch);
  
  try {
    const searchPromises = queriesToSearch.map(query => searchDuckDuckGoInstantAnswer(query, accessToken));
    const resultsArray = await Promise.allSettled(searchPromises);
    
    logger.debug(`DuckDuckGo searchDomainContext: ${resultsArray.length} queries executed for "${taskName}"`);
    
    resultsArray.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        allResults.push(...result.value);
        logger.debug(`DuckDuckGo Instant Answer API search ${index + 1} successful: "${queriesToSearch[index]}" - ${result.value.length} results`, {
          resultsPreview: result.value.slice(0, 2).map((r: string) => r.substring(0, DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.searchResultPreviewLength))
        });
      } else if (result.status === 'rejected') {
        logger.warn(`DuckDuckGo Instant Answer API search ${index + 1} failed: "${queriesToSearch[index]}"`, result.reason);
      } else if (result.status === 'fulfilled' && result.value.length === 0) {
        logger.warn(`DuckDuckGo Instant Answer API search ${index + 1} returned no results: "${queriesToSearch[index]}"`);
      }
    });
    
    logger.debug(`DuckDuckGo searchDomainContext total results for "${taskName}": ${allResults.length} results from ${queriesToSearch.length} queries`, {
      uniqueResults: [...new Set(allResults)].length,
      resultsPreview: allResults.slice(0, 3).map(r => r.substring(0, DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.searchResultPreviewLength))
    });
    
    // Remove duplicates and limit results
    const uniqueResults = Array.from(new Set(allResults));
    return uniqueResults.slice(0, DUCKDUCKGO_CONFIG.maxResults * DESCRIPTION_GENERATION_CONFIG.resultsMultiplier);
  } catch (error) {
    logger.debug('Domain context search error:', error);
    return [];
  }
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
                phrase.length > keywordLower.length + 2 && // Phrase should be longer than just the keyword
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
  const wordBoundaryRegex = (term: string) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  
  // Match domain phrases that contain our keywords (improved matching)
  domainTerms.phrases.forEach(phrase => {
    const phraseLower = phrase.toLowerCase();
    const phraseWords = phraseLower.split(/\s+/).filter(w => w.length >= 2);
    
    // Check if phrase contains keywords (more lenient matching)
    const containsKeyword = taskKeywords.some(kw => {
      const kwLower = kw.toLowerCase();
      return phraseLower.includes(kwLower) || kwLower.includes(phraseLower) ||
             phraseWords.some(pw => pw.includes(kwLower) || kwLower.includes(pw));
    });
    
    // Check if phrase relates to task name (even if not exact match)
    const phraseRegex = wordBoundaryRegex(phrase);
    const exactMatch = phraseRegex.test(taskNameLower);
    
    // Also check if any phrase words appear in task name
    const hasOverlappingWords = phraseWords.some(pw => taskNameLower.includes(pw));
    
    // Accept phrase if it contains keywords and (exact match OR has overlapping words)
    if (containsKeyword && (exactMatch || hasOverlappingWords) && 
        !finalPhrases.some(p => p.toLowerCase() === phraseLower)) {
      finalPhrases.push(phrase);
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
    
    if (verbPatterns.some(pattern => pattern.test(taskNameLower)) && relatesToKeyword &&
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
    
    if (nounPatterns.some(pattern => pattern.test(taskNameLower)) && relatesToKeyword &&
        !foundNouns.some(n => n.toLowerCase() === nounLower)) {
      foundNouns.push(noun);
    }
  });
  
  // STEP 5: Use task name as context (no external search results)
  const taskContext = taskName.trim();
  
  return {
    keywords: taskKeywords.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedKeywords),
    phrases: finalPhrases.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPhrases),
    verbs: foundVerbs.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedVerbs),
    nouns: foundNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedNouns),
    pronouns: [] as string[], // Pronouns not typically extracted from task name alone
    context: taskContext,
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
  
  // Start with Browser AI-extracted terms (from DuckDuckGo)
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
  // This ensures we have domain-appropriate terms even when DuckDuckGo returns sparse results
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
  
  // Find domain phrases that relate to keywords but add elaboration
  // PRIORITY: Look for phrases that contain keywords but are NOT in the task name
  // This ensures we get contextual information, not just repetition
  domainTerms.phrases.forEach(phrase => {
    const phraseLower = phrase.toLowerCase();
    const phraseWords = phraseLower.split(/\s+/).filter(w => w.length >= 2);
    
    // Check if phrase contains keywords (improved matching - check word-level matches)
    // Also check if any word in the phrase relates to any keyword (more lenient)
    const containsKeywords = taskKeywordsLower.some(kw => {
      const kwLower = kw.toLowerCase();
      // Direct match
      if (phraseLower.includes(kwLower) || kwLower.includes(phraseLower)) {
        return true;
      }
      // Word-level match - check if any phrase word contains or is contained by keyword
      return phraseWords.some(pw => pw.includes(kwLower) || kwLower.includes(pw));
    }) || phraseWords.some(pw => 
      taskKeywordsLower.some(tkw => {
        const tkwLower = tkw.toLowerCase();
        return pw.includes(tkwLower) || tkwLower.includes(pw);
      })
    );
    
    // More lenient check: phrase should NOT be a direct substring of task name
    // Allow partial matches if they add context
    const isDirectSubstring = taskNameLower.includes(phraseLower) && phraseLower.length > 3;
    const isTaskNameSubstring = phraseLower.includes(taskNameLower) && taskNameLower.length > 5;
    
    // Also check if phrase is too similar to task name (all words in phrase are in task name)
    const allWordsInTaskName = phraseWords.length > 0 && 
      phraseWords.every(word => taskNameLower.includes(word));
    
    // Accept phrase if it contains keywords and adds new context
    // More lenient: accept if phrase relates to keywords even if not all words match
    if (containsKeywords && !isDirectSubstring && !isTaskNameSubstring && !allWordsInTaskName) {
      // Count how many keywords the phrase contains (more = more relevant)
      const keywordCount = taskKeywordsLower.filter(kw => {
        const kwLower = kw.toLowerCase();
        return phraseLower.includes(kwLower) || 
               phraseWords.some(pw => pw.includes(kwLower) || kwLower.includes(pw));
      }).length;
      
      // Also check if phrase adds new words not in task name
      const newWords = phraseWords.filter(word => !taskNameLower.includes(word));
      // More lenient: accept if phrase has keywords OR adds new words OR is a contextual phrase
      const contextualActionWords = ['ensure', 'maintain', 'improve', 'create', 'develop', 'achieve', 'follow', 'use', 'optimize', 'enhance', 'resolve', 'implement', 'coordinate'];
      const addsContext = newWords.length > 0 || phraseWords.length > 2 || keywordCount >= 1 ||
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
    const bestPhrase = elaboratingPhrases[0];
    const bestPhraseLower = bestPhrase.toLowerCase();
    
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
    }).slice(0, 2);
    
    // Get context nouns that add value
    const contextNouns = elaboratingNouns.filter(n => 
      !bestPhraseLower.includes(n.toLowerCase()) &&
      !taskNameLower.includes(n.toLowerCase())
    ).slice(0, 2);
    
    // Build complete contextual sentence
    if (phraseHasAction) {
      // Phrase already has action - build sentence around it with keywords and nouns
      const parts: string[] = [];
      parts.push(bestPhrase.charAt(0).toUpperCase() + bestPhrase.slice(1));
      
      if (contextNouns.length > 0) {
        parts.push(`involving ${contextNouns.join(' and ')}`);
      }
      
      if (relevantKeywords.length > 0) {
        parts.push(`related to ${relevantKeywords.join(' and ')}`);
      }
      
      description = parts.join(' ');
    } else if (actionVerb) {
      // Need to add action verb - build sentence with verb + phrase + context
      const parts: string[] = [];
      parts.push(`${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${bestPhrase}`);
      
      if (contextNouns.length > 0) {
        parts.push(`for ${contextNouns[0]}`);
      } else if (relevantKeywords.length > 0) {
        parts.push(`related to ${relevantKeywords[0]}`);
      }
      
      description = parts.join(' ');
        } else {
      // No action verb available - use phrase with context
      const parts: string[] = [];
      parts.push(bestPhrase.charAt(0).toUpperCase() + bestPhrase.slice(1));
      
      if (contextNouns.length > 0) {
        parts.push(`involving ${contextNouns.join(' and ')}`);
      } else if (relevantKeywords.length > 0) {
        parts.push(`related to ${relevantKeywords.join(' and ')}`);
      }
      
      description = parts.join(' ');
    }
  } 
  // PRIORITY 2: Build sentence using domain verbs + nouns + keywords
  else if (elaboratingVerbs.length > 0 && elaboratingNouns.length > 0) {
    const actionVerb = elaboratingVerbs[0];
    const contextNouns = elaboratingNouns.slice(0, 2);
    
    // Get relevant keywords that add context
    const relevantKeywords = keywords.filter(kw => {
      const kwLower = kw.toLowerCase();
      return !contextNouns.some(n => n.toLowerCase().includes(kwLower)) &&
             !taskNameLower.includes(kwLower);
    }).slice(0, 2);
    
    // Build complete sentence
    const parts: string[] = [];
    parts.push(`${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${contextNouns.join(' and ')}`);
    
    if (relevantKeywords.length > 0) {
      parts.push(`related to ${relevantKeywords.join(' and ')}`);
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
      const isDirectSubstring = taskNameLower.includes(phraseLower) && phraseLower.length > 5;
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
      ).slice(0, 2);
      
      const contextNouns = elaboratingNouns.filter(n => 
        !bestPhraseLower.includes(n.toLowerCase())
      ).slice(0, 2);
      
      // Build complete sentence
      if (actionVerb && !bestPhraseLower.includes(actionVerb.toLowerCase())) {
        const parts: string[] = [];
        parts.push(`${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${bestPhrase}`);
        
        if (contextNouns.length > 0) {
          parts.push(`for ${contextNouns[0]}`);
        } else if (relevantKeywords.length > 0) {
          parts.push(`related to ${relevantKeywords[0]}`);
        }
        
        description = parts.join(' ');
      } else {
        const parts: string[] = [];
        parts.push(bestPhrase.charAt(0).toUpperCase() + bestPhrase.slice(1));
        
        if (contextNouns.length > 0) {
          parts.push(`involving ${contextNouns.join(' and ')}`);
        } else if (relevantKeywords.length > 0) {
          parts.push(`related to ${relevantKeywords.join(' and ')}`);
        }
        
        description = parts.join(' ');
      }
    }
  }
  // PRIORITY 4: Build sentence using extracted verbs + nouns + keywords
  else if (verbs.length > 0 && nouns.length > 0) {
    const actionVerb = verbs[0];
    const contextNouns = nouns.slice(0, 2);
    const relevantKeywords = keywords.filter(kw => 
      !contextNouns.some(n => n.toLowerCase().includes(kw.toLowerCase())) &&
      !taskNameLower.includes(kw.toLowerCase())
    ).slice(0, 2);
    
    // Build complete sentence
    const parts: string[] = [];
    parts.push(`${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${contextNouns.join(' and ')}`);
    
    if (relevantKeywords.length > 0) {
      parts.push(`related to ${relevantKeywords.join(' and ')}`);
    }
    
    description = parts.join(' ');
  }
  // PRIORITY 5: Build sentence using verbs + keywords
  else if (verbs.length > 0 && keywords.length > 0) {
    const actionVerb = verbs[0];
    const relevantKeywords = keywords.filter(kw => 
      !actionVerb.toLowerCase().includes(kw.toLowerCase()) &&
      !taskNameLower.includes(kw.toLowerCase())
    ).slice(0, 2);
    
    if (relevantKeywords.length > 0) {
      description = `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${relevantKeywords.join(' and ')}`;
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
    const contextNouns = nouns.slice(0, 1);
    const relevantKeywords = keywords.filter(kw => 
      !contextNouns.some(n => n.toLowerCase().includes(kw.toLowerCase())) &&
      !taskNameLower.includes(kw.toLowerCase())
    ).slice(0, 2);
    
    // Use action verb from extracted verbs or domain terminology
    const actionVerb = verbs.length > 0 ? verbs[0] : (elaboratingVerbs.length > 0 ? elaboratingVerbs[0] : '');
    
    if (relevantKeywords.length > 0) {
      if (actionVerb) {
        description = `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${contextNouns[0]} related to ${relevantKeywords.join(' and ')}`;
      } else {
        description = `${contextNouns[0]} related to ${relevantKeywords.join(' and ')}`;
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
    const relevantKeywords = keywords.filter(kw => !taskNameLower.includes(kw.toLowerCase())).slice(0, 3);
    const actionVerb = verbs.length > 0 ? verbs[0] : (elaboratingVerbs.length > 0 ? elaboratingVerbs[0] : '');
    
    if (actionVerb && relevantKeywords.length > 0) {
      description = `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${relevantKeywords.join(' and ')}`;
    } else if (relevantKeywords.length > 0) {
      // Try to add domain nouns for context
      if (elaboratingNouns.length > 0) {
        description = `${relevantKeywords.join(' and ')} involving ${elaboratingNouns[0]}`;
      } else {
        description = relevantKeywords.join(' and ');
      }
    } else if (actionVerb) {
      description = actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1);
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
  const isTooSimilar = wordOverlapRatio >= 0.8 && descriptionWords.length <= taskWordsForComparison.length + 2;
  
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
      }).slice(0, 2);
      
      const contextNouns = elaboratingNouns.filter(n => 
        !bestPhraseLower.includes(n.toLowerCase())
      ).slice(0, 2);
      
      // Build complete sentence
      const parts: string[] = [];
      if (actionVerb && !bestPhraseLower.includes(actionVerb.toLowerCase())) {
        parts.push(`${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${bestPhrase}`);
      } else {
        parts.push(bestPhrase.charAt(0).toUpperCase() + bestPhrase.slice(1));
      }
      
      if (contextNouns.length > 0) {
        parts.push(`involving ${contextNouns.join(' and ')}`);
      } else if (relevantKeywords.length > 0) {
        parts.push(`related to ${relevantKeywords.join(' and ')}`);
      }
      
      description = parts.join(' ');
    } else if (elaboratingVerbs.length > 0 && elaboratingNouns.length > 0) {
      // Use domain verbs and nouns with keywords
      const actionVerb = elaboratingVerbs[0];
      const contextNouns = elaboratingNouns.slice(0, 2);
      const relevantKeywords = keywords.filter(kw => 
        !contextNouns.some(n => n.toLowerCase().includes(kw.toLowerCase())) &&
        !taskNameLower.includes(kw.toLowerCase())
      ).slice(0, 2);
      
      const parts: string[] = [];
      parts.push(`${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${contextNouns.join(' and ')}`);
      
      if (relevantKeywords.length > 0) {
        parts.push(`related to ${relevantKeywords.join(' and ')}`);
      }
      
      description = parts.join(' ');
    } else {
      // Build sentence using available terms
      const actionVerb = verbs.length > 0 ? verbs[0] : (elaboratingVerbs.length > 0 ? elaboratingVerbs[0] : '');
      const contextNouns = nouns.length > 0 ? nouns.slice(0, 1) : (elaboratingNouns.length > 0 ? elaboratingNouns.slice(0, 1) : []);
      const relevantKeywords = keywords.filter(kw => !taskNameLower.includes(kw.toLowerCase())).slice(0, 2);
      
      const parts: string[] = [];
      if (actionVerb) {
        if (contextNouns.length > 0) {
          parts.push(`${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${contextNouns[0]}`);
        } else if (relevantKeywords.length > 0) {
          parts.push(`${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${relevantKeywords.join(' and ')}`);
        } else {
          parts.push(actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1));
        }
      } else if (contextNouns.length > 0) {
        parts.push(contextNouns[0].charAt(0).toUpperCase() + contextNouns[0].slice(1));
        if (relevantKeywords.length > 0) {
          parts.push(`related to ${relevantKeywords.join(' and ')}`);
        }
      } else if (relevantKeywords.length > 0) {
        parts.push(relevantKeywords.join(' and '));
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
 */
export async function generateDescription(taskName: string, accessToken?: string | null): Promise<GeneratedDescription> {
  if (!taskName || taskName.trim().length === 0) {
    return {
      description: '',
      domain: DEFAULT_TASK_DOMAIN,
      confidence: 0,
    };
  }

  // Detect domain from task name
  const domainResult = detectDomain(taskName, '');
  const domain = domainResult.domain;
  const domainTerms = getDomainTerminology(domain);

  // INTEGRATED APPROACH: DuckDuckGo + Browser AI + Local Terminology Dictionary
  // 1. DuckDuckGo: Provides real-world search results
  // 2. Browser AI: Extracts terms and creates context from search results
  // 3. Local Terminology: Acts as DICTIONARY/VALIDATOR to:
  //    - Validate extracted terms are domain-appropriate
  //    - Add synonyms and related terms from domain dictionary
  //    - Enhance terms with domain-specific context
  //    - Fill gaps when search results are minimal
  // Browser AI does the primary extraction, Local Terminology validates/enhances
  
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

  // STEP 1: Use Browser AI to extract terms directly from task name (no DuckDuckGo needed)
  // Browser AI analyzes user input and extracts keywords, phrases, verbs, nouns
  // Local Terminology acts as a cache/dictionary to enhance extracted terms
  logger.debug(`Using Browser AI to extract terms from task name: "${taskName}", domain: ${domain}`);
  
  // Extract terms directly from task name using Browser AI
  searchExtracted = extractTermsFromTaskNameWithBrowserAI(taskName, domainTerms);
  searchContext = searchExtracted.context; // Task name itself as context
  usedSearchResults = false; // Not using external search, using Browser AI only
  
  logger.debug(`Browser AI extraction: ${searchExtracted.keywords.length} keywords, ${searchExtracted.phrases.length} phrases, ${searchExtracted.verbs.length} verbs, ${searchExtracted.nouns.length} nouns`, {
    keywords: searchExtracted.keywords,
    phrases: searchExtracted.phrases,
    verbs: searchExtracted.verbs,
    nouns: searchExtracted.nouns
  });

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
  
  logger.debug(`Using Browser AI as PRIMARY source: ${finalKeywords.length} keywords, ${finalPhrases.length} phrases, ${finalVerbs.length} verbs, ${finalNouns.length} nouns`, {
    keywords: finalKeywords.slice(0, 5),
    phrases: finalPhrases.slice(0, 3),
    verbs: finalVerbs.slice(0, 3),
    nouns: finalNouns.slice(0, 3)
  });

  // STEP 3: Build description using Browser AI-extracted terms
  logger.debug(`Building description with Browser AI:`, {
    keywords: finalKeywords.slice(0, 5),
    phrases: finalPhrases.slice(0, 3),
    verbs: finalVerbs.slice(0, 3),
    nouns: finalNouns.slice(0, 3),
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

  // STEP 5: If description is still empty/short, try direct approaches
      const isDescriptionTooShort = description && description.trim().length < DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.descriptionTooShortThreshold;
  // Check if description is too generic (very short or uses common generic verbs)
  const genericVerbs = ['find', 'get', 'do', 'make', 'use', 'have'];
      const isDescriptionTooGeneric = description && (
    description.split(' ').length <= 3 && 
    genericVerbs.some(verb => description.toLowerCase().includes(verb))
  );

  if ((!description || description.trim().length === 0 || isDescriptionTooShort || isDescriptionTooGeneric)) {
    // Try using search context directly if available
    if (searchContext && searchContext.length > DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.contextBoostThreshold) {
          const contextPreviewLength = DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.contextPreviewLength;
      const contextToUse = searchContext.length > contextPreviewLength 
        ? searchContext.substring(0, contextPreviewLength).trim()
        : searchContext.trim();
      
          const firstSentence = contextToUse.split(/[.!?]+/)[0]?.trim();
          const directDescription = (firstSentence && firstSentence.length >= DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.directContextMinLength) 
            ? firstSentence 
            : contextToUse.substring(0, Math.min(DESCRIPTION_GENERATION_CONFIG.maxSentenceLength, contextToUse.length)).trim();
          
          if (directDescription.length >= DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.directContextMinLength) {
            description = directDescription.charAt(0).toUpperCase() + directDescription.slice(1);
            if (!DESCRIPTION_GENERATION_CONFIG.sentenceEndPattern.test(description)) {
              description += DESCRIPTION_GENERATION_CONFIG.descriptionSeparators.period.trim();
            }
        logger.debug(`Using direct search context: "${description.substring(0, 50)}..."`);
      }
    }
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
  const contextBoost = searchContext.length >= DESCRIPTION_GENERATION_CONFIG.minContextLength ? 0.1 : 
                      searchContext.length >= DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.contextBoostThreshold ? 0.05 : 0;
  
      confidence = Math.min(
    baseConf + browserAIBoost + contextBoost,
        DESCRIPTION_GENERATION_CONFIG.maxConfidence
      );
      
  logger.debug(`✅ Browser AI: description length=${description.length}, confidence=${confidence.toFixed(2)}, hasBrowserAITerms=${hasBrowserAITerms}, contextLength=${searchContext.length}`, {
    finalDescription: description.substring(0, 100),
    browserAITermsCount: finalKeywords.length + finalPhrases.length + finalVerbs.length,
    finalKeywords: finalKeywords.slice(0, 5),
    finalPhrases: finalPhrases.slice(0, 3),
    finalVerbs: finalVerbs.slice(0, 3),
    finalNouns: finalNouns.slice(0, 3),
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

  // STEP 5: Ultimate fallback if still empty (only if both search and cache failed)
  if (!description || description.trim().length === 0) {
    // Ultimate fallback: use hardcoded template (only when everything else fails)
    logger.warn(`Both DuckDuckGo + Browser AI and local terminology cache failed for "${taskName}", using ultimate fallback`);
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
}
