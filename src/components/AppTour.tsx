/**
 * App Tour Component
 * Uses React Joyride for a reliable, feature-rich tour experience
 */

import React, { useState, useEffect, useCallback } from "react";
import Joyride, { CallBackProps, STATUS, Step, EVENTS, ACTIONS } from "react-joyride";
import { useTheme } from "../contexts/ThemeContext";
import { useSubscription } from "../contexts/SubscriptionContext";
import { useAuth } from "../contexts/AuthContext";
import { SUBSCRIPTION_UI_TEXT, DEFAULT_MONTHLY_PRICE } from "../lib/subscription-constants";
import { getOfferings } from "../lib/revenuecat";
import { configureRevenueCat } from "../lib/revenuecat";
import { Z_INDEX, TOUR_CONSTANTS, VIEWPORT_BREAKPOINTS, SETTINGS_PANEL_SPACING_MEDIUM } from "../lib/layout-constants";
import { TIMING_CONSTANTS } from "../lib/timing-constants";
import { NOTIFICATION_STORAGE_KEYS } from "../lib/notification-constants";
import { useMobileLayout } from "../hooks/useMobileLayout";

interface AppTourProps {
  run: boolean;
  onFinish: () => void;
  onNavigate?: (view: string) => void;
  onShowPricing?: () => void;
}

