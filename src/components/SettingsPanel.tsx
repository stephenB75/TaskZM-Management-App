import React, { useState, useEffect, useCallback, useMemo } from 'react';
// Icons migrated to Icon component
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
import { useTeam } from '../contexts/TeamContext';
import { useAI } from '../contexts/AIContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useCalendar } from '../contexts/CalendarContext';
import type { SubscriptionTier } from '../types';
import { useAwards } from '../contexts/AwardContext';
import { useNotifications } from '../contexts/NotificationContext';
import { logger } from '../lib/logger';
import { PricingDialog } from './PricingDialog';
import { PrivacyPolicyDialog } from './PrivacyPolicyDialog';
import { TermsOfServiceDialog } from './TermsOfServiceDialog';
import { Badge } from './ui/badge';
import { AppHeader } from './AppHeader';
import { AvatarSelection } from './AvatarSelection';
import { AVATAR_UI_TEXT } from '../lib/avatar-constants';
import { SETTINGS_PANEL_UI_TEXT } from '../lib/settings-panel-constants';
import { NAVIGATION_UI_TEXT } from '../lib/navigation-constants';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { useMobileLayout } from '../hooks/useMobileLayout';
import { toast } from 'sonner';
import { Icon } from './Icon';
import { SettingsSection } from './settings/SettingsSection';
import { SettingsCategoryHeader } from './settings/SettingsCategoryHeader';
import { SettingsToggleRow } from './settings/SettingsToggleRow';
import { SettingsGroup } from './settings/SettingsGroup';
import { SettingsLead } from './settings/SettingsLead';
import { SettingsControlGroup } from './settings/SettingsControlGroup';
import { SettingsDivider } from './settings/SettingsDivider';
import { SettingsStatusCard } from './settings/SettingsStatusCard';
import { SettingsProUpsell } from './settings/SettingsProUpsell';
import { SettingsFeatureRow } from './settings/SettingsFeatureRow';
import { SettingsInfoCallout } from './settings/SettingsInfoCallout';
import { SettingsSubheading } from './settings/SettingsSubheading';
import { SettingsProfileSection } from './settings/SettingsProfileSection';
import { APP_VERSION, VERSION_NAME, VERSION_DATE } from '../lib/version';
import { AI_FUNCTION_EXPLANATION, DEFAULT_SCHEDULING_PERIOD_DAYS, AI_DAILY_HOUR_OPTIONS, AI_DAILY_HOUR_LABELS } from '../lib/ai-config';
import taskzmLogoBlack from '../assets/Taskzm_Logo_BLK-removebg.png';  // Black logo for about section
import { UI_SETTINGS_BADGE_COLORS, UI_TAG_COLORS, UI_AWARD_BADGE_COLORS, UI_AWARD_STAT_GRADIENTS } from '../lib/ui-colors';
import { SETTINGS_PANEL_TEXT_SIZES, SETTINGS_PANEL_TEXT_SIZE_BASE, SETTINGS_PANEL_TEXT_SIZE_LARGE } from '../lib/text-size-constants';
import { TIMING_CONSTANTS } from '../lib/timing-constants';
import { TASK_CARD_PRIORITY_COLORS } from '../lib/task-card-constants';
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
  HEADER_MOBILE_SAFE_AREA_SPACER,
  SETTINGS_PANEL_ACCORDION_ITEM_MARGIN_Y_DESKTOP,
  SETTINGS_PANEL_ACCORDION_TRIGGER_PADDING_Y,
  SETTINGS_PANEL_ACCORDION_CONTENT_PADDING_BOTTOM,
  SETTINGS_PANEL_ACCORDION_CONTENT_PADDING_TOP,
  SETTINGS_PANEL_ACCORDION_CONTENT_SPACING,
  SETTINGS_PANEL_SEPARATOR_MARGIN_Y,
  SETTINGS_PANEL_ICON_SIZE_SMALL,
  SETTINGS_PANEL_ICON_SIZE_MEDIUM,
  SETTINGS_PANEL_ACCORDION_ICON_SIZE,
  ICON_SIZE_SM,
  ICON_SIZE_MD,
  SETTINGS_PANEL_GAP_SMALL,
  SETTINGS_PANEL_GAP_XSMALL,
  SETTINGS_PANEL_SPACING_XSMALL,
  SETTINGS_PANEL_SPACING_SMALL,
  SETTINGS_PANEL_SPACING_MEDIUM,
  SETTINGS_PANEL_SPACING_LARGE,
  SETTINGS_PANEL_SPACING_XLARGE,
  SETTINGS_PANEL_MARGIN_BOTTOM_LARGE,
  SETTINGS_PANEL_MARGIN_TOP_MEDIUM,
  SETTINGS_PANEL_MARGIN_TOP_LARGE,
  SETTINGS_PANEL_PADDING_XSMALL,
  SETTINGS_PANEL_MARGIN_TOP_XSMALL,
  SETTINGS_PANEL_MARGIN_BOTTOM_SMALL,
  SETTINGS_PANEL_MARGIN_LEFT_SMALL,
  SETTINGS_PANEL_MARGIN_LEFT_NONE,
  SETTINGS_PANEL_MARGIN_RIGHT_NONE,
  SETTINGS_PANEL_PADDING_LARGE,
  SETTINGS_PANEL_PADDING_LEFT_AI_SECTION,
  SETTINGS_PANEL_PADDING_RIGHT_AI_SECTION,
  SETTINGS_PANEL_LINE_HEIGHT_AI_DESCRIPTION,
  SETTINGS_PANEL_GAP_NONE,
  SETTINGS_PANEL_POSITION_STATIC,
  SETTINGS_PANEL_BADGE_PADDING_LEFT,
  SETTINGS_PANEL_BADGE_PADDING_RIGHT,
  SETTINGS_PANEL_BADGE_PADDING_TOP,
  SETTINGS_PANEL_BADGE_PADDING_BOTTOM,
  SETTINGS_PANEL_AVATAR_SIZE_VALUE,
  SETTINGS_PANEL_PADDING_Y_SMALL,
  SETTINGS_PANEL_TEXT_SIZE_XSMALL,
  SETTINGS_PANEL_TEXT_SIZE_SMALL,
  SETTINGS_PANEL_TEXT_SIZE_MEDIUM,
  SETTINGS_PANEL_AVATAR_FONT_SIZE,
  SETTINGS_PANEL_ICON_SIZE_MEDIUM,
  SETTINGS_PANEL_ICON_SIZE_LARGE,
  SETTINGS_PANEL_ICON_SIZE_XLARGE,
  VIEWPORT_BREAKPOINTS,
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
  TOGGLE_SWITCH_DIMENSIONS,
  TOGGLE_SWITCH_SPACING,
  SETTINGS_PANEL_MARGIN_TOP_XSMALL,
  SETTINGS_PANEL_MARGIN_TOP_EXTRA_SMALL,
  SETTINGS_PANEL_MARGIN_TOP_MEDIUM_SMALL,
  SETTINGS_PANEL_MARGIN_TOP_SMALL,
  SETTINGS_PANEL_MARGIN_BOTTOM_SMALL,
  SETTINGS_PANEL_MARGIN_BOTTOM_MEDIUM,
  SETTINGS_PANEL_MARGIN_RIGHT_SMALL,
  SETTINGS_PANEL_MARGIN_RIGHT_XSMALL,
  SETTINGS_PANEL_MARGIN_LEFT_XSMALL,
  SETTINGS_PANEL_MARGIN_LEFT_SMALL,
  SETTINGS_PANEL_MARGIN_LEFT_MEDIUM,
  SETTINGS_PANEL_PADDING,
  SETTINGS_PANEL_PADDING_SMALL,
  SETTINGS_PANEL_PADDING_MEDIUM,
  SETTINGS_PANEL_PADDING_LARGE,
  SETTINGS_PANEL_PADDING_RIGHT_SMALL,
  SETTINGS_PANEL_PADDING_TOP_EXTRA_SMALL,
  SETTINGS_PANEL_PADDING_Y_EXTRA_SMALL,
  NAV_BAR_BOTTOM_PADDING_MOBILE,
  NAV_BAR_SPACER_HEIGHT,
  NAV_BAR_HEIGHT,
  NAV_BAR_SCROLL_BUFFER_REM,
  SETTINGS_PANEL_PADDING_Y_SMALL,
  SETTINGS_PANEL_ROW_PADDING_Y,
  SETTINGS_PANEL_START_TOUR_BUTTON_GAP,
  SETTINGS_PANEL_START_TOUR_BUTTON_HEIGHT,
  SETTINGS_PANEL_START_TOUR_BUTTON_PADDING_X,
  SETTINGS_PANEL_START_TOUR_FONT_SIZE,
  SETTINGS_PANEL_START_TOUR_ICON_SIZE,
  SETTINGS_PANEL_TOAST_DURATION_MS,
  SETTINGS_PANEL_TIMEOUT_DELAY_MS,
  SETTINGS_PANEL_PROFILE_BANNER_HEIGHT,
  SETTINGS_PANEL_PROFILE_AVATAR_SIZE,
  SETTINGS_PANEL_PROFILE_AVATAR_FONT_SIZE,
  SETTINGS_PANEL_PROFILE_AVATAR_OVERLAP_OFFSET,
  SETTINGS_PANEL_EDIT_BUTTON_SIZE,
  SETTINGS_PANEL_PROFILE_CONTENT_PADDING_X,
  SETTINGS_PANEL_PROFILE_CONTENT_PADDING_BOTTOM,
  SETTINGS_PANEL_PROFILE_CONTENT_PADDING_TOP,
  SETTINGS_PANEL_PROFILE_NAME_SIZE,
  SETTINGS_PANEL_PROFILE_ICON_SIZE,
  SETTINGS_PANEL_PROFILE_EMAIL_ICON_SIZE,
  COMPONENT_DIMENSIONS,
  MIN_TOUCH_TARGET_PX,
  ICON_SIZE_XS,
  ICON_SIZE_LG,
  PANEL_GAP_SMALL,
  PANEL_GAP_MEDIUM,
  PANEL_FIELD_SPACING,
  SETTINGS_PANEL_SECTION_GAP,
  SETTINGS_PANEL_CONTROL_GROUP_PADDING_X,
  SETTINGS_PANEL_LIST_ROW_PADDING_Y,
} from '../lib/layout-constants';
import { NOTIFICATION_TOAST_MESSAGES, NOTIFICATION_PANEL_TEXT } from '../lib/notification-constants';
import { getInitials } from '../lib/utils';
import { SUBSCRIPTION_UI_TEXT, PRO_FEATURES_COUNT } from '../lib/subscription-constants';
import { CALENDAR_PROVIDERS, CALENDAR_SETTINGS_LABELS, CALENDAR_SETTINGS_UI } from '../lib/calendar-integration-constants';
import { getBrowserTimezone } from '../lib/timing-constants';
import { configureRevenueCat, getOfferings, isRevenueCatConfigured } from '../lib/revenuecat';
import { COLOR_PRIMARY, COLOR_PASTEL_LAVENDER, COLOR_PASTEL_LAVENDER_DARK, COLOR_PASTEL_SKY, COLOR_PASTEL_SKY_DARK, COLOR_PASTEL_MINT, COLOR_PASTEL_MINT_DARK, COLOR_TEXT_WHITE, getColorWithOpacity } from '../lib/color-theme';
import { API_BASE, getAIConfigStatus } from '../lib/api';

interface SettingsPanelProps {
  onStartTour?: () => void;
}

