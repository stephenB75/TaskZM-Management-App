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
  'add': 1.8,
  'remove': 1.8,
  'delete': 1.5,
  'change': 2.0,
  'modify': 2.2,
  'improve': 2.5,
  'complete': 2.0,
  'finish': 2.0,
  'submit': 1.8,
  'approve': 1.5,
  'reject': 1.5,
  'confirm': 1.5,
  'cancel': 1.2,
  'schedule': 2.0,
  'book': 1.8,
  'reserve': 1.8,
  'register': 2.0,
  'sign': 1.2,
  'agree': 1.0,
  'accept': 1.5,
  'decline': 1.2,
  
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
  'coordinate': 2.5,
  'collaborate': 2.8,
  'communicate': 2.0,
  'train': 3.0,
  'learn': 3.0,
  'study': 2.8,
  'practice': 2.5,
  'rehearse': 2.5,
  'compile': 2.8,
  'collect': 2.0,
  'gather': 2.0,
  'assemble': 2.5,
  'construct': 3.2,
  'establish': 3.0,
  'found': 3.5,
  'launch': 3.2,
  'release': 3.0,
  'publish': 2.5,
  'submit': 1.8,
  'deliver': 2.5,
  'ship': 2.0,
  'distribute': 2.2,
  
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
 * Irregular verb mappings (common past tense and variations)
 */
const IRREGULAR_VERBS: Record<string, string> = {
  // Past tense -> base form
  'wrote': 'write',
  'written': 'write',
  'built': 'build',
  'made': 'make',
  'did': 'do',
  'went': 'go',
  'got': 'get',
  'took': 'take',
  'came': 'come',
  'saw': 'see',
  'found': 'find',
  'gave': 'give',
  'told': 'tell',
  'thought': 'think',
  'knew': 'know',
  'felt': 'feel',
  'left': 'leave',
  'put': 'put',
  'set': 'set',
  'met': 'meet',
  'ran': 'run',
  'began': 'begin',
  'broke': 'break',
  'brought': 'bring',
  'bought': 'buy',
  'caught': 'catch',
  'chose': 'choose',
  'drew': 'draw',
  'drove': 'drive',
  'ate': 'eat',
  'fell': 'fall',
  'flew': 'fly',
  'forgot': 'forget',
  'froze': 'freeze',
  'grew': 'grow',
  'heard': 'hear',
  'held': 'hold',
  'hid': 'hide',
  'hit': 'hit',
  'kept': 'keep',
  'led': 'lead',
  'lost': 'lose',
  'paid': 'pay',
  'read': 'read',
  'rode': 'ride',
  'rose': 'rise',
  'said': 'say',
  'sang': 'sing',
  'sat': 'sit',
  'slept': 'sleep',
  'spoke': 'speak',
  'spent': 'spend',
  'stood': 'stand',
  'stuck': 'stick',
  'struck': 'strike',
  'swam': 'swim',
  'taught': 'teach',
  'threw': 'throw',
  'understood': 'understand',
  'woke': 'wake',
  'won': 'win',
  'wore': 'wear',
  'wound': 'wind',
};

/**
 * Get base verb form from a word (improved stemming with irregular verb support)
 * Handles common verb variations: -ing, -ed, -s, -es, and irregular forms
 */
