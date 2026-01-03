/**
 * Domain-Specific Terminology Database
 * 
 * Provides comprehensive terminology maps for business, home, personal, and world scenarios
 * to enable context-aware task analysis and action plan generation.
 */

import {
  DOMAIN_DETECTION_THRESHOLDS,
  DOMAIN_SCORING_WEIGHTS,
} from './ai-config';

export type Domain = 'business' | 'home' | 'personal' | 'world' | 'mixed';

export interface DomainTerminology {
  keywords: string[];
  phrases: string[];
  verbs: string[];
  nouns: string[];
  pronouns: string[];
  context: Domain;
  effortMultiplier: number; // Adjust effort based on domain complexity
}

/**
 * Business Domain Terminology
 * Keywords, phrases, and verbs commonly used in business/professional contexts
 */
export const BUSINESS_TERMINOLOGY: DomainTerminology = {
  keywords: [
    'meeting', 'presentation', 'report', 'deadline', 'client', 'stakeholder', 'budget',
    'revenue', 'roi', 'kpi', 'quarterly', 'annual', 'project', 'milestone', 'deliverable',
    'strategy', 'analysis', 'forecast', 'proposal', 'contract', 'negotiation', 'deal',
    'sales', 'marketing', 'campaign', 'launch', 'product', 'service', 'customer',
    'team', 'collaboration', 'conference', 'workshop', 'training', 'onboarding',
    'review', 'audit', 'compliance', 'documentation', 'process', 'workflow',
    'efficiency', 'optimization', 'scalability', 'growth', 'expansion', 'merger',
    'acquisition', 'partnership', 'vendor', 'supplier', 'invoice', 'payment',
    'accounting', 'finance', 'investment', 'portfolio', 'risk', 'assessment'
  ],
  phrases: [
    'quarterly review', 'client call', 'project milestone', 'stakeholder update',
    'team meeting', 'status update', 'progress report', 'budget review',
    'strategic planning', 'business development', 'market analysis', 'competitive analysis',
    'product launch', 'go-to-market', 'sales pipeline', 'customer acquisition',
    'performance review', 'one-on-one', 'stand-up meeting', 'sprint planning',
    'retrospective', 'code review', 'technical debt', 'system architecture',
    'data analysis', 'financial report', 'quarterly earnings', 'annual planning'
  ],
  verbs: [
    'present', 'negotiate', 'strategize', 'analyze', 'forecast', 'delegate', 'coordinate',
    'collaborate', 'communicate', 'pitch', 'propose', 'approve', 'reject', 'review',
    'audit', 'assess', 'evaluate', 'optimize', 'scale', 'expand', 'launch', 'release',
    'deliver', 'execute', 'implement', 'manage', 'lead', 'facilitate', 'moderate',
    'document', 'report', 'track', 'monitor', 'measure', 'benchmark', 'improve'
  ],
  nouns: [
    'meeting', 'presentation', 'report', 'deadline', 'client', 'stakeholder', 'budget',
    'revenue', 'roi', 'kpi', 'quarter', 'project', 'milestone', 'deliverable',
    'strategy', 'analysis', 'forecast', 'proposal', 'contract', 'negotiation', 'deal',
    'sales', 'marketing', 'campaign', 'product', 'service', 'customer', 'team',
    'conference', 'workshop', 'training', 'review', 'audit', 'compliance', 'documentation',
    'process', 'workflow', 'efficiency', 'optimization', 'growth', 'expansion', 'merger',
    'acquisition', 'partnership', 'vendor', 'supplier', 'invoice', 'payment', 'finance'
  ],
  pronouns: [
    'we', 'us', 'our', 'ours', 'ourselves', 'they', 'them', 'their', 'theirs', 'themselves',
    'you', 'your', 'yours', 'yourself', 'yourselves', 'it', 'its', 'itself'
  ],
  context: 'business',
  effortMultiplier: 1.0, // Base multiplier for business tasks
};

/**
 * Home Domain Terminology
 * Keywords, phrases, and verbs commonly used in home/maintenance contexts
 */
