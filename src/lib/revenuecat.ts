/**
 * RevenueCat Integration for Cross-Platform Subscriptions
 * Handles web (Stripe), iOS (Apple IAP), and Android (Google Play)
 */

import { getPlatform } from './platform';

// Types
export interface CustomerInfo {
  activeSubscriptions: string[];
  entitlements: {
    active: Record<string, EntitlementInfo>;
    all: Record<string, EntitlementInfo>;
  };
  originalAppUserId: string;
  requestDate: string;
}

export interface EntitlementInfo {
  identifier: string;
  isActive: boolean;
  willRenew: boolean;
  productIdentifier: string;
  expirationDate: string | null;
}

export interface RevenueCatOffering {
  identifier: string;
  availablePackages: RevenueCatPackage[];
}

export interface RevenueCatPackage {
  identifier: string;
  product: {
    identifier: string;
    price: number;
    priceString: string;
    currencyCode: string;
    title: string;
    description: string;
  };
}

// Configuration state
let isConfigured = false;
let currentUserId: string | null = null;

/**
 * Configure RevenueCat for the current platform
 * Safe to call multiple times - only configures once per user
 */
export async function configureRevenueCat(userId: string): Promise<void> {
  if (isConfigured && currentUserId === userId) {
    console.log('✅ RevenueCat already configured for user:', userId);
    return;
  }

  const platform = getPlatform();
  console.log(`🔄 Configuring RevenueCat for platform: ${platform.platform}, user: ${userId}`);

  try {
    if (platform.isWeb) {
      // Web: Use RevenueCat Purchases JS SDK with Stripe
      
      // Get public API key from environment
      // Try multiple ways to access it in case of build/runtime differences
      const env = (import.meta as any).env || {};
      let apiKey = env.VITE_REVENUECAT_WEB_PUBLIC_KEY;
      
      // Fallback: try direct access
      if (!apiKey && (window as any).__VITE_ENV__) {
        apiKey = (window as any).__VITE_ENV__.VITE_REVENUECAT_WEB_PUBLIC_KEY;
      }
      
      // Debug: Log all environment variables that start with VITE_ (for debugging)
      if (!apiKey) {
        const allEnvKeys = Object.keys(env).filter((key: string) => key.startsWith('VITE_'));
        const isProd = env.MODE === 'production' || env.PROD === true;
        console.log('🔍 Debug: Available VITE_ environment variables:', allEnvKeys);
        console.log('🔍 Debug: import.meta.env keys:', Object.keys(env));
        console.log('🔍 Debug: Mode:', env.MODE, '| PROD:', env.PROD, '| DEV:', env.DEV);
        console.log('🔍 Debug: Is Production Build:', isProd);
        console.log('🔍 Debug: Direct access test:', env.VITE_REVENUECAT_WEB_PUBLIC_KEY);
        console.log('🔍 Debug: Full env object (first 500 chars):', JSON.stringify(env).substring(0, 500));
        
        if (isProd) {
          console.warn('⚠️  Running in PRODUCTION mode - .env file is NOT used!');
          console.warn('   Environment variables must be set in your hosting platform:');
          console.warn('   - Railway: Project Settings → Variables');
          console.warn('   - Vercel: Project Settings → Environment Variables');
          console.warn('   - Netlify: Site Settings → Environment Variables');
          console.warn('   Add: VITE_REVENUECAT_WEB_PUBLIC_KEY=rcb_OXJjKGSEpjpdaauCINwqRtgBeeKN');
        }
      }
      
      // Check if API key is missing or is a placeholder
      if (!apiKey || apiKey === 'dev_mode_placeholder' || (typeof apiKey === 'string' && apiKey.trim() === '')) {
        console.log('ℹ️  RevenueCat API key not found in environment variables');
        console.log('   Payment mode: SIMULATED (no real charges)');
        console.log('   To enable: Add VITE_REVENUECAT_WEB_PUBLIC_KEY to .env file');
        console.log('   📝 Instructions:');
        console.log('      1. Create a .env file in the project root (same level as package.json)');
        console.log('      2. Add: VITE_REVENUECAT_WEB_PUBLIC_KEY=rc_your_key_here');
        console.log('      3. Restart the dev server (npm run dev)');
        console.log('   🔍 Current API key value:', apiKey || 'undefined');
        return;
      }

      // Validate API key format (should start with 'rc_' or 'rcb_' for web)
      if (!apiKey.startsWith('rc_') && !apiKey.startsWith('rcb_')) {
        console.warn('⚠️  RevenueCat API key format appears invalid (should start with "rc_" or "rcb_")');
        console.warn('   Payment mode: SIMULATED (no real charges)');
        console.warn('   Current key format:', apiKey.substring(0, 5) + '...');
        return;
      }
      
      console.log('📦 RevenueCat API key found, initializing SDK...');
      
      // Try to import and configure RevenueCat
      try {
        const Purchases = await import('@revenuecat/purchases-js');
        
        // Wrap configuration in try-catch to handle any initialization errors
        try {
          await Purchases.configure({
            apiKey,
            appUserID: userId
          });
          
          console.log('✅ RevenueCat configured successfully');
          console.log('   Payment processing: ENABLED');
          console.log('   User ID:', userId);
          isConfigured = true;
          currentUserId = userId;
        } catch (configError: any) {
          // Handle configuration errors gracefully
          console.error('❌ RevenueCat configuration failed:', configError?.message || configError);
          console.warn('   Payment mode: SIMULATED (no real charges)');
          console.warn('   Check your API key and RevenueCat dashboard settings');
          // Don't set isConfigured to true if configuration failed
          return;
        }
      } catch (importError) {
        console.error('❌ RevenueCat SDK import failed:', importError);
        console.log('ℹ️  RevenueCat SDK not installed');
        console.log('   Payment mode: SIMULATED (no real charges)');
        console.log('   To enable real payments: npm install @revenuecat/purchases-js');
        // Don't throw, just continue without RevenueCat
        return;
      }
    } else {
      // iOS/Android: Native SDK is auto-configured in native code
      // Just verify it's available
      const Capacitor = (window as any).Capacitor;
      const Purchases = Capacitor?.Plugins?.Purchases;
      
      if (!Purchases) {
        console.warn('⚠️  RevenueCat native plugin not found, running in web fallback mode');
        return;
      }
      
      // Set user ID on native SDK
      await Purchases.logIn({ appUserID: userId });
      console.log(`✅ RevenueCat configured for ${platform.platform}`);
      isConfigured = true;
      currentUserId = userId;
    }
  } catch (error) {
    console.error('❌ Failed to configure RevenueCat:', error);
    console.warn('   App will continue to work with legacy payment flow');
    // Don't throw - allow app to continue without RevenueCat
  }
}

