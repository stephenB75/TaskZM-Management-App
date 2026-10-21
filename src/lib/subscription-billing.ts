/**
 * Subscription purchase channel helpers (App Store / Play Store / Stripe web).
 */

import { Browser } from '@capacitor/browser';
import { getPlatform } from './platform';
import { MOBILE_APP_ID } from './mobile-constants';

export type SubscriptionPurchaseStore =
  | 'stripe'
  | 'app_store'
  | 'play_store'
  | 'demo_account'
  | 'admin_granted'
  | 'manual_update'
  | 'revenuecat'
  | string;

export const SUBSCRIPTION_MANAGE_URLS = {
  ios: 'https://apps.apple.com/account/subscriptions',
  android: `https://play.google.com/store/account/subscriptions?package=${MOBILE_APP_ID}`,
} as const;

/** Normalize RevenueCat / legacy store strings to lowercase snake_case. */
export function normalizeSubscriptionPurchaseStore(
  raw: string | null | undefined
): SubscriptionPurchaseStore | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().replace(/-/g, '_');
  if (lower.includes('app_store') || lower === 'appstore') return 'app_store';
  if (lower.includes('play_store') || lower === 'playstore') return 'play_store';
  if (lower.includes('stripe') || lower === 'rc_billing') return 'stripe';
  if (lower.includes('demo')) return 'demo_account';
  if (lower.includes('admin')) return 'admin_granted';
  return lower;
}

export function isNativePurchasedSubscriptionStore(
  store: SubscriptionPurchaseStore | null | undefined
): boolean {
  const normalized = normalizeSubscriptionPurchaseStore(store ?? undefined);
  return normalized === 'app_store' || normalized === 'play_store';
}

export function isWebPurchasedSubscriptionStore(
  store: SubscriptionPurchaseStore | null | undefined
): boolean {
  return normalizeSubscriptionPurchaseStore(store ?? undefined) === 'stripe';
}

export async function openNativeSubscriptionManagement(): Promise<void> {
  const platform = getPlatform();
  const url = platform.isAndroid
    ? SUBSCRIPTION_MANAGE_URLS.android
    : SUBSCRIPTION_MANAGE_URLS.ios;

  if (platform.isNative) {
    await Browser.open({ url });
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Open RevenueCat's customer portal, where web (card) subscribers change or cancel their plan. */
export async function openWebSubscriptionManagement(managementUrl: string): Promise<void> {
  if (getPlatform().isNative) {
    await Browser.open({ url: managementUrl });
    return;
  }
  window.open(managementUrl, '_blank', 'noopener,noreferrer');
}
