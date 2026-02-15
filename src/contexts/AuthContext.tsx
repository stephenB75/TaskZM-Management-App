import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase-client';
import { setAccessToken } from '../lib/api';
import { logger } from '../lib/logger';
import { clearUserLocalStorage } from '../lib/utils';
import { API_BASE } from '../lib/api';
import { publicAnonKey } from '../utils/supabase/info';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  /** Get current session token (use when accessToken state may be stale, e.g. for AI description calls) */
  getSessionToken: () => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, name: string, isDemo?: boolean, avatar?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: { name?: string; avatar?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Update demo user login timestamp
  const updateDemoLoginTime = useCallback(async (userId: string, token: string) => {
    try {
      const response = await fetch(`${API_BASE}/demo/update-login-time`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        logger.warn('Failed to update demo login time:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData.error || 'Unknown error',
        });
      }
    } catch (error) {
      logger.warn('Failed to update demo login time (network error):', error);
      // Non-critical, continue
    }
  }, []);

  useEffect(() => {
    // Check for existing session
    checkSession();

    // Listen for auth state changes (including automatic token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        logger.debug('Auth state changed:', event);
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session) {
            const userData: User = {
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.name || 'User',
              role: 'admin',
              isDemo: session.user.user_metadata?.isDemo || false,
              avatar: session.user.user_metadata?.avatar || undefined,
            };
            setUser(userData);
            setToken(session.access_token);
            setAccessToken(session.access_token);
            
            // If demo user, update login timestamp
            if (userData.isDemo && session.access_token) {
              updateDemoLoginTime(session.user.id, session.access_token).catch(err => 
                logger.warn('Failed to update demo login time:', err)
              );
            }
            
            logger.debug('Session refreshed/restored:', { userId: userData.id, event });
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setToken(null);
          setAccessToken(null);
          logger.debug('User signed out');
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [updateDemoLoginTime]);

  async function checkSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        logger.error('Session check error:', error);
        setIsLoading(false);
        return;
      }

      if (session) {
        const userData: User = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata.name || 'User',
          role: 'admin',
          isDemo: session.user.user_metadata.isDemo || false,
          avatar: session.user.user_metadata.avatar || undefined,
        };
        setUser(userData);
        setToken(session.access_token);
        setAccessToken(session.access_token);
        
        // If demo user, update login timestamp
        if (userData.isDemo && session.access_token) {
          updateDemoLoginTime(session.user.id, session.access_token).catch(err => 
            logger.warn('Failed to update demo login time:', err)
          );
        }
      }
    } catch (error) {
      logger.error('Failed to check session:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.session) {
        const userData: User = {
          id: data.session.user.id,
          email: data.session.user.email || '',
          name: data.session.user.user_metadata.name || 'User',
          role: 'admin',
          isDemo: data.session.user.user_metadata.isDemo || false,
          avatar: data.session.user.user_metadata.avatar || undefined,
        };
        
        // Check if this is a different user - clear localStorage if so
        const storedUserId = localStorage.getItem('taskzm_current_user_id');
        if (storedUserId && storedUserId !== userData.id) {
          logger.info('Different user signing in, clearing localStorage');
          clearUserLocalStorage();
        }
        
        // Set current user ID
        localStorage.setItem('taskzm_current_user_id', userData.id);
        
        setUser(userData);
        setToken(data.session.access_token);
        setAccessToken(data.session.access_token);
        
        // If demo user, update login timestamp
        if (userData.isDemo && data.session.access_token) {
          updateDemoLoginTime(data.session.user.id, data.session.access_token).catch((err) => {
            logger.warn('Failed to update demo login time:', err);
          });
        }
        
        // Return session for signup flow
        return data.session;
      }
      return null;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const isInvalidCredentials =
        msg.toLowerCase().includes('invalid') && msg.toLowerCase().includes('credentials');
      if (isInvalidCredentials) {
        logger.debug('Sign in failed: invalid credentials');
      } else {
        logger.error('Sign in error:', error);
      }
      throw error;
    }
  }

  async function signUp(email: string, password: string, name: string, isDemo: boolean = false, avatar?: string) {
    try {
      // Call our backend signup endpoint which handles user creation
      const response = await fetch(`${API_BASE}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ email, password, name, isDemo, avatar }),
      });

      // Parse response body first to get error details
      let responseData;
      try {
        responseData = await response.json();
      } catch (parseError) {
        logger.error('Failed to parse signup response:', parseError);
        throw new Error(`Signup failed: Unable to parse server response (Status: ${response.status})`);
      }

      if (!response.ok) {
        // Log full error details for debugging
        logger.error('Signup endpoint error:', {
          status: response.status,
          statusText: response.statusText,
          error: responseData?.error || 'Unknown error',
          responseData,
        });
        throw new Error(responseData?.error || `Signup failed (Status: ${response.status})`);
      }

      // Verify we got the expected success response
      if (!responseData?.user) {
        logger.error('Signup response missing user data:', responseData);
        throw new Error('Signup succeeded but user data is missing');
      }

      // Clear localStorage for new signup to prevent seeing old data
      clearUserLocalStorage();
      
      // Now sign in with the new credentials
      const session = await signIn(email, password);
      
      // Mark as new user for tour trigger
      if (session) {
        // Set flag to indicate this is a new signup (will be checked on first app load)
        localStorage.setItem('taskzm_is_new_signup', 'true');
      }
    } catch (error) {
      logger.error('Sign up error:', error);
      throw error;
    }
  }

  const signOut = useCallback(async () => {
    try {
      const isDemoUser = user?.isDemo;
      const userId = user?.id;
      
      // If this is a demo user, clean up all their data
      if (isDemoUser && accessToken && userId) {
        logger.debug('Demo user signing out - initiating cleanup', { userId });
        
        try {
          const cleanupResponse = await fetch(
            `${API_BASE}/cleanup-demo-user`,
            {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ userId }), // Include userId in body for server verification
            }
          );

          if (cleanupResponse.ok) {
            const cleanupData = await cleanupResponse.json().catch(() => ({}));
            logger.debug('Demo user cleanup successful', cleanupData);
          } else {
            const errorData = await cleanupResponse.json().catch(() => ({ error: 'Unknown error' }));
            logger.warn('Demo user cleanup failed, but continuing with signout', {
              status: cleanupResponse.status,
              error: errorData.error || 'Unknown error',
            });
          }
        } catch (cleanupError) {
          logger.error('Demo cleanup error:', cleanupError);
          // Continue with signout even if cleanup fails
        }
        
        // Clear all localStorage data for demo user
        logger.debug('Clearing localStorage for demo user');
        try {
          // Task-related data
          localStorage.removeItem('tasks');
          localStorage.removeItem('projects');
          localStorage.removeItem('availableTags');
          localStorage.removeItem('hoursSettings');
          localStorage.removeItem('rolloverSettings');
          
          // AI settings
          localStorage.removeItem('ai-settings');
          
          // Tour flags
          localStorage.removeItem('taskzm_tour_completed');
          localStorage.removeItem('taskzm_is_new_signup');
          
          // Team data
          localStorage.removeItem('taskzm_team_members');
          localStorage.removeItem('team-members'); // Legacy key if exists
          
          // Subscription data (if userId exists)
          if (userId) {
            localStorage.removeItem(`subscription_${userId}`);
            localStorage.removeItem(`calendar_status_${userId}`);
          }
          
          // Clear all localStorage keys that might contain user-specific data
          // This is a safety net to catch any other keys we might have missed
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (
              key.startsWith('taskzm_') ||
              key.startsWith('subscription_') ||
              key.startsWith('calendar_') ||
              key === 'tasks' ||
              key === 'projects' ||
              key === 'availableTags' ||
              key === 'hoursSettings' ||
              key === 'rolloverSettings' ||
              key === 'ai-settings' ||
              key === 'team-members' ||
              key === 'taskzm_team_members'
            )) {
              keysToRemove.push(key);
            }
          }
          
          keysToRemove.forEach(key => {
            try {
              localStorage.removeItem(key);
            } catch (e) {
              logger.warn(`Failed to remove localStorage key: ${key}`, e);
            }
          });
          
          logger.debug(`Cleared ${keysToRemove.length} localStorage keys for demo user`);
        } catch (localStorageError) {
          logger.error('Error clearing localStorage:', localStorageError);
          // Continue with signout even if localStorage cleanup fails
        }
      }

      await supabase.auth.signOut();
      setUser(null);
      setToken(null);
      setAccessToken(null);
    } catch (error) {
      logger.error('Sign out error:', error);
      throw error;
    }
  }, [user, accessToken]);

  // Track demo user activity (update timestamp on interactions)
  // Activity is now tracked via useDemoActivity hook which is called on user interactions

  const getSessionToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  async function updateProfile(updates: { name?: string; avatar?: string }) {
    try {
      if (!user) {
        throw new Error('No user logged in');
      }

      // Update Supabase auth user metadata
      const { data, error } = await supabase.auth.updateUser({
        data: {
          name: updates.name !== undefined ? updates.name : user.name,
          avatar: updates.avatar !== undefined ? updates.avatar : user.avatar,
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      // Update local user state
      const updatedUser: User = {
        ...user,
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.avatar !== undefined && { avatar: updates.avatar }),
      };
      
      setUser(updatedUser);
    } catch (error) {
      logger.error('Profile update error:', error);
      throw error;
    }
  }

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, getSessionToken, signIn, signUp, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // During React Fast Refresh (HMR) or edge cases, providers can temporarily unmount
    // Always return a safe default instead of throwing to prevent crashes
    // This ensures the app continues to work even if the provider isn't available yet
    if (import.meta.env.DEV) {
      console.warn('useAuth called outside AuthProvider (likely HMR issue), returning default');
    }
    return {
      user: null,
      accessToken: null,
      getSessionToken: async () => null,
      signIn: async () => {},
      signUp: async () => {},
      signOut: async () => {},
      updateProfile: async () => {},
      isLoading: true,
    };
  }
  return context;
}