export const HOME_TERMINOLOGY: DomainTerminology = {
  keywords: [
    'groceries', 'cleaning', 'maintenance', 'repair', 'cooking', 'laundry', 'organizing',
    'decluttering', 'yard', 'garden', 'landscaping', 'plumbing', 'electrical', 'appliance',
    'furniture', 'decoration', 'renovation', 'remodeling', 'painting', 'flooring',
    'roofing', 'siding', 'windows', 'doors', 'heating', 'cooling', 'hvac',
    'insurance', 'mortgage', 'utilities', 'bills', 'taxes', 'homeowner', 'property',
    'supplies', 'shopping', 'meal prep', 'meal planning', 'deep clean', 'spring cleaning',
    'holiday prep', 'seasonal', 'maintenance schedule', 'home improvement', 'diy'
  ],
  phrases: [
    'home improvement', 'deep clean', 'meal prep', 'yard work', 'garden maintenance',
    'spring cleaning', 'holiday preparation', 'home maintenance', 'appliance repair',
    'room organization', 'closet organization', 'garage cleanup', 'attic organization',
    'basement cleanup', 'exterior maintenance', 'interior decoration', 'furniture assembly',
    'light fixture installation', 'plumbing repair', 'electrical work', 'painting project',
    'flooring installation', 'window replacement', 'door repair', 'roof inspection',
    'gutter cleaning', 'driveway repair', 'fence maintenance', 'shed organization'
  ],
  verbs: [
    'clean', 'organize', 'repair', 'maintain', 'cook', 'shop', 'decorate', 'renovate',
    'remodel', 'paint', 'install', 'assemble', 'disassemble', 'fix', 'replace',
    'upgrade', 'refurbish', 'restore', 'refinish', 'polish', 'wax', 'seal',
    'caulk', 'grout', 'tile', 'sand', 'stain', 'varnish', 'prune', 'trim',
    'mow', 'weed', 'plant', 'harvest', 'water', 'fertilize', 'mulch', 'rake'
  ],
  nouns: [
    'groceries', 'cleaning', 'maintenance', 'repair', 'cooking', 'laundry', 'organization',
    'yard', 'garden', 'landscaping', 'plumbing', 'electrical', 'appliance', 'furniture',
    'decoration', 'renovation', 'remodeling', 'painting', 'flooring', 'roofing', 'siding',
    'windows', 'doors', 'heating', 'cooling', 'hvac', 'insurance', 'mortgage', 'utilities',
    'bills', 'taxes', 'homeowner', 'property', 'supplies', 'shopping', 'meal', 'prep',
    'room', 'closet', 'garage', 'attic', 'basement', 'exterior', 'interior', 'fixture'
  ],
  pronouns: [
    'i', 'me', 'my', 'mine', 'myself', 'we', 'us', 'our', 'ours', 'ourselves',
    'you', 'your', 'yours', 'yourself', 'yourselves', 'it', 'its', 'itself'
  ],
  context: 'home',
  effortMultiplier: 0.9, // Slightly lower effort for home tasks (often more straightforward)
};

/**
 * Personal Domain Terminology
 * Keywords, phrases, and verbs commonly used in personal/self-care contexts
 */
export const PERSONAL_TERMINOLOGY: DomainTerminology = {
  keywords: [
    'exercise', 'workout', 'fitness', 'health', 'wellness', 'hobby', 'learning',
    'travel', 'family', 'friends', 'social', 'self-care', 'meditation', 'yoga',
    'reading', 'writing', 'creative', 'art', 'music', 'photography', 'cooking',
    'baking', 'crafting', 'sewing', 'knitting', 'gardening', 'sports', 'running',
    'cycling', 'swimming', 'hiking', 'camping', 'outdoor', 'adventure', 'exploration',
    'education', 'course', 'class', 'workshop', 'seminar', 'conference', 'event',
    'celebration', 'birthday', 'anniversary', 'holiday', 'vacation', 'trip',
    'therapy', 'counseling', 'coaching', 'mentoring', 'volunteering', 'charity'
  ],
  phrases: [
    'workout routine', 'personal project', 'self-care', 'skill development',
    'fitness goal', 'health checkup', 'doctor appointment', 'dental cleaning',
    'therapy session', 'coaching session', 'learning course', 'online class',
    'book club', 'hobby project', 'creative project', 'art project', 'music practice',
    'exercise routine', 'meal planning', 'nutrition planning', 'meditation practice',
    'yoga session', 'running training', 'cycling training', 'swimming practice',
    'hiking trip', 'camping trip', 'road trip', 'vacation planning', 'travel planning',
    'family time', 'date night', 'social event', 'birthday party', 'anniversary celebration',
    'holiday celebration', 'volunteer work', 'community service', 'charity event'
  ],
  verbs: [
    'exercise', 'workout', 'train', 'practice', 'learn', 'study', 'read', 'write',
    'create', 'make', 'build', 'craft', 'paint', 'draw', 'sketch', 'design',
    'play', 'perform', 'practice', 'rehearse', 'cook', 'bake', 'prepare',
    'travel', 'explore', 'visit', 'discover', 'experience', 'enjoy', 'relax',
    'meditate', 'reflect', 'journal', 'plan', 'organize', 'schedule', 'coordinate',
    'socialize', 'connect', 'meet', 'celebrate', 'volunteer', 'help', 'support'
  ],
  nouns: [
    'exercise', 'workout', 'fitness', 'health', 'wellness', 'hobby', 'learning',
    'travel', 'family', 'friends', 'social', 'self-care', 'meditation', 'yoga',
    'reading', 'writing', 'creative', 'art', 'music', 'photography', 'cooking',
    'baking', 'crafting', 'sewing', 'knitting', 'gardening', 'sports', 'running',
    'cycling', 'swimming', 'hiking', 'camping', 'outdoor', 'adventure', 'exploration',
    'education', 'course', 'class', 'workshop', 'seminar', 'conference', 'event',
    'celebration', 'birthday', 'anniversary', 'holiday', 'vacation', 'trip',
    'therapy', 'counseling', 'coaching', 'mentoring', 'volunteering', 'charity'
  ],
  pronouns: [
    'i', 'me', 'my', 'mine', 'myself', 'we', 'us', 'our', 'ours', 'ourselves',
    'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself',
    'she', 'her', 'hers', 'herself', 'they', 'them', 'their', 'theirs', 'themselves'
  ],
  context: 'personal',
  effortMultiplier: 0.85, // Personal tasks often have more flexibility
};

