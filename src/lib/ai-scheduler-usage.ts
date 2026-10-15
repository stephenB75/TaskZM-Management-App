/**
 * AI Scheduler Usage Tracking
 * Tracks weekly usage for free tier users
 */

import { AI_USAGE_STORAGE_KEY, FREE_TIER_WEEKLY_AI_LIMIT } from './ai-config';

const USAGE_STORAGE_KEY = AI_USAGE_STORAGE_KEY;
const WEEKLY_LIMIT = FREE_TIER_WEEKLY_AI_LIMIT;

interface UsageData {
  weekStart: string; // ISO date string for Monday of current week
  count: number; // Number of auto-schedule suggestions used this week
}

/**
 * Get the Monday of the current week (start of week)
 */
function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get current usage data
 */
export function getAIUsage(): UsageData {
  const weekStart = getWeekStart();
  const weekStartStr = weekStart.toISOString();
  
  try {
    const stored = localStorage.getItem(USAGE_STORAGE_KEY);
    if (stored) {
      const data: UsageData = JSON.parse(stored);
      // If stored week is different from current week, reset
      if (data.weekStart !== weekStartStr) {
        const newData: UsageData = { weekStart: weekStartStr, count: 0 };
        localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(newData));
        return newData;
      }
      return data;
    }
  } catch (error) {
    console.warn('Failed to read AI usage from localStorage:', error);
  }
  
  // Return fresh data for new week
  const newData: UsageData = { weekStart: weekStartStr, count: 0 };
  localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(newData));
  return newData;
}

/**
 * Increment AI scheduler usage count
 */
export function incrementAIUsage(): void {
  const usage = getAIUsage();
  usage.count += 1;
  localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(usage));
}

/**
 * Check if user has reached the weekly limit
 */
export function hasReachedLimit(limit: number = WEEKLY_LIMIT): boolean {
  const usage = getAIUsage();
  return usage.count >= limit;
}

/**
 * Get remaining AI suggestions for the week
 */
export function getRemainingCount(limit: number = WEEKLY_LIMIT): number {
  const usage = getAIUsage();
  return Math.max(0, limit - usage.count);
}

/**
 * Get current usage count
 */
export function getCurrentUsage(): number {
  const usage = getAIUsage();
  return usage.count;
}

