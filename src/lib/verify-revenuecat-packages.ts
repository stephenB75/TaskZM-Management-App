/**
 * RevenueCat Package Verification Utility
 * Provides comprehensive verification of RevenueCat packages and configuration
 */

import { getOfferings, isRevenueCatConfigured, getCurrentUserId } from './revenuecat';
import { MONTHLY_PACKAGE_IDENTIFIERS, YEARLY_PACKAGE_IDENTIFIERS } from './subscription-constants';
import { getPlatform } from './platform';

export interface PackageVerificationResult {
  isConfigured: boolean;
  userId: string | null;
  platform: string;
  offeringsAvailable: boolean;
  offeringIdentifier: string | null;
  packageCount: number;
  packages: Array<{
    identifier: string;
    productId: string;
    priceString: string;
    price: number | null;
    currencyCode: string;
    title: string;
    description: string;
    subscriptionPeriod: string | null;
    matchedAs: 'monthly' | 'yearly' | 'none';
    matchMethod: string | null;
  }>;
  monthlyPackageFound: boolean;
  yearlyPackageFound: boolean;
  monthlyPackage: any | null;
  yearlyPackage: any | null;
  errors: string[];
  warnings: string[];
}

/**
 * Verify RevenueCat packages and configuration
 */
export async function verifyRevenueCatPackages(): Promise<PackageVerificationResult> {
  const platform = getPlatform();
  const result: PackageVerificationResult = {
    isConfigured: false,
    userId: null,
    platform: platform.platform,
    offeringsAvailable: false,
    offeringIdentifier: null,
    packageCount: 0,
    packages: [],
    monthlyPackageFound: false,
    yearlyPackageFound: false,
    monthlyPackage: null,
    yearlyPackage: null,
    errors: [],
    warnings: [],
  };

  try {
    // Check configuration
    result.isConfigured = isRevenueCatConfigured();
    result.userId = getCurrentUserId();

    if (!result.isConfigured) {
      result.errors.push('RevenueCat is not configured');
      return result;
    }

    if (!result.userId) {
      result.warnings.push('No user ID found in RevenueCat configuration');
    }

    // Fetch offerings
    const offerings = await getOfferings();

    if (!offerings) {
      result.errors.push('No offerings available from RevenueCat');
      return result;
    }

    result.offeringsAvailable = true;
    result.offeringIdentifier = offerings.identifier || null;
    result.packageCount = offerings.availablePackages?.length || 0;

    if (result.packageCount === 0) {
      result.errors.push('No packages found in current offering');
      return result;
    }

    // Process each package
    const validPackages = offerings.availablePackages.filter((p: any) => p && p.product);

    for (const pkg of validPackages) {
      if (!pkg || !pkg.product) continue;

      const identifier = pkg.identifier || '';
      const identifierLower = identifier.toLowerCase();
      const productId = pkg.product.identifier || '';
      const productIdLower = productId.toLowerCase();

      // Check if it's a monthly package
      let matchedAs: 'monthly' | 'yearly' | 'none' = 'none';
      let matchMethod: string | null = null;

      // Check monthly identifiers
      const isMonthlyById = MONTHLY_PACKAGE_IDENTIFIERS.some(id => {
        const idLower = id.toLowerCase();
        return identifierLower === idLower || 
               identifierLower === idLower.replace('$', '') ||
               identifierLower === idLower.replace('$rc_', 'rc_') ||
               identifierLower.includes(idLower.replace('$', '')) ||
               identifierLower.includes(idLower.replace('$rc_', 'rc_'));
      });

      const isMonthlyByProductId = MONTHLY_PACKAGE_IDENTIFIERS.some(id => {
        const idLower = id.toLowerCase();
        return productIdLower === idLower || 
               productIdLower.includes(idLower.replace('$', '')) ||
               productIdLower.includes(idLower.replace('$rc_', 'rc_'));
      });

      const hasMonthlyKeywords = (identifierLower.includes('month') || 
                                  identifierLower.includes('rc_monthly') ||
                                  productIdLower.includes('month') ||
                                  productIdLower.includes('rc_monthly')) && 
                                 !identifierLower.includes('year') && 
                                 !identifierLower.includes('annual') &&
                                 !productIdLower.includes('year') &&
                                 !productIdLower.includes('annual');

      const isMonthlyByMetadata = pkg.product.subscriptionPeriod === 'P1M' || 
                                 pkg.product.subscriptionPeriod === 'MONTH' ||
                                 (pkg.product.subscriptionPeriod && 
                                  pkg.product.subscriptionPeriod.toString().toLowerCase().includes('month'));

      if (isMonthlyById || isMonthlyByProductId || hasMonthlyKeywords || isMonthlyByMetadata) {
        matchedAs = 'monthly';
        matchMethod = isMonthlyById ? 'identifier' : isMonthlyByProductId ? 'productId' : hasMonthlyKeywords ? 'keywords' : 'metadata';
        result.monthlyPackageFound = true;
        result.monthlyPackage = pkg;
      }

      // Check yearly identifiers (only if not already matched as monthly)
      if (matchedAs === 'none') {
        const isYearlyById = YEARLY_PACKAGE_IDENTIFIERS.some(id => {
          const idLower = id.toLowerCase();
          return identifierLower === idLower || 
                 identifierLower === idLower.replace('$', '') ||
                 identifierLower === idLower.replace('$rc_', 'rc_') ||
                 identifierLower.includes(idLower.replace('$', '')) ||
                 identifierLower.includes(idLower.replace('$rc_', 'rc_'));
        });

        const isYearlyByProductId = YEARLY_PACKAGE_IDENTIFIERS.some(id => {
          const idLower = id.toLowerCase();
          return productIdLower === idLower || 
                 productIdLower.includes(idLower.replace('$', '')) ||
                 productIdLower.includes(idLower.replace('$rc_', 'rc_'));
        });

        const hasYearlyKeywords = identifierLower.includes('year') || 
                                  identifierLower.includes('annual') ||
                                  identifierLower.includes('rc_yearly') ||
                                  identifierLower.includes('rc_annual') ||
                                  productIdLower.includes('year') ||
                                  productIdLower.includes('annual');

        const isYearlyByMetadata = pkg.product.subscriptionPeriod === 'P1Y' || 
                                   pkg.product.subscriptionPeriod === 'YEAR' ||
                                   pkg.product.subscriptionPeriod === 'ANNUAL' ||
                                   (pkg.product.subscriptionPeriod && 
                                    pkg.product.subscriptionPeriod.toString().toLowerCase().includes('year'));

        if (isYearlyById || isYearlyByProductId || hasYearlyKeywords || isYearlyByMetadata) {
          matchedAs = 'yearly';
          matchMethod = isYearlyById ? 'identifier' : isYearlyByProductId ? 'productId' : hasYearlyKeywords ? 'keywords' : 'metadata';
          result.yearlyPackageFound = true;
          result.yearlyPackage = pkg;
        }
      }

      // Add package to result
      result.packages.push({
        identifier,
        productId,
        priceString: pkg.product.priceString || 'N/A',
        price: pkg.product.price || null,
        currencyCode: pkg.product.currencyCode || 'N/A',
        title: pkg.product.title || 'N/A',
        description: pkg.product.description || 'N/A',
        subscriptionPeriod: pkg.product.subscriptionPeriod || null,
        matchedAs,
        matchMethod,
      });
    }

    // Add warnings for unmatched packages
    const unmatchedPackages = result.packages.filter(p => p.matchedAs === 'none');
    if (unmatchedPackages.length > 0) {
      result.warnings.push(`${unmatchedPackages.length} package(s) could not be matched as monthly or yearly`);
      result.warnings.push(`Unmatched identifiers: ${unmatchedPackages.map(p => p.identifier).join(', ')}`);
    }

    // Add warnings for missing packages
    if (!result.monthlyPackageFound) {
      result.warnings.push('Monthly package not found');
      result.warnings.push(`Expected identifiers: ${MONTHLY_PACKAGE_IDENTIFIERS.join(', ')}`);
    }

    if (!result.yearlyPackageFound) {
      result.warnings.push('Yearly package not found');
      result.warnings.push(`Expected identifiers: ${YEARLY_PACKAGE_IDENTIFIERS.join(', ')}`);
    }

  } catch (error: any) {
    result.errors.push(`Verification failed: ${error.message || error}`);
  }

  return result;
}

