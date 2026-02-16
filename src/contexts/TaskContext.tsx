import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, startTransition } from 'react';
import { toast } from '../lib/toast-wrapper';
import { useAuth } from './AuthContext';
import { useSubscription } from './SubscriptionContext';
// Removed TeamContext import to break circular dependency
// TeamContext depends on TaskContext, so TaskContext cannot depend on TeamContext
// Use useTeam hook in components that need team member info instead
import { useDemoActivity } from '../hooks/useDemoActivity';
import * as api from '../lib/api';
import { generateId, getFromLocalStorage, saveToLocalStorage, getDateString, getSeriesBaseId } from '../lib/utils';
import { migrateOrphanRecurringSeries } from '../lib/migrate-recurring-series';
import { generateSampleTasks, generateSampleProjects } from '../lib/sampleData';
import { logger } from '../lib/logger';
import { getCategoryHoursForTask } from '../lib/category-hours-utils';
import { getTaskMinutes } from '../lib/daily-hours-utils';
import type { Task, Project, Folder, TaskFilters, ViewConfig, HoursSettings, RolloverSettings, RecurrenceConfig } from '../types';
import {
  WORKSPACE_MAX_RETRIES,
  WORKSPACE_RETRY_DELAY_BASE_MS,
  WORKSPACE_TOAST_DURATION_MS,
  WORKSPACE_NAME_FALLBACK,
  WORKSPACE_NAME_SUFFIX,
  WORKSPACE_SYNC_INTERVAL_ACTIVE_MS,
  WORKSPACE_SYNC_INTERVAL_IDLE_MS,
  WORKSPACE_SYNC_INTERVAL_MAX_MS,
  WORKSPACE_ACTIVITY_TIMEOUT_MS,
  WORKSPACE_SYNC_NO_CHANGE_THRESHOLD,
  WORKSPACE_NETWORK_ERROR_THRESHOLD,
  WORKSPACE_NETWORK_ERROR_BACKOFF_BASE_MS,
  WORKSPACE_NETWORK_ERROR_BACKOFF_MAX_MS,
} from '../lib/layout-constants';
import { TIMING_CONSTANTS } from '../lib/timing-constants';
import {
  TOAST_DURATION_MEDIUM_MS,
  TOAST_DURATION_LONG_MS,
  TOAST_DURATION_EXTRA_LONG_MS,
} from '../lib/layout-constants';
import {
  DEFAULT_PROJECT_ID,
  DEFAULT_PROJECT_NAME,
  DEFAULT_PROJECT_DESCRIPTION,
  DEFAULT_TAGS,
  PROTECTED_TAGS,
  DEFAULT_WEEKDAY_WORK_START,
  DEFAULT_WEEKDAY_WORK_END,
  DEFAULT_WEEKDAY_PERSONAL_START,
  DEFAULT_WEEKDAY_PERSONAL_END,
  DEFAULT_WEEKDAY_PROJECTS_START,
  DEFAULT_WEEKDAY_PROJECTS_END,
  DEFAULT_WEEKEND_WORK_START,
  DEFAULT_WEEKEND_WORK_END,
  DEFAULT_WEEKEND_PERSONAL_START,
  DEFAULT_WEEKEND_PERSONAL_END,
  DEFAULT_WEEKEND_PROJECTS_START,
  DEFAULT_WEEKEND_PROJECTS_END,
  SYNC_INTERVAL_30_SECONDS,
  MINUTES_PER_HOUR,
  MILLISECONDS_PER_MINUTE,
  HOURS_PER_DAY,
  WORKSPACE_SYNC_ACTIVE_MULTIPLIER,
  WORKSPACE_SYNC_IDLE_MULTIPLIER,
  DATE_ONLY_PARSE_SUFFIX,
  RECURRENCE_OCCURRENCE_ID_SUFFIX_SUBTASKS,
  RECURRENCE_OCCURRENCE_ID_SUFFIX_COMPLETED,
  RECURRENCE_NONE_CONFIG,
} from '../lib/business-constants';
import { TIME_ROUNDING_INTERVAL_MINUTES } from '../lib/ai-config';
import { COLOR_PROJECT_DEFAULT } from '../lib/color-theme';
import { createDefaultTaskContext } from '../lib/context-defaults';

interface TaskContextType {
  tasks: Task[];
  projects: Project[];
  folders: Folder[];
  availableTags: string[];
  filters: TaskFilters;
  viewConfig: ViewConfig;
  hoursSettings: HoursSettings;
  rolloverSettings: RolloverSettings;
  workspaceId: string | null;
  isLoading: boolean;
  isSyncing: boolean;
  lastSync: Date | null;
  addTask: (task: Partial<Task>) => Promise<void>;
  addTaskSeries: (tasks: Task[]) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  bulkDeleteTasks: (taskIds: string[]) => Promise<void>;
  addProject: (project: Partial<Project>) => Promise<void>;
  updateProject: (projectId: string, updates: Partial<Project>) => Promise<void>;
  addFolder: (folder: Partial<Folder>) => Promise<void>;
  updateFolder: (folderId: string, updates: Partial<Folder>) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  addAvailableTag: (tag: string) => Promise<void>;
  removeAvailableTag: (tag: string) => Promise<void>;
  setFilters: (filters: TaskFilters) => void;
  setViewConfig: (config: ViewConfig) => void;
  updateHoursSettings: (settings: Partial<HoursSettings>) => Promise<void>;
  updateRolloverSettings: (settings: Partial<RolloverSettings>) => Promise<void>;
  syncWithServer: () => Promise<void>;
  ensureWorkspace: () => Promise<string | null>;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

// Constants moved to business-constants.ts

export function TaskProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  const { hasFeature } = useSubscription();
  
  // Removed TeamContext dependency to break circular dependency
  // TeamContext depends on TaskContext (for workspaceId), so TaskContext cannot depend on TeamContext
  // Permission checks that require team member info should be handled at component level using useTeam() hook
  
