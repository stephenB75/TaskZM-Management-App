/**
 * RevenueCat Integration
 * Handles subscription management through RevenueCat with Stripe as payment provider
 */

// Lazy load RevenueCat SDK to avoid initialization issues
let Purchases: any = null;
let purchasesInstance: any = null;
let isConfigured = false;
let isInitializing = false;

// Inline default prices to avoid import initialization issues
const DEFAULT_MONTHLY_PRICE = "$3.99";
const DEFAULT_YEARLY_PRICE = "$39.99";

// Lazy load the RevenueCat SDK
async function loadRevenueCatSDK() {
  if (Purchases) {
    return Purchases;
  }
  
  if (isInitializing) {
    // Wait for initialization to complete
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return Purchases;
  }
  
  isInitializing = true;
  try {
    const module = await import('@revenuecat/purchases-js');
    Purchases = module.Purchases;
    isInitializing = false;
    return Purchases;
  } catch (error) {
    isInitializing = false;
    console.error('Failed to load RevenueCat SDK:', error);
    // Return null instead of throwing to allow graceful degradation
    return null;
  }
}

/**
 * Configure RevenueCat SDK
 */
export async function configureRevenueCat(userId: string, forceReconfigure = false): Promise<void> {
  try {
    // Validate user ID
    if (!userId || typeof userId !== 'string') {
      console.warn('⚠️ Invalid user ID provided to RevenueCat');
      return;
    }

    const apiKey = import.meta.env.VITE_REVENUECAT_WEB_PUBLIC_KEY;
    
    if (!apiKey) {
      console.warn('⚠️ RevenueCat API key not found in environment variables');
      return;
    }

    // Skip reconfiguration if already configured and not forcing
    if (isConfigured && !forceReconfigure && purchasesInstance) {
      return;
    }

    // Lazy load SDK if not already loaded
    try {
      const RC = await loadRevenueCatSDK();
      
      if (!RC) {
        console.error('❌ Failed to load RevenueCat SDK');
        return;
      }

      // Initialize or reconfigure
      if (!purchasesInstance || forceReconfigure) {
        try {
          purchasesInstance = RC.configure({
            apiKey,
            appUserId: userId,
          });
          isConfigured = true;
          console.log('✅ RevenueCat configured successfully');
        } catch (configError: any) {
          console.error('❌ RevenueCat configuration error:', configError);
          // Don't throw - allow app to continue without RevenueCat
          return;
        }
      } else {
        // Update user ID if changed
        try {
          await purchasesInstance.logIn(userId);
          isConfigured = true;
        } catch (loginError: any) {
          console.error('❌ RevenueCat login error:', loginError);
          // Don't throw - allow app to continue
          return;
        }
      }
    } catch (loadError: any) {
      console.error('❌ Failed to load RevenueCat SDK:', loadError);
      // Don't throw - allow app to continue without RevenueCat
      return;
    }
  } catch (error: any) {
    console.error('❌ RevenueCat configuration failed:', error);
    // Don't throw - allow app to continue without RevenueCat
    // The app should work in a degraded mode without RevenueCat
  }
}

/**
 * Check if RevenueCat is configured
 */
export function isRevenueCatConfigured(): boolean {
  try {
    return isConfigured && purchasesInstance !== null && Purchases !== null;
  } catch (error) {
    // Safety check - if anything throws, assume not configured
    return false;
  }
}

/**
 * Get subscription offerings from RevenueCat
 */
