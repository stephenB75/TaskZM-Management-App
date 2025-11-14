import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { useDemoActivity } from '../hooks/useDemoActivity';
import * as api from '../lib/api';
import { generateId, getFromLocalStorage, saveToLocalStorage } from '../lib/utils';
import { generateSampleTasks, generateSampleProjects } from '../lib/sampleData';
import { logger } from '../lib/logger';
import type { Task, Project, Folder, TaskFilters, ViewConfig, HoursSettings, RolloverSettings } from '../types';

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

const DEFAULT_PROJECT_ID = 'default';
const DEFAULT_TAGS = ['Work', 'Personal', 'Projects', 'Business'];
// Protected tags that cannot be deleted
const PROTECTED_TAGS = ['Work', 'Personal', 'Projects', 'Business'];

export function TaskProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  const { updateActivity } = useDemoActivity(); // Track demo user activity
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([
    {
      id: DEFAULT_PROJECT_ID,
      name: 'Personal',
      color: '#3b82f6',
      description: 'Personal tasks',
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
      work: { start: '09:00', end: '17:00', enabled: true },
      personal: { start: '18:00', end: '22:00', enabled: true },
      projects: { start: '19:00', end: '23:00', enabled: true },
    },
    weekendHours: {
      work: { start: '10:00', end: '14:00', enabled: false },
      personal: { start: '09:00', end: '23:00', enabled: true },
      projects: { start: '14:00', end: '18:00', enabled: true },
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
  const [syncInterval, setSyncInterval] = useState(300000); // 5 minutes (reduced from 30s to minimize Edge Function invocations)
  const syncLockRef = useRef<boolean>(false); // Prevent concurrent sync operations

  // Load from Supabase FIRST when authenticated, localStorage only as offline fallback
  useEffect(() => {
    if (!user || !accessToken) {
      // Not authenticated - use localStorage as fallback only
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
      const localTasks = getFromLocalStorage<Task[]>('tasks', []);
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
    const maxRetries = 3;
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
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        }
        await createWorkspaceIfNeeded();
        // If creation succeeded, retry loading
        continue;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.error(`Failed to load workspace (attempt ${attempt}/${maxRetries}):`, lastError);
        
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
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
      duration: 5000,
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
      const workspaceName = `${user.name || 'User'}'s Workspace`;
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
        duration: 5000,
      });
      throw error;
    }
  }, [user, accessToken]);

  // Load tasks from Supabase (source of truth)
  async function loadTasksFromServer(wsId: string): Promise<Task[]> {
    try {
      logger.debug(`Loading tasks from server for workspace: ${wsId}`);
      const serverTasks = await api.getTasks(wsId);
      
      if (serverTasks && serverTasks.length > 0) {
        // Server has data - use it as source of truth
        logger.info(`Loaded ${serverTasks.length} tasks from server`);
        setTasks(serverTasks);
        // Always update localStorage with server data (overwrite any stale local data)
        saveToLocalStorage('tasks', serverTasks);
        setLastSync(new Date());
        
        // Clear any sync flags to ensure fresh sync on next load
        const syncKey = `synced_local_data_${wsId}`;
        localStorage.removeItem(syncKey);
        return serverTasks;
      } else {
        // No server data - check localStorage as fallback
        logger.warn('No tasks found on server, checking localStorage');
        const savedTasks = getFromLocalStorage<Task[]>('tasks', []);
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
          const refreshedTasks = await api.getTasks(wsId);
          if (refreshedTasks && refreshedTasks.length > 0) {
            setTasks(refreshedTasks);
            saveToLocalStorage('tasks', refreshedTasks);
            return refreshedTasks;
          }
          return [];
        } else {
          logger.info('No tasks found in server or localStorage');
          setTasks([]);
          saveToLocalStorage('tasks', []);
          return [];
        }
      }
    } catch (error) {
      logger.error('Failed to load tasks from server:', error);
      // Fallback to localStorage only if server completely fails
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
        saveToLocalStorage('projects', serverProjects);
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
                    logger.error('Failed to ensure workspace exists:', ensureError);
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

  const syncWithServer = useCallback(async (wsId?: string, silent: boolean = false) => {
    const targetWorkspaceId = wsId || workspaceId;
    if (!targetWorkspaceId || !accessToken) return;

    // Prevent concurrent sync operations
    if (syncLockRef.current) {
      logger.debug('Sync already in progress, skipping...');
      return;
    }

    syncLockRef.current = true;
    setIsSyncing(true);
    try {
      logger.debug(`Force syncing with server for workspace: ${targetWorkspaceId}`);
      
      // Load from Supabase (source of truth)
      const serverTasks = await api.getTasks(targetWorkspaceId);
      
      // Server is source of truth - always use server data, overwrite localStorage
      logger.info(`Synced ${serverTasks.length} tasks from server`);
      setTasks(serverTasks);
      saveToLocalStorage('tasks', serverTasks);
      setLastSync(new Date());
      
      // Clear sync flags to ensure fresh sync
      const syncKey = `synced_local_data_${targetWorkspaceId}`;
      localStorage.removeItem(syncKey);
      localStorage.setItem(`last_server_sync_${targetWorkspaceId}`, String(Date.now()));
      
      if (!silent) {
        toast.success('Synced with server', {
          description: `Loaded ${serverTasks.length} task${serverTasks.length !== 1 ? 's' : ''}`,
        });
      }
    } catch (error) {
      logger.error('Sync error:', error);
      // On error, keep current state (might be offline)
      if (!silent) {
        toast.error('Failed to sync with server', {
          description: 'Please check your internet connection',
        });
      }
    } finally {
      setIsSyncing(false);
      syncLockRef.current = false;
    }
  }, [workspaceId, accessToken]);

  // Auto-sync: Poll server for changes at regular intervals
  useEffect(() => {
    if (!autoSyncEnabled || !workspaceId || !accessToken) return;

    const syncTimer = setInterval(async () => {
      try {
        await syncWithServer(workspaceId, true); // Silent sync
        await syncProjectsFromServer(workspaceId);
        await syncFoldersFromServer(workspaceId, true); // Merge mode to preserve pending folders
        await syncSettingsFromServer(workspaceId);
      } catch (error) {
        logger.error('Auto-sync error:', error);
      }
    }, syncInterval);

    return () => clearInterval(syncTimer);
  }, [autoSyncEnabled, workspaceId, accessToken, syncInterval, syncWithServer]);

  // Debounce helper to prevent multiple rapid syncs
  const lastEventSyncRef = useRef<number>(0);
  const DEBOUNCE_INTERVAL = 60000; // Only sync once per minute from events

  const debouncedSync = useCallback(async () => {
    if (!workspaceId || !accessToken) return;
    
    const now = Date.now();
    if (now - lastEventSyncRef.current < DEBOUNCE_INTERVAL) {
      return; // Skip if synced recently
    }
    lastEventSyncRef.current = now;
    
    try {
      await syncWithServer(workspaceId, true);
      await syncProjectsFromServer(workspaceId);
      await syncFoldersFromServer(workspaceId, true); // Added missing folder sync
      await syncSettingsFromServer(workspaceId);
    } catch (error) {
      logger.error('Debounced sync error:', error);
    }
  }, [workspaceId, accessToken, syncWithServer]);

  // Sync when page becomes visible (user switches back to tab/device) - debounced
  useEffect(() => {
    if (!autoSyncEnabled || !workspaceId || !accessToken) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        debouncedSync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [autoSyncEnabled, workspaceId, accessToken, debouncedSync]);

  // Sync when network comes back online - debounced
  useEffect(() => {
    if (!autoSyncEnabled || !workspaceId || !accessToken) return;

    const handleOnline = () => {
      debouncedSync();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [autoSyncEnabled, workspaceId, accessToken, debouncedSync]);

  // Sync on window focus (user switches back to window) - debounced
  useEffect(() => {
    if (!autoSyncEnabled || !workspaceId || !accessToken) return;

    const handleFocus = () => {
      debouncedSync();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [autoSyncEnabled, workspaceId, accessToken, debouncedSync]);

  const addTask = useCallback(async (taskData: Partial<Task>) => {
    updateActivity(); // Track demo user activity
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
    if (workspaceId && accessToken) {
      try {
        await api.saveTask(workspaceId, newTask);
        // Reload from server to get the authoritative version
        await loadTasksFromServer(workspaceId);
        toast.success('Task created');
      } catch (error) {
        logger.error('Failed to save task to server:', error);
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
  const calculateNextOccurrence = useCallback((task: Task): Date | null => {
    if (task.recurrence.type === 'none') return null;

    const now = new Date();
    const baseDate = task.scheduledDate ? new Date(task.scheduledDate) : now;
    const nextDate = new Date(baseDate);

    switch (task.recurrence.type) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + task.recurrence.interval);
        break;
      
      case 'weekly':
        if (task.recurrence.daysOfWeek && task.recurrence.daysOfWeek.length > 0) {
          // Find the next occurrence day
          let daysToAdd = 0;
          const currentDay = nextDate.getDay();
          
          // Sort days of week to find the next one
          const sortedDays = [...task.recurrence.daysOfWeek].sort((a, b) => a - b);
          
          // Find next day in current week
          const nextDayInWeek = sortedDays.find(day => day > currentDay);
          if (nextDayInWeek !== undefined) {
            daysToAdd = nextDayInWeek - currentDay;
          } else {
            // Next occurrence is in the following interval week
            daysToAdd = (7 * task.recurrence.interval) - currentDay + sortedDays[0];
          }
          
          nextDate.setDate(nextDate.getDate() + daysToAdd);
        } else {
          // Fallback: add interval weeks
          nextDate.setDate(nextDate.getDate() + (7 * task.recurrence.interval));
        }
        break;
      
      case 'monthly':
        if (task.recurrence.dayOfMonth) {
          nextDate.setMonth(nextDate.getMonth() + task.recurrence.interval);
          // Set to the specified day of month, adjusting if needed (e.g., Feb 31 -> Feb 28)
          const dayOfMonth = Math.min(task.recurrence.dayOfMonth, new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate());
          nextDate.setDate(dayOfMonth);
        } else {
          // Fallback: add interval months
          nextDate.setMonth(nextDate.getMonth() + task.recurrence.interval);
        }
        break;
    }

    // Check if end date is set and if we've passed it
    if (task.recurrence.endDate) {
      const endDate = new Date(task.recurrence.endDate);
      if (nextDate > endDate) {
        return null; // Recurrence has ended
      }
    }

    return nextDate;
  }, []);

  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    updateActivity(); // Track demo user activity
    // Find the task to update
    const currentTask = tasks.find(t => t.id === taskId);
    if (!currentTask) {
      toast.error('Task not found');
      return;
    }
    
    const updatedTask = { ...currentTask, ...updates, updatedAt: new Date().toISOString() };
    let nextOccurrenceTask: Task | null = null;
    
    // Automatically handle completedAt when status changes (unless explicitly provided)
    if (updates.status !== undefined && updates.completedAt === undefined) {
      if (updates.status === 'done' && currentTask.status !== 'done') {
        // Task is being marked as complete
        updatedTask.completedAt = new Date().toISOString();
        
        // Generate next occurrence for recurring tasks
        if (currentTask.recurrence.type !== 'none') {
          const nextOccurrence = calculateNextOccurrence(currentTask);
          if (nextOccurrence) {
            // Create new task instance for the next occurrence
            nextOccurrenceTask = {
              ...currentTask,
              id: generateId(),
              status: 'todo',
              scheduledDate: nextOccurrence.toISOString(),
              completedAt: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
          }
        }
      } else if (updates.status !== 'done' && currentTask.status === 'done') {
        // Task is being unmarked from complete
        updatedTask.completedAt = null;
      }
    }

    // Save to Supabase FIRST (source of truth)
    if (workspaceId && accessToken) {
      try {
        await api.saveTask(workspaceId, updatedTask);
        
        // Save next occurrence task to server if created
        if (nextOccurrenceTask) {
          await api.saveTask(workspaceId, nextOccurrenceTask);
        }
        
        // Reload from server to get the authoritative version
        await loadTasksFromServer(workspaceId);
        
        if (nextOccurrenceTask) {
          toast.success('Next occurrence created', {
            description: `Task "${nextOccurrenceTask.title}" scheduled for ${new Date(nextOccurrenceTask.scheduledDate!).toLocaleDateString()}`,
          });
        }
      } catch (error) {
        logger.error('Failed to update task on server:', error);
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
        duration: 4000,
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
    if (workspaceId && accessToken) {
      try {
        logger.debug('Saving folder to server:', newFolder.id);
        const savedFolder = await api.saveFolder(workspaceId, newFolder);
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
      } catch (error) {
        logger.error('Failed to save folder to server:', error);
        // Keep the optimistic update, but mark it for sync
        toast.error('Folder saved offline, will sync when online');
      }
    } else {
      // No workspace/auth - already saved locally above
      logger.warn('No workspace or access token, saving folder locally only');
      toast.success('Folder created (offline)');
    }
  }, [workspaceId, accessToken, availableTags, addAvailableTag]);

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

    if (!workspaceId || !accessToken) {
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

    // Optimistic update: update state immediately
    setFolders(prev => {
      const updated = prev.map(folder =>
        folder.id === folderId
          ? { ...folder, ...updates, updatedAt: new Date().toISOString(), pendingSync: true, synced: false }
          : folder
      );
      saveToLocalStorage('folders', updated);
      return updated;
    });

    // Update in Supabase (source of truth)
    try {
      const updatedFolder = await api.updateFolder(workspaceId, folderId, updates);
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
    } catch (error) {
      logger.error('Failed to update folder on server:', error);
      // Keep the optimistic update, but mark it for sync
      toast.error('Folder updated offline, will sync when online');
    }
  }, [workspaceId, accessToken, folders, tasks, availableTags, updateTask, addAvailableTag, removeAvailableTag]);

  const deleteFolder = useCallback(async (folderId: string) => {
    // Find the folder to get its name
    const folderToDelete = folders.find(f => f.id === folderId);
    if (!folderToDelete) {
      toast.error('Folder not found');
      return;
    }
    
    const folderName = folderToDelete.name;

    // Remove folder tag from all tasks that have it
    const tasksToUpdate = tasks.filter(task => 
      task.tags && task.tags.includes(folderName)
    );

    for (const task of tasksToUpdate) {
      const updatedTags = task.tags.filter(tag => tag !== folderName);
      try {
        await updateTask(task.id, { tags: updatedTags });
      } catch (error) {
        logger.error(`Failed to remove folder tag from task ${task.id}:`, error);
      }
    }

    // Remove folder name from available tags if it exists
    if (availableTags.includes(folderName)) {
      try {
        await removeAvailableTag(folderName);
      } catch (error) {
        logger.error('Failed to remove folder name tag:', error);
        // Continue with folder deletion even if tag removal fails
      }
    }

    // Optimistic update: remove from state immediately
    setFolders(prev => {
      const updated = prev.filter(folder => folder.id !== folderId);
      saveToLocalStorage('folders', updated);
      return updated;
    });

    // Delete from Supabase (source of truth)
    if (workspaceId && accessToken) {
      try {
        await api.deleteFolder(workspaceId, folderId);
        // Folder already removed from state optimistically above
        // Just ensure localStorage is in sync
        toast.success('Folder deleted');
      } catch (error) {
        logger.error('Failed to delete folder from server:', error);
        // Re-add folder to state since deletion failed
        setFolders(prev => {
          if (folderToDelete && !prev.find(f => f.id === folderId)) {
            const updated = [...prev, folderToDelete];
            saveToLocalStorage('folders', updated);
            return updated;
          }
          return prev;
        });
        toast.error('Folder deletion failed, will sync when online');
      }
    } else {
      // No workspace/auth - already deleted locally above
      toast.success('Folder deleted (offline)');
    }
  }, [workspaceId, accessToken, folders, tasks, availableTags, updateTask, removeAvailableTag]);

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
  useEffect(() => {
    if (!rolloverSettings.autoRollover || !user) return;

    const checkAndRolloverTasks = () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayString = today.toISOString().split('T')[0];

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
                // Mark that we've checked today
                saveToLocalStorage('lastRolloverCheck', todayString);
              },
            },
            duration: 10000,
          });
        } else {
          // Automatically roll over without asking
          performRollover(tasksToRollover, todayString);
        }
      }
    };

    const performRollover = async (tasksToRollover: Task[], todayString: string) => {
      let rolledCount = 0;
      
      for (const task of tasksToRollover) {
        try {
          await updateTask(task.id, { scheduledDate: todayString });
          rolledCount++;
        } catch (error) {
          logger.error('Failed to rollover task:', task.id, error);
        }
      }
      
      if (rolledCount > 0) {
        toast.success(`✅ Rolled over ${rolledCount} task(s) to today`);
      }
      
      // Mark that we've checked today
      saveToLocalStorage('lastRolloverCheck', todayString);
    };

    // Check if we've already run rollover today
    const lastCheck = getFromLocalStorage<string>('lastRolloverCheck', '');
    const today = new Date().toISOString().split('T')[0];
    
    if (lastCheck !== today) {
      // Run rollover check after a short delay (to allow UI to load)
      const timer = setTimeout(() => {
        checkAndRolloverTasks();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [tasks, rolloverSettings, user, updateTask]);

  // Expose ensureWorkspace for manual triggering
  const ensureWorkspace = useCallback(async (): Promise<string | null> => {
    // If workspace already exists in state, return it
    if (workspaceId) {
      return workspaceId;
    }
    
    // If no user/auth, can't create workspace
    if (!user || !accessToken) {
      logger.warn('Cannot ensure workspace: user or accessToken missing');
      return null;
    }
    
    try {
      // First, check if workspace already exists (getUserWorkspaces auto-creates if missing)
      // This prevents creating duplicate workspaces
      const { workspaces } = await api.getUserWorkspaces();
      if (workspaces && workspaces.length > 0 && workspaces[0].id) {
        const wsId = workspaces[0].id;
        // Update state if it's not already set
        if (workspaceId !== wsId) {
          setWorkspaceId(wsId);
        }
        return wsId;
      }
      
      // Only create if no workspace exists (shouldn't happen due to auto-creation, but safety check)
      logger.warn('No workspace found after getUserWorkspaces, creating one');
      await createWorkspaceIfNeeded();
      
      // After creation, get the workspaceId from state or fetch it
      if (workspaceId) {
        return workspaceId;
      }
      // If state hasn't updated yet, fetch it directly
      const { workspaces: newWorkspaces } = await api.getUserWorkspaces();
      if (newWorkspaces && newWorkspaces.length > 0 && newWorkspaces[0].id) {
        const wsId = newWorkspaces[0].id;
        setWorkspaceId(wsId);
        return wsId;
      }
      return null;
    } catch (error) {
      logger.error('Failed to ensure workspace:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const detailedMessage = errorMessage.includes('Unknown error') 
        ? 'Unable to access workspace. Please check your connection and try again.'
        : errorMessage;
      
      toast.error('Failed to access workspace', {
        description: detailedMessage,
        duration: 5000,
      });
      return null;
    }
  }, [workspaceId, user, accessToken, createWorkspaceIfNeeded]);

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
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
}
