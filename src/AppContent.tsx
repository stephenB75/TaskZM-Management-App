import React, { useState, useEffect, useRef, Suspense } from 'react';
import { lazyWithRetry } from './lib/lazy-with-retry';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from './lib/toast-wrapper';
import {
  TOAST_DURATION_SHORT_MS,
  TOAST_DURATION_MEDIUM_MS,
  TOAST_DURATION_LONG_MS,
  TOAST_DURATION_DEFAULT_MS,
} from './lib/layout-constants';
import { useAuth } from './contexts/AuthContext';
import { useSubscription } from './contexts/SubscriptionContext';
import { useTasks } from './contexts/TaskContext';
import { useLoading } from './contexts/LoadingContext';
import { useTheme } from './contexts/ThemeContext';
import { useSidebar } from './contexts/SidebarContext';
import { useAI } from './contexts/AIContext';
import { useNotifications } from './contexts/NotificationContext';
import { InviteAcceptancePage } from './components/InviteAcceptancePage';
import { AwardCelebration } from './components/AwardCelebration';
import { AppSidebar } from './components/AppSidebar';
import { AppTour } from './components/AppTour';
import { BottomNav } from './components/BottomNav';
import { AIScheduleResultDialog } from './components/AIScheduleResultDialog';
import { PricingDialog } from './components/PricingDialog';
import { UpgradePrompt } from './components/UpgradePrompt';
import { DemoAccountDisclaimer } from './components/DemoAccountDisclaimer';
import { ErrorBoundary } from './components/ErrorBoundary';

const DashboardView = lazyWithRetry(() => import('./components/DashboardView').then(m => ({ default: m.DashboardView })));
const InboxView = lazyWithRetry(() => import('./components/InboxView').then(m => ({ default: m.InboxView })));
const ArchiveView = lazyWithRetry(() => import('./components/ArchiveView').then(m => ({ default: m.ArchiveView })));
const SettingsPanel = lazyWithRetry(() => import('./components/SettingsPanel').then(m => ({ default: m.SettingsPanel })));
const TodayAgendaView = lazyWithRetry(() => import('./components/TodayAgendaView').then(m => ({ default: m.TodayAgendaView })));
const AnalyticsPanel = lazyWithRetry(() => import('./components/AnalyticsPanel').then(m => ({ default: m.AnalyticsPanel })));
const TeamPanel = lazyWithRetry(() => import('./components/TeamPanel').then(m => ({ default: m.TeamPanel })));
const FoldersPanel = lazyWithRetry(() => import('./components/FoldersPanel').then(m => ({ default: m.FoldersPanel })));
const NotificationsPanel = lazyWithRetry(() => import('./components/NotificationsPanel').then(m => ({ default: m.NotificationsPanel })));
import { useAIScheduler, type SchedulePlan } from './hooks/useAIScheduler';
import { useAwardChecker } from './hooks/useAwardChecker';
import { useDemoActivity } from './hooks/useDemoActivity';
import { useMobileLayout } from './hooks/useMobileLayout';
import { TIMING_CONSTANTS } from './lib/timing-constants';
import { PANEL_WIDTH, PANEL_WIDTH_TABLET, PANEL_WIDTH_SMALL_MONITOR, SIDEBAR_WIDTH, HEADER_HEIGHT, HEADER_MOBILE_SPACER_HEIGHT, HEADER_MOBILE_SAFE_AREA_SPACER, NAV_BAR_SPACER_HEIGHT, NAV_BAR_BOTTOM_PADDING_MOBILE, NAV_BAR_HEIGHT, NAV_BAR_SCROLL_BUFFER_REM, HEADER_ANIMATION_DAMPING, HEADER_ANIMATION_STIFFNESS, VIEWPORT_BREAKPOINTS, getPanelWidth, MOBILE_SCROLL_CONTAINER_PADDING_TOP, SPLASH_SCREEN_TEXT, REACT_LOADING_SCREEN, APP_TEXT_FALLBACK_COLOR, HEADER_Z_INDEX, LOADING_SCREEN_GRADIENT_CLASS } from './lib/layout-constants';
import { KANBAN_BACKGROUND_GRADIENTS } from './lib/kanban-constants';
import logoImageBlack from './assets/Taskzm_Logo_BLK-removebg.png';
import logoImageGray from './assets/taskzm-logo-gray.png';

