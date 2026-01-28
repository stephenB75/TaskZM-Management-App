/**
 * Action Plan Generator
 * 
 * Generates structured action plans from task descriptions using context-aware
 * analysis to break down complex tasks into logical steps.
 */

import type { Task } from '../types';
import { detectDomain, type Domain, getDomainTerminology } from './domain-terminology';
import { analyzeTaskVerbs } from './verb-analysis';
import { estimateTaskHours } from './daily-hours-utils';
import { MINUTES_PER_HOUR, DEFAULT_PROJECT_ID } from './business-constants';
import { ACTION_PLAN_TIME_DISTRIBUTION, SEQUENTIAL_INDICATORS, DESCRIPTION_GENERATION_CONFIG, ACTION_PLAN_CONFIG, EFFORT_SCORE_THRESHOLDS } from './ai-config';
import { DEFAULT_TASK_STATUS, DEFAULT_TASK_PRIORITY, DEFAULT_TASK_DOMAIN, DEFAULT_CREATED_BY } from './task-constants';
import { extractTermsFromTaskNameWithBrowserAI, extractTermsFromTaskName } from './description-generator';
import type { AIContext } from './ai-context';

export interface ActionPlanStep {
  action: string;
  estimatedMinutes: number;
  dependencies?: string[];
  category: 'preparation' | 'execution' | 'follow-up';
  order: number;
}

export interface ActionPlan {
  steps: ActionPlanStep[];
  totalEstimatedMinutes: number;
  suggestedSubtasks: string[];
  context: Domain;
  confidence: number;
}

/**
 * Generate action plan from task description
 * ENHANCED: Now uses effort score from AIContext to adjust step complexity and detail
 * 
 * @param task - Task to generate action plan for
 * @param aiContext - Optional shared AI context (if provided, uses it instead of re-detecting/re-extracting)
 */
export function generateActionPlan(
  task: Task | Partial<Task>,
  aiContext?: AIContext
): ActionPlan {
  const title = (task.title || '').trim();
  const description = (task.description || '').trim();
  const fullText = `${title} ${description}`.trim();

  if (!fullText || fullText.length === 0) {
    // Even for empty tasks, return at least one default step to ensure action plan displays
    return {
      steps: [{
        action: ACTION_PLAN_CONFIG.DEFAULT_STEP_ACTION,
        estimatedMinutes: ACTION_PLAN_CONFIG.DEFAULT_MINUTES,
        category: 'execution' as const,
        order: 1,
      }],
      totalEstimatedMinutes: ACTION_PLAN_CONFIG.DEFAULT_MINUTES,
      suggestedSubtasks: [],
      context: DEFAULT_TASK_DOMAIN,
      confidence: 0,
    };
  }

  // Use shared context if provided, otherwise detect/extract independently
  let domain: Domain;
  let domainConfidence: number;
  let terminology: ReturnType<typeof getDomainTerminology>;
  let extractedTerms: ReturnType<typeof extractTermsFromTaskNameWithBrowserAI>;

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
    terminology = aiContext.domainTerms || getDomainTerminology(domain);
    // Use AIContext extracted terms if available, otherwise do quick local extraction (sync fallback)
    extractedTerms = aiContext.extractedTerms || (() => {
      const localExtracted = extractTermsFromTaskName(fullText, terminology);
      return {
        keywords: localExtracted.keywords,
        phrases: localExtracted.phrases,
        verbs: localExtracted.verbs,
        nouns: localExtracted.nouns,
        pronouns: localExtracted.pronouns,
        context: fullText,
      };
    })();
  } else {
    // Fallback: detect and extract independently (backward compatibility)
    const domainDetection = detectDomain(title, description);
    domain = domainDetection.domain;
    domainConfidence = domainDetection.confidence;
    terminology = getDomainTerminology(domain);
    // Quick local extraction for sync version
    const localExtracted = extractTermsFromTaskName(fullText, terminology);
    extractedTerms = {
      keywords: localExtracted.keywords,
      phrases: localExtracted.phrases,
      verbs: localExtracted.verbs,
      nouns: localExtracted.nouns,
      pronouns: localExtracted.pronouns,
      context: fullText,
    };
  }

  // Estimate total time
  const taskForEstimation: Task = {
    id: task.id || 'temp', // Temporary ID for estimation (not a constant as it's a placeholder)
    title,
    description,
    status: (task.status as any) || DEFAULT_TASK_STATUS,
    priority: (task.priority as any) || DEFAULT_TASK_PRIORITY,
    tags: task.tags || [],
    createdAt: task.createdAt || new Date().toISOString(),
    updatedAt: task.updatedAt || new Date().toISOString(),
    projectId: task.projectId || DEFAULT_PROJECT_ID,
    folderId: task.folderId || null,
    dueDate: task.dueDate || null,
    scheduledDate: task.scheduledDate || null,
    estimatedTime: task.estimatedTime || null,
    actualTime: task.actualTime || null,
    dependencies: task.dependencies || [],
    subtasks: task.subtasks || [],
    recurrence: task.recurrence || { type: 'none', interval: 1 },
    notes: task.notes || '',
    assignedTo: task.assignedTo || [],
    createdBy: task.createdBy || DEFAULT_CREATED_BY,
    completedAt: task.completedAt || null,
  };

  const totalHours = estimateTaskHours(taskForEstimation);
  const totalMinutes = Math.round(totalHours * MINUTES_PER_HOUR);

  // Generate steps based on domain and description
  // ENHANCED: Pass effort score and enhanced terms for better coordination
  const effortScore = aiContext?.effortScore;
  const steps = generateSteps(
    title,
    description,
    domain,
    terminology,
    totalMinutes,
    extractedTerms,
    aiContext?.enhancedTerms,
    effortScore
  );

  // Generate suggested subtasks
  const suggestedSubtasks = generateSubtasks(
    title,
    description,
    domain,
    terminology,
    extractedTerms
  );

  // Ensure we always have at least one step (safety check)
  const finalSteps = steps.length > 0 ? steps : [{
    action: title || ACTION_PLAN_CONFIG.DEFAULT_STEP_ACTION,
    estimatedMinutes: totalMinutes > 0 ? totalMinutes : ACTION_PLAN_CONFIG.DEFAULT_MINUTES,
    category: 'execution' as const,
    order: 1,
  }];

  return {
    steps: finalSteps,
    totalEstimatedMinutes: totalMinutes > 0 ? totalMinutes : finalSteps.reduce((sum, step) => sum + step.estimatedMinutes, 0),
    suggestedSubtasks,
    context: domain,
    confidence: domainConfidence,
  };
}

