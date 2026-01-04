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

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        
        if (data.success && Array.isArray(data.results)) {
          const results = data.results.filter((r: any): r is string => typeof r === 'string' && r.length > 0);
          
          if (results.length >= DESCRIPTION_GENERATION_CONFIG.minSearchResults) {
            logger.debug(`DuckDuckGo Instant Answer API successful (via Supabase proxy): ${results.length} results for "${query}"`);
            return results;
          }
        }
      } else {
        // If proxy returns error, log it but don't throw - fall back to local terminology
        const errorData = await response.json().catch(() => ({}));
        logger.debug('DuckDuckGo proxy API error:', errorData);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        logger.debug('DuckDuckGo proxy API timeout:', query);
      } else {
        logger.debug('DuckDuckGo proxy API failed:', error);
      }
    }

    // Return empty array if search failed (will fall back to local terminology)
    return [];
  } catch (error) {
    logger.debug('DuckDuckGo proxy API error:', error);
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
  const topKeywords = domainTerms.keywords.slice(0, DESCRIPTION_GENERATION_CONFIG.maxTopKeywords * 2);
  const topPhrases = domainTerms.phrases.slice(0, DESCRIPTION_GENERATION_CONFIG.maxTopPhrases * 2);
  const topVerbs = domainTerms.verbs.slice(0, DESCRIPTION_GENERATION_CONFIG.maxTopVerbs * 2);
  const topNouns = domainTerms.nouns.slice(0, DESCRIPTION_GENERATION_CONFIG.maxTopNouns * 2);
  
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
    
    resultsArray.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        allResults.push(...result.value);
        logger.debug(`DuckDuckGo Instant Answer API search ${index + 1} successful: "${queriesToSearch[index]}"`);
      }
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
  // Prioritize sentences that contain both keywords and found phrases
  const contextSnippets: string[] = [];
  
  searchResults.forEach(result => {
    if (result && result.length > 0) {
      const resultLower = result.toLowerCase();
      
      // Check if result contains keywords
      const hasKeywords = taskKeywords.some(kw => resultLower.includes(kw.toLowerCase()));
      // Check if result contains found phrases
      const hasPhrases = foundPhrases.some(phrase => resultLower.includes(phrase.toLowerCase()));
      
      // Prioritize results with both keywords and phrases
      if (hasKeywords && hasPhrases) {
        contextSnippets.push(result.substring(0, DESCRIPTION_GENERATION_CONFIG.maxSnippetLength));
      } else if (hasKeywords || hasPhrases) {
        contextSnippets.push(result.substring(0, Math.min(DESCRIPTION_GENERATION_CONFIG.maxSnippetLength, result.length)));
      }
    }
  });
  
  // If no context snippets found, use all search results
  let finalContext = contextSnippets.length > 0
    ? contextSnippets.join(' ').substring(0, DESCRIPTION_GENERATION_CONFIG.maxContextLength)
    : searchResults
        .slice(0, 3)
        .map(r => r && r.length > 0 ? r.substring(0, DESCRIPTION_GENERATION_CONFIG.maxSnippetLength) : '')
        .filter(r => r.length > 0)
        .join(' ')
        .substring(0, DESCRIPTION_GENERATION_CONFIG.maxContextLength);
  
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
  // This creates a natural description like "Take family pet for a walk to get their daily exercise"
  if (context && context.length >= DESCRIPTION_GENERATION_CONFIG.minContextLength) {
    const sentences = context.split(/[.!?]+/)
      .filter(s => s.trim().length >= DESCRIPTION_GENERATION_CONFIG.minSentenceLength)
      .map(s => s.trim());
    
    if (sentences.length > 0) {
      // Score sentences based on how many keywords and phrases they contain
      const scoredSentences = sentences.map(sentence => {
        const sentenceLower = sentence.toLowerCase();
        let score = 0;
        
        // Check for keywords (essential - must have at least one)
        const keywordCount = keywords.filter(kw => sentenceLower.includes(kw.toLowerCase())).length;
        if (keywordCount === 0) {
          return { sentence, score: 0 }; // No keywords = not relevant
        }
        score += keywordCount * DESCRIPTION_GENERATION_CONFIG.sentenceScoring.keywordWeight;
        
        // Check for phrases (high value)
        const phraseCount = relevantPhrases.filter(phrase => sentenceLower.includes(phrase.toLowerCase())).length;
        score += phraseCount * DESCRIPTION_GENERATION_CONFIG.sentenceScoring.phraseWeight;
        
        // Check for verbs and nouns (additional context)
        const verbCount = verbs.filter(v => {
          const vLower = v.toLowerCase();
          const vBase = vLower.replace(/(ing|ed|s|es)$/, '');
          return sentenceLower.includes(vLower) || sentenceLower.includes(vBase);
        }).length;
        score += verbCount * DESCRIPTION_GENERATION_CONFIG.sentenceScoring.verbWeight;
        
        const nounCount = nouns.filter(n => sentenceLower.includes(n.toLowerCase())).length;
        score += nounCount * DESCRIPTION_GENERATION_CONFIG.sentenceScoring.nounWeight;
        
        return { sentence, score };
      });
      
      // Get the best sentence (highest score)
      scoredSentences.sort((a, b) => b.score - a.score);
      const bestSentence = scoredSentences.find(s => s.score > 0)?.sentence || sentences[0];
      
      if (bestSentence && bestSentence.length > 0) {
        // Use the sentence directly as description (more natural)
        if (bestSentence.length < DESCRIPTION_GENERATION_CONFIG.maxSentenceLength) {
          description = bestSentence;
        } else {
          // Truncate if too long
          const truncated = bestSentence.substring(0, DESCRIPTION_GENERATION_CONFIG.maxSentenceLength);
          const lastSpace = truncated.lastIndexOf(' ');
          const threshold = DESCRIPTION_GENERATION_CONFIG.maxSentenceLength * DESCRIPTION_GENERATION_CONFIG.truncationThreshold;
          description = lastSpace > threshold 
            ? truncated.substring(0, lastSpace) + DESCRIPTION_GENERATION_CONFIG.descriptionSeparators.ellipsis
            : truncated + DESCRIPTION_GENERATION_CONFIG.descriptionSeparators.ellipsis;
        }
      }
    }
  }
  
  // STEP 2: If no good sentence found, construct description from keywords and phrases
  if (!description || description.trim().length === 0) {
    if (relevantPhrases.length > 0 && keywords.length > 0) {
      // Use first phrase that contains keywords
      const bestPhrase = relevantPhrases[0];
      description = bestPhrase;
    } else if (keywords.length > 0) {
      // Fallback: use keywords to create simple description
      const primaryKeyword = keywords[0];
      description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${primaryKeyword}`;
      if (keywords.length > 1) {
        description += `${DESCRIPTION_GENERATION_CONFIG.descriptionSeparators.comma}${keywords.slice(1).join(DESCRIPTION_GENERATION_CONFIG.descriptionSeparators.comma)}`;
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
    const searchResults = await searchDomainContext(taskName, domain, domainTerms, accessToken);
    
    if (searchResults.length > 0) {
      // Extract keywords from task name, find phrases using keywords, and build context from search results
      const extracted = extractKeywordsAndVerbsFromSearch(taskName, searchResults, domainTerms);
      
      logger.debug(`DuckDuckGo search results: ${searchResults.length} results, extracted: ${extracted.keywords.length} keywords, ${extracted.phrases.length} phrases, ${extracted.verbs.length} verbs, ${extracted.nouns.length} nouns, context length: ${extracted.context.length}`);
      
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
      
      // ALWAYS mark as using search results if we have any search results
      // This ensures we prioritize search-based descriptions over local terminology
      // Even if extracted terms are minimal, the search results provide valuable context
      if (searchResults.length > 0) {
        usedSearchResults = true;
        
        // Calculate confidence for search-based results
        // Boost confidence if we have context even if extracted terms are limited
        const hasExtractedTerms = extracted.keywords.length > 0 || extracted.phrases.length > 0 || 
                                  extracted.verbs.length > 0 || extracted.nouns.length > 0;
        const hasContext = extracted.context.length > 0;
        const contextBoost = extracted.context.length > DESCRIPTION_GENERATION_CONFIG.minContextLength ? 0.1 : 0;
        
        // If we have search results but no extracted context, use search results directly as context
        if (!hasContext && searchResults.length > 0) {
          // Use first few search results as context
          const directContext = searchResults
            .slice(0, 3)
            .map(r => r.substring(0, DESCRIPTION_GENERATION_CONFIG.maxSnippetLength))
            .join(' ');
          
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
        }
        
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
        
        logger.debug(`Using search results: description length=${description.length}, confidence=${confidence.toFixed(2)}, hasExtractedTerms=${hasExtractedTerms}, hasContext=${hasContext}, searchResults=${searchResults.length}`);
      }
    }
  } catch (error) {
    logger.debug('DuckDuckGo Instant Answer API error, falling back to local terminology:', error);
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

  logger.debug(`Generated description for "${taskName}": domain=${domain}, confidence=${confidence.toFixed(2)}, usedSearch=${usedSearchResults}, descriptionLength=${description.length}`);

  return {
    description: description.trim(),
    domain,
    confidence,
  };
}
