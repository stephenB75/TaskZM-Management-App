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

export interface GeneratedDescription {
  description: string;
  domain: Domain;
  confidence: number;
}

/**
 * Search DuckDuckGo Instant Answer API for context about the task
 * Uses DuckDuckGo's Instant Answer API to get instant answers and related topics
 */
async function searchDuckDuckGoInstantAnswer(query: string): Promise<string[]> {
  try {
    const searchQuery = encodeURIComponent(query);
    // DuckDuckGo Instant Answer API endpoint
    const instantAnswerUrl = `${DUCKDUCKGO_CONFIG.instantAnswerApiUrl}?q=${searchQuery}&format=json&no_html=1&skip_disambig=1`;
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DESCRIPTION_GENERATION_CONFIG.searchTimeout);
    
    try {
      // Try to fetch from Instant Answer API
      // Note: This may fail due to CORS, but we'll handle it gracefully
      const response = await fetch(instantAnswerUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
        mode: 'cors',
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const results: string[] = [];

        // Extract Abstract text (most relevant instant answer)
        if (data.AbstractText && typeof data.AbstractText === 'string') {
          results.push(data.AbstractText);
        }

        // Extract Answer (direct answer)
        if (data.Answer && typeof data.Answer === 'string') {
          results.push(data.Answer);
        }

        // Extract RelatedTopics
        if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
          data.RelatedTopics.slice(0, DUCKDUCKGO_CONFIG.maxResults - results.length).forEach((topic: any) => {
            if (topic.Text && typeof topic.Text === 'string') {
              results.push(topic.Text);
            }
          });
        }

        // Extract Results
        if (data.Results && Array.isArray(data.Results)) {
          const remainingSlots = DUCKDUCKGO_CONFIG.maxResults - results.length;
          data.Results.slice(0, remainingSlots).forEach((result: any) => {
            if (result.Text && typeof result.Text === 'string') {
              results.push(result.Text);
            }
          });
        }

        if (results.length >= DESCRIPTION_GENERATION_CONFIG.minSearchResults) {
          logger.debug(`DuckDuckGo Instant Answer API successful: ${results.length} results for "${query}"`);
          return results;
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        logger.debug('DuckDuckGo Instant Answer API timeout:', query);
      } else if (error instanceof TypeError && (error.message.includes('CORS') || error.message.includes('Failed to fetch'))) {
        // CORS error - DuckDuckGo Instant Answer API may not support direct browser requests
        // This is expected and will fall back to local terminology
        logger.debug('DuckDuckGo Instant Answer API CORS error (expected, will use local terminology):', query);
      } else {
        logger.debug('DuckDuckGo Instant Answer API failed:', error);
      }
    }

    // Return empty array if search failed
    return [];
  } catch (error) {
    // Catch any other errors (including CORS errors that might not be caught above)
    if (error instanceof TypeError && (error.message.includes('CORS') || error.message.includes('Failed to fetch'))) {
      logger.debug('DuckDuckGo Instant Answer API CORS error (expected, will use local terminology):', query);
    } else {
      logger.debug('DuckDuckGo Instant Answer API error:', error);
    }
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
  domainTerms: ReturnType<typeof getDomainTerminology>
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
    const searchPromises = queriesToSearch.map(query => searchDuckDuckGoInstantAnswer(query));
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
 * Extract phrases, verbs (action words), nouns, pronouns, and keywords from search results using browser AI
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
  
  // Find matching phrases from domain terminology (check first as they're most specific)
  domainTerms.phrases.forEach(phrase => {
    if (combinedText.includes(phrase.toLowerCase())) {
      foundPhrases.push(phrase);
    }
  });
  
  // Find matching verbs (action words) from domain terminology
  domainTerms.verbs.forEach(verb => {
    const verbLower = verb.toLowerCase();
    // Check for verb in various forms (verb, verb+ing, verb+ed, etc.)
    if (combinedText.includes(verbLower) || 
        combinedText.includes(`${verbLower}ing`) ||
        combinedText.includes(`${verbLower}ed`) ||
        combinedText.includes(`${verbLower}s`)) {
      foundVerbs.push(verb);
    }
  });
  
  // Find matching nouns from domain terminology
  domainTerms.nouns.forEach(noun => {
    const nounLower = noun.toLowerCase();
    if (combinedText.includes(nounLower) || 
        combinedText.includes(`${nounLower}s`) ||
        combinedText.includes(`${nounLower}es`)) {
      foundNouns.push(noun);
    }
  });
  
  // Find matching pronouns from domain terminology
  domainTerms.pronouns.forEach(pronoun => {
    if (combinedText.includes(pronoun.toLowerCase())) {
      foundPronouns.push(pronoun);
    }
  });
  
  // Find matching keywords from domain terminology
  domainTerms.keywords.forEach(keyword => {
    if (combinedText.includes(keyword.toLowerCase())) {
      foundKeywords.push(keyword);
    }
  });
  
  // Extract relevant context snippets based on found terms
  searchResults.forEach(result => {
    const resultLower = result.toLowerCase();
    const hasPhrase = foundPhrases.some(phrase => resultLower.includes(phrase.toLowerCase()));
    const hasVerb = foundVerbs.some(v => resultLower.includes(v.toLowerCase()));
    const hasNoun = foundNouns.some(n => resultLower.includes(n.toLowerCase()));
    const hasKeyword = foundKeywords.some(kw => resultLower.includes(kw.toLowerCase()));
    
    if (hasPhrase || hasVerb || hasNoun || hasKeyword) {
      contextSnippets.push(result.substring(0, DESCRIPTION_GENERATION_CONFIG.maxSnippetLength));
    }
  });
  
  return {
    keywords: foundKeywords.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedKeywords),
    phrases: foundPhrases.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPhrases),
    verbs: foundVerbs.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedVerbs),
    nouns: foundNouns.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedNouns),
    pronouns: foundPronouns.slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPronouns),
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
  
  // Build description using found phrases, verbs (action words), nouns, and keywords
  // Prioritize phrases as they provide the most context
  if (phrases.length > 0) {
    const primaryPhrase = phrases[0];
    description = `This task involves ${primaryPhrase}`;
    
    // Add nouns or keywords for additional context
    if (nouns.length > 0) {
      description += ` related to ${nouns.slice(0, DESCRIPTION_GENERATION_CONFIG.maxDisplayItemsSingle).join(' and ')}`;
    } else if (keywords.length > 0) {
      description += ` focusing on ${keywords.slice(0, DESCRIPTION_GENERATION_CONFIG.maxDisplayItemsSingle).join(' and ')}`;
    }
  } else if (verbs.length > 0) {
    // Use action words (verbs) if no phrases found
    const primaryVerb = verbs[0];
    description = `This task involves ${primaryVerb}ing`;
    
    // Add nouns for object context
    if (nouns.length > 0) {
      description += ` ${nouns.slice(0, DESCRIPTION_GENERATION_CONFIG.maxDisplayItemsSingle).join(' and ')}`;
    } else if (keywords.length > 0) {
      description += ` ${keywords.slice(0, DESCRIPTION_GENERATION_CONFIG.maxDisplayItemsSingle).join(' and ')}`;
    } else {
      description += ` ${taskName.toLowerCase()}`;
    }
  } else if (nouns.length > 0) {
    // Use nouns if no phrases or verbs found
    description = `This task focuses on ${nouns.slice(0, DESCRIPTION_GENERATION_CONFIG.maxDisplayItemsPair).join(' and ')}`;
    
    if (keywords.length > 0) {
      description += ` related to ${keywords.slice(0, DESCRIPTION_GENERATION_CONFIG.maxDisplayItemsSingle).join(' and ')}`;
    }
  } else if (keywords.length > 0) {
    description = `This task focuses on ${keywords.slice(0, DESCRIPTION_GENERATION_CONFIG.maxDisplayItemsPair).join(' and ')}`;
  } else {
    description = `This task involves ${taskName.toLowerCase()}`;
  }
  
  // Add contextual information from Instant Answer API results if available
  if (context && context.length >= DESCRIPTION_GENERATION_CONFIG.minContextLength) {
    // Extract a relevant sentence from context
    const sentences = context.split(/[.!?]+/).filter(s => s.trim().length >= DESCRIPTION_GENERATION_CONFIG.minSentenceLength);
    if (sentences.length > 0) {
      const relevantSentence = sentences[0].trim();
      if (relevantSentence.length < DESCRIPTION_GENERATION_CONFIG.maxSentenceLength) {
        description += `. ${relevantSentence}`;
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
export async function generateDescription(taskName: string): Promise<GeneratedDescription> {
  if (!taskName || taskName.trim().length === 0) {
    return {
      description: '',
      domain: 'personal',
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
    const searchResults = await searchDomainContext(taskName, domain, domainTerms);
    
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