function getBaseVerb(word: string): string {
  if (word.length < 2) return word;
  
  const wordLower = word.toLowerCase();
  
  // Check irregular verbs first
  if (IRREGULAR_VERBS[wordLower]) {
    return IRREGULAR_VERBS[wordLower];
  }
  
  // Remove common verb endings
  if (wordLower.endsWith('ing')) {
    // writing -> write, developing -> develop, running -> run
    const base = wordLower.slice(0, -3);
    if (base.length < 2) return wordLower;
    
    // Handle double consonants: running -> run, but writing -> write
    if (base.length > 2 && base[base.length - 1] === base[base.length - 2]) {
      const singleConsonant = base.slice(0, -1);
      if (ACTION_VERBS.includes(singleConsonant)) {
        return singleConsonant;
      }
    }
    
    // Handle -e ending verbs: writing -> write (writ + e + ing)
    const withE = base + 'e';
    if (ACTION_VERBS.includes(withE)) {
      return withE;
    }
    
    // Check if base itself is a verb
    if (ACTION_VERBS.includes(base)) {
      return base;
    }
    
    return base;
  }
  
  if (wordLower.endsWith('ed')) {
    // developed -> develop, created -> create, fixed -> fix
    const base = wordLower.slice(0, -2);
    if (base.length < 2) return wordLower;
    
    // Handle double consonants: planned -> plan, stopped -> stop
    if (base.length > 2 && base[base.length - 1] === base[base.length - 2]) {
      const singleConsonant = base.slice(0, -1);
      if (ACTION_VERBS.includes(singleConsonant)) {
        return singleConsonant;
      }
    }
    
    // Handle -e ending verbs: created -> create
    const withE = base + 'e';
    if (ACTION_VERBS.includes(withE)) {
      return withE;
    }
    
    // Check if base itself is a verb
    if (ACTION_VERBS.includes(base)) {
      return base;
    }
    
    return base;
  }
  
  if (wordLower.endsWith('es')) {
    // fixes -> fix, goes -> go, watches -> watch
    const base = wordLower.slice(0, -2);
    if (ACTION_VERBS.includes(base)) {
      return base;
    }
    // Try with 'e' for verbs like "fixes" -> "fix" (already handled) or "goes" -> "go"
    return base;
  }
  
  if (wordLower.endsWith('s') && wordLower.length > 3) {
    // writes -> write, develops -> develop
    const base = wordLower.slice(0, -1);
    if (ACTION_VERBS.includes(base)) {
      return base;
    }
    return base;
  }
  
  return wordLower;
}

/**
 * Check if a word matches a verb (exact match or base form match)
 * Improved matching with better handling of variations
 */
function matchesVerb(word: string): { verb: string; effort: number } | null {
  if (!word || word.length < 2) return null;
  
  const wordLower = word.toLowerCase().trim();
  if (!wordLower || wordLower.length < 2) return null;
  
  // Try exact match first (case-insensitive)
  if (ACTION_VERBS.includes(wordLower)) {
    return { verb: wordLower, effort: VERB_EFFORT_MAP[wordLower] };
  }
  
  // Try base form match (handles -ing, -ed, -s, -es endings and irregular verbs)
  const baseVerb = getBaseVerb(wordLower);
  if (baseVerb && baseVerb.length >= 2) {
    // Check if base verb itself is in the list
    if (ACTION_VERBS.includes(baseVerb)) {
      return { verb: baseVerb, effort: VERB_EFFORT_MAP[baseVerb] };
    }
    
    // If base verb is different from original, it means we did some transformation
    // Try checking if the base verb with common endings would match
    if (baseVerb !== wordLower) {
      // Try adding common endings back and checking
      const variations = [
        baseVerb + 'e',  // write from writ
        baseVerb + baseVerb[baseVerb.length - 1], // run from runn (double consonant)
      ];
      
      for (const variation of variations) {
        if (ACTION_VERBS.includes(variation)) {
          return { verb: variation, effort: VERB_EFFORT_MAP[variation] };
        }
      }
    }
  }
  
  // Try checking if any verb is contained in the word (for compound words and variations)
  // Only check if word is longer than 3 chars to avoid false matches
  if (wordLower.length >= 3) {
    // Sort verbs by length (longest first) to match more specific verbs first
    const sortedVerbs = [...ACTION_VERBS].sort((a, b) => b.length - a.length);
    
    for (const verb of sortedVerbs) {
      // Check if verb is at the start of the word (most common case)
      // e.g., "writing" starts with "writ" but we want "write"
      // e.g., "developing" starts with "develop"
      if (wordLower.startsWith(verb)) {
        // Make sure it's not just a partial match (e.g., "dev" matching "develop")
        const nextChar = wordLower[verb.length];
        if (!nextChar || !/[a-z]/.test(nextChar) || nextChar === 'i' || nextChar === 'e') {
          return { verb: verb, effort: VERB_EFFORT_MAP[verb] };
        }
      }
      
      // Check if verb is at the end of the word (less common but possible)
      if (wordLower.endsWith(verb) && wordLower.length > verb.length) {
        return { verb: verb, effort: VERB_EFFORT_MAP[verb] };
      }
      
      // Check if verb is contained in the word (for compound words like "code-review")
      if (wordLower.includes(verb) && wordLower.length > verb.length + 2) {
        // Only match if verb is a significant part of the word
        const verbIndex = wordLower.indexOf(verb);
        const before = wordLower[verbIndex - 1];
        const after = wordLower[verbIndex + verb.length];
        
        // Match if verb is at word boundary (hyphen, space, or start/end)
        if ((!before || before === '-' || before === '_' || before === ' ') &&
            (!after || after === '-' || after === '_' || after === ' ')) {
          return { verb: verb, effort: VERB_EFFORT_MAP[verb] };
        }
      }
    }
  }
  
  return null;
}

