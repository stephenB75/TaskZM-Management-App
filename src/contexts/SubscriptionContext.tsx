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
  
  // Initial state: Default to free tier (safe default)
  // NOTE: Actual subscription data comes from backend database (source of truth)
  // This is only a default until backend data is loaded
  const [subscription, setSubscription] = useState<SubscriptionInfo>({
    tier: 'free',
    status: 'active',
    startDate: null,
    endDate: null,
    cancelAtPeriodEnd: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Normalize subscription data to ensure all fields exist
  // NOTE: Defaults are only used if data is missing - actual data comes from backend
  const normalizeSubscription = (data: any): SubscriptionInfo => {
    return {
      tier: data?.tier || 'free', // Default to free if no data (backend is source of truth)
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
      
      // DATA SOURCE PRIORITY:
      // 1. Backend database (source of truth)
      // 2. localStorage (cache only, last resort for offline)
      
      // Fetch from database
      const serverSubscription = await api.getSubscription();
      
      if (serverSubscription) {
        const normalized = normalizeSubscription(serverSubscription);
        setSubscription(normalized);
        // Cache in localStorage for offline access
        localStorage.setItem(`subscription_${user?.id}`, JSON.stringify(normalized));
      } else {
        // Fallback to localStorage cache if server fails (last resort)
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
      console.warn('Failed to load subscription from server, using localStorage cache:', error);
      // Fallback to localStorage cache on error (last resort)
      try {
        const stored = localStorage.getItem(`${SUBSCRIPTION_STORAGE_KEY_PREFIX}${user?.id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          setSubscription(normalizeSubscription(parsed));
        } else {
          // If no stored cache, use default free tier (safe default)
          setSubscription(normalizeSubscription(null));
        }
      } catch (e) {
        console.warn('Failed to load from localStorage cache, using default:', e);
        // Last resort: use default free tier (safe default)
        setSubscription(normalizeSubscription(null));
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, accessToken]);

  const refreshSubscription = useCallback(async () => {
    console.log('🔄 Refreshing subscription status from backend...');
    
    // Load subscription from backend
    await loadSubscription();
    console.log('✅ Subscription refresh complete');
  }, [loadSubscription]);

  // Initial load when user logs in
  useEffect(() => {
    if (user && accessToken) {
      loadSubscription();
    } else {
      setIsLoading(false);
    }
  }, [user, accessToken, loadSubscription]);

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
      // Production uses backend payment processing (handled in PricingDialog)
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