/**
 * World/Global Domain Terminology
 * Keywords, phrases, and verbs commonly used in global/international contexts
 */
export const WORLD_TERMINOLOGY: DomainTerminology = {
  keywords: [
    'travel', 'trip', 'journey', 'voyage', 'expedition', 'culture', 'cultural',
    'language', 'translation', 'international', 'global', 'worldwide', 'overseas',
    'abroad', 'foreign', 'immigration', 'visa', 'passport', 'customs', 'border',
    'timezone', 'time zone', 'currency', 'exchange', 'conversion', 'exchange rate',
    'international call', 'video call', 'conference call', 'remote meeting',
    'cross-cultural', 'multicultural', 'diversity', 'inclusion', 'globalization',
    'international business', 'global market', 'world news', 'current events',
    'geography', 'country', 'nation', 'continent', 'region', 'climate', 'weather',
    'time difference', 'jet lag', 'accommodation', 'hotel', 'reservation', 'booking'
  ],
  phrases: [
    'travel planning', 'cultural event', 'international call', 'time zone conversion',
    'passport renewal', 'visa application', 'travel insurance', 'flight booking',
    'hotel reservation', 'car rental', 'travel itinerary', 'sightseeing', 'tour',
    'cultural exchange', 'language learning', 'translation work', 'international project',
    'global team', 'remote collaboration', 'cross-border', 'international shipping',
    'currency exchange', 'foreign exchange', 'exchange rate', 'international payment',
    'world news', 'current events', 'global trends', 'international relations',
    'climate change', 'environmental', 'sustainability', 'global warming'
  ],
  verbs: [
    'travel', 'explore', 'discover', 'visit', 'tour', 'sightsee', 'experience',
    'immerse', 'adapt', 'adjust', 'acclimate', 'navigate', 'orient', 'locate',
    'translate', 'interpret', 'communicate', 'connect', 'network', 'collaborate',
    'coordinate', 'synchronize', 'schedule', 'plan', 'book', 'reserve', 'confirm',
    'cancel', 'modify', 'update', 'track', 'monitor', 'manage', 'organize'
  ],
  nouns: [
    'travel', 'trip', 'journey', 'voyage', 'expedition', 'culture', 'language',
    'translation', 'international', 'global', 'worldwide', 'overseas', 'abroad',
    'foreign', 'immigration', 'visa', 'passport', 'customs', 'border', 'timezone',
    'time zone', 'currency', 'exchange', 'conversion', 'exchange rate', 'call',
    'video call', 'conference call', 'remote meeting', 'cross-cultural', 'multicultural',
    'diversity', 'inclusion', 'globalization', 'international business', 'global market',
    'world news', 'current events', 'geography', 'country', 'nation', 'continent',
    'region', 'climate', 'weather', 'time difference', 'jet lag', 'accommodation',
    'hotel', 'reservation', 'booking', 'flight', 'itinerary', 'sightseeing', 'tour'
  ],
  pronouns: [
    'i', 'me', 'my', 'mine', 'myself', 'we', 'us', 'our', 'ours', 'ourselves',
    'you', 'your', 'yours', 'yourself', 'yourselves', 'they', 'them', 'their',
    'theirs', 'themselves', 'it', 'its', 'itself'
  ],
  context: 'world',
  effortMultiplier: 1.1, // Slightly higher effort for global tasks (complexity, time zones, etc.)
};

/**
 * All domain terminologies
 */
export const DOMAIN_TERMINOLOGIES: Record<Domain, DomainTerminology> = {
  business: BUSINESS_TERMINOLOGY,
  home: HOME_TERMINOLOGY,
  personal: PERSONAL_TERMINOLOGY,
  world: WORLD_TERMINOLOGY,
  mixed: {
    keywords: [],
    phrases: [],
    verbs: [],
    nouns: [],
    pronouns: [],
    context: 'mixed',
    effortMultiplier: 1.0,
  },
};

