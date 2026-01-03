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
import { MINUTES_PER_HOUR } from './business-constants';
import { ACTION_PLAN_TIME_DISTRIBUTION } from './ai-config';

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
      context: 'personal',
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
    status: (task.status as any) || 'todo',
    priority: (task.priority as any) || 'medium',
    tags: task.tags || [],
    createdAt: task.createdAt || new Date().toISOString(),
    updatedAt: task.updatedAt || new Date().toISOString(),
    projectId: task.projectId || 'default',
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
    createdBy: task.createdBy || 'local',
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
 */
function generateSteps(
  title: string,
  description: string,
  domain: Domain,
  terminology: ReturnType<typeof getDomainTerminology>,
  totalMinutes: number
): ActionPlanStep[] {
  const steps: ActionPlanStep[] = [];
  const text = `${title} ${description}`.toLowerCase();

  // Analyze for sequential indicators
  const sequentialIndicators = [
    'first', 'then', 'next', 'after', 'before', 'finally', 'last',
    'step 1', 'step 2', 'step 3', 'phase 1', 'phase 2',
    'start with', 'begin by', 'end with', 'finish by'
  ];

  const hasSequence = sequentialIndicators.some(indicator => text.includes(indicator));

  // Domain-specific step generation
  switch (domain) {
    case 'business':
      steps.push(...generateBusinessSteps(text, totalMinutes, hasSequence));
      break;

    case 'home':
      steps.push(...generateHomeSteps(text, totalMinutes, hasSequence));
      break;

    case 'personal':
      steps.push(...generatePersonalSteps(text, totalMinutes, hasSequence));
      break;

    case 'world':
      steps.push(...generateWorldSteps(text, totalMinutes, hasSequence));
      break;

    default:
      steps.push(...generateGenericSteps(text, totalMinutes, hasSequence));
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
 * Generate business-specific steps
 */
function generateBusinessSteps(
  text: string,
  totalMinutes: number,
  hasSequence: boolean
): ActionPlanStep[] {
  const steps: ActionPlanStep[] = [];
  let order = 1;

  // Preparation steps
  if (text.includes('meeting') || text.includes('presentation') || text.includes('call')) {
    steps.push({
      action: 'Prepare materials and agenda',
      estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.PREPARATION.BUSINESS_MEETING),
      category: 'preparation',
      order: order++,
    });
  }

  if (text.includes('report') || text.includes('analysis') || text.includes('review')) {
    steps.push({
      action: 'Gather data and information',
      estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.PREPARATION.BUSINESS_REPORT),
      category: 'preparation',
      order: order++,
    });
  }

  // Execution step
  const executionMinutes = Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.EXECUTION.BUSINESS);
  steps.push({
    action: 'Execute main task',
    estimatedMinutes: executionMinutes,
    category: 'execution',
    order: order++,
  });

  // Follow-up steps
  if (text.includes('meeting') || text.includes('call')) {
    steps.push({
      action: 'Send follow-up notes or action items',
      estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.FOLLOW_UP.BUSINESS_MEETING),
      category: 'follow-up',
      order: order++,
      dependencies: [`step-${order - 1}`],
    });
  }

  if (text.includes('report') || text.includes('document')) {
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
 * Generate home-specific steps
 */
function generateHomeSteps(
  text: string,
  totalMinutes: number,
  hasSequence: boolean
): ActionPlanStep[] {
  const steps: ActionPlanStep[] = [];
  let order = 1;

  // Preparation steps
  if (text.includes('repair') || text.includes('fix') || text.includes('install')) {
    steps.push({
      action: 'Gather tools and supplies',
      estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.PREPARATION.HOME_REPAIR),
      category: 'preparation',
      order: order++,
    });
  }

  if (text.includes('cleaning') || text.includes('organize')) {
    steps.push({
      action: 'Prepare cleaning supplies or storage containers',
      estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.PREPARATION.HOME_CLEANING),
      category: 'preparation',
      order: order++,
    });
  }

  // Execution step
  steps.push({
    action: 'Complete main task',
    estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.EXECUTION.HOME),
    category: 'execution',
    order: order++,
  });

  // Follow-up steps
  if (text.includes('cleaning') || text.includes('organize')) {
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
 * Generate personal-specific steps
 */
function generatePersonalSteps(
  text: string,
  totalMinutes: number,
  hasSequence: boolean
): ActionPlanStep[] {
  const steps: ActionPlanStep[] = [];
  let order = 1;

  // Preparation steps
  if (text.includes('exercise') || text.includes('workout') || text.includes('fitness')) {
    steps.push({
      action: 'Warm up and prepare equipment',
      estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.PREPARATION.PERSONAL_EXERCISE),
      category: 'preparation',
      order: order++,
    });
  }

  if (text.includes('travel') || text.includes('trip')) {
    steps.push({
      action: 'Plan itinerary and pack',
      estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.PREPARATION.PERSONAL_TRAVEL),
      category: 'preparation',
      order: order++,
    });
  }

  // Execution step
  steps.push({
    action: 'Complete activity',
    estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.EXECUTION.PERSONAL),
    category: 'execution',
    order: order++,
  });

  // Follow-up steps
  if (text.includes('exercise') || text.includes('workout')) {
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
 * Generate world/global-specific steps
 */
function generateWorldSteps(
  text: string,
  totalMinutes: number,
  hasSequence: boolean
): ActionPlanStep[] {
  const steps: ActionPlanStep[] = [];
  let order = 1;

  // Preparation steps
  if (text.includes('travel') || text.includes('trip')) {
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

  if (text.includes('call') || text.includes('meeting') || text.includes('conference')) {
    steps.push({
      action: 'Confirm time zones and coordinate schedule',
      estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.PREPARATION.WORLD_CALL),
      category: 'preparation',
      order: order++,
    });
  }

  // Execution step
  steps.push({
    action: 'Execute main task',
    estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.EXECUTION.WORLD),
    category: 'execution',
    order: order++,
  });

  return steps;
}