/**
 * Analyze task verbs to determine effort score and primary action
 * Now handles verb variations (writing/write, developing/develop, etc.)
 */
export function analyzeTaskVerbs(task: Task): { effortScore: number; primaryVerb: string } {
  // Combine title and description for analysis
  const text = `${task.title || ''} ${task.description || ''}`.toLowerCase().trim();
  
  console.log('🔬 analyzeTaskVerbs: Analyzing text', {
    taskId: task.id,
    taskTitle: task.title,
    text,
    textLength: text.length,
  });
  
  if (!text) {
    console.log('⚠️ analyzeTaskVerbs: No text to analyze, using default');
    return { effortScore: 2.5, primaryVerb: 'unknown' };
  }
  
  // Split by spaces and also handle common separators
  // Improved regex to handle more cases: spaces, hyphens, underscores, and common punctuation
  const words = text.split(/[\s\-_.,!?;:()\[\]{}'"]+/).filter(w => w.length > 0);
  
  console.log('🔬 analyzeTaskVerbs: Words extracted', {
    taskId: task.id,
    wordCount: words.length,
    words: words.slice(0, 15), // Log first 15 words for better debugging
    fullText: text,
  });
  
  // Find verbs in the text
  const foundVerbs: Array<{ verb: string; effort: number; position: number; originalWord: string }> = [];
  
  for (let i = 0; i < words.length; i++) {
    // Clean the word - already split by punctuation, but trim any remaining whitespace
    let word = words[i].trim().toLowerCase();
    
    if (!word || word.length < 2) continue;
    
    // Check for verb match (exact or base form)
    const match = matchesVerb(word);
    if (match) {
      console.log('✅ analyzeTaskVerbs: Found verb', {
        taskId: task.id,
        originalWord: word,
        matchedVerb: match.verb,
        effort: match.effort,
        position: i,
      });
      foundVerbs.push({ 
        verb: match.verb, 
        effort: match.effort, 
        position: i,
        originalWord: word 
      });
    } else {
      // Log words that didn't match for debugging
      if (words.length <= 10) { // Only log for short tasks to avoid spam
        console.log('🔍 analyzeTaskVerbs: Word did not match verb', {
          taskId: task.id,
          word,
          position: i,
        });
      }
    }
  }
  
  // If no verbs found, use default medium effort
  if (foundVerbs.length === 0) {
    console.log('⚠️ analyzeTaskVerbs: No verbs found, using default effort', {
      taskId: task.id,
      taskTitle: task.title,
      wordsChecked: words.length,
      allWords: words.slice(0, 20), // Show first 20 words for debugging
      availableVerbs: ACTION_VERBS.slice(0, 10), // Show sample of available verbs
    });
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
  
  console.log('✅ analyzeTaskVerbs: Final result', {
    taskId: task.id,
    taskTitle: task.title,
    primaryVerb,
    effortScore,
    totalVerbsFound: foundVerbs.length,
  });
  
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

