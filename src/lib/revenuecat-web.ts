/**
 * RevenueCat utility helpers for web (Stripe Checkout via purchases-js).
 * Native platforms use revenuecat-native.ts via the revenuecat.ts facade.
 */

import { REVENUECAT_YEARLY_OFFERING_ID } from './subscription-constants';
import {
  collectAllOfferingPackages,
  resolveSubscriptionPackage,
} from './revenuecat-package-resolver';

let PurchasesModule: any = null;
let purchasesInstance: any = null;
let isConfigured = false;
let isInitializing = false;

/**
 * Show payment form message modal before redirecting to Stripe Checkout
 */
function showPaymentFormMessage(checkoutUrl: string): void {
  if (typeof window === 'undefined') {
    // If not in browser, redirect immediately
    window.location.href = checkoutUrl;
    return;
  }

  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `;

  // Create modal content
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 24px;
    max-width: 500px;
    width: 100%;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    animation: fadeIn 0.2s ease-out;
  `;

  // Add fade-in animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
  `;
  document.head.appendChild(style);

  modal.innerHTML = `
    <div style="text-align: center;">
      <div style="font-size: 32px; margin-bottom: 16px;">💡</div>
      <h3 style="font-size: 20px; font-weight: 600; color: #1f2937; margin-bottom: 12px;">
        Important Payment Information
      </h3>
      <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin-bottom: 24px;">
        <strong>Please select your country first</strong> in the payment form to properly fill out payment details. 
        Once you select your country, all payment fields will become active.
      </p>
      <button id="continue-to-payment" style="
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 12px 24px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        width: 100%;
        transition: background 0.2s;
      " onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">
        Continue to Payment Form
      </button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Handle continue button click
  const continueButton = modal.querySelector('#continue-to-payment');
  const handleContinue = () => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.2s ease-out';
    setTimeout(() => {
      document.body.removeChild(overlay);
      document.head.removeChild(style);
      // Comprehensive cleanup before redirect
      try {
        const dialogs = document.querySelectorAll('[role="dialog"], [data-state="open"]');
        dialogs.forEach((dialog) => {
          const closeButton = dialog.querySelector('[aria-label*="close" i], [aria-label*="Close"]');
          if (closeButton && closeButton instanceof HTMLElement) {
            closeButton.click();
          }
        });
        
        // Defer DOM reads to avoid forced reflows - batch all reads first, then writes
        const allOverlays = document.querySelectorAll('[style*="z-index"]');
        const overlaysToHide: HTMLElement[] = [];
        allOverlays.forEach((overlay) => {
          const element = overlay as HTMLElement;
          // Batch DOM reads
          const zIndex = window.getComputedStyle(element).zIndex;
          if (parseInt(zIndex) > 100) {
            overlaysToHide.push(element);
          }
        });
        // Batch DOM writes after all reads
        overlaysToHide.forEach((element) => {
          element.style.pointerEvents = 'none';
          element.style.display = 'none';
        });
        
        document.body.style.pointerEvents = 'auto';
        document.documentElement.style.pointerEvents = 'auto';
      } catch (cleanupError) {
        console.debug('Cleanup before redirect (non-critical):', cleanupError);
      }
      
      // Redirect to Stripe Checkout
      window.location.href = checkoutUrl;
    }, 200);
  };

  if (continueButton) {
    continueButton.addEventListener('click', handleContinue);
  }

  // Also allow clicking outside to continue (optional)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      handleContinue();
    }
  });
}

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
    
    // Verify configuration asynchronously (non-blocking) to avoid delays
    // Note: "No available adapters" warning is expected for Web Billing on web platform
    // Web Billing doesn't use adapters - it's a hosted checkout solution
    purchasesInstance.getOfferings()
      .then((testOfferings) => {
        console.log('✅ RevenueCat configuration verified, offerings accessible');
        // Check if offerings have packages (this confirms Web Billing is working)
        if (testOfferings?.current?.availablePackages?.length > 0) {
          console.log(`✅ Web Billing configured: ${testOfferings.current.availablePackages.length} package(s) available`);
        }
      })
      .catch((testError: any) => {
        const errorMsg = testError?.message || String(testError || '');
        // Only warn about adapter issues if it's NOT the expected "No available adapters" message
        // For Web Billing, "No available adapters" is normal and can be ignored
        if ((errorMsg.includes('adapter') || errorMsg.includes('No available')) && 
            !errorMsg.includes('No available adapters')) {
          console.warn('⚠️ RevenueCat configuration issue detected:', errorMsg);
        }
        // If it's just "No available adapters", that's expected for Web Billing - don't warn
      });
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

