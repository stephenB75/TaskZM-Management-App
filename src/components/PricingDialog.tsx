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
// Icons migrated to Icon component
import { Icon } from "./Icon";
import { ICON_SIZE_SM, ICON_SIZE_MD, ICON_SIZE_LG, ICON_SIZE_XS } from "../lib/layout-constants";
import { useSubscription } from "../contexts/SubscriptionContext";
import { useAuth } from "../contexts/AuthContext";
import { COLOR_PRIMARY, COLOR_PRIMARY_LIGHT, COLOR_PASTEL_LAVENDER, COLOR_PASTEL_SKY, COLOR_PASTEL_MINT, COLOR_TEXT_WHITE } from "../lib/color-theme";
import { toast } from '../lib/toast-wrapper';
import { motion } from "motion/react";
import { getPlatform } from "../lib/platform";
import { cn } from "../lib/utils";
import { TIMING_CONSTANTS } from "../lib/timing-constants";
import { UI_PRICING_DIALOG_COLORS, UI_PRICING_GRADIENT_COLORS } from "../lib/ui-colors";
import { PRICING_DIALOG_TEXT_SIZES } from "../lib/text-size-constants";
import {
  SUBSCRIPTION_UI_TEXT,
  FREE_TIER_FEATURES,
  PRO_MONTHLY_FEATURES,
  PRO_YEARLY_FEATURES,
  PRO_MONTHLY_FEATURES_LIST,
  PRO_YEARLY_FEATURES_LIST,
  FEATURES_DISPLAY_LIMIT,
} from "../lib/subscription-constants";
import * as api from "../lib/api";
import { getOfferings, restorePurchases, configureRevenueCat, purchaseProSubscription, isRevenueCatConfigured, isNativeStoreBilling, supportsBillingChannelChoice, getSubscriptionBillingChannel, setSubscriptionBillingChannel, type SubscriptionBillingChannel } from "../lib/revenuecat";
import { logger } from "../lib/logger";

interface DialogOffering {
  priceString: string;
  title: string;
  description: string;
}

interface PricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOfferingsUpdated?: (pricing: { monthly?: string | null; yearly?: string | null; timestamp: string }) => void;
}

