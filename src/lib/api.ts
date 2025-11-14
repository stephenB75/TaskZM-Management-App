import { projectId, publicAnonKey } from '../utils/supabase/info';
import type { Task, TimeTrackingSession, Activity, Folder } from '../types';
import { logger } from './logger';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-65e6e67f`;

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken || publicAnonKey}`,
  };
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
    const response = await fetch(`${API_BASE}/user/workspaces`, {
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
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch workspace');
  }

  return response.json();
}

// Task API
export async function getTasks(workspaceId: string): Promise<Task[]> {
  try {
    const response = await fetch(`${API_BASE}/tasks/${workspaceId}`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to fetch tasks');
    }

    const data = await response.json();
    // Validate response structure
    if (!data || !Array.isArray(data.tasks)) {
      logger.error('Invalid getTasks response format:', data);
      return [];
    }
    return data.tasks;
  } catch (error) {
    // If backend is not available, return empty array instead of crashing
    logger.warn('Backend unavailable, using empty task list:', error);
    return [];
  }
}

export async function saveTask(workspaceId: string, task: Task): Promise<Task> {
  try {
    const response = await fetch(`${API_BASE}/tasks/${workspaceId}`, {
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
      logger.error('saveTask failed:', { 
        status: response.status, 
        statusText: response.statusText,
        error: errorMessage,
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
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch time tracking sessions');
  }

  const data = await response.json();
  return data.sessions;
}

// Projects API
export async function getProjects(workspaceId: string) {
  try {
    const response = await fetch(`${API_BASE}/projects/${workspaceId}`, {
      method: 'GET',
      headers: getHeaders(),
    });

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
    logger.warn('Backend unavailable, using empty project list:', error);
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
export async function getFolders(workspaceId: string): Promise<Folder[]> {
  try {
    // Validate workspace ID format
    if (!workspaceId || typeof workspaceId !== 'string' || workspaceId.trim() === '') {
      logger.warn('Invalid workspace ID for getFolders:', workspaceId);
      return [];
    }

    const response = await fetch(`${API_BASE}/folders/${workspaceId}`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      // Handle 404 gracefully - workspace might not exist yet or has no folders
      if (response.status === 404) {
        // Check if it's a workspace not found error vs no folders
        let errorMessage = 'Unknown error';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (e) {
          // Ignore parse errors
        }
        
        // If workspace not found (not just no folders), return empty but log differently
        if (errorMessage.includes('Workspace not found') || errorMessage.includes('not found')) {
          logger.debug('Workspace not found (404) - may need to be created:', workspaceId);
        } else {
          logger.debug('No folders found for workspace (404):', workspaceId);
        }
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
    } else if (response.status === 401) {
      errorMessage = 'Authentication required. Please sign in again.';
    } else if (response.status === 403) {
      errorMessage = 'You do not have permission to create folders in this workspace.';
    }

    logger.error('Save folder error:', { error: errorMessage, status: response.status, workspaceId });
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
  const response = await fetch(`${API_BASE}/folders/${workspaceId}/${folderId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete folder');
  }
}

// Settings API
export async function getSettings(workspaceId: string) {
  try {
    const response = await fetch(`${API_BASE}/settings/${workspaceId}`, {
      method: 'GET',
      headers: getHeaders(),
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
export async function inviteTeamMember(workspaceId: string, email: string, name: string, role: 'admin' | 'member' | 'viewer' = 'member') {
  try {
    // Validate workspace ID format
    if (!workspaceId || typeof workspaceId !== 'string' || workspaceId.trim() === '') {
      throw new Error('Invalid workspace ID');
    }

    const response = await fetch(`${API_BASE}/team/${workspaceId}/invite`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, name, role }),
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
    
    // Handle both response formats: { invitation: {...} } or just the invitation object
    if (data.invitation) {
      return data.invitation;
    } else if (data.token) {
      // If response is the invitation object directly
      return data;
    } else {
      throw new Error('Invalid response format from invitation API');
    }
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
    logger.warn('Invalid workspace ID for getTeamMembers:', workspaceId);
    return [];
  }

  try {
    const response = await fetch(`${API_BASE}/team/${workspaceId}/members`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      // Handle 404 gracefully - workspace might not exist yet or have no members
      if (response.status === 404) {
        logger.debug('Workspace not found or has no members (404):', workspaceId);
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
          errorMessage = text || response.statusText || errorMessage;
        }
      } catch (parseError) {
        errorMessage = response.statusText || errorMessage;
      }
      
      // Only log non-404 errors
      logger.warn('Failed to fetch team members:', errorMessage);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.members || [];
  } catch (error) {
    // Handle 404 gracefully - return empty array
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('404') || errorMessage.includes('Not found')) {
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

// Admin API functions
export async function getAdminUserInfo(email: string) {
  const response = await fetch(`${API_BASE}/admin/get-user/${encodeURIComponent(email)}`, {
    method: 'GET',
    headers: getHeaders(),
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
