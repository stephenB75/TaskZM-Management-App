import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { lazyWithRetry } from './lib/lazy-with-retry';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from './lib/toast-wrapper';
import { TOAST_DURATION_MEDIUM_MS } from './lib/layout-constants';
import { useAuth } from './contexts/AuthContext';
import { useSubscription } from './contexts/SubscriptionContext';
import { useTasks } from './contexts/TaskContext';
import { useLoading } from './contexts/LoadingContext';
import { useTheme } from './contexts/ThemeContext';
import { useSidebar } from './contexts/SidebarContext';
import { useNotifications } from './contexts/NotificationContext';
import { InviteAcceptancePage } from './components/InviteAcceptancePage';
import { AwardCelebration } from './components/AwardCelebration';
import { AppHeader } from './components/AppHeader';
import { AppSidebar } from './components/AppSidebar';
import { AppTour } from './components/AppTour';
import { BottomNav } from './components/BottomNav';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './components/ui/sheet';
import { PlannerDesktop } from './components/planner/PlannerDesktop';
import { PlannerTimeline } from './components/planner/PlannerTimeline';
import { PlannerCalendar } from './components/planner/PlannerCalendar';
import { PlannerChat } from './components/planner/PlannerChat';
import { PlannerChatProvider } from './contexts/PlannerChatContext';
import { TaskDialog } from './components/TaskDialog';
import { NativePullToRefresh } from './components/NativePullToRefresh';
import { AIScheduleResultDialog } from './components/AIScheduleResultDialog';
import { PricingDialog } from './components/PricingDialog';
import { UpgradePrompt } from './components/UpgradePrompt';
import { ErrorBoundary } from './components/ErrorBoundary';

const InboxView = lazyWithRetry(() => import('./components/InboxView').then(m => ({ default: m.InboxView })));
const ArchiveView = lazyWithRetry(() => import('./components/ArchiveView').then(m => ({ default: m.ArchiveView })));
const SettingsPanel = lazyWithRetry(() => import('./components/SettingsPanel').then(m => ({ default: m.SettingsPanel })));
const AnalyticsPanel = lazyWithRetry(() => import('./components/AnalyticsPanel').then(m => ({ default: m.AnalyticsPanel })));
const TeamPanel = lazyWithRetry(() => import('./components/TeamPanel').then(m => ({ default: m.TeamPanel })));
const FoldersPanel = lazyWithRetry(() => import('./components/FoldersPanel').then(m => ({ default: m.FoldersPanel })));
const NotificationsPanel = lazyWithRetry(() => import('./components/NotificationsPanel').then(m => ({ default: m.NotificationsPanel })));
const AIRecommendationPanel = lazyWithRetry(() => import('./components/AIRecommendationPanel').then(m => ({ default: m.AIRecommendationPanel })));
import { useAIScheduler, type SchedulePlan } from './hooks/useAIScheduler';
import { useAwardChecker } from './hooks/useAwardChecker';
import { useDemoActivity } from './hooks/useDemoActivity';
import { useMobileLayout } from './hooks/useMobileLayout';
import { TIMING_CONSTANTS } from './lib/timing-constants';
import { NOTIFICATION_OPEN_TASK_EVENT, NOTIFICATIONS_SHEET_OPEN_EVENT } from './lib/notification-constants';
import { AI_PANEL_UI_TEXT, NAVIGATION_UI_TEXT, PLANNER_COMPOSER_FOCUS_EVENT } from './lib/navigation-constants';
import { clearCalendarEventsCache } from './lib/calendar-events-cache';
import { MOBILE_DEEP_LINK_PATHS } from './lib/mobile-constants';
import { getTodayAgendaBadgeCount } from './lib/notification-task-filters';
import { PANEL_WIDTH, PANEL_WIDTH_TABLET, PANEL_WIDTH_SMALL_MONITOR, SIDEBAR_WIDTH, HEADER_LOGO_HEIGHT, NAV_BAR_SCROLL_PADDING_MOBILE, HEADER_ANIMATION_DAMPING, HEADER_ANIMATION_STIFFNESS, VIEWPORT_BREAKPOINTS, getPanelWidth, MOBILE_SCROLL_CONTAINER_PADDING_TOP, MOBILE_SCROLL_CONTAINER_MIN_HEIGHT, SPLASH_SCREEN_TEXT, REACT_LOADING_SCREEN, APP_TEXT_FALLBACK_COLOR, HEADER_Z_INDEX, LOADING_SCREEN_GRADIENT_CLASS, APP_CANVAS_CLASS, DESKTOP_SIDE_PANEL_SPRING_ENTER, DESKTOP_SIDE_PANEL_EXIT_SECONDS, DESKTOP_SIDE_PANEL_EXIT_EASE, DESKTOP_SIDE_PANEL_CONTENT_FADE_SECONDS } from './lib/layout-constants';
import logoImageBlack from './assets/Taskzm_Logo_BLK-removebg.png';
import logoImageGray from './assets/taskzm-logo-gray.png';

