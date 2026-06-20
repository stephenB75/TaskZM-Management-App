import { publicAnonKey } from '../utils/supabase/info';
import type { Task, TimeTrackingSession, Activity, Folder, UserAward } from '../types';
import { logger } from './logger';
import type { Domain } from './domain-types';
import { supabase } from './supabase-client';

import { API_BASE } from './api-base';
import { TEAM_PANEL_UI_TEXT } from './team-panel-constants';

/**
 * Terminology validation constants
 */
const TERMINOLOGY_VALIDATION = {
  minKeywordLength: 2,
  minPhraseLength: 3,
  minVerbLength: 2,
  minNounLength: 2,
} as const;

export { API_BASE };

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

function getHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken || publicAnonKey}`,
  };
  
  // Note: X-Request-ID header removed due to CORS policy restrictions
  // The server's CORS configuration doesn't allow this custom header
  
  return headers;
}

/** If the server returned HTML (e.g. Cloudflare 500 page), return a short message instead of dumping HTML into logs. */
function sanitizeResponseError(body: string, status: number): string {
  const trimmed = (body || '').trim();
  if (trimmed.startsWith('<') || trimmed.toLowerCase().includes('<html')) {
    return `Server error (${status})`;
  }
  if (trimmed.length > 200) {
    return trimmed.slice(0, 200) + '…';
  }
  return trimmed || `Request failed (${status})`;
}

/**
 * Fetch with optional retry on 401: forces session refresh then retries once with new token.
 * Use for authenticated endpoints so expired tokens don't cause permanent 401.
 * GET requests default to cache: 'no-store' to avoid stale UI after user actions (workspaces, tasks, etc.).
 */
async function fetchWithAuthRetry(url: string, init: RequestInit): Promise<Response> {
  const method = init?.method ?? 'GET';
  const isGet = method === 'GET';
  const cacheOption = isGet && !(init && 'cache' in init) ? { cache: 'no-store' as RequestCache } : {};
  const mergedInit = { ...init, ...cacheOption };
  const headers = { ...getHeaders(), ...(mergedInit.headers as Record<string, string>) };
  let response = await fetch(url, { ...mergedInit, headers });
  if (response.status === 401) {
    try {
      // Force refresh so we get a new access token if the current one expired
      const { data: { session }, error } = await supabase.auth.refreshSession();
      const token = !error && session?.access_token ? session.access_token : (await supabase.auth.getSession()).data.session?.access_token;
      if (token) {
        setAccessToken(token);
        response = await fetch(url, { ...mergedInit, headers: { ...getHeaders(), ...(mergedInit.headers as Record<string, string>) } });
      }
    } catch (e) {
      logger.debug('Session refresh on 401 failed:', e);
    }
  }
  return response;
}

// Auth API
export async function signup(email: string, password: string, name: string) {
  const response = await fetch(`${API_BASE}/signup`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ email, password, name }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Signup failed');
  }

  return response.json();
}

// Workspace API
export async function getUserWorkspaces() {
  try {
    const response = await fetchWithAuthRetry(`${API_BASE}/user/workspaces`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: Failed to fetch workspaces`;
      let errorDetails = '';
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
        errorDetails = errorData.details || '';
      } catch (parseError) {
        // If JSON parsing fails, try to get text response
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText.substring(0, 200); // Limit length
          }
        } catch (textError) {
          // If all else fails, use status text
          errorMessage = response.statusText || errorMessage;
        }
      }
      
      const fullError = errorDetails ? `${errorMessage} (${errorDetails})` : errorMessage;
      logger.error('getUserWorkspaces failed:', { 
        status: response.status, 
        statusText: response.statusText,
        error: errorMessage,
        details: errorDetails
      });
      throw new Error(fullError);
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data || !data.workspaces || !Array.isArray(data.workspaces)) {
      logger.error('Invalid workspace response format:', data);
      throw new Error('Invalid workspace response format - expected array of workspaces');
    }

    return data;
  } catch (error) {
    logger.error('getUserWorkspaces error:', error);
    // Re-throw with better error message if it's not already an Error
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to fetch workspaces: ${String(error)}`);
  }
}

export async function createWorkspace(name: string): Promise<string> {
  try {
    const response = await fetch(`${API_BASE}/user/workspaces`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: Failed to create workspace`;
      let errorDetails = '';
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
        errorDetails = errorData.details || '';
      } catch (parseError) {
        // If JSON parsing fails, try to get text response
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText.substring(0, 200); // Limit length
          }
        } catch (textError) {
          // If all else fails, use status text
          errorMessage = response.statusText || errorMessage;
        }
      }
      
      const fullError = errorDetails ? `${errorMessage} (${errorDetails})` : errorMessage;
      logger.error('createWorkspace failed:', { 
        status: response.status, 
        statusText: response.statusText,
        error: errorMessage,
        details: errorDetails
      });
      throw new Error(fullError);
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data || !data.workspaceId) {
      logger.error('Invalid createWorkspace response format:', data);
      throw new Error('Invalid workspace creation response - missing workspaceId');
    }

    return data.workspaceId;
  } catch (error) {
    logger.error('createWorkspace error:', error);
    // Re-throw with better error message if it's not already an Error
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to create workspace: ${String(error)}`);
  }
}

export async function getWorkspace(workspaceId: string) {
  const response = await fetch(`${API_BASE}/workspace/${workspaceId}`, {
    method: 'GET',
    headers: getHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch workspace');
  }

  return response.json();
}

// Task API
export async function getTasks(
  workspaceId: string,
  options?: {
    since?: string; // ISO timestamp - only fetch tasks updated after this time
    ifModifiedSince?: string; // ETag/version - check if data changed
  }
): Promise<{ tasks: Task[]; error?: Error; lastModified?: string; notModified?: boolean }> {
  // Validate workspace ID
  if (!workspaceId || typeof workspaceId !== 'string' || workspaceId.trim() === '') {
    const error = new Error('Invalid workspace ID');
    logger.warn('Invalid workspace ID for getTasks:', workspaceId);
    return { tasks: [], error };
  }

  try {
    const params = new URLSearchParams();
    if (options?.since) {
      params.append('since', options.since);
    }
    if (options?.ifModifiedSince) {
      params.append('ifModifiedSince', options.ifModifiedSince);
    }

    const url = `${API_BASE}/tasks/${workspaceId}${params.toString() ? `?${params.toString()}` : ''}`;
    const headers = getHeaders();
    // Note: If-Modified-Since header removed due to CORS policy restrictions
    // Using query parameter instead for conditional requests

    const response = await fetchWithAuthRetry(url, {
      method: 'GET',
      headers,
      cache: 'no-store', // Prevent browsers (e.g. Edge) from using cached response; avoids tasks "disappearing" when sync overwrites with stale/empty cache
    });
    const lastModifiedHeader = response.headers.get('last-modified') || undefined;

    // Handle 304 Not Modified (no changes)
    if (response.status === 304) {
      logger.debug('Tasks not modified since last sync');
      return {
        tasks: [],
        lastModified: lastModifiedHeader || options?.ifModifiedSince,
        notModified: true,
      };
    }

    // Handle 404 - workspace might not exist yet (not necessarily an error)
    if (response.status === 404) {
      logger.debug('Workspace not found (404) - may need to be created:', workspaceId);
      return { tasks: [] }; // Return empty array, not an error
    }

    // Handle 401/403 - authentication/authorization errors
    if (response.status === 401 || response.status === 403) {
      const error = new Error('Authentication failed. Please sign in again.');
      logger.error('Authentication error:', { status: response.status, workspaceId });
      return { tasks: [], error };
    }

    if (!response.ok) {
      let errorMessage = 'Failed to fetch tasks';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        errorMessage = `Server error (${response.status})`;
      }
      const error = new Error(errorMessage);
      logger.error('Failed to fetch tasks:', { status: response.status, workspaceId, error: errorMessage });
      return { tasks: [], error };
    }

    const data = await response.json();
    // Validate response structure - ensure we always have an array (avoids "v is not iterable")
    const rawTasks = data?.tasks;
    const tasksArray = Array.isArray(rawTasks)
      ? rawTasks
      : rawTasks != null && typeof rawTasks === 'object'
        ? Object.values(rawTasks)
        : [];
    if (!Array.isArray(rawTasks) && rawTasks != null) {
      logger.warn('getTasks: server returned tasks as non-array, normalized to array', { type: typeof rawTasks });
    }
    return { tasks: tasksArray, lastModified: lastModifiedHeader };
  } catch (error) {
    // Network errors or other fetch failures
    const errorObj = error instanceof Error ? error : new Error('Network error');
    // Check if it's a network/fetch error
    const isNetworkError = errorObj.message.includes('fetch') || 
                          errorObj.message.includes('Network') ||
                          errorObj.message.includes('Failed to fetch') ||
                          errorObj.name === 'TypeError';
    
    if (isNetworkError) {
      // Network errors are logged in TaskContext with backoff, so we suppress repeated warnings here
      // Only log at debug level to avoid console spam
      logger.debug('Network error fetching tasks:', { workspaceId, error: errorObj.message });
      return { tasks: [], error: new Error('Failed to fetch - check your internet connection') };
    }
    
    logger.warn('Backend unavailable:', { workspaceId, error: errorObj.message });
    // Return error in response object so sync can handle it gracefully
    return { tasks: [], error: errorObj };
  }
}

export async function saveTask(workspaceId: string, task: Task): Promise<Task> {
  // Validate workspace ID
  if (!workspaceId || typeof workspaceId !== 'string' || workspaceId.trim() === '') {
    const error = new Error('Invalid workspace ID');
    logger.error('saveTask failed: Invalid workspace ID', { workspaceId, taskId: task.id });
    throw error;
  }

  try {
    const response = await fetchWithAuthRetry(`${API_BASE}/tasks/${workspaceId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(task),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to save task';
      try {
        const error = await response.json();
        errorMessage = error.error || errorMessage;
      } catch (parseError) {
        // If JSON parsing fails, try to get text response
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText.substring(0, 200); // Limit length
          }
        } catch (textError) {
          errorMessage = response.statusText || errorMessage;
        }
      }
      
      // Handle 404 - workspace not found
      if (response.status === 404 && (errorMessage.includes('Workspace not found') || errorMessage.includes('Workspace or endpoint not found'))) {
        const error = new Error('Workspace not found. Please refresh the page to create workspace.');
        logger.error('saveTask failed: Workspace not found', { 
          status: response.status, 
          workspaceId,
          taskId: task.id
        });
        throw error;
      }
      
      // Handle 401/403 - authentication errors
      if (response.status === 401 || response.status === 403) {
        const error = new Error('Authentication failed. Please sign in again.');
        logger.error('saveTask failed: Authentication error', { 
          status: response.status, 
          workspaceId,
          taskId: task.id
        });
        throw error;
      }
      
      logger.error('saveTask failed:', { 
        status: response.status, 
        statusText: response.statusText,
        error: errorMessage,
        workspaceId,
        taskId: task.id
      });
      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (!data || !data.task) {
      logger.error('Invalid saveTask response format:', data);
      throw new Error('Invalid response format - missing task data');
    }
    return data.task;
  } catch (error) {
    logger.error('saveTask error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to save task: ${String(error)}`);
  }
}

