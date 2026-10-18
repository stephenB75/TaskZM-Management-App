/**
 * Planner analysis: tidy a drafted task's title, split sentences that mention several tasks,
 * and break bigger tasks into subtasks. Rule-based and on device; patterns and step templates
 * live in PLANNER_ANALYSIS_CONFIG.
 */

import { PLANNER_ANALYSIS_CONFIG } from './ai-config';
import { splitList } from './planner-commands';

const CONFIG = PLANNER_ANALYSIS_CONFIG;

export interface SubtaskSuggestion {
  steps: string[];
  minutesPerStep: number;
}

/** Separate tasks mentioned in one line ("redo the site, also call mom"). */
export function splitClauses(line: string): string[] {
  return line
    .split(CONFIG.clauseSeparator)
    .map((piece) => piece.trim())
    .filter(Boolean);
}

/** Drop filler ("I need to", "don't forget to"), trailing punctuation, and capitalize. */
export function improveTitle(title: string): string {
  let next = title.trim();
  for (let previous = ''; previous !== next; ) {
    previous = next;
    next = next.replace(CONFIG.fillerPrefix, '').replace(/[\s,;:.!?-]+$/, '').replace(CONFIG.fillerSuffix, '').trim();
  }
  if (!next) return title.trim();
  return next.charAt(0).toUpperCase() + next.slice(1);
}

/** True when a brain-dump sentence reads like a note or feeling rather than something to do. */
export function isNoteSentence(text: string): boolean {
  const trimmed = text.trim();
  if (CONFIG.actionCuePattern.test(trimmed)) return false;
  return CONFIG.noteSentencePattern.test(trimmed) || /\?\s*$/.test(trimmed);
}

/** Case- and punctuation-insensitive key, so "Call mom." and "call Mom" count as the same task. */
export function taskTitleKey(title: string): string {
  return title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** A title followed by its own steps ("Plan party: invite guests, order cake"). */
export function splitInlineSteps(line: string): { title: string; steps: string[] } | null {
  const match = line.match(CONFIG.inlineStepsPattern);
  if (!match) return null;
  const steps = splitList(match[2]).map(improveTitle);
  if (steps.length < CONFIG.minInlineSteps) return null;
  return { title: match[1].trim(), steps: steps.slice(0, CONFIG.maxSubtasks) };
}

/** Typical steps for a recognizable bigger task, or null when it reads like a single action. */
export function suggestSubtasks(text: string): SubtaskSuggestion | null {
  const template = CONFIG.templates.find((candidate) => candidate.pattern.test(text));
  if (!template) return null;
  return { steps: template.steps.slice(0, CONFIG.maxSubtasks), minutesPerStep: template.minutesPerStep };
}

/** An estimate that leaves time for every subtask. */
export function estimateWithSubtasks(
  baseMinutes: number,
  subtaskCount: number,
  minutesPerStep: number = CONFIG.minutesPerStepFloor,
): number {
  return Math.max(baseMinutes, subtaskCount * minutesPerStep);
}
