/**
 * RevenueCat utility helpers for web
 * Handles fetching offerings, processing purchases, and syncing entitlements
 */

import { REVENUECAT_MONTHLY_PRODUCT_ID, REVENUECAT_YEARLY_PRODUCT_ID } from './subscription-constants';

let PurchasesModule: any = null;
let purchasesInstance: any = null;
let isConfigured = false;
let isInitializing = false;

async function loadRevenueCatSDK() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (PurchasesModule) {
    return PurchasesModule;
  }

  if (isInitializing) {
    // Wait up to 5 seconds for another call to finish initialization
    let attempts = 0;
    while (isInitializing && attempts < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts += 1;
    }
    return PurchasesModule;
  }

  isInitializing = true;
  try {
    const module = await import('@revenuecat/purchases-js');
    PurchasesModule = module.Purchases;
    return PurchasesModule;
  } catch (error) {
    console.error('❌ Failed to load RevenueCat SDK:', error);
    return null;
  } finally {
    isInitializing = false;
  }
}

export async function configureRevenueCat(userId: string, forceReconfigure = false) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!userId) {
    console.warn('⚠️ RevenueCat configuration skipped: missing user ID');
    return;
  }

  const apiKey = import.meta.env.VITE_REVENUECAT_WEB_PUBLIC_KEY;
  if (!apiKey) {
    console.warn('⚠️ RevenueCat public API key missing (VITE_REVENUECAT_WEB_PUBLIC_KEY)');
    return;
  }

  if (isConfigured && !forceReconfigure && purchasesInstance) {
    return;
  }

  const Purchases = await loadRevenueCatSDK();
  if (!Purchases) {
    console.warn('⚠️ RevenueCat SDK unavailable');
    return;
  }

  try {
    purchasesInstance = Purchases.configure({
      apiKey,
      appUserId: userId,
    });
    isConfigured = true;
    console.log('✅ RevenueCat configured');
  } catch (error) {
    console.error('❌ RevenueCat configuration error:', error);
    purchasesInstance = null;
    isConfigured = false;
  }
}

export function isRevenueCatConfigured() {
  return typeof window !== 'undefined' && isConfigured && !!purchasesInstance;
}

export async function resetRevenueCat() {
  if (!purchasesInstance) return;
  try {
    await purchasesInstance.close?.();
  } catch (error) {
    console.debug('RevenueCat close error (non-critical):', error);
  } finally {
    purchasesInstance = null;
    isConfigured = false;
  }
}

type OfferingDetails = {
  priceString: string;
  title: string;
  description: string;
} | null;

/**
 * Find a package by type (monthly or yearly)
 * Uses multiple strategies: product ID, identifier keywords, and offering shortcuts
 */
function findPackageByType(
  availablePackages: any[],
  offerings: any,
  type: 'monthly' | 'yearly'
): any | null {
  const productId = type === 'monthly' 
    ? REVENUECAT_MONTHLY_PRODUCT_ID 
    : REVENUECAT_YEARLY_PRODUCT_ID;
  
  const keywords = type === 'monthly' 
    ? ['month', 'monthly'] 
    : ['year', 'yearly', 'annual'];
  
  // Strategy 1: Match by exact product ID
  const byProductId = availablePackages.find((pkg: any) => {
    const pkgProductId = pkg?.storeProduct?.identifier ?? 
                        pkg?.rcBillingProduct?.identifier ?? 
                        pkg?.product?.identifier ?? '';
    return pkgProductId === productId;
  });
  
  if (byProductId) {
    console.log(`✅ Found ${type} package by product ID: ${productId}`);
    return byProductId;
  }
  
  // Strategy 2: Match by identifier keywords
  const byIdentifier = availablePackages.find((pkg: any) => {
    const identifier = (pkg?.identifier ?? '').toLowerCase();
    return keywords.some(keyword => identifier.includes(keyword));
  });
  
  if (byIdentifier) {
    console.log(`✅ Found ${type} package by identifier: ${byIdentifier.identifier}`);
    return byIdentifier;
  }
  
  // Strategy 3: Use offering shortcuts (monthly/annual properties)
  if (type === 'monthly' && offerings?.current?.monthly) {
    console.log('✅ Found monthly package via offering.monthly');
    return offerings.current.monthly;
  }
  
  if (type === 'yearly' && offerings?.current?.annual) {
    console.log('✅ Found yearly package via offering.annual');
    return offerings.current.annual;
  }
  
  console.warn(`⚠️ ${type} package not found`);
  return null;
}