export async function getOfferings(): Promise<{
  monthly: OfferingDetails;
  yearly: OfferingDetails;
}> {
  if (!isRevenueCatConfigured()) {
    return { monthly: null, yearly: null };
  }

  try {
    const offerings = await purchasesInstance.getOfferings();
    const allPackages = collectAllOfferingPackages(offerings);
    const currentPackages = offerings?.current?.availablePackages ?? [];

    if (import.meta.env.DEV) {
      console.log('📦 RevenueCat offerings received:', {
        hasCurrent: !!offerings?.current,
        currentOfferingId: offerings?.current?.identifier,
        currentPackageCount: currentPackages.length,
        searchablePackageCount: allPackages.length,
        allOfferings: offerings?.all ? Object.keys(offerings.all) : [],
        yearlyOfferingId: REVENUECAT_YEARLY_OFFERING_ID,
      });
      if (currentPackages.length === 1 && allPackages.length > 1) {
        console.warn(
          '⚠️ Yearly/monthly package resolved from a supplemental offering — add both packages to the Current Offering in RevenueCat when possible.'
        );
      }
    }

    const monthlyPkg = resolveSubscriptionPackage(offerings, 'monthly');
    const yearlyPkg = resolveSubscriptionPackage(offerings, 'yearly');

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
          // Web Billing specific properties
          displayName: product.displayName,
          localizedPrice: product.localizedPrice,
          displayPrice: product.displayPrice,
          // Full product object for debugging
          fullProduct: product,
        } : null,
      });

      if (!product) {
        console.warn(`⚠️ ${type} package has no product data`);
        return null;
      }

      // Try multiple price string locations and ensure it's a string
      let priceString: string | null = null;
      
      // First try direct string properties
      if (typeof product.priceString === 'string' && product.priceString.trim() !== '') {
        priceString = product.priceString;
      } else if (typeof product.formattedPrice === 'string' && product.formattedPrice.trim() !== '') {
        priceString = product.formattedPrice;
      } 
      // Check for Web Billing price object format: {amount: 499, amountMicros: 4990000, currency: 'USD'}
      else if (product.price && typeof product.price === 'object' && product.price !== null) {
        const priceObj = product.price as any;
        if (priceObj.amount !== undefined && priceObj.currency) {
          // amountMicros is in micros (1/1,000,000 of currency unit), amount is in cents
          // For USD: amount 499 = $4.99, amountMicros 4990000 = $4.99
          const amount = priceObj.amountMicros 
            ? priceObj.amountMicros / 1000000  // Convert micros to dollars
            : (priceObj.amount / 100);  // Convert cents to dollars
          
          if (!isNaN(amount) && isFinite(amount) && amount > 0) {
            const currency = priceObj.currency || 'USD';
            const currencySymbol = currency === 'USD' ? '$' : currency;
            priceString = `${currencySymbol}${amount.toFixed(2)}`;
          }
        }
      }
      // Fallback: try numeric price
      else if (product.price !== undefined && product.price !== null) {
        // Construct from price and currency
        const priceNum = typeof product.price === 'number' 
          ? product.price 
          : (typeof product.price === 'string' ? parseFloat(product.price) : parseFloat(String(product.price)));
        
        // Only construct if we have a valid number
        if (!isNaN(priceNum) && isFinite(priceNum) && priceNum > 0) {
          const currency = product.currencyCode || 'USD';
          const currencySymbol = currency === 'USD' ? '$' : currency;
          // If price is in cents (like 499), divide by 100
          const finalPrice = priceNum > 1000 ? priceNum / 100 : priceNum;
          priceString = `${currencySymbol}${finalPrice.toFixed(2)}`;
        }
      }
      
      // If still no price string, try to extract from object
      if (!priceString && product.priceString) {
        // If priceString is an object, try to extract the value
        if (typeof product.priceString === 'object' && product.priceString !== null) {
          const priceObj = product.priceString as any;
          const extractedPrice = priceObj.value || priceObj.amount || priceObj.price || priceObj.priceString;
          if (extractedPrice !== undefined && extractedPrice !== null) {
            const priceNum = typeof extractedPrice === 'number' 
              ? extractedPrice 
              : parseFloat(String(extractedPrice));
            if (!isNaN(priceNum) && isFinite(priceNum) && priceNum > 0) {
              const currency = priceObj.currencyCode || product.currencyCode || 'USD';
              const currencySymbol = currency === 'USD' ? '$' : currency;
              priceString = `${currencySymbol}${priceNum.toFixed(2)}`;
            } else {
              priceString = String(extractedPrice);
            }
          }
        } else if (typeof product.priceString === 'string') {
          priceString = product.priceString;
        }
      }
      
      // Try other price properties
      if (!priceString) {
        const altPrice = product.localizedPrice || product.displayPrice || product.priceDisplay || product.priceString;
        if (altPrice && typeof altPrice === 'string' && altPrice.trim() !== '') {
          priceString = altPrice;
        }
      }

      if (!priceString || priceString === 'null' || priceString === 'undefined') {
        console.warn(`⚠️ ${type} package product has no valid price string:`, product);
        return null;
      }
      
      // Ensure priceString is a clean string (remove any object artifacts and NaN)
      if (priceString) {
        priceString = String(priceString)
          .replace(/\[object Object\]/g, '')
          .replace(/NaN/gi, '')
          .replace(/undefined/gi, '')
          .replace(/null/gi, '')
          .trim();
      }

      // Validate priceString is not empty or invalid
      // Check if it's just a currency symbol without a number
      if (!priceString || 
          priceString === '' || 
          priceString === 'NaN' || 
          priceString === 'undefined' || 
          priceString === 'null' ||
          priceString === '$' || // Just currency symbol
          priceString === '€' ||
          priceString === '£' ||
          priceString.includes('NaN') ||
          (priceString.length < 2) || // Too short to be a valid price
          isNaN(parseFloat(priceString.replace(/[^0-9.]/g, ''))) ||
          parseFloat(priceString.replace(/[^0-9.]/g, '')) <= 0) {
        console.warn(`⚠️ ${type} package product has invalid price string:`, {
          original: product.priceString,
          cleaned: priceString,
          product: {
            priceString: product.priceString,
            formattedPrice: product.formattedPrice,
            price: product.price,
            currencyCode: product.currencyCode,
            localizedPrice: product.localizedPrice,
            displayPrice: product.displayPrice,
            allKeys: Object.keys(product),
          },
        });
        return null;
      }

      console.log(`✅ ${type} package mapped successfully:`, {
        identifier: pkg.identifier,
        priceString,
        title: product.title ?? fallbackTitle,
        description: product.description ?? fallbackDesc,
        priceSource: (() => {
          if (typeof product.priceString === 'string' && product.priceString.trim() !== '') return 'priceString';
          if (typeof product.formattedPrice === 'string' && product.formattedPrice.trim() !== '') return 'formattedPrice';
          if (product.price && typeof product.price === 'object') return 'price.amountMicros/amount';
          if (product.price !== undefined && product.price !== null) return 'price (numeric)';
          if (product.localizedPrice) return 'localizedPrice';
          if (product.displayPrice) return 'displayPrice';
          return 'unknown';
        })(),
      });

      return {
        priceString,
        title: product.title ?? fallbackTitle,
        description: product.description ?? fallbackDesc,
      };
    };

    const monthlyOffering = mapPackage(monthlyPkg, 'monthly', 'Monthly Plan', 'Billed monthly');
    const yearlyOffering = mapPackage(yearlyPkg, 'yearly', 'Yearly Plan', 'Billed annually');

    // Log detailed results
    console.log('📊 Package mapping results:', {
      monthly: {
        packageFound: !!monthlyPkg,
        offeringMapped: !!monthlyOffering,
        priceString: monthlyOffering?.priceString || 'N/A',
      },
      yearly: {
        packageFound: !!yearlyPkg,
        offeringMapped: !!yearlyOffering,
        priceString: yearlyOffering?.priceString || 'N/A',
        reason: !yearlyPkg ? 'Package not found by resolveSubscriptionPackage' : 
                !yearlyOffering ? 'Package found but mapPackage returned null (likely invalid price)' : 
                'Success',
      },
    });

    console.log('📊 Final offerings:', {
      monthly: monthlyOffering ? { 
        priceString: monthlyOffering.priceString, 
        title: monthlyOffering.title,
        description: monthlyOffering.description,
      } : null,
      yearly: yearlyOffering ? { 
        priceString: yearlyOffering.priceString, 
        title: yearlyOffering.title,
        description: yearlyOffering.description,
      } : null,
    });
    
    // Additional validation for yearly offering
    if (yearlyOffering) {
      const yearlyPriceNum = parseFloat(yearlyOffering.priceString.replace(/[^0-9.]/g, ''));
      console.log('✅ Yearly subscription price validation:', {
        priceString: yearlyOffering.priceString,
        numericValue: yearlyPriceNum,
        isValid: !isNaN(yearlyPriceNum) && yearlyPriceNum > 0,
        expectedRange: 'Should be around $47.99 based on dashboard',
      });
      
      if (isNaN(yearlyPriceNum) || yearlyPriceNum <= 0) {
        console.error('❌ Yearly subscription price is invalid!', {
          priceString: yearlyOffering.priceString,
          numericValue: yearlyPriceNum,
        });
      }
    } else {
      console.warn('⚠️ Yearly offering is null - check if yearly package was found');
    }

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
  } catch (error: any) {
    const msg = String(error?.message ?? error ?? '');
    const isNetworkRelated =
      /network|timeout|408|unreachable|failed to fetch|ERR_/i.test(msg) ||
      /not valid JSON|SyntaxError/i.test(msg);
    if (isNetworkRelated) {
      console.warn('RevenueCat customer info unavailable (network):', msg || error);
    } else {
      console.error('❌ Failed to fetch RevenueCat customer info:', error);
    }
    return null;
  }
}

