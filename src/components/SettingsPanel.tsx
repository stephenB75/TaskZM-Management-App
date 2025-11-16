import React, { useState, useEffect } from 'react';
import { 
  Moon, Sun, Monitor, User, LogOut, Calendar, Tag, Sparkles, 
  Bell, Clock, RotateCcw, Briefcase, CreditCard, Info, RefreshCw, Trophy, Award, Lock, Compass,
  Target, CheckCircle, Shield, Zap, Crown, Star, Flame, TrendingUp, Activity, Timer, Brain,
  BatteryCharging, Sunrise, Moon as MoonIcon, Calendar as CalendarIcon, Sparkles as SparklesIcon,
  BarChart3, Users, Check, X
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Separator } from './ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { CheckboxSwitch as Switch } from './ui/checkbox-switch';
import { Input } from './ui/input';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTasks } from '../contexts/TaskContext';
import { useAI } from '../contexts/AIContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useCalendar } from '../contexts/CalendarContext';
import { useAwards } from '../contexts/AwardContext';
import { useNotifications } from '../contexts/NotificationContext';
import { PricingDialog } from './PricingDialog';
import { PrivacyPolicyDialog } from './PrivacyPolicyDialog';
import { TermsOfServiceDialog } from './TermsOfServiceDialog';
import { Badge } from './ui/badge';
import { AppHeader } from './AppHeader';
import { toast } from 'sonner';
import { APP_VERSION, VERSION_NAME, VERSION_DATE } from '../lib/version';
import taskzmLogo from '../assets/taskzm-logo.png';
import {
  SETTINGS_PANEL_MOBILE_HEADER_SPACER,
  SETTINGS_PANEL_BOTTOM_PADDING_MOBILE,
  SETTINGS_PANEL_PADDING_TOP,
  SETTINGS_PANEL_CONTAINER_PADDING_SMALL,
  SETTINGS_PANEL_CONTAINER_PADDING_MEDIUM,
  SETTINGS_PANEL_CONTAINER_PADDING_LARGE,
  SETTINGS_PANEL_MAX_WIDTH,
  SETTINGS_PANEL_ACCORDION_ITEM_PADDING_X,
  SETTINGS_PANEL_ACCORDION_ITEM_PADDING_Y_SMALL,
  SETTINGS_PANEL_ACCORDION_ITEM_PADDING_Y_DESKTOP,
  SETTINGS_PANEL_ACCORDION_ITEM_MARGIN_Y,
  SETTINGS_PANEL_ACCORDION_ITEM_MARGIN_Y_MEDIUM,
  SETTINGS_PANEL_ACCORDION_ITEM_MARGIN_Y_DESKTOP,
  SETTINGS_PANEL_ACCORDION_TRIGGER_PADDING_Y,
  SETTINGS_PANEL_ACCORDION_CONTENT_PADDING_BOTTOM,
  SETTINGS_PANEL_ACCORDION_CONTENT_PADDING_TOP,
  SETTINGS_PANEL_ACCORDION_CONTENT_SPACING,
  SETTINGS_PANEL_ICON_SIZE_SMALL,
  SETTINGS_PANEL_ICON_SIZE_MEDIUM,
  SETTINGS_PANEL_ICON_SIZE_LARGE,
  SETTINGS_PANEL_ICON_SIZE_XLARGE,
  SETTINGS_PANEL_ICON_SIZE_EXTRA_SMALL,
  SETTINGS_PANEL_AVATAR_SIZE,
  SETTINGS_PANEL_INPUT_HEIGHT,
  SETTINGS_PANEL_BADGE_HEIGHT,
  SETTINGS_PANEL_GAP_SMALL,
  SETTINGS_PANEL_GAP_MEDIUM,
  SETTINGS_PANEL_GAP_LARGE,
  SETTINGS_PANEL_SPACING_XSMALL,
  SETTINGS_PANEL_SPACING_SMALL,
  SETTINGS_PANEL_SPACING_MEDIUM,
  SETTINGS_PANEL_SPACING_LARGE,
  SETTINGS_PANEL_TEXT_SIZE_XSMALL,
  SETTINGS_PANEL_TEXT_SIZE_SMALL,
  SETTINGS_PANEL_TEXT_SIZE_MEDIUM,
  SETTINGS_PANEL_MARGIN_TOP_XSMALL,
  SETTINGS_PANEL_MARGIN_TOP_SMALL,
  SETTINGS_PANEL_MARGIN_BOTTOM_SMALL,
  SETTINGS_PANEL_MARGIN_BOTTOM_MEDIUM,
  SETTINGS_PANEL_MARGIN_RIGHT_SMALL,
  SETTINGS_PANEL_MARGIN_RIGHT_XSMALL,
  SETTINGS_PANEL_MARGIN_LEFT_SMALL,
  SETTINGS_PANEL_PADDING_SMALL,
  SETTINGS_PANEL_PADDING_MEDIUM,
  SETTINGS_PANEL_PADDING_LARGE,
  SETTINGS_PANEL_PADDING_Y_SMALL,
  SETTINGS_PANEL_TOAST_DURATION_MS,
  SETTINGS_PANEL_TIMEOUT_DELAY_MS,
} from '../lib/layout-constants';
import { NOTIFICATION_TOAST_MESSAGES, NOTIFICATION_PANEL_TEXT } from '../lib/notification-constants';
import { getInitials } from '../lib/utils';
import { DEFAULT_MONTHLY_PRICE, MONTHLY_PACKAGE_IDENTIFIERS, YEARLY_PACKAGE_IDENTIFIERS, SUBSCRIPTION_UI_TEXT, PRO_FEATURES_COUNT, PRICING_REFRESH_INTERVAL } from '../lib/subscription-constants';

interface SettingsPanelProps {
  onStartTour?: () => void;
}