export async function getOfferings(forceRefresh = false): Promise<{
  monthly: {
    priceString: string;
    title: string;
    description: string;
    package: any;
  } | null;
  yearly: {
    priceString: string;
    title: string;
    description: string;
    package: any;
  } | null;
}> {
  try {
    // Ensure SDK is loaded and configured
    if (!purchasesInstance) {
      // Try to ensure SDK is loaded, but don't configure (that's done separately)
      await loadRevenueCatSDK();
      if (!purchasesInstance) {
        console.warn('⚠️ RevenueCat not configured, returning null offerings');
        return { monthly: null, yearly: null };
      }
    }

    let offerings;
    try {
      offerings = await purchasesInstance.getOfferings();
    } catch (error: any) {
      console.error('Failed to get offerings:', error);
      return { monthly: null, yearly: null };
    }
    
    if (!offerings?.current) {
      console.warn('⚠️ RevenueCat has no current offering');
      return { monthly: null, yearly: null };
    }

    const packages = offerings.current?.availablePackages;
    
    if (!packages || packages.length === 0) {
      console.warn('⚠️ Current offering has no packages');
      return { monthly: null, yearly: null };
    }

    // Find monthly and yearly packages
    let monthlyPkg: any = null;
    let yearlyPkg: any = null;

    for (const pkg of packages) {
      const identifier = pkg.identifier.toLowerCase();
      const productId = pkg.storeProduct?.identifier?.toLowerCase() || '';
      
      // Check for monthly package
      if (
        identifier.includes('monthly') ||
        identifier.includes('month') ||
        productId.includes('monthly') ||
        productId.includes('month')
      ) {
        monthlyPkg = pkg;
      }
      
      // Check for yearly package
      if (
        identifier.includes('yearly') ||
        identifier.includes('year') ||
        identifier.includes('annual') ||
        productId.includes('yearly') ||
        productId.includes('year') ||
        productId.includes('annual')
      ) {
        yearlyPkg = pkg;
      }
    }

    // Build offerings
    const monthlyOffering = monthlyPkg && monthlyPkg.storeProduct ? {
      priceString: monthlyPkg.storeProduct.priceString || DEFAULT_MONTHLY_PRICE,
      title: monthlyPkg.storeProduct.title || 'Monthly Pro',
      description: monthlyPkg.storeProduct.description || 'Billed monthly',
      package: monthlyPkg,
    } : null;

    const yearlyOffering = yearlyPkg && yearlyPkg.storeProduct ? {
      priceString: yearlyPkg.storeProduct.priceString || DEFAULT_YEARLY_PRICE,
      title: yearlyPkg.storeProduct.title || 'Yearly Pro',
      description: yearlyPkg.storeProduct.description || 'Billed annually',
      package: yearlyPkg,
    } : null;

    return {
      monthly: monthlyOffering,
      yearly: yearlyOffering,
    };
  } catch (error: any) {
    console.error('❌ Failed to load offerings from RevenueCat:', error);
    return { monthly: null, yearly: null };
  }
}

/**
 * Purchase a subscription through RevenueCat
 */
