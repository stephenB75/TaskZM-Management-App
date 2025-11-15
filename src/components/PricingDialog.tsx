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
          pkg => ['$rc_monthly', 'monthly'].includes(pkg.identifier)
        );
        const yearlyPkg = rcOfferings.availablePackages.find(
          pkg => ['$rc_annual', '$rc_yearly', 'annual', 'yearly'].includes(pkg.identifier)
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
          toast.success("🎉 Welcome to TaskZM Pro!", {
            description:
              "You now have access to all premium features.",
          });

          // Refresh subscription status from backend
          await refreshSubscription();
          onOpenChange(false);
          return;
        } else {
          // Payment failed or user cancelled
          console.log("Purchase cancelled or failed");
          toast.error("Payment failed", {
            description:
              "The payment could not be processed. Please check your payment method and try again.",
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
          toast.success("🎉 Welcome to TaskZM Pro! (Development Mode)", {
            description:
              "You now have access to all premium features. This is a development-only upgrade.",
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
        toast.success("✅ Subscription restored!", {
          description: "Your Pro features are now active.",
        });
        await refreshSubscription();
        onOpenChange(false);
      } else {
        toast.info("No active subscription found", {
          description:
            "If you believe this is an error, please contact support.",
        });
      }
    } catch (error: any) {
      console.error("Restore error:", error);
      toast.error("Restore failed", {
        description: error.message || "Please try again later.",
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCancel = async () => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      "Are you sure you want to cancel your subscription?\n\n" +
      "Your Pro features will remain active until the end of your billing period. " +
      "You can reactivate anytime before then."
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsCancelling(true);
      await cancelSubscription();
      await refreshSubscription();
      toast.success("Subscription cancelled", {
        description:
          "Your subscription will cancel at the end of your billing period. You can reactivate anytime before then.",
      });
    } catch (error: any) {
      console.error("Cancel error:", error);
      toast.error("Failed to cancel subscription", {
        description: error.message || "Please try again or contact support.",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDowngrade = async () => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      "Are you sure you want to downgrade to Free?\n\n" +
      "You will lose access to all Pro features immediately:\n" +
      "• AI Scheduler\n" +
      "• Task Hours & Time Tracking\n" +
      "• Analytics Dashboard\n" +
      "• Calendar Sync\n" +
      "• Auto Task Rollover\n" +
      "• Pomodoro Timer\n" +
      "• Team Collaboration\n\n" +
      "This action cannot be undone. You can upgrade again anytime."
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsDowngrading(true);
      await downgradeToFree();
      await refreshSubscription();
      toast.success("Downgraded to Free", {
        description:
          "You've been downgraded to the Free tier. You can upgrade to Pro again anytime.",
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Downgrade error:", error);
      toast.error("Failed to downgrade subscription", {
        description: error.message || "Please try again or contact support.",
      });
    } finally {
      setIsDowngrading(false);
    }
  };

  const freeTierFeatures = [
    { icon: Check, text: "Unlimited tasks", included: true },
    {
      icon: Calendar,
      text: "7-Day Kanban & Month View",
      included: true,
    },
    {
      icon: Tag,
      text: "Custom Tags & Organization",
      included: true,
    },
  ];

  const proTierFeatures = [
    { icon: Check, text: "Everything in Free", included: true, isHeader: true },
    {
      icon: Sparkles,
      text: "AI Scheduler",
      included: true,
      highlight: true,
    },
    {
      icon: Zap,
      text: "Task Hours & Time Tracking",
      included: true,
      highlight: true,
    },
    {
      icon: BarChart3,
      text: "Analytics Dashboard",
      included: true,
      highlight: true,
    },
    {
      icon: Calendar,
      text: "Calendar Sync (Google, Outlook, Apple)",
      included: true,
      highlight: true,
    },
    {
      icon: RotateCcw,
      text: "Auto Task Rollover",
      included: true,
      highlight: true,
    },
    {
      icon: Timer,
      text: "Pomodoro Timer",
      included: true,
      highlight: true,
    },
    {
      icon: Users,
      text: "Team Collaboration",
      included: true,
      highlight: true,
    },
  ];

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
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto p-0 md:p-0">
        <div className="p-4 md:p-6 lg:p-8">
          {/* Header and Toggle in Horizontal Layout */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 md:mb-8 gap-4">
            <DialogHeader className="text-left md:text-left">
              <DialogTitle className="text-2xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-[#9B87E8] via-[#C9E4F7] to-[#B8E6D5] bg-clip-text text-transparent mb-1">
                Choose Your Plan
              </DialogTitle>
              <DialogDescription className="text-sm md:text-base mt-1 text-muted-foreground">
                Unlock powerful features to supercharge your productivity
              </DialogDescription>
            </DialogHeader>

            {/* Plan Toggle - Compact Horizontal */}
            <div className="inline-flex items-center gap-2 p-1.5 bg-gradient-to-r from-[#E6D5F0] to-[#C9E4F7] dark:from-[#4A4A5E] dark:to-[#3E3E52] rounded-xl shadow-md">
              <button
                type="button"
                onClick={() => setSelectedPlan('monthly')}
                className={cn(
                  "px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300",
                  selectedPlan === 'monthly'
                    ? 'bg-white dark:bg-gray-700 text-[#9B87E8] dark:text-[#9B87E8] shadow-md'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                )}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setSelectedPlan('yearly')}
                className={cn(
                  "px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300",
                  selectedPlan === 'yearly'
                    ? 'bg-white dark:bg-gray-700 text-[#9B87E8] dark:text-[#9B87E8] shadow-md'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                )}
              >
                <span className="flex items-center gap-1.5">
                  Yearly
                  {savings > 0 && (
                    <span className="px-2 py-0.5 text-xs font-bold bg-gradient-to-r from-[#B8E6D5] to-[#C9E4F7] text-gray-800 rounded-full">
                      Save {savings}%
                    </span>
                  )}
                </span>
              </button>
            </div>
          </div>

          {/* Plans Grid - Horizontal Compact Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 max-w-full">
            {/* Free Tier - Horizontal Compact */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="relative border-2 border-gray-200 dark:border-gray-700 rounded-xl md:rounded-2xl p-5 md:p-6 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-300 shadow-md hover:shadow-lg flex flex-col"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">Free</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">Perfect for getting started</p>
                </div>
                {subscription.tier === "free" && (
                  <Badge className="bg-[#B8E6D5] text-gray-800 border-[#B8E6D5] text-xs px-2.5 py-1 shadow-sm flex-shrink-0">
                    Current
                  </Badge>
                )}
              </div>

              <div className="mb-4">
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100">$0</span>
                  <span className="text-base md:text-lg text-muted-foreground">/month</span>
                </div>
                <p className="text-xs md:text-sm text-muted-foreground">Forever free, no credit card required</p>
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {freeTierFeatures.map((feature, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2.5 group"
                  >
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#B8E6D5] dark:bg-[#5A8A7A] flex items-center justify-center mt-0.5 group-hover:scale-110 transition-transform duration-200">
                      <feature.icon className="w-3 h-3 text-gray-800 dark:text-gray-100" />
                    </div>
                    <span className="text-xs md:text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors leading-tight">
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                variant="outline"
                className="w-full border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm py-4 font-semibold transition-all duration-200 hover:scale-[1.01]"
                disabled={subscription.tier === "free" || isDowngrading}
                onClick={subscription.tier === "pro" ? handleDowngrade : undefined}
              >
                {isDowngrading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                    Downgrading...
                  </span>
                ) : subscription.tier === "free" ? (
                  "Current Plan"
                ) : (
                  "Downgrade to Free"
                )}
              </Button>
            </motion.div>

            {/* Pro Tier - Horizontal Compact Featured */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="relative border-2 border-[#9B87E8] rounded-xl md:rounded-2xl p-5 md:p-6 bg-gradient-to-br from-[#9B87E8]/10 via-[#C9E4F7]/10 to-[#B8E6D5]/10 dark:from-[#9B87E8]/20 dark:via-[#6A8AAA]/10 dark:to-[#5A8A7A]/10 overflow-hidden shadow-xl hover:shadow-[#9B87E8]/20 transition-all duration-300 flex flex-col"
            >
              {/* Compact Decorative elements */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-[#9B87E8]/20 to-[#C9E4F7]/20 rounded-bl-full blur-2xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#B8E6D5]/20 to-[#C9E4F7]/20 rounded-tr-full blur-2xl" />
              
              {/* Popular Badge - Compact */}
              <div className="absolute top-4 right-4 z-20">
                <Badge className="bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] text-white border-0 shadow-lg px-2.5 py-1 text-xs font-semibold">
                  <Crown className="w-3 h-3 mr-1" />
                  Popular
                </Badge>
              </div>

              <div className="relative z-10 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">Pro</h3>
                      <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-[#9B87E8] animate-pulse" />
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground">Unlock all premium features</p>
                  </div>
                  {subscription.tier === "pro" && (
                    <Badge className="bg-[#B8E6D5] text-gray-800 border-[#B8E6D5] text-xs px-2.5 py-1 shadow-sm flex-shrink-0">
                      Current
                    </Badge>
                  )}
                </div>

                <div className="mb-4">
                  {selectedPlan === 'monthly' ? (
                    <>
                      <div className="flex items-baseline gap-1.5 mb-1">
                        <span className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">
                          {offerings.monthly?.priceString || '$3.99'}
                        </span>
                        <span className="text-base md:text-lg text-muted-foreground">/month</span>
                      </div>
                      <p className="text-xs md:text-sm text-muted-foreground">Billed monthly, cancel anytime</p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1.5 mb-1">
                        <span className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">
                          {offerings.yearly?.priceString || '$39.99'}
                        </span>
                        <span className="text-base md:text-lg text-muted-foreground">/year</span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs md:text-sm text-muted-foreground">
                          Billed annually
                        </p>
                        {savings > 0 && (
                          <Badge className="bg-gradient-to-r from-[#B8E6D5] to-[#C9E4F7] text-gray-800 text-xs font-bold px-2 py-0.5">
                            Save {savings}%
                          </Badge>
                        )}
                      </div>
                      {offerings.yearly && offerings.monthly && (
                        <p className="text-xs md:text-sm font-semibold text-[#9B87E8]">
                          ${((parseFloat(offerings.yearly.price) / 12).toFixed(2))} per month
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Features in 2 columns for horizontal layout */}
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-6 flex-1">
                  {proTierFeatures.map((feature, index) => (
                    <li
                      key={index}
                      className={cn(
                        "flex items-start gap-2.5 group",
                        feature.isHeader && "pt-2 border-t border-[#9B87E8]/30 dark:border-[#9B87E8]/40 mt-1 md:col-span-2"
                      )}
                    >
                      <div className={cn(
                        "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 transition-all duration-200",
                        feature.highlight
                          ? "bg-gradient-to-br from-[#9B87E8] to-[#D4C5F9] shadow-sm group-hover:scale-110"
                          : "bg-[#B8E6D5] dark:bg-[#5A8A7A] group-hover:scale-110"
                      )}>
                        <feature.icon className={cn(
                          "w-3 h-3",
                          feature.highlight ? "text-white" : "text-gray-800 dark:text-gray-100"
                        )} />
                      </div>
                      <span className={cn(
                        "text-xs md:text-sm transition-colors leading-tight",
                        feature.highlight
                          ? "text-gray-900 dark:text-gray-100 font-semibold group-hover:text-[#9B87E8]"
                          : "text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100"
                      )}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="space-y-3">
                  <Button
                    className="w-full bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] hover:from-[#8B77D8] hover:to-[#C4B5E9] text-white shadow-lg hover:shadow-xl transition-all duration-300 text-sm md:text-base font-bold py-5 hover:scale-[1.01] active:scale-[0.99]"
                    disabled={
                      subscription.tier === "pro" || isUpgrading
                    }
                    onClick={handleUpgrade}
                  >
                    {isUpgrading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Processing...
                      </span>
                    ) : subscription.tier === "pro" ? (
                      "Current Plan"
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Upgrade to Pro
                      </span>
                    )}
                  </Button>

                  {/* Cancel Subscription Button - Show for Pro users who haven't cancelled */}
                  {subscription.tier === "pro" && !subscription.cancelAtPeriodEnd && (
                    <Button
                      variant="outline"
                      className="w-full border-2 border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm py-4 font-semibold transition-all duration-200 hover:scale-[1.01]"
                      disabled={isCancelling}
                      onClick={handleCancel}
                    >
                      {isCancelling ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                          Cancelling...
                        </span>
                      ) : (
                        "Cancel Subscription"
                      )}
                    </Button>
                  )}

                  {/* Show message if already cancelled */}
                  {subscription.tier === "pro" && subscription.cancelAtPeriodEnd && (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <p className="text-xs md:text-sm text-yellow-800 dark:text-yellow-200 text-center">
                        ⚠️ Your subscription will cancel at the end of your billing period. You can reactivate anytime before then.
                      </p>
                    </div>
                  )}

                  {/* Show Restore button for native platforms */}
                  {platform.isNative &&
                    subscription.tier !== "pro" && (
                      <Button
                        variant="outline"
                        className="w-full border-2 border-[#9B87E8]/40 text-[#9B87E8] hover:bg-[#9B87E8]/10 text-sm py-4 font-semibold transition-all duration-200 hover:scale-[1.01]"
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

          {/* Footer Note - Horizontal Compact */}
          <div className="mt-4 md:mt-6 p-3 md:p-4 bg-gradient-to-r from-[#E6D5F0]/40 via-[#C9E4F7]/40 to-[#B8E6D5]/40 dark:from-[#4A4A5E]/60 dark:via-[#3E3E52]/60 dark:to-[#3E3E52]/60 rounded-lg md:rounded-xl border-2 border-[#9B87E8]/30 shadow-md backdrop-blur-sm">
            <p className="text-xs md:text-sm text-center text-gray-700 dark:text-gray-300 leading-relaxed">
              💡 All plans include unlimited tasks and seamless calendar integration. 
              <span className="font-semibold text-[#9B87E8]"> Upgrade anytime</span> to unlock 
              AI-powered scheduling and advanced analytics.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
