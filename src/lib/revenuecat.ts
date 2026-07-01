/**
 * RevenueCat facade — routes to web (Stripe Checkout) or native (App Store / Play Store IAP).
 */

import { getPlatform } from './platform';

export type RevenueCatOfferingDetails = {
  priceString: string;
  title: string;
  description: string;
} | null;

export type RevenueCatOfferings = {
  monthly: RevenueCatOfferingDetails;
  yearly: RevenueCatOfferingDetails;
};

export type PurchaseResult = {
  success: boolean;
  error?: string;
  customerInfo?: unknown;
};

let configured = false;

async function loadImpl() {
  if (getPlatform().isNative) {
    return import('./revenuecat-native');
  }
  return import('./revenuecat-web');
}

export async function configureRevenueCat(userId: string, forceReconfigure = false): Promise<void> {
  const impl = await loadImpl();
  await impl.configureRevenueCat(userId, forceReconfigure);
  configured = impl.isRevenueCatConfigured();
}

export function isRevenueCatConfigured(): boolean {
  return configured;
}

export async function resetRevenueCat(): Promise<void> {
  const impl = await loadImpl();
  await impl.resetRevenueCat();
  configured = false;
}

export async function getOfferings(): Promise<RevenueCatOfferings> {
  const impl = await loadImpl();
  return impl.getOfferings();
}

export async function restorePurchases(): Promise<{ success: boolean; error?: string }> {
  const impl = await loadImpl();
  return impl.restorePurchases();
}

export async function getCustomerInfo(): Promise<unknown | null> {
  const impl = await loadImpl();
  return impl.getCustomerInfo();
}

export async function purchaseProSubscription(
  packageType: 'monthly' | 'yearly'
): Promise<PurchaseResult> {
  const impl = await loadImpl();
  return impl.purchaseProSubscription(packageType);
}

/** True when billing uses App Store / Play Store (not Stripe Checkout). */
export function isNativeStoreBilling(): boolean {
  return getPlatform().isNative;
}
