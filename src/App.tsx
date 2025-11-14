import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { Button } from './components/ui/button';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SubscriptionProvider, useSubscription } from './contexts/SubscriptionContext';
import { TaskProvider } from './contexts/TaskContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SidebarProvider, useSidebar } from './contexts/SidebarContext';
import { AIProvider, useAI } from './contexts/AIContext';
import { CalendarProvider } from './contexts/CalendarContext';
import { DragDropProvider } from './contexts/DragDropContext';
import { PomodoroProvider } from './contexts/PomodoroContext';
import { TeamProvider } from './contexts/TeamContext';
import { AwardProvider } from './contexts/AwardContext';
import { NotificationProvider } from './contexts/NotificationContext';
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
import { DocumentHead } from './components/DocumentHead';
import { useAIScheduler, type SchedulePlan } from './hooks/useAIScheduler';
import { useAwardChecker } from './hooks/useAwardChecker';
import { useDemoActivity } from './hooks/useDemoActivity';
import { configureRevenueCat, resetRevenueCat } from './lib/revenuecat';
import { getPlatform } from './lib/platform';
import { cn } from './lib/utils';
import { useIsMobile } from './components/ui/use-mobile';
import { PANEL_WIDTH, HEADER_HEIGHT } from './lib/layout-constants';
import './styles/globals.css';