/**
 * Generate action plan steps based on domain and description
 * ENHANCED: Uses effort score and enhanced terms for coordinated intelligence
 * Uses Browser AI extracted terms + enhanced terms for context-aware step generation
 * 
 * @param effortScore - Optional effort score (1-5) to adjust step complexity and detail
 * @param enhancedTerms - Optional enhanced terms from AIContext for better coordination
 */
function generateSteps(
  title: string,
  description: string,
  domain: Domain,
  terminology: ReturnType<typeof getDomainTerminology>,
  totalMinutes: number,
  extractedTerms?: ReturnType<typeof extractTermsFromTaskNameWithBrowserAI>,
  enhancedTerms?: AIContext['enhancedTerms'],
  effortScore?: number
): ActionPlanStep[] {
  const steps: ActionPlanStep[] = [];
  const fullText = `${title} ${description}`.trim();
  const text = fullText.toLowerCase();

  // Use provided extracted terms or extract them (sync fallback for when async Browser AI cannot be used)
  // NOTE: If extractedTerms is provided from AIContext, it already includes Browser AI terms (from async createAIContext)
  // If not provided, use sync local extraction (Browser AI would require async/await which isn't available here)
  const terms = extractedTerms || (() => {
    const localExtracted = extractTermsFromTaskName(fullText, terminology);
    return {
      keywords: localExtracted.keywords,
      phrases: localExtracted.phrases,
      verbs: localExtracted.verbs,
      nouns: localExtracted.nouns,
      pronouns: localExtracted.pronouns,
      context: fullText,
    };
  })();
  const { keywords, phrases, verbs, nouns } = terms;
  
  // Log confirmation that both Browser AI and Local Terminology are being used
  if (keywords.length > 0 || phrases.length > 0 || verbs.length > 0 || nouns.length > 0) {
    console.debug(`✅ AI Action Plan: Using Browser AI + Local Terminology`, {
      domain,
      keywordsCount: keywords.length,
      phrasesCount: phrases.length,
      verbsCount: verbs.length,
      nounsCount: nouns.length,
      terminologyPhrasesCount: terminology.phrases.length,
      terminologyVerbsCount: terminology.verbs.length,
      terminologyNounsCount: terminology.nouns.length,
      sampleKeywords: keywords.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.keywordsLogging),
      samplePhrases: phrases.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.phrasesLogging),
      sampleVerbs: verbs.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.verbsLogging),
      sampleNouns: nouns.slice(0, DESCRIPTION_GENERATION_CONFIG.sliceLimits.nounsLogging),
    });
  }

  // Analyze for sequential indicators using extracted terms
  const hasSequence = SEQUENTIAL_INDICATORS.some(indicator => text.includes(indicator)) ||
                      keywords.some(kw => SEQUENTIAL_INDICATORS.some(ind => kw.includes(ind))) ||
                      phrases.some(ph => SEQUENTIAL_INDICATORS.some(ind => ph.includes(ind)));

  // ENHANCED: Domain-specific step generation using Browser AI extracted terms + enhanced terms
  // Pass effort score to adjust step complexity and detail level
  switch (domain) {
    case 'business':
      steps.push(...generateBusinessSteps(text, keywords, phrases, verbs, nouns, totalMinutes, hasSequence, effortScore));
      break;

    case 'home':
      steps.push(...generateHomeSteps(text, keywords, phrases, verbs, nouns, totalMinutes, hasSequence, effortScore));
      break;

    case 'personal':
      steps.push(...generatePersonalSteps(text, keywords, phrases, verbs, nouns, totalMinutes, hasSequence, effortScore));
      break;

    case 'world':
      steps.push(...generateWorldSteps(text, keywords, phrases, verbs, nouns, totalMinutes, hasSequence, effortScore));
      break;

    default:
      steps.push(...generateGenericSteps(text, keywords, phrases, verbs, nouns, totalMinutes, hasSequence, effortScore));
  }

  // If no steps generated, create a default step
  if (steps.length === 0) {
    // Ensure we always have at least one step, even if totalMinutes is 0
    const defaultMinutes = totalMinutes > 0 ? totalMinutes : ACTION_PLAN_CONFIG.DEFAULT_MINUTES;
    steps.push({
      action: title || ACTION_PLAN_CONFIG.DEFAULT_STEP_ACTION,
      estimatedMinutes: defaultMinutes,
      category: 'execution',
      order: 1,
    });
  }

  // Ensure total minutes match (distribute proportionally)
  const currentTotal = steps.reduce((sum, step) => sum + step.estimatedMinutes, 0);
  if (currentTotal !== totalMinutes && currentTotal > 0 && totalMinutes > 0) {
    const ratio = totalMinutes / currentTotal;
    steps.forEach(step => {
      step.estimatedMinutes = Math.round(step.estimatedMinutes * ratio);
    });
  } else if (totalMinutes === 0 && currentTotal > 0) {
    // If totalMinutes is 0 but we have steps, set a minimum time for each step
    const minMinutesPerStep = Math.max(
      ACTION_PLAN_CONFIG.MIN_MINUTES_PER_STEP,
      Math.floor(ACTION_PLAN_CONFIG.DEFAULT_MINUTES / steps.length)
    );
    steps.forEach(step => {
      step.estimatedMinutes = Math.max(minMinutesPerStep, step.estimatedMinutes);
    });
  }

  return steps;
}

