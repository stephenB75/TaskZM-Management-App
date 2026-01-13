/**
 * AI Context System
 * 
 * Provides shared context for all AI components to work together efficiently.
 * Eliminates redundant domain detection, term extraction, and terminology fetching.
 * 
 * This ensures:
 * - Domain is detected once and shared
 * - Terms are extracted once and shared
 * - Terminology is fetched consistently
 * - Components build on each other's work
 */

import { detectDomain, type Domain, getDomainTerminology, getDomainTerminologyAsync } from './domain-terminology';
import { extractTermsFromTaskNameWithBrowserAI, validateAndEnhanceTermsWithDictionary } from './description-generator';
import { logger } from './logger';

export interface AIContext {
  // Domain detection (shared across all components)
  domain: Domain;
  domainConfidence: number;
  domainKeywords: string[];
  
  // Terminology (shared across all components)
  domainTerms: ReturnType<typeof getDomainTerminology>;
  
  // Extracted terms (shared across all components)
  extractedTerms: {
    keywords: string[];
    phrases: string[];
    verbs: string[];
    nouns: string[];
    pronouns: string[];
    context: string;
  };
  
  // Enhanced terms (validated and enhanced with domain terminology)
  enhancedTerms: {
    keywords: string[];
    phrases: string[];
    verbs: string[];
    nouns: string[];
    pronouns: string[];
  };
  
  // Full text for reference
  fullText: string;
  title: string;
  description: string;
}

/**
 * Create shared AI context for a task
 * This should be called once per task analysis and shared across all AI components
 * 
 * @param title - Task title
 * @param description - Task description
 * @param useAsyncTerminology - If true, fetch terminology from database (async). Default: false (uses cached)
 * @returns Shared AI context with domain, terminology, and extracted terms
 */
export async function createAIContext(
  title: string,
  description: string,
  useAsyncTerminology: boolean = false
): Promise<AIContext> {
  const fullText = `${title} ${description}`.trim();
  
  if (!fullText || fullText.length === 0) {
    // Return minimal context for empty tasks
    const defaultDomain = 'personal';
    const defaultTerms = getDomainTerminology(defaultDomain);
    
    return {
      domain: defaultDomain,
      domainConfidence: 0,
      domainKeywords: [],
      domainTerms: defaultTerms,
      extractedTerms: {
        keywords: [],
        phrases: [],
        verbs: [],
        nouns: [],
        pronouns: [],
        context: '',
      },
      enhancedTerms: {
        keywords: [],
        phrases: [],
        verbs: [],
        nouns: [],
        pronouns: [],
      },
      fullText: '',
      title: title.trim(),
      description: description.trim(),
    };
  }

  // STEP 1: Detect domain once (shared across all components)
  const domainDetection = detectDomain(title, description);
  const domain = domainDetection.domain;
  
  logger.debug('AI Context: Domain detected', {
    domain,
    confidence: domainDetection.confidence,
    keywords: domainDetection.keywords.length,
  });

  // STEP 2: Fetch terminology once (shared across all components)
  const domainTerms = useAsyncTerminology
    ? await getDomainTerminologyAsync(domain)
    : getDomainTerminology(domain);

  // STEP 3: Extract terms once (shared across all components)
  // Extract from both title and description for comprehensive analysis
  const titleExtracted = extractTermsFromTaskNameWithBrowserAI(title, domainTerms);
  const descriptionExtracted = description.trim().length > 0
    ? extractTermsFromTaskNameWithBrowserAI(description, domainTerms)
    : { keywords: [], phrases: [], verbs: [], nouns: [], pronouns: [], context: '' };

  // Combine extracted terms
  const combinedExtracted = {
    keywords: [...titleExtracted.keywords, ...descriptionExtracted.keywords],
    phrases: [...titleExtracted.phrases, ...descriptionExtracted.phrases],
    verbs: [...titleExtracted.verbs, ...descriptionExtracted.verbs],
    nouns: [...titleExtracted.nouns, ...descriptionExtracted.nouns],
    pronouns: [...titleExtracted.pronouns, ...descriptionExtracted.pronouns],
    context: `${titleExtracted.context} ${descriptionExtracted.context}`.trim(),
  };

  // STEP 4: Validate and enhance terms once (shared across all components)
  const enhancedTerms = validateAndEnhanceTermsWithDictionary(
    combinedExtracted,
    fullText,
    domainTerms
  );

  // Remove duplicates and limit to reasonable counts
  const uniqueKeywords = Array.from(new Set(enhancedTerms.keywords.map(k => k.toLowerCase())))
    .map(k => enhancedTerms.keywords.find(ek => ek.toLowerCase() === k)!)
    .slice(0, 15); // Use reasonable limit
  
  const uniquePhrases = Array.from(new Set(enhancedTerms.phrases.map(p => p.toLowerCase())))
    .map(p => enhancedTerms.phrases.find(ep => ep.toLowerCase() === p)!)
    .slice(0, 10);
  
  const uniqueVerbs = Array.from(new Set(enhancedTerms.verbs.map(v => v.toLowerCase())))
    .map(v => enhancedTerms.verbs.find(ev => ev.toLowerCase() === v)!)
    .slice(0, 10);
  
  const uniqueNouns = Array.from(new Set(enhancedTerms.nouns.map(n => n.toLowerCase())))
    .map(n => enhancedTerms.nouns.find(en => en.toLowerCase() === n)!)
    .slice(0, 10);
  
  const uniquePronouns = Array.from(new Set(enhancedTerms.pronouns.map(p => p.toLowerCase())))
    .map(p => enhancedTerms.pronouns.find(ep => ep.toLowerCase() === p)!)
    .slice(0, 5);

  logger.debug('AI Context: Terms extracted and enhanced', {
    keywords: uniqueKeywords.length,
    phrases: uniquePhrases.length,
    verbs: uniqueVerbs.length,
    nouns: uniqueNouns.length,
    pronouns: uniquePronouns.length,
  });

  return {
    domain,
    domainConfidence: domainDetection.confidence,
    domainKeywords: domainDetection.keywords,
    domainTerms,
    extractedTerms: combinedExtracted,
    enhancedTerms: {
      keywords: uniqueKeywords,
      phrases: uniquePhrases,
      verbs: uniqueVerbs,
      nouns: uniqueNouns,
      pronouns: uniquePronouns,
    },
    fullText,
    title: title.trim(),
    description: description.trim(),
  };
}

