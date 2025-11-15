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
  const [offerings, setOfferings] = React.useState<{
    monthly?: { price: string; priceString: string; currencyCode: string; identifier: string; title: string; description: string };
    yearly?: { price: string; priceString: string; currencyCode: string; identifier: string; title: string; description: string };
  }>({});
  const [revenueCatStatus, setRevenueCatStatus] = React.useState<{
    connected: boolean;
    packagesLoaded: number;
    lastChecked: string | null;
  }>({ connected: false, packagesLoaded: 0, lastChecked: null });
  const platform = getPlatform();

  // Load offerings when dialog opens
  React.useEffect(() => {
    if (open) {
      loadOfferings();
    }
  }, [open]);

  const loadOfferings = async () => {
    try {
      console.log('🔄 Loading offerings from RevenueCat...');
      const rcOfferings = await getOfferings();
      
      if (rcOfferings?.availablePackages) {
        console.log('✅ RevenueCat connected! Packages found:', rcOfferings.availablePackages.length);
        console.log('📦 All packages:', rcOfferings.availablePackages.map((p: any) => ({
          identifier: p.identifier,
          price: p.product.priceString,
          title: p.product.title
        })));

        // Find monthly and yearly packages
        const monthlyPkg = rcOfferings.availablePackages.find(
          (pkg: any) => MONTHLY_PACKAGE_IDENTIFIERS.includes(pkg.identifier)
        );
        const yearlyPkg = rcOfferings.availablePackages.find(
          (pkg: any) => YEARLY_PACKAGE_IDENTIFIERS.includes(pkg.identifier)
        );

        console.log('📅 Monthly package:', monthlyPkg ? {
          identifier: monthlyPkg.identifier,
          price: monthlyPkg.product.priceString,
          title: monthlyPkg.product.title
        } : 'NOT FOUND');
        console.log('📅 Yearly package:', yearlyPkg ? {
          identifier: yearlyPkg.identifier,
          price: yearlyPkg.product.priceString,
          title: yearlyPkg.product.title
        } : 'NOT FOUND');

        setOfferings({
          monthly: monthlyPkg ? {
            price: monthlyPkg.product.price.toString(),
            priceString: monthlyPkg.product.priceString,
            currencyCode: monthlyPkg.product.currencyCode,
            identifier: monthlyPkg.identifier,
            title: monthlyPkg.product.title || 'Monthly Pro',
            description: monthlyPkg.product.description || '',
          } : undefined,
          yearly: yearlyPkg ? {
            price: yearlyPkg.product.price.toString(),
            priceString: yearlyPkg.product.priceString,
            currencyCode: yearlyPkg.product.currencyCode,
            identifier: yearlyPkg.identifier,
            title: yearlyPkg.product.title || 'Yearly Pro',
            description: yearlyPkg.product.description || '',
          } : undefined,
        });

        setRevenueCatStatus({
          connected: true,
          packagesLoaded: rcOfferings.availablePackages.length,
          lastChecked: new Date().toISOString(),
        });
      } else {
        console.warn('⚠️ RevenueCat returned no packages');
        setRevenueCatStatus({
          connected: false,
          packagesLoaded: 0,
          lastChecked: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('❌ Failed to load offerings from RevenueCat:', error);
      setRevenueCatStatus({
        connected: false,
        packagesLoaded: 0,
        lastChecked: new Date().toISOString(),
      });
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

  const handleUpgradeMonthly = async () => {
    try {
      setIsUpgrading(true);
      const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';
      const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

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
          toast.error("Payment processing unavailable", {
            description: "Unable to process payment. Please contact support or try again later.",
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

        toast.error("Upgrade failed", {
          description: rcError.message || "Please try again or contact support.",
        });
        setIsUpgrading(false);
      }
    } catch (error: any) {
      console.error("Monthly upgrade error:", error);
      toast.error("Upgrade failed", {
        description: error.message || "Please try again or contact support.",
      });
      setIsUpgrading(false);
    }
  };

  const handleUpgradeYearly = async () => {
    try {
      setIsUpgrading(true);
      const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';
      const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

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
          toast.error("Payment processing unavailable", {
            description: "Unable to process payment. Please contact support or try again later.",
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

        toast.error("Upgrade failed", {
          description: rcError.message || "Please try again or contact support.",
        });
        setIsUpgrading(false);
      }
    } catch (error: any) {
      console.error("Yearly upgrade error:", error);
      toast.error("Upgrade failed", {
        description: error.message || "Please try again or contact support.",
      });
      setIsUpgrading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] lg:max-w-[1400px] max-h-[95vh] overflow-y-auto p-0 md:p-0">
        <div className="p-6 md:p-8 lg:p-10 xl:p-12">
          {/* Header */}
          <div className="mb-8 md:mb-10">
            <DialogHeader className="text-center">
              <DialogTitle className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-[#9B87E8] via-[#C9E4F7] to-[#B8E6D5] bg-clip-text text-transparent mb-2">
                {SUBSCRIPTION_UI_TEXT.title}
              </DialogTitle>
              <DialogDescription className="text-base md:text-lg lg:text-xl mt-2 text-muted-foreground">
                {SUBSCRIPTION_UI_TEXT.description}
              </DialogDescription>
            </DialogHeader>

            {/* RevenueCat Connection Status */}
            <div className={`mt-4 p-3 rounded-lg text-center text-sm ${
              revenueCatStatus.connected 
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200' 
                : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200'
            }`}>
              {revenueCatStatus.connected ? (
                <span>✅ RevenueCat Connected • {revenueCatStatus.packagesLoaded} package(s) loaded</span>
              ) : (
                <span>⚠️ RevenueCat not connected • Using default pricing</span>
              )}
            </div>
          </div>

          {/* Plans Grid - 3 Columns: Free, Monthly Pro, Yearly Pro */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 lg:gap-10 max-w-full">
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

            {/* Monthly Pro Tier */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="relative border-2 border-[#9B87E8] rounded-2xl md:rounded-3xl p-6 md:p-8 bg-gradient-to-br from-[#9B87E8]/10 via-[#C9E4F7]/10 to-[#B8E6D5]/10 dark:from-[#9B87E8]/20 dark:via-[#6A8AAA]/10 dark:to-[#5A8A7A]/10 overflow-hidden shadow-xl hover:shadow-[#9B87E8]/30 transition-all duration-300 flex flex-col"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-[#9B87E8]/20 to-[#C9E4F7]/20 rounded-bl-full blur-2xl" />
              
              <div className="relative z-10 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">Pro Monthly</h3>
                      <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-[#9B87E8] animate-pulse" />
                    </div>
                    <p className="text-sm md:text-base text-muted-foreground">Billed monthly</p>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">
                      {offerings.monthly?.priceString || DEFAULT_MONTHLY_PRICE}
                    </span>
                    <span className="text-lg md:text-xl text-muted-foreground">/month</span>
                  </div>
                  {offerings.monthly?.description && (
                    <p className="text-xs md:text-sm text-muted-foreground mt-1 italic">
                      {offerings.monthly.description}
                    </p>
                  )}
                </div>

                {/* Features list - compact */}
                <ul className="space-y-3 mb-6 flex-1">
                  {proTierFeatures.slice(0, 4).map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className={cn(
                        "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5",
                        feature.highlight
                          ? "bg-gradient-to-br from-[#9B87E8] to-[#D4C5F9]"
                          : "bg-[#B8E6D5] dark:bg-[#5A8A7A]"
                      )}>
                        <feature.icon className={cn(
                          "w-3 h-3",
                          feature.highlight ? "text-white" : "text-gray-800 dark:text-gray-100"
                        )} />
                      </div>
                      <span className="text-sm md:text-base text-gray-700 dark:text-gray-300">
                        {feature.text}
                      </span>
                    </li>
                  ))}
                  <li className="text-xs md:text-sm text-muted-foreground pt-2">
                    + {proTierFeatures.length - 4} more features
                  </li>
                </ul>

                <Button
                  className="w-full bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] hover:from-[#8B77D8] hover:to-[#C4B5E9] text-white shadow-lg hover:shadow-xl transition-all duration-300 text-sm md:text-base font-bold py-5 md:py-6 hover:scale-[1.01]"
                  disabled={subscription.tier === "pro" || isUpgrading}
                  onClick={handleUpgradeMonthly}
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
                      Upgrade Monthly
                    </span>
                  )}
                </Button>
              </div>
            </motion.div>

            {/* Yearly Pro Tier - Featured */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="relative border-2 border-[#9B87E8] rounded-2xl md:rounded-3xl p-6 md:p-8 bg-gradient-to-br from-[#9B87E8]/15 via-[#C9E4F7]/15 to-[#B8E6D5]/15 dark:from-[#9B87E8]/25 dark:via-[#6A8AAA]/15 dark:to-[#5A8A7A]/15 overflow-hidden shadow-2xl hover:shadow-[#9B87E8]/40 transition-all duration-300 flex flex-col"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-[#9B87E8]/25 to-[#C9E4F7]/25 rounded-bl-full blur-2xl" />
              
              {/* Popular Badge */}
              <div className="absolute top-4 right-4 z-20">
                <Badge className="bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] text-white border-0 shadow-lg px-3 py-1 text-xs font-semibold">
                  <Crown className="w-3 h-3 mr-1" />
                  Best Value
                </Badge>
              </div>

              <div className="relative z-10 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">Pro Yearly</h3>
                      <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-[#9B87E8] animate-pulse" />
                    </div>
                    <p className="text-sm md:text-base text-muted-foreground">Billed annually</p>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">
                      {offerings.yearly?.priceString || DEFAULT_YEARLY_PRICE}
                    </span>
                    <span className="text-lg md:text-xl text-muted-foreground">/year</span>
                  </div>
                  {savings > 0 && (
                    <Badge className="mb-2 bg-gradient-to-r from-[#B8E6D5] to-[#C9E4F7] text-gray-800 text-xs font-bold px-2 py-1">
                      Save {savings}%
                    </Badge>
                  )}
                  {offerings.yearly && offerings.monthly && (
                    <p className="text-sm md:text-base font-semibold text-[#9B87E8]">
                      ${((parseFloat(offerings.yearly.price) / 12).toFixed(2))} per month
                    </p>
                  )}
                  {offerings.yearly?.description && (
                    <p className="text-xs md:text-sm text-muted-foreground mt-1 italic">
                      {offerings.yearly.description}
                    </p>
                  )}
                </div>

                {/* Features list - compact */}
                <ul className="space-y-3 mb-6 flex-1">
                  {proTierFeatures.slice(0, 4).map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className={cn(
                        "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5",
                        feature.highlight
                          ? "bg-gradient-to-br from-[#9B87E8] to-[#D4C5F9]"
                          : "bg-[#B8E6D5] dark:bg-[#5A8A7A]"
                      )}>
                        <feature.icon className={cn(
                          "w-3 h-3",
                          feature.highlight ? "text-white" : "text-gray-800 dark:text-gray-100"
                        )} />
                      </div>
                      <span className="text-sm md:text-base text-gray-700 dark:text-gray-300">
                        {feature.text}
                      </span>
                    </li>
                  ))}
                  <li className="text-xs md:text-sm text-muted-foreground pt-2">
                    + {proTierFeatures.length - 4} more features
                  </li>
                </ul>

                <Button
                  className="w-full bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] hover:from-[#8B77D8] hover:to-[#C4B5E9] text-white shadow-xl hover:shadow-2xl transition-all duration-300 text-sm md:text-base font-bold py-5 md:py-6 hover:scale-[1.01]"
                  disabled={subscription.tier === "pro" || isUpgrading}
                  onClick={handleUpgradeYearly}
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
                      Upgrade Yearly
                    </span>
                  )}
                </Button>
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

