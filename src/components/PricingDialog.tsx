import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Check,
  Sparkles,
  Zap,
  BarChart3,
  Calendar,
  Tag,
  RotateCcw,
  Timer,
  Users,
  X,
  Crown,
} from "lucide-react";
import { useSubscription } from "../contexts/SubscriptionContext";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { motion } from "motion/react";
import {
  purchaseProSubscription,
  restorePurchases,
  getOfferings,
} from "../lib/revenuecat";
import { verifyRevenueCatPackages, logPackageVerification } from "../lib/verify-revenuecat-packages";
import { getPlatform } from "../lib/platform";
import { cn } from "../lib/utils";
import {
  DEFAULT_MONTHLY_PRICE,
  DEFAULT_YEARLY_PRICE,
  DEFAULT_CURRENCY_CODE,
  DEFAULT_MONTHLY_TITLE,
  DEFAULT_YEARLY_TITLE,
  MONTHLY_PACKAGE_IDENTIFIERS,
  YEARLY_PACKAGE_IDENTIFIERS,
  SUBSCRIPTION_UI_TEXT,
  FREE_TIER_FEATURES,
  PRO_TIER_FEATURES,
  PRO_FEATURES_LIST,
  FEATURES_DISPLAY_LIMIT,
} from "../lib/subscription-constants";

interface PricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOfferingsUpdated?: () => void;
}