export async function deleteTask(workspaceId: string, taskId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/tasks/${workspaceId}/${taskId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete task');
  }
}

// Activity API
export async function getActivities(workspaceId: string): Promise<Activity[]> {
  try {
    const response = await fetch(`${API_BASE}/activities/${workspaceId}`, {
      method: 'GET',
      headers: getHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to fetch activities');
    }

    const data = await response.json();
    return data.activities;
  } catch (error) {
    // If backend is not available, return empty array instead of crashing
    logger.warn('Backend unavailable, using empty activity list:', error);
    return [];
  }
}

// Time Tracking API
export async function saveTimeTrackingSession(workspaceId: string, session: TimeTrackingSession): Promise<TimeTrackingSession> {
  const response = await fetch(`${API_BASE}/time-tracking/${workspaceId}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(session),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save time tracking session');
  }

  const data = await response.json();
  return data.session;
}

export async function getTimeTrackingSessions(workspaceId: string): Promise<TimeTrackingSession[]> {
  const response = await fetch(`${API_BASE}/time-tracking/${workspaceId}`, {
    method: 'GET',
    headers: getHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch time tracking sessions');
  }

  const data = await response.json();
  return data.sessions;
}

// Projects API
export async function getProjects(
  workspaceId: string,
  options?: {
    since?: string; // ISO timestamp - only fetch projects updated after this time
    ifModifiedSince?: string; // ETag/version - check if data changed
  }
) {
  try {
    const params = new URLSearchParams();
    if (options?.since) {
      params.append('since', options.since);
    }
    if (options?.ifModifiedSince) {
      params.append('ifModifiedSince', options.ifModifiedSince);
    }

    const url = `${API_BASE}/projects/${workspaceId}${params.toString() ? `?${params.toString()}` : ''}`;
    const headers = getHeaders();
    // Note: If-Modified-Since header removed due to CORS policy restrictions
    // Using query parameter instead for conditional requests

    const response = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    // Handle 304 Not Modified (no changes)
    if (response.status === 304) {
      logger.debug('Projects not modified since last sync');
      return [];
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to fetch projects');
    }

    const data = await response.json();
    // Validate response structure
    if (!data || !Array.isArray(data.projects)) {
      logger.error('Invalid getProjects response format:', data);
      return [];
    }
    return data.projects;
  } catch (error) {
    // If backend is not available, return empty array instead of crashing
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Only log warnings for non-404 errors (404 is expected for new/empty workspaces)
    if (!errorMessage.includes('404') && !errorMessage.includes('Not found')) {
      logger.warn('Backend unavailable, using empty project list:', error);
    }
    return [];
  }
}

export async function saveProject(workspaceId: string, project: any) {
  const response = await fetch(`${API_BASE}/projects/${workspaceId}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(project),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save project');
  }

  const data = await response.json();
  return data.project;
}

export async function deleteProject(workspaceId: string, projectId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/projects/${workspaceId}/${projectId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete project');
  }
}

// Folder API
export async function getFolders(
  workspaceId: string,
  options?: {
    since?: string; // ISO timestamp - only fetch folders updated after this time
    ifModifiedSince?: string; // ETag/version - check if data changed
  }
): Promise<Folder[]> {
  try {
    // Validate workspace ID format
    if (!workspaceId || typeof workspaceId !== 'string' || workspaceId.trim() === '') {
      logger.warn('Invalid workspace ID for getFolders:', workspaceId);
      return [];
    }

    const params = new URLSearchParams();
    if (options?.since) {
      params.append('since', options.since);
    }
    if (options?.ifModifiedSince) {
      params.append('ifModifiedSince', options.ifModifiedSince);
    }

    const url = `${API_BASE}/folders/${workspaceId}${params.toString() ? `?${params.toString()}` : ''}`;
    const headers = getHeaders();
    // Note: If-Modified-Since header removed due to CORS policy restrictions
    // Using query parameter instead for conditional requests

    const response = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    // Handle 304 Not Modified (no changes)
    if (response.status === 304) {
      logger.debug('Folders not modified since last sync');
      return [];
    }

    if (!response.ok) {
      // Handle 404 gracefully - workspace might not exist yet or has no folders
      if (response.status === 404) {
        // Silently handle 404s - they're expected for new workspaces or workspaces without folders
        // Don't log to console to reduce noise
        return [];
      }
      
      // Handle 401/403 - authentication/authorization errors
      if (response.status === 401 || response.status === 403) {
        logger.error('Authentication error when fetching folders:', { status: response.status, workspaceId });
        return [];
      }

      // Try to parse error as JSON, fallback to text or status text
      let errorMessage = 'Unknown error';
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } else {
          const text = await response.text();
          errorMessage = text || response.statusText || errorMessage;
        }
      } catch (parseError) {
        errorMessage = response.statusText || errorMessage;
      }
      
      // Only log non-404 errors
      logger.warn('Failed to fetch folders:', errorMessage);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.folders || [];
  } catch (error) {
    // Don't log warnings for expected 404s (workspace might not exist yet or has no folders)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes('404') && !errorMessage.includes('Not found')) {
      logger.warn('Backend unavailable, using empty folder list:', error);
    }
    // Return empty array for any error (404 is expected for new workspaces)
    return [];
  }
}

