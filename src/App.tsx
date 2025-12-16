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
import { ThemeProvider } from './contexts/ThemeContext';
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
import { useIsMobile } from './components/ui/use-mobile';
import { PANEL_WIDTH, PANEL_WIDTH_TABLET, PANEL_WIDTH_SMALL_MONITOR, HEADER_HEIGHT, HEADER_MOBILE_SPACER_HEIGHT, HEADER_MOBILE_SAFE_AREA_SPACER, NAV_BAR_SPACER_HEIGHT, HEADER_ANIMATION_DAMPING, HEADER_ANIMATION_STIFFNESS, VIEWPORT_BREAKPOINTS, getPanelWidth } from './lib/layout-constants';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/globals.css';

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
  const { user, isLoading } = useAuth();
  useDemoActivity(); // Track demo user activity on app interactions
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const { settings: aiSettings } = useAI();
  const { hasFeature, features } = useSubscription();
  const isMobile = useIsMobile();
  
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
  const [upgradeFeature, setUpgradeFeature] = useState<'aiScheduler' | 'taskHours' | 'analytics' | 'taskRollover' | 'pomodoroTimer' | 'teamFeatures' | 'calendarSync'>('aiScheduler');
  const [runTour, setRunTour] = useState(false);
  const [showDemoDisclaimer, setShowDemoDisclaimer] = useState(false);
  const hasInitializedView = useRef(false);
  const [panelWidth, setPanelWidth] = useState(PANEL_WIDTH);
  
  // Update panel width based on viewport size
  useEffect(() => {
    const updatePanelWidth = () => {
      setPanelWidth(getPanelWidth());
    };
    
    updatePanelWidth();
    window.addEventListener('resize', updatePanelWidth);
    return () => window.removeEventListener('resize', updatePanelWidth);
  }, []);
  
  const { scheduleAllTasks, unscheduledCount, isScheduling } = useAIScheduler();
  const { tasks } = useTasks();
  const { settings: notificationSettings } = useNotifications();
  
  // Calculate count of upcoming and due now tasks for mobile badge
  const getUpcomingAndDueNowCount = () => {
    const now = new Date();
    const reminderTime = new Date(now.getTime() + notificationSettings.reminderTime * 60 * 1000);
    
    const dueSoonTasks = tasks.filter(task => {
      if (task.status === 'done') return false;
      
      let targetDate: Date | null = null;
      
      // Check dueDate first, then scheduledDate
      if (task.dueDate) {
        targetDate = new Date(task.dueDate);
      } else if (task.scheduledDate) {
        targetDate = new Date(task.scheduledDate);
      }
      
      if (!targetDate) return false;
      
      // Task is due soon if it's between now and reminder time
      return targetDate >= now && targetDate <= reminderTime;
    });
    
    return dueSoonTasks.length;
  };
  
  const upcomingAndDueNowCount = getUpcomingAndDueNowCount();
  
  // Check for award achievements when tasks are completed
  useAwardChecker();

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
    const checkMobile = isMobile || (typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.mobile);
    
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
            }, 500); // Short delay after disclaimer is closed
            
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
                }, 500);
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
            }, 500); // Check every 500ms
            
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
          }, 1500); // 1.5 second delay to let the UI settle
          
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



  if (isLoading) {
    return (
      <div className="fixed inset-0 h-screen w-screen flex items-center justify-center bg-gradient-to-br from-[#E6D5F0] via-[#C9E4F7] to-[#B8E6D5] dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 z-50">
        <div className="text-center px-4">
          <div className="relative mx-auto mb-4">
            <div className="animate-spin rounded-full h-12 w-12 md:h-16 md:w-16 border-4 border-[#E6D5F0] border-t-primary mx-auto"></div>
            <div className="absolute inset-0 rounded-full h-12 w-12 md:h-16 md:w-16 border-4 border-[#C9E4F7] border-t-accent mx-auto animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          </div>
          <p className="text-foreground mt-4 text-sm md:text-base font-medium">Loading TaskZM...</p>
          <div className="flex gap-1 justify-center mt-3">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-[#B8E6D5] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
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
      if (view === 'dashboard' && isMobile) {
        setMobileView('week');
      }
    }
    setSidebarOpen(false); // Close mobile sidebar on view change
  };

  const handleClosePanel = () => {
    setCurrentView('dashboard');
    // On mobile, when closing a panel, default to week view
    if (isMobile) {
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
        toast.error('AI Scheduler limit reached', {
          description: `You've used ${features.aiSchedulerLimit}/${features.aiSchedulerLimit} AI suggestions this week. Upgrade to Pro for unlimited AI scheduling.`,
          action: {
            label: 'Upgrade',
            onClick: () => {
              setShowPricingDialog(true);
            },
          },
        });
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
      <div className="h-screen flex bg-gradient-to-br from-[#EFE9FA] via-[#EAE4F6] to-[#E3DCF1] md:from-[#FAF9FC] md:via-[#F9F7FD] md:to-[#F3F0F9] dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <AppSidebar 
          currentView={currentView} 
          onViewChange={handleViewChange}
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
          unscheduledCount={unscheduledCount}
        />
        <main className="flex-1 overflow-hidden relative flex">
          {/* Mobile/Tablet: Show different views - Full height container with proper bottom spacing */}
          <div className="lg:hidden h-full flex-1 flex flex-col">
            <div 
              className="flex-1 overflow-y-auto overflow-x-hidden min-h-0"
              style={{
                paddingTop: `calc(${HEADER_MOBILE_SPACER_HEIGHT}px + env(safe-area-inset-top, 0px))`
              }}
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
              {/* Bottom nav spacer - inside scrollable container to prevent content from hiding behind nav bar */}
              <div 
                className="flex-shrink-0" 
                style={{ height: `calc(${NAV_BAR_SPACER_HEIGHT}px + env(safe-area-inset-bottom, 0px))` }}
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Desktop: Slide-out Panels with Push Effect */}
          <AnimatePresence mode="wait">
            {(currentView === 'notifications' || currentView === 'today' || currentView === 'inbox' || currentView === 'team' || currentView === 'folders' || currentView === 'analytics' || currentView === 'archive' || currentView === 'settings') && (
              <motion.div
                key={currentView}
                initial={{ width: 0, opacity: 0 }}
                animate={{ 
                  width: panelWidth,
                  opacity: 1 
                }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="hidden md:block h-full bg-background shadow-2xl border-r border-border flex-shrink-0 overflow-hidden"
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

          {/* Desktop: Dashboard - pushed to the right when panel is open */}
          <motion.div 
            className={`hidden md:block h-full flex-1 overflow-hidden`}
            style={{ paddingTop: `${HEADER_HEIGHT}px` }}
            layout
            initial={false}
            transition={{ type: 'spring', damping: HEADER_ANIMATION_DAMPING, stiffness: HEADER_ANIMATION_STIFFNESS }}
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
          </motion.div>
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
              <AwardProvider>
                <TeamProvider>
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
                </TeamProvider>
              </AwardProvider>
            </TaskProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
