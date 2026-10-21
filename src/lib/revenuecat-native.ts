/**
 * RevenueCat helpers for native iOS/Android (App Store / Play Store IAP).
 */

import { Purchases, LOG_LEVEL, type PurchasesPackage } from '@revenuecat/purchases-capacitor';
import { getPlatform } from './platform';
import { logger } from './logger';
import { REVENUECAT_PRO_ENTITLEMENT_ID, isRevenueCatProEntitlementId } from './mobile-constants';
import {
  collectAllOfferingPackages,
  getPackageProductId,
  resolveSubscriptionPackage,
  type RevenueCatOfferingsLike,
} from './revenuecat-package-resolver';

let isConfigured = false;
let isInitializing = false;

type OfferingDetails = {
  priceString: string;
  title: string;
  description: string;
} | null;

function getNativeApiKey(): string | undefined {
  const platform = getPlatform();
  if (platform.isIOS) {
    return import.meta.env.VITE_REVENUECAT_IOS_API_KEY;
  }
  if (platform.isAndroid) {
    return import.meta.env.VITE_REVENUECAT_ANDROID_API_KEY;
  }
  return undefined;
}

function packageToOfferingDetails(pkg: PurchasesPackage | null): OfferingDetails {
  if (!pkg?.product) return null;
  return {
    priceString: pkg.product.priceString,
    title: pkg.product.title,
    description: pkg.product.description,
  };
}

export async function configureRevenueCat(userId: string, forceReconfigure = false): Promise<void> {
  if (typeof window === 'undefined' || !userId) return;

  const apiKey = getNativeApiKey();
  if (!apiKey) {
    logger.warn('RevenueCat native API key missing (VITE_REVENUECAT_IOS_API_KEY / VITE_REVENUECAT_ANDROID_API_KEY)');
    return;
  }

  if (isConfigured && !forceReconfigure) return;
  if (isInitializing) return;

  isInitializing = true;
  try {
    await Purchases.setLogLevel({ level: import.meta.env.DEV ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN });
    await Purchases.configure({
      apiKey,
      appUserID: userId,
    });
    isConfigured = true;
    logger.info('RevenueCat native SDK configured');
  } catch (error) {
    logger.error('RevenueCat native configuration error:', error);
    isConfigured = false;
  } finally {
    isInitializing = false;
  }
}

export function isRevenueCatConfigured(): boolean {
  return typeof window !== 'undefined' && isConfigured;
}

export async function resetRevenueCat(): Promise<void> {
  if (!isConfigured) return;
  try {
    await Purchases.logOut();
  } catch (error) {
    logger.debug('RevenueCat native logOut error (non-critical):', error);
  } finally {
    isConfigured = false;
  }
}

export async function getOfferings(): Promise<{
  monthly: OfferingDetails;
  yearly: OfferingDetails;
}> {
  if (!isRevenueCatConfigured()) {
    return { monthly: null, yearly: null };
  }

  try {
    const offerings = await Purchases.getOfferings();
    const offeringsLike = offerings as unknown as RevenueCatOfferingsLike;
    const monthlyPkg = resolveSubscriptionPackage(offeringsLike, 'monthly') as PurchasesPackage | null;
    const yearlyPkg = resolveSubscriptionPackage(offeringsLike, 'yearly') as PurchasesPackage | null;
    return {
      monthly: packageToOfferingDetails(monthlyPkg),
      yearly: packageToOfferingDetails(yearlyPkg),
    };
  } catch (error) {
    logger.error('RevenueCat native getOfferings error:', error);
    return { monthly: null, yearly: null };
  }
}

export async function restorePurchases(): Promise<{ success: boolean; error?: string }> {
  if (!isRevenueCatConfigured()) {
    return { success: false, error: 'RevenueCat not configured' };
  }
  try {
    await Purchases.restorePurchases();
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Restore failed';
    logger.error('RevenueCat native restore error:', error);
    return { success: false, error: message };
  }
}

export async function getCustomerInfo(): Promise<Record<string, unknown> | null> {
  if (!isRevenueCatConfigured()) return null;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return customerInfo as unknown as Record<string, unknown>;
  } catch (error) {
    logger.error('RevenueCat native getCustomerInfo error:', error);
    return null;
  }
}

export async function purchaseProSubscription(
  packageType: 'monthly' | 'yearly'
): Promise<{ success: boolean; error?: string; customerInfo?: Record<string, unknown> }> {
  if (!isRevenueCatConfigured()) {
    return {
      success: false,
      error: 'RevenueCat not configured. Please refresh and try again.',
    };
  }

  try {
    const offerings = await Purchases.getOfferings();
    const offeringsLike = offerings as unknown as RevenueCatOfferingsLike;
    const allPackages = collectAllOfferingPackages(offeringsLike);

    if (allPackages.length === 0) {
      return { success: false, error: 'No subscription packages available.' };
    }

    const selectedPackage = resolveSubscriptionPackage(offeringsLike, packageType) as PurchasesPackage | null;
    if (!selectedPackage) {
      return {
        success: false,
        error: `${packageType === 'monthly' ? 'Monthly' : 'Yearly'} subscription not found.`,
      };
    }

    logger.debug(`RevenueCat native purchase ${packageType}`, {
      packageIdentifier: selectedPackage.identifier,
      productId: getPackageProductId(selectedPackage),
    });

    const { customerInfo } = await Purchases.purchasePackage({ aPackage: selectedPackage });
    const entitlements = (customerInfo as { entitlements?: { active?: Record<string, unknown> } })
      ?.entitlements?.active;
    const hasPro =
      entitlements &&
      (entitlements[REVENUECAT_PRO_ENTITLEMENT_ID] ||
        Object.keys(entitlements).some(isRevenueCatProEntitlementId));

    if (!hasPro) {
      return { success: false, error: 'Purchase completed but Pro entitlement not active.' };
    }

    return { success: true, customerInfo: customerInfo as unknown as Record<string, unknown> };
  } catch (error: unknown) {
    const err = error as { userCancelled?: boolean; message?: string };
    if (err.userCancelled) {
      return { success: false, error: 'Purchase cancelled' };
    }
    const message = err.message ?? 'Purchase failed';
    logger.error('RevenueCat native purchase error:', error);
    return { success: false, error: message };
  }
}

export function isNativeStoreBilling(): boolean {
  return true;
}