/**
 * Get current customer subscription status
 * Returns 'pro' or 'free' based on active entitlements
 */
export async function getSubscriptionStatus(): Promise<'pro' | 'free'> {
  // If RevenueCat not configured, return free
  if (!isConfigured) {
    console.warn('RevenueCat not configured, defaulting to free tier');
    return 'free';
  }

  try {
    const platform = getPlatform();

    if (platform.isWeb) {
      try {
        const Purchases = await import('@revenuecat/purchases-js');
        const customerInfo = await Purchases.getCustomerInfo();
        
        // Check for active 'pro' entitlement
        const isProActive = customerInfo.entitlements.active.pro !== undefined;
        return isProActive ? 'pro' : 'free';
      } catch (importError) {
        console.warn('RevenueCat not available, defaulting to free');
        return 'free';
      }
    } else {
      // Native platforms
      const Capacitor = (window as any).Capacitor;
      const Purchases = Capacitor?.Plugins?.Purchases;
      
      if (!Purchases) {
        console.warn('RevenueCat not available, defaulting to free');
        return 'free';
      }
      
      const { customerInfo } = await Purchases.getCustomerInfo();
      const isProActive = customerInfo.entitlements.active.pro !== undefined;
      return isProActive ? 'pro' : 'free';
    }
  } catch (error) {
    console.error('Failed to get subscription status:', error);
    return 'free'; // Safe fallback
  }
}

/**
 * Purchase Pro subscription
 * Automatically uses correct payment method based on platform
 * @param packageType - 'monthly' or 'yearly' subscription package
 */