export async function getOfferings(): Promise<{
  monthly: OfferingDetails;
  yearly: OfferingDetails;
}> {
  if (!isRevenueCatConfigured()) {
    return { monthly: null, yearly: null };
  }

  try {
    const offerings = await purchasesInstance.getOfferings();
    const availablePackages = offerings?.current?.availablePackages ?? [];

    // Use the same package finding logic as purchase flow for consistency
    const monthlyPkg = findPackageByType(availablePackages, offerings, 'monthly');
    const yearlyPkg = findPackageByType(availablePackages, offerings, 'yearly');

    const mapPackage = (pkg: any, fallbackTitle: string, fallbackDesc: string): OfferingDetails => {
      if (!pkg) return null;
      const product = pkg.storeProduct ?? pkg.rcBillingProduct ?? pkg.product ?? null;
      const priceString = product?.priceString ?? product?.formattedPrice ?? null;
      if (!priceString) return null;
      return {
        priceString,
        title: product?.title ?? fallbackTitle,
        description: product?.description ?? fallbackDesc,
      };
    };

    return {
      monthly: mapPackage(monthlyPkg, 'Monthly Plan', 'Billed monthly'),
      yearly: mapPackage(yearlyPkg, 'Yearly Plan', 'Billed annually'),
    };
  } catch (error) {
    console.error('❌ Failed to fetch RevenueCat offerings:', error);
    return { monthly: null, yearly: null };
  }
}

export async function restorePurchases(): Promise<{ success: boolean; error?: string }> {
  if (!isRevenueCatConfigured()) {
    return { success: false, error: 'RevenueCat not configured' };
  }
  try {
    await purchasesInstance.restorePurchases();
    return { success: true };
  } catch (error: any) {
    console.error('❌ RevenueCat restore error:', error);
    return { success: false, error: error?.message || 'Restore failed' };
  }
}

export async function getCustomerInfo(): Promise<any | null> {
  if (!isRevenueCatConfigured()) {
    return null;
  }
  try {
    return await purchasesInstance.getCustomerInfo();
  } catch (error) {
    console.error('❌ Failed to fetch RevenueCat customer info:', error);
    return null;
  }
}

/**
 * Purchase a Pro subscription through RevenueCat
 * @param packageType - 'monthly' or 'yearly'
 * @returns Purchase result with success status and error message if failed
 */
export async function purchaseProSubscription(
  packageType: 'monthly' | 'yearly'
): Promise<{ success: boolean; error?: string; customerInfo?: any }> {
  if (!isRevenueCatConfigured()) {
    return { 
      success: false, 
      error: 'RevenueCat not configured. Please refresh the page and try again.' 
    };
  }

  try {
    // Get current offerings to find the package
    const offerings = await purchasesInstance.getOfferings();
    const availablePackages = offerings?.current?.availablePackages ?? [];
    
    if (availablePackages.length === 0) {
      return { 
        success: false, 
        error: 'No subscription packages available. Please contact support.' 
      };
    }

    // Find the correct package
    const selectedPackage = findPackageByType(availablePackages, offerings, packageType);
    
    if (!selectedPackage) {
      return { 
        success: false, 
        error: `${packageType === 'monthly' ? 'Monthly' : 'Yearly'} subscription package not found. Please contact support.` 
      };
    }

    console.log(`🛒 Purchasing ${packageType} package:`, {
      identifier: selectedPackage.identifier,
      productId: selectedPackage.storeProduct?.identifier || selectedPackage.rcBillingProduct?.identifier,
      price: selectedPackage.storeProduct?.priceString || selectedPackage.rcBillingProduct?.priceString,
    });

    // Purchase the package
    // Note: On web, RevenueCat uses Stripe Checkout, which opens in a new window/tab
    const { customerInfo, productIdentifier } = await purchasesInstance.purchasePackage(selectedPackage);
    
    // Verify entitlement was granted
    const entitlements = customerInfo?.entitlements?.active ?? {};
    const hasProEntitlement = Object.keys(entitlements).some((key) => {
      const keyLower = key.toLowerCase();
      return keyLower.includes('pro') || 
             keyLower === 'pro-monthly' || 
             keyLower === 'pro-yearly';
    });

    if (!hasProEntitlement) {
      console.warn('⚠️ Purchase completed but Pro entitlement not found in customer info');
      // Still return success - webhook will update subscription status
      return { 
        success: true, 
        customerInfo,
        error: 'Purchase completed. Subscription status will update shortly.' 
      };
    }

    console.log('✅ Purchase successful, Pro entitlement active');
    return { success: true, customerInfo };
    
  } catch (error: any) {
    console.error('❌ RevenueCat purchase error:', error);
    
    // Extract detailed error information
    const errorMessage = error?.message || 
                        error?.underlyingErrorMessage || 
                        error?.toString() || 
                        'Purchase failed';
    
    // Check for specific error types
    if (errorMessage.includes('cancel') || errorMessage.includes('user_cancelled')) {
      return { 
        success: false, 
        error: 'Purchase was cancelled.' 
      };
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return { 
        success: false, 
        error: 'Network error. Please check your connection and try again.' 
      };
    }
    
    if (errorMessage.includes('payment') || errorMessage.includes('card')) {
      return { 
        success: false, 
        error: 'Payment failed. Please check your payment method and try again.' 
      };
    }
    
    return { 
      success: false, 
      error: errorMessage 
    };
  }
}