export function PricingDialog({
  open,
  onOpenChange,
  onOfferingsUpdated,
}: PricingDialogProps) {
  const { subscription, upgradeToPro, refreshSubscription, cancelSubscription, downgradeToFree } =
    useSubscription();
  
  // Debug: Log subscription state to help identify current plan
  React.useEffect(() => {
    logger.debug('📋 PricingDialog - Current subscription state:', {
      tier: subscription.tier,
      billingPeriod: subscription.billingPeriod,
      status: subscription.status,
      isFree: subscription.tier === 'free',
      isMonthlyPro: subscription.tier === 'pro' && subscription.billingPeriod === 'monthly',
      isYearlyPro: subscription.tier === 'pro' && subscription.billingPeriod === 'yearly',
    });
  }, [subscription]);
  
  const [isUpgrading, setIsUpgrading] = React.useState(false);
  const [isRestoring, setIsRestoring] = React.useState(false);
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [isDowngrading, setIsDowngrading] = React.useState(false);
  const [offerings, setOfferings] = React.useState<{
    monthly: DialogOffering | null;
    yearly: DialogOffering | null;
  }>({ monthly: null, yearly: null });
  const [isLoadingOfferings, setIsLoadingOfferings] = React.useState(false);
  const [offeringsError, setOfferingsError] = React.useState<string | null>(null);
  const [billingChannel, setBillingChannel] = React.useState<SubscriptionBillingChannel>(() =>
    getSubscriptionBillingChannel()
  );

  const platform = getPlatform();
  const { user } = useAuth();

  const loadOfferings = React.useCallback(async () => {
    if (!user?.id) return;

    setIsLoadingOfferings(true);
    setOfferingsError(null);
    try {
      await configureRevenueCat(user.id);
      const rcOfferings = await getOfferings();

      logger.debug('📥 Offerings loaded in PricingDialog:', {
        monthly: rcOfferings.monthly ? { 
          priceString: rcOfferings.monthly.priceString, 
          title: rcOfferings.monthly.title,
          description: rcOfferings.monthly.description,
        } : null,
        yearly: rcOfferings.yearly ? { 
          priceString: rcOfferings.yearly.priceString, 
          title: rcOfferings.yearly.title,
          description: rcOfferings.yearly.description,
        } : null,
        isRCConfigured: isRevenueCatConfigured(),
      });
      
      // Log yearly subscription details specifically
      if (rcOfferings.yearly) {
        const yearlyPriceNum = parseFloat(rcOfferings.yearly.priceString.replace(/[^0-9.]/g, ''));
        logger.debug('📅 Yearly subscription from RevenueCat:', {
          title: rcOfferings.yearly.title,
          priceString: rcOfferings.yearly.priceString,
          numericValue: yearlyPriceNum,
          perMonth: (yearlyPriceNum / 12).toFixed(2),
          description: rcOfferings.yearly.description,
        });
      }

      // Require RevenueCat to be configured and return offerings
      const hasMonthly = rcOfferings.monthly !== null;
      const hasYearly = rcOfferings.yearly !== null;
      
      if (!hasMonthly && !hasYearly) {
        // RevenueCat must be configured and return offerings
        logger.warn('⚠️ RevenueCat configured but no offerings returned');
        setOfferingsError(SUBSCRIPTION_UI_TEXT.errors.subscriptionNotAvailableDesc);
      } else if (!hasMonthly) {
        // Only yearly available
        logger.warn('⚠️ Only yearly subscription available');
        setOfferingsError(SUBSCRIPTION_UI_TEXT.upgrade.monthlyNotAvailable);
      } else if (!hasYearly) {
        // Only monthly available
        logger.warn('⚠️ Only monthly subscription available');
        setOfferingsError(SUBSCRIPTION_UI_TEXT.upgrade.yearlyNotAvailable);
      } else {
        // We have both offerings from RevenueCat - clear any errors
        logger.debug('✅ Both offerings loaded from RevenueCat');
        setOfferingsError(null);
      }

      setOfferings(rcOfferings);
      onOfferingsUpdated?.({
        monthly: rcOfferings.monthly?.priceString ?? null,
        yearly: rcOfferings.yearly?.priceString ?? null,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('RevenueCat offerings load failed:', error);
      // All RevenueCat errors are critical - we require RevenueCat pricing
      const errorMessage = error?.message || SUBSCRIPTION_UI_TEXT.errors.subscriptionNotAvailableDesc;
      setOfferingsError(errorMessage);
    } finally {
      setIsLoadingOfferings(false);
    }
  }, [user?.id, onOfferingsUpdated]);

  React.useEffect(() => {
    if (open && user?.id) {
      loadOfferings();
      configureRevenueCat(user.id).catch((error) => {
        logger.debug('RevenueCat pre-configuration failed (non-blocking):', error);
      });
    }
  }, [open, user?.id, loadOfferings]);

  React.useEffect(() => {
    if (!open || !user?.id || !supportsBillingChannelChoice()) return;

    let cancelled = false;
    void (async () => {
      await setSubscriptionBillingChannel(user.id, billingChannel);
      if (!cancelled) {
        await loadOfferings();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [billingChannel, open, user?.id, loadOfferings]);

  const handleRestore = async () => {
    try {
      setIsRestoring(true);
      if (!user?.id) {
        throw new Error(SUBSCRIPTION_UI_TEXT.errors.subscriptionNotAvailableDesc);
      }

      await configureRevenueCat(user.id);
      const result = await restorePurchases();
      if (!result.success) {
        throw new Error(result.error || SUBSCRIPTION_UI_TEXT.messages.restoreFailedDesc);
      }

      // Refresh subscription status from backend
      await refreshSubscription();
      toast.success(SUBSCRIPTION_UI_TEXT.messages.subscriptionRestored);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(SUBSCRIPTION_UI_TEXT.messages.restoreFailed, {
        description: error.message,
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCancel = async () => {
    const confirmed = window.confirm(
      `${SUBSCRIPTION_UI_TEXT.confirmations.cancel.title}\n\n${SUBSCRIPTION_UI_TEXT.confirmations.cancel.message}`
    );
    if (!confirmed) return;

    try {
      setIsCancelling(true);
      await cancelSubscription();
      await refreshSubscription();
      toast.success(SUBSCRIPTION_UI_TEXT.messages.subscriptionCancelled);
    } catch (error: any) {
      toast.error(SUBSCRIPTION_UI_TEXT.messages.cancelFailed, {
        description: error.message,
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDowngrade = async () => {
    // Use appropriate feature list based on current subscription
    const isYearly = subscription.billingPeriod === 'yearly';
    const featuresList = (isYearly ? PRO_YEARLY_FEATURES_LIST : PRO_MONTHLY_FEATURES_LIST).map(f => `• ${f}`).join('\n');
    const confirmed = window.confirm(
      `${SUBSCRIPTION_UI_TEXT.confirmations.downgrade.title}\n\n${SUBSCRIPTION_UI_TEXT.confirmations.downgrade.messagePrefix}\n${featuresList}${SUBSCRIPTION_UI_TEXT.confirmations.downgrade.messageSuffix}`
    );
    if (!confirmed) return;

    try {
      setIsDowngrading(true);
      await downgradeToFree();
      await refreshSubscription();
      toast.success(SUBSCRIPTION_UI_TEXT.messages.downgradeSuccess);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(SUBSCRIPTION_UI_TEXT.messages.downgradeFailed, {
        description: error.message,
      });
    } finally {
      setIsDowngrading(false);
    }
  };

  // Only use RevenueCat offerings - no fallbacks or static pricing
  // Prices are dynamically loaded from RevenueCat via getOfferings()
  // If offerings are null, cards will show loading/disabled state
  const monthlyOffering = offerings.monthly;
  const yearlyOffering = offerings.yearly;
  
  // Validate that we're using RevenueCat data (not static)
  React.useEffect(() => {
    if (monthlyOffering) {
      logger.debug('✅ Monthly offering from RevenueCat:', {
        priceString: monthlyOffering.priceString,
        title: monthlyOffering.title,
        source: 'RevenueCat (dynamic)',
      });
    }
    if (yearlyOffering) {
      logger.debug('✅ Yearly offering from RevenueCat:', {
        priceString: yearlyOffering.priceString,
        title: yearlyOffering.title,
        source: 'RevenueCat (dynamic)',
      });
    }
  }, [monthlyOffering, yearlyOffering]);
  
  // Log RevenueCat offerings and verify yearly subscription
  React.useEffect(() => {
    if (yearlyOffering) {
      const yearlyPriceNum = parseFloat(yearlyOffering.priceString.replace(/[^0-9.]/g, ''));
      logger.debug('💰 Yearly subscription from RevenueCat (UI):', {
        title: yearlyOffering.title,
        priceString: yearlyOffering.priceString,
        description: yearlyOffering.description,
        numericValue: yearlyPriceNum,
        isValid: !isNaN(yearlyPriceNum) && yearlyPriceNum > 0,
        perMonth: (yearlyPriceNum / 12).toFixed(2),
        source: 'RevenueCat',
      });
      
      // Warn if yearly price seems incorrect (too low or invalid)
      if (isNaN(yearlyPriceNum) || yearlyPriceNum <= 0 || yearlyPriceNum < 10) {
        logger.warn('⚠️ Yearly subscription price may be incorrect:', {
          priceString: yearlyOffering.priceString,
          numericValue: yearlyPriceNum,
          note: 'Price seems unusually low. Verify RevenueCat configuration.',
        });
      }
    }
    
    if (monthlyOffering) {
      logger.debug('💰 Monthly subscription from RevenueCat (UI):', {
        title: monthlyOffering.title,
        priceString: monthlyOffering.priceString,
        description: monthlyOffering.description,
        source: 'RevenueCat',
      });
    }
  }, [monthlyOffering, yearlyOffering]);
  const formatPrice = (price: string | undefined) => {
    if (isLoadingOfferings) return 'Loading…';
    if (!price) return '—';
    // Ensure price is a string and not an object
    let priceStr = String(price)
      .replace(/\[object Object\]/g, '')
      .replace(/NaN/gi, '')
      .replace(/undefined/gi, '')
      .replace(/null/gi, '')
      .trim();
    
    // Validate price string is not empty or invalid
    if (!priceStr || 
        priceStr === '' || 
        priceStr === 'NaN' || 
        priceStr === 'undefined' || 
        priceStr === 'null' ||
        priceStr.includes('NaN') ||
        isNaN(parseFloat(priceStr.replace(/[^0-9.]/g, '')))) {
      logger.warn('⚠️ Invalid price string detected:', price);
      return '—';
    }
    return priceStr;
  };
  const formatDescription = (description: string) =>
    isLoadingOfferings ? 'Fetching latest pricing…' : description;

  const calculateSavings = () => {
    if (!monthlyOffering || !yearlyOffering) return { percent: 0, amount: 0 };
    
    try {
      // Extract numeric values from price strings (e.g., "$3.99" -> 3.99, "€3,99" -> 3.99)
      // Handle various formats: "$3.99", "3.99", "$3,99.00", etc.
      const extractPrice = (priceStr: string): number => {
        if (!priceStr) return 0;
        // Remove all non-numeric characters except decimal point
        let cleaned = priceStr.replace(/[^\d.]/g, '');
        // Handle comma as decimal separator (European format)
        if (cleaned.includes(',') && !cleaned.includes('.')) {
          cleaned = cleaned.replace(',', '.');
        }
        // If both comma and period exist, assume period is decimal and comma is thousands
        if (cleaned.includes(',') && cleaned.includes('.')) {
          cleaned = cleaned.replace(/,/g, '');
        }
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) || parsed <= 0 ? 0 : parsed;
      };
      
      const monthlyPrice = extractPrice(monthlyOffering.priceString);
      const yearlyPrice = extractPrice(yearlyOffering.priceString);
      
      // Calculate what 12 months of monthly subscription would cost
      const yearlyEquivalent = monthlyPrice * 12;
      
      // If we don't have valid prices, return 0
      if (yearlyEquivalent === 0 || yearlyPrice === 0) {
        logger.warn('⚠️ Cannot calculate savings: invalid prices', {
          monthly: monthlyOffering.priceString,
          yearly: yearlyOffering.priceString,
          monthlyParsed: monthlyPrice,
          yearlyParsed: yearlyPrice,
        });
        return { percent: 0, amount: 0 };
      }
      
      // Calculate savings amount (dollar amount saved)
      const savingsAmount = yearlyEquivalent - yearlyPrice;
      
      // Calculate savings percentage: ((yearlyEquivalent - yearlyPrice) / yearlyEquivalent) * 100
      const savingsPercent = ((yearlyEquivalent - yearlyPrice) / yearlyEquivalent) * 100;
      const rounded = Math.round(savingsPercent);
      
      // Log for debugging
      console.log('💰 Savings calculation:', {
        monthlyPrice,
        yearlyPrice,
        yearlyEquivalent,
        savingsAmount: savingsAmount.toFixed(2),
        savingsPercent: savingsPercent.toFixed(2) + '%',
        rounded: rounded + '%',
      });
      
      // Return 0 if savings is negative (yearly is more expensive, which shouldn't happen)
      return rounded > 0 ? { percent: rounded, amount: savingsAmount } : { percent: 0, amount: 0 };
    } catch (error) {
      console.error('❌ Error calculating savings:', error);
      return { percent: 0, amount: 0 };
    }
  };

  const savings = calculateSavings();
  
  // Calculate per-month price for yearly plan
  const getYearlyPerMonthPrice = () => {
    if (!yearlyOffering) return '0.00';
    const yearlyPriceStr = yearlyOffering.priceString.replace(/[^0-9.]/g, '');
    const yearlyPrice = parseFloat(yearlyPriceStr) || 0;
    return (yearlyPrice / 12).toFixed(2);
  };

  const handleUpgradeMonthly = async () => {
    try {
      setIsUpgrading(true);
      
      if (!user?.id) {
        throw new Error(SUBSCRIPTION_UI_TEXT.errors.subscriptionNotAvailableDesc);
      }

      // Show immediate feedback
      toast.info('Preparing payment form...', {
        duration: TIMING_CONSTANTS.animations.medium * 10, // 2 seconds (2000ms)
      });

      // RevenueCat should already be configured from dialog open, but ensure it's ready
      // Use a timeout to prevent hanging if RevenueCat is slow
      const configurePromise = configureRevenueCat(user.id);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Configuration timeout')), TIMING_CONSTANTS.timeouts.configuration)
      );
      
      try {
        await Promise.race([configurePromise, timeoutPromise]);
      } catch (configError) {
        // If configuration times out, continue anyway - it might already be configured
        logger.debug('RevenueCat configuration timeout or error (continuing):', configError);
      }
      
      // Purchase through RevenueCat with timeout
      toast.info('Connecting to payment provider...', {
        duration: TIMING_CONSTANTS.animations.medium * 10, // 2 seconds (2000ms)
      });
      
      const purchasePromise = purchaseProSubscription('monthly');
      const purchaseTimeout = new Promise<{ success: boolean; error?: string }>((_, reject) =>
        setTimeout(() => reject(new Error('Purchase request timed out. The payment provider may be experiencing delays. Please try again.')), TIMING_CONSTANTS.timeouts.purchase)
      );
      
      const result = await Promise.race([purchasePromise, purchaseTimeout]);
      
      if (!result.success) {
        // Don't show error toast for user cancellation - it's not an error
        if ((result as any).cancelled || 
            result.error?.toLowerCase().includes('cancelled') || 
            result.error?.toLowerCase().includes('cancel')) {
          // User cancelled - just close dialog silently (no error message)
          console.log('ℹ️ Purchase cancelled by user');
          onOpenChange(false);
          return;
        }
        throw new Error(result.error || SUBSCRIPTION_UI_TEXT.upgrade.failedDesc);
      }

      // Refresh subscription status from backend (webhook may have updated it)
      await refreshSubscription();
      
      // Show success message
      if (result.error) {
        // Purchase completed but entitlement not immediately available
        toast.success(SUBSCRIPTION_UI_TEXT.messages.upgradeSuccess, {
          description: result.error,
        });
      } else {
        toast.success(SUBSCRIPTION_UI_TEXT.messages.upgradeSuccess);
      }
      
      onOpenChange(false);
    } catch (error: any) {
      console.error("Monthly upgrade error:", error);
      toast.error(SUBSCRIPTION_UI_TEXT.upgrade.failed, {
        description: error.message || SUBSCRIPTION_UI_TEXT.upgrade.failedDesc,
      });
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleUpgradeYearly = async () => {
    try {
      setIsUpgrading(true);
      
      if (!user?.id) {
        throw new Error(SUBSCRIPTION_UI_TEXT.errors.subscriptionNotAvailableDesc);
      }

      // Show immediate feedback
      toast.info('Preparing payment form...', {
        duration: TIMING_CONSTANTS.animations.medium * 10, // 2 seconds (2000ms)
      });

      // RevenueCat should already be configured from dialog open, but ensure it's ready
      // Use a timeout to prevent hanging if RevenueCat is slow
      const configurePromise = configureRevenueCat(user.id);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Configuration timeout')), TIMING_CONSTANTS.timeouts.configuration)
      );
      
      try {
        await Promise.race([configurePromise, timeoutPromise]);
      } catch (configError) {
        // If configuration times out, continue anyway - it might already be configured
        logger.debug('RevenueCat configuration timeout or error (continuing):', configError);
      }
      
      // Purchase through RevenueCat with timeout
      toast.info('Connecting to payment provider...', {
        duration: TIMING_CONSTANTS.animations.medium * 10, // 2 seconds (2000ms)
      });
      
      const purchasePromise = purchaseProSubscription('yearly');
      const purchaseTimeout = new Promise<{ success: boolean; error?: string }>((_, reject) =>
        setTimeout(() => reject(new Error('Purchase request timed out. The payment provider may be experiencing delays. Please try again.')), TIMING_CONSTANTS.timeouts.purchase)
      );
      
      const result = await Promise.race([purchasePromise, purchaseTimeout]);
      
      if (!result.success) {
        // Don't show error toast for user cancellation - it's not an error
        if ((result as any).cancelled || 
            result.error?.toLowerCase().includes('cancelled') || 
            result.error?.toLowerCase().includes('cancel')) {
          // User cancelled - just close dialog silently (no error message)
          console.log('ℹ️ Purchase cancelled by user');
          onOpenChange(false);
          return;
        }
        throw new Error(result.error || SUBSCRIPTION_UI_TEXT.upgrade.failedDesc);
      }

      // Refresh subscription status from backend (webhook may have updated it)
      await refreshSubscription();
      
      // Show success message
      if (result.error) {
        // Purchase completed but entitlement not immediately available
        toast.success(SUBSCRIPTION_UI_TEXT.messages.upgradeSuccess, {
          description: result.error,
        });
      } else {
        toast.success(SUBSCRIPTION_UI_TEXT.messages.upgradeSuccess);
      }
      
      onOpenChange(false);
    } catch (error: any) {
      console.error("Yearly upgrade error:", error);
      toast.error(SUBSCRIPTION_UI_TEXT.upgrade.failed, {
        description: error.message || SUBSCRIPTION_UI_TEXT.upgrade.failedDesc,
      });
    } finally {
      setIsUpgrading(false);
    }
  };


  const freeTierFeatures = FREE_TIER_FEATURES;
  const monthlyProFeatures = PRO_MONTHLY_FEATURES;
  const yearlyProFeatures = PRO_YEARLY_FEATURES;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-[850px] max-h-[95vh] overflow-y-auto rounded-2xl border-0 bg-background p-0 shadow-none md:p-0">
        <div className="p-3 md:p-4">
          <div className="mb-3 md:mb-4">
            <DialogHeader className="text-center">
              <DialogTitle className={`text-lg md:text-xl font-bold ${UI_PRICING_DIALOG_COLORS.titleGradient.className} mb-1`}>
                {SUBSCRIPTION_UI_TEXT.title}
              </DialogTitle>
              <DialogDescription className={`${PRICING_DIALOG_TEXT_SIZES.description} mt-1 text-muted-foreground`}>
                {SUBSCRIPTION_UI_TEXT.description}
              </DialogDescription>
            </DialogHeader>
          </div>

          {offeringsError && (
            <div className={`mb-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-3 py-1.5 ${PRICING_DIALOG_TEXT_SIZES.description} text-red-700 dark:text-red-300`}>
              {offeringsError}
            </div>
          )}

          {supportsBillingChannelChoice() && (
          <div className="mb-3 md:mb-4">
            <p className={`${PRICING_DIALOG_TEXT_SIZES.description} text-center text-muted-foreground mb-2 font-medium`}>
              {SUBSCRIPTION_UI_TEXT.native.billingMethodTitle}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                type="button"
                variant={billingChannel === 'native-store' ? 'default' : 'outline'}
                className="w-full"
                onClick={() => setBillingChannel('native-store')}
              >
                {SUBSCRIPTION_UI_TEXT.native.billingMethodNative}
              </Button>
              <Button
                type="button"
                variant={billingChannel === 'web' ? 'default' : 'outline'}
                className="w-full"
                onClick={() => setBillingChannel('web')}
              >
                {SUBSCRIPTION_UI_TEXT.native.billingMethodWeb}
              </Button>
            </div>
          </div>
          )}

          {/* Payment form country selection hint - web Stripe checkout only */}
          {!isNativeStoreBilling() && (
          <div className="mb-3 md:mb-4">
            <div className="p-2.5 md:p-3 bg-amber-50/90 dark:bg-amber-900/30 rounded-lg border-2 border-amber-300 dark:border-amber-700/60 shadow-sm">
              <p className={`${PRICING_DIALOG_TEXT_SIZES.description} text-center text-amber-800 dark:text-amber-200 leading-snug font-medium`}>
                💡 <span className="font-semibold">Important:</span> Please select your country first in the payment form to properly fill out payment details.
              </p>
            </div>
          </div>
          )}

          {isNativeStoreBilling() && (
          <div className="mb-3 md:mb-4">
            <div className="p-2.5 md:p-3 bg-blue-50/90 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800/60 shadow-sm">
              <p className={`${PRICING_DIALOG_TEXT_SIZES.description} text-center text-blue-900 dark:text-blue-100 leading-snug`}>
                {SUBSCRIPTION_UI_TEXT.native.billingNotice}
              </p>
            </div>
          </div>
          )}

          {!isNativeStoreBilling() && supportsBillingChannelChoice() && (
          <div className="mb-3 md:mb-4">
            <div className="p-2.5 md:p-3 bg-slate-50/90 dark:bg-slate-900/30 rounded-lg border border-slate-200 dark:border-slate-700/60 shadow-sm">
              <p className={`${PRICING_DIALOG_TEXT_SIZES.description} text-center text-slate-800 dark:text-slate-100 leading-snug`}>
                {SUBSCRIPTION_UI_TEXT.native.webBillingNotice}
              </p>
            </div>
          </div>
          )}

          <div className={cn("grid gap-2.5 md:gap-3 max-w-full", "grid-cols-1 md:grid-cols-3")}>
            {/* Free Tier */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className={cn(
                "relative border-2 rounded-lg md:rounded-xl p-3 md:p-4 bg-white dark:bg-card hover:border-gray-300 dark:hover:border-border transition-all duration-300 shadow-md hover:shadow-lg flex flex-col",
                subscription.tier === "free"
                  ? `${UI_PRICING_DIALOG_COLORS.accentBorderClass} ring-2 ${UI_PRICING_DIALOG_COLORS.accentRingClass} ${UI_PRICING_DIALOG_COLORS.accentDarkBorderClass} ${UI_PRICING_DIALOG_COLORS.accentDarkRingClass}`
                  : "border-gray-200 dark:border-border"
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-foreground mb-0.5">{SUBSCRIPTION_UI_TEXT.free.title}</h3>
                  <p className={`${PRICING_DIALOG_TEXT_SIZES.description} text-muted-foreground`}>{SUBSCRIPTION_UI_TEXT.free.subtitle}</p>
                </div>
                {subscription.tier === "free" && (
                  <Badge className={`${UI_PRICING_DIALOG_COLORS.accentClass} ${UI_PRICING_DIALOG_COLORS.accentTextClass} ${UI_PRICING_DIALOG_COLORS.accentBorderClass} ${PRICING_DIALOG_TEXT_SIZES.badge} px-1.5 py-0.5 shadow-sm flex-shrink-0 ml-1.5`}>
                    {SUBSCRIPTION_UI_TEXT.free.button.current}
                  </Badge>
                )}
              </div>

              <div className="mb-2.5">
                <div className="flex items-baseline gap-1 mb-0.5">
                  <span className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-foreground">{SUBSCRIPTION_UI_TEXT.free.price}</span>
                  <span className={`${PRICING_DIALOG_TEXT_SIZES.helper} text-muted-foreground`}>{SUBSCRIPTION_UI_TEXT.free.priceUnit}</span>
                </div>
                <p className={`${PRICING_DIALOG_TEXT_SIZES.helper} text-muted-foreground`}>{SUBSCRIPTION_UI_TEXT.free.description}</p>
              </div>

              <ul className="space-y-1.5 mb-2.5 flex-1 min-h-0 overflow-y-auto">
                {freeTierFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-1.5 group">
                    <div className={`flex-shrink-0 w-3.5 h-3.5 rounded-full ${UI_PRICING_DIALOG_COLORS.accentClass} ${UI_PRICING_DIALOG_COLORS.accentDarkClass} flex items-center justify-center mt-0.5`}>
                      <Icon name={feature.icon} size={8} className="w-2 h-2 text-gray-800 dark:text-foreground" />
                    </div>
                    <span className={`${PRICING_DIALOG_TEXT_SIZES.description} text-gray-700 dark:text-foreground leading-snug`}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                variant="outline"
                className={cn(
                  `w-full border-2 ${PRICING_DIALOG_TEXT_SIZES.description} py-1.5 font-medium transition-all duration-200`,
                  subscription.tier === "free"
                    ? `${UI_PRICING_DIALOG_COLORS.accentBorderClass} ${UI_PRICING_DIALOG_COLORS.accentBgClass} text-gray-700 dark:text-foreground cursor-default`
                    : "border-gray-300 dark:border-border text-gray-700 dark:text-foreground hover:bg-gray-50 dark:hover:bg-card"
                )}
                disabled={subscription.tier === "free" || isDowngrading}
                onClick={subscription.tier === "pro" ? handleDowngrade : undefined}
              >
                {isDowngrading ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <div className="w-3 h-3 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                    <span className={PRICING_DIALOG_TEXT_SIZES.small}>{SUBSCRIPTION_UI_TEXT.pro.button.downgrading}</span>
                  </span>
                ) : subscription.tier === "free" ? (
                  SUBSCRIPTION_UI_TEXT.free.button.current
                ) : (
                  SUBSCRIPTION_UI_TEXT.free.button.downgrade
                )}
              </Button>
            </motion.div>

            {/* Monthly Pro Tier */}
            {monthlyOffering ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className={cn(
                  `relative border-2 rounded-lg md:rounded-xl p-3 md:p-4 ${UI_PRICING_DIALOG_COLORS.cardGradient.light.className} ${UI_PRICING_DIALOG_COLORS.cardGradient.dark.className} overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 flex flex-col`,
                  subscription.tier === "pro" && subscription.billingPeriod === "monthly"
                    ? `${UI_PRICING_DIALOG_COLORS.cardBorder.primary} ring-2 ${UI_PRICING_DIALOG_COLORS.cardBorder.primaryRing}`
                    : UI_PRICING_DIALOG_COLORS.cardBorder.primary
                )}
              >
                <div className={`absolute top-0 right-0 w-20 h-20 ${UI_PRICING_DIALOG_COLORS.decorativeBlur.light.className} rounded-bl-full blur-xl pointer-events-none`} />
                
                {subscription.tier === "pro" && subscription.billingPeriod === "monthly" && (
                  <div className="absolute top-1.5 right-1.5 z-20 pointer-events-none">
                    <Badge className={`${UI_PRICING_DIALOG_COLORS.primaryClass} border-0 shadow-md px-1.5 py-0.5 ${PRICING_DIALOG_TEXT_SIZES.badge} font-medium`} style={{ color: COLOR_TEXT_WHITE }}>
                      {SUBSCRIPTION_UI_TEXT.pro.button.current}
                    </Badge>
                  </div>
                )}
                
                <div className="relative z-10 flex flex-col flex-1 min-h-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="flex items-center gap-1 mb-0.5">
                        <h3 className={`text-base md:text-lg font-semibold ${UI_PRICING_GRADIENT_COLORS.text.className}`}>
                          {monthlyOffering.title}
                        </h3>
                        <Icon name="sparkles" size={ICON_SIZE_XS} weight="duotone" className={`${UI_PRICING_DIALOG_COLORS.primaryTextClass} animate-pulse flex-shrink-0`} />
                      </div>
                      <p className={`${PRICING_DIALOG_TEXT_SIZES.helper} text-muted-foreground line-clamp-1`}>
                        {formatDescription(monthlyOffering.description)}
                      </p>
                    </div>
                  </div>

                  <div className="mb-2.5">
                    <div className="flex items-baseline gap-1 mb-0.5">
                      <span className={`text-xl md:text-2xl font-semibold ${UI_PRICING_GRADIENT_COLORS.text.className}`}>
                        {formatPrice(monthlyOffering.priceString)}
                      </span>
                      <span className={`${PRICING_DIALOG_TEXT_SIZES.helper} text-muted-foreground`}>{SUBSCRIPTION_UI_TEXT.planCards.priceUnits.month}</span>
                    </div>
                  </div>

                <ul className="space-y-1 mb-2.5 flex-1 min-h-0 overflow-y-auto">
                  {monthlyProFeatures.filter(f => !f.isHeader).map((feature, index) => (
                    <li key={index} className="flex items-start gap-1.5">
                      <div className={cn(
                        "flex-shrink-0 w-3 h-3 rounded-full flex items-center justify-center mt-0.5",
                        feature.highlight
                          ? UI_PRICING_GRADIENT_COLORS.primaryBr.className
                          : `${UI_PRICING_DIALOG_COLORS.accentClass} ${UI_PRICING_DIALOG_COLORS.accentDarkClass}`
                      )}>
                        <Icon 
                          name={feature.icon} 
                          size={6} 
                          className={cn(
                            "w-1.5 h-1.5",
                            feature.highlight ? "" : "text-gray-800 dark:text-foreground"
                          )} 
                        />
                      </div>
                      <span className={`${PRICING_DIALOG_TEXT_SIZES.description} text-gray-700 dark:text-foreground leading-snug`}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={cn(
                    `w-full shadow-md hover:shadow-lg transition-all duration-300 ${PRICING_DIALOG_TEXT_SIZES.description} font-medium py-1.5 relative z-20`,
                    subscription.tier === "pro" && subscription.billingPeriod === "monthly"
                      ? `${UI_PRICING_DIALOG_COLORS.primaryClass} ${UI_PRICING_DIALOG_COLORS.primaryHoverClass} cursor-default`
                      : `${UI_PRICING_DIALOG_COLORS.buttonGradient.className} ${UI_PRICING_DIALOG_COLORS.buttonGradient.hover.className}`
                  )}
                  style={{ color: COLOR_TEXT_WHITE }}
                  disabled={(subscription.tier === "pro" && subscription.billingPeriod === "monthly") || isUpgrading}
                  onClick={handleUpgradeMonthly}
                >
                  {isUpgrading ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <div className="w-2.5 h-2.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: COLOR_TEXT_WHITE }} />
                      <span className={PRICING_DIALOG_TEXT_SIZES.small}>{SUBSCRIPTION_UI_TEXT.planCards.monthly.button.processing}</span>
                    </span>
                  ) : subscription.tier === "pro" && subscription.billingPeriod === "monthly" ? (
                    SUBSCRIPTION_UI_TEXT.pro.button.current
                  ) : subscription.tier === "pro" ? (
                    SUBSCRIPTION_UI_TEXT.planCards.monthly.button.switch
                  ) : (
                    <span className="flex items-center justify-center gap-1.5">
                      <Icon name="sparkles" size={ICON_SIZE_XS} weight="duotone" />
                      <span>{SUBSCRIPTION_UI_TEXT.planCards.monthly.button.upgrade}</span>
                    </span>
                  )}
                </Button>
              </div>
            </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="relative border-2 border-gray-300 dark:border-border rounded-lg md:rounded-xl p-3 md:p-4 bg-gray-50 dark:bg-card overflow-hidden flex flex-col opacity-50"
              >
                <div className="relative z-10 flex flex-col flex-1 items-center justify-center py-4">
                  <p className={`${PRICING_DIALOG_TEXT_SIZES.description} text-muted-foreground text-center`}>
                    {isLoadingOfferings ? SUBSCRIPTION_UI_TEXT.planCards.loading : SUBSCRIPTION_UI_TEXT.planCards.monthly.notAvailable}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Yearly Pro Tier */}
            {yearlyOffering ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className={cn(
                  `relative border-2 rounded-lg md:rounded-xl p-3 md:p-4 ${UI_PRICING_DIALOG_COLORS.cardGradient.medium.className} ${UI_PRICING_DIALOG_COLORS.cardGradient.mediumDark.className} overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 flex flex-col`,
                  subscription.tier === "pro" && subscription.billingPeriod === "yearly"
                    ? `${UI_PRICING_DIALOG_COLORS.cardBorder.primary} ring-2 ${UI_PRICING_DIALOG_COLORS.cardBorder.primaryRing}`
                    : UI_PRICING_DIALOG_COLORS.cardBorder.primary
                )}
              >
                <div className={`absolute top-0 right-0 w-20 h-20 ${UI_PRICING_DIALOG_COLORS.decorativeBlur.medium.className} rounded-bl-full blur-xl pointer-events-none`} />
              
              <div className="absolute top-1.5 right-1.5 z-20 flex flex-col gap-0.5 pointer-events-none">
                {subscription.tier === "pro" && subscription.billingPeriod === "yearly" && (
                  <Badge className={`${UI_PRICING_DIALOG_COLORS.primaryClass} border-0 shadow-md px-1.5 py-0.5 ${PRICING_DIALOG_TEXT_SIZES.badge} font-medium mb-0.5`} style={{ color: COLOR_TEXT_WHITE }}>
                    {SUBSCRIPTION_UI_TEXT.pro.button.current}
                  </Badge>
                )}
                <Badge className={`${UI_PRICING_DIALOG_COLORS.buttonGradient.className} border-0 shadow-md px-1.5 py-0.5 ${PRICING_DIALOG_TEXT_SIZES.badge} font-medium`} style={{ color: COLOR_TEXT_WHITE }}>
                  <Icon name="crown" size={ICON_SIZE_XS} className="mr-0.5" style={{ color: COLOR_TEXT_WHITE }} />
                  {SUBSCRIPTION_UI_TEXT.planCards.yearly.badge}
                </Badge>
              </div>

              <div className="relative z-10 flex flex-col flex-1 min-h-0">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center gap-1 mb-0.5">
                      <h3 className="text-base md:text-lg font-semibold bg-gradient-to-r" style={{ backgroundImage: `linear-gradient(to right, ${COLOR_PRIMARY}, ${COLOR_PRIMARY_LIGHT})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                        {yearlyOffering.title}
                      </h3>
                      <Icon name="sparkles" size={ICON_SIZE_XS} weight="duotone" className={`${UI_PRICING_DIALOG_COLORS.primaryTextClass} animate-pulse flex-shrink-0`} />
                    </div>
                    <p className="text-[10px] md:text-xs text-muted-foreground line-clamp-1">
                      {formatDescription(yearlyOffering.description)}
                    </p>
                  </div>
                </div>

                <div className="mb-2.5">
                  <div className="flex items-baseline gap-1 mb-0.5">
                    <span className={`text-xl md:text-2xl font-semibold ${UI_PRICING_GRADIENT_COLORS.text.className}`}>
                      {formatPrice(yearlyOffering.priceString)}
                    </span>
                    <span className={`${PRICING_DIALOG_TEXT_SIZES.helper} text-muted-foreground`}>{SUBSCRIPTION_UI_TEXT.planCards.priceUnits.year}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {savings.percent > 0 && (
                      <Badge className={`${UI_PRICING_DIALOG_COLORS.badgeGradient.className} text-gray-800 ${PRICING_DIALOG_TEXT_SIZES.badge} font-medium px-1 py-0.5`}>
                        {isLoadingOfferings ? 'Loading…' : SUBSCRIPTION_UI_TEXT.planCards.yearly.savingsLabel(savings.percent, savings.amount)}
                      </Badge>
                    )}
                    <p className={`${PRICING_DIALOG_TEXT_SIZES.helper} font-medium ${UI_PRICING_DIALOG_COLORS.primaryTextClass}`}>
                      {isLoadingOfferings
                        ? 'Loading…'
                        : SUBSCRIPTION_UI_TEXT.planCards.yearly.perMonthLabel(getYearlyPerMonthPrice())}
                    </p>
                  </div>
                </div>

                <div className="mb-2">
                  <p className={`${PRICING_DIALOG_TEXT_SIZES.helper} text-muted-foreground italic text-center`}>
                    Includes all features from Free and Monthly plans
                  </p>
                </div>

                <ul className="space-y-1 mb-2.5 flex-1 min-h-0 overflow-y-auto">
                  {/* Show only Yearly-exclusive features (monthly features are shown in monthly column) */}
                  {yearlyProFeatures.filter(f => !f.isHeader).map((feature, index) => (
                    <li key={`yearly-${index}`} className="flex items-start gap-1.5">
                      <div className={cn(
                        "flex-shrink-0 w-3 h-3 rounded-full flex items-center justify-center mt-0.5"
                      )} style={{ backgroundImage: `linear-gradient(to bottom right, ${COLOR_PRIMARY}, ${COLOR_PRIMARY_LIGHT})` }}>
                        <Icon name={feature.icon} size={6} className="w-1.5 h-1.5" style={{ color: COLOR_TEXT_WHITE }} />
                      </div>
                      <span className={`${PRICING_DIALOG_TEXT_SIZES.description} text-gray-700 dark:text-foreground font-medium leading-snug`}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={cn(
                    `w-full shadow-md hover:shadow-lg transition-all duration-300 ${PRICING_DIALOG_TEXT_SIZES.description} font-medium py-1.5 relative z-20`,
                    subscription.tier === "pro" && subscription.billingPeriod === "yearly"
                      ? `${UI_PRICING_DIALOG_COLORS.primaryClass} ${UI_PRICING_DIALOG_COLORS.primaryHoverClass} cursor-default`
                      : `${UI_PRICING_DIALOG_COLORS.buttonGradient.className} ${UI_PRICING_DIALOG_COLORS.buttonGradient.hover.className}`
                  )}
                  style={{ color: COLOR_TEXT_WHITE }}
                  disabled={(subscription.tier === "pro" && subscription.billingPeriod === "yearly") || isUpgrading}
                  onClick={handleUpgradeYearly}
                >
                  {isUpgrading ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <div className="w-2.5 h-2.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: COLOR_TEXT_WHITE }} />
                      <span className={PRICING_DIALOG_TEXT_SIZES.small}>{SUBSCRIPTION_UI_TEXT.planCards.yearly.button.processing}</span>
                    </span>
                  ) : subscription.tier === "pro" && subscription.billingPeriod === "yearly" ? (
                    SUBSCRIPTION_UI_TEXT.pro.button.current
                  ) : subscription.tier === "pro" ? (
                    SUBSCRIPTION_UI_TEXT.planCards.yearly.button.switch
                  ) : (
                    <span className="flex items-center justify-center gap-1.5">
                      <Icon name="sparkles" size={ICON_SIZE_XS} weight="duotone" />
                      <span>{SUBSCRIPTION_UI_TEXT.planCards.yearly.button.upgrade}</span>
                    </span>
                  )}
                </Button>
              </div>
            </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="relative border-2 border-gray-300 dark:border-border rounded-lg md:rounded-xl p-3 md:p-4 bg-gray-50 dark:bg-card overflow-hidden flex flex-col opacity-50"
              >
                <div className="relative z-10 flex flex-col flex-1 items-center justify-center py-4">
                  <p className={`${PRICING_DIALOG_TEXT_SIZES.description} text-muted-foreground text-center`}>
                    {isLoadingOfferings ? SUBSCRIPTION_UI_TEXT.planCards.loading : SUBSCRIPTION_UI_TEXT.planCards.yearly.notAvailable}
                  </p>
                </div>
              </motion.div>
            )}
          </div>

          <div className="mt-2 md:mt-3 space-y-2">
            {(user?.id) && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  disabled={isRestoring}
                  onClick={handleRestore}
                >
                  {isRestoring ? SUBSCRIPTION_UI_TEXT.messages.restoringPurchases : SUBSCRIPTION_UI_TEXT.native.restorePurchases}
                </Button>
              </div>
            )}

            <div className="p-2 md:p-2.5 rounded-lg border shadow-md backdrop-blur-sm dark:from-[#4A4A5E]/60 dark:via-[#3E3E52]/60 dark:to-[#3E3E52]/60" style={{ backgroundImage: `linear-gradient(to right, ${COLOR_PASTEL_LAVENDER}66, ${COLOR_PASTEL_SKY}66, ${COLOR_PASTEL_MINT}66)`, borderColor: `${COLOR_PRIMARY}4D` }}>
              <p className={`${PRICING_DIALOG_TEXT_SIZES.description} text-center text-gray-700 dark:text-foreground leading-snug`}>
                {SUBSCRIPTION_UI_TEXT.footer.message}{' '}
                <span className="font-medium" style={{ color: COLOR_PRIMARY }}>{SUBSCRIPTION_UI_TEXT.footer.upgradeText}</span>{' '}
                {SUBSCRIPTION_UI_TEXT.footer.upgradeDescription}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