export async function purchaseProSubscription(packageType: 'monthly' | 'yearly' = 'monthly'): Promise<boolean> {
  // If RevenueCat not configured, try to configure it first
  if (!isConfigured) {
    console.warn('⚠️ RevenueCat not configured, attempting to configure before purchase...');
    
    // Try to get user ID from current context
    // If we have a stored user ID, use it
    if (currentUserId) {
      console.log('🔄 Re-configuring RevenueCat with stored user ID:', currentUserId);
      try {
        await configureRevenueCat(currentUserId);
      } catch (configError) {
        console.error('❌ Failed to configure RevenueCat:', configError);
        throw new Error('RevenueCat not configured. Please ensure you are logged in and RevenueCat API key is set.');
      }
    } else {
      // No user ID available - configuration must happen on login
      console.error('❌ RevenueCat not configured and no user ID available');
      throw new Error('RevenueCat not configured. Please refresh the page and try again.');
    }
    
    // Check again after configuration attempt
    if (!isConfigured) {
      throw new Error('RevenueCat configuration failed. Please check your API key and try again.');
    }
  }

  try {
    const platform = getPlatform();
    console.log(`Initiating ${packageType} purchase on ${platform.platform}`);

    if (platform.isWeb) {
      // Web: Use Stripe via RevenueCat
      try {
        const Purchases = await import('@revenuecat/purchases-js');
        
        const offerings = await Purchases.getOfferings();
        if (!offerings || !offerings.current) {
          throw new Error('No subscription offerings available');
        }
        
        // Safely access availablePackages with null check
        const availablePackages = offerings.current.availablePackages || [];
        if (availablePackages.length === 0) {
          throw new Error('No subscription packages available');
        }
        
        // Find the requested package
        const packageIdentifier = packageType === 'yearly' 
          ? ['$rc_annual', '$rc_yearly', 'annual', 'yearly']
          : ['$rc_monthly', 'monthly'];
        
        const selectedPackage = availablePackages.find(
          (pkg: any) => pkg && packageIdentifier.includes(pkg.identifier)
        );
        
        if (!selectedPackage) {
          throw new Error(`${packageType} subscription not found`);
        }
        
        const { customerInfo } = await Purchases.purchasePackage(selectedPackage);
        
        // Check if purchase was successful
        const isProActive = customerInfo?.entitlements?.active?.pro !== undefined;
        console.log(`Web ${packageType} purchase result:`, isProActive ? 'success' : 'failed');
        return isProActive;
      } catch (importError) {
        throw new Error('RevenueCat SDK not available - using fallback payment method');
      }
    } else {
      // Native platforms (iOS/Android)
      const Capacitor = (window as any).Capacitor;
      const Purchases = Capacitor?.Plugins?.Purchases;
      
      if (!Purchases) {
        throw new Error('RevenueCat native plugin not available');
      }
      
      const { offerings } = await Purchases.getOfferings();
      if (!offerings.current) {
        throw new Error('No subscription offerings available');
      }
      
      // Find the requested package
      const packageIdentifier = packageType === 'yearly' 
        ? ['$rc_annual', '$rc_yearly', 'annual', 'yearly']
        : ['$rc_monthly', 'monthly'];
      
      const selectedPackage = offerings.current.availablePackages.find(
        (pkg: any) => packageIdentifier.includes(pkg.identifier)
      );
      
      if (!selectedPackage) {
        throw new Error(`${packageType} subscription not found`);
      }
      
      const { customerInfo } = await Purchases.purchasePackage({ 
        aPackage: selectedPackage 
      });
      
      const isProActive = customerInfo.entitlements.active.pro !== undefined;
      console.log(`${platform.platform} ${packageType} purchase result:`, isProActive ? 'success' : 'failed');
      return isProActive;
    }
  } catch (error: any) {
    // Handle user cancellation gracefully
    if (error.message?.includes('user cancelled') || error.userCancelled) {
      console.log('User cancelled purchase');
      return false;
    }
    
    console.error('Purchase failed:', error);
    throw error;
  }
}

/**
 * Restore previous purchases
 * Required by Apple for subscription apps
 */
export async function restorePurchases(): Promise<boolean> {
  // If RevenueCat not configured, return false
  if (!isConfigured) {
    console.warn('RevenueCat not configured, cannot restore purchases');
    return false;
  }

  try {
    const platform = getPlatform();
    console.log(`Restoring purchases on ${platform.platform}`);

    if (platform.isWeb) {
      // Web: Just check current status (no restore needed for Stripe)
      const status = await getSubscriptionStatus();
      return status === 'pro';
    } else {
      // Native platforms
      const Capacitor = (window as any).Capacitor;
      const Purchases = Capacitor?.Plugins?.Purchases;
      
      if (!Purchases) {
        throw new Error('RevenueCat native plugin not available');
      }
      
      const { customerInfo } = await Purchases.restorePurchases();
      const isProActive = customerInfo.entitlements.active.pro !== undefined;
      console.log('Restore result:', isProActive ? 'restored' : 'no active subscription');
      return isProActive;
    }
  } catch (error) {
    console.error('Failed to restore purchases:', error);
    throw error;
  }
}

