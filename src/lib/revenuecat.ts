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
        const PurchasesModule = await import('@revenuecat/purchases-js');
        
        // The SDK exports a Purchases class - try to get it from default or named export
        const Purchases = (PurchasesModule.default?.Purchases || PurchasesModule.Purchases || PurchasesModule.default || PurchasesModule) as any;
        
        // Debug: Log what we imported
        console.log('🔍 RevenueCat SDK imported:', {
          hasDefault: !!PurchasesModule.default,
          hasPurchasesClass: !!PurchasesModule.Purchases,
          hasConfigure: typeof Purchases?.configure === 'function',
          moduleKeys: Object.keys(PurchasesModule),
          PurchasesType: typeof Purchases,
          PurchasesKeys: Purchases ? Object.keys(Purchases).slice(0, 15) : []
        });
        
        // Wrap configuration in try-catch to handle any initialization errors
        try {
          if (!Purchases || typeof Purchases.configure !== 'function') {
            throw new Error(`Purchases.configure is not a function. Purchases type: ${typeof Purchases}. Available: ${Purchases ? Object.keys(Purchases).join(', ') : 'none'}`);
          }
          
          // Configure using the static method
          // Validate userId before passing
          if (!userId || userId.trim() === '') {
            throw new Error('User ID is required for RevenueCat configuration');
          }
          
          console.log('🔍 Configuring with userId:', userId.substring(0, 8) + '...');
          
          const purchasesInstance = Purchases.configure({
            apiKey,
            appUserId: userId  // Note: it's appUserId, not appUserID
          });
          
          console.log('✅ Purchases instance created:', !!purchasesInstance);
          
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
          console.log(`🔄 Fetching offerings from RevenueCat (${3 - retries}/3 attempts)...`);
          offerings = await purchasesInstance.getOfferings();
          
          if (offerings && offerings.current) {
            break;
          }
          
          retries--;
          if (retries > 0) {
            console.log('⚠️ No offerings found, retrying in 1 second...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        if (!offerings || !offerings.current) {
          console.error('❌ No subscription offerings available after retries');
          console.error('   This usually means:');
          console.error('   1. No offerings configured in RevenueCat dashboard');
          console.error('   2. No "current" offering is set in RevenueCat');
          console.error('   3. Products are not properly linked to packages');
          console.error('   Check RevenueCat dashboard: https://app.revenuecat.com');
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
          console.error('❌ No packages found in any offering');
          console.error('   Current offering packages:', currentPackages.length);
          console.error('   All offerings count:', Object.keys(allOfferings).length);
          console.error('   Current offering ID:', offerings.current?.identifier || 'N/A');
          throw new Error('No subscription packages available in any offering. Please check RevenueCat dashboard.');
        }
        
        console.log(`📦 Found ${availablePackages.length} package(s) total (${currentPackages.length} from current offering, ${availablePackages.length - currentPackages.length} from other offerings)`);
        console.log('   Package identifiers:', availablePackages.map((p: any) => p?.identifier || 'unknown'));
        console.log('   Current offering:', offerings.current?.identifier || 'N/A');
        if (Object.keys(allOfferings).length > 0) {
          console.log('   Other offerings:', Object.keys(allOfferings).join(', '));
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
            console.log(`   ✅ Discovered monthly package: ${identifier} (productId: ${productId}, title: ${productTitle})`);
          } else if (looksYearly) {
            if (identifier) discoveredYearlyIds.push(identifier);
            if (productId) discoveredYearlyIds.push(productId);
            console.log(`   ✅ Discovered yearly package: ${identifier} (productId: ${productId}, title: ${productTitle})`);
          } else {
            console.log(`   ⚠️ Package ${identifier} could not be categorized as monthly or yearly`);
            console.log(`      - subscriptionPeriod: ${subscriptionPeriod}`);
            console.log(`      - identifier: ${identifier}`);
            console.log(`      - productId: ${productId}`);
            console.log(`      - productTitle: ${productTitle}`);
          }
        });
        
        // Combine discovered identifiers with fallback identifiers
        const packageIdentifiers = packageType === 'yearly' 
          ? [...new Set([...discoveredYearlyIds, ...YEARLY_PACKAGE_IDENTIFIERS])]
          : [...new Set([...discoveredMonthlyIds, ...MONTHLY_PACKAGE_IDENTIFIERS])];
        
        console.log(`🔍 Dynamic package matching for ${packageType}:`, {
          discovered: packageType === 'yearly' ? discoveredYearlyIds : discoveredMonthlyIds,
          fallback: packageType === 'yearly' ? YEARLY_PACKAGE_IDENTIFIERS : MONTHLY_PACKAGE_IDENTIFIERS,
          combined: packageIdentifiers
        });
        
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
          
          // Check exact matches on package identifier (with and without $ prefix)
          const exactIdentifierMatch = packageIdentifiers.some(id => {
            const idLower = id.toLowerCase();
            return identifierLower === idLower || 
                   identifierLower === idLower.replace('$', '') ||
                   identifierLower === idLower.replace('$rc_', 'rc_');
          });
          
          if (exactIdentifierMatch) {
            console.log(`   ✅ Matched by identifier: ${identifier}`);
            return true;
          }
          
          // Check exact match on product ID (most reliable for Stripe/App Store products)
          const exactProductIdMatch = packageIdentifiers.some(id => {
            const idLower = id.toLowerCase();
            return productIdLower === idLower;
          });
          
          if (exactProductIdMatch) {
            console.log(`   ✅ Matched by product ID: ${productId}`);
            return true;
          }
          
          // Check product title matching (for cases like "TaskZM Yearly Yearly")
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
          
          if (titleMatch) {
            console.log(`   ✅ Matched by product title: ${productTitle}`);
            return true;
          }
          
          // Check subscription period metadata
          if (packageType === 'monthly') {
            const isMonthlyByMetadata = subscriptionPeriod === 'P1M' || 
                                       subscriptionPeriod === 'MONTH' ||
                                       (subscriptionPeriod && subscriptionPeriod.toString().toLowerCase().includes('month'));
            if (isMonthlyByMetadata) {
              console.log(`   ✅ Matched by subscription period (monthly): ${subscriptionPeriod}`);
              return true;
            }
          } else {
            const isYearlyByMetadata = subscriptionPeriod === 'P1Y' || 
                                      subscriptionPeriod === 'YEAR' ||
                                      subscriptionPeriod === 'ANNUAL' ||
                                      (subscriptionPeriod && subscriptionPeriod.toString().toLowerCase().includes('year'));
            if (isYearlyByMetadata) {
              console.log(`   ✅ Matched by subscription period (yearly): ${subscriptionPeriod}`);
              return true;
            }
          }
          
          // Fallback to keyword matching on identifier and product fields
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
            if (hasMonthlyKeywords) {
              console.log(`   ✅ Matched by keywords (monthly): identifier=${identifier}, productId=${productId}, title=${productTitle}`);
              return true;
            }
          } else {
            const hasYearlyKeywords = identifierLower.includes('year') || 
                                     identifierLower.includes('annual') ||
                                     identifierLower.includes('rc_yearly') ||
                                     identifierLower.includes('rc_annual') ||
                                     productIdLower.includes('year') ||
                                     productIdLower.includes('annual') ||
                                     productTitleLower.includes('year') ||
                                     productTitleLower.includes('annual');
            if (hasYearlyKeywords) {
              console.log(`   ✅ Matched by keywords (yearly): identifier=${identifier}, productId=${productId}, title=${productTitle}`);
              return true;
            }
          }
          
          return false;
        });
        
        if (!selectedPackage) {
          console.error(`❌ ${packageType} subscription package not found`);
          console.error('   Available package identifiers:', availablePackages.map((p: any) => p?.identifier || 'unknown'));
          console.error('   Looking for:', packageIdentifiers);
          throw new Error(`${packageType} subscription package not found. Available packages: ${availablePackages.map((p: any) => p?.identifier || 'unknown').join(', ')}`);
        }
        
        console.log(`✅ Found ${packageType} package:`, selectedPackage.identifier);
        console.log('📦 Package details:', {
          identifier: selectedPackage.identifier,
          productId: selectedPackage.product?.identifier,
          priceString: selectedPackage.product?.priceString,
          title: selectedPackage.product?.title
        });
        
        // For web, RevenueCat will open Stripe Checkout automatically
        // The purchase method should handle the checkout flow and return customerInfo when complete
        console.log('🔄 Initiating Stripe Checkout via RevenueCat...');
        console.log('   This will open a Stripe Checkout form where users can enter payment details');
        
        try {
          // Use the instance method for purchase (reuse instance from above)
          // This will automatically open Stripe Checkout for web purchases
          const purchaseResult = await purchasesInstance.purchase({ rcPackage: selectedPackage });
          
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
          // Check if this is a user cancellation (not an error)
          if (purchaseError?.userCancelled || purchaseError?.message?.toLowerCase().includes('cancel')) {
            console.log('ℹ️ User cancelled the purchase');
            throw { ...purchaseError, userCancelled: true };
          }
          
          // Check if this is a checkout-related error
          if (purchaseError?.message?.toLowerCase().includes('checkout') || 
              purchaseError?.message?.toLowerCase().includes('stripe')) {
            console.error('❌ Stripe Checkout error:', purchaseError.message);
            console.error('   This might indicate:');
            console.error('   1. Stripe integration not properly configured in RevenueCat');
            console.error('   2. Checkout session creation failed');
            console.error('   3. Payment form not accessible');
            throw new Error(`Checkout failed: ${purchaseError.message || 'Unable to open payment form'}`);
          }
          
          // Re-throw other errors
          console.error('❌ Purchase error:', purchaseError);
          throw purchaseError;
        }
      } catch (importError: any) {
        console.error('❌ RevenueCat purchase error:', importError);
        console.error('   Error type:', importError?.constructor?.name);
        console.error('   Error message:', importError?.message || importError);
        
        // Check if it's a specific error we can handle
        if (importError?.message?.includes('not configured') || importError?.message?.includes('not available')) {
          throw new Error('RevenueCat SDK not available - using fallback payment method');
        }
        
        // Re-throw the original error with more context
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
  // If RevenueCat not configured, return null
  if (!isConfigured) {
    console.warn('⚠️ RevenueCat not configured, no offerings available');
    console.warn('   isConfigured:', isConfigured);
    console.warn('   currentUserId:', currentUserId);
    return null;
  }

  try {
    const platform = getPlatform();
    console.log(`🔄 Fetching offerings from RevenueCat (platform: ${platform.platform}, forceRefresh: ${forceRefresh})...`);

    if (platform.isWeb) {
      try {
        const PurchasesModule = await import('@revenuecat/purchases-js');
        const Purchases = (PurchasesModule.default?.Purchases || PurchasesModule.Purchases || PurchasesModule.default || PurchasesModule) as any;
        console.log('📦 RevenueCat SDK imported successfully');
        
        // Get the configured instance
        const purchasesInstance = Purchases.getSharedInstance();
        
        // Try to sync customer info first to ensure product data is loaded
        try {
          console.log('🔄 Syncing customer info to ensure product data is loaded...');
          await purchasesInstance.syncPurchases();
          console.log('✅ Customer info synced');
        } catch (syncError: any) {
          console.warn('⚠️ Could not sync purchases (this is usually fine):', syncError?.message || syncError);
        }
        
        // If force refresh, try to invalidate cache by getting customer info first
        if (forceRefresh) {
          try {
            console.log('🔄 Force refreshing - fetching customer info to invalidate cache...');
            await purchasesInstance.getCustomerInfo();
            // Add a small delay to ensure cache is cleared
            await new Promise(resolve => setTimeout(resolve, 300));
          } catch (error: any) {
            console.warn('⚠️ Could not refresh customer info:', error?.message || error);
          }
        }
        
        const offerings = await purchasesInstance.getOfferings();
        console.log('📋 Raw offerings response:', offerings);
        
        // Log the full structure to understand what RevenueCat is returning
        if (offerings?.current) {
          console.log('============================================================');
          console.log('📋 REVENUECAT RAW OFFERING DATA');
          console.log('============================================================');
          console.log('Offering Identifier:', offerings.current.identifier);
          console.log('Server Description:', offerings.current.serverDescription || 'N/A');
          console.log('Metadata:', offerings.current.metadata || 'N/A');
          console.log('Package Count:', offerings.current.availablePackages?.length || 0);
          console.log('\n📦 All Packages (Full Details):');
          if (offerings.current.availablePackages && offerings.current.availablePackages.length > 0) {
            offerings.current.availablePackages.forEach((p: any, index: number) => {
              console.log(`\n   Package ${index + 1}:`);
              console.log('      Identifier:', p?.identifier || 'N/A');
              console.log('      Package Type:', p?.packageType || 'N/A');
              console.log('      Has Product Object:', !!p?.product);
              if (p?.product) {
                const productKeys = Object.keys(p.product);
                console.log('      Product Keys:', productKeys.length > 0 ? productKeys : 'EMPTY OBJECT');
                console.log('      Product Identifier:', p.product.identifier || 'N/A');
                console.log('      Product Title:', p.product.title || 'N/A');
                console.log('      Product Description:', p.product.description || 'N/A');
                console.log('      Price String:', p.product.priceString || 'N/A');
                console.log('      Price (number):', p.product.price || 'N/A');
                console.log('      Currency Code:', p.product.currencyCode || 'N/A');
                console.log('      Subscription Period:', p.product.subscriptionPeriod || 'N/A');
                console.log('      Intro Price:', p.product.introPrice || 'N/A');
                console.log('      Discount:', p.product.discount || 'N/A');
              } else {
                console.log('      ⚠️ Product object is missing or null');
              }
            });
          } else {
            console.log('   ⚠️ No packages found in offering');
          }
          console.log('============================================================');
        }
        
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
        console.log('📦 Available packages in current offering:', currentOffering.availablePackages?.length || 0);
        
        // Check if we should also look at other offerings
        // Sometimes packages are split across multiple offerings
        let allPackages = [...(currentOffering.availablePackages || [])];
        
        if (offerings.all && Object.keys(offerings.all).length > 1) {
          console.log('📦 Multiple offerings detected, checking all offerings for packages...');
          Object.entries(offerings.all).forEach(([key, offering]: [string, any]) => {
            if (offering && offering.availablePackages && offering.availablePackages.length > 0) {
              console.log(`   Offering "${key}": ${offering.availablePackages.length} package(s)`);
              // Add packages from other offerings (avoid duplicates)
              offering.availablePackages.forEach((pkg: any) => {
                if (pkg && pkg.identifier) {
                  const exists = allPackages.some((p: any) => p?.identifier === pkg.identifier);
                  if (!exists) {
                    allPackages.push(pkg);
                    console.log(`      Added package: ${pkg.identifier}`);
                  }
                }
              });
            }
          });
        }
        
        if (allPackages.length === 0) {
          console.warn('⚠️ No packages found in any offering');
          console.warn('   Check RevenueCat dashboard to ensure packages are attached to offerings');
          return null;
        }
        
        // Replace availablePackages with combined packages from all offerings
        currentOffering.availablePackages = allPackages;
        console.log(`✅ Total packages from all offerings: ${allPackages.length}`);
        
        // Log package details for verification
        console.log('📦 Package details from CURRENT offering:');
        let validPackageCount = 0;
        let emptyProductCount = 0;
        let packagesWithIdentifiers = 0;
        
        currentOffering.availablePackages.forEach((pkg: any, index: number) => {
          if (!pkg) {
            console.warn(`   Package ${index + 1}: null or undefined`);
            return;
          }
          
          const hasIdentifier = !!pkg.identifier;
          if (hasIdentifier) packagesWithIdentifiers++;
          
          const productKeys = pkg.product ? Object.keys(pkg.product) : [];
          // More lenient check: product exists and has ANY properties (not just specific ones)
          // RevenueCat products can have various structures depending on platform
          const hasValidProduct = pkg.product && 
                                  typeof pkg.product === 'object' && 
                                  productKeys.length > 0;
          
          if (hasValidProduct) {
            validPackageCount++;
            console.log(`   Package ${index + 1} (VALID - has product data):`, {
              identifier: pkg.identifier || 'unknown',
              productId: pkg.product.identifier || 'unknown',
              priceString: pkg.product.priceString || 'N/A',
              price: pkg.product.price || 'N/A',
              currencyCode: pkg.product.currencyCode || 'N/A',
              title: pkg.product.title || 'N/A',
              description: pkg.product.description || 'N/A',
              subscriptionPeriod: pkg.product.subscriptionPeriod || 'N/A'
            });
          } else if (hasIdentifier) {
            emptyProductCount++;
            console.warn(`   Package ${index + 1} (HAS IDENTIFIER but empty product - will use defaults):`, {
              identifier: pkg.identifier || 'unknown',
              hasProduct: !!pkg.product,
              productKeys: productKeys.length > 0 ? productKeys : 'empty object',
              note: 'This package will still be processed and matched by identifier'
            });
          } else {
            console.warn(`   Package ${index + 1} (INVALID - no identifier):`, {
              hasIdentifier: false,
              hasProduct: !!pkg.product,
              productKeys: productKeys.length > 0 ? productKeys : 'empty object'
            });
          }
        });
        
        // Check if we should also look at other offerings
        if (offerings.all && Object.keys(offerings.all).length > 0) {
          console.log('\n📦 Checking ALL offerings (not just current):');
          Object.entries(offerings.all).forEach(([key, offering]: [string, any]) => {
            if (offering && offering.availablePackages && offering.availablePackages.length > 0) {
              console.log(`   Offering "${key}": ${offering.availablePackages.length} package(s)`);
              offering.availablePackages.forEach((pkg: any) => {
                if (pkg && pkg.identifier) {
                  console.log(`      - ${pkg.identifier} (${pkg.product ? 'has product' : 'no product'})`);
                }
              });
            }
          });
        }
        
        if (emptyProductCount > 0) {
          console.warn(`⚠️ Found ${emptyProductCount} package(s) with empty product data (but they have identifiers)`);
          console.warn('   These packages will still be processed using default pricing');
          console.warn('   To fix: Link products to packages in RevenueCat Dashboard → Packages');
        }
        
        if (packagesWithIdentifiers === 0) {
          console.error('❌ No packages with identifiers found in current offering');
          console.error('   This indicates a RevenueCat configuration issue');
        } else {
          console.log(`✅ Found ${packagesWithIdentifiers} package(s) with identifiers (will be processed)`);
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
