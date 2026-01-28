/**
 * useTaskBreakdown Hook
 * 
 * Provides real-time task breakdown analysis with context-aware action plans,
 * description enhancement, and domain-specific insights.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Task } from '../types';
import { type Domain } from '../lib/domain-terminology';
import { analyzeDescription, type DescriptionAnalysis } from '../lib/description-analyzer';
import { generateActionPlan, type ActionPlan } from '../lib/action-plan-generator';
import { estimateTaskHours, cacheAIAnalysis } from '../lib/daily-hours-utils';
import { analyzeTaskVerbs } from '../lib/verb-analysis';
import { MINUTES_PER_HOUR, DEFAULT_PROJECT_ID } from '../lib/business-constants';
import {
  TASK_BREAKDOWN_DEBOUNCE_MS,
  TASK_BREAKDOWN_CACHE_SIZE,
} from '../lib/ai-config';
import { DEFAULT_TASK_STATUS, DEFAULT_TASK_PRIORITY, DEFAULT_TASK_DOMAIN, DEFAULT_CREATED_BY, TEMP_TASK_ID } from '../lib/task-constants';
import { createAIContextSync, type AIContext } from '../lib/ai-context';
import { getDomainTerminology } from '../lib/domain-terminology';
import { DOMAIN_DETECTION_THRESHOLDS, LOGGING_CONFIG } from '../lib/ai-config';

export interface TaskBreakdown {
  estimatedMinutes: number;
  estimatedHours: number;
  effortScore: number;
  primaryVerb: string;
  suggestedCategory: 'work' | 'personal' | 'projects' | null;
  actionPlan: ActionPlan | null;
  descriptionAnalysis: DescriptionAnalysis | null;
  domain: Domain;
  confidence: number;
}

interface UseTaskBreakdownOptions {
  debounceMs?: number;
  enabled?: boolean;
}

/**
 * Simple text hash for caching
 */
function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Cache for breakdown results
 */
const breakdownCache = new Map<string, TaskBreakdown>();

/**
 * Real-time task breakdown hook with context-aware analysis
 */