/**
 * Get available offerings/packages
 */
export async function getOfferings(): Promise<RevenueCatOffering | null> {
  // If RevenueCat not configured, return null
  if (!isConfigured) {
    console.warn('⚠️ RevenueCat not configured, no offerings available');
    console.warn('   isConfigured:', isConfigured);
    console.warn('   currentUserId:', currentUserId);
    return null;
  }

  try {
    const platform = getPlatform();
    console.log(`🔄 Fetching offerings from RevenueCat (platform: ${platform.platform})...`);

    if (platform.isWeb) {
      try {
        const Purchases = await import('@revenuecat/purchases-js');
        console.log('📦 RevenueCat SDK imported successfully');
        
        const offerings = await Purchases.getOfferings();
        console.log('📋 Raw offerings response:', offerings);
        
        // Safely return offerings with null checks
        if (!offerings) {
          console.warn('⚠️ RevenueCat returned null/undefined offerings');
          return null;
        }
        
        if (!offerings.current) {
          console.warn('⚠️ RevenueCat has no current offering');
          console.warn('   Available offerings:', Object.keys(offerings));
          console.warn('   Check RevenueCat dashboard to ensure an offering is set as "current"');
          return null;
        }
        
        const currentOffering = offerings.current as any;
        console.log('✅ Current offering found:', currentOffering.identifier);
        console.log('📦 Available packages:', currentOffering.availablePackages?.length || 0);
        
        if (!currentOffering.availablePackages || currentOffering.availablePackages.length === 0) {
          console.warn('⚠️ Current offering has no packages');
          console.warn('   Check RevenueCat dashboard to ensure packages are attached to the offering');
          return null;
        }
        
        return currentOffering;
      } catch (importError: any) {
        console.error('❌ RevenueCat SDK import failed:', importError);
        console.error('   Error details:', importError.message || importError);
        return null;
      }
    } else {
      const Capacitor = (window as any).Capacitor;
      const Purchases = Capacitor?.Plugins?.Purchases;
      
      if (!Purchases) {
        console.warn('⚠️ RevenueCat native plugin not available');
        return null;
      }
      
      const { offerings } = await Purchases.getOfferings();
      return offerings.current;
    }
  } catch (error: any) {
    console.error('❌ Failed to get offerings:', error);
    console.error('   Error message:', error.message || error);
    console.error('   Error stack:', error.stack);
    return null;
  }
}

/**
 * Open customer management portal
 * For web: Opens Stripe billing portal
 * For native: Directs to App Store/Play Store
 * @param accessToken - User's access token for authentication (required for web)
 */
export async function openCustomerPortal(accessToken?: string): Promise<void> {
  const platform = getPlatform();

  if (platform.isWeb) {
    try {
      if (!accessToken) {
        throw new Error('Access token required to open billing portal');
      }

      // Get billing portal URL from backend
      const { projectId } = await import('../utils/supabase/info');
      const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-65e6e67f`;
      
      const response = await fetch(`${API_BASE}/create-billing-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create billing portal session');
      }

      const { url } = await response.json();
      if (url) {
        window.open(url, '_blank');
      } else {
        throw new Error('No billing portal URL received');
      }
    } catch (error) {
      console.error('Failed to open billing portal:', error);
      throw error;
    }
  } else if (platform.isIOS) {
    // iOS: Open App Store subscriptions
    const url = 'https://apps.apple.com/account/subscriptions';
    window.open(url, '_system');
  } else if (platform.isAndroid) {
    // Android: Open Play Store subscriptions
    const url = 'https://play.google.com/store/account/subscriptions';
    window.open(url, '_system');
  }
}

/**
 * Check if RevenueCat is properly configured
 */
export function isRevenueCatConfigured(): boolean {
  return isConfigured;
}

/**
 * Get current user ID
 */
export function getCurrentUserId(): string | null {
  return currentUserId;
}

/**
 * Reset configuration (for logout)
 */
export function resetRevenueCat(): void {
  isConfigured = false;
  currentUserId = null;
  console.log('RevenueCat configuration reset');
}
