/**
 * Description Generator
 * 
 * Generates task descriptions based on task name using DuckDuckGo search + browser AI
 * with domain-specific terminology, keywords, verbs, and action words.
 */

import { detectDomain, type Domain, getDomainTerminology } from './domain-terminology';
import { TASK_BREAKDOWN_DEBOUNCE_MS, DUCKDUCKGO_CONFIG, DESCRIPTION_GENERATION_CONFIG } from './ai-config';
import { logger } from './logger';

export interface GeneratedDescription {
  description: string;
  domain: Domain;
  confidence: number;
}

/**
 * Search DuckDuckGo for context about the task
 * Uses DuckDuckGo's Instant Answer API to get search results
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
      description += ` related to ${nouns.slice(0, 1).join(' and ')}`;
    } else if (keywords.length > 0) {
      description += ` focusing on ${keywords.slice(0, 1).join(' and ')}`;
    }
  } else if (verbs.length > 0) {
    // Use action words (verbs) if no phrases found
    const primaryVerb = verbs[0];
    description = `This task involves ${primaryVerb}ing`;
    
    // Add nouns for object context
    if (nouns.length > 0) {
      description += ` ${nouns.slice(0, 1).join(' and ')}`;
    } else if (keywords.length > 0) {
      description += ` ${keywords.slice(0, 1).join(' and ')}`;
    } else {
      description += ` ${taskName.toLowerCase()}`;
    }
  } else if (nouns.length > 0) {
    // Use nouns if no phrases or verbs found
    description = `This task focuses on ${nouns.slice(0, 2).join(' and ')}`;
    
    if (keywords.length > 0) {
      description += ` related to ${keywords.slice(0, 1).join(' and ')}`;
    }
  } else if (keywords.length > 0) {
    description = `This task focuses on ${keywords.slice(0, 2).join(' and ')}`;
  } else {
    description = `This task involves ${taskName.toLowerCase()}`;
  }
  
  // Add contextual information from search results if available
  if (context && context.length > 50) {
    // Extract a relevant sentence from context
    const sentences = context.split(/[.!?]+/).filter(s => s.trim().length > 20);
    if (sentences.length > 0) {
      const relevantSentence = sentences[0].trim();
      if (relevantSentence.length < 150) {
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
  const taskWords = taskName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  // Build domain-specific search queries
  const searchQueries: string[] = [];
  
  // 1. Main task query
  searchQueries.push(taskName);
  
  // 2. Domain-specific queries with phrases, verbs (action words), nouns, and pronouns
  const topKeywords = domainTerms.keywords.slice(0, 2).filter(kw => 
    taskWords.some(word => kw.toLowerCase().includes(word) || word.includes(kw.toLowerCase()))
  );
  const topPhrases = domainTerms.phrases.slice(0, 2).filter(phrase => 
    taskWords.some(word => phrase.toLowerCase().includes(word) || word.includes(phrase.toLowerCase()))
  );
  const topVerbs = domainTerms.verbs.slice(0, 2).filter(v => 
    taskWords.some(word => v.toLowerCase().includes(word) || word.includes(v.toLowerCase()))
  );
  const topNouns = domainTerms.nouns.slice(0, 2).filter(noun => 
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
  const queriesToSearch = searchQueries.slice(0, 5); // Increased to 5 queries to include phrases, verbs, nouns
  
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
    return uniqueResults.slice(0, DUCKDUCKGO_CONFIG.maxResults * 2); // Allow more results from multiple queries
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
      contextSnippets.push(result.substring(0, 200)); // Limit snippet length
    }
  });
  
  return {
    keywords: foundKeywords.slice(0, 5), // Top 5 keywords
    phrases: foundPhrases.slice(0, 3), // Top 3 phrases
    verbs: foundVerbs.slice(0, 3), // Top 3 verbs (action words)
    nouns: foundNouns.slice(0, 3), // Top 3 nouns
    pronouns: foundPronouns.slice(0, 2), // Top 2 pronouns
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
  let confidence = 0.3; // Base confidence
  let usedSearchResults = false;

  try {
    // Search for domain-specific keywords, verbs, and scenarios
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
        confidence = Math.min(
          0.6 + 
          (extracted.keywords.length * 0.03) + 
          (extracted.phrases.length * 0.05) + // Phrases are more specific, higher weight
          (extracted.verbs.length * 0.04) + 
          (extracted.nouns.length * 0.03) +
          (extracted.pronouns.length * 0.01) + // Pronouns add natural language context
          (searchResults.length * 0.02),
          0.95
        );
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
      description += ` ${keywords.slice(0, 2).join(' and ')}`;
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
      0.3 + (keywords.length * 0.2) + (verbs.length * 0.15),
      0.9
    );
  }

  return {
    description,
    domain,
    confidence,
  };
}

