import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { Toaster } from './components/ui/sonner';
import { toast } from './lib/toast-wrapper';
import {
  TOAST_DURATION_SHORT_MS,
  TOAST_DURATION_MEDIUM_MS,
  TOAST_DURATION_LONG_MS,
  TOAST_DURATION_DEFAULT_MS,
} from './lib/layout-constants';
import { Button } from './components/ui/button';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SubscriptionProvider, useSubscription } from './contexts/SubscriptionContext';
import { TaskProvider, useTasks } from './contexts/TaskContext';
import { LoadingProvider, useLoading } from './contexts/LoadingContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { SidebarProvider, useSidebar } from './contexts/SidebarContext';
import { AIProvider, useAI } from './contexts/AIContext';
import { CalendarProvider } from './contexts/CalendarContext';
import { DragDropProvider } from './contexts/DragDropContext';
import { PomodoroProvider } from './contexts/PomodoroContext';
import { TeamProvider } from './contexts/TeamContext';
import { AwardProvider } from './contexts/AwardContext';
import { NotificationProvider, useNotifications } from './contexts/NotificationContext';
import { AuthScreen } from './components/AuthScreen';
import { InviteAcceptancePage } from './components/InviteAcceptancePage';
import { AwardCelebration } from './components/AwardCelebration';
import { AppSidebar } from './components/AppSidebar';
import { AppTour } from './components/AppTour';
import { BottomNav } from './components/BottomNav';
import { DashboardView } from './components/DashboardView';
import { InboxView } from './components/InboxView';
import { ArchiveView } from './components/ArchiveView';
import { SettingsPanel } from './components/SettingsPanel';
import { TodayAgendaView } from './components/TodayAgendaView';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { TeamPanel } from './components/TeamPanel';
import { FoldersPanel } from './components/FoldersPanel';
import { NotificationsPanel } from './components/NotificationsPanel';
import { AIScheduleResultDialog } from './components/AIScheduleResultDialog';
import { PricingDialog } from './components/PricingDialog';
import { UpgradePrompt } from './components/UpgradePrompt';
import { DemoAccountDisclaimer } from './components/DemoAccountDisclaimer';
import { DocumentHead } from './components/DocumentHead';
import { useAIScheduler, type SchedulePlan } from './hooks/useAIScheduler';
import { useAwardChecker } from './hooks/useAwardChecker';
import { useDemoActivity } from './hooks/useDemoActivity';
import { getPlatform } from './lib/platform';
import { cn } from './lib/utils';
import { useMobileLayout } from './hooks/useMobileLayout';
import { TIMING_CONSTANTS } from './lib/timing-constants';
import { PANEL_WIDTH, PANEL_WIDTH_TABLET, PANEL_WIDTH_SMALL_MONITOR, HEADER_HEIGHT, HEADER_MOBILE_SPACER_HEIGHT, HEADER_MOBILE_SAFE_AREA_SPACER, NAV_BAR_SPACER_HEIGHT, NAV_BAR_BOTTOM_PADDING_MOBILE, NAV_BAR_HEIGHT, NAV_BAR_SCROLL_BUFFER_REM, HEADER_ANIMATION_DAMPING, HEADER_ANIMATION_STIFFNESS, VIEWPORT_BREAKPOINTS, getPanelWidth, MOBILE_SCROLL_CONTAINER_PADDING_TOP, LOADING_SCREEN_LOGO, SPLASH_SCREEN_TEXT, REACT_LOADING_SCREEN, APP_TEXT_FALLBACK_COLOR } from './lib/layout-constants';
import { KANBAN_BACKGROUND_GRADIENTS } from './lib/kanban-constants';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/globals.css';
import logoImageBlack from './assets/Taskzm_Logo_BLK-removebg.png';
import logoImageGray from './assets/taskzm-logo-gray.png';

const getTwoWeekDateRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const mondayOffset = (day + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  const end = new Date(start);
  end.setDate(end.getDate() + 13);
  end.setHours(23, 59, 59, 999);
  return { startDate: start, endDate: end };
};

