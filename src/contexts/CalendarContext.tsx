import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { toast } from '../lib/toast-wrapper';
import { useAuth } from './AuthContext';
import { useSubscription } from './SubscriptionContext';
import { useTasks } from './TaskContext';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { supabase } from '../lib/supabase-client';
import { TIMING_CONSTANTS } from '../lib/timing-constants';
import { AppleCalDAVSetupDialog } from '../components/AppleCalDAVSetupDialog';
import { clearCalendarEventsCache } from '../lib/calendar-events-cache';
import { createDefaultCalendarContext } from '../lib/context-defaults';

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

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/taskzm-database-function`;

export function CalendarProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  const { hasFeature, features } = useSubscription();
  const { tasks, workspaceId } = useTasks();
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus>({
    google: false,
    outlook: false,
    apple: false,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [showAppleCalDAVDialog, setShowAppleCalDAVDialog] = useState(false);
  
  // Refs to prevent multiple simultaneous syncs and track sync state
  const isSyncingRef = useRef(false);
  const lastAutoSyncRef = useRef<number>(0);
  const autoSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Calendar sync interval - use constant from TIMING_CONSTANTS
  const CALENDAR_SYNC_INTERVAL = TIMING_CONSTANTS.calendar.syncInterval;
  
  // Minimum time between auto syncs - use constant from TIMING_CONSTANTS
  const MIN_AUTO_SYNC_INTERVAL = TIMING_CONSTANTS.calendar.minAutoSyncInterval;

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
    const CACHE_DURATION = TIMING_CONSTANTS.calendar.cacheDuration;
    
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
    
    // Gate: Calendar sync requires Pro subscription
    if (!hasFeature('calendarSync')) {
      // Dispatch event to trigger upgrade prompt
      window.dispatchEvent(new CustomEvent('showUpgradePrompt', { 
        detail: { feature: 'calendarSync' } 
      }));
      return;
    }
    
    // Check calendar sync limit for Pro Monthly (1 calendar connection)
    if (features.calendarSyncLimit !== undefined) {
      const connectedCalendars = [
        calendarStatus.google,
        calendarStatus.outlook,
        calendarStatus.apple,
      ].filter(Boolean).length;
      
      // If this calendar is already connected, allow reconnection
      const isAlreadyConnected = 
        (provider === 'google' && calendarStatus.google) ||
        (provider === 'outlook' && calendarStatus.outlook) ||
        (provider === 'apple' && calendarStatus.apple);
      
      if (!isAlreadyConnected && connectedCalendars >= features.calendarSyncLimit) {
        toast.error('Calendar Connection Limit Reached', {
          description: `You've reached the limit of ${features.calendarSyncLimit} calendar connection${features.calendarSyncLimit === 1 ? '' : 's'} on Pro Monthly. Upgrade to Pro Yearly for unlimited calendar connections.`,
          action: {
            label: 'Upgrade',
            onClick: () => {
              window.dispatchEvent(new CustomEvent('showUpgradePrompt', { 
                detail: { feature: 'calendarSync' } 
              }));
            },
          },
        });
        return;
      }
    }

    // Apple Calendar uses CalDAV for one-way import
    if (provider === 'apple') {
      setShowAppleCalDAVDialog(true);
      return;
    }

    // For Google Calendar, check if user signed in with Google via Supabase
    if (provider === 'google') {
      try {
        // Check if user has Google OAuth tokens from Supabase
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user?.app_metadata?.provider === 'google') {
          // User signed in with Google - try to use Supabase tokens
          const providerToken = (session as any).provider_token;
          const providerRefreshToken = (session as any).provider_refresh_token;
          
          if (providerToken) {
            // Try to use Supabase Google tokens for calendar
            const response = await fetch(`${BASE_URL}/calendar/google/use-supabase-tokens`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                providerToken,
                providerRefreshToken,
              }),
            });

            if (response.ok) {
              const data = await response.json();
              if (data.success) {
                // Successfully connected using Supabase tokens
                await checkCalendarStatus();
                toast.success('Google Calendar connected!', {
                  description: 'Using your Google account from sign-in',
                });
                return;
              }
            }
            
            // If using Supabase tokens failed (e.g., missing calendar scopes), fall through to OAuth flow
            console.log('Supabase Google tokens not sufficient for calendar, using OAuth flow');
          }
        }
      } catch (error) {
        // If checking Supabase tokens fails, fall through to OAuth flow
        console.log('Error checking Supabase Google tokens, using OAuth flow:', error);
      }
    }

    try {
      // Get OAuth URL from server (fallback or if Supabase tokens not available)
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
      const width = TIMING_CONSTANTS.calendar.popupWidth;
      const height = TIMING_CONSTANTS.calendar.popupHeight;
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
        // Fast path: Early return for non-matching message types (most common case)
        if (!event.data || typeof event.data !== 'object' || !event.data.type) {
          return;
        }
        
        // Fast path: Only process calendar OAuth messages
        if (event.data.type !== 'calendar-oauth-success' && event.data.type !== 'calendar-oauth-error') {
          return;
        }
        
        // Fast path: Only process messages for the current provider
        if (event.data.provider !== provider) {
          return;
        }
        
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
          
          // Clean up listeners immediately (synchronous, fast)
          window.removeEventListener('message', messageHandler);
          clearInterval(checkPopup);
          popup.close();
          
          // Defer all heavy operations to next tick to keep handler fast
          if (event.data.type === 'calendar-oauth-success') {
            // Use setTimeout(0) to defer to next event loop tick
            setTimeout(() => {
              checkCalendarStatus();
              toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} Calendar connected successfully!`);
            }, 0);
          } else if (event.data.type === 'calendar-oauth-error') {
            // Defer toast to next tick
            setTimeout(() => {
              toast.error(`Failed to connect ${provider} Calendar`, {
                description: event.data.error || 'An error occurred during authorization',
              });
            }, 0);
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
      }, TIMING_CONSTANTS.calendar.popupCheckInterval);

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
      // Apple Calendar uses CalDAV endpoint, other providers use OAuth endpoint
      const endpoint = provider === 'apple' 
        ? `${BASE_URL}/calendar/apple/caldav`
        : `${BASE_URL}/calendar/${provider}`;
      
      const response = await fetch(endpoint, {
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

      // Update localStorage and clear cache
      if (user.id) {
        const newStatus = { ...calendarStatus, [provider]: false };
        localStorage.setItem(`calendar_status_${user.id}`, JSON.stringify(newStatus));
        // Clear the status cache to prevent stale data on refresh
        localStorage.removeItem(`calendar_status_cache_${user.id}`);
        localStorage.removeItem(`calendar_status_cache_time_${user.id}`);
      }

      toast.success(`${provider === 'apple' ? 'Apple' : provider} Calendar disconnected`);
    } catch (error) {
      console.error(`Failed to disconnect ${provider}:`, error);
      toast.error(`Failed to disconnect ${provider === 'apple' ? 'Apple' : provider} Calendar`);
    }
  }, [user, accessToken, calendarStatus]);

  // Sync a single task to calendar
  const syncTask = useCallback(async (taskId: string, provider: CalendarProvider) => {
    if (!user) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      toast.error('Task not found');
      return;
    }

    if (!task.scheduledDate) {
      toast.error('Task must have a scheduled date to sync');
      return;
    }

    // Apple Calendar is one-way import only (iCloud → TaskZM)
    if (provider === 'apple') {
      toast.info('Apple Calendar is import-only', {
        description: 'Events are imported from iCloud. To add events, use Apple Calendar app.',
      });
      return;
    }

    // Google/Outlook use server-side OAuth
    if (!accessToken || !workspaceId) return;

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

  // Internal function to sync Apple Calendar (can be called silently for auto-sync)
  const syncAppleCalendarInternal = useCallback(async (silent: boolean = false): Promise<boolean> => {
    if (!user || !accessToken) {
      console.debug('Apple Calendar sync skipped: no user or access token');
      return false;
    }
    
    // Prevent multiple simultaneous syncs
    if (isSyncingRef.current) {
      console.debug('Apple Calendar sync already in progress, skipping...');
      return false;
    }
    
    // Check minimum interval for auto-sync
    if (silent) {
      const now = Date.now();
      const timeSinceLastSync = now - lastAutoSyncRef.current;
      if (timeSinceLastSync < MIN_AUTO_SYNC_INTERVAL) {
        console.debug(`Apple Calendar auto-sync skipped (last sync was ${Math.round(timeSinceLastSync / 1000)}s ago, minimum is ${MIN_AUTO_SYNC_INTERVAL / 1000}s)`);
        return false;
      }
    }
    
    console.log(`[Apple Calendar Sync] Starting ${silent ? 'background' : 'manual'} sync...`);
    
    try {
      isSyncingRef.current = true;
      if (!silent) {
        setIsSyncing(true);
      }
      
      // Auto-detect user's timezone from browser
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
      
      const response = await fetch(`${BASE_URL}/calendar/apple/caldav/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userTimezone }),
      });

      const data = await response.json();

      if (data.success) {
        setLastSync(new Date());
        lastAutoSyncRef.current = Date.now();
        
        // Clear calendar events cache to force refresh
        clearCalendarEventsCache();
        
        console.log(`[Apple Calendar Sync] Success: ${data.created} created, ${data.updated} updated, ${data.deleted} deleted`);
        
        if (!silent) {
          toast.success('iCloud Calendar synced!', {
            description: `Imported ${data.created} new, updated ${data.updated}, removed ${data.deleted} events`,
          });
        } else {
          console.debug(`Apple Calendar auto-sync complete: ${data.created} new, ${data.updated} updated, ${data.deleted} removed`);
        }
        return true;
      } else if (response.status === 400 && data.error?.includes('not configured')) {
        // CalDAV not set up yet
        if (!silent) {
          toast.info('Apple Calendar not configured', {
            description: 'Please complete the setup first.',
          });
          setShowAppleCalDAVDialog(true);
        }
        return false;
      } else {
        if (!silent) {
          toast.error('Sync failed', {
            description: data.error || 'Failed to sync with iCloud Calendar',
          });
        } else {
          console.debug('Apple Calendar auto-sync failed:', data.error);
        }
        return false;
      }
    } catch (error) {
      console.error('Apple CalDAV sync error:', error);
      if (!silent) {
        toast.error('Sync failed', {
          description: 'Could not connect to iCloud Calendar',
        });
      } else {
        console.debug('Apple Calendar auto-sync error (silent):', error);
      }
      return false;
    } finally {
      isSyncingRef.current = false;
      if (!silent) {
        setIsSyncing(false);
      }
    }
  }, [user, accessToken]);

  // Sync Google Calendar events from Google Calendar to database
  const syncGoogleCalendarInternal = useCallback(async (silent: boolean = false): Promise<boolean> => {
    if (!user || !accessToken) {
      console.debug('Google Calendar sync skipped: no user or access token');
      return false;
    }
    
    // Prevent multiple simultaneous syncs
    if (isSyncingRef.current) {
      console.debug('Google Calendar sync already in progress, skipping...');
      return false;
    }
    
    console.log(`[Google Calendar Sync] Starting ${silent ? 'background' : 'manual'} sync...`);
    
    try {
      isSyncingRef.current = true;
      if (!silent) {
        setIsSyncing(true);
      }
      
      // Auto-detect user's timezone from browser
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
      
      const response = await fetch(`${BASE_URL}/calendar/google/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userTimezone }),
      });

      const data = await response.json();

      if (data.success) {
        setLastSync(new Date());
        
        // Clear calendar events cache to force refresh
        clearCalendarEventsCache();
        
        console.log(`[Google Calendar Sync] Success: ${data.created} created, ${data.updated} updated, ${data.deleted} deleted`);
        
        if (!silent) {
          toast.success('Google Calendar synced!', {
            description: `Imported ${data.created} new, updated ${data.updated}, removed ${data.deleted} events`,
          });
        } else {
          console.debug(`Google Calendar auto-sync complete: ${data.created} new, ${data.updated} updated, ${data.deleted} removed`);
        }
        return true;
      } else if (response.status === 400 && data.error?.includes('not connected')) {
        // Google Calendar not connected
        if (!silent) {
          toast.info('Google Calendar not connected', {
            description: 'Please connect your Google Calendar first.',
          });
        }
        return false;
      } else {
        if (!silent) {
          toast.error('Sync failed', {
            description: data.error || 'Failed to sync with Google Calendar',
          });
        } else {
          console.debug('Google Calendar auto-sync failed:', data.error);
        }
        return false;
      }
    } catch (error) {
      console.error('Google Calendar sync error:', error);
      if (!silent) {
        toast.error('Sync failed', {
          description: 'Could not connect to Google Calendar',
        });
      } else {
        console.debug('Google Calendar auto-sync error (silent):', error);
      }
      return false;
    } finally {
      isSyncingRef.current = false;
      if (!silent) {
        setIsSyncing(false);
      }
    }
  }, [user, accessToken]);

  // Sync all tasks to calendar
  const syncAllTasks = useCallback(async (provider: CalendarProvider) => {
    if (!user) return;

    // Apple Calendar - trigger CalDAV sync (import from iCloud)
    if (provider === 'apple') {
      await syncAppleCalendarInternal(false);
      return;
    }

    // Google Calendar - trigger sync (import from Google Calendar)
    if (provider === 'google') {
      await syncGoogleCalendarInternal(false);
      return;
    }

    // Outlook use server-side sync
    if (!accessToken || !workspaceId) return;

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
        console.log('Sync response text:', responseText?.substring(0, 500));
        if (!responseText) {
          throw new Error('Empty response from server');
        }
        // Check if response is the literal "[object Object]" which indicates a serialization error
        if (responseText === '[object Object]' || responseText.trim() === '[object Object]') {
          console.error('Server returned [object Object] - serialization error on server');
          throw new Error('Server returned invalid data. Please try again or reconnect your calendar.');
        }
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse sync response:', parseError);
        throw new Error('Invalid response from server. Please try again or reconnect your calendar.');
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
  }, [user, accessToken, workspaceId, tasks]);

  // Handle Apple CalDAV setup completion
  const handleAppleCalDAVComplete = useCallback(() => {
    if (!user) return;
    
    setCalendarStatus(prev => ({ ...prev, apple: true }));
    if (user.id) {
      const newStatus = { ...calendarStatus, apple: true };
      localStorage.setItem(`calendar_status_${user.id}`, JSON.stringify(newStatus));
    }
    setShowAppleCalDAVDialog(false);
    
    // Trigger initial sync after setup
    // Use a small delay to ensure setup is complete
    setTimeout(() => {
      syncAppleCalendarInternal(false);
    }, TIMING_CONSTANTS.intervals.taskContext); // Use task context delay constant (1 second)
  }, [user, calendarStatus, syncAppleCalendarInternal]);

  // Automatic Apple Calendar sync on mount (if connected)
  // Defer to idle time to avoid blocking initial render and causing performance violations
  useEffect(() => {
    if (!user || !accessToken || !calendarStatus.apple) return;
    
    // Use requestIdleCallback if available, otherwise use longer timeout
    // This ensures sync happens when browser is idle, not blocking critical rendering
    const scheduleSync = () => {
      console.debug('Auto-syncing Apple Calendar on app load...');
      syncAppleCalendarInternal(true);
    };
    
    let initialSyncTimer: NodeJS.Timeout | number | null = null;
    
    // Use constants for timeout values
    const IDLE_CALLBACK_TIMEOUT = 5 * TIMING_CONSTANTS.timeConversions.secondsToMs; // 5 seconds
    const FALLBACK_SYNC_DELAY = 5 * TIMING_CONSTANTS.timeConversions.secondsToMs; // 5 seconds
    
    if ('requestIdleCallback' in window) {
      // Use idle callback to sync when browser is idle (after 5 seconds max wait)
      const idleCallback = (window as any).requestIdleCallback(
        scheduleSync,
        { timeout: IDLE_CALLBACK_TIMEOUT }
      );
      initialSyncTimer = idleCallback;
    } else {
      // Fallback: Wait 5 seconds after mount to let app fully load
      initialSyncTimer = setTimeout(scheduleSync, FALLBACK_SYNC_DELAY);
    }
    
    return () => {
      if (typeof initialSyncTimer === 'number') {
        clearTimeout(initialSyncTimer);
      } else if (initialSyncTimer && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(initialSyncTimer);
      }
    };
  }, [user, accessToken, calendarStatus.apple, syncAppleCalendarInternal]);

  // Periodic automatic sync for Apple Calendar
  useEffect(() => {
    if (!user || !accessToken || !calendarStatus.apple) {
      // Clear interval if calendar is disconnected
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
        autoSyncIntervalRef.current = null;
      }
      return;
    }
    
    // Set up periodic sync
    autoSyncIntervalRef.current = setInterval(() => {
      console.debug('Periodic Apple Calendar sync triggered...');
      syncAppleCalendarInternal(true);
    }, CALENDAR_SYNC_INTERVAL);
    
    return () => {
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
        autoSyncIntervalRef.current = null;
      }
    };
  }, [user, accessToken, calendarStatus.apple, syncAppleCalendarInternal, CALENDAR_SYNC_INTERVAL]);

  // Sync when page becomes visible (user returns to app) - Apple Calendar
  useEffect(() => {
    if (!user || !accessToken || !calendarStatus.apple) return;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if enough time has passed since last sync
        const now = Date.now();
        const timeSinceLastSync = now - lastAutoSyncRef.current;
        
        // Only sync if it's been at least 1 minute since last sync (reduced for better responsiveness)
        const VISIBILITY_SYNC_COOLDOWN = TIMING_CONSTANTS.timeConversions.minutesToMs; // 1 minute
        if (timeSinceLastSync >= VISIBILITY_SYNC_COOLDOWN) {
          console.debug('Auto-syncing Apple Calendar on visibility change...');
          syncAppleCalendarInternal(true);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, accessToken, calendarStatus.apple, syncAppleCalendarInternal]);

  // Sync when page becomes visible (user returns to app) - Google Calendar
  useEffect(() => {
    if (!user || !accessToken || !calendarStatus.google) return;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if enough time has passed since last sync
        const now = Date.now();
        const timeSinceLastSync = now - lastAutoSyncRef.current;
        
        // Only sync if it's been at least 1 minute since last sync
        const VISIBILITY_SYNC_COOLDOWN = TIMING_CONSTANTS.timeConversions.minutesToMs; // 1 minute
        if (timeSinceLastSync >= VISIBILITY_SYNC_COOLDOWN) {
          console.debug('Auto-syncing Google Calendar on visibility change...');
          syncGoogleCalendarInternal(true);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, accessToken, calendarStatus.google, syncGoogleCalendarInternal]);

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
      <AppleCalDAVSetupDialog
        open={showAppleCalDAVDialog}
        onOpenChange={setShowAppleCalDAVDialog}
        onComplete={handleAppleCalDAVComplete}
      />
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (context === undefined) {
    // Return fallback values instead of throwing to prevent app crashes
    console.warn('useCalendar called outside CalendarProvider, using fallback values');
    return createDefaultCalendarContext();
  }
  return context;
}
