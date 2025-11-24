import { useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { projectId } from '../utils/supabase/info';
import { logger } from '../lib/logger';

/**
 * Hook to track demo user activity and update last activity timestamp
 * Call this hook or use updateActivity() function on user interactions
 */
export function useDemoActivity() {
  const { user, accessToken } = useAuth();

  const updateActivity = useCallback(async () => {
    if (!user?.isDemo || !accessToken || !user?.id) return;

    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-65e6e67f/demo/update-activity`, {
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
      }
    } catch (error) {
      logger.warn('Failed to update demo activity (network error):', error);
    }
  }, [user?.isDemo, user?.id, accessToken]);

  // Update activity on mount and periodically
  useEffect(() => {
    if (!user?.isDemo || !accessToken) return;

    // Update immediately
    updateActivity();

    // Update every 5 minutes while user is active
    const interval = setInterval(updateActivity, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user?.isDemo, user?.id, accessToken, updateActivity]);

  return { updateActivity };
}

