/**
 * Description Generator
 * 
 * Generates task descriptions based on task name using DuckDuckGo search + browser AI
 * with domain-specific terminology, keywords, verbs, and action words.
 */

import { detectDomain, type Domain, getDomainTerminology } from './domain-terminology';
import { TASK_BREAKDOWN_DEBOUNCE_MS } from './ai-config';
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
 * Process search results using browser AI to generate context
 */
function processSearchResultsWithBrowserAI(
  taskName: string,
  searchResults: string[],
  domain: Domain,
  domainTerms: ReturnType<typeof getDomainTerminology>
): string {
  if (searchResults.length === 0) {
    return '';
  }

  // Combine search results into context
  const context = searchResults.join(' ').substring(0, DESCRIPTION_GENERATION_CONFIG.maxContextLength);

  // Extract relevant information from search results
  const words = taskName.toLowerCase().split(/\s+/);
  const relevantSnippets = searchResults.filter(snippet => {
    const snippetLower = snippet.toLowerCase();
    return words.some(word => snippetLower.includes(word));
  });

  // Build description using search context
  let description = '';
  
  if (relevantSnippets.length > 0) {
    // Use the most relevant snippet as base
    const primarySnippet = relevantSnippets[0];
    const snippetWords = primarySnippet.split(/\s+/).slice(0, 20).join(' ');
    
    description = `Based on common practices, ${snippetWords}`;
    
    // Add domain-specific guidance
    if (domain === 'business') {
      description += '. Apply professional standards and best practices.';
    } else if (domain === 'home') {
      description += '. Follow established methods for home maintenance.';
    } else if (domain === 'personal') {
      description += '. Take a thoughtful and personal approach.';
    } else if (domain === 'world') {
      description += '. Consider global perspectives and implications.';
    }
  }

  return description;
}

/**
 * Generates a task description based on task name using DuckDuckGo + browser AI
 * Falls back to local terminology if search fails
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

  // Try DuckDuckGo search first
  let description = '';
  let confidence = 0.3; // Base confidence
  let usedSearchResults = false;

  try {
    const searchResults = await searchDuckDuckGo(taskName);
    
    if (searchResults.length > 0) {
      // Process search results with browser AI
      const searchBasedDescription = processSearchResultsWithBrowserAI(
        taskName,
        searchResults,
        domain,
        domainTerms
      );
      
      if (searchBasedDescription) {
        description = searchBasedDescription;
        confidence = Math.min(0.7 + (searchResults.length * 0.05), 0.95);
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