/**
 * Generate business-specific steps using Browser AI extracted terms
 * ENHANCED: Uses effort score to adjust step complexity and detail
 */
function generateBusinessSteps(
  text: string,
  keywords: string[],
  phrases: string[],
  verbs: string[],
  nouns: string[],
  totalMinutes: number,
  hasSequence: boolean,
  effortScore?: number
): ActionPlanStep[] {
  const steps: ActionPlanStep[] = [];
  let order = 1;

  // Helper function to check if terms match business concepts
  const hasMeetingTerms = (terms: string[]) => terms.some(term => 
    ['meeting', 'presentation', 'call', 'conference', 'discuss', 'present'].some(match => 
      term.toLowerCase().includes(match)
    )
  );
  const hasReportTerms = (terms: string[]) => terms.some(term => 
    ['report', 'analysis', 'review', 'document', 'analyze', 'evaluate'].some(match => 
      term.toLowerCase().includes(match)
    )
  );

  // Check using Browser AI extracted terms (keywords, phrases, verbs, nouns)
  const hasMeeting = text.includes('meeting') || text.includes('presentation') || text.includes('call') ||
                     hasMeetingTerms(keywords) || hasMeetingTerms(phrases) || hasMeetingTerms(verbs);
  const hasReport = text.includes('report') || text.includes('analysis') || text.includes('review') ||
                    hasReportTerms(keywords) || hasReportTerms(phrases) || hasReportTerms(verbs);

  // Preparation steps
  if (hasMeeting) {
    steps.push({
      action: 'Prepare materials and agenda',
      estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.PREPARATION.BUSINESS_MEETING),
      category: 'preparation',
      order: order++,
    });
  }

  if (hasReport) {
    steps.push({
      action: 'Gather data and information',
      estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.PREPARATION.BUSINESS_REPORT),
      category: 'preparation',
      order: order++,
    });
  }

  // ENHANCED: Execution step - use extracted verbs and effort score for more intelligent action
  const executionMinutes = Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.EXECUTION.BUSINESS);
  
  // Higher effort = more detailed action descriptions using keywords/phrases
  let executionAction: string;
  if (effortScore && effortScore >= EFFORT_SCORE_THRESHOLDS.VERY_HIGH && phrases.length > 0) {
    // Very high effort: use contextual phrases for detailed action
    executionAction = `${verbs.length > 0 ? verbs[0].charAt(0).toUpperCase() + verbs[0].slice(1) : 'Execute'} ${phrases[0] || (nouns.length > 0 ? nouns[0] : 'main task')}`;
  } else if (effortScore && effortScore >= EFFORT_SCORE_THRESHOLDS.HIGH && keywords.length > 0 && nouns.length > 0) {
    // High effort: combine verb + keyword + noun for context
    executionAction = `${verbs.length > 0 ? verbs[0].charAt(0).toUpperCase() + verbs[0].slice(1) : 'Execute'} ${keywords[0]} ${nouns[0]}`;
  } else if (verbs.length > 0 && verbs[0]) {
    // Medium/low effort: use verb + noun
    executionAction = `${verbs[0].charAt(0).toUpperCase() + verbs[0].slice(1)} ${nouns.length > 0 ? nouns[0] : 'main task'}`;
  } else {
    executionAction = 'Execute main task';
  }
  
  steps.push({
    action: executionAction,
    estimatedMinutes: executionMinutes,
    category: 'execution',
    order: order++,
  });

  // Follow-up steps
  if (hasMeeting) {
    steps.push({
      action: 'Send follow-up notes or action items',
      estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.FOLLOW_UP.BUSINESS_MEETING),
      category: 'follow-up',
      order: order++,
      dependencies: [`step-${order - 1}`],
    });
  }

  if (hasReport || text.includes('document')) {
    steps.push({
      action: 'Review and finalize',
      estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.FOLLOW_UP.BUSINESS_REPORT),
      category: 'follow-up',
      order: order++,
      dependencies: [`step-${order - 1}`],
    });
  }

  return steps;
}

