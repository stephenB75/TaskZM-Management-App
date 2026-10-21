import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
// Icons migrated to Icon component
import { Icon } from "./Icon";
import { ICON_SIZE_SM, ICON_SIZE_MD, ICON_SIZE_XS } from "../lib/layout-constants";
import { useSubscription } from "../contexts/SubscriptionContext";
import { useAuth } from "../contexts/AuthContext";
import { toast } from '../lib/toast-wrapper';
import { motion } from "motion/react";
import { getPlatform } from "../lib/platform";
import { cn } from "../lib/utils";
import { TIMING_CONSTANTS } from "../lib/timing-constants";
import { PRICING_DIALOG_TEXT_SIZES } from "../lib/text-size-constants";
import {
  SUBSCRIPTION_UI_TEXT,
  FREE_TIER_FEATURES,
  PRO_MONTHLY_FEATURES,
  PRO_YEARLY_FEATURES,
  PRO_MONTHLY_FEATURES_LIST,
  PRO_YEARLY_FEATURES_LIST,
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


  const isFreePlan = subscription.tier === "free";
  const isMonthlyPlan = subscription.tier === "pro" && subscription.billingPeriod === "monthly";
  const isYearlyPlan = subscription.tier === "pro" && subscription.billingPeriod === "yearly";
  const textSizes = PRICING_DIALOG_TEXT_SIZES;
  const secondsToMs = TIMING_CONSTANTS.timeConversions.secondsToMs;

  const billingNote = isNativeStoreBilling()
    ? SUBSCRIPTION_UI_TEXT.native.billingNotice
    : supportsBillingChannelChoice()
      ? `${SUBSCRIPTION_UI_TEXT.native.webBillingNotice} ${SUBSCRIPTION_UI_TEXT.native.countryHint}`
      : SUBSCRIPTION_UI_TEXT.native.countryHint;

  const primaryButtonClass = "bg-foreground text-background hover:opacity-90 [&_svg]:text-background";
  const secondaryButtonClass = "border border-border bg-background text-foreground hover:bg-muted disabled:opacity-60";
  const ctaClass = `mt-5 h-11 w-full rounded-full ${textSizes.body} font-semibold`;

  const cardMotion = (order: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: TIMING_CONSTANTS.animations.medium / secondsToMs,
      delay: (order * TIMING_CONSTANTS.animations.default) / (2 * secondsToMs),
    },
  });

  const cardClass = (isCurrent: boolean, isFeatured = false) =>
    cn(
      "relative flex flex-col rounded-2xl bg-card p-5 md:p-6",
      isFeatured ? "border-2 border-foreground shadow-lg" : "border border-border",
      isCurrent && !isFeatured && "border-2 border-muted-foreground"
    );

  const renderPill = (label: React.ReactNode, tone: "solid" | "muted") => (
    <span
      className={cn(
        `inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 ${textSizes.pill} font-medium whitespace-nowrap`,
        tone === "solid" ? "bg-foreground text-background [&_svg]:text-background" : "border border-border bg-muted text-foreground"
      )}
    >
      {label}
    </span>
  );

  const renderFeatures = (features: typeof FREE_TIER_FEATURES) => {
    const header = features.find((f) => f.isHeader);
    return (
      <div className="mt-6 border-t border-border pt-5">
        <p className={`${textSizes.detail} mb-4 font-semibold uppercase tracking-wide text-muted-foreground`}>
          {header ? `${header.text}:` : SUBSCRIPTION_UI_TEXT.planCards.includedLabel}
        </p>
        <ul className="space-y-3.5">
          {features
            .filter((f) => !f.isHeader)
            .map((feature) => (
              <li key={feature.text} className="flex items-start gap-3">
                <Icon name="check" size={ICON_SIZE_MD} weight="bold" className="mt-0.5 flex-shrink-0 text-foreground" />
                <div className="min-w-0">
                  <p className={`${textSizes.body} font-medium leading-snug text-foreground`}>{feature.text}</p>
                  {feature.detail && (
                    <p className={`${textSizes.detail} mt-0.5 leading-snug text-muted-foreground`}>{feature.detail}</p>
                  )}
                </div>
              </li>
            ))}
        </ul>
      </div>
    );
  };

  const renderPrice = (price: string, unit: string, helper: React.ReactNode) => (
    <div className="mt-5">
      <div className="flex items-baseline gap-1">
        <span className={`${textSizes.price} font-bold tracking-tight text-foreground`}>{price}</span>
        <span className={`${textSizes.body} text-muted-foreground`}>{unit}</span>
      </div>
      <div className={`${textSizes.detail} mt-1.5 flex min-h-[1.25rem] flex-wrap items-center gap-2 text-muted-foreground`}>
        {helper}
      </div>
    </div>
  );

  const renderSpinnerLabel = (label: string) => (
    <span className="flex items-center justify-center gap-2">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      <span>{label}</span>
    </span>
  );

  const renderUnavailable = (label: string, order: number) => (
    <motion.div
      {...cardMotion(order)}
      className="flex min-h-[12rem] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted p-6"
    >
      <p className={`${textSizes.body} text-center text-muted-foreground`}>
        {isLoadingOfferings ? SUBSCRIPTION_UI_TEXT.planCards.loading : label}
      </p>
    </motion.div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[95vw] overflow-y-auto rounded-3xl border-0 bg-background p-0 shadow-none sm:max-w-[90vw] sm:p-0 lg:max-w-[1040px]">
        <div className="p-5 sm:p-8">
          <DialogHeader className="mb-6 text-center sm:text-center">
            <DialogTitle className={`${textSizes.title} font-bold tracking-tight text-foreground`}>
              {SUBSCRIPTION_UI_TEXT.title}
            </DialogTitle>
            <DialogDescription className={`${textSizes.subtitle} mt-2 text-muted-foreground`}>
              {SUBSCRIPTION_UI_TEXT.description}
            </DialogDescription>
          </DialogHeader>

          {supportsBillingChannelChoice() && (
            <div className="mb-5 flex flex-col items-center gap-2">
              <p className={`${textSizes.detail} font-medium text-muted-foreground`}>
                {SUBSCRIPTION_UI_TEXT.native.billingMethodTitle}
              </p>
              <div className="grid w-full max-w-md grid-cols-2 gap-1 rounded-2xl bg-muted p-1 sm:rounded-full">
                {([
                  ['native-store', SUBSCRIPTION_UI_TEXT.native.billingMethodNative],
                  ['web', SUBSCRIPTION_UI_TEXT.native.billingMethodWeb],
                ] as const).map(([channel, label]) => (
                  <button
                    key={channel}
                    type="button"
                    aria-pressed={billingChannel === channel}
                    onClick={() => setBillingChannel(channel)}
                    className={cn(
                      `rounded-xl px-3 py-2 ${textSizes.body} font-medium leading-tight transition-colors sm:rounded-full`,
                      billingChannel === channel
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {offeringsError && (
            <div className={`mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 ${textSizes.body} text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300`}>
              {offeringsError}
            </div>
          )}

          <div className={`mb-6 flex items-start gap-3 rounded-xl bg-muted px-4 py-3 ${textSizes.body} leading-relaxed text-muted-foreground`}>
            <Icon name="info" size={ICON_SIZE_MD} className="mt-0.5 flex-shrink-0 text-foreground" />
            <p>{billingNote}</p>
          </div>

          <div className="grid grid-cols-1 gap-6 pt-3 lg:grid-cols-3 lg:gap-5">
            {/* Free */}
            <motion.div {...cardMotion(0)} className={cardClass(isFreePlan)}>
              <div className="flex min-h-[1.75rem] flex-wrap items-center gap-2">
                <h3 className={`${textSizes.planName} font-semibold text-foreground`}>{SUBSCRIPTION_UI_TEXT.free.title}</h3>
                {isFreePlan && renderPill(SUBSCRIPTION_UI_TEXT.free.button.current, "muted")}
              </div>
              <p className={`${textSizes.body} mt-1 text-muted-foreground`}>{SUBSCRIPTION_UI_TEXT.free.subtitle}</p>
              {renderPrice(SUBSCRIPTION_UI_TEXT.free.price, SUBSCRIPTION_UI_TEXT.free.priceUnit, SUBSCRIPTION_UI_TEXT.free.description)}
              <Button
                variant="outline"
                className={cn(ctaClass, secondaryButtonClass)}
                disabled={isFreePlan || isDowngrading}
                onClick={subscription.tier === "pro" ? handleDowngrade : undefined}
              >
                {isDowngrading
                  ? renderSpinnerLabel(SUBSCRIPTION_UI_TEXT.pro.button.downgrading)
                  : isFreePlan
                    ? SUBSCRIPTION_UI_TEXT.free.button.current
                    : SUBSCRIPTION_UI_TEXT.free.button.downgrade}
              </Button>
              {renderFeatures(FREE_TIER_FEATURES)}
            </motion.div>

            {/* Pro Monthly */}
            {monthlyOffering ? (
              <motion.div {...cardMotion(1)} className={cardClass(isMonthlyPlan)}>
                <div className="flex min-h-[1.75rem] flex-wrap items-center gap-2">
                  <h3 className={`${textSizes.planName} font-semibold text-foreground`}>{monthlyOffering.title}</h3>
                  {isMonthlyPlan && renderPill(SUBSCRIPTION_UI_TEXT.pro.button.current, "muted")}
                </div>
                <p className={`${textSizes.body} mt-1 line-clamp-1 text-muted-foreground`}>
                  {formatDescription(monthlyOffering.description)}
                </p>
                {renderPrice(
                  formatPrice(monthlyOffering.priceString),
                  SUBSCRIPTION_UI_TEXT.planCards.priceUnits.month,
                  SUBSCRIPTION_UI_TEXT.planCards.monthly.billingPeriod
                )}
                <Button
                  variant={isMonthlyPlan ? "outline" : "default"}
                  className={cn(ctaClass, isMonthlyPlan ? secondaryButtonClass : primaryButtonClass)}
                  disabled={isMonthlyPlan || isUpgrading}
                  onClick={handleUpgradeMonthly}
                >
                  {isUpgrading
                    ? renderSpinnerLabel(SUBSCRIPTION_UI_TEXT.planCards.monthly.button.processing)
                    : isMonthlyPlan
                      ? SUBSCRIPTION_UI_TEXT.pro.button.current
                      : subscription.tier === "pro"
                        ? SUBSCRIPTION_UI_TEXT.planCards.monthly.button.switch
                        : SUBSCRIPTION_UI_TEXT.planCards.monthly.button.upgrade}
                </Button>
                {renderFeatures(PRO_MONTHLY_FEATURES)}
              </motion.div>
            ) : (
              renderUnavailable(SUBSCRIPTION_UI_TEXT.planCards.monthly.notAvailable, 1)
            )}

            {/* Pro Yearly */}
            {yearlyOffering ? (
              <motion.div {...cardMotion(2)} className={cardClass(isYearlyPlan, true)}>
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  {renderPill(
                    <>
                      <Icon name="crown" size={ICON_SIZE_XS} />
                      {SUBSCRIPTION_UI_TEXT.planCards.yearly.badge}
                    </>,
                    "solid"
                  )}
                </div>
                <div className="flex min-h-[1.75rem] flex-wrap items-center gap-2">
                  <h3 className={`${textSizes.planName} font-semibold text-foreground`}>{yearlyOffering.title}</h3>
                  {isYearlyPlan && renderPill(SUBSCRIPTION_UI_TEXT.pro.button.current, "muted")}
                </div>
                <p className={`${textSizes.body} mt-1 line-clamp-1 text-muted-foreground`}>
                  {formatDescription(yearlyOffering.description)}
                </p>
                {renderPrice(
                  formatPrice(yearlyOffering.priceString),
                  SUBSCRIPTION_UI_TEXT.planCards.priceUnits.year,
                  isLoadingOfferings ? (
                    SUBSCRIPTION_UI_TEXT.planCards.loading
                  ) : (
                    <>
                      <span className="font-medium text-foreground">
                        {SUBSCRIPTION_UI_TEXT.planCards.yearly.perMonthLabel(getYearlyPerMonthPrice())}
                      </span>
                      {savings.percent > 0 &&
                        renderPill(SUBSCRIPTION_UI_TEXT.planCards.yearly.savingsLabel(savings.percent, savings.amount), "muted")}
                    </>
                  )
                )}
                <Button
                  variant={isYearlyPlan ? "outline" : "default"}
                  className={cn(ctaClass, isYearlyPlan ? secondaryButtonClass : primaryButtonClass)}
                  disabled={isYearlyPlan || isUpgrading}
                  onClick={handleUpgradeYearly}
                >
                  {isUpgrading
                    ? renderSpinnerLabel(SUBSCRIPTION_UI_TEXT.planCards.yearly.button.processing)
                    : isYearlyPlan
                      ? SUBSCRIPTION_UI_TEXT.pro.button.current
                      : subscription.tier === "pro"
                        ? SUBSCRIPTION_UI_TEXT.planCards.yearly.button.switch
                        : (
                          <span className="flex items-center justify-center gap-2">
                            <Icon name="sparkles" size={ICON_SIZE_SM} weight="duotone" />
                            <span>{SUBSCRIPTION_UI_TEXT.planCards.yearly.button.upgrade}</span>
                          </span>
                        )}
                </Button>
                {renderFeatures(PRO_YEARLY_FEATURES)}
              </motion.div>
            ) : (
              renderUnavailable(SUBSCRIPTION_UI_TEXT.planCards.yearly.notAvailable, 2)
            )}
          </div>

          <div className="mt-6 flex flex-col items-center gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between">
            <p className={`${textSizes.body} text-center leading-relaxed text-muted-foreground sm:text-left`}>
              {SUBSCRIPTION_UI_TEXT.footer.message}{' '}
              <span className="font-medium text-foreground">{SUBSCRIPTION_UI_TEXT.footer.upgradeText}</span>{' '}
              {SUBSCRIPTION_UI_TEXT.footer.upgradeDescription}
            </p>
            {user?.id && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`flex-shrink-0 rounded-full px-4 ${textSizes.body}`}
                disabled={isRestoring}
                onClick={handleRestore}
              >
                {isRestoring ? SUBSCRIPTION_UI_TEXT.messages.restoringPurchases : SUBSCRIPTION_UI_TEXT.native.restorePurchases}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
