/**
 * Helpers for AI Assist when creating new tasks (TaskDialog, quick-add flows).
 */

import { MINUTES_PER_HOUR } from './business-constants';
import { NEW_TASK_AI_ASSIST } from './ai-config';
import type { TaskPriority } from '../types';
import type { FilteredTerminology } from './description-generator';
import type { Domain } from './domain-terminology';

export interface NewTaskBreakdownSnapshot {
  domain: Domain;
  effortScore: number;
  estimatedMinutes: number;
  filteredTerminology?: FilteredTerminology;
  actionPlan?: {
    suggestedSubtasks: string[];
  } | null;
}

export function splitMinutesToDurationFields(totalMinutes: number): {
  hours: string;
  minutes: string;
} {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / MINUTES_PER_HOUR);
  const minutes = safeMinutes % MINUTES_PER_HOUR;
  return { hours: String(hours), minutes: String(minutes) };
}

export function isDefaultZeroDuration(hours: string, minutes: string): boolean {
  return (parseInt(hours, 10) || 0) === 0 && (parseInt(minutes, 10) || 0) === 0;
}

export function canAutoApplyBreakdownDuration(
  isNewTask: boolean,
  hours: string,
  minutes: string,
  userEditedDuration: boolean,
): boolean {
  return (
    isNewTask &&
    !userEditedDuration &&
    isDefaultZeroDuration(hours, minutes)
  );
}

/**
 * Suggest priority from effort score — only when user has not changed from default.
 */
export function suggestPriorityFromEffort(
  effortScore: number,
  currentPriority: TaskPriority,
): TaskPriority | null {
  if (currentPriority !== NEW_TASK_AI_ASSIST.defaultPriorityForSuggestion) {
    return null;
  }
  if (effortScore >= NEW_TASK_AI_ASSIST.effortUrgentThreshold) {
    return 'urgent';
  }
  if (effortScore >= NEW_TASK_AI_ASSIST.effortHighThreshold) {
    return 'high';
  }
  if (effortScore <= NEW_TASK_AI_ASSIST.effortLowThreshold) {
    return 'low';
  }
  return null;
}

export function getBreakdownGenerationContext(
  breakdown: NewTaskBreakdownSnapshot | null | undefined,
): { domain: Domain; filteredTerminology: FilteredTerminology } | undefined {
  if (!breakdown?.domain || !breakdown.filteredTerminology) {
    return undefined;
  }
  return {
    domain: breakdown.domain,
    filteredTerminology: breakdown.filteredTerminology,
  };
}

export function shouldOfferDescriptionOptions(
  title: string,
  description: string,
  breakdown: NewTaskBreakdownSnapshot | null | undefined,
  isBreakdownLoading: boolean,
  isGeneratingDescription: boolean,
): boolean {
  return (
    title.trim().length >= NEW_TASK_AI_ASSIST.minTitleLengthForOptions &&
    !description.trim() &&
    Boolean(breakdown?.effortScore) &&
    !isBreakdownLoading &&
    !isGeneratingDescription
  );
}
