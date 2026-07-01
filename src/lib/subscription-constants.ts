/**
 * Subscription Configuration Constants
 * Centralized configuration for subscription features, pricing, and UI text
 */

import { MILLISECONDS_PER_MINUTE } from './business-constants';

// Default pricing
export const DEFAULT_MONTHLY_PRICE = "$3.99";
export const DEFAULT_YEARLY_PRICE = "$39.99";

// Default currency code
export const DEFAULT_CURRENCY_CODE = "USD";

// Default plan titles
export const DEFAULT_MONTHLY_TITLE = "Monthly Pro";
export const DEFAULT_YEARLY_TITLE = "Yearly Pro";

// RevenueCat Product IDs (from RevenueCat dashboard)
export const REVENUECAT_MONTHLY_PRODUCT_ID = 'prodb18a767009';
export const REVENUECAT_YEARLY_PRODUCT_ID = 'prod7fa9c154cb';

// Number of PRO features (for UI display)
export const PRO_FEATURES_COUNT = 7;

// Number of features to display in plan cards before showing "+ X more features"
export const FEATURES_DISPLAY_LIMIT = 4;

// LocalStorage key prefix for subscription data
export const SUBSCRIPTION_STORAGE_KEY_PREFIX = 'subscription_';

// Subscription sync intervals (in milliseconds)
export const SUBSCRIPTION_SYNC_INTERVAL = 5 * MILLISECONDS_PER_MINUTE; // 5 minutes
export const PRICING_REFRESH_INTERVAL = 1 * MILLISECONDS_PER_MINUTE; // 60 seconds

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
    restoringPurchases: "Restoring purchases...",
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
  errors: {
    paymentProcessingUnavailable: "Payment processing unavailable",
    paymentProcessingUnavailableDesc: "Unable to process payment. Please contact support or try again later.",
    paymentFormError: "Payment Form Error",
    paymentFormErrorDesc: "Unable to open or interact with the payment form. Please check: 1) Stripe is properly configured, 2) Your browser allows popups/modals, 3) No browser extensions are blocking the payment form. If the issue persists, try a different browser or check the browser console for errors.",
    subscriptionNotAvailable: "Subscription Not Available",
    subscriptionNotAvailableDesc: "Subscription packages are not currently available. This may be a configuration issue. Please contact support.",
    packageNotFound: "Package Not Found",
    packageNotFoundDesc: "The requested subscription package was not found. Please contact support.",
    subscriptionNotAvailableCheckDesc: "No subscription packages are currently available. Please try again later or contact support.",
  },
  settings: {
    sectionTitle: "Subscription",
    proBadge: "Pro",
    currentPlan: {
      label: "Current Plan",
      pro: "TaskZM Pro",
      free: "Free Plan",
    },
    subscriptionDetails: {
      started: "Started:",
      expires: "Expires:",
      nextBilling: "Next billing:",
      activeStatus: "Active",
      nextBillingDate: "the next billing date",
    },
    features: {
      sectionTitle: "Your Features:",
      unlimitedTasks: "Unlimited Tasks",
      customTags: "Custom Tags",
      aiScheduler: "AI Scheduler",
      taskHours: "Task Hours (Weekday/Weekend)",
      analytics: "Analytics Dashboard",
      pomodoroTimer: "Pomodoro Timer",
      teamCollaboration: "Team Collaboration",
      calendarSync: "Calendar Sync",
      autoTaskRollover: "Auto Task Rollover",
      recurringTasks: "Recurring Tasks",
      taskTemplates: "Task Templates",
      taskDependencies: "Task Dependencies",
      multipleWorkspaces: "Multiple Workspaces",
      proBadge: "PRO",
      yearlyBadge: "PRO YEARLY",
    },
    upgradeToPro: "Upgrade to Pro",
    upgradeToProButton: "Upgrade to Pro",
    upgradeToProToUnlock: "Upgrade to Pro to unlock:",
    unlockFeatures: (count: number, price: string) => `Unlock all ${count} PRO features for just ${price}/month`,
    viewPlans: "View Plans",
    subscriptionStatusRefreshed: "Subscription status refreshed",
    subscriptionRefreshFailed: "Failed to refresh subscription",
    subscriptionWillCancel: "Subscription will cancel at period end",
    subscriptionWillCancelDesc: "You can reactivate anytime before the end of your billing period.",
    subscriptionCancelFailed: "Failed to cancel subscription",
    subscriptionCancelFailedDesc: "Please try again or contact support.",
    manageSubscription: "Manage Subscription",
    cancelConfirmation: "Are you sure you want to cancel your subscription? Your Pro features will remain active until the end of your billing period.",
    refresh: "Refresh",
    cancel: "Cancel",
    subscriptionCancelled: {
      title: "Subscription Cancelled",
      message: (endDate: string | null | undefined) => {
        const dateText = endDate ? new Date(endDate).toLocaleDateString() : 'the next billing date';
        return `Your subscription will remain active until ${dateText}. You'll continue to have access to all Pro features until then.`;
      },
    },
  },
  context: {
    upgradedDevMode: "✅ Upgraded to Pro tier (Development Mode)",
    upgradeFailed: "Failed to upgrade subscription",
    upgradeNotAllowedProduction: "Direct upgrade not allowed in production. Payment verification required.",
    subscriptionWillCancelAtPeriodEnd: "Subscription will cancel at period end",
    cancelFailed: "Failed to cancel subscription",
    downgradedToFree: "✅ Downgraded to Free tier",
    downgradeFailed: "Failed to downgrade subscription",
    hookError: "useSubscription must be used within a SubscriptionProvider",
  },
  planCards: {
    loading: "Loading pricing...",
    monthly: {
      title: "Pro Monthly",
      billingPeriod: "Billed monthly",
      notAvailable: "Monthly subscription not available",
      button: {
        processing: "Processing...",
        current: "Current Plan",
        upgrade: "Upgrade Monthly",
        switch: "Switch to Monthly",
      },
    },
    yearly: {
      title: "Pro Yearly",
      billingPeriod: "Billed annually",
      badge: "Best Value",
      notAvailable: "Yearly subscription not available",
      savingsLabel: (percent: number, amount?: number) => {
        if (amount !== undefined && amount > 0) {
          return `Save ${percent}% ($${amount.toFixed(2)})`;
        }
        return `Save ${percent}%`;
      },
      perMonthLabel: (price: string) => `$${price} per month`,
      button: {
        processing: "Processing...",
        current: "Current Plan",
        upgrade: "Upgrade Yearly",
        switch: "Switch to Yearly",
      },
    },
    priceUnits: {
      month: "/month",
      year: "/year",
    },
    moreFeaturesLabel: "more features",
  },
  configuration: {
    errorTitle: "Configuration Error",
    initializationFailed: "Failed to initialize payment system. Please refresh the page and try again.",
    loginRequired: "Please ensure you are logged in and try again.",
  },
  upgrade: {
    failed: "Upgrade failed",
    failedDesc: "Please try again or contact support.",
    monthlyNotAvailable: "Monthly subscription is not currently available. Only yearly subscription is available.",
    yearlyNotAvailable: "Yearly subscription is not currently available.",
  },
  upgradePrompt: {
    unlock: (feature: string) => `Unlock ${feature}`,
    specialOffer: "✨ Special Offer:",
    getProFeatures: (price: string) => `Get all Pro features for just ${price}`,
    maybeLater: "Maybe Later",
    upgradeToPro: "Upgrade to Pro",
    proFeature: "Pro Feature",
    proFeaturePrice: (price: string) => `${price}/month`,
  },
  native: {
    billingNotice:
      'Payment is processed securely through the App Store or Google Play. Manage or cancel your subscription in your device settings.',
    restorePurchasesHint: 'Already subscribed? Use Restore Purchases below.',
  },
} as const;

