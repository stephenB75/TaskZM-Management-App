/**
 * Browser AI API Integration
 * 
 * Provides integration with the Browser AI API (window.ai) for enhanced
 * AI-powered task description generation and term extraction.
 * 
 * Falls back to local processing when Browser AI API is unavailable.
 */

import { logger } from './logger';
import { BROWSER_AI_CONFIG } from './ai-config';

/**
 * Browser AI API types
 */
interface BrowserAIModel {
  name: string;
  provider: string;
}

interface BrowserAIPrompt {
  text: string;
  temperature?: number;
  maxTokens?: number;
}

interface BrowserAIResponse {
  text: string;
  model?: string;
}

/**
 * Check if Browser AI API is available
 * Supports multiple Browser AI API formats:
 * - window.ai (standard Browser AI API)
 * - navigator.ai (Chrome built-in AI)
 */
export function isBrowserAIAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  // Check for window.ai
  if (typeof (window as any).ai !== 'undefined' && (window as any).ai !== null) {
    return true;
  }
  
  // Check for navigator.ai (Chrome built-in AI)
  if (typeof navigator !== 'undefined' && typeof (navigator as any).ai !== 'undefined' && (navigator as any).ai !== null) {
    return true;
  }
  
  return false;
}

/**
 * Get available Browser AI models
 */
export async function getBrowserAIModels(): Promise<BrowserAIModel[]> {
  if (!isBrowserAIAvailable()) {
    return [];
  }

  try {
    const ai = (window as any).ai;
    if (ai && typeof ai.languageModel === 'function') {
      // Browser AI API is available
      const models = await ai.languageModel();
      return Array.isArray(models) ? models : [];
    }
  } catch (error) {
    logger.warn('Error getting Browser AI models:', error);
  }

  return [];
}

/**
 * Generate text using Browser AI API
 * Supports multiple Browser AI API formats for maximum compatibility
 * 
 * @param prompt - The prompt text
 * @param options - Optional generation options
 * @returns Generated text or null if unavailable
 */
