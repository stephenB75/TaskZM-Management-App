import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getFromLocalStorage, saveToLocalStorage } from '../lib/utils';

interface AISettings {
  autoSchedulingEnabled: boolean;
  priorityBasedScheduling: boolean;
  scheduleUnscheduledTasks: boolean;
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
};

export function AIProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AISettings>(() => {
    return getFromLocalStorage<AISettings>('ai-settings', DEFAULT_AI_SETTINGS);
  });

  // Persist settings to localStorage
  useEffect(() => {
    saveToLocalStorage('ai-settings', settings);
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
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
}
