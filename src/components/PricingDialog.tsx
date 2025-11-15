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
import { toast } from "sonner";
import { motion } from "motion/react";
import {
  purchaseProSubscription,
  restorePurchases,
  getOfferings,
} from "../lib/revenuecat";
import { getPlatform } from "../lib/platform";
import { cn } from "../lib/utils";
import {
  DEFAULT_MONTHLY_PRICE,
  DEFAULT_YEARLY_PRICE,
  MONTHLY_PACKAGE_IDENTIFIERS,
  YEARLY_PACKAGE_IDENTIFIERS,
  SUBSCRIPTION_UI_TEXT,
  FREE_TIER_FEATURES,
  PRO_TIER_FEATURES,
  PRO_FEATURES_LIST,
} from "../lib/subscription-constants";

interface PricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PricingDialog({
  open,
  onOpenChange,
}: PricingDialogProps) {
  const { subscription, upgradeToPro, refreshSubscription, cancelSubscription, downgradeToFree } =
    useSubscription();
  const [isUpgrading, setIsUpgrading] = React.useState(false);
  const [isRestoring, setIsRestoring] = React.useState(false);
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [isDowngrading, setIsDowngrading] = React.useState(false);
  const [selectedPlan, setSelectedPlan] = React.useState<'monthly' | 'yearly'>('monthly');
  const [offerings, setOfferings] = React.useState<{
    monthly?: { price: string; priceString: string; currencyCode: string };
    yearly?: { price: string; priceString: string; currencyCode: string };
  }>({});
  const platform = getPlatform();

  // Load offerings when dialog opens
  React.useEffect(() => {
    if (open) {
      loadOfferings();
    }
  }, [open]);

  const loadOfferings = async () => {
    try {
      const rcOfferings = await getOfferings();
      if (rcOfferings?.availablePackages) {
        const monthlyPkg = rcOfferings.availablePackages.find(
          pkg => MONTHLY_PACKAGE_IDENTIFIERS.includes(pkg.identifier)
        );
        const yearlyPkg = rcOfferings.availablePackages.find(
          pkg => YEARLY_PACKAGE_IDENTIFIERS.includes(pkg.identifier)
        );

        setOfferings({
          monthly: monthlyPkg ? {
            price: monthlyPkg.product.price.toString(),
            priceString: monthlyPkg.product.priceString,
            currencyCode: monthlyPkg.product.currencyCode,
          } : undefined,
          yearly: yearlyPkg ? {
            price: yearlyPkg.product.price.toString(),
            priceString: yearlyPkg.product.priceString,
            currencyCode: yearlyPkg.product.currencyCode,
          } : undefined,
        });
      }
    } catch (error) {
      console.log('Failed to load offerings, using defaults:', error);
    }
  };

  const handleUpgrade = async () => {
    try {
      setIsUpgrading(true);

      // Check if we're in production mode
      const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';
      const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

      // Try RevenueCat purchase first (works for all platforms)
      try {
        console.log(
          `Attempting ${selectedPlan} purchase on ${platform.platform}`,
        );
        const success = await purchaseProSubscription(selectedPlan);

        if (success) {
          toast.success(SUBSCRIPTION_UI_TEXT.messages.upgradeSuccess, {
            description: SUBSCRIPTION_UI_TEXT.messages.upgradeSuccessDesc,
          });

          // Refresh subscription status from backend
          await refreshSubscription();
          onOpenChange(false);
          return;
        } else {
          // Payment failed or user cancelled
          console.log("Purchase cancelled or failed");
          toast.error(SUBSCRIPTION_UI_TEXT.messages.paymentFailed, {
            description: SUBSCRIPTION_UI_TEXT.messages.paymentFailedDesc,
          });
          return;
        }
      } catch (rcError: any) {
        // If user cancelled, show a friendly message
        if (
          rcError.message?.includes("cancelled") ||
          rcError.userCancelled
        ) {
          // Don't show error for cancellation - user intentionally cancelled
          return;
        }

        // SECURITY: In production, never allow free upgrades
        if (isProduction) {
          console.error("Payment processing failed in production:", rcError.message);
          
          // Provide more specific error messages based on error type
          let errorTitle = "Payment processing unavailable";
          let errorDescription = "Unable to process payment. Please contact support or try again later.";
          
          if (rcError.message?.includes("not configured")) {
            errorTitle = "Payment system not configured";
            errorDescription = "Payment processing is currently unavailable. Please contact support.";
          } else if (rcError.message?.includes("No subscription offerings available") || 
                     rcError.message?.includes("subscription not found")) {
            errorTitle = "Subscription not available";
            errorDescription = "The selected subscription plan is not available. Please try again or contact support.";
          } else if (rcError.message?.includes("network") || rcError.message?.includes("timeout")) {
            errorTitle = "Connection error";
            errorDescription = "Unable to connect to payment service. Please check your internet connection and try again.";
          } else if (rcError.message) {
            // Use the specific error message if available
            errorDescription = rcError.message;
          }
          
          toast.error(errorTitle, {
            description: errorDescription,
          });
          return;
        }

        // Development mode only: Allow fallback for testing
        if (isDevelopment) {
          // RevenueCat not configured - this is expected in development
          if (rcError.message?.includes("not configured")) {
            console.log(
              "ℹ️  RevenueCat not fully configured - using development mode",
            );
            console.log(
              "ℹ️  To enable payment processing, run: npm install @revenuecat/purchases-js",
            );
            console.log(
              "ℹ️  See /docs/PAYMENT_SYSTEM_SETUP.md for full setup guide",
            );
          } else {
            console.warn(
              "⚠️  Payment processing unavailable:",
              rcError.message,
            );
          }

          // Fall back to simulated upgrade (DEVELOPMENT ONLY)
          console.log(
            "→ Using simulated upgrade for development",
          );
          
          await upgradeToPro();
          toast.success(SUBSCRIPTION_UI_TEXT.messages.upgradeDevMode, {
            description: SUBSCRIPTION_UI_TEXT.messages.upgradeDevModeDesc,
          });
          onOpenChange(false);
          return;
        }

        // Unknown environment - err on the side of caution
        console.error("Payment processing failed:", rcError.message);
        toast.error("Payment processing unavailable", {
          description:
            "Unable to process payment. Please contact support.",
        });
      }
    } catch (error: any) {
      console.error("Upgrade error:", error);
      toast.error("Upgrade failed", {
        description:
          error.message ||
          "Please try again or contact support.",
      });
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleRestore = async () => {
    try {
      setIsRestoring(true);
      console.log("Restoring purchases...");

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
    if (!offerings.monthly || !offerings.yearly) return 0;
    const monthlyPrice = parseFloat(offerings.monthly.price);
    const yearlyPrice = parseFloat(offerings.yearly.price);
    const yearlyEquivalent = monthlyPrice * 12;
    if (yearlyEquivalent === 0) return 0;
    return Math.round(((yearlyEquivalent - yearlyPrice) / yearlyEquivalent) * 100);
  };

  const savings = calculateSavings();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] lg:max-w-[1400px] max-h-[95vh] overflow-y-auto p-0 md:p-0">
        <div className="p-6 md:p-8 lg:p-10 xl:p-12">
          {/* Header and Toggle in Horizontal Layout */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 md:mb-10 gap-6">
            <DialogHeader className="text-left md:text-left">
              <DialogTitle className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-[#9B87E8] via-[#C9E4F7] to-[#B8E6D5] bg-clip-text text-transparent mb-2">
                {SUBSCRIPTION_UI_TEXT.title}
              </DialogTitle>
              <DialogDescription className="text-base md:text-lg lg:text-xl mt-2 text-muted-foreground">
                {SUBSCRIPTION_UI_TEXT.description}
              </DialogDescription>
            </DialogHeader>

            {/* Plan Toggle - Spacious Horizontal */}
            <div className="inline-flex items-center gap-3 p-2 bg-gradient-to-r from-[#E6D5F0] to-[#C9E4F7] dark:from-[#4A4A5E] dark:to-[#3E3E52] rounded-2xl shadow-lg">
              <button
                type="button"
                onClick={() => setSelectedPlan('monthly')}
                className={cn(
                  "px-8 py-3 rounded-xl text-base font-semibold transition-all duration-300",
                  selectedPlan === 'monthly'
                    ? 'bg-white dark:bg-gray-700 text-[#9B87E8] dark:text-[#9B87E8] shadow-md'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                )}
              >
                {SUBSCRIPTION_UI_TEXT.toggle.monthly}
              </button>
              <button
                type="button"
                onClick={() => setSelectedPlan('yearly')}
                className={cn(
                  "px-8 py-3 rounded-xl text-base font-semibold transition-all duration-300",
                  selectedPlan === 'yearly'
                    ? 'bg-white dark:bg-gray-700 text-[#9B87E8] dark:text-[#9B87E8] shadow-md'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                )}
              >
                <span className="flex items-center gap-2">
                  {SUBSCRIPTION_UI_TEXT.toggle.yearly}
                  {savings > 0 && (
                    <span className="px-3 py-1 text-xs font-bold bg-gradient-to-r from-[#B8E6D5] to-[#C9E4F7] text-gray-800 rounded-full">
                      Save {savings}%
                    </span>
                  )}
                </span>
              </button>
            </div>
          </div>

          {/* Plans Grid - Spacious Horizontal Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 lg:gap-12 max-w-full">
            {/* Free Tier - Spacious Design */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="relative border-2 border-gray-200 dark:border-gray-700 rounded-2xl md:rounded-3xl p-8 md:p-10 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-300 shadow-lg hover:shadow-xl flex flex-col"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <h3 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">{SUBSCRIPTION_UI_TEXT.free.title}</h3>
                  <p className="text-base md:text-lg text-muted-foreground">{SUBSCRIPTION_UI_TEXT.free.subtitle}</p>
                </div>
                {subscription.tier === "free" && (
                  <Badge className="bg-[#B8E6D5] text-gray-800 border-[#B8E6D5] text-sm px-4 py-2 shadow-sm flex-shrink-0">
                    {SUBSCRIPTION_UI_TEXT.free.button.current}
                  </Badge>
                )}
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-gray-100">{SUBSCRIPTION_UI_TEXT.free.price}</span>
                  <span className="text-xl md:text-2xl text-muted-foreground">{SUBSCRIPTION_UI_TEXT.free.priceUnit}</span>
                </div>
                <p className="text-base md:text-lg text-muted-foreground">{SUBSCRIPTION_UI_TEXT.free.description}</p>
              </div>

              <ul className="space-y-4 mb-8 flex-1">
                {freeTierFeatures.map((feature, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-4 group"
                  >
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#B8E6D5] dark:bg-[#5A8A7A] flex items-center justify-center mt-0.5 group-hover:scale-110 transition-transform duration-200">
                      <feature.icon className="w-4 h-4 text-gray-800 dark:text-gray-100" />
                    </div>
                    <span className="text-base md:text-lg text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors leading-relaxed">
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                variant="outline"
                className="w-full border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-base md:text-lg py-6 font-semibold transition-all duration-200 hover:scale-[1.01]"
                disabled={subscription.tier === "free" || isDowngrading}
                onClick={subscription.tier === "pro" ? handleDowngrade : undefined}
              >
                {isDowngrading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                    {SUBSCRIPTION_UI_TEXT.pro.button.downgrading}
                  </span>
                ) : subscription.tier === "free" ? (
                  SUBSCRIPTION_UI_TEXT.free.button.current
                ) : (
                  SUBSCRIPTION_UI_TEXT.free.button.downgrade
                )}
              </Button>
            </motion.div>

            {/* Pro Tier - Spacious Featured Design */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="relative border-2 border-[#9B87E8] rounded-2xl md:rounded-3xl p-8 md:p-10 bg-gradient-to-br from-[#9B87E8]/10 via-[#C9E4F7]/10 to-[#B8E6D5]/10 dark:from-[#9B87E8]/20 dark:via-[#6A8AAA]/10 dark:to-[#5A8A7A]/10 overflow-hidden shadow-2xl hover:shadow-[#9B87E8]/30 transition-all duration-300 flex flex-col"
            >
              {/* Enhanced Decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#9B87E8]/25 to-[#C9E4F7]/25 rounded-bl-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-[#B8E6D5]/25 to-[#C9E4F7]/25 rounded-tr-full blur-3xl" />
              
              {/* Popular Badge - Enhanced */}
              <div className="absolute top-6 right-6 z-20">
                <Badge className="bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] text-white border-0 shadow-xl px-4 py-2 text-sm font-semibold">
                  <Crown className="w-4 h-4 mr-1.5" />
                  {SUBSCRIPTION_UI_TEXT.pro.badge.popular}
                </Badge>
              </div>

              <div className="relative z-10 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">{SUBSCRIPTION_UI_TEXT.pro.title}</h3>
                      <Sparkles className="w-6 h-6 md:w-7 md:h-7 text-[#9B87E8] animate-pulse" />
                    </div>
                    <p className="text-base md:text-lg text-muted-foreground">{SUBSCRIPTION_UI_TEXT.pro.subtitle}</p>
                  </div>
                  {subscription.tier === "pro" && (
                    <Badge className="bg-[#B8E6D5] text-gray-800 border-[#B8E6D5] text-sm px-4 py-2 shadow-sm flex-shrink-0">
                      {SUBSCRIPTION_UI_TEXT.pro.badge.current}
                    </Badge>
                  )}
                </div>

                <div className="mb-8">
                  {selectedPlan === 'monthly' ? (
                    <>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">
                          {offerings.monthly?.priceString || DEFAULT_MONTHLY_PRICE}
                        </span>
                        <span className="text-xl md:text-2xl text-muted-foreground">/month</span>
                      </div>
                      <p className="text-base md:text-lg text-muted-foreground">{SUBSCRIPTION_UI_TEXT.pro.description}</p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">
                          {offerings.yearly?.priceString || DEFAULT_YEARLY_PRICE}
                        </span>
                        <span className="text-xl md:text-2xl text-muted-foreground">/year</span>
                      </div>
                      <div className="flex items-center gap-3 mb-2">
                        <p className="text-base md:text-lg text-muted-foreground">
                          {SUBSCRIPTION_UI_TEXT.pro.descriptionYearly}
                        </p>
                        {savings > 0 && (
                          <Badge className="bg-gradient-to-r from-[#B8E6D5] to-[#C9E4F7] text-gray-800 text-sm font-bold px-3 py-1">
                            Save {savings}%
                          </Badge>
                        )}
                      </div>
                      {offerings.yearly && offerings.monthly && (
                        <p className="text-base md:text-lg font-semibold text-[#9B87E8]">
                          ${((parseFloat(offerings.yearly.price) / 12).toFixed(2))} per month
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Features in 2 columns for spacious layout */}
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 flex-1">
                  {proTierFeatures.map((feature, index) => (
                    <li
                      key={index}
                      className={cn(
                        "flex items-start gap-4 group",
                        feature.isHeader && "pt-4 border-t border-[#9B87E8]/30 dark:border-[#9B87E8]/40 mt-2 md:col-span-2"
                      )}
                    >
                      <div className={cn(
                        "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 transition-all duration-200",
                        feature.highlight
                          ? "bg-gradient-to-br from-[#9B87E8] to-[#D4C5F9] shadow-md group-hover:scale-110"
                          : "bg-[#B8E6D5] dark:bg-[#5A8A7A] group-hover:scale-110"
                      )}>
                        <feature.icon className={cn(
                          "w-4 h-4",
                          feature.highlight ? "text-white" : "text-gray-800 dark:text-gray-100"
                        )} />
                      </div>
                      <span className={cn(
                        "text-base md:text-lg transition-colors leading-relaxed",
                        feature.highlight
                          ? "text-gray-900 dark:text-gray-100 font-semibold group-hover:text-[#9B87E8]"
                          : "text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100"
                      )}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="space-y-4">
                  <Button
                    className="w-full bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] hover:from-[#8B77D8] hover:to-[#C4B5E9] text-white shadow-xl hover:shadow-2xl transition-all duration-300 text-base md:text-lg font-bold py-6 md:py-7 hover:scale-[1.01] active:scale-[0.99]"
                    disabled={
                      subscription.tier === "pro" || isUpgrading
                    }
                    onClick={handleUpgrade}
                  >
                    {isUpgrading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {SUBSCRIPTION_UI_TEXT.pro.button.processing}
                      </span>
                    ) : subscription.tier === "pro" ? (
                      SUBSCRIPTION_UI_TEXT.pro.button.current
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Sparkles className="w-5 h-5" />
                        {SUBSCRIPTION_UI_TEXT.pro.button.upgrade}
                      </span>
                    )}
                  </Button>

                  {/* Cancel Subscription Button - Show for Pro users who haven't cancelled */}
                  {subscription.tier === "pro" && !subscription.cancelAtPeriodEnd && (
                    <Button
                      variant="outline"
                      className="w-full border-2 border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-base md:text-lg py-5 md:py-6 font-semibold transition-all duration-200 hover:scale-[1.01]"
                      disabled={isCancelling}
                      onClick={handleCancel}
                    >
                      {isCancelling ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                          {SUBSCRIPTION_UI_TEXT.pro.button.cancelling}
                        </span>
                      ) : (
                        SUBSCRIPTION_UI_TEXT.pro.button.cancel
                      )}
                    </Button>
                  )}

                  {/* Show message if already cancelled */}
                  {subscription.tier === "pro" && subscription.cancelAtPeriodEnd && (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-xl">
                      <p className="text-sm md:text-base text-yellow-800 dark:text-yellow-200 text-center">
                        {SUBSCRIPTION_UI_TEXT.messages.cancelWarning}
                      </p>
                    </div>
                  )}

                  {/* Show Restore button for native platforms */}
                  {platform.isNative &&
                    subscription.tier !== "pro" && (
                      <Button
                        variant="outline"
                        className="w-full border-2 border-[#9B87E8]/40 text-[#9B87E8] hover:bg-[#9B87E8]/10 text-base md:text-lg py-5 md:py-6 font-semibold transition-all duration-200 hover:scale-[1.01]"
                        disabled={isRestoring}
                        onClick={handleRestore}
                      >
                        {isRestoring
                          ? "Restoring..."
                          : "Restore Purchases"}
                      </Button>
                    )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Footer Note - Spacious */}
          <div className="mt-8 md:mt-10 p-5 md:p-6 bg-gradient-to-r from-[#E6D5F0]/40 via-[#C9E4F7]/40 to-[#B8E6D5]/40 dark:from-[#4A4A5E]/60 dark:via-[#3E3E52]/60 dark:to-[#3E3E52]/60 rounded-xl md:rounded-2xl border-2 border-[#9B87E8]/30 shadow-lg backdrop-blur-sm">
            <p className="text-sm md:text-base lg:text-lg text-center text-gray-700 dark:text-gray-300 leading-relaxed">
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
