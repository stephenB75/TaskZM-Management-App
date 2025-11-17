/**
 * RevenueCat utility helpers for web
 * Used for fetching offerings (pricing) and syncing entitlements
 * while leaving actual payment processing to Stripe/backend.
 */

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

    const findByIdentifier = (keyword: string) =>
      availablePackages.find((pkg: any) => {
        const identifier = pkg?.identifier?.toLowerCase?.() ?? '';
        const productId = pkg?.storeProduct?.identifier?.toLowerCase?.() ?? '';
        return identifier.includes(keyword) || productId.includes(keyword);
      }) ?? null;

    const monthlyPkg = findByIdentifier('month') ?? offerings?.current?.monthly ?? null;
    const yearlyPkg = findByIdentifier('year') ?? offerings?.current?.annual ?? null;

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