export async function generateTextWithBrowserAI(
  prompt: string,
  options: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
  } = {}
): Promise<string | null> {
  if (!isBrowserAIAvailable()) {
    logger.debug('Browser AI API not available');
    return null;
  }

  try {
    // Try window.ai first (standard Browser AI API)
    const windowAI = (window as any).ai;
    if (windowAI) {
      // Format 1: window.ai with getWindowAI() pattern
      if (typeof windowAI.getWindowAI === 'function') {
        try {
          const ai = await windowAI.getWindowAI();
          if (ai && typeof ai.generateText === 'function') {
            const response = await ai.generateText({
              prompt,
              temperature: options.temperature ?? BROWSER_AI_CONFIG.TEMPERATURE.DEFAULT,
              maxTokens: options.maxTokens ?? BROWSER_AI_CONFIG.MAX_TOKENS.DEFAULT,
            });
            if (response && typeof response === 'string') {
              logger.debug('✅ Browser AI API: Generated text using window.ai.getWindowAI()');
              return response;
            }
            if (response && typeof response === 'object' && 'text' in response) {
              logger.debug('✅ Browser AI API: Generated text using window.ai.getWindowAI()');
              return (response as BrowserAIResponse).text;
            }
          }
        } catch (error) {
          logger.debug('window.ai.getWindowAI() format failed, trying alternatives:', error);
        }
      }
      
      // Format 2: window.ai.languageModel() returns a session/model; then call generateText on it
      // (languageModel is async in some specs—get the object first, then generateText)
      if (windowAI && typeof windowAI.languageModel === 'function') {
        try {
          const modelOrSession = await windowAI.languageModel();
          if (modelOrSession && typeof (modelOrSession as any).generateText === 'function') {
            const promptConfig: BrowserAIPrompt = {
              text: prompt,
              temperature: options.temperature ?? BROWSER_AI_CONFIG.TEMPERATURE.DEFAULT,
              maxTokens: options.maxTokens ?? BROWSER_AI_CONFIG.MAX_TOKENS.DEFAULT,
            };
            const response = await (modelOrSession as any).generateText(promptConfig);
            if (response && typeof response === 'string') {
              logger.debug('✅ Browser AI API: Generated text using window.ai.languageModel().generateText()');
              return response;
            }
            if (response && typeof response === 'object' && 'text' in response) {
              logger.debug('✅ Browser AI API: Generated text using window.ai.languageModel().generateText()');
              return (response as BrowserAIResponse).text;
            }
          }
          // Fallback: some implementations attach generateText on the function itself
          if (typeof (windowAI.languageModel as any).generateText === 'function') {
            const promptConfig: BrowserAIPrompt = {
              text: prompt,
              temperature: options.temperature ?? BROWSER_AI_CONFIG.TEMPERATURE.DEFAULT,
              maxTokens: options.maxTokens ?? BROWSER_AI_CONFIG.MAX_TOKENS.DEFAULT,
            };
            const response = await (windowAI.languageModel as any).generateText(promptConfig);
            if (response && typeof response === 'string') return response;
            if (response && typeof response === 'object' && 'text' in response) return (response as BrowserAIResponse).text;
          }
        } catch (error) {
          logger.debug('window.ai.languageModel format failed, trying alternatives:', error);
        }
      }

      // Format 3: window.ai.generateText() (direct method)
      if (windowAI && typeof windowAI.generateText === 'function') {
        try {
          const response = await windowAI.generateText(prompt, options);
          if (response && typeof response === 'string') {
            logger.debug('✅ Browser AI API: Generated text using window.ai.generateText()');
            return response;
          }
          if (response && typeof response === 'object' && 'text' in response) {
            logger.debug('✅ Browser AI API: Generated text using window.ai.generateText()');
            return (response as BrowserAIResponse).text;
          }
        } catch (error) {
          logger.debug('window.ai.generateText() format failed, trying alternatives:', error);
        }
      }
    }

    // Try navigator.ai (Chrome built-in AI)
    const navigatorAI = typeof navigator !== 'undefined' ? (navigator as any).ai : null;
    if (navigatorAI) {
      // Format 4: navigator.ai.languageModel.generateText() or await languageModel() then generateText
      const navLM = navigatorAI.languageModel;
      if (navLM) {
        try {
          const lmObj = typeof navLM === 'function' ? await navLM() : navLM;
          if (lmObj && typeof (lmObj as any).generateText === 'function') {
            const response = await (lmObj as any).generateText({
              prompt,
              temperature: options.temperature ?? BROWSER_AI_CONFIG.TEMPERATURE.DEFAULT,
              maxTokens: options.maxTokens ?? BROWSER_AI_CONFIG.MAX_TOKENS.DEFAULT,
            });
            if (response && typeof response === 'string') {
              logger.debug('✅ Browser AI API: Generated text using navigator.ai.languageModel');
              return response;
            }
            if (response && typeof response === 'object' && 'text' in response) {
              return (response as BrowserAIResponse).text;
            }
          }
          if (typeof (navLM as any).generateText === 'function') {
            const response = await (navLM as any).generateText({
              prompt,
              temperature: options.temperature ?? BROWSER_AI_CONFIG.TEMPERATURE.DEFAULT,
              maxTokens: options.maxTokens ?? BROWSER_AI_CONFIG.MAX_TOKENS.DEFAULT,
            });
            if (response && typeof response === 'string') return response;
            if (response && typeof response === 'object' && 'text' in response) return (response as BrowserAIResponse).text;
          }
        } catch (error) {
          logger.debug('navigator.ai.languageModel format failed:', error);
        }
      }
    }

    // Format 5: Chrome built-in Prompt API (Chrome 138+) — LanguageModel.create() then session.prompt()
    const LanguageModel = typeof window !== 'undefined' ? (window as any).LanguageModel : undefined;
    if (LanguageModel && typeof LanguageModel.create === 'function') {
      try {
        const availability = typeof LanguageModel.availability === 'function'
          ? await LanguageModel.availability({ expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] })
          : 'readily';
        if (availability !== 'unavailable') {
          const session = await LanguageModel.create();
          if (session && typeof session.prompt === 'function') {
            const result = await session.prompt(prompt);
            if (typeof result === 'string' && result.trim().length > 0) {
              logger.debug('✅ Browser AI API: Generated text using Chrome Prompt API (LanguageModel.session.prompt)');
              return result.trim();
            }
          }
        }
      } catch (error) {
        logger.debug('Chrome LanguageModel / session.prompt format failed:', error);
      }
    }
  } catch (error) {
    logger.warn('Error generating text with Browser AI API:', error);
    return null;
  }

  logger.debug('Browser AI API: All API format attempts failed');
  return null;
}

/**
 * Extract terms from text using Browser AI API
 * 
 * @param text - The text to extract terms from
 * @param domain - The domain context (business, home, personal, world)
 * @returns Extracted terms or null if unavailable
 */