/**
 * Generate home-specific steps using Browser AI extracted terms
 * ENHANCED: Uses effort score to adjust step complexity and detail
 */
function generateHomeSteps(
  text: string,
  keywords: string[],
  phrases: string[],
  verbs: string[],
  nouns: string[],
  totalMinutes: number,
  hasSequence: boolean,
  effortScore?: number
): ActionPlanStep[] {
  const steps: ActionPlanStep[] = [];
  let order = 1;

  // Helper function to check if terms match home concepts
  const hasRepairTerms = (terms: string[]) => terms.some(term => 
    ['repair', 'fix', 'install', 'maintain', 'replace'].some(match => 
      term.toLowerCase().includes(match)
    )
  );
  const hasCleaningTerms = (terms: string[]) => terms.some(term => 
    ['cleaning', 'organize', 'clean', 'tidy', 'declutter'].some(match => 
      term.toLowerCase().includes(match)
    )
  );

  // Check using Browser AI extracted terms
  const hasRepair = text.includes('repair') || text.includes('fix') || text.includes('install') ||
                    hasRepairTerms(keywords) || hasRepairTerms(phrases) || hasRepairTerms(verbs);
  const hasCleaning = text.includes('cleaning') || text.includes('organize') ||
                      hasCleaningTerms(keywords) || hasCleaningTerms(phrases) || hasCleaningTerms(verbs);

  // Preparation steps
  if (hasRepair) {
    steps.push({
      action: 'Gather tools and supplies',
      estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.PREPARATION.HOME_REPAIR),
      category: 'preparation',
      order: order++,
    });
  }

  if (hasCleaning) {
    steps.push({
      action: 'Prepare cleaning supplies or storage containers',
      estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.PREPARATION.HOME_CLEANING),
      category: 'preparation',
      order: order++,
    });
  }

  // ENHANCED: Execution step - use extracted verbs and effort score for more intelligent action
  const executionMinutes = Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.EXECUTION.HOME);
  
  // Higher effort = more detailed action descriptions using keywords/phrases
  let executionAction: string;
  if (effortScore && effortScore >= 4 && phrases.length > 0) {
    executionAction = `${verbs.length > 0 ? verbs[0].charAt(0).toUpperCase() + verbs[0].slice(1) : 'Complete'} ${phrases[0] || (nouns.length > 0 ? nouns[0] : 'main task')}`;
  } else if (effortScore && effortScore >= 3 && keywords.length > 0 && nouns.length > 0) {
    executionAction = `${verbs.length > 0 ? verbs[0].charAt(0).toUpperCase() + verbs[0].slice(1) : 'Complete'} ${keywords[0]} ${nouns[0]}`;
  } else if (verbs.length > 0 && verbs[0]) {
    executionAction = `${verbs[0].charAt(0).toUpperCase() + verbs[0].slice(1)} ${nouns.length > 0 ? nouns[0] : 'main task'}`;
  } else {
    executionAction = 'Complete main task';
  }
  
  steps.push({
    action: executionAction,
    estimatedMinutes: executionMinutes,
    category: 'execution',
    order: order++,
  });

  // Follow-up steps
  if (hasCleaning) {
    steps.push({
      action: 'Clean up and put away supplies',
      estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.FOLLOW_UP.HOME_CLEANING),
      category: 'follow-up',
      order: order++,
    });
  }

  return steps;
}

