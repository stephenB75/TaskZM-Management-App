/**
 * Description Generator
 * 
 * Generates task descriptions based on task name using browser AI
 * with domain-specific terminology, keywords, verbs, and action words.
 */

import { detectDomain, type Domain, DOMAIN_TERMINOLOGY_MAP } from './domain-terminology';
import { TASK_BREAKDOWN_DEBOUNCE_MS } from './ai-config';

export interface GeneratedDescription {
  description: string;
  domain: Domain;
  confidence: number;
}

/**
 * Generates a task description based on task name
 * Uses domain detection and terminology to create context-aware descriptions
 */
export function generateDescription(taskName: string): GeneratedDescription {
  if (!taskName || taskName.trim().length === 0) {
    return {
      description: '',
      domain: 'personal',
      confidence: 0,
    };
  }

  // Detect domain from task name
  const domain = detectDomain(taskName);
  const domainTerms = DOMAIN_TERMINOLOGY_MAP[domain];

  // Extract keywords and verbs from task name
  const words = taskName.toLowerCase().split(/\s+/);
  const keywords = words.filter(word => 
    domainTerms.keywords.some(kw => kw.toLowerCase().includes(word) || word.includes(kw.toLowerCase()))
  );
  const verbs = words.filter(word =>
    domainTerms.verbs.some(v => v.toLowerCase().includes(word) || word.includes(v.toLowerCase()))
  );

  // Build description using domain-specific terminology
  let description = '';
  
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
  const confidence = Math.min(
    0.3 + (keywords.length * 0.2) + (verbs.length * 0.15),
    0.9
  );

  return {
    description,
    domain,
    confidence,
  };
}

