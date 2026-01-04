/**
 * Description Generator
 * 
 * Generates task descriptions based on task name using DuckDuckGo search + browser AI
 * with domain-specific terminology, keywords, verbs, and action words.
 */

import { detectDomain, type Domain, getDomainTerminology } from './domain-terminology';
import { TASK_BREAKDOWN_DEBOUNCE_MS, DUCKDUCKGO_CONFIG, DESCRIPTION_GENERATION_CONFIG } from './ai-config';
import { logger } from './logger';
import { supabase } from './supabase-client';

/**
 * Hash query for cache key (simple hash function)
 */
function hashQuery(query: string): string {
  let hash = 0;
  const normalizedQuery = query.toLowerCase().trim();
  for (let i = 0; i < normalizedQuery.length; i++) {
    const char = normalizedQuery.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Get current user ID from Supabase auth
 */
async function getCurrentUserId(): Promise<string | null> {
  try {
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  } catch (error) {
    logger.debug('Failed to get user ID:', error);
    return null;
  }
}

/**
 * Database cache entry interface
 */
interface DatabaseCacheEntry {
  results: string[];
  extracted_keywords: string[];
  extracted_phrases: string[];
  extracted_verbs: string[];
  extracted_nouns: string[];
  extracted_pronouns: string[];
  domain: string | null;
  confidence: number | null;
}

/**
 * Get cached search results from Supabase database
 */
async function getCachedResultsFromDatabase(
  query: string
): Promise<DatabaseCacheEntry | null> {
  if (!DUCKDUCKGO_CONFIG.cacheEnabled || !supabase) return null;
  
  try {
    const queryHash = hashQuery(query);
    const userId = await getCurrentUserId();
    
    // Query cache: user-specific first, then global (user_id IS NULL)
    const { data, error } = await supabase
      .from('duckduckgo_search_cache')
      .select('results, extracted_keywords, extracted_phrases, extracted_verbs, extracted_nouns, extracted_pronouns, domain, confidence, expires_at, hit_count')
      .eq('query_hash', queryHash)
      .or(`user_id.eq.${userId || 'null'},user_id.is.null`)
      .order('user_id', { ascending: false, nullsFirst: false }) // Prefer user-specific over global
      .limit(DESCRIPTION_GENERATION_CONFIG.cacheQueryLimit)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    // Check if cache entry is expired
    const expiresAt = new Date(data.expires_at);
    if (expiresAt < new Date()) {
      // Delete expired entry
      await supabase
        .from('duckduckgo_search_cache')
        .delete()
        .eq('query_hash', queryHash)
        .or(`user_id.eq.${userId || 'null'},user_id.is.null`);
      return null;
    }
    
    // Update hit count
    const newHitCount = (data.hit_count || DESCRIPTION_GENERATION_CONFIG.defaultHitCount) + 1;
    await supabase
      .from('duckduckgo_search_cache')
      .update({ hit_count: newHitCount })
      .eq('query_hash', queryHash)
      .or(`user_id.eq.${userId || 'null'},user_id.is.null`);
    
    logger.debug(`DuckDuckGo database cache hit: "${query}" (hit count: ${newHitCount})`);
    
    return {
      results: data.results || [],
      extracted_keywords: data.extracted_keywords || [],
      extracted_phrases: data.extracted_phrases || [],
      extracted_verbs: data.extracted_verbs || [],
      extracted_nouns: data.extracted_nouns || [],
      extracted_pronouns: data.extracted_pronouns || [],
      domain: data.domain || null,
      confidence: data.confidence || null,
    };
  } catch (error) {
    logger.debug('Failed to get cached results from database:', error);
    return null;
  }
}

/**
 * Store search results in Supabase database
 */
async function setCachedResultsInDatabase(
  query: string,
  results: string[],
  extracted: {
    keywords: string[];
    phrases: string[];
    verbs: string[];
    nouns: string[];
    pronouns: string[];
  },
  domain: Domain,
  confidence: number
): Promise<void> {
  if (!DUCKDUCKGO_CONFIG.cacheEnabled || !supabase || results.length === 0) return;
  
  try {
    const queryHash = hashQuery(query);
    const userId = await getCurrentUserId();
    
    // Calculate expiry time
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + DUCKDUCKGO_CONFIG.cacheExpiryHours);
    
    // Upsert cache entry (insert or update if exists)
    const { error } = await supabase
      .from('duckduckgo_search_cache')
      .upsert({
        user_id: userId,
        query: query,
        query_hash: queryHash,
        results: results,
        extracted_keywords: extracted.keywords,
        extracted_phrases: extracted.phrases,
        extracted_verbs: extracted.verbs,
        extracted_nouns: extracted.nouns,
        extracted_pronouns: extracted.pronouns,
        domain: domain,
        confidence: confidence,
        expires_at: expiresAt.toISOString(),
        hit_count: DESCRIPTION_GENERATION_CONFIG.initialHitCount,
      }, {
        onConflict: 'user_id,query_hash',
      });
    
    if (error) {
      logger.debug('Failed to store cache in database:', error);
    } else {
      logger.debug(`DuckDuckGo database cache stored: "${query}" (${results.length} results)`);
    }
  } catch (error) {
    logger.debug('Failed to store cache in database:', error);
  }
}

export interface GeneratedDescription {
  description: string;
  domain: Domain;
  confidence: number;
}

/**
 * Search DuckDuckGo for context about the task
 * Uses DuckDuckGo's Instant Answer API to get search results
 * Implements caching to speed up repeated queries
 */
async function searchDuckDuckGo(query: string): Promise<string[]> {
  try {
    const searchQuery = encodeURIComponent(query);
    const instantAnswerUrl = `${DUCKDUCKGO_CONFIG.instantAnswerApiUrl}?q=${searchQuery}&format=json&no_html=1&skip_disambig=1`;
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DESCRIPTION_GENERATION_CONFIG.searchTimeout);
    
    try {
      const response = await fetch(instantAnswerUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const results: string[] = [];

        // Extract Abstract text (most relevant)
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
          logger.debug(`DuckDuckGo search successful: ${results.length} results for "${query}"`);
          // Cache will be stored after extraction (in searchDomainContext)
          return results;
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        logger.debug('DuckDuckGo search timeout:', query);
      } else {
        logger.debug('DuckDuckGo Instant Answer API failed:', error);
      }
    }

    // Return empty array if search failed
    return [];
  } catch (error) {
    logger.debug('DuckDuckGo search error:', error);
    return [];
  }
}