export async function extractTermsWithBrowserAI(
  text: string,
  domain: string
): Promise<{
  keywords: string[];
  phrases: string[];
  verbs: string[];
  nouns: string[];
  summary: string;
} | null> {
  if (!isBrowserAIAvailable()) {
    return null;
  }

  try {
    const prompt = `You are analyzing a ${domain} task. The FULL TASK TEXT is the only source of context. Every keyword and phrase must be interpreted ONLY within this task.

FULL TASK: "${text}"

CONTEXT RULES:
- Interpret every term in the context of the full task above (e.g. "login" in "Fix login bug" means the login feature, not the action of logging in).
- Prefer PHRASES that preserve context over single ambiguous words (e.g. include "login bug" and "authentication system", not just "login", "bug", "system").
- Keywords should be specific to THIS task—avoid generic words like "task", "work", "do".
- The summary must describe what THIS task involves, so downstream use has clear context.

Return ONLY a valid JSON object with:
- keywords: array of 3-8 important, context-specific keywords from the task
- phrases: array of 2-5 key phrases (${BROWSER_AI_CONFIG.PROMPT.PHRASE_LENGTH_RANGE}) that capture the task's essence and preserve context
- verbs: array of 2-5 action verbs that describe what needs to be done in this task
- nouns: array of 3-8 important nouns (objects/subjects) as they appear in this task
- summary: a brief, contextual summary (${BROWSER_AI_CONFIG.PROMPT.SUMMARY_LENGTH}) that explains what this task involves and how the terms relate to it

Example for "Fix login bug in authentication system":
{
  "keywords": ["login", "bug", "authentication", "system", "fix"],
  "phrases": ["login bug", "authentication system", "fix login"],
  "verbs": ["fix", "debug", "test", "resolve"],
  "nouns": ["bug", "login", "authentication", "system"],
  "summary": "This task involves fixing a login bug in the authentication system."
}

Return ONLY the JSON object, no other text:
{"keywords": [...], "phrases": [...], "verbs": [...], "nouns": [...], "summary": "..."}`;

    const response = await generateTextWithBrowserAI(prompt, {
      temperature: BROWSER_AI_CONFIG.TEMPERATURE.EXTRACTION, // Lower temperature for more consistent extraction
      maxTokens: BROWSER_AI_CONFIG.MAX_TOKENS.EXTRACTION,
    });

    if (!response) {
      return null;
    }

    // Try to parse JSON from response
    // The response might be wrapped in markdown code blocks or plain JSON
    let jsonText = response.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```')) {
      const lines = jsonText.split('\n');
      const startIndex = lines.findIndex(line => line.includes('{'));
      const endIndex = lines.findIndex((line, idx) => idx > startIndex && line.includes('}'));
      if (startIndex !== -1 && endIndex !== -1) {
        jsonText = lines.slice(startIndex, endIndex + 1).join('\n');
      }
    }

    // Extract JSON object if wrapped in text
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    try {
      const parsed = JSON.parse(jsonText);
      
      return {
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        phrases: Array.isArray(parsed.phrases) ? parsed.phrases : [],
        verbs: Array.isArray(parsed.verbs) ? parsed.verbs : [],
        nouns: Array.isArray(parsed.nouns) ? parsed.nouns : [],
        summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      };
    } catch (parseError) {
      logger.warn('Failed to parse Browser AI response as JSON:', parseError);
      // Fallback: try to extract terms from the summary text
      return {
        keywords: [],
        phrases: [],
        verbs: [],
        nouns: [],
        summary: response,
      };
    }
  } catch (error) {
    logger.warn('Error extracting terms with Browser AI API:', error);
    return null;
  }
}

/**
 * Generate contextual description using Browser AI API
 * 
 * @param taskName - The task name
 * @param domain - The domain context
 * @param extractedTerms - Previously extracted terms for context
 * @returns Generated description or null if unavailable
 */
export async function generateDescriptionWithBrowserAI(
  taskName: string,
  domain: string,
  extractedTerms?: {
    keywords: string[];
    phrases: string[];
    verbs: string[];
    nouns: string[];
    /** Optional context summary (e.g. from extractTermsWithBrowserAI) so the model interprets terms in the right context. */
    contextSummary?: string;
  },
  actionPlanSteps?: string[]
): Promise<string | null> {
  if (!isBrowserAIAvailable()) {
    return null;
  }

  try {
    const actionPlanContext = actionPlanSteps && actionPlanSteps.length > 0
      ? `\n\nAction plan steps (weave these into the description): ${actionPlanSteps.join('; ')}. Include research, strategy, timeline/schedule as appropriate.`
      : '';

    const contextSummaryBlock = extractedTerms?.contextSummary?.trim()
      ? `\n\nContext summary (interpret keywords/phrases in this light): ${extractedTerms.contextSummary}`
      : '';

    const termsContext = extractedTerms && (
      extractedTerms.keywords.length > 0 || 
      extractedTerms.phrases.length > 0 || 
      extractedTerms.verbs.length > 0 || 
      extractedTerms.nouns.length > 0
    )
      ? `\n\nRelevant context extracted from this task:
- Keywords: ${extractedTerms.keywords.slice(0, 5).join(', ')}${extractedTerms.keywords.length > 5 ? '...' : ''}
- Key Phrases: ${extractedTerms.phrases.slice(0, 3).join(', ')}${extractedTerms.phrases.length > 3 ? '...' : ''}
- Action Verbs: ${extractedTerms.verbs.slice(0, 3).join(', ')}${extractedTerms.verbs.length > 3 ? '...' : ''}
- Important Nouns: ${extractedTerms.nouns.slice(0, 5).join(', ')}${extractedTerms.nouns.length > 5 ? '...' : ''}`
      : '';

    const prompt = `Generate a clear, contextual description for this ${domain} task.

Task Name (full context — interpret all terms below within this): "${taskName}"${contextSummaryBlock}${termsContext}${actionPlanContext || ''}

Requirements:
- The task name above is the ONLY source of truth and the ONLY context. Interpret every keyword and phrase strictly in that context (e.g. "login" in "Fix login bug" means the login feature, not "to log in").
- The description must reflect ONLY the task name; do not use any word or concept that is not stated or clearly implied by the task name.
- Write 1-3 full, contextual sentences that explain what the task involves. Use natural, flowing prose. Do not introduce topics (e.g. workout, fitness, notifications, re-occurring) that are not in the task name or action plan.
- Be SPECIFIC and CONTEXTUAL — use extracted terms only as they apply in the task name (e.g. prefer "login bug" over generic "bug" when the task is about a login bug).
- DO NOT repeat the task name verbatim. Use correct English: complete sentences, proper grammar, no redundant phrases (e.g. "X enables X"), no sentence fragments.
- Use professional, clear language appropriate for ${domain} tasks.
- ${BROWSER_AI_CONFIG.PROMPT.ACCURATE_LENGTH}
- Avoid run-on sentences: do not chain many clauses with "and", "but", or commas; use separate sentences when you have multiple points.
- Use only extracted keywords/phrases/verbs/nouns that are relevant in the context of the task name to build an accurate description (sentence or paragraph as needed).

Example (marketing plan):
Task: "Create a marketing plan that explain the new product launch."
Action plan: Create PPT Deck; Develop Marketing Strategy; Create Schedule for Product Launch.
Good description: "Research and build marketing ideas for the new product launch and build a timeline for the schedule launch."

Example (fix bug):
Task: "Fix login bug"
Good: "This task involves debugging authentication issues in the login system to restore user access."

Example (home task):
Task: "Dispose or sell for parts the old refrigerator in the garage."
Good: "This task involves removing, disposing, or selling for parts an old refrigerator located in the garage."

Generate the description now:`;

    const response = await generateTextWithBrowserAI(prompt, {
      temperature: BROWSER_AI_CONFIG.TEMPERATURE.DESCRIPTION,
      maxTokens: BROWSER_AI_CONFIG.MAX_TOKENS.DESCRIPTION,
    });

    if (response) {
      // Clean up the response (remove quotes, extra whitespace, etc.)
      return response.trim().replace(/^["']|["']$/g, '');
    }

    return null;
  } catch (error) {
    logger.warn('Error generating description with Browser AI API:', error);
    return null;
  }
}

/**
 * Check Browser AI API availability and log status
 */
export function checkBrowserAIStatus(): {
  available: boolean;
  models: string[];
} {
  const available = isBrowserAIAvailable();
  const models: string[] = [];

  if (available) {
    // Try to get models synchronously if possible
    try {
      const ai = (window as any).ai;
      if (ai && typeof ai.languageModel === 'function') {
        // Models might be available synchronously in some implementations
        models.push('Browser AI API');
      }
    } catch (error) {
      // Ignore errors in status check
    }
  }

  if (process.env.NODE_ENV === 'development') {
    logger.debug('Browser AI API Status:', {
      available,
      models: models.length > 0 ? models : ['Unknown'],
    });
  }

  return {
    available,
    models,
  };
}