/**
 * Generate personal-specific steps using Browser AI extracted terms
 * ENHANCED: Uses effort score to adjust step complexity and detail
 */
function generatePersonalSteps(
  text: string,
  keywords: string[],
  phrases: string[],
  verbs: string[],
  nouns: string[],
  totalMinutes: number,
  hasSequence: boolean,
  effortScore?: number
): ActionPlanStep[] {
  const steps: ActionPlanStep[] = [];
  let order = 1;

  // Helper function to check if terms match personal concepts
  const hasExerciseTerms = (terms: string[]) => {
    // CRITICAL: Only detect exercise terms if domain is personal, not business/technical
    if (domain !== 'personal') return false;
    return terms.some(term => 
      ['exercise', 'workout', 'fitness', 'train', 'run', 'gym'].some(match => 
        term.toLowerCase().includes(match)
      )
    );
  };
  const hasTravelTerms = (terms: string[]) => terms.some(term => 
    ['travel', 'trip', 'journey', 'vacation'].some(match => 
      term.toLowerCase().includes(match)
    )
  );

  // Check using Browser AI extracted terms
  // CRITICAL: Only detect exercise if domain is personal, not business/technical
  const hasExercise = domain === 'personal' && (
    text.includes('exercise') || text.includes('workout') || text.includes('fitness') ||
    hasExerciseTerms(keywords) || hasExerciseTerms(phrases) || hasExerciseTerms(verbs)
  );
  const hasTravel = text.includes('travel') || text.includes('trip') ||
                    hasTravelTerms(keywords) || hasTravelTerms(phrases) || hasTravelTerms(verbs);

  // Preparation steps
  if (hasExercise) {
    steps.push({
      action: 'Warm up and prepare equipment',
      estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.PREPARATION.PERSONAL_EXERCISE),
      category: 'preparation',
      order: order++,
    });
  }

  if (hasTravel) {
    steps.push({
      action: 'Plan itinerary and pack',
      estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.PREPARATION.PERSONAL_TRAVEL),
      category: 'preparation',
      order: order++,
    });
  }

  // ENHANCED: Execution step - use extracted verbs and effort score for more intelligent action
  const executionMinutes = Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.EXECUTION.PERSONAL);
  
  // Higher effort = more detailed action descriptions using keywords/phrases
  let executionAction: string;
  if (effortScore && effortScore >= 4 && phrases.length > 0) {
    executionAction = `${verbs.length > 0 ? verbs[0].charAt(0).toUpperCase() + verbs[0].slice(1) : 'Complete'} ${phrases[0] || (nouns.length > 0 ? nouns[0] : 'activity')}`;
  } else if (effortScore && effortScore >= 3 && keywords.length > 0 && nouns.length > 0) {
    executionAction = `${verbs.length > 0 ? verbs[0].charAt(0).toUpperCase() + verbs[0].slice(1) : 'Complete'} ${keywords[0]} ${nouns[0]}`;
  } else if (verbs.length > 0 && verbs[0]) {
    executionAction = `${verbs[0].charAt(0).toUpperCase() + verbs[0].slice(1)} ${nouns.length > 0 ? nouns[0] : 'activity'}`;
  } else {
    executionAction = 'Complete activity';
  }
  
  steps.push({
    action: executionAction,
    estimatedMinutes: executionMinutes,
    category: 'execution',
    order: order++,
  });

  // Follow-up steps
  if (hasExercise) {
    steps.push({
      action: 'Cool down and stretch',
      estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.FOLLOW_UP.PERSONAL_EXERCISE),
      category: 'follow-up',
      order: order++,
    });
  }

  return steps;
}

