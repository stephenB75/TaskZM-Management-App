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
import { DEFAULT_TASK_STATUS } from './task-constants';
import { extractTermsFromTaskNameWithBrowserAI, validateAndEnhanceTermsWithDictionary } from './description-generator';
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
 */
export function analyzeDescription(
  title: string,
  description: string,
  aiContext?: AIContext
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
  let domain: Domain;
  let domainConfidence: number;
  let uniqueKeywords: string[];
  let uniquePhrases: string[];
  let uniqueVerbs: string[];
  let uniqueNouns: string[];
  let domainTerms: ReturnType<typeof getDomainTerminology>;

  if (aiContext) {
    // Use shared context (no redundant work)
    domain = aiContext.domain;
    domainConfidence = aiContext.domainConfidence;
    uniqueKeywords = aiContext.enhancedTerms.keywords;
    uniquePhrases = aiContext.enhancedTerms.phrases;
    uniqueVerbs = aiContext.enhancedTerms.verbs;
    uniqueNouns = aiContext.enhancedTerms.nouns;
    domainTerms = aiContext.domainTerms;
  } else {
    // Fallback: detect and extract independently (backward compatibility)
    const domainDetection = detectDomain(title, description);
    domain = domainDetection.domain;
    domainConfidence = domainDetection.confidence;
    domainTerms = getDomainTerminology(domain);

    // ENHANCED: Use sophisticated extraction methods from description-generator
    // Extract terms from both title and description for comprehensive analysis
    const titleExtracted = extractTermsFromTaskNameWithBrowserAI(title, domainTerms);
    const descriptionExtracted = description.trim().length > 0 
      ? extractTermsFromTaskNameWithBrowserAI(description, domainTerms)
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

  // Generate enhanced description
  const { enhanced, suggestions, addedContext } = enhanceDescription(
    original,
    domain,
    uniqueKeywords,
    primaryVerb
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
 */
function enhanceDescription(
  original: string,
  domain: Domain,
  keywords: string[],
  primaryVerb: string
): {
  enhanced: string;
  suggestions: string[];
  addedContext: string[];
} {
  if (!original || original.trim().length === 0) {
    // For empty descriptions, suggest based on domain
    const terminology = getDomainTerminology(domain);
    const suggestions = generateDomainSuggestions(domain, terminology);
    return {
      enhanced: original,
      suggestions,
      addedContext: [],
    };
  }

  const suggestions: string[] = [];
  const addedContext: string[] = [];

  // Domain-specific enhancements
  switch (domain) {
    case 'business':
      if (!original.toLowerCase().includes('deadline') && keywords.some(k => ['project', 'report', 'presentation'].includes(k))) {
        suggestions.push('Consider adding a deadline or timeline');
      }
      if (!original.toLowerCase().includes('stakeholder') && keywords.some(k => ['client', 'team', 'project'].includes(k))) {
        suggestions.push('Mention key stakeholders or participants');
      }
      if (primaryVerb === 'present' || primaryVerb === 'meet') {
        addedContext.push('Meeting preparation and follow-up actions');
      }
      break;

    case 'home':
      if (keywords.some(k => ['repair', 'maintenance', 'fix'].includes(k))) {
        suggestions.push('List any supplies or tools needed');
      }
      if (keywords.some(k => ['cleaning', 'organize'].includes(k))) {
        suggestions.push('Specify which areas or rooms');
      }
      if (keywords.some(k => ['cooking', 'meal'].includes(k))) {
        suggestions.push('Include ingredients or recipe details');
      }
      break;

    case 'personal':
      if (keywords.some(k => ['exercise', 'workout', 'fitness'].includes(k))) {
        suggestions.push('Specify duration or type of workout');
      }
      if (keywords.some(k => ['travel', 'trip'].includes(k))) {
        suggestions.push('Include destination or travel details');
      }
      if (keywords.some(k => ['learning', 'course', 'study'].includes(k))) {
        suggestions.push('Mention specific topics or resources');
      }
      break;

    case 'world':
      if (keywords.some(k => ['travel', 'trip', 'journey'].includes(k))) {
        suggestions.push('Include time zones and cultural considerations');
      }
      if (keywords.some(k => ['call', 'meeting', 'conference'].includes(k))) {
        suggestions.push('Specify time zone for international coordination');
      }
      break;
  }

  // General enhancements
  if (original.length < DESCRIPTION_COMPLEXITY_THRESHOLDS.MIN_DESCRIPTION_LENGTH) {
    suggestions.push('Add more details to help with task planning');
  }

  if (!original.includes('?') && !original.includes('.')) {
    suggestions.push('Break down into specific steps or questions');
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
 */
function generateDomainSuggestions(
  domain: Domain,
  terminology: ReturnType<typeof getDomainTerminology>
): string[] {
  const suggestions: string[] = [];

  switch (domain) {
    case 'business':
      suggestions.push('Add project context, stakeholders, and deadlines');
      suggestions.push('Include meeting participants or deliverables');
      break;

    case 'home':
      suggestions.push('Specify location, supplies needed, and time estimate');
      suggestions.push('Include any preparation steps or tools required');
      break;

    case 'personal':
      suggestions.push('Add duration, location, or specific goals');
      suggestions.push('Include any preparation or resources needed');
      break;

    case 'world':
      suggestions.push('Include time zones, locations, and cultural context');
      suggestions.push('Specify international coordination details');
      break;

    default:
      suggestions.push('Add details about what needs to be done');
      suggestions.push('Include any constraints, deadlines, or requirements');
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
  const extracted = extractTermsFromTaskNameWithBrowserAI(fullText, domainTerms);
  
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

