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
import { getPlatform } from "../lib/platform";
import { cn } from "../lib/utils";
import { TIMING_CONSTANTS } from "../lib/timing-constants";
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
import { getOfferings, restorePurchases, configureRevenueCat, purchaseProSubscription, isRevenueCatConfigured } from "../lib/revenuecat";
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
      // Pre-configure RevenueCat when dialog opens to avoid delays during purchase
      configureRevenueCat(user.id).catch((error) => {
        logger.debug('RevenueCat pre-configuration failed (non-blocking):', error);
      });
    }
  }, [open, user?.id, loadOfferings]);

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
      console.log('✅ Yearly offering from RevenueCat:', {
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
      console.log('💰 Yearly subscription from RevenueCat (UI):', {
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
        console.warn('⚠️ Yearly subscription price may be incorrect:', {
          priceString: yearlyOffering.priceString,
          numericValue: yearlyPriceNum,
          note: 'Price seems unusually low. Verify RevenueCat configuration.',
        });
      }
    }
    
    if (monthlyOffering) {
      console.log('💰 Monthly subscription from RevenueCat (UI):', {
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
      console.warn('⚠️ Invalid price string detected:', price);
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
        console.warn('⚠️ Cannot calculate savings: invalid prices', {
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
        duration: 2000,
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
        duration: 2000,
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
        duration: 2000,
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
        duration: 2000,
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
      <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-[850px] max-h-[95vh] overflow-y-auto p-0 md:p-0">
        <div className="p-3 md:p-4">
          <div className="mb-3 md:mb-4">
            <DialogHeader className="text-center">
              <DialogTitle className="text-lg md:text-xl font-bold bg-gradient-to-r from-[#9B87E8] via-[#C9E4F7] to-[#B8E6D5] bg-clip-text text-transparent mb-1">
                {SUBSCRIPTION_UI_TEXT.title}
              </DialogTitle>
              <DialogDescription className="text-[11px] md:text-xs mt-1 text-muted-foreground">
                {SUBSCRIPTION_UI_TEXT.description}
              </DialogDescription>
            </DialogHeader>
          </div>

          {offeringsError && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] md:text-xs text-red-700">
              {offeringsError}
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
                  ? "border-[#B8E6D5] ring-2 ring-[#B8E6D5]/50 dark:border-[#5A8A7A] dark:ring-[#5A8A7A]/50"
                  : "border-gray-200 dark:border-border"
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-foreground mb-0.5">{SUBSCRIPTION_UI_TEXT.free.title}</h3>
                  <p className="text-[11px] md:text-xs text-muted-foreground">{SUBSCRIPTION_UI_TEXT.free.subtitle}</p>
                </div>
                {subscription.tier === "free" && (
                  <Badge className="bg-[#B8E6D5] text-gray-800 border-[#B8E6D5] text-[9px] md:text-[10px] px-1.5 py-0.5 shadow-sm flex-shrink-0 ml-1.5">
                    {SUBSCRIPTION_UI_TEXT.free.button.current}
                  </Badge>
                )}
              </div>

              <div className="mb-2.5">
                <div className="flex items-baseline gap-1 mb-0.5">
                  <span className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-foreground">{SUBSCRIPTION_UI_TEXT.free.price}</span>
                  <span className="text-[10px] md:text-xs text-muted-foreground">{SUBSCRIPTION_UI_TEXT.free.priceUnit}</span>
                </div>
                <p className="text-[10px] md:text-xs text-muted-foreground">{SUBSCRIPTION_UI_TEXT.free.description}</p>
              </div>

              <ul className="space-y-1.5 mb-2.5 flex-1 min-h-0 overflow-y-auto">
                {freeTierFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-1.5 group">
                    <div className="flex-shrink-0 w-3.5 h-3.5 rounded-full bg-[#B8E6D5] dark:bg-[#5A8A7A] flex items-center justify-center mt-0.5">
                      <feature.icon className="w-2 h-2 text-gray-800 dark:text-foreground" />
                    </div>
                    <span className="text-[11px] md:text-xs text-gray-700 dark:text-foreground leading-snug">
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                variant="outline"
                className={cn(
                  "w-full border-2 text-[11px] md:text-xs py-1.5 font-medium transition-all duration-200",
                  subscription.tier === "free"
                    ? "border-[#B8E6D5] bg-[#B8E6D5]/10 text-gray-700 dark:text-foreground cursor-default"
                    : "border-gray-300 dark:border-border text-gray-700 dark:text-foreground hover:bg-gray-50 dark:hover:bg-card"
                )}
                disabled={subscription.tier === "free" || isDowngrading}
                onClick={subscription.tier === "pro" ? handleDowngrade : undefined}
              >
                {isDowngrading ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <div className="w-3 h-3 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] md:text-[11px]">{SUBSCRIPTION_UI_TEXT.pro.button.downgrading}</span>
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
                  "relative border-2 rounded-lg md:rounded-xl p-3 md:p-4 bg-gradient-to-br from-[#9B87E8]/10 via-[#C9E4F7]/10 to-[#B8E6D5]/10 dark:from-[#9B87E8]/20 dark:via-[#6A8AAA]/10 dark:to-[#5A8A7A]/10 overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 flex flex-col",
                  subscription.tier === "pro" && subscription.billingPeriod === "monthly"
                    ? "border-[#9B87E8] ring-2 ring-[#9B87E8]/50"
                    : "border-[#9B87E8]"
                )}
              >
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-[#9B87E8]/20 to-[#C9E4F7]/20 rounded-bl-full blur-xl pointer-events-none" />
                
                {subscription.tier === "pro" && subscription.billingPeriod === "monthly" && (
                  <div className="absolute top-1.5 right-1.5 z-20 pointer-events-none">
                    <Badge className="bg-[#9B87E8] text-white border-0 shadow-md px-1.5 py-0.5 text-[9px] md:text-[10px] font-medium">
                      {SUBSCRIPTION_UI_TEXT.pro.button.current}
                    </Badge>
                  </div>
                )}
                
                <div className="relative z-10 flex flex-col flex-1 min-h-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="flex items-center gap-1 mb-0.5">
                        <h3 className="text-base md:text-lg font-semibold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">
                          {monthlyOffering.title}
                        </h3>
                        <Sparkles className="w-2.5 h-2.5 md:w-3 md:h-3 text-[#9B87E8] animate-pulse flex-shrink-0" />
                      </div>
                      <p className="text-[10px] md:text-xs text-muted-foreground line-clamp-1">
                        {formatDescription(monthlyOffering.description)}
                      </p>
                    </div>
                  </div>

                  <div className="mb-2.5">
                    <div className="flex items-baseline gap-1 mb-0.5">
                      <span className="text-xl md:text-2xl font-semibold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">
                        {formatPrice(monthlyOffering.priceString)}
                      </span>
                      <span className="text-[10px] md:text-xs text-muted-foreground">{SUBSCRIPTION_UI_TEXT.planCards.priceUnits.month}</span>
                    </div>
                  </div>

                <ul className="space-y-1 mb-2.5 flex-1 min-h-0 overflow-y-auto">
                  {monthlyProFeatures.filter(f => !f.isHeader).map((feature, index) => (
                    <li key={index} className="flex items-start gap-1.5">
                      <div className={cn(
                        "flex-shrink-0 w-3 h-3 rounded-full flex items-center justify-center mt-0.5",
                        feature.highlight
                          ? "bg-gradient-to-br from-[#9B87E8] to-[#D4C5F9]"
                          : "bg-[#B8E6D5] dark:bg-[#5A8A7A]"
                      )}>
                        <feature.icon className={cn(
                          "w-1.5 h-1.5",
                          feature.highlight ? "text-white" : "text-gray-800 dark:text-foreground"
                        )} />
                      </div>
                      <span className="text-[11px] md:text-xs text-gray-700 dark:text-foreground leading-snug">
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={cn(
                    "w-full shadow-md hover:shadow-lg transition-all duration-300 text-[11px] md:text-xs font-medium py-1.5 relative z-20",
                    subscription.tier === "pro" && subscription.billingPeriod === "monthly"
                      ? "bg-[#9B87E8] text-white hover:bg-[#8B77D8] cursor-default"
                      : "bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] hover:from-[#8B77D8] hover:to-[#C4B5E9] text-white"
                  )}
                  disabled={(subscription.tier === "pro" && subscription.billingPeriod === "monthly") || isUpgrading}
                  onClick={handleUpgradeMonthly}
                >
                  {isUpgrading ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span className="text-[10px] md:text-[11px]">{SUBSCRIPTION_UI_TEXT.planCards.monthly.button.processing}</span>
                    </span>
                  ) : subscription.tier === "pro" && subscription.billingPeriod === "monthly" ? (
                    SUBSCRIPTION_UI_TEXT.pro.button.current
                  ) : subscription.tier === "pro" ? (
                    SUBSCRIPTION_UI_TEXT.planCards.monthly.button.switch
                  ) : (
                    <span className="flex items-center justify-center gap-1.5">
                      <Sparkles className="w-2.5 h-2.5" />
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
                  <p className="text-[11px] md:text-xs text-muted-foreground text-center">
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
                  "relative border-2 rounded-lg md:rounded-xl p-3 md:p-4 bg-gradient-to-br from-[#9B87E8]/15 via-[#C9E4F7]/15 to-[#B8E6D5]/15 dark:from-[#9B87E8]/25 dark:via-[#6A8AAA]/15 dark:to-[#5A8A7A]/15 overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 flex flex-col",
                  subscription.tier === "pro" && subscription.billingPeriod === "yearly"
                    ? "border-[#9B87E8] ring-2 ring-[#9B87E8]/50"
                    : "border-[#9B87E8]"
                )}
              >
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-[#9B87E8]/25 to-[#C9E4F7]/25 rounded-bl-full blur-xl pointer-events-none" />
              
              <div className="absolute top-1.5 right-1.5 z-20 flex flex-col gap-0.5 pointer-events-none">
                {subscription.tier === "pro" && subscription.billingPeriod === "yearly" && (
                  <Badge className="bg-[#9B87E8] text-white border-0 shadow-md px-1.5 py-0.5 text-[9px] md:text-[10px] font-medium mb-0.5">
                    {SUBSCRIPTION_UI_TEXT.pro.button.current}
                  </Badge>
                )}
                <Badge className="bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] text-white border-0 shadow-md px-1.5 py-0.5 text-[9px] md:text-[10px] font-medium">
                  <Crown className="w-1.5 h-1.5 md:w-2 md:h-2 mr-0.5" />
                  {SUBSCRIPTION_UI_TEXT.planCards.yearly.badge}
                </Badge>
              </div>

              <div className="relative z-10 flex flex-col flex-1 min-h-0">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center gap-1 mb-0.5">
                      <h3 className="text-base md:text-lg font-semibold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">
                        {yearlyOffering.title}
                      </h3>
                      <Sparkles className="w-2.5 h-2.5 md:w-3 md:h-3 text-[#9B87E8] animate-pulse flex-shrink-0" />
                    </div>
                    <p className="text-[10px] md:text-xs text-muted-foreground line-clamp-1">
                      {formatDescription(yearlyOffering.description)}
                    </p>
                  </div>
                </div>

                <div className="mb-2.5">
                  <div className="flex items-baseline gap-1 mb-0.5">
                    <span className="text-xl md:text-2xl font-semibold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">
                      {formatPrice(yearlyOffering.priceString)}
                    </span>
                    <span className="text-[10px] md:text-xs text-muted-foreground">{SUBSCRIPTION_UI_TEXT.planCards.priceUnits.year}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {savings.percent > 0 && (
                      <Badge className="bg-gradient-to-r from-[#B8E6D5] to-[#C9E4F7] text-gray-800 text-[9px] md:text-[10px] font-medium px-1 py-0.5">
                        {isLoadingOfferings ? 'Loading…' : SUBSCRIPTION_UI_TEXT.planCards.yearly.savingsLabel(savings.percent, savings.amount)}
                      </Badge>
                    )}
                    <p className="text-[10px] md:text-xs font-medium text-[#9B87E8]">
                      {isLoadingOfferings
                        ? 'Loading…'
                        : SUBSCRIPTION_UI_TEXT.planCards.yearly.perMonthLabel(getYearlyPerMonthPrice())}
                    </p>
                  </div>
                </div>

                <ul className="space-y-1 mb-2.5 flex-1 min-h-0 overflow-y-auto">
                  {/* Show all Monthly features first, then all Yearly-exclusive features */}
                  {monthlyProFeatures.filter(f => !f.isHeader).map((feature, index) => (
                    <li key={`monthly-${index}`} className="flex items-start gap-1.5">
                      <div className={cn(
                        "flex-shrink-0 w-3 h-3 rounded-full flex items-center justify-center mt-0.5",
                        feature.highlight
                          ? "bg-gradient-to-br from-[#9B87E8] to-[#D4C5F9]"
                          : "bg-[#B8E6D5] dark:bg-[#5A8A7A]"
                      )}>
                        <feature.icon className={cn(
                          "w-1.5 h-1.5",
                          feature.highlight ? "text-white" : "text-gray-800 dark:text-foreground"
                        )} />
                      </div>
                      <span className="text-[11px] md:text-xs text-gray-700 dark:text-foreground leading-snug">
                        {feature.text}
                      </span>
                    </li>
                  ))}
                  {yearlyProFeatures.filter(f => !f.isHeader).map((feature, index) => (
                    <li key={`yearly-${index}`} className="flex items-start gap-1.5">
                      <div className={cn(
                        "flex-shrink-0 w-3 h-3 rounded-full flex items-center justify-center mt-0.5",
                        "bg-gradient-to-br from-[#9B87E8] to-[#D4C5F9]"
                      )}>
                        <feature.icon className="w-1.5 h-1.5 text-white" />
                      </div>
                      <span className="text-[11px] md:text-xs text-gray-700 dark:text-foreground font-medium leading-snug">
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={cn(
                    "w-full shadow-md hover:shadow-lg transition-all duration-300 text-[11px] md:text-xs font-medium py-1.5 relative z-20",
                    subscription.tier === "pro" && subscription.billingPeriod === "yearly"
                      ? "bg-[#9B87E8] text-white hover:bg-[#8B77D8] cursor-default"
                      : "bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] hover:from-[#8B77D8] hover:to-[#C4B5E9] text-white"
                  )}
                  disabled={(subscription.tier === "pro" && subscription.billingPeriod === "yearly") || isUpgrading}
                  onClick={handleUpgradeYearly}
                >
                  {isUpgrading ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span className="text-[10px] md:text-[11px]">{SUBSCRIPTION_UI_TEXT.planCards.yearly.button.processing}</span>
                    </span>
                  ) : subscription.tier === "pro" && subscription.billingPeriod === "yearly" ? (
                    SUBSCRIPTION_UI_TEXT.pro.button.current
                  ) : subscription.tier === "pro" ? (
                    SUBSCRIPTION_UI_TEXT.planCards.yearly.button.switch
                  ) : (
                    <span className="flex items-center justify-center gap-1.5">
                      <Sparkles className="w-2.5 h-2.5" />
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
                  <p className="text-[11px] md:text-xs text-muted-foreground text-center">
                    {isLoadingOfferings ? SUBSCRIPTION_UI_TEXT.planCards.loading : SUBSCRIPTION_UI_TEXT.planCards.yearly.notAvailable}
                  </p>
                </div>
              </motion.div>
            )}
          </div>

          <div className="mt-3 md:mt-4">
            <div className="p-2 md:p-2.5 bg-gradient-to-r from-[#E6D5F0]/40 via-[#C9E4F7]/40 to-[#B8E6D5]/40 dark:from-[#4A4A5E]/60 dark:via-[#3E3E52]/60 dark:to-[#3E3E52]/60 rounded-lg border border-[#9B87E8]/30 shadow-md backdrop-blur-sm">
              <p className="text-[11px] md:text-xs text-center text-gray-700 dark:text-foreground leading-snug">
                {SUBSCRIPTION_UI_TEXT.footer.message}{' '}
                <span className="font-medium text-[#9B87E8]">{SUBSCRIPTION_UI_TEXT.footer.upgradeText}</span>{' '}
                {SUBSCRIPTION_UI_TEXT.footer.upgradeDescription}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
