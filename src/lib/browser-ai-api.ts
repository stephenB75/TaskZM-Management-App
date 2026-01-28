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
 */
export function isBrowserAIAvailable(): boolean {
  return typeof window !== 'undefined' && 
         typeof (window as any).ai !== 'undefined' && 
         (window as any).ai !== null;
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
    return null;
  }

  try {
    const ai = (window as any).ai;
    
    // Try languageModel API (standard Browser AI API)
    if (ai && typeof ai.languageModel === 'function') {
      const promptConfig: BrowserAIPrompt = {
        text: prompt,
        temperature: options.temperature ?? BROWSER_AI_CONFIG.TEMPERATURE.DEFAULT,
        maxTokens: options.maxTokens ?? BROWSER_AI_CONFIG.MAX_TOKENS.DEFAULT,
      };

      const response = await ai.languageModel.generateText(promptConfig);
      
      if (response && typeof response === 'string') {
        return response;
      }
      
      if (response && typeof response === 'object' && 'text' in response) {
        return (response as BrowserAIResponse).text;
      }
    }

    // Try alternative API format (some implementations use different structure)
    if (ai && typeof ai.generateText === 'function') {
      const response = await ai.generateText(prompt, options);
      if (response && typeof response === 'string') {
        return response;
      }
      if (response && typeof response === 'object' && 'text' in response) {
        return (response as BrowserAIResponse).text;
      }
    }
  } catch (error) {
    logger.warn('Error generating text with Browser AI API:', error);
    return null;
  }

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
    const prompt = `Extract key information from this ${domain} task: "${text}"

Return a JSON object with:
- keywords: array of important keywords
- phrases: array of key phrases (${BROWSER_AI_CONFIG.PROMPT.PHRASE_LENGTH_RANGE})
- verbs: array of action verbs
- nouns: array of important nouns
- summary: a brief contextual summary (${BROWSER_AI_CONFIG.PROMPT.SUMMARY_LENGTH})

Format: {"keywords": [...], "phrases": [...], "verbs": [...], "nouns": [...], "summary": "..."}`;

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
  }
): Promise<string | null> {
  if (!isBrowserAIAvailable()) {
    return null;
  }

  try {
    const termsContext = extractedTerms
      ? `\n\nContext: Keywords: ${extractedTerms.keywords.join(', ')}, Phrases: ${extractedTerms.phrases.join(', ')}, Verbs: ${extractedTerms.verbs.join(', ')}, Nouns: ${extractedTerms.nouns.join(', ')}`
      : '';

    const prompt = `Generate a clear, contextual description for this ${domain} task: "${taskName}"${termsContext}

Requirements:
- Be specific and contextual
- Don't repeat the task name
- Use professional language
- Keep it concise (${BROWSER_AI_CONFIG.PROMPT.SUMMARY_LENGTH})
- Focus on what the task involves or aims to accomplish

Description:`;

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
