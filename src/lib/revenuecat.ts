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
      // Note: Stripe adapter configuration is done in RevenueCat dashboard
      // The "No available adapters" error means Stripe is not configured in RevenueCat dashboard
    });
    isConfigured = true;
    console.log('✅ RevenueCat configured');
    
    // Verify configuration by checking if we can get offerings
    // Note: "No available adapters" warning is expected for Web Billing on web platform
    // Web Billing doesn't use adapters - it's a hosted checkout solution
    try {
      const testOfferings = await purchasesInstance.getOfferings();
      console.log('✅ RevenueCat configuration verified, offerings accessible');
      // Check if offerings have packages (this confirms Web Billing is working)
      if (testOfferings?.current?.availablePackages?.length > 0) {
        console.log(`✅ Web Billing configured: ${testOfferings.current.availablePackages.length} package(s) available`);
      }
    } catch (testError: any) {
      const errorMsg = testError?.message || String(testError || '');
      // Only warn about adapter issues if it's NOT the expected "No available adapters" message
      // For Web Billing, "No available adapters" is normal and can be ignored
      if ((errorMsg.includes('adapter') || errorMsg.includes('No available')) && 
          !errorMsg.includes('No available adapters')) {
        console.warn('⚠️ RevenueCat configuration issue detected:', errorMsg);
      }
      // If it's just "No available adapters", that's expected for Web Billing - don't warn
    }
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

    console.log('📦 RevenueCat offerings received:', {
      hasCurrent: !!offerings?.current,
      packageCount: availablePackages.length,
      packages: availablePackages.map((pkg: any) => ({
        identifier: pkg?.identifier,
        hasStoreProduct: !!pkg?.storeProduct,
        hasRcBillingProduct: !!pkg?.rcBillingProduct,
        hasProduct: !!pkg?.product,
        storeProductKeys: pkg?.storeProduct ? Object.keys(pkg.storeProduct) : [],
        rcBillingProductKeys: pkg?.rcBillingProduct ? Object.keys(pkg.rcBillingProduct) : [],
      })),
    });

    // Use the same package finding logic as purchase flow for consistency
    const monthlyPkg = findPackageByType(availablePackages, offerings, 'monthly');
    const yearlyPkg = findPackageByType(availablePackages, offerings, 'yearly');

    const mapPackage = (pkg: any, type: 'monthly' | 'yearly', fallbackTitle: string, fallbackDesc: string): OfferingDetails => {
      if (!pkg) {
        console.warn(`⚠️ ${type} package is null`);
        return null;
      }

      // Try multiple product locations and property names
      const product = pkg.storeProduct ?? 
                     pkg.rcBillingProduct ?? 
                     pkg.product ?? 
                     pkg.billingProduct ??
                     null;

      console.log(`🔍 Mapping ${type} package:`, {
        identifier: pkg.identifier,
        hasProduct: !!product,
        productKeys: product ? Object.keys(product) : [],
        productData: product ? {
          priceString: product.priceString,
          formattedPrice: product.formattedPrice,
          price: product.price,
          currencyCode: product.currencyCode,
          title: product.title,
          description: product.description,
        } : null,
      });

      if (!product) {
        console.warn(`⚠️ ${type} package has no product data`);
        return null;
      }

      // Try multiple price string locations and ensure it's a string
      let priceString: string | null = null;
      
      // First try direct string properties
      if (typeof product.priceString === 'string') {
        priceString = product.priceString;
      } else if (typeof product.formattedPrice === 'string') {
        priceString = product.formattedPrice;
      } else if (product.price) {
        // Construct from price and currency
        const price = typeof product.price === 'number' ? product.price : parseFloat(String(product.price));
        const currency = product.currencyCode || 'USD';
        const currencySymbol = currency === 'USD' ? '$' : currency;
        priceString = `${currencySymbol}${price.toFixed(2)}`;
      }
      
      // If still no price string, try to extract from object
      if (!priceString && product.priceString) {
        // If priceString is an object, try to extract the value
        if (typeof product.priceString === 'object') {
          const priceObj = product.priceString as any;
          priceString = priceObj.value || priceObj.amount || priceObj.price || String(priceObj);
        } else {
          priceString = String(product.priceString);
        }
      }
      
      // Final fallback: convert to string
      if (!priceString && product.price) {
        priceString = String(product.price);
      }

      if (!priceString || priceString === 'null' || priceString === 'undefined') {
        console.warn(`⚠️ ${type} package product has no valid price string:`, product);
        return null;
      }
      
      // Ensure priceString is a clean string (remove any object artifacts and NaN)
      priceString = String(priceString)
        .replace(/\[object Object\]/g, '')
        .replace(/NaN/gi, '')
        .replace(/undefined/gi, '')
        .replace(/null/gi, '')
        .trim();

      // Validate priceString is not empty or invalid
      if (!priceString || 
          priceString === '' || 
          priceString === 'NaN' || 
          priceString === 'undefined' || 
          priceString === 'null' ||
          priceString.includes('NaN') ||
          isNaN(parseFloat(priceString.replace(/[^0-9.]/g, '')))) {
        console.warn(`⚠️ ${type} package product has invalid price string:`, {
          original: product.priceString,
          cleaned: priceString,
          product: product,
        });
        return null;
      }

      console.log(`✅ ${type} package mapped successfully:`, {
        priceString,
        title: product.title ?? fallbackTitle,
        description: product.description ?? fallbackDesc,
      });

      return {
        priceString,
        title: product.title ?? fallbackTitle,
        description: product.description ?? fallbackDesc,
      };
    };

    const monthlyOffering = mapPackage(monthlyPkg, 'monthly', 'Monthly Plan', 'Billed monthly');
    const yearlyOffering = mapPackage(yearlyPkg, 'yearly', 'Yearly Plan', 'Billed annually');

    console.log('📊 Final offerings:', {
      monthly: monthlyOffering ? { priceString: monthlyOffering.priceString, title: monthlyOffering.title } : null,
      yearly: yearlyOffering ? { priceString: yearlyOffering.priceString, title: yearlyOffering.title } : null,
    });

    return {
      monthly: monthlyOffering,
      yearly: yearlyOffering,
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
      packageKeys: Object.keys(selectedPackage || {}),
      storeProductKeys: Object.keys(selectedPackage.storeProduct || {}),
      rcBillingProductKeys: Object.keys(selectedPackage.rcBillingProduct || {}),
    });

    // Check if package has a checkout URL before purchasing (web/Stripe Checkout)
    const checkoutUrl = selectedPackage.checkoutUrl || 
                       selectedPackage.checkout_url ||
                       selectedPackage.storeProduct?.checkoutUrl ||
                       selectedPackage.rcBillingProduct?.checkoutUrl;
    
    // For Web Billing, checkout URL might not be available until purchasePackage is called
    // RevenueCat Web Billing generates checkout URLs dynamically during purchase
    console.log('🔍 Pre-purchase checkout URL check:', {
      hasCheckoutUrl: !!checkoutUrl,
      checkoutUrl,
      packageHasCheckoutUrl: !!selectedPackage.checkoutUrl,
      packageHasCheckout_url: !!selectedPackage.checkout_url,
      storeProductHasCheckoutUrl: !!selectedPackage.storeProduct?.checkoutUrl,
      rcBillingProductHasCheckoutUrl: !!selectedPackage.rcBillingProduct?.checkoutUrl,
      note: 'For Web Billing, checkout URL is typically generated during purchasePackage call',
    });
    
    if (checkoutUrl) {
      console.log('🔗 Package has checkout URL, redirecting to Stripe Checkout:', checkoutUrl);
      window.location.href = checkoutUrl;
      return { 
        success: true, 
        error: 'Redirecting to payment...' 
      };
    }

    // Purchase the package
    // For RevenueCat Web Billing, purchasePackage will either:
    // 1. Return a checkout URL in the result (success case)
    // 2. Throw an error with a checkout URL (some SDK versions)
    // 3. Return customerInfo if payment completed synchronously (unlikely for Web Billing)
    console.log('🛒 Calling purchasePackage for Web Billing...', {
      packageIdentifier: selectedPackage.identifier,
      hasStoreProduct: !!selectedPackage.storeProduct,
      hasRcBillingProduct: !!selectedPackage.rcBillingProduct,
      platform: 'web',
      billingType: 'Web Billing (Stripe hosted checkout)',
    });
    
    let purchaseResult;
    try {
      // For Web Billing, this call should generate a checkout URL
      purchaseResult = await purchasesInstance.purchasePackage(selectedPackage);
      
      console.log('📦 Purchase result (success path):', {
        type: typeof purchaseResult,
        isPromise: purchaseResult instanceof Promise,
        keys: Object.keys(purchaseResult || {}),
        hasCustomerInfo: !!purchaseResult?.customerInfo,
        hasCheckoutUrl: !!(purchaseResult?.checkoutUrl || purchaseResult?.checkout_url),
        fullResult: purchaseResult,
      });
      
    } catch (purchaseError: any) {
      console.log('📦 Purchase error caught (analyzing error):', {
        errorType: typeof purchaseError,
        errorName: purchaseError?.name,
        errorMessage: purchaseError?.message,
        errorKeys: Object.keys(purchaseError || {}),
        hasCheckoutUrl: !!(purchaseError?.checkoutUrl || purchaseError?.checkout_url),
        hasUnderlyingError: !!purchaseError?.underlyingError,
        fullError: purchaseError,
      });
      
      // FIRST: Check if this is a user cancellation (most common case)
      // Extract error code early to detect cancellation
      const errorCode = purchaseError?.code || 
                       purchaseError?.errorCode || 
                       purchaseError?.underlyingError?.code ||
                       purchaseError?.underlyingError?.errorCode;
      const errorMessage = purchaseError?.message || 
                          purchaseError?.underlyingError?.message ||
                          '';
      const errorString = purchaseError?.toString?.() || String(purchaseError || '');
      const codeFromString = errorString.match(/code:\s*(\w+)/i)?.[1] || 
                            errorString.match(/\(code:\s*(\w+)/i)?.[1];
      const finalErrorCode = errorCode || codeFromString;
      
      const isCancelled = 
        finalErrorCode === 'UserCancelledError' ||
        finalErrorCode === 'USER_CANCELLED' ||
        errorCode === 'UserCancelledError' ||
        errorCode === 'USER_CANCELLED' ||
        codeFromString === 'UserCancelledError' ||
        errorString.includes('UserCancelledError') ||
        errorString.includes('code: UserCancelledError') ||
        errorMessage.toLowerCase().includes('cancel') ||
        errorMessage.toLowerCase().includes('user_cancelled') ||
        errorMessage.toLowerCase().includes('cancelled by user');
      
      if (isCancelled) {
        console.log('ℹ️ Purchase was cancelled by user (this is normal, not an error)');
        return { 
          success: false, 
          error: 'Purchase was cancelled.',
          cancelled: true,
        };
      }
      
      // SECOND: Check for checkout URL in error (Web Billing may return checkout URL in error)
      // This is a valid flow - the error contains the redirect URL
      const errorCheckoutUrl = purchaseError?.checkoutUrl || 
                              purchaseError?.checkout_url ||
                              purchaseError?.underlyingError?.checkoutUrl ||
                              purchaseError?.underlyingError?.checkout_url ||
                              purchaseError?.checkoutSessionUrl ||
                              purchaseError?.url;
      
      if (errorCheckoutUrl) {
        console.log('✅ Found checkout URL in error (Web Billing flow):', errorCheckoutUrl);
        console.log('🔗 Redirecting to Stripe Checkout...');
        window.location.href = errorCheckoutUrl;
        return { 
          success: true, 
          error: 'Redirecting to payment...' 
        };
      }
      
      // Check if error message contains a URL (sometimes it's in the message)
      const urlMatch = purchaseError?.message?.match(/https?:\/\/[^\s]+/);
      if (urlMatch && urlMatch[0]) {
        console.log('✅ Found checkout URL in error message:', urlMatch[0]);
        window.location.href = urlMatch[0];
        return { 
          success: true, 
          error: 'Redirecting to payment...' 
        };
      }
      
      // If no checkout URL and not a cancellation, this is a real error
      console.error('❌ Purchase error without checkout URL or cancellation:', {
        errorCode: finalErrorCode,
        errorMessage,
        errorString: errorString.substring(0, 200),
      });
      throw purchaseError;
    }
    
    console.log('📦 Purchase result received:', {
      hasCustomerInfo: !!purchaseResult?.customerInfo,
      hasCheckoutUrl: !!(purchaseResult?.checkoutUrl || purchaseResult?.checkout_url),
      checkoutUrl: purchaseResult?.checkoutUrl || purchaseResult?.checkout_url,
      keys: Object.keys(purchaseResult || {}),
      fullResult: purchaseResult,
    });
    
    // Check if there's a checkout URL in the response (for Web Billing/Stripe Checkout)
    // RevenueCat Web Billing may return checkout URL in various properties
    const resultCheckoutUrl = purchaseResult?.checkoutUrl || 
                              purchaseResult?.checkout_url ||
                              purchaseResult?.checkoutSessionUrl ||
                              purchaseResult?.url ||
                              purchaseResult?.redirectUrl ||
                              purchaseResult?.redirect_url;
    
    if (resultCheckoutUrl) {
      console.log('✅ Found checkout URL in purchase result (Web Billing):', resultCheckoutUrl);
      console.log('🔗 Redirecting to Stripe Checkout...');
      window.location.href = resultCheckoutUrl;
      return { 
        success: true, 
        error: 'Redirecting to payment...' 
      };
    }
    
    // If no checkout URL, this is unexpected for Web Billing
    // Web Billing should always redirect to Stripe Checkout
    console.warn('⚠️ Purchase result has no checkout URL - unexpected for Web Billing');
    console.warn('⚠️ This might indicate Web Billing configuration issue');
    
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
    
    // Extract error information from various possible structures
    // RevenueCat errors can have different structures, so we check multiple places
    const errorCode = error?.code || 
                     error?.errorCode || 
                     error?.underlyingError?.code ||
                     error?.underlyingError?.errorCode ||
                     (error?.toString?.()?.match(/code:\s*(\w+)/i)?.[1]);
    
    const errorMessage = error?.message || 
                        error?.underlyingErrorMessage || 
                        error?.underlyingError?.message ||
                        (typeof error === 'string' ? error : '') ||
                        error?.toString?.() || 
                        'Purchase failed';
    
    const errorName = error?.name || 
                     error?.constructor?.name ||
                     error?.underlyingError?.name ||
                     (error?.toString?.()?.match(/PurchasesError|(\w+Error)/)?.[0]);
    
    // Try to extract code from error string representation
    // RevenueCat errors often show as "PurchasesError(code: UserCancelledError, message: )"
    const errorString = error?.toString?.() || String(error || '');
    const codeFromString = errorString.match(/code:\s*(\w+)/i)?.[1] || 
                          errorString.match(/\(code:\s*(\w+)/i)?.[1];
    
    const finalErrorCode = errorCode || codeFromString;
    
    // Log detailed error information for debugging
    console.error('❌ Error details:', {
      name: errorName,
      message: errorMessage,
      code: errorCode,
      codeFromString,
      finalErrorCode,
      errorCode: error?.errorCode,
      underlyingError: error?.underlyingError,
      checkoutUrl: error?.checkoutUrl || error?.checkout_url,
      errorString,
      keys: Object.keys(error || {}),
      stringified: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    });
    
    // Check for user cancellation (most common case)
    // RevenueCat uses "UserCancelledError" as the code
    const isCancelled = 
      finalErrorCode === 'UserCancelledError' ||
      finalErrorCode === 'USER_CANCELLED' ||
      errorCode === 'UserCancelledError' ||
      errorCode === 'USER_CANCELLED' ||
      codeFromString === 'UserCancelledError' ||
      errorName === 'UserCancelledError' ||
      errorString.includes('UserCancelledError') ||
      errorString.includes('code: UserCancelledError') ||
      errorMessage.toLowerCase().includes('cancel') ||
      errorMessage.toLowerCase().includes('user_cancelled') ||
      errorMessage.toLowerCase().includes('cancelled by user') ||
      (errorMessage === '' && (finalErrorCode === 'UserCancelledError' || errorCode === 'UserCancelledError'));
    
    if (isCancelled) {
      console.log('ℹ️ Purchase was cancelled by user (this is normal, not an error)');
      // Return success: false but with a specific cancellation flag
      // The UI will handle this gracefully without showing an error
      return { 
        success: false, 
        error: 'Purchase was cancelled.',
        cancelled: true, // Flag to indicate this is a cancellation, not an error
      };
    }
    
    // Check if error contains a checkout URL (Web Billing may return checkout URL in error)
    // RevenueCat Web Billing can return checkout URLs in various error properties
    const errorCheckoutUrl = error?.checkoutUrl || 
                            error?.checkout_url || 
                            error?.checkoutSessionUrl ||
                            error?.url ||
                            error?.redirectUrl ||
                            error?.redirect_url ||
                            error?.underlyingError?.checkoutUrl ||
                            error?.underlyingError?.checkout_url ||
                            error?.underlyingError?.checkoutSessionUrl ||
                            error?.underlyingError?.url;
    
    // Also check error message for URLs (sometimes it's embedded in the message)
    const errorMessageUrl = errorMessage?.match(/https?:\/\/[^\s]+/)?.[0];
    const finalCheckoutUrl = errorCheckoutUrl || errorMessageUrl;
    
    if (finalCheckoutUrl) {
      console.log('✅ Found checkout URL in error (Web Billing redirect):', finalCheckoutUrl);
      console.log('🔗 Redirecting to Stripe Checkout...');
      window.location.href = finalCheckoutUrl;
      return { 
        success: true, 
        error: 'Redirecting to payment...' 
      };
    }
    
    // Check for network errors
    if (errorMessage.toLowerCase().includes('network') || 
        errorMessage.toLowerCase().includes('fetch') ||
        errorMessage.toLowerCase().includes('connection') ||
        errorCode === 'NetworkError') {
      return { 
        success: false, 
        error: 'Network error. Please check your connection and try again.' 
      };
    }
    
    // Check for payment errors
    if (errorMessage.toLowerCase().includes('payment') || 
        errorMessage.toLowerCase().includes('card') ||
        errorMessage.toLowerCase().includes('declined') ||
        errorCode === 'PaymentError') {
      return { 
        success: false, 
        error: 'Payment failed. Please check your payment method and try again.' 
      };
    }
    
    // Check for configuration errors (but ignore "No available adapters" for Web Billing)
    // "No available adapters" is expected on web - Web Billing doesn't use adapters
    const isAdapterWarning = errorMessage.toLowerCase().includes('no available adapters');
    if (!isAdapterWarning && (
        errorMessage.toLowerCase().includes('adapter') || 
        errorMessage.toLowerCase().includes('checkout') ||
        errorMessage.toLowerCase().includes('not configured') ||
        errorCode === 'ConfigurationError')) {
      return { 
        success: false, 
        error: 'Stripe payment adapter is not configured in RevenueCat. Please contact support or check RevenueCat dashboard settings.' 
      };
    }
    
    // If it's just "No available adapters", this is expected for Web Billing
    // Continue with purchase flow - Web Billing should still work
    if (isAdapterWarning) {
      console.log('ℹ️ "No available adapters" warning is expected for Web Billing on web platform');
      // Don't return error - continue with purchase flow
    }
    
    // Check for product/package errors
    if (errorMessage.toLowerCase().includes('package') ||
        errorMessage.toLowerCase().includes('product') ||
        errorMessage.toLowerCase().includes('not found') ||
        errorCode === 'ProductNotAvailableError') {
      return { 
        success: false, 
        error: 'Subscription package not available. Please try again or contact support.' 
      };
    }
    
    // Generic error with code if available
    if (errorCode && errorMessage) {
      return { 
        success: false, 
        error: `${errorMessage} (Code: ${errorCode})` 
      };
    }
    
    // Fallback to generic message
    return { 
      success: false, 
      error: errorMessage || 'Purchase failed. Please try again.' 
    };
  }
}

