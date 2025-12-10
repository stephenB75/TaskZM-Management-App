import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { toast } from '../lib/toast-wrapper';
import { useAuth } from './AuthContext';
import { useTasks } from './TaskContext';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { CalDAVCredentialsDialog } from '../components/CalDAVCredentialsDialog';
import { TIMING_CONSTANTS } from '../lib/timing-constants';

type CalendarProvider = 'google' | 'outlook' | 'apple';

interface CalendarStatus {
  google: boolean;
  outlook: boolean;
  apple: boolean;
}

interface AppleCalendarTestResult {
  success: boolean;
  hasTokens?: boolean;
  hasCredentials?: boolean;
  authValid?: boolean;
  calendarURLDiscovered?: boolean;
  calendarURL?: string;
  canFetchEvents?: boolean;
  eventsCount?: number;
  message?: string;
  error?: string;
}

interface CalendarContextType {
  calendarStatus: CalendarStatus;
  isSyncing: boolean;
  lastSync: Date | null;
  connectCalendar: (provider: CalendarProvider) => Promise<void>;
  disconnectCalendar: (provider: CalendarProvider) => Promise<void>;
  syncTask: (taskId: string, provider: CalendarProvider) => Promise<void>;
  syncAllTasks: (provider: CalendarProvider) => Promise<void>;
  checkCalendarStatus: () => Promise<void>;
  testAppleConnection: () => Promise<AppleCalendarTestResult>;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-65e6e67f`;

export function CalendarProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  const { tasks, workspaceId } = useTasks();
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus>({
    google: false,
    outlook: false,
    apple: false,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [showCalDAVDialog, setShowCalDAVDialog] = useState(false);

  // Load calendar status from localStorage on mount
  useEffect(() => {
    if (user?.id) {
      const stored = localStorage.getItem(`calendar_status_${user.id}`);
      if (stored) {
        try {
          const status = JSON.parse(stored);
          setCalendarStatus(status);
        } catch (e) {
          console.error('Failed to parse calendar status:', e);
        }
      }
      // Also check server status
      checkCalendarStatus();
    }
  }, [user?.id]);

  // Check calendar connection status from server with caching
  const checkCalendarStatus = useCallback(async () => {
    if (!user || !accessToken) return;

    // Check cache first (5 minute cache)
    const cacheKey = `calendar_status_cache_${user.id}`;
    const cacheTimeKey = `calendar_status_cache_time_${user.id}`;
    const cachedTime = localStorage.getItem(cacheTimeKey);
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    
    if (cachedTime) {
      const cacheAge = Date.now() - parseInt(cachedTime, 10);
      if (cacheAge < CACHE_DURATION) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const data = JSON.parse(cached);
            setCalendarStatus(data);
            return; // Use cached data, skip Edge Function call
          } catch (e) {
            // Cache parse error, continue to fetch
          }
        }
      }
    }

    try {
      const response = await fetch(`${BASE_URL}/calendar/status`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCalendarStatus(data);
        
        // Update localStorage and cache
        if (user.id) {
          localStorage.setItem(`calendar_status_${user.id}`, JSON.stringify(data));
          localStorage.setItem(cacheKey, JSON.stringify(data));
          localStorage.setItem(cacheTimeKey, Date.now().toString());
        }
      }
    } catch (error) {
      console.error('Failed to check calendar status:', error);
      // On error, try to use cached data if available
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const data = JSON.parse(cached);
          setCalendarStatus(data);
        } catch (e) {
          // Ignore cache parse errors
        }
      }
    }
  }, [user, accessToken]);

  // Test Apple Calendar connection
  const testAppleConnection = useCallback(async (): Promise<AppleCalendarTestResult> => {
    if (!user || !accessToken) {
      return { success: false, error: 'Please sign in to test calendar connection' };
    }

    try {
      const response = await fetch(`${BASE_URL}/calendar/apple/test`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Apple Calendar Connected', {
          description: data.message,
        });
      } else {
        toast.error('Apple Calendar Connection Issue', {
          description: data.error || data.message || 'Connection test failed',
        });
      }
      
      return data;
    } catch (error) {
      console.error('Failed to test Apple Calendar connection:', error);
      const errorMessage = error instanceof Error ? error.message : 'Test failed';
      toast.error('Connection Test Failed', {
        description: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  }, [user, accessToken]);

  // Connect to a calendar provider
  const connectCalendar = useCallback(async (provider: CalendarProvider) => {
    if (!user || !accessToken) {
      toast.error('Please sign in to connect calendar');
      return;
    }

    // Apple Calendar requires different flow (CalDAV)
    if (provider === 'apple') {
      setShowCalDAVDialog(true);
      return;
    }

    try {
      // Get OAuth URL from server
      const response = await fetch(`${BASE_URL}/calendar/${provider}/auth`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        let errorMessage = 'Failed to initiate OAuth';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If response isn't JSON, use status text
          errorMessage = `${errorMessage}: ${response.statusText}`;
        }
        toast.error(`Failed to connect ${provider} Calendar`, {
          description: errorMessage,
        });
        return;
      }

      const data = await response.json();
      
      // Validate response contains authUrl
      if (!data || !data.authUrl) {
        toast.error(`Failed to connect ${provider} Calendar`, {
          description: 'Server did not return a valid OAuth URL. Please check your OAuth configuration.',
        });
        console.error('Invalid OAuth response:', data);
        return;
      }
      
      // Open OAuth flow in popup
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        data.authUrl,
        'Calendar OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup) {
        toast.error('Please allow popups to connect calendar', {
          description: 'Your browser blocked the popup window. Please allow popups for this site and try again.',
        });
        return;
      }

      // Listen for messages from popup
      const messageHandler = (event: MessageEvent) => {
        try {
          // Ignore messages from browser extensions and other origins
          // Only process messages from our own origin or the OAuth popup
          const allowedOrigins = [
            window.location.origin,
            `https://${projectId}.supabase.co`,
            'https://accounts.google.com',
            'https://login.microsoftonline.com',
            'https://appleid.apple.com',
          ];
          
          // Skip if origin is not in allowed list (likely a browser extension)
          if (event.origin && !allowedOrigins.some(origin => event.origin.startsWith(origin))) {
            return;
          }
          
          // Verify message is from our OAuth flow
          if (event.data?.type === 'calendar-oauth-success' && event.data?.provider === provider) {
            window.removeEventListener('message', messageHandler);
            clearInterval(checkPopup);
            popup.close();
            
            // Recheck status after successful connection
            setTimeout(() => {
              checkCalendarStatus();
              toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} Calendar connected successfully!`);
            }, TIMING_CONSTANTS.animations.long);
          } else if (event.data?.type === 'calendar-oauth-error' && event.data?.provider === provider) {
            window.removeEventListener('message', messageHandler);
            clearInterval(checkPopup);
            popup.close();
            
            toast.error(`Failed to connect ${provider} Calendar`, {
              description: event.data.error || 'An error occurred during authorization',
            });
          }
        } catch (error) {
          // Silently ignore errors from message handling (likely from browser extensions)
          console.debug('Message handler error (non-critical):', error);
        }
      };

      window.addEventListener('message', messageHandler);

      // Fallback: Check if popup is closed (user might have closed it manually)
      const checkPopup = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopup);
          window.removeEventListener('message', messageHandler);
          // Only show error if we didn't receive a success/error message
          // This prevents showing error when user successfully completes OAuth
          setTimeout(() => {
            checkCalendarStatus();
          }, TIMING_CONSTANTS.delays.calendarCheck);
        }
      }, 500);

      toast.success(`Connecting to ${provider} Calendar...`, {
        description: 'Complete the authorization in the popup window',
      });
    } catch (error) {
      console.error(`Failed to connect ${provider}:`, error);
      toast.error(`Failed to connect ${provider} Calendar`, {
        description: String(error),
      });
    }
  }, [user, accessToken, checkCalendarStatus]);

  // Disconnect from a calendar provider
  const disconnectCalendar = useCallback(async (provider: CalendarProvider) => {
    if (!user || !accessToken) return;

    try {
      const response = await fetch(`${BASE_URL}/calendar/${provider}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect calendar');
      }

      // Update status
      setCalendarStatus(prev => ({
        ...prev,
        [provider]: false,
      }));

      // Update localStorage
      if (user.id) {
        const newStatus = { ...calendarStatus, [provider]: false };
        localStorage.setItem(`calendar_status_${user.id}`, JSON.stringify(newStatus));
      }

      toast.success(`${provider} Calendar disconnected`);
    } catch (error) {
      console.error(`Failed to disconnect ${provider}:`, error);
      toast.error(`Failed to disconnect ${provider} Calendar`);
    }
  }, [user, accessToken, calendarStatus]);

  // Sync a single task to calendar
  const syncTask = useCallback(async (taskId: string, provider: CalendarProvider) => {
    if (!user || !accessToken || !workspaceId) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      toast.error('Task not found');
      return;
    }

    if (!task.scheduledDate) {
      toast.error('Task must have a scheduled date to sync');
      return;
    }

    try {
      setIsSyncing(true);

      const response = await fetch(`${BASE_URL}/calendar/sync-task`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ task, provider, workspaceId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sync task');
      }

      setLastSync(new Date());
      toast.success(`Task synced to ${provider} Calendar`);
    } catch (error) {
      console.error(`Failed to sync task to ${provider}:`, error);
      toast.error(`Failed to sync task`, {
        description: String(error),
      });
    } finally {
      setIsSyncing(false);
    }
  }, [user, accessToken, tasks, workspaceId]);

  // Sync all tasks to calendar
  const syncAllTasks = useCallback(async (provider: CalendarProvider) => {
    if (!user || !accessToken || !workspaceId) return;

    try {
      setIsSyncing(true);

      const loadingToast = toast.loading('Syncing tasks to calendar...', {
        description: 'This may take a moment',
      });

      const response = await fetch(`${BASE_URL}/calendar/sync-all`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workspaceId, provider }),
      });

      toast.dismiss(loadingToast);

      if (!response.ok) {
        // Try to parse JSON error response, but handle non-JSON responses gracefully
        let errorMessage = `Failed to sync tasks (${response.status})`;
        try {
          // Clone the response so we can read it without consuming the original
          const responseClone = response.clone();
          const contentType = response.headers.get('content-type');
          
          if (contentType && contentType.includes('application/json')) {
            try {
              const error = await responseClone.json();
              // Ensure error.error is a string, not an object
              if (error && error.error) {
                errorMessage = typeof error.error === 'string' 
                  ? error.error 
                  : JSON.stringify(error.error);
              } else if (typeof error === 'string') {
                errorMessage = error;
              } else if (error && typeof error === 'object') {
                errorMessage = error.message || error.toString() || errorMessage;
              }
            } catch (jsonError) {
              // If JSON parsing fails, try text
              const text = await response.text();
              // Check if text is "[object Object]" and handle it
              if (text && text !== '[object Object]' && text.trim().length > 0) {
                errorMessage = text;
              }
            }
          } else {
            // If response is not JSON, read as text
            const text = await response.text();
            // Check if text is "[object Object]" and handle it
            if (text && text !== '[object Object]' && text.trim().length > 0) {
              errorMessage = text;
            }
          }
        } catch (parseError) {
          // If parsing fails, use status text
          console.error('Error parsing error response:', parseError);
          errorMessage = response.statusText || `Server error (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      // Parse response JSON with error handling
      let data;
      try {
        const responseText = await response.text();
        if (!responseText) {
          throw new Error('Empty response from server');
        }
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse sync response:', parseError);
        throw new Error('Invalid response from server. Please try again.');
      }
      
      setLastSync(new Date());
      
      const syncedCount = Number(data.synced) || 0;
      const failedCount = Number(data.failed) || 0;
      const totalCount = Number(data.total) || syncedCount + failedCount;
      const failedIds = Array.isArray(data.failedTaskIds) ? data.failedTaskIds : [];
      const summary = `Synced ${syncedCount} task${syncedCount === 1 ? '' : 's'}${failedCount > 0 ? `, ${failedCount} failed` : ''}${totalCount ? ` (total ${totalCount})` : ''}`;
      const failureReason = typeof data.failureReason === 'string' && data.failureReason.trim().length > 0 
        ? data.failureReason.trim() 
        : undefined;

      if (failedCount > 0) {
        const details: string[] = [summary];
        if (failureReason) details.push(`Reason: ${failureReason}`);
        if (failedIds.length) details.push(`Failed task IDs: ${failedIds.slice(0, 5).join(', ')}${failedIds.length > 5 ? '…' : ''}`);

        if (syncedCount === 0) {
          toast.error('Calendar sync failed', { description: details.join(' | ') });
        } else {
          toast.warning('Calendar sync partially completed', { description: details.join(' | ') });
        }
      } else {
        toast.success('Calendar sync complete!', { description: summary });
      }
    } catch (error) {
      console.error(`Failed to sync all tasks to ${provider}:`, error);
      toast.error('Failed to sync tasks', {
        description: String(error),
      });
    } finally {
      setIsSyncing(false);
    }
  }, [user, accessToken, workspaceId]);

  const handleCalDAVConfirm = useCallback(async (credentials: { email: string; appPassword: string }) => {
    if (!user || !accessToken) {
      toast.error('Please sign in to connect calendar');
      return;
    }

    try {
      const url = `${BASE_URL}/calendar/apple/setup`;
      console.log('Calling Apple Calendar setup endpoint:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: credentials.email,
          appPassword: credentials.appPassword,
        }),
      });
      
      console.log('Apple Calendar setup response:', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        ok: response.ok,
      });

      if (!response.ok) {
        // Try to parse JSON error response
        let errorMessage = `Failed to connect Apple Calendar (${response.status})`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const error = await response.json();
            errorMessage = error.error || errorMessage;
          } else {
            // If response is not JSON, read as text
            const text = await response.text();
            errorMessage = text || errorMessage;
          }
        } catch (parseError) {
          // If parsing fails, use status text
          errorMessage = response.statusText || `Server error (${response.status})`;
        }
        console.error('Apple Calendar setup error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorMessage,
        });
        throw new Error(errorMessage);
      }

      // Parse success response
      let data;
      try {
        const responseText = await response.text();
        console.log('Apple Calendar setup response body:', responseText);
        data = responseText ? JSON.parse(responseText) : { success: true };
        console.log('Apple Calendar setup parsed data:', data);
      } catch (parseError) {
        // If JSON parsing fails, still consider it a success if status is OK
        if (response.ok) {
          console.log('Response OK but JSON parse failed, treating as success');
          data = { success: true };
        } else {
          throw new Error('Invalid response from server');
        }
      }

      // Immediately update the calendar status to show connection
      setCalendarStatus(prev => ({ ...prev, apple: true }));
      
      // Also refresh from server to ensure consistency
      await checkCalendarStatus();
      
      toast.success('Apple Calendar connected successfully! 🎉', {
        description: 'Your Apple Calendar is now synced with TaskZM',
      });
      setShowCalDAVDialog(false);
    } catch (error) {
      console.error('Apple Calendar connection error:', error);
      toast.error('Failed to connect Apple Calendar', {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }, [user, accessToken, checkCalendarStatus]);

  return (
    <CalendarContext.Provider
      value={{
        calendarStatus,
        isSyncing,
        lastSync,
        connectCalendar,
        disconnectCalendar,
        syncTask,
        syncAllTasks,
        checkCalendarStatus,
        testAppleConnection,
      }}
    >
      {children}
      <CalDAVCredentialsDialog
        open={showCalDAVDialog}
        onOpenChange={setShowCalDAVDialog}
        onConfirm={handleCalDAVConfirm}
      />
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (context === undefined) {
    // Return fallback values instead of throwing to prevent app crashes
    console.warn('useCalendar called outside CalendarProvider, using fallback values');
    return {
      calendarStatus: { google: false, outlook: false, apple: false },
      isSyncing: false,
      lastSync: null,
      connectCalendar: async () => {},
      disconnectCalendar: async () => {},
      syncTask: async () => {},
      syncAllTasks: async () => {},
      checkCalendarStatus: async () => {},
      testAppleConnection: async () => ({ success: false, error: 'Not signed in' }),
    };
  }
  return context;
}
