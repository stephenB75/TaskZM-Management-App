/**
 * RevenueCat utility helpers for web (Stripe Checkout via purchases-js).
 * Native platforms use revenuecat-native.ts via the revenuecat.ts facade.
 */

import { REVENUECAT_MONTHLY_PRODUCT_ID, REVENUECAT_YEARLY_PRODUCT_ID } from './subscription-constants';

// Track if we've already warned about product ID mismatch to avoid duplicate warnings
let hasWarnedAboutProductIdMismatch = false;

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
  
  // Expanded keywords to match various identifier formats
  // RevenueCat packages can have identifiers like: $rc_monthly, rc_monthly, monthly, $monthly, etc.
  // Also supports formats like "Yearly Subscription - ofrnga3a1440e88" (contains "yearly")
  const keywords = type === 'monthly' 
    ? ['month', 'monthly', 'rc_monthly', '$rc_monthly'] 
    : ['year', 'yearly', 'annual', 'annually', 'rc_yearly', 'rc_annual', '$rc_yearly', '$rc_annual'];
  
  // Log all available packages for debugging with full details
  console.log(`🔍 Searching for ${type} package among ${availablePackages.length} packages:`);
  console.log(`   Expected Product ID: ${productId}`);
  console.log(`   Expected Keywords: ${keywords.join(', ')}`);
  
  // Special check for rc_annual and yearly product ID connection
  if (type === 'yearly' && productId === REVENUECAT_YEARLY_PRODUCT_ID) {
    console.log(`   🔗 Checking for rc_annual identifier matching product ID: ${productId}`);
  }
  
  console.log(`   Available packages (full details):`, 
    availablePackages.map((pkg: any) => {
      const storeProductId = pkg?.storeProduct?.identifier;
      const rcBillingProductId = pkg?.rcBillingProduct?.identifier;
      const pkgProductId = pkg?.product?.identifier;
      const identifier = pkg?.identifier || 'N/A';
      const identifierLower = identifier.toLowerCase();
      
      // Check if this package has rc_annual identifier and matches the expected product ID
      const isRcAnnual = identifierLower === 'rc_annual' || identifierLower === '$rc_annual';
      const matchesExpectedProductId = storeProductId === productId || rcBillingProductId === productId || pkgProductId === productId;
      const isRcAnnualWithCorrectProduct = isRcAnnual && matchesExpectedProductId;
      
      return {
        identifier: identifier,
        identifierLower: identifierLower,
        productIds: {
          storeProduct: storeProductId || 'N/A',
          rcBillingProduct: rcBillingProductId || 'N/A',
          product: pkgProductId || 'N/A',
        },
        title: pkg?.storeProduct?.title || pkg?.rcBillingProduct?.title || pkg?.product?.title || 'N/A',
        matchesProductId: matchesExpectedProductId,
        matchesKeywords: keywords.some(kw => identifierLower.includes(kw.toLowerCase())),
        keywordMatches: keywords.filter(kw => identifierLower.includes(kw.toLowerCase())),
        // Special verification for rc_annual
        isRcAnnual: isRcAnnual,
        isRcAnnualWithCorrectProduct: isRcAnnualWithCorrectProduct,
        // Show all possible identifier variations
        allIdentifiers: {
          packageIdentifier: identifier,
          storeProductIdentifier: storeProductId,
          rcBillingProductIdentifier: rcBillingProductId,
          productIdentifier: pkgProductId,
        },
      };
    })
  );
  
  // Log confirmation if rc_annual matches yearly product ID
  if (type === 'yearly' && productId === REVENUECAT_YEARLY_PRODUCT_ID) {
    const rcAnnualPackage = availablePackages.find((pkg: any) => {
      const identifier = (pkg?.identifier || '').toLowerCase();
      return identifier === 'rc_annual' || identifier === '$rc_annual';
    });
    
    if (rcAnnualPackage) {
      const storeProductId = rcAnnualPackage?.storeProduct?.identifier;
      const rcBillingProductId = rcAnnualPackage?.rcBillingProduct?.identifier;
      const pkgProductId = rcAnnualPackage?.product?.identifier;
      const matchesProductId = storeProductId === productId || rcBillingProductId === productId || pkgProductId === productId;
      
      console.log(`🔗 Found package with rc_annual identifier:`, {
        packageIdentifier: rcAnnualPackage.identifier,
        productIds: {
          storeProduct: storeProductId,
          rcBillingProduct: rcBillingProductId,
          product: pkgProductId,
        },
        expectedProductId: productId,
        matchesExpectedProductId: matchesProductId,
      });
      
      if (matchesProductId) {
        console.log(`✅ CONFIRMED: rc_annual identifier matches product ID ${productId} (${REVENUECAT_YEARLY_PRODUCT_ID})`);
      } else {
        // For Web Billing, "Yearly" is a valid identifier - only warn if it's neither expected ID nor "Yearly"
        const isWebBillingYearly = rcBillingProductId === 'Yearly' || rcBillingProductId === 'yearly';
        if (!isWebBillingYearly) {
          console.warn(`⚠️ rc_annual package product ID mismatch:`, {
            actual: rcBillingProductId || storeProductId || pkgProductId,
            expected: productId,
            note: 'Package will still work, but consider linking to product ' + productId + ' in RevenueCat Dashboard'
          });
        }
      }
    } else {
      console.log(`ℹ️ No package with rc_annual identifier found in available packages`);
    }
  }
  
  // Strategy 1: Match by identifier first (especially for rc_annual)
  // This is important because the package identifier is what we're looking for
  // The product ID might be different due to RevenueCat configuration
  if (type === 'yearly') {
    const byRcAnnualIdentifier = availablePackages.find((pkg: any) => {
      const identifier = (pkg?.identifier || '').toLowerCase();
      return identifier === 'rc_annual' || identifier === '$rc_annual';
    });
    
    if (byRcAnnualIdentifier) {
      const pkgProductId = byRcAnnualIdentifier?.storeProduct?.identifier ?? 
                          byRcAnnualIdentifier?.rcBillingProduct?.identifier ?? 
                          byRcAnnualIdentifier?.product?.identifier ?? '';
      
      console.log(`✅ Found yearly package by rc_annual identifier:`, {
        packageIdentifier: byRcAnnualIdentifier.identifier,
        productId: pkgProductId,
        expectedProductId: productId,
        matchesExpectedProductId: pkgProductId === productId,
      });
      
      if (pkgProductId === productId) {
        console.log(`✅ CONFIRMED: rc_annual identifier matches expected product ID ${productId}`);
      } else {
        // For Web Billing, "Yearly" is a valid identifier - only warn if it's neither expected ID nor "Yearly"
        const isWebBillingYearly = pkgProductId === 'Yearly' || pkgProductId === 'yearly';
        if (!isWebBillingYearly) {
          console.warn(`⚠️ rc_annual package product ID differs:`, {
            actual: pkgProductId,
            expected: productId,
            note: 'Package will still work, but consider linking to product ' + productId + ' in RevenueCat Dashboard'
          });
        }
      }
      
      return byRcAnnualIdentifier;
    }
  }
  
  // Strategy 2: Match by exact product ID
  const byProductId = availablePackages.find((pkg: any) => {
    const pkgProductId = pkg?.storeProduct?.identifier ?? 
                        pkg?.rcBillingProduct?.identifier ?? 
                        pkg?.product?.identifier ?? '';
    return pkgProductId === productId;
  });
  
  if (byProductId) {
    const packageIdentifier = byProductId.identifier?.toLowerCase() || '';
    const isRcAnnual = packageIdentifier === 'rc_annual' || packageIdentifier === '$rc_annual';
    
    console.log(`✅ Found ${type} package by product ID: ${productId}`, byProductId.identifier);
    
    // Confirm rc_annual matches yearly product ID
    if (type === 'yearly' && productId === REVENUECAT_YEARLY_PRODUCT_ID && isRcAnnual) {
      console.log(`✅ CONFIRMED: rc_annual identifier matches product ID ${REVENUECAT_YEARLY_PRODUCT_ID}`);
      console.log(`   Package identifier: ${byProductId.identifier}`);
      console.log(`   Product ID: ${productId}`);
    }
    
    return byProductId;
  }
  
  // Strategy 3: Match by identifier keywords (case-insensitive)
  // Check package identifier, product identifiers, and titles
  const byIdentifier = availablePackages.find((pkg: any) => {
    const packageIdentifier = (pkg?.identifier ?? '').toLowerCase();
    const storeProductId = (pkg?.storeProduct?.identifier ?? '').toLowerCase();
    const rcBillingProductId = (pkg?.rcBillingProduct?.identifier ?? '').toLowerCase();
    const productId = (pkg?.product?.identifier ?? '').toLowerCase();
    
    // Check all identifier locations
    const matches = keywords.some(keyword => {
      const keywordLower = keyword.toLowerCase();
      return packageIdentifier.includes(keywordLower) ||
             storeProductId.includes(keywordLower) ||
             rcBillingProductId.includes(keywordLower) ||
             productId.includes(keywordLower);
    });
    
    if (matches) {
      const matchedKeywords = keywords.filter(kw => {
        const kwLower = kw.toLowerCase();
        return packageIdentifier.includes(kwLower) ||
               storeProductId.includes(kwLower) ||
               rcBillingProductId.includes(kwLower) ||
               productId.includes(kwLower);
      });
      
      console.log(`🔍 ${type} package candidate found by identifier:`, {
        packageIdentifier: pkg?.identifier,
        packageIdentifierLower: packageIdentifier,
        storeProductId: pkg?.storeProduct?.identifier,
        rcBillingProductId: pkg?.rcBillingProduct?.identifier,
        productId: pkg?.product?.identifier,
        matchedKeywords: matchedKeywords,
        isRcAnnual: matchedKeywords.some(kw => kw.toLowerCase() === 'rc_annual') || 
                   packageIdentifier === 'rc_annual' ||
                   storeProductId === 'rc_annual' ||
                   rcBillingProductId === 'rc_annual' ||
                   productId === 'rc_annual',
      });
      
      // Special confirmation for rc_annual
      if (type === 'yearly' && (matchedKeywords.some(kw => kw.toLowerCase() === 'rc_annual') || 
                                packageIdentifier === 'rc_annual' ||
                                storeProductId === 'rc_annual' ||
                                rcBillingProductId === 'rc_annual' ||
                                productId === 'rc_annual')) {
        console.log('✅ CONFIRMED: Yearly subscription package is using identifier "rc_annual"');
        console.log('   Package identifier:', pkg?.identifier);
        console.log('   Store Product ID:', pkg?.storeProduct?.identifier);
        console.log('   RC Billing Product ID:', pkg?.rcBillingProduct?.identifier);
        console.log('   Product ID:', pkg?.product?.identifier);
      }
    }
    
    return matches;
  });
  
  if (byIdentifier) {
    const matchedIdentifier = byIdentifier.identifier;
    const isRcAnnual = matchedIdentifier?.toLowerCase() === 'rc_annual' || 
                       matchedIdentifier?.toLowerCase() === '$rc_annual';
    
    // Get the product ID from the matched package
    const packageProductId = byIdentifier?.storeProduct?.identifier ?? 
                            byIdentifier?.rcBillingProduct?.identifier ?? 
                            byIdentifier?.product?.identifier ?? '';
    
    console.log(`✅ Found ${type} package by identifier: ${matchedIdentifier}`);
    console.log(`   Matched using identifier pattern from: ${keywords.join(', ')}`);
    console.log(`   Package product ID: ${packageProductId}`);
    console.log(`   Expected product ID: ${productId}`);
    
    if (type === 'yearly' && isRcAnnual) {
      console.log('✅ CONFIRMED: Yearly subscription is using identifier "rc_annual"');
      
      // Verify it matches the expected product ID
      if (packageProductId === productId && productId === REVENUECAT_YEARLY_PRODUCT_ID) {
        console.log(`✅ CONFIRMED: rc_annual identifier matches product ID ${REVENUECAT_YEARLY_PRODUCT_ID}`);
        console.log(`   Package identifier: ${matchedIdentifier}`);
        console.log(`   Package product ID: ${packageProductId}`);
        console.log(`   Expected product ID: ${productId}`);
      } else if (packageProductId && packageProductId !== productId) {
        // For Web Billing, "Yearly" is a valid identifier - only warn if it's neither expected ID nor "Yearly"
        const isWebBillingYearly = packageProductId === 'Yearly' || packageProductId === 'yearly';
        if (!isWebBillingYearly) {
          console.warn(`⚠️ rc_annual package product ID differs:`, {
            actual: packageProductId,
            expected: productId,
            note: 'Package will still work, but consider linking to product ' + productId + ' in RevenueCat Dashboard'
          });
        }
      }
    }
    
    return byIdentifier;
  }
  
  // Strategy 3: Match by product title keywords
  const byTitle = availablePackages.find((pkg: any) => {
    const title = (pkg?.storeProduct?.title ?? 
                   pkg?.rcBillingProduct?.title ?? 
                   pkg?.product?.title ?? '').toLowerCase();
    const matches = keywords.some(keyword => title.includes(keyword.toLowerCase()));
    
    if (matches) {
      console.log(`🔍 ${type} package candidate found by title:`, {
        title: pkg?.storeProduct?.title || pkg?.rcBillingProduct?.title || pkg?.product?.title,
        titleLower: title,
        matchedKeywords: keywords.filter(kw => title.includes(kw.toLowerCase())),
      });
    }
    
    return matches;
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
  // BUT: Don't use monthly package for yearly or vice versa
  if (availablePackages.length === 1) {
    const singlePackage = availablePackages[0];
    const singleIdentifier = (singlePackage?.identifier || '').toLowerCase();
    const singleTitle = (singlePackage?.storeProduct?.title || 
                        singlePackage?.rcBillingProduct?.title || 
                        singlePackage?.product?.title || '').toLowerCase();
    
    // Check if the single package matches the requested type
    const isMonthly = singleIdentifier.includes('month') || singleTitle.includes('month');
    const isYearly = singleIdentifier.includes('year') || 
                    singleIdentifier.includes('annual') ||
                    singleTitle.includes('year') ||
                    singleTitle.includes('annual');
    
    if (type === 'monthly' && isMonthly) {
      console.log(`✅ Only one package available and it matches monthly: ${singlePackage.identifier}`);
      return singlePackage;
    } else if (type === 'yearly' && isYearly) {
      console.log(`✅ Only one package available and it matches yearly: ${singlePackage.identifier}`);
      return singlePackage;
    } else {
      console.warn(`⚠️ Only one package available (${singlePackage.identifier}) but it doesn't match ${type} type`);
      console.warn(`   Package appears to be: ${isMonthly ? 'monthly' : isYearly ? 'yearly' : 'unknown'}`);
      return null; // Don't use wrong package type
    }
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
    
    // Search all offerings for rc_annual package and validate product ID
    const YEARLY_OFFERING_ID = 'ofrnga3a1440e88';
    const yearlyOfferingValidation = offerings?.all?.[YEARLY_OFFERING_ID];
    
    // Log all available offerings
    if (offerings?.all) {
      console.log(`📋 All available offerings:`, Object.keys(offerings.all));
      for (const offeringKey in offerings.all) {
        const offering = offerings.all[offeringKey];
        console.log(`   Offering "${offeringKey}":`, {
          identifier: offering.identifier,
          packageCount: offering.availablePackages?.length || 0,
          packages: offering.availablePackages?.map((pkg: any) => ({
            identifier: pkg?.identifier,
            productId: pkg?.storeProduct?.identifier || pkg?.rcBillingProduct?.identifier || pkg?.product?.identifier,
            title: pkg?.storeProduct?.title || pkg?.rcBillingProduct?.title || pkg?.product?.title,
          })) || [],
        });
      }
    }
    
    // Search all offerings for rc_annual package
    let rcAnnualPkg: any = null;
    let rcAnnualOfferingKey: string | null = null;
    
    if (offerings?.all) {
      for (const offeringKey in offerings.all) {
        const offering = offerings.all[offeringKey];
        const foundPkg = offering?.availablePackages?.find((pkg: any) => {
          const identifier = (pkg?.identifier || '').toLowerCase();
          return identifier === 'rc_annual' || identifier === '$rc_annual';
        });
        
        if (foundPkg) {
          rcAnnualPkg = foundPkg;
          rcAnnualOfferingKey = offeringKey;
          break;
        }
      }
    }
    
    if (rcAnnualPkg) {
      const productId = rcAnnualPkg?.storeProduct?.identifier || 
                       rcAnnualPkg?.rcBillingProduct?.identifier || 
                       rcAnnualPkg?.product?.identifier;
      
      console.log(`✅ Found rc_annual package in offering "${rcAnnualOfferingKey}":`, {
        packageIdentifier: rcAnnualPkg?.identifier,
        productId: productId,
        expectedProductId: REVENUECAT_YEARLY_PRODUCT_ID,
        matchesExpected: productId === REVENUECAT_YEARLY_PRODUCT_ID,
        price: rcAnnualPkg?.storeProduct?.priceString || rcAnnualPkg?.rcBillingProduct?.priceString || 'N/A',
        allProductIds: {
          storeProduct: rcAnnualPkg?.storeProduct?.identifier,
          rcBillingProduct: rcAnnualPkg?.rcBillingProduct?.identifier,
          product: rcAnnualPkg?.product?.identifier,
        },
      });
      
      if (productId === REVENUECAT_YEARLY_PRODUCT_ID) {
        console.log(`✅ CONFIRMED: rc_annual package has correct product ID (${REVENUECAT_YEARLY_PRODUCT_ID})`);
      } else {
        // For Web Billing, "Yearly" is a valid identifier - only warn if it's neither expected ID nor "Yearly"
        const isWebBillingYearly = productId === 'Yearly' || productId === 'yearly';
        if (!isWebBillingYearly && !hasWarnedAboutProductIdMismatch) {
          hasWarnedAboutProductIdMismatch = true;
          console.warn(`⚠️ rc_annual package product ID mismatch:`, {
            actual: productId,
            expected: REVENUECAT_YEARLY_PRODUCT_ID,
            note: 'Package will still work. To fix: RevenueCat Dashboard → Packages → rc_annual → Link to product ' + REVENUECAT_YEARLY_PRODUCT_ID
          });
        } else if (isWebBillingYearly && !hasWarnedAboutProductIdMismatch) {
          hasWarnedAboutProductIdMismatch = true;
          console.log(`ℹ️ rc_annual package using Web Billing identifier "Yearly" (this is valid for Web Billing)`);
        }
      }
    } else {
      console.warn(`⚠️ rc_annual package not found in any offering`);
      if (yearlyOfferingValidation) {
        console.warn(`   Offering "${YEARLY_OFFERING_ID}" exists but doesn't contain rc_annual`);
        console.warn(`   Packages in "${YEARLY_OFFERING_ID}":`, yearlyOfferingValidation.availablePackages?.map((p: any) => p?.identifier) || []);
      } else {
        console.warn(`   Offering "${YEARLY_OFFERING_ID}" not found in RevenueCat offerings`);
      }
    }

    console.log('📦 RevenueCat offerings received:', {
      hasCurrent: !!offerings?.current,
      currentOfferingId: offerings?.current?.identifier,
      packageCount: availablePackages.length,
      allOfferings: offerings?.all ? Object.keys(offerings.all) : [],
      yearlyOfferingId: YEARLY_OFFERING_ID,
      hasYearlyOffering: !!yearlyOfferingValidation,
      rcAnnualFound: !!rcAnnualPkg,
      rcAnnualOffering: rcAnnualOfferingKey,
      packages: availablePackages.map((pkg: any) => {
        const product = pkg?.storeProduct || pkg?.rcBillingProduct || pkg?.product;
        const priceObj = product?.price;
        return {
          identifier: pkg?.identifier,
          productIds: {
            storeProduct: pkg?.storeProduct?.identifier || 'N/A',
            rcBillingProduct: pkg?.rcBillingProduct?.identifier || 'N/A',
            product: pkg?.product?.identifier || 'N/A',
          },
          hasStoreProduct: !!pkg?.storeProduct,
          hasRcBillingProduct: !!pkg?.rcBillingProduct,
          hasProduct: !!pkg?.product,
          priceInfo: {
            priceString: product?.priceString || 'N/A',
            formattedPrice: product?.formattedPrice || 'N/A',
            priceObject: priceObj ? {
              amount: priceObj.amount,
              amountMicros: priceObj.amountMicros,
              currency: priceObj.currency,
            } : 'N/A',
            displayName: product?.displayName || 'N/A',
          },
          title: product?.title || product?.displayName || 'N/A',
        };
      }),
    });
    
    // Warn if only one package found when we expect two
    if (availablePackages.length === 1) {
      const foundPackage = availablePackages[0];
      const foundIdentifier = foundPackage?.identifier || 'unknown';
      const foundProductId = foundPackage?.storeProduct?.identifier || 
                            foundPackage?.rcBillingProduct?.identifier || 
                            foundPackage?.product?.identifier || 'unknown';
      
      console.warn('⚠️ Only ONE package found in RevenueCat offering, but TWO products exist in dashboard!');
      console.warn(`   Found package: ${foundIdentifier} (Product ID: ${foundProductId})`);
      console.warn('   This usually means:');
      console.warn('   1. Only one package is added to the current offering');
      console.warn('   2. The second package needs to be added to the offering');
      console.warn('   3. Check RevenueCat Dashboard → Offerings → Current Offering → Packages');
      console.warn('   4. Both "Monthly Subscription" and "Yearly Subscription" packages must be in the offering');
      console.warn('');
      console.warn('   📋 SPECIFIC INSTRUCTIONS FOR YEARLY PACKAGE:');
      console.warn('   - The yearly package should have identifier: "rc_annual" (or "$rc_annual")');
      console.warn(`   - The yearly package should use product ID: "${REVENUECAT_YEARLY_PRODUCT_ID}"`);
      console.warn(`   - Go to RevenueCat Dashboard → Products → Find product "${REVENUECAT_YEARLY_PRODUCT_ID}"`);
      console.warn('   - Create a package with identifier "rc_annual" for this product');
      console.warn('   - Add this package to your Current Offering');
    }
    
    // Check other offerings for the missing package
    if (availablePackages.length === 1 && offerings?.all) {
      console.log('🔍 Checking other offerings for missing package...');
      const allOfferingKeys = Object.keys(offerings.all);
      console.log(`   Found ${allOfferingKeys.length} other offering(s): ${allOfferingKeys.join(', ')}`);
      
      for (const offeringKey of allOfferingKeys) {
        const offering = offerings.all[offeringKey];
        const otherPackages = offering?.availablePackages ?? [];
        console.log(`   Offering "${offeringKey}" has ${otherPackages.length} package(s):`, 
          otherPackages.map((p: any) => ({
            identifier: p?.identifier,
            productId: p?.storeProduct?.identifier || p?.rcBillingProduct?.identifier || p?.product?.identifier,
          }))
        );
        
        // Check if this offering has rc_annual
        const hasRcAnnual = otherPackages.some((p: any) => {
          const identifier = (p?.identifier || '').toLowerCase();
          return identifier === 'rc_annual' || identifier === '$rc_annual';
        });
        
        if (hasRcAnnual) {
          console.warn(`   ⚠️ Found "rc_annual" package in offering "${offeringKey}", but it's not in the current offering!`);
          console.warn(`   → You need to add the "rc_annual" package to your Current Offering`);
        }
      }
    }

    // If only one package found, try to find the missing one in other offerings
    let allPackagesToSearch = [...availablePackages];
    if (availablePackages.length === 1 && offerings?.all) {
      console.log('🔍 Searching other offerings for missing package...');
      
      // Prioritize checking the specific yearly offering ID
      const YEARLY_OFFERING_ID = 'ofrnga3a1440e88';
      if (offerings.all[YEARLY_OFFERING_ID]) {
        const yearlyOffering = offerings.all[YEARLY_OFFERING_ID];
        const yearlyPackages = yearlyOffering?.availablePackages ?? [];
        console.log(`   🔍 Checking specific yearly offering "${YEARLY_OFFERING_ID}":`, {
          packageCount: yearlyPackages.length,
          packages: yearlyPackages.map((p: any) => ({
            identifier: p?.identifier,
            productId: p?.storeProduct?.identifier || p?.rcBillingProduct?.identifier || p?.product?.identifier,
          })),
        });
        
        // Add packages from the yearly offering
        for (const pkg of yearlyPackages) {
          const pkgId = pkg?.identifier;
          if (pkgId && !allPackagesToSearch.some(p => p?.identifier === pkgId)) {
            console.log(`   ✅ Found package "${pkgId}" in yearly offering "${YEARLY_OFFERING_ID}"`);
            allPackagesToSearch.push(pkg);
          }
        }
      }
      
      // Also check other offerings
      for (const offeringKey in offerings.all) {
        if (offeringKey === YEARLY_OFFERING_ID) continue; // Already checked
        const offering = offerings.all[offeringKey];
        const otherPackages = offering?.availablePackages ?? [];
        // Add packages from other offerings that aren't already in the list
        for (const pkg of otherPackages) {
          const pkgId = pkg?.identifier;
          if (pkgId && !allPackagesToSearch.some(p => p?.identifier === pkgId)) {
            console.log(`   Found package "${pkgId}" in offering "${offeringKey}"`);
            allPackagesToSearch.push(pkg);
          }
        }
      }
      console.log(`   Total packages to search: ${allPackagesToSearch.length} (${availablePackages.length} from current, ${allPackagesToSearch.length - availablePackages.length} from other offerings)`);
    }
    
    // Use the same package finding logic as purchase flow for consistency
    // Search in all available packages (current + other offerings)
    const monthlyPkg = findPackageByType(allPackagesToSearch, offerings, 'monthly');
    const yearlyPkg = findPackageByType(allPackagesToSearch, offerings, 'yearly');
    
    // If yearly package was found in another offering, warn about it
    if (yearlyPkg && availablePackages.length === 1) {
      const yearlyInCurrent = availablePackages.some(p => p?.identifier === yearlyPkg?.identifier);
      if (!yearlyInCurrent) {
        console.warn('⚠️ Yearly package (rc_annual) was found in another offering, but not in the current offering!');
        console.warn('   → You need to add the "rc_annual" package to your Current Offering');
        console.warn('   → RevenueCat Dashboard → Offerings → Current Offering → Add Package');
        console.warn(`   → Select the package with identifier "rc_annual" and product ID "${REVENUECAT_YEARLY_PRODUCT_ID}"`);
      }
    }

    // Log package finding results
    console.log('📦 Package finding results:', {
      monthly: monthlyPkg ? {
        identifier: monthlyPkg.identifier,
        found: true,
      } : { found: false },
      yearly: yearlyPkg ? {
        identifier: yearlyPkg.identifier,
        found: true,
      } : { 
        found: false,
        availablePackages: availablePackages.map((p: any) => ({
          identifier: p.identifier,
          title: p.storeProduct?.title || p.rcBillingProduct?.title || p.product?.title,
        })),
      },
    });

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
        reason: !yearlyPkg ? 'Package not found by findPackageByType' : 
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

