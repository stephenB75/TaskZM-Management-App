/**
 * Loading Context
 * Tracks overall app loading state to coordinate splash screen visibility
 * and ensure dashboard is only shown when all critical data is loaded
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useTasks } from './TaskContext';
import { useSubscription } from './SubscriptionContext';
import { logger } from '../lib/logger';

interface LoadingState {
  auth: boolean;
  workspace: boolean;
  subscription: boolean;
  isReady: boolean;
}

interface LoadingContextType {
  isLoading: boolean;
  loadingProgress: number;
  loadingMessage: string;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const { workspaceId, isLoading: workspaceLoading } = useTasks();
  const { isLoading: subscriptionLoading } = useSubscription();
  
  // Handle case where useTasks might not be available yet (during initial render)
  const workspaceLoadingState = workspaceLoading !== undefined ? workspaceLoading : true;
  
  const [loadingState, setLoadingState] = useState<LoadingState>({
    auth: true,
    workspace: true,
    subscription: true,
    isReady: false,
  });

  // Track loading states
  useEffect(() => {
    setLoadingState(prev => ({
      ...prev,
      auth: authLoading,
    }));
  }, [authLoading]);

  useEffect(() => {
    // Workspace is ready when:
    // - User is not authenticated (no workspace needed)
    // - User is authenticated and workspaceId is set (workspace loaded)
    // - Workspace loading is complete
    const workspaceReady = !user || (user && workspaceId && !workspaceLoadingState);
    
    setLoadingState(prev => ({
      ...prev,
      workspace: !workspaceReady,
    }));
  }, [user, workspaceId, workspaceLoadingState]);

  useEffect(() => {
    setLoadingState(prev => ({
      ...prev,
      subscription: subscriptionLoading,
    }));
  }, [subscriptionLoading]);

  // Calculate overall loading state: auth + workspace only (subscription non-blocking for first paint)
  useEffect(() => {
    const isReady = !loadingState.auth && !loadingState.workspace;
    
    setLoadingState(prev => ({
      ...prev,
      isReady,
    }));

    if (isReady) {
      logger.debug('✅ Auth and workspace ready, app is ready (subscription may still load in background)');
      window.dispatchEvent(new CustomEvent('app-ready'));
    }
  }, [loadingState.auth, loadingState.workspace]);

  // Calculate loading progress (0-100) - auth and workspace only for "ready" bar
  const loadingProgress = React.useMemo(() => {
    const total = 2; // auth, workspace (subscription loads in background)
    let loaded = 0;
    
    if (!loadingState.auth) loaded++;
    if (!loadingState.workspace) loaded++;
    
    return Math.round((loaded / total) * 100);
  }, [loadingState]);

  // Generate loading message (subscription not shown as blocking)
  const loadingMessage = React.useMemo(() => {
    if (loadingState.auth) return 'Authenticating...';
    if (loadingState.workspace) return 'Loading workspace...';
    return 'Loading TaskZM...';
  }, [loadingState]);

  const value: LoadingContextType = {
    isLoading: !loadingState.isReady,
    loadingProgress,
    loadingMessage,
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}

