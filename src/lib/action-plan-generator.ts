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
import { ACTION_PLAN_TIME_DISTRIBUTION, SEQUENTIAL_INDICATORS } from './ai-config';
import { DEFAULT_TASK_STATUS, DEFAULT_TASK_PRIORITY, DEFAULT_TASK_DOMAIN, DEFAULT_CREATED_BY } from './task-constants';
import { extractTermsFromTaskNameWithBrowserAI } from './description-generator';

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
 */
export function generateActionPlan(
  task: Task | Partial<Task>
): ActionPlan {
  const title = (task.title || '').trim();
  const description = (task.description || '').trim();
  const fullText = `${title} ${description}`.trim();

  if (!fullText || fullText.length === 0) {
    return {
      steps: [],
      totalEstimatedMinutes: 0,
      suggestedSubtasks: [],
      context: DEFAULT_TASK_DOMAIN,
      confidence: 0,
    };
  }

  // Detect domain
  const domainDetection = detectDomain(title, description);
  const domain = domainDetection.domain;
  const terminology = getDomainTerminology(domain);

  // Estimate total time
  const taskForEstimation: Task = {
    id: task.id || 'temp',
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
  const steps = generateSteps(
    title,
    description,
    domain,
    terminology,
    totalMinutes
  );

  // Generate suggested subtasks
  const suggestedSubtasks = generateSubtasks(
    title,
    description,
    domain,
    terminology
  );

  return {
    steps,
    totalEstimatedMinutes: totalMinutes,
    suggestedSubtasks,
    context: domain,
    confidence: domainDetection.confidence,
  };
}

/**
 * Generate action plan steps based on domain and description
 * Uses Browser AI to extract keywords, phrases, verbs, and nouns for context-aware step generation
 */
function generateSteps(
  title: string,
  description: string,
  domain: Domain,
  terminology: ReturnType<typeof getDomainTerminology>,
  totalMinutes: number
): ActionPlanStep[] {
  const steps: ActionPlanStep[] = [];
  const fullText = `${title} ${description}`.trim();
  const text = fullText.toLowerCase();

  // Use Browser AI to extract terms from task title and description
  const extractedTerms = extractTermsFromTaskNameWithBrowserAI(fullText, terminology);
  const { keywords, phrases, verbs, nouns } = extractedTerms;

  // Analyze for sequential indicators using extracted terms
  const hasSequence = SEQUENTIAL_INDICATORS.some(indicator => text.includes(indicator)) ||
                      keywords.some(kw => SEQUENTIAL_INDICATORS.some(ind => kw.includes(ind))) ||
                      phrases.some(ph => SEQUENTIAL_INDICATORS.some(ind => ph.includes(ind)));

  // Domain-specific step generation using Browser AI extracted terms
  switch (domain) {
    case 'business':
      steps.push(...generateBusinessSteps(text, keywords, phrases, verbs, nouns, totalMinutes, hasSequence));
      break;

    case 'home':
      steps.push(...generateHomeSteps(text, keywords, phrases, verbs, nouns, totalMinutes, hasSequence));
      break;

    case 'personal':
      steps.push(...generatePersonalSteps(text, keywords, phrases, verbs, nouns, totalMinutes, hasSequence));
      break;

    case 'world':
      steps.push(...generateWorldSteps(text, keywords, phrases, verbs, nouns, totalMinutes, hasSequence));
      break;

    default:
      steps.push(...generateGenericSteps(text, keywords, phrases, verbs, nouns, totalMinutes, hasSequence));
  }

  // If no steps generated, create a default step
  if (steps.length === 0) {
    steps.push({
      action: title || 'Complete task',
      estimatedMinutes: totalMinutes,
      category: 'execution',
      order: 1,
    });
  }

  // Ensure total minutes match (distribute proportionally)
  const currentTotal = steps.reduce((sum, step) => sum + step.estimatedMinutes, 0);
  if (currentTotal !== totalMinutes && currentTotal > 0) {
    const ratio = totalMinutes / currentTotal;
    steps.forEach(step => {
      step.estimatedMinutes = Math.round(step.estimatedMinutes * ratio);
    });
  }

  return steps;
}

/**
 * Generate business-specific steps using Browser AI extracted terms
 */
function generateBusinessSteps(
  text: string,
  keywords: string[],
  phrases: string[],
  verbs: string[],
  nouns: string[],
  totalMinutes: number,
  hasSequence: boolean
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

  // Execution step - use extracted verbs to create more specific action
  const executionMinutes = Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.EXECUTION.BUSINESS);
  const executionAction = verbs.length > 0 && verbs[0] 
    ? `${verbs[0].charAt(0).toUpperCase() + verbs[0].slice(1)} ${nouns.length > 0 ? nouns[0] : 'main task'}`
    : 'Execute main task';
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
 */
function generateHomeSteps(
  text: string,
  keywords: string[],
  phrases: string[],
  verbs: string[],
  nouns: string[],
  totalMinutes: number,
  hasSequence: boolean
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

  // Execution step - use extracted verbs to create more specific action
  const executionMinutes = Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.EXECUTION.HOME);
  const executionAction = verbs.length > 0 && verbs[0] 
    ? `${verbs[0].charAt(0).toUpperCase() + verbs[0].slice(1)} ${nouns.length > 0 ? nouns[0] : 'main task'}`
    : 'Complete main task';
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
 */
function generatePersonalSteps(
  text: string,
  keywords: string[],
  phrases: string[],
  verbs: string[],
  nouns: string[],
  totalMinutes: number,
  hasSequence: boolean
): ActionPlanStep[] {
  const steps: ActionPlanStep[] = [];
  let order = 1;

  // Helper function to check if terms match personal concepts
  const hasExerciseTerms = (terms: string[]) => terms.some(term => 
    ['exercise', 'workout', 'fitness', 'train', 'run', 'gym'].some(match => 
      term.toLowerCase().includes(match)
    )
  );
  const hasTravelTerms = (terms: string[]) => terms.some(term => 
    ['travel', 'trip', 'journey', 'vacation'].some(match => 
      term.toLowerCase().includes(match)
    )
  );

  // Check using Browser AI extracted terms
  const hasExercise = text.includes('exercise') || text.includes('workout') || text.includes('fitness') ||
                      hasExerciseTerms(keywords) || hasExerciseTerms(phrases) || hasExerciseTerms(verbs);
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

  // Execution step - use extracted verbs to create more specific action
  const executionMinutes = Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.EXECUTION.PERSONAL);
  const executionAction = verbs.length > 0 && verbs[0] 
    ? `${verbs[0].charAt(0).toUpperCase() + verbs[0].slice(1)} ${nouns.length > 0 ? nouns[0] : 'activity'}`
    : 'Complete activity';
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
 */
function generateWorldSteps(
  text: string,
  keywords: string[],
  phrases: string[],
  verbs: string[],
  nouns: string[],
  totalMinutes: number,
  hasSequence: boolean
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

  // Execution step - use extracted verbs to create more specific action
  const executionMinutes = Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.EXECUTION.WORLD);
  const executionAction = verbs.length > 0 && verbs[0] 
    ? `${verbs[0].charAt(0).toUpperCase() + verbs[0].slice(1)} ${nouns.length > 0 ? nouns[0] : 'main task'}`
    : 'Execute main task';
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
 */
function generateGenericSteps(
  text: string,
  keywords: string[],
  phrases: string[],
  verbs: string[],
  nouns: string[],
  totalMinutes: number,
  hasSequence: boolean
): ActionPlanStep[] {
  const steps: ActionPlanStep[] = [];

  // Use extracted verbs and nouns to create more specific steps
  const prepAction = verbs.length > 0 && verbs[0]
    ? `Prepare and plan for ${verbs[0]}${nouns.length > 0 ? ` ${nouns[0]}` : ''}`
    : 'Prepare and plan';
  const execAction = verbs.length > 0 && verbs[0]
    ? `${verbs[0].charAt(0).toUpperCase() + verbs[0].slice(1)}${nouns.length > 0 ? ` ${nouns[0]}` : ' task'}`
    : 'Execute task';
  const reviewAction = verbs.length > 0
    ? `Review and complete ${verbs[0]}`
    : 'Review and complete';

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
 */
function generateSubtasks(
  title: string,
  description: string,
  domain: Domain,
  terminology: ReturnType<typeof getDomainTerminology>
): string[] {
  const subtasks: string[] = [];
  const fullText = `${title} ${description}`.trim();
  const text = fullText.toLowerCase();

  // Use Browser AI to extract terms from task title and description
  const extractedTerms = extractTermsFromTaskNameWithBrowserAI(fullText, terminology);
  const { keywords, phrases, verbs, nouns } = extractedTerms;

  // Helper function to check if terms match concepts
  const hasTerm = (searchTerms: string[], matchTerms: string[]) => 
    searchTerms.some(term => matchTerms.some(match => term.toLowerCase().includes(match)));

  // Domain-specific subtask suggestions using Browser AI extracted terms
  switch (domain) {
    case 'business':
      if (text.includes('meeting') || hasTerm(keywords, ['meeting']) || hasTerm(phrases, ['meeting'])) {
        subtasks.push('Prepare agenda');
        subtasks.push('Review previous notes');
        subtasks.push('Send meeting invite');
      }
      if (text.includes('report') || text.includes('analysis') || 
          hasTerm(keywords, ['report', 'analysis']) || hasTerm(phrases, ['report', 'analysis'])) {
        subtasks.push('Collect data');
        subtasks.push('Analyze findings');
        subtasks.push('Create summary');
      }
      if (text.includes('presentation') || hasTerm(keywords, ['presentation']) || hasTerm(phrases, ['presentation'])) {
        subtasks.push('Create slides');
        subtasks.push('Practice delivery');
        subtasks.push('Prepare Q&A');
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
      if (text.includes('exercise') || text.includes('workout') || 
          hasTerm(keywords, ['exercise', 'workout']) || hasTerm(verbs, ['exercise', 'workout'])) {
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