/**
 * Generate world/global-specific steps using Browser AI extracted terms
 * ENHANCED: Uses effort score to adjust step complexity and detail
 */
function generateWorldSteps(
  text: string,
  keywords: string[],
  phrases: string[],
  verbs: string[],
  nouns: string[],
  totalMinutes: number,
  hasSequence: boolean,
  effortScore?: number
): ActionPlanStep[] {
  const steps: ActionPlanStep[] = [];
  let order = 1;

  // Helper function to check if terms match world concepts
  const hasTravelTerms = (terms: string[]) => terms.some(term => 
    ['travel', 'trip', 'journey', 'vacation', 'flight'].some(match => 
      term.toLowerCase().includes(match)
    )
  );
  const hasCallTerms = (terms: string[]) => terms.some(term => 
    ['call', 'meeting', 'conference', 'zoom', 'video'].some(match => 
      term.toLowerCase().includes(match)
    )
  );

  // Check using Browser AI extracted terms
  const hasTravel = text.includes('travel') || text.includes('trip') ||
                    hasTravelTerms(keywords) || hasTravelTerms(phrases) || hasTravelTerms(verbs);
  const hasCall = text.includes('call') || text.includes('meeting') || text.includes('conference') ||
                  hasCallTerms(keywords) || hasCallTerms(phrases) || hasCallTerms(verbs);

  // Preparation steps
  if (hasTravel) {
    steps.push({
      action: 'Check time zones and plan schedule',
      estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.PREPARATION.WORLD_TRAVEL),
      category: 'preparation',
      order: order++,
    });
    steps.push({
      action: 'Prepare travel documents and reservations',
      estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.PREPARATION.WORLD_TRAVEL),
      category: 'preparation',
      order: order++,
    });
  }

  if (hasCall) {
    steps.push({
      action: 'Confirm time zones and coordinate schedule',
      estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.PREPARATION.WORLD_CALL),
      category: 'preparation',
      order: order++,
    });
  }

  // ENHANCED: Execution step - use extracted verbs and effort score for more intelligent action
  const executionMinutes = Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.EXECUTION.WORLD);
  
  // Higher effort = more detailed action descriptions using keywords/phrases
  let executionAction: string;
  if (effortScore && effortScore >= 4 && phrases.length > 0) {
    executionAction = `${verbs.length > 0 ? verbs[0].charAt(0).toUpperCase() + verbs[0].slice(1) : 'Execute'} ${phrases[0] || (nouns.length > 0 ? nouns[0] : 'main task')}`;
  } else if (effortScore && effortScore >= 3 && keywords.length > 0 && nouns.length > 0) {
    executionAction = `${verbs.length > 0 ? verbs[0].charAt(0).toUpperCase() + verbs[0].slice(1) : 'Execute'} ${keywords[0]} ${nouns[0]}`;
  } else if (verbs.length > 0 && verbs[0]) {
    executionAction = `${verbs[0].charAt(0).toUpperCase() + verbs[0].slice(1)} ${nouns.length > 0 ? nouns[0] : 'main task'}`;
  } else {
    executionAction = 'Execute main task';
  }
  
  steps.push({
    action: executionAction,
    estimatedMinutes: executionMinutes,
    category: 'execution',
    order: order++,
  });

  return steps;
}

/**
 * Generate generic steps for unknown/mixed domains using Browser AI extracted terms
 * ENHANCED: Uses effort score to adjust step complexity and detail
 */
