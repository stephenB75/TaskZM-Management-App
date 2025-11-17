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
    : ['year', 'yearly', 'annual', 'annually'];
  
  // Log all available packages for debugging
  console.log(`🔍 Searching for ${type} package among ${availablePackages.length} packages:`, 
    availablePackages.map((pkg: any) => ({
      identifier: pkg?.identifier,
      productId: pkg?.storeProduct?.identifier || pkg?.rcBillingProduct?.identifier || pkg?.product?.identifier,
      title: pkg?.storeProduct?.title || pkg?.rcBillingProduct?.title || pkg?.product?.title,
    }))
  );
  
  // Strategy 1: Match by exact product ID
  const byProductId = availablePackages.find((pkg: any) => {
    const pkgProductId = pkg?.storeProduct?.identifier ?? 
                        pkg?.rcBillingProduct?.identifier ?? 
                        pkg?.product?.identifier ?? '';
    return pkgProductId === productId;
  });
  
  if (byProductId) {
    console.log(`✅ Found ${type} package by product ID: ${productId}`, byProductId.identifier);
    return byProductId;
  }
  
  // Strategy 2: Match by identifier keywords (case-insensitive)
  const byIdentifier = availablePackages.find((pkg: any) => {
    const identifier = (pkg?.identifier ?? '').toLowerCase();
    return keywords.some(keyword => identifier.includes(keyword.toLowerCase()));
  });
  
  if (byIdentifier) {
    console.log(`✅ Found ${type} package by identifier: ${byIdentifier.identifier}`);
    return byIdentifier;
  }
  
  // Strategy 3: Match by product title keywords
  const byTitle = availablePackages.find((pkg: any) => {
    const title = (pkg?.storeProduct?.title ?? 
                   pkg?.rcBillingProduct?.title ?? 
                   pkg?.product?.title ?? '').toLowerCase();
    return keywords.some(keyword => title.includes(keyword.toLowerCase()));
  });
  
  if (byTitle) {
    console.log(`✅ Found ${type} package by title: ${byTitle.storeProduct?.title || byTitle.rcBillingProduct?.title}`);
    return byTitle;
  }
  
  // Strategy 4: Use offering shortcuts (monthly/annual properties)
  if (type === 'monthly' && offerings?.current?.monthly) {
    console.log('✅ Found monthly package via offering.monthly');
    return offerings.current.monthly;
  }
  
  if (type === 'yearly' && offerings?.current?.annual) {
    console.log('✅ Found yearly package via offering.annual');
    return offerings.current.annual;
  }
  
  // Strategy 5: Try all packages if only one matches the type
  if (availablePackages.length === 1) {
    console.log(`⚠️ Only one package available, using it for ${type}`);
    return availablePackages[0];
  }
  
  console.warn(`⚠️ ${type} package not found. Available packages:`, 
    availablePackages.map((p: any) => p?.identifier).join(', '));
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

    // Check if package has a checkout URL before purchasing (web/Stripe Checkout)
    const checkoutUrl = selectedPackage.checkoutUrl || 
                       selectedPackage.checkout_url ||
                       selectedPackage.storeProduct?.checkoutUrl ||
                       selectedPackage.rcBillingProduct?.checkoutUrl;
    
    if (checkoutUrl) {
      console.log('🔗 Package has checkout URL, redirecting to Stripe Checkout:', checkoutUrl);
      window.location.href = checkoutUrl;
      return { 
        success: true, 
        error: 'Redirecting to payment...' 
      };
    }

    // Purchase the package
    // On web, RevenueCat should handle Stripe Checkout automatically
    console.log('🛒 Calling purchasePackage...');
    const purchaseResult = await purchasesInstance.purchasePackage(selectedPackage);
    
    console.log('📦 Purchase result:', {
      hasCustomerInfo: !!purchaseResult?.customerInfo,
      hasCheckoutUrl: !!(purchaseResult?.checkoutUrl || purchaseResult?.checkout_url),
      keys: Object.keys(purchaseResult || {}),
    });
    
    // Check if there's a checkout URL in the response (for web/Stripe Checkout)
    const resultCheckoutUrl = purchaseResult?.checkoutUrl || purchaseResult?.checkout_url;
    if (resultCheckoutUrl) {
      console.log('🔗 Opening Stripe Checkout from purchase result:', resultCheckoutUrl);
      window.location.href = resultCheckoutUrl;
      return { 
        success: true, 
        error: 'Redirecting to payment...' 
      };
    }
    
    // If no checkout URL, the purchase may have completed synchronously
    const customerInfo = purchaseResult?.customerInfo || purchaseResult;
    
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
    console.error('❌ Error details:', {
      message: error?.message,
      code: error?.code,
      underlyingError: error?.underlyingError,
      checkoutUrl: error?.checkoutUrl || error?.checkout_url,
      keys: Object.keys(error || {}),
    });
    
    // Check if error contains a checkout URL (some SDKs return checkout URL in error)
    const errorCheckoutUrl = error?.checkoutUrl || 
                            error?.checkout_url || 
                            error?.underlyingError?.checkoutUrl ||
                            error?.underlyingError?.checkout_url;
    
    if (errorCheckoutUrl) {
      console.log('🔗 Error contains checkout URL, redirecting:', errorCheckoutUrl);
      window.location.href = errorCheckoutUrl;
      return { 
        success: true, 
        error: 'Redirecting to payment...' 
      };
    }
    
    // Extract detailed error information
    const errorMessage = error?.message || 
                        error?.underlyingErrorMessage || 
                        error?.underlyingError?.message ||
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
    
    // Check for "No available adapters" error (Stripe Checkout not configured)
    if (errorMessage.includes('adapter') || errorMessage.includes('checkout')) {
      return { 
        success: false, 
        error: 'Payment system not configured. Please contact support.' 
      };
    }
    
    return { 
      success: false, 
      error: errorMessage 
    };
  }
}