function ViewFallback() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[120px]" aria-hidden>
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const DESKTOP_SIDE_PANEL_VIEWS = new Set([
  'notifications',
  'inbox',
  'team',
  'folders',
  'analytics',
  'archive',
  'settings',
]);

function isDesktopSidePanelView(view: string): boolean {
  return DESKTOP_SIDE_PANEL_VIEWS.has(view);
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
  const { hasFeature, subscription } = useSubscription();
  const { syncWithServer, workspaceId, tasks } = useTasks();
  const shouldUseMobileLayout = useMobileLayout(); // Use mobile layout for tablets in portrait/landscape
  const shouldUseMobileLayoutRef = useRef(shouldUseMobileLayout);
  shouldUseMobileLayoutRef.current = shouldUseMobileLayout;
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  
  // Initialize view: use same breakpoint as useMobileLayout (tablet) so mobile/tablet see tasks immediately
  const getInitialView = () => {
    if (typeof window !== 'undefined') {
      return 'today';
    }
    return 'dashboard';
  };
  
  const [currentView, setCurrentView] = useState(getInitialView);
  const [mobileView, setMobileView] = useState<'today' | 'week'>('today');
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [notificationsSheetOpen, setNotificationsSheetOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [notificationTaskId, setNotificationTaskId] = useState<string | null>(null);
  const notificationTask = notificationTaskId ? tasks.find((task) => task.id === notificationTaskId) ?? null : null;
  const [scrollHomeWeek, setScrollHomeWeek] = useState(false);
  const [showScheduleResult, setShowScheduleResult] = useState(false);
  const [scheduledTasks, setScheduledTasks] = useState<SchedulePlan[]>([]);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [showPricingDialog, setShowPricingDialog] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<'aiScheduler' | 'taskHours' | 'analytics' | 'taskRollover' | 'pomodoroTimer' | 'teamFeatures' | 'calendarSync' | 'recurringTasks' | 'taskDependencies' | 'taskTemplates'>('aiScheduler');
  const [runTour, setRunTour] = useState(false);
  const hasInitializedView = useRef(false);
  const [panelWidth, setPanelWidth] = useState(PANEL_WIDTH);
  const dashboardViewModeRef = useRef<'week' | 'month'>('week');
  const [desktopCalendarMode, setDesktopCalendarMode] = useState<'week' | 'month'>('week');
  const mobileScrollRef = useRef<HTMLDivElement>(null);

  const handleMobilePullRefresh = useCallback(async () => {
    clearCalendarEventsCache();
    await syncWithServer();
  }, [syncWithServer]);

  const pullToRefreshEnabled =
    shouldUseMobileLayout &&
    (currentView === 'today' || (currentView === 'dashboard' && mobileView === 'week'));
  const isPlannerTab = currentView === 'today' || currentView === 'dashboard' || currentView === 'ai';
  
  // When mobile layout is shown and user is authenticated, trigger a sync so mobile gets latest tasks from server
  const mobileSyncDoneRef = useRef(false);
  useEffect(() => {
    if (!shouldUseMobileLayout) {
      mobileSyncDoneRef.current = false;
      return;
    }
    if (!user || !workspaceId) return;
    if (mobileSyncDoneRef.current) return;
    mobileSyncDoneRef.current = true;
    syncWithServer().catch(() => {});
  }, [shouldUseMobileLayout, user, workspaceId, syncWithServer]);

  // Update panel width based on viewport size
  useEffect(() => {
    const updatePanelWidth = () => {
      setPanelWidth(getPanelWidth());
    };
    
    updatePanelWidth();
    window.addEventListener('resize', updatePanelWidth);
    return () => window.removeEventListener('resize', updatePanelWidth);
  }, []);

  // Open task or notifications panel when user taps a notification / deep link
  useEffect(() => {
    const handleOpenTaskFromNotification = (event: CustomEvent<{ taskId?: string }>) => {
      const taskId = event.detail?.taskId;
      if (taskId) {
        setCurrentView('today');
        setMobileView('today');
        setAiPanelOpen(false);
        setNotificationsSheetOpen(false);
        setNotificationTaskId(taskId);
        return;
      }
      setAiPanelOpen(false);
      if (shouldUseMobileLayoutRef.current) {
        setNotificationsSheetOpen(true);
        return;
      }
      setCurrentView('notifications');
    };

    window.addEventListener(NOTIFICATION_OPEN_TASK_EVENT, handleOpenTaskFromNotification as EventListener);
    return () => {
      window.removeEventListener(NOTIFICATION_OPEN_TASK_EVENT, handleOpenTaskFromNotification as EventListener);
    };
  }, []);

  // Handle /task/:id URLs opened in the web app (Universal Links fallback in browser)
  useEffect(() => {
    const path = window.location.pathname.replace(/^\//, '');
    if (!path.startsWith(`${MOBILE_DEEP_LINK_PATHS.task}/`)) return;

    const taskId = decodeURIComponent(path.split('/')[1] ?? '');
    if (!taskId) return;

    window.dispatchEvent(
      new CustomEvent(NOTIFICATION_OPEN_TASK_EVENT, { detail: { taskId } }),
    );
    window.history.replaceState({}, '', '/');
  }, []);

  // Handle tour events for view mode changes and panel opening
  useEffect(() => {
    const handleTourSetViewMode = (event: CustomEvent<{ mode: 'week' | 'month' }>) => {
      dashboardViewModeRef.current = event.detail.mode;
      if (shouldUseMobileLayout) {
        setCurrentView('dashboard');
        setMobileView('week');
      } else {
        setDesktopCalendarMode(event.detail.mode);
      }
      window.dispatchEvent(new CustomEvent('dashboard-set-view-mode', { 
        detail: { mode: event.detail.mode } 
      }));
    };

    const handleTourOpenPanel = (event: CustomEvent<{ panel: string }>) => {
      const panel = event.detail.panel;
      if (panel === 'ai') {
        setCurrentView('dashboard');
        setAiPanelOpen(true);
      } else if (panel === 'analytics') {
        setCurrentView('analytics');
      } else if (panel === 'today') {
        setCurrentView('today');
      } else if (panel === 'inbox') {
        setCurrentView('inbox');
      } else if (panel === 'settings') {
        setCurrentView('settings');
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
  
  const { unscheduledCount } = useAIScheduler();
  const { settings: notificationSettings } = useNotifications();

  const upcomingAndDueNowCount = getTodayAgendaBadgeCount(tasks);
  
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
        console.log('%c✨ TaskZM v1.0.1 - Baseline Reset ✨', 'font-size: 16px; font-weight: bold; color: #171717;');
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

  const tourTriggeredRef = React.useRef(false);

  useEffect(() => {
    if (!user || isLoading) return;
    
    if (tourTriggeredRef.current) return;
    
    try {
      const tourCompleted = window?.localStorage?.getItem('taskzm_tour_completed');
      const isNewSignup = window?.localStorage?.getItem('taskzm_is_new_signup') === 'true';
      
      if (isNewSignup && !tourCompleted) {
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
        setCurrentView('today');
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
              borderTopColor: 'var(--primary, #171717)',
              borderRightColor: 'var(--border)',
              borderBottomColor: 'var(--border)',
              borderLeftColor: 'var(--border)',
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
              borderRightColor: 'var(--border)',
              borderBottomColor: 'var(--border)',
              borderLeftColor: 'var(--border)',
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
    if (view === 'notifications' && shouldUseMobileLayout) {
      setSidebarOpen(false);
      setNotificationsSheetOpen(true);
      return;
    }

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
    
    if (view === 'dashboard') {
      if (shouldUseMobileLayout) {
        setCurrentView('dashboard');
        setMobileView('week');
        setSidebarOpen(false);
        return;
      }
      setCurrentView('today');
      setDesktopCalendarMode('month');
      setSidebarOpen(false);
      return;
    }

    if (view === 'today' && !shouldUseMobileLayout) {
      setCurrentView('today');
      setDesktopCalendarMode('week');
      setSidebarOpen(false);
      return;
    }

    if (currentView === view && view !== 'today') {
      setCurrentView('today');
      if (shouldUseMobileLayout) {
        setMobileView('today');
      }
    } else {
      setCurrentView(view);
      if (view === 'dashboard' && shouldUseMobileLayout) {
        setMobileView('week');
      }
    }
    setSidebarOpen(false);
  };

  const handleClosePanel = () => {
    setCurrentView('today');
    if (shouldUseMobileLayout) {
      setMobileView('today');
    }
  };

  const handleUpgradeRequest = () => {
    setShowUpgradePrompt(false);
    setShowPricingDialog(true);
  };

  const handleTourNavigate = (view: string) => {
    flushSync(() => {
      setCurrentView(view);
      if (shouldUseMobileLayout && view === 'dashboard') {
        setMobileView('week');
      }
    });
  };

  const handleTourStart = () => {
    tourTriggeredRef.current = false;

    const needsPanelClose = currentView !== 'dashboard' || aiPanelOpen;

    if (needsPanelClose) {
      flushSync(() => {
        setCurrentView('dashboard');
        if (shouldUseMobileLayout) {
          setMobileView('week');
        }
        setAiPanelOpen(false);
        setSidebarOpen(false);
      });

      const panelCloseMs = shouldUseMobileLayout
        ? TIMING_CONSTANTS.tour.navigationComplete
        : Math.round(DESKTOP_SIDE_PANEL_EXIT_SECONDS * 1000) + TIMING_CONSTANTS.tour.navigationComplete;

      window.setTimeout(() => {
        setRunTour(true);
      }, panelCloseMs);
      return;
    }

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

  const handleBottomNavInteraction = () => {
    if (runTour) return;
    setRunTour(false);
  };

  const handleMobileWeekPress = () => {
    setCurrentView('dashboard');
    setMobileView('week');
    setSidebarOpen(false);
  };

  useEffect(() => {
    if (!scrollHomeWeek) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('home-week')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setScrollHomeWeek(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [scrollHomeWeek, currentView]);

  useEffect(() => {
    const openAi = () => {
      if (shouldUseMobileLayoutRef.current) {
        setCurrentView('ai');
        return;
      }
      window.dispatchEvent(new CustomEvent(PLANNER_COMPOSER_FOCUS_EVENT));
    };
    const openCreate = () => setCreateTaskOpen(true);
    const openNotifications = () => setNotificationsSheetOpen(true);
    window.addEventListener('taskzm-open-ai', openAi);
    window.addEventListener('taskzm-add-task', openCreate);
    window.addEventListener(NOTIFICATIONS_SHEET_OPEN_EVENT, openNotifications);
    return () => {
      window.removeEventListener('taskzm-open-ai', openAi);
      window.removeEventListener('taskzm-add-task', openCreate);
      window.removeEventListener(NOTIFICATIONS_SHEET_OPEN_EVENT, openNotifications);
    };
  }, []);

  if (inviteToken) {
    return <InviteAcceptancePage token={inviteToken} />;
  }

  return (
    <PlannerChatProvider>
      <div className={`h-screen h-viewport-safe min-h-viewport-safe flex ${APP_CANVAS_CLASS} relative overflow-hidden`}>
        {shouldUseMobileLayout && isPlannerTab && (
          <AppHeader
            title={
              <img
                src={isDark ? logoImageGray : logoImageBlack}
                alt="TaskZM"
                className="object-contain"
                style={{ height: HEADER_LOGO_HEIGHT, width: 'auto' }}
              />
            }
            panelOpen={!shouldUseMobileLayout && isDesktopSidePanelView(currentView)}
          />
        )}
        <AppSidebar 
          currentView={currentView} 
          calendarMode={desktopCalendarMode}
          onViewChange={handleViewChange}
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
          unscheduledCount={unscheduledCount}
          upcomingAndDueNowCount={upcomingAndDueNowCount}
        />
        <main className="flex-1 overflow-hidden relative flex">
          {shouldUseMobileLayout && (
          <div className="flex-1 flex flex-col min-h-0 w-full max-w-full min-w-0">
            <NativePullToRefresh
              scrollRef={mobileScrollRef}
              enabled={pullToRefreshEnabled}
              onRefresh={handleMobilePullRefresh}
            >
            <div
              ref={mobileScrollRef}
              className={`taskzm-mobile-scroll flex-1 min-h-0 relative min-w-0 w-full max-w-full ${
                isPlannerTab ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'
              }`}
              style={{
                scrollBehavior: 'smooth',
                WebkitOverflowScrolling: 'touch',
                overscrollBehaviorY: 'contain',
                minHeight: shouldUseMobileLayout
                  ? MOBILE_SCROLL_CONTAINER_MIN_HEIGHT
                  : 'auto',
                paddingTop: shouldUseMobileLayout
                  ? MOBILE_SCROLL_CONTAINER_PADDING_TOP
                  : undefined,
                paddingBottom: shouldUseMobileLayout ? NAV_BAR_SCROLL_PADDING_MOBILE : undefined,
                background: 'transparent',
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
              } as React.CSSProperties}
            >
              <Suspense fallback={<ViewFallback />}>
                {currentView === 'today' && (
                  <PlannerTimeline onPlanWithAi={() => setCurrentView('ai')} />
                )}
                {currentView === 'dashboard' && <PlannerCalendar />}
                {currentView === 'ai' && <PlannerChat />}
                {currentView === 'notifications' && <NotificationsPanel />}
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
            </NativePullToRefresh>
          </div>
          )}

          <AnimatePresence initial={false}>
            {!shouldUseMobileLayout && isDesktopSidePanelView(currentView) && (
              <motion.div
                key="desktop-side-panel-shell"
                initial={{ x: -panelWidth }}
                animate={{
                  x: 0,
                  transition: DESKTOP_SIDE_PANEL_SPRING_ENTER,
                }}
                exit={{
                  x: -panelWidth,
                  transition: {
                    duration: DESKTOP_SIDE_PANEL_EXIT_SECONDS,
                    ease: DESKTOP_SIDE_PANEL_EXIT_EASE,
                  },
                }}
                className="h-full h-viewport-safe bg-background shadow-2xl border-r border-border flex-shrink-0 overflow-hidden"
                style={{
                  zIndex: HEADER_Z_INDEX + 1,
                  position: 'fixed',
                  left: `${SIDEBAR_WIDTH}px`,
                  top: 0,
                  width: panelWidth,
                  minHeight: 'var(--viewport-height, 100vh)',
                }}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={currentView}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: DESKTOP_SIDE_PANEL_CONTENT_FADE_SECONDS }}
                    className="h-full min-h-full w-full overflow-y-auto overflow-x-auto min-w-0"
                    style={{
                      WebkitOverflowScrolling: 'touch',
                      touchAction: 'pan-y',
                      overscrollBehaviorY: 'contain',
                      minHeight: '100%',
                    } as React.CSSProperties}
                  >
                    <Suspense fallback={<ViewFallback />}>
                      {currentView === 'notifications' && <NotificationsPanel />}
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
                        <SettingsPanel onStartTour={handleTourStart} />
                      )}
                    </Suspense>
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {!shouldUseMobileLayout && (
          <div className="h-full flex-1 overflow-hidden">
            <PlannerDesktop mode={desktopCalendarMode} />
          </div>
          )}
        </main>
        <BottomNav 
          currentView={currentView}
          onViewChange={handleViewChange}
          mobileView={mobileView}
          onMobileViewChange={setMobileView}
          onNavInteraction={handleBottomNavInteraction}
          onWeekPress={handleMobileWeekPress}
          tourActive={runTour}
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

      <TaskDialog open={createTaskOpen} onClose={() => setCreateTaskOpen(false)} />
      <TaskDialog open={Boolean(notificationTask)} task={notificationTask} onClose={() => setNotificationTaskId(null)} />

      <Sheet open={aiPanelOpen} onOpenChange={setAiPanelOpen}>
        <SheetContent
          side={shouldUseMobileLayout ? 'bottom' : 'right'}
          className={shouldUseMobileLayout ? 'taskzm-ai-sheet overflow-y-auto bg-background' : 'w-full overflow-y-auto bg-background sm:max-w-md'}
        >
          <SheetHeader className="p-0 pr-10">
            <SheetTitle>{NAVIGATION_UI_TEXT.ai}</SheetTitle>
            <SheetDescription>{AI_PANEL_UI_TEXT.sheetDescription}</SheetDescription>
          </SheetHeader>
          <Suspense fallback={null}>
            <AIRecommendationPanel onClose={() => setAiPanelOpen(false)} />
          </Suspense>
        </SheetContent>
      </Sheet>

      {shouldUseMobileLayout && (
        <Sheet open={notificationsSheetOpen} onOpenChange={setNotificationsSheetOpen}>
          <SheetContent side="bottom" className="taskzm-ai-sheet overflow-y-auto bg-background">
            <SheetHeader className="p-0 pr-10">
              <SheetTitle>{NAVIGATION_UI_TEXT.notifications}</SheetTitle>
              <SheetDescription className="sr-only">{NAVIGATION_UI_TEXT.notifications}</SheetDescription>
            </SheetHeader>
            <Suspense fallback={<ViewFallback />}>
              <NotificationsPanel embedded />
            </Suspense>
          </SheetContent>
        </Sheet>
      )}

      {loadingOverlay}
    </PlannerChatProvider>
  );
}