export async function saveFolder(workspaceId: string, folder: Partial<Folder>): Promise<Folder> {
  // Validate workspace ID format
  if (!workspaceId || typeof workspaceId !== 'string' || workspaceId.trim() === '' || workspaceId.includes(':')) {
    throw new Error('Invalid workspace ID');
  }

  const response = await fetch(`${API_BASE}/folders/${workspaceId}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(folder),
  });

  if (!response.ok) {
    // Try to parse error as JSON, fallback to text or status text
    let errorMessage = 'Failed to save folder';
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const error = await response.json();
        errorMessage = error.error || errorMessage;
      } else {
        const text = await response.text();
        errorMessage = text || response.statusText || errorMessage;
      }
    } catch (parseError) {
      errorMessage = response.statusText || errorMessage;
    }

    // Provide more helpful error messages
    if (response.status === 404) {
      if (errorMessage.includes('Workspace not found') || errorMessage.includes('not found')) {
        errorMessage = 'Workspace not found. Please refresh the page to reload your workspace.';
      } else {
        errorMessage = 'Workspace or endpoint not found. Please refresh the page.';
      }
      // Log 404s as debug instead of warnings - endpoint may not exist on server (expected for some deployments)
      logger.debug('Save folder endpoint not found (404):', { error: errorMessage, status: response.status, workspaceId });
    } else if (response.status === 401) {
      errorMessage = 'Authentication required. Please sign in again.';
      logger.error('Save folder error:', { error: errorMessage, status: response.status, workspaceId });
    } else if (response.status === 403) {
      errorMessage = 'You do not have permission to create folders in this workspace.';
      logger.error('Save folder error:', { error: errorMessage, status: response.status, workspaceId });
    } else {
      logger.error('Save folder error:', { error: errorMessage, status: response.status, workspaceId });
    }

    throw new Error(errorMessage);
  }

  // Try to parse response as JSON
  try {
    const data = await response.json();
    return data.folder;
  } catch (parseError) {
    // If response is not JSON, try to get text
    const text = await response.text();
    throw new Error(`Invalid response from server: ${text.substring(0, 100)}`);
  }
}

export async function updateFolder(workspaceId: string, folderId: string, updates: Partial<Folder>): Promise<Folder> {
  const response = await fetch(`${API_BASE}/folders/${workspaceId}/${folderId}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update folder');
  }

  const data = await response.json();
  return data.folder;
}

