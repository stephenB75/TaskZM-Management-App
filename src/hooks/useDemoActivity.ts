import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../lib/api';
import { logger } from '../lib/logger';
import { TIMING_CONSTANTS } from '../lib/timing-constants';
import { DEMO_ACCOUNT_CONFIG } from '../lib/auth-constants';
import { toast } from '../lib/toast-wrapper';

/**
 * Hook to track demo user activity and enforce demo limits (per guidelines):
 * - Yearly (Pro) license
 * - 15-minute use limit per session: session ends when total time since login reaches 15 mins
 * - 15-minute inactivity: cleanup and sign out if inactive for 15 mins
 */
export function useDemoActivity() {
  const { user, accessToken, signOut } = useAuth();
  const lastActivityRef = useRef<number>(Date.now());
  const sessionStartRef = useRef<number>(Date.now());
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

  // Check session limit (15 mins use) and inactivity (15 mins); trigger cleanup if either exceeded
  const checkSessionAndInactivity = useCallback(async () => {
    if (!user?.isDemo || !accessToken || !user?.id) return;

    const now = Date.now();
    const timeSinceActivity = now - lastActivityRef.current;
    const sessionDurationMs = now - sessionStartRef.current;
    const inactiveMinutes = Math.floor(timeSinceActivity / TIMING_CONSTANTS.timeConversions.minutesToMs);
    const sessionMinutes = Math.floor(sessionDurationMs / TIMING_CONSTANTS.timeConversions.minutesToMs);

    logger.debug('Checking demo user session and inactivity', {
      timeSinceActivity,
      inactiveMinutes,
      sessionDurationMs,
      sessionMinutes,
      maxSessionUseMinutes: TIMING_CONSTANTS.demo.maxSessionUseMinutes,
      cleanupTimeoutMinutes: TIMING_CONSTANTS.demo.cleanupTimeoutMinutes,
    });

    // Guideline: 15-minute use limit per session
    if (sessionDurationMs >= TIMING_CONSTANTS.demo.maxSessionUseMs) {
      logger.warn(`Demo session ended: ${sessionMinutes}-minute use limit reached (${TIMING_CONSTANTS.demo.maxSessionUseMinutes} minutes)`);
      toast.info('Demo session ended', {
        description: `Your ${DEMO_ACCOUNT_CONFIG.maxSessionUseMinutes}-minute demo use limit has been reached. Sign in again to start a new session, or create an account to keep your data.`,
      });

      try {
        const cleanupResponse = await fetch(
          `${API_BASE}/cleanup-demo-user`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ userId: user.id }),
          }
        );
        if (cleanupResponse.ok) logger.debug('Demo user cleanup successful (session limit)');
      } catch (cleanupError) {
        logger.error('Demo cleanup error (session limit):', cleanupError);
      }
      try {
        await signOut();
        logger.debug('Demo user signed out: 15-minute use limit reached');
      } catch (signOutError) {
        logger.error('Failed to sign out demo user after session limit:', signOutError);
      }
      return;
    }

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

  // Update activity on mount and periodically; enforce 15-min session and inactivity limits
  useEffect(() => {
    if (!user?.isDemo || !accessToken || !user?.id) {
      if (inactivityCheckIntervalRef.current) {
        clearInterval(inactivityCheckIntervalRef.current);
        inactivityCheckIntervalRef.current = null;
      }
      return;
    }

    const now = Date.now();
    lastActivityRef.current = now;
    sessionStartRef.current = now;

    updateActivity();

    const activityInterval = setInterval(updateActivity, TIMING_CONSTANTS.intervals.demoActivity);
    inactivityCheckIntervalRef.current = setInterval(checkSessionAndInactivity, TIMING_CONSTANTS.intervals.activityCheck);

    return () => {
      clearInterval(activityInterval);
      if (inactivityCheckIntervalRef.current) {
        clearInterval(inactivityCheckIntervalRef.current);
        inactivityCheckIntervalRef.current = null;
      }
    };
  }, [user?.isDemo, user?.id, accessToken, updateActivity, checkSessionAndInactivity]);

  return { updateActivity };
}

