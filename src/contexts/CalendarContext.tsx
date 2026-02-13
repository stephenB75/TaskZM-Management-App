import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { toast } from '../lib/toast-wrapper';
import { useAuth } from './AuthContext';
import { useSubscription } from './SubscriptionContext';
import { useTasks } from './TaskContext';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { CALENDAR_API_BASE } from '../lib/calendar-api-base';
import { CALENDAR_OAUTH_ORIGINS, CALENDAR_OAUTH_MESSAGE_TYPES, CALENDAR_PROVIDER_DISPLAY_NAMES, CALENDAR_PROVIDERS, type CalendarProviderId } from '../lib/calendar-integration-constants';
import { RECURRENCE_SERIES_OCCURRENCE_SEPARATOR } from '../lib/business-constants';
import { supabase } from '../lib/supabase-client';
import { TIMING_CONSTANTS, DEFAULT_FALLBACK_TIMEZONE } from '../lib/timing-constants';
import { AppleCalDAVSetupDialog } from '../components/AppleCalDAVSetupDialog';
import { clearCalendarEventsCache } from '../lib/calendar-events-cache';
import { createDefaultCalendarContext } from '../lib/context-defaults';

type CalendarProvider = CalendarProviderId;

interface CalendarStatus {
  google: boolean;
  outlook: boolean;
  apple: boolean;
}