export async function deleteFolder(workspaceId: string, folderId: string): Promise<void> {
  // Validate workspace ID format
  if (!workspaceId || typeof workspaceId !== 'string' || workspaceId.trim() === '' || workspaceId.includes(':')) {
    throw new Error('Invalid workspace ID');
  }

  const response = await fetch(`${API_BASE}/folders/${workspaceId}/${folderId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  if (!response.ok) {
    // Try to parse error as JSON, fallback to text or status text
    let errorMessage = 'Failed to delete folder';
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const error = await response.json();
        errorMessage = error.error || errorMessage;
      } else {
        const text = await response.text();
        errorMessage = text || response.statusText || errorMessage;
      }
    } catch (parseError) {
      errorMessage = response.statusText || errorMessage;
    }

    // Provide more helpful error messages
    if (response.status === 404) {
      if (errorMessage.includes('Workspace not found') || errorMessage.includes('not found')) {
        errorMessage = 'Workspace not found. Please refresh the page to reload your workspace.';
      } else {
        errorMessage = 'Folder or workspace not found. Please refresh the page.';
      }
    } else if (response.status === 401) {
      errorMessage = 'Authentication required. Please sign in again.';
    } else if (response.status === 403) {
      errorMessage = 'You do not have permission to delete folders in this workspace.';
    }

    logger.error('Delete folder error:', { error: errorMessage, status: response.status, workspaceId, folderId });
    throw new Error(errorMessage);
  }
}

// Settings API
export async function getSettings(workspaceId: string) {
  try {
    const response = await fetch(`${API_BASE}/settings/${workspaceId}`, {
      method: 'GET',
      headers: getHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to fetch settings');
    }

    const data = await response.json();
    return data.settings;
  } catch (error) {
    // If backend is not available, return default settings instead of crashing
    logger.warn('Backend unavailable, using default settings:', error);
    return {
      availableTags: null,
      hoursSettings: null,
      rolloverSettings: null,
      viewConfig: null,
    };
  }
}

export async function saveSettings(workspaceId: string, settings: any) {
  try {
    const response = await fetch(`${API_BASE}/settings/${workspaceId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to save settings';
      try {
        const error = await response.json();
        errorMessage = error.error || errorMessage;
      } catch (parseError) {
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText.substring(0, 200);
          }
        } catch (textError) {
          errorMessage = response.statusText || errorMessage;
        }
      }
      logger.error('saveSettings failed:', { 
        status: response.status, 
        statusText: response.statusText,
        error: errorMessage,
        workspaceId
      });
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    logger.error('saveSettings error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to save settings: ${String(error)}`);
  }
}

