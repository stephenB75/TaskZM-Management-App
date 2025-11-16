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
  DEFAULT_CURRENCY_CODE,
  DEFAULT_MONTHLY_TITLE,
  DEFAULT_YEARLY_TITLE,
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

  // Get user from auth context for RevenueCat configuration
  const { user } = useAuth();

  // Load offerings when dialog opens and refresh periodically
  React.useEffect(() => {
    if (open) {
      // Ensure RevenueCat is configured before loading offerings
      const ensureConfigured = async () => {
        const { configureRevenueCat, isRevenueCatConfigured } = await import('../lib/revenuecat');
        
        // Try to configure if not already configured and we have a user
        if (!isRevenueCatConfigured() && user?.id) {
          console.log('🔄 RevenueCat not configured, attempting to configure...');
          try {
            await configureRevenueCat(user.id);
          } catch (error) {
            console.warn('Failed to configure RevenueCat:', error);
          }
        }
        
        loadOfferings();
      };
      ensureConfigured();

      // Refresh offerings every 30 seconds while dialog is open
      const refreshInterval = setInterval(() => {
        console.log('🔄 Refreshing offerings from RevenueCat...');
        loadOfferings();
      }, 30000);

      return () => {
        clearInterval(refreshInterval);
      };
    }
  }, [open, user?.id]);

  // Also refresh offerings when subscription changes
  React.useEffect(() => {
    if (open && subscription.tier) {
      console.log('🔄 Subscription tier changed, refreshing offerings...');
      loadOfferings();
    }
  }, [subscription.tier, open]);

  const loadOfferings = async () => {
    try {
      // Check if RevenueCat is configured first
      const { isRevenueCatConfigured, getCurrentUserId } = await import('../lib/revenuecat');
      
      const configured = isRevenueCatConfigured();
      const userId = getCurrentUserId();
      
      console.log('🔍 RevenueCat Status Check:');
      console.log('   isConfigured:', configured);
      console.log('   currentUserId:', userId);
      console.log('   currentUser:', user?.id);
      
      if (!configured) {
        console.log('ℹ️  RevenueCat not configured yet');
        console.log('   Configuration should happen automatically on login');
        console.log('   Attempting to configure now...');
        
        // Try to configure if we have a user
        if (user?.id) {
          const { configureRevenueCat } = await import('../lib/revenuecat');
          try {
            await configureRevenueCat(user.id);
            console.log('✅ Configuration attempt completed');
          } catch (configError) {
            console.error('❌ Configuration failed:', configError);
          }
        } else {
          console.warn('⚠️  No user ID available for configuration');
        }
        
        setRevenueCatStatus({
          connected: false,
          packagesLoaded: 0,
          lastChecked: new Date().toISOString(),
        });
        return;
      }
      
      console.log('🔄 Loading offerings from RevenueCat...');
      const rcOfferings = await getOfferings();
      
      if (rcOfferings?.availablePackages && rcOfferings.availablePackages.length > 0) {
        console.log('✅ RevenueCat connected! Packages found:', rcOfferings.availablePackages.length);
        
        // Filter out packages without products and log them
        const validPackages = rcOfferings.availablePackages.filter((p: any) => p && p.product);
        const invalidPackages = rcOfferings.availablePackages.filter((p: any) => !p || !p.product);
        
        if (invalidPackages.length > 0) {
          console.warn('⚠️ Found packages without products:', invalidPackages.map((p: any) => p?.identifier || 'unknown'));
        }
        
        console.log('📦 All valid packages:', validPackages.map((p: any) => ({
          identifier: p.identifier,
          price: p.product?.priceString || 'N/A',
          title: p.product?.title || 'N/A'
        })));

        // Find monthly and yearly packages (only from valid packages)
        const monthlyPkg = validPackages.find(
          (pkg: any) => pkg && MONTHLY_PACKAGE_IDENTIFIERS.includes(pkg.identifier)
        );
        const yearlyPkg = validPackages.find(
          (pkg: any) => pkg && YEARLY_PACKAGE_IDENTIFIERS.includes(pkg.identifier)
        );

        console.log('📅 Monthly package:', monthlyPkg ? {
          identifier: monthlyPkg.identifier,
          price: monthlyPkg.product?.priceString || 'N/A',
          title: monthlyPkg.product?.title || 'N/A'
        } : 'NOT FOUND');
        console.log('📅 Yearly package:', yearlyPkg ? {
          identifier: yearlyPkg.identifier,
          price: yearlyPkg.product?.priceString || 'N/A',
          title: yearlyPkg.product?.title || 'N/A'
        } : 'NOT FOUND');

        setOfferings({
          monthly: monthlyPkg && monthlyPkg.product ? {
            price: monthlyPkg.product.price?.toString() || '0',
            priceString: monthlyPkg.product.priceString || DEFAULT_MONTHLY_PRICE,
            currencyCode: monthlyPkg.product.currencyCode || DEFAULT_CURRENCY_CODE,
            identifier: monthlyPkg.identifier,
            title: monthlyPkg.product.title || DEFAULT_MONTHLY_TITLE,
            description: monthlyPkg.product.description || '',
          } : undefined,
          yearly: yearlyPkg && yearlyPkg.product ? {
            price: yearlyPkg.product.price?.toString() || '0',
            priceString: yearlyPkg.product.priceString || DEFAULT_YEARLY_PRICE,
            currencyCode: yearlyPkg.product.currencyCode || DEFAULT_CURRENCY_CODE,
            identifier: yearlyPkg.identifier,
            title: yearlyPkg.product.title || DEFAULT_YEARLY_TITLE,
            description: yearlyPkg.product.description || '',
          } : undefined,
        });

        setRevenueCatStatus({
          connected: true,
          packagesLoaded: rcOfferings.availablePackages.length,
          lastChecked: new Date().toISOString(),
        });
        
        // Notify parent component that offerings were updated
        if (onOfferingsUpdated) {
          onOfferingsUpdated();
        }
      } else {
        console.warn('⚠️ RevenueCat returned no packages or empty offerings');
        console.warn('   This could mean:');
        console.warn('   1. No offerings configured in RevenueCat dashboard');
        console.warn('   2. No packages attached to the current offering');
        console.warn('   3. Products not set up in RevenueCat');
        setRevenueCatStatus({
          connected: false,
          packagesLoaded: 0,
          lastChecked: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      console.error('❌ Failed to load offerings from RevenueCat:', error);
      console.error('   Error message:', error.message || error);
      console.error('   Error stack:', error.stack);
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

      // Ensure RevenueCat is configured before attempting purchase
      const { isRevenueCatConfigured, configureRevenueCat, getOfferings } = await import('../lib/revenuecat');
      
      if (!isRevenueCatConfigured() && user?.id) {
        console.log('🔄 RevenueCat not configured, configuring before purchase...');
        try {
          await configureRevenueCat(user.id);
          console.log('✅ RevenueCat configured, proceeding with purchase...');
        } catch (configError: any) {
          console.error('❌ Failed to configure RevenueCat:', configError);
          toast.error('Configuration Error', {
            description: 'Failed to initialize payment system. Please refresh the page and try again.',
          });
          setIsUpgrading(false);
          return;
        }
      } else if (!isRevenueCatConfigured()) {
        console.error('❌ RevenueCat not configured and no user ID available');
        toast.error('Configuration Error', {
          description: 'Please ensure you are logged in and try again.',
        });
        setIsUpgrading(false);
        return;
      }

      // Check if offerings are available before purchase
      console.log('🔍 Checking if offerings are available...');
      const offeringsCheck = await getOfferings();
      if (!offeringsCheck || !offeringsCheck.availablePackages || offeringsCheck.availablePackages.length === 0) {
        console.warn('⚠️ No offerings found, attempting to reload...');
        // Try reloading offerings
        await loadOfferings();
        
        // Check again after reload
        const offeringsCheck2 = await getOfferings();
        if (!offeringsCheck2 || !offeringsCheck2.availablePackages || offeringsCheck2.availablePackages.length === 0) {
          console.error('❌ No offerings available after reload');
          toast.error(SUBSCRIPTION_UI_TEXT.errors.subscriptionNotAvailable, {
            description: SUBSCRIPTION_UI_TEXT.errors.subscriptionNotAvailableCheckDesc,
          });
          setIsUpgrading(false);
          return;
        }
      }

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
          
          // Provide specific error messages based on error type
          let errorTitle = SUBSCRIPTION_UI_TEXT.errors.paymentProcessingUnavailable;
          let errorDescription = SUBSCRIPTION_UI_TEXT.errors.paymentProcessingUnavailableDesc;
          
          if (rcError.message?.includes("No subscription offerings available") || 
              rcError.message?.includes("No subscription packages available")) {
            errorTitle = SUBSCRIPTION_UI_TEXT.errors.subscriptionNotAvailable;
            errorDescription = SUBSCRIPTION_UI_TEXT.errors.subscriptionNotAvailableDesc;
          } else if (rcError.message?.includes("subscription package not found")) {
            errorTitle = SUBSCRIPTION_UI_TEXT.errors.packageNotFound;
            errorDescription = SUBSCRIPTION_UI_TEXT.errors.packageNotFoundDesc;
          }
          
          toast.error(errorTitle, {
            description: errorDescription,
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

      // Ensure RevenueCat is configured before attempting purchase
      const { isRevenueCatConfigured, configureRevenueCat, getOfferings } = await import('../lib/revenuecat');
      
      if (!isRevenueCatConfigured() && user?.id) {
        console.log('🔄 RevenueCat not configured, configuring before purchase...');
        try {
          await configureRevenueCat(user.id);
          console.log('✅ RevenueCat configured, proceeding with purchase...');
        } catch (configError: any) {
          console.error('❌ Failed to configure RevenueCat:', configError);
          toast.error('Configuration Error', {
            description: 'Failed to initialize payment system. Please refresh the page and try again.',
          });
          setIsUpgrading(false);
          return;
        }
      } else if (!isRevenueCatConfigured()) {
        console.error('❌ RevenueCat not configured and no user ID available');
        toast.error('Configuration Error', {
          description: 'Please ensure you are logged in and try again.',
        });
        setIsUpgrading(false);
        return;
      }

      // Check if offerings are available before purchase
      console.log('🔍 Checking if offerings are available...');
      const offeringsCheck = await getOfferings();
      if (!offeringsCheck || !offeringsCheck.availablePackages || offeringsCheck.availablePackages.length === 0) {
        console.warn('⚠️ No offerings found, attempting to reload...');
        // Try reloading offerings
        await loadOfferings();
        
        // Check again after reload
        const offeringsCheck2 = await getOfferings();
        if (!offeringsCheck2 || !offeringsCheck2.availablePackages || offeringsCheck2.availablePackages.length === 0) {
          console.error('❌ No offerings available after reload');
          toast.error(SUBSCRIPTION_UI_TEXT.errors.subscriptionNotAvailable, {
            description: SUBSCRIPTION_UI_TEXT.errors.subscriptionNotAvailableCheckDesc,
          });
          setIsUpgrading(false);
          return;
        }
      }

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
          
          // Provide specific error messages based on error type
          let errorTitle = SUBSCRIPTION_UI_TEXT.errors.paymentProcessingUnavailable;
          let errorDescription = SUBSCRIPTION_UI_TEXT.errors.paymentProcessingUnavailableDesc;
          
          if (rcError.message?.includes("No subscription offerings available") || 
              rcError.message?.includes("No subscription packages available")) {
            errorTitle = SUBSCRIPTION_UI_TEXT.errors.subscriptionNotAvailable;
            errorDescription = SUBSCRIPTION_UI_TEXT.errors.subscriptionNotAvailableDesc;
          } else if (rcError.message?.includes("subscription package not found")) {
            errorTitle = SUBSCRIPTION_UI_TEXT.errors.packageNotFound;
            errorDescription = SUBSCRIPTION_UI_TEXT.errors.packageNotFoundDesc;
          }
          
          toast.error(errorTitle, {
            description: errorDescription,
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
      <DialogContent className="max-w-[95vw] lg:max-w-[980px] max-h-[95vh] overflow-y-auto p-0 md:p-0">
        <div className="p-4 md:p-5 lg:p-7 xl:p-8">
          {/* Header */}
          <div className="mb-5 md:mb-7">
            <DialogHeader className="text-center">
              <DialogTitle className="text-2xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-[#9B87E8] via-[#C9E4F7] to-[#B8E6D5] bg-clip-text text-transparent mb-2">
                {SUBSCRIPTION_UI_TEXT.title}
              </DialogTitle>
              <DialogDescription className="text-sm md:text-base lg:text-lg mt-2 text-muted-foreground">
                {SUBSCRIPTION_UI_TEXT.description}
              </DialogDescription>
            </DialogHeader>

            {/* RevenueCat Connection Status */}
            <div className={`mt-3 p-2 rounded-lg text-center text-xs ${
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 lg:gap-7 max-w-full">
            {/* Free Tier - Spacious Design */}
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
                  <li
                    key={index}
                    className="flex items-start gap-3 group"
                  >
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
                      <h3 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">Pro Monthly</h3>
                      <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-[#9B87E8] animate-pulse" />
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground">Billed monthly</p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">
                      {offerings.monthly?.priceString || DEFAULT_MONTHLY_PRICE}
                    </span>
                    <span className="text-sm md:text-base text-muted-foreground">/month</span>
                  </div>
                  {offerings.monthly?.description && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      {offerings.monthly.description}
                    </p>
                  )}
                </div>

                {/* Features list - compact */}
                <ul className="space-y-2 mb-4 flex-1">
                  {proTierFeatures.slice(0, 4).map((feature, index) => (
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
                    + {proTierFeatures.length - 4} more features
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
                      Processing...
                    </span>
                  ) : subscription.tier === "pro" ? (
                    "Current Plan"
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Sparkles className="w-3 h-3" />
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
              className="relative border-2 border-[#9B87E8] rounded-xl md:rounded-2xl p-4 md:p-5 bg-gradient-to-br from-[#9B87E8]/15 via-[#C9E4F7]/15 to-[#B8E6D5]/15 dark:from-[#9B87E8]/25 dark:via-[#6A8AAA]/15 dark:to-[#5A8A7A]/15 overflow-hidden shadow-2xl hover:shadow-[#9B87E8]/40 transition-all duration-300 flex flex-col"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#9B87E8]/25 to-[#C9E4F7]/25 rounded-bl-full blur-2xl" />
              
              {/* Popular Badge */}
              <div className="absolute top-3 right-3 z-20">
                <Badge className="bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] text-white border-0 shadow-lg px-2 py-0.5 text-xs font-semibold">
                  <Crown className="w-2.5 h-2.5 mr-1" />
                  Best Value
                </Badge>
              </div>

              <div className="relative z-10 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">Pro Yearly</h3>
                      <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-[#9B87E8] animate-pulse" />
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground">Billed annually</p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9] bg-clip-text text-transparent">
                      {offerings.yearly?.priceString || DEFAULT_YEARLY_PRICE}
                    </span>
                    <span className="text-sm md:text-base text-muted-foreground">/year</span>
                  </div>
                  {savings > 0 && (
                    <Badge className="mb-2 bg-gradient-to-r from-[#B8E6D5] to-[#C9E4F7] text-gray-800 text-xs font-bold px-2 py-0.5">
                      Save {savings}%
                    </Badge>
                  )}
                  {offerings.yearly && offerings.monthly && (
                    <p className="text-xs md:text-sm font-semibold text-[#9B87E8]">
                      ${((parseFloat(offerings.yearly.price) / 12).toFixed(2))} per month
                    </p>
                  )}
                  {offerings.yearly?.description && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      {offerings.yearly.description}
                    </p>
                  )}
                </div>

                {/* Features list - compact */}
                <ul className="space-y-2 mb-4 flex-1">
                  {proTierFeatures.slice(0, 4).map((feature, index) => (
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
                    + {proTierFeatures.length - 4} more features
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
                      Processing...
                    </span>
                  ) : subscription.tier === "pro" ? (
                    "Current Plan"
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Sparkles className="w-3 h-3" />
                      Upgrade Yearly
                    </span>
                  )}
                </Button>
              </div>
            </motion.div>
          </div>

          {/* Footer Note - Spacious */}
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