export async function purchaseProSubscription(
  packageIdentifier: 'monthly' | 'yearly'
): Promise<{ success: boolean; error?: string }> {
  try {
    // Ensure SDK is loaded and configured
    if (!purchasesInstance) {
      await loadRevenueCatSDK();
      if (!purchasesInstance) {
        return { success: false, error: 'RevenueCat not configured. Please refresh the page and try again.' };
      }
    }

    let offerings;
    try {
      offerings = await purchasesInstance.getOfferings();
    } catch (error: any) {
      throw new Error(`Failed to load offerings: ${error?.message || 'Unknown error'}`);
    }
    
    if (!offerings?.current) {
      throw new Error('No subscription offerings available');
    }

    const packages = offerings.current?.availablePackages;
    
    if (!packages || packages.length === 0) {
      throw new Error('No packages available in current offering');
    }
    
    // Find the requested package
    let selectedPackage: any = null;
    
    for (const pkg of packages) {
      const identifier = pkg.identifier.toLowerCase();
      const productId = pkg.storeProduct?.identifier?.toLowerCase() || '';
      
      if (packageIdentifier === 'monthly') {
        if (
          identifier.includes('monthly') ||
          identifier.includes('month') ||
          productId.includes('monthly') ||
          productId.includes('month')
        ) {
          selectedPackage = pkg;
          break;
        }
      } else if (packageIdentifier === 'yearly') {
        if (
          identifier.includes('yearly') ||
          identifier.includes('year') ||
          identifier.includes('annual') ||
          productId.includes('yearly') ||
          productId.includes('year') ||
          productId.includes('annual')
        ) {
          selectedPackage = pkg;
          break;
        }
      }
    }

    if (!selectedPackage) {
      throw new Error(`${packageIdentifier} subscription package not found`);
    }

    // Purchase through RevenueCat (which handles Stripe for web)
    let purchaseResult;
    try {
      purchaseResult = await purchasesInstance.purchasePackage(selectedPackage);
    } catch (purchaseError: any) {
      throw purchaseError; // Re-throw to be caught by outer catch
    }
    
    // Handle different return formats from RevenueCat SDK
    const customerInfo = purchaseResult?.customerInfo || purchaseResult;
    
    if (!customerInfo) {
      throw new Error('Purchase completed but no customer info returned');
    }
    
    // Check if purchase was successful
    const hasActiveEntitlement = 
      customerInfo?.entitlements?.active?.['pro'] ||
      customerInfo?.entitlements?.active?.['PRO-Monthly'] ||
      customerInfo?.entitlements?.active?.['PRO-Yearly'];

    if (hasActiveEntitlement) {
      return { success: true };
    } else {
      throw new Error('Purchase completed but no active entitlement found');
    }
  } catch (error: any) {
    console.error('❌ RevenueCat purchase error:', error);
    
    // Extract error message
    let errorMessage = 'Purchase failed';
    if (error?.message) {
      errorMessage = error.message;
    } else if (error?.underlyingErrorMessage) {
      errorMessage = error.underlyingErrorMessage;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    // Check for user cancellation
    if (error?.userCancelled || errorMessage.toLowerCase().includes('cancel')) {
      errorMessage = 'Purchase was cancelled';
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Get current subscription status from RevenueCat
 */
export async function getSubscriptionStatus(): Promise<{
  tier: 'free' | 'pro';
  status: 'active' | 'inactive' | 'expired' | 'cancelled';
  startDate: string | null;
  endDate: string | null;
  cancelAtPeriodEnd: boolean;
}> {
  try {
    if (!purchasesInstance) {
      return {
        tier: 'free',
        status: 'inactive',
        startDate: null,
        endDate: null,
        cancelAtPeriodEnd: false,
      };
    }

    let customerInfo;
    try {
      customerInfo = await purchasesInstance.getCustomerInfo();
    } catch (error: any) {
      console.error('Failed to get customer info:', error);
      return {
        tier: 'free',
        status: 'inactive',
        startDate: null,
        endDate: null,
        cancelAtPeriodEnd: false,
      };
    }
    
    if (!customerInfo) {
      return {
        tier: 'free',
        status: 'inactive',
        startDate: null,
        endDate: null,
        cancelAtPeriodEnd: false,
      };
    }
    
    // Check for active entitlements
    const hasProEntitlement = 
      customerInfo.entitlements?.active?.['pro'] ||
      customerInfo.entitlements?.active?.['PRO-Monthly'] ||
      customerInfo.entitlements?.active?.['PRO-Yearly'];

    if (hasProEntitlement) {
      const entitlement = customerInfo.entitlements?.active?.['pro'] ||
                         customerInfo.entitlements?.active?.['PRO-Monthly'] ||
                         customerInfo.entitlements?.active?.['PRO-Yearly'];
      
      if (entitlement) {
        return {
          tier: 'pro',
          status: entitlement.willRenew ? 'active' : 'cancelled',
          startDate: entitlement.latestPurchaseDate ? entitlement.latestPurchaseDate.toISOString() : null,
          endDate: entitlement.expirationDate ? entitlement.expirationDate.toISOString() : null,
          cancelAtPeriodEnd: !entitlement.willRenew,
        };
      }
    }

    return {
      tier: 'free',
      status: 'inactive',
      startDate: null,
      endDate: null,
      cancelAtPeriodEnd: false,
    };
  } catch (error: any) {
    console.error('❌ Failed to get subscription status from RevenueCat:', error);
    return {
      tier: 'free',
      status: 'inactive',
      startDate: null,
      endDate: null,
      cancelAtPeriodEnd: false,
    };
  }
}

/**
 * Restore purchases (for users who already purchased)
 */
export async function restorePurchases(): Promise<{ success: boolean; error?: string }> {
  try {
    // Ensure SDK is loaded and configured
    if (!purchasesInstance) {
      await loadRevenueCatSDK();
      if (!purchasesInstance) {
        return { success: false, error: 'RevenueCat not configured. Please refresh the page and try again.' };
      }
    }

    let restoreResult;
    try {
      restoreResult = await purchasesInstance.restorePurchases();
    } catch (error: any) {
      console.error('Failed to restore purchases:', error);
      return { 
        success: false, 
        error: error?.message || 'Failed to restore purchases' 
      };
    }
    
    // Handle different return formats from RevenueCat SDK
    const customerInfo = restoreResult?.customerInfo || restoreResult;
    
    if (!customerInfo) {
      return { success: false, error: 'No customer info returned from restore' };
    }
    
    // Check if restore was successful
    const hasActiveEntitlement = 
      customerInfo.entitlements?.active?.['pro'] ||
      customerInfo.entitlements?.active?.['PRO-Monthly'] ||
      customerInfo.entitlements?.active?.['PRO-Yearly'];

    if (hasActiveEntitlement) {
      return { success: true };
    } else {
      return { success: false, error: 'No active subscription found' };
    }
  } catch (error: any) {
    console.error('❌ Failed to restore purchases:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to restore purchases' 
    };
  }
}

/**
 * Open customer portal for subscription management
 */
export async function openCustomerPortal(): Promise<string | null> {
  try {
    // Ensure SDK is loaded and configured
    if (!purchasesInstance) {
      await loadRevenueCatSDK();
      if (!purchasesInstance) {
        throw new Error('RevenueCat not configured. Please refresh the page and try again.');
      }
    }

    let customerInfo;
    try {
      customerInfo = await purchasesInstance.getCustomerInfo();
    } catch (error: any) {
      console.error('Failed to get customer info:', error);
      throw new Error('Unable to retrieve customer information');
    }
    
    if (!customerInfo) {
      throw new Error('Unable to retrieve customer information');
    }
    
    // Check if user has a subscription managed by RevenueCat/Stripe
    const hasStripeSubscription = 
      customerInfo.entitlements?.active?.['pro']?.store === 'stripe' ||
      customerInfo.entitlements?.active?.['PRO-Monthly']?.store === 'stripe' ||
      customerInfo.entitlements?.active?.['PRO-Yearly']?.store === 'stripe';

    if (!hasStripeSubscription) {
      throw new Error('No Stripe subscription found. Subscription may be managed through App Store or Play Store.');
    }

    // Get customer portal URL from RevenueCat
    // Note: RevenueCat doesn't directly provide portal URLs, so we'll need to use Stripe's portal
    // This should be handled by the backend
    return null;
  } catch (error: any) {
    console.error('❌ Failed to open customer portal:', error);
    throw error;
  }
}

/**
 * Reset RevenueCat (for testing/logout)
 */
export async function resetRevenueCat(): Promise<void> {
  try {
    if (purchasesInstance) {
      try {
        await purchasesInstance.logOut();
      } catch (logoutError: any) {
        // Silently handle logout errors - they're non-critical
        console.debug('RevenueCat logout error (non-critical):', logoutError);
      }
      purchasesInstance = null;
      isConfigured = false;
    }
    // Don't reset Purchases class itself - keep it loaded for future use
  } catch (error: any) {
    // Silently handle - reset is best-effort and shouldn't crash the app
    console.debug('RevenueCat reset error (non-critical):', error);
  }
}

