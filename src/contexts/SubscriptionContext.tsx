import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { SubscriptionInfo, SubscriptionTier, SubscriptionFeatures } from '../types';
import { useAuth } from './AuthContext';
import * as api from '../lib/api';
import { toast } from 'sonner';
import { SUBSCRIPTION_UI_TEXT, SUBSCRIPTION_STORAGE_KEY_PREFIX, SUBSCRIPTION_SYNC_INTERVAL } from '../lib/subscription-constants';
import { configureRevenueCat, resetRevenueCat, getCustomerInfo as getRevenueCatCustomerInfo, isRevenueCatConfigured } from '../lib/revenuecat';
import { DAYS_IN_MONTH_APPROX } from '../lib/business-constants';
import { createDefaultSubscriptionContext } from '../lib/context-defaults';

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

// Feature matrix based on tier and billing period
const getFeatures = (tier: SubscriptionTier, billingPeriod?: 'monthly' | 'yearly' | null): SubscriptionFeatures => {
  if (tier === 'pro') {
    const isYearly = billingPeriod === 'yearly';
    
    return {
      unlimitedTasks: true,
      customTags: true,
      aiScheduler: true,
      aiSchedulerLimit: undefined, // Unlimited for pro
      taskHours: true,
      analytics: true,
      analyticsDaysLimit: isYearly ? undefined : DAYS_IN_MONTH_APPROX, // Unlimited for yearly, DAYS_IN_MONTH_APPROX days for monthly
      taskRollover: true,
      pomodoroTimer: true, // Advanced for pro
      teamFeatures: isYearly, // Only for yearly
      teamMembersLimit: isYearly ? undefined : 0, // Unlimited for yearly, 0 for monthly
      calendarSync: true,
      calendarSyncLimit: isYearly ? undefined : 1, // Unlimited for yearly, 1 calendar for monthly
      // Recurring tasks available in both monthly and yearly, but with limits
      recurringTasks: true, // Available for all Pro users
      recurringTasksLimit: isYearly ? undefined : 5, // Unlimited for yearly, 5 active recurring tasks for monthly
      // Yearly-only advanced features
      taskTemplates: isYearly,
      taskDependencies: isYearly,
      multipleWorkspaces: isYearly,
    };
  }
  
  // Free tier
  return {
    unlimitedTasks: true,
    customTags: true,
    aiScheduler: true, // Limited - 3/week
    aiSchedulerLimit: 3, // 3 suggestions per week
    taskHours: false,
    analytics: false,
    analyticsDaysLimit: undefined, // No analytics for free
    taskRollover: false,
    pomodoroTimer: true, // Basic - no history/stats
    teamFeatures: false,
    teamMembersLimit: 0,
    calendarSync: false,
    // Yearly-only features - all false for free
    recurringTasks: false,
    taskTemplates: false,
    taskDependencies: false,
    multipleWorkspaces: false,
  };
};

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  
  // Initial state: Default to free tier (safe default)
  // NOTE: Actual subscription data comes from backend database (source of truth)
  // This is only a default until backend data is loaded
  // EXCEPTION: Demo users always get Pro tier (yearly) - set immediately
  const [subscription, setSubscription] = useState<SubscriptionInfo>(() => {
    // If user is a demo user, start with Pro tier (yearly) immediately
    if (user?.isDemo) {
      return {
        tier: 'pro',
        status: 'active',
        startDate: new Date().toISOString(),
        endDate: null,
        cancelAtPeriodEnd: false,
        billingPeriod: 'yearly',
      };
    }
    return {
      tier: 'free',
      status: 'active',
      startDate: null,
      endDate: null,
      cancelAtPeriodEnd: false,
    };
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
      billingPeriod: data?.billingPeriod || null, // monthly, yearly, or null
    };
  };

  // Derived features based on tier and billing period
  const features = getFeatures(subscription.tier, subscription.billingPeriod);

  // Configure RevenueCat whenever the user changes
  useEffect(() => {
    if (!user?.id) {
      resetRevenueCat();
      return;
    }

    configureRevenueCat(user.id).catch((error) => {
      console.warn('RevenueCat configuration failed (non-blocking):', error);
    });
  }, [user?.id]);

  const mergeSubscriptionWithRevenueCat = useCallback(async (current: SubscriptionInfo): Promise<SubscriptionInfo> => {
    if (!user?.id) return current;

    // DEMO USERS: Always return Pro tier (yearly) - don't check RevenueCat
    if (user.isDemo) {
      return {
        tier: 'pro',
        status: 'active',
        startDate: current.startDate || new Date().toISOString(),
        endDate: null,
        cancelAtPeriodEnd: false,
        billingPeriod: 'yearly',
      };
    }

    try {
      if (!isRevenueCatConfigured()) {
        await configureRevenueCat(user.id);
      }

      if (!isRevenueCatConfigured()) {
        return current;
      }

      const customerInfo = await getRevenueCatCustomerInfo();
      const entitlements = customerInfo?.entitlements?.active;
      if (!entitlements) return current;

      const proKey = Object.keys(entitlements).find((key) => key.toLowerCase().includes('pro'));
      if (!proKey) {
        return current;
      }

      const entitlement = entitlements[proKey];
      if (!entitlement) {
        return current;
      }

      // Determine billing period from product identifier
      // Check active subscriptions to see if it's monthly or yearly
      let billingPeriod: 'monthly' | 'yearly' | null = current.billingPeriod || null;
      
      // Try to detect from product identifier in active subscriptions
      const activeSubscriptions = customerInfo?.activeSubscriptions || {};
      const productIdentifiers = Object.keys(activeSubscriptions);
      
      for (const productId of productIdentifiers) {
        if (productId === REVENUECAT_YEARLY_PRODUCT_ID) {
          billingPeriod = 'yearly';
          break;
        } else if (productId === REVENUECAT_MONTHLY_PRODUCT_ID) {
          billingPeriod = 'monthly';
          break;
        }
      }
      
      // Fallback: check if product identifier contains "yearly" or "annual"
      if (!billingPeriod) {
        const allProductIds = [
          ...productIdentifiers,
          ...Object.values(activeSubscriptions).map((sub: any) => sub.productIdentifier).filter(Boolean),
        ];
        
        for (const productId of allProductIds) {
          const productIdLower = String(productId).toLowerCase();
          if (productIdLower.includes('yearly') || productIdLower.includes('annual') || productIdLower.includes('year')) {
            billingPeriod = 'yearly';
            break;
          } else if (productIdLower.includes('monthly') || productIdLower.includes('month')) {
            billingPeriod = 'monthly';
            break;
          }
        }
      }

      return {
        tier: 'pro',
        status: entitlement.willRenew ? 'active' : 'cancelled',
        startDate: entitlement.latestPurchaseDate?.toISOString?.() ?? current.startDate,
        endDate: entitlement.expirationDate?.toISOString?.() ?? current.endDate,
        cancelAtPeriodEnd: !entitlement.willRenew,
        billingPeriod: billingPeriod,
      };
    } catch (error) {
      console.warn('RevenueCat entitlement sync failed:', error);
      return current;
    }
  }, [user?.id]);

  const loadSubscription = useCallback(async () => {
    if (!user || !accessToken) return;
    try {
      setIsLoading(true);
      
      // SPECIAL HANDLING FOR DEMO USERS:
      // Demo users always get Pro tier (yearly) - clear any cached free tier data
      if (user.isDemo) {
        // Clear localStorage cache for demo users to force fresh fetch
        localStorage.removeItem(`${SUBSCRIPTION_STORAGE_KEY_PREFIX}${user.id}`);
        localStorage.removeItem(`subscription_${user.id}`);
        
        // Set Pro tier immediately for demo users
        const demoSubscription: SubscriptionInfo = {
          tier: 'pro',
          status: 'active',
          startDate: new Date().toISOString(),
          endDate: null,
          cancelAtPeriodEnd: false,
          billingPeriod: 'yearly',
        };
        setSubscription(demoSubscription);
        console.log('✅ Demo user detected - setting Pro tier (yearly) immediately');
      }
      
      // DATA SOURCE PRIORITY:
      // 1. Backend database (source of truth)
      // 2. localStorage (cache only, last resort for offline)
      
      // Fetch from database
      const serverSubscription = await api.getSubscription();
      
      if (serverSubscription) {
        const normalized = normalizeSubscription(serverSubscription);
        
        // FORCE Pro tier (yearly) for demo users even if backend returns something else
        if (user.isDemo) {
          normalized.tier = 'pro';
          normalized.status = 'active';
          normalized.billingPeriod = 'yearly';
          normalized.endDate = null;
          normalized.cancelAtPeriodEnd = false;
          if (!normalized.startDate) {
            normalized.startDate = new Date().toISOString();
          }
          console.log('✅ Demo user - forcing Pro tier (yearly) from backend response');
        }
        
        const merged = await mergeSubscriptionWithRevenueCat(normalized);
        setSubscription(merged);
        // Cache in localStorage for offline access (but not for demo users to prevent stale cache)
        if (!user.isDemo) {
          localStorage.setItem(`subscription_${user?.id}`, JSON.stringify(merged));
        }
      } else {
        // Fallback to localStorage cache if server fails (last resort)
        // BUT: Skip cache for demo users - they should always get Pro tier
        if (user.isDemo) {
          const demoSubscription: SubscriptionInfo = {
            tier: 'pro',
            status: 'active',
            startDate: new Date().toISOString(),
            endDate: null,
            cancelAtPeriodEnd: false,
            billingPeriod: 'yearly',
          };
          const merged = await mergeSubscriptionWithRevenueCat(demoSubscription);
          setSubscription(merged);
          console.log('✅ Demo user - using Pro tier (yearly) fallback');
        } else {
          const stored = localStorage.getItem(`${SUBSCRIPTION_STORAGE_KEY_PREFIX}${user?.id}`);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              const merged = await mergeSubscriptionWithRevenueCat(normalizeSubscription(parsed));
              setSubscription(merged);
            } catch (parseError) {
              console.warn('Failed to parse stored subscription:', parseError);
              const fallback = await mergeSubscriptionWithRevenueCat(normalizeSubscription(null));
              setSubscription(fallback);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load subscription from server, using localStorage cache:', error);
      // Fallback to localStorage cache on error (last resort)
      // BUT: Demo users always get Pro tier (yearly)
      if (user.isDemo) {
        const demoSubscription: SubscriptionInfo = {
          tier: 'pro',
          status: 'active',
          startDate: new Date().toISOString(),
          endDate: null,
          cancelAtPeriodEnd: false,
          billingPeriod: 'yearly',
        };
        const merged = await mergeSubscriptionWithRevenueCat(demoSubscription);
        setSubscription(merged);
        console.log('✅ Demo user - using Pro tier (yearly) error fallback');
      } else {
        try {
          const stored = localStorage.getItem(`${SUBSCRIPTION_STORAGE_KEY_PREFIX}${user?.id}`);
          if (stored) {
            const parsed = JSON.parse(stored);
            const merged = await mergeSubscriptionWithRevenueCat(normalizeSubscription(parsed));
            setSubscription(merged);
          } else {
            // If no stored cache, use default free tier (safe default)
            const fallback = await mergeSubscriptionWithRevenueCat(normalizeSubscription(null));
            setSubscription(fallback);
          }
        } catch (e) {
          console.warn('Failed to load from localStorage cache, using default:', e);
          // Last resort: use default free tier (safe default)
          const fallback = await mergeSubscriptionWithRevenueCat(normalizeSubscription(null));
          setSubscription(fallback);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, accessToken, mergeSubscriptionWithRevenueCat]);

  const refreshSubscription = useCallback(async () => {
    console.log('🔄 Refreshing subscription status from backend...');
    
    // Load subscription from backend
    await loadSubscription();
    console.log('✅ Subscription refresh complete');
  }, [loadSubscription]);

  // Initial load when user logs in
  useEffect(() => {
    if (user && accessToken) {
      // For demo users, immediately set Pro tier (yearly) before loading from server
      if (user.isDemo) {
        const demoSubscription: SubscriptionInfo = {
          tier: 'pro',
          status: 'active',
          startDate: new Date().toISOString(),
          endDate: null,
          cancelAtPeriodEnd: false,
          billingPeriod: 'yearly',
        };
        setSubscription(demoSubscription);
        console.log('✅ Demo user logged in - setting Pro tier (yearly) immediately');
      }
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
    // During React Fast Refresh (HMR), providers can temporarily unmount
    // Return a safe default instead of throwing to prevent crashes
    if (import.meta.env.DEV) {
      console.warn('useSubscription called outside SubscriptionProvider (likely HMR issue), returning default');
      return createDefaultSubscriptionContext();
    }
    throw new Error(SUBSCRIPTION_UI_TEXT.context.hookError);
  }
  return context;
}
