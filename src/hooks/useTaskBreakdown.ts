/**
 * useTaskBreakdown Hook
 * 
 * Provides real-time task breakdown analysis with context-aware action plans,
 * description enhancement, and domain-specific insights.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Task } from '../types';
import { detectDomain, type Domain } from '../lib/domain-terminology';
import { analyzeDescription, type DescriptionAnalysis } from '../lib/description-analyzer';
import { generateActionPlan, type ActionPlan } from '../lib/action-plan-generator';
import { estimateTaskHours } from '../lib/daily-hours-utils';
import { analyzeTaskVerbs } from '../lib/verb-analysis';
import { MINUTES_PER_HOUR } from '../lib/business-constants';
import {
  TASK_BREAKDOWN_DEBOUNCE_MS,
  TASK_BREAKDOWN_CACHE_SIZE,
} from '../lib/ai-config';

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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/85c90fa8-930b-4fcf-a079-2d6d7391cfb2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTaskBreakdown.ts:68',message:'Hook entry - before useState calls',data:{titleLength:title?.length,descriptionLength:description?.length,enabled:options.enabled},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  const { debounceMs = TASK_BREAKDOWN_DEBOUNCE_MS, enabled = true } = options;
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/85c90fa8-930b-4fcf-a079-2d6d7391cfb2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTaskBreakdown.ts:69',message:'Before useState breakdown',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  const [breakdown, setBreakdown] = useState<TaskBreakdown | null>(null);
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/85c90fa8-930b-4fcf-a079-2d6d7391cfb2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTaskBreakdown.ts:70',message:'Before useState isLoading',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  const [isLoading, setIsLoading] = useState(false);
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/85c90fa8-930b-4fcf-a079-2d6d7391cfb2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTaskBreakdown.ts:71',message:'Before useState error',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  const [error, setError] = useState<Error | null>(null);

  // Create cache key
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/85c90fa8-930b-4fcf-a079-2d6d7391cfb2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTaskBreakdown.ts:74',message:'Before useMemo cacheKey',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  const cacheKey = useMemo(() => {
    const text = `${title}${description}`.trim();
    const key = text.length > 0 ? hashText(text) : '';
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/85c90fa8-930b-4fcf-a079-2d6d7391cfb2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTaskBreakdown.ts:77',message:'useMemo cacheKey computed',data:{cacheKey:key,textLength:text.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    return key;
  }, [title, description]);

  // Check cache first
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/85c90fa8-930b-4fcf-a079-2d6d7391cfb2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTaskBreakdown.ts:80',message:'Before useMemo cachedBreakdown',data:{cacheKey},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  const cachedBreakdown = useMemo(() => {
    if (!cacheKey) return null;
    const cached = breakdownCache.get(cacheKey) || null;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/85c90fa8-930b-4fcf-a079-2d6d7391cfb2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTaskBreakdown.ts:83',message:'useMemo cachedBreakdown computed',data:{hasCached:!!cached},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    return cached;
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

    // Check cache directly using current cacheKey
    // Use cacheKey from closure, but verify it's valid
    const currentCacheKey = `${title}${description}`.trim();
    const hashKey = currentCacheKey.length > 0 ? hashText(currentCacheKey) : '';
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
          // Detect domain
          const domainDetection = detectDomain(title, description);

          // Create temporary task for analysis
          const tempTask: Partial<Task> = {
            title,
            description,
            status: 'todo',
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
            status: 'todo',
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

          // Analyze description
          const descriptionAnalysis = analyzeDescription(title, description);

          // Generate action plan
          const actionPlan = generateActionPlan(tempTask as Task);

          // Determine suggested category from domain
          let suggestedCategory: 'work' | 'personal' | 'projects' | null = null;
          if (domainDetection.domain === 'business') {
            suggestedCategory = 'work';
          } else if (domainDetection.domain === 'personal') {
            suggestedCategory = 'personal';
          } else if (domainDetection.domain === 'home' || domainDetection.domain === 'world') {
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
            domain: domainDetection.domain,
            confidence: domainDetection.confidence,
          };

          // Cache result
          if (cacheKey) {
            breakdownCache.set(cacheKey, result);
            // Limit cache size
            if (breakdownCache.size > TASK_BREAKDOWN_CACHE_SIZE) {
              const firstKey = breakdownCache.keys().next().value;
              if (firstKey) {
                breakdownCache.delete(firstKey);
              }
            }
          }

          setBreakdown(result);
          setIsLoading(false);
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Failed to analyze breakdown');
          setError(error);
          setIsLoading(false);
        }
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to analyze breakdown');
      setError(error);
      setIsLoading(false);
    }
  }, [title, description, enabled, cacheKey]);

  // Debounce analysis
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/85c90fa8-930b-4fcf-a079-2d6d7391cfb2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTaskBreakdown.ts:211',message:'Before useEffect',data:{enabled,titleLength:title?.length,descriptionLength:description?.length,hasCachedBreakdown:!!cachedBreakdown},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/85c90fa8-930b-4fcf-a079-2d6d7391cfb2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTaskBreakdown.ts:213',message:'useEffect executing',data:{enabled},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
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

