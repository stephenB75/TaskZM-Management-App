/**
 * Description Analyzer
 * 
 * Analyzes user input to extract context, enhance descriptions, and provide
 * domain-specific insights for task breakdown suggestions.
 */

import type { Task } from '../types';
import { detectDomain, type Domain, getDomainTerminology } from './domain-terminology';
import { analyzeTaskVerbs } from './verb-analysis';
import { DESCRIPTION_COMPLEXITY_THRESHOLDS } from './ai-config';
import { DEFAULT_TASK_STATUS } from './task-constants';

export interface DescriptionAnalysis {
  original: string;
  enhanced: string;
  suggestions: string[];
  addedContext: string[];
  detectedDomain: Domain;
  confidence: number;
  keywords: string[];
  verbs: string[];
  complexity: 'simple' | 'moderate' | 'complex';
}

/**
 * Analyze user input to extract verbs, keywords, phrases, and domain context
 */
export function analyzeDescription(
  title: string,
  description: string
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
      verbs: [],
      complexity: 'simple',
    };
  }

  // Detect domain
  const domainDetection = detectDomain(title, description);

  // Analyze verbs
  const tempTask: Partial<Task> = {
    title,
    description,
    status: DEFAULT_TASK_STATUS,
    priority: 'medium',
    tags: [],
  };
  const verbAnalysis = analyzeTaskVerbs(tempTask as Task);
  const primaryVerb = verbAnalysis.primaryVerb;

  // Extract keywords and verbs from text
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
    domainDetection.domain,
    domainDetection.keywords,
    primaryVerb
  );

  return {
    original,
    enhanced,
    suggestions,
    addedContext,
    detectedDomain: domainDetection.domain,
    confidence: domainDetection.confidence,
    keywords: domainDetection.keywords,
    verbs: primaryVerb !== 'unknown' ? [primaryVerb] : [],
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
 */
export function extractKeyPhrases(description: string): string[] {
  if (!description || description.trim().length === 0) {
    return [];
  }

  const phrases: string[] = [];
  const words = description.toLowerCase().split(/\s+/);

  // Extract 2-3 word phrases
  for (let i = 0; i < words.length - 1; i++) {
    const twoWord = `${words[i]} ${words[i + 1]}`;
    if (twoWord.length > DESCRIPTION_COMPLEXITY_THRESHOLDS.MIN_PHRASE_LENGTH) {
      phrases.push(twoWord);
    }

    if (i < words.length - 2) {
      const threeWord = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      if (threeWord.length > 8) {
        phrases.push(threeWord);
      }
    }
  }

  return phrases;
}