  const { updateActivity } = useDemoActivity(); // Track demo user activity
  const [tasks, setTasks] = useState<Task[]>([]);
  const tasksRef = useRef<Task[]>([]); // Ref to access current tasks without causing dependency issues
  const [projects, setProjects] = useState<Project[]>([
    {
      id: DEFAULT_PROJECT_ID,
      name: DEFAULT_PROJECT_NAME,
      color: COLOR_PROJECT_DEFAULT,
      description: DEFAULT_PROJECT_DESCRIPTION,
      createdAt: new Date().toISOString(),
      archived: false,
    },
  ]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>(DEFAULT_TAGS);
  const [filters, setFilters] = useState<TaskFilters>({});
  const [viewConfig, setViewConfig] = useState<ViewConfig>({
    groupBy: 'none',
    sortBy: 'dueDate',
    sortOrder: 'asc',
    showCompleted: true,
  });
  const [isLoading, setIsLoading] = useState(true); // Track workspace loading state
  const [hoursSettings, setHoursSettings] = useState<HoursSettings>({
    weekdayHours: {
      work: { start: DEFAULT_WEEKDAY_WORK_START, end: DEFAULT_WEEKDAY_WORK_END, enabled: true },
      personal: { start: DEFAULT_WEEKDAY_PERSONAL_START, end: DEFAULT_WEEKDAY_PERSONAL_END, enabled: true },
      projects: { start: DEFAULT_WEEKDAY_PROJECTS_START, end: DEFAULT_WEEKDAY_PROJECTS_END, enabled: true },
    },
    weekendHours: {
      work: { start: DEFAULT_WEEKEND_WORK_START, end: DEFAULT_WEEKEND_WORK_END, enabled: false },
      personal: { start: DEFAULT_WEEKEND_PERSONAL_START, end: DEFAULT_WEEKEND_PERSONAL_END, enabled: true },
      projects: { start: DEFAULT_WEEKEND_PROJECTS_START, end: DEFAULT_WEEKEND_PROJECTS_END, enabled: true },
    },
    respectHours: true,
  });
  const [rolloverSettings, setRolloverSettings] = useState<RolloverSettings>({
    autoRollover: true,
    askBeforeRolling: false,
  });
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [syncInterval, setSyncInterval] = useState(WORKSPACE_SYNC_INTERVAL_IDLE_MS); // Start with idle interval (2 minutes)
  const syncLockRef = useRef<boolean>(false); // Prevent concurrent sync operations
  const consecutiveNoChangeSyncsRef = useRef<number>(0); // Track backoff when no changes detected
  const consecutiveNetworkErrorsRef = useRef<number>(0); // Track consecutive network errors for backoff
  const syncIntervalRef = useRef<number>(WORKSPACE_SYNC_INTERVAL_IDLE_MS); // Keep latest interval in ref to avoid stale closures
  const syncWithServerRef = useRef<((wsId?: string, silent?: boolean) => Promise<void>) | null>(null); // Store latest sync function to avoid dependency issues
  const lastErrorToastRef = useRef<{ message: string; timestamp: number } | null>(null); // Track last error toast to prevent duplicates
  const lastNetworkErrorLogRef = useRef<number>(0); // Track last network error log time to suppress repeated warnings
  // Lock to prevent concurrent next occurrence creation for the same recurring task
  const nextOccurrenceCreationLock = useRef<Set<string>>(new Set());
  
  // Activity tracking for adaptive polling
  const lastActivityRef = useRef<number>(Date.now());
  const isActiveRef = useRef<boolean>(false);
  
  // Store last sync timestamps and ETags for delta sync
  const lastSyncTimestampsRef = useRef<{
    tasks?: string;
    projects?: string;
    folders?: string;
  }>({});
  const lastETagsRef = useRef<{
    tasks?: string;
    projects?: string;
    folders?: string;
  }>({});

  // Keep latest interval readily available for callback logic
  useEffect(() => {
    syncIntervalRef.current = syncInterval;
  }, [syncInterval]);

  // Keep tasksRef in sync with tasks state (for comparison in syncWithServer)
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Optimistic loading: Load from localStorage immediately, then sync with server in background
  useEffect(() => {
    if (!user || !accessToken) {
      // Not authenticated - use localStorage as fallback only (no userId check needed)
      const savedTasks = getFromLocalStorage<Task[]>('tasks', []);
      const savedProjects = getFromLocalStorage<Project[]>('projects', []);
      setTasks(savedTasks);
      if (savedProjects.length > 0) {
        setProjects(savedProjects);
      }
      setAvailableTags(getFromLocalStorage<string[]>('availableTags', DEFAULT_TAGS));
      // Also load folders from localStorage when not authenticated
      const savedFolders = getFromLocalStorage<Folder[]>('folders', []);
      if (savedFolders.length > 0) {
        setFolders(savedFolders);
      }
      setIsLoading(false); // Not loading if no user
      return;
    }

    // Authenticated - OPTIMISTIC LOADING: Load from localStorage immediately for instant UI
    // Then sync with server in background to get latest data
    const savedTasks = getFromLocalStorage<Task[]>('tasks', [], user.id);
    const savedProjects = getFromLocalStorage<Project[]>('projects', [], user.id);
    const savedFolders = getFromLocalStorage<Folder[]>('folders', [], user.id);
    const savedTags = getFromLocalStorage<string[]>('availableTags', DEFAULT_TAGS, user.id);
    
    // Set cached data immediately for instant UI rendering
    if (savedTasks.length > 0) {
      setTasks(savedTasks);
    }
    if (savedProjects.length > 0) {
      setProjects(savedProjects);
    }
    if (savedFolders.length > 0) {
      setFolders(savedFolders);
    }
    setAvailableTags(savedTags);
    
    // Then load from server in background (non-blocking)
    // This ensures UI appears immediately while fresh data loads
    loadWorkspace();
  }, [user, accessToken]);

  // Sync local-only data when workspace becomes available
  // Always prioritize server data to ensure cross-device sync
  useEffect(() => {
    if (!workspaceId || !accessToken || !user) return;

    let isMounted = true;

    // Always load from server first (source of truth)
    // This ensures desktop and mobile see the same data
    loadTasksFromServer(workspaceId).then((serverTasks) => {
      if (!isMounted) return;

      // After loading from server, check for any local-only tasks
      const localTasks = getFromLocalStorage<Task[]>('tasks', [], user?.id);
      // Use serverTasks directly instead of tasks state to avoid stale closure
      const serverTaskIds = new Set((serverTasks || []).map(t => t.id));
      
      // Find tasks that exist locally but not on server
      const localOnlyTasks = localTasks.filter(task => {
        return !serverTaskIds.has(task.id) && (task.createdBy === 'local' || !task.createdBy);
      });

      if (localOnlyTasks.length > 0) {
        logger.info(`Found ${localOnlyTasks.length} local-only task(s), syncing to server...`);
        
        // Sync each local task to server
        Promise.all(
          localOnlyTasks.map(async (task) => {
            try {
              // Update createdBy to user ID before syncing
              const taskToSync = {
                ...task,
                createdBy: user.id,
              };
              await api.saveTask(workspaceId, taskToSync);
              logger.debug(`Synced local task ${task.id} to server`);
            } catch (error) {
              logger.error(`Failed to sync local task ${task.id}:`, error);
            }
          })
        ).then(() => {
          if (!isMounted) return;
          // Reload from server to get authoritative data including newly synced tasks
          loadTasksFromServer(workspaceId).catch(err => {
            logger.error('Failed to reload tasks after sync:', err);
          });
        }).catch(err => {
          logger.error('Error during local data sync:', err);
        });
      }
    }).catch(err => {
      logger.error('Failed to load tasks from server during sync:', err);
    });

    return () => {
      isMounted = false;
    };
  }, [workspaceId, accessToken, user]); // Removed 'tasks' from dependencies to prevent infinite loop

  // Refetch tasks when tab becomes visible so user sees fresh data after switching tabs (avoids stale cache)
  const prevVisibilityRef = useRef(typeof document !== 'undefined' ? document.visibilityState : 'visible');
  useEffect(() => {
    if (!workspaceId || !user?.id || !accessToken) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && prevVisibilityRef.current === 'hidden') {
        loadTasksFromServer(workspaceId).catch((err) => {
          logger.debug('Visibility refetch tasks failed:', err);
        });
      }
      prevVisibilityRef.current = document.visibilityState;
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [workspaceId, user?.id, accessToken]);

  async function loadWorkspace() {
    if (!user || !accessToken) {
      logger.warn('Cannot load workspace: user or accessToken missing', { 
        hasUser: !!user, 
        hasAccessToken: !!accessToken 
      });
      return;
    }
    
    // Retry logic for workspace loading
    const maxRetries = WORKSPACE_MAX_RETRIES;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`Loading workspace for user: ${user.id} (attempt ${attempt}/${maxRetries})`);
        const { workspaces } = await api.getUserWorkspaces();
        
        if (workspaces && workspaces.length > 0) {
          const wsId = workspaces[0].id;
          if (wsId) {
            logger.debug('Workspace found:', wsId);
            setWorkspaceId(wsId);
            
            // Load all data from Supabase (source of truth)
            logger.debug('Loading data from server for workspace:', wsId);
            try {
              await Promise.all([
                loadTasksFromServer(wsId),
                syncProjectsFromServer(wsId),
                syncFoldersFromServer(wsId, true), // Merge with local to preserve pending folders
                syncSettingsFromServer(wsId),
              ]);
              logger.info('Workspace data loaded successfully');
            } catch (loadError) {
              logger.error('Error loading workspace data:', loadError);
              // Continue anyway - partial data is better than no data
            }
            setIsLoading(false); // Loading complete
            return;
          } else {
            logger.warn('Workspace ID is empty in response');
            lastError = new Error('Workspace ID is empty in response');
          }
        } else {
          logger.warn('No workspaces found for user, will create one');
          lastError = new Error('No workspaces found');
        }
        
        // If we get here, workspace wasn't found - try to create one
        if (attempt < maxRetries) {
          logger.info(`Attempting to create workspace (attempt ${attempt})`);
          await new Promise(resolve => setTimeout(resolve, WORKSPACE_RETRY_DELAY_BASE_MS * attempt)); // Exponential backoff
        }
        await createWorkspaceIfNeeded();
        // If creation succeeded, retry loading
        continue;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.error(`Failed to load workspace (attempt ${attempt}/${maxRetries}):`, lastError);
        
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, WORKSPACE_RETRY_DELAY_BASE_MS * attempt));
          continue;
        }
      }
    }
    
    // All retries failed
    logger.error('Failed to load workspace after all retries:', lastError);
    const errorMessage = lastError?.message || 'Unknown error';
    const detailedMessage = errorMessage.includes('Unknown error')
      ? 'Unable to connect to server. Please check your internet connection and try again.'
      : errorMessage;
    
    toast.error('Failed to load workspace. Please refresh the page.', {
      description: detailedMessage,
      duration: WORKSPACE_TOAST_DURATION_MS,
    });
    
    // Fallback to localStorage if server fails
    const savedTasks = getFromLocalStorage<Task[]>('tasks', []);
    const savedProjects = getFromLocalStorage<Project[]>('projects', []);
    const savedFolders = getFromLocalStorage<Folder[]>('folders', []);
    setTasks(savedTasks);
    if (savedProjects.length > 0) {
      setProjects(savedProjects);
    }
    if (savedFolders.length > 0) {
      setFolders(savedFolders);
    }
    setIsLoading(false); // Mark as loaded even with fallback
  }

  const createWorkspaceIfNeeded = useCallback(async () => {
    if (!user || !accessToken) {
      logger.warn('Cannot create workspace: user or accessToken missing');
      throw new Error('User or access token missing');
    }
    
    try {
      // Check again if workspace exists (might have been created by another request)
      logger.debug('Checking for existing workspace before creating...');
      const { workspaces } = await api.getUserWorkspaces();
      if (workspaces && workspaces.length > 0 && workspaces[0].id) {
        const wsId = workspaces[0].id;
        logger.info('Workspace already exists:', wsId);
        setWorkspaceId(wsId);
        try {
          await Promise.all([
            loadTasksFromServer(wsId),
            syncProjectsFromServer(wsId),
            syncFoldersFromServer(wsId, true), // Merge with local to preserve pending folders
            syncSettingsFromServer(wsId),
          ]);
        } catch (loadError) {
          logger.error('Error loading workspace data:', loadError);
          // Continue anyway - workspace is set, data can be loaded later
        }
        return;
      }

      // Create workspace via backend
      const workspaceName = `${user.name || WORKSPACE_NAME_FALLBACK}${WORKSPACE_NAME_SUFFIX}`;
      logger.info('Creating new workspace:', workspaceName);
      const workspaceId = await api.createWorkspace(workspaceName);
      
      if (!workspaceId) {
        throw new Error('Workspace creation returned no workspace ID');
      }
      
      logger.info('Workspace created successfully:', workspaceId);
      setWorkspaceId(workspaceId);
      
      // Load data for new workspace
      logger.debug('Loading data for new workspace:', workspaceId);
      try {
        await Promise.all([
          loadTasksFromServer(workspaceId),
          syncProjectsFromServer(workspaceId),
          syncFoldersFromServer(workspaceId, true), // Merge with local to preserve pending folders
          syncSettingsFromServer(workspaceId),
        ]);
        logger.info('Workspace setup complete:', workspaceId);
      } catch (loadError) {
        logger.error('Error loading data for new workspace:', loadError);
        // Continue anyway - workspace is created, data can be loaded later
      }
    } catch (error) {
      logger.error('Failed to create workspace:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const detailedMessage = errorMessage.includes('Unknown error') 
        ? 'Unable to connect to server. Please check your internet connection and try again.'
        : errorMessage;
      
      toast.error('Failed to create workspace', {
        description: detailedMessage,
        duration: WORKSPACE_TOAST_DURATION_MS,
      });
      throw error;
    }
  }, [user, accessToken]);

  // Deduplicate recurring task occurrences
  // CRITICAL: This function should ONLY remove true duplicates, not filter out recurring task series
  // Recurring tasks work by having ONE task that appears on multiple dates via isDateInRecurrence()
  // Removes duplicate tasks that have the same title, recurrence pattern, and scheduled date
  // Also handles pre-created occurrences (recurrence.type = 'none') by matching title and scheduledDate
  // Helper function to check if two task arrays are equal (by ID and updatedAt)
  // This prevents unnecessary re-renders when sync data hasn't actually changed
  function areTasksEqual(tasks1: Task[], tasks2: Task[]): boolean {
    if (tasks1.length !== tasks2.length) return false;
    
    // Create maps for quick lookup
    const map1 = new Map(tasks1.map(t => [t.id, t.updatedAt]));
    const map2 = new Map(tasks2.map(t => [t.id, t.updatedAt]));
    
    // Check if all IDs match and updatedAt timestamps match
    for (const [id, updatedAt] of map1) {
      if (!map2.has(id) || map2.get(id) !== updatedAt) {
        return false;
      }
    }
    
    return true;
  }

  function deduplicateRecurringTasks(tasks: Task[]): Task[] {
    // First, deduplicate by task ID (most important - same ID should only appear once)
    const tasksById = new Map<string, Task>();
    const duplicateIds: string[] = [];
    
    for (const task of tasks) {
      if (tasksById.has(task.id)) {
        // Same ID found - keep the most recently updated one
        const existing = tasksById.get(task.id)!;
        const existingDate = new Date(existing.updatedAt);
        const currentDate = new Date(task.updatedAt);
        
        if (currentDate > existingDate) {
          tasksById.set(task.id, task);
          duplicateIds.push(task.id);
        } else {
          duplicateIds.push(task.id);
        }
      } else {
        tasksById.set(task.id, task);
      }
    }
    
    // Now deduplicate by recurrence pattern (for tasks with same title/config but different IDs)
    // CRITICAL: Only deduplicate completed occurrences and true duplicates (same title + pattern + scheduledDate)
    // Active recurring tasks should ALL be kept - they need to appear on multiple dates
    const seenCompletedOccurrences = new Map<string, Task>(); // For completed occurrences (type = 'none' AND status = 'done')
    const seenTrueDuplicates = new Map<string, Task>(); // For true duplicates (same title + pattern + scheduledDate)
    
    // Use the deduplicated-by-ID tasks
    const uniqueByIdTasks = Array.from(tasksById.values());
    
    for (const task of uniqueByIdTasks) {
      if (!task.recurrence) {
        continue; // Skip tasks without recurrence config
      }
      
      // Handle completed occurrences (recurrence.type = 'none' AND status = 'done')
      // These are created when a recurring task is marked complete
      if (task.recurrence.type === 'none' && task.status === 'done' && task.scheduledDate) {
        // Create a key based on title and scheduledDate
        // This catches duplicates of completed occurrences
        const key = `${task.title}|${task.scheduledDate}`;
        
        if (seenCompletedOccurrences.has(key)) {
          const existing = seenCompletedOccurrences.get(key)!;
          const existingDate = new Date(existing.updatedAt);
          const currentDate = new Date(task.updatedAt);
          
          // Keep the most recently updated one
          if (currentDate > existingDate) {
            seenCompletedOccurrences.set(key, task);
          }
        } else {
          seenCompletedOccurrences.set(key, task);
        }
        continue;
      }
      
      // Handle active recurring tasks (recurrence.type !== 'none')
      // CRITICAL FIX: Only deduplicate if they have the same title, pattern, AND scheduledDate (true duplicates)
      // Recurring tasks should all be kept - they represent the same task appearing on multiple dates
      // The system uses isDateInRecurrence() to determine which dates each task appears on
      // We only deduplicate if the exact same task was created twice (same title + pattern + scheduledDate)
      if (task.recurrence.type !== 'none' && task.scheduledDate) {
        const daysOfWeekKey = task.recurrence.daysOfWeek 
          ? JSON.stringify([...task.recurrence.daysOfWeek].sort())
          : '';
        const dayOfMonthKey = task.recurrence.dayOfMonth || '';
        const endDateKey = task.recurrence.endDate || '';
        const scheduledDateKey = task.scheduledDate || '';
        // Include scheduledDate in key to only catch true duplicates (same task created twice)
        const key = `${task.title}|${task.recurrence.type}|${task.recurrence.interval}|${daysOfWeekKey}|${dayOfMonthKey}|${endDateKey}|${scheduledDateKey}`;
        
        // If we've seen this exact key before (same pattern AND same scheduledDate), it's a true duplicate
        if (seenTrueDuplicates.has(key)) {
          const existing = seenTrueDuplicates.get(key)!;
          const existingDate = new Date(existing.updatedAt);
          const currentDate = new Date(task.updatedAt);
          
          // Keep the most recently updated one
          if (currentDate > existingDate) {
            seenTrueDuplicates.set(key, task);
          }
        } else {
          seenTrueDuplicates.set(key, task);
        }
      }
      // If task has no scheduledDate, keep it (it will be handled elsewhere)
    }
    
    // Count duplicates removed (only count tasks that were actually filtered out)
    let duplicatesRemoved = 0;
    const filteredTasks = uniqueByIdTasks.filter(task => {
      if (!task.recurrence) {
        return true; // Keep tasks without recurrence
      }
      
      // Check completed occurrences (type = 'none' AND status = 'done')
      if (task.recurrence.type === 'none' && task.status === 'done' && task.scheduledDate) {
        const key = `${task.title}|${task.scheduledDate}`;
        const deduplicatedTask = seenCompletedOccurrences.get(key);
        // Keep only if this is the task we're keeping
        const shouldKeep = deduplicatedTask?.id === task.id;
        if (!shouldKeep) duplicatesRemoved++;
        return shouldKeep;
      }
      
      // Check active recurring tasks (type !== 'none')
      // CRITICAL FIX: Only filter out true duplicates (same title + pattern + scheduledDate)
      // All other active recurring tasks should be kept - they need to appear on multiple dates
      if (task.recurrence.type !== 'none') {
        // If task has no scheduledDate, keep it (it will be handled elsewhere)
        if (!task.scheduledDate) {
          return true;
        }
        
        const daysOfWeekKey = task.recurrence.daysOfWeek 
          ? JSON.stringify([...task.recurrence.daysOfWeek].sort())
          : '';
        const dayOfMonthKey = task.recurrence.dayOfMonth || '';
        const endDateKey = task.recurrence.endDate || '';
        const scheduledDateKey = task.scheduledDate || '';
        const key = `${task.title}|${task.recurrence.type}|${task.recurrence.interval}|${daysOfWeekKey}|${dayOfMonthKey}|${endDateKey}|${scheduledDateKey}`;
        const deduplicatedTask = seenTrueDuplicates.get(key);
        // Keep only if this is the task we're keeping (true duplicate check)
        // If not found in seenTrueDuplicates, keep it (it's a unique recurring task)
        // CRITICAL: Always keep active recurring tasks - they need to appear on multiple dates via isDateInRecurrence()
        const shouldKeep = deduplicatedTask ? deduplicatedTask.id === task.id : true;
        if (!shouldKeep) duplicatesRemoved++;
        return shouldKeep;
      }
      
      // Keep tasks that don't match either pattern (e.g., non-recurring tasks)
      return true;
    });
    
    if (duplicatesRemoved > 0 || duplicateIds.length > 0) {
      logger.warn(`Removed ${duplicatesRemoved} duplicate recurring task occurrence(s)${duplicateIds.length > 0 ? ` and ${duplicateIds.length} duplicate task ID(s)` : ''}`);
    }
    
    // Debug: Log recurring tasks to verify they're being kept
    if (import.meta.env.DEV) {
      const activeRecurringTasks = filteredTasks.filter(t => t.recurrence && t.recurrence.type !== 'none');
      if (activeRecurringTasks.length > 0) {
        logger.debug('Active recurring tasks after deduplication', {
          count: activeRecurringTasks.length,
          tasks: activeRecurringTasks.map(t => ({
            id: t.id,
            title: t.title,
            scheduledDate: t.scheduledDate,
            recurrenceType: t.recurrence.type,
            recurrenceInterval: t.recurrence.interval,
            daysOfWeek: t.recurrence.daysOfWeek
          }))
        });
      }
    }
    
    return filteredTasks;
  }

  // Load tasks from Supabase (source of truth)
  async function loadTasksFromServer(wsId: string): Promise<Task[]> {
    // Validate workspace ID
    if (!wsId || typeof wsId !== 'string' || wsId.trim() === '') {
      logger.warn('Invalid workspace ID for loadTasksFromServer:', wsId);
      const savedTasks = getFromLocalStorage<Task[]>('tasks', [], user?.id);
      if (savedTasks.length > 0) {
        const { tasks: migratedTasks } = migrateOrphanRecurringSeries(savedTasks);
        setTasks(migratedTasks);
        return migratedTasks;
      }
      return [];
    }

    try {
      logger.debug(`Loading tasks from server for workspace: ${wsId}`);
      const result = await api.getTasks(wsId);
      const { tasks: serverTasks, error } = result;
      
      // If there was an error, handle it appropriately
      if (error) {
        logger.error('Error loading tasks from server:', error);
        
        // Check if it's an authentication error
        if (error.message.includes('Authentication')) {
          toast.error('Authentication failed', {
            description: 'Please sign in again to continue.',
          });
          // Don't fall back to localStorage for auth errors
          const savedTasks = getFromLocalStorage<Task[]>('tasks', []);
          const { tasks: migratedTasks } = migrateOrphanRecurringSeries(savedTasks);
          setTasks(migratedTasks);
          return migratedTasks;
        }
        
        // For other errors, fall back to localStorage if available
        const savedTasks = getFromLocalStorage<Task[]>('tasks', []);
        if (savedTasks.length > 0) {
          logger.warn(`Using ${savedTasks.length} tasks from localStorage as fallback`);
          const { tasks: migratedTasks } = migrateOrphanRecurringSeries(savedTasks);
          setTasks(migratedTasks);
          saveToLocalStorage('tasks', migratedTasks, user?.id);
          toast.error('Failed to load tasks from server, using offline data', {
            description: error.message || 'Please check your internet connection',
          });
          return migratedTasks;
        } else {
          // No local data, show error but don't set empty array yet
          toast.error('Failed to load tasks', {
            description: error.message || 'Please check your internet connection',
          });
          setTasks([]);
          return [];
        }
      }
      
      // No error - process the tasks
      if (serverTasks && serverTasks.length > 0) {
        // Deduplicate recurring task occurrences before using server data
        const deduplicatedTasks = deduplicateRecurringTasks(serverTasks);
        
        // Migrate existing recurring series (occurrence-only) to new model: add base task per series
        const { tasks: migratedTasks, newBases } = migrateOrphanRecurringSeries(deduplicatedTasks);
        if (newBases.length > 0) {
          for (const base of newBases) {
            try {
              await api.saveTask(wsId, base);
              logger.debug('Migrated recurring series: saved base task', { baseId: base.id });
            } catch (err) {
              logger.error('Failed to save migrated base task', { baseId: base.id, err });
            }
          }
        }
        
        // Server has data - use it as source of truth (with any new base tasks from migration)
        if (deduplicatedTasks.length !== serverTasks.length) {
          logger.warn(`Found ${serverTasks.length - deduplicatedTasks.length} duplicate recurring tasks, removed them`, {
            originalCount: serverTasks.length,
            deduplicatedCount: deduplicatedTasks.length
          });
        }
        logger.info(`Loaded ${serverTasks.length} tasks from server${deduplicatedTasks.length !== serverTasks.length ? ` (deduplicated to ${deduplicatedTasks.length})` : ''}${newBases.length > 0 ? `, migrated ${newBases.length} recurring series` : ''}`);
        setTasks(migratedTasks);
        // Always update localStorage with migrated server data (overwrite any stale local data)
        saveToLocalStorage('tasks', migratedTasks, user?.id);
        setLastSync(new Date());
        
        // Store sync timestamp and ETag for next delta sync
        const syncTimestamp = new Date().toISOString();
        const syncKey = `last_sync_timestamp_tasks_${wsId}`;
        localStorage.setItem(syncKey, syncTimestamp);
        lastSyncTimestampsRef.current.tasks = syncTimestamp;
        
        // Clear any sync flags to ensure fresh sync on next load
        const syncFlagKey = `synced_local_data_${wsId}`;
        localStorage.removeItem(syncFlagKey);
        return migratedTasks;
      } else {
        // No server data - this is valid (workspace exists but has no tasks)
        logger.info('No tasks found on server (workspace may be empty)');
        const savedTasks = getFromLocalStorage<Task[]>('tasks', [], user?.id);
        if (savedTasks.length > 0) {
          logger.info(`Found ${savedTasks.length} tasks in localStorage, syncing to server`);
          setTasks(savedTasks);
          // Try to sync local tasks to server
          for (const task of savedTasks) {
            try {
              await api.saveTask(wsId, task);
              logger.debug(`Synced local task ${task.id} to server`);
            } catch (err) {
              logger.error(`Failed to sync task ${task.id}:`, err);
            }
          }
          // After syncing, reload from server to get authoritative data
          const refreshedResult = await api.getTasks(wsId);
          if (!refreshedResult.error && refreshedResult.tasks && refreshedResult.tasks.length > 0) {
            // Deduplicate recurring task occurrences and migrate orphan series
            const deduplicatedTasks = deduplicateRecurringTasks(refreshedResult.tasks);
            const { tasks: migratedTasks, newBases } = migrateOrphanRecurringSeries(deduplicatedTasks);
            if (newBases.length > 0) {
              for (const base of newBases) {
                try {
                  await api.saveTask(wsId, base);
                } catch (err) {
                  logger.error('Failed to save migrated base task after refresh', { baseId: base.id, err });
                }
              }
            }
            setTasks(migratedTasks);
            saveToLocalStorage('tasks', migratedTasks, user?.id);
            return migratedTasks;
          }
        }
        // No tasks in server or localStorage - this is valid for a new workspace
        logger.info('No tasks found in server or localStorage');
        setTasks([]);
        saveToLocalStorage('tasks', [], user?.id);
        return [];
      }
    } catch (error) {
      // Unexpected error (shouldn't happen with new error handling, but keep as safety net)
      logger.error('Unexpected error loading tasks from server:', error);
      const savedTasks = getFromLocalStorage<Task[]>('tasks', []);
      if (savedTasks.length > 0) {
        logger.warn(`Using ${savedTasks.length} tasks from localStorage as fallback`);
        const { tasks: migratedTasks } = migrateOrphanRecurringSeries(savedTasks);
        setTasks(migratedTasks);
        saveToLocalStorage('tasks', migratedTasks, user?.id);
        toast.error('Failed to load tasks from server, using offline data', {
          description: 'Please check your internet connection',
        });
        return migratedTasks;
      } else {
        setTasks([]);
        return [];
      }
    }
  }

  async function syncProjectsFromServer(wsId: string) {
    try {
      const serverProjects = await api.getProjects(wsId);
      if (serverProjects && serverProjects.length > 0) {
        setProjects(serverProjects);
        saveToLocalStorage('projects', serverProjects, user?.id);
      }
    } catch (error) {
      logger.error('Failed to sync projects:', error);
    }
  }

  async function syncFoldersFromServer(wsId: string, mergeWithLocal: boolean = false) {
    try {
      // Validate workspace ID before attempting sync
      if (!wsId || typeof wsId !== 'string' || wsId.trim() === '') {
        logger.warn('Invalid workspace ID for folder sync:', wsId);
        return;
      }

      // Ensure workspace exists before attempting to sync
      // This prevents 404 errors when workspace doesn't exist
      // Note: Server uses format workspace_${userId}_${timestamp}, so timestamps are valid
      if (accessToken && user) {
        try {
          // Try to get workspaces - this will auto-create if missing
          const { workspaces } = await api.getUserWorkspaces();
          if (workspaces && workspaces.length > 0 && workspaces[0].id) {
            const validWorkspaceId = workspaces[0].id;
            if (validWorkspaceId !== wsId) {
              logger.info('Workspace ID updated during folder sync:', { old: wsId, new: validWorkspaceId });
              wsId = validWorkspaceId;
              if (workspaceId !== validWorkspaceId) {
                setWorkspaceId(validWorkspaceId);
              }
            }
          } else {
            // No workspace found, try to create one
            await createWorkspaceIfNeeded();
            // After creation, get the workspaceId
            const { workspaces: newWorkspaces } = await api.getUserWorkspaces();
            if (newWorkspaces && newWorkspaces.length > 0 && newWorkspaces[0].id) {
              const validWorkspaceId = newWorkspaces[0].id;
              wsId = validWorkspaceId;
              if (workspaceId !== validWorkspaceId) {
                setWorkspaceId(validWorkspaceId);
              }
            } else {
              logger.warn('Cannot sync folders: workspace does not exist and could not be created');
              return;
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          // Only log as error if it's not a simple "not found" case
          if (!errorMessage.includes('not found') && !errorMessage.includes('404') && !errorMessage.includes('Workspace or endpoint not found')) {
            logger.error('Failed to ensure workspace exists during folder sync:', error);
          } else {
            logger.debug('Workspace not found during folder sync (expected for new workspaces):', errorMessage);
          }
          // Continue anyway - getFolders will handle 404 gracefully
        }
      }

      // Try to get folders - this will return empty array if workspace doesn't exist
      let serverFolders = await api.getFolders(wsId);
      
      // If we got an empty array, it could mean:
      // 1. Workspace exists but has no folders (OK - continue)
      // 2. Workspace doesn't exist (404) - we should ensure workspace exists first
      // We can't distinguish between these cases from getFolders alone,
      // but if we get a 404 when trying to save a folder, we'll handle it there

      // Normalize server folders to ensure sync flags are accurate
      if (Array.isArray(serverFolders)) {
        serverFolders = serverFolders.map(folder => ({
          ...folder,
          synced: true,
          pendingSync: false,
        }));
      }

      // Only sync offline folders if we have valid conditions
      // Note: serverFolders can be empty array if workspace exists but has no folders
      const canSyncOfflineFolders = mergeWithLocal && 
        accessToken && 
        wsId && 
        typeof wsId === 'string' && 
        !wsId.includes(':') && // Ensure workspace ID doesn't have invalid characters
        serverFolders && 
        Array.isArray(serverFolders) &&
        (typeof navigator === 'undefined' || navigator.onLine);

      // Attempt to sync any local-only folders (created offline) back to the server
      if (canSyncOfflineFolders) {
        const serverFolderIds = new Set(serverFolders.map(f => f.id));
        const localFolders = getFromLocalStorage<Folder[]>('folders', []).filter(Boolean);
        const offlineFolders = localFolders.filter(
          (folder) => folder?.id && !serverFolderIds.has(folder.id) && folder.pendingSync
        );

        if (offlineFolders.length > 0) {
          logger.info(`Found ${offlineFolders.length} offline folder(s); syncing to server...`);

          for (const offlineFolder of offlineFolders) {
            try {
              // Validate folder data before syncing
              if (!offlineFolder || !offlineFolder.id || !offlineFolder.name) {
                logger.warn('Skipping invalid offline folder:', offlineFolder);
                continue;
              }

              // Validate workspace ID format (should not contain extra characters)
              if (!wsId || typeof wsId !== 'string' || wsId.includes(':')) {
                logger.error('Invalid workspace ID format:', wsId);
                continue;
              }

              const { pendingSync: _pendingSync, synced: _synced, ...payload } = offlineFolder;
              
              // Ensure payload has required fields
              if (!payload.id || !payload.name) {
                logger.warn('Skipping folder with missing required fields:', payload);
                continue;
              }

              // Try to save folder - if workspace doesn't exist, ensureWorkspace will create it
              let savedFolder;
              try {
                savedFolder = await api.saveFolder(wsId, payload);
              } catch (saveError) {
                const errorMessage = saveError instanceof Error ? saveError.message : String(saveError);
                // If workspace doesn't exist, try to ensure it exists and retry
                if (errorMessage.includes('Workspace not found') || errorMessage.includes('Workspace or endpoint not found')) {
                  // Check if this is likely an endpoint issue (404) vs workspace issue
                  const isEndpoint404 = errorMessage.includes('endpoint not found') || errorMessage.includes('404');
                  
                  if (isEndpoint404) {
                    // Endpoint doesn't exist on server - skip silently (expected for some deployments)
                    logger.debug('Folders endpoint not available on server, skipping folder sync');
                    continue;
                  }
                  
                  logger.debug('Workspace not found when saving folder, ensuring workspace exists...');
                  try {
                    const validWorkspaceId = await ensureWorkspace();
                    if (validWorkspaceId && validWorkspaceId === wsId) {
                      // Workspace now exists, retry saving folder
                      savedFolder = await api.saveFolder(wsId, payload);
                    } else if (validWorkspaceId) {
                      // Workspace ID changed, update and retry
                      logger.info('Workspace ID changed during folder sync, updating:', { old: wsId, new: validWorkspaceId });
                      wsId = validWorkspaceId;
                      savedFolder = await api.saveFolder(wsId, payload);
                    } else {
                      // Couldn't create workspace, skip this folder
                      logger.warn('Cannot sync folder: workspace does not exist and could not be created');
                      continue;
                    }
                  } catch (ensureError) {
                    const ensureErrorMessage = ensureError instanceof Error ? ensureError.message : String(ensureError);
                    // Only log as error if it's not a simple "not found" case
                    if (!ensureErrorMessage.includes('not found') && !ensureErrorMessage.includes('404') && !ensureErrorMessage.includes('Workspace or endpoint not found')) {
                      logger.error('Failed to ensure workspace exists:', ensureError);
                    } else {
                      logger.debug('Workspace not found during ensure (expected for new workspaces):', ensureErrorMessage);
                    }
                    continue; // Skip this folder
                  }
                } else {
                  // Other error, re-throw to be caught by outer catch
                  throw saveError;
                }
              }
              
              if (!savedFolder || !savedFolder.id) {
                logger.warn('Invalid response from saveFolder:', savedFolder);
                continue;
              }

              const existingIndex = serverFolders.findIndex((f) => f.id === savedFolder.id);
              const normalizedSavedFolder = {
                ...savedFolder,
                synced: true,
                pendingSync: false,
              };
              if (existingIndex >= 0) {
                serverFolders[existingIndex] = normalizedSavedFolder;
              } else {
                serverFolders.push(normalizedSavedFolder);
              }
              serverFolderIds.add(normalizedSavedFolder.id);
              logger.debug('Synced offline folder to server:', normalizedSavedFolder.id);
            } catch (syncError) {
              // Log error but don't throw - continue with other folders
              const errorMessage = syncError instanceof Error ? syncError.message : String(syncError);
              logger.error('Failed to sync offline folder to server:', offlineFolder?.id, errorMessage);
              
              // If it's a JSON parsing error, the folder data might be corrupted
              if (errorMessage.includes('JSON') || errorMessage.includes('SyntaxError')) {
                logger.warn('Folder data may be corrupted, skipping sync:', offlineFolder?.id);
              }
            }
          }
        }
      }

      if (mergeWithLocal && (!accessToken || (typeof navigator !== 'undefined' && !navigator.onLine))) {
        logger.debug('Skipping offline folder sync (no access token or offline)');
      }

      // Ensure folders have a stable ordering (oldest first)
      if (Array.isArray(serverFolders) && serverFolders.length > 1) {
        serverFolders = [...serverFolders].sort((a, b) => {
          const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
          if (aTime === bTime) {
            return (a?.name || '').localeCompare(b?.name || '');
          }
          return aTime - bTime;
        });
      }

      if (mergeWithLocal) {
        // Merge server folders with current state folders (server takes precedence for conflicts)
        // Use current state instead of localStorage to avoid stale data
        setFolders(prevFolders => {
        const serverFolderIds = new Set(serverFolders.map(f => f.id));
          
          // Keep current folders that aren't on server (might be pending sync)
        const localOnlyFolders = prevFolders.filter(f => !serverFolderIds.has(f.id) && f.pendingSync);
          
          // Merge: server folders + local-only folders
          const mergedFolders = [...serverFolders, ...localOnlyFolders];
          
          // Only update if the merged result is actually different
          if (mergedFolders.length !== prevFolders.length) {
            saveToLocalStorage('folders', mergedFolders);
            return mergedFolders;
          }
          
          // Check if any folder data changed by comparing folder IDs and data
          const prevFolderMap = new Map(prevFolders.map(f => [f.id, f]));
          const hasChanges = mergedFolders.some((mergedFolder) => {
            const prevFolder = prevFolderMap.get(mergedFolder.id);
            if (!prevFolder) return true; // New folder
            // Check if data changed
            return prevFolder.name !== mergedFolder.name ||
              prevFolder.description !== mergedFolder.description ||
              prevFolder.color !== mergedFolder.color ||
              prevFolder.updatedAt !== mergedFolder.updatedAt;
          });
          
          if (hasChanges) {
            saveToLocalStorage('folders', mergedFolders);
            return mergedFolders;
          }
          
          // No changes, return same reference to prevent re-render
          return prevFolders;
        });
      } else {
        // Full sync: use server as source of truth
        if (serverFolders && serverFolders.length > 0) {
          setFolders(serverFolders);
          saveToLocalStorage('folders', serverFolders);
        } else {
          // Only clear if we're sure there are no folders (not just a temporary empty response)
          // Preserve current folders if server returns empty (might be a sync issue)
          setFolders(prevFolders => {
            if (prevFolders.length === 0) {
              saveToLocalStorage('folders', []);
              return [];
            }
            // Keep current folders if server is empty
            return prevFolders;
          });
        }
      }
    } catch (error) {
      logger.error('Failed to sync folders:', error);
      // Fallback to current state - don't clear folders on error
      setFolders(prevFolders => {
        if (prevFolders.length > 0) {
          // Ensure localStorage is in sync with state
          saveToLocalStorage('folders', prevFolders);
        }
        return prevFolders;
      });
    }
  }

  async function syncSettingsFromServer(wsId: string) {
    try {
      const settings = await api.getSettings(wsId);
      
      if (settings.availableTags) {
        // Merge server tags with default tags, ensuring defaults are always present
        const mergedTags = [...new Set([...DEFAULT_TAGS, ...settings.availableTags])];
        setAvailableTags(mergedTags);
        saveToLocalStorage('availableTags', mergedTags);
        // Update server if defaults were missing
        if (mergedTags.length !== settings.availableTags.length) {
          await api.saveSettings(wsId, { availableTags: mergedTags });
        }
      }
      
      if (settings.hoursSettings) {
        setHoursSettings(settings.hoursSettings);
        saveToLocalStorage('hoursSettings', settings.hoursSettings);
      }
      
      if (settings.rolloverSettings) {
        setRolloverSettings(settings.rolloverSettings);
        saveToLocalStorage('rolloverSettings', settings.rolloverSettings);
      }
      
      if (settings.viewConfig) {
        setViewConfig(settings.viewConfig);
      }
    } catch (error) {
      logger.error('Failed to sync settings:', error);
    }
  }

  const ERROR_TOAST_COOLDOWN = TIMING_CONSTANTS.taskSync.errorToastCooldown; // Don't show same error within cooldown period

  const syncWithServer = useCallback(
    async (wsId?: string, silent: boolean = false) => {
      const targetWorkspaceId = wsId || workspaceId;
      if (!targetWorkspaceId || !accessToken) return;

      // Check if browser is offline
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (!silent) {
          const now = Date.now();
          // Only log offline status once per minute to avoid spam
          if (now - lastNetworkErrorLogRef.current > TIMING_CONSTANTS.taskSync.networkErrorLogCooldown) {
            logger.debug('Sync skipped: browser is offline');
            lastNetworkErrorLogRef.current = now;
          }
        }
        return;
      }

      // Prevent concurrent sync operations
      if (syncLockRef.current) {
        logger.debug('Sync already in progress, skipping...');
        return;
      }

      syncLockRef.current = true;
      setIsSyncing(true);
      try {
        const lastModifiedSince = lastSyncTimestampsRef.current.tasks;

        // Load from Supabase (source of truth) with conditional headers
        const result = await api.getTasks(
          targetWorkspaceId,
          lastModifiedSince ? { ifModifiedSince: lastModifiedSince } : undefined
        );
        const {
          tasks: serverTasks = [],
          error,
          notModified,
          lastModified,
        } = result;

        // If there was an error, handle it
        if (error) {
          const isNetworkError = error.message.includes('Failed to fetch') || 
                                error.message.includes('Network') ||
                                error.message.includes('timeout') ||
                                error.name === 'TypeError';
          
          if (isNetworkError) {
            consecutiveNetworkErrorsRef.current += 1;
            
            // Suppress repeated network error warnings (only log once per 30 seconds)
            const now = Date.now();
            if (now - lastNetworkErrorLogRef.current > SYNC_INTERVAL_30_SECONDS) {
              logger.warn('Network error fetching tasks:', {
                workspaceId: targetWorkspaceId,
                error: error.message,
                consecutiveErrors: consecutiveNetworkErrorsRef.current,
              });
              lastNetworkErrorLogRef.current = now;
            }
            
            // Implement exponential backoff for network errors
            if (consecutiveNetworkErrorsRef.current >= WORKSPACE_NETWORK_ERROR_THRESHOLD) {
              const backoffSteps = consecutiveNetworkErrorsRef.current - WORKSPACE_NETWORK_ERROR_THRESHOLD + 1;
              const proposedInterval = Math.min(
                WORKSPACE_NETWORK_ERROR_BACKOFF_BASE_MS * Math.pow(2, backoffSteps - 1),
                WORKSPACE_NETWORK_ERROR_BACKOFF_MAX_MS
              );
              
              if (proposedInterval > syncIntervalRef.current) {
                logger.debug(
                  `Network errors detected (${consecutiveNetworkErrorsRef.current}), backing off to ${proposedInterval / 1000}s`
                );
                setSyncInterval(proposedInterval);
              }
            }
          } else {
            // Non-network errors: reset network error counter
            consecutiveNetworkErrorsRef.current = 0;
            
            // Log detailed error information for debugging
            logger.error('Sync error details:', {
              error: error.message,
              workspaceId: targetWorkspaceId,
              hasAccessToken: !!accessToken,
              errorType: error.name,
              stack: error.stack,
            });
          }
          
          // For authentication errors, don't update timestamp - force retry
          // For other errors, still update timestamp to prevent getting stuck
          if (!error.message.includes('Authentication')) {
            // Update timestamp even on error to prevent infinite retry loops
            const errorTimestamp = new Date().toISOString();
            lastSyncTimestampsRef.current.tasks = errorTimestamp;
            localStorage.setItem(`last_sync_timestamp_tasks_${targetWorkspaceId}`, errorTimestamp);
            setLastSync(new Date());
          }
          
          if (!silent && !isNetworkError) {
            // Only show non-network error toasts (network errors are handled silently with backoff)
            const errorMessage = error.message || 'Please check your internet connection';
            const now = Date.now();
            
            // Only show error toast if it's different from last one or enough time has passed
            const shouldShowError = !lastErrorToastRef.current || 
                                   lastErrorToastRef.current.message !== errorMessage ||
                                   (now - lastErrorToastRef.current.timestamp) > ERROR_TOAST_COOLDOWN;
            
            if (shouldShowError) {
              if (error.message.includes('Authentication')) {
                toast.error('Authentication failed', {
                  description: 'Please sign in again to continue.',
                });
                lastErrorToastRef.current = { message: 'Authentication failed', timestamp: now };
              } else {
                // Provide more helpful error messages
                let userFriendlyMessage = errorMessage;
                if (errorMessage.includes('timeout')) {
                  userFriendlyMessage = 'Server is taking too long to respond. Please try again.';
                } else if (errorMessage.includes('CORS')) {
                  userFriendlyMessage = 'Connection blocked. Please check your network settings.';
                }
                
                toast.error('Failed to sync with server', {
                  description: userFriendlyMessage,
                });
                lastErrorToastRef.current = { message: errorMessage, timestamp: now };
              }
            }
          }
          return;
        }
        
        // Clear error toast ref on successful sync
        lastErrorToastRef.current = null;
        
        // Reset network error counter on successful sync
        consecutiveNetworkErrorsRef.current = 0;

        const syncTimestamp = lastModified || new Date().toISOString();
        lastSyncTimestampsRef.current.tasks = syncTimestamp;
        localStorage.setItem(`last_sync_timestamp_tasks_${targetWorkspaceId}`, syncTimestamp);
        localStorage.setItem(`last_server_sync_${targetWorkspaceId}`, String(Date.now()));
        setLastSync(new Date());

        if (notModified) {
          logger.debug('No task changes detected since last sync');
          consecutiveNoChangeSyncsRef.current += 1;

          if (
            !isActiveRef.current &&
            consecutiveNoChangeSyncsRef.current >= WORKSPACE_SYNC_NO_CHANGE_THRESHOLD
          ) {
            const backoffSteps =
              consecutiveNoChangeSyncsRef.current - WORKSPACE_SYNC_NO_CHANGE_THRESHOLD + 1;
            const proposedInterval = Math.min(
              WORKSPACE_SYNC_INTERVAL_IDLE_MS * Math.pow(2, backoffSteps),
              WORKSPACE_SYNC_INTERVAL_MAX_MS
            );

            if (proposedInterval !== syncIntervalRef.current) {
              logger.debug(
                `Increasing idle sync interval to ${proposedInterval / 1000}s (no changes detected)`
              );
              setSyncInterval(proposedInterval);
            }
          }
          return;
        }

        // Data changed - reset backoff and align interval to activity state
        consecutiveNoChangeSyncsRef.current = 0;
        consecutiveNetworkErrorsRef.current = 0; // Reset network error counter on successful sync
        const desiredInterval = isActiveRef.current
          ? WORKSPACE_SYNC_INTERVAL_ACTIVE_MS
          : WORKSPACE_SYNC_INTERVAL_IDLE_MS;
        if (syncIntervalRef.current !== desiredInterval) {
          setSyncInterval(desiredInterval);
        }

        // Server is source of truth - only update state if data actually changed
        // This prevents unnecessary re-renders that feel like refreshes
        const currentTasks = tasksRef.current; // Get current tasks from ref (avoids dependency issues)
        const tasksChanged = !areTasksEqual(currentTasks, serverTasks);

        // Safeguard: do not overwrite local tasks with empty server response when we have local tasks.
        // On some browsers (e.g. Edge) GET can return 404/empty due to caching or request handling;
        // overwriting would make tasks "disappear" after marking complete when sync runs.
        if (serverTasks.length === 0 && currentTasks.length > 0) {
          logger.warn('Server returned no tasks but local state has tasks; preserving local state to avoid tasks disappearing');
          return;
        }

        // Option D: merge strategy for today's tasks so local scheduledDate for today is not overwritten by server unless server is strictly newer
        const todayString = getDateString(new Date());
        const currentById = new Map(currentTasks.map((t) => [t.id, t]));
        const mergePreservingTodayTimes = (serverList: Task[]): Task[] =>
          serverList.map((serverTask) => {
            const localTask = currentById.get(serverTask.id);
            if (!localTask) return serverTask;
            const localScheduledForToday =
              localTask.scheduledDate &&
              getDateString(new Date(localTask.scheduledDate)) === todayString;
            if (!localScheduledForToday) return serverTask;
            const serverNewer =
              serverTask.updatedAt &&
              localTask.updatedAt &&
              new Date(serverTask.updatedAt).getTime() > new Date(localTask.updatedAt).getTime();
            if (serverNewer) return serverTask;
            return { ...serverTask, scheduledDate: localTask.scheduledDate };
          });

        let tasksToSet = tasksChanged ? mergePreservingTodayTimes(serverTasks) : serverTasks;
        // Migrate existing recurring series (occurrence-only) to new model
        const { tasks: migratedTasks, newBases } = migrateOrphanRecurringSeries(tasksToSet);
        if (newBases.length > 0) {
          tasksToSet = migratedTasks;
          for (const base of newBases) {
            try {
              await api.saveTask(targetWorkspaceId, base);
              logger.debug('Synced migrated base task', { baseId: base.id });
            } catch (err) {
              logger.error('Failed to save migrated base task during sync', { baseId: base.id, err });
            }
          }
        }

        if (tasksChanged || newBases.length > 0) {
          logger.info(`Synced ${serverTasks.length} tasks from server${newBases.length > 0 ? `, migrated ${newBases.length} recurring series` : ''} (data changed)`);
          // Use startTransition to make state update non-blocking (runs in background)
          startTransition(() => {
            setTasks(tasksToSet);
            saveToLocalStorage('tasks', tasksToSet, user?.id);
          });
        } else {
          logger.debug(`Sync completed but no task changes detected (skipping state update)`);
          // Still update localStorage and sync timestamp even if state doesn't change
          saveToLocalStorage('tasks', tasksToSet, user?.id);
        }

        // Clear sync flags to ensure fresh sync
        const syncKey = `synced_local_data_${targetWorkspaceId}`;
        localStorage.removeItem(syncKey);

        // Only show success notification if tasks actually changed (not on every routine sync)
        // This reduces notification noise - users only see notifications when something meaningful happened
        if (!silent && tasksChanged && serverTasks.length > 0) {
          toast.success('Synced with server', {
            description: `Loaded ${serverTasks.length} task${serverTasks.length !== 1 ? 's' : ''}`,
          });
        }
      } catch (error) {
        logger.error('Unexpected sync error:', error);
        // On error, keep current state (might be offline)
        if (!silent) {
          const errorMessage = 'Please check your internet connection';
          const now = Date.now();
          
          // Only show error toast if it's different from last one or enough time has passed
          const shouldShowError = !lastErrorToastRef.current || 
                                 lastErrorToastRef.current.message !== errorMessage ||
                                 (now - lastErrorToastRef.current.timestamp) > ERROR_TOAST_COOLDOWN;
          
          if (shouldShowError) {
            toast.error('Failed to sync with server', {
              description: errorMessage,
            });
            lastErrorToastRef.current = { message: errorMessage, timestamp: now };
          }
        }
      } finally {
        setIsSyncing(false);
        syncLockRef.current = false;
      }
    },
    [workspaceId, accessToken, user?.id, api, setTasks, setIsSyncing, setLastSync, setSyncInterval, isActiveRef, tasksRef, areTasksEqual, saveToLocalStorage, logger, toast, startTransition]
  );
  
  // Update ref when callback changes to avoid dependency issues
  React.useEffect(() => {
    syncWithServerRef.current = syncWithServer;
  }, [syncWithServer]);

  // Activity tracking for adaptive polling
  useEffect(() => {
    if (!autoSyncEnabled || !workspaceId || !accessToken) return;

    // Throttle activity handler to reduce performance impact
    let activityThrottleTimeout: NodeJS.Timeout | null = null;
    const THROTTLE_MS = TIMING_CONSTANTS.delays.throttle; // Only process activity once per second

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      
      // Update demo user activity on user interactions
      if (user?.isDemo) {
        updateActivity();
      }
      
      // Throttle state updates to prevent excessive re-renders
      if (activityThrottleTimeout) return;
      
      activityThrottleTimeout = setTimeout(() => {
        activityThrottleTimeout = null;
        if (!isActiveRef.current) {
          isActiveRef.current = true;
          // Only update state if interval actually needs to change (prevents unnecessary re-renders)
          if (syncIntervalRef.current !== WORKSPACE_SYNC_INTERVAL_ACTIVE_MS) {
            setSyncInterval(WORKSPACE_SYNC_INTERVAL_ACTIVE_MS);
            logger.debug('User activity detected, switching to active sync interval (30 sec)');
          }
        }
      }, THROTTLE_MS);
    };

    // Track user activity - improved for mobile devices
    // Use fewer, less frequent events to reduce performance impact
    const events = [
      'mousedown', 'keypress', 'scroll', 
      'touchstart', 'click',
      'pointerdown', 'pointerup' // Removed high-frequency events (mousemove, touchmove, pointermove)
    ];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Check for inactivity periodically
    const activityCheckInterval = setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      if (timeSinceActivity > WORKSPACE_ACTIVITY_TIMEOUT_MS && isActiveRef.current) {
        isActiveRef.current = false;
        // Only update state if interval actually needs to change (prevents unnecessary re-renders)
        if (syncIntervalRef.current !== WORKSPACE_SYNC_INTERVAL_IDLE_MS) {
          setSyncInterval(WORKSPACE_SYNC_INTERVAL_IDLE_MS);
          logger.debug('User inactive, switching to idle sync interval (2 min)');
        }
      }
    }, TIMING_CONSTANTS.intervals.activityCheck); // Check every minute

    // Listen for online/offline events to reset network error counter
    const handleOnline = () => {
      logger.debug('Browser came back online, resetting network error counter');
      consecutiveNetworkErrorsRef.current = 0;
      // Reset sync interval to normal when back online
      const desiredInterval = isActiveRef.current
        ? WORKSPACE_SYNC_INTERVAL_ACTIVE_MS
        : WORKSPACE_SYNC_INTERVAL_IDLE_MS;
      if (syncIntervalRef.current !== desiredInterval) {
        setSyncInterval(desiredInterval);
      }
    };
    
    const handleOffline = () => {
      logger.debug('Browser went offline');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      clearInterval(activityCheckInterval);
      if (activityThrottleTimeout) {
        clearTimeout(activityThrottleTimeout);
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [autoSyncEnabled, workspaceId, accessToken, user?.isDemo, updateActivity]);

  // Auto-sync: Poll server for changes at adaptive intervals
  // Uses requestIdleCallback when available to run syncs in background without blocking UI
  useEffect(() => {
    if (!autoSyncEnabled || !workspaceId || !accessToken) return;

    // Helper to run sync in background (non-blocking)
    const runBackgroundSync = async () => {
      try {
        // Only sync tasks on regular interval (most frequently changing)
        if (syncWithServerRef.current) {
        await syncWithServerRef.current(workspaceId, true);
      } // Silent sync
        
        // Sync folders more frequently (every interval) for better cross-device sync
        // Projects and settings change less frequently, so sync them every N intervals based on activity
        const syncCount = Math.floor(Date.now() / syncInterval);
        const syncMultiplier = isActiveRef.current 
          ? WORKSPACE_SYNC_ACTIVE_MULTIPLIER 
          : WORKSPACE_SYNC_IDLE_MULTIPLIER;
        const shouldSyncOtherResources = syncCount % syncMultiplier === 0;
        
        // Always sync folders (they change more frequently than projects/settings)
        await syncFoldersFromServer(workspaceId, true);
        
        // Sync projects and settings less frequently
        if (shouldSyncOtherResources) {
          await Promise.all([
            syncProjectsFromServer(workspaceId),
            syncSettingsFromServer(workspaceId),
          ]);
        }
      } catch (error) {
        logger.error('Auto-sync error:', error);
      }
    };

    // Use requestIdleCallback when available to run syncs when browser is idle
    // Falls back to setTimeout if requestIdleCallback is not available
    // CRITICAL: Use syncIntervalRef.current instead of syncInterval to prevent effect re-runs
    // This prevents the interval from being recreated every time syncInterval state changes
    const scheduleSync = () => {
      const currentInterval = syncIntervalRef.current;
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(runBackgroundSync, { timeout: currentInterval });
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(runBackgroundSync, 0);
      }
    };

    // Set up interval to schedule syncs (non-blocking)
    // Use syncIntervalRef.current to get the latest interval value without causing re-renders
    // Store timer in a ref so we can update it when interval changes
    const syncTimerRef = { current: null as NodeJS.Timeout | null };
    const syncTimerIntervalRef = { current: 0 }; // Store the interval value separately
    
    const startSyncTimer = () => {
      // Clear existing timer if any
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }
      // Start new timer with current interval
      const currentInterval = syncIntervalRef.current;
      syncTimerRef.current = setInterval(scheduleSync, currentInterval);
      // Store interval value separately (can't attach to timer ID since it's a number)
      syncTimerIntervalRef.current = currentInterval;
    };
    
    // Start initial timer
    startSyncTimer();
    
    // Update timer when interval changes (without recreating the entire effect)
    // Check periodically if interval has changed
    const intervalUpdateTimer = setInterval(() => {
      const latestInterval = syncIntervalRef.current;
      // Restart timer if interval changed
      if (syncTimerRef.current && latestInterval !== syncTimerIntervalRef.current) {
        startSyncTimer();
      }
    }, TIMING_CONSTANTS.taskSync.intervalUpdateCheck);

    return () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }
      clearInterval(intervalUpdateTimer);
    };
  }, [autoSyncEnabled, workspaceId, accessToken]); // Removed syncWithServer and syncInterval from dependencies to prevent refresh loops

  // Debounce helper to prevent multiple rapid syncs
  const lastEventSyncRef = useRef<number>(0);
  const DEBOUNCE_INTERVAL = TIMING_CONSTANTS.taskSync.debounceInterval; // Only sync once per interval from events - reduced for better cross-device sync
  const lastFullSyncRef = useRef<number>(0);
  const FULL_SYNC_INTERVAL = SYNC_INTERVAL_30_SECONDS; // Full sync (all resources) every 30 seconds - reduced for better cross-device sync

  const debouncedSync = useCallback(async (fullSync: boolean = false) => {
    if (!workspaceId || !accessToken) return;
    
    const now = Date.now();
    
    // Always allow tasks sync (most important)
    const shouldSyncTasks = now - lastEventSyncRef.current >= DEBOUNCE_INTERVAL;
    
    // Only do full sync if explicitly requested or enough time has passed
    const shouldFullSync = fullSync || (now - lastFullSyncRef.current >= FULL_SYNC_INTERVAL);
    
    if (!shouldSyncTasks && !shouldFullSync) {
      return; // Skip if synced recently
    }
    
    if (shouldSyncTasks) {
      lastEventSyncRef.current = now;
    }
    if (shouldFullSync) {
      lastFullSyncRef.current = now;
    }
    
    try {
      // Always sync tasks (most frequently changing)
      if (syncWithServerRef.current) {
        await syncWithServerRef.current(workspaceId, true);
      }
      
      // Only sync other resources on full sync
      if (shouldFullSync) {
        await Promise.all([
          syncProjectsFromServer(workspaceId),
          syncFoldersFromServer(workspaceId, true),
          syncSettingsFromServer(workspaceId),
        ]);
      }
    } catch (error) {
      logger.error('Debounced sync error:', error);
    }
  }, [workspaceId, accessToken]); // Removed syncWithServer from dependencies

  // REMOVED: Visibility change handler that triggers syncs on tab switch
  // This was causing app refreshes when users switched tabs/apps
  // Task syncs now only happen:
  // 1. On manual sync button click
  // 2. On network reconnect (online event)
  // 3. Via periodic background sync (if auto-sync is enabled)
  // This prevents disruptive refreshes during user sessions

  // Sync when network comes back online - debounced with full sync
  useEffect(() => {
    if (!autoSyncEnabled || !workspaceId || !accessToken) return;

    const handleOnline = () => {
      // Do full sync when network comes back
      debouncedSync(true);
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [autoSyncEnabled, workspaceId, accessToken, debouncedSync]);

  // REMOVED: Focus handler that triggers syncs on window focus
  // This was causing app refreshes when users switched back to the window
  // Task syncs now only happen:
  // 1. On manual sync button click
  // 2. On network reconnect (online event)
  // 3. Via periodic background sync (if auto-sync is enabled)
  // This prevents disruptive refreshes during user sessions

  // Helper function to calculate the next occurrence date from a given date
  // MUST be defined before addTask and updateTask
  const calculateNextOccurrenceDate = useCallback((recurrence: RecurrenceConfig, fromDate: Date): Date | null => {
    if (!recurrence || recurrence.type === 'none') return null;

    const nextDate = new Date(fromDate);
    nextDate.setHours(0, 0, 0, 0);

    switch (recurrence.type) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + recurrence.interval);
        break;
      
      case 'weekly':
        if (recurrence.daysOfWeek && Array.isArray(recurrence.daysOfWeek) && recurrence.daysOfWeek.length > 0) {
          const currentDay = nextDate.getDay();
          const sortedDays = [...recurrence.daysOfWeek].sort((a, b) => a - b);
          
          // Find the next day in the current week (after today)
          // If today is one of the days, we want the next occurrence, not today again
          const nextDayInWeek = sortedDays.find(day => day > currentDay);
          if (nextDayInWeek !== undefined) {
            // Found a day later in the current week
            nextDate.setDate(nextDate.getDate() + (nextDayInWeek - currentDay));
          } else {
            // No more days in current week, go to first day of next interval week
            const daysUntilNextWeek = TIMING_CONSTANTS.calendar.daysPerWeek - currentDay;
            const daysToFirstDay = sortedDays[0];
            // Add: days to end of week + days to first day + (interval - 1) full weeks
            const daysToAdd = daysUntilNextWeek + daysToFirstDay + (TIMING_CONSTANTS.calendar.daysPerWeek * (recurrence.interval - 1));
            nextDate.setDate(nextDate.getDate() + daysToAdd);
          }
        } else {
          // Simple weekly: same day of week every interval weeks
          nextDate.setDate(nextDate.getDate() + (TIMING_CONSTANTS.calendar.daysPerWeek * recurrence.interval));
        }
        break;
      
      case 'monthly':
        if (recurrence.dayOfMonth) {
          // Move to the next interval month
          nextDate.setMonth(nextDate.getMonth() + recurrence.interval);
          // Handle month overflow (e.g., Jan 31 + 1 month = Feb 28/29)
          const maxDayInMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
          const dayOfMonth = Math.min(recurrence.dayOfMonth, maxDayInMonth);
          nextDate.setDate(dayOfMonth);
          // Ensure we're not going backwards (if the day of month is in the past, we already moved forward)
          const fromDateOnly = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
          if (nextDate <= fromDateOnly) {
            // If somehow we ended up at or before the fromDate, move forward one more month
            nextDate.setMonth(nextDate.getMonth() + recurrence.interval);
            const nextMaxDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
            nextDate.setDate(Math.min(recurrence.dayOfMonth, nextMaxDay));
          }
        } else {
          // Same day of month, next interval
          nextDate.setMonth(nextDate.getMonth() + recurrence.interval);
          const maxDayInMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
          const originalDay = fromDate.getDate();
          // Handle month overflow (e.g., Jan 31 + 1 month = Feb 28/29)
          if (originalDay > maxDayInMonth) {
            nextDate.setDate(maxDayInMonth);
          } else {
            nextDate.setDate(originalDay);
          }
          // Ensure we're not going backwards
          const fromDateOnly = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
          if (nextDate <= fromDateOnly) {
            // Move forward one more month
            nextDate.setMonth(nextDate.getMonth() + recurrence.interval);
            const nextMaxDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
            if (originalDay > nextMaxDay) {
              nextDate.setDate(nextMaxDay);
            } else {
              nextDate.setDate(originalDay);
            }
          }
        }
        break;
      
      default:
        return null;
    }

    return nextDate;
  }, []);

  const ensureWorkspace = useCallback(async (): Promise<string | null> => {
    // If no user/auth, can't create workspace
    if (!user || !accessToken) {
      logger.warn('Cannot ensure workspace: user or accessToken missing');
      return null;
    }
    
    try {
      // First, try to get existing workspace (getUserWorkspaces auto-creates if missing)
      logger.debug('Ensuring workspace exists...');
      const { workspaces } = await api.getUserWorkspaces();
      
      if (workspaces && workspaces.length > 0 && workspaces[0].id) {
        const wsId = workspaces[0].id;
        logger.info('Workspace found/created:', wsId);
        
        // Update state if it's different
        if (workspaceId !== wsId) {
          setWorkspaceId(wsId);
        }
        return wsId;
      }
      
      // If getUserWorkspaces didn't return a workspace, explicitly create one
      logger.warn('No workspace returned from getUserWorkspaces, creating explicitly...');
      await createWorkspaceIfNeeded();
      
      // After creation, fetch the workspace ID
      const { workspaces: newWorkspaces } = await api.getUserWorkspaces();
      if (newWorkspaces && newWorkspaces.length > 0 && newWorkspaces[0].id) {
        const wsId = newWorkspaces[0].id;
        logger.info('Workspace created successfully:', wsId);
        setWorkspaceId(wsId);
        return wsId;
      }
      
      // If still no workspace, something went wrong
      logger.error('Failed to create workspace - no workspace ID returned');
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Try to create workspace explicitly if getUserWorkspaces failed
      if (errorMessage.includes('not found') || errorMessage.includes('404') || errorMessage.includes('Workspace or endpoint not found')) {
        logger.debug('Workspace not found, attempting explicit creation...');
        try {
          await createWorkspaceIfNeeded();
          const { workspaces: retryWorkspaces } = await api.getUserWorkspaces();
          if (retryWorkspaces && retryWorkspaces.length > 0 && retryWorkspaces[0].id) {
            const wsId = retryWorkspaces[0].id;
            logger.info('Workspace created after retry:', wsId);
            setWorkspaceId(wsId);
            return wsId;
          }
        } catch (createError) {
          logger.error('Failed to create workspace on retry:', createError);
        }
      }
      
      // For other errors, log and show toast
      logger.error('Failed to ensure workspace:', error);
      const detailedMessage = errorMessage.includes('Unknown error') 
        ? 'Unable to access workspace. Please check your connection and try again.'
        : errorMessage;
      
      toast.error('Failed to access workspace', {
        description: detailedMessage,
        duration: TOAST_DURATION_LONG_MS,
      });
      return null;
    }
  }, [workspaceId, user, accessToken, createWorkspaceIfNeeded]);

  const addTask = useCallback(async (taskData: Partial<Task>) => {
    updateActivity(); // Track demo user activity
    
    // Permission check removed to break circular dependency with TeamContext
    // Permission checks should be handled at component level using useTeam() hook
    
    // Validate workspace ID
    let currentWorkspaceId = workspaceId;
    if (!currentWorkspaceId) {
      // Ensure workspace exists before creating task
      const validWorkspaceId = await ensureWorkspace();
      if (!validWorkspaceId) {
        toast.error('Workspace not available. Please refresh the page.');
        return;
      }
      currentWorkspaceId = validWorkspaceId;
    }
    
    const taskId = taskData.id && typeof taskData.id === 'string' && taskData.id.trim().length > 0
      ? taskData.id.trim()
      : generateId();
    const newTask: Task = {
      id: taskId,
      title: taskData.title || 'Untitled Task',
      description: taskData.description || '',
      status: taskData.status || 'todo',
      priority: taskData.priority || 'medium',
      dueDate: taskData.dueDate || null,
      scheduledDate: taskData.scheduledDate || null,
      projectId: taskData.projectId || DEFAULT_PROJECT_ID,
      tags: taskData.tags || [],
      assignedTo: taskData.assignedTo || [],
      createdBy: user?.id || 'local',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      estimatedTime: taskData.estimatedTime || null,
      actualTime: null,
      dependencies: taskData.dependencies || [],
      subtasks: taskData.subtasks || [],
      recurrence: taskData.recurrence || RECURRENCE_NONE_CONFIG,
      notes: taskData.notes || '',
    };

    // Save to Supabase (source of truth); optimistic add first for instant UI
    if (currentWorkspaceId && accessToken) {
      const validWorkspaceId = currentWorkspaceId;
      try {
        // Optimistic add so the new task appears immediately
        setTasks(prev => {
          const updated = [...prev, newTask];
          saveToLocalStorage('tasks', updated);
          return updated;
        });

        await api.saveTask(validWorkspaceId, newTask);

        debouncedSync(false);
        toast.success('Task created', { playSound: true });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to save task to server:', error);

        // Revert optimistic add by resyncing from server
        await loadTasksFromServer(validWorkspaceId).catch(() => {});

        // If workspace not found, try to ensure it exists and retry
        if (errorMessage.includes('Workspace not found') || errorMessage.includes('Workspace or endpoint not found')) {
          try {
            logger.debug('Workspace not found when saving task, ensuring workspace exists...');
            await createWorkspaceIfNeeded();
            await new Promise(resolve => setTimeout(resolve, TIMING_CONSTANTS.delays.taskContext));
            const retryWorkspaceId = await ensureWorkspace();
            if (retryWorkspaceId) {
              logger.info('Workspace created, retrying task save with workspace ID:', retryWorkspaceId);
              setTasks(prev => {
                const updated = [...prev, newTask];
                saveToLocalStorage('tasks', updated);
                return updated;
              });
              await api.saveTask(retryWorkspaceId, newTask);
              debouncedSync(false);
              toast.success('Task created', { playSound: true });
              return;
            } else {
              logger.error('Workspace creation failed - no workspace ID returned');
            }
          } catch (retryError) {
            logger.error('Failed to ensure workspace on retry:', retryError);
          }
        }

        // Fallback: keep task in local state and cache (already reverted above; re-add for offline)
        setTasks(prev => {
          const updated = [...prev, newTask];
          saveToLocalStorage('tasks', updated);
          return updated;
        });
        toast.error('Task saved offline, will sync when online');
      }
    } else {
      // No workspace/auth - save locally only
      setTasks(prev => {
        const updated = [...prev, newTask];
        saveToLocalStorage('tasks', updated);
        return updated;
      });
      toast.success('Task created (offline)', { playSound: true });
    }
  }, [user, workspaceId, accessToken, updateActivity, ensureWorkspace, createWorkspaceIfNeeded, loadTasksFromServer, debouncedSync]);

  const addTaskSeries = useCallback(async (seriesTasks: Task[]) => {
    if (!seriesTasks.length) return;
    updateActivity();
    let currentWorkspaceId = workspaceId;
    if (!currentWorkspaceId) {
      const validWorkspaceId = await ensureWorkspace();
      if (!validWorkspaceId) {
        toast.error('Workspace not available. Please refresh the page.');
        return;
      }
      currentWorkspaceId = validWorkspaceId;
    }
    if (currentWorkspaceId && accessToken) {
      try {
        setTasks((prev) => {
          const updated = [...prev, ...seriesTasks];
          saveToLocalStorage('tasks', updated);
          return updated;
        });
        for (const t of seriesTasks) {
          await api.saveTask(currentWorkspaceId!, t);
        }
        debouncedSync(false);
        toast.success(seriesTasks.length === 1 ? 'Task created' : `Series created: ${seriesTasks.length} tasks`);
      } catch (error) {
        logger.error('Failed to save task series', error);
        await loadTasksFromServer(currentWorkspaceId!).catch(() => {});
        toast.error('Failed to create series. Please try again.');
      }
    } else {
      setTasks((prev) => {
        const updated = [...prev, ...seriesTasks];
        saveToLocalStorage('tasks', updated);
        return updated;
      });
      toast.success(seriesTasks.length === 1 ? 'Task created (offline)' : `Series created: ${seriesTasks.length} tasks (offline)`, { playSound: true });
    }
  }, [user, workspaceId, accessToken, updateActivity, ensureWorkspace, loadTasksFromServer, debouncedSync]);

  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    updateActivity(); // Track demo user activity

    // Debug: trace who updates scheduledDate (e.g. DragDropContext, TaskDialog, sync overwrite)
    if (updates.scheduledDate !== undefined && typeof console !== 'undefined' && console.debug) {
      console.debug('[TaskContext.updateTask] scheduledDate update', { taskId, scheduledDate: updates.scheduledDate }, new Error().stack);
    }

    // Recurring tasks use occurrence IDs (taskId__YYYY-MM-DD) for Pomodoro; occurrence subtask IDs are baseId + SUFFIX + YYYY-MM-DD. Series occurrence ids are baseId__YYYY-MM-DD.
    const isOccurrenceSubtaskId = taskId.includes(RECURRENCE_OCCURRENCE_ID_SUFFIX_SUBTASKS);
    const seriesBase = getSeriesBaseId(taskId);
    const baseTaskId = isOccurrenceSubtaskId
      ? taskId.split(RECURRENCE_OCCURRENCE_ID_SUFFIX_SUBTASKS)[0]
      : seriesBase ?? (taskId.includes('__') ? taskId.split('__')[0] : taskId);

    try {
    // Permission check removed to break circular dependency with TeamContext
    // Permission checks should be handled at component level using useTeam() hook

    // Validate workspace ID
    let currentWorkspaceId = workspaceId;
    if (!currentWorkspaceId) {
      // Ensure workspace exists before updating task
      const validWorkspaceId = await ensureWorkspace();
      if (!validWorkspaceId) {
        toast.error('Workspace not available. Please refresh the page.');
        return;
      }
      currentWorkspaceId = validWorkspaceId;
    }

    // Find the task to update: for occurrence subtask or series occurrence use taskId; otherwise use base task ID
    const lookupId = isOccurrenceSubtaskId || seriesBase ? taskId : baseTaskId;
    let currentTask = tasks.find(t => t.id === lookupId);

    // Occurrence subtask task may not exist yet (first time saving subtasks for this occurrence) – upsert
    if (isOccurrenceSubtaskId && !currentTask) {
      const baseTask = tasks.find(t => t.id === baseTaskId);
      if (!baseTask) {
        toast.error('Task not found');
        return;
      }
      const occurrenceDateStr = taskId.split(RECURRENCE_OCCURRENCE_ID_SUFFIX_SUBTASKS)[1];
      const occurrenceDate = occurrenceDateStr ? new Date(occurrenceDateStr + DATE_ONLY_PARSE_SUFFIX) : new Date();
      const baseScheduled = baseTask.scheduledDate ? new Date(baseTask.scheduledDate) : occurrenceDate;
      occurrenceDate.setHours(baseScheduled.getHours(), baseScheduled.getMinutes(), baseScheduled.getSeconds(), baseScheduled.getMilliseconds());
      const occurrenceSubtaskTask: Task = {
        ...baseTask,
        id: taskId,
        subtasks: updates.subtasks ?? baseTask.subtasks,
        actualTime: updates.actualTime ?? baseTask.actualTime ?? null,
        recurrence: RECURRENCE_NONE_CONFIG,
        updatedAt: new Date().toISOString(),
        scheduledDate: occurrenceDate.toISOString(),
      };
      if (currentWorkspaceId && accessToken) {
        setTasks((prev) => (prev.some((t) => t.id === taskId) ? prev : [...prev, occurrenceSubtaskTask]));
        await api.saveTask(currentWorkspaceId, occurrenceSubtaskTask);
        debouncedSync(false);
      } else {
        setTasks((prev) => {
          const next = prev.some((t) => t.id === taskId) ? prev : [...prev, occurrenceSubtaskTask];
          saveToLocalStorage('tasks', next, user?.id);
          return next;
        });
      }
      return;
    }

    if (!currentTask) {
      toast.error('Task not found');
      return;
    }
    
    // Preserve recurrence property when updating task - don't let updates overwrite it unless explicitly changed
    // This ensures recurring tasks maintain their recurrence pattern when marked complete
    
    // Check if task is being marked as complete (status changing to 'done')
    const isBeingMarkedComplete = (updates.status === 'done' && currentTask.status !== 'done') ||
                                  (updates.status === undefined && updates.completedAt !== undefined && currentTask.status !== 'done');
    const isBeingUnmarkedComplete = (updates.status !== 'done' && currentTask.status === 'done') ||
                                    (updates.status === undefined && updates.completedAt === null && currentTask.status === 'done');
    
    // Build the updated task object immutably - avoid direct mutations to prevent readonly property errors
    const baseUpdates: Partial<Task> = {
      ...updates,
      updatedAt: new Date().toISOString(),
      // Explicitly preserve recurrence if it's not being changed
      recurrence: updates.recurrence !== undefined ? updates.recurrence : currentTask.recurrence,
    };
    
    // Automatically handle completedAt when status changes (unless explicitly provided)
    const statusUpdates: Partial<Task> = 
      updates.status !== undefined && updates.completedAt === undefined
        ? isBeingMarkedComplete
          ? { completedAt: new Date().toISOString() }
          : isBeingUnmarkedComplete
          ? { completedAt: null }
          : {}
        : updates.completedAt !== undefined && updates.status === undefined
        ? updates.completedAt !== null && currentTask.status !== 'done'
          ? { status: 'done' as const }
          : updates.completedAt === null && currentTask.status === 'done'
          ? { status: 'todo' as const }
          : {}
        : {};
    
    // Create the final updated task object immutably
    const updatedTask: Task = { 
      ...currentTask, 
      ...baseUpdates,
      ...statusUpdates
    };
    
    // Handle recurring task completion: create completed occurrence only (don't advance to next occurrence)
    // UPDATED: When closing a recurring task, only close the current occurrence, don't create next occurrence
    const isRecurringTask = currentTask.recurrence && currentTask.recurrence.type !== 'none';
    let completedOccurrence: Task | null = null;
    
    if (isRecurringTask && isBeingMarkedComplete && currentTask.scheduledDate) {
      // Check if this task is already being processed (prevent race conditions)
      if (nextOccurrenceCreationLock.current.has(baseTaskId)) {
        logger.debug('Recurring task completion already in progress, skipping duplicate creation');
        // Still need to update the task status to done
        // Continue with normal update flow below
      } else {
        // Acquire lock only if not already locked
        nextOccurrenceCreationLock.current.add(baseTaskId);
      
        try {
          // Use completion date (today) so the occurrence appears on Today Agenda and filter id matches
          const completionDate = new Date();
          completionDate.setHours(0, 0, 0, 0);
          const completionDateKey = getDateString(completionDate);
          const completedOccurrenceId = `${currentTask.id}${RECURRENCE_OCCURRENCE_ID_SUFFIX_COMPLETED}${completionDateKey}`;
          
          // Check if completed occurrence already exists (prevent duplicates)
          const existingCompletedOccurrence = tasks.find(t => t.id === completedOccurrenceId);
          if (existingCompletedOccurrence) {
            logger.debug('Completed occurrence already exists, skipping creation', { completedOccurrenceId });
            // Don't create completed occurrence if it already exists
          } else {
            // Occurrence scheduled for today at same time as base task so it appears on Today Agenda
            const baseScheduled = new Date(currentTask.scheduledDate);
            const occurrenceScheduled = new Date(completionDate);
            occurrenceScheduled.setHours(baseScheduled.getHours(), baseScheduled.getMinutes(), baseScheduled.getSeconds(), baseScheduled.getMilliseconds());
            const completedAt = new Date().toISOString();
            // Use per-occurrence time from _subtasks_ for this date if present, else base task
            const subtasksOccurrenceId = `${baseTaskId}${RECURRENCE_OCCURRENCE_ID_SUFFIX_SUBTASKS}${completionDateKey}`;
            const subtasksOccurrence = tasks.find(t => t.id === subtasksOccurrenceId);
            const occurrenceActualTime = subtasksOccurrence?.actualTime ?? currentTask.actualTime ?? null;
            completedOccurrence = {
              ...currentTask,
              id: completedOccurrenceId,
              recurrence: RECURRENCE_NONE_CONFIG,
              status: 'done',
              completedAt,
              updatedAt: completedAt,
              actualTime: occurrenceActualTime,
              scheduledDate: occurrenceScheduled.toISOString(), // Today at same time so Today Agenda shows it
            };
          }
          
          // UPDATED: Don't create next occurrence - just mark current occurrence as done
          logger.debug('Recurring task marked complete - only closing current occurrence, not advancing to next', {
            taskId: baseTaskId,
            completionDateKey,
          });
        } catch (error) {
          logger.error('Error creating completed occurrence for recurring task:', error);
          // Release lock on error
          nextOccurrenceCreationLock.current.delete(baseTaskId);
          throw error;
        } finally {
          // Release lock after a short delay to ensure server save completes
          setTimeout(() => {
            nextOccurrenceCreationLock.current.delete(baseTaskId);
          }, TIMING_CONSTANTS.taskSync.uiUpdateDelay);
        }
      }
    }
    
    // Save to Supabase (source of truth); use currentWorkspaceId to avoid redundant ensureWorkspace
    if (currentWorkspaceId && accessToken) {
      const validWorkspaceId = currentWorkspaceId;
      try {
        // Optimistic update first so UI updates immediately (mark complete / edit feels instant)
        setTasks((prev) => {
          // Recurring: close only this occurrence; never set base task to done (keeps series active)
          if (isRecurringTask && isBeingMarkedComplete) {
            if (completedOccurrence && !prev.some((t) => t.id === completedOccurrence.id)) {
              return [...prev, completedOccurrence];
            }
            return prev; // Base task stays todo; only the occurrence is done
          }
          return prev.map((t) => (t.id === lookupId ? updatedTask : t));
        });

        // Save completed occurrence if created (only if it doesn't already exist)
        if (completedOccurrence) {
          // Double-check it doesn't exist before saving
          const existingCompleted = tasks.find(t => t.id === completedOccurrence.id);
          if (!existingCompleted) {
            await api.saveTask(validWorkspaceId, completedOccurrence);
          } else {
            logger.debug('Completed occurrence already exists in tasks, skipping save', { id: completedOccurrence.id });
          }
        }
        
        // UPDATED: For recurring tasks marked complete, don't advance to next occurrence
        // Just save the completed occurrence and keep the base task unchanged
        // The base task will continue to appear on future dates via isDateInRecurrence()
        const hasScheduledDateUpdate = updates.scheduledDate !== undefined;
        
        if (!isRecurringTask || hasScheduledDateUpdate) {
          // Save non-recurring tasks, or recurring tasks when scheduledDate is being updated
          await api.saveTask(validWorkspaceId, updatedTask);
        } else if (isRecurringTask && isBeingMarkedComplete) {
          // For recurring tasks marked complete, don't update the base task
          // The base task stays active and will appear on future dates
          // Only the completed occurrence is saved (already saved above)
          logger.debug('Recurring task marked complete - base task unchanged, only completed occurrence saved', {
            taskId: baseTaskId,
            completedOccurrenceId: completedOccurrence?.id,
          });
        } else {
          // Other recurring task updates (status change, etc.) - save normally
          await api.saveTask(validWorkspaceId, updatedTask);
        }

        // Skip full reload after save for faster UX; background sync notifies other devices
        debouncedSync(false);
        // Also trigger a direct sync after a short delay to ensure other devices get updates quickly (silent so failures don't toast)
        setTimeout(() => {
          if (workspaceId && accessToken && syncWithServerRef.current) {
            syncWithServerRef.current(workspaceId, true).catch((err: any) => {
              logger.debug('Background sync after task update:', err);
            });
          }
        }, TIMING_CONSTANTS.taskSync.serverProcessDelay);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to update task on server:', error);
        
        // If workspace not found, try to ensure it exists and retry
        if (errorMessage.includes('Workspace not found') || errorMessage.includes('Workspace or endpoint not found')) {
          try {
            logger.debug('Workspace not found when updating task, ensuring workspace exists...');
            // Explicitly create workspace
            await createWorkspaceIfNeeded();
            // Wait a bit for workspace to be fully created
            await new Promise(resolve => setTimeout(resolve, TIMING_CONSTANTS.delays.taskContext));
            const validWorkspaceId = await ensureWorkspace();
            if (validWorkspaceId) {
              logger.info('Workspace created, retrying task update with workspace ID:', validWorkspaceId);
              // Retry saving with valid workspace ID
              // Save completed occurrence if created
              if (completedOccurrence) {
                await api.saveTask(validWorkspaceId, completedOccurrence);
              }
              // For recurring task marked complete, do NOT save base task (only close this occurrence)
              if (!isRecurringTask || !isBeingMarkedComplete) {
                await api.saveTask(validWorkspaceId, updatedTask);
              }
              // Release lock after save completes
              if (isRecurringTask && isBeingMarkedComplete) {
                setTimeout(() => {
                  nextOccurrenceCreationLock.current.delete(baseTaskId);
                }, TIMING_CONSTANTS.taskSync.uiUpdateDelay);
              }
              await loadTasksFromServer(validWorkspaceId);
              // Trigger immediate sync to notify other devices (with minimal debounce for cross-device sync)
              debouncedSync(false);
              // Also trigger a direct sync after a short delay (silent so failures don't toast)
              setTimeout(() => {
                if (workspaceId && accessToken && syncWithServerRef.current) {
                  syncWithServerRef.current(workspaceId, true).catch((err: any) => {
                    logger.debug('Background sync after task update retry:', err);
                  });
                }
              }, TIMING_CONSTANTS.taskSync.serverProcessDelay);
              return;
            } else {
              logger.error('Workspace creation failed - no workspace ID returned');
            }
          } catch (retryError) {
            logger.error('Failed to ensure workspace on retry:', retryError);
          }
        }
        
        // Fallback: update locally
        setTasks(prev => {
          // For recurring task marked complete: only add the completed occurrence; do not set base task to done (avoids duplicate "done" entries)
          if (isRecurringTask && isBeingMarkedComplete && completedOccurrence) {
            const updated = [...prev, completedOccurrence];
            saveToLocalStorage('tasks', updated, user?.id);
            return updated;
          }
          let updated = prev.map(task => {
            if (task.id === lookupId) {
              return updatedTask;
            }
            return task;
          });
          if (completedOccurrence) {
            updated = [...updated, completedOccurrence];
          }
          saveToLocalStorage('tasks', updated, user?.id);
          return updated;
        });
        
        // Release lock on error
        if (isRecurringTask && isBeingMarkedComplete) {
          nextOccurrenceCreationLock.current.delete(baseTaskId);
        }
        
        // Revert optimistic update by resyncing from server
        await loadTasksFromServer(validWorkspaceId).catch(() => {});
        toast.error('Task updated offline, will sync when online');
      }
    } else {
      // No workspace/auth - update locally only
      setTasks(prev => {
        // For recurring task marked complete: only add the completed occurrence; do not set base task to done (avoids duplicate "done" entries)
        if (isRecurringTask && isBeingMarkedComplete && completedOccurrence) {
          const updated = [...prev, completedOccurrence];
          saveToLocalStorage('tasks', updated, user?.id);
          return updated;
        }
        let updated = prev.map(task => {
          if (task.id === lookupId) {
            return updatedTask;
          }
          return task;
        });
        if (completedOccurrence) {
          updated = [...updated, completedOccurrence];
        }
        saveToLocalStorage('tasks', updated, user?.id);
        return updated;
      });
      
      // Release lock
      if (isRecurringTask && isBeingMarkedComplete) {
        nextOccurrenceCreationLock.current.delete(baseTaskId);
      }
    }
  } catch (_) {
    throw _;
  }
  }, [tasks, workspaceId, accessToken, updateActivity, calculateNextOccurrenceDate, ensureWorkspace, createWorkspaceIfNeeded, loadTasksFromServer, debouncedSync]); // Removed syncWithServer from dependencies

  const deleteTask = useCallback(async (taskId: string) => {
    updateActivity(); // Track demo user activity
    
    // Permission check removed to break circular dependency with TeamContext
    // Permission checks should be handled at component level using useTeam() hook
    
    // Delete from Supabase FIRST (source of truth)
    if (workspaceId && accessToken) {
      try {
        await api.deleteTask(workspaceId, taskId);
        // Reload from server to get the authoritative version
        await loadTasksFromServer(workspaceId);
        // Trigger immediate sync to notify other devices (debounced)
        debouncedSync(false);
        toast.success('Task deleted');
      } catch (error) {
        logger.error('Failed to delete task from server:', error);
        // Fallback: delete locally
        setTasks(prev => {
          const updated = prev.filter(task => task.id !== taskId);
          saveToLocalStorage('tasks', updated);
          return updated;
        });
        toast.error('Task deleted offline, will sync when online');
      }
    } else {
      // No workspace/auth - delete locally only
      setTasks(prev => {
        const updated = prev.filter(task => task.id !== taskId);
        saveToLocalStorage('tasks', updated);
        return updated;
      });
      toast.success('Task deleted (offline)');
    }
  }, [workspaceId, accessToken, updateActivity]);

  const bulkDeleteTasks = useCallback(async (taskIds: string[]) => {
    if (taskIds.length === 0) return;
    
    updateActivity(); // Track demo user activity
    
    // Delete from Supabase FIRST (source of truth)
    if (workspaceId && accessToken) {
      try {
        // Delete all tasks in parallel
        await Promise.all(
          taskIds.map(taskId => api.deleteTask(workspaceId, taskId))
        );
        // Reload from server to get the authoritative version
        await loadTasksFromServer(workspaceId);
        // Trigger immediate sync to notify other devices (debounced)
        debouncedSync(false);
        toast.success(`${taskIds.length} task${taskIds.length === 1 ? '' : 's'} deleted`);
      } catch (error) {
        logger.error('Failed to delete tasks from server:', error);
        // Fallback: delete locally
        setTasks(prev => {
          const updated = prev.filter(task => !taskIds.includes(task.id));
          saveToLocalStorage('tasks', updated);
          return updated;
        });
        toast.error(`${taskIds.length} task${taskIds.length === 1 ? '' : 's'} deleted offline, will sync when online`);
      }
    } else {
      // No workspace/auth - delete locally only
      setTasks(prev => {
        const updated = prev.filter(task => !taskIds.includes(task.id));
        saveToLocalStorage('tasks', updated);
        return updated;
      });
      toast.success(`${taskIds.length} task${taskIds.length === 1 ? '' : 's'} deleted (offline)`);
    }
  }, [workspaceId, accessToken, updateActivity]);

  const addProject = useCallback(async (projectData: Partial<Project>) => {
    const newProject: Project = {
      id: generateId(),
      name: projectData.name || 'New Project',
      color: projectData.color || '#3b82f6',
      description: projectData.description || '',
      createdAt: new Date().toISOString(),
      archived: false,
    };

    // Save to Supabase FIRST (source of truth)
    if (workspaceId && accessToken) {
      try {
        await api.saveProject(workspaceId, newProject);
        // Reload from server to get the authoritative version
        await syncProjectsFromServer(workspaceId);
        toast.success('Project created');
      } catch (error) {
        logger.error('Failed to save project to server:', error);
        // Fallback: save locally
        setProjects(prev => {
          const updated = [...prev, newProject];
          saveToLocalStorage('projects', updated);
          return updated;
        });
        toast.error('Project saved offline, will sync when online');
      }
    } else {
      // No workspace/auth - save locally only
      setProjects(prev => {
        const updated = [...prev, newProject];
        saveToLocalStorage('projects', updated);
        return updated;
      });
      toast.success('Project created (offline)');
    }
  }, [workspaceId, accessToken]);

  const updateProject = useCallback(async (projectId: string, updates: Partial<Project>) => {
    const currentProject = projects.find(p => p.id === projectId);
    if (!currentProject) {
      toast.error('Project not found');
      return;
    }

    const updatedProject = { ...currentProject, ...updates };

    // Save to Supabase FIRST (source of truth)
    if (workspaceId && accessToken) {
      try {
        await api.saveProject(workspaceId, updatedProject);
        // Reload from server to get the authoritative version
        await syncProjectsFromServer(workspaceId);
      } catch (error) {
        logger.error('Failed to update project on server:', error);
        // Fallback: update locally
        setProjects(prev => {
          const updated = prev.map(project =>
            project.id === projectId ? updatedProject : project
          );
          saveToLocalStorage('projects', updated);
          return updated;
        });
        toast.error('Project updated offline, will sync when online');
      }
    } else {
      // No workspace/auth - update locally only
      setProjects(prev => {
        const updated = prev.map(project =>
          project.id === projectId ? updatedProject : project
        );
        saveToLocalStorage('projects', updated);
        return updated;
      });
    }
  }, [projects, workspaceId, accessToken]);

  // Define addAvailableTag and removeAvailableTag BEFORE folder functions to avoid circular dependency
  const addAvailableTag = useCallback(async (tag: string) => {
    const trimmedTag = tag.trim();
    if (!trimmedTag) {
      toast.error('Tag name cannot be empty');
      return;
    }
    
    if (availableTags.includes(trimmedTag)) {
      toast.error('Tag already exists');
      return;
    }
    
    const updatedTags = [...availableTags, trimmedTag];
    
    // Save to Supabase FIRST (source of truth)
    if (workspaceId && accessToken) {
      try {
        await api.saveSettings(workspaceId, { availableTags: updatedTags });
        // Reload from server to get the authoritative version
        await syncSettingsFromServer(workspaceId);
        toast.success('Tag created');
      } catch (error) {
        logger.error('Failed to save tag to server:', error);
        // Fallback: save locally
        setAvailableTags(updatedTags);
        saveToLocalStorage('availableTags', updatedTags);
        toast.error('Tag saved offline, will sync when online');
      }
    } else {
      // No workspace/auth - save locally only
      setAvailableTags(updatedTags);
      saveToLocalStorage('availableTags', updatedTags);
      toast.success('Tag created (offline)');
    }
  }, [availableTags, workspaceId, accessToken]);

  const removeAvailableTag = useCallback(async (tag: string) => {
    // Prevent deletion of protected/default tags
    if (PROTECTED_TAGS.includes(tag)) {
      toast.error('Cannot delete default tags', {
        description: 'Work, Personal, Projects, and Business are required tags and cannot be removed.',
        duration: TOAST_DURATION_MEDIUM_MS,
      });
      return;
    }
    
    const updatedTags = availableTags.filter(t => t !== tag);
    
    // Save to Supabase FIRST (source of truth)
    if (workspaceId && accessToken) {
      try {
        await api.saveSettings(workspaceId, { availableTags: updatedTags });
        // Reload from server to get the authoritative version
        await syncSettingsFromServer(workspaceId);
        toast.success('Tag removed');
      } catch (error) {
        logger.error('Failed to remove tag from server:', error);
        // Fallback: remove locally
        setAvailableTags(updatedTags);
        saveToLocalStorage('availableTags', updatedTags);
        toast.error('Tag removed offline, will sync when online');
      }
    } else {
      // No workspace/auth - remove locally only
      setAvailableTags(updatedTags);
      saveToLocalStorage('availableTags', updatedTags);
      toast.success('Tag removed (offline)');
    }
  }, [availableTags, workspaceId, accessToken]);

  const addFolder = useCallback(async (folderData: Partial<Folder>) => {
    if (!folderData.name || !folderData.name.trim()) {
      toast.error('Folder name is required');
      return;
    }

    const newFolder: Folder = {
      id: folderData.id || generateId(),
      name: folderData.name.trim(),
      description: folderData.description || '',
      color: folderData.color || '#3b82f6',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      synced: false,
      pendingSync: true,
    };

    // Add folder name as an available tag
    const folderName = newFolder.name;
    if (folderName && !availableTags.includes(folderName)) {
      try {
        await addAvailableTag(folderName);
      } catch (error) {
        logger.error('Failed to add folder name as tag:', error);
        // Continue with folder creation even if tag addition fails
      }
    }

    // Optimistic update: add to state immediately
    setFolders(prev => {
      // Check if folder with same name already exists
      if (prev.some(f => f.name === newFolder.name)) {
        logger.warn('Folder with this name already exists');
        return prev;
      }
      const updated = [...prev, newFolder];
      saveToLocalStorage('folders', updated);
      logger.debug('Folder added optimistically:', newFolder.id);
      return updated;
    });

    // Save to Supabase (source of truth)
    if (accessToken) {
      try {
        // Ensure workspace exists before saving folder
        let currentWorkspaceId = workspaceId;
        if (!currentWorkspaceId) {
          const validWorkspaceId = await ensureWorkspace();
          if (!validWorkspaceId) {
            toast.error('Workspace not available. Please refresh the page.');
            return;
          }
          currentWorkspaceId = validWorkspaceId;
        }

        logger.debug('Saving folder to server:', newFolder.id);
        let savedFolder: Folder;
        try {
          savedFolder = await api.saveFolder(currentWorkspaceId, newFolder);
        } catch (saveError) {
          const errorMessage = saveError instanceof Error ? saveError.message : String(saveError);
          // If workspace not found, try to ensure it exists and retry
          if (errorMessage.includes('Workspace not found') || errorMessage.includes('Workspace or endpoint not found')) {
            logger.debug('Workspace not found when saving folder, ensuring workspace exists...');
            try {
              // Explicitly create workspace
              await createWorkspaceIfNeeded();
              // Wait a bit for workspace to be fully created
              await new Promise(resolve => setTimeout(resolve, TIMING_CONSTANTS.delays.taskContext));
              const validWorkspaceId = await ensureWorkspace();
              if (validWorkspaceId) {
                logger.info('Workspace created, retrying folder save with workspace ID:', validWorkspaceId);
                // Retry saving with valid workspace ID
                savedFolder = await api.saveFolder(validWorkspaceId, newFolder);
                // Update workspace ID in state if it changed
                if (workspaceId !== validWorkspaceId) {
                  setWorkspaceId(validWorkspaceId);
                }
              } else {
                throw new Error('Workspace creation failed - no workspace ID returned');
              }
            } catch (retryError) {
              logger.error('Failed to ensure workspace on retry:', retryError);
              throw saveError; // Re-throw original error
            }
          } else {
            throw saveError; // Re-throw if not a workspace error
          }
        }

        logger.debug('Folder saved to server, updating state:', savedFolder.id);
        const normalizedSavedFolder: Folder = {
          ...savedFolder,
          synced: true,
          pendingSync: false,
        };
        
        // Update state with server response immediately
        // Only update if the folder data actually changed to prevent unnecessary re-renders
        setFolders(prev => {
          // Check if folder already exists in state
          const existingIndex = prev.findIndex(f => f.id === newFolder.id);
          
          if (existingIndex >= 0) {
            const existingFolder = prev[existingIndex];
            // Only update if data actually changed
            const hasChanged = 
              existingFolder.name !== normalizedSavedFolder.name ||
              existingFolder.description !== normalizedSavedFolder.description ||
              existingFolder.color !== normalizedSavedFolder.color ||
              existingFolder.updatedAt !== normalizedSavedFolder.updatedAt ||
              existingFolder.pendingSync !== normalizedSavedFolder.pendingSync ||
              existingFolder.synced !== normalizedSavedFolder.synced;
            
            if (!hasChanged) {
              logger.debug('Folder data unchanged, skipping state update');
              return prev; // Return same reference to prevent re-render
            }
            
            // Replace existing folder with server version
            const updated = [...prev];
            updated[existingIndex] = normalizedSavedFolder;
            logger.debug('Folder updated in state at index:', existingIndex);
            saveToLocalStorage('folders', updated);
            return updated;
          } else {
            // Add server folder if not found (shouldn't happen, but handle it)
            const updated = [...prev, normalizedSavedFolder];
            logger.debug('Folder added to state (was missing)');
            saveToLocalStorage('folders', updated);
            return updated;
          }
        });
        
        toast.success('Folder created');
        try {
          await syncFoldersFromServer(currentWorkspaceId, true);
        } catch (syncError) {
          logger.error('Failed to refresh folders after creation:', syncError);
        }
        // Trigger immediate sync to notify other devices (with minimal debounce for cross-device sync)
        debouncedSync(true);
        // Also trigger a direct folder sync after a short delay to ensure other devices get updates quickly
        setTimeout(() => {
          if (currentWorkspaceId && accessToken) {
            syncFoldersFromServer(currentWorkspaceId, true).catch(err => {
              logger.debug('Background folder sync after creation:', err);
            });
          }
        }, TIMING_CONSTANTS.taskSync.serverProcessDelay); // Delay to allow server to process
      } catch (error) {
        logger.error('Failed to save folder to server:', error);
        // Keep the optimistic update, but mark it for sync
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Workspace not found') || errorMessage.includes('Workspace or endpoint not found')) {
          toast.error('Workspace not found. Please refresh the page.');
        } else {
          toast.error('Folder saved offline, will sync when online');
        }
      }
    } else {
      // No workspace/auth - already saved locally above
      logger.warn('No workspace or access token, saving folder locally only');
      toast.success('Folder created (offline)');
    }
  }, [workspaceId, accessToken, availableTags, addAvailableTag, debouncedSync]);

  const updateFolder = useCallback(async (folderId: string, updates: Partial<Folder>) => {
    // Find the folder to get the old name
    const oldFolder = folders.find(f => f.id === folderId);
    if (!oldFolder) {
      toast.error('Folder not found');
      return;
    }
    
    const oldName = oldFolder.name;
    const newName = updates.name?.trim();

    // If folder name is being updated, update tags in all tasks
    if (oldName && newName && oldName !== newName) {
      // Update tasks: remove old tag, add new tag
      const tasksToUpdate = tasks.filter(task => 
        task.tags && task.tags.includes(oldName)
      );

      for (const task of tasksToUpdate) {
        const updatedTags = task.tags
          .filter(tag => tag !== oldName)
          .concat(newName);
        
        try {
          await updateTask(task.id, { tags: updatedTags });
        } catch (error) {
          logger.error(`Failed to update task ${task.id} tags:`, error);
        }
      }

      // Update available tags: remove old, add new
      if (availableTags.includes(oldName)) {
        try {
          await removeAvailableTag(oldName);
        } catch (error) {
          logger.error('Failed to remove old folder name tag:', error);
        }
      }
      if (newName && !availableTags.includes(newName)) {
        try {
          await addAvailableTag(newName);
        } catch (error) {
          logger.error('Failed to add new folder name tag:', error);
        }
      }
    }

    // Save to server
    if (accessToken) {
      try {
        // Ensure workspace exists before updating folder
        let currentWorkspaceId = workspaceId;
        if (!currentWorkspaceId) {
          const validWorkspaceId = await ensureWorkspace();
          if (!validWorkspaceId) {
            toast.error('Workspace not available. Please refresh the page.');
            return;
          }
          currentWorkspaceId = validWorkspaceId;
        }

        let updatedFolder: Folder;
        try {
          updatedFolder = await api.updateFolder(currentWorkspaceId, folderId, updates);
        } catch (updateError) {
          const errorMessage = updateError instanceof Error ? updateError.message : String(updateError);
          // If workspace not found, try to ensure it exists and retry
          if (errorMessage.includes('Workspace not found') || errorMessage.includes('Workspace or endpoint not found')) {
            logger.debug('Workspace not found when updating folder, ensuring workspace exists...');
            try {
              // Explicitly create workspace
              await createWorkspaceIfNeeded();
              // Wait a bit for workspace to be fully created
              await new Promise(resolve => setTimeout(resolve, TIMING_CONSTANTS.delays.taskContext));
              const validWorkspaceId = await ensureWorkspace();
              if (validWorkspaceId) {
                logger.info('Workspace created, retrying folder update with workspace ID:', validWorkspaceId);
                // Retry updating with valid workspace ID
                updatedFolder = await api.updateFolder(validWorkspaceId, folderId, updates);
                // Update workspace ID in state if it changed
                if (workspaceId !== validWorkspaceId) {
                  setWorkspaceId(validWorkspaceId);
                }
              } else {
                throw new Error('Workspace creation failed - no workspace ID returned');
              }
            } catch (retryError) {
              logger.error('Failed to ensure workspace on retry:', retryError);
              throw updateError; // Re-throw original error
            }
          } else {
            throw updateError; // Re-throw if not a workspace error
          }
        }

        const normalizedUpdatedFolder: Folder = {
          ...updatedFolder,
          pendingSync: false,
          synced: true,
        };
        // Update state with server response to ensure we have the exact server version
        setFolders(prev => {
          const updated = prev.map(f => f.id === folderId ? normalizedUpdatedFolder : f);
          saveToLocalStorage('folders', updated);
          return updated;
        });
        toast.success('Folder updated');
        // Trigger immediate sync to notify other devices
        try {
          await syncFoldersFromServer(currentWorkspaceId, true);
        } catch (syncError) {
          logger.error('Failed to refresh folders after update:', syncError);
        }
        // Trigger immediate sync to notify other devices (with minimal debounce for cross-device sync)
        debouncedSync(true);
        // Also trigger a direct folder sync after a short delay to ensure other devices get updates quickly
        setTimeout(() => {
          if (currentWorkspaceId && accessToken) {
            syncFoldersFromServer(currentWorkspaceId, true).catch(err => {
              logger.debug('Background folder sync after update:', err);
            });
          }
        }, TIMING_CONSTANTS.taskSync.serverProcessDelay); // Delay to allow server to process
      } catch (error) {
        logger.error('Failed to update folder on server:', error);
        // Keep the optimistic update, but mark it for sync
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Workspace not found') || errorMessage.includes('Workspace or endpoint not found')) {
          toast.error('Workspace not found. Please refresh the page.');
        } else {
          setFolders(prev => {
            const updated = prev.map(f => f.id === folderId ? { ...f, ...updates, synced: false, pendingSync: true } : f);
            saveToLocalStorage('folders', updated);
            return updated;
          });
          toast.error('Folder update failed, will sync when online');
        }
      }
    } else {
      // No workspace/auth - update locally only
      setFolders(prev => {
        const updated = prev.map(folder =>
          folder.id === folderId
            ? { ...folder, ...updates, updatedAt: new Date().toISOString(), pendingSync: true, synced: false }
            : folder
        );
        saveToLocalStorage('folders', updated);
        return updated;
      });
      toast.success('Folder updated (offline)');
      return;
    }
  }, [workspaceId, accessToken, folders, tasks, availableTags, updateTask, addAvailableTag, removeAvailableTag, debouncedSync]);

  // Expose ensureWorkspace for manual triggering (moved before deleteFolder to avoid initialization error)
  const deleteFolder = useCallback(async (folderId: string) => {
    // Find the folder to get its name
    const folderToDelete = folders.find(f => f.id === folderId);
    if (!folderToDelete) {
      toast.error('Folder not found');
      return;
    }
    
    const folderName = folderToDelete.name;
    let lastWorkspaceUsed: string | null = null;
    let serverDeleteSuccess = false;

    // Try to delete folder from server first (source of truth)
    // This ensures the folder is deleted even if tag removal fails
    if (accessToken) {
      try {
        // Ensure workspace exists before deleting folder
        let currentWorkspaceId = workspaceId;
        lastWorkspaceUsed = currentWorkspaceId ?? null;
        if (!currentWorkspaceId) {
          const validWorkspaceId = await ensureWorkspace();
          if (!validWorkspaceId) {
            // Don't throw - allow local deletion to proceed even if workspace is not available
            logger.warn('Workspace not available, proceeding with local deletion only');
          } else {
            currentWorkspaceId = validWorkspaceId;
            lastWorkspaceUsed = validWorkspaceId;
          }
        }

        // Delete folder from server first (only if we have a workspace ID)
        if (currentWorkspaceId) {
          try {
            await api.deleteFolder(currentWorkspaceId, folderId);
            serverDeleteSuccess = true;
            lastWorkspaceUsed = currentWorkspaceId;
          } catch (deleteError) {
            const errorMessage = deleteError instanceof Error ? deleteError.message : String(deleteError);
            // If workspace not found, try to ensure it exists and retry
            if (errorMessage.includes('Workspace not found') || errorMessage.includes('Workspace or endpoint not found')) {
              logger.debug('Workspace not found when deleting folder, ensuring workspace exists...');
              try {
                // Explicitly create workspace
                await createWorkspaceIfNeeded();
                // Wait a bit for workspace to be fully created
                await new Promise(resolve => setTimeout(resolve, TIMING_CONSTANTS.delays.taskContext));
                const validWorkspaceId = await ensureWorkspace();
                if (validWorkspaceId) {
                  logger.info('Workspace created, retrying folder deletion with workspace ID:', validWorkspaceId);
                  // Retry deleting with valid workspace ID
                  await api.deleteFolder(validWorkspaceId, folderId);
                  serverDeleteSuccess = true;
                  lastWorkspaceUsed = validWorkspaceId;
                  // Update workspace ID in state if it changed
                  if (workspaceId !== validWorkspaceId) {
                    setWorkspaceId(validWorkspaceId);
                  }
                } else {
                  logger.warn('Workspace creation failed, proceeding with local deletion only');
                }
              } catch (retryError) {
                logger.error('Failed to ensure workspace on retry:', retryError);
                // Don't throw - allow local deletion to proceed
                logger.warn('Server deletion failed, proceeding with local deletion only');
              }
            } else {
              // For other errors, log but allow local deletion to proceed
              logger.warn('Server deletion failed:', errorMessage);
            }
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Error deleting folder from server:', error);
        // Don't throw - allow local deletion to proceed
        logger.warn('Server deletion failed, proceeding with local deletion only');
      }
    }

    // Remove folder tag from all tasks that have it
    // This happens regardless of server deletion success to keep local state consistent
    const tasksToUpdate = tasks.filter(task => 
      task.tags && task.tags.includes(folderName)
    );

    for (const task of tasksToUpdate) {
      const updatedTags = task.tags.filter(tag => tag !== folderName);
      try {
        await updateTask(task.id, { tags: updatedTags });
      } catch (error) {
        logger.error(`Failed to remove folder tag from task ${task.id}:`, error);
        // Continue even if tag removal fails - folder will still be deleted locally
      }
    }

    // Remove folder name from available tags if it exists
    if (availableTags.includes(folderName)) {
      try {
        await removeAvailableTag(folderName);
      } catch (error) {
        logger.error('Failed to remove folder name tag:', error);
        // Continue even if tag removal fails - folder will still be deleted locally
      }
    }

    // Remove from state (always do this to keep UI consistent)
    setFolders(prev => {
      const updated = prev.filter(folder => folder.id !== folderId);
      saveToLocalStorage('folders', updated);
      return updated;
    });

    // Show appropriate success message
    if (serverDeleteSuccess || !accessToken) {
      toast.success('Folder deleted');
    } else {
      toast.success('Folder deleted (offline)');
    }

    if (serverDeleteSuccess && lastWorkspaceUsed) {
      try {
        await syncFoldersFromServer(lastWorkspaceUsed, true);
      } catch (syncError) {
        logger.error('Failed to refresh folders after deletion:', syncError);
      }
      // Trigger immediate sync to notify other devices (with minimal debounce for cross-device sync)
      debouncedSync(true);
      // Also trigger a direct folder sync after a short delay to ensure other devices get updates quickly
      setTimeout(() => {
        if (lastWorkspaceUsed && accessToken) {
          syncFoldersFromServer(lastWorkspaceUsed, true).catch(err => {
            logger.debug('Background folder sync after deletion:', err);
          });
        }
      }, TIMING_CONSTANTS.taskSync.serverProcessDelay); // Delay to allow server to process
    }
  }, [workspaceId, accessToken, folders, tasks, availableTags, updateTask, removeAvailableTag, ensureWorkspace, createWorkspaceIfNeeded, setWorkspaceId, debouncedSync]);

  const updateHoursSettings = useCallback(async (settings: Partial<HoursSettings>) => {
    const updatedSettings = { ...hoursSettings, ...settings };

    // Save to Supabase FIRST (source of truth)
    if (workspaceId && accessToken) {
      try {
        await api.saveSettings(workspaceId, { hoursSettings: updatedSettings });
        // Reload from server to get the authoritative version
        await syncSettingsFromServer(workspaceId);
        toast.success('Hours settings updated');
      } catch (error) {
        logger.error('Failed to sync hours settings:', error);
        // Fallback: save locally
        setHoursSettings(updatedSettings);
        saveToLocalStorage('hoursSettings', updatedSettings);
        toast.error('Hours settings saved offline, will sync when online');
      }
    } else {
      // No workspace/auth - save locally only
      setHoursSettings(updatedSettings);
      saveToLocalStorage('hoursSettings', updatedSettings);
      toast.success('Hours settings updated (offline)');
    }
  }, [hoursSettings, workspaceId, accessToken]);

  const updateRolloverSettings = useCallback(async (settings: Partial<RolloverSettings>) => {
    const updatedSettings = { ...rolloverSettings, ...settings };

    // Save to Supabase FIRST (source of truth)
    if (workspaceId && accessToken) {
      try {
        await api.saveSettings(workspaceId, { rolloverSettings: updatedSettings });
        // Reload from server to get the authoritative version
        await syncSettingsFromServer(workspaceId);
        toast.success('Rollover settings updated');
      } catch (error) {
        logger.error('Failed to sync rollover settings:', error);
        // Fallback: save locally
        setRolloverSettings(updatedSettings);
        saveToLocalStorage('rolloverSettings', updatedSettings);
        toast.error('Rollover settings saved offline, will sync when online');
      }
    } else {
      // No workspace/auth - save locally only
      setRolloverSettings(updatedSettings);
      saveToLocalStorage('rolloverSettings', updatedSettings);
      toast.success('Rollover settings updated (offline)');
    }
  }, [rolloverSettings, workspaceId, accessToken]);

  // Task Rollover: Check for incomplete tasks from previous days and roll them over
  // Use a ref to track if we've already checked today to prevent duplicate notifications
  const rolloverCheckedRef = React.useRef<string>('');

  useEffect(() => {
    // Gate: Task rollover requires Pro subscription
    if (!hasFeature('taskRollover')) return;
    if (!rolloverSettings.autoRollover || !user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayString = getDateString(today);

    // Check if we've already run rollover today (check both localStorage and ref)
    const lastCheck = getFromLocalStorage<string>('lastRolloverCheck', '');
    const hasCheckedToday = lastCheck === todayString || rolloverCheckedRef.current === todayString;
    
    if (hasCheckedToday) {
      return; // Already checked today, don't run again
    }

    const checkAndRolloverTasks = () => {
      // Find incomplete tasks that should roll over to inbox
      // Tasks roll over if:
      // 1. They have a scheduledDate that has passed (before today), OR
      // 2. They have a dueDate that has passed (before today, even if no scheduledDate)
      // 3. They are not completed (status !== 'done')
      // 4. They are not already in inbox (scheduledDate === null/undefined means already in inbox)
      // 5. They are NOT recurring tasks (rollover rule does not apply to recurring tasks)
      // Guideline: Recurring tasks are never rolled over; they use their own recurrence scheduling.
      // Note: Rollover occurs after midnight when the date changes, rolling over tasks from previous days
      const tasksToRollover = tasks.filter(task => {
        // Skip completed tasks
        if (task.status === 'done') return false;
        
        // Do not apply rollover to recurring tasks (guideline: recurring tasks excluded from rollover)
        if (task.recurrence && task.recurrence.type !== 'none') return false;
        
        // Skip tasks already in inbox (scheduledDate === null/undefined means already in inbox)
        // Tasks already in inbox don't need to be rolled over again
        if (task.scheduledDate === null || task.scheduledDate === undefined) return false;
        
        // Check if task has a scheduledDate or dueDate that has passed (before today)
        let hasPassedDate = false;
        
        // Priority 1: Check scheduledDate if it exists
        // Roll over tasks when scheduledDate is before today (has passed)
        if (task.scheduledDate) {
          try {
            const taskDate = new Date(task.scheduledDate);
            // Validate date is not invalid
            if (isNaN(taskDate.getTime())) {
              logger.warn('Invalid scheduledDate in task:', task.id, task.scheduledDate);
              return false;
            }
            taskDate.setHours(0, 0, 0, 0);
            const taskDateString = getDateString(taskDate);
            // Only roll over if date is BEFORE today (not today or future)
            // After midnight, tasks from previous days will be rolled over
            hasPassedDate = taskDateString < todayString;
          } catch (error) {
            logger.error('Error parsing scheduledDate:', task.id, task.scheduledDate, error);
            return false;
          }
        }
        
        // Priority 2: If scheduledDate hasn't passed or doesn't exist, check dueDate
        // Roll over tasks when dueDate is before today (has passed)
        if (!hasPassedDate && task.dueDate) {
          try {
            const dueDate = new Date(task.dueDate);
            // Validate date is not invalid
            if (isNaN(dueDate.getTime())) {
              logger.warn('Invalid dueDate in task:', task.id, task.dueDate);
              return false;
            }
            dueDate.setHours(0, 0, 0, 0);
            const dueDateString = getDateString(dueDate);
            // Only roll over if date is BEFORE today (not today or future)
            // After midnight, tasks with due dates from previous days will be rolled over
            hasPassedDate = dueDateString < todayString;
          } catch (error) {
            logger.error('Error parsing dueDate:', task.id, task.dueDate, error);
            return false;
          }
        }
        
        // Task should roll over if it has a passed date (before today)
        return hasPassedDate;
      });

      if (tasksToRollover.length > 0) {
        // Mark that we've checked today IMMEDIATELY to prevent duplicate notifications
        rolloverCheckedRef.current = todayString;
        saveToLocalStorage('lastRolloverCheck', todayString);

        if (rolloverSettings.askBeforeRolling) {
          // Show confirmation dialog
          const taskTitles = tasksToRollover.slice(0, 3).map(t => t.title).join(', ');
          const more = tasksToRollover.length > 3 ? ` and ${tasksToRollover.length - 3} more` : '';
          
          toast.info('🔄 Task Rollover', {
            description: `Move ${tasksToRollover.length} incomplete task(s) to inbox? (${taskTitles}${more})`,
            action: {
              label: 'Move to Inbox',
              onClick: () => performRollover(tasksToRollover, todayString),
            },
            cancel: {
              label: 'Skip',
              onClick: () => {
                // Already marked as checked above, no need to do it again
              },
            },
            duration: TOAST_DURATION_EXTRA_LONG_MS,
          });
        } else {
          // Automatically roll over without asking
          performRollover(tasksToRollover, todayString);
        }
      } else {
        // No tasks to rollover, but mark that we've checked today
        rolloverCheckedRef.current = todayString;
        saveToLocalStorage('lastRolloverCheck', todayString);
      }
    };

    const performRollover = async (tasksToRollover: Task[], todayString: string) => {
      let movedCount = 0;
      let failedCount = 0;
      const failedTasks: string[] = [];
      
      // Move tasks to inbox by setting scheduledDate to null
      // Guideline: Recurring tasks are never rolled over; safety filter to exclude any recurring task
      const validTasksToRollover = tasksToRollover.filter(task => {
        if (task.recurrence && task.recurrence.type !== 'none') {
          logger.warn('Attempted to roll over recurring task, skipping (rollover does not apply to recurring tasks):', task.id, task.title);
          return false;
        }
        return true;
      });
      
      for (const task of validTasksToRollover) {
        try {
          // Set scheduledDate to null to make it unscheduled (moves to inbox)
          // This preserves the task's other properties (dueDate, priority, etc.)
          await updateTask(task.id, { scheduledDate: null });
          movedCount++;
          logger.debug('Task rolled over to inbox:', task.id, task.title);
        } catch (error) {
          logger.error('Failed to move task to inbox:', task.id, task.title, error);
          failedCount++;
          failedTasks.push(task.title);
        }
      }
      
      // Show appropriate alert based on results
      if (movedCount > 0 && failedCount === 0) {
        // All tasks moved successfully
        toast.success(`✅ Moved ${movedCount} task${movedCount !== 1 ? 's' : ''} to inbox`, {
          description: movedCount === 1 
            ? 'The task has been moved to your inbox'
            : 'All tasks have been moved to your inbox',
          duration: TOAST_DURATION_MEDIUM_MS,
        });
      } else if (movedCount > 0 && failedCount > 0) {
        // Some tasks moved, some failed
        toast.warning(`⚠️ Moved ${movedCount} task${movedCount !== 1 ? 's' : ''} to inbox`, {
          description: `Failed to move ${failedCount} task${failedCount !== 1 ? 's' : ''}: ${failedTasks.slice(0, 3).join(', ')}${failedTasks.length > 3 ? '...' : ''}`,
          duration: TOAST_DURATION_LONG_MS,
        });
      } else if (failedCount > 0) {
        // All tasks failed
        toast.error(`❌ Failed to move tasks to inbox`, {
          description: `Could not move ${failedCount} task${failedCount !== 1 ? 's' : ''} to inbox. Please try again.`,
          duration: TOAST_DURATION_LONG_MS,
        });
      }
      
      // Ensure we're marked as checked (should already be set, but double-check)
      rolloverCheckedRef.current = todayString;
      saveToLocalStorage('lastRolloverCheck', todayString);
    };

    // Run rollover check after a short delay (to allow UI to load)
    // Also re-run when tasks change (but only if we haven't checked today)
    const timer = setTimeout(() => {
      checkAndRolloverTasks();
    }, TIMING_CONSTANTS.delays.rolloverCheck);
    
    return () => clearTimeout(timer);
  }, [rolloverSettings.autoRollover, rolloverSettings.askBeforeRolling, user?.id, updateTask, tasks.length]);

  return (
    <TaskContext.Provider
      value={{
        tasks,
        projects,
        folders,
        availableTags,
        filters,
        viewConfig,
        hoursSettings,
        rolloverSettings,
        workspaceId,
        isLoading,
        isSyncing,
        lastSync,
        addTask,
        updateTask,
        deleteTask,
        bulkDeleteTasks,
        addProject,
        updateProject,
        addFolder,
        updateFolder,
        deleteFolder,
        addAvailableTag,
        removeAvailableTag,
        setFilters,
        setViewConfig,
        updateHoursSettings,
        updateRolloverSettings,
        syncWithServer,
        ensureWorkspace,
        addTaskSeries,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (context === undefined) {
    // During React Fast Refresh (HMR) or edge cases, providers can temporarily unmount
    // Always return a safe default instead of throwing to prevent crashes
    // This ensures the app continues to work even if the provider isn't available yet
    if (import.meta.env.DEV) {
      console.warn('useTasks called outside TaskProvider (likely HMR issue), returning default');
    }
    const defaultContext = createDefaultTaskContext();
    return defaultContext;
  }
  return context;
}