function generateGenericSteps(
  text: string,
  keywords: string[],
  phrases: string[],
  verbs: string[],
  nouns: string[],
  totalMinutes: number,
  hasSequence: boolean,
  effortScore?: number
): ActionPlanStep[] {
  const steps: ActionPlanStep[] = [];

  // ENHANCED: Use extracted verbs, nouns, keywords, and phrases with effort score for more intelligent steps
  let prepAction: string;
  let execAction: string;
  let reviewAction: string;
  
  if (effortScore && effortScore >= EFFORT_SCORE_THRESHOLDS.VERY_HIGH && phrases.length > 0) {
    // Very high effort: use contextual phrases
    prepAction = `Prepare and plan for ${phrases[0] || (verbs.length > 0 ? verbs[0] : 'task')}`;
    execAction = `${verbs.length > 0 ? verbs[0].charAt(0).toUpperCase() + verbs[0].slice(1) : 'Execute'} ${phrases[0] || (nouns.length > 0 ? nouns[0] : 'task')}`;
    reviewAction = `Review and finalize ${phrases[0] || (verbs.length > 0 ? verbs[0] : 'task')}`;
  } else if (effortScore && effortScore >= EFFORT_SCORE_THRESHOLDS.HIGH && keywords.length > 0) {
    // High effort: use keywords for context
    prepAction = `Prepare and plan for ${keywords[0]}${verbs.length > 0 ? ` ${verbs[0]}` : ''}${nouns.length > 0 ? ` ${nouns[0]}` : ''}`;
    execAction = `${verbs.length > 0 ? verbs[0].charAt(0).toUpperCase() + verbs[0].slice(1) : 'Execute'} ${keywords[0]}${nouns.length > 0 ? ` ${nouns[0]}` : ' task'}`;
    reviewAction = `Review and complete ${keywords[0]}${verbs.length > 0 ? ` ${verbs[0]}` : ''}`;
  } else {
    // Medium/low effort: use verbs and nouns
    prepAction = verbs.length > 0 && verbs[0]
      ? `Prepare and plan for ${verbs[0]}${nouns.length > 0 ? ` ${nouns[0]}` : ''}`
      : 'Prepare and plan';
    execAction = verbs.length > 0 && verbs[0]
      ? `${verbs[0].charAt(0).toUpperCase() + verbs[0].slice(1)}${nouns.length > 0 ? ` ${nouns[0]}` : ' task'}`
      : 'Execute task';
    reviewAction = verbs.length > 0
      ? `Review and complete ${verbs[0]}`
      : 'Review and complete';
  }

  // Simple breakdown: preparation, execution, follow-up
  steps.push({
    action: prepAction,
    estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.PREPARATION.GENERIC),
    category: 'preparation',
    order: 1,
  });

  steps.push({
    action: execAction,
    estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.EXECUTION.GENERIC),
    category: 'execution',
    order: 2,
    dependencies: ['step-1'],
  });

  steps.push({
    action: reviewAction,
    estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.FOLLOW_UP.GENERIC),
    category: 'follow-up',
    order: 3,
    dependencies: ['step-2'],
  });

  return steps;
}

/**
 * Generate suggested subtasks based on domain and description using Browser AI extracted terms
 * ENHANCED: Uses enhanced terms for better coordination with other AI components
 */
