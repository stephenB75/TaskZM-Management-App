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
import { MINUTES_PER_HOUR } from '../lib/business-constants';
import {
  TASK_BREAKDOWN_DEBOUNCE_MS,
  TASK_BREAKDOWN_CACHE_SIZE,
} from '../lib/ai-config';
import { DEFAULT_TASK_STATUS } from '../lib/task-constants';
import { createAIContextSync, type AIContext } from '../lib/ai-context';

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

    try {
      // Use requestAnimationFrame to avoid blocking UI
      requestAnimationFrame(() => {
        try {
          // Create shared AI context once (eliminates redundant domain detection and term extraction)
          const aiContext = createAIContextSync(title, description);
          
          // Log for debugging
          console.log('AI Analysis: Creating context', {
            title: title.substring(0, 50),
            description: description.substring(0, 50),
            domain: aiContext.domain,
            confidence: aiContext.domainConfidence,
          });

          // Create temporary task for analysis
          const tempTask: Partial<Task> = {
            title,
            description,
            status: DEFAULT_TASK_STATUS,
            priority: 'medium',
            tags: [],
          };

          // Analyze verbs
          const verbAnalysis = analyzeTaskVerbs(tempTask as Task);

          // Estimate hours
          const taskForEstimation: Task = {
            id: 'temp',
            title,
            description,
            status: DEFAULT_TASK_STATUS,
            priority: 'medium',
            tags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            projectId: 'default',
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
            createdBy: 'local',
            completedAt: null,
          };

          const estimatedHours = estimateTaskHours(taskForEstimation);
          const estimatedMinutes = Math.round(estimatedHours * MINUTES_PER_HOUR);

          // Analyze description (pass shared context and effort score to avoid redundant work)
          const descriptionAnalysis = analyzeDescription(title, description, aiContext, verbAnalysis.effortScore);

          // Generate action plan (pass shared context to avoid redundant work)
          const actionPlan = generateActionPlan(tempTask as Task, aiContext);

          // Determine suggested category from domain
          let suggestedCategory: 'work' | 'personal' | 'projects' | null = null;
          if (aiContext.domain === 'business') {
            suggestedCategory = 'work';
          } else if (aiContext.domain === 'personal') {
            suggestedCategory = 'personal';
          } else if (aiContext.domain === 'home' || aiContext.domain === 'world') {
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
            domain: aiContext.domain,
            confidence: aiContext.domainConfidence,
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

          console.log('AI Analysis: Breakdown generated', {
            estimatedMinutes: result.estimatedMinutes,
            effortScore: result.effortScore,
            domain: result.domain,
            hasActionPlan: !!result.actionPlan,
            hasDescriptionAnalysis: !!result.descriptionAnalysis,
          });

          setBreakdown(result);
          setIsLoading(false);
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Failed to analyze breakdown');
          console.error('AI Analysis: Error in breakdown analysis', error);
          setError(error);
          setIsLoading(false);
          setBreakdown(null); // Ensure breakdown is null on error
        }
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to analyze breakdown');
      setError(error);
      setIsLoading(false);
    }
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
  }, [title, description, debounceMs, enabled, cacheKey, cachedBreakdown, analyzeBreakdown]);

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

