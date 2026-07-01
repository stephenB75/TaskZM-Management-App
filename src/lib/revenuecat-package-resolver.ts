/**
 * Shared RevenueCat offering/package resolution for web and native SDKs.
 */

import {
  REVENUECAT_MONTHLY_PRODUCT_ID,
  REVENUECAT_YEARLY_PRODUCT_ID,
  REVENUECAT_YEARLY_OFFERING_ID,
} from './subscription-constants';

export type SubscriptionPackageType = 'monthly' | 'yearly';

/** Minimal package shape shared by purchases-js and purchases-capacitor. */
export type RevenueCatPackageLike = {
  identifier?: string;
  storeProduct?: { identifier?: string; title?: string; priceString?: string };
  rcBillingProduct?: { identifier?: string; title?: string; priceString?: string };
  product?: { identifier?: string; title?: string; description?: string; priceString?: string };
};

export type RevenueCatOfferingsLike = {
  current?: {
    identifier?: string;
    availablePackages?: RevenueCatPackageLike[];
    monthly?: RevenueCatPackageLike;
    annual?: RevenueCatPackageLike;
  };
  all?: Record<
    string,
    {
      identifier?: string;
      availablePackages?: RevenueCatPackageLike[];
    }
  >;
};

const PACKAGE_KEYWORDS: Record<SubscriptionPackageType, readonly string[]> = {
  monthly: ['month', 'monthly', 'rc_monthly', '$rc_monthly'],
  yearly: ['year', 'yearly', 'annual', 'annually', 'rc_yearly', 'rc_annual', '$rc_yearly', '$rc_annual'],
};

const YEARLY_PACKAGE_IDENTIFIERS = new Set(['rc_annual', '$rc_annual']);

export function getExpectedProductId(type: SubscriptionPackageType): string {
  return type === 'monthly' ? REVENUECAT_MONTHLY_PRODUCT_ID : REVENUECAT_YEARLY_PRODUCT_ID;
}

export function getPackageProductId(pkg: RevenueCatPackageLike | null | undefined): string {
  if (!pkg) return '';
  return (
    pkg.storeProduct?.identifier ??
    pkg.rcBillingProduct?.identifier ??
    pkg.product?.identifier ??
    ''
  );
}

export function getPackageTitle(pkg: RevenueCatPackageLike | null | undefined): string {
  if (!pkg) return '';
  return (
    pkg.storeProduct?.title ??
    pkg.rcBillingProduct?.title ??
    pkg.product?.title ??
    ''
  );
}

/** Infer monthly vs yearly from a store product, RC product, or package identifier. */
export function inferBillingPeriodFromProductId(
  productId: string | null | undefined
): SubscriptionPackageType | null {
  if (!productId) return null;

  const lower = productId.toLowerCase();
  if (lower === REVENUECAT_YEARLY_PRODUCT_ID.toLowerCase()) return 'yearly';
  if (lower === REVENUECAT_MONTHLY_PRODUCT_ID.toLowerCase()) return 'monthly';
  if (YEARLY_PACKAGE_IDENTIFIERS.has(lower)) return 'yearly';

  if (
    lower.includes('yearly') ||
    lower.includes('annual') ||
    lower.includes('annually') ||
    (lower.includes('year') && !lower.includes('month'))
  ) {
    return 'yearly';
  }
  if (lower.includes('monthly') || lower.includes('month')) {
    return 'monthly';
  }

  return null;
}

function matchesKeywords(value: string, keywords: readonly string[]): boolean {
  const lower = value.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
}

function packageMatchesType(pkg: RevenueCatPackageLike, type: SubscriptionPackageType): boolean {
  const keywords = PACKAGE_KEYWORDS[type];
  const identifier = (pkg.identifier ?? '').toLowerCase();
  const productId = getPackageProductId(pkg).toLowerCase();
  const title = getPackageTitle(pkg).toLowerCase();

  return (
    matchesKeywords(identifier, keywords) ||
    matchesKeywords(productId, keywords) ||
    matchesKeywords(title, keywords)
  );
}

function dedupePackages(packages: RevenueCatPackageLike[]): RevenueCatPackageLike[] {
  const seen = new Set<string>();
  const result: RevenueCatPackageLike[] = [];

  for (const pkg of packages) {
    const key = pkg.identifier ?? getPackageProductId(pkg);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(pkg);
  }

  return result;
}

/**
 * Collect packages from the current offering plus supplemental offerings
 * (e.g. yearly-only offering) so purchase and pricing use the same set.
 */
export function collectAllOfferingPackages(
  offerings: RevenueCatOfferingsLike | null | undefined
): RevenueCatPackageLike[] {
  if (!offerings) return [];

  const merged: RevenueCatPackageLike[] = [
    ...(offerings.current?.availablePackages ?? []),
  ];

  const supplementalOfferingIds = [REVENUECAT_YEARLY_OFFERING_ID];
  for (const offeringId of supplementalOfferingIds) {
    const supplemental = offerings.all?.[offeringId]?.availablePackages ?? [];
    merged.push(...supplemental);
  }

  if (offerings.all) {
    for (const offering of Object.values(offerings.all)) {
      merged.push(...(offering.availablePackages ?? []));
    }
  }

  return dedupePackages(merged);
}

export function findSubscriptionPackage(
  packages: RevenueCatPackageLike[],
  offerings: RevenueCatOfferingsLike | null | undefined,
  type: SubscriptionPackageType
): RevenueCatPackageLike | null {
  const expectedProductId = getExpectedProductId(type);
  const keywords = PACKAGE_KEYWORDS[type];

  if (type === 'yearly') {
    const byRcAnnual = packages.find((pkg) =>
      YEARLY_PACKAGE_IDENTIFIERS.has((pkg.identifier ?? '').toLowerCase())
    );
    if (byRcAnnual) return byRcAnnual;
  }

  const byProductId = packages.find(
    (pkg) => getPackageProductId(pkg) === expectedProductId
  );
  if (byProductId) return byProductId;

  const byIdentifier = packages.find((pkg) => {
    const identifier = (pkg.identifier ?? '').toLowerCase();
    const productId = getPackageProductId(pkg).toLowerCase();
    return (
      matchesKeywords(identifier, keywords) || matchesKeywords(productId, keywords)
    );
  });
  if (byIdentifier) return byIdentifier;

  const byTitle = packages.find((pkg) => matchesKeywords(getPackageTitle(pkg), keywords));
  if (byTitle) return byTitle;

  if (type === 'monthly' && offerings?.current?.monthly) {
    return offerings.current.monthly;
  }
  if (type === 'yearly' && offerings?.current?.annual) {
    return offerings.current.annual;
  }

  if (packages.length === 1) {
    const single = packages[0];
    return packageMatchesType(single, type) ? single : null;
  }

  return null;
}

export function resolveSubscriptionPackage(
  offerings: RevenueCatOfferingsLike | null | undefined,
  type: SubscriptionPackageType
): RevenueCatPackageLike | null {
  const packages = collectAllOfferingPackages(offerings);
  if (packages.length === 0) return null;
  return findSubscriptionPackage(packages, offerings, type);
}
