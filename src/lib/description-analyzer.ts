/**
 * Description Analyzer
 * 
 * Analyzes user input to extract context, enhance descriptions, and provide
 * domain-specific insights for task breakdown suggestions.
 * ENHANCED: Now uses sophisticated extraction methods from description-generator
 * for better keyword and phrase analysis.
 */

import type { Task } from '../types';
import { detectDomain, type Domain, getDomainTerminology } from './domain-terminology';
import { analyzeTaskVerbs } from './verb-analysis';
import { DESCRIPTION_COMPLEXITY_THRESHOLDS, DESCRIPTION_GENERATION_CONFIG } from './ai-config';
import { DEFAULT_TASK_STATUS, DEFAULT_TASK_DOMAIN } from './task-constants';
import { extractTermsFromTaskNameWithBrowserAI, extractTermsFromTaskName, validateAndEnhanceTermsWithDictionary } from './description-generator';
import { logger } from './logger';
import type { AIContext } from './ai-context';

export interface DescriptionAnalysis {
  original: string;
  enhanced: string;
  suggestions: string[];
  addedContext: string[];
  detectedDomain: Domain;
  confidence: number;
  keywords: string[];
  phrases: string[];
  verbs: string[];
  nouns: string[];
  complexity: 'simple' | 'moderate' | 'complex';
}

/**
 * Analyze user input to extract verbs, keywords, phrases, and domain context
 * ENHANCED: Now uses sophisticated extraction methods for better keyword and phrase analysis
 * 
 * @param title - Task title
 * @param description - Task description
 * @param aiContext - Optional shared AI context (if provided, uses it instead of re-detecting/re-extracting)
 * @param effortScore - Optional effort score (1-5) to influence suggestion complexity
 */