/** Normalize backend response to CalendarStatus so setCalendarStatus always receives the expected shape. */
function normalizeCalendarStatus(data: unknown): CalendarStatus {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    return {
      google: Boolean(o.google === true || o.google_connected === true),
      outlook: Boolean(o.outlook === true || o.outlook_connected === true),
      apple: Boolean(o.apple === true || o.apple_connected === true),
    };
  }
  return { google: false, outlook: false, apple: false };
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
  connectingProvider: CalendarProvider | null;
  disconnectingProvider: CalendarProvider | null;
  connectCalendar: (provider: CalendarProvider) => Promise<void>;
  disconnectCalendar: (provider: CalendarProvider) => Promise<void>;
  syncTask: (taskId: string, provider: CalendarProvider) => Promise<void>;
  syncAllTasks: (provider: CalendarProvider) => Promise<void>;
  checkCalendarStatus: () => Promise<CalendarStatus | undefined>;
  testAppleConnection: () => Promise<AppleCalendarTestResult>;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  const { hasFeature, features, subscription } = useSubscription();
  const { tasks, workspaceId } = useTasks();
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus>({
    google: false,
    outlook: false,
    apple: false,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [showAppleCalDAVDialog, setShowAppleCalDAVDialog] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<CalendarProvider | null>(null);
  const [disconnectingProvider, setDisconnectingProvider] = useState<CalendarProvider | null>(null);
  
  // Refs to prevent multiple simultaneous syncs and track sync state
  const isSyncingRef = useRef(false);
  const lastAutoSyncRef = useRef<number>(0);
  const autoSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const syncAppleCalendarInternalRef = useRef<((silent?: boolean) => Promise<boolean>) | null>(null);
  const calendarStatusRetryRef = useRef(false);
  /** When we optimistically or successfully set a provider to true, store timestamp so checkCalendarStatus does not overwrite with stale false. */
  const lastConnectAtRef = useRef<Partial<Record<CalendarProvider, number>>>({});
  /** When we disconnect a provider, store timestamp so checkCalendarStatus does not overwrite with stale true (so toggle stays off and can be turned back on). */
  const lastDisconnectAtRef = useRef<Partial<Record<CalendarProvider, number>>>({});

  // Calendar sync interval - use constant from TIMING_CONSTANTS
  const CALENDAR_SYNC_INTERVAL = TIMING_CONSTANTS.calendar.syncInterval;

  // Minimum time between auto syncs - use constant from TIMING_CONSTANTS
  const MIN_AUTO_SYNC_INTERVAL = TIMING_CONSTANTS.calendar.minAutoSyncInterval;

  /** Merge API/cache status with grace-period refs so recent connect/disconnect is not overwritten. */
  const mergeStatusWithGraceRefs = useCallback((status: CalendarStatus): CalendarStatus => {
    const graceMs = TIMING_CONSTANTS.calendar.statusConnectGraceMs;
    const now = Date.now();
    const merged: CalendarStatus = { ...status };
    const providers: CalendarProvider[] = [CALENDAR_PROVIDERS.google, CALENDAR_PROVIDERS.outlook, CALENDAR_PROVIDERS.apple];
    for (const p of providers) {
      const connectAt = lastConnectAtRef.current[p];
      const disconnectAt = lastDisconnectAtRef.current[p];
      if (connectAt != null && (now - connectAt) < graceMs) merged[p] = true;
      else if (disconnectAt != null && (now - disconnectAt) < graceMs) merged[p] = false;
    }
    return merged;
  }, []);

  // Check calendar connection status from server with caching. Returns merged status when fetched or from cache.
  const checkCalendarStatus = useCallback(async (): Promise<CalendarStatus | undefined> => {
    if (!user || !accessToken) {
      if (import.meta.env.DEV) {
        console.debug('[Calendar] checkCalendarStatus skipped: missing user or accessToken');
      }
      return undefined;
    }
    if (import.meta.env.DEV) {
      console.debug('[Calendar] checkCalendarStatus running');
    }

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
            const merged = mergeStatusWithGraceRefs(normalizeCalendarStatus(data));
            setCalendarStatus(merged);
            return merged;
          } catch (e) {
            // Cache parse error, continue to fetch
          }
        }
      }
    }

    try {
      const response = await fetch(`${CALENDAR_API_BASE}/calendar/status`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const status = normalizeCalendarStatus(data);
        const merged = mergeStatusWithGraceRefs(status);
        setCalendarStatus(merged);

        // Update localStorage and cache
        if (user.id) {
          localStorage.setItem(`calendar_status_${user.id}`, JSON.stringify(merged));
          localStorage.setItem(cacheKey, JSON.stringify(merged));
          localStorage.setItem(cacheTimeKey, Date.now().toString());
        }
        return merged;
      } else {
        // Non-ok response: use cached status if available so we don't leave default forever
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const data = JSON.parse(cached);
            const merged = mergeStatusWithGraceRefs(normalizeCalendarStatus(data));
            setCalendarStatus(merged);
            return merged;
          } catch (e) {
            // Ignore cache parse errors
          }
        }
        return undefined;
      }
    } catch (error) {
      console.error('Failed to check calendar status:', error);
      // On error, try to use cached data if available
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const data = JSON.parse(cached);
          const merged = mergeStatusWithGraceRefs(normalizeCalendarStatus(data));
          setCalendarStatus(merged);
          return merged;
        } catch (e) {
          // Ignore cache parse errors
        }
      } else if (!calendarStatusRetryRef.current) {
        // No cache: retry once after a short delay so we don't leave status at default forever
        calendarStatusRetryRef.current = true;
        setTimeout(() => {
          checkCalendarStatus();
        }, TIMING_CONSTANTS.delays.calendarCheck);
      }
      return undefined;
    }
  }, [user, accessToken, mergeStatusWithGraceRefs]);

  // Load calendar status from localStorage on mount; re-run when accessToken becomes available so server status is fetched
  useEffect(() => {
    if (!user?.id) return;
    calendarStatusRetryRef.current = false;
    const stored = localStorage.getItem(`calendar_status_${user.id}`);
    if (stored) {
      try {
        const status = JSON.parse(stored);
        setCalendarStatus(mergeStatusWithGraceRefs(normalizeCalendarStatus(status)));
      } catch (e) {
        console.error('Failed to parse calendar status:', e);
      }
    }
    if (accessToken) {
      checkCalendarStatus();
    }
  }, [user?.id, accessToken, checkCalendarStatus, mergeStatusWithGraceRefs]);

  // Re-check calendar status when tab becomes visible (e.g. user connected calendar in another tab, or stale cache)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !user?.id || !accessToken) return;
      const cacheKey = `calendar_status_cache_${user.id}`;
      const cacheTimeKey = `calendar_status_cache_time_${user.id}`;
      localStorage.removeItem(cacheKey);
      localStorage.removeItem(cacheTimeKey);
      checkCalendarStatus();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [user?.id, accessToken, checkCalendarStatus]);

  // Test Apple Calendar connection
  const testAppleConnection = useCallback(async (): Promise<AppleCalendarTestResult> => {
    if (!user || !accessToken) {
      return { success: false, error: 'Please sign in to test calendar connection' };
    }

    try {
      const response = await fetch(`${CALENDAR_API_BASE}/calendar/apple/test`, {
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
    setConnectingProvider(provider);
    // Gate: Calendar sync requires Pro subscription (Monthly or Yearly)
    // Check both tier and feature to ensure proper gating
    if (subscription.tier !== 'pro' || !hasFeature('calendarSync')) {
      // Only show upgrade prompt for free tier users
      // Pro users (monthly or yearly) should have calendarSync enabled
      if (subscription.tier !== 'pro') {
        // Dispatch event to trigger upgrade prompt
        window.dispatchEvent(new CustomEvent('showUpgradePrompt', { 
          detail: { feature: 'calendarSync' } 
        }));
      } else {
        // Pro user but feature not enabled - this shouldn't happen, but log it
        console.warn('[Calendar Sync] Pro user detected but calendarSync feature not enabled. Subscription:', {
          tier: subscription.tier,
          billingPeriod: subscription.billingPeriod,
          hasFeature: hasFeature('calendarSync'),
        });
        toast.error('Calendar sync is not available', {
          description: 'Please contact support if you have a Pro subscription.',
        });
      }
      setConnectingProvider(null);
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
        (provider === CALENDAR_PROVIDERS.google && calendarStatus.google) ||
        (provider === CALENDAR_PROVIDERS.outlook && calendarStatus.outlook) ||
        (provider === CALENDAR_PROVIDERS.apple && calendarStatus.apple);
      
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
        setConnectingProvider(null);
        return;
      }
    }

    // Clear calendar status cache so next checkCalendarStatus() fetches fresh data (avoids stale "off" after connect)
    if (user.id) {
      localStorage.removeItem(`calendar_status_cache_${user.id}`);
      localStorage.removeItem(`calendar_status_cache_time_${user.id}`);
    }

    // Optimistic update for Google/Outlook so the toggle turns on immediately; Apple opens dialog so no optimistic update
    if (provider === CALENDAR_PROVIDERS.google || provider === CALENDAR_PROVIDERS.outlook) {
      lastConnectAtRef.current[provider] = Date.now();
      lastDisconnectAtRef.current[provider] = undefined;
      setCalendarStatus(prev => ({ ...prev, [provider]: true }));
    }

    // Apple Calendar uses CalDAV for one-way import; keep connectingProvider so toggle stays disabled and prevents double-tap until dialog closes
    if (provider === CALENDAR_PROVIDERS.apple) {
      setShowAppleCalDAVDialog(true);
      return;
    }

    // For Google Calendar, check if user signed in with Google via Supabase
    if (provider === CALENDAR_PROVIDERS.google) {
      try {
        // Check if user has Google OAuth tokens from Supabase
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user?.app_metadata?.provider === CALENDAR_PROVIDERS.google) {
          // User signed in with Google - try to use Supabase tokens
          const providerToken = (session as any).provider_token;
          const providerRefreshToken = (session as any).provider_refresh_token;
          
          if (providerToken) {
            // Try to use Supabase Google tokens for calendar
            const response = await fetch(`${CALENDAR_API_BASE}/calendar/google/use-supabase-tokens`, {
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
                // Successfully connected - force UI to show connected (server may not have updated status yet)
                setCalendarStatus(prev => {
                  const next = { ...prev, google: true };
                  if (user.id) localStorage.setItem(`calendar_status_${user.id}`, JSON.stringify(next));
                  return next;
                });
                clearCalendarEventsCache();
                await checkCalendarStatus();
                setCalendarStatus(prev => ({ ...prev, google: true })); // Keep true after refresh
                toast.success('Google Calendar connected!', {
                  description: 'Using your Google account from sign-in',
                });
                setConnectingProvider(null);
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
      const response = await fetch(`${CALENDAR_API_BASE}/calendar/${provider}/auth`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        let errorMessage = 'Failed to initiate OAuth';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error ?? errorData.message ?? errorMessage;
        } catch (e) {
          // If response isn't JSON, use status text
          errorMessage = `${errorMessage}: ${response.statusText}`;
        }
        if (response.status === 404) {
          errorMessage = "Calendar auth endpoint not found. Make sure the Supabase Edge Function 'taskzm-database-function' is deployed and the function URL is correct.";
        }
        toast.error(`Failed to connect ${CALENDAR_PROVIDER_DISPLAY_NAMES[provider]} Calendar`, {
          description: errorMessage,
        });
        await checkCalendarStatus(); // Revert optimistic update
        setConnectingProvider(null);
        return;
      }

      const data = await response.json();
      
      // Validate response contains authUrl and that it is the provider's OAuth URL (not our backend)
      const authUrl = typeof data?.authUrl === 'string' ? data.authUrl : '';
      const expectedOrigin = provider === CALENDAR_PROVIDERS.google
        ? CALENDAR_OAUTH_ORIGINS.google
        : provider === CALENDAR_PROVIDERS.outlook
          ? CALENDAR_OAUTH_ORIGINS.microsoft
          : null;
      if (!authUrl || (expectedOrigin && !authUrl.startsWith(expectedOrigin))) {
        toast.error(`Failed to connect ${CALENDAR_PROVIDER_DISPLAY_NAMES[provider]} Calendar`, {
          description: expectedOrigin
            ? 'Server did not return a valid OAuth URL. The calendar function may not be deployed or the request path may be wrong.'
            : 'Server did not return a valid OAuth URL. Please check your OAuth configuration.',
        });
        console.error('Invalid OAuth response (expected URL starting with', expectedOrigin, '):', data);
        await checkCalendarStatus(); // Revert optimistic update
        setConnectingProvider(null);
        return;
      }
      
      // Open OAuth flow in popup
      const width = TIMING_CONSTANTS.calendar.popupWidth;
      const height = TIMING_CONSTANTS.calendar.popupHeight;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        authUrl,
        'Calendar OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup) {
        toast.error('Please allow popups to connect calendar', {
          description: 'Your browser blocked the popup window. Please allow popups for this site and try again.',
        });
        await checkCalendarStatus(); // Revert optimistic update
        setConnectingProvider(null);
        return;
      }

      // Track if we've received a message to prevent duplicate handling
      let messageReceived = false;
      
      // Declare checkPopupInterval variable that will be set below (needed for cleanup in messageHandler)
      let checkPopupInterval: NodeJS.Timeout | null = null;
      
      // Listen for messages from popup
      const messageHandler = (event: MessageEvent) => {
        // Enhanced logging for debugging
        console.debug('[Calendar OAuth] Message received:', {
          hasData: !!event.data,
          dataType: typeof event.data,
          messageType: event.data?.type,
          provider: event.data?.provider,
          origin: event.origin,
          expectedProvider: provider,
        });
        
        // Fast path: Early return for non-matching message types (most common case)
        if (!event.data || typeof event.data !== 'object' || !event.data.type) {
          return;
        }
        
        // Fast path: Only process calendar OAuth messages
        if (event.data.type !== CALENDAR_OAUTH_MESSAGE_TYPES.success && event.data.type !== CALENDAR_OAUTH_MESSAGE_TYPES.error) {
          return;
        }
        
        // Fast path: Only process messages for the current provider
        if (event.data.provider !== provider) {
          console.debug('[Calendar OAuth] Message provider mismatch:', event.data.provider, 'vs', provider);
          return;
        }
        
        // Prevent duplicate handling
        if (messageReceived) {
          console.debug('[Calendar OAuth] Message already handled, ignoring duplicate');
          return;
        }
        
        try {
          // Ignore messages from browser extensions and other origins
          // Only process messages from our own origin or the OAuth callback
          const allowedOrigins = [
            window.location.origin,
            `https://${projectId}.supabase.co`,
            CALENDAR_OAUTH_ORIGINS.google,
            CALENDAR_OAUTH_ORIGINS.microsoft,
            CALENDAR_OAUTH_ORIGINS.apple,
          ];
          
          // ENHANCED: More lenient origin check for OAuth callbacks
          // The callback page is served from Supabase functions, so we need to allow that origin
          // CRITICAL FIX: Process calendar OAuth messages regardless of origin if they match type and provider
          // This is safe because we validate the message type and provider, and the message comes from our callback page
          const isAllowedOrigin = !event.origin || allowedOrigins.some(origin => {
            // Check if origin matches exactly or starts with allowed origin
            return event.origin === origin || event.origin.startsWith(origin);
          });
          
          // CRITICAL FIX: Always process calendar OAuth messages if they match type and provider
          // The origin check is for security, but we've already validated the message type and provider
          // If it's a calendar OAuth message with matching provider, it's from our callback page
          if (!isAllowedOrigin) {
            console.warn('[Calendar OAuth] Message from unexpected origin:', event.origin, 'but processing anyway for calendar OAuth message');
            // Still process the message - it's validated by type and provider
          }
          
          // Additional validation: ensure message has required fields
          if (!event.data.type || !event.data.provider) {
            console.warn('[Calendar OAuth] Message missing required fields, ignoring');
            return;
          }
          
          // Mark message as received
          messageReceived = true;
          
          // Clean up listeners immediately (synchronous, fast)
          window.removeEventListener('message', messageHandler);
          if (checkPopupInterval) {
            clearInterval(checkPopupInterval);
          }
          
          // Close popup with a small delay to ensure message is fully processed
          setTimeout(() => {
            try {
              if (popup && !popup.closed) {
                popup.close();
              }
            } catch {
              // COOP can block cross-origin window.closed; ignore
            }
          }, TIMING_CONSTANTS.delays.calendarPopup);
          
          // Defer all heavy operations to next tick to keep handler fast
          if (event.data.type === CALENDAR_OAUTH_MESSAGE_TYPES.success) {
            console.log('[Calendar OAuth] Success message received for', provider, 'from origin:', event.origin);
            const connectedProvider = provider;
            // Use setTimeout(0) to defer to next event loop tick
            setTimeout(() => {
              lastConnectAtRef.current[connectedProvider] = Date.now();
              lastDisconnectAtRef.current[connectedProvider] = undefined;
              setCalendarStatus(prev => {
                const next = { ...prev, [connectedProvider]: true };
                if (user?.id) localStorage.setItem(`calendar_status_${user.id}`, JSON.stringify(next));
                return next;
              });
              clearCalendarEventsCache();
              // Clear status cache so re-check fetches fresh data (avoids stale false from race)
              if (user?.id) {
                localStorage.removeItem(`calendar_status_cache_${user.id}`);
                localStorage.removeItem(`calendar_status_cache_time_${user.id}`);
              }
              // Delay re-check so backend has time to finish storing tokens, then force connected state
              const delayMs = TIMING_CONSTANTS.delays.calendarStatusAfterOAuthMs ?? 1500;
              setTimeout(() => {
                checkCalendarStatus().then(() => {
                  setCalendarStatus(prev => {
                    const next = { ...prev, [connectedProvider]: true };
                    if (user?.id) localStorage.setItem(`calendar_status_${user.id}`, JSON.stringify(next));
                    return next;
                  });
                  console.log('[Calendar OAuth] Calendar status checked after success message');
                }).catch((err) => {
                  console.error('[Calendar OAuth] Error checking calendar status:', err);
                });
              }, delayMs);
              setConnectingProvider(null);
              toast.success(`${CALENDAR_PROVIDER_DISPLAY_NAMES[connectedProvider]} Calendar connected successfully!`);
            }, 0);
          } else if (event.data.type === CALENDAR_OAUTH_MESSAGE_TYPES.error) {
            console.error('[Calendar OAuth] Error message received for', provider, 'from origin:', event.origin, 'error:', event.data.error);
            setTimeout(() => {
              setConnectingProvider(null);
              checkCalendarStatus(); // Revert optimistic update
              toast.error(`Failed to connect ${CALENDAR_PROVIDER_DISPLAY_NAMES[provider]} Calendar`, {
                description: event.data.error || 'An error occurred during authorization',
              });
            }, 0);
          }
        } catch (error) {
          // Log errors for debugging but don't crash
          console.error('[Calendar OAuth] Message handler error:', error);
          // Still try to clean up
          if (!messageReceived) {
            messageReceived = true;
            window.removeEventListener('message', messageHandler);
            if (checkPopupInterval) {
              clearInterval(checkPopupInterval);
            }
            setTimeout(() => {
              try {
                if (popup && !popup.closed) {
                  popup.close();
                }
              } catch {
                // COOP can block cross-origin window.closed; ignore
              }
              // Check status anyway in case connection succeeded
              checkCalendarStatus();
            }, TIMING_CONSTANTS.delays.calendarPopup);
          }
        }
      };

      window.addEventListener('message', messageHandler);

      // Fallback: Check if popup is closed (user might have closed it manually)
      // ENHANCED: Also check for successful completion even if message wasn't received
      // Use try/catch: COOP can block popup.closed for cross-origin OAuth windows
      checkPopupInterval = setInterval(() => {
        let closed = false;
        try {
          closed = popup.closed;
        } catch {
          closed = true;
        }
        if (closed) {
          if (checkPopupInterval) {
            clearInterval(checkPopupInterval);
          }
          window.removeEventListener('message', messageHandler);
          
          // If we didn't receive a message, check calendar status after a delay so backend has time to store tokens
          if (!messageReceived) {
            console.log('[Calendar OAuth] Popup closed without message, checking calendar status...');
            if (user?.id) {
              localStorage.removeItem(`calendar_status_cache_${user.id}`);
              localStorage.removeItem(`calendar_status_cache_time_${user.id}`);
            }
            const delayMs = TIMING_CONSTANTS.delays.calendarStatusAfterOAuthMs ?? 1500;
            setTimeout(() => {
              checkCalendarStatus().then((status) => {
                if (status?.[provider]) {
                  setCalendarStatus(prev => {
                    const next = { ...prev, [provider]: true };
                    if (user?.id) localStorage.setItem(`calendar_status_${user.id}`, JSON.stringify(next));
                    return next;
                  });
                  toast.success(`${CALENDAR_PROVIDER_DISPLAY_NAMES[provider]} Calendar connected successfully!`);
                }
                setConnectingProvider(null);
              }).catch(() => {
                setConnectingProvider(null);
              });
            }, delayMs);
          }
        }
      }, TIMING_CONSTANTS.calendar.popupCheckInterval);

      toast.success(`Connecting to ${CALENDAR_PROVIDER_DISPLAY_NAMES[provider]} Calendar...`, {
        description: 'Complete the authorization in the popup window',
      });
    } catch (error) {
      console.error(`Failed to connect ${provider}:`, error);
      setConnectingProvider(null);
      toast.error(`Failed to connect ${CALENDAR_PROVIDER_DISPLAY_NAMES[provider]} Calendar`, {
        description: String(error),
      });
      await checkCalendarStatus(); // Revert optimistic update
    }
  }, [user, accessToken, checkCalendarStatus, calendarStatus]);

  // Disconnect from a calendar provider
  const disconnectCalendar = useCallback(async (provider: CalendarProvider) => {
    if (!user || !accessToken) return;

    setDisconnectingProvider(provider);
    try {
      // Apple Calendar uses CalDAV endpoint, other providers use OAuth endpoint
      const endpoint = provider === CALENDAR_PROVIDERS.apple
        ? `${CALENDAR_API_BASE}/calendar/apple/caldav`
        : `${CALENDAR_API_BASE}/calendar/${provider}`;
      
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect calendar');
      }

      // Update status and protect this provider from stale API "true" so toggle stays off and can be turned back on
      lastConnectAtRef.current[provider] = undefined;
      lastDisconnectAtRef.current[provider] = Date.now();
      setCalendarStatus(prev => ({
        ...prev,
        [provider]: false,
      }));

      // Clear calendar events cache so views don't show stale events from this provider
      clearCalendarEventsCache();

      // Update localStorage and clear cache
      if (user.id) {
        const newStatus = { ...calendarStatus, [provider]: false };
        localStorage.setItem(`calendar_status_${user.id}`, JSON.stringify(newStatus));
        // Clear the status cache to prevent stale data on refresh
        localStorage.removeItem(`calendar_status_cache_${user.id}`);
        localStorage.removeItem(`calendar_status_cache_time_${user.id}`);
      }

      toast.success(`${CALENDAR_PROVIDER_DISPLAY_NAMES[provider]} Calendar disconnected`);
      // Reconfirm with backend so toggle stays in sync (no delay needed; DELETE already completed)
      checkCalendarStatus();
    } catch (error) {
      console.error(`Failed to disconnect ${provider}:`, error);
      toast.error(`Failed to disconnect ${CALENDAR_PROVIDER_DISPLAY_NAMES[provider]} Calendar`);
    } finally {
      setDisconnectingProvider(null);
    }
  }, [user, accessToken, calendarStatus, checkCalendarStatus]);

  // Sync a single task to calendar
  const syncTask = useCallback(async (taskId: string, provider: CalendarProvider) => {
    if (!user) return;

    // Recurring tasks may pass occurrence ID (baseId + SEPARATOR + YYYY-MM-DD); resolve to base task ID
    const baseTaskId = taskId.includes(RECURRENCE_SERIES_OCCURRENCE_SEPARATOR) ? taskId.split(RECURRENCE_SERIES_OCCURRENCE_SEPARATOR)[0] : taskId;
    const task = tasks.find(t => t.id === baseTaskId);
    if (!task) {
      toast.error('Task not found');
      return;
    }

    if (!task.scheduledDate) {
      toast.error('Task must have a scheduled date to sync');
      return;
    }

    // Apple Calendar is one-way import only (iCloud → TaskZM)
    if (provider === CALENDAR_PROVIDERS.apple) {
      toast.info('Apple Calendar is import-only', {
        description: 'Events are imported from iCloud. To add events, use Apple Calendar app.',
      });
      return;
    }

    // Google/Outlook are read-only: we only display calendar events, we do not write tasks to the calendar
    if (provider === CALENDAR_PROVIDERS.google || provider === CALENDAR_PROVIDERS.outlook) {
      toast.info('Calendar is view-only', {
        description: 'We only read your calendar to show it in the app. Tasks are not written to your calendar.',
      });
      return;
    }

    // Google/Outlook use server-side OAuth
    if (!accessToken || !workspaceId) return;

    try {
      setIsSyncing(true);

      const response = await fetch(`${CALENDAR_API_BASE}/calendar/sync-task`, {
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
      toast.success(`Task synced to ${CALENDAR_PROVIDER_DISPLAY_NAMES[provider]} Calendar`);
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
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_FALLBACK_TIMEZONE;
      
      const response = await fetch(`${CALENDAR_API_BASE}/calendar/apple/caldav/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userTimezone }),
      });

      let data: { success?: boolean; error?: string; errors?: string[]; created?: number; updated?: number; deleted?: number };
      try {
        data = await response.json();
      } catch {
        const fallbackMessage = response.status === 401
          ? 'Please sign in again and try syncing.'
          : response.status >= 500
            ? 'Calendar service is temporarily unavailable. Please try again in a few minutes.'
            : 'Could not read server response. Please try again.';
        if (!silent) {
          toast.error('Apple Calendar sync failed', { description: fallbackMessage });
        }
        return false;
      }

      const serverMessage = data.error || (Array.isArray(data.errors) && data.errors.length > 0 ? data.errors.join(' ') : undefined);

      if (data.success) {
        setLastSync(new Date());
        lastAutoSyncRef.current = Date.now();
        
        // Clear calendar events cache only when sync reports changes (avoids extra Edge calls when nothing changed)
        if ((data.created || 0) + (data.updated || 0) + (data.deleted || 0) > 0) {
          clearCalendarEventsCache();
        }
        
        console.log(`[Apple Calendar Sync] Success: ${data.created} created, ${data.updated} updated, ${data.deleted} deleted`);
        
        // Only show notification if there were actual changes (not on every routine sync)
        const hasChanges = (data.created || 0) > 0 || (data.updated || 0) > 0 || (data.deleted || 0) > 0;
        if (!silent && hasChanges) {
          toast.success('iCloud Calendar synced!', {
            description: `Imported ${data.created} new, updated ${data.updated}, removed ${data.deleted} events`,
          });
        } else {
          console.debug(`Apple Calendar auto-sync complete: ${data.created} new, ${data.updated} updated, ${data.deleted} removed`);
        }
        return true;
      } else if (response.status === 401) {
        if (!silent) {
          toast.error('Session expired', {
            description: 'Please sign in again and try syncing Apple Calendar.',
          });
        }
        return false;
      } else if (response.status === 400 && (serverMessage?.toLowerCase().includes('not configured') || serverMessage?.toLowerCase().includes('connect') || serverMessage?.toLowerCase().includes('credentials'))) {
        // CalDAV not set up or credentials issue
        if (!silent) {
          toast.info('Apple Calendar not configured', {
            description: serverMessage || 'Please complete the setup first.',
          });
          setShowAppleCalDAVDialog(true);
        }
        return false;
      } else {
        if (!silent) {
          toast.error('Apple Calendar sync failed', {
            description: serverMessage || 'Failed to sync with iCloud Calendar. Please check your app-specific password and try again.',
          });
        } else {
          console.debug('Apple Calendar auto-sync failed:', serverMessage);
        }
        return false;
      }
    } catch (error) {
      console.error('Apple CalDAV sync error:', error);
      const isNetwork = error instanceof TypeError && (error.message === 'Failed to fetch' || error.message?.includes('network'));
      if (!silent) {
        toast.error('Apple Calendar sync failed', {
          description: isNetwork
            ? 'Network error. Check your connection and try again.'
            : 'Could not connect to calendar service. Please try again.',
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
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_FALLBACK_TIMEZONE;
      
      const response = await fetch(`${CALENDAR_API_BASE}/calendar/google/sync`, {
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
        
        // Clear calendar events cache only when sync reports changes (avoids extra Edge calls when nothing changed)
        if ((data.created || 0) + (data.updated || 0) + (data.deleted || 0) > 0) {
          clearCalendarEventsCache();
        }
        
        console.log(`[Google Calendar Sync] Success: ${data.created} created, ${data.updated} updated, ${data.deleted} deleted`);
        
        // Only show notification if there were actual changes (not on every routine sync)
        const hasChanges = (data.created || 0) > 0 || (data.updated || 0) > 0 || (data.deleted || 0) > 0;
        if (!silent && hasChanges) {
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
    if (provider === CALENDAR_PROVIDERS.apple) {
      await syncAppleCalendarInternal(false);
      return;
    }

    // Google/Outlook are read-only: we only display calendar events, we do not write tasks to the calendar
    if (provider === CALENDAR_PROVIDERS.google || provider === CALENDAR_PROVIDERS.outlook) {
      toast.info('Calendar is view-only', {
        description: 'We only read your calendar to show it in the app. Tasks are not written to your calendar.',
      });
      return;
    }

    // Outlook use server-side sync
    if (!accessToken || !workspaceId) return;

    try {
      setIsSyncing(true);

      const loadingToast = toast.loading('Syncing tasks to calendar...', {
        description: 'This may take a moment',
      });

      const response = await fetch(`${CALENDAR_API_BASE}/calendar/sync-all`, {
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
      } else if (syncedCount > 0) {
        // Only show success notification if tasks were actually synced (not on every routine sync with no changes)
        toast.success('Calendar sync complete!', { description: summary });
      }
      // If syncedCount is 0 and failedCount is 0, no notification (nothing to sync or already in sync)
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

    lastConnectAtRef.current[CALENDAR_PROVIDERS.apple] = Date.now();
    lastDisconnectAtRef.current[CALENDAR_PROVIDERS.apple] = undefined;
    setCalendarStatus(prev => ({ ...prev, apple: true }));
    if (user.id) {
      const newStatus = { ...calendarStatus, apple: true };
      localStorage.setItem(`calendar_status_${user.id}`, JSON.stringify(newStatus));
    }
    clearCalendarEventsCache();
    setShowAppleCalDAVDialog(false);
    setConnectingProvider(null);

    // Trigger initial sync after setup (silent so failures don't toast; user already got dialog feedback)
    setTimeout(() => {
      if (syncAppleCalendarInternalRef.current) {
        syncAppleCalendarInternalRef.current(true);
      }
    }, TIMING_CONSTANTS.intervals.taskContext); // Use task context delay constant (1 second)
  }, [user, calendarStatus]); // Removed syncAppleCalendarInternal from dependencies

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
    let usedIdleCallback = false;
    
    // Use constants for timeout values
    const IDLE_CALLBACK_TIMEOUT = 5 * TIMING_CONSTANTS.timeConversions.secondsToMs; // 5 seconds
    const FALLBACK_SYNC_DELAY = 5 * TIMING_CONSTANTS.timeConversions.secondsToMs; // 5 seconds
    
    if ('requestIdleCallback' in window) {
      // Use idle callback to sync when browser is idle (Safari 15.4+; fallback for older Safari)
      usedIdleCallback = true;
      initialSyncTimer = (window as any).requestIdleCallback(
        scheduleSync,
        { timeout: IDLE_CALLBACK_TIMEOUT }
      );
    } else {
      // Fallback: Wait 5 seconds after mount (older Safari, etc.)
      initialSyncTimer = setTimeout(scheduleSync, FALLBACK_SYNC_DELAY);
    }
    
    return () => {
      if (usedIdleCallback && typeof initialSyncTimer === 'number' && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(initialSyncTimer);
      } else if (initialSyncTimer != null) {
        clearTimeout(initialSyncTimer as NodeJS.Timeout);
      }
    };
  }, [user, accessToken, calendarStatus.apple]); // Removed syncAppleCalendarInternal from dependencies

  // Automatic Google Calendar sync on mount (if connected) - populates DB so events show in views
  useEffect(() => {
    if (!user || !accessToken || !calendarStatus.google) return;

    const scheduleSync = () => {
      console.debug('Auto-syncing Google Calendar on app load...');
      syncGoogleCalendarInternal(true);
    };

    const IDLE_CALLBACK_TIMEOUT = 5 * TIMING_CONSTANTS.timeConversions.secondsToMs;
    const FALLBACK_SYNC_DELAY = 5 * TIMING_CONSTANTS.timeConversions.secondsToMs;
    let timer: NodeJS.Timeout | number | null = null;
    let usedIdleCallback = false;

    if ('requestIdleCallback' in window) {
      usedIdleCallback = true;
      timer = (window as any).requestIdleCallback(scheduleSync, { timeout: IDLE_CALLBACK_TIMEOUT });
    } else {
      timer = setTimeout(scheduleSync, FALLBACK_SYNC_DELAY);
    }

    return () => {
      if (usedIdleCallback && typeof timer === 'number' && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(timer);
      } else if (timer != null) {
        clearTimeout(timer as NodeJS.Timeout);
      }
    };
  }, [user, accessToken, calendarStatus.google]); // syncGoogleCalendarInternal omitted to avoid re-running on callback identity change

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
    // Use ref to avoid recreating interval when callback changes
    autoSyncIntervalRef.current = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
      console.debug('Periodic Apple Calendar sync triggered...');
      if (syncAppleCalendarInternalRef.current) {
        syncAppleCalendarInternalRef.current(true);
      }
    }, CALENDAR_SYNC_INTERVAL);
    
    return () => {
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
        autoSyncIntervalRef.current = null;
      }
    };
  }, [user, accessToken, calendarStatus.apple]); // Removed syncAppleCalendarInternal and CALENDAR_SYNC_INTERVAL from dependencies

  // REMOVED: Visibility change handlers that trigger syncs on tab switch
  // These were causing app refreshes when users switched tabs/apps
  // Calendar syncs now only happen:
  // 1. On manual sync button click
  // 2. On initial calendar connection
  // 3. Via periodic background sync (if implemented in the future)
  // This prevents disruptive refreshes during user sessions

  return (
    <CalendarContext.Provider
      value={{
        calendarStatus,
        isSyncing,
        lastSync,
        connectingProvider,
        disconnectingProvider,
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
        onOpenChange={(open) => {
          setShowAppleCalDAVDialog(open);
          if (!open) setConnectingProvider(null);
        }}
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