/**
 * Detect domain from text by matching keywords, phrases, and verbs
 * Returns the domain with highest confidence score
 */
export function detectDomain(
  title: string,
  description: string
): {
  domain: Domain;
  confidence: number;
  keywords: string[];
  matchedTerms: {
    business: number;
    home: number;
    personal: number;
    world: number;
  };
} {
  const text = `${title} ${description}`.toLowerCase().trim();
  
  if (!text || text.length === 0) {
    return {
      domain: 'personal',
      confidence: 0,
      keywords: [],
      matchedTerms: { business: 0, home: 0, personal: 0, world: 0 },
    };
  }

  const matchedTerms = {
    business: 0,
    home: 0,
    personal: 0,
    world: 0,
  };

  const foundKeywords: string[] = [];

  // Check each domain
  for (const [domainKey, terminology] of Object.entries(DOMAIN_TERMINOLOGIES)) {
    if (domainKey === 'mixed') continue;

    const domain = domainKey as Exclude<Domain, 'mixed'>;

    // Check keywords (weight: 1 point each)
    for (const keyword of terminology.keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(text)) {
        matchedTerms[domain] += DOMAIN_SCORING_WEIGHTS.KEYWORD;
        if (!foundKeywords.includes(keyword)) {
          foundKeywords.push(keyword);
        }
      }
    }

    // Check phrases (weight: 2 points each - more specific)
    for (const phrase of terminology.phrases) {
      const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      if (regex.test(text)) {
        matchedTerms[domain] += DOMAIN_SCORING_WEIGHTS.PHRASE;
        if (!foundKeywords.includes(phrase)) {
          foundKeywords.push(phrase);
        }
      }
    }

    // Check verbs (weight: 1.5 points each - action-oriented)
    for (const verb of terminology.verbs) {
      const regex = new RegExp(`\\b${verb}\\w*\\b`, 'i');
      if (regex.test(text)) {
        matchedTerms[domain] += DOMAIN_SCORING_WEIGHTS.VERB;
        if (!foundKeywords.includes(verb)) {
          foundKeywords.push(verb);
        }
      }
    }
  }

  // Find domain with highest score
  const scores = Object.entries(matchedTerms) as Array<[Domain, number]>;
  const maxScore = Math.max(...scores.map(([, score]) => score));
  const totalScore = scores.reduce((sum, [, score]) => sum + score, 0);

  // If no matches or very low scores, default to personal
  if (maxScore === 0 || totalScore < 1) {
    return {
      domain: 'personal',
      confidence: DOMAIN_DETECTION_THRESHOLDS.MIN_CONFIDENCE,
      keywords: foundKeywords,
      matchedTerms,
    };
  }

  // Find the winning domain
  const winningDomain = scores.find(([, score]) => score === maxScore)?.[0] || 'personal';

  // Calculate confidence (0-1 scale)
  // Higher confidence if one domain clearly dominates
  const confidence = totalScore > 0 ? maxScore / totalScore : DOMAIN_DETECTION_THRESHOLDS.MIN_CONFIDENCE;

  // If confidence is low (<0.4) and multiple domains have similar scores, mark as mixed
  const secondHighest = scores
    .filter(([domain]) => domain !== winningDomain)
    .sort(([, a], [, b]) => b - a)[0]?.[1] || 0;

  const finalDomain: Domain =
    confidence < DOMAIN_DETECTION_THRESHOLDS.MIXED_THRESHOLD &&
    secondHighest > maxScore * DOMAIN_DETECTION_THRESHOLDS.MIXED_SIMILARITY
      ? 'mixed'
      : (winningDomain as Domain);

  return {
    domain: finalDomain,
    confidence: Math.min(1.0, confidence),
    keywords: foundKeywords,
    matchedTerms,
  };
}

/**
 * Get domain-specific terminology
 */
export function getDomainTerminology(domain: Domain): DomainTerminology {
  return DOMAIN_TERMINOLOGIES[domain] || DOMAIN_TERMINOLOGIES.personal;
}

/**
 * Check if a word/phrase matches any domain terminology
 */
export function matchesDomainTerminology(
  text: string,
  domain: Domain
): boolean {
  const terminology = getDomainTerminology(domain);
  const lowerText = text.toLowerCase();

  // Check keywords
  if (terminology.keywords.some(kw => lowerText.includes(kw.toLowerCase()))) {
    return true;
  }

  // Check phrases
  if (terminology.phrases.some(phrase => lowerText.includes(phrase.toLowerCase()))) {
    return true;
  }

  // Check verbs
  if (terminology.verbs.some(verb => {
    const regex = new RegExp(`\\b${verb}\\w*\\b`, 'i');
    return regex.test(lowerText);
  })) {
    return true;
  }

  return false;
}

