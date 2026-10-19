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

/** Lower shouted text and expand texting shorthand so the rest of the parser (dates, verbs) sees full words. */
export function normalizeShorthand(text: string): string {
  const base = isShouting(text) ? text.toLowerCase() : text;
  return CONFIG.shorthand.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), base);
}

/** Even spacing and punctuation: no space before commas, one space after, no doubled marks. */
function tidyPunctuation(text: string): string {
  return text
    .replace(/\s+([,;:.!?])/g, '$1')
    .replace(/([,;:])(?=[A-Za-z])/g, '$1 ')
    .replace(/([!?.,])\1+/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Shouted input ("CALL MOM") is lowered before cleanup. */
function isShouting(text: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, '');
  return letters.length > 3 && letters === letters.toUpperCase();
}

/** A lone "i" becomes "I" and the first letter is capitalized. */
function toSentenceCase(text: string): string {
  const base = text.replace(/\bi\b/g, 'I');
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** "Calling mom" → "call mom"; leaves titles that already start with a command alone. */
function toImperative(text: string): string {
  const match = text.match(/^([A-Za-z]+)\b/);
  const verb = match ? CONFIG.imperativeVerbs[match[1].toLowerCase()] : undefined;
  return verb ? verb + text.slice(match![1].length) : text;
}

/** Drop filler ("I need to", "don't forget to"), expand shorthand, use a command verb, and fix casing and punctuation. */
export function improveTitle(title: string): string {
  let next = tidyPunctuation(normalizeShorthand(title.trim()));
  for (let previous = ''; previous !== next; ) {
    previous = next;
    next = next.replace(CONFIG.fillerPrefix, '').replace(/[\s,;:.!?-]+$/, '').replace(CONFIG.fillerSuffix, '').trim();
  }
  if (!next) return title.trim();
  return toSentenceCase(toImperative(next));
}

/** A full sentence for a task description: cleaned like a title, ending with a period. */
export function toSentence(text: string): string {
  const cleaned = improveTitle(text);
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

/**
 * Long, run-on items keep a short title and move the reason or detail into the description:
 * "Email Sam about the invoice because the total is wrong again" → "Email Sam about the invoice".
 */
export function splitTitleDetail(text: string): { title: string; detail: string | null } {
  const words = text.trim().split(/\s+/);
  if (words.length <= CONFIG.maxTitleWords) return { title: text, detail: null };
  const match = text.match(CONFIG.detailClausePattern);
  if (!match || match.index === undefined || match.index === 0) return { title: text, detail: null };
  return { title: text.slice(0, match.index), detail: toSentence(text) };
}

/** Clean subtask titles, dropping blanks, repeats, and any step that just restates the task. */
export function cleanSteps(steps: string[], taskTitle: string): string[] {
  const seen = new Set([taskTitleKey(taskTitle)]);
  const out: string[] = [];
  for (const step of steps) {
    const cleaned = improveTitle(step);
    const key = taskTitleKey(cleaned);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
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