// Subscription API
export async function getSubscription() {
  const response = await fetch(`${API_BASE}/subscription`, {
    method: 'GET',
    headers: getHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch subscription');
  }

  const data = await response.json();
  const subscription = data.subscription;
  
  // Normalize subscription data to ensure all required fields exist
  if (subscription) {
    return {
      tier: subscription.tier || 'free',
      status: subscription.status || 'active',
      startDate: subscription.startDate || null,
      endDate: subscription.endDate || null,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
      billingPeriod: subscription.billingPeriod || null,
    };
  }
  
  return subscription;
}

export async function saveSubscription(subscription: any) {
  const response = await fetch(`${API_BASE}/subscription`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(subscription),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save subscription');
  }

  const data = await response.json();
  return data.subscription;
}

// Team/Invitation API
export async function inviteTeamMember(
  workspaceId: string,
  email: string,
  name: string,
  role: 'admin' | 'member' | 'viewer' = 'member',
  options?: { teamId?: string; avatar?: string },
) {
  try {
    // Validate workspace ID format
    if (!workspaceId || typeof workspaceId !== 'string' || workspaceId.trim() === '') {
      throw new Error('Invalid workspace ID');
    }

    const response = await fetch(`${API_BASE}/team/${workspaceId}/invite`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        email,
        name,
        role,
        teamId: options?.teamId,
        avatar: options?.avatar,
      }),
    });

    if (!response.ok) {
      // Try to parse error response
      let errorMessage = 'Unknown error';
      let errorDetails = '';
      
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
          errorDetails = error.details || '';
        } else {
          const text = await response.text();
          errorMessage = text || response.statusText || errorMessage;
        }
      } catch (parseError) {
        errorMessage = response.statusText || `HTTP ${response.status}`;
      }

      // Provide more helpful error messages
      if (response.status === 404) {
        if (errorMessage.includes('Workspace not found') || errorMessage.includes('not found')) {
          errorMessage = 'Workspace not found. Please refresh the page or contact support.';
        } else {
          errorMessage = 'Workspace or endpoint not found. Please refresh the page.';
        }
      } else if (response.status === 401) {
        errorMessage = 'Authentication required. Please sign in again.';
      } else if (response.status === 403) {
        errorMessage = 'You do not have permission to invite members to this workspace.';
      }

      logger.error('Invite API error:', { error: errorMessage, details: errorDetails, status: response.status, workspaceId });
      throw new Error(errorMessage);
    }

    const data = await response.json();
    logger.debug('Invite API response:', data);
    
    if (data.member) {
      return { member: data.member };
    }
    if (data.invitation) {
      return { invitation: data.invitation };
    }
    if (data.token) {
      return { invitation: data };
    }
    throw new Error('Invalid response format from invitation API');
  } catch (error) {
    logger.error('Error in inviteTeamMember:', error);
    // Re-throw with better error message if it's not already an Error
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to send invitation: ${String(error)}`);
  }
}

export async function getTeamMembers(workspaceId: string) {
  // Validate workspace ID format
  if (!workspaceId || typeof workspaceId !== 'string' || workspaceId.trim() === '') {
    logger.debug('Invalid workspace ID for getTeamMembers:', workspaceId);
    return [];
  }

  try {
    const response = await fetch(`${API_BASE}/team/${workspaceId}/members`, {
      method: 'GET',
      headers: getHeaders(),
      cache: 'no-store',
    }).catch((fetchError) => {
      // Handle network errors gracefully
      logger.debug('Network error fetching team members:', fetchError);
      return new Response(null, { status: 404, statusText: 'Not Found' });
    });

    if (!response.ok) {
      // Handle 404 gracefully - workspace might not exist yet or have no members
      if (response.status === 404) {
        // Silently handle 404s - they're expected for new workspaces or workspaces without members
        // Don't log to console to reduce noise
        return [];
      }
      
      // Handle 401/403 - authentication/authorization errors
      if (response.status === 401 || response.status === 403) {
        logger.error('Authentication error when fetching team members:', { status: response.status, workspaceId });
        return [];
      }
      
      // Try to parse error as JSON, fallback to text or status text
      let errorMessage = 'Failed to fetch team members';
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } else {
          const text = await response.text();
          errorMessage = sanitizeResponseError(text, response.status);
        }
      } catch (parseError) {
        errorMessage = response.statusText || errorMessage;
      }
      
      // Only log warnings for non-404 errors
      if (response.status !== 404) {
        logger.warn('Failed to fetch team members:', errorMessage);
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.members || [];
  } catch (error) {
    // Handle 404 gracefully - return empty array
    const rawMessage = error instanceof Error ? error.message : String(error);
    const errorMessage = sanitizeResponseError(rawMessage, 0);
    if (rawMessage.includes('404') || rawMessage.includes('Not found')) {
      logger.debug('Workspace not found, returning empty team members list');
      return [];
    }
    // For other errors, log and return empty array to prevent app crashes
    logger.warn('Error fetching team members, using empty list:', errorMessage);
    return [];
  }
}

export async function removeTeamMember(workspaceId: string, memberId: string) {
  const response = await fetch(`${API_BASE}/team/${workspaceId}/members/${memberId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove team member');
  }

  return response.json();
}