// Feature definitions
export interface FeatureDefinition {
  icon: string; // Icon name for use with Icon component
  text: string;
  included: boolean;
  highlight?: boolean;
  isHeader?: boolean;
}

export const FREE_TIER_FEATURES: FeatureDefinition[] = [
  { icon: "check", text: "Unlimited tasks", included: true },
  {
    icon: "calendar",
    text: "7-Day Kanban & Month View",
    included: true,
  },
  {
    icon: "tag",
    text: "Custom Tags & Organization",
    included: true,
  },
  {
    icon: "sparkles",
    text: "Limited AI Scheduler (3 suggestions/week)",
    included: true,
    highlight: true,
  },
  {
    icon: "timer",
    text: "Basic Pomodoro Timer",
    included: true,
  },
];

export const PRO_MONTHLY_FEATURES: FeatureDefinition[] = [
  { icon: "check", text: "Everything in Free", included: true, isHeader: true },
  {
    icon: "sparkles",
    text: "Unlimited AI Scheduler",
    included: true,
    highlight: true,
  },
  {
    icon: "calendar",
    text: "Calendar Sync (1 calendar connection)",
    included: true,
    highlight: true,
  },
  {
    icon: "zap",
    text: "Task Hours & Time Tracking",
    included: true,
    highlight: true,
  },
  {
    icon: "rotate-ccw",
    text: "Auto Task Rollover",
    included: true,
    highlight: true,
  },
  {
    icon: "timer",
    text: "Advanced Pomodoro (history, stats, custom intervals)",
    included: true,
    highlight: true,
  },
  {
    icon: "bar-chart",
    text: "Analytics Dashboard (30-day history)",
    included: true,
    highlight: true,
  },
  {
    icon: "repeat",
    text: "Recurring Tasks (up to 5 active recurring tasks)",
    included: true,
    highlight: true,
  },
];

