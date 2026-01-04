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
  const topKeywords = domainTerms.keywords.slice(0, DESCRIPTION_GENERATION_CONFIG.maxTopKeywords).filter(kw => 
    taskWords.some(word => kw.toLowerCase().includes(word) || word.includes(kw.toLowerCase()))
  );
  const topPhrases = domainTerms.phrases.slice(0, DESCRIPTION_GENERATION_CONFIG.maxTopPhrases).filter(phrase => 
    taskWords.some(word => phrase.toLowerCase().includes(word) || word.includes(phrase.toLowerCase()))
  );
  const topVerbs = domainTerms.verbs.slice(0, DESCRIPTION_GENERATION_CONFIG.maxTopVerbs).filter(v => 
    taskWords.some(word => v.toLowerCase().includes(word) || word.includes(v.toLowerCase()))
  );
  const topNouns = domainTerms.nouns.slice(0, DESCRIPTION_GENERATION_CONFIG.maxTopNouns).filter(noun => 
    taskWords.some(word => noun.toLowerCase().includes(word) || word.includes(noun.toLowerCase()))
  );
  
  // Add queries with phrases (action phrases)
  if (topPhrases.length > 0) {
    searchQueries.push(`${taskName} ${topPhrases[0]}`);
  }
  
  // Add queries with verbs (action words)
  if (topVerbs.length > 0) {
    searchQueries.push(`${topVerbs[0]} ${taskName}`);
    if (topVerbs.length > 1) {
      searchQueries.push(`${taskName} ${topVerbs[1]}`);
    }
  }
  
  // Add queries with nouns
  if (topNouns.length > 0) {
    searchQueries.push(`${taskName} ${topNouns[0]}`);
  }
  
  // Add queries with keywords
  if (topKeywords.length > 0) {
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
 * Extract phrases, verbs (action words), nouns, pronouns, and keywords from search results using browser AI
 * Extracts terms directly from API results AND matches against domain terminology
 */
function extractKeywordsAndVerbsFromSearch(
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
  const foundKeywords: string[] = [];
  const foundPhrases: string[] = [];
  const foundVerbs: string[] = [];
  const foundNouns: string[] = [];
  const foundPronouns: string[] = [];
  const contextSnippets: string[] = [];
  
  const combinedText = searchResults.join(' ').toLowerCase();
  
  // STEP 1: Extract terms directly from Instant Answer API results
  // Process each search result individually to preserve context and extract better phrases
  searchResults.forEach(result => {
    const extractedFromResult = extractTermsFromText(
      result,
      DESCRIPTION_GENERATION_CONFIG.stopWords
    );
    
    // Add extracted terms from this result
    foundKeywords.push(...extractedFromResult.keywords);
    foundPhrases.push(...extractedFromResult.phrases);
    foundVerbs.push(...extractedFromResult.verbs);
    foundNouns.push(...extractedFromResult.nouns);
  });
  
  // Also extract from combined text to catch cross-result patterns
  const extractedFromCombined = extractTermsFromText(
    combinedText,
    DESCRIPTION_GENERATION_CONFIG.stopWords
  );
  
  // Merge with individual results (avoid duplicates)
  extractedFromCombined.keywords.forEach(kw => {
    if (!foundKeywords.some(k => k.toLowerCase() === kw.toLowerCase())) {
      foundKeywords.push(kw);
    }
  });
  extractedFromCombined.phrases.forEach(phrase => {
    if (!foundPhrases.some(p => p.toLowerCase() === phrase.toLowerCase())) {
      foundPhrases.push(phrase);
    }
  });
  extractedFromCombined.verbs.forEach(verb => {
    if (!foundVerbs.some(v => v.toLowerCase() === verb.toLowerCase())) {
      foundVerbs.push(verb);
    }
  });
  extractedFromCombined.nouns.forEach(noun => {
    if (!foundNouns.some(n => n.toLowerCase() === noun.toLowerCase())) {
      foundNouns.push(noun);
    }
  });
  
  // STEP 2: Find matching terms from domain terminology (for domain-specific context)
  domainTerms.phrases.forEach(phrase => {
    if (combinedText.includes(phrase.toLowerCase()) && !foundPhrases.includes(phrase)) {
      foundPhrases.push(phrase);
    }
  });
  
  domainTerms.verbs.forEach(verb => {
    const verbLower = verb.toLowerCase();
    if ((combinedText.includes(verbLower) || 
         combinedText.includes(`${verbLower}ing`) ||
         combinedText.includes(`${verbLower}ed`) ||
         combinedText.includes(`${verbLower}s`)) &&
        !foundVerbs.some(v => v.toLowerCase() === verbLower)) {
      foundVerbs.push(verb);
    }
  });
  
  domainTerms.nouns.forEach(noun => {
    const nounLower = noun.toLowerCase();
    if ((combinedText.includes(nounLower) || 
         combinedText.includes(`${nounLower}s`) ||
         combinedText.includes(`${nounLower}es`)) &&
        !foundNouns.some(n => n.toLowerCase() === nounLower)) {
      foundNouns.push(noun);
    }
  });
  
  domainTerms.pronouns.forEach(pronoun => {
    if (combinedText.includes(pronoun.toLowerCase()) && !foundPronouns.includes(pronoun)) {
      foundPronouns.push(pronoun);
    }
  });
  
  domainTerms.keywords.forEach(keyword => {
    if (combinedText.includes(keyword.toLowerCase()) && !foundKeywords.includes(keyword)) {
      foundKeywords.push(keyword);
    }
  });
  
  // STEP 3: Extract relevant context snippets based on found terms
  // Prioritize results with extracted terms, but include all results for context
  searchResults.forEach(result => {
    if (result && result.length > 0) {
      const resultLower = result.toLowerCase();
      const hasPhrase = foundPhrases.some(phrase => resultLower.includes(phrase.toLowerCase()));
      const hasVerb = foundVerbs.some(v => resultLower.includes(v.toLowerCase()));
      const hasNoun = foundNouns.some(n => resultLower.includes(n.toLowerCase()));
      const hasKeyword = foundKeywords.some(kw => resultLower.includes(kw.toLowerCase()));
      
      // Always include results - prioritize those with extracted terms
      if (hasPhrase || hasVerb || hasNoun || hasKeyword) {
        // Results with extracted terms get full snippet length
        contextSnippets.push(result.substring(0, DESCRIPTION_GENERATION_CONFIG.maxSnippetLength));
      } else {
        // Results without extracted terms still provide valuable context
        // Use a slightly shorter snippet to prioritize term-matched results
        contextSnippets.push(result.substring(0, Math.min(DESCRIPTION_GENERATION_CONFIG.maxSnippetLength, result.length)));
      }
    }
  });
  
  // Ensure we always have context from search results, even if no terms were extracted
  // If contextSnippets is empty but we have search results, use them directly
  let finalContext = contextSnippets.join(' ').substring(0, DESCRIPTION_GENERATION_CONFIG.maxContextLength);
  
  if (!finalContext || finalContext.trim().length === 0) {
    // Fallback: use search results directly as context
    finalContext = searchResults
      .slice(0, 3) // Use first 3 results
      .map(r => r && r.length > 0 ? r.substring(0, DESCRIPTION_GENERATION_CONFIG.maxSnippetLength) : '')
      .filter(r => r.length > 0)
      .join(' ')
      .substring(0, DESCRIPTION_GENERATION_CONFIG.maxContextLength);
  }
  
  return {
    keywords: Array.from(new Set(foundKeywords)).slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedKeywords),
    phrases: Array.from(new Set(foundPhrases)).slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPhrases),
    verbs: Array.from(new Set(foundVerbs)).slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedVerbs),
    nouns: Array.from(new Set(foundNouns)).slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedNouns),
    pronouns: Array.from(new Set(foundPronouns)).slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPronouns),
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
 * Build contextual description using extracted phrases, verbs (action words), nouns, pronouns, keywords, and search context
 * Creates a comprehensive description based on DuckDuckGo Instant Answer API findings or local terminology
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
  
  // Remove duplicates and filter out terms that are too similar to task name
  const taskWords = taskName.toLowerCase().split(/\s+/);
  const uniquePhrases = Array.from(new Set(phrases))
    .filter(phrase => !taskWords.some(word => phrase.toLowerCase().includes(word) && word.length > DESCRIPTION_GENERATION_CONFIG.minWordLengthForFiltering));
  const uniqueKeywords = Array.from(new Set(keywords))
    .filter(kw => !taskWords.some(word => kw.toLowerCase() === word.toLowerCase()));
  const uniqueVerbs = Array.from(new Set(verbs))
    .filter(v => !taskWords.some(word => v.toLowerCase() === word.toLowerCase()));
  const uniqueNouns = Array.from(new Set(nouns))
    .filter(n => !taskWords.some(word => n.toLowerCase() === word.toLowerCase()));
  
  // Build description by combining keywords and phrases intelligently
  // Strategy: Use phrases + keywords together to create richer context
  
  // Combine phrases and keywords for richer descriptions
  const combinedTerms: Array<{ type: 'phrase' | 'keyword' | 'verb' | 'noun'; value: string; priority: number }> = [];
  
  // Add phrases with highest priority (most specific)
  uniquePhrases.forEach((phrase, index) => {
    combinedTerms.push({ type: 'phrase', value: phrase, priority: DESCRIPTION_GENERATION_CONFIG.termPriority.phrase - index });
  });
  
  // Add keywords with medium-high priority
  uniqueKeywords.forEach((keyword, index) => {
    combinedTerms.push({ type: 'keyword', value: keyword, priority: DESCRIPTION_GENERATION_CONFIG.termPriority.keyword - index });
  });
  
  // Add verbs with medium priority
  uniqueVerbs.forEach((verb, index) => {
    combinedTerms.push({ type: 'verb', value: verb, priority: DESCRIPTION_GENERATION_CONFIG.termPriority.verb - index });
  });
  
  // Add nouns with lower priority
  uniqueNouns.forEach((noun, index) => {
    combinedTerms.push({ type: 'noun', value: noun, priority: DESCRIPTION_GENERATION_CONFIG.termPriority.noun - index });
  });
  
  // Sort by priority (highest first)
  combinedTerms.sort((a, b) => b.priority - a.priority);
  
  // Build description using combined terms
  if (combinedTerms.length > 0) {
    const primaryTerm = combinedTerms[0];
    let primaryValue = primaryTerm.value;
    
    // Format verbs properly
    if (primaryTerm.type === 'verb') {
      const verbBase = primaryValue.replace(/(ing|ed|s|es)$/, '');
      primaryValue = primaryValue.endsWith('ing') ? primaryValue : 
                     primaryValue.endsWith('ed') ? primaryValue :
                     `${verbBase}ing`;
    }
    
    description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${primaryValue}`;
    
    // Add secondary terms (combine up to maxSecondaryTerms for richer context)
    const secondaryTerms = combinedTerms.slice(1, DESCRIPTION_GENERATION_CONFIG.maxSecondaryTerms).filter(term => {
      // Avoid duplicates and terms already included in primary
      const primaryLower = primaryValue.toLowerCase();
      const termLower = term.value.toLowerCase();
      return !primaryLower.includes(termLower) && !termLower.includes(primaryLower);
    });
    
    if (secondaryTerms.length > 0) {
      // Combine secondary terms intelligently
      const termValues = secondaryTerms.map(term => {
        if (term.type === 'verb') {
          const verbBase = term.value.replace(/(ing|ed|s|es)$/, '');
          return term.value.endsWith('ing') ? term.value : 
                 term.value.endsWith('ed') ? term.value :
                 `${verbBase}ing`;
        }
        return term.value;
      });
      
      if (termValues.length === 1) {
        description += `${DESCRIPTION_GENERATION_CONFIG.descriptionSeparators.comma}${termValues[0]}`;
      } else if (termValues.length === 2) {
        description += `${DESCRIPTION_GENERATION_CONFIG.descriptionSeparators.comma}${termValues[0]}${DESCRIPTION_GENERATION_CONFIG.descriptionSeparators.commaAnd}${termValues[1]}`;
      } else {
        description += `${DESCRIPTION_GENERATION_CONFIG.descriptionSeparators.comma}${termValues.slice(0, -1).join(DESCRIPTION_GENERATION_CONFIG.descriptionSeparators.comma)}${DESCRIPTION_GENERATION_CONFIG.descriptionSeparators.commaAnd}${termValues[termValues.length - 1]}`;
      }
    }
  } else {
    // Fallback if no terms found
    description = `${DESCRIPTION_GENERATION_CONFIG.descriptionTemplates.involves} ${taskName.toLowerCase()}`;
  }
  
  // Add contextual information from Instant Answer API results if available
  // Use context to enhance description with actual information from search results
  if (context && context.length >= DESCRIPTION_GENERATION_CONFIG.minContextLength) {
    // Extract relevant sentences from context, prioritizing those with extracted terms
    const sentences = context.split(/[.!?]+/)
      .filter(s => s.trim().length >= DESCRIPTION_GENERATION_CONFIG.minSentenceLength)
      .map(s => s.trim());
    
    if (sentences.length > 0) {
      // Score sentences based on how many extracted terms they contain
      const scoredSentences = sentences.map(sentence => {
        const sentenceLower = sentence.toLowerCase();
        let score = 0;
        
        // Check for phrases (highest weight)
        uniquePhrases.forEach(phrase => {
          if (sentenceLower.includes(phrase.toLowerCase())) {
            score += DESCRIPTION_GENERATION_CONFIG.sentenceScoring.phraseWeight;
          }
        });
        
        // Check for keywords
        uniqueKeywords.forEach(keyword => {
          if (sentenceLower.includes(keyword.toLowerCase())) {
            score += DESCRIPTION_GENERATION_CONFIG.sentenceScoring.keywordWeight;
          }
        });
        
        // Check for verbs
        uniqueVerbs.forEach(verb => {
          if (sentenceLower.includes(verb.toLowerCase())) {
            score += DESCRIPTION_GENERATION_CONFIG.sentenceScoring.verbWeight;
          }
        });
        
        // Check for nouns
        uniqueNouns.forEach(noun => {
          if (sentenceLower.includes(noun.toLowerCase())) {
            score += DESCRIPTION_GENERATION_CONFIG.sentenceScoring.nounWeight;
          }
        });
        
        return { sentence, score };
      });
      
      // Sort by score and get best sentence
      scoredSentences.sort((a, b) => b.score - a.score);
      const bestSentence = scoredSentences[0]?.sentence || sentences[0];
      
      if (bestSentence && bestSentence.length > 0) {
        if (bestSentence.length < DESCRIPTION_GENERATION_CONFIG.maxSentenceLength) {
          description += `${DESCRIPTION_GENERATION_CONFIG.descriptionSeparators.period}${bestSentence}`;
        } else {
          // Truncate if too long, but try to end at a word boundary
          const truncated = bestSentence.substring(0, DESCRIPTION_GENERATION_CONFIG.maxSentenceLength);
          const lastSpace = truncated.lastIndexOf(' ');
          const threshold = DESCRIPTION_GENERATION_CONFIG.maxSentenceLength * DESCRIPTION_GENERATION_CONFIG.truncationThreshold;
          if (lastSpace > threshold) {
            description += `${DESCRIPTION_GENERATION_CONFIG.descriptionSeparators.period}${truncated.substring(0, lastSpace)}${DESCRIPTION_GENERATION_CONFIG.descriptionSeparators.ellipsis}`;
          } else {
            description += `${DESCRIPTION_GENERATION_CONFIG.descriptionSeparators.period}${truncated}${DESCRIPTION_GENERATION_CONFIG.descriptionSeparators.ellipsis}`;
          }
        }
      }
    }
  }
  
  // Add domain-specific guidance based on scenarios
  description += ` ${DESCRIPTION_GENERATION_CONFIG.domainGuidance[domain]}`;
  
  return description;
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
      // Extract phrases, verbs (action words), nouns, pronouns, and keywords from search results using browser AI
      const extracted = extractKeywordsAndVerbsFromSearch(searchResults, domainTerms);
      
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