export function SettingsPanel({ onStartTour }: SettingsPanelProps) {
  const { user, signOut, updateProfile, accessToken } = useAuth();
  const { theme, setTheme } = useTheme();
  const { syncWithServer, isSyncing, lastSync, hoursSettings, updateHoursSettings, rolloverSettings, updateRolloverSettings, availableTags, addAvailableTag, removeAvailableTag } = useTasks();
  const { settings: aiSettings, toggleAutoScheduling, togglePriorityBasedScheduling, toggleScheduleUnscheduledTasks } = useAI();
  const { subscription, features, cancelSubscription, refreshSubscription, isLoading: isSubscriptionLoading } = useSubscription();
  const { calendarStatus, isSyncing: isCalendarSyncing, lastSync: lastCalendarSync, connectCalendar, disconnectCalendar, syncAllTasks: syncAllTasksToCalendar } = useCalendar();
  const { awards, earnedAwards, getAwardProgress } = useAwards();
  const { permission, settings: notificationSettings, badgeCount, requestPermission, updateSettings: updateNotificationSettings } = useNotifications();
  const [dayType, setDayType] = useState<'weekday' | 'weekend'>('weekday');
  const [showPricingDialog, setShowPricingDialog] = useState(false);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [profileName, setProfileName] = useState(user?.name || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [hasSeenTour, setHasSeenTour] = useState(false);
  
  // RevenueCat pricing state
  const [currentPricing, setCurrentPricing] = useState<{
    monthly?: string;
    yearly?: string;
    lastUpdated?: string;
  }>({});

  // Load pricing from RevenueCat
  useEffect(() => {
    const loadPricing = async () => {
      try {
        const { getOfferings, isRevenueCatConfigured, configureRevenueCat } = await import('../lib/revenuecat');
        
        // Ensure RevenueCat is configured
        if (!isRevenueCatConfigured() && user?.id) {
          try {
            await configureRevenueCat(user.id);
          } catch (error) {
            console.warn('Failed to configure RevenueCat for pricing:', error);
            return;
          }
        }

        if (!isRevenueCatConfigured()) {
          // Use default pricing if RevenueCat not configured
          setCurrentPricing({
            monthly: DEFAULT_MONTHLY_PRICE,
            lastUpdated: new Date().toISOString(),
          });
          return;
        }

        // Force refresh to get latest packages from RevenueCat
        const offerings = await getOfferings(true);
        if (offerings?.availablePackages && offerings.availablePackages.length > 0) {
          // Filter for packages with valid product data (not just empty objects)
          const hasValidProduct = (p: any) => {
            if (!p || !p.product) return false;
            const productKeys = Object.keys(p.product);
            return productKeys.length > 0 && (p.product.identifier || p.product.priceString || p.product.price);
          };
          const validPackages = offerings.availablePackages.filter(hasValidProduct);
          
          // Use the same robust matching logic as PricingDialog
          let monthlyPkg: any = null;
          let yearlyPkg: any = null;
          
          for (const pkg of validPackages) {
            if (!pkg || !pkg.product) continue;
            
            const identifier = pkg.identifier || '';
            const identifierLower = identifier.toLowerCase();
            const productId = pkg.product.identifier || '';
            const productIdLower = productId.toLowerCase();
            
            // Check if this is a monthly package
            if (!monthlyPkg) {
              const isMonthlyById = MONTHLY_PACKAGE_IDENTIFIERS.some(id => {
                const idLower = id.toLowerCase();
                return identifierLower === idLower || 
                       identifierLower === idLower.replace('$', '') ||
                       identifierLower === idLower.replace('$rc_', 'rc_') ||
                       identifierLower.includes(idLower.replace('$', '')) ||
                       identifierLower.includes(idLower.replace('$rc_', 'rc_'));
              });
              
              const isMonthlyByProductId = MONTHLY_PACKAGE_IDENTIFIERS.some(id => {
                const idLower = id.toLowerCase();
                // Exact match (most reliable)
                if (productIdLower === idLower) return true;
                // Pattern matching for package identifiers
                return productIdLower.includes(idLower.replace('$', '')) ||
                       productIdLower.includes(idLower.replace('$rc_', 'rc_'));
              });
              
              const hasMonthlyKeywords = (identifierLower.includes('month') || 
                                        identifierLower.includes('rc_monthly') ||
                                        productIdLower.includes('month') ||
                                        productIdLower.includes('rc_monthly')) && 
                                       !identifierLower.includes('year') && 
                                       !identifierLower.includes('annual') &&
                                       !productIdLower.includes('year') &&
                                       !productIdLower.includes('annual');
              
              const isMonthlyByMetadata = pkg.product.subscriptionPeriod === 'P1M' || 
                                         pkg.product.subscriptionPeriod === 'MONTH' ||
                                         (pkg.product.subscriptionPeriod && 
                                          pkg.product.subscriptionPeriod.toString().toLowerCase().includes('month'));
              
              if (isMonthlyById || isMonthlyByProductId || hasMonthlyKeywords || isMonthlyByMetadata) {
                monthlyPkg = pkg;
              }
            }
            
            // Check if this is a yearly package
            if (!yearlyPkg) {
              const isYearlyById = YEARLY_PACKAGE_IDENTIFIERS.some(id => {
                const idLower = id.toLowerCase();
                return identifierLower === idLower || 
                       identifierLower === idLower.replace('$', '') ||
                       identifierLower === idLower.replace('$rc_', 'rc_') ||
                       identifierLower.includes(idLower.replace('$', '')) ||
                       identifierLower.includes(idLower.replace('$rc_', 'rc_'));
              });
              
              const isYearlyByProductId = YEARLY_PACKAGE_IDENTIFIERS.some(id => {
                const idLower = id.toLowerCase();
                // Exact match (most reliable)
                if (productIdLower === idLower) return true;
                // Pattern matching for package identifiers
                return productIdLower.includes(idLower.replace('$', '')) ||
                       productIdLower.includes(idLower.replace('$rc_', 'rc_'));
              });
              
              const hasYearlyKeywords = identifierLower.includes('year') || 
                                        identifierLower.includes('annual') ||
                                        identifierLower.includes('rc_yearly') ||
                                        identifierLower.includes('rc_annual') ||
                                        productIdLower.includes('year') ||
                                        productIdLower.includes('annual');
              
              const isYearlyByMetadata = pkg.product.subscriptionPeriod === 'P1Y' || 
                                        pkg.product.subscriptionPeriod === 'YEAR' ||
                                        pkg.product.subscriptionPeriod === 'ANNUAL' ||
                                        (pkg.product.subscriptionPeriod && 
                                         pkg.product.subscriptionPeriod.toString().toLowerCase().includes('year'));
              
              if (isYearlyById || isYearlyByProductId || hasYearlyKeywords || isYearlyByMetadata) {
                yearlyPkg = pkg;
              }
            }
          }

          // Use nullish coalescing to only use defaults if RevenueCat data is truly missing
          setCurrentPricing({
            monthly: monthlyPkg?.product?.priceString ?? DEFAULT_MONTHLY_PRICE,
            yearly: yearlyPkg?.product?.priceString ?? undefined,
            lastUpdated: new Date().toISOString(),
          });
          
          // Log pricing source for debugging
          if (monthlyPkg) {
            console.log('✅ Monthly pricing loaded from RevenueCat:', monthlyPkg.product.priceString);
          } else {
            console.warn('⚠️ Monthly pricing not found, using default:', DEFAULT_MONTHLY_PRICE);
          }
          if (yearlyPkg) {
            console.log('✅ Yearly pricing loaded from RevenueCat:', yearlyPkg.product.priceString);
          }
        } else {
          // Fallback to default pricing
          setCurrentPricing({
            monthly: DEFAULT_MONTHLY_PRICE,
            lastUpdated: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.warn('Failed to load pricing from RevenueCat:', error);
        // Use default pricing on error
        setCurrentPricing({
          monthly: DEFAULT_MONTHLY_PRICE,
          lastUpdated: new Date().toISOString(),
        });
      }
    };

    // Load pricing on mount and when subscription changes
    loadPricing();
    
    // Refresh pricing periodically
    const refreshInterval = setInterval(loadPricing, PRICING_REFRESH_INTERVAL);
    
    return () => {
      clearInterval(refreshInterval);
    };
  }, [user?.id, subscription.tier]);

  // Helper function to get icon component from icon name
  const getAwardIcon = (iconName: string) => {
    const iconMap: Record<string, any> = {
      'target': Target,
      'check-circle': CheckCircle,
      'shield': Shield,
      'zap': Zap,
      'crown': Crown,
      'star': Star,
      'trophy': Trophy,
      'flame': Flame,
      'trending-up': TrendingUp,
      'activity': Activity,
      'award': Award,
      'timer': Timer,
      'brain': Brain,
      'battery-charging': BatteryCharging,
      'sunrise': Sunrise,
      'moon': MoonIcon,
      'calendar': CalendarIcon,
      'sparkles': SparklesIcon,
    };
    return iconMap[iconName] || Target;
  };

  // Check if user has seen tour on mount and when storage changes
  useEffect(() => {
    const checkTourStatus = () => {
      try {
        const tourCompleted = window?.localStorage?.getItem('taskzm_tour_completed');
        setHasSeenTour(tourCompleted === 'true');
      } catch (error) {
        console.warn('Unable to access localStorage for tour status:', error);
        setHasSeenTour(false);
      }
    };

    checkTourStatus();

    // Listen for storage changes
    const handler = () => checkTourStatus();
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // Sync profileName with user changes
  useEffect(() => {
    if (user?.name) {
      setProfileName(user.name);
    }
  }, [user?.name]);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setIsUpdatingProfile(true);
      const trimmedName = profileName.trim();
      
      if (!trimmedName) {
        toast.error('Name cannot be empty');
        return;
      }

      if (trimmedName === user?.name) {
        toast.info('No changes to save');
        return;
      }

      await updateProfile({ name: trimmedName });
      toast.success('Profile updated successfully');
    } catch (error) {
      // Error handled by toast notification
      toast.error('Failed to update profile');
      // Reset to original value on error
      setProfileName(user?.name || '');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleAddTag = () => {
    const tagName = newTagInput.trim();
    if (tagName) {
      // Prevent adding "urgent" tag
      if (tagName.toLowerCase() === 'urgent') {
        toast.error('Cannot add "urgent" tag', {
          description: 'The "urgent" tag is reserved and cannot be added.',
        });
        setNewTagInput('');
        return;
      }
      addAvailableTag(tagName);
      setNewTagInput('');
    }
  };

  // Protected tags that cannot be deleted
  const PROTECTED_TAGS = ['Work', 'Personal', 'Projects', 'Business'];
  
  // Automatically remove "urgent" tag if it exists (on component mount and when tags change)
  useEffect(() => {
    const urgentTag = availableTags.find(t => t.toLowerCase() === 'urgent');
    if (urgentTag) {
      // Remove "urgent" tag silently (it's being filtered out anyway)
      removeAvailableTag(urgentTag).catch(() => {
        // Ignore errors - tag will be filtered from display anyway
      });
    }
  }, [availableTags, removeAvailableTag]);
  
  const handleRemoveTag = (tag: string) => {
    // Don't allow removing "urgent" tag through UI (it's already filtered)
    if (tag.toLowerCase() === 'urgent') {
      return;
    }
    removeAvailableTag(tag);
  };
  
  const isProtectedTag = (tag: string) => PROTECTED_TAGS.includes(tag);

  const handleStartTour = () => {
    if (onStartTour) {
      onStartTour();
      toast.info('Starting app tour...', {
        description: 'Let us show you around TaskZM!'
      });
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-[#E4E0EF] to-[#DCD6EB] dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
      <AppHeader
        title="Settings"
        panelOpen={true}
        isSidePanelHeader={true}
        description="Customize your task manager"
        hideDesktopLogo
        actions={
          onStartTour ? (
            <Button
              size="sm"
              variant="outline"
              className="flex items-center"
              style={{ gap: SETTINGS_PANEL_GAP_SMALL }}
              onClick={handleStartTour}
            >
              <Compass style={{ width: SETTINGS_PANEL_ICON_SIZE_MEDIUM, height: SETTINGS_PANEL_ICON_SIZE_MEDIUM }} />
              Start Tour
            </Button>
          ) : null
        }
      />
      {/* Spacer for fixed header on mobile */}
      <div className="md:hidden" style={{ height: SETTINGS_PANEL_MOBILE_HEADER_SPACER }} />
      <div
        className="flex-1 overflow-y-auto overscroll-y-contain"
        style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        <div 
          className="mx-auto" 
          style={{ 
            padding: SETTINGS_PANEL_CONTAINER_PADDING_SMALL,
            paddingLeft: SETTINGS_PANEL_CONTAINER_PADDING_MEDIUM,
            paddingRight: SETTINGS_PANEL_CONTAINER_PADDING_MEDIUM,
            paddingTop: SETTINGS_PANEL_CONTAINER_PADDING_LARGE,
            paddingBottom: SETTINGS_PANEL_CONTAINER_PADDING_LARGE,
          }}
        >
          <div 
            className="mx-auto" 
            style={{ 
              maxWidth: SETTINGS_PANEL_MAX_WIDTH,
              paddingBottom: SETTINGS_PANEL_BOTTOM_PADDING_MOBILE, 
              paddingTop: SETTINGS_PANEL_PADDING_TOP 
            }}
          >
          <Accordion type="single" collapsible className="w-full">
        {/* User Profile */}
        <AccordionItem 
          value="user-profile" 
          className="border rounded-lg bg-card md:my-4"
          style={{
            paddingLeft: SETTINGS_PANEL_ACCORDION_ITEM_PADDING_X,
            paddingRight: SETTINGS_PANEL_ACCORDION_ITEM_PADDING_X,
            paddingTop: SETTINGS_PANEL_ACCORDION_ITEM_PADDING_Y_SMALL,
            paddingBottom: SETTINGS_PANEL_ACCORDION_ITEM_PADDING_Y_SMALL,
            marginTop: SETTINGS_PANEL_ACCORDION_ITEM_MARGIN_Y,
            marginBottom: SETTINGS_PANEL_ACCORDION_ITEM_MARGIN_Y,
          }}
        >
          <AccordionTrigger className="hover:no-underline" style={{ paddingTop: SETTINGS_PANEL_ACCORDION_TRIGGER_PADDING_Y, paddingBottom: SETTINGS_PANEL_ACCORDION_TRIGGER_PADDING_Y }}>
            <div className="flex items-center" style={{ gap: SETTINGS_PANEL_GAP_MEDIUM }}>
              <div 
                className="rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold"
                style={{ 
                  width: '2rem', 
                  height: '2rem',
                  fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL
                }}
              >
                {getInitials(user?.name)}
              </div>
              <span>User Profile</span>
            </div>
          </AccordionTrigger>
          <AccordionContent 
            style={{ 
              paddingBottom: SETTINGS_PANEL_ACCORDION_CONTENT_PADDING_BOTTOM,
              paddingTop: SETTINGS_PANEL_ACCORDION_CONTENT_PADDING_TOP,
              gap: SETTINGS_PANEL_ACCORDION_CONTENT_SPACING
            }}
          >
            <div className="flex items-center" style={{ gap: SETTINGS_PANEL_GAP_LARGE }}>
              <div 
                className="rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-primary font-semibold shadow-sm"
                style={{ 
                  width: SETTINGS_PANEL_AVATAR_SIZE, 
                  height: SETTINGS_PANEL_AVATAR_SIZE,
                  fontSize: '1.5rem'
                }}
              >
                {getInitials(user?.name)}
              </div>
              <div className="flex-1" style={{ gap: SETTINGS_PANEL_SPACING_XSMALL }}>
                <div style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_MEDIUM }}>{user?.name}</div>
                <div className="text-muted-foreground" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>{user?.email}</div>
              </div>
            </div>
            
            <Separator />
            
            <div style={{ gap: SETTINGS_PANEL_SPACING_MEDIUM }}>
              <div style={{ gap: SETTINGS_PANEL_SPACING_SMALL }}>
                <Label htmlFor="name" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>Name</Label>
                <Input 
                  id="name" 
                  value={profileName} 
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Enter your name"
                  style={{ height: SETTINGS_PANEL_INPUT_HEIGHT }}
                />
              </div>
              <div style={{ gap: SETTINGS_PANEL_SPACING_SMALL }}>
                <Label htmlFor="email" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>Email</Label>
                <Input 
                  id="email" 
                  value={user?.email || ''} 
                  disabled 
                  style={{ height: SETTINGS_PANEL_INPUT_HEIGHT }}
                />
              </div>
            </div>

            {profileName.trim() !== user?.name && (
              <Button 
                size="sm" 
                onClick={handleUpdateProfile} 
                disabled={isUpdatingProfile || !profileName.trim()}
                className="w-full"
              >
                {isUpdatingProfile ? 'Saving...' : 'Save Changes'}
              </Button>
            )}

            <Separator />

            <Button variant="destructive" size="sm" onClick={handleSignOut} className="w-full">
              <LogOut style={{ width: SETTINGS_PANEL_ICON_SIZE_MEDIUM, height: SETTINGS_PANEL_ICON_SIZE_MEDIUM, marginRight: SETTINGS_PANEL_MARGIN_RIGHT_SMALL }} />
              Sign Out
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* Subscription */}
        <AccordionItem 
          value="subscription" 
          className="border rounded-lg bg-card md:my-4"
          style={{
            paddingLeft: SETTINGS_PANEL_ACCORDION_ITEM_PADDING_X,
            paddingRight: SETTINGS_PANEL_ACCORDION_ITEM_PADDING_X,
            paddingTop: SETTINGS_PANEL_ACCORDION_ITEM_PADDING_Y_SMALL,
            paddingBottom: SETTINGS_PANEL_ACCORDION_ITEM_PADDING_Y_SMALL,
            marginTop: SETTINGS_PANEL_ACCORDION_ITEM_MARGIN_Y,
            marginBottom: SETTINGS_PANEL_ACCORDION_ITEM_MARGIN_Y,
          }}
        >
          <AccordionTrigger className="hover:no-underline" style={{ paddingTop: SETTINGS_PANEL_ACCORDION_TRIGGER_PADDING_Y, paddingBottom: SETTINGS_PANEL_ACCORDION_TRIGGER_PADDING_Y }}>
            <div className="flex items-center" style={{ gap: SETTINGS_PANEL_GAP_MEDIUM }}>
              <CreditCard style={{ width: SETTINGS_PANEL_ICON_SIZE_LARGE, height: SETTINGS_PANEL_ICON_SIZE_LARGE }} className="text-primary" />
              <span>{SUBSCRIPTION_UI_TEXT.settings.sectionTitle}</span>
              {subscription.tier === 'pro' && (
                <Badge className="bg-[#D4C5F9] text-gray-800 border-[#D4C5F9]" style={{ marginLeft: SETTINGS_PANEL_MARGIN_LEFT_SMALL }}>
                  <Sparkles style={{ width: SETTINGS_PANEL_ICON_SIZE_SMALL, height: SETTINGS_PANEL_ICON_SIZE_SMALL, marginRight: SETTINGS_PANEL_MARGIN_RIGHT_XSMALL }} />
                  {SUBSCRIPTION_UI_TEXT.settings.proBadge}
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent 
            style={{ 
              paddingBottom: SETTINGS_PANEL_ACCORDION_CONTENT_PADDING_BOTTOM,
              paddingTop: SETTINGS_PANEL_ACCORDION_CONTENT_PADDING_TOP,
              gap: SETTINGS_PANEL_ACCORDION_CONTENT_SPACING
            }}
          >
            <div className="space-y-4 sm:space-y-3 md:space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">{SUBSCRIPTION_UI_TEXT.settings.currentPlan.label}</Label>
                    {isSubscriptionLoading && (
                      <RefreshCw style={{ width: SETTINGS_PANEL_ICON_SIZE_SMALL, height: SETTINGS_PANEL_ICON_SIZE_SMALL }} className="text-muted-foreground animate-spin" />
                    )}
                  </div>
                  <p className="text-muted-foreground" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>
                    {subscription.tier === 'pro' ? SUBSCRIPTION_UI_TEXT.settings.currentPlan.pro : SUBSCRIPTION_UI_TEXT.settings.currentPlan.free}
                  </p>
                  {subscription.tier === 'pro' && subscription.startDate && (
                    <p className="text-muted-foreground/70" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_XSMALL, marginTop: SETTINGS_PANEL_MARGIN_TOP_SMALL }}>
                      {SUBSCRIPTION_UI_TEXT.settings.subscriptionDetails.started} {new Date(subscription.startDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Badge 
                  variant={(subscription.status || 'active') === 'active' ? 'default' : 'secondary'}
                  className={(subscription.status || 'active') === 'active' ? 'bg-[#B5E8D3] text-gray-800 border-[#B5E8D3]' : ''}
                >
                  {subscription.status 
                    ? subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)
                    : SUBSCRIPTION_UI_TEXT.settings.subscriptionDetails.activeStatus
                  }
                </Badge>
              </div>

              {/* Subscription Details for Pro */}
              {subscription.tier === 'pro' && subscription.endDate && (
                <div className="text-xs text-muted-foreground space-y-1">
                  {subscription.cancelAtPeriodEnd ? (
                    <p className="text-amber-600 dark:text-amber-400">
                      {SUBSCRIPTION_UI_TEXT.settings.subscriptionDetails.expires} {new Date(subscription.endDate).toLocaleDateString()}
                    </p>
                  ) : (
                    <p>{SUBSCRIPTION_UI_TEXT.settings.subscriptionDetails.nextBilling} {new Date(subscription.endDate).toLocaleDateString()}</p>
                  )}
                </div>
              )}

              <Separator />

              {/* Features List */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{SUBSCRIPTION_UI_TEXT.settings.features.sectionTitle}</Label>
                <div className="grid gap-2">
                  {/* Unlimited Tasks - Available for all */}
                  <div className="flex items-center" style={{ gap: SETTINGS_PANEL_GAP_SMALL }}>
                    <Check style={{ width: SETTINGS_PANEL_ICON_SIZE_MEDIUM, height: SETTINGS_PANEL_ICON_SIZE_MEDIUM }} className="text-[#B5E8D3]" />
                    <span style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>{SUBSCRIPTION_UI_TEXT.settings.features.unlimitedTasks}</span>
                  </div>

                  {/* Custom Tags - Available for all */}
                  <div className="flex items-center" style={{ gap: SETTINGS_PANEL_GAP_SMALL }}>
                    <Check style={{ width: SETTINGS_PANEL_ICON_SIZE_MEDIUM, height: SETTINGS_PANEL_ICON_SIZE_MEDIUM }} className="text-[#B5E8D3]" />
                    <span style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>{SUBSCRIPTION_UI_TEXT.settings.features.customTags}</span>
                  </div>

                  {/* AI Scheduler - PRO only */}
                  <div className="flex items-center" style={{ gap: SETTINGS_PANEL_GAP_SMALL }}>
                    {features.aiScheduler ? (
                      <Check style={{ width: SETTINGS_PANEL_ICON_SIZE_MEDIUM, height: SETTINGS_PANEL_ICON_SIZE_MEDIUM }} className="text-[#B5E8D3]" />
                    ) : (
                      <X style={{ width: SETTINGS_PANEL_ICON_SIZE_MEDIUM, height: SETTINGS_PANEL_ICON_SIZE_MEDIUM }} className="text-muted-foreground/40" />
                    )}
                    <span className={features.aiScheduler ? '' : 'text-muted-foreground/60'} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>
                      {SUBSCRIPTION_UI_TEXT.settings.features.aiScheduler}
                    </span>
                    {!features.aiScheduler && (
                      <Badge variant="outline" className="ml-auto bg-gradient-to-r from-[#D4C5F9] to-[#B4E4CE] text-primary-foreground border-0" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_XSMALL, paddingLeft: '0.375rem', paddingRight: '0.375rem', paddingTop: '0', paddingBottom: '0', height: SETTINGS_PANEL_BADGE_HEIGHT }}>
                        {SUBSCRIPTION_UI_TEXT.settings.features.proBadge}
                      </Badge>
                    )}
                  </div>

                  {/* Task Hours - PRO only */}
                  <div className="flex items-center" style={{ gap: SETTINGS_PANEL_GAP_SMALL }}>
                    {features.taskHours ? (
                      <Check style={{ width: SETTINGS_PANEL_ICON_SIZE_MEDIUM, height: SETTINGS_PANEL_ICON_SIZE_MEDIUM }} className="text-[#B5E8D3]" />
                    ) : (
                      <X style={{ width: SETTINGS_PANEL_ICON_SIZE_MEDIUM, height: SETTINGS_PANEL_ICON_SIZE_MEDIUM }} className="text-muted-foreground/40" />
                    )}
                    <span className={features.taskHours ? '' : 'text-muted-foreground/60'} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>
                      {SUBSCRIPTION_UI_TEXT.settings.features.taskHours}
                    </span>
                    {!features.taskHours && (
                      <Badge variant="outline" className="ml-auto bg-gradient-to-r from-[#D4C5F9] to-[#B4E4CE] text-primary-foreground border-0" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_XSMALL, paddingLeft: '0.375rem', paddingRight: '0.375rem', paddingTop: '0', paddingBottom: '0', height: SETTINGS_PANEL_BADGE_HEIGHT }}>
                        {SUBSCRIPTION_UI_TEXT.settings.features.proBadge}
                      </Badge>
                    )}
                  </div>

                  {/* Analytics - PRO only */}
                  <div className="flex items-center" style={{ gap: SETTINGS_PANEL_GAP_SMALL }}>
                    {features.analytics ? (
                      <Check style={{ width: SETTINGS_PANEL_ICON_SIZE_MEDIUM, height: SETTINGS_PANEL_ICON_SIZE_MEDIUM }} className="text-[#B5E8D3]" />
                    ) : (
                      <X style={{ width: SETTINGS_PANEL_ICON_SIZE_MEDIUM, height: SETTINGS_PANEL_ICON_SIZE_MEDIUM }} className="text-muted-foreground/40" />
                    )}
                    <span className={features.analytics ? '' : 'text-muted-foreground/60'} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>
                      {SUBSCRIPTION_UI_TEXT.settings.features.analytics}
                    </span>
                    {!features.analytics && (
                      <Badge variant="outline" className="ml-auto bg-gradient-to-r from-[#D4C5F9] to-[#B4E4CE] text-primary-foreground border-0" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_XSMALL, paddingLeft: '0.375rem', paddingRight: '0.375rem', paddingTop: '0', paddingBottom: '0', height: SETTINGS_PANEL_BADGE_HEIGHT }}>
                        {SUBSCRIPTION_UI_TEXT.settings.features.proBadge}
                      </Badge>
                    )}
                  </div>

                  {/* Pomodoro Timer - PRO only */}
                  <div className="flex items-center" style={{ gap: SETTINGS_PANEL_GAP_SMALL }}>
                    {features.pomodoroTimer ? (
                      <Check style={{ width: SETTINGS_PANEL_ICON_SIZE_MEDIUM, height: SETTINGS_PANEL_ICON_SIZE_MEDIUM }} className="text-[#B5E8D3]" />
                    ) : (
                      <X style={{ width: SETTINGS_PANEL_ICON_SIZE_MEDIUM, height: SETTINGS_PANEL_ICON_SIZE_MEDIUM }} className="text-muted-foreground/40" />
                    )}
                    <span className={features.pomodoroTimer ? '' : 'text-muted-foreground/60'} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>
                      {SUBSCRIPTION_UI_TEXT.settings.features.pomodoroTimer}
                    </span>
                    {!features.pomodoroTimer && (
                      <Badge variant="outline" className="ml-auto bg-gradient-to-r from-[#D4C5F9] to-[#B4E4CE] text-primary-foreground border-0" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_XSMALL, paddingLeft: '0.375rem', paddingRight: '0.375rem', paddingTop: '0', paddingBottom: '0', height: SETTINGS_PANEL_BADGE_HEIGHT }}>
                        {SUBSCRIPTION_UI_TEXT.settings.features.proBadge}
                      </Badge>
                    )}
                  </div>

                  {/* Team Features - PRO only */}
                  <div className="flex items-center" style={{ gap: SETTINGS_PANEL_GAP_SMALL }}>
                    {features.teamFeatures ? (
                      <Check style={{ width: SETTINGS_PANEL_ICON_SIZE_MEDIUM, height: SETTINGS_PANEL_ICON_SIZE_MEDIUM }} className="text-[#B5E8D3]" />
                    ) : (
                      <X style={{ width: SETTINGS_PANEL_ICON_SIZE_MEDIUM, height: SETTINGS_PANEL_ICON_SIZE_MEDIUM }} className="text-muted-foreground/40" />
                    )}
                    <span className={features.teamFeatures ? '' : 'text-muted-foreground/60'} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>
                      {SUBSCRIPTION_UI_TEXT.settings.features.teamCollaboration}
                    </span>
                    {!features.teamFeatures && (
                      <Badge variant="outline" className="ml-auto bg-gradient-to-r from-[#D4C5F9] to-[#B4E4CE] text-primary-foreground border-0" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_XSMALL, paddingLeft: '0.375rem', paddingRight: '0.375rem', paddingTop: '0', paddingBottom: '0', height: SETTINGS_PANEL_BADGE_HEIGHT }}>
                        {SUBSCRIPTION_UI_TEXT.settings.features.proBadge}
                      </Badge>
                    )}
                  </div>

                  {/* Calendar Sync - PRO only */}
                  <div className="flex items-center" style={{ gap: SETTINGS_PANEL_GAP_SMALL }}>
                    {features.calendarSync ? (
                      <Check style={{ width: SETTINGS_PANEL_ICON_SIZE_MEDIUM, height: SETTINGS_PANEL_ICON_SIZE_MEDIUM }} className="text-[#B5E8D3]" />
                    ) : (
                      <X style={{ width: SETTINGS_PANEL_ICON_SIZE_MEDIUM, height: SETTINGS_PANEL_ICON_SIZE_MEDIUM }} className="text-muted-foreground/40" />
                    )}
                    <span className={features.calendarSync ? '' : 'text-muted-foreground/60'} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>
                      {SUBSCRIPTION_UI_TEXT.settings.features.calendarSync}
                    </span>
                    {!features.calendarSync && (
                      <Badge variant="outline" className="ml-auto bg-gradient-to-r from-[#D4C5F9] to-[#B4E4CE] text-primary-foreground border-0" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_XSMALL, paddingLeft: '0.375rem', paddingRight: '0.375rem', paddingTop: '0', paddingBottom: '0', height: SETTINGS_PANEL_BADGE_HEIGHT }}>
                        {SUBSCRIPTION_UI_TEXT.settings.features.proBadge}
                      </Badge>
                    )}
                  </div>

                  {/* Task Rollover - PRO only */}
                  <div className="flex items-center" style={{ gap: SETTINGS_PANEL_GAP_SMALL }}>
                    {features.taskRollover ? (
                      <Check style={{ width: SETTINGS_PANEL_ICON_SIZE_MEDIUM, height: SETTINGS_PANEL_ICON_SIZE_MEDIUM }} className="text-[#B5E8D3]" />
                    ) : (
                      <X style={{ width: SETTINGS_PANEL_ICON_SIZE_MEDIUM, height: SETTINGS_PANEL_ICON_SIZE_MEDIUM }} className="text-muted-foreground/40" />
                    )}
                    <span className={features.taskRollover ? '' : 'text-muted-foreground/60'} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>
                      {SUBSCRIPTION_UI_TEXT.settings.features.autoTaskRollover}
                    </span>
                    {!features.taskRollover && (
                      <Badge variant="outline" className="ml-auto bg-gradient-to-r from-[#D4C5F9] to-[#B4E4CE] text-primary-foreground border-0" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_XSMALL, paddingLeft: '0.375rem', paddingRight: '0.375rem', paddingTop: '0', paddingBottom: '0', height: SETTINGS_PANEL_BADGE_HEIGHT }}>
                        {SUBSCRIPTION_UI_TEXT.settings.features.proBadge}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {subscription.tier === 'free' && (
                <>
                  <Separator />
                  <div className="bg-gradient-to-br from-[#D4C5F9]/10 to-[#C9E4F7]/10 border border-[#D4C5F9]/20 rounded-lg p-4">
                    <div className="flex items-start" style={{ gap: SETTINGS_PANEL_GAP_MEDIUM, marginBottom: SETTINGS_PANEL_MARGIN_BOTTOM_MEDIUM }}>
                      <Sparkles className="text-[#D4C5F9] flex-shrink-0" style={{ width: SETTINGS_PANEL_ICON_SIZE_LARGE, height: SETTINGS_PANEL_ICON_SIZE_LARGE, marginTop: SETTINGS_PANEL_MARGIN_TOP_XSMALL }} />
                      <div>
                        <p className="mb-1" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_MEDIUM, marginBottom: SETTINGS_PANEL_MARGIN_BOTTOM_SMALL }}>{SUBSCRIPTION_UI_TEXT.settings.upgradeToPro}</p>
                        <p className="text-muted-foreground" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>
                          {SUBSCRIPTION_UI_TEXT.settings.unlockFeatures(PRO_FEATURES_COUNT, currentPricing.monthly || DEFAULT_MONTHLY_PRICE)}
                        </p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      className="w-full bg-[#D4C5F9] hover:bg-[#D4C5F9]/90 text-gray-800"
                      onClick={() => setShowPricingDialog(true)}
                    >
                      <Sparkles style={{ width: SETTINGS_PANEL_ICON_SIZE_MEDIUM, height: SETTINGS_PANEL_ICON_SIZE_MEDIUM, marginRight: SETTINGS_PANEL_MARGIN_RIGHT_SMALL }} />
                      {SUBSCRIPTION_UI_TEXT.settings.viewPlans}
                    </Button>
                  </div>
                </>
              )}

              {subscription.tier === 'pro' && (
                <>
                  <Separator />
                  
                  {subscription.cancelAtPeriodEnd && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-3">
                      <div className="flex items-start" style={{ gap: SETTINGS_PANEL_GAP_SMALL }}>
                        <Info className="text-amber-600 dark:text-amber-400 flex-shrink-0" style={{ width: SETTINGS_PANEL_ICON_SIZE_MEDIUM, height: SETTINGS_PANEL_ICON_SIZE_MEDIUM, marginTop: SETTINGS_PANEL_MARGIN_TOP_XSMALL }} />
                        <div>
                          <p className="font-medium text-amber-800 dark:text-amber-200" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL, marginBottom: SETTINGS_PANEL_MARGIN_BOTTOM_SMALL }}>
                            {SUBSCRIPTION_UI_TEXT.settings.subscriptionCancelled.title}
                          </p>
                          <p className="text-amber-700 dark:text-amber-300" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>
                            {SUBSCRIPTION_UI_TEXT.settings.subscriptionCancelled.message(subscription.endDate)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => {
                        // Open PricingDialog to show RevenueCat subscription options
                        // This will connect to Stripe for web purchases via RevenueCat
                        setShowPricingDialog(true);
                      }}
                    >
                      <CreditCard style={{ width: SETTINGS_PANEL_ICON_SIZE_MEDIUM, height: SETTINGS_PANEL_ICON_SIZE_MEDIUM, marginRight: SETTINGS_PANEL_MARGIN_RIGHT_SMALL }} />
                      {subscription.tier === 'free' ? SUBSCRIPTION_UI_TEXT.settings.upgradeToPro : SUBSCRIPTION_UI_TEXT.settings.manageSubscription}
                    </Button>

                    <div className="flex" style={{ gap: SETTINGS_PANEL_GAP_SMALL }}>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex-1 text-muted-foreground hover:text-foreground"
                        onClick={async () => {
                          try {
                            await refreshSubscription();
                            toast.success(SUBSCRIPTION_UI_TEXT.settings.subscriptionStatusRefreshed);
                          } catch (error) {
                            toast.error(SUBSCRIPTION_UI_TEXT.settings.subscriptionRefreshFailed);
                          }
                        }}
                        disabled={isSubscriptionLoading}
                      >
                        <RefreshCw className={isSubscriptionLoading ? 'animate-spin' : ''} style={{ width: SETTINGS_PANEL_ICON_SIZE_SMALL, height: SETTINGS_PANEL_ICON_SIZE_SMALL, marginRight: SETTINGS_PANEL_MARGIN_RIGHT_SMALL }} />
                        {SUBSCRIPTION_UI_TEXT.settings.refresh}
                      </Button>

                      {!subscription.cancelAtPeriodEnd && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="flex-1 text-muted-foreground hover:text-destructive"
                          onClick={async () => {
                            if (confirm(SUBSCRIPTION_UI_TEXT.confirmations.cancel.title + '\n\n' + SUBSCRIPTION_UI_TEXT.confirmations.cancel.message)) {
                              try {
                                await cancelSubscription();
                                toast.success(SUBSCRIPTION_UI_TEXT.settings.subscriptionWillCancel, {
                                  description: SUBSCRIPTION_UI_TEXT.settings.subscriptionWillCancelDesc,
                                });
                              } catch (error) {
                                toast.error(SUBSCRIPTION_UI_TEXT.settings.subscriptionCancelFailed, {
                                  description: SUBSCRIPTION_UI_TEXT.settings.subscriptionCancelFailedDesc,
                                });
                              }
                            }
                          }}
                        >
                          {SUBSCRIPTION_UI_TEXT.settings.cancel}
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Calendar Integration */}
        <AccordionItem value="calendar" className="border rounded-lg px-4 py-2 sm:py-0 md:py-0 bg-card my-2 sm:my-1.5 md:my-4" data-tour="calendar-integration">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-primary" />
              <span>Calendar Integration</span>
              {!features.calendarSync && (
                <Badge variant="secondary" className="ml-auto bg-gradient-to-r from-[#D4C5F9] to-[#B4E4CE] text-primary-foreground">
                  PRO
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-2 space-y-4 sm:space-y-4 md:space-y-4">
            {!features.calendarSync ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Sync your tasks with Google, Outlook, and Apple Calendar with TaskZM Pro
                </p>
                <div className="p-4 border rounded-lg bg-gradient-to-br from-[#D4C5F9]/10 to-[#C9E4F7]/10 dark:from-[#D4C5F9]/5 dark:to-[#C9E4F7]/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="w-4 h-4 text-[#D4C5F9]" />
                    <span className="text-sm">Pro Feature</span>
                  </div>
                <p className="text-xs text-muted-foreground mb-3">
                  • Google Calendar OAuth sync<br />
                  • Outlook Calendar OAuth sync (Coming Soon)<br />
                  • Apple Calendar CalDAV sync<br />
                  • Automatic bidirectional sync (every 30s)
                </p>
                  <Button 
                    size="sm" 
                    onClick={() => setShowPricingDialog(true)}
                    className="bg-[#D4C5F9] hover:bg-[#D4C5F9]/90 w-full"
                  >
                    <Sparkles className="w-3 h-3 mr-1.5" />
                    {SUBSCRIPTION_UI_TEXT.settings.upgradeToProButton}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Sync your tasks with external calendar services
                </p>
                
                <div className="space-y-3">
                  {/* Google Calendar - Fully Implemented */}
                  <div className="flex items-center justify-between gap-3 py-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Label htmlFor="google-cal" className="text-sm cursor-pointer">Google Calendar</Label>
                    </div>
                    <Switch 
                      id="google-cal" 
                      className="flex-shrink-0"
                      checked={calendarStatus.google}
                      onCheckedChange={(checked) => {
                        if (checked) connectCalendar('google');
                        else disconnectCalendar('google');
                        toast.success(
                          checked ? 'Google Calendar Connected' : 'Google Calendar Disconnected',
                          {
                            description: checked 
                              ? 'Your Google Calendar is now synced with TaskZM' 
                              : 'Google Calendar has been disconnected'
                          }
                        );
                      }}
                    />
                  </div>
                  
                  {/* Outlook Calendar - Coming Soon */}
                  <div className="flex items-center justify-between gap-3 py-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Label htmlFor="outlook-cal" className="text-sm cursor-pointer">Outlook Calendar</Label>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-muted text-muted-foreground border-muted-foreground/20">
                        Coming Soon
                      </Badge>
                    </div>
                    <Switch 
                      id="outlook-cal" 
                      className="flex-shrink-0"
                      checked={false}
                      disabled={true}
                      onCheckedChange={() => {
                        toast.info('Outlook Calendar integration is coming soon!', {
                          description: 'We\'re working on adding Outlook Calendar support. Stay tuned!',
                        });
                      }}
                    />
                  </div>
                  
                  {/* Apple Calendar - CalDAV */}
                  <div className="flex items-center justify-between gap-3 py-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Label htmlFor="apple-cal" className="text-sm cursor-pointer">Apple Calendar</Label>
                    </div>
                    <Switch 
                      id="apple-cal" 
                      className="flex-shrink-0"
                      checked={calendarStatus.apple}
                      onCheckedChange={(checked) => {
                        if (checked) connectCalendar('apple');
                        else disconnectCalendar('apple');
                        if (!checked) {
                          toast.success('Apple Calendar Disconnected', {
                            description: 'Apple Calendar has been disconnected',
                          });
                        }
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            <Separator />

            <Button 
              size="sm" 
              className="w-full"
              onClick={() => {
                if (calendarStatus.google) syncAllTasksToCalendar('google');
                else if (calendarStatus.apple) syncAllTasksToCalendar('apple');
              }}
              disabled={isCalendarSyncing || (!calendarStatus.google && !calendarStatus.apple)}
            >
              <Calendar className="w-4 h-4 mr-2" />
              {isCalendarSyncing ? 'Syncing...' : 'Sync All Tasks'}
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* Notifications */}
        <AccordionItem value="notifications" className="border rounded-lg px-3 md:px-4 py-2 sm:py-0 md:py-0 bg-card my-2 sm:my-1.5 md:my-4">
          <AccordionTrigger className="hover:no-underline py-3 md:py-4">
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
              <Bell className="w-4 h-4 md:w-5 md:h-5 text-primary flex-shrink-0" />
              <span className="text-sm md:text-base truncate">Notifications</span>
              {badgeCount > 0 && (
                <Badge variant="destructive" className="ml-auto flex-shrink-0 text-xs">
                  {badgeCount}
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-3 md:pb-4 pt-2 space-y-3 md:space-y-4">
            <p className="text-xs md:text-sm text-muted-foreground">
              Manage notifications for due and overdue tasks
            </p>

            {/* Permission Status */}
            <div className="p-2.5 md:p-3 rounded-lg border bg-muted/50">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs md:text-sm font-medium flex-1 min-w-0">Notification Permission</span>
                <Badge 
                  variant={permission === 'granted' ? 'default' : permission === 'denied' ? 'destructive' : 'secondary'}
                  className="text-xs flex-shrink-0"
                >
                  {permission === 'granted' ? NOTIFICATION_PANEL_TEXT.permission.granted : permission === 'denied' ? NOTIFICATION_PANEL_TEXT.permission.denied : NOTIFICATION_PANEL_TEXT.permission.notSet}
                </Badge>
              </div>
              {permission !== 'granted' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2 text-xs md:text-sm"
                  onClick={async () => {
                    const granted = await requestPermission();
                    if (!granted && permission === 'default') {
                      // Permission was just denied, show instructions
                      toast.info(NOTIFICATION_TOAST_MESSAGES.permissionDeniedInfo, {
                        description: NOTIFICATION_TOAST_MESSAGES.permissionDeniedDescription,
                        duration: SETTINGS_PANEL_TOAST_DURATION_MS,
                      });
                    }
                  }}
                  disabled={permission === 'denied'}
                >
                  <Bell className="w-3 h-3 md:w-4 md:h-4 mr-1.5 md:mr-2" />
                  <span className="truncate">
                    {permission === 'denied' 
                      ? NOTIFICATION_PANEL_TEXT.permission.blocked
                      : NOTIFICATION_PANEL_TEXT.permission.enable}
                  </span>
                </Button>
              )}
              {permission === 'denied' && (
                <div className="mt-3 space-y-2">
                  <p className="text-[10px] md:text-xs text-muted-foreground font-medium">
                    Notifications are blocked. Follow these steps to enable them:
                  </p>
                  <div className="bg-background/50 border border-border rounded-md p-2.5 space-y-2">
                    {(() => {
                      const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
                      const isFirefox = /Firefox/.test(navigator.userAgent);
                      const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
                      const isEdge = /Edg/.test(navigator.userAgent);
                      
                      if (isChrome || isEdge) {
                        return (
                          <div className="space-y-1.5 text-[10px] md:text-xs text-muted-foreground">
                            <p className="font-medium text-foreground">Chrome/Edge:</p>
                            <ol className="list-decimal list-inside space-y-1 ml-1">
                              <li>Click the lock icon (🔒) or info icon (i) in the address bar</li>
                              <li>Find "Notifications" in the dropdown menu</li>
                              <li>Change from "Block" to "Allow"</li>
                              <li>Refresh this page</li>
                            </ol>
                            <p className="mt-1.5 pt-1.5 border-t border-border/50">
                              Or: Settings → Privacy and security → Site settings → Notifications → Add this site to "Allowed"
                            </p>
                          </div>
                        );
                      } else if (isFirefox) {
                        return (
                          <div className="space-y-1.5 text-[10px] md:text-xs text-muted-foreground">
                            <p className="font-medium text-foreground">Firefox:</p>
                            <ol className="list-decimal list-inside space-y-1 ml-1">
                              <li>Click the lock icon (🔒) in the address bar</li>
                              <li>Click "More Information"</li>
                              <li>Go to the "Permissions" tab</li>
                              <li>Find "Notifications" and change from "Block" to "Allow"</li>
                              <li>Refresh this page</li>
                            </ol>
                            <p className="mt-1.5 pt-1.5 border-t border-border/50">
                              Or: Settings → Privacy & Security → Permissions → Notifications → Allow for this site
                            </p>
                          </div>
                        );
                      } else if (isSafari) {
                        return (
                          <div className="space-y-1.5 text-[10px] md:text-xs text-muted-foreground">
                            <p className="font-medium text-foreground">Safari:</p>
                            <ol className="list-decimal list-inside space-y-1 ml-1">
                              <li>Safari menu → Settings (Preferences)</li>
                              <li>Go to "Websites" tab</li>
                              <li>Select "Notifications" in the left sidebar</li>
                              <li>Find this website and change to "Allow"</li>
                              <li>Refresh this page</li>
                            </ol>
                            <p className="mt-1.5 pt-1.5 border-t border-border/50">
                              Note: Safari requires you to enable notifications in Safari settings, not from the browser prompt.
                            </p>
                          </div>
                        );
                      } else {
                        return (
                          <div className="space-y-1.5 text-[10px] md:text-xs text-muted-foreground">
                            <p className="font-medium text-foreground">General Instructions:</p>
                            <ol className="list-decimal list-inside space-y-1 ml-1">
                              <li>Look for a lock icon (🔒) or info icon (i) in your browser's address bar</li>
                              <li>Click it to open site permissions</li>
                              <li>Find "Notifications" and change to "Allow"</li>
                              <li>Refresh this page</li>
                            </ol>
                            <p className="mt-1.5 pt-1.5 border-t border-border/50">
                              Or check your browser settings under Privacy/Security → Site Permissions → Notifications
                            </p>
                          </div>
                        );
                      }
                    })()}
                  </div>
                </div>
              )}
              {permission === 'default' && (
                <p className="text-[10px] md:text-xs text-muted-foreground mt-2 leading-relaxed">
                  Click "Enable Notifications" above to receive alerts for due and overdue tasks. A browser dialog will appear asking for permission.
                </p>
              )}
            </div>

            <Separator />

            {/* Notification Settings */}
            <div className="space-y-2.5 md:space-y-3">
              <div className="flex items-start justify-between gap-2 md:gap-3 py-1">
                <div className="space-y-0.5 flex-1 min-w-0 pr-2">
                  <Label htmlFor="notifications-enabled" className="text-xs md:text-sm cursor-pointer">Enable Notifications</Label>
                  <p className="text-[10px] md:text-xs text-muted-foreground">Turn on all notification features</p>
                </div>
                <Switch 
                  id="notifications-enabled" 
                  checked={notificationSettings.enabled}
                  onCheckedChange={async (checked) => {
                    updateNotificationSettings({ enabled: checked });
                    // If enabling and permission not granted, request it
                    if (checked && permission === 'default') {
                      // Small delay to let the switch update first
                      setTimeout(async () => {
                        await requestPermission();
                      }, SETTINGS_PANEL_TIMEOUT_DELAY_MS);
                    }
                  }}
                  disabled={permission === 'denied'}
                  className="flex-shrink-0 mt-0.5"
                />
              </div>

              <div className="flex items-start justify-between gap-2 md:gap-3 py-1">
                <div className="space-y-0.5 flex-1 min-w-0 pr-2">
                  <Label htmlFor="notifications-badge" className="text-xs md:text-sm cursor-pointer">{NOTIFICATION_PANEL_TEXT.badge.showAppIconBadge}</Label>
                  <p className="text-[10px] md:text-xs text-muted-foreground">{NOTIFICATION_PANEL_TEXT.badge.displayTaskCount}</p>
                </div>
                <Switch 
                  id="notifications-badge" 
                  checked={notificationSettings.showBadge}
                  onCheckedChange={(checked) => updateNotificationSettings({ showBadge: checked })}
                  disabled={!notificationSettings.enabled || permission !== 'granted'}
                  className="flex-shrink-0 mt-0.5"
                />
              </div>

              <div className="flex items-start justify-between gap-2 md:gap-3 py-1">
                <div className="space-y-0.5 flex-1 min-w-0 pr-2">
                  <Label htmlFor="notifications-overdue" className="text-xs md:text-sm cursor-pointer">Overdue Alerts</Label>
                  <p className="text-[10px] md:text-xs text-muted-foreground">Notify when tasks become overdue</p>
                </div>
                <Switch 
                  id="notifications-overdue" 
                  checked={notificationSettings.overdueAlerts}
                  onCheckedChange={(checked) => updateNotificationSettings({ overdueAlerts: checked })}
                  disabled={!notificationSettings.enabled || permission !== 'granted'}
                  className="flex-shrink-0 mt-0.5"
                />
              </div>

              <div className="flex items-start justify-between gap-2 md:gap-3 py-1">
                <div className="space-y-0.5 flex-1 min-w-0 pr-2">
                  <Label htmlFor="notifications-reminders" className="text-xs md:text-sm cursor-pointer">Due Date Reminders</Label>
                  <p className="text-[10px] md:text-xs text-muted-foreground">Notify before tasks are due</p>
                </div>
                <Switch 
                  id="notifications-reminders" 
                  checked={notificationSettings.dueDateReminders}
                  onCheckedChange={(checked) => updateNotificationSettings({ dueDateReminders: checked })}
                  disabled={!notificationSettings.enabled || permission !== 'granted'}
                  className="flex-shrink-0 mt-0.5"
                />
              </div>

              {/* Reminder Time */}
              {notificationSettings.dueDateReminders && (
                <div className="space-y-1.5 md:space-y-2 pt-2">
                  <Label htmlFor="reminder-time" className="text-xs md:text-sm">Reminder Time (minutes before due date)</Label>
                  <Input
                    id="reminder-time"
                    type="number"
                    min="5"
                    max="1440"
                    step="5"
                    value={notificationSettings.reminderTime}
                    onChange={(e) => updateNotificationSettings({ 
                      reminderTime: Math.max(5, Math.min(1440, parseInt(e.target.value) || 60)) 
                    })}
                    disabled={!notificationSettings.enabled || permission !== 'granted'}
                    className="w-full h-9 text-sm"
                  />
                  <p className="text-[10px] md:text-xs text-muted-foreground">
                    Current: {notificationSettings.reminderTime < 60 
                      ? `${notificationSettings.reminderTime} minutes` 
                      : `${Math.round(notificationSettings.reminderTime / 60)} hours`} before due date
                  </p>
                </div>
              )}

              {/* Check Interval */}
              <div className="space-y-1.5 md:space-y-2 pt-2">
                <Label htmlFor="check-interval" className="text-xs md:text-sm">Check Interval (minutes)</Label>
                <Input
                  id="check-interval"
                  type="number"
                  min="5"
                  max="60"
                  step="5"
                  value={notificationSettings.checkInterval}
                  onChange={(e) => updateNotificationSettings({ 
                    checkInterval: Math.max(5, Math.min(60, parseInt(e.target.value) || 15)) 
                  })}
                  disabled={!notificationSettings.enabled || permission !== 'granted'}
                  className="w-full h-9 text-sm"
                />
                <p className="text-[10px] md:text-xs text-muted-foreground">
                  How often to check for due tasks (min: 5, max: 60 minutes)
                </p>
              </div>

              <Separator className="my-3 md:my-4" />

              {/* Additional Notification Options */}
              <div className="space-y-2.5 md:space-y-3">
                <div className="flex items-start justify-between gap-2 md:gap-3 py-1">
                  <div className="space-y-0.5 flex-1 min-w-0 pr-2">
                    <Label htmlFor="push-notif" className="text-xs md:text-sm cursor-pointer">Push Notifications</Label>
                    <p className="text-[10px] md:text-xs text-muted-foreground">Desktop and mobile alerts</p>
                  </div>
                  <Switch 
                    id="push-notif" 
                    checked={notificationSettings.enabled && permission === 'granted'}
                    disabled={!notificationSettings.enabled || permission !== 'granted'}
                    className="flex-shrink-0 mt-0.5" 
                  />
                </div>
                
                <div className="flex items-start justify-between gap-2 md:gap-3 py-1">
                  <div className="space-y-0.5 flex-1 min-w-0 pr-2">
                    <Label htmlFor="email-notif" className="text-xs md:text-sm cursor-pointer">Email Notifications</Label>
                    <p className="text-[10px] md:text-xs text-muted-foreground">Daily task summary emails</p>
                  </div>
                  <Switch 
                    id="email-notif" 
                    className="flex-shrink-0 mt-0.5"
                    disabled={!notificationSettings.enabled || permission !== 'granted'}
                  />
                </div>

                <div className="flex items-start justify-between gap-2 md:gap-3 py-1">
                  <div className="space-y-0.5 flex-1 min-w-0 pr-2">
                    <Label htmlFor="sound-notif" className="text-xs md:text-sm cursor-pointer">Sound</Label>
                    <p className="text-[10px] md:text-xs text-muted-foreground">Play sound for notifications</p>
                  </div>
                  <Switch 
                    id="sound-notif" 
                    defaultChecked
                    disabled={!notificationSettings.enabled || permission !== 'granted'}
                    className="flex-shrink-0 mt-0.5" 
                  />
                </div>
              </div>
            </div>

            {/* Current Badge Count */}
            {notificationSettings.showBadge && badgeCount > 0 && (
              <div className="mt-3 md:mt-4 p-2.5 md:p-3 rounded-lg border bg-primary/5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs md:text-sm font-medium">{NOTIFICATION_PANEL_TEXT.badge.currentBadgeCount}</span>
                  <Badge variant="destructive" className="text-base md:text-lg px-2 md:px-3 py-0.5 md:py-1">
                    {badgeCount}
                  </Badge>
                </div>
                <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                  {badgeCount === 1 ? NOTIFICATION_PANEL_TEXT.badge.taskNeedsAttention : NOTIFICATION_PANEL_TEXT.badge.tasksNeedAttention}
                </p>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Tags Management */}
        <AccordionItem value="tags" className="border rounded-lg px-4 py-2 sm:py-0 md:py-0 bg-card my-2 sm:my-1.5 md:my-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <Tag className="w-5 h-5 text-primary" />
              <span>Tags Management</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-2 space-y-4 sm:space-y-4 md:space-y-4">
            <p className="text-sm text-muted-foreground">
              Create and manage custom tags for organizing tasks
            </p>
            
            <div className="flex gap-2">
              <Input 
                placeholder="New tag name..." 
                className="h-9" 
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
              />
              <Button size="sm" onClick={handleAddTag}>Add</Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {availableTags
                .filter((tag) => tag.toLowerCase() !== 'urgent')
                .map((tag, index) => {
                  const colors = [
                    'bg-[#B4E4CE]/30',
                    'bg-[#E6D5F0]/30',
                    'bg-[#FDD5B4]/30',
                    'bg-[#C9E4F7]/30',
                  ];
                  const bgColor = colors[index % colors.length];
                  const isProtected = isProtectedTag(tag);
                  
                  return (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className={`${bgColor} ${isProtected ? 'cursor-default' : 'cursor-pointer hover:opacity-70'} transition-opacity ${isProtected ? 'opacity-90' : ''}`}
                      onClick={isProtected ? undefined : () => handleRemoveTag(tag)}
                    >
                      {tag}
                      {!isProtected && (
                        <span className="ml-1 text-xs opacity-60">×</span>
                      )}
                    </Badge>
                  );
                })}
            </div>
            
            {availableTags.filter((tag) => tag.toLowerCase() !== 'urgent').length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No tags yet. Add your first tag above!
              </p>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* AI Settings */}
        <AccordionItem value="ai-settings" className="border rounded-lg px-4 py-2 sm:py-0 md:py-0 bg-card my-2 sm:my-1.5 md:my-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <span>AI Scheduling</span>
              {!features.aiScheduler && (
                <Badge variant="secondary" className="ml-auto bg-gradient-to-r from-[#D4C5F9] to-[#B4E4CE] text-primary-foreground">
                  PRO
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-2 space-y-4 sm:space-y-4 md:space-y-4">
            {!features.aiScheduler ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Configure AI-powered automatic task scheduling that intelligently organizes your tasks.
                </p>
                
                <div className="bg-gradient-to-br from-[#D4C5F9]/10 to-[#B4E4CE]/10 border border-[#D4C5F9]/20 rounded-lg p-4">
                  <div className="space-y-2">
                    <p className="text-sm">{SUBSCRIPTION_UI_TEXT.settings.upgradeToProToUnlock}</p>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• Smart task scheduling</li>
                      <li>• Respects your category hours</li>
                      <li>• Priority-based optimization</li>
                      <li>• Saves hours of planning time</li>
                      <li>• Re-schedule entire days, weeks, or months</li>
                    </ul>
                  </div>
                  <Button 
                    onClick={() => setShowPricingDialog(true)}
                    className="w-full mt-3 bg-gradient-to-r from-[#D4C5F9] to-[#B4E4CE] hover:opacity-90"
                  >
                    {SUBSCRIPTION_UI_TEXT.settings.upgradeToProButton}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Configure AI-powered automatic task scheduling
                </p>
            
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3 py-1">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <Label htmlFor="ai-auto-scheduling" className="text-sm cursor-pointer">Enable AI Auto-Scheduling</Label>
                  <p className="text-xs text-muted-foreground">Automatically schedule tasks when created</p>
                </div>
                <Switch 
                  id="ai-auto-scheduling" 
                  checked={aiSettings.autoSchedulingEnabled}
                  onCheckedChange={toggleAutoScheduling}
                  className="flex-shrink-0 mt-0.5"
                />
              </div>
              
              <div className="flex items-start justify-between gap-3 py-1">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <Label htmlFor="ai-priority-scheduling" className="text-sm cursor-pointer">Priority-Based Scheduling</Label>
                  <p className="text-xs text-muted-foreground">Schedule urgent tasks first, then high, medium, low</p>
                </div>
                <Switch 
                  id="ai-priority-scheduling" 
                  checked={aiSettings.priorityBasedScheduling}
                  onCheckedChange={togglePriorityBasedScheduling}
                  disabled={!aiSettings.autoSchedulingEnabled}
                  className="flex-shrink-0 mt-0.5"
                />
              </div>

              <div className="flex items-start justify-between gap-3 py-1">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <Label htmlFor="ai-schedule-unscheduled" className="text-sm cursor-pointer">Schedule Unscheduled Tasks</Label>
                  <p className="text-xs text-muted-foreground">AI schedules tasks without due dates</p>
                </div>
                <Switch 
                  id="ai-schedule-unscheduled" 
                  checked={aiSettings.scheduleUnscheduledTasks}
                  onCheckedChange={toggleScheduleUnscheduledTasks}
                  disabled={!aiSettings.autoSchedulingEnabled}
                  className="flex-shrink-0 mt-0.5"
                />
              </div>
            </div>

            <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/10 space-y-3">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-xs text-muted-foreground space-y-2">
                  <div>
                    <p className="mb-1 font-semibold text-foreground">How AI Schedules Tasks:</p>
                    <p className="leading-relaxed">
                      The AI scheduler intelligently organizes your tasks and events by analyzing multiple factors to create an optimal schedule that fits your workflow.
                    </p>
                  </div>
                  
                  <div className="space-y-1.5 pl-1">
                    <p className="font-medium text-foreground">📊 Task Analysis:</p>
                    <ul className="space-y-1 list-disc list-inside ml-1">
                      <li>Estimates task duration based on priority, description length, subtasks, and task complexity</li>
                      <li>Considers task categories (Work, Personal, Projects) and your custom category hours</li>
                      <li>Respects due dates and schedules urgent tasks first when priority-based scheduling is enabled</li>
                      <li>Accounts for task status (active tasks get preference)</li>
                    </ul>
                  </div>

                  <div className="space-y-1.5 pl-1">
                    <p className="font-medium text-foreground">⏰ Scheduling Rules:</p>
                    <ul className="space-y-1 list-disc list-inside ml-1">
                      <li>Enforces a 5-hour daily limit per day to prevent over-scheduling</li>
                      <li>Schedules tasks within your defined category hours (e.g., Work hours 9 AM-5 PM)</li>
                      <li>Separates weekday and weekend schedules based on your preferences</li>
                      <li>Distributes tasks across available days, starting from tomorrow</li>
                      <li>Finds optimal time slots within work hours (9 AM-5 PM) when possible</li>
                    </ul>
                  </div>

                  <div className="space-y-1.5 pl-1">
                    <p className="font-medium text-foreground">🔄 Smart Features:</p>
                    <ul className="space-y-1 list-disc list-inside ml-1">
                      <li>If a day exceeds 5 hours, you'll be consulted before proceeding</li>
                      <li>Tasks that can't be scheduled within 14 days are flagged for manual scheduling</li>
                      <li>You can reschedule entire days, weeks, or months with one click</li>
                      <li>All schedules can be manually adjusted anytime</li>
                    </ul>
                  </div>

                  <div className="pt-1 border-t border-primary/10">
                    <p className="text-xs italic">
                      💡 Tip: Enable "Priority-Based Scheduling" to automatically prioritize urgent and high-priority tasks first.
                    </p>
                  </div>
                </div>
              </div>
            </div>
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Date, Time & Theme */}
        <AccordionItem value="datetime" className="border rounded-lg px-4 py-2 sm:py-0 md:py-0 bg-card my-2 sm:my-1.5 md:my-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-primary" />
              <span>Date, Time & Theme</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-2 space-y-4 sm:space-y-4 md:space-y-4">
            <div className="space-y-4 sm:space-y-3 md:space-y-3">
              <div className="space-y-2 sm:space-y-2">
                <Label className="text-sm">Time Format</Label>
                <RadioGroup defaultValue="12h" className="space-y-2 sm:space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="12h" id="12h" />
                    <Label htmlFor="12h" className="text-sm cursor-pointer">12-hour (2:00 PM)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="24h" id="24h" />
                    <Label htmlFor="24h" className="text-sm cursor-pointer">24-hour (14:00)</Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator className="my-3 sm:my-2" />

              <div className="space-y-2 sm:space-y-2">
                <Label className="text-sm">Week Starts On</Label>
                <RadioGroup defaultValue="sunday" className="space-y-2 sm:space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sunday" id="sunday" />
                    <Label htmlFor="sunday" className="text-sm cursor-pointer">Sunday</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="monday" id="monday" />
                    <Label htmlFor="monday" className="text-sm cursor-pointer">Monday</Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator className="my-3 sm:my-2" />

              <div className="space-y-2 sm:space-y-2">
                <Label htmlFor="theme-select" className="text-sm">Theme</Label>
                <RadioGroup value={theme} onValueChange={(value) => setTheme(value as any)} className="space-y-2 sm:space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="light" id="light" />
                    <Label htmlFor="light" className="flex items-center gap-2 cursor-pointer text-sm">
                      <Sun className="w-4 h-4" />
                      Light
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dark" id="dark" />
                    <Label htmlFor="dark" className="flex items-center gap-2 cursor-pointer text-sm">
                      <Moon className="w-4 h-4" />
                      Dark
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="system" id="system" />
                    <Label htmlFor="system" className="flex items-center gap-2 cursor-pointer text-sm">
                      <Monitor className="w-4 h-4" />
                      System
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Task Rollover */}
        <AccordionItem value="rollover" className="border rounded-lg px-4 py-2 sm:py-0 md:py-0 bg-card my-2 sm:my-1.5 md:my-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <RotateCcw className="w-5 h-5 text-primary" />
              <span>Task Rollover</span>
              {!features.taskRollover && (
                <Badge variant="secondary" className="ml-auto bg-gradient-to-r from-[#D4C5F9] to-[#B4E4CE] text-primary-foreground">
                  PRO
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-2 space-y-4 sm:space-y-4 md:space-y-4">
            {!features.taskRollover ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Automatically move incomplete tasks to the next day, ensuring nothing falls through the cracks.
                </p>
                
                <div className="bg-gradient-to-br from-[#D4C5F9]/10 to-[#B4E4CE]/10 border border-[#D4C5F9]/20 rounded-lg p-4">
                  <div className="space-y-2">
                    <p className="text-sm">{SUBSCRIPTION_UI_TEXT.settings.upgradeToProToUnlock}</p>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• Automatic task rollover at midnight</li>
                      <li>• Optional confirmation before moving tasks</li>
                      <li>• Never miss incomplete tasks</li>
                      <li>• Smart rescheduling for better productivity</li>
                    </ul>
                  </div>
                  <Button 
                    onClick={() => setShowPricingDialog(true)}
                    className="w-full mt-3 bg-gradient-to-r from-[#D4C5F9] to-[#B4E4CE] hover:opacity-90"
                  >
                    {SUBSCRIPTION_UI_TEXT.settings.upgradeToProButton}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Automatically move incomplete tasks to the next day
                </p>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="auto-rollover" className="text-sm">Auto Rollover</Label>
                      <p className="text-xs text-muted-foreground">Move tasks at midnight</p>
                    </div>
                    <Switch 
                      id="auto-rollover" 
                      checked={rolloverSettings.autoRollover}
                      onCheckedChange={(checked) => 
                        updateRolloverSettings({ autoRollover: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="ask-rollover" className="text-sm">Ask Before Rolling</Label>
                      <p className="text-xs text-muted-foreground">Confirm before moving tasks</p>
                    </div>
                    <Switch 
                      id="ask-rollover" 
                      checked={rolloverSettings.askBeforeRolling}
                      onCheckedChange={(checked) => 
                        updateRolloverSettings({ askBeforeRolling: checked })
                      }
                      disabled={!rolloverSettings.autoRollover}
                    />
                  </div>
                </div>
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Task Category Hours */}
        <AccordionItem value="hours" className="border rounded-lg px-4 py-2 sm:py-0 md:py-0 bg-card my-2 sm:my-1.5 md:my-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <Briefcase className="w-5 h-5 text-primary" />
              <span>Task Category Hours</span>
              {!features.taskHours && (
                <Badge variant="secondary" className="ml-auto bg-gradient-to-r from-[#D4C5F9] to-[#B4E4CE] text-primary-foreground">
                  PRO
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-2 space-y-4 sm:space-y-4 md:space-y-4">
            {!features.taskHours ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Set preferred working hours for different task categories (Work, Personal, Projects) with separate weekday and weekend schedules.
                </p>
                
                <div className="bg-gradient-to-br from-[#D4C5F9]/10 to-[#B4E4CE]/10 border border-[#D4C5F9]/20 rounded-lg p-4">
                  <div className="space-y-2">
                    <p className="text-sm">{SUBSCRIPTION_UI_TEXT.settings.upgradeToProToUnlock}</p>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• Weekday/weekend hour settings</li>
                      <li>• Category-specific hours (Work, Personal, Projects)</li>
                      <li>• Better work-life balance</li>
                      <li>• AI respects your boundaries</li>
                    </ul>
                  </div>
                  <Button 
                    onClick={() => setShowPricingDialog(true)}
                    className="w-full mt-3 bg-gradient-to-r from-[#D4C5F9] to-[#B4E4CE] hover:opacity-90"
                  >
                    {SUBSCRIPTION_UI_TEXT.settings.upgradeToProButton}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Set preferred hours for different task categories
                </p>

            {/* Weekday/Weekend Toggle */}
            <div className="flex justify-center">
              <ToggleGroup 
                type="single" 
                value={dayType} 
                onValueChange={(value) => value && setDayType(value as 'weekday' | 'weekend')}
                className="bg-muted/50 rounded-lg p-1"
              >
                <ToggleGroupItem 
                  value="weekday" 
                  className="data-[state=on]:bg-background data-[state=on]:text-foreground px-6 rounded-md"
                >
                  Weekdays
                </ToggleGroupItem>
                <ToggleGroupItem 
                  value="weekend" 
                  className="data-[state=on]:bg-background data-[state=on]:text-foreground px-6 rounded-md"
                >
                  Weekends
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            
            <Separator />
            
            <div className="space-y-4">
              {/* Work Hours */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#B4E4CE]" />
                    <Label className="text-sm font-medium">Work Tasks</Label>
                  </div>
                  <Switch 
                    checked={dayType === 'weekday' 
                      ? hoursSettings.weekdayHours.work.enabled 
                      : hoursSettings.weekendHours.work.enabled
                    }
                    onCheckedChange={(checked) => {
                      const hoursKey = dayType === 'weekday' ? 'weekdayHours' : 'weekendHours';
                      updateHoursSettings({
                        [hoursKey]: {
                          ...hoursSettings[hoursKey],
                          work: { ...hoursSettings[hoursKey].work, enabled: checked }
                        }
                      });
                    }}
                    className="flex-shrink-0"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="work-start" className="text-xs text-muted-foreground">Start</Label>
                    <Input 
                      id="work-start" 
                      type="time" 
                      value={dayType === 'weekday' 
                        ? hoursSettings.weekdayHours.work.start 
                        : hoursSettings.weekendHours.work.start
                      }
                      onChange={(e) => {
                        const hoursKey = dayType === 'weekday' ? 'weekdayHours' : 'weekendHours';
                        updateHoursSettings({
                          [hoursKey]: {
                            ...hoursSettings[hoursKey],
                            work: { ...hoursSettings[hoursKey].work, start: e.target.value }
                          }
                        });
                      }}
                      disabled={dayType === 'weekday' 
                        ? !hoursSettings.weekdayHours.work.enabled 
                        : !hoursSettings.weekendHours.work.enabled
                      }
                      className="h-9" 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="work-end" className="text-xs text-muted-foreground">End</Label>
                    <Input 
                      id="work-end" 
                      type="time" 
                      value={dayType === 'weekday' 
                        ? hoursSettings.weekdayHours.work.end 
                        : hoursSettings.weekendHours.work.end
                      }
                      onChange={(e) => {
                        const hoursKey = dayType === 'weekday' ? 'weekdayHours' : 'weekendHours';
                        updateHoursSettings({
                          [hoursKey]: {
                            ...hoursSettings[hoursKey],
                            work: { ...hoursSettings[hoursKey].work, end: e.target.value }
                          }
                        });
                      }}
                      disabled={dayType === 'weekday' 
                        ? !hoursSettings.weekdayHours.work.enabled 
                        : !hoursSettings.weekendHours.work.enabled
                      }
                      className="h-9" 
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Personal Hours */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#E6D5F0]" />
                    <Label className="text-sm font-medium">Personal Tasks</Label>
                  </div>
                  <Switch 
                    checked={dayType === 'weekday' 
                      ? hoursSettings.weekdayHours.personal.enabled 
                      : hoursSettings.weekendHours.personal.enabled
                    }
                    onCheckedChange={(checked) => {
                      const hoursKey = dayType === 'weekday' ? 'weekdayHours' : 'weekendHours';
                      updateHoursSettings({
                        [hoursKey]: {
                          ...hoursSettings[hoursKey],
                          personal: { ...hoursSettings[hoursKey].personal, enabled: checked }
                        }
                      });
                    }}
                    className="flex-shrink-0"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="personal-start" className="text-xs text-muted-foreground">Start</Label>
                    <Input 
                      id="personal-start" 
                      type="time" 
                      value={dayType === 'weekday' 
                        ? hoursSettings.weekdayHours.personal.start 
                        : hoursSettings.weekendHours.personal.start
                      }
                      onChange={(e) => {
                        const hoursKey = dayType === 'weekday' ? 'weekdayHours' : 'weekendHours';
                        updateHoursSettings({
                          [hoursKey]: {
                            ...hoursSettings[hoursKey],
                            personal: { ...hoursSettings[hoursKey].personal, start: e.target.value }
                          }
                        });
                      }}
                      disabled={dayType === 'weekday' 
                        ? !hoursSettings.weekdayHours.personal.enabled 
                        : !hoursSettings.weekendHours.personal.enabled
                      }
                      className="h-9" 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="personal-end" className="text-xs text-muted-foreground">End</Label>
                    <Input 
                      id="personal-end" 
                      type="time" 
                      value={dayType === 'weekday' 
                        ? hoursSettings.weekdayHours.personal.end 
                        : hoursSettings.weekendHours.personal.end
                      }
                      onChange={(e) => {
                        const hoursKey = dayType === 'weekday' ? 'weekdayHours' : 'weekendHours';
                        updateHoursSettings({
                          [hoursKey]: {
                            ...hoursSettings[hoursKey],
                            personal: { ...hoursSettings[hoursKey].personal, end: e.target.value }
                          }
                        });
                      }}
                      disabled={dayType === 'weekday' 
                        ? !hoursSettings.weekdayHours.personal.enabled 
                        : !hoursSettings.weekendHours.personal.enabled
                      }
                      className="h-9" 
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Projects Hours */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#FDD5B4]" />
                    <Label className="text-sm font-medium">Project Tasks</Label>
                  </div>
                  <Switch 
                    checked={dayType === 'weekday' 
                      ? hoursSettings.weekdayHours.projects.enabled 
                      : hoursSettings.weekendHours.projects.enabled
                    }
                    onCheckedChange={(checked) => {
                      const hoursKey = dayType === 'weekday' ? 'weekdayHours' : 'weekendHours';
                      updateHoursSettings({
                        [hoursKey]: {
                          ...hoursSettings[hoursKey],
                          projects: { ...hoursSettings[hoursKey].projects, enabled: checked }
                        }
                      });
                    }}
                    className="flex-shrink-0"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="projects-start" className="text-xs text-muted-foreground">Start</Label>
                    <Input 
                      id="projects-start" 
                      type="time" 
                      value={dayType === 'weekday' 
                        ? hoursSettings.weekdayHours.projects.start 
                        : hoursSettings.weekendHours.projects.start
                      }
                      onChange={(e) => {
                        const hoursKey = dayType === 'weekday' ? 'weekdayHours' : 'weekendHours';
                        updateHoursSettings({
                          [hoursKey]: {
                            ...hoursSettings[hoursKey],
                            projects: { ...hoursSettings[hoursKey].projects, start: e.target.value }
                          }
                        });
                      }}
                      disabled={dayType === 'weekday' 
                        ? !hoursSettings.weekdayHours.projects.enabled 
                        : !hoursSettings.weekendHours.projects.enabled
                      }
                      className="h-9" 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="projects-end" className="text-xs text-muted-foreground">End</Label>
                    <Input 
                      id="projects-end" 
                      type="time" 
                      value={dayType === 'weekday' 
                        ? hoursSettings.weekdayHours.projects.end 
                        : hoursSettings.weekendHours.projects.end
                      }
                      onChange={(e) => {
                        const hoursKey = dayType === 'weekday' ? 'weekdayHours' : 'weekendHours';
                        updateHoursSettings({
                          [hoursKey]: {
                            ...hoursSettings[hoursKey],
                            projects: { ...hoursSettings[hoursKey].projects, end: e.target.value }
                          }
                        });
                      }}
                      disabled={dayType === 'weekday' 
                        ? !hoursSettings.weekdayHours.projects.enabled 
                        : !hoursSettings.weekendHours.projects.enabled
                      }
                      className="h-9" 
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="respect-hours" className="text-sm cursor-pointer">Respect Category Hours</Label>
                  <p className="text-xs text-muted-foreground">AI scheduling will use these time windows for each task category</p>
                </div>
                <Switch 
                  id="respect-hours" 
                  checked={hoursSettings.respectHours}
                  onCheckedChange={(checked) => updateHoursSettings({ respectHours: checked })}
                  className="flex-shrink-0 mt-0.5"
                />
              </div>

              <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-muted-foreground">
                    <p className="mb-1">
                      <strong className="text-foreground">How it works:</strong>
                    </p>
                    <p>
                      When AI scheduling is enabled, tasks will be scheduled within the time windows you set for each category. 
                      You can set different hours for weekdays (Mon-Fri) and weekends (Sat-Sun) to maintain work-life balance and optimize your schedule.
                    </p>
                  </div>
                </div>
              </div>
            </div>
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Awards & Achievements */}
        <AccordionItem value="awards" className="border rounded-lg px-4 py-2 sm:py-0 md:py-0 bg-card my-2 sm:my-1.5 md:my-4" data-tour="awards-section">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-primary" />
              <span>Awards & Achievements</span>
              <Badge variant="secondary" className="ml-auto bg-muted text-muted-foreground text-xs">
                {earnedAwards.length}/{awards.length}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-2 space-y-4 sm:space-y-4 md:space-y-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Quietly track your achievements as you complete tasks. Awards appear as subtle notifications in the corner.
              </p>

              {/* Summary Stats - Moved to Top */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-xl border border-blue-200/50 dark:border-blue-800/50">
                  <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">{earnedAwards.length}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">Earned</div>
                </div>
                <div className="text-center p-3 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-xl border border-amber-200/50 dark:border-amber-800/50">
                  <div className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">{Math.round((earnedAwards.length / awards.length) * 100)}%</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">Complete</div>
                </div>
                <div className="text-center p-3 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-xl border border-purple-200/50 dark:border-purple-800/50">
                  <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{awards.length - earnedAwards.length}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">Remaining</div>
                </div>
              </div>

              <Separator />

              {/* Award Categories as Nested Accordion */}
              <Accordion type="multiple" className="space-y-3">
                {/* Completion Awards */}
                <AccordionItem value="completion" className="border rounded-lg px-3 bg-gradient-to-br from-blue-50/50 to-cyan-50/50 dark:from-blue-950/20 dark:to-cyan-950/20">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                        <Target className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <h4 className="text-sm font-semibold">Completion Milestones</h4>
                        <p className="text-xs text-muted-foreground">Track your task achievements</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                        {earnedAwards.filter(ea => awards.find(a => a.id === ea.awardId)?.category === 'completion').length}/{awards.filter(a => a.category === 'completion').length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3 pt-2">
                    <div className="space-y-2">
                      {awards.filter(a => a.category === 'completion').map(award => {
                        const isEarned = earnedAwards.some(ea => ea.awardId === award.id);
                        const progress = getAwardProgress(award.id);
                        const IconComponent = getAwardIcon(award.icon);
                        
                        return (
                          <div 
                            key={award.id}
                            className={`
                              group p-3 rounded-lg border transition-all duration-300
                              ${isEarned 
                                ? 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/40 dark:to-cyan-950/40 border-blue-200 dark:border-blue-800/50' 
                                : 'bg-card border-border/50 hover:border-border'
                              }
                            `}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`
                                flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all
                                ${isEarned 
                                  ? 'bg-gradient-to-br from-blue-500 to-cyan-600' 
                                  : 'bg-muted/50 group-hover:bg-muted'
                                }
                              `}>
                                <IconComponent className={`w-5 h-5 ${isEarned ? 'text-white' : 'text-muted-foreground'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-1 mb-1">
                                  <div className={`text-sm font-medium ${isEarned ? 'text-blue-700 dark:text-blue-300' : ''}`}>
                                    {award.name}
                                  </div>
                                  {isEarned && <Award className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
                                  {!isEarned && <Lock className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {award.description}
                                </div>
                                {progress && !isEarned && (
                                  <div className="mt-2">
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                                      <span>{progress.currentProgress} / {progress.targetProgress}</span>
                                      <span>{Math.round(progress.percentage)}%</span>
                                    </div>
                                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
                                        style={{ width: `${progress.percentage}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Streak Awards */}
                <AccordionItem value="streak" className="border rounded-lg px-3 bg-gradient-to-br from-orange-50/50 to-red-50/50 dark:from-orange-950/20 dark:to-red-950/20">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <h4 className="text-sm font-semibold">Streak Champions</h4>
                        <p className="text-xs text-muted-foreground">Build consistency habits</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                        {earnedAwards.filter(ea => awards.find(a => a.id === ea.awardId)?.category === 'streak').length}/{awards.filter(a => a.category === 'streak').length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3 pt-2">
                    <div className="space-y-2">
                      {awards.filter(a => a.category === 'streak').map(award => {
                        const isEarned = earnedAwards.some(ea => ea.awardId === award.id);
                        const progress = getAwardProgress(award.id);
                        const IconComponent = getAwardIcon(award.icon);
                        
                        return (
                          <div 
                            key={award.id}
                            className={`
                              group p-3 rounded-lg border transition-all duration-300
                              ${isEarned 
                                ? 'bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/40 dark:to-red-950/40 border-orange-200 dark:border-orange-800/50' 
                                : 'bg-card border-border/50 hover:border-border'
                              }
                            `}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`
                                flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all
                                ${isEarned 
                                  ? 'bg-gradient-to-br from-orange-500 to-red-600' 
                                  : 'bg-muted/50 group-hover:bg-muted'
                                }
                              `}>
                                <IconComponent className={`w-5 h-5 ${isEarned ? 'text-white' : 'text-muted-foreground'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-1 mb-1">
                                  <div className={`text-sm font-medium ${isEarned ? 'text-orange-700 dark:text-orange-300' : ''}`}>
                                    {award.name}
                                  </div>
                                  {isEarned && <Award className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />}
                                  {!isEarned && <Lock className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {award.description}
                                </div>
                                {progress && !isEarned && (
                                  <div className="mt-2">
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                                      <span>{progress.currentProgress} / {progress.targetProgress} days</span>
                                      <span>{Math.round(progress.percentage)}%</span>
                                    </div>
                                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-300"
                                        style={{ width: `${progress.percentage}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Focus Awards */}
                <AccordionItem value="focus" className="border rounded-lg px-3 bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                        <Timer className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <h4 className="text-sm font-semibold">Focus Masters</h4>
                        <p className="text-xs text-muted-foreground">Deep work achievements</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                        {earnedAwards.filter(ea => awards.find(a => a.id === ea.awardId)?.category === 'focus').length}/{awards.filter(a => a.category === 'focus').length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3 pt-2">
                    <div className="space-y-2">
                      {awards.filter(a => a.category === 'focus').map(award => {
                        const isEarned = earnedAwards.some(ea => ea.awardId === award.id);
                        const progress = getAwardProgress(award.id);
                        const IconComponent = getAwardIcon(award.icon);
                        
                        return (
                          <div 
                            key={award.id}
                            className={`
                              group p-3 rounded-lg border transition-all duration-300
                              ${isEarned 
                                ? 'bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/40 border-purple-200 dark:border-purple-800/50' 
                                : 'bg-card border-border/50 hover:border-border'
                              }
                            `}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`
                                flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all
                                ${isEarned 
                                  ? 'bg-gradient-to-br from-purple-500 to-pink-600' 
                                  : 'bg-muted/50 group-hover:bg-muted'
                                }
                              `}>
                                <IconComponent className={`w-5 h-5 ${isEarned ? 'text-white' : 'text-muted-foreground'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-1 mb-1">
                                  <div className={`text-sm font-medium ${isEarned ? 'text-purple-700 dark:text-purple-300' : ''}`}>
                                    {award.name}
                                  </div>
                                  {isEarned && <Award className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />}
                                  {!isEarned && <Lock className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {award.description}
                                </div>
                                {progress && !isEarned && (
                                  <div className="mt-2">
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                                      <span>{progress.currentProgress} / {progress.targetProgress} sessions</span>
                                      <span>{Math.round(progress.percentage)}%</span>
                                    </div>
                                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                                        style={{ width: `${progress.percentage}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Special Awards */}
                <AccordionItem value="special" className="border rounded-lg px-3 bg-gradient-to-br from-pink-50/50 to-purple-50/50 dark:from-pink-950/20 dark:to-purple-950/20">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <SparklesIcon className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <h4 className="text-sm font-semibold">Special Achievements</h4>
                        <p className="text-xs text-muted-foreground">Unique accomplishments</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300">
                        {earnedAwards.filter(ea => {
                          const award = awards.find(a => a.id === ea.awardId);
                          return award?.category === 'special' || award?.category === 'speed';
                        }).length}/{awards.filter(a => a.category === 'special' || a.category === 'speed').length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3 pt-2">
                    <div className="space-y-2">
                      {awards.filter(a => a.category === 'special' || a.category === 'speed').map(award => {
                        const isEarned = earnedAwards.some(ea => ea.awardId === award.id);
                        const IconComponent = getAwardIcon(award.icon);
                        
                        return (
                          <div 
                            key={award.id}
                            className={`
                              group p-3 rounded-lg border transition-all duration-300
                              ${isEarned 
                                ? 'bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950/40 dark:to-purple-950/40 border-pink-200 dark:border-pink-800/50' 
                                : 'bg-card border-border/50 hover:border-border'
                              }
                            `}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`
                                flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all
                                ${isEarned 
                                  ? 'bg-gradient-to-br from-pink-500 to-purple-600' 
                                  : 'bg-muted/50 group-hover:bg-muted'
                                }
                              `}>
                                <IconComponent className={`w-5 h-5 ${isEarned ? 'text-white' : 'text-muted-foreground'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-1 mb-1">
                                  <div className={`text-sm font-medium ${isEarned ? 'text-pink-700 dark:text-pink-300' : ''}`}>
                                    {award.name}
                                  </div>
                                  {isEarned && <Award className="w-3.5 h-3.5 text-pink-500 flex-shrink-0" />}
                                  {!isEarned && <Lock className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {award.description}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* App Tour */}
        <AccordionItem value="app-tour" className="border rounded-lg px-4 py-2 sm:py-0 md:py-0 bg-card my-2 sm:my-1.5 md:my-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <Compass className="w-5 h-5 text-primary" />
              <span>App Tour</span>
              {!hasSeenTour && (
                <Badge className="bg-[#FDD5B4] text-gray-800 border-[#FDD5B4] ml-2">
                  New
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-2 space-y-4 sm:space-y-4 md:space-y-4">
            <p className="text-sm text-muted-foreground">
              Take a guided tour of TaskZM's features and learn how to get the most out of your neurodivergent-friendly task manager.
            </p>
            
            <div className="bg-gradient-to-br from-[#C9E4F7]/10 to-[#E6D5F0]/10 border border-[#C9E4F7]/20 rounded-lg p-4">
              <div className="flex items-start gap-3 mb-3">
                <Compass className="w-5 h-5 text-[#C9E4F7] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm mb-1">Interactive Walkthrough</p>
                  <p className="text-xs text-muted-foreground">
                    {hasSeenTour 
                      ? 'Revisit all the key features and learn new tips'
                      : 'Get introduced to all the powerful features designed for your success'
                    }
                  </p>
                </div>
              </div>
              <Button 
                size="sm" 
                className="w-full bg-[#C9E4F7] hover:bg-[#C9E4F7]/90 text-gray-800"
                onClick={handleStartTour}
              >
                <Compass className="w-4 h-4 mr-2" />
                {hasSeenTour ? 'Restart Tour' : 'Start Tour'}
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium">Tour Highlights:</p>
              <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                <li>• Navigation & panel system</li>
                <li>• Today Agenda timeline</li>
                <li>• 7-Day Kanban board</li>
                <li>• AI Scheduler & Pomodoro timer</li>
                <li>• Calendar sync & team collaboration</li>
                <li>• Subtle achievements & analytics</li>
                <li>• Settings & customization</li>
              </ul>
            </div>

            <Separator />

            <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <p>
                    The tour takes about 2-3 minutes and can be skipped or paused at any time. 
                    You can restart it whenever you need a refresher!
                  </p>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* About */}
        <AccordionItem value="about" className="border rounded-lg px-4 py-2 sm:py-0 md:py-0 bg-card my-2 sm:my-1.5 md:my-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 text-primary" />
              <span>About</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-2 space-y-4 sm:space-y-4 md:space-y-4">
            <div className="space-y-4 sm:space-y-3 md:space-y-3">
              <div className="flex flex-col items-center gap-1.5">
                <img 
                  src={taskzmLogo} 
                  alt="TaskZM Logo"
                  className="w-[120px]"
                />
                <div className="text-xs text-muted-foreground text-center">Version {APP_VERSION}</div>
                <div className="text-xs text-muted-foreground/70 text-center">{VERSION_NAME}</div>
              </div>

              <Separator />

              <p className="text-xs text-muted-foreground leading-relaxed">
                TaskZM is a neurodivergent-friendly task management application built with React, TypeScript, and Supabase. 
                Designed with accessibility and focus in mind.
              </p>
              
              <div className="text-xs text-muted-foreground/70">
                Released: {VERSION_DATE}
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowPrivacyDialog(true)}
                >
                  Privacy Policy
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowTermsDialog(true)}
                >
                  Terms of Service
                </Button>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Database Sync</Label>
                    <p className="text-xs text-muted-foreground">Auto-sync every 30 seconds</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSyncing && (
                      <RefreshCw className="w-3 h-3 text-primary animate-spin" />
                    )}
                    <Badge 
                      variant="secondary" 
                      className={isSyncing ? 'bg-[#B4E4CE]/30' : 'bg-[#D4C5F9]/30'}
                    >
                      {isSyncing ? 'Syncing...' : 'Active'}
                    </Badge>
                  </div>
                </div>
                <div className="p-2.5 bg-muted/50 rounded-lg border border-border/50">
                  <div className="flex items-start gap-2">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80 mb-0.5">Last Database Sync</p>
                      <p className="text-xs font-medium">
                        {lastSync ? new Date(lastSync).toLocaleString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric',
                          hour: 'numeric', 
                          minute: '2-digit',
                          hour12: true 
                        }) : 'Never synced'}
                      </p>
                      {lastSync && (
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {(() => {
                            const diffMs = Date.now() - new Date(lastSync).getTime();
                            const diffMins = Math.floor(diffMs / 60000);
                            const diffHours = Math.floor(diffMs / 3600000);
                            const diffDays = Math.floor(diffMs / 86400000);
                            
                            if (diffMins < 1) return 'Just now';
                            if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
                            if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
                            return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
                          })()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="p-2.5 bg-primary/5 rounded-lg border border-primary/10">
                  <div className="flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Your tasks, projects, and settings are automatically synced to the cloud in the background. All changes are saved instantly and synchronized across your devices.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
        </div>
      </div>

      {/* Pricing Dialog */}
      <PricingDialog
        open={showPricingDialog}
        onOpenChange={setShowPricingDialog}
        onOfferingsUpdated={() => {
          // Refresh pricing when offerings are updated in PricingDialog
          const refreshPricing = async () => {
            try {
              const { getOfferings, isRevenueCatConfigured } = await import('../lib/revenuecat');
              if (isRevenueCatConfigured()) {
                const offerings = await getOfferings();
                if (offerings?.availablePackages && offerings.availablePackages.length > 0) {
                  const validPackages = offerings.availablePackages.filter((p: any) => p && p.product);
                  const monthlyPkg = validPackages.find(
                    (pkg: any) => pkg && MONTHLY_PACKAGE_IDENTIFIERS.includes(pkg.identifier)
                  );
                  const yearlyPkg = validPackages.find(
                    (pkg: any) => pkg && YEARLY_PACKAGE_IDENTIFIERS.includes(pkg.identifier)
                  );
                  setCurrentPricing({
                    monthly: monthlyPkg?.product?.priceString || DEFAULT_MONTHLY_PRICE,
                    yearly: yearlyPkg?.product?.priceString || undefined,
                    lastUpdated: new Date().toISOString(),
                  });
                }
              }
            } catch (error) {
              console.warn('Failed to refresh pricing after offerings update:', error);
            }
          };
          refreshPricing();
        }}
      />

      {/* Privacy Policy Dialog */}
      <PrivacyPolicyDialog
        open={showPrivacyDialog}
        onOpenChange={setShowPrivacyDialog}
      />

      {/* Terms of Service Dialog */}
      <TermsOfServiceDialog
        open={showTermsDialog}
        onOpenChange={setShowTermsDialog}
      />
    </div>
  </div>
);
}