export const PRO_YEARLY_FEATURES: FeatureDefinition[] = [
  { icon: "check", text: "Everything in Pro Monthly", included: true, isHeader: true },
  {
    icon: "repeat",
    text: "Unlimited Recurring Tasks (remove 5-task limit)",
    included: true,
    highlight: true,
  },
  {
    icon: "calendar",
    text: "Unlimited Calendar Connections (remove 1-calendar limit)",
    included: true,
    highlight: true,
  },
  {
    icon: "users",
    text: "Team Collaboration (unlimited members, role-based access)",
    included: true,
    highlight: true,
  },
  {
    icon: "bar-chart",
    text: "Unlimited Analytics History (lifetime data retention)",
    included: true,
    highlight: true,
  },
  {
    icon: "file-text",
    text: "Task Templates (save and reuse task patterns)",
    included: true,
    highlight: true,
  },
  {
    icon: "link",
    text: "Task Dependencies (link related tasks, project workflows)",
    included: true,
    highlight: true,
  },
  {
    icon: "folder-tree",
    text: "Multiple Workspaces (organize by department/project)",
    included: true,
    highlight: true,
  },
  {
    icon: "crown",
    text: "Priority Support & Early Access to New Features",
    included: true,
    highlight: true,
  },
];

// Legacy: Keep PRO_TIER_FEATURES for backward compatibility (combines Monthly + Yearly)
export const PRO_TIER_FEATURES: FeatureDefinition[] = [
  ...PRO_MONTHLY_FEATURES,
  ...PRO_YEARLY_FEATURES.filter(f => !f.isHeader),
];

// Pro features list for downgrade confirmation
export const PRO_MONTHLY_FEATURES_LIST = [
  "Unlimited AI Scheduler",
  "Calendar Sync (1 calendar)",
  "Task Hours & Time Tracking",
  "Auto Task Rollover",
  "Advanced Pomodoro Timer",
  "Analytics Dashboard (30-day history)",
  "Recurring Tasks (up to 5 active)",
];

export const PRO_YEARLY_FEATURES_LIST = [
  "Unlimited Recurring Tasks",
  "Unlimited Calendar Connections",
  "Team Collaboration (unlimited members)",
  "Unlimited Analytics History",
  "Task Templates",
  "Task Dependencies",
  "Multiple Workspaces",
  "Priority Support & Early Access",
];

// Legacy: Keep for backward compatibility
export const PRO_FEATURES_LIST = PRO_YEARLY_FEATURES_LIST;