export function useTaskBreakdown(
  title: string,
  description: string,
  options: UseTaskBreakdownOptions = {}
): {
  breakdown: TaskBreakdown | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { debounceMs = TASK_BREAKDOWN_DEBOUNCE_MS, enabled = true } = options;
  const [breakdown, setBreakdown] = useState<TaskBreakdown | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Create cache key
  const cacheKey = useMemo(() => {
    const text = `${title}${description}`.trim();
    return text.length > 0 ? hashText(text) : '';
  }, [title, description]);

  // Check cache first
  const cachedBreakdown = useMemo(() => {
    if (!cacheKey) return null;
    return breakdownCache.get(cacheKey) || null;
  }, [cacheKey]);

  // Analyze task breakdown
  // Remove cachedBreakdown from dependencies to break circular dependency
  const analyzeBreakdown = useCallback(() => {
    if (!enabled) {
      setBreakdown(null);
      setIsLoading(false);
      return;
    }

    const text = `${title}${description}`.trim();
    if (!text || text.length === 0) {
      setBreakdown(null);
      setIsLoading(false);
      return;
    }

    // Check cache directly using current text (not from closure)
    // Recompute hash to ensure we're using current values
    const currentText = `${title}${description}`.trim();
    const hashKey = currentText.length > 0 ? hashText(currentText) : '';
    if (hashKey && breakdownCache.has(hashKey)) {
      const cached = breakdownCache.get(hashKey);
      if (cached) {
        setBreakdown(cached);
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    // Use setTimeout with 0 delay to defer heavy computation and avoid blocking UI
    // This allows the UI to remain responsive while analysis runs
    // Note: This timeout cannot be cancelled from here, but the useEffect that calls
    // this function will handle cleanup by preventing state updates if dependencies change
    setTimeout(() => {
      try {
        // Create temporary task for analysis
        const tempTask: Partial<Task> = {
          title,
          description,
          status: DEFAULT_TASK_STATUS,
          priority: 'medium',
          tags: [],
        };

        // Analyze verbs FIRST to get effort score
        const verbAnalysis = analyzeTaskVerbs(tempTask as Task);
        
        // Create shared AI context once (eliminates redundant domain detection and term extraction)
        // ENHANCED: Include effort score and primary verb in context for coordinated intelligence
        // CRITICAL: Add error handling to ensure domain is always defined
        let aiContext;
        try {
          aiContext = createAIContextSync(title, description);
          
          // Validate that domain is defined
          if (!aiContext.domain || (aiContext.domain !== 'business' && aiContext.domain !== 'home' && aiContext.domain !== 'personal' && aiContext.domain !== 'world' && aiContext.domain !== 'mixed')) {
            console.error('AI Analysis: Invalid domain detected, using fallback', { 
              domain: aiContext.domain, 
              title: title.substring(0, LOGGING_CONFIG.MAX_LOG_TEXT_LENGTH),
              description: description.substring(0, LOGGING_CONFIG.MAX_LOG_TEXT_LENGTH)
            });
            // Create fallback context with default domain
            aiContext = {
              ...aiContext,
              domain: DEFAULT_TASK_DOMAIN,
              domainConfidence: DOMAIN_DETECTION_THRESHOLDS.DEFAULT_CONFIDENCE,
              domainKeywords: [],
            };
          }
        } catch (error) {
          console.error('AI Analysis: Error creating AI context, using fallback:', error);
          // Create minimal fallback context
          const defaultDomain = DEFAULT_TASK_DOMAIN;
          aiContext = {
            domain: defaultDomain,
            domainConfidence: DOMAIN_DETECTION_THRESHOLDS.DEFAULT_CONFIDENCE,
            domainKeywords: [],
            domainTerms: getDomainTerminology(defaultDomain),
            extractedTerms: {
              keywords: [],
              phrases: [],
              verbs: [],
              nouns: [],
              pronouns: [],
              context: '',
            },
            enhancedTerms: {
              keywords: [],
              phrases: [],
              verbs: [],
              nouns: [],
              pronouns: [],
            },
            fullText: `${title} ${description}`.trim(),
            title: title.trim(),
            description: description.trim(),
          };
        }
        
        // Add effort analysis to context for coordination
        (aiContext as any).effortScore = verbAnalysis.effortScore;
        (aiContext as any).primaryVerb = verbAnalysis.primaryVerb;
        
        // Log for debugging (only in development)
        if (process.env.NODE_ENV === 'development') {
          console.log('AI Analysis: Creating context with effort score', {
            title: title.substring(0, LOGGING_CONFIG.MAX_LOG_TEXT_LENGTH),
            description: description.substring(0, LOGGING_CONFIG.MAX_LOG_TEXT_LENGTH),
            domain: aiContext.domain,
            confidence: aiContext.domainConfidence,
            effortScore: verbAnalysis.effortScore,
            primaryVerb: verbAnalysis.primaryVerb,
          });
        }

        // Estimate hours
        const taskForEstimation: Task = {
          id: TEMP_TASK_ID,
          title,
          description,
          status: DEFAULT_TASK_STATUS,
          priority: DEFAULT_TASK_PRIORITY,
          tags: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          projectId: DEFAULT_PROJECT_ID,
          folderId: null,
          dueDate: null,
          scheduledDate: null,
          estimatedTime: null,
          actualTime: null,
          dependencies: [],
          subtasks: [],
          recurrence: { type: 'none', interval: 1 },
          notes: '',
          assignedTo: [],
          createdBy: DEFAULT_CREATED_BY,
          completedAt: null,
        };

        const estimatedHours = estimateTaskHours(taskForEstimation);
        const estimatedMinutes = Math.round(estimatedHours * MINUTES_PER_HOUR);

        // CRITICAL: Ensure domain is defined before using it
        // Double-check domain is valid (defensive programming)
        const validDomain = aiContext.domain && 
          (aiContext.domain === 'business' || aiContext.domain === 'home' || 
           aiContext.domain === 'personal' || aiContext.domain === 'world' || 
           aiContext.domain === 'mixed')
          ? aiContext.domain
          : DEFAULT_TASK_DOMAIN;
        
        // Ensure aiContext has valid domain before passing to other functions
        const safeAIContext = {
          ...aiContext,
          domain: validDomain,
          domainConfidence: aiContext.domainConfidence ?? DOMAIN_DETECTION_THRESHOLDS.DEFAULT_CONFIDENCE,
        };
        
        // Analyze description (pass shared context and effort score to avoid redundant work)
        const descriptionAnalysis = analyzeDescription(title, description, safeAIContext, verbAnalysis.effortScore);

        // Generate action plan (pass shared context to avoid redundant work)
        const actionPlan = generateActionPlan(tempTask as Task, safeAIContext);

        // Determine suggested category from domain
        let suggestedCategory: 'work' | 'personal' | 'projects' | null = null;
        if (validDomain === 'business') {
          suggestedCategory = 'work';
        } else if (validDomain === 'personal') {
          suggestedCategory = 'personal';
        } else if (validDomain === 'home' || validDomain === 'world') {
          suggestedCategory = 'personal'; // Default to personal for home/world
        }

        const result: TaskBreakdown = {
          estimatedMinutes,
          estimatedHours,
          effortScore: verbAnalysis.effortScore,
          primaryVerb: verbAnalysis.primaryVerb,
          suggestedCategory,
          actionPlan,
          descriptionAnalysis,
          domain: validDomain,
          confidence: safeAIContext.domainConfidence,
        };

        // Cache result using current hash (not from closure)
        const resultHashKey = currentText.length > 0 ? hashText(currentText) : '';
        if (resultHashKey) {
          breakdownCache.set(resultHashKey, result);
          // Limit cache size
          if (breakdownCache.size > TASK_BREAKDOWN_CACHE_SIZE) {
            const firstKey = breakdownCache.keys().next().value;
            if (firstKey !== undefined) {
              breakdownCache.delete(firstKey);
            }
          }
        }

        // Cache AI Analysis results for use by scheduler
        // This ensures the scheduler uses the same effort score and time estimate
        // that was shown to the user in the AI Analysis suggestions
        cacheAIAnalysis(
          title,
          description,
          verbAnalysis.effortScore,
          estimatedMinutes,
          verbAnalysis.primaryVerb
        );

        if (process.env.NODE_ENV === 'development') {
          console.log('AI Analysis: Breakdown generated', {
            estimatedMinutes: result.estimatedMinutes,
            effortScore: result.effortScore,
            domain: result.domain,
            hasActionPlan: !!result.actionPlan,
            hasDescriptionAnalysis: !!result.descriptionAnalysis,
          });
        }

        setBreakdown(result);
        setIsLoading(false);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to analyze breakdown');
        console.error('AI Analysis: Error in breakdown analysis', error);
        setError(error);
        setIsLoading(false);
        setBreakdown(null); // Ensure breakdown is null on error
      }
    }, 0);
    
    // Store timeout ID in a way that can be cleaned up by the useEffect
    // Note: The actual cleanup happens in the useEffect that calls this function
  }, [title, description, enabled]);

  // Debounce analysis
  useEffect(() => {
    if (!enabled) {
      setBreakdown(null);
      setIsLoading(false);
      return;
    }

    const text = `${title}${description}`.trim();
    if (!text || text.length === 0) {
      setBreakdown(null);
      setIsLoading(false);
      return;
    }

    // Check cache immediately using current cacheKey (not from closure)
    if (cacheKey && cachedBreakdown) {
      setBreakdown(cachedBreakdown);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timeoutId = setTimeout(() => {
      analyzeBreakdown();
    }, debounceMs);

    return () => {
      clearTimeout(timeoutId);
    };
    // Remove analyzeBreakdown from dependencies to prevent infinite loops
    // analyzeBreakdown is stable (useCallback with title/description deps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, debounceMs, enabled, cacheKey, cachedBreakdown]);

  return {
    breakdown,
    isLoading,
    error,
  };
}

/**
 * Clear breakdown cache (useful for testing or when terminology updates)
 */
export function clearBreakdownCache(): void {
  breakdownCache.clear();
}

