import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../lib/api';
import { logger } from '../lib/logger';
import { TIMING_CONSTANTS } from '../lib/timing-constants';

/**
 * Hook to track demo user activity and update last activity timestamp
 * Also monitors inactivity and triggers cleanup if user is inactive > 15 minutes
 */
export function useDemoActivity() {
  const { user, accessToken, signOut } = useAuth();
  const lastActivityRef = useRef<number>(Date.now());
  const inactivityCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const updateActivity = useCallback(async () => {
    if (!user?.isDemo || !accessToken || !user?.id) return;

    // Update local last activity timestamp
    lastActivityRef.current = Date.now();

    try {
      const response = await fetch(`${API_BASE}/demo/update-activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        logger.warn('Failed to update demo activity:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData.error || 'Unknown error',
        });
      } else {
        logger.debug('Demo activity updated successfully');
      }
    } catch (error) {
      logger.warn('Failed to update demo activity (network error):', error);
    }
  }, [user?.isDemo, user?.id, accessToken]);

  // Check for inactivity and trigger cleanup if threshold exceeded
  const checkInactivity = useCallback(async () => {
    if (!user?.isDemo || !accessToken || !user?.id) return;

    const timeSinceActivity = Date.now() - lastActivityRef.current;
    const inactiveMinutes = Math.floor(timeSinceActivity / TIMING_CONSTANTS.timeConversions.minutesToMs);

    logger.debug('Checking demo user inactivity', {
      timeSinceActivity,
      inactiveMinutes,
      threshold: TIMING_CONSTANTS.demo.cleanupTimeoutMinutes,
    });

    if (timeSinceActivity > TIMING_CONSTANTS.demo.cleanupTimeoutMs) {
      logger.warn(`Demo user inactive for ${inactiveMinutes} minutes (threshold: ${TIMING_CONSTANTS.demo.cleanupTimeoutMinutes} minutes) - triggering cleanup and sign out`);

      try {
        // Trigger cleanup on server
        const cleanupResponse = await fetch(
          `${API_BASE}/cleanup-demo-user`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ userId: user.id }), // Include userId for server verification
          }
        );

        if (cleanupResponse.ok) {
          logger.debug('Demo user cleanup successful (inactivity timeout)');
        } else {
          logger.warn('Demo user cleanup failed (inactivity timeout), but continuing with signout');
        }
      } catch (cleanupError) {
        logger.error('Demo cleanup error (inactivity timeout):', cleanupError);
        // Continue with signout even if cleanup fails
      }

      // Sign out the user (this will also clear localStorage)
      try {
        await signOut();
        logger.debug('Demo user signed out due to inactivity');
      } catch (signOutError) {
        logger.error('Failed to sign out demo user after inactivity:', signOutError);
      }
    }
  }, [user?.isDemo, user?.id, accessToken, signOut]);

  // Update activity on mount and periodically
  useEffect(() => {
    if (!user?.isDemo || !accessToken || !user?.id) {
      // Clear intervals if user is not demo
      if (inactivityCheckIntervalRef.current) {
        clearInterval(inactivityCheckIntervalRef.current);
        inactivityCheckIntervalRef.current = null;
      }
      return;
    }

    // Initialize last activity timestamp
    // Start with current time - will be updated when updateActivity completes
    lastActivityRef.current = Date.now();

    // Update activity immediately (this will sync with server and update lastActivityRef)
    updateActivity();

    // Update activity every 5 minutes while user is active
    const activityInterval = setInterval(updateActivity, TIMING_CONSTANTS.intervals.demoActivity);

    // Check for inactivity every minute
    inactivityCheckIntervalRef.current = setInterval(checkInactivity, TIMING_CONSTANTS.intervals.activityCheck);

    return () => {
      clearInterval(activityInterval);
      if (inactivityCheckIntervalRef.current) {
        clearInterval(inactivityCheckIntervalRef.current);
        inactivityCheckIntervalRef.current = null;
      }
    };
  }, [user?.isDemo, user?.id, accessToken, updateActivity, checkInactivity]);

  return { updateActivity };
}