function ViewFallback() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[120px]" aria-hidden>
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

/**
 * Main app content (sidebar, views, panels). Rendered only when user is authenticated.
 * Expects to be inside ThemeProvider and all app providers.
 */
export default function AppContent() {
  const { user } = useAuth();
  const { isLoading, loadingMessage } = useLoading();
  useDemoActivity(); // Track demo user activity on app interactions
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const { settings: aiSettings } = useAI();
  const { hasFeature, features, subscription } = useSubscription();
  const shouldUseMobileLayout = useMobileLayout(); // Use mobile layout for tablets in portrait/landscape
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  
  // Initialize view: use same breakpoint as useMobileLayout (tablet) so mobile/tablet see tasks immediately
  const getInitialView = () => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < VIEWPORT_BREAKPOINTS.tablet ? 'today' : 'dashboard';
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
  const { tasks, workspaceId } = useTasks();
  const { settings: notificationSettings } = useNotifications();
  
  // Calculate count of overdue and due now tasks for mobile badge
  const getUpcomingAndDueNowCount = () => {
    const now = new Date();
    const dueNowMs = TIMING_CONSTANTS.todayAgendaBadge.dueNowMinutes * TIMING_CONSTANTS.timeConversions.minutesToMs;
    const dueNowThreshold = new Date(now.getTime() + dueNowMs);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const allTasksWithDates = tasks.filter((t: { dueDate?: string | null; scheduledDate?: string | null; status: string }) => (t.dueDate || t.scheduledDate) && t.status !== 'done');
    
    const dueTasks = tasks.filter((task: { id: string; title: string; status: string; dueDate?: string | null; scheduledDate?: string | null; recurrence?: { type: string } }) => {
      if (task.status === 'done') return false;
      if (task.scheduledDate === null || task.scheduledDate === undefined) {
        return false;
      }
      if (task.recurrence && task.recurrence.type !== 'none') return false;
      
      let targetDate: Date | null = null;
      let dateType: 'dueDate' | 'scheduledDate' | null = null;
      
      if (task.scheduledDate) {
        targetDate = new Date(task.scheduledDate);
        dateType = 'scheduledDate';
      } else {
        return false;
      }
      
      if (!targetDate || isNaN(targetDate.getTime())) return false;
      
      const targetDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const todayDateOnly = new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate());
      
      if (targetDateOnly > todayDateOnly) {
        return false;
      }
      
      const targetTime = targetDate.getTime();
      const nowTime = now.getTime();
      const thresholdTime = dueNowThreshold.getTime();
      const isDue = targetTime <= thresholdTime;
      
      if (isDue) {
        const timeDiff = (targetTime - nowTime) / TIMING_CONSTANTS.timeConversions.minutesToMs;
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
        const timeDiff = (targetTime - nowTime) / TIMING_CONSTANTS.timeConversions.minutesToMs;
        const isFutureDate = targetDateOnly > todayDateOnly;
        const dueNowMin = TIMING_CONSTANTS.todayAgendaBadge.dueNowMinutes;
        const dueSoonMax = TIMING_CONSTANTS.todayAgendaBadge.dueSoonMaxMinutes;
        if (isFutureDate || (timeDiff > dueNowMin && timeDiff < dueSoonMax)) {
          console.debug(`⏭️ [Today Agenda Badge] Task "${task.title}" NOT counted:`, {
            taskId: task.id,
            reason: isFutureDate ? 'Future date (tomorrow or later)' : `Scheduled for later today (${Math.round(timeDiff)} minutes from now)`,
            targetDateOnly: targetDateOnly.toLocaleDateString(),
            todayDateOnly: todayDateOnly.toLocaleDateString(),
            timeDiffMinutes: Math.round(timeDiff * 10) / 10,
            isFutureDate,
            taskScheduledDate: task.scheduledDate,
            taskDueDate: task.dueDate,
          });
        }
      }
      
      return isDue;
    });
    
    if (dueTasks.length > 0) {
      console.group(`🔔 [Today Agenda Badge] BADGE SHOWING: ${dueTasks.length} task(s) counted as due`);
      console.log('Current Time:', {
        UTC: now.toISOString(),
        Local: now.toLocaleString(),
        Timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      console.log(`Threshold (${TIMING_CONSTANTS.todayAgendaBadge.dueNowMinutes} minutes from now):`, {
        UTC: dueNowThreshold.toISOString(),
        Local: dueNowThreshold.toLocaleString(),
      });
      console.log('Tasks being counted:', dueTasks.map((t: { id: string; title: string; status: string; dueDate?: string | null; scheduledDate?: string | null }) => {
        const targetDate = t.dueDate ? new Date(t.dueDate) : (t.scheduledDate ? new Date(t.scheduledDate) : null);
        const timeDiff = targetDate ? (targetDate.getTime() - now.getTime()) / TIMING_CONSTANTS.timeConversions.minutesToMs : null;
        const dueNowMin = TIMING_CONSTANTS.todayAgendaBadge.dueNowMinutes;
        return {
          id: t.id,
          title: t.title,
          status: t.status,
          dateType: t.dueDate ? 'dueDate' : 'scheduledDate',
          targetDateUTC: targetDate?.toISOString(),
          targetDateLocal: targetDate?.toLocaleString(),
          timeDiffMinutes: timeDiff ? Math.round(timeDiff * 10) / 10 : null,
          isOverdue: timeDiff ? timeDiff < 0 : false,
          isDueSoon: timeDiff ? timeDiff >= 0 && timeDiff <= dueNowMin : false,
        };
      }));
      console.groupEnd();
    } else {
      console.log(`✅ [Today Agenda Badge] No badge - ${allTasksWithDates.length} task(s) with dates, but none are due within ${TIMING_CONSTANTS.todayAgendaBadge.dueNowMinutes} minutes`);
    }
    
    return dueTasks.length;
  };
  
  const upcomingAndDueNowCount = getUpcomingAndDueNowCount();
  
  useAwardChecker();
  
  // Strategic upgrade prompts for new free users
  useEffect(() => {
    if (!user || isLoading || subscription.tier !== 'free') return;
    
    try {
      const isNewSignup = window?.localStorage?.getItem('taskzm_is_new_signup') === 'true';
      const tourCompleted = window?.localStorage?.getItem('taskzm_tour_completed') === 'true';
      const upgradePromptShown = window?.localStorage?.getItem('taskzm_upgrade_prompt_shown') === 'true';
      
      if (!isNewSignup || !tourCompleted) return;
      
      const completedTasks = tasks.filter((t: { status: string }) => t.status === 'done');
      const completedCount = completedTasks.length;
      
      const { minCompletedTasks, maxCompletedTasks, delayMs: upgradeDelayMs } = TIMING_CONSTANTS.upgradePrompt;
      if (completedCount >= minCompletedTasks && completedCount <= maxCompletedTasks && !upgradePromptShown) {
        const timer = setTimeout(() => {
          setUpgradeFeature('aiScheduler');
          setShowUpgradePrompt(true);
          window?.localStorage?.setItem('taskzm_upgrade_prompt_shown', 'true');
        }, upgradeDelayMs);
        
        return () => clearTimeout(timer);
      }
    } catch (error) {
      console.warn('Error checking for strategic upgrade prompts:', error);
    }
  }, [tasks, user, isLoading, subscription.tier]);

  useEffect(() => {
    const handleUpgradePrompt = (event: CustomEvent) => {
      const feature = event.detail?.feature;
      if (feature && ['recurringTasks', 'taskDependencies', 'taskTemplates', 'calendarSync'].includes(feature)) {
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

  const [inviteToken, setInviteToken] = useState<string | null>(null);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      setInviteToken(token);
    }
  }, []);

  useEffect(() => {
    try {
      const hasSeenMessage = window?.sessionStorage?.getItem('taskzm_session_info_shown');
      
      if (!hasSeenMessage) {
        console.log('%c✨ TaskZM v1.0.1 - Baseline Reset ✨', 'font-size: 16px; font-weight: bold; color: #9D87C3;');
        console.log('%cℹ️  Payment System Status:', 'font-weight: bold; color: #4A90E2;');
        console.log('  • Payment System: Stripe integration');
        console.log('  • Mode: Production (real payments via Stripe)');
        
        window?.sessionStorage?.setItem('taskzm_session_info_shown', 'true');
      }
    } catch (error) {
      console.warn('Session storage unavailable, skipping session info message:', error);
    }
  }, []);

  useEffect(() => {
    if (hasInitializedView.current) return;
    
    const checkMobile = shouldUseMobileLayout || (typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.mobile);
    
    if (checkMobile && currentView === 'dashboard') {
      setCurrentView('today');
    }
    
    hasInitializedView.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When switching to mobile layout: only redirect dashboard→today when mobileView is 'today'
  // (so user can tap Week and see DashboardView with Week tab; don't override that)
  useEffect(() => {
    if (shouldUseMobileLayout && currentView === 'dashboard' && mobileView === 'today') {
      setCurrentView('today');
    }
  }, [shouldUseMobileLayout, currentView, mobileView]);

  useEffect(() => {
    if (!user || isLoading) return;
    
    if (user.isDemo) {
      try {
        const disclaimerSeen = window?.sessionStorage?.getItem('demo_disclaimer_seen');
        
        if (!disclaimerSeen) {
          const timer = setTimeout(() => {
            setShowDemoDisclaimer(true);
          }, TIMING_CONSTANTS.demoDisclaimer.delayMs);
          
          return () => clearTimeout(timer);
        }
      } catch (error) {
        console.warn('Session storage unavailable when checking demo disclaimer:', error);
      }
    }
  }, [user, isLoading]);

  const tourTriggeredRef = React.useRef(false);

  useEffect(() => {
    if (!user || isLoading) return;
    
    if (tourTriggeredRef.current) return;
    
    try {
      const tourCompleted = window?.localStorage?.getItem('taskzm_tour_completed');
      const isNewSignup = window?.localStorage?.getItem('taskzm_is_new_signup') === 'true';
      
      if (isNewSignup && !tourCompleted) {
        if (user.isDemo) {
          const disclaimerSeen = window?.sessionStorage?.getItem('demo_disclaimer_seen');
          
          if (disclaimerSeen) {
            tourTriggeredRef.current = true;
            
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
            }, TIMING_CONSTANTS.animations.long);
            
            return () => clearTimeout(timer);
          } else {
            let hasTriggered = false;
            
            const checkDisclaimer = () => {
              if (hasTriggered || tourTriggeredRef.current) return;
              
              const seen = window?.sessionStorage?.getItem('demo_disclaimer_seen');
              if (seen && !tourCompleted) {
                hasTriggered = true;
                tourTriggeredRef.current = true;
                
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
            
            checkDisclaimer();
            
            const interval = setInterval(() => {
              checkDisclaimer();
              if (hasTriggered) {
                clearInterval(interval);
              }
            }, TIMING_CONSTANTS.delays.splashScreenPollInterval);
            
            return () => clearInterval(interval);
          }
        } else {
          tourTriggeredRef.current = true;
          
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
          }, TIMING_CONSTANTS.animations.long * 3);
          
          return () => clearTimeout(timer);
        }
      } else if (isNewSignup) {
        window?.localStorage?.removeItem('taskzm_is_new_signup');
      }
    } catch (error) {
      console.warn('Local storage unavailable when checking tour status:', error);
    }
  }, [user, isLoading]);

  useEffect(() => {
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

  const [isAppRendered, setIsAppRendered] = React.useState(false);
  const [minDisplayTimeElapsed, setMinDisplayTimeElapsed] = React.useState(false);
  const [isAppFullyInitialized, setIsAppFullyInitialized] = React.useState(false);
  
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setMinDisplayTimeElapsed(true);
    }, TIMING_CONSTANTS.delays.splashScreenMinDisplay);
    
    return () => clearTimeout(timer);
  }, []);

  const initTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (isLoading || !minDisplayTimeElapsed) {
      setIsAppRendered(false);
      setIsAppFullyInitialized(false);
      return;
    }
    let cancelled = false;
    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        setIsAppRendered(true);
        initTimerRef.current = setTimeout(() => {
          initTimerRef.current = null;
          if (!cancelled) setIsAppFullyInitialized(true);
        }, TIMING_CONSTANTS.delays.splashScreenReactInitDelay);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (initTimerRef.current !== null) {
        clearTimeout(initTimerRef.current);
        initTimerRef.current = null;
      }
    };
  }, [isLoading, minDisplayTimeElapsed]);

  React.useEffect(() => {
    if (isLoading) setIsAppFullyInitialized(false);
  }, [isLoading]);
  
  const showLoadingScreen = isLoading || !isAppRendered || !minDisplayTimeElapsed || !isAppFullyInitialized;
  const isUserReady = !user || (user && workspaceId !== undefined);
  const finalShowLoadingScreen = showLoadingScreen || !isUserReady;
  
  const loadingOverlay = finalShowLoadingScreen ? (
    <div className={`fixed inset-0 h-screen w-screen flex items-center justify-center ${LOADING_SCREEN_GRADIENT_CLASS}`} style={{ zIndex: REACT_LOADING_SCREEN.zIndex }}>
      <div className="flex flex-col items-center justify-center space-y-6">
        <img
          src={isDark ? logoImageGray : logoImageBlack}
          alt={SPLASH_SCREEN_TEXT.logoAlt}
          className="loading-screen-logo"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const fallback = document.createElement('div');
            fallback.textContent = SPLASH_SCREEN_TEXT.fallbackText;
            fallback.style.cssText = `font-size: min(8vw, 48px); font-weight: bold; color: var(--primary, ${APP_TEXT_FALLBACK_COLOR}); text-align: center;`;
            target.parentNode?.appendChild(fallback);
          }}
        />
        <div className="relative w-12 h-12 md:w-16 md:h-16">
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
        <p className="text-sm md:text-base font-medium text-foreground">
          {loadingMessage || SPLASH_SCREEN_TEXT.loadingMessage}
        </p>
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: REACT_LOADING_SCREEN.dots.animationDelays.first }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: REACT_LOADING_SCREEN.dots.animationDelays.second }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: REACT_LOADING_SCREEN.dots.animationDelays.third }} />
        </div>
      </div>
    </div>
  ) : null;

  // Guard: should not reach here without user (gate in AuthenticatedApp shows AuthScreen)
  if (!user) {
    return null;
  }

  const handleViewChange = (view: string) => {
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
    
    if (currentView === view && view !== 'dashboard') {
      setCurrentView('dashboard');
    } else {
      setCurrentView(view);
      if (view === 'dashboard' && shouldUseMobileLayout) {
        setMobileView('week');
      }
    }
    setSidebarOpen(false);
  };

  const handleClosePanel = () => {
    setCurrentView('dashboard');
    if (shouldUseMobileLayout) {
      setMobileView('week');
    }
  };

  const handleAISchedule = async () => {
    if (!hasFeature('aiScheduler')) {
      setUpgradeFeature('aiScheduler');
      setShowUpgradePrompt(true);
      return;
    }

      if (features.aiSchedulerLimit !== undefined) {
        const { hasReachedLimit, getRemainingCount, incrementAIUsage } = await import('./lib/ai-scheduler-usage');
        if (hasReachedLimit(features.aiSchedulerLimit)) {
          setUpgradeFeature('aiScheduler');
          setShowUpgradePrompt(true);
          return;
        }
        incrementAIUsage();
      }

    if (!aiSettings.autoSchedulingEnabled || !aiSettings.scheduleUnscheduledTasks) {
      toast.error('AI Scheduling is disabled', {
        description: 'Enable AI scheduling in Settings to use this feature.',
        duration: TOAST_DURATION_MEDIUM_MS,
      });
      return;
    }

    if (unscheduledCount === 0) {
      toast.info('No tasks to schedule', {
        description: 'All your tasks are already scheduled!',
        duration: TOAST_DURATION_SHORT_MS,
      });
      return;
    }

    const loadingToast = toast.loading('AI is scheduling your tasks...', {
      description: `Organizing ${unscheduledCount} task${unscheduledCount === 1 ? '' : 's'}`,
    });

    try {
      const result = await scheduleAllTasks({ 
        period: 'twoWeeks',
        onlyWithoutDueDate: true,
        forceCategoryHours: true 
      });
      
      toast.dismiss(loadingToast);
      
      if (result.scheduled.length > 0) {
        setScheduledTasks(result.scheduled);
        setShowScheduleResult(true);
        
        toast.success(`Scheduled ${result.scheduled.length} task${result.scheduled.length === 1 ? '' : 's'}!`, {
          description: 'Tasks distributed across upcoming days',
          duration: TOAST_DURATION_SHORT_MS,
        });
      }
      
      const maxHours = aiSettings.maxHoursPerDay ?? 5;
      if (result.exceedsLimit.length > 0) {
        toast.warning(
          `${result.exceedsLimit.length} task${result.exceedsLimit.length === 1 ? '' : 's'} need${result.exceedsLimit.length === 1 ? 's' : ''} manual scheduling`,
          {
            description: `These tasks exceed the ${maxHours}-hour daily limit. Please schedule them manually.`,
            duration: TOAST_DURATION_DEFAULT_MS,
          }
        );
      }
      
      if (result.scheduled.length === 0 && result.exceedsLimit.length > 0) {
        toast.info('No tasks could be automatically scheduled', {
          description: `All tasks exceed the ${maxHours}-hour daily limit. Please schedule them manually.`,
          duration: TOAST_DURATION_LONG_MS,
        });
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      
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
    tourTriggeredRef.current = false;
    setRunTour(true);
  };

  const handleTourFinish = () => {
    setRunTour(false);
    tourTriggeredRef.current = false;
    try {
      window?.localStorage?.setItem('taskzm_tour_completed', 'true');
      const isNewSignup = window?.localStorage?.getItem('taskzm_is_new_signup') === 'true';
      
      if (isNewSignup && subscription.tier === 'free') {
        setTimeout(() => {
          setShowPricingDialog(true);
        }, TIMING_CONSTANTS.animations.long);
      }
      
      window?.localStorage?.removeItem('taskzm_is_new_signup');
    } catch (error) {
      console.warn('Local storage unavailable when finishing tour:', error);
    }
    
    window.dispatchEvent(new Event('storage'));
    
    toast.success('Tour completed!', {
      description: 'You\'re ready to start using TaskZM!'
    });
  };

  if (inviteToken) {
    return <InviteAcceptancePage token={inviteToken} />;
  }

  return (
    <>
      <div className={`h-screen h-viewport-safe min-h-viewport-safe flex ${LOADING_SCREEN_GRADIENT_CLASS} relative overflow-hidden`}>
        <AppSidebar 
          currentView={currentView} 
          onViewChange={handleViewChange}
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
          unscheduledCount={unscheduledCount}
          upcomingAndDueNowCount={upcomingAndDueNowCount}
        />
        <main className="flex-1 overflow-hidden relative flex">
          {shouldUseMobileLayout && (
          <div className="flex-1 flex flex-col min-h-0 w-full max-w-full min-w-0">
            <div 
              className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 relative min-w-0 w-full max-w-full"
              style={{
                scrollBehavior: 'smooth',
                WebkitOverflowScrolling: 'touch',
                overscrollBehaviorY: 'contain',
                minHeight: shouldUseMobileLayout
                  ? `calc(var(--viewport-height, 100vh) - ${HEADER_HEIGHT}px - ${NAV_BAR_HEIGHT}px)`
                  : 'auto',
                paddingTop: shouldUseMobileLayout
                  ? MOBILE_SCROLL_CONTAINER_PADDING_TOP
                  : undefined,
                paddingBottom: shouldUseMobileLayout
                  ? `calc(${NAV_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px) + ${NAV_BAR_SCROLL_BUFFER_REM})`
                  : undefined,
                backgroundImage: shouldUseMobileLayout
                  ? isDark
                    ? `linear-gradient(to bottom, ${KANBAN_BACKGROUND_GRADIENTS.dark.from}, ${KANBAN_BACKGROUND_GRADIENTS.dark.via}, ${KANBAN_BACKGROUND_GRADIENTS.dark.to})`
                    : `linear-gradient(to bottom, ${KANBAN_BACKGROUND_GRADIENTS.mobile.from}, ${KANBAN_BACKGROUND_GRADIENTS.mobile.to})`
                  : 'transparent',
                backgroundSize: shouldUseMobileLayout
                  ? '100% auto'
                  : 'auto',
                backgroundRepeat: 'repeat-y',
                backgroundAttachment: 'scroll',
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
              } as React.CSSProperties}
            >
              <Suspense fallback={<ViewFallback />}>
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
              </Suspense>
            </div>
          </div>
          )}

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
                className="h-full h-viewport-safe bg-background shadow-2xl border-r border-border flex-shrink-0 overflow-hidden"
                style={{ 
                  zIndex: HEADER_Z_INDEX + 1,
                  position: 'fixed',
                  left: `${SIDEBAR_WIDTH}px`,
                  top: 0,
                  minHeight: 'var(--viewport-height, 100vh)',
                }}
              >
                <div 
                  className="h-full min-h-full w-full overflow-y-auto overflow-x-auto min-w-0"
                  style={{
                    WebkitOverflowScrolling: 'touch',
                    touchAction: 'pan-y',
                    overscrollBehaviorY: 'contain',
                    minHeight: '100%',
                  } as React.CSSProperties}
                >
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

          {!shouldUseMobileLayout && (
          <div 
            className="h-full flex-1 overflow-hidden"
            style={{ paddingTop: `${HEADER_HEIGHT}px` }}
          >
            <Suspense fallback={<ViewFallback />}>
              <DashboardView 
                mobileView={mobileView}
                onMobileViewChange={setMobileView}
                aiPanelOpen={aiPanelOpen}
                onAiPanelChange={setAiPanelOpen}
                hideAgenda={true}
                panelOpen={currentView !== 'dashboard'}
                panelKey={currentView}
              />
            </Suspense>
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
      
      <AIScheduleResultDialog 
        open={showScheduleResult}
        onOpenChange={setShowScheduleResult}
        scheduledTasks={scheduledTasks}
      />

      <UpgradePrompt
        open={showUpgradePrompt}
        onOpenChange={setShowUpgradePrompt}
        onUpgrade={handleUpgradeRequest}
        feature={upgradeFeature}
      />

      <PricingDialog
        open={showPricingDialog}
        onOpenChange={setShowPricingDialog}
      />

      <AwardCelebration />

      <AppTour
        run={runTour}
        onFinish={handleTourFinish}
        onNavigate={handleTourNavigate}
        onShowPricing={() => setShowPricingDialog(true)}
      />

      <DemoAccountDisclaimer
        open={showDemoDisclaimer}
        onOpenChange={setShowDemoDisclaimer}
      />
      {loadingOverlay}
    </>
  );
}
