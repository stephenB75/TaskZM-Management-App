import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getFromLocalStorage, saveToLocalStorage } from '../lib/utils';
import { createDefaultAIContext } from '../lib/context-defaults';
import { AI_DAILY_HOUR_OPTIONS } from '../lib/ai-config';
import { STORAGE_KEY_AI_SETTINGS } from '../lib/business-constants';

interface AISettings {
  autoSchedulingEnabled: boolean;
  priorityBasedScheduling: boolean;
  scheduleUnscheduledTasks: boolean;
  maxHoursPerDay: number; // Daily work hour limit (5, 8, or 10)
}

interface AIContextType {
  settings: AISettings;
  updateSettings: (updates: Partial<AISettings>) => void;
  toggleAutoScheduling: () => void;
  togglePriorityBasedScheduling: () => void;
  toggleScheduleUnscheduledTasks: () => void;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

const DEFAULT_AI_SETTINGS: AISettings = {
  autoSchedulingEnabled: true,
  priorityBasedScheduling: true,
  scheduleUnscheduledTasks: true,
  maxHoursPerDay: AI_DAILY_HOUR_OPTIONS.FIVE_HOURS, // Default to 5 hours
};

export function AIProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AISettings>(() => {
    const stored = getFromLocalStorage<Partial<AISettings>>(STORAGE_KEY_AI_SETTINGS, DEFAULT_AI_SETTINGS);
    const merged = { ...DEFAULT_AI_SETTINGS, ...stored };
    if (!Number.isFinite(merged.maxHoursPerDay) || merged.maxHoursPerDay <= 0) {
      merged.maxHoursPerDay = DEFAULT_AI_SETTINGS.maxHoursPerDay;
    }
    return merged;
  });

  // Persist settings to localStorage
  useEffect(() => {
    saveToLocalStorage(STORAGE_KEY_AI_SETTINGS, settings);
  }, [settings]);

  const updateSettings = (updates: Partial<AISettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const toggleAutoScheduling = () => {
    setSettings(prev => ({ ...prev, autoSchedulingEnabled: !prev.autoSchedulingEnabled }));
  };

  const togglePriorityBasedScheduling = () => {
    setSettings(prev => ({ ...prev, priorityBasedScheduling: !prev.priorityBasedScheduling }));
  };

  const toggleScheduleUnscheduledTasks = () => {
    setSettings(prev => ({ ...prev, scheduleUnscheduledTasks: !prev.scheduleUnscheduledTasks }));
  };

  return (
    <AIContext.Provider
      value={{
        settings,
        updateSettings,
        toggleAutoScheduling,
        togglePriorityBasedScheduling,
        toggleScheduleUnscheduledTasks,
      }}
    >
      {children}
    </AIContext.Provider>
  );
}

export function useAI() {
  const context = useContext(AIContext);
  if (context === undefined) {
    // During React Fast Refresh (HMR), providers can temporarily unmount
    // Return a safe default instead of throwing to prevent crashes
    if (import.meta.env.DEV) {
      console.warn('useAI called outside AIProvider (likely HMR issue), returning default');
      return createDefaultAIContext();
    }
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
}