function AppContent() {
  const { user } = useAuth();
  const { isLoading, loadingMessage } = useLoading();
  useDemoActivity(); // Track demo user activity on app interactions
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const { settings: aiSettings } = useAI();
  const { hasFeature, features, subscription } = useSubscription();
  const shouldUseMobileLayout = useMobileLayout(); // Use mobile layout for tablets in portrait/landscape
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  
  // Initialize view: 'today' on mobile, 'dashboard' on desktop
  const getInitialView = () => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < VIEWPORT_BREAKPOINTS.mobile ? 'today' : 'dashboard';
    }
    return 'dashboard';
  };
  
  const [currentView, setCurrentView] = useState(getInitialView);
  const [mobileView, setMobileView] = useState<'today' | 'week'>('today');
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [showScheduleResult, setShowScheduleResult] = useState(false);
  const [scheduledTasks, setScheduledTasks] = useState<SchedulePlan[]>([]);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [showPricingDialog, setShowPricingDialog] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<'aiScheduler' | 'taskHours' | 'analytics' | 'taskRollover' | 'pomodoroTimer' | 'teamFeatures' | 'calendarSync' | 'recurringTasks' | 'taskDependencies' | 'taskTemplates'>('aiScheduler');
  const [runTour, setRunTour] = useState(false);
  const [showDemoDisclaimer, setShowDemoDisclaimer] = useState(false);
  const hasInitializedView = useRef(false);
  const [panelWidth, setPanelWidth] = useState(PANEL_WIDTH);
  const dashboardViewModeRef = useRef<'week' | 'month'>('week');
  
  // Update panel width based on viewport size
  useEffect(() => {
    const updatePanelWidth = () => {
      setPanelWidth(getPanelWidth());
    };
    
    updatePanelWidth();
    window.addEventListener('resize', updatePanelWidth);
    return () => window.removeEventListener('resize', updatePanelWidth);
  }, []);

  // Handle tour events for view mode changes and panel opening
  useEffect(() => {
    const handleTourSetViewMode = (event: CustomEvent<{ mode: 'week' | 'month' }>) => {
      dashboardViewModeRef.current = event.detail.mode;
      // Dispatch to DashboardView if it's mounted
      window.dispatchEvent(new CustomEvent('dashboard-set-view-mode', { 
        detail: { mode: event.detail.mode } 
      }));
    };

    const handleTourOpenPanel = (event: CustomEvent<{ panel: string }>) => {
      const panel = event.detail.panel;
      if (panel === 'ai') {
        setAiPanelOpen(true);
      } else if (panel === 'analytics') {
        setCurrentView('analytics');
      } else if (panel === 'today') {
        setCurrentView('today');
      } else if (panel === 'inbox') {
        setCurrentView('inbox');
      }
    };

    const handleTourClosePanel = () => {
      setCurrentView('dashboard');
      setAiPanelOpen(false);
      // On mobile, when closing a panel, default to week view
      if (shouldUseMobileLayout) {
        setMobileView('week');
      }
    };

    window.addEventListener('tour-set-view-mode', handleTourSetViewMode as EventListener);
    window.addEventListener('tour-open-panel', handleTourOpenPanel as EventListener);
    window.addEventListener('tour-close-panel', handleTourClosePanel as EventListener);

    return () => {
      window.removeEventListener('tour-set-view-mode', handleTourSetViewMode as EventListener);
      window.removeEventListener('tour-open-panel', handleTourOpenPanel as EventListener);
      window.removeEventListener('tour-close-panel', handleTourClosePanel as EventListener);
    };
  }, [shouldUseMobileLayout]);
  
  const { scheduleAllTasks, unscheduledCount, isScheduling } = useAIScheduler();
  const { tasks } = useTasks();
  const { settings: notificationSettings } = useNotifications();
  
  // Calculate count of overdue and due now tasks for mobile badge
  // Only show tasks that are actually due (overdue or due now), not tasks scheduled for later today
  // Timezone-aware: compares dates in local time to avoid false positives from UTC/local mismatches
  const getUpcomingAndDueNowCount = () => {
    const now = new Date();
    // Only show tasks that are overdue or due RIGHT NOW (within 5 minutes)
    // This prevents showing tasks scheduled for later today that aren't actually due yet
    const dueNowThreshold = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes
    
    // Get today's date boundaries in local time for date comparison
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    // Enhanced logging to debug badge count
    const allTasksWithDates = tasks.filter((t: { dueDate?: string | null; scheduledDate?: string | null; status: string }) => (t.dueDate || t.scheduledDate) && t.status !== 'done');
    
    const dueTasks = tasks.filter((task: { id: string; title: string; status: string; dueDate?: string | null; scheduledDate?: string | null; recurrence?: { type: string } }) => {
      if (task.status === 'done') return false;
      
      // CRITICAL: Exclude tasks that have been rolled over to inbox
      // Rolled over tasks have scheduledDate === null (or undefined) and have been moved to inbox
      // They should NOT trigger badge notifications even if they have a dueDate
      // Check for both null and undefined to be safe
      if (task.scheduledDate === null || task.scheduledDate === undefined) {
        return false;
      }
      
      // CRITICAL: Exclude recurring tasks - they have their own scheduling mechanism
      if (task.recurrence && task.recurrence.type !== 'none') return false;
      
      let targetDate: Date | null = null;
      let dateType: 'dueDate' | 'scheduledDate' | null = null;
      
      // For badge count, only use scheduledDate (not dueDate) to avoid counting rolled-over tasks
      // Rolled-over tasks have scheduledDate === null but may still have a dueDate
      // Only count tasks that are actually scheduled (have a scheduledDate)
      if (task.scheduledDate) {
        targetDate = new Date(task.scheduledDate);
        dateType = 'scheduledDate';
      } else {
        // If no scheduledDate, don't count it (even if it has a dueDate)
        // This ensures rolled-over tasks are never counted
        return false;
      }
      
      if (!targetDate || isNaN(targetDate.getTime())) return false;
      
      // CRITICAL: Only count tasks for today or past dates (not future dates)
      // Normalize target date to local date (ignore time) for date comparison
      const targetDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const todayDateOnly = new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate());
      
      // Skip tasks scheduled for future dates (tomorrow or later)
      if (targetDateOnly > todayDateOnly) {
        return false;
      }
      
      // Normalize both dates to local time for accurate comparison
      // This prevents timezone issues where UTC dates might appear as "due" when they're actually scheduled for later in local time
      const targetTime = targetDate.getTime();
      const nowTime = now.getTime();
      const thresholdTime = dueNowThreshold.getTime();
      
      // Only include tasks that are overdue or due within the next 5 minutes
      // This excludes tasks scheduled for later today that aren't actually due yet
      const isDue = targetTime <= thresholdTime;
      
      // Enhanced debug logging - always log when task is counted as due
      if (isDue) {
        const timeDiff = (targetTime - nowTime) / (60 * 1000); // minutes
        console.log(`🔔 [Today Agenda Badge] Task "${task.title}" is counted as due:`, {
          taskId: task.id,
          dateType,
          targetDateUTC: targetDate.toISOString(),
          targetDateLocal: targetDate.toLocaleString(),
          targetDateOnly: targetDateOnly.toLocaleDateString(),
          todayDateOnly: todayDateOnly.toLocaleDateString(),
          isTodayOrPast: targetDateOnly <= todayDateOnly,
          targetTime: targetTime,
          nowUTC: now.toISOString(),
          nowLocal: now.toLocaleString(),
          nowTime: nowTime,
          thresholdTime: thresholdTime,
          timeDiffMinutes: Math.round(timeDiff * 10) / 10,
          isOverdue: targetTime < nowTime,
          isDueSoon: targetTime >= nowTime && targetTime <= thresholdTime,
          taskStatus: task.status,
          taskDueDate: task.dueDate,
          taskScheduledDate: task.scheduledDate,
          note: 'Only tasks with scheduledDate are counted (rolled-over tasks excluded)',
        });
      } else {
        // Log why task is NOT counted (for debugging)
        const timeDiff = (targetTime - nowTime) / (60 * 1000);
        const isFutureDate = targetDateOnly > todayDateOnly;
        const isTooFarInFuture = targetTime > thresholdTime;
        if (isFutureDate || (timeDiff > 5 && timeDiff < 60)) {
          console.debug(`⏭️ [Today Agenda Badge] Task "${task.title}" NOT counted:`, {
            taskId: task.id,
            reason: isFutureDate ? 'Future date (tomorrow or later)' : `Scheduled for later today (${Math.round(timeDiff)} minutes from now)`,
            targetDateOnly: targetDateOnly.toLocaleDateString(),
            todayDateOnly: todayDateOnly.toLocaleDateString(),
            timeDiffMinutes: Math.round(timeDiff * 10) / 10,
            isFutureDate,
            isTooFarInFuture,
            taskScheduledDate: task.scheduledDate,
            taskDueDate: task.dueDate,
          });
        }
      }
      
      return isDue;
    });
    
    // Always log badge calculation details - make it very visible
    if (dueTasks.length > 0) {
      console.group(`🔔 [Today Agenda Badge] BADGE SHOWING: ${dueTasks.length} task(s) counted as due`);
      console.log('Current Time:', {
        UTC: now.toISOString(),
        Local: now.toLocaleString(),
        Timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      console.log('Threshold (5 minutes from now):', {
        UTC: dueNowThreshold.toISOString(),
        Local: dueNowThreshold.toLocaleString(),
      });
      console.log('Tasks being counted:', dueTasks.map((t: { id: string; title: string; status: string; dueDate?: string | null; scheduledDate?: string | null }) => {
        const targetDate = t.dueDate ? new Date(t.dueDate) : (t.scheduledDate ? new Date(t.scheduledDate) : null);
        const timeDiff = targetDate ? (targetDate.getTime() - now.getTime()) / (60 * 1000) : null;
        return {
          id: t.id,
          title: t.title,
          status: t.status,
          dateType: t.dueDate ? 'dueDate' : 'scheduledDate',
          targetDateUTC: targetDate?.toISOString(),
          targetDateLocal: targetDate?.toLocaleString(),
          timeDiffMinutes: timeDiff ? Math.round(timeDiff * 10) / 10 : null,
          isOverdue: timeDiff ? timeDiff < 0 : false,
          isDueSoon: timeDiff ? timeDiff >= 0 && timeDiff <= 5 : false,
        };
      }));
      console.groupEnd();
    } else {
      console.log(`✅ [Today Agenda Badge] No badge - ${allTasksWithDates.length} task(s) with dates, but none are due within 5 minutes`);
    }
    
    return dueTasks.length;
  };
  
  const upcomingAndDueNowCount = getUpcomingAndDueNowCount();
  
  // Check for award achievements when tasks are completed
  useAwardChecker();
  
  // Strategic upgrade prompts for new free users
  useEffect(() => {
    if (!user || isLoading || subscription.tier !== 'free') return;
    
    try {
      const isNewSignup = window?.localStorage?.getItem('taskzm_is_new_signup') === 'true';
      const tourCompleted = window?.localStorage?.getItem('taskzm_tour_completed') === 'true';
      const pricingShownAfterTour = window?.localStorage?.getItem('taskzm_pricing_shown_after_tour') === 'true';
      const upgradePromptShown = window?.localStorage?.getItem('taskzm_upgrade_prompt_shown') === 'true';
      
      // Only show strategic prompts for new users who completed tour
      if (!isNewSignup || !tourCompleted) return;
      
      // Count completed tasks
      const completedTasks = tasks.filter((t: { status: string }) => t.status === 'done');
      const completedCount = completedTasks.length;
      
      // Show upgrade prompt after completing 3-5 tasks (if not already shown)
      if (completedCount >= 3 && completedCount <= 5 && !upgradePromptShown) {
        // Small delay to let task completion settle
        const timer = setTimeout(() => {
          setUpgradeFeature('aiScheduler');
          setShowUpgradePrompt(true);
          window?.localStorage?.setItem('taskzm_upgrade_prompt_shown', 'true');
        }, 2000);
        
        return () => clearTimeout(timer);
      }
    } catch (error) {
      console.warn('Error checking for strategic upgrade prompts:', error);
    }
  }, [tasks, user, isLoading, subscription.tier]);

  // Listen for upgrade prompt events from TaskDialog and other components
  useEffect(() => {
    const handleUpgradePrompt = (event: CustomEvent) => {
      const feature = event.detail?.feature;
      if (feature && ['recurringTasks', 'taskDependencies', 'taskTemplates', 'calendarSync'].includes(feature)) {
        // CRITICAL: Don't show upgrade prompt if user already has Pro subscription (monthly or yearly)
        // Only show for free tier users
        if (subscription.tier === 'pro') {
          console.debug(`[Upgrade Prompt] Skipping upgrade prompt for ${feature} - user already has Pro subscription (${subscription.billingPeriod || 'unknown'} billing)`);
          return;
        }
        setUpgradeFeature(feature);
        setShowUpgradePrompt(true);
      }
    };

    window.addEventListener('showUpgradePrompt', handleUpgradePrompt as EventListener);
    return () => {
      window.removeEventListener('showUpgradePrompt', handleUpgradePrompt as EventListener);
    };
  }, [setUpgradeFeature, setShowUpgradePrompt, subscription.tier, subscription.billingPeriod]);

  // Check for invitation token in URL
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    // Show invitation page if token is present in URL (works for /invite or any path)
    if (token) {
      setInviteToken(token);
    }
  }, []);

  // Show helpful console message once on first load
  useEffect(() => {
    try {
      const hasSeenMessage = window?.sessionStorage?.getItem('taskzm_session_info_shown');
      
      // Show once per session
      if (!hasSeenMessage) {
        console.log('%c✨ TaskZM v1.0.1 - Baseline Reset ✨', 'font-size: 16px; font-weight: bold; color: #9D87C3;');
        console.log('%cℹ️  Payment System Status:', 'font-weight: bold; color: #4A90E2;');
        
        // Payment system status
        console.log('  • Payment System: Stripe integration');
        console.log('  • Mode: Production (real payments via Stripe)');
        
        window?.sessionStorage?.setItem('taskzm_session_info_shown', 'true');
      }
    } catch (error) {
      console.warn('Session storage unavailable, skipping session info message:', error);
    }
  }, []);


  // Set default view to 'today' on mobile when app loads/refreshes
  useEffect(() => {
    // Only run once on initial mount to set default view for mobile
    if (hasInitializedView.current) return;
    
    // Check if we're on mobile (either via hook or window width)
    const checkMobile = shouldUseMobileLayout || (typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.mobile);
    
    // Only set to 'today' on mobile if currently on 'dashboard'
    // This ensures mobile always starts with 'today' view on refresh/reopen
    if (checkMobile && currentView === 'dashboard') {
      setCurrentView('today');
    }
    
    hasInitializedView.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once on mount

  // Show demo account disclaimer for demo users
  useEffect(() => {
    if (!user || isLoading) return;
    
    // Only show for demo users
    if (user.isDemo) {
      try {
        // Check if disclaimer has been seen in this session
        const disclaimerSeen = window?.sessionStorage?.getItem('demo_disclaimer_seen');
        
        if (!disclaimerSeen) {
          // Show disclaimer after a short delay to let UI settle
          const timer = setTimeout(() => {
            setShowDemoDisclaimer(true);
          }, 1000); // 1 second delay
          
          return () => clearTimeout(timer);
        }
      } catch (error) {
        console.warn('Session storage unavailable when checking demo disclaimer:', error);
      }
    }
  }, [user, isLoading]);

  // Track if tour has been triggered to prevent multiple triggers
  const tourTriggeredRef = React.useRef(false);

  // Auto-start tour only for new signups (not existing users)
  // For demo users, wait until disclaimer is closed before starting tour
  useEffect(() => {
    if (!user || isLoading) return;
    
    // Prevent multiple triggers
    if (tourTriggeredRef.current) return;
    
    try {
      const tourCompleted = window?.localStorage?.getItem('taskzm_tour_completed');
      const isNewSignup = window?.localStorage?.getItem('taskzm_is_new_signup') === 'true';
      
      // Only auto-start tour for new signups who haven't completed the tour
      if (isNewSignup && !tourCompleted) {
        // For demo users, wait until disclaimer is closed
        if (user.isDemo) {
          // Check if disclaimer has been seen (user clicked "I Understand")
          const disclaimerSeen = window?.sessionStorage?.getItem('demo_disclaimer_seen');
          
          // Only start tour if disclaimer has been seen (closed)
          if (disclaimerSeen) {
            // Mark as triggered immediately to prevent loops
            tourTriggeredRef.current = true;
            
            // Clear the new signup flag immediately to prevent re-triggering
            try {
              window?.localStorage?.removeItem('taskzm_is_new_signup');
            } catch (removeError) {
              console.warn('Unable to clear new signup flag:', removeError);
            }
            
            const timer = setTimeout(() => {
              console.log('🎯 Starting tour for demo user after disclaimer closed');
              setRunTour(true);
              toast.info('👋 Welcome! Let us show you around TaskZM', {
                description: 'Take a quick tour to learn the basics',
                duration: TOAST_DURATION_MEDIUM_MS
              });
            }, TIMING_CONSTANTS.animations.long); // Short delay after disclaimer is closed
            
            return () => clearTimeout(timer);
          } else {
            // Disclaimer not seen yet - set up one-time listener for when it closes
            let hasTriggered = false;
            
            const checkDisclaimer = () => {
              // Prevent multiple triggers
              if (hasTriggered || tourTriggeredRef.current) return;
              
              const seen = window?.sessionStorage?.getItem('demo_disclaimer_seen');
              if (seen && !tourCompleted) {
                hasTriggered = true;
                tourTriggeredRef.current = true;
                
                // Clear the new signup flag immediately
                try {
                  window?.localStorage?.removeItem('taskzm_is_new_signup');
                } catch (removeError) {
                  console.warn('Unable to clear new signup flag:', removeError);
                }
                
                console.log('🎯 Disclaimer closed, starting tour for demo user');
                setTimeout(() => {
                  setRunTour(true);
                  toast.info('👋 Welcome! Let us show you around TaskZM', {
                    description: 'Take a quick tour to learn the basics',
                    duration: TOAST_DURATION_MEDIUM_MS
                  });
                }, TIMING_CONSTANTS.animations.long);
              }
            };
            
            // Check immediately in case disclaimer was already closed
            checkDisclaimer();
            
            // Listen for storage changes (when disclaimer sets sessionStorage) - but only once
            const interval = setInterval(() => {
              checkDisclaimer();
              // Clear interval after first trigger to prevent loops
              if (hasTriggered) {
                clearInterval(interval);
              }
            }, TIMING_CONSTANTS.delays.splashScreenPollInterval); // Check at polling interval
            
            return () => clearInterval(interval);
          }
        } else {
          // For regular users, start tour normally
          // Mark as triggered immediately to prevent loops
          tourTriggeredRef.current = true;
          
          // Clear the new signup flag immediately to prevent re-triggering
          try {
            window?.localStorage?.removeItem('taskzm_is_new_signup');
          } catch (removeError) {
            console.warn('Unable to clear new signup flag:', removeError);
          }
          
          const timer = setTimeout(() => {
            console.log('🎯 Starting tour for new regular user');
            setRunTour(true);
            toast.info('👋 Welcome! Let us show you around TaskZM', {
              description: 'Take a quick tour to learn the basics',
              duration: TOAST_DURATION_MEDIUM_MS
            });
          }, TIMING_CONSTANTS.animations.long * 3); // Delay to let the UI settle (1.5 seconds)
          
          return () => clearTimeout(timer);
        }
      } else if (isNewSignup) {
        // Clear the flag even if tour was already completed
        window?.localStorage?.removeItem('taskzm_is_new_signup');
      }
    } catch (error) {
      console.warn('Local storage unavailable when checking tour status:', error);
    }
  }, [user, isLoading]);

  // Keyboard shortcut to close panel (Escape key)
  // Must be defined before conditional returns (Rules of Hooks)
  useEffect(() => {
    // Only add listener if user is authenticated and panel is open
    if (!user || (currentView !== 'today' && currentView !== 'inbox' && currentView !== 'archive' && currentView !== 'analytics' && currentView !== 'settings' && currentView !== 'team' && currentView !== 'folders')) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCurrentView('dashboard');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user, currentView]);



  // Track if app is fully rendered and interactive (not just data loaded)
  const [isAppRendered, setIsAppRendered] = React.useState(false);
  const [minDisplayTimeElapsed, setMinDisplayTimeElapsed] = React.useState(false);
  
  // Track minimum display time for loading screen
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setMinDisplayTimeElapsed(true);
    }, TIMING_CONSTANTS.delays.splashScreenMinDisplay);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Check if app is fully rendered and interactive
  React.useEffect(() => {
    if (isLoading) {
      // Still loading data, don't check yet
      setIsAppRendered(false);
      return;
    }
    
    // Wait for minimum display time before checking
    if (!minDisplayTimeElapsed) {
      return;
    }
    
    // Data is loaded, now check if React has fully rendered and app is interactive
    let checkCount = 0;
    const maxChecks = TIMING_CONSTANTS.delays.splashScreenMaxChecks;
    const timeoutId = setTimeout(() => {
      // Fallback: if we've been checking for too long, assume app is ready
      if (import.meta.env.DEV) {
        console.warn('⚠️ App ready check timeout - forcing app to be considered ready');
      }
      setIsAppRendered(true);
    }, TIMING_CONSTANTS.delays.splashScreenTimeout);
    
    const checkAppReady = () => {
      checkCount++;
      
      // Safety: if we've checked too many times, assume app is ready
      if (checkCount > maxChecks) {
        if (import.meta.env.DEV) {
          console.warn('⚠️ App ready check exceeded max attempts - forcing app to be considered ready');
        }
        clearTimeout(timeoutId);
        setIsAppRendered(true);
        return;
      }
      
      const rootEl = document.getElementById('root');
      if (!rootEl) {
        setTimeout(checkAppReady, TIMING_CONSTANTS.delays.splashScreenPollInterval);
        return;
      }
      
      // Check for meaningful content (more strict - require substantial content)
      const innerHTML = rootEl.innerHTML.trim();
      const hasContent = rootEl.children.length > 0 && 
                        innerHTML.length > TIMING_CONSTANTS.delays.splashScreenMinContentLength;
      
      // Check for interactive elements (buttons, links, inputs, etc.)
      // Require multiple interactive elements to ensure app is fully loaded
      const interactiveElements = rootEl.querySelectorAll('button:not([disabled]), a:not([disabled]), [role="button"]:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [data-testid], [onclick]');
      const visibleInteractiveElements = Array.from(interactiveElements).filter((el) => {
        const htmlEl = el as HTMLElement;
        const style = window.getComputedStyle(htmlEl);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0' &&
               !htmlEl.hasAttribute('disabled');
      });
      const hasInteractive = visibleInteractiveElements.length >= TIMING_CONSTANTS.delays.splashScreenMinInteractiveElements;
      
      // Check for app-specific elements (sidebar, dashboard, kanban, etc.)
      const hasAppElements = rootEl.querySelector('[class*="sidebar"], [class*="dashboard"], [class*="kanban"], [class*="view"], [class*="panel"]') !== null ||
                           rootEl.querySelector('nav, header, main, section, aside') !== null;
      
      // Check for kanban-specific elements to ensure kanban view is fully rendered
      // Kanban columns should be present and visible
      const hasKanbanColumns = rootEl.querySelector('[class*="kanban"] [data-rbd-droppable-id], [class*="kanban"] [data-testid*="column"], [class*="kanban"] [class*="column"]') !== null;
      
      // If kanban is present, ensure it has columns before considering app ready
      const kanbanColumnCount = hasKanbanColumns ? rootEl.querySelectorAll('[class*="kanban"] [data-rbd-droppable-id], [class*="kanban"] [data-testid*="column"], [class*="kanban"] [class*="column"]').length : 0;
      const isKanbanReady = !hasKanbanColumns || (hasKanbanColumns && kanbanColumnCount >= TIMING_CONSTANTS.delays.splashScreenMinKanbanColumns);
      
      // Check for auth screen elements (auth form, sign in button, etc.)
      const hasAuthElements = rootEl.querySelector('[class*="auth"], [class*="signin"], [class*="signup"], [id*="auth"]') !== null;
      
      // Check if loading screen is still visible (if it is, app isn't ready yet)
      const hasLoadingScreen = rootEl.querySelector('[class*="loading"], [class*="splash"], .animate-spin') !== null;
      
      // Check if body is in a loading state (pointer-events: none, etc.)
      const bodyStyle = window.getComputedStyle(document.body);
      const isBodyInteractive = bodyStyle.pointerEvents !== 'none' && 
                               !document.body.classList.contains('loading') &&
                               !document.body.hasAttribute('data-loading');
      
      // Check if React has finished rendering by looking for React root markers
      // React 18+ uses data-reactroot or similar markers
      const hasReactMarkers = rootEl.querySelector('[data-reactroot], [data-react-version]') !== null ||
                             rootEl.children.length > 0; // If there are children, React has rendered
      
      // App is ready if:
      // 1. Has substantial content
      // 2. Has multiple visible, enabled interactive elements (at least 3)
      // 3. Has app elements OR auth elements (one of them)
      // 4. Loading screen is NOT visible (app content has replaced it)
      // 5. Body is interactive (not disabled)
      // 6. React has finished rendering
      // 7. If kanban is present, ensure it has columns rendered
      const isReady = hasContent && 
                     hasInteractive && 
                     (hasAppElements || hasAuthElements) &&
                     !hasLoadingScreen &&
                     isBodyInteractive &&
                     hasReactMarkers &&
                     isKanbanReady;
      
      if (isReady) {
        clearTimeout(timeoutId);
        if (import.meta.env.DEV) {
          console.log('✅ App is ready:', { 
            hasContent, 
            hasInteractive, 
            interactiveCount: visibleInteractiveElements.length,
            hasAppElements, 
            hasAuthElements,
            hasLoadingScreen,
            isBodyInteractive,
            hasReactMarkers,
            isKanbanReady,
            kanbanColumns: kanbanColumnCount
          });
        }
        // Add additional delay to ensure React has fully initialized event handlers
        // and the app is truly responsive
        // Also account for kanban view animations (duration + delay = 600ms)
        const hasKanbanView = rootEl.querySelector('[class*="kanban"]') !== null;
        const additionalDelay = hasKanbanView ? TIMING_CONSTANTS.delays.splashScreenKanbanAnimationDelay : 0;
        
        setTimeout(() => {
          // Double-check that app is still ready before hiding
          const finalCheck = rootEl && 
                            rootEl.children.length > 0 && 
                            rootEl.querySelector('button:not([disabled]), a:not([disabled])') !== null;
          
          // If kanban is present, ensure columns are still there
          const finalKanbanColumnCount = hasKanbanView ? rootEl.querySelectorAll('[class*="kanban"] [data-rbd-droppable-id], [class*="kanban"] [data-testid*="column"], [class*="kanban"] [class*="column"]').length : 0;
          const finalKanbanCheck = !hasKanbanView || 
                                  (finalKanbanColumnCount >= TIMING_CONSTANTS.delays.splashScreenMinKanbanColumns);
          
          if (finalCheck && finalKanbanCheck) {
            setIsAppRendered(true);
          } else {
            // If final check fails, continue checking
            if (import.meta.env.DEV) {
              console.warn('⚠️ Final check failed, continuing to wait...', { finalCheck, finalKanbanCheck });
            }
            setTimeout(checkAppReady, TIMING_CONSTANTS.delays.splashScreenCheckDelay);
          }
        }, TIMING_CONSTANTS.delays.splashScreenPostReadyDelay + TIMING_CONSTANTS.delays.splashScreenReactInitDelay + additionalDelay);
      } else {
        if (import.meta.env.DEV && checkCount % 10 === 0) {
          // Log every 10th check to avoid spam
          console.log(`⏳ App not ready yet (attempt ${checkCount}/${maxChecks}):`, { 
            hasContent, 
            hasInteractive, 
            interactiveCount: visibleInteractiveElements.length,
            hasAppElements, 
            hasAuthElements,
            hasLoadingScreen,
            isBodyInteractive,
            hasReactMarkers
          });
        }
        // Check again after a short delay
        setTimeout(checkAppReady, TIMING_CONSTANTS.delays.splashScreenPollInterval);
      }
    };
    
    // Use requestAnimationFrame to ensure React has rendered
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Additional delay to ensure React has fully rendered
        setTimeout(() => {
          checkAppReady();
        }, TIMING_CONSTANTS.delays.splashScreenCheckDelay);
      });
    });
    
    // Cleanup timeout on unmount
    return () => {
      clearTimeout(timeoutId);
    };
  }, [isLoading, minDisplayTimeElapsed]);
  
  // Show loading screen if data is loading OR app is not yet rendered/interactive
  // Also ensure minimum display time has elapsed
  const showLoadingScreen = isLoading || !isAppRendered || !minDisplayTimeElapsed;
  
  // If loading, show React loading screen (which properly loads images via imports)
  // React loading screen stays visible until isLoading is false AND app is fully rendered and interactive
  if (showLoadingScreen) {
    const { actualTheme } = useTheme();
    const isDark = actualTheme === 'dark';
    
    return (
      <div className="fixed inset-0 h-screen w-screen flex items-center justify-center bg-gradient-to-br from-[#EFE9FA] via-[#EAE4F6] to-[#E3DCF1] md:from-[#FAF9FC] md:via-[#F9F7FD] md:to-[#F3F0F9] dark:from-gray-950 dark:via-gray-900 dark:to-gray-950" style={{ zIndex: REACT_LOADING_SCREEN.zIndex }}>
        <div className="flex flex-col items-center justify-center space-y-6">
          {/* Logo - Responsive sizing using CSS class */}
          <img
            src={isDark ? logoImageGray : logoImageBlack}
            alt={SPLASH_SCREEN_TEXT.logoAlt}
            className="loading-screen-logo"
            onError={(e) => {
              // Fallback if image fails
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const fallback = document.createElement('div');
              fallback.textContent = SPLASH_SCREEN_TEXT.fallbackText;
              fallback.style.cssText = `font-size: min(8vw, 48px); font-weight: bold; color: var(--primary, ${APP_TEXT_FALLBACK_COLOR}); text-align: center;`;
              target.parentNode?.appendChild(fallback);
            }}
          />
          
          {/* Dual Spinner */}
          <div className="relative w-12 h-12 md:w-16 md:h-16">
            {/* Outer spinner */}
            <div
              className="absolute inset-0 border-4 rounded-full animate-spin"
              style={{
                borderTopColor: 'var(--primary, #9B87E8)',
                borderRightColor: 'var(--pastel-lavender, #E6D5F0)',
                borderBottomColor: 'var(--pastel-lavender, #E6D5F0)',
                borderLeftColor: 'var(--pastel-lavender, #E6D5F0)',
                display: 'block',
                visibility: 'visible',
                opacity: 1,
                animationDuration: REACT_LOADING_SCREEN.spinner.outer.animationDuration,
              }}
            />
            {/* Inner spinner */}
            <div
              className="absolute inset-0 border-4 rounded-full animate-spin"
              style={{
                borderTopColor: 'transparent',
                borderRightColor: 'var(--pastel-sky, #C9E4F7)',
                borderBottomColor: 'var(--pastel-sky, #C9E4F7)',
                borderLeftColor: 'var(--pastel-sky, #C9E4F7)',
                animationDirection: REACT_LOADING_SCREEN.spinner.inner.animationDirection,
                animationDuration: REACT_LOADING_SCREEN.spinner.inner.animationDuration,
                display: 'block',
                visibility: 'visible',
                opacity: 1,
              }}
            />
          </div>
          
          {/* Loading message */}
          <p className="text-sm md:text-base font-medium text-foreground">
            {loadingMessage || SPLASH_SCREEN_TEXT.loadingMessage}
          </p>
          
          {/* Loading dots */}
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: REACT_LOADING_SCREEN.dots.animationDelays.first }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: REACT_LOADING_SCREEN.dots.animationDelays.second }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: REACT_LOADING_SCREEN.dots.animationDelays.third }} />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const handleViewChange = (view: string) => {
    // Check if feature requires PRO
    if (view === 'analytics' && !hasFeature('analytics')) {
      setUpgradeFeature('analytics');
      setShowUpgradePrompt(true);
      setSidebarOpen(false);
      return;
    }
    
    if (view === 'team' && !hasFeature('teamFeatures')) {
      setUpgradeFeature('teamFeatures');
      setShowUpgradePrompt(true);
      setSidebarOpen(false);
      return;
    }
    
    // If clicking the same view, close the panel
    if (currentView === view && view !== 'dashboard') {
      setCurrentView('dashboard');
    } else {
      setCurrentView(view);
      // On mobile, when dashboard is selected, default to week view
      if (view === 'dashboard' && shouldUseMobileLayout) {
        setMobileView('week');
      }
    }
    setSidebarOpen(false); // Close mobile sidebar on view change
  };

  const handleClosePanel = () => {
    setCurrentView('dashboard');
    // On mobile, when closing a panel, default to week view
    if (shouldUseMobileLayout) {
      setMobileView('week');
    }
  };

  const handleAISchedule = async () => {
    // Check if user has access to AI Scheduler feature
    if (!hasFeature('aiScheduler')) {
      setUpgradeFeature('aiScheduler');
      setShowUpgradePrompt(true);
      return;
    }

      // Check AI scheduler usage limit for free tier
      if (features.aiSchedulerLimit !== undefined) {
        const { hasReachedLimit, getRemainingCount, incrementAIUsage } = await import('./lib/ai-scheduler-usage');
        if (hasReachedLimit(features.aiSchedulerLimit)) {
          // Show upgrade prompt instead of just a toast for better conversion
          setUpgradeFeature('aiScheduler');
          setShowUpgradePrompt(true);
          return;
        }
        // Increment usage before scheduling
        incrementAIUsage();
      }

    // Check if AI scheduling is enabled
    if (!aiSettings.autoSchedulingEnabled || !aiSettings.scheduleUnscheduledTasks) {
      toast.error('AI Scheduling is disabled', {
        description: 'Enable AI scheduling in Settings to use this feature.',
        duration: TOAST_DURATION_MEDIUM_MS,
      });
      return;
    }

    // Check if there are unscheduled tasks
    if (unscheduledCount === 0) {
      toast.info('No tasks to schedule', {
        description: 'All your tasks are already scheduled!',
        duration: TOAST_DURATION_SHORT_MS,
      });
      return;
    }

    // Show loading toast
    const loadingToast = toast.loading('AI is scheduling your tasks...', {
      description: `Organizing ${unscheduledCount} task${unscheduledCount === 1 ? '' : 's'}`,
    });

    try {
      // Schedule only tasks without due dates for a two week period, using category hours
      const result = await scheduleAllTasks({ 
        period: 'twoWeeks',
        onlyWithoutDueDate: true,
        forceCategoryHours: true 
      });
      
      // Dismiss loading toast
      toast.dismiss(loadingToast);
      
      if (result.scheduled.length > 0) {
        // Store scheduled tasks and show result dialog
        setScheduledTasks(result.scheduled);
        setShowScheduleResult(true);
        
        // Show success toast
        toast.success(`Scheduled ${result.scheduled.length} task${result.scheduled.length === 1 ? '' : 's'}!`, {
          description: 'Tasks distributed across upcoming days',
          duration: TOAST_DURATION_SHORT_MS,
        });
      }
      
      // Show warning if tasks exceed the 5-hour limit
      if (result.exceedsLimit.length > 0) {
        toast.warning(
          `${result.exceedsLimit.length} task${result.exceedsLimit.length === 1 ? '' : 's'} need${result.exceedsLimit.length === 1 ? 's' : ''} manual scheduling`,
          {
            description: `These tasks exceed the 5-hour daily limit. Please schedule them manually.`,
            duration: TOAST_DURATION_DEFAULT_MS,
          }
        );
      }
      
      // If no tasks were scheduled but some exceed limit
      if (result.scheduled.length === 0 && result.exceedsLimit.length > 0) {
        toast.info('No tasks could be automatically scheduled', {
          description: `All tasks exceed the 5-hour daily limit. Please schedule them manually.`,
          duration: TOAST_DURATION_LONG_MS,
        });
      }
    } catch (error) {
      // Dismiss loading toast
      toast.dismiss(loadingToast);
      
      // Show error toast
      toast.error('Scheduling failed', {
        description: 'Something went wrong. Please try again.',
        duration: TOAST_DURATION_MEDIUM_MS,
      });
      console.error('AI scheduling error:', error);
    }
  };

  const handleUpgradeRequest = () => {
    setShowUpgradePrompt(false);
    setShowPricingDialog(true);
  };

  const handleTourNavigate = (view: string) => {
    setCurrentView(view);
  };

  const handleTourStart = () => {
    // Reset trigger ref when manually starting tour
    tourTriggeredRef.current = false;
    setRunTour(true);
  };

  const handleTourFinish = () => {
    setRunTour(false);
    // Reset the trigger ref so tour can be manually restarted
    tourTriggeredRef.current = false;
    try {
      window?.localStorage?.setItem('taskzm_tour_completed', 'true');
      const isNewSignup = window?.localStorage?.getItem('taskzm_is_new_signup') === 'true';
      
      // Show pricing dialog for new free users after tour completion
      // (onShowPricing in AppTour will handle this, but we also check here as backup)
      if (isNewSignup && subscription.tier === 'free') {
        // Small delay to let tour close smoothly
        setTimeout(() => {
          setShowPricingDialog(true);
        }, TIMING_CONSTANTS.animations.long);
      }
      
      // Clear new signup flag if it exists
      window?.localStorage?.removeItem('taskzm_is_new_signup');
    } catch (error) {
      console.warn('Local storage unavailable when finishing tour:', error);
    }
    
    // Dispatch event so SettingsPanel can update (safe even if storage unavailable)
    window.dispatchEvent(new Event('storage'));
    
    toast.success('Tour completed!', {
      description: 'You\'re ready to start using TaskZM!'
    });
  };

  // Show invitation acceptance page if token is present
  if (inviteToken) {
    return <InviteAcceptancePage token={inviteToken} />;
  }

  return (
    <>
      <div className="h-screen flex bg-gradient-to-br from-[#EFE9FA] via-[#EAE4F6] to-[#E3DCF1] md:from-[#FAF9FC] md:via-[#F9F7FD] md:to-[#F3F0F9] dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 relative overflow-hidden">
        <AppSidebar 
          currentView={currentView} 
          onViewChange={handleViewChange}
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
          unscheduledCount={unscheduledCount}
          upcomingAndDueNowCount={upcomingAndDueNowCount}
        />
        <main className="flex-1 overflow-hidden relative flex">
          {/* Mobile/Tablet: Show different views - Full height container with proper bottom spacing */}
          {shouldUseMobileLayout && (
          <div className="flex-1 flex flex-col min-h-0">
            <div 
              className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 relative"
              style={{
                scrollBehavior: 'smooth',
                WebkitOverflowScrolling: 'touch',
                overscrollBehaviorY: 'contain',
                // Minimum height to fill space between header and nav bar, extends with content
                minHeight: shouldUseMobileLayout
                  ? `calc(100vh - ${HEADER_HEIGHT}px - ${NAV_BAR_HEIGHT}px)`
                  : 'auto',
                // Add padding-top on mobile/tablet to ensure content is not hidden by fixed header when scrolling up
                paddingTop: shouldUseMobileLayout
                  ? MOBILE_SCROLL_CONTAINER_PADDING_TOP
                  : undefined,
                // Add padding-bottom on mobile/tablet to ensure content can scroll past nav bar
                // Use full nav bar height + safe area + extra buffer to ensure last item is fully visible
                paddingBottom: shouldUseMobileLayout
                  ? `calc(${NAV_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px) + ${NAV_BAR_SCROLL_BUFFER_REM})`
                  : undefined,
                // Background gradient fills the container and extends with content - extends to nav bar
                backgroundImage: shouldUseMobileLayout
                  ? `linear-gradient(to bottom, ${KANBAN_BACKGROUND_GRADIENTS.mobile.from}, ${KANBAN_BACKGROUND_GRADIENTS.mobile.to})`
                  : 'transparent',
                // Ensure background extends fully to nav bar and beyond with content
                backgroundSize: shouldUseMobileLayout
                  ? '100% auto'
                  : 'auto',
                backgroundRepeat: 'repeat-y',
                backgroundAttachment: 'scroll',
              } as React.CSSProperties}
            >
              {currentView === 'dashboard' && (
                <DashboardView 
                  mobileView={mobileView}
                  onMobileViewChange={setMobileView}
                  aiPanelOpen={aiPanelOpen}
                  onAiPanelChange={setAiPanelOpen}
                />
              )}
              {currentView === 'notifications' && <NotificationsPanel />}
              {currentView === 'today' && <TodayAgendaView />}
              {currentView === 'inbox' && <InboxView />}
              {currentView === 'team' && <TeamPanel />}
              {currentView === 'folders' && <FoldersPanel />}
              {currentView === 'analytics' && (
                <ErrorBoundary>
                  <AnalyticsPanel onClose={handleClosePanel} />
                </ErrorBoundary>
              )}
              {currentView === 'archive' && <ArchiveView />}
              {currentView === 'settings' && (
                <SettingsPanel 
                  onStartTour={handleTourStart}
                />
              )}
            </div>
          </div>
          )}

          {/* Desktop: Slide-out Panels with Push Effect (not mobile/tablet) */}
          <AnimatePresence mode="wait">
            {!shouldUseMobileLayout && (currentView === 'notifications' || currentView === 'today' || currentView === 'inbox' || currentView === 'team' || currentView === 'folders' || currentView === 'analytics' || currentView === 'archive' || currentView === 'settings') && (
              <motion.div
                key={currentView}
                initial={{ width: 0, opacity: 0 }}
                animate={{ 
                  width: panelWidth,
                  opacity: 1 
                }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="h-full bg-background shadow-2xl border-r border-border flex-shrink-0 overflow-hidden"
              >
                {/* Panel Content */}
                <div className="h-full w-full overflow-hidden">
                  {currentView === 'notifications' && <NotificationsPanel />}
                  {currentView === 'today' && <TodayAgendaView />}
                  {currentView === 'inbox' && <InboxView />}
                  {currentView === 'team' && <TeamPanel />}
                  {currentView === 'folders' && <FoldersPanel />}
                  {currentView === 'analytics' && (
                    <ErrorBoundary>
                      <AnalyticsPanel onClose={handleClosePanel} />
                    </ErrorBoundary>
                  )}
                  {currentView === 'archive' && <ArchiveView />}
                  {currentView === 'settings' && (
                    <SettingsPanel 
                      onStartTour={handleTourStart}
                    />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Desktop: Dashboard - pushed to the right when panel is open (not mobile/tablet) */}
          {/* No animation - header shifts instantly when panel opens/closes */}
          {!shouldUseMobileLayout && (
          <div 
            className="h-full flex-1 overflow-hidden"
            style={{ paddingTop: `${HEADER_HEIGHT}px` }}
          >
            <DashboardView 
              mobileView={mobileView}
              onMobileViewChange={setMobileView}
              aiPanelOpen={aiPanelOpen}
              onAiPanelChange={setAiPanelOpen}
              hideAgenda={true}
              panelOpen={currentView !== 'dashboard'}
              panelKey={currentView}
            />
          </div>
          )}
        </main>
        <BottomNav 
          currentView={currentView}
          onViewChange={handleViewChange}
          mobileView={mobileView}
          onMobileViewChange={setMobileView}
          unscheduledCount={unscheduledCount}
          upcomingAndDueNowCount={upcomingAndDueNowCount}
        />
      </div>
      
      {/* AI Schedule Result Dialog */}
      <AIScheduleResultDialog 
        open={showScheduleResult}
        onOpenChange={setShowScheduleResult}
        scheduledTasks={scheduledTasks}
      />

      {/* Upgrade Prompt */}
      <UpgradePrompt
        open={showUpgradePrompt}
        onOpenChange={setShowUpgradePrompt}
        onUpgrade={handleUpgradeRequest}
        feature={upgradeFeature}
      />

      {/* Pricing Dialog */}
      <PricingDialog
        open={showPricingDialog}
        onOpenChange={setShowPricingDialog}
      />

      {/* Award Celebration */}
      <AwardCelebration />

      {/* App Tour */}
      <AppTour
        run={runTour}
        onFinish={handleTourFinish}
        onNavigate={handleTourNavigate}
        onShowPricing={() => setShowPricingDialog(true)}
      />

      {/* Demo Account Disclaimer */}
      <DemoAccountDisclaimer
        open={showDemoDisclaimer}
        onOpenChange={setShowDemoDisclaimer}
      />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <SubscriptionProvider>
            <TaskProvider>
              <LoadingProvider>
                <TeamProvider>
                <AwardProvider>
                  <CalendarProvider>
                    <AIProvider>
                      <NotificationProvider>
                        <SidebarProvider>
                          <PomodoroProvider>
                            <DragDropProvider>
                              <DocumentHead />
                              <AppContent />
                              <Toaster />
                            </DragDropProvider>
                          </PomodoroProvider>
                        </SidebarProvider>
                      </NotificationProvider>
                    </AIProvider>
                  </CalendarProvider>
                </AwardProvider>
                </TeamProvider>
              </LoadingProvider>
            </TaskProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
