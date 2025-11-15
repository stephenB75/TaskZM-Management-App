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
  const { subscription, upgradeToPro, refreshSubscription } =
    useSubscription();
  const [isUpgrading, setIsUpgrading] = React.useState(false);
  const [isRestoring, setIsRestoring] = React.useState(false);
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
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0 md:p-0">
        <div className="p-6 md:p-8 lg:p-12">
          <DialogHeader className="text-center mb-8 md:mb-10">
            <DialogTitle className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-[#9B87E8] via-[#C9E4F7] to-[#B8E6D5] bg-clip-text text-transparent mb-3">
              Choose Your Plan
            </DialogTitle>
            <DialogDescription className="text-base md:text-lg lg:text-xl mt-2 text-muted-foreground max-w-2xl mx-auto">
              Unlock powerful features to supercharge your productivity
            </DialogDescription>
          </DialogHeader>

          {/* Plan Toggle - Desktop Optimized */}
          <div className="flex justify-center mb-8 md:mb-10">
            <div className="inline-flex items-center gap-3 p-2 bg-gradient-to-r from-[#E6D5F0] to-[#C9E4F7] dark:from-[#4A4A5E] dark:to-[#3E3E52] rounded-2xl shadow-lg">
              <button
                type="button"
                onClick={() => setSelectedPlan('monthly')}
                className={cn(
                  "px-8 py-3.5 rounded-xl text-base font-semibold transition-all duration-300 relative",
                  selectedPlan === 'monthly'
                    ? 'bg-white dark:bg-gray-700 text-[#9B87E8] dark:text-[#9B87E8] shadow-lg scale-105'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:scale-105'
                )}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setSelectedPlan('yearly')}
                className={cn(
                  "px-8 py-3.5 rounded-xl text-base font-semibold transition-all duration-300 relative",
                  selectedPlan === 'yearly'
                    ? 'bg-white dark:bg-gray-700 text-[#9B87E8] dark:text-[#9B87E8] shadow-lg scale-105'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:scale-105'
                )}
              >
                <span className="flex items-center gap-2">
                  Yearly
                  {savings > 0 && (
                    <span className="px-3 py-1 text-xs font-bold bg-gradient-to-r from-[#B8E6D5] to-[#C9E4F7] text-gray-800 rounded-full shadow-sm">
                      Save {savings}%
                    </span>
                  )}
                </span>
              </button>
            </div>
          </div>

          {/* Plans Grid - Desktop Optimized Side-by-Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 lg:gap-12 max-w-5xl mx-auto">
            {/* Free Tier - Desktop Optimized */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="relative border-2 border-gray-200 dark:border-gray-700 rounded-2xl md:rounded-3xl p-6 md:p-8 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              <div className="flex items-start justify-between mb-5 md:mb-6">
                <div>
                  <h3 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Free</h3>
                  <p className="text-sm md:text-base text-muted-foreground">Perfect for getting started</p>
                </div>
                {subscription.tier === "free" && (
                  <Badge className="bg-[#B8E6D5] text-gray-800 border-[#B8E6D5] text-sm px-4 py-1.5 shadow-sm">
                    Current Plan
                  </Badge>
                )}
              </div>

              <div className="mb-6 md:mb-8">
                <div className="flex items-baseline gap-2 mb-2 md:mb-3">
                  <span className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100">$0</span>
                  <span className="text-lg md:text-xl text-muted-foreground">/month</span>
                </div>
                <p className="text-sm md:text-base text-muted-foreground">Forever free, no credit card required</p>
              </div>

              <ul className="space-y-3 md:space-y-4 mb-8 md:mb-10">
                {freeTierFeatures.map((feature, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-4 group"
                  >
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#B8E6D5] dark:bg-[#5A8A7A] flex items-center justify-center mt-0.5 group-hover:scale-110 transition-transform duration-200">
                      <feature.icon className="w-4 h-4 text-gray-800 dark:text-gray-100" />
                    </div>
                    <span className="text-base text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                variant="outline"
                className="w-full border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-base py-6 font-semibold transition-all duration-200 hover:scale-[1.02]"
                disabled={subscription.tier === "free"}
              >
                {subscription.tier === "free"
                  ? "Current Plan"
                  : "Downgrade"}
              </Button>
            </motion.div>

            {/* Pro Tier - Featured Desktop Optimized */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="relative border-2 border-[#9B87E8] rounded-2xl md:rounded-3xl p-6 md:p-8 bg-gradient-to-br from-[#9B87E8]/10 via-[#C9E4F7]/10 to-[#B8E6D5]/10 dark:from-[#9B87E8]/20 dark:via-[#6A8AAA]/10 dark:to-[#5A8A7A]/10 overflow-hidden shadow-2xl hover:shadow-[#9B87E8]/20 transition-all duration-300 md:scale-[1.02]"
            >
              {/* Enhanced Decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#9B87E8]/25 to-[#C9E4F7]/25 rounded-bl-full blur-3xl animate-pulse" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-[#B8E6D5]/25 to-[#C9E4F7]/25 rounded-tr-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-gradient-to-r from-[#9B87E8]/15 to-[#D4C5F9]/15 rounded-full blur-2xl" />
              
              {/* Popular Badge - Enhanced */}
              <div className="absolute top-6 right-6 z-20">
                <Badge className="bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] text-white border-0 shadow-xl px-4 py-1.5 text-sm font-semibold">
                  <Crown className="w-4 h-4 mr-1.5" />
                  Popular
                </Badge>
              </div>

              <div className="relative z-10">
                <div className="flex items-start justify-between mb-5 md:mb-6">
                  <div>
                    <div className="flex items-center gap-2 md:gap-3 mb-2">
                      <h3 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">Pro</h3>
                      <Sparkles className="w-5 h-5 md:w-7 md:h-7 text-[#9B87E8] animate-pulse" />
                    </div>
                    <p className="text-sm md:text-base text-muted-foreground">Unlock all premium features</p>
                  </div>
                  {subscription.tier === "pro" && (
                    <Badge className="bg-[#B8E6D5] text-gray-800 border-[#B8E6D5] text-sm px-4 py-1.5 shadow-sm">
                      Current Plan
                    </Badge>
                  )}
                </div>

                <div className="mb-6 md:mb-8">
                  {selectedPlan === 'monthly' ? (
                    <>
                      <div className="flex items-baseline gap-2 mb-2 md:mb-3">
                        <span className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">
                          {offerings.monthly?.priceString || '$3.99'}
                        </span>
                        <span className="text-lg md:text-xl text-muted-foreground">/month</span>
                      </div>
                      <p className="text-sm md:text-base text-muted-foreground">Billed monthly, cancel anytime</p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2 mb-2 md:mb-3">
                        <span className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">
                          {offerings.yearly?.priceString || '$39.99'}
                        </span>
                        <span className="text-lg md:text-xl text-muted-foreground">/year</span>
                      </div>
                      <div className="flex items-center gap-2 md:gap-3 mb-2">
                        <p className="text-sm md:text-base text-muted-foreground">
                          Billed annually
                        </p>
                        {savings > 0 && (
                          <Badge className="bg-gradient-to-r from-[#B8E6D5] to-[#C9E4F7] text-gray-800 text-xs font-bold px-2 md:px-3 py-1 shadow-sm">
                            Save {savings}%
                          </Badge>
                        )}
                      </div>
                      {offerings.yearly && offerings.monthly && (
                        <p className="text-sm md:text-base font-semibold text-[#9B87E8]">
                          ${((parseFloat(offerings.yearly.price) / 12).toFixed(2))} per month
                        </p>
                      )}
                    </>
                  )}
                </div>

                <ul className="space-y-3 md:space-y-4 mb-8 md:mb-10">
                  {proTierFeatures.map((feature, index) => (
                    <li
                      key={index}
                      className={cn(
                        "flex items-start gap-4 group",
                        feature.isHeader && "pt-4 border-t border-[#9B87E8]/30 dark:border-[#9B87E8]/40 mt-2"
                      )}
                    >
                      <div className={cn(
                        "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 transition-all duration-200",
                        feature.highlight
                          ? "bg-gradient-to-br from-[#9B87E8] to-[#D4C5F9] shadow-md group-hover:scale-110 group-hover:shadow-lg"
                          : "bg-[#B8E6D5] dark:bg-[#5A8A7A] group-hover:scale-110"
                      )}>
                        <feature.icon className={cn(
                          "w-4 h-4",
                          feature.highlight ? "text-white" : "text-gray-800 dark:text-gray-100"
                        )} />
                      </div>
                      <span className={cn(
                        "text-base transition-colors",
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
                    className="w-full bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] hover:from-[#8B77D8] hover:to-[#C4B5E9] text-white shadow-xl hover:shadow-2xl transition-all duration-300 text-base md:text-lg font-bold py-6 md:py-7 hover:scale-[1.02] active:scale-[0.98]"
                    disabled={
                      subscription.tier === "pro" || isUpgrading
                    }
                    onClick={handleUpgrade}
                  >
                    {isUpgrading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Processing...
                      </span>
                    ) : subscription.tier === "pro" ? (
                      "Current Plan"
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Sparkles className="w-5 h-5" />
                        Upgrade to Pro
                      </span>
                    )}
                  </Button>

                  {/* Show Restore button for native platforms */}
                  {platform.isNative &&
                    subscription.tier !== "pro" && (
                      <Button
                        variant="outline"
                        className="w-full border-2 border-[#9B87E8]/40 text-[#9B87E8] hover:bg-[#9B87E8]/10 text-base py-6 font-semibold transition-all duration-200 hover:scale-[1.02]"
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

          {/* Footer Note - Desktop Optimized */}
          <div className="mt-8 md:mt-10 p-4 md:p-6 bg-gradient-to-r from-[#E6D5F0]/40 via-[#C9E4F7]/40 to-[#B8E6D5]/40 dark:from-[#4A4A5E]/60 dark:via-[#3E3E52]/60 dark:to-[#3E3E52]/60 rounded-xl md:rounded-2xl border-2 border-[#9B87E8]/30 shadow-lg backdrop-blur-sm">
            <p className="text-sm md:text-base text-center text-gray-700 dark:text-gray-300 leading-relaxed">
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