/**
 * Purchase a Pro subscription through RevenueCat
 * @param packageType - 'monthly' or 'yearly'
 * @returns Purchase result with success status and error message if failed
 * 
 * Note on Stripe Checkout Form Field Activation:
 * - Stripe Checkout requires country selection before payment fields become active
 * - This is a Stripe requirement for tax calculation and compliance
 * - Users must select their country from the dropdown first
 * - Once country is selected, all payment fields (email, card, etc.) will activate
 * - This behavior is expected and cannot be changed via code
 * - To improve UX, configure "Auto-detect country" in Stripe Dashboard → Settings → Checkout
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
    // Get current offerings to find the package (same resolver as getOfferings)
    const offerings = await purchasesInstance.getOfferings();
    const selectedPackage = resolveSubscriptionPackage(offerings, packageType);

    if (!selectedPackage) {
      const packageCount = collectAllOfferingPackages(offerings).length;
      if (packageCount === 0) {
        return {
          success: false,
          error: 'No subscription packages available. Please contact support.',
        };
      }
      return {
        success: false,
        error: `${packageType === 'monthly' ? 'Monthly' : 'Yearly'} subscription package not found. Please contact support.`,
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
      
      // Show payment form message before redirecting
      showPaymentFormMessage(checkoutUrl);
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
      // Add timeout to prevent hanging if RevenueCat/Stripe is slow
      // Increased timeout to 45 seconds to account for slow network/Stripe checkout generation
      const purchasePromise = purchasesInstance.purchasePackage(selectedPackage);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Purchase request timed out after 45 seconds. The payment provider may be experiencing delays. Please try again.')), 45000);
      });
      
      purchaseResult = await Promise.race([purchasePromise, timeoutPromise]);
      
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
        // Comprehensive cleanup to ensure Stripe Checkout form fields are fully clickable
        try {
          // Close any open dialogs/modals
          const dialogs = document.querySelectorAll('[role="dialog"], [data-state="open"]');
          dialogs.forEach((dialog) => {
            const closeButton = dialog.querySelector('[aria-label*="close" i], [aria-label*="Close"], button[aria-label*="close" i]');
            if (closeButton && closeButton instanceof HTMLElement) {
              closeButton.click();
            }
          });
          
          // Remove overlays and high z-index elements
          const allOverlays = document.querySelectorAll(
            '[style*="z-index"], [class*="overlay"], [class*="backdrop"], [class*="modal"], [class*="dialog"]'
          );
          allOverlays.forEach((overlay) => {
            const element = overlay as HTMLElement;
            const zIndex = window.getComputedStyle(element).zIndex;
            if (parseInt(zIndex) > 100 || element.classList.contains('overlay') || 
                element.classList.contains('backdrop') || element.classList.contains('modal')) {
              element.style.pointerEvents = 'none';
              element.style.display = 'none';
              element.style.visibility = 'hidden';
            }
          });
          
          document.body.style.pointerEvents = 'auto';
          document.documentElement.style.pointerEvents = 'auto';
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (cleanupError) {
          console.debug('Cleanup before redirect (non-critical):', cleanupError);
        }
        // Show payment form message before redirecting
        showPaymentFormMessage(errorCheckoutUrl);
        return { 
          success: true, 
          error: 'Redirecting to payment...' 
        };
      }
      
      // Check if error message contains a URL (sometimes it's in the message)
      const urlMatch = purchaseError?.message?.match(/https?:\/\/[^\s]+/);
      if (urlMatch && urlMatch[0]) {
        console.log('✅ Found checkout URL in error message:', urlMatch[0]);
        // Comprehensive cleanup to ensure Stripe Checkout form fields are fully clickable
        try {
          // Close any open dialogs/modals
          const dialogs = document.querySelectorAll('[role="dialog"], [data-state="open"]');
          dialogs.forEach((dialog) => {
            const closeButton = dialog.querySelector('[aria-label*="close" i], [aria-label*="Close"], button[aria-label*="close" i]');
            if (closeButton && closeButton instanceof HTMLElement) {
              closeButton.click();
            }
          });
          
          // Remove overlays and high z-index elements
          const allOverlays = document.querySelectorAll(
            '[style*="z-index"], [class*="overlay"], [class*="backdrop"], [class*="modal"], [class*="dialog"]'
          );
          allOverlays.forEach((overlay) => {
            const element = overlay as HTMLElement;
            const zIndex = window.getComputedStyle(element).zIndex;
            if (parseInt(zIndex) > 100 || element.classList.contains('overlay') || 
                element.classList.contains('backdrop') || element.classList.contains('modal')) {
              element.style.pointerEvents = 'none';
              element.style.display = 'none';
              element.style.visibility = 'hidden';
            }
          });
          
          document.body.style.pointerEvents = 'auto';
          document.documentElement.style.pointerEvents = 'auto';
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (cleanupError) {
          console.debug('Cleanup before redirect (non-critical):', cleanupError);
        }
        // Use window.location.href for better form field activation
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
      // Comprehensive cleanup to ensure Stripe Checkout form fields are fully clickable
      // This fixes issues where clickable areas are outside the field boxes
      try {
        // Close any open dialogs/modals that might interfere
        const dialogs = document.querySelectorAll('[role="dialog"], [data-state="open"]');
        dialogs.forEach((dialog) => {
          const closeButton = dialog.querySelector('[aria-label*="close" i], [aria-label*="Close"], button[aria-label*="close" i]');
          if (closeButton && closeButton instanceof HTMLElement) {
            closeButton.click();
          }
        });
        
        // Remove any high z-index overlays, backdrops, or modals
        // Batch DOM reads first to avoid forced reflows, then batch writes
        const allOverlays = document.querySelectorAll(
          '[style*="z-index"], [class*="overlay"], [class*="backdrop"], [class*="modal"], [class*="dialog"]'
        );
        const overlaysToHide: HTMLElement[] = [];
        allOverlays.forEach((overlay) => {
          const element = overlay as HTMLElement;
          // Batch all DOM reads first
          const zIndex = window.getComputedStyle(element).zIndex;
          const computedZIndex = parseInt(zIndex) || 0;
          
          // Collect elements to hide (don't write yet)
          if (computedZIndex > 100 || element.classList.contains('overlay') || 
              element.classList.contains('backdrop') || element.classList.contains('modal')) {
            overlaysToHide.push(element);
          }
        });
        // Batch all DOM writes after reads complete
        overlaysToHide.forEach((element) => {
          element.style.pointerEvents = 'none';
          element.style.display = 'none';
          element.style.visibility = 'hidden';
          element.style.opacity = '0';
        });
        
        // Clear pointer-events on body and html to ensure nothing blocks clicks
        document.body.style.pointerEvents = 'auto';
        document.documentElement.style.pointerEvents = 'auto';
        
        // Remove any fixed or absolute positioned elements that might overlay
        const fixedElements = document.querySelectorAll('[style*="position: fixed"], [style*="position:absolute"]');
        fixedElements.forEach((element) => {
          const el = element as HTMLElement;
          const position = window.getComputedStyle(el).position;
          if ((position === 'fixed' || position === 'absolute') && 
              (parseInt(window.getComputedStyle(el).zIndex) || 0) > 100) {
            el.style.pointerEvents = 'none';
          }
        });
        
        // Ensure all inputs and form elements are accessible
        const formElements = document.querySelectorAll('input, textarea, select, button, label');
        formElements.forEach((element) => {
          const el = element as HTMLElement;
          el.style.pointerEvents = 'auto';
        });
        
        // Small delay to ensure DOM cleanup completes before redirect
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (cleanupError) {
        console.debug('Cleanup before redirect (non-critical):', cleanupError);
      }
      // Show payment form message before redirecting
      showPaymentFormMessage(resultCheckoutUrl);
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
    const entitlementKeys = Object.keys(entitlements);
    
    console.log('🎫 Checking entitlements:', {
      allEntitlementKeys: entitlementKeys,
      expectedKeys: ['pro', 'PRO-Monthly', 'PRO-Yearly', 'pro-monthly', 'pro-yearly'],
    });
    
    const hasProEntitlement = entitlementKeys.some((key) => {
      const keyLower = key.toLowerCase();
      const matches = keyLower.includes('pro') || 
             keyLower === 'pro-monthly' || 
             keyLower === 'pro-yearly';
      if (matches) {
        console.log(`✅ Found Pro entitlement: ${key}`);
      }
      return matches;
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
      // Clear any overlays before redirect
      try {
        document.body.style.pointerEvents = 'auto';
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (cleanupError) {
        console.debug('Cleanup before redirect (non-critical):', cleanupError);
      }
      // Use window.location.href for better form field activation
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