export function SettingsPanel({ onStartTour }: SettingsPanelProps) {
  const { user, signOut, updateProfile, accessToken } = useAuth();
  const { theme, setTheme, actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const { syncWithServer, isSyncing, lastSync, hoursSettings, updateHoursSettings, rolloverSettings, updateRolloverSettings, availableTags, addAvailableTag, removeAvailableTag } = useTasks();
  const { teams, currentTeamMembers, teamMembers, getTeamMember } = useTeam();
  const { settings: aiSettings, toggleAutoScheduling, togglePriorityBasedScheduling, toggleScheduleUnscheduledTasks, updateSettings } = useAI();
  const { subscription, features, cancelSubscription, refreshSubscription, isLoading: isSubscriptionLoading } = useSubscription();
  const { calendarStatus, isSyncing: isCalendarSyncing, lastSync: lastCalendarSync, connectingProvider, disconnectingProvider, connectCalendar, disconnectCalendar, syncAllTasks: syncAllTasksToCalendar, checkCalendarStatus } = useCalendar();
  const { awards, earnedAwards, getAwardProgress } = useAwards();
  const { permission, settings: notificationSettings, badgeCount, requestPermission, updateSettings: updateNotificationSettings } = useNotifications();
  const [dayType, setDayType] = useState<'weekday' | 'weekend'>('weekday');
  const [showPricingDialog, setShowPricingDialog] = useState(false);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [profileName, setProfileName] = useState(user?.name || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [hasSeenTour, setHasSeenTour] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState<string | undefined>(user?.avatar);
  const [showAvatarSelection, setShowAvatarSelection] = useState(false);
  const [serverAIConfigured, setServerAIConfigured] = useState<boolean | null>(null);
  const shouldUseMobileLayout = useMobileLayout(); // Use mobile layout for tablets in portrait/landscape

  useEffect(() => {
    let cancelled = false;
    getAIConfigStatus().then(({ configured }) => { if (!cancelled) setServerAIConfigured(configured); });
    return () => { cancelled = true; };
  }, []);

  // Update profile avatar state when user changes
  React.useEffect(() => {
    setProfileAvatar(user?.avatar);
  }, [user?.avatar]);

  // Update profile avatar state when user changes
  React.useEffect(() => {
    setProfileAvatar(user?.avatar);
  }, [user?.avatar]);
  
  // Date, Time & Theme settings state
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>(() => {
    const stored = localStorage.getItem('time-format');
    return (stored === '12h' || stored === '24h') ? stored : '12h';
  });
  const [weekStart, setWeekStart] = useState<'sunday' | 'monday'>(() => {
    const stored = localStorage.getItem('week-start');
    return (stored === 'sunday' || stored === 'monday') ? stored : 'sunday';
  });
  
  // Persist timeFormat to localStorage
  useEffect(() => {
    localStorage.setItem('time-format', timeFormat);
  }, [timeFormat]);
  
  // Persist weekStart to localStorage
  useEffect(() => {
    localStorage.setItem('week-start', weekStart);
  }, [weekStart]);
  
  // Pricing state (dynamically fetched from RevenueCat)
  const [currentPricing, setCurrentPricing] = useState<{
    monthly?: string | null;
    yearly?: string | null;
    lastUpdated?: string;
  }>({
    monthly: null,
    yearly: null,
    lastUpdated: new Date().toISOString(),
  });

  const handlePricingUpdate = useCallback((pricing: { monthly?: string | null; yearly?: string | null; timestamp?: string }) => {
    setCurrentPricing({
      monthly: pricing.monthly ?? null,
      yearly: pricing.yearly ?? null,
      lastUpdated: pricing.timestamp || new Date().toISOString(),
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function fetchPricing() {
      try {
        if (!user?.id) return;
        await configureRevenueCat(user.id);
        if (!isRevenueCatConfigured()) return;
        const offerings = await getOfferings();
        if (!isMounted) return;
        handlePricingUpdate({
          monthly: offerings.monthly?.priceString ?? null,
          yearly: offerings.yearly?.priceString ?? null,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.warn('SettingsPanel pricing fetch failed:', error);
      }
    }
    fetchPricing();
    return () => {
      isMounted = false;
    };
  }, [user?.id, handlePricingUpdate]);

  // Helper function to get icon name (icons now use Icon component)
  const getAwardIconName = (iconName: string): string => {
    // Icon names are already in the correct format for Icon component
    return iconName;
  };

  // Memoize award counts to avoid recalculating on every render
  const awardCounts = useMemo(() => {
    const completionAwards = awards.filter(a => a.category === 'completion');
    const streakAwards = awards.filter(a => a.category === 'streak');
    const focusAwards = awards.filter(a => a.category === 'focus');
    
    // Create a map for faster lookups
    const awardMap = new Map(awards.map(a => [a.id, a]));
    
    return {
      completion: {
        earned: earnedAwards.filter(ea => awardMap.get(ea.awardId)?.category === 'completion').length,
        total: completionAwards.length,
      },
      streak: {
        earned: earnedAwards.filter(ea => awardMap.get(ea.awardId)?.category === 'streak').length,
        total: streakAwards.length,
      },
      focus: {
        earned: earnedAwards.filter(ea => awardMap.get(ea.awardId)?.category === 'focus').length,
        total: focusAwards.length,
      },
    };
  }, [awards, earnedAwards]);

  // Check if user has seen tour on mount and when storage changes
  useEffect(() => {
    const checkTourStatus = () => {
      try {
        const tourCompleted = window?.localStorage?.getItem('taskzm_tour_completed');
        setHasSeenTour(tourCompleted === 'true');
      } catch (error) {
        logger.warn('Unable to access localStorage for tour status:', error);
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

  const handleDeleteAccount = async () => {
    if (!user?.id || !accessToken) {
      toast.error('Unable to delete account: User not authenticated');
      return;
    }

    setIsDeletingAccount(true);
    try {
      const response = await fetch(`${API_BASE}/delete-account`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to delete account');
      }

      const result = await response.json();
      
      toast.success('Account deleted successfully', {
        description: 'All your data has been permanently deleted.',
      });

      // Sign out and redirect
      await signOut();
      
      // Clear all local storage
      localStorage.clear();
      
      // Redirect to home/login page
      window.location.href = '/';
    } catch (error) {
      logger.error('Error deleting account:', error);
      toast.error('Failed to delete account', {
        description: error instanceof Error ? error.message : 'Please try again or contact support.',
      });
      setIsDeletingAccount(false);
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

      const hasNameChange = trimmedName !== user?.name;
      const hasAvatarChange = profileAvatar !== undefined && profileAvatar !== user?.avatar;
      
      if (!hasNameChange && !hasAvatarChange) {
        toast.info('No changes to save');
        return;
      }

      await updateProfile({ 
        name: hasNameChange ? trimmedName : undefined,
        avatar: hasAvatarChange ? profileAvatar : undefined,
      });
      toast.success('Profile updated successfully');
    } catch (error) {
      // Error handled by toast notification
      toast.error('Failed to update profile');
      // Reset to original value on error
      setProfileName(user?.name || '');
      setProfileAvatar(user?.avatar);
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
      logger.debug('🎯 Tour manually triggered from Settings Panel');
      onStartTour();
      toast.info('Starting app tour...', {
        description: 'Let us show you around TaskZM!'
      });
    } else {
        logger.warn('⚠️ onStartTour prop not provided to SettingsPanel');
      toast.error('Unable to start tour', {
        description: 'Tour functionality is not available. Please refresh the page.'
      });
    }
  };

  return (
    <div className="h-full flex flex-col min-w-0 bg-background">
      <AppHeader
        title={NAVIGATION_UI_TEXT.settings}
        panelOpen={true}
        isSidePanelHeader={true}
        description="Customize your task manager"
        hideDesktopLogo
        actions={
          onStartTour ? (
            <Button
              size="sm"
              variant="outline"
              className="flex items-center rounded-full"
              style={{
                gap: SETTINGS_PANEL_START_TOUR_BUTTON_GAP,
                height: SETTINGS_PANEL_START_TOUR_BUTTON_HEIGHT,
                paddingInline: SETTINGS_PANEL_START_TOUR_BUTTON_PADDING_X,
                fontSize: SETTINGS_PANEL_START_TOUR_FONT_SIZE,
                lineHeight: SETTINGS_PANEL_START_TOUR_BUTTON_HEIGHT,
              }}
              onClick={handleStartTour}
            >
              <Icon name="compass" size={SETTINGS_PANEL_START_TOUR_ICON_SIZE} weight="duotone" />
              Start Tour
            </Button>
          ) : null
        }
      />
      <div
        className="flex-1 overflow-y-auto overflow-x-auto overscroll-y-contain min-w-0 flex flex-col items-stretch"
        data-tour="settings-panel"
        style={{ 
          WebkitOverflowScrolling: 'touch',
          paddingBottom: shouldUseMobileLayout ? `calc(${NAV_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px) + ${NAV_BAR_SCROLL_BUFFER_REM})` : undefined, // Add padding to scroll container on mobile/tablet to ensure content can scroll past nav bar
        } as React.CSSProperties}
      >
        <div 
          className="mx-auto w-full box-border min-w-0 break-words" 
          style={{ 
            padding: SETTINGS_PANEL_CONTAINER_PADDING_SMALL,
            paddingLeft: SETTINGS_PANEL_CONTAINER_PADDING_SMALL,
            paddingRight: SETTINGS_PANEL_CONTAINER_PADDING_SMALL,
            maxWidth: '100%',
            // On mobile/tablet, header is fixed at top, so minimal top padding needed (scroll container handles spacing)
            // On desktop, use larger padding since header is relative
            paddingTop: shouldUseMobileLayout 
              ? SETTINGS_PANEL_PADDING_MEDIUM // 0.75rem (12px) - minimal spacing after fixed header
              : SETTINGS_PANEL_CONTAINER_PADDING_LARGE, // 2rem - larger spacing for desktop relative header
            paddingBottom: shouldUseMobileLayout
              ? `calc(${NAV_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px) + ${NAV_BAR_SCROLL_BUFFER_REM})` // Full nav bar height + safe area + extra buffer to ensure last item is fully visible and scrollable
              : SETTINGS_PANEL_CONTAINER_PADDING_LARGE,
          }}
        >
          <div 
            className="mx-auto w-full max-w-full box-border min-w-0 break-words overflow-x-auto" 
            style={{ 
              maxWidth: `min(${SETTINGS_PANEL_MAX_WIDTH}, 100%)`,
              paddingBottom: 0, // Bottom padding handled by parent container
              paddingTop: shouldUseMobileLayout
                ? SETTINGS_PANEL_PADDING_MEDIUM // 0.75rem (12px) on mobile/tablet for better spacing after AppHeader
                : SETTINGS_PANEL_PADDING_TOP 
            }}
          >
          <Accordion type="multiple" defaultValue={['user-profile']} className="w-full min-w-0" style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SECTION_GAP }}>
        <SettingsCategoryHeader title={SETTINGS_PANEL_UI_TEXT.categories.account} />
        <SettingsSection
          value="user-profile"
          icon="user-circle-check"
          title={SETTINGS_PANEL_UI_TEXT.profile.userProfile}
          description={SETTINGS_PANEL_UI_TEXT.sections.userProfile.description}
        >

                      <SettingsProfileSection
                        displayName={user?.name || SETTINGS_PANEL_UI_TEXT.profile.fallbackName}
                        email={user?.email || SETTINGS_PANEL_UI_TEXT.profile.fallbackEmail}
                        username={user?.email?.split('@')[0] || SETTINGS_PANEL_UI_TEXT.profile.user}
                        avatar={user?.avatar}
                        role={user?.role}
                        teamName={(() => {
                          const userTeamMember =
                            currentTeamMembers.find((m) => m.id === user?.id) ||
                            teamMembers.find((m) => m.id === user?.id);
                          const teamId = userTeamMember?.teamId || user?.teamId;
                          return teamId ? teams.find((t) => t.id === teamId)?.name ?? null : null;
                        })()}
                        profileName={profileName}
                        onProfileNameChange={setProfileName}
                        isUpdatingProfile={isUpdatingProfile}
                        canSaveProfile={profileName.trim() !== user?.name}
                        onSaveProfile={handleUpdateProfile}
                        onChangeAvatar={() => setShowAvatarSelection(true)}
                        onSignOut={handleSignOut}
                        onDeleteAccount={() => setShowDeleteAccountDialog(true)}
                        subscriptionTier={subscription.tier === 'pro' ? 'pro' : 'free'}
                        subscriptionStatus={subscription.status}
                        billingPeriod={subscription.billingPeriod}
                      />
          
        </SettingsSection>

        <SettingsSection
          value="subscription"
          icon="credit-card"
          title={SUBSCRIPTION_UI_TEXT.settings.sectionTitle}
          description={SETTINGS_PANEL_UI_TEXT.sections.subscription.description}
          badge={subscription.tier === 'pro' ? (
            <Badge className={`${UI_SETTINGS_BADGE_COLORS.primaryClass} text-gray-800 ${UI_SETTINGS_BADGE_COLORS.primaryBorderClass}`} style={{ marginLeft: SETTINGS_PANEL_MARGIN_LEFT_SMALL }}>
              <Icon name="sparkles" size={SETTINGS_PANEL_ICON_SIZE_SMALL} weight="duotone" style={{ marginRight: SETTINGS_PANEL_MARGIN_RIGHT_XSMALL }} />
              {SUBSCRIPTION_UI_TEXT.settings.proBadge}
            </Badge>
          ) : undefined}
        >

                      <div style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_LARGE }}>
                        <div className="flex items-start justify-between" style={{ gap: SETTINGS_PANEL_SPACING_LARGE }}>
                          <div className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_XSMALL }}>
                            <div className="flex items-center" style={{ gap: SETTINGS_PANEL_SPACING_SMALL }}>
                              <Label className="text-sm">{SUBSCRIPTION_UI_TEXT.settings.currentPlan.label}</Label>
                              {isSubscriptionLoading && (
                                <Icon name="refresh-cw" size={SETTINGS_PANEL_ICON_SIZE_SMALL} className="text-muted-foreground animate-spin" />
                              )}
                            </div>
                            <p className="text-muted-foreground" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>
                              {subscription.tier === 'pro' 
                                ? `${SUBSCRIPTION_UI_TEXT.settings.currentPlan.pro}${subscription.billingPeriod ? ` (${subscription.billingPeriod === 'monthly' ? 'Monthly' : 'Yearly'})` : ''}`
                                : SUBSCRIPTION_UI_TEXT.settings.currentPlan.free}
                            </p>
                            {subscription.tier === 'pro' && subscription.startDate && (
                              <p className="text-muted-foreground/70" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_XSMALL, marginTop: SETTINGS_PANEL_MARGIN_TOP_SMALL }}>
                                {SUBSCRIPTION_UI_TEXT.settings.subscriptionDetails.started} {new Date(subscription.startDate).toLocaleDateString()}
                              </p>
                            )}
                            {/* Show feature limits for free tier */}
                            {subscription.tier === 'free' && features.aiSchedulerLimit !== undefined && (
                              <p className="text-muted-foreground/70" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_XSMALL, marginTop: SETTINGS_PANEL_MARGIN_TOP_SMALL }}>
                                AI Scheduler: {features.aiSchedulerLimit} suggestions/week
                              </p>
                            )}
                            {/* Show feature limits for monthly pro */}
                            {subscription.tier === 'pro' && subscription.billingPeriod === 'monthly' && features.analyticsDaysLimit !== undefined && (
                              <p className="text-muted-foreground/70" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_XSMALL, marginTop: SETTINGS_PANEL_MARGIN_TOP_SMALL }}>
                                Analytics: {features.analyticsDaysLimit}-day history
                              </p>
                            )}
                          </div>
                          <Badge 
                            variant={(subscription.status || 'active') === 'active' ? 'default' : 'secondary'}
                            className={(subscription.status || 'active') === 'active' ? `${UI_SETTINGS_BADGE_COLORS.subscriptionClass} text-gray-800 ${UI_SETTINGS_BADGE_COLORS.subscriptionBorderClass}` : ''}
                          >
                            {subscription.status 
                              ? subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)
                              : SUBSCRIPTION_UI_TEXT.settings.subscriptionDetails.activeStatus
                            }
                          </Badge>
                        </div>

                        {/* Subscription Details for Pro */}
                        {subscription.tier === 'pro' && subscription.endDate && (
                          <div className="text-xs text-muted-foreground" style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_XSMALL }}>
                            {subscription.cancelAtPeriodEnd ? (
                              <p className="text-amber-600 dark:text-amber-400">
                                {SUBSCRIPTION_UI_TEXT.settings.subscriptionDetails.expires} {new Date(subscription.endDate).toLocaleDateString()}
                              </p>
                            ) : (
                              <p>{SUBSCRIPTION_UI_TEXT.settings.subscriptionDetails.nextBilling} {new Date(subscription.endDate).toLocaleDateString()}</p>
                            )}
                          </div>
                        )}

                        <Separator style={{ marginTop: SETTINGS_PANEL_SEPARATOR_MARGIN_Y, marginBottom: SETTINGS_PANEL_SEPARATOR_MARGIN_Y }} />

                        {/* Features List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_MEDIUM }}>
                          <Label className="text-xs text-muted-foreground">{SUBSCRIPTION_UI_TEXT.settings.features.sectionTitle}</Label>
                          <div className="grid" style={{ gap: SETTINGS_PANEL_SPACING_MEDIUM }}>
                            {/* Unlimited Tasks - Available for all */}
                            <div className="flex items-center min-w-0" style={{ gap: SETTINGS_PANEL_GAP_MEDIUM }}>
                              <Icon name="check" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                              <span className="min-w-0 flex-1 break-words" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>{SUBSCRIPTION_UI_TEXT.settings.features.unlimitedTasks}</span>
                            </div>

                            {/* Custom Tags - Available for all */}
                            <div className="flex items-center min-w-0" style={{ gap: SETTINGS_PANEL_GAP_MEDIUM }}>
                              <Icon name="check" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                              <span className="min-w-0 flex-1 break-words" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>{SUBSCRIPTION_UI_TEXT.settings.features.customTags}</span>
                            </div>

                            {/* AI Scheduler - PRO only */}
                            <div className="flex items-center min-w-0" style={{ gap: SETTINGS_PANEL_GAP_MEDIUM }}>
                              {features.aiScheduler ? (
                                <Icon name="check" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                              ) : (
                                <Icon name="x" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} className="text-gray-400 dark:text-muted-foreground flex-shrink-0" />
                              )}
                              <span className={`${features.aiScheduler ? '' : 'text-muted-foreground/60'} min-w-0 flex-1 break-words`} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>
                                {SUBSCRIPTION_UI_TEXT.settings.features.aiScheduler}
                                {features.aiSchedulerLimit !== undefined && (
                                  <span className="text-muted-foreground/70"> ({features.aiSchedulerLimit}/week)</span>
                                )}
                              </span>
                              {!features.aiScheduler && (
                                <Badge variant="outline" className={`${UI_SETTINGS_BADGE_COLORS.gradientClass} text-primary-foreground border-0 flex-shrink-0`} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_XSMALL, paddingLeft: SETTINGS_PANEL_BADGE_PADDING_LEFT, paddingRight: SETTINGS_PANEL_BADGE_PADDING_RIGHT, paddingTop: SETTINGS_PANEL_BADGE_PADDING_TOP, paddingBottom: SETTINGS_PANEL_BADGE_PADDING_BOTTOM, height: SETTINGS_PANEL_BADGE_HEIGHT }}>
                                  {SUBSCRIPTION_UI_TEXT.settings.features.proBadge}
                                </Badge>
                              )}
                            </div>

                            {/* Task Hours - PRO only */}
                            <div className="flex items-center min-w-0" style={{ gap: SETTINGS_PANEL_GAP_MEDIUM }}>
                              {features.taskHours ? (
                                <Icon name="check" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                              ) : (
                                <Icon name="x" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} className="text-gray-400 dark:text-muted-foreground flex-shrink-0" />
                              )}
                              <span className={`${features.taskHours ? '' : 'text-muted-foreground/60'} min-w-0 flex-1 break-words`} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>
                                {SUBSCRIPTION_UI_TEXT.settings.features.taskHours}
                              </span>
                              {!features.taskHours && (
                                <Badge variant="outline" className={`${UI_SETTINGS_BADGE_COLORS.gradientClass} text-primary-foreground border-0 flex-shrink-0`} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_XSMALL, paddingLeft: SETTINGS_PANEL_BADGE_PADDING_LEFT, paddingRight: SETTINGS_PANEL_BADGE_PADDING_RIGHT, paddingTop: SETTINGS_PANEL_BADGE_PADDING_TOP, paddingBottom: SETTINGS_PANEL_BADGE_PADDING_BOTTOM, height: SETTINGS_PANEL_BADGE_HEIGHT }}>
                                  {SUBSCRIPTION_UI_TEXT.settings.features.proBadge}
                                </Badge>
                              )}
                            </div>

                            {/* Analytics - PRO only */}
                            <div className="flex items-center min-w-0" style={{ gap: SETTINGS_PANEL_GAP_MEDIUM }}>
                              {features.analytics ? (
                                <Icon name="check" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                              ) : (
                                <Icon name="x" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} className="text-gray-400 dark:text-muted-foreground flex-shrink-0" />
                              )}
                              <span className={`${features.analytics ? '' : 'text-muted-foreground/60'} min-w-0 flex-1 break-words`} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>
                                {SUBSCRIPTION_UI_TEXT.settings.features.analytics}
                                {features.analyticsDaysLimit !== undefined && (
                                  <span className="text-muted-foreground/70"> ({features.analyticsDaysLimit}-day history)</span>
                                )}
                                {features.analytics && features.analyticsDaysLimit === undefined && (
                                  <span className="text-muted-foreground/70"> (Unlimited)</span>
                                )}
                              </span>
                              {!features.analytics && (
                                <Badge variant="outline" className={`${UI_SETTINGS_BADGE_COLORS.gradientClass} text-primary-foreground border-0 flex-shrink-0`} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_XSMALL, paddingLeft: SETTINGS_PANEL_BADGE_PADDING_LEFT, paddingRight: SETTINGS_PANEL_BADGE_PADDING_RIGHT, paddingTop: SETTINGS_PANEL_BADGE_PADDING_TOP, paddingBottom: SETTINGS_PANEL_BADGE_PADDING_BOTTOM, height: SETTINGS_PANEL_BADGE_HEIGHT }}>
                                  {SUBSCRIPTION_UI_TEXT.settings.features.proBadge}
                                </Badge>
                              )}
                            </div>

                            {/* Pomodoro Timer - PRO only */}
                            <div className="flex items-center min-w-0" style={{ gap: SETTINGS_PANEL_GAP_MEDIUM }}>
                              {features.pomodoroTimer ? (
                                <Icon name="check" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                              ) : (
                                <Icon name="x" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} className="text-gray-400 dark:text-muted-foreground flex-shrink-0" />
                              )}
                              <span className={`${features.pomodoroTimer ? '' : 'text-muted-foreground/60'} min-w-0 flex-1 break-words`} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>
                                {SUBSCRIPTION_UI_TEXT.settings.features.pomodoroTimer}
                              </span>
                              {!features.pomodoroTimer && (
                                <Badge variant="outline" className={`${UI_SETTINGS_BADGE_COLORS.gradientClass} text-primary-foreground border-0 flex-shrink-0`} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_XSMALL, paddingLeft: SETTINGS_PANEL_BADGE_PADDING_LEFT, paddingRight: SETTINGS_PANEL_BADGE_PADDING_RIGHT, paddingTop: SETTINGS_PANEL_BADGE_PADDING_TOP, paddingBottom: SETTINGS_PANEL_BADGE_PADDING_BOTTOM, height: SETTINGS_PANEL_BADGE_HEIGHT }}>
                                  {SUBSCRIPTION_UI_TEXT.settings.features.proBadge}
                                </Badge>
                              )}
                            </div>

                            {/* Team Features - PRO only */}
                            <div className="flex items-center min-w-0" style={{ gap: SETTINGS_PANEL_GAP_MEDIUM }}>
                              {features.teamFeatures ? (
                                <Icon name="check" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                              ) : (
                                <Icon name="x" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} className="text-gray-400 dark:text-muted-foreground flex-shrink-0" />
                              )}
                              <span className={`${features.teamFeatures ? '' : 'text-muted-foreground/60'} min-w-0 flex-1 break-words`} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>
                                {SUBSCRIPTION_UI_TEXT.settings.features.teamCollaboration}
                              </span>
                              {!features.teamFeatures && (
                                <Badge variant="outline" className={`${UI_SETTINGS_BADGE_COLORS.gradientClass} text-primary-foreground border-0 flex-shrink-0`} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_XSMALL, paddingLeft: SETTINGS_PANEL_BADGE_PADDING_LEFT, paddingRight: SETTINGS_PANEL_BADGE_PADDING_RIGHT, paddingTop: SETTINGS_PANEL_BADGE_PADDING_TOP, paddingBottom: SETTINGS_PANEL_BADGE_PADDING_BOTTOM, height: SETTINGS_PANEL_BADGE_HEIGHT }}>
                                  {SUBSCRIPTION_UI_TEXT.settings.features.proBadge}
                                </Badge>
                              )}
                            </div>

                            {/* Calendar Sync - PRO only */}
                            <div className="flex items-center min-w-0" style={{ gap: SETTINGS_PANEL_GAP_MEDIUM }}>
                              {features.calendarSync ? (
                                <Icon name="check" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                              ) : (
                                <Icon name="x" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} className="text-gray-400 dark:text-muted-foreground flex-shrink-0" />
                              )}
                              <span className={`${features.calendarSync ? '' : 'text-muted-foreground/60'} min-w-0 flex-1 break-words`} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>
                                {SUBSCRIPTION_UI_TEXT.settings.features.calendarSync}
                                {features.calendarSync && features.calendarSyncLimit !== undefined && (
                                  <span className="text-muted-foreground/70"> ({features.calendarSyncLimit} connection{features.calendarSyncLimit === 1 ? '' : 's'})</span>
                                )}
                                {features.calendarSync && features.calendarSyncLimit === undefined && (
                                  <span className="text-muted-foreground/70"> (Unlimited)</span>
                                )}
                              </span>
                              {!features.calendarSync && (
                                <Badge variant="outline" className={`${UI_SETTINGS_BADGE_COLORS.gradientClass} text-primary-foreground border-0 flex-shrink-0`} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_XSMALL, paddingLeft: SETTINGS_PANEL_BADGE_PADDING_LEFT, paddingRight: SETTINGS_PANEL_BADGE_PADDING_RIGHT, paddingTop: SETTINGS_PANEL_BADGE_PADDING_TOP, paddingBottom: SETTINGS_PANEL_BADGE_PADDING_BOTTOM, height: SETTINGS_PANEL_BADGE_HEIGHT }}>
                                  {SUBSCRIPTION_UI_TEXT.settings.features.proBadge}
                                </Badge>
                              )}
                            </div>

                            {/* Recurring Tasks - PRO (Monthly with limit, Yearly unlimited) */}
                            <div className="flex items-center min-w-0" style={{ gap: SETTINGS_PANEL_GAP_MEDIUM }}>
                              {features.recurringTasks ? (
                                <Icon name="check" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                              ) : (
                                <Icon name="x" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} className="text-gray-400 dark:text-muted-foreground flex-shrink-0" />
                              )}
                              <span className={`${features.recurringTasks ? '' : 'text-muted-foreground/60'} min-w-0 flex-1 break-words`} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>
                                {SUBSCRIPTION_UI_TEXT.settings.features.recurringTasks}
                                {features.recurringTasks && features.recurringTasksLimit !== undefined && (
                                  <span className="text-muted-foreground/70"> (up to {features.recurringTasksLimit} active)</span>
                                )}
                                {features.recurringTasks && features.recurringTasksLimit === undefined && (
                                  <span className="text-muted-foreground/70"> (Unlimited)</span>
                                )}
                              </span>
                              {!features.recurringTasks && (
                                <Badge variant="outline" className={`${UI_SETTINGS_BADGE_COLORS.gradientClass} text-primary-foreground border-0 flex-shrink-0`} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_XSMALL, paddingLeft: SETTINGS_PANEL_BADGE_PADDING_LEFT, paddingRight: SETTINGS_PANEL_BADGE_PADDING_RIGHT, paddingTop: SETTINGS_PANEL_BADGE_PADDING_TOP, paddingBottom: SETTINGS_PANEL_BADGE_PADDING_BOTTOM, height: SETTINGS_PANEL_BADGE_HEIGHT }}>
                                  {SUBSCRIPTION_UI_TEXT.settings.features.proBadge}
                                </Badge>
                              )}
                            </div>

                            {/* Task Rollover - PRO only */}
                            <div className="flex items-center min-w-0" style={{ gap: SETTINGS_PANEL_GAP_MEDIUM }}>
                              {features.taskRollover ? (
                                <Icon name="check" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                              ) : (
                                <Icon name="x" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} className="text-gray-400 dark:text-muted-foreground flex-shrink-0" />
                              )}
                              <span className={`${features.taskRollover ? '' : 'text-muted-foreground/60'} min-w-0 flex-1 break-words`} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>
                                {SUBSCRIPTION_UI_TEXT.settings.features.autoTaskRollover}
                              </span>
                              {!features.taskRollover && (
                                <Badge variant="outline" className={`${UI_SETTINGS_BADGE_COLORS.gradientClass} text-primary-foreground border-0 flex-shrink-0`} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_XSMALL, paddingLeft: SETTINGS_PANEL_BADGE_PADDING_LEFT, paddingRight: SETTINGS_PANEL_BADGE_PADDING_RIGHT, paddingTop: SETTINGS_PANEL_BADGE_PADDING_TOP, paddingBottom: SETTINGS_PANEL_BADGE_PADDING_BOTTOM, height: SETTINGS_PANEL_BADGE_HEIGHT }}>
                                  {SUBSCRIPTION_UI_TEXT.settings.features.proBadge}
                                </Badge>
                              )}
                            </div>

                            {/* Yearly-only features section */}
                            {(subscription.tier === 'pro' && subscription.billingPeriod === 'yearly') || 
                             (!features.taskTemplates || !features.taskDependencies || !features.multipleWorkspaces) ? (
                              <>
                                <Separator className="my-2" />
                                <div className="text-xs font-semibold text-muted-foreground mb-2">Pro Yearly Features:</div>

                                {/* Task Templates - PRO YEARLY only */}
                                <div className="flex items-center min-w-0" style={{ gap: SETTINGS_PANEL_GAP_MEDIUM }}>
                                  {features.taskTemplates ? (
                                    <Icon name="check" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                                  ) : (
                                    <Icon name="x" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} className="text-gray-400 dark:text-muted-foreground flex-shrink-0" />
                                  )}
                                  <span className={`${features.taskTemplates ? '' : 'text-muted-foreground/60'} min-w-0 flex-1 break-words`} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>
                                    {SUBSCRIPTION_UI_TEXT.settings.features.taskTemplates}
                                  </span>
                                  {!features.taskTemplates && (
                                    <Badge variant="outline" className={`${UI_SETTINGS_BADGE_COLORS.gradientClass} text-primary-foreground border-0 flex-shrink-0`} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_XSMALL, paddingLeft: SETTINGS_PANEL_BADGE_PADDING_LEFT, paddingRight: SETTINGS_PANEL_BADGE_PADDING_RIGHT, paddingTop: SETTINGS_PANEL_BADGE_PADDING_TOP, paddingBottom: SETTINGS_PANEL_BADGE_PADDING_BOTTOM, height: SETTINGS_PANEL_BADGE_HEIGHT }}>
                                      {SUBSCRIPTION_UI_TEXT.settings.features.yearlyBadge}
                                    </Badge>
                                  )}
                                </div>

                                {/* Task Dependencies - PRO YEARLY only */}
                                <div className="flex items-center min-w-0" style={{ gap: SETTINGS_PANEL_GAP_MEDIUM }}>
                                  {features.taskDependencies ? (
                                    <Icon name="check" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                                  ) : (
                                    <Icon name="x" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} className="text-gray-400 dark:text-muted-foreground flex-shrink-0" />
                                  )}
                                  <span className={`${features.taskDependencies ? '' : 'text-muted-foreground/60'} min-w-0 flex-1 break-words`} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>
                                    {SUBSCRIPTION_UI_TEXT.settings.features.taskDependencies}
                                  </span>
                                  {!features.taskDependencies && (
                                    <Badge variant="outline" className={`${UI_SETTINGS_BADGE_COLORS.gradientClass} text-primary-foreground border-0 flex-shrink-0`} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_XSMALL, paddingLeft: SETTINGS_PANEL_BADGE_PADDING_LEFT, paddingRight: SETTINGS_PANEL_BADGE_PADDING_RIGHT, paddingTop: SETTINGS_PANEL_BADGE_PADDING_TOP, paddingBottom: SETTINGS_PANEL_BADGE_PADDING_BOTTOM, height: SETTINGS_PANEL_BADGE_HEIGHT }}>
                                      {SUBSCRIPTION_UI_TEXT.settings.features.yearlyBadge}
                                    </Badge>
                                  )}
                                </div>

                                {/* Multiple Workspaces - PRO YEARLY only */}
                                <div className="flex items-center min-w-0" style={{ gap: SETTINGS_PANEL_GAP_MEDIUM }}>
                                  {features.multipleWorkspaces ? (
                                    <Icon name="check" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                                  ) : (
                                    <Icon name="x" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} className="text-gray-400 dark:text-muted-foreground flex-shrink-0" />
                                  )}
                                  <span className={`${features.multipleWorkspaces ? '' : 'text-muted-foreground/60'} min-w-0 flex-1 break-words`} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>
                                    {SUBSCRIPTION_UI_TEXT.settings.features.multipleWorkspaces}
                                  </span>
                                  {!features.multipleWorkspaces && (
                                    <Badge variant="outline" className={`${UI_SETTINGS_BADGE_COLORS.gradientClass} text-primary-foreground border-0 flex-shrink-0`} style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_XSMALL, paddingLeft: SETTINGS_PANEL_BADGE_PADDING_LEFT, paddingRight: SETTINGS_PANEL_BADGE_PADDING_RIGHT, paddingTop: SETTINGS_PANEL_BADGE_PADDING_TOP, paddingBottom: SETTINGS_PANEL_BADGE_PADDING_BOTTOM, height: SETTINGS_PANEL_BADGE_HEIGHT }}>
                                      {SUBSCRIPTION_UI_TEXT.settings.features.yearlyBadge}
                                    </Badge>
                                  )}
                                </div>
                              </>
                            ) : null}
                          </div>
                        </div>

                        {subscription.tier === 'free' && (
                          <>
                            <Separator style={{ marginTop: SETTINGS_PANEL_SEPARATOR_MARGIN_Y, marginBottom: SETTINGS_PANEL_SEPARATOR_MARGIN_Y }} />
                            <div className={`${UI_SETTINGS_BADGE_COLORS.infoBox.background.className} ${UI_SETTINGS_BADGE_COLORS.infoBox.border.className} rounded-lg p-4`}>
                              <div className="flex items-start" style={{ gap: SETTINGS_PANEL_GAP_MEDIUM, marginBottom: SETTINGS_PANEL_MARGIN_BOTTOM_MEDIUM }}>
                                <Icon name="sparkles" size={SETTINGS_PANEL_ICON_SIZE_LARGE} weight="duotone" className={`${UI_SETTINGS_BADGE_COLORS.infoBox.iconClass} flex-shrink-0`} style={{ marginTop: SETTINGS_PANEL_MARGIN_TOP_XSMALL }} />
                                <div>
                                  <p className="mb-1" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_MEDIUM, marginBottom: SETTINGS_PANEL_MARGIN_BOTTOM_SMALL }}>{SUBSCRIPTION_UI_TEXT.settings.upgradeToPro}</p>
                                  <p className="text-muted-foreground" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>
                                    {SUBSCRIPTION_UI_TEXT.settings.unlockFeatures(PRO_FEATURES_COUNT, currentPricing.monthly || '—')}
                                  </p>
                                </div>
                              </div>
                              <Button 
                                size="sm" 
                                className={`w-full ${UI_SETTINGS_BADGE_COLORS.primaryClass} ${UI_SETTINGS_BADGE_COLORS.primaryHoverClass} text-gray-800`}
                                onClick={() => setShowPricingDialog(true)}
                              >
                                <Icon name="sparkles" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} weight="duotone" style={{ marginRight: SETTINGS_PANEL_MARGIN_RIGHT_SMALL }} />
                                {SUBSCRIPTION_UI_TEXT.settings.viewPlans}
                              </Button>
                            </div>
                          </>
                        )}

                        {subscription.tier === 'pro' && (
                          <>
                            <Separator style={{ marginTop: SETTINGS_PANEL_SEPARATOR_MARGIN_Y, marginBottom: SETTINGS_PANEL_SEPARATOR_MARGIN_Y }} />
                  
                            {subscription.cancelAtPeriodEnd && (
                              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg" style={{ padding: SETTINGS_PANEL_PADDING_MEDIUM, marginBottom: SETTINGS_PANEL_MARGIN_BOTTOM_MEDIUM }}>
                                <div className="flex items-start" style={{ gap: SETTINGS_PANEL_GAP_SMALL }}>
                                  <Icon name="info" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} className="text-amber-600 dark:text-amber-400 flex-shrink-0" style={{ marginTop: SETTINGS_PANEL_MARGIN_TOP_XSMALL }} />
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

                            <div style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_SMALL }}>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="w-full"
                                onClick={() => {
                                  // Open PricingDialog to show subscription options
                                  setShowPricingDialog(true);
                                }}
                              >
                                <Icon name="credit-card" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} style={{ marginRight: SETTINGS_PANEL_MARGIN_RIGHT_SMALL }} />
                                {(subscription.tier as SubscriptionTier) === 'free' ? SUBSCRIPTION_UI_TEXT.settings.upgradeToPro : SUBSCRIPTION_UI_TEXT.settings.manageSubscription}
                              </Button>

                              <div className="flex" style={{ gap: SETTINGS_PANEL_GAP_SMALL }}>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="flex-1 text-muted-foreground hover:text-foreground"
                                  onClick={() => {
                                    // Defer async operation to avoid blocking click handler
                                    requestAnimationFrame(() => {
                                      refreshSubscription()
                                        .then(() => {
                                          toast.success(SUBSCRIPTION_UI_TEXT.settings.subscriptionStatusRefreshed);
                                        })
                                        .catch(() => {
                                          toast.error(SUBSCRIPTION_UI_TEXT.settings.subscriptionRefreshFailed);
                                        });
                                    });
                                  }}
                                  disabled={isSubscriptionLoading}
                                >
                                  <Icon name="refresh-cw" size={SETTINGS_PANEL_ICON_SIZE_SMALL} className={isSubscriptionLoading ? 'animate-spin' : ''} style={{ marginRight: SETTINGS_PANEL_MARGIN_RIGHT_SMALL }} />
                                  {SUBSCRIPTION_UI_TEXT.settings.refresh}
                                </Button>

                                {!subscription.cancelAtPeriodEnd && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="flex-1 text-muted-foreground hover:text-destructive"
                                    onClick={() => {
                                      if (confirm(SUBSCRIPTION_UI_TEXT.confirmations.cancel.title + '\n\n' + SUBSCRIPTION_UI_TEXT.confirmations.cancel.message)) {
                                        // Defer async operation to avoid blocking click handler
                                        requestAnimationFrame(() => {
                                          cancelSubscription()
                                            .then(() => {
                                              toast.success(SUBSCRIPTION_UI_TEXT.settings.subscriptionWillCancel, {
                                                description: SUBSCRIPTION_UI_TEXT.settings.subscriptionWillCancelDesc,
                                              });
                                            })
                                            .catch(() => {
                                              toast.error(SUBSCRIPTION_UI_TEXT.settings.subscriptionCancelFailed, {
                                                description: SUBSCRIPTION_UI_TEXT.settings.subscriptionCancelFailedDesc,
                                              });
                                            });
                                        });
                                      }
                                    }}
                                  >
                                    <Icon name="x-circle" size={SETTINGS_PANEL_ICON_SIZE_SMALL} style={{ marginRight: SETTINGS_PANEL_MARGIN_RIGHT_SMALL }} />
                                    {SUBSCRIPTION_UI_TEXT.settings.cancel}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
          
        </SettingsSection>

        <SettingsCategoryHeader title={SETTINGS_PANEL_UI_TEXT.categories.integrations} />
        <SettingsSection
          value="calendar"
          icon="calendar"
          title={CALENDAR_SETTINGS_UI.sectionTitle}
          description={SETTINGS_PANEL_UI_TEXT.sections.calendar.description}
          dataTour="calendar-integration"
          badge={!features.calendarSync ? (
            <Badge variant="secondary" className={`ml-auto ${UI_SETTINGS_BADGE_COLORS.gradientClass} text-primary-foreground`}>
              PRO
            </Badge>
          ) : undefined}
        >

                      {!features.calendarSync ? (
                        <SettingsGroup>
                          <SettingsLead>{CALENDAR_SETTINGS_UI.proUpsellTitle}</SettingsLead>
                          <SettingsProUpsell
                            action={
                              <Button 
                                size="sm" 
                                onClick={() => setShowPricingDialog(true)}
                                className={`${UI_SETTINGS_BADGE_COLORS.primaryClass} ${UI_SETTINGS_BADGE_COLORS.primaryHoverClass} w-full`}
                              >
                                <Icon name="sparkles" size={SETTINGS_PANEL_ICON_SIZE_SMALL} weight="duotone" className="mr-1.5" style={{ marginRight: SETTINGS_PANEL_MARGIN_RIGHT_XSMALL }} />
                                {SUBSCRIPTION_UI_TEXT.settings.upgradeToProButton}
                              </Button>
                            }
                          >
                            <div className="flex items-center" style={{ gap: SETTINGS_PANEL_SPACING_MEDIUM }}>
                              <Icon name="lock" size={ICON_SIZE_MD} className={UI_SETTINGS_BADGE_COLORS.infoBox.iconClass} />
                              <span className="text-sm font-medium">Pro Feature</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {CALENDAR_SETTINGS_UI.proUpsellBullets.map((line) => (
                                <React.Fragment key={line}>
                                  • {line}<br />
                                </React.Fragment>
                              ))}
                            </p>
                          </SettingsProUpsell>
                        </SettingsGroup>
                      ) : (
                        <SettingsGroup>
                          <SettingsLead>{CALENDAR_SETTINGS_UI.sectionSubtitle}</SettingsLead>
                          <p className="text-xs text-muted-foreground">
                            {CALENDAR_SETTINGS_UI.deviceTimezoneNote.replace('{timezone}', getBrowserTimezone())}
                          </p>
                          <SettingsControlGroup>
                            <SettingsToggleRow
                              id={`${CALENDAR_PROVIDERS.google}-cal`}
                              label={CALENDAR_SETTINGS_LABELS.google}
                              checked={!!calendarStatus.google}
                              touchTarget
                              disabled={!!isCalendarSyncing || connectingProvider === CALENDAR_PROVIDERS.google || disconnectingProvider === CALENDAR_PROVIDERS.google}
                              onCheckedChange={async (checked) => {
                                try {
                                  if (checked) await connectCalendar(CALENDAR_PROVIDERS.google);
                                  else await disconnectCalendar(CALENDAR_PROVIDERS.google);
                                } catch (error) {
                                  logger.error('Calendar toggle error:', error);
                                  toast.error(error instanceof Error ? error.message : String(error));
                                }
                              }}
                            />
                            <SettingsToggleRow
                              id={`${CALENDAR_PROVIDERS.outlook}-cal`}
                              label={CALENDAR_SETTINGS_LABELS.outlook}
                              checked={!!calendarStatus.outlook}
                              touchTarget
                              disabled={!!isCalendarSyncing || connectingProvider === CALENDAR_PROVIDERS.outlook || disconnectingProvider === CALENDAR_PROVIDERS.outlook}
                              onCheckedChange={async (checked) => {
                                try {
                                  if (checked) await connectCalendar(CALENDAR_PROVIDERS.outlook);
                                  else await disconnectCalendar(CALENDAR_PROVIDERS.outlook);
                                } catch (error) {
                                  logger.error('Calendar toggle error:', error);
                                  toast.error(error instanceof Error ? error.message : String(error));
                                }
                              }}
                            />
                            <SettingsToggleRow
                              id={`${CALENDAR_PROVIDERS.apple}-cal`}
                              label={CALENDAR_SETTINGS_LABELS.apple}
                              checked={!!calendarStatus.apple}
                              touchTarget
                              disabled={!!isCalendarSyncing || connectingProvider === CALENDAR_PROVIDERS.apple || disconnectingProvider === CALENDAR_PROVIDERS.apple}
                              onCheckedChange={async (checked) => {
                                try {
                                  if (checked) await connectCalendar(CALENDAR_PROVIDERS.apple);
                                  else await disconnectCalendar(CALENDAR_PROVIDERS.apple);
                                } catch (error) {
                                  logger.error('Calendar toggle error:', error);
                                  toast.error(error instanceof Error ? error.message : String(error));
                                }
                              }}
                            />
                          </SettingsControlGroup>
                        </SettingsGroup>
                      )}

                      <SettingsDivider />

                      {(calendarStatus.google || calendarStatus.outlook) && (
                        <SettingsLead>{CALENDAR_SETTINGS_UI.viewOnlyMessage}</SettingsLead>
                      )}

                      <div className="space-y-2">
                        {calendarStatus.apple && (
                          <>
                            <Button 
                              size="sm" 
                              className="w-full"
                              onClick={() => syncAllTasksToCalendar(CALENDAR_PROVIDERS.apple)}
                              disabled={isCalendarSyncing}
                            >
                              <Icon name="calendar" size={SETTINGS_PANEL_ICON_SIZE_MEDIUM} weight="duotone" className="mr-2" style={{ marginRight: SETTINGS_PANEL_MARGIN_RIGHT_SMALL }} />
                              {isCalendarSyncing ? CALENDAR_SETTINGS_UI.syncButtonSyncing : CALENDAR_SETTINGS_UI.syncButtonLabel}
                            </Button>
                            {lastCalendarSync && (
                              <p className="text-xs text-muted-foreground text-center">
                                {CALENDAR_SETTINGS_UI.lastSyncedLabel} {new Date(lastCalendarSync).toLocaleString()}
                              </p>
                            )}
                          </>
                        )}
                      </div>
          
        </SettingsSection>

        <SettingsSection
          value="notifications"
          icon="bell"
          title="Notifications"
          description={SETTINGS_PANEL_UI_TEXT.sections.notifications.description}
          badge={badgeCount > 0 ? (
            <Badge variant="destructive" className="ml-auto flex-shrink-0 text-xs">
              {badgeCount}
            </Badge>
          ) : undefined}
        >

                      <SettingsGroup>
                        <SettingsLead>Manage notifications for due and overdue tasks</SettingsLead>

                        <SettingsStatusCard>
                          <div className="flex items-center justify-between" style={{ gap: SETTINGS_PANEL_GAP_SMALL, marginBottom: permission !== 'granted' ? SETTINGS_PANEL_MARGIN_BOTTOM_SMALL : 0 }}>
                            <span className="flex-1 min-w-0 font-medium" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_MEDIUM }}>Notification Permission</span>
                            <Badge 
                              variant={permission === 'granted' ? 'default' : permission === 'denied' ? 'destructive' : 'secondary'}
                              className="flex-shrink-0 text-xs"
                            >
                              {permission === 'granted' ? NOTIFICATION_PANEL_TEXT.permission.granted : permission === 'denied' ? NOTIFICATION_PANEL_TEXT.permission.denied : NOTIFICATION_PANEL_TEXT.permission.notSet}
                            </Badge>
                          </div>
                          {permission !== 'granted' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full text-xs md:text-sm"
                              style={{ marginTop: SETTINGS_PANEL_SPACING_SMALL }}
                              onClick={() => {
                                requestAnimationFrame(() => {
                                  requestPermission().then((granted) => {
                                    if (!granted && permission === 'default') {
                                      toast.info(NOTIFICATION_TOAST_MESSAGES.permissionDeniedInfo, {
                                        description: NOTIFICATION_TOAST_MESSAGES.permissionDeniedDescription,
                                        duration: SETTINGS_PANEL_TOAST_DURATION_MS,
                                      });
                                    }
                                  });
                                });
                              }}
                              disabled={permission === 'denied'}
                            >
                              <Icon name="bell" size={ICON_SIZE_SM} className="mr-1.5 md:mr-2" />
                              <span className="truncate">
                                {permission === 'denied' 
                                  ? NOTIFICATION_PANEL_TEXT.permission.blocked
                                  : NOTIFICATION_PANEL_TEXT.permission.enable}
                              </span>
                            </Button>
                          )}
                          {permission === 'denied' && (
                            <div style={{ marginTop: SETTINGS_PANEL_SPACING_MEDIUM, display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_SMALL }}>
                              <p className={`${SETTINGS_PANEL_TEXT_SIZES.helper} font-medium text-muted-foreground`}>
                                Notifications are blocked. Follow these steps to enable them:
                              </p>
                              <div className="rounded-lg border border-border/50 bg-background/60" style={{ padding: SETTINGS_PANEL_PADDING_SMALL, display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_SMALL }}>
                                {(() => {
                                  const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
                                  const isFirefox = /Firefox/.test(navigator.userAgent);
                                  const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
                                  const isEdge = /Edg/.test(navigator.userAgent);
                        
                                  if (isChrome || isEdge) {
                                    return (
                                      <div className={SETTINGS_PANEL_TEXT_SIZES.helper} style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_EXTRA_SMALL, color: 'inherit' }}>
                                        <p className="font-medium text-foreground">Chrome/Edge:</p>
                                        <ol className="list-decimal list-inside" style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_XSMALL, marginLeft: SETTINGS_PANEL_MARGIN_LEFT_XSMALL }}>
                                          <li>Click the lock icon (🔒) or info icon (i) in the address bar</li>
                                          <li>Find "Notifications" in the dropdown menu</li>
                                          <li>Change from "Block" to "Allow"</li>
                                          <li>Refresh this page</li>
                                        </ol>
                                        <p className="border-t border-border/50" style={{ marginTop: SETTINGS_PANEL_MARGIN_TOP_EXTRA_SMALL, paddingTop: SETTINGS_PANEL_PADDING_TOP_EXTRA_SMALL }}>
                                          Or: Settings → Privacy and security → Site settings → Notifications → Add this site to "Allowed"
                                        </p>
                                      </div>
                                    );
                                  } else if (isFirefox) {
                                    return (
                                      <div className={SETTINGS_PANEL_TEXT_SIZES.helper} style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_EXTRA_SMALL, color: 'inherit' }}>
                                        <p className="font-medium text-foreground">Firefox:</p>
                                        <ol className="list-decimal list-inside" style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_XSMALL, marginLeft: SETTINGS_PANEL_MARGIN_LEFT_XSMALL }}>
                                          <li>Click the lock icon (🔒) in the address bar</li>
                                          <li>Click "More Information"</li>
                                          <li>Go to the "Permissions" tab</li>
                                          <li>Find "Notifications" and change from "Block" to "Allow"</li>
                                          <li>Refresh this page</li>
                                        </ol>
                                        <p className="border-t border-border/50" style={{ marginTop: SETTINGS_PANEL_MARGIN_TOP_EXTRA_SMALL, paddingTop: SETTINGS_PANEL_PADDING_TOP_EXTRA_SMALL }}>
                                          Or: Settings → Privacy & Security → Permissions → Notifications → Allow for this site
                                        </p>
                                      </div>
                                    );
                                  } else if (isSafari) {
                                    return (
                                      <div className={SETTINGS_PANEL_TEXT_SIZES.helper} style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_EXTRA_SMALL, color: 'inherit' }}>
                                        <p className="font-medium text-foreground">Safari:</p>
                                        <ol className="list-decimal list-inside" style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_XSMALL, marginLeft: SETTINGS_PANEL_MARGIN_LEFT_XSMALL }}>
                                          <li>Safari menu → Settings (Preferences)</li>
                                          <li>Go to "Websites" tab</li>
                                          <li>Select "Notifications" in the left sidebar</li>
                                          <li>Find this website and change to "Allow"</li>
                                          <li>Refresh this page</li>
                                        </ol>
                                        <p className="border-t border-border/50" style={{ marginTop: SETTINGS_PANEL_MARGIN_TOP_EXTRA_SMALL, paddingTop: SETTINGS_PANEL_PADDING_TOP_EXTRA_SMALL }}>
                                          Note: Safari requires you to enable notifications in Safari settings, not from the browser prompt.
                                        </p>
                                      </div>
                                    );
                                  } else {
                                    return (
                                      <div className={SETTINGS_PANEL_TEXT_SIZES.helper} style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_EXTRA_SMALL, color: 'inherit' }}>
                                        <p className="font-medium text-foreground">General Instructions:</p>
                                        <ol className="list-decimal list-inside" style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_XSMALL, marginLeft: SETTINGS_PANEL_MARGIN_LEFT_XSMALL }}>
                                          <li>Look for a lock icon (🔒) or info icon (i) in your browser's address bar</li>
                                          <li>Click it to open site permissions</li>
                                          <li>Find "Notifications" and change to "Allow"</li>
                                          <li>Refresh this page</li>
                                        </ol>
                                        <p className="border-t border-border/50" style={{ marginTop: SETTINGS_PANEL_MARGIN_TOP_EXTRA_SMALL, paddingTop: SETTINGS_PANEL_PADDING_TOP_EXTRA_SMALL }}>
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
                            <p className={`${SETTINGS_PANEL_TEXT_SIZES.helper} text-muted-foreground leading-relaxed`} style={{ marginTop: SETTINGS_PANEL_MARGIN_TOP_MEDIUM_SMALL }}>
                              Click "Enable Notifications" above to receive alerts for due and overdue tasks. A browser dialog will appear asking for permission.
                            </p>
                          )}
                        </SettingsStatusCard>

                        <SettingsControlGroup>
                          <SettingsToggleRow
                            id="notifications-enabled"
                            label="Enable Notifications"
                            description="Turn on all notification features"
                            checked={notificationSettings.enabled}
                            disabled={permission === 'denied'}
                            onCheckedChange={async (checked) => {
                              updateNotificationSettings({ enabled: checked });
                              if (checked && permission === 'default') {
                                setTimeout(async () => {
                                  await requestPermission();
                                }, SETTINGS_PANEL_TIMEOUT_DELAY_MS);
                              }
                            }}
                          />
                          <SettingsToggleRow
                            id="notifications-badge"
                            label={NOTIFICATION_PANEL_TEXT.badge.showAppIconBadge}
                            description={NOTIFICATION_PANEL_TEXT.badge.displayTaskCount}
                            checked={notificationSettings.showBadge}
                            disabled={!notificationSettings.enabled || permission !== 'granted'}
                            onCheckedChange={(checked) => updateNotificationSettings({ showBadge: checked })}
                          />
                          <SettingsToggleRow
                            id="notifications-overdue"
                            label="Overdue Alerts"
                            description="Notify when tasks become overdue"
                            checked={notificationSettings.overdueAlerts}
                            disabled={!notificationSettings.enabled || permission !== 'granted'}
                            onCheckedChange={(checked) => updateNotificationSettings({ overdueAlerts: checked })}
                          />
                          <SettingsToggleRow
                            id="notifications-reminders"
                            label="Due Date Reminders"
                            description="Notify 1 hour before tasks are due"
                            checked={notificationSettings.dueDateReminders}
                            disabled={!notificationSettings.enabled || permission !== 'granted'}
                            onCheckedChange={(checked) => updateNotificationSettings({ dueDateReminders: checked })}
                          />
                          <SettingsToggleRow
                            id="push-notif"
                            label="Push Notifications"
                            description="Desktop and mobile alerts"
                            checked={notificationSettings.enabled && permission === 'granted'}
                            disabled={!notificationSettings.enabled || permission !== 'granted'}
                            onCheckedChange={() => {}}
                          />
                          <SettingsToggleRow
                            id="email-notif"
                            label="Email Notifications"
                            description="Daily task summary emails"
                            checked={false}
                            disabled={!notificationSettings.enabled || permission !== 'granted'}
                            onCheckedChange={() => {}}
                          />
                          <SettingsToggleRow
                            id="sound-notif"
                            label="Sound"
                            description="Play sound for notifications"
                            checked
                            disabled={!notificationSettings.enabled || permission !== 'granted'}
                            onCheckedChange={() => {}}
                          />
                        </SettingsControlGroup>
                      </SettingsGroup>

                      {notificationSettings.showBadge && badgeCount > 0 && (
                        <SettingsStatusCard tone="primary">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_MEDIUM }}>{NOTIFICATION_PANEL_TEXT.badge.currentBadgeCount}</span>
                            <Badge variant="destructive" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_BASE, paddingLeft: SETTINGS_PANEL_BADGE_PADDING_LEFT, paddingRight: SETTINGS_PANEL_BADGE_PADDING_RIGHT, paddingTop: SETTINGS_PANEL_PADDING_Y_EXTRA_SMALL, paddingBottom: SETTINGS_PANEL_PADDING_Y_EXTRA_SMALL }}>
                              {badgeCount}
                            </Badge>
                          </div>
                          <p className={`${SETTINGS_PANEL_TEXT_SIZES.helper} text-muted-foreground`} style={{ marginTop: SETTINGS_PANEL_MARGIN_TOP_SMALL }}>
                            {badgeCount === 1 ? NOTIFICATION_PANEL_TEXT.badge.taskNeedsAttention : NOTIFICATION_PANEL_TEXT.badge.tasksNeedAttention}
                          </p>
                        </SettingsStatusCard>
                      )}
          
        </SettingsSection>

        <SettingsCategoryHeader title={SETTINGS_PANEL_UI_TEXT.categories.tasks} />
        <SettingsSection
          value="tags"
          icon="tag"
          title="Tags Management"
          description={SETTINGS_PANEL_UI_TEXT.sections.tags.description}
        >

                      <SettingsGroup>
                        <SettingsLead>Create and manage custom tags for organizing tasks</SettingsLead>

                        <SettingsControlGroup>
                          <div className="flex items-center gap-2" style={{ padding: SETTINGS_PANEL_PADDING_MEDIUM }}>
                            <Input 
                              placeholder="New tag name..." 
                              className="h-9 flex-1" 
                              value={newTagInput}
                              onChange={(e) => setNewTagInput(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                            />
                            <Button type="button" size="sm" onClick={handleAddTag}>Add</Button>
                          </div>
                        </SettingsControlGroup>

                        <div className="flex flex-wrap rounded-xl border border-border/40 bg-muted/10 p-3" style={{ gap: SETTINGS_PANEL_GAP_SMALL }}>
                        {availableTags
                          .filter((tag) => tag.toLowerCase() !== 'urgent')
                          .map((tag, index) => {
                            const colors = [
                              UI_TAG_COLORS.mint.class,
                              UI_TAG_COLORS.lavender.class,
                              UI_TAG_COLORS.peach.class,
                              UI_TAG_COLORS.blue.class,
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
                                  <span 
                                    className="text-xs opacity-60"
                                    style={{ 
                                      marginLeft: SETTINGS_PANEL_GAP_XSMALL,
                                    }}
                                  >
                                    ×
                                  </span>
                                )}
                              </Badge>
                            );
                          })}
                        </div>
            
                        {availableTags.filter((tag) => tag.toLowerCase() !== 'urgent').length === 0 && (
                          <p className="text-center text-sm text-muted-foreground" style={{ paddingTop: SETTINGS_PANEL_ROW_PADDING_Y, paddingBottom: SETTINGS_PANEL_ROW_PADDING_Y }}>
                            No tags yet. Add your first tag above!
                          </p>
                        )}
                      </SettingsGroup>
          
        </SettingsSection>

        <SettingsSection
          value="priority-levels"
          icon="flag"
          title={SETTINGS_PANEL_UI_TEXT.priorityLevels.sectionTitle}
          description={SETTINGS_PANEL_UI_TEXT.sections.priorityLevels.description}
        >

                      <SettingsGroup>
                        <SettingsLead>{SETTINGS_PANEL_UI_TEXT.priorityLevels.intro}</SettingsLead>
                        <SettingsControlGroup>
                          {[
                            { key: 'urgent', label: SETTINGS_PANEL_UI_TEXT.priorityLevels.urgent.label, description: SETTINGS_PANEL_UI_TEXT.priorityLevels.urgent.description, badgeClass: TASK_CARD_PRIORITY_COLORS.urgent.badge },
                            { key: 'high', label: SETTINGS_PANEL_UI_TEXT.priorityLevels.high.label, description: SETTINGS_PANEL_UI_TEXT.priorityLevels.high.description, badgeClass: TASK_CARD_PRIORITY_COLORS.high.badge },
                            { key: 'medium', label: SETTINGS_PANEL_UI_TEXT.priorityLevels.medium.label, description: SETTINGS_PANEL_UI_TEXT.priorityLevels.medium.description, badgeClass: TASK_CARD_PRIORITY_COLORS.medium.badge },
                            { key: 'low', label: SETTINGS_PANEL_UI_TEXT.priorityLevels.low.label, description: SETTINGS_PANEL_UI_TEXT.priorityLevels.low.description, badgeClass: TASK_CARD_PRIORITY_COLORS.low.badge },
                          ].map((item) => (
                            <div
                              key={item.key}
                              className="flex items-start gap-3"
                              style={{
                                paddingTop: SETTINGS_PANEL_LIST_ROW_PADDING_Y,
                                paddingBottom: SETTINGS_PANEL_LIST_ROW_PADDING_Y,
                                paddingLeft: SETTINGS_PANEL_CONTROL_GROUP_PADDING_X,
                                paddingRight: SETTINGS_PANEL_CONTROL_GROUP_PADDING_X,
                              }}
                            >
                              <Badge variant="secondary" className={`${item.badgeClass} w-16 flex-shrink-0 justify-center border`}>
                                {item.label}
                              </Badge>
                              <span className="text-muted-foreground" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_MEDIUM, lineHeight: 1.45 }}>
                                {item.description}
                              </span>
                            </div>
                          ))}
                        </SettingsControlGroup>
                      </SettingsGroup>
          
        </SettingsSection>

        <SettingsCategoryHeader title={SETTINGS_PANEL_UI_TEXT.categories.scheduling} />
        <SettingsSection
          value="ai-settings"
          icon="head-circuit"
          title="AI Scheduling"
          description={SETTINGS_PANEL_UI_TEXT.sections.aiSettings.description}
          badge={!features.aiScheduler ? (
            <Badge variant="secondary" className={`ml-auto ${UI_SETTINGS_BADGE_COLORS.gradientClass} text-primary-foreground`}>
              PRO
            </Badge>
          ) : undefined}
        >

                      {serverAIConfigured !== null && (
                        <p className="text-xs text-muted-foreground mb-1">
                          Server AI (task descriptions): {serverAIConfigured ? 'Configured' : 'Not configured — usage will not appear on OpenAI portal'}
                        </p>
                      )}
                      {!features.aiScheduler ? (
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            Configure AI-powered automatic task scheduling that intelligently organizes your tasks.
                          </p>
                
                          <div className={`${UI_SETTINGS_BADGE_COLORS.infoBox.background.className} ${UI_SETTINGS_BADGE_COLORS.infoBox.border.className} rounded-lg p-4`}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_SMALL }}>
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
                              className={`w-full mt-3 ${UI_SETTINGS_BADGE_COLORS.gradientClass} hover:opacity-90`}
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
                        <SettingsControlGroup>
                        <SettingsToggleRow
                          id="ai-auto-scheduling"
                          label="Enable AI Auto-Scheduling"
                          description="Automatically schedule tasks when created"
                          checked={aiSettings.autoSchedulingEnabled}
                          onCheckedChange={toggleAutoScheduling}
                        />
                        <SettingsToggleRow
                          id="ai-priority-scheduling"
                          label="Priority-Based Scheduling"
                          description="Schedule urgent tasks first, then high, medium, low"
                          checked={aiSettings.priorityBasedScheduling}
                          onCheckedChange={togglePriorityBasedScheduling}
                          disabled={!aiSettings.autoSchedulingEnabled}
                        />
                        <SettingsToggleRow
                          id="ai-schedule-unscheduled"
                          label="Schedule Unscheduled Tasks"
                          description="AI schedules tasks without due dates"
                          checked={aiSettings.scheduleUnscheduledTasks}
                          onCheckedChange={toggleScheduleUnscheduledTasks}
                          disabled={!aiSettings.autoSchedulingEnabled}
                        />
                        </SettingsControlGroup>

                        <SettingsSubheading title="Daily Work Hour Limit" />
                        <SettingsControlGroup>
                            {Object.entries(AI_DAILY_HOUR_OPTIONS).map(([key, hours]) => {
                              const hourOption = hours as typeof AI_DAILY_HOUR_OPTIONS[keyof typeof AI_DAILY_HOUR_OPTIONS];
                              const labels = AI_DAILY_HOUR_LABELS[hourOption];
                              return (
                                <SettingsToggleRow
                                  key={key}
                                  id={`ai-hours-${hourOption}`}
                                  label={labels.label}
                                  description={labels.description}
                                  checked={aiSettings.maxHoursPerDay === hourOption}
                                  disabled={!aiSettings.autoSchedulingEnabled}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      updateSettings({ maxHoursPerDay: hourOption });
                                    }
                                  }}
                                />
                              );
                            })}
                        </SettingsControlGroup>
                      </div>

                      <SettingsInfoCallout className="mt-0">
                        <p className="font-semibold text-foreground" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL, marginBottom: SETTINGS_PANEL_MARGIN_BOTTOM_SMALL }}>
                          {AI_FUNCTION_EXPLANATION.TITLE}
                        </p>
                        <p style={{ lineHeight: SETTINGS_PANEL_LINE_HEIGHT_AI_DESCRIPTION, fontSize: SETTINGS_PANEL_TEXT_SIZE_XSMALL }}>
                          {AI_FUNCTION_EXPLANATION.getDescription(aiSettings.maxHoursPerDay, DEFAULT_SCHEDULING_PERIOD_DAYS)}
                        </p>
                        <div className="border-t border-primary/10" style={{ paddingTop: SETTINGS_PANEL_PADDING_MEDIUM }}>
                          <p className="italic" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_XSMALL }}>
                            💡 Tip: Enable "Priority-Based Scheduling" to automatically prioritize urgent and high-priority tasks first.
                          </p>
                        </div>
                      </SettingsInfoCallout>
                        </>
                      )}
          
        </SettingsSection>

        <SettingsSection
          value="rollover"
          icon="rotate-ccw"
          title="Task Rollover"
          description={SETTINGS_PANEL_UI_TEXT.sections.rollover.description}
          badge={!features.taskRollover ? (
            <Badge variant="secondary" className={`ml-auto ${UI_SETTINGS_BADGE_COLORS.gradientClass} text-primary-foreground`}>
              PRO
            </Badge>
          ) : undefined}
        >

                      {!features.taskRollover ? (
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            Automatically move incomplete tasks to the next day, ensuring nothing falls through the cracks.
                          </p>
                
                          <div className={`${UI_SETTINGS_BADGE_COLORS.infoBox.background.className} ${UI_SETTINGS_BADGE_COLORS.infoBox.border.className} rounded-lg p-4`}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_SMALL }}>
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
                              className={`w-full mt-3 ${UI_SETTINGS_BADGE_COLORS.gradientClass} hover:opacity-90`}
                            >
                              {SUBSCRIPTION_UI_TEXT.settings.upgradeToProButton}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <SettingsLead>Automatically move incomplete tasks to the next day</SettingsLead>
                          <SettingsControlGroup>
                            <SettingsToggleRow
                              id="auto-rollover"
                              label="Auto Rollover"
                              description="Move tasks at midnight"
                              checked={rolloverSettings.autoRollover}
                              onCheckedChange={(checked) => updateRolloverSettings({ autoRollover: checked })}
                            />
                            <SettingsToggleRow
                              id="ask-rollover"
                              label="Ask Before Rolling"
                              description="Confirm before moving tasks"
                              checked={rolloverSettings.askBeforeRolling}
                              disabled={!rolloverSettings.autoRollover}
                              onCheckedChange={(checked) => updateRolloverSettings({ askBeforeRolling: checked })}
                            />
                          </SettingsControlGroup>
                        </>
                      )}
          
        </SettingsSection>

        <SettingsSection
          value="hours"
          icon="briefcase"
          title="Task Category Hours"
          description={SETTINGS_PANEL_UI_TEXT.sections.hours.description}
          badge={!features.taskHours ? (
            <Badge variant="secondary" className={`ml-auto ${UI_SETTINGS_BADGE_COLORS.gradientClass} text-primary-foreground`}>
              PRO
            </Badge>
          ) : undefined}
        >

                      {!features.taskHours ? (
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            Set preferred working hours for different task categories (Work, Personal, Projects) with separate weekday and weekend schedules.
                          </p>
                
                          <div className={`${UI_SETTINGS_BADGE_COLORS.infoBox.background.className} ${UI_SETTINGS_BADGE_COLORS.infoBox.border.className} rounded-lg p-4`}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_SMALL }}>
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
                              className={`w-full mt-3 ${UI_SETTINGS_BADGE_COLORS.gradientClass} hover:opacity-90`}
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
            
                      <Separator style={{ marginTop: SETTINGS_PANEL_SEPARATOR_MARGIN_Y, marginBottom: SETTINGS_PANEL_SEPARATOR_MARGIN_Y }} />
            
                      <div className="space-y-4">
                        {/* Work Hours */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${UI_SETTINGS_BADGE_COLORS.category.mintClass}`} />
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

                        <Separator style={{ marginTop: SETTINGS_PANEL_SEPARATOR_MARGIN_Y, marginBottom: SETTINGS_PANEL_SEPARATOR_MARGIN_Y }} />

                        {/* Personal Hours */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${UI_SETTINGS_BADGE_COLORS.category.lavenderClass}`} />
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

                        <Separator style={{ marginTop: SETTINGS_PANEL_SEPARATOR_MARGIN_Y, marginBottom: SETTINGS_PANEL_SEPARATOR_MARGIN_Y }} />

                        {/* Projects Hours */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${UI_SETTINGS_BADGE_COLORS.category.peachClass}`} />
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

                        <Separator style={{ marginTop: SETTINGS_PANEL_SEPARATOR_MARGIN_Y, marginBottom: SETTINGS_PANEL_SEPARATOR_MARGIN_Y }} />

                        <SettingsToggleRow
                          id="respect-hours"
                          label="Respect Category Hours"
                          description="AI scheduling will use these time windows for each task category"
                          checked={hoursSettings.respectHours}
                          onCheckedChange={(checked) => updateHoursSettings({ respectHours: checked })}
                          variant="standalone"
                        />

                        <div className="mt-3">
                          <SettingsInfoCallout>
                            <p className="mb-1">
                              <strong className="text-foreground">How it works:</strong>
                            </p>
                            <p>
                              When AI scheduling is enabled, tasks will be scheduled within the time windows you set for each category. 
                              You can set different hours for weekdays (Mon-Fri) and weekends (Sat-Sun) to maintain work-life balance and optimize your schedule.
                            </p>
                          </SettingsInfoCallout>
                        </div>
                      </div>
                        </>
                      )}
          
        </SettingsSection>

        <SettingsCategoryHeader title={SETTINGS_PANEL_UI_TEXT.categories.preferences} />
        <SettingsSection
          value="datetime"
          icon="clock"
          title="Date, Time & Theme"
          description={SETTINGS_PANEL_UI_TEXT.sections.dateTime.description}
        >

                      <div className="space-y-4">
                        {/* Time Format */}
                        <div className="space-y-2 sm:space-y-2">
                          <Label className="text-sm">Time Format</Label>
                          <div className="flex items-center justify-between gap-3 py-1">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Label htmlFor="time-format-toggle" className="text-sm cursor-pointer">
                                {timeFormat === '24h' ? '24-hour (14:00)' : '12-hour (2:00 PM)'}
                              </Label>
                            </div>
                            <Switch 
                              id="time-format-toggle" 
                              className="flex-shrink-0"
                              checked={timeFormat === '24h'}
                              onCheckedChange={(checked) => {
                                setTimeFormat(checked ? '24h' : '12h');
                              }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground pl-0.5">
                            {timeFormat === '24h' 
                              ? 'Times are displayed in 24-hour format (e.g., 14:00 instead of 2:00 PM)' 
                              : 'Times are displayed in 12-hour format with AM/PM (e.g., 2:00 PM instead of 14:00)'}
                          </p>
                        </div>

                        <Separator className="my-3 sm:my-2" />

                        {/* Week Starts On */}
                        <div className="space-y-2 sm:space-y-2">
                          <Label className="text-sm">Week Starts On</Label>
                          <div className="flex items-center justify-between gap-3 py-1">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Label htmlFor="week-start-toggle" className="text-sm cursor-pointer">
                                {weekStart === 'monday' ? 'Monday' : 'Sunday'}
                              </Label>
                            </div>
                            <Switch 
                              id="week-start-toggle" 
                              className="flex-shrink-0"
                              checked={weekStart === 'monday'}
                              onCheckedChange={(checked) => {
                                setWeekStart(checked ? 'monday' : 'sunday');
                              }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground pl-0.5">
                            {weekStart === 'monday' 
                              ? 'The calendar week begins on Monday, with Sunday at the end of the week' 
                              : 'The calendar week begins on Sunday, with Saturday at the end of the week'}
                          </p>
                        </div>

                        <Separator className="my-3 sm:my-2" />

                        {/* Theme */}
                        <div className="space-y-2 sm:space-y-2">
                          <Label htmlFor="theme-select" className="text-sm">Theme</Label>
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-3 py-1">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <Icon name="monitor" size={ICON_SIZE_MD} />
                                  <Label htmlFor="system-theme-toggle" className="text-sm cursor-pointer">Use System Theme</Label>
                                </div>
                                <Switch 
                                  id="system-theme-toggle" 
                                  className="flex-shrink-0"
                                  checked={theme === 'system'}
                                  onCheckedChange={(checked) => {
                                    setTheme(checked ? 'system' : (actualTheme === 'dark' ? 'dark' : 'light'));
                                  }}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground pl-6">
                                {theme === 'system' 
                                  ? 'The app automatically matches your device\'s theme (light or dark) and updates when your system theme changes' 
                                  : 'You can manually choose between light and dark mode below'}
                              </p>
                            </div>
                            {theme !== 'system' && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-3 py-1">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Icon name="moon" size={ICON_SIZE_MD} />
                                    <Label htmlFor="dark-mode-toggle" className="text-sm cursor-pointer">Dark Mode</Label>
                                  </div>
                                  <Switch 
                                    id="dark-mode-toggle" 
                                    className="flex-shrink-0"
                                    checked={theme === 'dark'}
                                    onCheckedChange={(checked) => {
                                      setTheme(checked ? 'dark' : 'light');
                                    }}
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground pl-6">
                                  {theme === 'dark' 
                                    ? 'Dark mode is enabled with a dark background and light text for better viewing in low-light conditions' 
                                    : 'Light mode is enabled with a light background and dark text for better viewing in bright conditions'}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
          
        </SettingsSection>

        <SettingsCategoryHeader title={SETTINGS_PANEL_UI_TEXT.categories.engagement} />
        <SettingsSection
          value="awards"
          icon="trophy"
          title="Awards & Achievements"
          description={SETTINGS_PANEL_UI_TEXT.sections.awards.description}
          dataTour="awards-section"
          badge={
            <Badge variant="secondary" className="ml-auto bg-muted text-muted-foreground text-xs">
              {earnedAwards.length}/{awards.length}
            </Badge>
          }
        >

                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Quietly track your achievements as you complete tasks. Awards appear as subtle notifications in the corner.
                        </p>

                        {/* Summary Stats - Moved to Top */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className={`text-center p-3 ${UI_AWARD_STAT_GRADIENTS.completion.className}`}>
                            <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">{earnedAwards.length}</div>
                            <div className={`${SETTINGS_PANEL_TEXT_SIZES.awardLabel} text-muted-foreground mt-0.5 font-medium`}>Earned</div>
                          </div>
                          <div className={`text-center p-3 ${UI_AWARD_STAT_GRADIENTS.earned.className}`}>
                            <div className={`text-2xl font-bold ${UI_AWARD_STAT_GRADIENTS.completion.textGradient.className}`}>{Math.round((earnedAwards.length / awards.length) * 100)}%</div>
                            <div className={`${SETTINGS_PANEL_TEXT_SIZES.awardLabel} text-muted-foreground mt-0.5 font-medium`}>Complete</div>
                          </div>
                          <div className={`text-center p-3 ${UI_AWARD_STAT_GRADIENTS.remaining.className}`}>
                            <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{awards.length - earnedAwards.length}</div>
                            <div className={`${SETTINGS_PANEL_TEXT_SIZES.awardLabel} text-muted-foreground mt-0.5 font-medium`}>Remaining</div>
                          </div>
                        </div>

                        <Separator style={{ marginTop: SETTINGS_PANEL_SEPARATOR_MARGIN_Y, marginBottom: SETTINGS_PANEL_SEPARATOR_MARGIN_Y }} />

                        {/* Award Categories as Nested Accordion */}
                        <Accordion type="multiple" className="space-y-3">
                          {/* Completion Awards */}
                          <AccordionItem value="completion" className="px-3">
                            <AccordionTrigger className="hover:no-underline py-3">
                              <div className="flex items-center gap-3 w-full">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                                  <Icon name="target" size={ICON_SIZE_MD} weight="duotone" style={{ color: COLOR_TEXT_WHITE }} />
                                </div>
                                <div className="flex-1 text-left">
                                  <h4 className="text-sm font-semibold">Completion Milestones</h4>
                                  <p className="text-xs text-muted-foreground">Track your task achievements</p>
                                </div>
                                <Badge variant="secondary" className={`${SETTINGS_PANEL_TEXT_SIZES.badge} ${UI_AWARD_BADGE_COLORS.blue.light} ${UI_AWARD_BADGE_COLORS.blue.text}`}>
                                  {awardCounts.completion.earned}/{awardCounts.completion.total}
                                </Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent 
                              style={{ 
                                paddingBottom: SETTINGS_PANEL_ACCORDION_CONTENT_PADDING_BOTTOM,
                                paddingTop: SETTINGS_PANEL_ACCORDION_CONTENT_PADDING_TOP,
                                gap: SETTINGS_PANEL_ACCORDION_CONTENT_SPACING
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_SMALL }}>
                                {awards.filter(a => a.category === 'completion').map(award => {
                                  const isEarned = earnedAwards.some(ea => ea.awardId === award.id);
                                  const progress = getAwardProgress(award.id);
                                  // Icon name is already in correct format for Icon component
                        
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
                                          <Icon name={getAwardIconName(award.icon)} size={SETTINGS_PANEL_ICON_SIZE_SMALL} weight={isEarned ? "fill" : "duotone"} className={isEarned ? '' : 'text-muted-foreground'} style={isEarned ? { color: COLOR_TEXT_WHITE } : {}} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-start justify-between gap-1 mb-1">
                                            <div className={`text-sm font-medium ${isEarned ? 'text-blue-700 dark:text-blue-300' : ''}`}>
                                              {award.name}
                                            </div>
                                            {isEarned && <Icon name="award" size={ICON_SIZE_SM} weight="duotone" className="text-blue-500 flex-shrink-0" />}
                                            {!isEarned && <Icon name="lock" size={ICON_SIZE_SM} className="text-muted-foreground/50 flex-shrink-0" />}
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {award.description}
                                          </div>
                                          {progress && !isEarned && (
                                            <div className="mt-2">
                                              <div className={`flex items-center justify-between ${SETTINGS_PANEL_TEXT_SIZES.progressLabel} text-muted-foreground mb-1`}>
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
                          <AccordionItem value="streak" className="px-3">
                            <AccordionTrigger className="hover:no-underline py-3">
                              <div className="flex items-center gap-3 w-full">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center flex-shrink-0">
                                  <Icon name="trending-up" size={ICON_SIZE_MD} weight="duotone" style={{ color: COLOR_TEXT_WHITE }} />
                                </div>
                                <div className="flex-1 text-left">
                                  <h4 className="text-sm font-semibold">Streak Champions</h4>
                                  <p className="text-xs text-muted-foreground">Build consistency habits</p>
                                </div>
                                <Badge variant="secondary" className={`${SETTINGS_PANEL_TEXT_SIZES.badge} ${UI_AWARD_BADGE_COLORS.orange.light} ${UI_AWARD_BADGE_COLORS.orange.text}`}>
                                  {awardCounts.streak.earned}/{awardCounts.streak.total}
                                </Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent 
                              style={{ 
                                paddingBottom: SETTINGS_PANEL_ACCORDION_CONTENT_PADDING_BOTTOM,
                                paddingTop: SETTINGS_PANEL_ACCORDION_CONTENT_PADDING_TOP,
                                gap: SETTINGS_PANEL_ACCORDION_CONTENT_SPACING
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_SMALL }}>
                                {awards.filter(a => a.category === 'streak').map(award => {
                                  const isEarned = earnedAwards.some(ea => ea.awardId === award.id);
                                  const progress = getAwardProgress(award.id);
                                  // Icon name is already in correct format for Icon component
                        
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
                                          <Icon name={getAwardIconName(award.icon)} size={SETTINGS_PANEL_ICON_SIZE_SMALL} weight={isEarned ? "fill" : "duotone"} className={isEarned ? '' : 'text-muted-foreground'} style={isEarned ? { color: COLOR_TEXT_WHITE } : {}} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-start justify-between gap-1 mb-1">
                                            <div className={`text-sm font-medium ${isEarned ? 'text-orange-700 dark:text-orange-300' : ''}`}>
                                              {award.name}
                                            </div>
                                            {isEarned && <Icon name="award" size={14} weight="duotone" className="text-orange-500 flex-shrink-0" />}
                                            {!isEarned && <Icon name="lock" size={ICON_SIZE_SM} className="text-muted-foreground/50 flex-shrink-0" />}
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {award.description}
                                          </div>
                                          {progress && !isEarned && (
                                            <div className="mt-2">
                                              <div className={`flex items-center justify-between ${SETTINGS_PANEL_TEXT_SIZES.progressLabel} text-muted-foreground mb-1`}>
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
                          <AccordionItem value="focus" className="px-3">
                            <AccordionTrigger className="hover:no-underline py-3">
                              <div className="flex items-center gap-3 w-full">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                                  <Icon name="timer" size={ICON_SIZE_MD} weight="duotone" style={{ color: COLOR_TEXT_WHITE }} />
                                </div>
                                <div className="flex-1 text-left">
                                  <h4 className="text-sm font-semibold">Focus Masters</h4>
                                  <p className="text-xs text-muted-foreground">Deep work achievements</p>
                                </div>
                                <Badge variant="secondary" className={`${SETTINGS_PANEL_TEXT_SIZES.badge} ${UI_AWARD_BADGE_COLORS.purple.light} ${UI_AWARD_BADGE_COLORS.purple.text}`}>
                                  {awardCounts.focus.earned}/{awardCounts.focus.total}
                                </Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent 
                              style={{ 
                                paddingBottom: SETTINGS_PANEL_ACCORDION_CONTENT_PADDING_BOTTOM,
                                paddingTop: SETTINGS_PANEL_ACCORDION_CONTENT_PADDING_TOP,
                                gap: SETTINGS_PANEL_ACCORDION_CONTENT_SPACING
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_SMALL }}>
                                {awards.filter(a => a.category === 'focus').map(award => {
                                  const isEarned = earnedAwards.some(ea => ea.awardId === award.id);
                                  const progress = getAwardProgress(award.id);
                                  // Icon name is already in correct format for Icon component
                        
                                  return (
                                    <div 
                                      key={award.id}
                                      className={`
                                        group p-3 rounded-lg border transition-all duration-300
                                        ${isEarned 
                                          ? UI_AWARD_BADGE_COLORS.purple.activeGradient.className 
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
                                          <Icon name={getAwardIconName(award.icon)} size={SETTINGS_PANEL_ICON_SIZE_SMALL} weight={isEarned ? "fill" : "duotone"} className={isEarned ? '' : 'text-muted-foreground'} style={isEarned ? { color: COLOR_TEXT_WHITE } : {}} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-start justify-between gap-1 mb-1">
                                            <div className={`text-sm font-medium ${isEarned ? 'text-purple-700 dark:text-purple-300' : ''}`}>
                                              {award.name}
                                            </div>
                                            {isEarned && <Icon name="award" size={14} weight="duotone" className="text-purple-500 flex-shrink-0" />}
                                            {!isEarned && <Icon name="lock" size={ICON_SIZE_SM} className="text-muted-foreground/50 flex-shrink-0" />}
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {award.description}
                                          </div>
                                          {progress && !isEarned && (
                                            <div className="mt-2">
                                              <div className={`flex items-center justify-between ${SETTINGS_PANEL_TEXT_SIZES.progressLabel} text-muted-foreground mb-1`}>
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
                          <AccordionItem value="special" className="px-3">
                            <AccordionTrigger className="hover:no-underline py-3">
                              <div className="flex items-center gap-3 w-full">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                                  <Icon name="sparkles" size={ICON_SIZE_XS} weight="duotone" style={{ color: COLOR_TEXT_WHITE }} />
                                </div>
                                <div className="flex-1 text-left">
                                  <h4 className="text-sm font-semibold">Special Achievements</h4>
                                  <p className="text-xs text-muted-foreground">Unique accomplishments</p>
                                </div>
                                <Badge variant="secondary" className={`${SETTINGS_PANEL_TEXT_SIZES.badge} ${UI_AWARD_BADGE_COLORS.pink.light} ${UI_AWARD_BADGE_COLORS.pink.text}`}>
                                  {earnedAwards.filter(ea => {
                                    const award = awards.find(a => a.id === ea.awardId);
                                    return award?.category === 'special' || award?.category === 'speed';
                                  }).length}/{awards.filter(a => a.category === 'special' || a.category === 'speed').length}
                                </Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent 
                              style={{ 
                                paddingBottom: SETTINGS_PANEL_ACCORDION_CONTENT_PADDING_BOTTOM,
                                paddingTop: SETTINGS_PANEL_ACCORDION_CONTENT_PADDING_TOP,
                                gap: SETTINGS_PANEL_ACCORDION_CONTENT_SPACING
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_SMALL }}>
                                {awards.filter(a => a.category === 'special' || a.category === 'speed').map(award => {
                                  const isEarned = earnedAwards.some(ea => ea.awardId === award.id);
                                  // Icon name is already in correct format for Icon component
                        
                                  return (
                                    <div 
                                      key={award.id}
                                      className={`
                                        group p-3 rounded-lg border transition-all duration-300
                                        ${isEarned 
                                          ? UI_AWARD_BADGE_COLORS.pink.activeGradient.className 
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
                                          <Icon name={getAwardIconName(award.icon)} size={SETTINGS_PANEL_ICON_SIZE_SMALL} weight={isEarned ? "fill" : "duotone"} className={isEarned ? '' : 'text-muted-foreground'} style={isEarned ? { color: COLOR_TEXT_WHITE } : {}} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-start justify-between gap-1 mb-1">
                                            <div className={`text-sm font-medium ${isEarned ? 'text-pink-700 dark:text-pink-300' : ''}`}>
                                              {award.name}
                                            </div>
                                            {isEarned && <Icon name="award" size={14} weight="duotone" className="text-pink-500 flex-shrink-0" />}
                                            {!isEarned && <Icon name="lock" size={ICON_SIZE_SM} className="text-muted-foreground/50 flex-shrink-0" />}
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
          
        </SettingsSection>

        <SettingsSection
          value="app-tour"
          icon="compass"
          title="App Tour"
          description={SETTINGS_PANEL_UI_TEXT.sections.appTour.description}
          badge={!hasSeenTour ? (
            <Badge className="bg-accent/50 text-foreground border-accent/50 ml-2">
              New
            </Badge>
          ) : undefined}
        >

                      <p className="text-sm text-muted-foreground" style={{ marginBottom: SETTINGS_PANEL_MARGIN_BOTTOM_SMALL }}>
                        Take a guided tour of TaskZM's features and learn how to get the most out of your neurodivergent-friendly task manager.
                      </p>
            
                      <div className="bg-gradient-to-br from-primary/10 to-accent/10 dark:from-primary/5 dark:to-accent/5 border border-primary/20 dark:border-primary/10 rounded-lg" style={{ padding: SETTINGS_PANEL_PADDING_LARGE, marginBottom: SETTINGS_PANEL_MARGIN_BOTTOM_SMALL }}>
                        <div className="flex items-start" style={{ gap: SETTINGS_PANEL_GAP_MEDIUM, marginBottom: SETTINGS_PANEL_SPACING_MEDIUM }}>
                          <Icon name="compass" size={SETTINGS_PANEL_ICON_SIZE_SMALL} weight="duotone" className="text-primary flex-shrink-0" style={{ marginTop: SETTINGS_PANEL_MARGIN_TOP_XSMALL }} />
                          <div>
                            <p className="text-sm text-foreground" style={{ marginBottom: SETTINGS_PANEL_SPACING_XSMALL }}>Interactive Walkthrough</p>
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
                          className="w-full bg-primary hover:bg-primary/90 dark:bg-primary dark:hover:bg-primary/90 text-primary-foreground border border-primary/20 shadow-sm"
                          onClick={handleStartTour}
                        >
                          <Icon name="compass" size={ICON_SIZE_XS} weight="duotone" className="text-primary-foreground" style={{ marginRight: SETTINGS_PANEL_MARGIN_RIGHT_SMALL }} />
                          {hasSeenTour ? 'Restart Tour' : 'Start Tour'}
                        </Button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_SMALL, marginBottom: SETTINGS_PANEL_MARGIN_BOTTOM_SMALL }}>
                        <p className="text-xs font-medium">Tour Highlights:</p>
                        <ul className="text-xs text-muted-foreground" style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_XSMALL, marginLeft: SETTINGS_PANEL_MARGIN_LEFT_MEDIUM }}>
                          <li>• Sidebar icons & mobile navigation</li>
                          <li>• Week view & Month calendar toggle</li>
                          <li>• AI Scheduler & Re-Scheduler</li>
                          <li>• Settings — calendars, AI, hours & more</li>
                        </ul>
                      </div>

                      <Separator style={{ marginTop: SETTINGS_PANEL_MARGIN_TOP_SMALL, marginBottom: SETTINGS_PANEL_MARGIN_BOTTOM_SMALL }} />

                      <div className="bg-primary/5 rounded-lg border border-primary/10" style={{ padding: SETTINGS_PANEL_PADDING_MEDIUM }}>
                        <div className="flex items-start" style={{ gap: SETTINGS_PANEL_SPACING_SMALL }}>
                          <Icon name="info" size={ICON_SIZE_MD} className="text-primary flex-shrink-0" style={{ marginTop: SETTINGS_PANEL_MARGIN_TOP_XSMALL }} />
                          <div className="text-xs text-muted-foreground">
                            <p>
                              The tour takes about 2-3 minutes and can be skipped or paused at any time. 
                              You can restart it whenever you need a refresher!
                            </p>
                          </div>
                        </div>
                      </div>
          
        </SettingsSection>

        <SettingsSection
          value="about"
          icon="info"
          title="About"
          description={SETTINGS_PANEL_UI_TEXT.sections.about.description}
        >

                      <div className="space-y-4">
                        <div className="flex flex-col items-center gap-1.5">
                          <img 
                            src={taskzmLogoBlack} 
                            alt="TaskZM Logo"
                            className={`${COMPONENT_DIMENSIONS.settingsPanel.logoWidthMobile} sm:${COMPONENT_DIMENSIONS.settingsPanel.logoWidth} object-contain`}
                            style={{
                              marginTop: '-0.5rem', // Negative margin to reduce space above
                              marginBottom: '-0.5rem', // Negative margin to reduce space below
                              paddingTop: '0', // No padding above logo
                              paddingBottom: '0', // No padding below logo
                              display: 'block', // Remove inline spacing
                              lineHeight: 0, // Remove line-height spacing
                            }}
                          />
                          <div className="text-xs text-muted-foreground text-center">Version {APP_VERSION}</div>
                          <div className="text-xs text-muted-foreground/70 text-center">{VERSION_NAME}</div>
                        </div>

                        <Separator style={{ marginTop: SETTINGS_PANEL_SEPARATOR_MARGIN_Y, marginBottom: SETTINGS_PANEL_SEPARATOR_MARGIN_Y }} />

                        <p className="text-xs text-muted-foreground leading-relaxed">
                          TaskZM is a neurodivergent-friendly task management application built with React, TypeScript, and Supabase. 
                          Designed with accessibility and focus in mind.
                        </p>
              
                        <div className="text-xs text-muted-foreground/70">
                          Released: {VERSION_DATE}
                        </div>

                        <Separator style={{ marginTop: SETTINGS_PANEL_SEPARATOR_MARGIN_Y, marginBottom: SETTINGS_PANEL_SEPARATOR_MARGIN_Y }} />

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

                        <Separator style={{ marginTop: SETTINGS_PANEL_SEPARATOR_MARGIN_Y, marginBottom: SETTINGS_PANEL_SEPARATOR_MARGIN_Y }} />

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="text-xs">Database Sync</Label>
                              <p className="text-xs text-muted-foreground">Auto-sync every 30 seconds</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {isSyncing && (
                                <Icon name="refresh-cw" size={ICON_SIZE_XS} className="text-primary animate-spin" />
                              )}
                              <Badge 
                                variant="secondary" 
                                className={isSyncing ? 'bg-accent/30 dark:bg-accent/20' : 'bg-primary/30 dark:bg-primary/20'}
                              >
                                {isSyncing ? 'Syncing...' : 'Active'}
                              </Badge>
                            </div>
                          </div>
                          <div className="p-2.5 bg-muted/50 rounded-lg border border-border/50">
                            <div className="flex items-start gap-2">
                              <Icon name="clock" size={SETTINGS_PANEL_ICON_SIZE_SMALL} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className={`${SETTINGS_PANEL_TEXT_SIZES.versionInfo} uppercase tracking-wide text-muted-foreground/80 mb-0.5`}>Last Database Sync</p>
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
                                  <p className={`${SETTINGS_PANEL_TEXT_SIZES.versionInfo} text-muted-foreground/70 mt-0.5`}>
                                    {(() => {
                                      const diffMs = Date.now() - new Date(lastSync).getTime();
                                      const diffMins = Math.floor(diffMs / TIMING_CONSTANTS.timeConversions.minutesToMs);
                                      const diffHours = Math.floor(diffMs / TIMING_CONSTANTS.timeConversions.hoursToMs);
                                      const diffDays = Math.floor(diffMs / TIMING_CONSTANTS.timeConversions.daysToMs);
                            
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
                              <Icon name="info" size={SETTINGS_PANEL_ICON_SIZE_SMALL} className="text-primary mt-0.5 flex-shrink-0" />
                              <p className={`${SETTINGS_PANEL_TEXT_SIZES.versionInfo} text-muted-foreground leading-relaxed`}>
                                Your tasks, projects, and settings are automatically synced to the cloud in the background. All changes are saved instantly and synchronized across your devices.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
          
        </SettingsSection>
          </Accordion>
        </div>
      </div>

      {/* Pricing Dialog */}
      <PricingDialog
        open={showPricingDialog}
        onOpenChange={setShowPricingDialog}
        onOfferingsUpdated={handlePricingUpdate}
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

      {/* Avatar Selection Dialog */}
      <Dialog open={showAvatarSelection} onOpenChange={setShowAvatarSelection}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{AVATAR_UI_TEXT.selectYourAvatar}</DialogTitle>
            <DialogDescription>
              {AVATAR_UI_TEXT.selectAvatarDescription}
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_MEDIUM, paddingTop: SETTINGS_PANEL_PADDING, paddingBottom: SETTINGS_PANEL_PADDING }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_FIELD_SPACING }}>
              <Label>{AVATAR_UI_TEXT.chooseAvatar}</Label>
              <AvatarSelection
                selectedAvatar={profileAvatar}
                onAvatarSelect={setProfileAvatar}
                previewSeed={profileName.trim() || user?.name || user?.email || 'User'}
              />
            </div>
          </div>

          <div className="flex justify-end" style={{ gap: PANEL_GAP_MEDIUM }}>
            <Button
              variant="outline"
              onClick={() => {
                setShowAvatarSelection(false);
                setProfileAvatar(user?.avatar);
              }}
            >
              {AVATAR_UI_TEXT.cancel}
            </Button>
            <Button
              onClick={() => {
                if (profileAvatar) {
                  handleUpdateProfile();
                  setShowAvatarSelection(false);
                } else {
                  toast.error(AVATAR_UI_TEXT.pleaseSelectAvatar);
                }
              }}
              disabled={!profileAvatar || isUpdatingProfile}
            >
              {isUpdatingProfile ? AVATAR_UI_TEXT.saving : AVATAR_UI_TEXT.saveAvatar}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={showDeleteAccountDialog} onOpenChange={setShowDeleteAccountDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete your account? This action cannot be undone.
              <br /><br />
              This will permanently delete:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>All your tasks and projects</li>
                <li>Your workspace and team data</li>
                <li>Your subscription information</li>
                <li>Your calendar connections</li>
                <li>All other account data</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAccount}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </div>
);
}
