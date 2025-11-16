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

export interface RevenueCatOfferings {
  current: RevenueCatOffering | null;
  all: Record<string, RevenueCatOffering>;
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

// Expected RevenueCat App ID for verification
// This should match the app ID in your RevenueCat dashboard
const EXPECTED_REVENUECAT_APP_ID = 'app4689b9299f';

/**
 * Configure RevenueCat for the current platform
 * Safe to call multiple times - only configures once per user
 */
export async function configureRevenueCat(userId: string, forceReconfigure: boolean = false): Promise<void> {
  // Check if we need to reconfigure (new user, force flag, or API key changed)
  const env = (import.meta as any).env || {};
  const currentApiKey = env.VITE_REVENUECAT_WEB_PUBLIC_KEY;
  
  // If already configured for same user and not forcing, check if API key changed
  if (isConfigured && currentUserId === userId && !forceReconfigure) {
    // Check if API key has changed (would require reconfiguration)
    // Note: We can't easily detect this without storing the old key, so we'll reconfigure if forced
    console.log('✅ RevenueCat already configured for user:', userId);
    return;
  }
  
  // If forcing reconfiguration or user changed, reset state
  if (forceReconfigure || (isConfigured && currentUserId !== userId)) {
    isConfigured = false;
    currentUserId = null;
    console.log('🔄 Resetting RevenueCat configuration...');
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
      
      if (!apiKey) {
        const isProd = env.MODE === 'production' || env.PROD === true;
        if (isProd) {
          console.warn('⚠️ RevenueCat API key not found in production. Set VITE_REVENUECAT_WEB_PUBLIC_KEY in your hosting platform.');
        }
      }
      
      if (!apiKey || apiKey === 'dev_mode_placeholder' || (typeof apiKey === 'string' && apiKey.trim() === '')) {
        console.warn('⚠️ RevenueCat API key not found. Payment mode: SIMULATED');
        return;
      }

      // Validate API key format (should start with 'rc_' or 'rcb_' for web)
      if (!apiKey.startsWith('rc_') && !apiKey.startsWith('rcb_')) {
        console.error('❌ RevenueCat API key format is invalid');
        console.error('   Expected format: Starts with "rc_" or "rcb_"');
        console.error('   Current key format:', apiKey.substring(0, Math.min(10, apiKey.length)) + '...');
        console.error('   For web apps, use a PUBLIC API key (starts with "rcb_")');
        console.error('   Get your key from: RevenueCat Dashboard → Project Settings → API Keys');
        return;
      }
      
      // Log API key info (masked) for debugging
      const keyPrefix = apiKey.substring(0, 6);
      const keySuffix = apiKey.length > 10 ? apiKey.substring(apiKey.length - 4) : '****';
      console.log('🔑 Using RevenueCat API key:', `${keyPrefix}...${keySuffix} (${apiKey.length} chars)`);
      console.log('   Key type:', apiKey.startsWith('rcb_') ? 'PUBLIC (web)' : apiKey.startsWith('rc_') ? 'PUBLIC (legacy)' : 'UNKNOWN');
      console.log('   Expected app ID: app4689b9299f');
      
      // Initialize RevenueCat SDK
      
      // Try to import and configure RevenueCat
      try {
        const PurchasesModule = await import('@revenuecat/purchases-js');
        
        // The SDK exports a Purchases class - try to get it from default or named export
        const Purchases = (PurchasesModule.default?.Purchases || PurchasesModule.Purchases || PurchasesModule.default || PurchasesModule) as any;
        
        
        // Wrap configuration in try-catch to handle any initialization errors
        try {
          if (!Purchases || typeof Purchases.configure !== 'function') {
            throw new Error(`Purchases.configure is not a function. Purchases type: ${typeof Purchases}. Available: ${Purchases ? Object.keys(Purchases).join(', ') : 'none'}`);
          }
          
          if (!userId || userId.trim() === '') {
            throw new Error('User ID is required for RevenueCat configuration');
          }
          
          const purchasesInstance = Purchases.configure({
            apiKey,
            appUserId: userId
          });
          
          console.log('✅ RevenueCat configured successfully');
          
          isConfigured = true;
          currentUserId = userId;
        } catch (configError: any) {
          console.error('❌ RevenueCat configuration failed:', configError?.message || configError);
          return;
        }
      } catch (importError) {
        console.error('❌ RevenueCat SDK import failed:', importError);
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
        const PurchasesModule = await import('@revenuecat/purchases-js');
        const Purchases = (PurchasesModule.default?.Purchases || PurchasesModule.Purchases || PurchasesModule.default || PurchasesModule) as any;
        
        // Get the configured instance
        const purchasesInstance = Purchases.getSharedInstance();
        const customerInfo = await purchasesInstance.getCustomerInfo();
        
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
        const PurchasesModule = await import('@revenuecat/purchases-js');
        const Purchases = (PurchasesModule.default?.Purchases || PurchasesModule.Purchases || PurchasesModule.default || PurchasesModule) as any;
        
        // Get the configured instance
        const purchasesInstance = Purchases.getSharedInstance();
        
        // Try to get offerings - with retry logic
        let offerings = null;
        let retries = 2;
        
        while (retries > 0 && (!offerings || !offerings.current)) {
          offerings = await purchasesInstance.getOfferings();
          if (offerings && offerings.current) break;
          retries--;
          if (retries > 0) await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        if (!offerings || !offerings.current) {
          throw new Error('No subscription offerings available. Please check RevenueCat dashboard configuration.');
        }
        
        // Combine packages from current offering AND all offerings (same logic as getOfferings)
        // This ensures we find packages even if they're in a non-current offering
        const currentPackages = offerings.current?.availablePackages || [];
        const allOfferings = offerings.all || {};
        const allPackagesFromAllOfferings: any[] = [];
        
        // Add packages from current offering
        currentPackages.forEach((pkg: any) => {
          if (pkg && !allPackagesFromAllOfferings.find(p => p?.identifier === pkg?.identifier)) {
            allPackagesFromAllOfferings.push(pkg);
          }
        });
        
        // Add packages from all other offerings
        Object.values(allOfferings).forEach((offering: any) => {
          if (offering && offering.availablePackages) {
            offering.availablePackages.forEach((pkg: any) => {
              if (pkg && !allPackagesFromAllOfferings.find(p => p?.identifier === pkg?.identifier)) {
                allPackagesFromAllOfferings.push(pkg);
              }
            });
          }
        });
        
        const availablePackages = allPackagesFromAllOfferings;
        
        if (availablePackages.length === 0) {
          throw new Error('No subscription packages available in any offering. Please check RevenueCat dashboard.');
        }
        
        // Find the requested package
        // Import identifiers from constants for consistency
        const { MONTHLY_PACKAGE_IDENTIFIERS, YEARLY_PACKAGE_IDENTIFIERS } = await import('./subscription-constants');
        // Dynamic identifier detection: Extract identifiers from available packages
        // This replaces hardcoded identifier lists with actual identifiers from RevenueCat
        const discoveredMonthlyIds: string[] = [];
        const discoveredYearlyIds: string[] = [];
        
        availablePackages.forEach((pkg: any) => {
          if (!pkg) return;
          const identifier = pkg.identifier || '';
          const productId = pkg.product?.identifier || '';
          const productTitle = pkg.product?.title || '';
          const subscriptionPeriod = pkg.product?.subscriptionPeriod || '';
          const identifierLower = identifier.toLowerCase();
          const productIdLower = productId.toLowerCase();
          const productTitleLower = productTitle.toLowerCase();
          
          // Comprehensive monthly detection (same logic as PricingDialog)
          const looksMonthly = subscriptionPeriod === 'P1M' || 
                              subscriptionPeriod === 'MONTH' ||
                              (subscriptionPeriod && subscriptionPeriod.toString().toLowerCase().includes('month')) ||
                              identifierLower.includes('month') ||
                              productIdLower.includes('month') ||
                              productTitleLower.includes('month') ||
                              (identifierLower.includes('pro') && !identifierLower.includes('year') && !identifierLower.includes('annual') && !productTitleLower.includes('year') && !productTitleLower.includes('annual'));
          
          // Comprehensive yearly detection (same logic as PricingDialog)
          const looksYearly = subscriptionPeriod === 'P1Y' || 
                             subscriptionPeriod === 'YEAR' ||
                             subscriptionPeriod === 'ANNUAL' ||
                             (subscriptionPeriod && subscriptionPeriod.toString().toLowerCase().includes('year')) ||
                             identifierLower.includes('year') ||
                             identifierLower.includes('annual') ||
                             productIdLower.includes('year') ||
                             productIdLower.includes('annual') ||
                             productTitleLower.includes('year') ||
                             productTitleLower.includes('annual');
          
          if (looksMonthly && !looksYearly) {
            if (identifier) discoveredMonthlyIds.push(identifier);
            if (productId) discoveredMonthlyIds.push(productId);
          } else if (looksYearly) {
            if (identifier) discoveredYearlyIds.push(identifier);
            if (productId) discoveredYearlyIds.push(productId);
          }
        });
        
        const packageIdentifiers = packageType === 'yearly'
          ? (discoveredYearlyIds.length > 0 ? discoveredYearlyIds : YEARLY_PACKAGE_IDENTIFIERS)
          : (discoveredMonthlyIds.length > 0 ? discoveredMonthlyIds : MONTHLY_PACKAGE_IDENTIFIERS);
        
        // Use comprehensive matching logic (same as PricingDialog)
        // Try exact match first (package identifier, then product ID), then pattern matching, then metadata
        const selectedPackage = availablePackages.find((pkg: any) => {
          if (!pkg) return false;
          const identifier = pkg.identifier || '';
          const identifierLower = identifier.toLowerCase();
          const productId = pkg.product?.identifier || '';
          const productIdLower = productId.toLowerCase();
          const productTitle = pkg.product?.title || '';
          const productTitleLower = productTitle.toLowerCase();
          const subscriptionPeriod = pkg.product?.subscriptionPeriod || '';
          
          // Check exact matches on package identifier
          const exactIdentifierMatch = packageIdentifiers.some(id => {
            const idLower = id.toLowerCase();
            return identifierLower === idLower || 
                   identifierLower === idLower.replace('$', '') ||
                   identifierLower === idLower.replace('$rc_', 'rc_');
          });
          
          if (exactIdentifierMatch) return true;
          
          // Check exact match on product ID
          const exactProductIdMatch = packageIdentifiers.some(id => {
            const idLower = id.toLowerCase();
            return productIdLower === idLower;
          });
          
          if (exactProductIdMatch) return true;
          
          // Check against known RevenueCat product IDs
          const { REVENUECAT_MONTHLY_PRODUCT_ID, REVENUECAT_YEARLY_PRODUCT_ID } = await import('./subscription-constants');
          if (packageType === 'monthly' && productIdLower === REVENUECAT_MONTHLY_PRODUCT_ID.toLowerCase()) {
            return true;
          }
          if (packageType === 'yearly' && productIdLower === REVENUECAT_YEARLY_PRODUCT_ID.toLowerCase()) {
            return true;
          }
          
          // Check product title matching
          const titleMatch = packageIdentifiers.some(id => {
            const idLower = id.toLowerCase();
            if (packageType === 'monthly') {
              return productTitleLower.includes(idLower) && 
                     !productTitleLower.includes('year') &&
                     !productTitleLower.includes('annual');
            } else {
              return productTitleLower.includes(idLower);
            }
          });
          
          if (titleMatch) return true;
          
          // Check subscription period metadata
          if (packageType === 'monthly') {
            const isMonthlyByMetadata = subscriptionPeriod === 'P1M' || 
                                       subscriptionPeriod === 'MONTH' ||
                                       (subscriptionPeriod && subscriptionPeriod.toString().toLowerCase().includes('month'));
            if (isMonthlyByMetadata) return true;
          } else {
            const isYearlyByMetadata = subscriptionPeriod === 'P1Y' || 
                                      subscriptionPeriod === 'YEAR' ||
                                      subscriptionPeriod === 'ANNUAL' ||
                                      (subscriptionPeriod && subscriptionPeriod.toString().toLowerCase().includes('year'));
            if (isYearlyByMetadata) return true;
          }
          
          // Fallback to keyword matching
          if (packageType === 'monthly') {
            const hasMonthlyKeywords = (identifierLower.includes('month') || 
                                      identifierLower.includes('rc_monthly') ||
                                      productIdLower.includes('month') ||
                                      productTitleLower.includes('month')) && 
                                     !identifierLower.includes('year') && 
                                     !identifierLower.includes('annual') &&
                                     !productIdLower.includes('year') &&
                                     !productIdLower.includes('annual') &&
                                     !productTitleLower.includes('year') &&
                                     !productTitleLower.includes('annual');
            if (hasMonthlyKeywords) return true;
          } else {
            const hasYearlyKeywords = identifierLower.includes('year') || 
                                     identifierLower.includes('annual') ||
                                     identifierLower.includes('rc_yearly') ||
                                     identifierLower.includes('rc_annual') ||
                                     productIdLower.includes('year') ||
                                     productIdLower.includes('annual') ||
                                     productTitleLower.includes('year') ||
                                     productTitleLower.includes('annual');
            if (hasYearlyKeywords) return true;
          }
          
          return false;
        });
        
        if (!selectedPackage) {
          throw new Error(`${packageType} subscription package not found. Available packages: ${availablePackages.map((p: any) => p?.identifier || 'unknown').join(', ')}`);
        }
        
        // Validate package has product data before purchase
        // RevenueCat requires product data to process purchases
        if (!selectedPackage.product || !selectedPackage.product.identifier) {
          console.error('❌ Package missing product data - cannot proceed with purchase');
          console.error('   Package identifier:', selectedPackage.identifier);
          console.error('   Product object:', selectedPackage.product);
          console.error('   Attempting to refresh offerings to get product data...');
          
          try {
            // Sync and refresh to get product data
            await purchasesInstance.syncPurchases();
            await purchasesInstance.getCustomerInfo();
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Re-fetch offerings
            const refreshedOfferings = await purchasesInstance.getOfferings();
            const allRefreshedPackages: any[] = [];
            
            if (refreshedOfferings?.current?.availablePackages) {
              allRefreshedPackages.push(...refreshedOfferings.current.availablePackages);
            }
            if (refreshedOfferings?.all) {
              Object.values(refreshedOfferings.all).forEach((offering: any) => {
                if (offering?.availablePackages) {
                  allRefreshedPackages.push(...offering.availablePackages);
                }
              });
            }
            
            // Find the same package with product data
            const refreshedPackage = allRefreshedPackages.find((pkg: any) => 
              pkg?.identifier === selectedPackage.identifier && 
              pkg?.product?.identifier
            );
            
            if (refreshedPackage && refreshedPackage.product && refreshedPackage.product.identifier) {
              console.log('✅ Found package with product data after refresh');
              selectedPackage = refreshedPackage;
            } else {
              throw new Error('Product data is not available. Please ensure products are linked to packages in RevenueCat dashboard.');
            }
          } catch (refreshError: any) {
            console.error('❌ Could not refresh package data:', refreshError);
            throw new Error('Unable to load product information for purchase. Please check RevenueCat configuration: ensure products are created in Stripe, linked to packages in RevenueCat, and try again.');
          }
        }
        
        try {
          // Use purchasePackage method for web purchases
          // This will automatically open Stripe Checkout for web purchases
          console.log('🛒 Initiating purchase for package:', {
            identifier: selectedPackage.identifier,
            productId: selectedPackage.product?.identifier,
            priceString: selectedPackage.product?.priceString,
            hasProductData: !!selectedPackage.product,
            hasProductIdentifier: !!selectedPackage.product?.identifier
          });
          
          // Final validation before purchase
          if (!selectedPackage.identifier) {
            throw new Error('Invalid package: missing identifier');
          }
          
          if (!selectedPackage.product?.identifier) {
            throw new Error('Invalid package: missing product identifier. Please ensure products are linked to packages in RevenueCat dashboard.');
          }
          
          const purchaseResult = await purchasesInstance.purchasePackage(selectedPackage);
          
          // Handle the purchase result - it might be customerInfo directly or wrapped
          const customerInfo = purchaseResult?.customerInfo || purchaseResult;
          
          if (!customerInfo) {
            console.error('❌ No customerInfo returned from purchase');
            throw new Error('Purchase completed but no customer information received');
          }
        
          // Check if purchase was successful
          const isProActive = customerInfo?.entitlements?.active?.pro !== undefined;
          console.log(`✅ Web ${packageType} purchase result:`, isProActive ? 'SUCCESS' : 'FAILED');
          
          if (isProActive) {
            console.log('   ✅ Pro entitlement is now active');
            console.log('   Active entitlements:', Object.keys(customerInfo.entitlements?.active || {}));
          } else {
            console.warn('   ⚠️ Purchase completed but Pro entitlement not active');
            console.warn('   Available entitlements:', Object.keys(customerInfo.entitlements?.active || {}));
            console.warn('   All entitlements:', customerInfo.entitlements);
          }
          
          return isProActive;
        } catch (purchaseError: any) {
          console.error('❌ Purchase error details:', {
            name: purchaseError?.name,
            message: purchaseError?.message,
            code: purchaseError?.code,
            error: purchaseError
          });
          
          const errorName = purchaseError?.name || purchaseError?.constructor?.name || 'Unknown';
          const errorMessage = purchaseError?.message || purchaseError?.toString() || String(purchaseError) || 'Unknown error';
          const errorCode = purchaseError?.code || purchaseError?.errorCode || 'N/A';
          
          // Check for user cancellation first
          const isUserCancelled = purchaseError?.userCancelled || 
                                 purchaseError?.userCancelled === true ||
                                 errorMessage?.toLowerCase().includes('cancel') ||
                                 errorMessage?.toLowerCase().includes('cancelled') ||
                                 errorMessage?.toLowerCase().includes('user cancelled') ||
                                 errorName?.toLowerCase().includes('cancel') ||
                                 errorCode === 'USER_CANCELLED';
          
          if (isUserCancelled) {
            console.log('ℹ️ User cancelled the purchase');
            throw { ...purchaseError, userCancelled: true };
          }
          
          // Check for checkout/payment form errors
          const isCheckoutError = errorMessage?.toLowerCase().includes('checkout') || 
                                 errorMessage?.toLowerCase().includes('stripe') ||
                                 errorMessage?.toLowerCase().includes('payment form') ||
                                 errorMessage?.toLowerCase().includes('unable to open') ||
                                 errorMessage?.toLowerCase().includes('checkout_url') ||
                                 errorCode?.toString().includes('checkout');
          
          if (isCheckoutError) {
            console.error('❌ Checkout error:', errorMessage);
            throw new Error(`Checkout failed: ${errorMessage || 'Unable to open payment form. Please ensure popups are enabled and try again.'}`);
          }
          
          // Check for network errors
          const isNetworkError = errorMessage?.toLowerCase().includes('network') ||
                                errorMessage?.toLowerCase().includes('fetch') ||
                                errorMessage?.toLowerCase().includes('connection') ||
                                errorMessage?.toLowerCase().includes('timeout') ||
                                errorMessage?.toLowerCase().includes('failed to fetch');
          
          if (isNetworkError) {
            console.error('❌ Network error:', errorMessage);
            throw new Error(`Network error: ${errorMessage || 'Unable to connect to payment service. Please check your internet connection and try again.'}`);
          }
          
          // Check for unauthorized errors
          const isUnauthorized = errorMessage?.toLowerCase().includes('credentials') ||
                                errorMessage?.toLowerCase().includes('unauthorized') ||
                                errorMessage?.includes('401') ||
                                errorCode?.toString().includes('401');
          
          if (isUnauthorized) {
            console.error('❌ Unauthorized error:', errorMessage);
            throw new Error('RevenueCat API key is invalid or expired. Please check your API key in the RevenueCat dashboard and update VITE_REVENUECAT_WEB_PUBLIC_KEY.');
          }
          
          // Check for configuration errors
          const isConfigError = errorMessage?.toLowerCase().includes('not configured') ||
                               errorMessage?.toLowerCase().includes('not available') ||
                               errorMessage?.toLowerCase().includes('api key') ||
                               errorCode?.toString().includes('config');
          
          if (isConfigError) {
            console.error('❌ Configuration error:', errorMessage);
            throw new Error(`Configuration error: ${errorMessage || 'RevenueCat is not properly configured'}`);
          }
          
          // Enhanced error message
          const enhancedMessage = errorMessage !== 'Unknown error' && errorMessage !== 'Ie' 
            ? errorMessage 
            : `Purchase failed: ${errorName} (code: ${errorCode})`;
          
          console.error('❌ Purchase failed:', enhancedMessage);
          throw new Error(enhancedMessage);
        }
      } catch (importError: any) {
        if (importError?.message?.includes('not configured') || importError?.message?.includes('not available')) {
        throw new Error('RevenueCat SDK not available - using fallback payment method');
        }
        throw new Error(`Purchase failed: ${importError?.message || 'Unknown error occurred'}`);
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
      return isProActive;
    }
  } catch (error: any) {
    if (error.message?.includes('user cancelled') || error.userCancelled) {
      return false;
    }
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
      // Web: Use getCustomerInfo to restore (works for Stripe too)
      try {
        const PurchasesModule = await import('@revenuecat/purchases-js');
        const Purchases = (PurchasesModule.default?.Purchases || PurchasesModule.Purchases || PurchasesModule.default || PurchasesModule) as any;
        
        // Get the configured instance
        const purchasesInstance = Purchases.getSharedInstance();
        const customerInfo = await purchasesInstance.getCustomerInfo();
        const isProActive = customerInfo?.entitlements?.active?.pro !== undefined;
        return isProActive;
      } catch (error) {
        console.warn('Failed to restore purchases:', error);
        return false;
      }
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
 * @param forceRefresh - If true, forces a fresh fetch from RevenueCat (bypasses cache)
 */
export async function getOfferings(forceRefresh: boolean = false): Promise<RevenueCatOffering | null> {
  if (!isConfigured) {
    return null;
  }

  try {
    const platform = getPlatform();

    if (platform.isWeb) {
      try {
        const PurchasesModule = await import('@revenuecat/purchases-js');
        const Purchases = (PurchasesModule.default?.Purchases || PurchasesModule.Purchases || PurchasesModule.default || PurchasesModule) as any;
        const purchasesInstance = Purchases.getSharedInstance();
        
        // Fetch offerings from RevenueCat
        // If forceRefresh, sync first to clear cache
        if (forceRefresh) {
          try {
            await purchasesInstance.syncPurchases();
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error: any) {
            // Silently fail - sync is optional
          }
        }
        
        // Fetch offerings
        let offerings;
        try {
          offerings = await purchasesInstance.getOfferings();
        } catch (error: any) {
          const errorMessage = error?.message || String(error || '');
          const errorCode = error?.code || '';
          const isUnauthorized = errorMessage.includes('credentials') || 
                                errorMessage.includes('Unauthorized') ||
                                errorMessage.includes('401') ||
                                errorCode === '401';
          
          if (isUnauthorized) {
            console.error('❌ RevenueCat API credentials error (401 Unauthorized)');
            console.error('   This means your API key is invalid, expired, or has incorrect permissions.');
            console.error('   To fix:');
            console.error('   1. Go to RevenueCat Dashboard → Project Settings → API Keys');
            console.error('   2. Verify you are using the correct PUBLIC API key (starts with "rcb_" for web)');
            console.error('   3. Ensure the API key is for the correct app (app4689b9299f)');
            console.error('   4. Check that the API key has not been revoked or expired');
            console.error('   5. Update VITE_REVENUECAT_WEB_PUBLIC_KEY in your environment variables');
            console.error('   6. Restart your development server or rebuild your app');
            throw new Error('RevenueCat API key is invalid or expired. Please check your API key in the RevenueCat dashboard and update VITE_REVENUECAT_WEB_PUBLIC_KEY.');
          }
          
          // Re-throw other errors
          throw offeringsError;
        }
        
        // Log what we received for verification
        if (forceRefresh && offerings?.current) {
          console.log('✅ Fresh offerings received from RevenueCat:', {
            offeringId: offerings.current.identifier,
            packageCount: offerings.current.availablePackages?.length || 0,
            packageIdentifiers: offerings.current.availablePackages?.map((p: any) => p?.identifier || 'unknown') || [],
            timestamp: new Date().toISOString()
          });
        }
        
        if (!offerings?.current) {
          console.warn('⚠️ RevenueCat has no current offering');
          return null;
        }
        
        const currentOffering = offerings.current as any;
        let allPackages = [...(currentOffering.availablePackages || [])];
        
        // Combine packages from all offerings
        if (offerings.all && Object.keys(offerings.all).length > 1) {
          Object.entries(offerings.all).forEach(([key, offering]: [string, any]) => {
            if (offering?.availablePackages) {
              offering.availablePackages.forEach((pkg: any) => {
                if (pkg?.identifier && !allPackages.some((p: any) => p?.identifier === pkg.identifier)) {
                  allPackages.push(pkg);
                }
              });
            }
          });
        }
        
        if (allPackages.length === 0) {
          console.warn('⚠️ No packages found in any offering');
          return null;
        }
        
        currentOffering.availablePackages = allPackages;
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
