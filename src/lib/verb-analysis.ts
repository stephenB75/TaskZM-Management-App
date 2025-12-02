import type { Task } from '../types';

/**
 * Verb-to-effort mapping based on action type
 * Effort scores range from 1-5:
 * - 1-2: Low effort (quick actions)
 * - 2-3: Medium effort (moderate actions)
 * - 3-4: High effort (complex actions)
 * - 4-5: Very high effort (architectural/complex actions)
 */
const VERB_EFFORT_MAP: Record<string, number> = {
  // Low effort (1-2)
  'review': 1.5,
  'check': 1.2,
  'verify': 1.3,
  'read': 1.0,
  'browse': 1.0,
  'view': 1.0,
  'look': 1.0,
  'watch': 1.0,
  'listen': 1.0,
  'scan': 1.2,
  'skim': 1.1,
  
  // Medium effort (2-3)
  'write': 2.5,
  'draft': 2.3,
  'create': 2.8,
  'update': 2.2,
  'edit': 2.0,
  'send': 1.8,
  'respond': 2.0,
  'reply': 1.8,
  'email': 2.0,
  'message': 1.8,
  'post': 2.0,
  'share': 1.8,
  'upload': 2.2,
  'download': 1.8,
  'copy': 1.5,
  'paste': 1.5,
  'move': 1.8,
  'organize': 2.2,
  'sort': 1.8,
  'filter': 1.8,
  
  // High effort (3-4)
  'develop': 3.5,
  'implement': 3.8,
  'build': 3.5,
  'design': 3.2,
  'plan': 3.0,
  'research': 3.2,
  'analyze': 3.0,
  'test': 2.8,
  'debug': 3.2,
  'fix': 2.8,
  'solve': 3.0,
  'investigate': 3.2,
  'evaluate': 2.8,
  'assess': 2.8,
  'prepare': 2.5,
  'setup': 2.8,
  'configure': 2.8,
  'install': 2.5,
  'deploy': 3.2,
  'document': 2.5,
  'present': 2.8,
  'meet': 2.0,
  'call': 2.0,
  'discuss': 2.2,
  
  // Very high effort (4-5)
  'architect': 4.5,
  'refactor': 4.2,
  'migrate': 4.5,
  'integrate': 4.0,
  'optimize': 4.0,
  'restructure': 4.5,
  'redesign': 4.2,
  'rebuild': 4.5,
  'rewrite': 4.0,
  'transform': 4.5,
  'consolidate': 4.0,
  'reorganize': 3.8,
};

/**
 * Common action verbs to look for in task text
 */
const ACTION_VERBS = Object.keys(VERB_EFFORT_MAP);

/**
 * Verb categories for time range adjustments
 */
const VERB_CATEGORIES = {
  meeting: ['meeting', 'call', 'conference', 'standup', 'sync', 'discuss', 'meet'],
  review: ['review', 'check', 'verify', 'audit', 'inspect', 'examine'],
  planning: ['plan', 'design', 'architecture', 'strategy', 'research', 'analyze'],
  writing: ['write', 'draft', 'create', 'document', 'blog', 'compose'],
  development: ['code', 'develop', 'implement', 'build', 'fix', 'debug', 'test'],
  project: ['project', 'feature', 'module', 'system', 'migrate', 'integrate'],
};

/**
 * Analyze task verbs to determine effort score and primary action
 */
export function analyzeTaskVerbs(task: Task): { effortScore: number; primaryVerb: string } {
  // Combine title and description for analysis
  const text = `${task.title} ${task.description || ''}`.toLowerCase();
  const words = text.split(/\s+/);
  
  // Find verbs in the text
  const foundVerbs: Array<{ verb: string; effort: number; position: number }> = [];
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[.,!?;:()]/g, ''); // Remove punctuation
    if (ACTION_VERBS.includes(word)) {
      const effort = VERB_EFFORT_MAP[word];
      foundVerbs.push({ verb: word, effort, position: i });
    }
  }
  
  // If no verbs found, use default medium effort
  if (foundVerbs.length === 0) {
    return { effortScore: 2.5, primaryVerb: 'unknown' };
  }
  
  // Use the first significant verb found (earliest in text)
  const primaryVerb = foundVerbs[0].verb;
  let effortScore = foundVerbs[0].effort;
  
  // If multiple verbs found, use the highest effort (most complex action)
  if (foundVerbs.length > 1) {
    const maxEffort = Math.max(...foundVerbs.map(v => v.effort));
    effortScore = maxEffort;
  }
  
  // Clamp effort score between 1.0 and 5.0
  effortScore = Math.max(1.0, Math.min(5.0, effortScore));
  
  return { effortScore, primaryVerb };
}