/**
 * Generate generic steps for unknown/mixed domains
 */
function generateGenericSteps(
  text: string,
  totalMinutes: number,
  hasSequence: boolean
): ActionPlanStep[] {
  const steps: ActionPlanStep[] = [];

  // Simple breakdown: preparation, execution, follow-up
  steps.push({
    action: 'Prepare and plan',
    estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.PREPARATION.GENERIC),
    category: 'preparation',
    order: 1,
  });

  steps.push({
    action: 'Execute task',
    estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.EXECUTION.GENERIC),
    category: 'execution',
    order: 2,
    dependencies: ['step-1'],
  });

  steps.push({
    action: 'Review and complete',
    estimatedMinutes: Math.round(totalMinutes * ACTION_PLAN_TIME_DISTRIBUTION.FOLLOW_UP.GENERIC),
    category: 'follow-up',
    order: 3,
    dependencies: ['step-2'],
  });

  return steps;
}

/**
 * Generate suggested subtasks based on domain and description
 */
function generateSubtasks(
  title: string,
  description: string,
  domain: Domain,
  terminology: ReturnType<typeof getDomainTerminology>
): string[] {
  const subtasks: string[] = [];
  const text = `${title} ${description}`.toLowerCase();

  // Domain-specific subtask suggestions
  switch (domain) {
    case 'business':
      if (text.includes('meeting')) {
        subtasks.push('Prepare agenda');
        subtasks.push('Review previous notes');
        subtasks.push('Send meeting invite');
      }
      if (text.includes('report') || text.includes('analysis')) {
        subtasks.push('Collect data');
        subtasks.push('Analyze findings');
        subtasks.push('Create summary');
      }
      if (text.includes('presentation')) {
        subtasks.push('Create slides');
        subtasks.push('Practice delivery');
        subtasks.push('Prepare Q&A');
      }
      break;

    case 'home':
      if (text.includes('cleaning')) {
        subtasks.push('Declutter first');
        subtasks.push('Deep clean surfaces');
        subtasks.push('Organize items');
      }
      if (text.includes('repair') || text.includes('fix')) {
        subtasks.push('Diagnose issue');
        subtasks.push('Gather tools');
        subtasks.push('Test fix');
      }
      if (text.includes('cooking') || text.includes('meal')) {
        subtasks.push('Gather ingredients');
        subtasks.push('Prep ingredients');
        subtasks.push('Cook and serve');
      }
      break;

    case 'personal':
      if (text.includes('exercise') || text.includes('workout')) {
        subtasks.push('Warm up');
        subtasks.push('Main workout');
        subtasks.push('Cool down');
      }
      if (text.includes('learning') || text.includes('study')) {
        subtasks.push('Review materials');
        subtasks.push('Take notes');
        subtasks.push('Practice application');
      }
      break;

    case 'world':
      if (text.includes('travel') || text.includes('trip')) {
        subtasks.push('Check time zones');
        subtasks.push('Book accommodations');
        subtasks.push('Plan itinerary');
      }
      break;
  }

  return subtasks;
}