function AppContent() {
  const { user, isLoading } = useAuth();
  useDemoActivity(); // Track demo user activity on app interactions
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const { settings: aiSettings } = useAI();
  const { hasFeature } = useSubscription();
  const isMobile = useIsMobile();
  
  // Initialize view: 'today' on mobile, 'dashboard' on desktop
  const getInitialView = () => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 ? 'today' : 'dashboard';
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
  const hasInitializedView = useRef(false);
  
  const { scheduleAllTasks, unscheduledCount, isScheduling } = useAIScheduler();
  
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
        console.log('  • Mode: Development (simulated payments)');
        console.log('  • To enable real payments: npm install @revenuecat/purchases-js');
        console.log('  • Guide: /PAYMENT_SETUP_QUICK_FIX.md');
        window?.sessionStorage?.setItem('taskzm_session_info_shown', 'true');
      }
    } catch (error) {
      console.warn('Session storage unavailable, skipping session info message:', error);
    }
  }, []);

  // Initialize RevenueCat when user logs in
  useEffect(() => {
    if (user?.id) {
      const platform = getPlatform();
      
      configureRevenueCat(user.id).catch(error => {
        // RevenueCat configuration failed - this is expected if not set up yet
        // App will gracefully fall back to legacy payment flow
        // Silently handle errors to prevent console noise
        if (error?.message && !error.message.includes('checkoutUrls')) {
          console.debug('RevenueCat configuration skipped:', error.message);
        }
      });
    } else {
      // Reset RevenueCat when user logs out
      resetRevenueCat();
    }
  }, [user?.id]);

  // Set default view to 'today' on mobile when app loads/refreshes
  useEffect(() => {
    // Only run once on initial mount to set default view for mobile
    if (hasInitializedView.current) return;
    
    // Check if we're on mobile (either via hook or window width)
    const checkMobile = isMobile || (typeof window !== 'undefined' && window.innerWidth < 768);
    
    // Only set to 'today' on mobile if currently on 'dashboard'
    // This ensures mobile always starts with 'today' view on refresh/reopen
    if (checkMobile && currentView === 'dashboard') {
      setCurrentView('today');
    }
    
    hasInitializedView.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once on mount

  // Auto-start tour only for new signups (not existing users)
  useEffect(() => {
    if (!user || isLoading) return;
    
    try {
      const tourCompleted = window?.localStorage?.getItem('taskzm_tour_completed');
      const isNewSignup = window?.localStorage?.getItem('taskzm_is_new_signup') === 'true';
      
      // Only auto-start tour for new signups who haven't completed the tour
      if (isNewSignup && !tourCompleted) {
        const timer = setTimeout(() => {
          setRunTour(true);
          // Clear the new signup flag so it doesn't trigger again
          try {
            window?.localStorage?.removeItem('taskzm_is_new_signup');
          } catch (removeError) {
            console.warn('Unable to clear new signup flag:', removeError);
          }
          toast.info('👋 Welcome! Let us show you around TaskZM', {
            description: 'Take a quick tour to learn the basics',
            duration: 4000
          });
        }, 1500); // 1.5 second delay to let the UI settle
        
        return () => clearTimeout(timer);
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
    }
    setSidebarOpen(false); // Close mobile sidebar on view change
  };

  const handleClosePanel = () => {
    setCurrentView('dashboard');
  };

  const handleAISchedule = async () => {
    // Check if user has access to AI Scheduler feature
    if (!hasFeature('aiScheduler')) {
      setUpgradeFeature('aiScheduler');
      setShowUpgradePrompt(true);
      return;
    }

    // Check if AI scheduling is enabled
    if (!aiSettings.autoSchedulingEnabled || !aiSettings.scheduleUnscheduledTasks) {
      toast.error('AI Scheduling is disabled', {
        description: 'Enable AI scheduling in Settings to use this feature.',
        duration: 4000,
      });
      return;
    }

    // Check if there are unscheduled tasks
    if (unscheduledCount === 0) {
      toast.info('No tasks to schedule', {
        description: 'All your tasks are already scheduled!',
        duration: 3000,
      });
      return;
    }

    // Show loading toast
    const loadingToast = toast.loading('AI is scheduling your tasks...', {
      description: `Organizing ${unscheduledCount} task${unscheduledCount === 1 ? '' : 's'}`,
    });

    try {
      // Schedule all tasks
      const result = await scheduleAllTasks();
      
      // Dismiss loading toast
      toast.dismiss(loadingToast);
      
      if (result.scheduled.length > 0) {
        // Store scheduled tasks and show result dialog
        setScheduledTasks(result.scheduled);
        setShowScheduleResult(true);
        
        // Show success toast
        toast.success(`Scheduled ${result.scheduled.length} task${result.scheduled.length === 1 ? '' : 's'}!`, {
          description: 'Tasks distributed across upcoming days',
          duration: 3000,
        });
      }
      
      // Show warning if tasks exceed the 5-hour limit
      if (result.exceedsLimit.length > 0) {
        toast.warning(
          `${result.exceedsLimit.length} task${result.exceedsLimit.length === 1 ? '' : 's'} need${result.exceedsLimit.length === 1 ? 's' : ''} manual scheduling`,
          {
            description: `These tasks exceed the 5-hour daily limit. Please schedule them manually.`,
            duration: 6000,
          }
        );
      }
      
      // If no tasks were scheduled but some exceed limit
      if (result.scheduled.length === 0 && result.exceedsLimit.length > 0) {
        toast.info('No tasks could be automatically scheduled', {
          description: `All tasks exceed the 5-hour daily limit. Please schedule them manually.`,
          duration: 5000,
        });
      }
    } catch (error) {
      // Dismiss loading toast
      toast.dismiss(loadingToast);
      
      // Show error toast
      toast.error('Scheduling failed', {
        description: 'Something went wrong. Please try again.',
        duration: 4000,
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

  const handleTourFinish = () => {
    setRunTour(false);
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
          {/* Mobile: Show different views - Full height container with proper bottom spacing */}
          <div className="lg:hidden h-full flex-1 flex flex-col">
            <div className="flex-1 overflow-hidden">
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
              {currentView === 'analytics' && <AnalyticsPanel onClose={handleClosePanel} />}
              {currentView === 'archive' && <ArchiveView />}
              {currentView === 'settings' && (
                <SettingsPanel 
                  onStartTour={() => setRunTour(true)}
                />
              )}
            </div>
            {/* Bottom nav spacer - ensures content doesn't hide behind bottom nav */}
            {/* Reduced to h-7 (28px) to minimize space above nav bar */}
            <div className="h-7 flex-shrink-0" />
          </div>

          {/* Desktop: Slide-out Panels with Push Effect */}
          <AnimatePresence mode="wait">
            {(currentView === 'notifications' || currentView === 'today' || currentView === 'inbox' || currentView === 'team' || currentView === 'folders' || currentView === 'analytics' || currentView === 'archive' || currentView === 'settings') && (
              <motion.div
                key={currentView}
                initial={{ width: 0, opacity: 0 }}
                animate={{ 
                  width: PANEL_WIDTH,
                  opacity: 1 
                }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="hidden lg:block h-full bg-background shadow-2xl border-r border-border flex-shrink-0 overflow-hidden"
              >
                {/* Panel Content */}
                <div className="h-full w-full overflow-hidden">
                  {currentView === 'notifications' && <NotificationsPanel />}
                  {currentView === 'today' && <TodayAgendaView />}
                  {currentView === 'inbox' && <InboxView />}
                  {currentView === 'team' && <TeamPanel />}
                  {currentView === 'folders' && <FoldersPanel />}
                  {currentView === 'analytics' && <AnalyticsPanel onClose={handleClosePanel} />}
                  {currentView === 'archive' && <ArchiveView />}
                  {currentView === 'settings' && (
                    <SettingsPanel 
                      onStartTour={() => setRunTour(true)}
                    />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Desktop: Dashboard - pushed to the right when panel is open */}
          <motion.div 
            className={`hidden lg:block h-full flex-1 overflow-hidden`}
            style={{ paddingTop: `${HEADER_HEIGHT}px` }}
            layout
            initial={false}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
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
    </>
  );
}

export default function App() {
  return (
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
  );
}