/**
 * Calculate complexity score from task properties
 * Returns a score between 1.0 and 5.0
 */
export function calculateComplexity(task: Task): number {
  let complexity = 1.0; // Base complexity
  
  // Add complexity for subtasks
  if (task.subtasks && task.subtasks.length > 0) {
    const subtaskComplexity = Math.min(task.subtasks.length * 0.5, 2.0); // Max +2.0 for 4+ subtasks
    complexity += subtaskComplexity;
  }
  
  // Add complexity for dependencies
  if (task.dependencies && task.dependencies.length > 0) {
    const dependencyComplexity = Math.min(task.dependencies.length * 0.5, 1.0); // Max +1.0 for 2+ dependencies
    complexity += dependencyComplexity;
  }
  
  // Add complexity for long descriptions
  if (task.description && task.description.length > 500) {
    complexity += 0.5;
  }
  
  // Add complexity for complexity-indicating tags
  if (task.tags && task.tags.length > 0) {
    const tagLower = task.tags.map(t => t.toLowerCase());
    if (tagLower.some(t => ['complex', 'difficult', 'large', 'major', 'challenging'].includes(t))) {
      complexity += 0.5;
    }
  }
  
  // Reduce complexity for in-progress tasks (work already done)
  if (task.status === 'in-progress') {
    complexity -= 0.3;
  }
  
  // Clamp between 1.0 and 5.0
  complexity = Math.max(1.0, Math.min(5.0, complexity));
  
  return complexity;
}

/**
 * Apply verb-specific time adjustments based on action type
 * Maintains existing keyword-based logic while refining formula results
 */
export function applyVerbSpecificAdjustments(
  estimatedMinutes: number,
  verb: string,
  task: Task
): number {
  const verbLower = verb.toLowerCase();
  
  // Meeting/call keywords = 30-90 minutes
  if (VERB_CATEGORIES.meeting.some(v => verbLower.includes(v) || task.title.toLowerCase().includes(v))) {
    estimatedMinutes = Math.max(estimatedMinutes, 30);
    estimatedMinutes = Math.min(estimatedMinutes, 90);
  }
  // Review keywords = 15-45 minutes
  else if (VERB_CATEGORIES.review.some(v => verbLower.includes(v) || task.title.toLowerCase().includes(v))) {
    estimatedMinutes = Math.max(estimatedMinutes, 15);
    estimatedMinutes = Math.min(estimatedMinutes, 45);
  }
  // Planning/design keywords = 60-180 minutes
  else if (VERB_CATEGORIES.planning.some(v => verbLower.includes(v) || task.title.toLowerCase().includes(v))) {
    estimatedMinutes = Math.max(estimatedMinutes, 60);
    estimatedMinutes = Math.min(estimatedMinutes, 180);
  }
  // Writing keywords = 45-120 minutes
  else if (VERB_CATEGORIES.writing.some(v => verbLower.includes(v) || task.title.toLowerCase().includes(v))) {
    estimatedMinutes = Math.max(estimatedMinutes, 45);
    estimatedMinutes = Math.min(estimatedMinutes, 120);
  }
  // Development keywords = 60-240 minutes
  else if (VERB_CATEGORIES.development.some(v => verbLower.includes(v) || task.title.toLowerCase().includes(v))) {
    estimatedMinutes = Math.max(estimatedMinutes, 60);
    estimatedMinutes = Math.min(estimatedMinutes, 240);
  }
  // Project keywords = 120-300 minutes
  else if (VERB_CATEGORIES.project.some(v => verbLower.includes(v) || task.title.toLowerCase().includes(v))) {
    estimatedMinutes = Math.max(estimatedMinutes, 120);
    estimatedMinutes = Math.min(estimatedMinutes, 300);
  }
  
  return estimatedMinutes;
}

