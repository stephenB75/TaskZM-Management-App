/**
 * RevenueCat Integration
 * Handles subscription management through RevenueCat with Stripe as payment provider
 */

import Purchases from '@revenuecat/purchases-js';
import { DEFAULT_MONTHLY_PRICE, DEFAULT_YEARLY_PRICE } from './subscription-constants';

let purchasesInstance: typeof Purchases | null = null;
let isConfigured = false;

/**
 * Configure RevenueCat SDK
 */
export async function configureRevenueCat(userId: string, forceReconfigure = false): Promise<void> {
  try {
    const apiKey = import.meta.env.VITE_REVENUECAT_WEB_PUBLIC_KEY;
    
    if (!apiKey) {
      console.warn('⚠️ RevenueCat API key not found in environment variables');
      return;
    }

    // Skip reconfiguration if already configured and not forcing
    if (isConfigured && !forceReconfigure) {
      return;
    }

    // Initialize or reconfigure
    if (!purchasesInstance || forceReconfigure) {
      purchasesInstance = await Purchases.configure({
        apiKey,
        appUserID: userId,
      });
    } else {
      // Update user ID if changed
      await purchasesInstance.logIn(userId);
    }

    isConfigured = true;
    console.log('✅ RevenueCat configured successfully');
  } catch (error: any) {
    console.error('❌ RevenueCat configuration failed:', error);
    throw error;
  }
}

/**
 * Check if RevenueCat is configured
 */
export function isRevenueCatConfigured(): boolean {
  return isConfigured && purchasesInstance !== null;
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
    if (!purchasesInstance) {
      throw new Error('RevenueCat not configured');
    }

    const offerings = await purchasesInstance.getOfferings();
    
    if (!offerings.current) {
      console.warn('⚠️ RevenueCat has no current offering');
      return { monthly: null, yearly: null };
    }

    const packages = offerings.current.availablePackages;
    
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
    if (!purchasesInstance) {
      throw new Error('RevenueCat not configured');
    }

    const offerings = await purchasesInstance.getOfferings();
    
    if (!offerings.current) {
      throw new Error('No subscription offerings available');
    }

    const packages = offerings.current.availablePackages;
    
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
    const { customerInfo } = await purchasesInstance.purchasePackage(selectedPackage);
    
    // Check if purchase was successful
    const hasActiveEntitlement = customerInfo.entitlements.active['pro'] || 
                                  customerInfo.entitlements.active['PRO-Monthly'] ||
                                  customerInfo.entitlements.active['PRO-Yearly'];

    if (hasActiveEntitlement) {
      return { success: true };
    } else {
      throw new Error('Purchase completed but no active entitlement found');
    }
  } catch (error: any) {
    console.error('❌ RevenueCat purchase error:', error);
    
    // Extract error message
    let errorMessage = 'Purchase failed';
    if (error.message) {
      errorMessage = error.message;
    } else if (error.underlyingErrorMessage) {
      errorMessage = error.underlyingErrorMessage;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    // Check for user cancellation
    if (error.userCancelled || errorMessage.toLowerCase().includes('cancel')) {
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

    const customerInfo = await purchasesInstance.getCustomerInfo();
    
    // Check for active entitlements
    const hasProEntitlement = 
      customerInfo.entitlements.active['pro'] ||
      customerInfo.entitlements.active['PRO-Monthly'] ||
      customerInfo.entitlements.active['PRO-Yearly'];

    if (hasProEntitlement) {
      const entitlement = customerInfo.entitlements.active['pro'] ||
                         customerInfo.entitlements.active['PRO-Monthly'] ||
                         customerInfo.entitlements.active['PRO-Yearly'];
      
      return {
        tier: 'pro',
        status: entitlement.willRenew ? 'active' : 'cancelled',
        startDate: entitlement.latestPurchaseDate || null,
        endDate: entitlement.expirationDate || null,
        cancelAtPeriodEnd: !entitlement.willRenew,
      };
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
    if (!purchasesInstance) {
      throw new Error('RevenueCat not configured');
    }

    const customerInfo = await purchasesInstance.restorePurchases();
    
    // Check if restore was successful
    const hasActiveEntitlement = 
      customerInfo.entitlements.active['pro'] ||
      customerInfo.entitlements.active['PRO-Monthly'] ||
      customerInfo.entitlements.active['PRO-Yearly'];

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
    if (!purchasesInstance) {
      throw new Error('RevenueCat not configured');
    }

    const customerInfo = await purchasesInstance.getCustomerInfo();
    
    // Check if user has a subscription managed by RevenueCat/Stripe
    const hasStripeSubscription = 
      customerInfo.entitlements.active['pro']?.store === 'stripe' ||
      customerInfo.entitlements.active['PRO-Monthly']?.store === 'stripe' ||
      customerInfo.entitlements.active['PRO-Yearly']?.store === 'stripe';

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
      await purchasesInstance.logOut();
      purchasesInstance = null;
      isConfigured = false;
    }
  } catch (error: any) {
    console.error('❌ Failed to reset RevenueCat:', error);
  }
}