/**
 * Build contextual description using extracted phrases, verbs (action words), nouns, pronouns, keywords, and search context
 * Creates a comprehensive description based on DuckDuckGo search findings
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
  
  // Start with task name context
  const taskWords = taskName.toLowerCase().split(/\s+/);
  
  // Build description using found phrases, verbs (action words), nouns, and keywords from search
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
  
  // Add contextual information from search results if available
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
  // Use pronouns for more natural language flow
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
 * Search DuckDuckGo for domain-specific keywords, phrases, verbs (action words), nouns, pronouns, and scenarios
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
  
  // 3. Domain context query with pronouns for natural language context
  const domainContextMap: Record<Domain, string> = {
    business: 'professional work business',
    home: 'home maintenance household',
    personal: 'personal life self-care',
    world: 'global international travel',
    mixed: 'general',
  };
  searchQueries.push(`${taskName} ${domainContextMap[domain]}`);
  
  // Search all queries in parallel (with limit to avoid too many requests)
  const queriesToSearch = searchQueries.slice(0, DESCRIPTION_GENERATION_CONFIG.maxQueriesPerSearch);
  
  try {
    const searchPromises = queriesToSearch.map(query => searchDuckDuckGo(query));
    const resultsArray = await Promise.allSettled(searchPromises);
    
    resultsArray.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        allResults.push(...result.value);
        logger.debug(`DuckDuckGo search ${index + 1} successful: "${queriesToSearch[index]}"`);
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
 * Generates a task description based on task name using DuckDuckGo + browser AI
 * Searches for domain-specific keywords, verbs, and scenarios as per guidelines
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

  // Search DuckDuckGo for domain-specific context (keywords, verbs, scenarios)
  let description = '';
  let confidence = DESCRIPTION_GENERATION_CONFIG.baseConfidence;
  let usedSearchResults = false;

  try {
    // Check database cache first for the main task query
    const mainQueryCache = await getCachedResultsFromDatabase(taskName);
    let searchResults: string[] = [];
    let extracted: ReturnType<typeof extractKeywordsAndVerbsFromSearch> | null = null;
    
    if (mainQueryCache !== null) {
      // Use cached extracted data if available
      logger.debug(`Using cached extracted data for: "${taskName}"`);
      searchResults = mainQueryCache.results;
      extracted = {
        keywords: mainQueryCache.extracted_keywords,
        phrases: mainQueryCache.extracted_phrases,
        verbs: mainQueryCache.extracted_verbs,
        nouns: mainQueryCache.extracted_nouns,
        pronouns: mainQueryCache.extracted_pronouns,
        context: mainQueryCache.results.join(' ').substring(0, DESCRIPTION_GENERATION_CONFIG.maxContextLength),
      };
      // Use cached domain and confidence if available
      if (mainQueryCache.domain) {
        domain = mainQueryCache.domain as Domain;
        domainTerms = getDomainTerminology(domain);
      }
      if (mainQueryCache.confidence !== null) {
        confidence = mainQueryCache.confidence;
      }
    } else {
      // Search for domain-specific keywords, verbs, and scenarios
      searchResults = await searchDomainContext(taskName, domain, domainTerms);
      
      if (searchResults.length > 0) {
        // Extract phrases, verbs (action words), nouns, pronouns, and keywords from search results using browser AI
        extracted = extractKeywordsAndVerbsFromSearch(searchResults, domainTerms);
        
        // Calculate confidence for storage
        const calculatedConfidence = Math.min(
          DESCRIPTION_GENERATION_CONFIG.searchBaseConfidence + 
          (extracted.keywords.length * DESCRIPTION_GENERATION_CONFIG.keywordWeight) + 
          (extracted.phrases.length * DESCRIPTION_GENERATION_CONFIG.phraseWeight) +
          (extracted.verbs.length * DESCRIPTION_GENERATION_CONFIG.verbWeight) + 
          (extracted.nouns.length * DESCRIPTION_GENERATION_CONFIG.nounWeight) +
          (extracted.pronouns.length * DESCRIPTION_GENERATION_CONFIG.pronounWeight) +
          (searchResults.length * DESCRIPTION_GENERATION_CONFIG.resultCountWeight),
          DESCRIPTION_GENERATION_CONFIG.maxConfidence
        );
        
        // Store in database cache for future use
        await setCachedResultsInDatabase(
          taskName,
          searchResults,
          {
            keywords: extracted.keywords,
            phrases: extracted.phrases,
            verbs: extracted.verbs,
            nouns: extracted.nouns,
            pronouns: extracted.pronouns,
          },
          domain,
          calculatedConfidence
        );
        
        confidence = calculatedConfidence;
      }
    }
    
    if (searchResults.length > 0 && extracted) {
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
      }
    }
  } catch (error) {
    logger.debug('DuckDuckGo search error, falling back to local terminology:', error);
  }

  // Fallback to local terminology if search didn't provide good results
  if (!usedSearchResults || !description) {
    // Extract keywords and verbs from task name
    const words = taskName.toLowerCase().split(/\s+/);
    const keywords = words.filter(word => 
      domainTerms.keywords.some(kw => kw.toLowerCase().includes(word) || word.includes(kw.toLowerCase()))
    );
    const verbs = words.filter(word =>
      domainTerms.verbs.some(v => v.toLowerCase().includes(word) || word.includes(v.toLowerCase()))
    );

    // Build description using domain-specific terminology
    // Start with action-oriented opening
    if (verbs.length > 0) {
      const primaryVerb = verbs[0];
      description += `This task involves ${primaryVerb}ing`;
    } else {
      description += 'This task involves';
    }

    // Add context based on keywords
    if (keywords.length > 0) {
      description += ` ${keywords.slice(0, DESCRIPTION_GENERATION_CONFIG.maxTopKeywords).join(' and ')}`;
    } else {
      description += ` ${taskName.toLowerCase()}`;
    }

    // Add domain-specific context
    if (domain === 'business') {
      description += '. Focus on professional standards and efficiency.';
    } else if (domain === 'home') {
      description += '. Organize and maintain your living space effectively.';
    } else if (domain === 'personal') {
      description += '. Take time to complete this thoughtfully.';
    } else if (domain === 'world') {
      description += '. Consider broader implications and impact.';
    }

    // Calculate confidence based on keyword/verb matches
    confidence = Math.min(
      DESCRIPTION_GENERATION_CONFIG.baseConfidence + 
      (keywords.length * DESCRIPTION_GENERATION_CONFIG.fallbackKeywordWeight) + 
      (verbs.length * DESCRIPTION_GENERATION_CONFIG.fallbackVerbWeight),
      DESCRIPTION_GENERATION_CONFIG.fallbackMaxConfidence
    );
  }

  return {
    description,
    domain,
    confidence,
  };
}