export function analyzeDescription(
  title: string,
  description: string,
  aiContext?: AIContext,
  effortScore?: number
): DescriptionAnalysis {
  const fullText = `${title} ${description}`.trim();
  const original = description.trim();

  if (!fullText || fullText.length === 0) {
    return {
      original,
      enhanced: original,
      suggestions: [],
      addedContext: [],
      detectedDomain: 'personal',
      confidence: 0,
      keywords: [],
      phrases: [],
      verbs: [],
      nouns: [],
      complexity: 'simple',
    };
  }

  // Analyze verbs (needed in both branches)
  const tempTask: Partial<Task> = {
    title,
    description,
    status: DEFAULT_TASK_STATUS,
    priority: 'medium',
    tags: [],
  };
  const verbAnalysis = analyzeTaskVerbs(tempTask as Task);
  const primaryVerb = verbAnalysis.primaryVerb;

  // Use shared context if provided, otherwise detect/extract independently
  // Initialize domain so it is never uninitialized (avoids "Can't find variable: domain")
  let domain: Domain = DEFAULT_TASK_DOMAIN;
  let domainConfidence: number = 0;
  let uniqueKeywords: string[];
  let uniquePhrases: string[];
  let uniqueVerbs: string[];
  let uniqueNouns: string[];
  let domainTerms: ReturnType<typeof getDomainTerminology>;

  if (aiContext) {
    // Use shared context (no redundant work)
    // CRITICAL: Validate domain is defined before using it
    const contextDomain = aiContext.domain;
    domain = (contextDomain &&
      (contextDomain === 'business' || contextDomain === 'home' ||
       contextDomain === 'personal' || contextDomain === 'world' ||
       contextDomain === 'mixed'))
      ? contextDomain
      : DEFAULT_TASK_DOMAIN;
    domainConfidence = aiContext.domainConfidence ?? 0;
    uniqueKeywords = aiContext.enhancedTerms?.keywords || [];
    uniquePhrases = aiContext.enhancedTerms?.phrases || [];
    uniqueVerbs = aiContext.enhancedTerms?.verbs || [];
    uniqueNouns = aiContext.enhancedTerms?.nouns || [];
    domainTerms = aiContext.domainTerms || getDomainTerminology(domain);
  } else {
    // Fallback: detect and extract independently (backward compatibility)
    const domainDetection = detectDomain(title, description);
    domain = domainDetection?.domain ?? DEFAULT_TASK_DOMAIN;
    domainConfidence = domainDetection?.confidence ?? 0;
    domainTerms = getDomainTerminology(domain);

    // ENHANCED: Use sophisticated extraction methods from description-generator
    // Extract terms from both title and description for comprehensive analysis
    // NOTE: For sync version, use local extraction (Browser AI API is async)
    const titleExtracted = (() => {
      const localExtracted = extractTermsFromTaskName(title, domainTerms);
      return {
        keywords: localExtracted.keywords,
        phrases: localExtracted.phrases,
        verbs: localExtracted.verbs,
        nouns: localExtracted.nouns,
        pronouns: localExtracted.pronouns,
        context: title,
      };
    })();
    const descriptionExtracted = description.trim().length > 0 
      ? (() => {
          const localExtracted = extractTermsFromTaskName(description, domainTerms);
          return {
            keywords: localExtracted.keywords,
            phrases: localExtracted.phrases,
            verbs: localExtracted.verbs,
            nouns: localExtracted.nouns,
            pronouns: localExtracted.pronouns,
            context: description,
          };
        })()
      : { keywords: [], phrases: [], verbs: [], nouns: [], pronouns: [], context: '' };

    // Combine and enhance extracted terms
    const combinedExtracted = {
      keywords: [...titleExtracted.keywords, ...descriptionExtracted.keywords],
      phrases: [...titleExtracted.phrases, ...descriptionExtracted.phrases],
      verbs: [...titleExtracted.verbs, ...descriptionExtracted.verbs],
      nouns: [...titleExtracted.nouns, ...descriptionExtracted.nouns],
      pronouns: [...titleExtracted.pronouns, ...descriptionExtracted.pronouns],
      context: `${titleExtracted.context} ${descriptionExtracted.context}`.trim(),
    };

    // Validate and enhance terms with domain terminology dictionary
    const enhancedTerms = validateAndEnhanceTermsWithDictionary(
      combinedExtracted,
      fullText,
      domainTerms
    );

    // Remove duplicates and limit to reasonable counts
    uniqueKeywords = Array.from(new Set(enhancedTerms.keywords.map(k => k.toLowerCase())))
      .map(k => enhancedTerms.keywords.find(ek => ek.toLowerCase() === k)!)
      .slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedKeywords);
    
    uniquePhrases = Array.from(new Set(enhancedTerms.phrases.map(p => p.toLowerCase())))
      .map(p => enhancedTerms.phrases.find(ep => ep.toLowerCase() === p)!)
      .slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPhrases);
    
    uniqueVerbs = Array.from(new Set(enhancedTerms.verbs.map(v => v.toLowerCase())))
      .map(v => enhancedTerms.verbs.find(ev => ev.toLowerCase() === v)!)
      .slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedVerbs);
    
    uniqueNouns = Array.from(new Set(enhancedTerms.nouns.map(n => n.toLowerCase())))
      .map(n => enhancedTerms.nouns.find(en => en.toLowerCase() === n)!)
      .slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedNouns);
  }

  // Add primary verb if not already in verbs list
  const allVerbs = primaryVerb !== 'unknown' && !uniqueVerbs.some(v => v.toLowerCase() === primaryVerb.toLowerCase())
    ? [primaryVerb, ...uniqueVerbs]
    : uniqueVerbs;

  // Extract keywords and verbs from text for complexity calculation
  const words = fullText
    .toLowerCase()
    .split(/[\s\-_.,!?;:()\[\]{}'"]+/)
    .filter(w => w.length > 2);

  // Determine complexity
  let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
  if (
    words.length > DESCRIPTION_COMPLEXITY_THRESHOLDS.COMPLEX.WORD_COUNT ||
    description.length > DESCRIPTION_COMPLEXITY_THRESHOLDS.COMPLEX.CHAR_COUNT
  ) {
    complexity = 'complex';
  } else if (
    words.length > DESCRIPTION_COMPLEXITY_THRESHOLDS.MODERATE.WORD_COUNT ||
    description.length > DESCRIPTION_COMPLEXITY_THRESHOLDS.MODERATE.CHAR_COUNT
  ) {
    complexity = 'moderate';
  }

  // Get effort score from aiContext or use provided parameter
  const normalizedEffortScore = effortScore !== undefined && effortScore >= 1 && effortScore <= 5
    ? effortScore
    : (aiContext?.extractedTerms ? 2.5 : 2.5); // Default to medium effort

  // Generate enhanced description (pass all extracted terms and effort score for better suggestions)
  const { enhanced, suggestions, addedContext } = enhanceDescription(
    original,
    domain,
    uniqueKeywords,
    primaryVerb,
    uniquePhrases,
    uniqueVerbs,
    uniqueNouns,
    normalizedEffortScore
  );

  logger.debug('AI Analyzer: Enhanced extraction', {
    keywords: uniqueKeywords.length,
    phrases: uniquePhrases.length,
    verbs: allVerbs.length,
    nouns: uniqueNouns.length,
    domain,
  });

  return {
    original,
    enhanced,
    suggestions,
    addedContext,
    detectedDomain: domain,
    confidence: domainConfidence,
    keywords: uniqueKeywords,
    phrases: uniquePhrases,
    verbs: allVerbs,
    nouns: uniqueNouns,
    complexity,
  };
}

/**
 * Enhance description with domain-specific context and suggestions
 * ENHANCED: Now uses phrases, verbs, and nouns for more contextual suggestions
 */
function enhanceDescription(
  original: string,
  domain: Domain,
  keywords: string[],
  primaryVerb: string,
  phrases?: string[],
  verbs?: string[],
  nouns?: string[]
): {
  enhanced: string;
  suggestions: string[];
  addedContext: string[];
} {
  if (!original || original.trim().length === 0) {
    // For empty descriptions, suggest based on domain and available terms
    const terminology = getDomainTerminology(domain);
    const suggestions = generateDomainSuggestions(domain, terminology, keywords, phrases, verbs, nouns);
    return {
      enhanced: original,
      suggestions,
      addedContext: [],
    };
  }

  const suggestions: string[] = [];
  const addedContext: string[] = [];
  const originalLower = original.toLowerCase();

  // ENHANCED: Use phrases, verbs, and nouns for more contextual suggestions
  const allKeywords = [...keywords, ...(phrases || []), ...(verbs || []), ...(nouns || [])];
  const hasJobKeywords = allKeywords.some(k => ['job', 'work', 'employment', 'hours', 'time', 'log', 'login', 'platform'].includes(k.toLowerCase()));
  const hasLoginKeywords = allKeywords.some(k => ['login', 'log', 'access', 'account', 'password'].includes(k.toLowerCase()));
  const hasTimeKeywords = allKeywords.some(k => ['time', 'hours', 'duration', 'schedule', 'track'].includes(k.toLowerCase()));

  // Domain-specific enhancements
  switch (domain) {
    case 'business':
      if (hasJobKeywords && hasLoginKeywords && !originalLower.includes('platform')) {
        suggestions.push('Specify which platform or system you need to log into');
      }
      if (hasTimeKeywords && hasJobKeywords && !originalLower.includes('track') && !originalLower.includes('record')) {
        suggestions.push('Clarify what information needs to be tracked or recorded');
      }
      if (!originalLower.includes('deadline') && keywords.some(k => ['project', 'report', 'presentation'].includes(k.toLowerCase()))) {
        suggestions.push('Consider adding a deadline or timeline');
      }
      if (!originalLower.includes('stakeholder') && keywords.some(k => ['client', 'team', 'project'].includes(k.toLowerCase()))) {
        suggestions.push('Mention key stakeholders or participants');
      }
      if (primaryVerb === 'present' || primaryVerb === 'meet') {
        addedContext.push('Meeting preparation and follow-up actions');
      }
      break;

    case 'home':
      if (keywords.some(k => ['repair', 'maintenance', 'fix'].includes(k.toLowerCase()))) {
        suggestions.push('List any supplies or tools needed');
      }
      if (keywords.some(k => ['cleaning', 'organize'].includes(k.toLowerCase()))) {
        suggestions.push('Specify which areas or rooms');
      }
      if (keywords.some(k => ['cooking', 'meal'].includes(k.toLowerCase()))) {
        suggestions.push('Include ingredients or recipe details');
      }
      break;

    case 'personal':
      if (hasJobKeywords && hasLoginKeywords) {
        suggestions.push('Specify the platform name and what information to log');
      }
      if (hasTimeKeywords && hasJobKeywords) {
        suggestions.push('Clarify the time period or hours to be tracked');
      }
      if (keywords.some(k => ['exercise', 'workout', 'fitness'].includes(k.toLowerCase()))) {
        suggestions.push('Specify duration or type of workout');
      }
      if (keywords.some(k => ['travel', 'trip'].includes(k.toLowerCase()))) {
        suggestions.push('Include destination or travel details');
      }
      if (keywords.some(k => ['learning', 'course', 'study'].includes(k.toLowerCase()))) {
        suggestions.push('Mention specific topics or resources');
      }
      break;

    case 'world':
      if (keywords.some(k => ['travel', 'trip', 'journey'].includes(k.toLowerCase()))) {
        suggestions.push('Include time zones and cultural considerations');
      }
      if (keywords.some(k => ['call', 'meeting', 'conference'].includes(k.toLowerCase()))) {
        suggestions.push('Specify time zone for international coordination');
      }
      break;
  }

  // General enhancements based on content and effort score
  // Higher effort tasks get more detailed suggestions
  if (original.length < DESCRIPTION_COMPLEXITY_THRESHOLDS.MIN_DESCRIPTION_LENGTH) {
    if (hasJobKeywords && hasLoginKeywords) {
      if (effortScore >= 3) {
        suggestions.push('Add comprehensive details about the login process, platform requirements, and what information needs to be tracked');
      } else {
        suggestions.push('Add details about the login process and what needs to be tracked');
      }
    } else if (hasTimeKeywords) {
      if (effortScore >= 3) {
        suggestions.push('Specify the time period, duration details, and any scheduling constraints');
      } else {
        suggestions.push('Specify the time period or duration details');
      }
    } else {
      if (effortScore >= 3) {
        suggestions.push('Add comprehensive details including steps, requirements, and constraints to help with task planning');
      } else if (effortScore >= 2) {
        suggestions.push('Add more details including key steps and requirements to help with task planning');
      } else {
        suggestions.push('Add more details to help with task planning');
      }
    }
  }

  // Effort-aware suggestions for breaking down tasks
  if (!original.includes('?') && !original.includes('.')) {
    if (effortScore >= 4) {
      suggestions.push('Break down into detailed steps with specific questions and requirements');
    } else if (effortScore >= 3) {
      suggestions.push('Break down into specific steps, questions, and key considerations');
    } else {
      suggestions.push('Break down into specific steps or questions');
    }
  }

  // Build enhanced description (for now, just return original - enhancement can be applied by user)
  const enhanced = original;

  return {
    enhanced,
    suggestions,
    addedContext,
  };
}

/**
 * Generate domain-specific suggestions for empty descriptions
 * ENHANCED: Now uses extracted terms for more contextual suggestions
 * Uses effort score to adjust suggestion complexity
 */
function generateDomainSuggestions(
  domain: Domain,
  terminology: ReturnType<typeof getDomainTerminology>,
  keywords?: string[],
  phrases?: string[],
  verbs?: string[],
  nouns?: string[],
  effortScore: number = 2.5
): string[] {
  const suggestions: string[] = [];
  const allTerms = [...(keywords || []), ...(phrases || []), ...(verbs || []), ...(nouns || [])];
  const hasJobTerms = allTerms.some(t => ['job', 'work', 'employment', 'hours', 'time', 'log', 'login', 'platform', 'part', 'time'].includes(t.toLowerCase()));
  const hasLoginTerms = allTerms.some(t => ['login', 'log', 'access', 'account', 'password'].includes(t.toLowerCase()));

  // Context-aware suggestions based on extracted terms
  if (hasJobTerms && hasLoginTerms) {
    suggestions.push('Specify the platform name and login credentials needed');
    suggestions.push('Clarify what hours or information need to be logged');
    return suggestions;
  }

  // Adjust suggestion detail based on effort score
  const isHighEffort = effortScore >= 3;
  const isVeryHighEffort = effortScore >= 4;

  switch (domain) {
    case 'business':
      if (hasJobTerms) {
        if (isVeryHighEffort) {
          suggestions.push('Specify the platform or system to access, authentication requirements, and data security considerations');
          suggestions.push('Clarify what information needs to be tracked, recorded, and reported with detailed requirements');
        } else if (isHighEffort) {
          suggestions.push('Specify the platform or system to access and authentication requirements');
          suggestions.push('Clarify what information needs to be tracked or recorded with specific details');
        } else {
          suggestions.push('Specify the platform or system to access');
          suggestions.push('Clarify what information needs to be tracked or recorded');
        }
      } else {
        if (isVeryHighEffort) {
          suggestions.push('Add comprehensive project context, key stakeholders, deadlines, deliverables, and success criteria');
          suggestions.push('Include meeting participants, agenda items, action items, and follow-up requirements');
        } else if (isHighEffort) {
          suggestions.push('Add project context, stakeholders, deadlines, and deliverables');
          suggestions.push('Include meeting participants, agenda items, and action items');
        } else {
          suggestions.push('Add project context, stakeholders, and deadlines');
          suggestions.push('Include meeting participants or deliverables');
        }
      }
      break;

    case 'home':
      if (isVeryHighEffort) {
        suggestions.push('Specify location, supplies needed, time estimate, safety considerations, and cleanup requirements');
        suggestions.push('Include detailed preparation steps, tools required, and any special instructions');
      } else if (isHighEffort) {
        suggestions.push('Specify location, supplies needed, time estimate, and safety considerations');
        suggestions.push('Include preparation steps, tools required, and special instructions');
      } else {
        suggestions.push('Specify location, supplies needed, and time estimate');
        suggestions.push('Include any preparation steps or tools required');
      }
      break;

    case 'personal':
      if (hasJobTerms) {
        if (isHighEffort) {
          suggestions.push('Specify the job platform, login process, and account requirements');
          suggestions.push('Clarify what hours or time needs to be tracked with specific details');
        } else {
          suggestions.push('Specify the job platform and login process');
          suggestions.push('Clarify what hours or time needs to be tracked');
        }
      } else {
        if (isVeryHighEffort) {
          suggestions.push('Add duration, location, specific goals, resources needed, and success metrics');
          suggestions.push('Include detailed preparation steps, required resources, and any constraints');
        } else if (isHighEffort) {
          suggestions.push('Add duration, location, specific goals, and resources needed');
          suggestions.push('Include preparation steps, required resources, and constraints');
        } else {
          suggestions.push('Add duration, location, or specific goals');
          suggestions.push('Include any preparation or resources needed');
        }
      }
      break;

    case 'world':
      if (isHighEffort) {
        suggestions.push('Include time zones, locations, cultural context, and communication preferences');
        suggestions.push('Specify international coordination details, language considerations, and scheduling constraints');
      } else {
        suggestions.push('Include time zones, locations, and cultural context');
        suggestions.push('Specify international coordination details');
      }
      break;

    default:
      if (hasJobTerms || hasLoginTerms) {
        if (isHighEffort) {
          suggestions.push('Specify the platform, authentication method, and what needs to be logged');
          suggestions.push('Clarify the time period or hours to track with specific requirements');
        } else {
          suggestions.push('Specify the platform and what needs to be logged');
          suggestions.push('Clarify the time period or hours to track');
        }
      } else {
        if (isVeryHighEffort) {
          suggestions.push('Add comprehensive details about what needs to be done, including steps, requirements, and success criteria');
          suggestions.push('Include all constraints, deadlines, dependencies, and any special requirements');
        } else if (isHighEffort) {
          suggestions.push('Add details about what needs to be done, including key steps and requirements');
          suggestions.push('Include constraints, deadlines, and any special requirements');
        } else {
          suggestions.push('Add details about what needs to be done');
          suggestions.push('Include any constraints, deadlines, or requirements');
        }
      }
  }

  return suggestions;
}

/**
 * Extract key phrases and terminology from description
 * ENHANCED: Now uses domain terminology and sophisticated extraction methods
 */
export function extractKeyPhrases(description: string, title?: string): string[] {
  if (!description || description.trim().length === 0) {
    return [];
  }

  const fullText = title ? `${title} ${description}`.trim() : description.trim();
  
  // Detect domain for better phrase extraction
  const domainDetection = detectDomain(title || '', description);
  const domainTerms = getDomainTerminology(domainDetection.domain);

  // Use sophisticated extraction method
  // NOTE: For sync version, use local extraction (Browser AI API is async)
  const localExtracted = extractTermsFromTaskName(fullText, domainTerms);
  const extracted = {
    keywords: localExtracted.keywords,
    phrases: localExtracted.phrases,
    verbs: localExtracted.verbs,
    nouns: localExtracted.nouns,
    pronouns: localExtracted.pronouns,
    context: fullText,
  };
  
  // Enhance with domain terminology
  const enhanced = validateAndEnhanceTermsWithDictionary(
    extracted,
    fullText,
    domainTerms
  );

  // Return unique phrases, prioritizing domain phrases
  const uniquePhrases = Array.from(new Set(enhanced.phrases.map(p => p.toLowerCase())))
    .map(p => enhanced.phrases.find(ep => ep.toLowerCase() === p)!)
    .slice(0, DESCRIPTION_GENERATION_CONFIG.maxExtractedPhrases);

  return uniquePhrases;
}

