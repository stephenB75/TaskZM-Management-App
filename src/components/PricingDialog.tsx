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
import {
  SUBSCRIPTION_UI_TEXT,
  FREE_TIER_FEATURES,
  PRO_TIER_FEATURES,
  PRO_FEATURES_LIST,
  FEATURES_DISPLAY_LIMIT,
  DEFAULT_MONTHLY_PRICE,
  DEFAULT_YEARLY_PRICE,
} from "../lib/subscription-constants";
import * as api from "../lib/api";

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

  const platform = getPlatform();
  const { user } = useAuth();

  const handleRestore = async () => {
    try {
      setIsRestoring(true);
      // Restore purchases by refreshing subscription from backend
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
    const featuresList = PRO_FEATURES_LIST.map(f => `• ${f}`).join('\n');
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

  const calculateSavings = () => {
    // Calculate savings between monthly and yearly
    const monthlyPrice = 3.99;
    const yearlyPrice = 39.99;
    const yearlyEquivalent = monthlyPrice * 12;
    if (yearlyEquivalent === 0) return 0;
    return Math.round(((yearlyEquivalent - yearlyPrice) / yearlyEquivalent) * 100);
  };

  const savings = calculateSavings();

  const handleUpgradeMonthly = async () => {
    try {
      setIsUpgrading(true);
      const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';
      const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

      if (isProduction) {
        // In production, redirect to Stripe checkout
        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/make-server-65e6e67f/create-checkout-session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await import('../utils/supabase/info')).publicAnonKey}`,
            },
            body: JSON.stringify({
              priceId: 'monthly', // Backend will map this to Stripe price ID
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to create checkout session');
          }

          const { url } = await response.json();
          if (url) {
            window.location.href = url;
            return;
          }
        } catch (error: any) {
          console.error('Checkout error:', error);
          toast.error(SUBSCRIPTION_UI_TEXT.errors.paymentProcessingUnavailable, {
            description: error.message || SUBSCRIPTION_UI_TEXT.errors.paymentProcessingUnavailableDesc,
          });
          setIsUpgrading(false);
          return;
        }
      }

      if (isDevelopment) {
        // Development mode: use simulated upgrade
        await upgradeToPro();
        toast.success(SUBSCRIPTION_UI_TEXT.messages.upgradeDevMode);
        onOpenChange(false);
      }
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
      const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';
      const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

      if (isProduction) {
        // In production, redirect to Stripe checkout
        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/make-server-65e6e67f/create-checkout-session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await import('../utils/supabase/info')).publicAnonKey}`,
            },
            body: JSON.stringify({
              priceId: 'yearly', // Backend will map this to Stripe price ID
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to create checkout session');
          }

          const { url } = await response.json();
          if (url) {
            window.location.href = url;
            return;
          }
        } catch (error: any) {
          console.error('Checkout error:', error);
          toast.error(SUBSCRIPTION_UI_TEXT.errors.paymentProcessingUnavailable, {
            description: error.message || SUBSCRIPTION_UI_TEXT.errors.paymentProcessingUnavailableDesc,
          });
          setIsUpgrading(false);
          return;
        }
      }

      if (isDevelopment) {
        // Development mode: use simulated upgrade
        await upgradeToPro();
        toast.success(SUBSCRIPTION_UI_TEXT.messages.upgradeDevMode);
        onOpenChange(false);
      }
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
  const proTierFeatures = PRO_TIER_FEATURES;

  // Static pricing (can be moved to backend API later)
  const monthlyOffering = {
    priceString: DEFAULT_MONTHLY_PRICE,
    title: SUBSCRIPTION_UI_TEXT.planCards.monthly.title,
    description: SUBSCRIPTION_UI_TEXT.planCards.monthly.billingPeriod,
  };

  const yearlyOffering = {
    priceString: DEFAULT_YEARLY_PRICE,
    title: SUBSCRIPTION_UI_TEXT.planCards.yearly.title,
    description: SUBSCRIPTION_UI_TEXT.planCards.yearly.billingPeriod,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] lg:max-w-[980px] max-h-[95vh] overflow-y-auto p-0 md:p-0">
        <div className="p-4 md:p-5 lg:p-7 xl:p-8">
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

          <div className={cn("grid gap-4 md:gap-5 lg:gap-7 max-w-full", "grid-cols-1 md:grid-cols-3")}>
            {/* Free Tier */}
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
                  <li key={index} className="flex items-start gap-3 group">
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
                        {monthlyOffering.title}
                      </h3>
                      <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-[#9B87E8] animate-pulse" />
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      {monthlyOffering.description}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">
                      {monthlyOffering.priceString}
                    </span>
                    <span className="text-sm md:text-base text-muted-foreground">{SUBSCRIPTION_UI_TEXT.planCards.priceUnits.month}</span>
                  </div>
                </div>

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
                    + {proTierFeatures.length - FEATURES_DISPLAY_LIMIT} {SUBSCRIPTION_UI_TEXT.planCards.moreFeaturesLabel}
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

            {/* Yearly Pro Tier */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="relative border-2 border-[#9B87E8] rounded-xl md:rounded-2xl p-4 md:p-5 bg-gradient-to-br from-[#9B87E8]/15 via-[#C9E4F7]/15 to-[#B8E6D5]/15 dark:from-[#9B87E8]/25 dark:via-[#6A8AAA]/15 dark:to-[#5A8A7A]/15 overflow-hidden shadow-2xl hover:shadow-[#9B87E8]/40 transition-all duration-300 flex flex-col"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#9B87E8]/25 to-[#C9E4F7]/25 rounded-bl-full blur-2xl" />
              
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
                        {yearlyOffering.title}
                      </h3>
                      <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-[#9B87E8] animate-pulse" />
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      {yearlyOffering.description}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">
                      {yearlyOffering.priceString}
                    </span>
                    <span className="text-sm md:text-base text-muted-foreground">{SUBSCRIPTION_UI_TEXT.planCards.priceUnits.year}</span>
                  </div>
                  {savings > 0 && (
                    <Badge className="mb-2 bg-gradient-to-r from-[#B8E6D5] to-[#C9E4F7] text-gray-800 text-xs font-bold px-2 py-0.5">
                      {SUBSCRIPTION_UI_TEXT.planCards.yearly.savingsLabel(savings)}
                    </Badge>
                  )}
                  <p className="text-xs md:text-sm font-semibold text-[#9B87E8]">
                    {SUBSCRIPTION_UI_TEXT.planCards.yearly.perMonthLabel((39.99 / 12).toFixed(2))}
                  </p>
                </div>

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
                    + {proTierFeatures.length - FEATURES_DISPLAY_LIMIT} {SUBSCRIPTION_UI_TEXT.planCards.moreFeaturesLabel}
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
          </div>

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