export async function updateTeamMemberRole(workspaceId: string, memberId: string, role: 'admin' | 'member' | 'viewer') {
  const response = await fetch(`${API_BASE}/team/${workspaceId}/members/${memberId}/role`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ role }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update team member role');
  }

  return response.json();
}

// Team Management API Functions
export async function createTeam(workspaceId: string, name: string, description?: string) {
  const response = await fetch(`${API_BASE}/teams/${workspaceId}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ name, description }),
  });

  if (!response.ok) {
    let message = TEAM_PANEL_UI_TEXT.failedToCreateTeam;
    try {
      const body = await response.json();
      message = body?.error ?? body?.message ?? message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  return response.json();
}

export async function updateTeam(teamId: string, name: string, description?: string) {
  const response = await fetch(`${API_BASE}/teams/${teamId}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ name, description }),
  });

  if (!response.ok) {
    let message = TEAM_PANEL_UI_TEXT.failedToUpdateTeam;
    try {
      const body = await response.json();
      message = body?.error ?? body?.message ?? message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  return response.json();
}

export async function deleteTeam(teamId: string) {
  const response = await fetch(`${API_BASE}/teams/${teamId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  if (!response.ok) {
    let message = TEAM_PANEL_UI_TEXT.failedToDeleteTeam;
    try {
      const body = await response.json();
      message = body?.error ?? body?.message ?? message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  return response.json();
}

export async function getTeams(workspaceId: string) {
  try {
    const response = await fetch(`${API_BASE}/teams/${workspaceId}`, {
      method: 'GET',
      headers: getHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch teams');
    }

    const data = await response.json();
    return data.teams || [];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('404') || errorMessage.includes('Not found')) {
      return [];
    }
    logger.warn('Error fetching teams, using empty list:', errorMessage);
    return [];
  }
}

export async function getTeamMembersByTeam(teamId: string) {
  try {
    const response = await fetch(`${API_BASE}/teams/${teamId}/members`, {
      method: 'GET',
      headers: getHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      let errorMessage = 'Failed to fetch team members';
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } else {
          const text = await response.text();
          errorMessage = sanitizeResponseError(text, response.status);
        }
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    // Backend returns array directly, not wrapped in object
    return Array.isArray(data) ? data : (data.members || []);
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const errorMessage = sanitizeResponseError(rawMessage, 0);
    if (rawMessage.includes('404') || rawMessage.includes('Not found')) {
      return [];
    }
    logger.warn('Error fetching team members, using empty list:', errorMessage);
    return [];
  }
}

export async function inviteTeamMemberToTeam(teamId: string, email: string, name: string, role: 'admin' | 'member' | 'viewer' = 'member', avatar?: string) {
  const response = await fetch(`${API_BASE}/teams/${teamId}/invite`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ email, name, role, avatar }),
  });

  if (!response.ok) {
    let message = TEAM_PANEL_UI_TEXT.failedToInviteTeamMember;
    try {
      const body = await response.json();
      message = body?.error ?? body?.message ?? message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  return response.json();
}

// Admin API functions
export async function getAdminUserInfo(email: string) {
  const response = await fetch(`${API_BASE}/admin/get-user/${encodeURIComponent(email)}`, {
    method: 'GET',
    headers: getHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get user info');
  }

  return response.json();
}

export async function setUserAccess(email: string, role?: 'admin' | 'member' | 'viewer', tier?: 'pro' | 'free') {
  const response = await fetch(`${API_BASE}/admin/set-user-access`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ email, role, tier }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to set user access');
  }

  return response.json();
}

export async function validateInvitation(token: string) {
  const response = await fetch(`${API_BASE}/team/invitations/validate`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Invalid or expired invitation');
  }

  return response.json();
}

export async function acceptInvitation(token: string, password?: string) {
  const response = await fetch(`${API_BASE}/team/invitations/accept`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ token, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to accept invitation');
  }

  return response.json();
}

export async function resendInvitation(workspaceId: string, invitationToken: string) {
  const response = await fetch(`${API_BASE}/team/${workspaceId}/invitations/resend`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ token: invitationToken }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to resend invitation');
  }

  return response.json();
}

export async function declineInvitation(workspaceId: string, invitationToken: string) {
  const response = await fetch(`${API_BASE}/team/${workspaceId}/invitations/decline`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ token: invitationToken }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to decline invitation');
  }

  return response.json();
}

// Shared Terminology API
export interface SharedTerminology {
  keywords: string[];
  phrases: string[];
  verbs: string[];
  nouns: string[];
}

const EMPTY_TERMINOLOGY: SharedTerminology = { keywords: [], phrases: [], verbs: [], nouns: [] };

/**
 * Fetch shared terminology for all domains in one request (reduces Edge invocations from 4 to 1).
 * Returns { business, home, personal, world }.
 */
export async function getAllSharedTerminology(): Promise<Record<Exclude<Domain, 'mixed'>, SharedTerminology>> {
  try {
    const response = await fetch(`${API_BASE}/shared-terminology`, {
      method: 'GET',
      headers: getHeaders(),
      cache: 'no-store',
    });
    if (!response.ok) {
      logger.warn('Failed to fetch all shared terminology:', response.status);
      return {
        business: { ...EMPTY_TERMINOLOGY },
        home: { ...EMPTY_TERMINOLOGY },
        personal: { ...EMPTY_TERMINOLOGY },
        world: { ...EMPTY_TERMINOLOGY },
      };
    }
    const data = await response.json();
    return {
      business: data.business || EMPTY_TERMINOLOGY,
      home: data.home || EMPTY_TERMINOLOGY,
      personal: data.personal || EMPTY_TERMINOLOGY,
      world: data.world || EMPTY_TERMINOLOGY,
    };
  } catch (error) {
    logger.warn('Error fetching all shared terminology:', error);
    return {
      business: { ...EMPTY_TERMINOLOGY },
      home: { ...EMPTY_TERMINOLOGY },
      personal: { ...EMPTY_TERMINOLOGY },
      world: { ...EMPTY_TERMINOLOGY },
    };
  }
}

/**
 * Fetch shared terminology for a domain from the database
 * This includes all user-learned terms that have been shared
 */
export async function getSharedTerminology(domain: Domain): Promise<SharedTerminology> {
  try {
    if (domain === 'mixed') {
      // Mixed domain doesn't have shared terminology
      return { keywords: [], phrases: [], verbs: [], nouns: [] };
    }

    const response = await fetch(`${API_BASE}/shared-terminology/${domain}`, {
      method: 'GET',
      headers: getHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      logger.warn(`Failed to fetch shared terminology for domain ${domain}:`, response.status);
      return { keywords: [], phrases: [], verbs: [], nouns: [] };
    }

    const data = await response.json();
    return data.terminology || { keywords: [], phrases: [], verbs: [], nouns: [] };
  } catch (error) {
    logger.warn('Error fetching shared terminology:', error);
    return { keywords: [], phrases: [], verbs: [], nouns: [] };
  }
}

/**
 * Check if server-side OpenAI is configured (for task description generation).
 * No auth required. Used to show "Server AI: Configured" in Settings and to explain portal usage.
 */
export async function getAIConfigStatus(): Promise<{ configured: boolean }> {
  try {
    const response = await fetch(`${API_BASE}/ai/status`);
    if (!response.ok) return { configured: false };
    const data = await response.json();
    return { configured: !!data?.configured };
  } catch {
    return { configured: false };
  }
}

/**
 * Save new terminology to the shared database
 * This allows all users to benefit from learned terms
 */
export async function saveSharedTerminology(
  domain: Domain,
  keywords: string[] = [],
  phrases: string[] = [],
  verbs: string[] = [],
  nouns: string[] = []
): Promise<{ success: boolean; saved: number; skipped: number }> {
  try {
    if (domain === 'mixed') {
      return { success: false, saved: 0, skipped: keywords.length + phrases.length + verbs.length + nouns.length };
    }

    const response = await fetch(`${API_BASE}/shared-terminology`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        domain,
        keywords: keywords.filter(k => k && k.trim().length >= TERMINOLOGY_VALIDATION.minKeywordLength),
        phrases: phrases.filter(p => p && p.trim().length >= TERMINOLOGY_VALIDATION.minPhraseLength),
        verbs: verbs.filter(v => v && v.trim().length >= TERMINOLOGY_VALIDATION.minVerbLength),
        nouns: nouns.filter(n => n && n.trim().length >= TERMINOLOGY_VALIDATION.minNounLength),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      logger.warn('Failed to save shared terminology:', error);
      return { success: false, saved: 0, skipped: keywords.length + phrases.length + verbs.length + nouns.length };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    logger.warn('Error saving shared terminology:', error);
    return { success: false, saved: 0, skipped: keywords.length + phrases.length + verbs.length + nouns.length };
  }
}

/**
 * Get all earned awards for the current user from the database
 */
export async function getUserAwards(): Promise<UserAward[]> {
  try {
    const response = await fetch(`${API_BASE}/user/awards`, {
      method: 'GET',
      headers: getHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      logger.warn('Failed to fetch user awards:', response.status);
      return [];
    }

    const data = await response.json();
    return data.awards || [];
  } catch (error) {
    logger.warn('Error fetching user awards:', error);
    return [];
  }
}

/**
 * Save earned awards to the database
 * This will upsert awards (insert if new, update if exists)
 */
export async function saveUserAwards(awards: UserAward[]): Promise<{ success: boolean; saved: number }> {
  try {
    const response = await fetch(`${API_BASE}/user/awards`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ awards }),
    });

    if (!response.ok) {
      logger.error('Failed to save user awards:', response.status);
      return { success: false, saved: 0 };
    }

    const data = await response.json();
    return { success: true, saved: data.saved || awards.length };
  } catch (error) {
    logger.error('Error saving user awards:', error);
    return { success: false, saved: 0 };
  }
}

/**
 * Save a single award to the database
 */
export async function saveUserAward(award: UserAward): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${API_BASE}/user/awards/single`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ award }),
    });

    if (!response.ok) {
      logger.error('Failed to save user award:', response.status);
      return { success: false };
    }

    return { success: true };
  } catch (error) {
    logger.error('Error saving user award:', error);
    return { success: false };
  }
}