/**
 * Create shared AI context synchronously (uses cached terminology)
 * Use this when you need immediate results and can accept cached terminology
 * 
 * @param title - Task title
 * @param description - Task description
 * @returns Shared AI context with domain, terminology, and extracted terms
 */
export function createAIContextSync(
  title: string,
  description: string
): AIContext {
  const fullText = `${title} ${description}`.trim();
  
  if (!fullText || fullText.length === 0) {
    const defaultDomain = 'personal';
    const defaultTerms = getDomainTerminology(defaultDomain);
    
    return {
      domain: defaultDomain,
      domainConfidence: 0,
      domainKeywords: [],
      domainTerms: defaultTerms,
      extractedTerms: {
        keywords: [],
        phrases: [],
        verbs: [],
        nouns: [],
        pronouns: [],
        context: '',
      },
      enhancedTerms: {
        keywords: [],
        phrases: [],
        verbs: [],
        nouns: [],
        pronouns: [],
      },
      fullText: '',
      title: title.trim(),
      description: description.trim(),
    };
  }

  // Detect domain
  const domainDetection = detectDomain(title, description);
  const domain = domainDetection.domain;
  const domainTerms = getDomainTerminology(domain);

  // Extract terms
  const titleExtracted = extractTermsFromTaskNameWithBrowserAI(title, domainTerms);
  const descriptionExtracted = description.trim().length > 0
    ? extractTermsFromTaskNameWithBrowserAI(description, domainTerms)
    : { keywords: [], phrases: [], verbs: [], nouns: [], pronouns: [], context: '' };

  const combinedExtracted = {
    keywords: [...titleExtracted.keywords, ...descriptionExtracted.keywords],
    phrases: [...titleExtracted.phrases, ...descriptionExtracted.phrases],
    verbs: [...titleExtracted.verbs, ...descriptionExtracted.verbs],
    nouns: [...titleExtracted.nouns, ...descriptionExtracted.nouns],
    pronouns: [...titleExtracted.pronouns, ...descriptionExtracted.pronouns],
    context: `${titleExtracted.context} ${descriptionExtracted.context}`.trim(),
  };

  // Enhance terms
  const enhancedTerms = validateAndEnhanceTermsWithDictionary(
    combinedExtracted,
    fullText,
    domainTerms
  );

  // Remove duplicates
  const uniqueKeywords = Array.from(new Set(enhancedTerms.keywords.map(k => k.toLowerCase())))
    .map(k => enhancedTerms.keywords.find(ek => ek.toLowerCase() === k)!)
    .slice(0, 15);
  
  const uniquePhrases = Array.from(new Set(enhancedTerms.phrases.map(p => p.toLowerCase())))
    .map(p => enhancedTerms.phrases.find(ep => ep.toLowerCase() === p)!)
    .slice(0, 10);
  
  const uniqueVerbs = Array.from(new Set(enhancedTerms.verbs.map(v => v.toLowerCase())))
    .map(v => enhancedTerms.verbs.find(ev => ev.toLowerCase() === v)!)
    .slice(0, 10);
  
  const uniqueNouns = Array.from(new Set(enhancedTerms.nouns.map(n => n.toLowerCase())))
    .map(n => enhancedTerms.nouns.find(en => en.toLowerCase() === n)!)
    .slice(0, 10);
  
  const uniquePronouns = Array.from(new Set(enhancedTerms.pronouns.map(p => p.toLowerCase())))
    .map(p => enhancedTerms.pronouns.find(ep => ep.toLowerCase() === p)!)
    .slice(0, 5);

  return {
    domain,
    domainConfidence: domainDetection.confidence,
    domainKeywords: domainDetection.keywords,
    domainTerms,
    extractedTerms: combinedExtracted,
    enhancedTerms: {
      keywords: uniqueKeywords,
      phrases: uniquePhrases,
      verbs: uniqueVerbs,
      nouns: uniqueNouns,
      pronouns: uniquePronouns,
    },
    fullText,
    title: title.trim(),
    description: description.trim(),
  };
}
