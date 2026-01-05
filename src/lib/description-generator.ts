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
  const taskWords = taskName.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length >= DESCRIPTION_GENERATION_CONFIG.minWordLength)
    .filter(w => !DESCRIPTION_GENERATION_CONFIG.stopWords.includes(w));
  
  // Remove duplicates and return
  return Array.from(new Set(taskWords));
}

/**
 * Find phrases in search results using keywords from task name
 * Looks for phrases (2-5 words) that contain the keywords
 */
function findPhrasesUsingKeywords(
  searchResults: string[],
  keywords: string[]
): string[] {
  const foundPhrases: string[] = [];
  const combinedText = searchResults.join(' ').toLowerCase();
  
  // For each keyword, find phrases that contain it
  keywords.forEach(keyword => {
    const keywordLower = keyword.toLowerCase();
    
    // Extract phrases containing this keyword from search results
    searchResults.forEach(result => {
      const resultLower = result.toLowerCase();
      const words = resultLower.split(/\s+/);
      
      // Find all positions of the keyword in the text
      for (let i = 0; i < words.length; i++) {
        if (words[i].includes(keywordLower) || keywordLower.includes(words[i])) {
          // Extract phrases of different lengths (2-5 words) starting from this position
          for (let len = DESCRIPTION_GENERATION_CONFIG.minPhraseLength; 
               len <= DESCRIPTION_GENERATION_CONFIG.maxPhraseLength && i + len <= words.length; 
               len++) {
            const phrase = words.slice(i, i + len).join(' ');
            
            // Only add if phrase contains the keyword and is meaningful
            if (phrase.includes(keywordLower) && 
                phrase.length > keywordLower.length + 2 && // Phrase should be longer than just the keyword
                !foundPhrases.some(p => p.toLowerCase() === phrase.toLowerCase())) {
              foundPhrases.push(phrase);
            }
          }
        }
      }
    });
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
  
  // Add top phrases by frequency
  const sortedPhrases = Array.from(phraseFreq.entries())
    .filter(([phrase, freq]) => freq >= DESCRIPTION_GENERATION_CONFIG.minWordFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPhrases)
    .map(([phrase]) => phrase);
  
  sortedPhrases.forEach(phrase => {
    if (!foundPhrases.some(p => p.toLowerCase() === phrase.toLowerCase())) {
      foundPhrases.push(phrase);
    }
  });
  
  return foundPhrases.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPhrases);
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
 * Extract keywords, phrases, verbs, nouns, and pronouns from task name using domain terminology
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
 * Build contextual description from search results using keywords and phrases
 * NEW FLOW: Constructs natural description from search results that contain keywords and phrases
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
  let description = '';
  
  const taskNameLower = taskName.toLowerCase();
  
  // Filter phrases to only include those that relate to keywords
  const relevantPhrases = phrases.filter(phrase => {
    const phraseLower = phrase.toLowerCase();
    return keywords.some(kw => phraseLower.includes(kw.toLowerCase()) || kw.toLowerCase().includes(phraseLower));
  });
  
  // STEP 1: Find the best sentence from search results that contains keywords and phrases
  // PRIORITY: Use actual complete sentences from search results, not just extracted terms
  // Use context even if it's shorter than minContextLength - it might still be useful
  if (context && context.length > 0) {
    // Try splitting by sentences first (periods, exclamation, question marks)
    // This is the most reliable way to get complete sentences
    // BE MORE LENIENT: Lower minimum length to capture more sentences
    const minLen = Math.max(
      DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.minLenFallback, 
      DESCRIPTION_GENERATION_CONFIG.minSentenceLength - DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.minLenReduction
    ); // Allow shorter sentences
    let sentences = context.split(/[.!?]+/)
      .filter(s => s.trim().length >= minLen)
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length <= DESCRIPTION_GENERATION_CONFIG.maxSentenceLength * DESCRIPTION_GENERATION_CONFIG.sentenceLengthMultiplier);
    
    // If no sentences found with punctuation, try splitting by newlines (paragraph breaks)
    if (sentences.length === 0) {
      sentences = context.split(/\n+/)
        .filter(s => s.trim().length >= minLen)
        .map(s => s.trim())
        .filter(s => s.length > 0 && s.length <= DESCRIPTION_GENERATION_CONFIG.maxSentenceLength * DESCRIPTION_GENERATION_CONFIG.sentenceLengthMultiplier);
    }
    
    // If still no sentences, try splitting by commas (less ideal, but might work)
    if (sentences.length === 0) {
      sentences = context.split(/[,;]+/)
        .filter(s => s.trim().length >= minLen)
        .map(s => s.trim())
        .filter(s => s.length > 0 && s.length <= DESCRIPTION_GENERATION_CONFIG.maxSentenceLength * DESCRIPTION_GENERATION_CONFIG.sentenceLengthMultiplier);
    }
    
      // If still no sentences, use meaningful chunks from context
      // BE MORE LENIENT: Use smaller chunks if needed
      if (sentences.length === 0 && context.trim().length > 0) {
        // Try to extract a meaningful sentence-like chunk
        const words = context.trim().split(/\s+/);
        const minWords = Math.max(3, DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.chunkMinWords - 2); // Lower threshold
        if (words.length >= minWords) {
          // Take first N words as a sentence
          const chunk = words.slice(0, Math.min(DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.chunkMaxWords, words.length)).join(' ');
          if (chunk.length >= minLen) {
            sentences = [chunk];
          }
        }
        
        // If still no sentences, use first part of context directly (even if short)
        if (sentences.length === 0 && context.trim().length >= DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.minLenFallback) {
          const firstPart = context.trim().substring(0, DESCRIPTION_GENERATION_CONFIG.maxSentenceLength).trim();
          if (firstPart.length >= DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.minLenFallback) {
            sentences = [firstPart];
          }
        }
      }
    
    if (sentences.length > 0) {
      // Score sentences based on how many keywords and phrases they contain
      // Prioritize sentences that are complete, natural, and contain task-relevant terms
      const scoredSentences = sentences.map(sentence => {
        const sentenceLower = sentence.toLowerCase();
        let score = 0;
        
        // Check for keywords (preferred but not required - allow sentences without keywords if they have phrases)
        const keywordCount = keywords.filter(kw => {
          const kwLower = kw.toLowerCase();
          // Use word boundary matching for better accuracy
          return new RegExp(`\\b${kwLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(sentenceLower);
        }).length;
        
        // Don't completely reject sentences without keywords if they have phrases or are from search results
        // This allows using sentences that might be relevant even if keyword extraction wasn't perfect
        if (keywordCount === 0 && keywords.length > 0 && relevantPhrases.length === 0) {
          // Only reject if we have keywords but no phrases and no keyword matches
          // This is less strict - allows sentences that might still be useful
          score -= 5; // Penalty but don't reject completely
        }
        score += keywordCount * DESCRIPTION_GENERATION_CONFIG.sentenceScoring.keywordWeight;
        
        // Check for phrases (high value - complete phrases are better than individual keywords)
        const phraseCount = relevantPhrases.filter(phrase => {
          const phraseLower = phrase.toLowerCase();
          return sentenceLower.includes(phraseLower);
        }).length;
        score += phraseCount * DESCRIPTION_GENERATION_CONFIG.sentenceScoring.phraseWeight;
        
        // MAJOR BONUS: Sentences with multiple keywords are more relevant
        if (keywordCount >= 2) {
          score += DESCRIPTION_GENERATION_CONFIG.sentenceScoringBonuses.multipleKeywords2;
        }
        if (keywordCount >= 3) {
          score += DESCRIPTION_GENERATION_CONFIG.sentenceScoringBonuses.multipleKeywords3;
        }
        
        // MAJOR BONUS: Sentences with both keywords AND phrases are highly relevant
        if (keywordCount > 0 && phraseCount > 0) {
          score += DESCRIPTION_GENERATION_CONFIG.sentenceScoringBonuses.keywordsAndPhrases;
        }
        
        // Check for verbs and nouns (additional context)
        const verbCount = verbs.filter(v => {
          const vLower = v.toLowerCase();
          const vBase = vLower.replace(/(ing|ed|s|es)$/, '');
          return sentenceLower.includes(vLower) || sentenceLower.includes(vBase);
        }).length;
        score += verbCount * DESCRIPTION_GENERATION_CONFIG.sentenceScoring.verbWeight;
        
        const nounCount = nouns.filter(n => sentenceLower.includes(n.toLowerCase())).length;
        score += nounCount * DESCRIPTION_GENERATION_CONFIG.sentenceScoring.nounWeight;
        
        // Prefer longer, more complete sentences (but not too long)
        if (sentence.length >= DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.wellFormedMin && 
            sentence.length <= DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.wellFormedMax) {
          score += DESCRIPTION_GENERATION_CONFIG.sentenceScoringBonuses.wellFormedSentence;
        }
        
        // Penalize very short sentences (likely fragments)
        if (sentence.length < DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.fragmentMax) {
          score += DESCRIPTION_GENERATION_CONFIG.sentenceScoringBonuses.shortSentencePenalty;
        }
        
        return { sentence, score };
      });
      
      // Get the best sentence (highest score)
      scoredSentences.sort((a, b) => {
        // First sort by score
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        // If scores are equal, prefer longer sentences (more complete)
        return b.sentence.length - a.sentence.length;
      });
      
      // Use the best sentence - be more lenient to allow sentences even with lower scores
      // This ensures we use search result context even if keyword matching isn't perfect
      // If we have context from search results, prioritize using it even with low scores
      // ACCEPT ANY SENTENCE: Even with negative scores, if we have search results, use them
      let bestSentence = scoredSentences.length > 0 ? scoredSentences[0].sentence : null;
      
      // If no scored sentences but we have context, use first sentence from context
      // BE MORE LENIENT: Lower minimum length requirement
      if (!bestSentence && context && context.length > 0) {
        const firstSentence = context.split(/[.!?]+/)[0]?.trim();
        if (firstSentence && firstSentence.length >= DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.minLenFallback) {
          bestSentence = firstSentence;
        } else if (context.trim().length >= DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.minLenFallback) {
          // If no sentence found, use first part of context
          bestSentence = context.trim().substring(0, DESCRIPTION_GENERATION_CONFIG.maxSentenceLength).trim();
        }
      }
      
      if (bestSentence && bestSentence.length > 0) {
        // Use the sentence directly as description (more natural)
        // Clean up the sentence (remove extra spaces, ensure proper capitalization)
        let cleanSentence = bestSentence.trim();
        
        // Remove extra whitespace
        cleanSentence = cleanSentence.replace(DESCRIPTION_GENERATION_CONFIG.whitespacePattern, ' ');
        
        // Ensure sentence starts with capital letter
        if (cleanSentence.length > 0) {
          cleanSentence = cleanSentence.charAt(0).toUpperCase() + cleanSentence.slice(1);
        }
        
        // Ensure sentence ends with punctuation if it doesn't already
        if (cleanSentence.length > 0 && !DESCRIPTION_GENERATION_CONFIG.sentenceEndPattern.test(cleanSentence)) {
          cleanSentence += DESCRIPTION_GENERATION_CONFIG.descriptionSeparators.period.trim();
        }
        
        if (cleanSentence.length < DESCRIPTION_GENERATION_CONFIG.maxSentenceLength) {
          description = cleanSentence;
        } else {
          // Truncate if too long, but try to end at a word boundary
          const truncated = cleanSentence.substring(0, DESCRIPTION_GENERATION_CONFIG.maxSentenceLength);
          const lastSpace = truncated.lastIndexOf(' ');
          const threshold = DESCRIPTION_GENERATION_CONFIG.maxSentenceLength * DESCRIPTION_GENERATION_CONFIG.truncationThreshold;
          description = lastSpace > threshold 
            ? truncated.substring(0, lastSpace) + DESCRIPTION_GENERATION_CONFIG.descriptionSeparators.ellipsis
            : truncated + DESCRIPTION_GENERATION_CONFIG.descriptionSeparators.ellipsis;
        }
      }
    }
  }
  
  // STEP 2: If no good sentence found from search results, construct description from keywords and phrases
  // This should only happen if search results don't contain usable sentences
  if (!description || description.trim().length === 0) {
    // Try to construct a natural description using keywords, phrases, and domain terminology
    // Priority: Use domain terminology phrases to construct natural sentences
    
    // First, try to use domain terminology phrases that match the task
    // These are the most reliable source of complete, natural phrases
    const taskKeywordsLower = keywords.map(kw => kw.toLowerCase());
    const matchingDomainPhrases = domainTerms.phrases.filter(p => {
      const pLower = p.toLowerCase();
      // Check if phrase contains multiple keywords (more relevant)
      const matchingKeywords = taskKeywordsLower.filter(kw => pLower.includes(kw)).length;
      // Prefer phrases with 2+ keywords, or longer phrases with at least 1 keyword
      return matchingKeywords >= DESCRIPTION_GENERATION_CONFIG.domainPhraseMatching.minKeywordsForMatch || 
             (matchingKeywords >= 1 && pLower.length > DESCRIPTION_GENERATION_CONFIG.domainPhraseMatching.minLengthForSingleKeyword);
    });
    
    if (matchingDomainPhrases.length > 0) {
      // Sort by: 1) number of matching keywords, 2) length (longer = more complete)
      const sortedPhrases = matchingDomainPhrases.sort((a, b) => {
        const aKeywords = taskKeywordsLower.filter(kw => a.toLowerCase().includes(kw)).length;
        const bKeywords = taskKeywordsLower.filter(kw => b.toLowerCase().includes(kw)).length;
        if (bKeywords !== aKeywords) {
          return bKeywords - aKeywords;
        }
        return b.length - a.length;
      });
      
      const bestPhrase = sortedPhrases[0];
      const actionWord = taskNameLower.includes(DESCRIPTION_GENERATION_CONFIG.actionWords.find) ? DESCRIPTION_GENERATION_CONFIG.actionWords.find : 
                        taskNameLower.includes(DESCRIPTION_GENERATION_CONFIG.actionWords.search) ? DESCRIPTION_GENERATION_CONFIG.actionWords.search :
                        taskNameLower.includes(DESCRIPTION_GENERATION_CONFIG.actionWords.buy) ? DESCRIPTION_GENERATION_CONFIG.actionWords.buy :
                        taskNameLower.includes(DESCRIPTION_GENERATION_CONFIG.actionWords.get) ? DESCRIPTION_GENERATION_CONFIG.actionWords.get : 
                        DESCRIPTION_GENERATION_CONFIG.actionWords.find;
      
      // Construct a natural sentence
      if (bestPhrase.toLowerCase().includes(actionWord)) {
        // Phrase already has action word, use as-is
        description = bestPhrase.charAt(0).toUpperCase() + bestPhrase.slice(1);
      } else {
        // Add action word and meaningful context (only if it adds value)
        const contextKeywords = keywords.filter(kw => {
          const kwLower = kw.toLowerCase();
          const phraseLower = bestPhrase.toLowerCase();
          // Only use context if it's not already in the phrase and is meaningful
          return !phraseLower.includes(kwLower) && 
                 kwLower !== actionWord &&
                 !DESCRIPTION_GENERATION_CONFIG.contextFilterStopWords.includes(kwLower) &&
                 DESCRIPTION_GENERATION_CONFIG.preferredContextWords.home.includes(kwLower);
        });
        
        if (contextKeywords.length > 0) {
          description = `${actionWord.charAt(0).toUpperCase() + actionWord.slice(1)} ${bestPhrase} for ${contextKeywords[0]}`;
        } else {
          // Phrase is complete enough on its own
          description = `${actionWord.charAt(0).toUpperCase() + actionWord.slice(1)} ${bestPhrase}`;
        }
      }
    } else if (relevantPhrases.length > 0 && keywords.length > 0) {
      // Use phrases found in search results
      const bestPhrase = relevantPhrases[0];
      
      // Look for action verbs related to the task
      const actionVerbs = verbs.filter(v => {
        const vLower = v.toLowerCase();
        return DESCRIPTION_GENERATION_CONFIG.actionWordList.some(action => 
          vLower.includes(action) || action.includes(vLower)
        );
      });
      
      if (actionVerbs.length > 0) {
        // Construct: "Find [phrase] for [context]"
        const action = actionVerbs[0];
        const context = keywords.filter(kw => !bestPhrase.toLowerCase().includes(kw.toLowerCase())).slice(0, DESCRIPTION_GENERATION_CONFIG.fallbackKeywordLimits.maxKeywordsForContext).join(' ');
        description = `${action.charAt(0).toUpperCase() + action.slice(1)} ${bestPhrase}${context ? ` for ${context}` : ''}`;
      } else {
        // Use phrase directly with proper capitalization
        description = bestPhrase.charAt(0).toUpperCase() + bestPhrase.slice(1);
      }
    } else if (phrases.length > 0 && keywords.length > 0) {
      // Use any phrase found, even if not filtered as "relevant"
      const bestPhrase = phrases[0];
      const actionVerbs = verbs.filter(v => {
        const vLower = v.toLowerCase();
        return DESCRIPTION_GENERATION_CONFIG.actionWordList.slice(0, DESCRIPTION_GENERATION_CONFIG.maxActionWordsForFiltering).some(action => 
          vLower.includes(action) || action.includes(vLower)
        );
      });
      
      if (actionVerbs.length > 0) {
        description = `${actionVerbs[0].charAt(0).toUpperCase() + actionVerbs[0].slice(1)} ${bestPhrase}`;
      } else {
        description = bestPhrase.charAt(0).toUpperCase() + bestPhrase.slice(1);
      }
    } else if (keywords.length > 0) {
      // Construct a natural description from keywords using domain terminology
      // Find action verbs from domain terminology that relate to keywords
      const taskKeywordsLower = keywords.map(kw => kw.toLowerCase());
      const relatedVerbs = domainTerms.verbs.filter(v => {
        const vLower = v.toLowerCase();
        return taskKeywordsLower.some(kw => vLower.includes(kw) || kw.includes(vLower)) ||
               DESCRIPTION_GENERATION_CONFIG.actionWordList.some(action => 
                 vLower.includes(action) || action.includes(vLower)
               );
      });
      
      const relatedNouns = domainTerms.nouns.filter(n => {
        const nLower = n.toLowerCase();
        return taskKeywordsLower.some(kw => nLower.includes(kw) || kw.includes(nLower));
      });
      
      const relatedPhrases = domainTerms.phrases.filter(p => {
        const pLower = p.toLowerCase();
        return taskKeywordsLower.some(kw => pLower.includes(kw) || kw.includes(pLower));
      });
      
      // Build description using domain terminology - construct natural sentences
      if (relatedPhrases.length > 0) {
        // Use domain phrase - construct a natural sentence
        // Prioritize longer, more complete phrases (they're more descriptive)
        const sortedPhrases = relatedPhrases.sort((a, b) => {
          // First sort by length (longer = more complete)
          if (b.length !== a.length) {
            return b.length - a.length;
          }
          // Then by number of keywords contained
          const aKeywords = taskKeywordsLower.filter(kw => a.toLowerCase().includes(kw)).length;
          const bKeywords = taskKeywordsLower.filter(kw => b.toLowerCase().includes(kw)).length;
          return bKeywords - aKeywords;
        });
        
        const bestPhrase = sortedPhrases[0];
        const actionWord = taskNameLower.includes('find') ? 'find' : 
                          taskNameLower.includes('search') ? 'search' :
                          taskNameLower.includes('buy') ? 'buy' :
                          taskNameLower.includes('get') ? 'get' : 'find';
        
        // Check if phrase already contains action word
        if (bestPhrase.toLowerCase().includes(actionWord)) {
          // Phrase already has action, capitalize and use as-is
          description = bestPhrase.charAt(0).toUpperCase() + bestPhrase.slice(1);
        } else {
          // Construct natural sentence: "Find [phrase] for [context]"
          // Only add context if it adds value (not already in phrase)
          const contextKeywords = keywords.filter(kw => {
            const kwLower = kw.toLowerCase();
            const phraseLower = bestPhrase.toLowerCase();
            // Exclude if keyword is already in phrase or is a stop word
            return !phraseLower.includes(kwLower) && 
                   kwLower !== actionWord &&
                   !['a', 'an', 'the', 'our', 'for', 'auto'].includes(kwLower);
          });
          
          // Prefer "home" or other meaningful context words
          const meaningfulContext = contextKeywords.find(kw => 
            ['home', 'house', 'household'].includes(kw.toLowerCase())
          ) || contextKeywords[0];
          
          if (meaningfulContext) {
            description = `${actionWord.charAt(0).toUpperCase() + actionWord.slice(1)} ${bestPhrase} for ${meaningfulContext}`;
          } else {
            // Just use action + phrase (phrase is complete enough)
            description = `${actionWord.charAt(0).toUpperCase() + actionWord.slice(1)} ${bestPhrase}`;
          }
        }
      } else if (relatedNouns.length > 0) {
        // Use noun with action word - construct natural sentence
        const actionWord = taskNameLower.includes('find') ? 'find' : 
                          taskNameLower.includes('search') ? 'search' :
                          taskNameLower.includes('buy') ? 'buy' :
                          taskNameLower.includes('get') ? 'get' : 'find';
        
        // Prioritize longer, more specific nouns
        const bestNoun = relatedNouns.sort((a, b) => b.length - a.length)[0];
        const contextKeywords = keywords.filter(kw => {
          const kwLower = kw.toLowerCase();
          return !bestNoun.toLowerCase().includes(kwLower) && 
                 kwLower !== actionWord &&
                 !DESCRIPTION_GENERATION_CONFIG.contextFilterStopWords.includes(kwLower);
        });
        
        if (contextKeywords.length > 0) {
          const context = contextKeywords[0];
          description = `${actionWord.charAt(0).toUpperCase() + actionWord.slice(1)} ${bestNoun} for ${context}`;
        } else {
          description = `${actionWord.charAt(0).toUpperCase() + actionWord.slice(1)} ${bestNoun}`;
        }
      } else if (relatedVerbs.length > 0 && relatedNouns.length > 0) {
        // Construct: "Find [noun] for [context]"
        const verb = relatedVerbs[0];
        const noun = relatedNouns[0];
        const contextKeywords = keywords.filter(kw => {
          const kwLower = kw.toLowerCase();
          return !noun.toLowerCase().includes(kwLower) && 
                 kwLower !== verb.toLowerCase() &&
                 !DESCRIPTION_GENERATION_CONFIG.contextFilterStopWords.includes(kwLower);
        });
        
        if (contextKeywords.length > 0) {
          const context = contextKeywords.slice(0, 1).join(' ');
          description = `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${noun} for ${context}`;
        } else {
          description = `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${noun}`;
        }
      } else if (relatedVerbs.length > 0) {
        // Use verb + most relevant keywords (not all keywords)
        const verb = relatedVerbs[0];
        // Only use keywords that aren't already in the verb
        const relevantKeywords = keywords.filter(kw => {
          const kwLower = kw.toLowerCase();
          return !verb.toLowerCase().includes(kwLower) &&
                 !DESCRIPTION_GENERATION_CONFIG.contextFilterStopWords.includes(kwLower);
        }).slice(0, DESCRIPTION_GENERATION_CONFIG.maxContextKeywordsForFallback);
        
        if (relevantKeywords.length > 0) {
          description = `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${relevantKeywords.join(' ')}`;
        } else {
          description = verb.charAt(0).toUpperCase() + verb.slice(1);
        }
      } else {
        // Fallback: construct from keywords with action word - create proper sentence
        const actionWord = taskNameLower.includes('find') ? 'find' : 
                          taskNameLower.includes('search') ? 'search' :
                          taskNameLower.includes('buy') ? 'buy' :
                          taskNameLower.includes('get') ? 'get' : 'find';
        
        // Filter out stop words and construct proper sentence
        const relevantKeywords = keywords.filter(kw => {
          const kwLower = kw.toLowerCase();
          return kwLower !== actionWord &&
                 !DESCRIPTION_GENERATION_CONFIG.contextFilterStopWords.includes(kwLower);
        });
        
        if (relevantKeywords.length > 0) {
          // Use first 2-3 keywords to construct sentence
          const keywordStr = relevantKeywords.slice(0, DESCRIPTION_GENERATION_CONFIG.fallbackKeywordLimits.maxKeywordsForDescription).join(' ');
          description = `${actionWord.charAt(0).toUpperCase() + actionWord.slice(1)} ${keywordStr}`;
        } else {
          description = `${actionWord.charAt(0).toUpperCase() + actionWord.slice(1)} ${taskName.toLowerCase()}`;
        }
      }
    } else {
      // Ultimate fallback
      description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${taskName.toLowerCase()}`;
    }
  }
  
  // Return the natural description (no domain guidance appended - keep it natural)
  return description.trim();
}

/**
 * Generates a task description based on task name using DuckDuckGo Instant Answer API + browser AI
 * Searches for domain-specific keywords, verbs, and scenarios as per guidelines
 * Falls back to local terminology if Instant Answer API is unavailable
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

  // Try to get context from DuckDuckGo Instant Answer API
  let description = '';
  let confidence = DESCRIPTION_GENERATION_CONFIG.baseConfidence;
  let usedSearchResults = false;

  try {
    // Search DuckDuckGo Instant Answer API for domain-specific context (keywords, verbs, scenarios)
    logger.debug(`Starting DuckDuckGo search for task: "${taskName}", domain: ${domain}, hasAccessToken: ${!!accessToken}`);
    const searchResults = await searchDomainContext(taskName, domain, domainTerms, accessToken);
    logger.debug(`DuckDuckGo search completed: ${searchResults.length} total results for "${taskName}"`);
    
    if (searchResults.length > 0) {
      // Extract keywords from task name, find phrases using keywords, and build context from search results
      const extracted = extractKeywordsAndVerbsFromSearch(taskName, searchResults, domainTerms);
      
      logger.debug(`DuckDuckGo search results: ${searchResults.length} results, extracted: ${extracted.keywords.length} keywords, ${extracted.phrases.length} phrases, ${extracted.verbs.length} verbs, ${extracted.nouns.length} nouns, context length: ${extracted.context.length}`, {
        searchResultsPreview: searchResults.slice(0, 3).map(r => r.substring(0, DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.searchResultPreviewLength)),
        keywords: extracted.keywords,
        phrases: extracted.phrases,
        contextPreview: extracted.context.substring(0, DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.contextPreviewLength)
      });
      
      // ALWAYS mark as using search results if we have any search results
      // This ensures we prioritize search-based descriptions over local terminology
      // Even if extracted terms are minimal, the search results provide valuable context
      usedSearchResults = true;
      
      // Build contextual description using search findings
      // Always use search results if we have them, even if extracted terms are minimal
      // The context from search results is valuable even without perfect term extraction
      description = buildContextualDescription(
        taskName,
        extracted.keywords,
        extracted.phrases,
        extracted.verbs,
        extracted.nouns,
        extracted.pronouns,
        extracted.context,
        domain,
        domainTerms
      );
      
      // Calculate confidence for search-based results
      // Boost confidence if we have context even if extracted terms are limited
      const hasExtractedTerms = extracted.keywords.length > 0 || extracted.phrases.length > 0 || 
                                extracted.verbs.length > 0 || extracted.nouns.length > 0;
      const hasContext = extracted.context.length > 0;
      // Boost confidence if we have meaningful context (even if shorter than minContextLength)
      const contextBoost = extracted.context.length >= DESCRIPTION_GENERATION_CONFIG.minContextLength ? 0.1 : 
                          extracted.context.length >= DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.contextBoostThreshold ? 0.05 : 0; // Smaller boost for shorter but useful contexts
      
      // If buildContextualDescription returned empty or too short, try using search results directly
      // Also check if description is too generic (like "Find code testing")
      const isDescriptionTooShort = description && description.trim().length < DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.descriptionTooShortThreshold;
      const isDescriptionTooGeneric = description && (
        description.toLowerCase().includes('find') && description.split(' ').length <= 3
      );
      
      if ((!description || description.trim().length === 0 || isDescriptionTooShort || isDescriptionTooGeneric) && searchResults.length > 0) {
        logger.debug(`buildContextualDescription returned empty/short/generic, using search results directly for "${taskName}"`, {
          currentDescription: description,
          isTooShort: isDescriptionTooShort,
          isTooGeneric: isDescriptionTooGeneric,
          searchResultsCount: searchResults.length
        });
        
        // PRIORITY 1: Use the full context from search results (most comprehensive)
        if (hasContext && extracted.context.length > DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.contextBoostThreshold) {
          // Use a meaningful portion of context (first N chars or first sentence)
          const contextPreviewLength = DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.contextPreviewLength;
          const contextToUse = extracted.context.length > contextPreviewLength 
            ? extracted.context.substring(0, contextPreviewLength).trim()
            : extracted.context.trim();
          
          // Try to get first complete sentence
          const firstSentence = contextToUse.split(/[.!?]+/)[0]?.trim();
          const directDescription = (firstSentence && firstSentence.length >= DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.directContextMinLength) 
            ? firstSentence 
            : contextToUse.substring(0, Math.min(DESCRIPTION_GENERATION_CONFIG.maxSentenceLength, contextToUse.length)).trim();
          
          if (directDescription.length >= DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.directContextMinLength) {
            description = directDescription.charAt(0).toUpperCase() + directDescription.slice(1);
            // Ensure it ends with punctuation
            if (!DESCRIPTION_GENERATION_CONFIG.sentenceEndPattern.test(description)) {
              description += DESCRIPTION_GENERATION_CONFIG.descriptionSeparators.period.trim();
            }
            logger.debug(`Using direct context from search results: "${description.substring(0, 50)}..."`);
          }
        }
        
        // PRIORITY 2: If still empty/short, use search results directly
        if ((!description || description.trim().length < DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.directContextMinLength) && searchResults.length > 0) {
          // Use first few search results directly as description
          const directContext = searchResults
            .slice(0, DESCRIPTION_GENERATION_CONFIG.maxDirectSearchResultsForContext)
            .map(r => r && r.length > 0 ? r.trim() : '')
            .filter(r => r.length > 0)
            .join(' ')
            .trim();
          
          if (directContext.length > 0) {
            // Take first sentence or first meaningful chunk (at least N chars)
            const firstSentence = directContext.split(/[.!?]+/)[0]?.trim();
            const minLength = DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.directContextMinLength;
            const chunkToUse = (firstSentence && firstSentence.length >= minLength)
              ? firstSentence
              : directContext.substring(0, Math.min(DESCRIPTION_GENERATION_CONFIG.maxSentenceLength, directContext.length)).trim();
            
            if (chunkToUse.length >= minLength) {
              description = chunkToUse.charAt(0).toUpperCase() + chunkToUse.slice(1);
              // Ensure it ends with punctuation
              if (!DESCRIPTION_GENERATION_CONFIG.sentenceEndPattern.test(description)) {
                description += DESCRIPTION_GENERATION_CONFIG.descriptionSeparators.period.trim();
              }
              logger.debug(`Using direct search results: "${description.substring(0, 50)}..."`);
            }
          }
        }
        
        // PRIORITY 3: If still empty, rebuild with direct context (more lenient)
        if ((!description || description.trim().length < DESCRIPTION_GENERATION_CONFIG.sentenceLengthThresholds.directContextMinLength) && searchResults.length > 0) {
          const directContext = searchResults
            .slice(0, DESCRIPTION_GENERATION_CONFIG.maxDirectSearchResultsForContext)
            .map(r => r && r.length > 0 ? r.trim() : '')
            .filter(r => r.length > 0)
            .join(' ');
          
          if (directContext.length > 0) {
            // Rebuild description with direct context from search results
            description = buildContextualDescription(
              taskName,
              extracted.keywords,
              extracted.phrases,
              extracted.verbs,
              extracted.nouns,
              extracted.pronouns,
              directContext,
              domain,
              domainTerms
            );
            logger.debug(`Rebuilt description with direct context: "${description.substring(0, 50)}..."`);
          }
        }
      }
      
      // Calculate confidence for search-based results
      confidence = Math.min(
        DESCRIPTION_GENERATION_CONFIG.searchBaseConfidence + 
        (extracted.keywords.length * DESCRIPTION_GENERATION_CONFIG.keywordWeight) + 
        (extracted.phrases.length * DESCRIPTION_GENERATION_CONFIG.phraseWeight) +
        (extracted.verbs.length * DESCRIPTION_GENERATION_CONFIG.verbWeight) + 
        (extracted.nouns.length * DESCRIPTION_GENERATION_CONFIG.nounWeight) +
        (extracted.pronouns.length * DESCRIPTION_GENERATION_CONFIG.pronounWeight) +
        (searchResults.length * DESCRIPTION_GENERATION_CONFIG.resultCountWeight) +
        contextBoost,
        DESCRIPTION_GENERATION_CONFIG.maxConfidence
      );
      
        logger.debug(`Using search results: description length=${description.length}, confidence=${confidence.toFixed(2)}, hasExtractedTerms=${hasExtractedTerms}, hasContext=${hasContext}, searchResults=${searchResults.length}, description preview="${description.substring(0, 50)}..."`, {
          finalDescription: description,
          searchResultsCount: searchResults.length,
          contextLength: extracted.context.length
        });
        
        // CRITICAL: If description is still empty or too short after all attempts, log warning
        if (!description || description.trim().length === 0) {
          logger.warn(`WARNING: Search results exist but description is empty for "${taskName}". Search results:`, searchResults.slice(0, 3));
        } else if (description.trim().length < 20) {
          logger.warn(`WARNING: Description is too short (${description.length} chars) for "${taskName}". Expected contextual description from search results.`, {
            description,
            searchResults: searchResults.slice(0, 3)
          });
        }
    } else {
      logger.debug(`No search results for "${taskName}", will use fallback`);
    }
  } catch (error) {
    logger.warn('DuckDuckGo Instant Answer API error, falling back to local terminology:', error);
  }

  // Fallback to local terminology ONLY if Instant Answer API didn't provide results
  // Don't fallback if we successfully used search results, even if description is minimal
  if (!usedSearchResults) {
    // Extract terms from task name using domain terminology
    const extracted = extractTermsFromTaskName(taskName, domainTerms);
    
    // Build description using domain-specific terminology
    const fallbackDescription = buildContextualDescription(
      taskName,
      extracted.keywords,
      extracted.phrases,
      extracted.verbs,
      extracted.nouns,
      extracted.pronouns,
      '', // No context from search
      domain,
      domainTerms
    );

    // Only use fallback if we got a valid description, otherwise keep the search-based one
    if (fallbackDescription && fallbackDescription.trim().length > 0) {
      description = fallbackDescription;
      
      // Calculate confidence based on keyword/verb matches
      confidence = Math.min(
        DESCRIPTION_GENERATION_CONFIG.baseConfidence + 
        (extracted.keywords.length * DESCRIPTION_GENERATION_CONFIG.fallbackKeywordWeight) + 
        (extracted.phrases.length * DESCRIPTION_GENERATION_CONFIG.phraseWeight) +
        (extracted.verbs.length * DESCRIPTION_GENERATION_CONFIG.fallbackVerbWeight) +
        (extracted.nouns.length * DESCRIPTION_GENERATION_CONFIG.nounWeight) +
        (extracted.pronouns.length * DESCRIPTION_GENERATION_CONFIG.pronounWeight),
        DESCRIPTION_GENERATION_CONFIG.fallbackMaxConfidence
      );
    } else if (!description || description.trim().length === 0) {
      // Ultimate fallback: create a basic description from task name
      description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${taskName.toLowerCase()}. ${DESCRIPTION_GENERATION_CONFIG.domainGuidance[domain]}`;
      confidence = DESCRIPTION_GENERATION_CONFIG.baseConfidence;
    }
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

  logger.debug(`Generated description for "${taskName}": domain=${domain}, confidence=${confidence.toFixed(2)}, usedSearch=${usedSearchResults}, descriptionLength=${finalDescription.length}, preview="${finalDescription.substring(0, 50)}..."`);
  
  // FINAL CHECK: If we used search results but got a fallback description, log warning
  if (usedSearchResults && finalDescription.includes(DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves)) {
    logger.warn(`WARNING: Used search results but got fallback description for "${taskName}". This indicates search results weren't properly utilized.`);
  }

  return {
    description: finalDescription,
    domain,
    confidence,
  };
}