export function PricingDialog({
  open,
  onOpenChange,
  onOfferingsUpdated,
}: PricingDialogProps) {
  const { subscription, upgradeToPro, refreshSubscription, cancelSubscription, downgradeToFree } =
    useSubscription();
  const [isUpgrading, setIsUpgrading] = React.useState(false);
  const [isRestoring, setIsRestoring] = React.useState(false);
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [isDowngrading, setIsDowngrading] = React.useState(false);
  const [offerings, setOfferings] = React.useState<{
    monthly?: { price: string; priceString: string; currencyCode: string; identifier: string; title: string; description: string };
    yearly?: { price: string; priceString: string; currencyCode: string; identifier: string; title: string; description: string };
  }>({});

  // Debug: Log offerings state changes
  React.useEffect(() => {
    console.log('🔄 Offerings state updated:', {
      monthly: offerings.monthly ? {
        identifier: offerings.monthly.identifier,
        priceString: offerings.monthly.priceString,
        title: offerings.monthly.title,
        available: true
      } : { available: false },
      yearly: offerings.yearly ? {
        identifier: offerings.yearly.identifier,
        priceString: offerings.yearly.priceString,
        title: offerings.yearly.title,
        available: true
      } : { available: false }
    });
  }, [offerings]);
  const platform = getPlatform();

  // Get user from auth context for RevenueCat configuration
  const { user } = useAuth();

  // Load offerings when dialog opens
  React.useEffect(() => {
    if (open) {
      // Ensure RevenueCat is configured before loading offerings
      const ensureConfigured = async () => {
        const { configureRevenueCat, isRevenueCatConfigured } = await import('../lib/revenuecat');
        
        // Try to configure if not already configured and we have a user
        if (!isRevenueCatConfigured() && user?.id) {
          console.log('🔄 RevenueCat not configured, attempting to configure...');
          try {
            await configureRevenueCat(user.id);
          } catch (error) {
            console.warn('Failed to configure RevenueCat:', error);
          }
        }
        
        loadOfferings();
        
        // Run verification when dialog opens (for debugging)
        if (isRevenueCatConfigured()) {
          console.log('🔍 Running RevenueCat package verification...');
          const verificationResult = await verifyRevenueCatPackages();
          logPackageVerification(verificationResult);
        }
      };
      ensureConfigured();
    }
  }, [open, user?.id]);

  // Also refresh offerings when subscription changes
  React.useEffect(() => {
    if (open && subscription.tier) {
      console.log('🔄 Subscription tier changed, refreshing offerings...');
      loadOfferings();
    }
  }, [subscription.tier, open]);

  const loadOfferings = async () => {
    try {
      // Check if RevenueCat is configured first
      const { isRevenueCatConfigured, getCurrentUserId } = await import('../lib/revenuecat');
      
      const configured = isRevenueCatConfigured();
      const userId = getCurrentUserId();
      
      console.log('🔍 RevenueCat Status Check:');
      console.log('   isConfigured:', configured);
      console.log('   currentUserId:', userId);
      console.log('   currentUser:', user?.id);
      
      if (!configured) {
        console.log('ℹ️  RevenueCat not configured yet');
        console.log('   Configuration should happen automatically on login');
        console.log('   Attempting to configure now...');
        
        // Try to configure if we have a user
        if (user?.id) {
          const { configureRevenueCat } = await import('../lib/revenuecat');
          try {
            await configureRevenueCat(user.id);
            console.log('✅ Configuration attempt completed');
          } catch (configError) {
            console.error('❌ Configuration failed:', configError);
          }
        } else {
          console.warn('⚠️  No user ID available for configuration');
        }
        return;
      }
      
      console.log('🔄 Loading offerings from RevenueCat...');
      
      // Force refresh to get latest packages from RevenueCat (bypasses cache)
      // Try multiple times to ensure we get the latest data
      let rcOfferings = null;
      let attempts = 0;
      const maxAttempts = 2;
      
      while (attempts < maxAttempts) {
        attempts++;
        console.log(`🔄 Fetch attempt ${attempts}/${maxAttempts}...`);
        
        // Add delay before retry (not before first attempt)
        if (attempts > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        rcOfferings = await getOfferings(true);
        
        // Check if we got packages
        if (rcOfferings?.availablePackages && rcOfferings.availablePackages.length > 0) {
          console.log(`✅ Got ${rcOfferings.availablePackages.length} packages on attempt ${attempts}`);
          break;
        } else {
          console.warn(`⚠️ No packages found on attempt ${attempts}, retrying...`);
        }
      }
      
      if (rcOfferings?.availablePackages && rcOfferings.availablePackages.length > 0) {
        console.log('✅ RevenueCat connected! Packages found:', rcOfferings.availablePackages.length);
        console.log('📋 Offering identifier:', rcOfferings.identifier || 'N/A');
        
        // Log ALL packages first (before filtering) to see what RevenueCat is actually returning
        console.log('📦 ALL PACKAGES FROM REVENUECAT (before filtering):');
        rcOfferings.availablePackages.forEach((p: any, index: number) => {
          const identifier = p?.identifier || 'N/A';
          const hasProduct = !!p?.product;
          const productKeys = p?.product && typeof p.product === 'object' ? Object.keys(p.product) : [];
          // Check if product has ANY data (not just specific fields)
          const hasProductData = hasProduct && productKeys.length > 0;
          
          // Log the FULL product object to see what RevenueCat is actually returning
          console.log(`   Package ${index + 1}:`, {
            identifier,
            hasIdentifier: !!p?.identifier,
            hasProduct,
            hasProductData,
            productType: typeof p?.product,
            productIsObject: p?.product && typeof p.product === 'object',
            productKeys: productKeys.length > 0 ? productKeys : (hasProduct ? 'object exists but no enumerable keys' : 'no product'),
            productIdentifier: p?.product?.identifier || 'N/A',
            productTitle: p?.product?.title || 'N/A',
            priceString: p?.product?.priceString || 'N/A',
            price: p?.product?.price || 'N/A',
            currencyCode: p?.product?.currencyCode || 'N/A',
            // Log the entire product object structure
            fullProductObject: p?.product ? JSON.stringify(p.product, null, 2).substring(0, 200) : 'N/A',
            willBeProcessed: !!p?.identifier ? 'YES (has identifier)' : 'NO (no identifier)'
          });
        });
        
        // VERY lenient validation: accept ANY package with an identifier
        // RevenueCat sometimes returns packages with empty product objects that get populated later
        // We'll match by identifier and use defaults for missing product data
        const hasValidPackage = (p: any) => {
          if (!p) return false;
          // Accept ANY package that has an identifier (even if product is missing or empty)
          // This allows us to match packages and display them with default pricing
          return !!p.identifier;
        };
        
        const validPackages = rcOfferings.availablePackages.filter(hasValidPackage);
        const invalidPackages = rcOfferings.availablePackages.filter((p: any) => !hasValidPackage(p));
        
        if (invalidPackages.length > 0) {
          console.warn('⚠️ Found packages without identifiers (these will be skipped):');
          invalidPackages.forEach((p: any) => {
            console.warn('   - Package:', {
              hasIdentifier: !!p?.identifier,
              identifier: p?.identifier || 'MISSING',
              hasProduct: !!p?.product,
              productKeys: p?.product ? Object.keys(p.product) : []
            });
          });
        }
        
        // Log packages with empty product objects (these are still valid, just need defaults)
        const packagesWithEmptyProducts = validPackages.filter((p: any) => {
          if (!p.identifier) return false;
          if (!p.product) return true; // No product object at all
          if (typeof p.product !== 'object') return true; // Product is not an object
          const keys = Object.keys(p.product);
          return keys.length === 0; // Product object exists but has no properties
        });
        
        const packagesWithProductData = validPackages.filter((p: any) => {
          if (!p.identifier) return false;
          if (!p.product) return false;
          if (typeof p.product !== 'object') return false;
          const keys = Object.keys(p.product);
          return keys.length > 0; // Product has actual data
        });
        
        console.log(`📊 Package Summary:`);
        console.log(`   Total packages: ${validPackages.length}`);
        console.log(`   Packages with product data: ${packagesWithProductData.length}`);
        console.log(`   Packages with empty/missing products: ${packagesWithEmptyProducts.length}`);
        
        if (packagesWithEmptyProducts.length > 0) {
          console.warn(`⚠️ Found ${packagesWithEmptyProducts.length} package(s) with empty product data (will use defaults):`);
          packagesWithEmptyProducts.forEach((p: any) => {
            console.warn(`   - ${p.identifier}: Will use default pricing/title`);
            console.warn('   This is OK - package will still be displayed and matched by identifier');
            console.warn('   Product data may populate later, or you may need to link products in RevenueCat dashboard');
          });
        }
        
        if (packagesWithProductData.length > 0) {
          console.log(`✅ Found ${packagesWithProductData.length} package(s) with product data:`);
          packagesWithProductData.forEach((p: any) => {
            console.log(`   - ${p.identifier}:`, {
              productId: p.product?.identifier || 'N/A',
              title: p.product?.title || 'N/A',
              priceString: p.product?.priceString || 'N/A',
              price: p.product?.price || 'N/A',
              currencyCode: p.product?.currencyCode || 'N/A',
              allProductKeys: Object.keys(p.product || {})
            });
          });
        }
        
        // Log all package identifiers for debugging
        console.log('📦 All package identifiers from RevenueCat:', validPackages.map((p: any) => p?.identifier || 'unknown'));
        console.log('📦 All valid packages (FULL DETAILS):', validPackages.map((p: any) => ({
          identifier: p.identifier || 'unknown',
          productId: p.product?.identifier || 'unknown',
          price: p.product?.priceString || 'N/A',
          priceAmount: p.product?.price || 'N/A',
          currencyCode: p.product?.currencyCode || 'N/A',
          title: p.product?.title || 'N/A',
          description: p.product?.description || 'N/A',
          subscriptionPeriod: p.product?.subscriptionPeriod || 'N/A',
          introPrice: p.product?.introPrice || 'N/A',
          discount: p.product?.discount || 'N/A'
        })));
        console.log('📦 RAW PACKAGE DATA (for debugging):', JSON.stringify(validPackages.map((p: any) => ({
          identifier: p?.identifier,
          product: {
            identifier: p?.product?.identifier,
            priceString: p?.product?.priceString,
            price: p?.product?.price,
            currencyCode: p?.product?.currencyCode,
            title: p?.product?.title,
            description: p?.product?.description,
            subscriptionPeriod: p?.product?.subscriptionPeriod,
            introPrice: p?.product?.introPrice,
            discount: p?.product?.discount
          }
        })), null, 2));
        console.log('🔍 Looking for monthly identifiers:', MONTHLY_PACKAGE_IDENTIFIERS);
        console.log('🔍 Looking for yearly identifiers:', YEARLY_PACKAGE_IDENTIFIERS);

        // Find monthly and yearly packages (only from valid packages)
        // Try multiple matching strategies: exact match, case-insensitive, partial match, and product metadata
        let monthlyPkg: any = null;
        let yearlyPkg: any = null;
        
        // First pass: Try exact and case-insensitive matches
        // Process ALL valid packages, even if they don't have product objects yet
        for (const pkg of validPackages) {
          if (!pkg) continue;
          
          const identifier = pkg.identifier || '';
          const identifierLower = identifier.toLowerCase();
          const productId = pkg.product?.identifier || '';
          const productIdLower = productId.toLowerCase();
          const productTitle = pkg.product?.title || '';
          const productTitleLower = productTitle.toLowerCase();
          
          // Check if this is a monthly package
          if (!monthlyPkg) {
            // Check identifier against monthly list
            const isMonthlyById = MONTHLY_PACKAGE_IDENTIFIERS.some(id => {
              const idLower = id.toLowerCase();
              return identifierLower === idLower || 
                     identifierLower === idLower.replace('$', '') ||
                     identifierLower === idLower.replace('$rc_', 'rc_') ||
                     identifierLower.includes(idLower.replace('$', '')) ||
                     identifierLower.includes(idLower.replace('$rc_', 'rc_'));
            });
            
            // Check product ID against monthly list (exact match first, then pattern matching)
            const isMonthlyByProductId = MONTHLY_PACKAGE_IDENTIFIERS.some(id => {
              const idLower = id.toLowerCase();
              // Exact match (most reliable)
              if (productIdLower === idLower) return true;
              // Pattern matching for package identifiers
              return productIdLower.includes(idLower.replace('$', '')) ||
                     productIdLower.includes(idLower.replace('$rc_', 'rc_'));
            });
            
            // Check product title/name against monthly list (for cases like "TaskZM PRO PRO")
            const isMonthlyByProductTitle = MONTHLY_PACKAGE_IDENTIFIERS.some(id => {
              const idLower = id.toLowerCase();
              return productTitleLower.includes(idLower) && 
                     !productTitleLower.includes('year') &&
                     !productTitleLower.includes('annual');
            });
            
            // Check for monthly keywords (but not yearly/annual)
            const hasMonthlyKeywords = (identifierLower.includes('month') || 
                                      identifierLower.includes('rc_monthly') ||
                                      productIdLower.includes('month') ||
                                      productIdLower.includes('rc_monthly') ||
                                      productTitleLower.includes('month') ||
                                      productTitleLower.includes('pro')) && 
                                     !identifierLower.includes('year') && 
                                     !identifierLower.includes('annual') &&
                                     !productIdLower.includes('year') &&
                                     !productIdLower.includes('annual') &&
                                     !productTitleLower.includes('year') &&
                                     !productTitleLower.includes('annual');
            
            // Check product metadata (billing period) - only if product exists
            const isMonthlyByMetadata = pkg.product?.subscriptionPeriod === 'P1M' || 
                                       pkg.product?.subscriptionPeriod === 'MONTH' ||
                                       (pkg.product?.subscriptionPeriod && 
                                        pkg.product.subscriptionPeriod.toString().toLowerCase().includes('month'));
            
            if (isMonthlyById || isMonthlyByProductId || isMonthlyByProductTitle || hasMonthlyKeywords || isMonthlyByMetadata) {
              monthlyPkg = pkg;
              console.log('✅ Found monthly package:', {
                identifier,
                productId: productId || 'N/A',
                productTitle: productTitle || 'N/A',
                priceString: pkg.product?.priceString || 'N/A',
                hasProduct: !!pkg.product,
                matchedBy: isMonthlyById ? 'identifier' : isMonthlyByProductId ? 'productId' : isMonthlyByProductTitle ? 'productTitle' : hasMonthlyKeywords ? 'keywords' : 'metadata'
              });
            }
          }
          
          // Check if this is a yearly package
          if (!yearlyPkg) {
            // Check identifier against yearly list
            const isYearlyById = YEARLY_PACKAGE_IDENTIFIERS.some(id => {
              const idLower = id.toLowerCase();
              return identifierLower === idLower || 
                     identifierLower === idLower.replace('$', '') ||
                     identifierLower === idLower.replace('$rc_', 'rc_') ||
                     identifierLower.includes(idLower.replace('$', '')) ||
                     identifierLower.includes(idLower.replace('$rc_', 'rc_'));
            });
            
            // Check product ID against yearly list (exact match first, then pattern matching)
            const isYearlyByProductId = YEARLY_PACKAGE_IDENTIFIERS.some(id => {
              const idLower = id.toLowerCase();
              // Exact match (most reliable)
              if (productIdLower === idLower) return true;
              // Pattern matching for package identifiers
              return productIdLower.includes(idLower.replace('$', '')) ||
                     productIdLower.includes(idLower.replace('$rc_', 'rc_'));
            });
            
            // Check product title/name against yearly list (for cases like "TaskZM Yearly Yearly")
            const isYearlyByProductTitle = YEARLY_PACKAGE_IDENTIFIERS.some(id => {
              const idLower = id.toLowerCase();
              return productTitleLower.includes(idLower);
            });
            
            // Check for yearly/annual keywords
            const hasYearlyKeywords = identifierLower.includes('year') || 
                                      identifierLower.includes('annual') ||
                                      identifierLower.includes('rc_yearly') ||
                                      identifierLower.includes('rc_annual') ||
                                      productIdLower.includes('year') ||
                                      productIdLower.includes('annual') ||
                                      productTitleLower.includes('year') ||
                                      productTitleLower.includes('annual');
            
            // Check product metadata (billing period) - only if product exists
            const isYearlyByMetadata = pkg.product?.subscriptionPeriod === 'P1Y' || 
                                      pkg.product?.subscriptionPeriod === 'YEAR' ||
                                      pkg.product?.subscriptionPeriod === 'ANNUAL' ||
                                      (pkg.product?.subscriptionPeriod && 
                                       pkg.product.subscriptionPeriod.toString().toLowerCase().includes('year'));
            
            if (isYearlyById || isYearlyByProductId || isYearlyByProductTitle || hasYearlyKeywords || isYearlyByMetadata) {
              yearlyPkg = pkg;
              console.log('✅ Found yearly package:', {
                identifier,
                productId: productId || 'N/A',
                productTitle: productTitle || 'N/A',
                priceString: pkg.product?.priceString || 'N/A',
                hasProduct: !!pkg.product,
                matchedBy: isYearlyById ? 'identifier' : isYearlyByProductId ? 'productId' : isYearlyByProductTitle ? 'productTitle' : hasYearlyKeywords ? 'keywords' : 'metadata'
              });
            }
          }
        }

        // Log detailed package information
        if (!monthlyPkg) {
          console.warn('⚠️ Monthly package NOT FOUND');
          console.warn('   Available package identifiers:', validPackages.map((p: any) => ({
            identifier: p?.identifier || 'unknown',
            productId: p?.product?.identifier || 'unknown',
            priceString: p?.product?.priceString || 'N/A',
            subscriptionPeriod: p?.product?.subscriptionPeriod || 'N/A'
          })));
        }
        if (!yearlyPkg) {
          console.warn('⚠️ Yearly package NOT FOUND');
          console.warn('   Available package identifiers:', validPackages.map((p: any) => ({
            identifier: p?.identifier || 'unknown',
            productId: p?.product?.identifier || 'unknown',
            priceString: p?.product?.priceString || 'N/A',
            subscriptionPeriod: p?.product?.subscriptionPeriod || 'N/A'
          })));
        }

        // Set offerings from RevenueCat - this is the source of truth
        // Handle packages even if product data is missing (use defaults with package identifier)
        const monthlyOffering = monthlyPkg ? {
          price: (monthlyPkg.product?.price?.toString() ?? '0'),
          priceString: (monthlyPkg.product?.priceString ?? DEFAULT_MONTHLY_PRICE),
          currencyCode: (monthlyPkg.product?.currencyCode ?? DEFAULT_CURRENCY_CODE),
          identifier: monthlyPkg.identifier || 'monthly',
          title: (monthlyPkg.product?.title?.trim() || DEFAULT_MONTHLY_TITLE),
          description: (monthlyPkg.product?.description?.trim() || SUBSCRIPTION_UI_TEXT.planCards.monthly.billingPeriod),
        } : undefined;

        const yearlyOffering = yearlyPkg ? {
          price: (yearlyPkg.product?.price?.toString() ?? '0'),
          priceString: (yearlyPkg.product?.priceString ?? DEFAULT_YEARLY_PRICE),
          currencyCode: (yearlyPkg.product?.currencyCode ?? DEFAULT_CURRENCY_CODE),
          identifier: yearlyPkg.identifier || 'yearly',
          title: (yearlyPkg.product?.title?.trim() || DEFAULT_YEARLY_TITLE),
          description: (yearlyPkg.product?.description?.trim() || SUBSCRIPTION_UI_TEXT.planCards.yearly.billingPeriod),
        } : undefined;

        console.log('============================================================');
        console.log('📊 REVENUECAT DATA RENDERING REPORT');
        console.log('============================================================');
        console.log('\n📦 Raw Package Data from RevenueCat:');
        console.log('   Total packages received:', validPackages.length);
        validPackages.forEach((p: any, index: number) => {
          console.log(`   Package ${index + 1}:`, {
            identifier: p?.identifier || 'N/A',
            productId: p?.product?.identifier || 'N/A',
            productTitle: p?.product?.title || 'N/A',
            productDescription: p?.product?.description || 'N/A',
            priceString: p?.product?.priceString || 'N/A',
            price: p?.product?.price || 'N/A',
            currencyCode: p?.product?.currencyCode || 'N/A',
            subscriptionPeriod: p?.product?.subscriptionPeriod || 'N/A',
            hasValidProduct: !!(p?.product && Object.keys(p.product).length > 0)
          });
        });
        
        console.log('\n🔍 Package Matching Results:');
        console.log('   Monthly Package Found:', monthlyPkg ? '✅ YES' : '❌ NO');
        if (monthlyPkg) {
          console.log('      Identifier:', monthlyPkg.identifier);
          console.log('      Product ID:', monthlyPkg.product?.identifier);
          console.log('      Price String:', monthlyPkg.product?.priceString);
          console.log('      Price:', monthlyPkg.product?.price);
          console.log('      Title:', monthlyPkg.product?.title);
        }
        console.log('   Yearly Package Found:', yearlyPkg ? '✅ YES' : '❌ NO');
        if (yearlyPkg) {
          console.log('      Identifier:', yearlyPkg.identifier);
          console.log('      Product ID:', yearlyPkg.product?.identifier);
          console.log('      Price String:', yearlyPkg.product?.priceString);
          console.log('      Price:', yearlyPkg.product?.price);
          console.log('      Title:', yearlyPkg.product?.title);
        }
        
        console.log('\n✅ Setting offerings from RevenueCat:');
        if (monthlyOffering) {
          const fromRC = monthlyPkg?.product?.priceString != null && monthlyPkg.product.priceString !== '';
          console.log('   Monthly Offering:', {
            identifier: monthlyOffering.identifier,
            priceString: monthlyOffering.priceString,
            price: monthlyOffering.price,
            currencyCode: monthlyOffering.currencyCode,
            title: monthlyOffering.title,
            description: monthlyOffering.description,
            fromRevenueCat: fromRC ? 'YES ✅' : 'NO (using default) ⚠️',
            rawPriceString: monthlyPkg?.product?.priceString || 'null/undefined',
            rawPrice: monthlyPkg?.product?.price || 'null/undefined',
          });
        } else {
          console.log('   Monthly: NOT AVAILABLE (package not found in RevenueCat)');
        }
        if (yearlyOffering) {
          const fromRC = yearlyPkg?.product?.priceString != null && yearlyPkg.product.priceString !== '';
          console.log('   Yearly Offering:', {
            identifier: yearlyOffering.identifier,
            priceString: yearlyOffering.priceString,
            price: yearlyOffering.price,
            currencyCode: yearlyOffering.currencyCode,
            title: yearlyOffering.title,
            description: yearlyOffering.description,
            fromRevenueCat: fromRC ? 'YES ✅' : 'NO (using default) ⚠️',
            rawPriceString: yearlyPkg?.product?.priceString || 'null/undefined',
            rawPrice: yearlyPkg?.product?.price || 'null/undefined',
          });
        } else {
          console.log('   Yearly: NOT AVAILABLE (package not found in RevenueCat)');
        }

        console.log('\n🎨 UI Rendering State:');
        console.log('   Monthly will render:', monthlyOffering ? '✅ YES' : '❌ NO');
        console.log('   Yearly will render:', yearlyOffering ? '✅ YES' : '❌ NO');
        console.log('   Grid columns:', 
          monthlyOffering && yearlyOffering ? '3 (Free, Monthly, Yearly)' :
          monthlyOffering || yearlyOffering ? '2 (Free + one Pro)' :
          '1 (Free only)'
        );
        console.log('============================================================');

        setOfferings({
          monthly: monthlyOffering,
          yearly: yearlyOffering,
        });
        
        // Notify parent component that offerings were updated
        if (onOfferingsUpdated) {
          onOfferingsUpdated();
        }
      } else {
        console.warn('⚠️ RevenueCat returned no packages or empty offerings');
        console.warn('   This could mean:');
        console.warn('   1. No offerings configured in RevenueCat dashboard');
        console.warn('   2. No packages attached to the current offering');
        console.warn('   3. Products not set up in RevenueCat');
      }
    } catch (error: any) {
      console.error('❌ Failed to load offerings from RevenueCat:', error);
      console.error('   Error message:', error.message || error);
      console.error('   Error stack:', error.stack);
    }
  };


  const handleRestore = async () => {
    try {
      setIsRestoring(true);
      console.log(SUBSCRIPTION_UI_TEXT.messages.restoringPurchases);

      const success = await restorePurchases();

      if (success) {
        toast.success(SUBSCRIPTION_UI_TEXT.messages.subscriptionRestored, {
          description: SUBSCRIPTION_UI_TEXT.messages.subscriptionRestoredDesc,
        });
        await refreshSubscription();
        onOpenChange(false);
      } else {
        toast.info(SUBSCRIPTION_UI_TEXT.messages.noActiveSubscription, {
          description: SUBSCRIPTION_UI_TEXT.messages.noActiveSubscriptionDesc,
        });
      }
    } catch (error: any) {
      console.error("Restore error:", error);
      toast.error(SUBSCRIPTION_UI_TEXT.messages.restoreFailed, {
        description: error.message || SUBSCRIPTION_UI_TEXT.messages.restoreFailedDesc,
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCancel = async () => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      `${SUBSCRIPTION_UI_TEXT.confirmations.cancel.title}\n\n${SUBSCRIPTION_UI_TEXT.confirmations.cancel.message}`
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsCancelling(true);
      await cancelSubscription();
      await refreshSubscription();
      toast.success(SUBSCRIPTION_UI_TEXT.messages.subscriptionCancelled, {
        description: SUBSCRIPTION_UI_TEXT.messages.subscriptionCancelledDesc,
      });
    } catch (error: any) {
      console.error("Cancel error:", error);
      toast.error(SUBSCRIPTION_UI_TEXT.messages.cancelFailed, {
        description: error.message || SUBSCRIPTION_UI_TEXT.messages.cancelFailedDesc,
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDowngrade = async () => {
    // Show confirmation dialog
    const featuresList = PRO_FEATURES_LIST.map(f => `• ${f}`).join('\n');
    const confirmed = window.confirm(
      `${SUBSCRIPTION_UI_TEXT.confirmations.downgrade.title}\n\n${SUBSCRIPTION_UI_TEXT.confirmations.downgrade.messagePrefix}\n${featuresList}${SUBSCRIPTION_UI_TEXT.confirmations.downgrade.messageSuffix}`
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsDowngrading(true);
      await downgradeToFree();
      await refreshSubscription();
      toast.success(SUBSCRIPTION_UI_TEXT.messages.downgradeSuccess, {
        description: SUBSCRIPTION_UI_TEXT.messages.downgradeSuccessDesc,
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Downgrade error:", error);
      toast.error(SUBSCRIPTION_UI_TEXT.messages.downgradeFailed, {
        description: error.message || SUBSCRIPTION_UI_TEXT.messages.downgradeFailedDesc,
      });
    } finally {
      setIsDowngrading(false);
    }
  };

  // Use feature definitions from constants
  const freeTierFeatures = FREE_TIER_FEATURES;
  const proTierFeatures = PRO_TIER_FEATURES;

  const calculateSavings = () => {
    // Only calculate savings if both monthly and yearly are available
    if (!offerings.monthly || !offerings.yearly) return 0;
    try {
      const monthlyPrice = parseFloat(offerings.monthly.price || '0');
      const yearlyPrice = parseFloat(offerings.yearly.price || '0');
      if (monthlyPrice === 0 || yearlyPrice === 0) return 0;
      const yearlyEquivalent = monthlyPrice * 12;
      if (yearlyEquivalent === 0) return 0;
      return Math.round(((yearlyEquivalent - yearlyPrice) / yearlyEquivalent) * 100);
    } catch (error) {
      console.warn('Error calculating savings:', error);
      return 0;
    }
  };

  const savings = calculateSavings();

  const handleUpgradeMonthly = async () => {
    try {
      setIsUpgrading(true);
      const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';
      const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

      // Ensure RevenueCat is configured before attempting purchase
      const { isRevenueCatConfigured, configureRevenueCat, getOfferings } = await import('../lib/revenuecat');
      
      if (!isRevenueCatConfigured() && user?.id) {
        console.log('🔄 RevenueCat not configured, configuring before purchase...');
        try {
          await configureRevenueCat(user.id);
          console.log('✅ RevenueCat configured, proceeding with purchase...');
        } catch (configError: any) {
          console.error('❌ Failed to configure RevenueCat:', configError);
          toast.error(SUBSCRIPTION_UI_TEXT.configuration.errorTitle, {
            description: SUBSCRIPTION_UI_TEXT.configuration.initializationFailed,
          });
          setIsUpgrading(false);
          return;
        }
      } else if (!isRevenueCatConfigured()) {
        console.error('❌ RevenueCat not configured and no user ID available');
        toast.error(SUBSCRIPTION_UI_TEXT.configuration.errorTitle, {
          description: SUBSCRIPTION_UI_TEXT.configuration.loginRequired,
        });
        setIsUpgrading(false);
        return;
      }

      // Check if monthly package is available
      if (!offerings.monthly) {
        console.error('❌ Monthly package not available');
        toast.error(SUBSCRIPTION_UI_TEXT.errors.packageNotFound, {
          description: SUBSCRIPTION_UI_TEXT.upgrade.monthlyNotAvailable,
        });
        setIsUpgrading(false);
        return;
      }

      // Check if offerings are available before purchase
      console.log('🔍 Checking if offerings are available...');
        const offeringsCheck = await getOfferings(true);
      if (!offeringsCheck || !offeringsCheck.availablePackages || offeringsCheck.availablePackages.length === 0) {
        console.warn('⚠️ No offerings found, attempting to reload...');
        // Try reloading offerings
        await loadOfferings();
        
        // Check again after reload
        const offeringsCheck2 = await getOfferings(true);
        if (!offeringsCheck2 || !offeringsCheck2.availablePackages || offeringsCheck2.availablePackages.length === 0) {
          console.error('❌ No offerings available after reload');
          toast.error(SUBSCRIPTION_UI_TEXT.errors.subscriptionNotAvailable, {
            description: SUBSCRIPTION_UI_TEXT.errors.subscriptionNotAvailableCheckDesc,
          });
          setIsUpgrading(false);
          return;
        }
        
        // Re-check monthly package after reload
        if (!offerings.monthly) {
          console.error('❌ Monthly package still not available after reload');
          toast.error(SUBSCRIPTION_UI_TEXT.errors.packageNotFound, {
            description: SUBSCRIPTION_UI_TEXT.upgrade.monthlyNotAvailable,
          });
          setIsUpgrading(false);
          return;
        }
      }

      try {
        console.log(`Attempting monthly purchase on ${platform.platform}`);
        const success = await purchaseProSubscription('monthly');
        
        if (success) {
          toast.success(SUBSCRIPTION_UI_TEXT.messages.upgradeSuccess, {
            description: SUBSCRIPTION_UI_TEXT.messages.upgradeSuccessDesc,
          });
          await refreshSubscription();
          setIsUpgrading(false);
          onOpenChange(false);
          return;
        } else {
          toast.error(SUBSCRIPTION_UI_TEXT.messages.paymentFailed, {
            description: SUBSCRIPTION_UI_TEXT.messages.paymentFailedDesc,
          });
          setIsUpgrading(false);
          return;
        }
      } catch (rcError: any) {
        if (rcError.message?.includes("cancelled") || rcError.userCancelled) {
          setIsUpgrading(false);
          return;
        }

        if (isProduction) {
          console.error("Payment processing failed in production:", rcError.message);
          
          // Provide specific error messages based on error type
          let errorTitle = SUBSCRIPTION_UI_TEXT.errors.paymentProcessingUnavailable;
          let errorDescription = SUBSCRIPTION_UI_TEXT.errors.paymentProcessingUnavailableDesc;
          
          if (rcError.message?.includes("No subscription offerings available") || 
              rcError.message?.includes("No subscription packages available")) {
            errorTitle = SUBSCRIPTION_UI_TEXT.errors.subscriptionNotAvailable;
            errorDescription = SUBSCRIPTION_UI_TEXT.errors.subscriptionNotAvailableDesc;
          } else if (rcError.message?.includes("subscription package not found")) {
            errorTitle = SUBSCRIPTION_UI_TEXT.errors.packageNotFound;
            errorDescription = SUBSCRIPTION_UI_TEXT.errors.packageNotFoundDesc;
          }
          
          toast.error(errorTitle, {
            description: errorDescription,
          });
          setIsUpgrading(false);
          return;
        }

        if (isDevelopment) {
          console.log("→ Using simulated upgrade for development (monthly)");
          try {
            await upgradeToPro();
            toast.success(SUBSCRIPTION_UI_TEXT.messages.upgradeDevMode, {
              description: SUBSCRIPTION_UI_TEXT.messages.upgradeDevModeDesc,
            });
            setIsUpgrading(false);
            onOpenChange(false);
            return;
          } catch (upgradeError) {
            console.error("Development upgrade failed:", upgradeError);
            setIsUpgrading(false);
            throw upgradeError;
          }
        }

        toast.error(SUBSCRIPTION_UI_TEXT.upgrade.failed, {
          description: rcError.message || SUBSCRIPTION_UI_TEXT.upgrade.failedDesc,
        });
        setIsUpgrading(false);
      }
    } catch (error: any) {
      console.error("Monthly upgrade error:", error);
      toast.error(SUBSCRIPTION_UI_TEXT.upgrade.failed, {
        description: error.message || SUBSCRIPTION_UI_TEXT.upgrade.failedDesc,
      });
      setIsUpgrading(false);
    }
  };

  const handleUpgradeYearly = async () => {
    try {
      setIsUpgrading(true);
      const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';
      const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

      // Ensure RevenueCat is configured before attempting purchase
      const { isRevenueCatConfigured, configureRevenueCat, getOfferings } = await import('../lib/revenuecat');
      
      if (!isRevenueCatConfigured() && user?.id) {
        console.log('🔄 RevenueCat not configured, configuring before purchase...');
        try {
          await configureRevenueCat(user.id);
          console.log('✅ RevenueCat configured, proceeding with purchase...');
        } catch (configError: any) {
          console.error('❌ Failed to configure RevenueCat:', configError);
          toast.error(SUBSCRIPTION_UI_TEXT.configuration.errorTitle, {
            description: SUBSCRIPTION_UI_TEXT.configuration.initializationFailed,
          });
          setIsUpgrading(false);
          return;
        }
      } else if (!isRevenueCatConfigured()) {
        console.error('❌ RevenueCat not configured and no user ID available');
        toast.error(SUBSCRIPTION_UI_TEXT.configuration.errorTitle, {
          description: SUBSCRIPTION_UI_TEXT.configuration.loginRequired,
        });
        setIsUpgrading(false);
        return;
      }

      // Check if yearly package is available
      if (!offerings.yearly) {
        console.error('❌ Yearly package not available');
        console.error('   Current offerings state:', {
          monthly: offerings.monthly ? {
            identifier: offerings.monthly.identifier,
            priceString: offerings.monthly.priceString
          } : 'NOT AVAILABLE',
          yearly: offerings.yearly ? {
            identifier: offerings.yearly.identifier,
            priceString: offerings.yearly.priceString
          } : 'NOT AVAILABLE'
        });
        
        // Check if RevenueCat is configured
        const { isRevenueCatConfigured } = await import('../lib/revenuecat');
        if (!isRevenueCatConfigured()) {
          console.error('   RevenueCat is not configured');
          toast.error(SUBSCRIPTION_UI_TEXT.configuration.errorTitle, {
            description: SUBSCRIPTION_UI_TEXT.configuration.initializationFailed,
          });
          setIsUpgrading(false);
          return;
        }
        
        console.error('   Attempting to reload offerings to check for yearly package...');
        
        // Try reloading offerings one more time
        await loadOfferings();
        
        // Get fresh offerings directly from RevenueCat to verify
        const freshOfferings = await getOfferings(true);
        if (!freshOfferings?.availablePackages || freshOfferings.availablePackages.length === 0) {
          console.error('❌ No packages available from RevenueCat');
          console.error('   This usually means:');
          console.error('   1. No offerings configured in RevenueCat dashboard');
          console.error('   2. No packages attached to the current offering');
          console.error('   3. Products not set up in RevenueCat');
          toast.error(SUBSCRIPTION_UI_TEXT.errors.subscriptionNotAvailable, {
            description: SUBSCRIPTION_UI_TEXT.errors.subscriptionNotAvailableCheckDesc,
          });
          setIsUpgrading(false);
          return;
        }
        
        // Log available packages for debugging with full details
        const availablePackagesInfo = freshOfferings.availablePackages.map((p: any) => ({
          identifier: p?.identifier || 'unknown',
          productId: p?.product?.identifier || 'unknown',
          priceString: p?.product?.priceString || 'N/A',
          priceAmount: p?.product?.price || 'N/A',
          currencyCode: p?.product?.currencyCode || 'N/A',
          subscriptionPeriod: p?.product?.subscriptionPeriod || 'N/A',
          title: p?.product?.title || 'N/A',
          description: p?.product?.description || 'N/A',
          introPrice: p?.product?.introPrice || 'N/A',
          discount: p?.product?.discount || 'N/A'
        }));
        console.error('   Available packages from RevenueCat (FULL DETAILS):', availablePackagesInfo);
        console.error('   RAW PACKAGE DATA:', JSON.stringify(freshOfferings.availablePackages.map((p: any) => ({
          identifier: p?.identifier,
          product: {
            identifier: p?.product?.identifier,
            priceString: p?.product?.priceString,
            price: p?.product?.price,
            currencyCode: p?.product?.currencyCode,
            title: p?.product?.title,
            description: p?.product?.description,
            subscriptionPeriod: p?.product?.subscriptionPeriod,
            introPrice: p?.product?.introPrice,
            discount: p?.product?.discount
          }
        })), null, 2));
        
        // Try to find yearly package in fresh offerings using the same matching logic
        // Filter for packages with valid product data first
        const hasValidProduct = (p: any) => {
          if (!p || !p.product) return false;
          const productKeys = Object.keys(p.product);
          return productKeys.length > 0 && (p.product.identifier || p.product.priceString || p.product.price);
        };
        
        const validFreshPackages = freshOfferings.availablePackages.filter(hasValidProduct);
        
        if (validFreshPackages.length === 0) {
          console.error('❌ No packages with valid product data found');
          console.error('   All packages have empty product objects');
          console.error('   This indicates a RevenueCat configuration issue');
          console.error('   Please check:');
          console.error('   1. Products are linked to packages in RevenueCat dashboard');
          console.error('   2. Products have pricing configured');
          console.error('   3. API key has correct permissions');
        }
        
        let foundYearlyPkg: any = null;
        for (const pkg of validFreshPackages) {
          if (!pkg || !pkg.product) continue;
          
          const identifier = pkg.identifier || '';
          const identifierLower = identifier.toLowerCase();
          const productId = pkg.product.identifier || '';
          const productIdLower = productId.toLowerCase();
          
          // Check identifier against yearly list
          const isYearlyById = YEARLY_PACKAGE_IDENTIFIERS.some(id => {
            const idLower = id.toLowerCase();
            return identifierLower === idLower || 
                   identifierLower === idLower.replace('$', '') ||
                   identifierLower === idLower.replace('$rc_', 'rc_') ||
                   identifierLower.includes(idLower.replace('$', '')) ||
                   identifierLower.includes(idLower.replace('$rc_', 'rc_'));
          });
          
          // Check product ID against yearly list (exact match first, then pattern matching)
          const isYearlyByProductId = YEARLY_PACKAGE_IDENTIFIERS.some(id => {
            const idLower = id.toLowerCase();
            // Exact match (most reliable)
            if (productIdLower === idLower) return true;
            // Pattern matching for package identifiers
            return productIdLower.includes(idLower.replace('$', '')) ||
                   productIdLower.includes(idLower.replace('$rc_', 'rc_'));
          });
          
          // Check for yearly/annual keywords
          const hasYearlyKeywords = identifierLower.includes('year') || 
                                    identifierLower.includes('annual') ||
                                    identifierLower.includes('rc_yearly') ||
                                    identifierLower.includes('rc_annual') ||
                                    productIdLower.includes('year') ||
                                    productIdLower.includes('annual');
          
          // Check product metadata (billing period)
          const isYearlyByMetadata = pkg.product.subscriptionPeriod === 'P1Y' || 
                                    pkg.product.subscriptionPeriod === 'YEAR' ||
                                    pkg.product.subscriptionPeriod === 'ANNUAL' ||
                                    (pkg.product.subscriptionPeriod && 
                                     pkg.product.subscriptionPeriod.toString().toLowerCase().includes('year'));
          
          if (isYearlyById || isYearlyByProductId || hasYearlyKeywords || isYearlyByMetadata) {
            foundYearlyPkg = pkg;
            console.log('✅ Found yearly package in fresh offerings:', {
              identifier,
              productId,
              priceString: pkg.product.priceString,
              matchedBy: isYearlyById ? 'identifier' : isYearlyByProductId ? 'productId' : hasYearlyKeywords ? 'keywords' : 'metadata'
            });
            break;
          }
        }
        
        // If we found a yearly package in fresh offerings but state hasn't updated, reload offerings one more time
        if (foundYearlyPkg && !offerings.yearly) {
          console.log('   Yearly package found in fresh offerings, reloading state...');
          await loadOfferings();
          // Wait a bit for state to update
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Check again after reload (state may not have updated yet, so check fresh offerings)
        if (!offerings.yearly && !foundYearlyPkg) {
          console.error('❌ Yearly package still not available after reload');
          console.error('   This may indicate a package identifier mismatch');
          console.error('   Actual package identifier from RevenueCat:', availablePackagesInfo[0]?.identifier || 'N/A');
          console.error('   Expected identifiers:', YEARLY_PACKAGE_IDENTIFIERS);
          console.error('   Suggestion: Update package identifier in RevenueCat dashboard to match one of the expected identifiers, or add the actual identifier to YEARLY_PACKAGE_IDENTIFIERS in subscription-constants.ts');
          toast.error(SUBSCRIPTION_UI_TEXT.errors.packageNotFound, {
            description: SUBSCRIPTION_UI_TEXT.upgrade.yearlyNotAvailable,
          });
          setIsUpgrading(false);
          return;
        }
      }

      // Check if offerings are available before purchase
      console.log('🔍 Checking if offerings are available...');
        const offeringsCheck = await getOfferings(true);
      if (!offeringsCheck || !offeringsCheck.availablePackages || offeringsCheck.availablePackages.length === 0) {
        console.warn('⚠️ No offerings found, attempting to reload...');
        // Try reloading offerings
        await loadOfferings();
        
        // Check again after reload
        const offeringsCheck2 = await getOfferings(true);
        if (!offeringsCheck2 || !offeringsCheck2.availablePackages || offeringsCheck2.availablePackages.length === 0) {
          console.error('❌ No offerings available after reload');
          toast.error(SUBSCRIPTION_UI_TEXT.errors.subscriptionNotAvailable, {
            description: SUBSCRIPTION_UI_TEXT.errors.subscriptionNotAvailableCheckDesc,
          });
          setIsUpgrading(false);
          return;
        }
        
        // Re-check yearly package after reload
        if (!offerings.yearly) {
          console.error('❌ Yearly package still not available after reload');
          toast.error(SUBSCRIPTION_UI_TEXT.errors.packageNotFound, {
            description: SUBSCRIPTION_UI_TEXT.upgrade.yearlyNotAvailable,
          });
          setIsUpgrading(false);
          return;
        }
      }

      try {
        console.log(`Attempting yearly purchase on ${platform.platform}`);
        const success = await purchaseProSubscription('yearly');
        
        if (success) {
          toast.success(SUBSCRIPTION_UI_TEXT.messages.upgradeSuccess, {
            description: SUBSCRIPTION_UI_TEXT.messages.upgradeSuccessDesc,
          });
          await refreshSubscription();
          setIsUpgrading(false);
          onOpenChange(false);
          return;
        } else {
          toast.error(SUBSCRIPTION_UI_TEXT.messages.paymentFailed, {
            description: SUBSCRIPTION_UI_TEXT.messages.paymentFailedDesc,
          });
          setIsUpgrading(false);
          return;
        }
      } catch (rcError: any) {
        if (rcError.message?.includes("cancelled") || rcError.userCancelled) {
          setIsUpgrading(false);
          return;
        }

        if (isProduction) {
          console.error("Payment processing failed in production:", rcError.message);
          
          // Provide specific error messages based on error type
          let errorTitle = SUBSCRIPTION_UI_TEXT.errors.paymentProcessingUnavailable;
          let errorDescription = SUBSCRIPTION_UI_TEXT.errors.paymentProcessingUnavailableDesc;
          
          if (rcError.message?.includes("No subscription offerings available") || 
              rcError.message?.includes("No subscription packages available")) {
            errorTitle = SUBSCRIPTION_UI_TEXT.errors.subscriptionNotAvailable;
            errorDescription = SUBSCRIPTION_UI_TEXT.errors.subscriptionNotAvailableDesc;
          } else if (rcError.message?.includes("subscription package not found")) {
            errorTitle = SUBSCRIPTION_UI_TEXT.errors.packageNotFound;
            errorDescription = SUBSCRIPTION_UI_TEXT.errors.packageNotFoundDesc;
          }
          
          toast.error(errorTitle, {
            description: errorDescription,
          });
          setIsUpgrading(false);
          return;
        }

        if (isDevelopment) {
          console.log("→ Using simulated upgrade for development (yearly)");
          try {
            await upgradeToPro();
            toast.success(SUBSCRIPTION_UI_TEXT.messages.upgradeDevMode, {
              description: SUBSCRIPTION_UI_TEXT.messages.upgradeDevModeDesc,
            });
            setIsUpgrading(false);
            onOpenChange(false);
            return;
          } catch (upgradeError) {
            console.error("Development upgrade failed:", upgradeError);
            setIsUpgrading(false);
            throw upgradeError;
          }
        }

        toast.error(SUBSCRIPTION_UI_TEXT.upgrade.failed, {
          description: rcError.message || SUBSCRIPTION_UI_TEXT.upgrade.failedDesc,
        });
        setIsUpgrading(false);
      }
    } catch (error: any) {
      console.error("Yearly upgrade error:", error);
      toast.error(SUBSCRIPTION_UI_TEXT.upgrade.failed, {
        description: error.message || SUBSCRIPTION_UI_TEXT.upgrade.failedDesc,
      });
      setIsUpgrading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] lg:max-w-[980px] max-h-[95vh] overflow-y-auto p-0 md:p-0">
        <div className="p-4 md:p-5 lg:p-7 xl:p-8">
          {/* Header */}
          <div className="mb-5 md:mb-7">
            <DialogHeader className="text-center">
              <DialogTitle className="text-2xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-[#9B87E8] via-[#C9E4F7] to-[#B8E6D5] bg-clip-text text-transparent mb-2">
                {SUBSCRIPTION_UI_TEXT.title}
              </DialogTitle>
              <DialogDescription className="text-sm md:text-base lg:text-lg mt-2 text-muted-foreground">
                {SUBSCRIPTION_UI_TEXT.description}
              </DialogDescription>
            </DialogHeader>

          </div>

          {/* Plans Grid - Responsive: Free, Monthly Pro (if available), Yearly Pro (if available) */}
          {(() => {
            const hasMonthly = !!offerings.monthly;
            const hasYearly = !!offerings.yearly;
            const gridCols = hasMonthly && hasYearly 
              ? "grid-cols-1 md:grid-cols-3"  // All 3 plans: Free, Monthly, Yearly
              : hasMonthly || hasYearly
              ? "grid-cols-1 md:grid-cols-2"  // 2 plans: Free + one Pro plan
              : "grid-cols-1";  // Just Free plan
            
            console.log('🎨 UI Grid Layout Decision:');
            console.log('   Monthly available:', hasMonthly);
            console.log('   Yearly available:', hasYearly);
            console.log('   Grid columns:', gridCols);
            console.log('   Plans to render:', 
              `Free${hasMonthly ? ' + Monthly' : ''}${hasYearly ? ' + Yearly' : ''}`
            );
            
            return (
              <div className={cn("grid gap-4 md:gap-5 lg:gap-7 max-w-full", gridCols)}>
            {/* Free Tier - Spacious Design */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="relative border-2 border-gray-200 dark:border-gray-700 rounded-xl md:rounded-2xl p-5 md:p-7 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-300 shadow-lg hover:shadow-xl flex flex-col"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">{SUBSCRIPTION_UI_TEXT.free.title}</h3>
                  <p className="text-sm md:text-base text-muted-foreground">{SUBSCRIPTION_UI_TEXT.free.subtitle}</p>
                </div>
                {subscription.tier === "free" && (
                  <Badge className="bg-[#B8E6D5] text-gray-800 border-[#B8E6D5] text-xs px-3 py-1 shadow-sm flex-shrink-0">
                    {SUBSCRIPTION_UI_TEXT.free.button.current}
                  </Badge>
                )}
              </div>

              <div className="mb-5">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100">{SUBSCRIPTION_UI_TEXT.free.price}</span>
                  <span className="text-base md:text-xl text-muted-foreground">{SUBSCRIPTION_UI_TEXT.free.priceUnit}</span>
                </div>
                <p className="text-sm md:text-base text-muted-foreground">{SUBSCRIPTION_UI_TEXT.free.description}</p>
              </div>

              <ul className="space-y-3 mb-5 flex-1">
                {freeTierFeatures.map((feature, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 group"
                  >
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#B8E6D5] dark:bg-[#5A8A7A] flex items-center justify-center mt-0.5 group-hover:scale-110 transition-transform duration-200">
                      <feature.icon className="w-3 h-3 text-gray-800 dark:text-gray-100" />
                    </div>
                    <span className="text-sm md:text-base text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors leading-relaxed">
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                variant="outline"
                className="w-full border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm md:text-base py-4 font-semibold transition-all duration-200 hover:scale-[1.01]"
                disabled={subscription.tier === "free" || isDowngrading}
                onClick={subscription.tier === "pro" ? handleDowngrade : undefined}
              >
                {isDowngrading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                    {SUBSCRIPTION_UI_TEXT.pro.button.downgrading}
                  </span>
                ) : subscription.tier === "free" ? (
                  SUBSCRIPTION_UI_TEXT.free.button.current
                ) : (
                  SUBSCRIPTION_UI_TEXT.free.button.downgrade
                )}
              </Button>
            </motion.div>

            {/* Monthly Pro Tier */}
            {offerings.monthly && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="relative border-2 border-[#9B87E8] rounded-xl md:rounded-2xl p-4 md:p-5 bg-gradient-to-br from-[#9B87E8]/10 via-[#C9E4F7]/10 to-[#B8E6D5]/10 dark:from-[#9B87E8]/20 dark:via-[#6A8AAA]/10 dark:to-[#5A8A7A]/10 overflow-hidden shadow-xl hover:shadow-[#9B87E8]/30 transition-all duration-300 flex flex-col"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#9B87E8]/20 to-[#C9E4F7]/20 rounded-bl-full blur-2xl" />
              
              <div className="relative z-10 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">
                        {offerings.monthly?.title ?? SUBSCRIPTION_UI_TEXT.planCards.monthly.title}
                      </h3>
                      <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-[#9B87E8] animate-pulse" />
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      {offerings.monthly?.description || SUBSCRIPTION_UI_TEXT.planCards.monthly.billingPeriod}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">
                      {offerings.monthly?.priceString ?? DEFAULT_MONTHLY_PRICE}
                    </span>
                    <span className="text-sm md:text-base text-muted-foreground">{SUBSCRIPTION_UI_TEXT.planCards.priceUnits.month}</span>
                  </div>
                  {offerings.monthly?.description && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      {offerings.monthly.description}
                    </p>
                  )}
                </div>

                {/* Features list - compact */}
                <ul className="space-y-2 mb-4 flex-1">
                  {proTierFeatures.slice(0, FEATURES_DISPLAY_LIMIT).map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className={cn(
                        "flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center mt-0.5",
                        feature.highlight
                          ? "bg-gradient-to-br from-[#9B87E8] to-[#D4C5F9]"
                          : "bg-[#B8E6D5] dark:bg-[#5A8A7A]"
                      )}>
                        <feature.icon className={cn(
                          "w-2.5 h-2.5",
                          feature.highlight ? "text-white" : "text-gray-800 dark:text-gray-100"
                        )} />
                      </div>
                      <span className="text-xs md:text-sm text-gray-700 dark:text-gray-300">
                        {feature.text}
                      </span>
                    </li>
                  ))}
                  <li className="text-xs text-muted-foreground pt-1">
                    + {proTierFeatures.length - FEATURES_DISPLAY_LIMIT} more features
                  </li>
                </ul>

                <Button
                  className="w-full bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] hover:from-[#8B77D8] hover:to-[#C4B5E9] text-white shadow-lg hover:shadow-xl transition-all duration-300 text-xs md:text-sm font-bold py-3 md:py-4 hover:scale-[1.01]"
                  disabled={subscription.tier === "pro" || isUpgrading}
                  onClick={handleUpgradeMonthly}
                >
                  {isUpgrading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {SUBSCRIPTION_UI_TEXT.planCards.monthly.button.processing}
                    </span>
                  ) : subscription.tier === "pro" ? (
                    SUBSCRIPTION_UI_TEXT.planCards.monthly.button.current
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Sparkles className="w-3 h-3" />
                      {SUBSCRIPTION_UI_TEXT.planCards.monthly.button.upgrade}
                    </span>
                  )}
                </Button>
              </div>
            </motion.div>
            )}

            {/* Yearly Pro Tier - Featured */}
            {offerings.yearly && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="relative border-2 border-[#9B87E8] rounded-xl md:rounded-2xl p-4 md:p-5 bg-gradient-to-br from-[#9B87E8]/15 via-[#C9E4F7]/15 to-[#B8E6D5]/15 dark:from-[#9B87E8]/25 dark:via-[#6A8AAA]/15 dark:to-[#5A8A7A]/15 overflow-hidden shadow-2xl hover:shadow-[#9B87E8]/40 transition-all duration-300 flex flex-col"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#9B87E8]/25 to-[#C9E4F7]/25 rounded-bl-full blur-2xl" />
              
              {/* Popular Badge */}
              <div className="absolute top-3 right-3 z-20">
                <Badge className="bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] text-white border-0 shadow-lg px-2 py-0.5 text-xs font-semibold">
                  <Crown className="w-2.5 h-2.5 mr-1" />
                  {SUBSCRIPTION_UI_TEXT.planCards.yearly.badge}
                </Badge>
              </div>

              <div className="relative z-10 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">
                        {offerings.yearly?.title ?? SUBSCRIPTION_UI_TEXT.planCards.yearly.title}
                      </h3>
                      <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-[#9B87E8] animate-pulse" />
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      {offerings.yearly?.description || SUBSCRIPTION_UI_TEXT.planCards.yearly.billingPeriod}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">
                      {offerings.yearly?.priceString ?? DEFAULT_YEARLY_PRICE}
                    </span>
                    <span className="text-sm md:text-base text-muted-foreground">{SUBSCRIPTION_UI_TEXT.planCards.priceUnits.year}</span>
                  </div>
                  {savings > 0 && (
                    <Badge className="mb-2 bg-gradient-to-r from-[#B8E6D5] to-[#C9E4F7] text-gray-800 text-xs font-bold px-2 py-0.5">
                      {SUBSCRIPTION_UI_TEXT.planCards.yearly.savingsLabel(savings)}
                    </Badge>
                  )}
                  {offerings.yearly && offerings.monthly && parseFloat(offerings.yearly.price || '0') > 0 && (
                    <p className="text-xs md:text-sm font-semibold text-[#9B87E8]">
                      {SUBSCRIPTION_UI_TEXT.planCards.yearly.perMonthLabel(((parseFloat(offerings.yearly.price) / 12).toFixed(2)))}
                    </p>
                  )}
                  {offerings.yearly?.description && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      {offerings.yearly.description}
                    </p>
                  )}
                </div>

                {/* Features list - compact */}
                <ul className="space-y-2 mb-4 flex-1">
                  {proTierFeatures.slice(0, FEATURES_DISPLAY_LIMIT).map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className={cn(
                        "flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center mt-0.5",
                        feature.highlight
                          ? "bg-gradient-to-br from-[#9B87E8] to-[#D4C5F9]"
                          : "bg-[#B8E6D5] dark:bg-[#5A8A7A]"
                      )}>
                        <feature.icon className={cn(
                          "w-2.5 h-2.5",
                          feature.highlight ? "text-white" : "text-gray-800 dark:text-gray-100"
                        )} />
                      </div>
                      <span className="text-xs md:text-sm text-gray-700 dark:text-gray-300">
                        {feature.text}
                      </span>
                    </li>
                  ))}
                  <li className="text-xs text-muted-foreground pt-1">
                    + {proTierFeatures.length - FEATURES_DISPLAY_LIMIT} more features
                  </li>
                </ul>

                <Button
                  className="w-full bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] hover:from-[#8B77D8] hover:to-[#C4B5E9] text-white shadow-xl hover:shadow-2xl transition-all duration-300 text-xs md:text-sm font-bold py-3 md:py-4 hover:scale-[1.01]"
                  disabled={subscription.tier === "pro" || isUpgrading}
                  onClick={handleUpgradeYearly}
                >
                  {isUpgrading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {SUBSCRIPTION_UI_TEXT.planCards.yearly.button.processing}
                    </span>
                  ) : subscription.tier === "pro" ? (
                    SUBSCRIPTION_UI_TEXT.planCards.yearly.button.current
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Sparkles className="w-3 h-3" />
                      {SUBSCRIPTION_UI_TEXT.planCards.yearly.button.upgrade}
                    </span>
                  )}
                </Button>
              </div>
            </motion.div>
            )}
              </div>
            );
          })()}

          {/* Footer Note - Spacious */}
          <div className="mt-5 md:mt-7 p-3 md:p-4 bg-gradient-to-r from-[#E6D5F0]/40 via-[#C9E4F7]/40 to-[#B8E6D5]/40 dark:from-[#4A4A5E]/60 dark:via-[#3E3E52]/60 dark:to-[#3E3E52]/60 rounded-lg md:rounded-xl border-2 border-[#9B87E8]/30 shadow-lg backdrop-blur-sm">
            <p className="text-xs md:text-sm lg:text-base text-center text-gray-700 dark:text-gray-300 leading-relaxed">
              {SUBSCRIPTION_UI_TEXT.footer.message}{' '}
              <span className="font-semibold text-[#9B87E8]">{SUBSCRIPTION_UI_TEXT.footer.upgradeText}</span>{' '}
              {SUBSCRIPTION_UI_TEXT.footer.upgradeDescription}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


