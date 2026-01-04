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
  
  // Extract phrases (2-5 word combinations)
  for (let i = 0; i < words.length - 1; i++) {
    for (let len = DESCRIPTION_GENERATION_CONFIG.minPhraseLength; 
         len <= DESCRIPTION_GENERATION_CONFIG.maxPhraseLength && i + len <= words.length; 
         len++) {
      const phrase = words.slice(i, i + len).join(' ');
      if (phrase.length > DESCRIPTION_GENERATION_CONFIG.minKeywordLength) {
        phrases.push(phrase);
      }
    }
  }
  
  // Remove duplicate phrases and sort by length (longer = more specific)
  const uniquePhrases = Array.from(new Set(phrases))
    .sort((a, b) => b.length - a.length)
    .slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPhrases);
  
  phrases.push(...uniquePhrases);
  
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
  const extractedFromAPI = extractTermsFromText(
    combinedText,
    DESCRIPTION_GENERATION_CONFIG.stopWords
  );
  
  // Add extracted terms (prioritize API results as they're context-specific)
  foundKeywords.push(...extractedFromAPI.keywords);
  foundPhrases.push(...extractedFromAPI.phrases);
  foundVerbs.push(...extractedFromAPI.verbs);
  foundNouns.push(...extractedFromAPI.nouns);
  
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
  searchResults.forEach(result => {
    const resultLower = result.toLowerCase();
    const hasPhrase = foundPhrases.some(phrase => resultLower.includes(phrase.toLowerCase()));
    const hasVerb = foundVerbs.some(v => resultLower.includes(v.toLowerCase()));
    const hasNoun = foundNouns.some(n => resultLower.includes(n.toLowerCase()));
    const hasKeyword = foundKeywords.some(kw => resultLower.includes(kw.toLowerCase()));
    
    if (hasPhrase || hasVerb || hasNoun || hasKeyword) {
      contextSnippets.push(result.substring(0, DESCRIPTION_GENERATION_CONFIG.maxSnippetLength));
    } else if (result.length > 0) {
      // Also include results that don't match terms but provide context
      contextSnippets.push(result.substring(0, DESCRIPTION_GENERATION_CONFIG.maxSnippetLength));
    }
  });
  
  return {
    keywords: Array.from(new Set(foundKeywords)).slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedKeywords),
    phrases: Array.from(new Set(foundPhrases)).slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPhrases),
    verbs: Array.from(new Set(foundVerbs)).slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedVerbs),
    nouns: Array.from(new Set(foundNouns)).slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedNouns),
    pronouns: Array.from(new Set(foundPronouns)).slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPronouns),
    context: contextSnippets.join(' ').substring(0, DESCRIPTION_GENERATION_CONFIG.maxContextLength),
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
    .filter(phrase => !taskWords.some(word => phrase.toLowerCase().includes(word) && word.length > 3));
  const uniqueKeywords = Array.from(new Set(keywords))
    .filter(kw => !taskWords.some(word => kw.toLowerCase() === word.toLowerCase()));
  const uniqueVerbs = Array.from(new Set(verbs))
    .filter(v => !taskWords.some(word => v.toLowerCase() === word.toLowerCase()));
  const uniqueNouns = Array.from(new Set(nouns))
    .filter(n => !taskWords.some(word => n.toLowerCase() === word.toLowerCase()));
  
  // Build description using found phrases, verbs (action words), nouns, and keywords
  // Prioritize phrases as they provide the most context
  if (uniquePhrases.length > 0) {
    const primaryPhrase = uniquePhrases[0];
    description = `This task involves ${primaryPhrase}`;
    
    // Add additional context from other phrases or keywords if available
    if (uniquePhrases.length > 1) {
      description += ` and ${uniquePhrases[1]}`;
    } else if (uniqueNouns.length > 0 && !primaryPhrase.toLowerCase().includes(uniqueNouns[0].toLowerCase())) {
      description += ` related to ${uniqueNouns[0]}`;
    } else if (uniqueKeywords.length > 0 && !primaryPhrase.toLowerCase().includes(uniqueKeywords[0].toLowerCase())) {
      description += ` focusing on ${uniqueKeywords[0]}`;
    }
  } else if (uniqueVerbs.length > 0) {
    // Use action words (verbs) if no phrases found
    const primaryVerb = uniqueVerbs[0];
    // Check if verb already ends in 'ing', 'ed', etc.
    const verbBase = primaryVerb.replace(/(ing|ed|s|es)$/, '');
    const verbForm = primaryVerb.endsWith('ing') ? primaryVerb : 
                     primaryVerb.endsWith('ed') ? primaryVerb :
                     `${verbBase}ing`;
    description = `This task involves ${verbForm}`;
    
    // Add nouns or keywords for object context
    if (uniqueNouns.length > 0) {
      description += ` ${uniqueNouns[0]}`;
    } else if (uniqueKeywords.length > 0) {
      description += ` ${uniqueKeywords[0]}`;
    } else {
      // Use task name if no other context available
      const taskNameLower = taskName.toLowerCase();
      description += ` ${taskNameLower}`;
    }
  } else if (uniqueNouns.length > 0) {
    // Use nouns if no phrases or verbs found
    description = `This task focuses on ${uniqueNouns[0]}`;
    
    if (uniqueNouns.length > 1) {
      description += ` and ${uniqueNouns[1]}`;
    } else if (uniqueKeywords.length > 0) {
      description += ` related to ${uniqueKeywords[0]}`;
    }
  } else if (uniqueKeywords.length > 0) {
    description = `This task focuses on ${uniqueKeywords[0]}`;
    if (uniqueKeywords.length > 1) {
      description += ` and ${uniqueKeywords[1]}`;
    }
  } else {
    description = `This task involves ${taskName.toLowerCase()}`;
  }
  
  // Add contextual information from Instant Answer API results if available
  if (context && context.length >= DESCRIPTION_GENERATION_CONFIG.minContextLength) {
    // Extract relevant sentences from context, prioritizing those with extracted terms
    const sentences = context.split(/[.!?]+/)
      .filter(s => s.trim().length >= DESCRIPTION_GENERATION_CONFIG.minSentenceLength)
      .map(s => s.trim());
    
    if (sentences.length > 0) {
      // Find sentence with most extracted terms
      let bestSentence = sentences[0];
      let maxMatches = 0;
      
      sentences.forEach(sentence => {
        const sentenceLower = sentence.toLowerCase();
        const matches = 
          (uniquePhrases.some(p => sentenceLower.includes(p.toLowerCase())) ? 2 : 0) +
          (uniqueKeywords.some(k => sentenceLower.includes(k.toLowerCase())) ? 1 : 0) +
          (uniqueVerbs.some(v => sentenceLower.includes(v.toLowerCase())) ? 1 : 0) +
          (uniqueNouns.some(n => sentenceLower.includes(n.toLowerCase())) ? 1 : 0);
        
        if (matches > maxMatches) {
          maxMatches = matches;
          bestSentence = sentence;
        }
      });
      
      if (bestSentence.length < DESCRIPTION_GENERATION_CONFIG.maxSentenceLength) {
        description += `. ${bestSentence}`;
      } else if (bestSentence.length > 0) {
        // Truncate if too long
        description += `. ${bestSentence.substring(0, DESCRIPTION_GENERATION_CONFIG.maxSentenceLength)}...`;
      }
    }
  }
  
  // Add domain-specific guidance based on scenarios
  const domainGuidance: Record<Domain, string> = {
    business: 'Apply professional standards, best practices, and ensure efficiency in execution.',
    home: 'Follow established home maintenance methods and organize your living space effectively.',
    personal: 'Take a thoughtful and personal approach, prioritizing your well-being and preferences.',
    world: 'Consider global perspectives, cultural contexts, and broader implications.',
    mixed: 'Balance multiple aspects and consider different perspectives.',
  };
  
  description += ` ${domainGuidance[domain]}`;
  
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
      
      // Build contextual description using search findings
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
      
      if (description) {
        usedSearchResults = true;
        
        // Calculate confidence for search-based results
        confidence = Math.min(
          DESCRIPTION_GENERATION_CONFIG.searchBaseConfidence + 
          (extracted.keywords.length * DESCRIPTION_GENERATION_CONFIG.keywordWeight) + 
          (extracted.phrases.length * DESCRIPTION_GENERATION_CONFIG.phraseWeight) +
          (extracted.verbs.length * DESCRIPTION_GENERATION_CONFIG.verbWeight) + 
          (extracted.nouns.length * DESCRIPTION_GENERATION_CONFIG.nounWeight) +
          (extracted.pronouns.length * DESCRIPTION_GENERATION_CONFIG.pronounWeight) +
          (searchResults.length * DESCRIPTION_GENERATION_CONFIG.resultCountWeight),
          DESCRIPTION_GENERATION_CONFIG.maxConfidence
        );
      }
    }
  } catch (error) {
    logger.debug('DuckDuckGo Instant Answer API error, falling back to local terminology:', error);
  }

  // Fallback to local terminology if Instant Answer API didn't provide good results
  if (!usedSearchResults || !description) {
    // Extract terms from task name using domain terminology
    const extracted = extractTermsFromTaskName(taskName, domainTerms);
    
    // Build description using domain-specific terminology
    description = buildContextualDescription(
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
  }

  logger.debug(`Generated description for "${taskName}": domain=${domain}, confidence=${confidence.toFixed(2)}, usedSearch=${usedSearchResults}`);

  return {
    description,
    domain,
    confidence,
  };
}
