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
          // User cancelled or payment failed
          console.log("Purchase cancelled or failed");
          return;
        }
      } catch (rcError: any) {
        // If user cancelled, don't show any message
        if (
          rcError.message?.includes("cancelled") ||
          rcError.userCancelled
        ) {
          return;
        }

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

        // Fall back to simulated upgrade (for development/testing)
        console.log(
          "→ Using simulated upgrade for development",
        );
      }

      // Fallback: Use existing upgrade method (for development/testing)
      await upgradeToPro();
      toast.success("🎉 Welcome to TaskZM Pro!", {
        description:
          "You now have access to all premium features.",
      });
      onOpenChange(false);
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
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0 sm:p-6">
        <div className="p-4 sm:p-6">
          <DialogHeader className="text-center mb-6 sm:mb-8">
            <DialogTitle className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-[#9B87E8] via-[#C9E4F7] to-[#B8E6D5] bg-clip-text text-transparent">
              Choose Your Plan
            </DialogTitle>
            <DialogDescription className="text-base sm:text-lg mt-2 text-muted-foreground">
              Unlock powerful features to supercharge your productivity
            </DialogDescription>
          </DialogHeader>

          {/* Plan Toggle - Only for Pro Plan */}
          <div className="flex justify-center mb-6 sm:mb-8">
            <div className="inline-flex items-center gap-2 p-1.5 bg-gradient-to-r from-[#E6D5F0] to-[#C9E4F7] dark:from-[#4A4A5E] dark:to-[#3E3E52] rounded-xl shadow-sm">
              <button
                type="button"
                onClick={() => setSelectedPlan('monthly')}
                className={cn(
                  "px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-semibold transition-all duration-200",
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
                  "px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-semibold transition-all duration-200 relative",
                  selectedPlan === 'yearly'
                    ? 'bg-white dark:bg-gray-700 text-[#9B87E8] dark:text-[#9B87E8] shadow-md'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                )}
              >
                Yearly
                {savings > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-gradient-to-r from-[#B8E6D5] to-[#C9E4F7] text-gray-800 rounded-full">
                    Save {savings}%
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Plans Grid - Stack on mobile, side-by-side on desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
            {/* Free Tier */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="relative border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-5 sm:p-6 lg:p-8 bg-white dark:bg-gray-900"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Free</h3>
                  <p className="text-sm text-muted-foreground mt-1">Perfect for getting started</p>
                </div>
                {subscription.tier === "free" && (
                  <Badge className="bg-[#B8E6D5] text-gray-800 border-[#B8E6D5] text-xs sm:text-sm px-2 sm:px-3 py-1">
                    Current Plan
                  </Badge>
                )}
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-gray-100">$0</span>
                  <span className="text-lg text-muted-foreground">/month</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">Forever free, no credit card required</p>
              </div>

              <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                {freeTierFeatures.map((feature, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3"
                  >
                    <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#B8E6D5] dark:bg-[#5A8A7A] flex items-center justify-center mt-0.5">
                      <feature.icon className="w-3 h-3 sm:w-4 sm:h-4 text-gray-800 dark:text-gray-100" />
                    </div>
                    <span className="text-sm sm:text-base text-gray-700 dark:text-gray-300">
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                variant="outline"
                className="w-full border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                disabled={subscription.tier === "free"}
              >
                {subscription.tier === "free"
                  ? "Current Plan"
                  : "Downgrade"}
              </Button>
            </motion.div>

            {/* Pro Tier - Featured */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="relative border-2 border-[#9B87E8] rounded-2xl p-5 sm:p-6 lg:p-8 bg-gradient-to-br from-[#9B87E8]/10 via-[#C9E4F7]/10 to-[#B8E6D5]/10 dark:from-[#9B87E8]/20 dark:via-[#6A8AAA]/10 dark:to-[#5A8A7A]/10 overflow-hidden shadow-xl"
            >
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-[#9B87E8]/20 to-[#C9E4F7]/20 rounded-bl-full blur-2xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#B8E6D5]/20 to-[#C9E4F7]/20 rounded-tr-full blur-2xl" />
              
              {/* Popular Badge */}
              <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
                <Badge className="bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] text-white border-0 shadow-lg">
                  <Crown className="w-3 h-3 mr-1" />
                  Popular
                </Badge>
              </div>

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">Pro</h3>
                      <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-[#9B87E8]" />
                    </div>
                    <p className="text-sm text-muted-foreground">Unlock all premium features</p>
                  </div>
                  {subscription.tier === "pro" && (
                    <Badge className="bg-[#B8E6D5] text-gray-800 border-[#B8E6D5] text-xs sm:text-sm px-2 sm:px-3 py-1">
                      Current Plan
                    </Badge>
                  )}
                </div>

                <div className="mb-6">
                  {selectedPlan === 'monthly' ? (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">
                          {offerings.monthly?.priceString || '$3.99'}
                        </span>
                        <span className="text-lg text-muted-foreground">/month</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">Billed monthly, cancel anytime</p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">
                          {offerings.yearly?.priceString || '$39.99'}
                        </span>
                        <span className="text-lg text-muted-foreground">/year</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <p className="text-sm text-muted-foreground">
                          Billed annually
                        </p>
                        {savings > 0 && (
                          <Badge className="bg-gradient-to-r from-[#B8E6D5] to-[#C9E4F7] text-gray-800 text-xs font-semibold">
                            Save {savings}%
                          </Badge>
                        )}
                      </div>
                      {offerings.yearly && offerings.monthly && (
                        <p className="text-sm font-semibold text-[#9B87E8] mt-1">
                          ${((parseFloat(offerings.yearly.price) / 12).toFixed(2))} per month
                        </p>
                      )}
                    </>
                  )}
                </div>

                <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                  {proTierFeatures.map((feature, index) => (
                    <li
                      key={index}
                      className={cn(
                        "flex items-start gap-3",
                        feature.isHeader && "pt-2 border-t border-[#9B87E8]/20 dark:border-[#9B87E8]/30"
                      )}
                    >
                      <div className={cn(
                        "flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center mt-0.5",
                        feature.highlight
                          ? "bg-gradient-to-br from-[#9B87E8] to-[#D4C5F9] shadow-md"
                          : "bg-[#B8E6D5] dark:bg-[#5A8A7A]"
                      )}>
                        <feature.icon className={cn(
                          "w-3 h-3 sm:w-4 sm:h-4",
                          feature.highlight ? "text-white" : "text-gray-800 dark:text-gray-100"
                        )} />
                      </div>
                      <span className={cn(
                        "text-sm sm:text-base",
                        feature.highlight
                          ? "text-gray-900 dark:text-gray-100 font-medium"
                          : "text-gray-700 dark:text-gray-300"
                      )}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="space-y-3">
                  <Button
                    className="w-full bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] hover:from-[#8B77D8] hover:to-[#C4B5E9] text-white shadow-lg hover:shadow-xl transition-all duration-200 text-base sm:text-lg font-semibold py-6 sm:py-7"
                    disabled={
                      subscription.tier === "pro" || isUpgrading
                    }
                    onClick={handleUpgrade}
                  >
                    {isUpgrading ? (
                      "Processing..."
                    ) : subscription.tier === "pro" ? (
                      "Current Plan"
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        Upgrade to Pro
                      </>
                    )}
                  </Button>

                  {/* Show Restore button for native platforms */}
                  {platform.isNative &&
                    subscription.tier !== "pro" && (
                      <Button
                        variant="outline"
                        className="w-full border-[#9B87E8]/30 text-[#9B87E8] hover:bg-[#9B87E8]/10"
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

          {/* Footer Note */}
          <div className="mt-6 sm:mt-8 p-4 sm:p-5 bg-gradient-to-r from-[#E6D5F0]/30 via-[#C9E4F7]/30 to-[#B8E6D5]/30 dark:from-[#4A4A5E]/50 dark:via-[#3E3E52]/50 dark:to-[#3E3E52]/50 rounded-xl border border-[#9B87E8]/20">
            <p className="text-xs sm:text-sm text-center text-gray-700 dark:text-gray-300">
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
