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
    { icon: Check, text: "Everything in Free", included: true },
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center">
            Choose Your Plan
          </DialogTitle>
          <DialogDescription className="text-center">
            Unlock powerful features to supercharge your
            productivity
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6 mt-6">
          {/* Free Tier */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="border-2 border-gray-200 rounded-xl p-6 bg-white dark:bg-gray-900 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg">Free</h3>
              {subscription.tier === "free" && (
                <Badge
                  variant="outline"
                  className="bg-[#B5E8D3] text-gray-800 border-[#B5E8D3]"
                >
                  Current Plan
                </Badge>
              )}
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl">$0</span>
                <span className="text-gray-500">/month</span>
              </div>
            </div>

            <ul className="space-y-3 mb-6">
              {freeTierFeatures.map((feature, index) => (
                <li
                  key={index}
                  className="flex items-start gap-3"
                >
                  <feature.icon className="w-5 h-5 text-[#B5E8D3] flex-shrink-0 mt-0.5" />
                  <span className="text-sm">
                    {feature.text}
                  </span>
                </li>
              ))}
            </ul>

            <Button
              variant="outline"
              className="w-full"
              disabled={subscription.tier === "free"}
            >
              {subscription.tier === "free"
                ? "Current Plan"
                : "Downgrade"}
            </Button>
          </motion.div>

          {/* Pro Tier */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="border-2 border-[#D4C5F9] rounded-xl p-6 bg-gradient-to-br from-[#D4C5F9]/10 to-[#C9E4F7]/10 dark:from-[#D4C5F9]/5 dark:to-[#C9E4F7]/5 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4C5F9] opacity-10 rounded-bl-full" />

            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="flex items-center gap-2">
                <h3 className="text-lg">Pro</h3>
                <Badge className="bg-[#D4C5F9] text-gray-800 border-[#D4C5F9]">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Popular
                </Badge>
              </div>
              {subscription.tier === "pro" && (
                <Badge
                  variant="outline"
                  className="bg-[#B5E8D3] text-gray-800 border-[#B5E8D3]"
                >
                  Current Plan
                </Badge>
              )}
            </div>

            {/* Plan Toggle */}
            <div className="mb-4 relative z-10">
              <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setSelectedPlan('monthly')}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    selectedPlan === 'monthly'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPlan('yearly')}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    selectedPlan === 'yearly'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  Yearly
                  {offerings.yearly && offerings.monthly && (() => {
                    const monthlyPrice = parseFloat(offerings.monthly.price);
                    const yearlyPrice = parseFloat(offerings.yearly.price);
                    const yearlyEquivalent = monthlyPrice * 12;
                    const savings = yearlyEquivalent > 0 
                      ? Math.round(((yearlyEquivalent - yearlyPrice) / yearlyEquivalent) * 100)
                      : 0;
                    return savings > 0 ? (
                      <span className="ml-1 text-xs text-[#D4C5F9] font-semibold">
                        Save {savings}%
                      </span>
                    ) : null;
                  })()}
                </button>
              </div>
            </div>

            <div className="mb-6 relative z-10">
              {selectedPlan === 'monthly' ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl">
                      {offerings.monthly?.priceString || '$3.99'}
                    </span>
                    <span className="text-gray-500">/month</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Billed monthly, cancel anytime
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl">
                      {offerings.yearly?.priceString || '$39.99'}
                    </span>
                    <span className="text-gray-500">/year</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Billed annually, save {(() => {
                      if (!offerings.monthly || !offerings.yearly) return 0;
                      const monthlyPrice = parseFloat(offerings.monthly.price);
                      const yearlyPrice = parseFloat(offerings.yearly.price);
                      const yearlyEquivalent = monthlyPrice * 12;
                      if (yearlyEquivalent === 0) return 0;
                      return Math.round(((yearlyEquivalent - yearlyPrice) / yearlyEquivalent) * 100);
                    })()}% • Cancel anytime
                  </p>
                  {offerings.yearly && offerings.monthly && (
                    <p className="text-xs text-[#D4C5F9] font-semibold mt-1">
                      ${((parseFloat(offerings.yearly.price) / 12).toFixed(2))} per month
                    </p>
                  )}
                </>
              )}
            </div>

            <ul className="space-y-3 mb-6 relative z-10">
              {proTierFeatures.map((feature, index) => (
                <li
                  key={index}
                  className="flex items-start gap-3"
                >
                  <feature.icon
                    className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                      feature.highlight
                        ? "text-[#D4C5F9]"
                        : "text-gray-400"
                    }`}
                  />
                  <span
                    className={`text-sm ${feature.highlight ? "" : ""}`}
                  >
                    {feature.text}
                  </span>
                </li>
              ))}
            </ul>

            <div className="space-y-3 relative z-10">
              <Button
                className="w-full bg-[#D4C5F9] hover:bg-[#D4C5F9]/90 text-gray-800"
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
                    <Sparkles className="w-4 h-4 mr-2" />
                    Upgrade to Pro
                  </>
                )}
              </Button>

              {/* Show Restore button for native platforms */}
              {platform.isNative &&
                subscription.tier !== "pro" && (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={isRestoring}
                    onClick={handleRestore}
                  >
                    {isRestoring
                      ? "Restoring..."
                      : "Restore Purchases"}
                  </Button>
                )}
            </div>
          </motion.div>
        </div>

        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-xs text-center text-gray-600 dark:text-gray-400">
            💡 All plans include unlimited tasks and seamless
            calendar integration. Upgrade anytime to unlock
            AI-powered scheduling and advanced analytics.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}