export function AppTour({
  run,
  onFinish,
  onNavigate,
  onShowPricing,
}: AppTourProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const shouldUseMobileLayout = useMobileLayout();
  const [monthlyPrice, setMonthlyPrice] = useState<string>(DEFAULT_MONTHLY_PRICE);
  const [steps, setSteps] = useState<Step[]>([]);

  // Fetch RevenueCat pricing when component mounts or user changes
  useEffect(() => {
    const fetchPricing = async () => {
      if (!user?.id) return;
      
      try {
        await configureRevenueCat(user.id);
        const offerings = await getOfferings();
        
        if (offerings.monthly?.priceString) {
          setMonthlyPrice(offerings.monthly.priceString);
        }
      } catch (error) {
        console.warn('Failed to fetch RevenueCat pricing for app tour:', error);
      }
    };

    fetchPricing();
  }, [user?.id]);

  // Create tour steps with dynamic pricing and responsive placement
  useEffect(() => {
    const createSteps = (): Step[] => {
      // Determine placement based on device type
      const getPlacement = (desktopPlacement: string, mobilePlacement: string = desktopPlacement): "auto" | "center" | "top" | "top-start" | "top-end" | "bottom" | "bottom-start" | "bottom-end" | "left" | "left-start" | "left-end" | "right" | "right-start" | "right-end" => {
        const placement = shouldUseMobileLayout ? mobilePlacement : desktopPlacement;
        // Type assertion for valid placement values
        return placement as "auto" | "center" | "top" | "top-start" | "top-end" | "bottom" | "bottom-start" | "bottom-end" | "left" | "left-start" | "left-end" | "right" | "right-start" | "right-end";
      };

      const baseSteps: Step[] = [
        {
          target: 'body',
          content: (
            <div>
              <h3 className="text-lg font-semibold mb-2">Welcome to TaskZM! 🎉</h3>
              <p className="text-sm text-muted-foreground">
                Your neurodivergent-friendly task management companion designed to reduce overwhelm and boost focus with calming colors and smooth animations.
              </p>
            </div>
          ),
          placement: 'center',
          disableBeacon: true,
        },
        {
          target: '[data-tour="sidebar"]',
          content: (
            <div>
              <h3 className="text-lg font-semibold mb-2">Sidebar Navigation</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Access all your tools through the icon sidebar. Click any icon to open a sliding panel with smooth animations.
              </p>
              <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1 ml-2">
                <li>Today Agenda - Timeline view</li>
                <li>Inbox - Unscheduled tasks</li>
                <li>Analytics - Track progress</li>
                <li>Settings - Customize your experience</li>
              </ul>
            </div>
          ),
          placement: getPlacement('right', 'bottom'),
        },
        {
          target: '[data-tour="today-panel"]',
          content: (
            <div>
              <h3 className="text-lg font-semibold mb-2">Today Agenda</h3>
              <p className="text-sm text-muted-foreground mb-2">
                See all your tasks for today in a timeline view. Tasks are arranged chronologically with their scheduled times.
              </p>
              <p className="text-xs text-muted-foreground">
                This panel slides in from the side. Click the X button to close it.
              </p>
            </div>
          ),
          placement: getPlacement('left', 'top'),
        },
        {
          target: 'body',
          content: (
            <div>
              <h3 className="text-lg font-semibold mb-2">Closing Today Agenda</h3>
              <p className="text-sm text-muted-foreground">
                Now let's close this panel and move to the next feature. The panel will close automatically.
              </p>
            </div>
          ),
          placement: 'center',
          disableBeacon: true,
        },
        {
          target: '[data-tour="inbox-panel"]',
          content: (
            <div>
              <h3 className="text-lg font-semibold mb-2">Inbox</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Capture all your unscheduled tasks in the Inbox. This is your brain dump area where you can quickly add tasks without worrying about scheduling.
              </p>
              <p className="text-xs text-muted-foreground">
                Later, use AI Scheduler or manually schedule them to your week.
              </p>
            </div>
          ),
          placement: getPlacement('left', 'top'),
        },
        {
          target: 'body',
          content: (
            <div>
              <h3 className="text-lg font-semibold mb-2">Closing Inbox</h3>
              <p className="text-sm text-muted-foreground">
                Great! Now let's explore the main workspace. The panel will close automatically.
              </p>
            </div>
          ),
          placement: 'center',
          disableBeacon: true,
        },
        {
          target: shouldUseMobileLayout ? '[data-tour="kanban"]' : '[data-tour="kanban-board"]',
          content: (
            <div>
              <h3 className="text-lg font-semibold mb-2">7-Day Kanban Board</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Your main workspace showing the upcoming week at a glance. Each day is color-coded with calming pastel colors for easy visual scanning.
              </p>
              <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1 ml-2">
                <li>Drag tasks between days</li>
                <li>Click + to add new tasks</li>
                <li>Use Pomodoro timer for focused work</li>
              </ul>
            </div>
          ),
          placement: getPlacement('bottom', 'top'),
        },
        {
          target: '[data-tour="calendar-month-view-toggle"]',
          content: (
            <div>
              <h3 className="text-lg font-semibold mb-2">Calendar Month View</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Switch to month view using this toggle button to see your entire month at a glance. This view shows all scheduled tasks across the month, helping you plan ahead.
              </p>
              <p className="text-xs text-muted-foreground">
                Toggle between week and month views anytime.
              </p>
            </div>
          ),
          placement: getPlacement('bottom', 'top'),
        },
        {
          target: shouldUseMobileLayout ? '[data-tour="kanban"]' : '[data-tour="kanban-board"]',
          content: (
            <div>
              <h3 className="text-lg font-semibold mb-2">Back to Week View</h3>
              <p className="text-sm text-muted-foreground">
                Let's switch back to week view to see the task cards in detail. The view will change automatically.
              </p>
            </div>
          ),
          placement: getPlacement('bottom', 'top'),
        },
        {
          target: '[data-tour="add-task"]',
          content: (
            <div>
              <h3 className="text-lg font-semibold mb-2">Task Cards</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Each task card shows priority, category, duration, and description. Click any task to edit details, add subtasks, or start a Pomodoro session.
              </p>
              <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1 ml-2">
                <li>Drag to reschedule</li>
                <li>Click to edit</li>
                <li>Start Pomodoro timer</li>
              </ul>
            </div>
          ),
          placement: getPlacement('bottom', 'top'),
        },
        {
          target: '[data-tour="ai-recommendations-panel"]',
          content: (
            <div>
              <h3 className="text-lg font-semibold mb-2">AI Recommendations Panel ✨</h3>
              <p className="text-sm text-muted-foreground mb-2">
                This panel provides powerful AI-powered scheduling tools. Let's explore the AI Smart Scheduler first.
              </p>
            </div>
          ),
          placement: getPlacement('left', 'left'),
        },
        {
          target: '[data-tour="ai-schedule-preview-dialog"]',
          content: (
            <div>
              <h3 className="text-lg font-semibold mb-2">AI Smart Scheduler ✨</h3>
              <p className="text-sm text-muted-foreground mb-2">
                This dialog shows you how AI will schedule your unscheduled tasks. The AI analyzes:
              </p>
              <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1 ml-2">
                <li>Task priority (Urgent → High → Medium → Low)</li>
                <li>Estimated duration and due dates</li>
                <li>Your working hours and availability</li>
                <li>Category-based time limits</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                Review the schedule and click "Schedule" to apply it, or "Cancel" to make changes.
              </p>
            </div>
          ),
          placement: getPlacement('left', 'left'),
        },
        {
          target: 'body',
          content: (
            <div>
              <h3 className="text-lg font-semibold mb-2">Closing Schedule Preview</h3>
              <p className="text-sm text-muted-foreground">
                Now let's see the Reschedule feature. The dialog will close automatically.
              </p>
            </div>
          ),
          placement: 'center',
          disableBeacon: true,
        },
        {
          target: '[data-tour="reschedule-dialog"]',
          content: (
            <div>
              <h3 className="text-lg font-semibold mb-2">Reschedule Tasks 🔄</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Use this dialog to reschedule tasks from a specific day, week, or month to a new date.
              </p>
              <div className="space-y-2 mt-3">
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium mb-1">Reschedule Options:</p>
                  <ul className="ml-2 list-disc list-inside space-y-0.5">
                    <li><strong>Day:</strong> Move all tasks from a specific day to a new date</li>
                    <li><strong>Week:</strong> Redistribute tasks across a new week</li>
                    <li><strong>Month:</strong> Reschedule tasks across a new month</li>
                  </ul>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Select a date using the calendar picker, then click "Reschedule" to let AI redistribute your tasks.
                </p>
              </div>
              {subscription.tier === 'free' && (
                <p className="text-xs text-primary font-medium mt-2">
                  💎 {SUBSCRIPTION_UI_TEXT.upgradePrompt.proFeature} - {SUBSCRIPTION_UI_TEXT.upgradePrompt.proFeaturePrice(monthlyPrice)}
                </p>
              )}
            </div>
          ),
          placement: getPlacement('left', 'left'),
        },
        {
          target: 'body',
          content: (
            <div>
              <h3 className="text-lg font-semibold mb-2">AI Features Complete! 🎉</h3>
              <p className="text-sm text-muted-foreground mb-2">
                You've seen how AI can help schedule and reschedule your tasks intelligently.
              </p>
              <p 
                className="text-xs text-muted-foreground border-t border-border/50 mt-3 pt-3"
                style={{ 
                  marginTop: SETTINGS_PANEL_SPACING_MEDIUM,
                  paddingTop: SETTINGS_PANEL_SPACING_MEDIUM
                }}
              >
                🎉 You've completed the tour! Click "Get Started" to begin using TaskZM.
              </p>
            </div>
          ),
          placement: 'center',
          disableBeacon: true,
        },
      ];

      return baseSteps;
    };

    setSteps(createSteps());
  }, [monthlyPrice, subscription.tier, shouldUseMobileLayout]);

  // Handle tour callbacks
  const handleJoyrideCallback = useCallback((data: CallBackProps) => {
    const { status, type, action, index } = data;

    // Handle navigation and actions based on step
    if (onNavigate && (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND)) {
      const step = steps[index];
      if (step) {
        // Handle panel opening
        if (step.target === '[data-tour="today-panel"]') {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('tour-open-panel', { 
              detail: { panel: TOUR_CONSTANTS.panels.today } 
            }));
          }, TIMING_CONSTANTS.tour.navigationComplete);
        } else if (step.target === '[data-tour="inbox-panel"]') {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('tour-open-panel', { 
              detail: { panel: TOUR_CONSTANTS.panels.inbox } 
            }));
          }, TIMING_CONSTANTS.tour.navigationComplete);
        }

        // Handle panel closing (after showing panel content)
        // Close Today Agenda panel after step 2 (index 2, before step 3)
        if (step.target === 'body' && index === TOUR_CONSTANTS.stepIndices.closeTodayPanel) {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('tour-close-panel'));
          }, TIMING_CONSTANTS.tour.navigationComplete);
        }
        // Close Inbox panel after step 4 (index 4, before step 5)
        else if (step.target === 'body' && index === TOUR_CONSTANTS.stepIndices.closeInboxPanel) {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('tour-close-panel'));
          }, TIMING_CONSTANTS.tour.navigationComplete);
        }

        // Navigate to dashboard for main workspace views
        if (step.target === '[data-tour="kanban"]' || 
            step.target === '[data-tour="kanban-board"]' ||
            step.target === '[data-tour="add-task"]' || 
            step.target === '[data-tour="ai-scheduler"]' ||
            step.target === '[data-tour="ai-recommendations-panel"]' ||
            step.target === '[data-tour="ai-schedule-preview-dialog"]' ||
            step.target === '[data-tour="reschedule-dialog"]' ||
            step.target === '[data-tour="calendar-month-view-toggle"]') {
          onNavigate(TOUR_CONSTANTS.viewModes.dashboard);
        }

        // Handle view mode changes
        if (step.target === '[data-tour="calendar-month-view-toggle"]') {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('tour-set-view-mode', { 
              detail: { mode: TOUR_CONSTANTS.viewModes.month } 
            }));
          }, TIMING_CONSTANTS.tour.navigationComplete);
        } else if ((step.target === '[data-tour="kanban"]' || step.target === '[data-tour="kanban-board"]') && index === TOUR_CONSTANTS.stepIndices.switchToWeekView) {
          // Switch back to week view (step 8)
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('tour-set-view-mode', { 
              detail: { mode: TOUR_CONSTANTS.viewModes.week } 
            }));
          }, TIMING_CONSTANTS.tour.navigationComplete);
        }

        // Handle AI panel opening - open before showing the step
        if (step.target === '[data-tour="ai-recommendations-panel"]') {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('tour-open-panel', { 
              detail: { panel: TOUR_CONSTANTS.panels.ai } 
            }));
          }, TIMING_CONSTANTS.tour.navigationComplete);
        }

        // Handle AI dialog opening
        if (step.target === '[data-tour="ai-schedule-preview-dialog"]') {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('tour-open-ai-dialog', { 
              detail: { dialog: 'schedule-preview' } 
            }));
          }, TIMING_CONSTANTS.tour.navigationComplete);
        }

        // Close schedule preview dialog before showing reschedule dialog
        const rescheduleDialogIndex = steps.findIndex(s => s.target === '[data-tour="reschedule-dialog"]');
        if (step.target === 'body' && rescheduleDialogIndex > 0 && index === rescheduleDialogIndex - 1) {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('tour-close-ai-dialog'));
          }, TIMING_CONSTANTS.tour.navigationComplete);
        }

        // Handle reschedule dialog opening
        if (step.target === '[data-tour="reschedule-dialog"]') {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('tour-open-ai-dialog', { 
              detail: { dialog: 'reschedule-day' } 
            }));
          }, TIMING_CONSTANTS.tour.navigationComplete);
        }

        // Close reschedule dialog after showing completion step
        const lastBodyStepIndex = steps.map((s, i) => ({ step: s, index: i }))
          .filter(({ step }) => step.target === 'body')
          .pop()?.index;
        if (step.target === 'body' && lastBodyStepIndex !== undefined && index === lastBodyStepIndex - 1) {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('tour-close-ai-dialog'));
          }, TIMING_CONSTANTS.tour.navigationComplete);
        }
      }
    }

    // Also handle step before to prepare for next step
    if (type === EVENTS.STEP_BEFORE) {
      const step = steps[index];
      if (step) {
        // Ensure we're on dashboard before showing kanban/calendar views
        // Also open AI panel and dialogs before showing the step
        if (step.target === '[data-tour="kanban"]' || 
            step.target === '[data-tour="kanban-board"]' ||
            step.target === '[data-tour="calendar-month-view-toggle"]' ||
            step.target === '[data-tour="add-task"]' ||
            step.target === '[data-tour="ai-scheduler"]' ||
            step.target === '[data-tour="ai-recommendations-panel"]' ||
            step.target === '[data-tour="ai-schedule-preview-dialog"]' ||
            step.target === '[data-tour="reschedule-dialog"]') {
          onNavigate?.(TOUR_CONSTANTS.viewModes.dashboard);
          
          // Open AI panel before showing panel step
          if (step.target === '[data-tour="ai-recommendations-panel"]') {
            window.dispatchEvent(new CustomEvent('tour-open-panel', { 
              detail: { panel: TOUR_CONSTANTS.panels.ai } 
            }));
          }
          
          // Open AI dialogs before showing dialog steps
          if (step.target === '[data-tour="ai-schedule-preview-dialog"]') {
            // Ensure panel is open first
            window.dispatchEvent(new CustomEvent('tour-open-panel', { 
              detail: { panel: TOUR_CONSTANTS.panels.ai } 
            }));
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('tour-open-ai-dialog', { 
                detail: { dialog: 'schedule-preview' } 
              }));
            }, TIMING_CONSTANTS.tour.navigationComplete * 2);
          }
          
          if (step.target === '[data-tour="reschedule-dialog"]') {
            // Ensure panel is open first
            window.dispatchEvent(new CustomEvent('tour-open-panel', { 
              detail: { panel: TOUR_CONSTANTS.panels.ai } 
            }));
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('tour-open-ai-dialog', { 
                detail: { dialog: 'reschedule-day' } 
              }));
            }, TIMING_CONSTANTS.tour.navigationComplete * 2);
          }
        }
      }
    }

    // Handle tour completion or skip
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      // Mark tour as completed
      try {
        localStorage.setItem(NOTIFICATION_STORAGE_KEYS.tourCompleted, 'true');
      } catch (error) {
        console.warn('Failed to save tour completion:', error);
      }

      // Show pricing dialog for new free users
      const isNewSignup = window?.localStorage?.getItem(NOTIFICATION_STORAGE_KEYS.newSignup) === 'true';
      if (isNewSignup && subscription.tier === 'free' && onShowPricing) {
        setTimeout(() => {
          onShowPricing();
        }, TIMING_CONSTANTS.tour.pricingDialogDelay);
      }

      onFinish();
    }
  }, [steps, onNavigate, onFinish, onShowPricing, subscription.tier]);

  // Custom styles for the tour
  const joyrideStyles = {
    options: {
      primaryColor: TOUR_CONSTANTS.colors.primary,
      textColor: isDark ? TOUR_CONSTANTS.colors.text.dark : TOUR_CONSTANTS.colors.text.light,
      backgroundColor: isDark ? TOUR_CONSTANTS.colors.background.dark : TOUR_CONSTANTS.colors.background.light,
      overlayColor: isDark ? TOUR_CONSTANTS.colors.overlay.dark : TOUR_CONSTANTS.colors.overlay.light,
      arrowColor: isDark ? TOUR_CONSTANTS.colors.arrow.dark : TOUR_CONSTANTS.colors.arrow.light,
      zIndex: Z_INDEX.APP_TOUR,
    },
    tooltip: {
      borderRadius: TOUR_CONSTANTS.tooltip.borderRadius,
      padding: TOUR_CONSTANTS.tooltip.padding,
    },
    tooltipContainer: {
      textAlign: 'left' as const,
    },
    buttonNext: {
      backgroundColor: TOUR_CONSTANTS.colors.primary,
      fontSize: TOUR_CONSTANTS.button.fontSize,
      fontWeight: TOUR_CONSTANTS.button.fontWeight,
      padding: TOUR_CONSTANTS.button.padding,
      borderRadius: TOUR_CONSTANTS.button.borderRadius,
    },
    buttonBack: {
      marginRight: TOUR_CONSTANTS.button.marginRight,
      fontSize: TOUR_CONSTANTS.button.fontSize,
      color: isDark ? TOUR_CONSTANTS.colors.text.dark : TOUR_CONSTANTS.colors.text.light,
    },
    buttonSkip: {
      fontSize: TOUR_CONSTANTS.button.fontSize,
      color: isDark ? TOUR_CONSTANTS.colors.muted.dark : TOUR_CONSTANTS.colors.muted.light,
    },
    spotlight: {
      borderRadius: TOUR_CONSTANTS.spotlight.borderRadius,
    },
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous={true}
      showProgress={true}
      showSkipButton={true}
      callback={handleJoyrideCallback}
      styles={joyrideStyles}
      disableOverlay={shouldUseMobileLayout}
      locale={{
        back: TOUR_CONSTANTS.locale.back,
        close: TOUR_CONSTANTS.locale.close,
        last: TOUR_CONSTANTS.locale.last,
        next: TOUR_CONSTANTS.locale.next,
        skip: TOUR_CONSTANTS.locale.skip,
      }}
      floaterProps={{
        disableAnimation: false,
      }}
      disableOverlayClose={true}
      disableScrolling={false}
      scrollOffset={TOUR_CONSTANTS.scroll.offset}
      spotlightPadding={TOUR_CONSTANTS.spotlight.padding}
    />
  );
}