/**
 * Log verification results to console in a readable format
 */
export function logPackageVerification(result: PackageVerificationResult): void {
  console.log('\n' + '='.repeat(60));
  console.log('📦 REVENUECAT PACKAGE VERIFICATION REPORT');
  console.log('='.repeat(60));

  console.log('\n📋 Configuration:');
  console.log(`   Configured: ${result.isConfigured ? '✅ Yes' : '❌ No'}`);
  console.log(`   Platform: ${result.platform}`);
  console.log(`   User ID: ${result.userId || 'Not set'}`);

  console.log('\n📦 Offerings:');
  console.log(`   Available: ${result.offeringsAvailable ? '✅ Yes' : '❌ No'}`);
  if (result.offeringIdentifier) {
    console.log(`   Offering ID: ${result.offeringIdentifier}`);
  }
  console.log(`   Package Count: ${result.packageCount}`);

  console.log('\n📊 Package Matching:');
  console.log(`   Monthly Package: ${result.monthlyPackageFound ? '✅ Found' : '❌ Not Found'}`);
  console.log(`   Yearly Package: ${result.yearlyPackageFound ? '✅ Found' : '❌ Not Found'}`);

  if (result.packages.length > 0) {
    console.log('\n📦 All Packages:');
    result.packages.forEach((pkg, index) => {
      console.log(`\n   Package ${index + 1}:`);
      console.log(`      Identifier: ${pkg.identifier}`);
      console.log(`      Product ID: ${pkg.productId}`);
      console.log(`      Price: ${pkg.priceString} (${pkg.currencyCode})`);
      console.log(`      Title: ${pkg.title}`);
      console.log(`      Subscription Period: ${pkg.subscriptionPeriod || 'N/A'}`);
      console.log(`      Matched As: ${pkg.matchedAs === 'none' ? '❌ None' : `✅ ${pkg.matchedAs.toUpperCase()}`}`);
      if (pkg.matchMethod) {
        console.log(`      Match Method: ${pkg.matchMethod}`);
      }
    });
  }

  if (result.errors.length > 0) {
    console.log('\n❌ Errors:');
    result.errors.forEach(error => {
      console.log(`   • ${error}`);
    });
  }

  if (result.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    result.warnings.forEach(warning => {
      console.log(`   • ${warning}`);
    });
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Quick verification function that can be called from browser console
 * Usage: window.verifyRevenueCatPackages()
 */
export async function verifyPackages(): Promise<void> {
  const result = await verifyRevenueCatPackages();
  logPackageVerification(result);
  
  // Also return the result for programmatic access
  (window as any).__revenuecatVerificationResult = result;
  console.log('💡 Verification result also stored in window.__revenuecatVerificationResult');
}

// Make it available globally for console access
if (typeof window !== 'undefined') {
  (window as any).verifyRevenueCatPackages = verifyPackages;
}