function generateSubtasks(
  title: string,
  description: string,
  domain: Domain,
  terminology: ReturnType<typeof getDomainTerminology>,
  extractedTerms?: ReturnType<typeof extractTermsFromTaskNameWithBrowserAI>,
  enhancedTerms?: AIContext['enhancedTerms']
): string[] {
  const subtasks: string[] = [];
  const fullText = `${title} ${description}`.trim();
  const text = fullText.toLowerCase();

  // Use provided extracted terms or extract them (sync fallback for when async Browser AI cannot be used)
  // NOTE: If extractedTerms is provided from AIContext, it already includes Browser AI terms (from async createAIContext)
  // If not provided, use sync local extraction (Browser AI would require async/await which isn't available here)
  const terms = extractedTerms || (() => {
    const localExtracted = extractTermsFromTaskName(fullText, terminology);
    return {
      keywords: localExtracted.keywords,
      phrases: localExtracted.phrases,
      verbs: localExtracted.verbs,
      nouns: localExtracted.nouns,
      pronouns: localExtracted.pronouns,
      context: fullText,
    };
  })();
  
  // ENHANCED: Combine extracted terms with enhanced terms for better coordination
  const keywords = enhancedTerms?.keywords.length > 0
    ? [...new Set([...terms.keywords, ...enhancedTerms.keywords])]
    : terms.keywords;
  const phrases = enhancedTerms?.phrases.length > 0
    ? [...new Set([...terms.phrases, ...enhancedTerms.phrases])]
    : terms.phrases;
  const verbs = enhancedTerms?.verbs.length > 0
    ? [...new Set([...terms.verbs, ...enhancedTerms.verbs])]
    : terms.verbs;
  const nouns = enhancedTerms?.nouns.length > 0
    ? [...new Set([...terms.nouns, ...enhancedTerms.nouns])]
    : terms.nouns;

  // Helper function to check if terms match concepts
  const hasTerm = (searchTerms: string[], matchTerms: string[]) => 
    searchTerms.some(term => matchTerms.some(match => term.toLowerCase().includes(match)));

  // Domain-specific subtask suggestions using Browser AI extracted terms
  // ENHANCED: More contextual and specific subtasks based on actual task content
  switch (domain) {
    case 'business':
      // Technical/development tasks
      if (text.includes('fix') || text.includes('bug') || text.includes('issue') || 
          hasTerm(keywords, ['fix', 'bug', 'issue', 'error', 'problem']) || 
          hasTerm(verbs, ['fix', 'debug', 'resolve', 'repair']) ||
          hasTerm(phrases, ['fix issue', 'bug fix', 'system issue', 'resolve problem'])) {
        if (text.includes('recurring') || text.includes('re-occurring') || hasTerm(keywords, ['recurring', 'recurrence'])) {
          subtasks.push('Identify root cause of recurring issue');
          subtasks.push('Review recurrence logic and patterns');
          subtasks.push('Test fix with multiple occurrences');
          subtasks.push('Document solution and prevention steps');
        } else {
          subtasks.push('Reproduce the issue');
          subtasks.push('Identify root cause');
          subtasks.push('Implement fix');
          subtasks.push('Test solution');
        }
      }
      
      // System/technical tasks
      if (text.includes('system') || hasTerm(keywords, ['system', 'code', 'application', 'software']) ||
          hasTerm(phrases, ['system issue', 'code base', 'application'])) {
        if (!subtasks.some(s => s.toLowerCase().includes('fix') || s.toLowerCase().includes('issue'))) {
          subtasks.push('Analyze system architecture');
          subtasks.push('Review code and dependencies');
          subtasks.push('Test system components');
        }
      }
      
      if (text.includes('meeting') || hasTerm(keywords, ['meeting']) || hasTerm(phrases, ['meeting'])) {
        subtasks.push('Prepare agenda');
        subtasks.push('Review previous notes');
        subtasks.push('Send meeting invite');
      }
      
      // Report tasks - more specific based on context
      if (text.includes('report') || text.includes('analysis') || 
          hasTerm(keywords, ['report', 'analysis']) || hasTerm(phrases, ['report', 'analysis'])) {
        // Check if it's a technical report
        if (text.includes('system') || text.includes('code') || hasTerm(keywords, ['system', 'technical', 'code'])) {
          subtasks.push('Gather technical data and logs');
          subtasks.push('Analyze system performance');
          subtasks.push('Document findings and recommendations');
        } else {
          subtasks.push('Collect data');
          subtasks.push('Analyze findings');
          subtasks.push('Create summary');
        }
      }
      
      // Presentation tasks - more specific
      if (text.includes('presentation') || hasTerm(keywords, ['presentation']) || hasTerm(phrases, ['presentation'])) {
        // Check if it's a technical presentation
        if (text.includes('system') || text.includes('technical') || hasTerm(keywords, ['system', 'technical'])) {
          subtasks.push('Prepare technical slides');
          subtasks.push('Create diagrams and examples');
          subtasks.push('Practice technical delivery');
        } else {
          subtasks.push('Create slides');
          subtasks.push('Practice delivery');
          subtasks.push('Prepare Q&A');
        }
      }
      break;

    case 'home':
      if (text.includes('cleaning') || hasTerm(keywords, ['cleaning', 'clean']) || hasTerm(phrases, ['cleaning'])) {
        subtasks.push('Declutter first');
        subtasks.push('Deep clean surfaces');
        subtasks.push('Organize items');
      }
      if (text.includes('repair') || text.includes('fix') || 
          hasTerm(keywords, ['repair', 'fix']) || hasTerm(verbs, ['repair', 'fix'])) {
        subtasks.push('Diagnose issue');
        subtasks.push('Gather tools');
        subtasks.push('Test fix');
      }
      if (text.includes('cooking') || text.includes('meal') || 
          hasTerm(keywords, ['cooking', 'meal']) || hasTerm(phrases, ['cooking', 'meal'])) {
        subtasks.push('Gather ingredients');
        subtasks.push('Prep ingredients');
        subtasks.push('Cook and serve');
      }
      break;

    case 'personal':
      // CRITICAL: Only add exercise subtasks if domain is personal, not business/technical
      if (domain === 'personal' && (text.includes('exercise') || text.includes('workout') || 
          hasTerm(keywords, ['exercise', 'workout']) || hasTerm(verbs, ['exercise', 'workout']))) {
        subtasks.push('Warm up');
        subtasks.push('Main workout');
        subtasks.push('Cool down');
      }
      if (text.includes('learning') || text.includes('study') || 
          hasTerm(keywords, ['learning', 'study']) || hasTerm(verbs, ['learn', 'study'])) {
        subtasks.push('Review materials');
        subtasks.push('Take notes');
        subtasks.push('Practice application');
      }
      break;

    case 'world':
      if (text.includes('travel') || text.includes('trip') || 
          hasTerm(keywords, ['travel', 'trip']) || hasTerm(phrases, ['travel', 'trip'])) {
        subtasks.push('Check time zones');
        subtasks.push('Book accommodations');
        subtasks.push('Plan itinerary');
      }
      break;
  }

  return subtasks;
}

