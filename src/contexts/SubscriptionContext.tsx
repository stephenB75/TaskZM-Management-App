import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { SubscriptionInfo, SubscriptionTier, SubscriptionFeatures } from '../types';
import { useAuth } from './AuthContext';
import * as api from '../lib/api';
import { toast } from 'sonner';
import { SUBSCRIPTION_UI_TEXT, SUBSCRIPTION_STORAGE_KEY_PREFIX, SUBSCRIPTION_SYNC_INTERVAL } from '../lib/subscription-constants';

interface SubscriptionContextType {
  subscription: SubscriptionInfo;
  features: SubscriptionFeatures;
  isLoading: boolean;
  upgradeToPro: () => Promise<void>;
  cancelSubscription: () => Promise<void>;
  downgradeToFree: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  hasFeature: (feature: keyof SubscriptionFeatures) => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

// Feature matrix based on tier
const getFeatures = (tier: SubscriptionTier): SubscriptionFeatures => {
  if (tier === 'pro') {
    return {
      unlimitedTasks: true,
      calendar: true, // Deprecated - using calendarSync
      customTags: true,
      aiScheduler: true,
      taskHours: true,
      analytics: true,
      taskRollover: true,
      pomodoroTimer: true,
      teamFeatures: true,
      calendarSync: true,
    };
  }
  
  // Free tier
  return {
    unlimitedTasks: true,
    calendar: false, // FIXED: Was incorrectly true
    customTags: true,
    aiScheduler: false,
    taskHours: false,
    analytics: false,
    taskRollover: false,
    pomodoroTimer: false,
    teamFeatures: false,
    calendarSync: false,
  };
};

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo>({
    tier: 'free',
    status: 'active',
    startDate: null,
    endDate: null,
    cancelAtPeriodEnd: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Normalize subscription data to ensure all fields exist
  const normalizeSubscription = (data: any): SubscriptionInfo => {
    return {
      tier: data?.tier || 'free',
      status: data?.status || 'active',
      startDate: data?.startDate || null,
      endDate: data?.endDate || null,
      cancelAtPeriodEnd: data?.cancelAtPeriodEnd || false,
    };
  };

  // Derived features based on tier
  const features = getFeatures(subscription.tier);

  const loadSubscription = useCallback(async () => {
    if (!user || !accessToken) return;
    try {
      setIsLoading(true);
      
      // First, try to get subscription status from RevenueCat (source of truth)
      let rcStatus: 'pro' | 'free' | null = null;
      let shouldSyncToBackend = false;
      
      try {
        const { getSubscriptionStatus, isRevenueCatConfigured } = await import('../lib/revenuecat');
        if (isRevenueCatConfigured()) {
          console.log('🔄 Checking subscription status from RevenueCat...');
          rcStatus = await getSubscriptionStatus();
          console.log('📊 RevenueCat subscription status:', rcStatus);
          shouldSyncToBackend = true; // RevenueCat is source of truth, sync to backend
        }
      } catch (rcError) {
        // RevenueCat not available or not configured - continue with backend check
        console.log('RevenueCat check failed, using backend subscription:', rcError);
      }
      
      // If RevenueCat says Pro, sync to backend
      if (shouldSyncToBackend && rcStatus === 'pro') {
        console.log('✅ RevenueCat shows Pro subscription - syncing to backend...');
        try {
          const serverSubscription = await api.getSubscription();
          const currentTier = serverSubscription?.tier || 'free';
          
          // If backend doesn't match RevenueCat, update it
          if (currentTier !== 'pro') {
            console.log('🔄 Backend subscription out of sync, updating from RevenueCat...');
            const updatedSubscription: SubscriptionInfo = {
              tier: 'pro',
              status: 'active',
              startDate: serverSubscription?.startDate || new Date().toISOString(),
              endDate: serverSubscription?.endDate || null,
              cancelAtPeriodEnd: serverSubscription?.cancelAtPeriodEnd || false,
            };
            
            // Save to backend
            await api.saveSubscription(updatedSubscription);
            console.log('✅ Backend subscription updated from RevenueCat');
            
            setSubscription(updatedSubscription);
            localStorage.setItem(`${SUBSCRIPTION_STORAGE_KEY_PREFIX}${user?.id}`, JSON.stringify(updatedSubscription));
            setIsLoading(false);
            return;
          } else {
            // Backend already matches, just use it
            const normalized = normalizeSubscription(serverSubscription);
            setSubscription(normalized);
            localStorage.setItem(`subscription_${user?.id}`, JSON.stringify(normalized));
            setIsLoading(false);
            return;
          }
        } catch (syncError) {
          console.warn('Failed to sync RevenueCat status to backend:', syncError);
          // Continue with normal flow
        }
      }
      
      // If RevenueCat says Free, also sync to backend
      if (shouldSyncToBackend && rcStatus === 'free') {
        console.log('ℹ️ RevenueCat shows Free subscription - checking backend...');
        try {
          const serverSubscription = await api.getSubscription();
          const currentTier = serverSubscription?.tier || 'free';
          
          // If backend says Pro but RevenueCat says Free, update backend
          if (currentTier === 'pro') {
            console.log('🔄 Backend shows Pro but RevenueCat shows Free - syncing to Free...');
            const updatedSubscription: SubscriptionInfo = {
              tier: 'free',
              status: 'inactive',
              startDate: null,
              endDate: null,
              cancelAtPeriodEnd: false,
            };
            
            // Save to backend
            await api.saveSubscription(updatedSubscription);
            console.log('✅ Backend subscription updated to Free from RevenueCat');
            
            setSubscription(updatedSubscription);
            localStorage.setItem(`${SUBSCRIPTION_STORAGE_KEY_PREFIX}${user?.id}`, JSON.stringify(updatedSubscription));
            setIsLoading(false);
            return;
          }
        } catch (syncError) {
          console.warn('Failed to sync RevenueCat status to backend:', syncError);
          // Continue with normal flow
        }
      }
      
      // Fetch from database (fallback or when RevenueCat not configured)
      const serverSubscription = await api.getSubscription();
      
      if (serverSubscription) {
        const normalized = normalizeSubscription(serverSubscription);
        setSubscription(normalized);
        // Also save to localStorage for offline access
        localStorage.setItem(`subscription_${user?.id}`, JSON.stringify(normalized));
      } else {
        // Fallback to localStorage if server fails
        const stored = localStorage.getItem(`${SUBSCRIPTION_STORAGE_KEY_PREFIX}${user?.id}`);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            setSubscription(normalizeSubscription(parsed));
          } catch (parseError) {
            console.warn('Failed to parse stored subscription:', parseError);
            setSubscription(normalizeSubscription(null));
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load subscription from server, using fallback:', error);
      // Fallback to localStorage on error
      try {
        const stored = localStorage.getItem(`${SUBSCRIPTION_STORAGE_KEY_PREFIX}${user?.id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          setSubscription(normalizeSubscription(parsed));
        } else {
          // If no stored data, use default free tier
          setSubscription(normalizeSubscription(null));
        }
      } catch (e) {
        console.warn('Failed to load from localStorage, using default:', e);
        // Last resort: use default free tier
        setSubscription(normalizeSubscription(null));
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, accessToken]);

  const configureRevenueCat = useCallback(async () => {
    try {
      const { configureRevenueCat: initRevenueCat } = await import('../lib/revenuecat');
      if (user?.id) {
        await initRevenueCat(user.id);
      }
    } catch (error) {
      console.warn('RevenueCat initialization failed (this is OK for dev):', error);
    }
  }, [user?.id]);

  const refreshSubscription = useCallback(async () => {
    console.log('🔄 Refreshing subscription status from RevenueCat and backend...');
    
    // Ensure RevenueCat is configured before refreshing
    try {
      const { configureRevenueCat, isRevenueCatConfigured } = await import('../lib/revenuecat');
      if (!isRevenueCatConfigured() && user?.id) {
        console.log('🔄 RevenueCat not configured, configuring before refresh...');
        await configureRevenueCat(user.id);
      }
    } catch (configError) {
      console.warn('Failed to configure RevenueCat during refresh:', configError);
    }
    
    // Load subscription (which will sync from RevenueCat)
    await loadSubscription();
    console.log('✅ Subscription refresh complete');
  }, [loadSubscription, user?.id]);

  // Initial load when user logs in
  useEffect(() => {
    if (user && accessToken) {
      loadSubscription();
      // Initialize RevenueCat for this user
      configureRevenueCat();
    } else {
      setIsLoading(false);
    }
  }, [user, accessToken, loadSubscription, configureRevenueCat]);

  // Periodic subscription sync to prevent race conditions
  useEffect(() => {
    if (!user || !accessToken) return;

    // Sync every 5 minutes to catch webhook updates
    const syncInterval = setInterval(() => {
      console.log('Performing periodic subscription sync...');
      refreshSubscription().catch((error) => {
        console.warn('Periodic subscription sync failed:', error);
        // Don't show error to user for background sync
      });
    }, SUBSCRIPTION_SYNC_INTERVAL);

    // Also sync when window regains focus (user returns to app)
    const handleFocus = () => {
      console.log('Window focused, syncing subscription...');
      refreshSubscription().catch((error) => {
        console.warn('Focus subscription sync failed:', error);
      });
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, accessToken, refreshSubscription]);

  async function upgradeToPro() {
    try {
      // SECURITY: Check if we're in production
      const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';
      
      if (isProduction) {
        throw new Error(SUBSCRIPTION_UI_TEXT.context.upgradeNotAllowedProduction);
      }

      // Development/Testing fallback: Simulate upgrade
      // Note: This should ONLY be called from PricingDialog in development mode
      // Production uses RevenueCat (handled in PricingDialog)
      console.warn('⚠️  Using development-only upgrade method. This should not happen in production.');
      
      const newSubscription: SubscriptionInfo = {
        tier: 'pro',
        status: 'active',
        startDate: new Date().toISOString(),
        endDate: null, // null means ongoing subscription
        cancelAtPeriodEnd: false,
      };
      
      // Save to database
      await api.saveSubscription(newSubscription);
      
      setSubscription(newSubscription);
      localStorage.setItem(`subscription_${user?.id}`, JSON.stringify(newSubscription));
      
      toast.success(SUBSCRIPTION_UI_TEXT.context.upgradedDevMode);
      console.log(SUBSCRIPTION_UI_TEXT.context.upgradedDevMode);
    } catch (error) {
      console.error('Upgrade failed:', error);
      toast.error(SUBSCRIPTION_UI_TEXT.context.upgradeFailed);
      throw error;
    }
  }

  async function cancelSubscription() {
    try {
      const updatedSubscription: SubscriptionInfo = {
        ...subscription,
        cancelAtPeriodEnd: true,
      };
      
      // Save to database
      await api.saveSubscription(updatedSubscription);
      
      setSubscription(updatedSubscription);
      localStorage.setItem(`subscription_${user?.id}`, JSON.stringify(updatedSubscription));
      
      toast.success(SUBSCRIPTION_UI_TEXT.context.subscriptionWillCancelAtPeriodEnd);
      console.log(SUBSCRIPTION_UI_TEXT.context.subscriptionWillCancelAtPeriodEnd);
    } catch (error) {
      console.error('Cancellation failed:', error);
      toast.error(SUBSCRIPTION_UI_TEXT.context.cancelFailed);
      throw error;
    }
  }

  async function downgradeToFree() {
    try {
      const freeSubscription: SubscriptionInfo = {
        tier: 'free',
        status: 'inactive',
        startDate: null,
        endDate: null,
        cancelAtPeriodEnd: false,
      };
      
      // Save to database
      await api.saveSubscription(freeSubscription);
      
      setSubscription(freeSubscription);
      localStorage.setItem(`subscription_${user?.id}`, JSON.stringify(freeSubscription));
      
      toast.success(SUBSCRIPTION_UI_TEXT.context.downgradedToFree);
      console.log(SUBSCRIPTION_UI_TEXT.context.downgradedToFree);
    } catch (error) {
      console.error('Downgrade failed:', error);
      toast.error(SUBSCRIPTION_UI_TEXT.context.downgradeFailed);
      throw error;
    }
  }

  function hasFeature(feature: keyof SubscriptionFeatures): boolean {
    return features[feature];
  }

  return (
    <SubscriptionContext.Provider 
      value={{ 
        subscription, 
        features, 
        isLoading, 
        upgradeToPro, 
        cancelSubscription,
        downgradeToFree,
        refreshSubscription,
        hasFeature 
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error(SUBSCRIPTION_UI_TEXT.context.hookError);
  }
  return context;
}
