/**
 * RevenueCat facade — routes to web (Stripe Checkout) or native (App Store / Play Store IAP).
 * On iOS/Android, prefers native IAP when configured; falls back to web billing when needed.
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
  cancelled?: boolean;
};

export type SubscriptionBillingChannel = 'native-store' | 'web';

let configured = false;
let activeBillingChannel: SubscriptionBillingChannel = 'web';

function hasNativeRevenueCatApiKey(): boolean {
  const platform = getPlatform();
  if (platform.isIOS) {
    return Boolean(import.meta.env.VITE_REVENUECAT_IOS_API_KEY);
  }
  if (platform.isAndroid) {
    return Boolean(import.meta.env.VITE_REVENUECAT_ANDROID_API_KEY);
  }
  return false;
}

export function hasWebRevenueCatApiKey(): boolean {
  return Boolean(import.meta.env.VITE_REVENUECAT_WEB_PUBLIC_KEY);
}

export function canUseNativeStoreBilling(): boolean {
  return getPlatform().isNative && hasNativeRevenueCatApiKey();
}

export function canUseWebBilling(): boolean {
  return hasWebRevenueCatApiKey();
}

export function getSubscriptionBillingChannel(): SubscriptionBillingChannel {
  return activeBillingChannel;
}

async function loadImplForChannel(channel: SubscriptionBillingChannel) {
  if (channel === 'native-store') {
    return import('./revenuecat-native');
  }
  return import('./revenuecat-web');
}

function resolvePreferredChannel(
  preferredChannel?: SubscriptionBillingChannel
): SubscriptionBillingChannel | null {
  if (preferredChannel === 'native-store' && canUseNativeStoreBilling()) {
    return 'native-store';
  }
  if (preferredChannel === 'web' && canUseWebBilling()) {
    return 'web';
  }
  if (getPlatform().isNative && canUseNativeStoreBilling()) {
    return 'native-store';
  }
  if (canUseWebBilling()) {
    return 'web';
  }
  return null;
}

async function configureChannel(
  userId: string,
  channel: SubscriptionBillingChannel,
  forceReconfigure: boolean
): Promise<boolean> {
  const impl = await loadImplForChannel(channel);
  await impl.configureRevenueCat(userId, forceReconfigure);
  return impl.isRevenueCatConfigured();
}

export async function configureRevenueCat(
  userId: string,
  forceReconfigure = false,
  preferredChannel?: SubscriptionBillingChannel
): Promise<void> {
  if (!userId) {
    configured = false;
    return;
  }

  const primaryChannel = resolvePreferredChannel(preferredChannel);
  if (!primaryChannel) {
    configured = false;
    return;
  }

  activeBillingChannel = primaryChannel;
  let isReady = await configureChannel(userId, primaryChannel, forceReconfigure);

  if (
    !isReady &&
    primaryChannel === 'native-store' &&
    canUseWebBilling()
  ) {
    activeBillingChannel = 'web';
    isReady = await configureChannel(userId, 'web', forceReconfigure);
  }

  configured = isReady;
}

export async function setSubscriptionBillingChannel(
  userId: string,
  channel: SubscriptionBillingChannel
): Promise<void> {
  await configureRevenueCat(userId, true, channel);
}

export function isRevenueCatConfigured(): boolean {
  return configured;
}

export async function resetRevenueCat(): Promise<void> {
  const impl = await loadImplForChannel(activeBillingChannel);
  await impl.resetRevenueCat();
  configured = false;
  activeBillingChannel = 'web';
}

export async function getOfferings(): Promise<RevenueCatOfferings> {
  const impl = await loadImplForChannel(activeBillingChannel);
  return impl.getOfferings();
}

export async function restorePurchases(): Promise<{ success: boolean; error?: string }> {
  const impl = await loadImplForChannel(activeBillingChannel);
  return impl.restorePurchases();
}

export async function getCustomerInfo(): Promise<unknown | null> {
  const impl = await loadImplForChannel(activeBillingChannel);
  return impl.getCustomerInfo();
}

export async function purchaseProSubscription(
  packageType: 'monthly' | 'yearly'
): Promise<PurchaseResult> {
  const impl = await loadImplForChannel(activeBillingChannel);
  return impl.purchaseProSubscription(packageType);
}

/** True when the active checkout uses App Store / Play Store (not Stripe web checkout). */
export function isNativeStoreBilling(): boolean {
  return activeBillingChannel === 'native-store';
}

/** True when both native IAP and web checkout are available (native app builds). */
export function supportsBillingChannelChoice(): boolean {
  return canUseNativeStoreBilling() && canUseWebBilling();
}
