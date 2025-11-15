/**
 * Subscription Configuration Constants
 * Centralized configuration for subscription features, pricing, and UI text
 */

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

// Default pricing (fallback when RevenueCat is not available)
export const DEFAULT_MONTHLY_PRICE = "$3.99";
export const DEFAULT_YEARLY_PRICE = "$39.99";

// Package identifiers for RevenueCat
export const MONTHLY_PACKAGE_IDENTIFIERS = ['$rc_monthly', 'monthly'];
export const YEARLY_PACKAGE_IDENTIFIERS = ['$rc_annual', '$rc_yearly', 'annual', 'yearly'];

// UI Text
export const SUBSCRIPTION_UI_TEXT = {
  title: "Choose Your Plan",
  description: "Unlock powerful features to supercharge your productivity",
  free: {
    title: "Free",
    subtitle: "Perfect for getting started",
    price: "$0",
    priceUnit: "/month",
    description: "Forever free, no credit card required",
    button: {
      current: "Current Plan",
      downgrade: "Downgrade to Free",
    },
  },
  pro: {
    title: "Pro",
    subtitle: "Unlock all premium features",
    description: "Billed monthly, cancel anytime",
    descriptionYearly: "Billed annually",
    button: {
      upgrade: "Upgrade to Pro",
      current: "Current Plan",
      cancel: "Cancel Subscription",
      processing: "Processing...",
      cancelling: "Cancelling...",
      downgrading: "Downgrading...",
    },
    badge: {
      popular: "Popular",
      current: "Current",
    },
  },
  toggle: {
    monthly: "Monthly",
    yearly: "Yearly",
  },
  footer: {
    message: "💡 All plans include unlimited tasks and seamless calendar integration.",
    upgradeText: "Upgrade anytime",
    upgradeDescription: "to unlock AI-powered scheduling and advanced analytics.",
  },
  messages: {
    upgradeSuccess: "🎉 Welcome to TaskZM Pro!",
    upgradeSuccessDesc: "You now have access to all premium features.",
    upgradeDevMode: "🎉 Welcome to TaskZM Pro! (Development Mode)",
    upgradeDevModeDesc: "You now have access to all premium features. This is a development-only upgrade.",
    paymentFailed: "Payment failed",
    paymentFailedDesc: "The payment could not be processed. Please check your payment method and try again.",
    subscriptionRestored: "✅ Subscription restored!",
    subscriptionRestoredDesc: "Your Pro features are now active.",
    noActiveSubscription: "No active subscription found",
    noActiveSubscriptionDesc: "If you believe this is an error, please contact support.",
    restoreFailed: "Restore failed",
    restoreFailedDesc: "Please try again later.",
    subscriptionCancelled: "Subscription cancelled",
    subscriptionCancelledDesc: "Your subscription will cancel at the end of your billing period. You can reactivate anytime before then.",
    cancelFailed: "Failed to cancel subscription",
    cancelFailedDesc: "Please try again or contact support.",
    downgradeSuccess: "Downgraded to Free",
    downgradeSuccessDesc: "You've been downgraded to the Free tier. You can upgrade to Pro again anytime.",
    downgradeFailed: "Failed to downgrade subscription",
    downgradeFailedDesc: "Please try again or contact support.",
    cancelWarning: "⚠️ Your subscription will cancel at the end of your billing period. You can reactivate anytime before then.",
  },
  confirmations: {
    cancel: {
      title: "Are you sure you want to cancel your subscription?",
      message: "Your Pro features will remain active until the end of your billing period. You can reactivate anytime before then.",
    },
    downgrade: {
      title: "Are you sure you want to downgrade to Free?",
      messagePrefix: "You will lose access to all Pro features immediately:",
      messageSuffix: "\n\nThis action cannot be undone. You can upgrade again anytime.",
    },
  },
} as const;

// Feature definitions
export interface FeatureDefinition {
  icon: typeof Check;
  text: string;
  included: boolean;
  highlight?: boolean;
  isHeader?: boolean;
}

export const FREE_TIER_FEATURES: FeatureDefinition[] = [
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

export const PRO_TIER_FEATURES: FeatureDefinition[] = [
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

// Pro features list for downgrade confirmation
export const PRO_FEATURES_LIST = [
  "AI Scheduler",
  "Task Hours & Time Tracking",
  "Analytics Dashboard",
  "Calendar Sync",
  "Auto Task Rollover",
  "Pomodoro Timer",
  "Team Collaboration",
];

