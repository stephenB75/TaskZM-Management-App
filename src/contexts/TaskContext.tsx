import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { useDemoActivity } from '../hooks/useDemoActivity';
import * as api from '../lib/api';
import { generateId, getFromLocalStorage, saveToLocalStorage } from '../lib/utils';
import { generateSampleTasks, generateSampleProjects } from '../lib/sampleData';
import { logger } from '../lib/logger';
import { findNextAvailableSlot } from '../lib/time-conflict';
import { getCategoryHoursForTask } from '../lib/category-hours-utils';
import { getTaskMinutes } from '../lib/daily-hours-utils';
import type { Task, Project, Folder, TaskFilters, ViewConfig, HoursSettings, RolloverSettings } from '../types';
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
} from '../lib/business-constants';
import { COLOR_PROJECT_DEFAULT } from '../lib/color-theme';

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
  isSyncing: boolean;
  lastSync: Date | null;
  addTask: (task: Partial<Task>) => Promise<void>;
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
  const { updateActivity } = useDemoActivity(); // Track demo user activity
  const [tasks, setTasks] = useState<Task[]>([]);
  // Lock to prevent concurrent next occurrence creation for the same task
  const nextOccurrenceCreationLock = useRef<Set<string>>(new Set());
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
  const lastErrorToastRef = useRef<{ message: string; timestamp: number } | null>(null); // Track last error toast to prevent duplicates
  const lastNetworkErrorLogRef = useRef<number>(0); // Track last network error log time to suppress repeated warnings
  
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

  // Load from Supabase FIRST when authenticated, localStorage only as offline fallback
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
      return;
    }

    // Authenticated - load from Supabase first
    // localStorage will be checked with userId in getFromLocalStorage calls
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
  // Removes duplicate tasks that have the same title, recurrence pattern, and scheduled date
  function deduplicateRecurringTasks(tasks: Task[]): Task[] {
    const seen = new Map<string, Task>();
    
    for (const task of tasks) {
      // Only check recurring tasks
      if (!task.recurrence || task.recurrence.type === 'none') {
        continue;
      }
      
      // Create a unique key for this recurring task occurrence
      // Format: title|type|interval|daysOfWeek|dayOfMonth|scheduledDate
      const daysOfWeekKey = task.recurrence.daysOfWeek 
        ? JSON.stringify([...task.recurrence.daysOfWeek].sort())
        : '';
      const dayOfMonthKey = task.recurrence.dayOfMonth || '';
      const key = `${task.title}|${task.recurrence.type}|${task.recurrence.interval}|${daysOfWeekKey}|${dayOfMonthKey}|${task.scheduledDate || ''}`;
      
      // If we've seen this key before, keep the one with the most recent updatedAt
      if (seen.has(key)) {
        const existing = seen.get(key)!;
        const existingDate = new Date(existing.updatedAt);
        const currentDate = new Date(task.updatedAt);
        
        // Keep the most recently updated one, or if same, keep the one that's not done
        if (currentDate > existingDate || (currentDate.getTime() === existingDate.getTime() && task.status !== 'done' && existing.status === 'done')) {
          seen.set(key, task);
        }
      } else {
        seen.set(key, task);
      }
    }
    
    // Return deduplicated tasks
    const deduplicated = new Set(seen.values());
    const duplicatesRemoved = tasks.length - deduplicated.size;
    
    if (duplicatesRemoved > 0) {
      logger.warn(`Removed ${duplicatesRemoved} duplicate recurring task occurrence(s)`);
    }
    
    // Return all tasks, but replace duplicates with the deduplicated versions
    const deduplicatedMap = new Map(seen.values().map(t => [t.id, t]));
    return tasks.map(task => {
      // If this task is a recurring task, check if we have a deduplicated version
      if (task.recurrence && task.recurrence.type !== 'none') {
        const daysOfWeekKey = task.recurrence.daysOfWeek 
          ? JSON.stringify([...task.recurrence.daysOfWeek].sort())
          : '';
        const dayOfMonthKey = task.recurrence.dayOfMonth || '';
        const key = `${task.title}|${task.recurrence.type}|${task.recurrence.interval}|${daysOfWeekKey}|${dayOfMonthKey}|${task.scheduledDate || ''}`;
        const deduplicatedTask = seen.get(key);
        
        // If this task is not the one we're keeping, return null to filter it out
        if (deduplicatedTask && deduplicatedTask.id !== task.id) {
          return null;
        }
      }
      return task;
    }).filter((task): task is Task => task !== null);
  }

  // Load tasks from Supabase (source of truth)
  async function loadTasksFromServer(wsId: string): Promise<Task[]> {
    // Validate workspace ID
    if (!wsId || typeof wsId !== 'string' || wsId.trim() === '') {
      logger.warn('Invalid workspace ID for loadTasksFromServer:', wsId);
      const savedTasks = getFromLocalStorage<Task[]>('tasks', [], user?.id);
      if (savedTasks.length > 0) {
        setTasks(savedTasks);
        return savedTasks;
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
          setTasks(savedTasks);
          return savedTasks;
        }
        
        // For other errors, fall back to localStorage if available
        const savedTasks = getFromLocalStorage<Task[]>('tasks', []);
        if (savedTasks.length > 0) {
          logger.warn(`Using ${savedTasks.length} tasks from localStorage as fallback`);
          setTasks(savedTasks);
          toast.error('Failed to load tasks from server, using offline data', {
            description: error.message || 'Please check your internet connection',
          });
          return savedTasks;
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
        
        // Server has data - use it as source of truth
        logger.info(`Loaded ${serverTasks.length} tasks from server${deduplicatedTasks.length !== serverTasks.length ? ` (deduplicated to ${deduplicatedTasks.length})` : ''}`);
        setTasks(deduplicatedTasks);
        // Always update localStorage with deduplicated server data (overwrite any stale local data)
        saveToLocalStorage('tasks', deduplicatedTasks, user?.id);
        setLastSync(new Date());
        
        // Store sync timestamp and ETag for next delta sync
        const syncTimestamp = new Date().toISOString();
        const syncKey = `last_sync_timestamp_tasks_${wsId}`;
        localStorage.setItem(syncKey, syncTimestamp);
        lastSyncTimestampsRef.current.tasks = syncTimestamp;
        
        // Clear any sync flags to ensure fresh sync on next load
        const syncFlagKey = `synced_local_data_${wsId}`;
        localStorage.removeItem(syncFlagKey);
        return deduplicatedTasks;
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
            // Deduplicate recurring task occurrences
            const deduplicatedTasks = deduplicateRecurringTasks(refreshedResult.tasks);
            setTasks(deduplicatedTasks);
            saveToLocalStorage('tasks', deduplicatedTasks, user?.id);
            return deduplicatedTasks;
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
        setTasks(savedTasks);
        toast.error('Failed to load tasks from server, using offline data', {
          description: 'Please check your internet connection',
        });
        return savedTasks;
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

  const ERROR_TOAST_COOLDOWN = 5000; // Don't show same error within 5 seconds

  const syncWithServer = useCallback(
    async (wsId?: string, silent: boolean = false) => {
      const targetWorkspaceId = wsId || workspaceId;
      if (!targetWorkspaceId || !accessToken) return;

      // Check if browser is offline
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (!silent) {
          const now = Date.now();
          // Only log offline status once per minute to avoid spam
          if (now - lastNetworkErrorLogRef.current > 60000) {
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
            if (now - lastNetworkErrorLogRef.current > 30000) {
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

        // Server is source of truth - always use server data, overwrite localStorage
        logger.info(`Synced ${serverTasks.length} tasks from server`);
        setTasks(serverTasks);
        saveToLocalStorage('tasks', serverTasks, user?.id);

        // Clear sync flags to ensure fresh sync
        const syncKey = `synced_local_data_${targetWorkspaceId}`;
        localStorage.removeItem(syncKey);

        if (!silent && serverTasks.length > 0) {
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
    [workspaceId, accessToken, user?.id]
  );

  // Activity tracking for adaptive polling
  useEffect(() => {
    if (!autoSyncEnabled || !workspaceId || !accessToken) return;

    // Throttle activity handler to reduce performance impact
    let activityThrottleTimeout: NodeJS.Timeout | null = null;
    const THROTTLE_MS = TIMING_CONSTANTS.delays.throttle; // Only process activity once per second

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      
      // Throttle state updates to prevent excessive re-renders
      if (activityThrottleTimeout) return;
      
      activityThrottleTimeout = setTimeout(() => {
        activityThrottleTimeout = null;
        if (!isActiveRef.current) {
          isActiveRef.current = true;
          // Switch to active interval (30 seconds)
          setSyncInterval(WORKSPACE_SYNC_INTERVAL_ACTIVE_MS);
          logger.debug('User activity detected, switching to active sync interval (30 sec)');
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
        // Switch to idle interval (2 minutes)
        setSyncInterval(WORKSPACE_SYNC_INTERVAL_IDLE_MS);
        logger.debug('User inactive, switching to idle sync interval (2 min)');
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
  }, [autoSyncEnabled, workspaceId, accessToken]);

  // Auto-sync: Poll server for changes at adaptive intervals
  useEffect(() => {
    if (!autoSyncEnabled || !workspaceId || !accessToken) return;

    // Only sync tasks on auto-sync (most frequently changing data)
    // Projects, folders, and settings change less frequently
    const syncTimer = setInterval(async () => {
      try {
        // Only sync tasks on regular interval (most frequently changing)
        await syncWithServer(workspaceId, true); // Silent sync
        
        // Sync folders more frequently (every interval) for better cross-device sync
        // Projects and settings change less frequently, so sync them every 2-3 intervals
        const syncCount = Math.floor(Date.now() / syncInterval);
        const shouldSyncOtherResources = syncCount % (isActiveRef.current ? 2 : 3) === 0;
        
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
    }, syncInterval);

    return () => clearInterval(syncTimer);
  }, [autoSyncEnabled, workspaceId, accessToken, syncInterval, syncWithServer]);

  // Debounce helper to prevent multiple rapid syncs
  const lastEventSyncRef = useRef<number>(0);
  const DEBOUNCE_INTERVAL = 2000; // Only sync once per 2 seconds from events - reduced for better cross-device sync
  const lastFullSyncRef = useRef<number>(0);
  const FULL_SYNC_INTERVAL = 30000; // Full sync (all resources) every 30 seconds - reduced for better cross-device sync

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
      await syncWithServer(workspaceId, true);
      
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
  }, [workspaceId, accessToken, syncWithServer]);

  // Sync when page becomes visible (user switches back to tab/device) - debounced with full sync
  useEffect(() => {
    if (!autoSyncEnabled || !workspaceId || !accessToken) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Do full sync when user returns to app
        debouncedSync(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [autoSyncEnabled, workspaceId, accessToken, debouncedSync]);

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

  // Sync on window focus (user switches back to window) - debounced
  useEffect(() => {
    if (!autoSyncEnabled || !workspaceId || !accessToken) return;

    const handleFocus = () => {
      // Only sync tasks on focus (not full sync)
      debouncedSync(false);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [autoSyncEnabled, workspaceId, accessToken, debouncedSync]);

  const addTask = useCallback(async (taskData: Partial<Task>) => {
    updateActivity(); // Track demo user activity
    
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
    
    const newTask: Task = {
      id: generateId(),
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
      recurrence: taskData.recurrence || { type: 'none', interval: 1 },
      notes: taskData.notes || '',
    };

    // Save to Supabase FIRST (source of truth)
    if (currentWorkspaceId && accessToken) {
      try {
        // Ensure workspace exists before saving task
        let validWorkspaceId = currentWorkspaceId;
        try {
          const ensuredWorkspaceId = await ensureWorkspace();
          if (ensuredWorkspaceId) {
            validWorkspaceId = ensuredWorkspaceId;
            if (validWorkspaceId !== currentWorkspaceId) {
              // Workspace ID was corrected, update state
              setWorkspaceId(validWorkspaceId);
            }
          } else {
            // Workspace couldn't be created, save locally
            throw new Error('Workspace not available');
          }
        } catch (ensureError) {
          const ensureErrorMessage = ensureError instanceof Error ? ensureError.message : String(ensureError);
          // If it's just a "not found" error, try to create workspace
          if (ensureErrorMessage.includes('not found') || ensureErrorMessage.includes('404')) {
            logger.debug('Workspace not found, attempting to create...');
            // Try creating workspace
            await createWorkspaceIfNeeded();
            const { workspaces } = await api.getUserWorkspaces();
            if (workspaces && workspaces.length > 0 && workspaces[0].id) {
              validWorkspaceId = workspaces[0].id;
              setWorkspaceId(validWorkspaceId);
            } else {
              throw new Error('Could not create workspace');
            }
          } else {
            throw ensureError;
          }
        }
        
        await api.saveTask(validWorkspaceId, newTask);
        // Reload from server to get the authoritative version
        await loadTasksFromServer(validWorkspaceId);
        // Trigger immediate sync to notify other devices (debounced)
        debouncedSync(false);
        toast.success('Task created');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to save task to server:', error);
        
        // If workspace not found, try to ensure it exists and retry
        if (errorMessage.includes('Workspace not found') || errorMessage.includes('Workspace or endpoint not found')) {
          try {
            logger.debug('Workspace not found when saving task, ensuring workspace exists...');
            // Explicitly create workspace
            await createWorkspaceIfNeeded();
            // Wait a bit for workspace to be fully created
            await new Promise(resolve => setTimeout(resolve, TIMING_CONSTANTS.delays.taskContext));
            const validWorkspaceId = await ensureWorkspace();
            if (validWorkspaceId) {
              logger.info('Workspace created, retrying task save with workspace ID:', validWorkspaceId);
              // Retry saving with valid workspace ID
              await api.saveTask(validWorkspaceId, newTask);
              await loadTasksFromServer(validWorkspaceId);
              // Trigger immediate sync to notify other devices (debounced)
              debouncedSync(false);
              toast.success('Task created');
              return;
            } else {
              logger.error('Workspace creation failed - no workspace ID returned');
            }
          } catch (retryError) {
            logger.error('Failed to ensure workspace on retry:', retryError);
          }
        }
        
        // Fallback: save locally and cache
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
      toast.success('Task created (offline)');
    }
  }, [user, workspaceId, accessToken, updateActivity]);

  // Helper function to calculate next occurrence date for recurring tasks
  // This calculates the next occurrence AFTER the current scheduledDate
  const calculateNextOccurrence = useCallback((task: Task, fromDate?: Date): Date | null => {
    if (!task.recurrence || task.recurrence.type === 'none') return null;
    
    // Use provided fromDate (completion date) or fall back to scheduledDate
    // When a task is marked complete, we calculate from TODAY, not the original scheduled date
    const baseDate = fromDate ? new Date(fromDate) : (task.scheduledDate ? new Date(task.scheduledDate) : null);
    if (!baseDate || isNaN(baseDate.getTime())) {
      console.error('calculateNextOccurrence: Invalid base date', fromDate || task.scheduledDate);
      return null;
    }

    // Validate recurrence interval
    if (typeof task.recurrence.interval !== 'number' || task.recurrence.interval < 1) {
      console.error('calculateNextOccurrence: Invalid recurrence interval', task.recurrence.interval);
      return null;
    }

    const nextDate = new Date(baseDate);
    nextDate.setHours(0, 0, 0, 0); // Normalize to start of day

    switch (task.recurrence.type) {
      case 'daily':
        // Add interval days
        nextDate.setDate(nextDate.getDate() + task.recurrence.interval);
        break;
      
      case 'weekly':
        if (task.recurrence.daysOfWeek && Array.isArray(task.recurrence.daysOfWeek) && task.recurrence.daysOfWeek.length > 0) {
          // Validate days of week
          const validDays = task.recurrence.daysOfWeek.filter(day => 
            typeof day === 'number' && 
            day >= TIMING_CONSTANTS.calendar.minDayOfWeek && 
            day <= TIMING_CONSTANTS.calendar.maxDayOfWeek
          );
          if (validDays.length === 0) {
            // Fallback: add interval weeks
            nextDate.setDate(nextDate.getDate() + (TIMING_CONSTANTS.calendar.daysPerWeek * task.recurrence.interval));
            break;
          }

          const currentDay = nextDate.getDay();
          const sortedDays = [...validDays].sort((a, b) => a - b);
          
          // Find next day in current week (after today)
          const nextDayInWeek = sortedDays.find(day => day > currentDay);
          if (nextDayInWeek !== undefined) {
            // Next occurrence is in the same week
            nextDate.setDate(nextDate.getDate() + (nextDayInWeek - currentDay));
          } else {
            // Next occurrence is in the following interval week
            // Calculate days until the first valid day in the next interval week
            const daysUntilNextWeek = TIMING_CONSTANTS.calendar.daysPerWeek - currentDay;
            const daysToFirstDay = sortedDays[0];
            // Add (interval - 1) full weeks after the first week
            const daysToAdd = daysUntilNextWeek + daysToFirstDay + (TIMING_CONSTANTS.calendar.daysPerWeek * (task.recurrence.interval - 1));
            nextDate.setDate(nextDate.getDate() + daysToAdd);
          }
        } else {
          // Fallback: add interval weeks (same day of week)
          // If calculating from today, ensure we move to the next interval week
          nextDate.setDate(nextDate.getDate() + (TIMING_CONSTANTS.calendar.daysPerWeek * task.recurrence.interval));
        }
        break;
      
      case 'monthly':
        if (task.recurrence.dayOfMonth && 
            typeof task.recurrence.dayOfMonth === 'number' && 
            task.recurrence.dayOfMonth >= TIMING_CONSTANTS.calendar.minDayOfMonth && 
            task.recurrence.dayOfMonth <= TIMING_CONSTANTS.calendar.maxDayOfMonth) {
          // Add interval months from the base date
          nextDate.setMonth(nextDate.getMonth() + task.recurrence.interval);
          // Set to the specified day of month, adjusting if needed (e.g., Jan 31 -> Feb 28)
          const maxDayInMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
          const dayOfMonth = Math.min(task.recurrence.dayOfMonth, maxDayInMonth);
          nextDate.setDate(dayOfMonth);
        } else {
          // Fallback: add interval months (same day of month)
          // If the day doesn't exist in the target month (e.g., Jan 31 -> Feb), adjust to last day
          const originalDay = nextDate.getDate();
          nextDate.setMonth(nextDate.getMonth() + task.recurrence.interval);
          const maxDayInMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
          if (originalDay > maxDayInMonth) {
            nextDate.setDate(maxDayInMonth);
          }
        }
        break;
      
      default:
        console.error('calculateNextOccurrence: Unknown recurrence type', task.recurrence.type);
        return null;
    }

    // Check if end date is set and if we've passed it
    if (task.recurrence.endDate) {
      try {
        const endDate = new Date(task.recurrence.endDate);
        if (!isNaN(endDate.getTime()) && nextDate > endDate) {
          return null; // Recurrence has ended
        }
      } catch (error) {
        console.error('calculateNextOccurrence: Error parsing endDate', error);
        // Continue - treat as no end date if invalid
      }
    }

    return nextDate;
  }, []);

  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    updateActivity(); // Track demo user activity
    
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
    
    // Find the task to update
    const currentTask = tasks.find(t => t.id === taskId);
    if (!currentTask) {
      toast.error('Task not found');
      return;
    }
    
    const updatedTask = { ...currentTask, ...updates, updatedAt: new Date().toISOString() };
    let nextOccurrenceTask: Task | null = null;
    
    // Check if task is being marked as complete (status changing to 'done')
    const isBeingMarkedComplete = (updates.status === 'done' && currentTask.status !== 'done') ||
                                  (updates.status === undefined && updates.completedAt !== undefined && currentTask.status !== 'done');
    const isBeingUnmarkedComplete = (updates.status !== 'done' && currentTask.status === 'done') ||
                                    (updates.status === undefined && updates.completedAt === null && currentTask.status === 'done');
    
    // Automatically handle completedAt when status changes (unless explicitly provided)
    if (updates.status !== undefined && updates.completedAt === undefined) {
      if (isBeingMarkedComplete) {
        // Task is being marked as complete - set completedAt if not already provided
        updatedTask.completedAt = new Date().toISOString();
      } else if (isBeingUnmarkedComplete) {
        // Task is being unmarked from complete
        updatedTask.completedAt = null;
      }
    } else if (updates.completedAt !== undefined && updates.status === undefined) {
      // completedAt was explicitly set, update status accordingly
      if (updates.completedAt !== null && currentTask.status !== 'done') {
        updatedTask.status = 'done';
      } else if (updates.completedAt === null && currentTask.status === 'done') {
        updatedTask.status = 'todo';
      }
    }
    
    // Generate next occurrence for recurring tasks when marked complete
    // This happens regardless of how the task was marked complete (via status or completedAt)
    // IMPORTANT: Only create next occurrence if the task is actually being marked complete (not already done)
    if (isBeingMarkedComplete && currentTask.recurrence && currentTask.recurrence.type !== 'none' && currentTask.status !== 'done') {
      // Prevent concurrent next occurrence creation for the same task
      // This handles race conditions when user clicks complete multiple times rapidly
      if (nextOccurrenceCreationLock.current.has(taskId)) {
        logger.debug('Next occurrence creation already in progress for this task, skipping duplicate', {
          taskId,
          taskTitle: currentTask.title
        });
      } else {
        // Acquire lock
        nextOccurrenceCreationLock.current.add(taskId);
        
        try {
          // Calculate next occurrence from TODAY (completion date), not from original scheduled date
          // This ensures the next task appears on the correct future date
          const completionDate = new Date(); // Today - when the task is being marked complete
          const nextOccurrence = calculateNextOccurrence(currentTask, completionDate);
          
          if (nextOccurrence) {
            const nextOccurrenceDateStr = nextOccurrence.toISOString();
            
            // Check if a next occurrence already exists to prevent duplicates
            // Look for a task with matching recurrence pattern, title, and the next scheduled date
            // Use a more comprehensive check that includes checking all tasks, not just current state
            const existingNextOccurrence = tasks.find(t => {
              // Must be a different task
              if (t.id === taskId) return false;
              
              // Must have the same title (same task series)
              if (t.title !== currentTask.title) return false;
              
              // Must have the same recurrence pattern
              if (!t.recurrence || t.recurrence.type !== currentTask.recurrence.type) return false;
              if (t.recurrence.interval !== currentTask.recurrence.interval) return false;
              
              // For weekly tasks, also check daysOfWeek (sort arrays for comparison)
              if (currentTask.recurrence.type === 'weekly') {
                const currentDays = (currentTask.recurrence.daysOfWeek || []).sort();
                const taskDays = (t.recurrence.daysOfWeek || []).sort();
                if (JSON.stringify(currentDays) !== JSON.stringify(taskDays)) {
                  return false;
                }
              }
              
              // For monthly tasks, also check dayOfMonth
              if (currentTask.recurrence.type === 'monthly' && 
                  t.recurrence.dayOfMonth !== currentTask.recurrence.dayOfMonth) {
                return false;
              }
              
              // Must have the same scheduled date as the next occurrence
              if (t.scheduledDate !== nextOccurrenceDateStr) return false;
              
              // Must be active (not completed) - this is the next occurrence we're looking for
              if (t.status === 'done') return false;
              
              return true;
            });

            // Only create next occurrence if it doesn't already exist
            if (!existingNextOccurrence) {
              // Create new task instance for the next occurrence
              // The current task stays done on its scheduled date, new instance continues the series
              nextOccurrenceTask = {
                ...currentTask,
                id: generateId(),
                status: 'todo',
                scheduledDate: nextOccurrence.toISOString(),
                completedAt: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
            } else {
              // Next occurrence already exists - log for debugging but don't create duplicate
              logger.debug('Next occurrence already exists, skipping creation to prevent duplicate', {
                currentTaskId: currentTask.id,
                currentScheduledDate: currentTask.scheduledDate,
                nextOccurrenceDate: nextOccurrenceDateStr,
                existingTaskId: existingNextOccurrence.id,
                existingTaskScheduledDate: existingNextOccurrence.scheduledDate
              });
            }
          }
        } finally {
          // Release lock after a short delay to ensure server save completes
          // This prevents race conditions from rapid clicks
          setTimeout(() => {
            nextOccurrenceCreationLock.current.delete(taskId);
          }, TIMING_CONSTANTS.recurrence.nextOccurrenceLockTimeout); // Lock timeout to prevent rapid duplicate creation
        }
      }
    }

    // Save to Supabase FIRST (source of truth)
    if (workspaceId && accessToken) {
      try {
        // Ensure workspace exists before saving task
        let validWorkspaceId = workspaceId;
        try {
          const ensuredWorkspaceId = await ensureWorkspace();
          if (ensuredWorkspaceId) {
            validWorkspaceId = ensuredWorkspaceId;
            if (validWorkspaceId !== workspaceId) {
              // Workspace ID was corrected, update state
              setWorkspaceId(validWorkspaceId);
            }
          } else {
            // Workspace couldn't be created, save locally
            throw new Error('Workspace not available');
          }
        } catch (ensureError) {
          const ensureErrorMessage = ensureError instanceof Error ? ensureError.message : String(ensureError);
          // If it's just a "not found" error, try to create workspace
          if (ensureErrorMessage.includes('not found') || ensureErrorMessage.includes('404')) {
            logger.debug('Workspace not found, attempting to create...');
            // Try creating workspace
            await createWorkspaceIfNeeded();
            const { workspaces } = await api.getUserWorkspaces();
            if (workspaces && workspaces.length > 0 && workspaces[0].id) {
              validWorkspaceId = workspaces[0].id;
              setWorkspaceId(validWorkspaceId);
            } else {
              throw new Error('Could not create workspace');
            }
          } else {
            throw ensureError;
          }
        }
        
        await api.saveTask(validWorkspaceId, updatedTask);
        
        // Save next occurrence task to server if created
        if (nextOccurrenceTask) {
          await api.saveTask(validWorkspaceId, nextOccurrenceTask);
        }
        
        // Reload from server to get the authoritative version
        await loadTasksFromServer(validWorkspaceId);
        // Trigger immediate sync to notify other devices (with minimal debounce for cross-device sync)
        debouncedSync(false);
        // Also trigger a direct sync after a short delay to ensure other devices get updates quickly
        setTimeout(() => {
          if (workspaceId && accessToken) {
            syncWithServer(workspaceId, false).catch(err => {
              logger.debug('Background sync after task update:', err);
            });
          }
        }, 1000);
        
        if (nextOccurrenceTask) {
          toast.success('Next occurrence created', {
            description: `Task "${nextOccurrenceTask.title}" scheduled for ${new Date(nextOccurrenceTask.scheduledDate!).toLocaleDateString()}`,
          });
        }
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
              await api.saveTask(validWorkspaceId, updatedTask);
              if (nextOccurrenceTask) {
                await api.saveTask(validWorkspaceId, nextOccurrenceTask);
              }
              await loadTasksFromServer(validWorkspaceId);
              // Trigger immediate sync to notify other devices (with minimal debounce for cross-device sync)
              debouncedSync(false);
              // Also trigger a direct sync after a short delay to ensure other devices get updates quickly
              setTimeout(() => {
                if (workspaceId && accessToken) {
                  syncWithServer(workspaceId, false).catch(err => {
                    logger.debug('Background sync after task update retry:', err);
                  });
                }
              }, 1000);
              if (nextOccurrenceTask) {
                toast.success('Next occurrence created', {
                  description: `Task "${nextOccurrenceTask.title}" scheduled for ${new Date(nextOccurrenceTask.scheduledDate!).toLocaleDateString()}`,
                });
              }
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
          const updated = prev.map(task => {
            if (task.id === taskId) {
              return updatedTask;
            }
            return task;
          });
          
          if (nextOccurrenceTask) {
            updated.push(nextOccurrenceTask);
          }
          
          saveToLocalStorage('tasks', updated);
          return updated;
        });
        toast.error('Task updated offline, will sync when online');
      }
    } else {
      // No workspace/auth - update locally only
      setTasks(prev => {
        const updated = prev.map(task => {
          if (task.id === taskId) {
            return updatedTask;
          }
          return task;
        });
        
        if (nextOccurrenceTask) {
          updated.push(nextOccurrenceTask);
        }
        
        saveToLocalStorage('tasks', updated);
        return updated;
      });
    }
  }, [tasks, workspaceId, accessToken, updateActivity, calculateNextOccurrence]);

  const deleteTask = useCallback(async (taskId: string) => {
    updateActivity(); // Track demo user activity
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
        }, 1000); // 1 second delay to allow server to process
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
        }, 1000); // 1 second delay to allow server to process
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
      }, 1000); // 1 second delay to allow server to process
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
    if (!rolloverSettings.autoRollover || !user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayString = today.toISOString().split('T')[0];

    // Check if we've already run rollover today (check both localStorage and ref)
    const lastCheck = getFromLocalStorage<string>('lastRolloverCheck', '');
    const hasCheckedToday = lastCheck === todayString || rolloverCheckedRef.current === todayString;
    
    if (hasCheckedToday) {
      return; // Already checked today, don't run again
    }

    const checkAndRolloverTasks = () => {
      // Find incomplete tasks scheduled for yesterday or earlier
      const tasksToRollover = tasks.filter(task => {
        if (task.status === 'done' || !task.scheduledDate) return false;
        
        const taskDate = new Date(task.scheduledDate);
        taskDate.setHours(0, 0, 0, 0);
        const taskDateString = taskDate.toISOString().split('T')[0];
        
        // Task is from a previous day
        return taskDateString < todayString;
      });

      if (tasksToRollover.length > 0) {
        // Mark that we've checked today IMMEDIATELY to prevent duplicate notifications
        rolloverCheckedRef.current = todayString;
        saveToLocalStorage('lastRolloverCheck', todayString);

        if (rolloverSettings.askBeforeRolling) {
          // Show confirmation dialog
          const taskTitles = tasksToRollover.slice(0, 3).map(t => t.title).join(', ');
          const more = tasksToRollover.length > 3 ? ` and ${tasksToRollover.length - 3} more` : '';
          
          toast('🔄 Task Rollover', {
            description: `Roll over ${tasksToRollover.length} incomplete task(s) to today? (${taskTitles}${more})`,
            action: {
              label: 'Roll Over',
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
      let rolledCount = 0;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
      const now = new Date();
      
      // Sort tasks by priority and scheduled time to maintain chronological order
      const sortedTasksToRollover = [...tasksToRollover].sort((a, b) => {
        // First by priority
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority] || 1;
        const bPriority = priorityOrder[b.priority] || 1;
        if (aPriority !== bPriority) return bPriority - aPriority;
        
        // Then by original scheduled time (if available)
        if (a.scheduledDate && b.scheduledDate) {
          return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
        }
        if (a.scheduledDate) return -1;
        if (b.scheduledDate) return 1;
        
        return 0;
      });
      
      // Track scheduled tasks to maintain chronological order and prevent overlaps
      // This array is updated as we schedule tasks to ensure findNextAvailableSlot
      // knows about previously scheduled rollover tasks
      const scheduledRolloverTasks: Task[] = [];
      let lastScheduledEnd: number | null = null; // Track the end time of the last scheduled task
      
      for (const task of sortedTasksToRollover) {
        try {
          // Get category hours for this task
          const categoryHours = getCategoryHoursForTask(task, today, hoursSettings);
          
          // Determine start time based on category hours or current time
          let startTime: Date;
          if (categoryHours) {
            // Start from category hours start time, but not before current time
            const categoryStartMinutes = categoryHours.start;
            const categoryStartHours = Math.floor(categoryStartMinutes / 60);
            const categoryStartMins = categoryStartMinutes % 60;
            
            startTime = new Date(today);
            startTime.setHours(categoryStartHours, categoryStartMins, 0, 0);
            
            // If category start is before current time, use current time (rounded up)
            if (startTime.getTime() < now.getTime()) {
              const currentMinutes = now.getMinutes();
              const roundedMinutes = Math.ceil(currentMinutes / 15) * 15;
              startTime = new Date(now);
              if (roundedMinutes >= 60) {
                startTime.setHours(startTime.getHours() + 1);
                startTime.setMinutes(0);
              } else {
                startTime.setMinutes(roundedMinutes);
              }
              startTime.setSeconds(0);
              startTime.setMilliseconds(0);
              
              // Ensure we're still within category hours
              const currentTotalMinutes = startTime.getHours() * 60 + startTime.getMinutes();
              if (currentTotalMinutes < categoryHours.start) {
                startTime.setHours(Math.floor(categoryHours.start / 60), categoryHours.start % 60, 0, 0);
              }
            }
          } else {
            // No category hours - start from current time (rounded up) or 9:00 AM, whichever is later
            const currentMinutes = now.getMinutes();
            const roundedMinutes = Math.ceil(currentMinutes / 15) * 15;
            startTime = new Date(now);
            if (roundedMinutes >= 60) {
              startTime.setHours(startTime.getHours() + 1);
              startTime.setMinutes(0);
            } else {
              startTime.setMinutes(roundedMinutes);
            }
            startTime.setSeconds(0);
            startTime.setMilliseconds(0);
            
            // Ensure not before 9:00 AM
            const nineAM = new Date(today);
            nineAM.setHours(9, 0, 0, 0);
            if (startTime.getTime() < nineAM.getTime()) {
              startTime = nineAM;
            }
          }
          
          // If we have a previously scheduled task, start from its end time to maintain chronological order
          if (lastScheduledEnd !== null) {
            const lastEndDate = new Date(lastScheduledEnd);
            // Round to nearest 15-minute slot
            const minutes = lastEndDate.getMinutes();
            const roundedMinutes = Math.ceil(minutes / 15) * 15;
            if (roundedMinutes >= 60) {
              lastEndDate.setHours(lastEndDate.getHours() + 1);
              lastEndDate.setMinutes(0);
            } else {
              lastEndDate.setMinutes(roundedMinutes);
            }
            lastEndDate.setSeconds(0);
            lastEndDate.setMilliseconds(0);
            
            // Use the later of: last scheduled end or calculated start time
            // This ensures chronological order while respecting category hours
            if (lastEndDate.getTime() > startTime.getTime()) {
              startTime = lastEndDate;
            }
          }
          
          // Get task duration
          const taskDuration = getTaskMinutes(task); // Use AI estimator
          
          // Combine existing tasks with previously scheduled rollover tasks
          // This ensures findNextAvailableSlot knows about all scheduled tasks
          const allTasksIncludingRollover = [...tasks, ...scheduledRolloverTasks];
          
          // Find next available slot on today, respecting category hours
          const availableSlot = findNextAvailableSlot(
            task.id,
            startTime,
            taskDuration,
            allTasksIncludingRollover,
            {
              ensureAfterCurrentTime: true,
              categoryHours: categoryHours,
            }
          );
          
          // Ensure the slot is on today (not tomorrow) and within valid hours
          if (availableSlot.getDate() === today.getDate() && 
              availableSlot.getMonth() === today.getMonth() && 
              availableSlot.getFullYear() === today.getFullYear() &&
              availableSlot.getHours() < 24) {
            // Use the available slot time
            await updateTask(task.id, { scheduledDate: availableSlot.toISOString() });
            
            // Track this scheduled task for subsequent iterations
            const scheduledTask: Task = {
              ...task,
              scheduledDate: availableSlot.toISOString(),
            };
            scheduledRolloverTasks.push(scheduledTask);
            
            // Update last scheduled end time for chronological ordering
            const taskEndTime = availableSlot.getTime() + (taskDuration * 60 * 1000);
            lastScheduledEnd = taskEndTime;
            
            rolledCount++;
          } else {
            // No valid slot found - skip this task
            logger.warn('No available slot found for rollover task:', task.id);
          }
        } catch (error) {
          logger.error('Failed to rollover task:', task.id, error);
        }
      }
      
      if (rolledCount > 0) {
        toast.success(`✅ Rolled over ${rolledCount} task(s) to today`);
      }
      
      // Ensure we're marked as checked (should already be set, but double-check)
      rolloverCheckedRef.current = todayString;
      saveToLocalStorage('lastRolloverCheck', todayString);
    };

    // Run rollover check after a short delay (to allow UI to load)
    const timer = setTimeout(() => {
      checkAndRolloverTasks();
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [rolloverSettings.autoRollover, rolloverSettings.askBeforeRolling, user?.id, updateTask]);

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
      }}
    >
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (context === undefined) {
    // During React Fast Refresh (HMR), providers can temporarily unmount
    // Return a safe default instead of throwing to prevent crashes
    if (import.meta.env.DEV) {
      console.warn('useTasks called outside TaskProvider (likely HMR issue), returning default');
      return {
        tasks: [],
        projects: [],
        folders: [],
        availableTags: [],
        filters: {},
        viewConfig: { groupBy: 'none', sortBy: 'dueDate', sortOrder: 'asc', showCompleted: true },
        hoursSettings: {
          weekdayHours: { work: { start: '09:00', end: '17:00', enabled: true }, personal: { start: '08:00', end: '22:00', enabled: true }, projects: { start: '09:00', end: '17:00', enabled: true } },
          weekendHours: { work: { start: '09:00', end: '17:00', enabled: false }, personal: { start: '08:00', end: '22:00', enabled: true }, projects: { start: '09:00', end: '17:00', enabled: false } },
        },
        rolloverSettings: { enabled: false, maxHours: 5 },
        workspaceId: null,
        isSyncing: false,
        lastSync: null,
        addTask: async () => {},
        updateTask: async () => {},
        deleteTask: async () => {},
        addProject: async () => {},
        updateProject: async () => {},
        addFolder: async () => {},
        updateFolder: async () => {},
        deleteFolder: async () => {},
        addAvailableTag: async () => {},
        removeAvailableTag: async () => {},
        setFilters: () => {},
        setViewConfig: () => {},
        updateHoursSettings: async () => {},
        updateRolloverSettings: async () => {},
        syncWithServer: async () => {},
        ensureWorkspace: async () => null,
      };
    }
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
}
