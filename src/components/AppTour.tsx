/**
 * App Tour Component
 * Highlights each nav icon, Week/Month toggle, AI buttons + dialogs, and settings sections.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Joyride, { ACTIONS, CallBackProps, STATUS, Step, EVENTS } from 'react-joyride';
import { useTheme } from '../contexts/ThemeContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_MONTHLY_PRICE } from '../lib/subscription-constants';
import { getOfferings, configureRevenueCat } from '../lib/revenuecat';
import { Z_INDEX, TOUR_CONSTANTS } from '../lib/layout-constants';
import { TIMING_CONSTANTS } from '../lib/timing-constants';
import { NOTIFICATION_STORAGE_KEYS } from '../lib/notification-constants';
import { useMobileLayout } from '../hooks/useMobileLayout';
import {
  APP_TOUR_UI,
  APP_TOUR_TARGETS,
  APP_TOUR_STEP_KEYS,
  buildAppTourStepDefs,
  getNavIconCopy,
  getSettingsSectionCopy,
  type AppTourStepMeta,
} from '../lib/app-tour-constants';

interface AppTourProps {
  run: boolean;
  onFinish: () => void;
  onNavigate?: (view: string) => void;
  onShowPricing?: () => void;
}

type TourPlacement = Step['placement'];

function TourBullets({ items }: { items: readonly string[] }) {
  return (
    <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1 ml-2 mt-2">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function renderStepContent(meta: AppTourStepMeta, isMobile: boolean): React.ReactNode {
  switch (meta.stepKey) {
    case APP_TOUR_STEP_KEYS.welcome:
      return (
        <div>
          <h3 className="text-lg font-semibold mb-2">{APP_TOUR_UI.welcome.title}</h3>
          <p className="text-sm text-muted-foreground">{APP_TOUR_UI.welcome.description}</p>
        </div>
      );
    case APP_TOUR_STEP_KEYS.navIntro:
      return (
        <div>
          <h3 className="text-lg font-semibold mb-2">
            {isMobile ? APP_TOUR_UI.bottomNavIntro.title : APP_TOUR_UI.sidebarIconIntro.title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isMobile ? APP_TOUR_UI.bottomNavIntro.description : APP_TOUR_UI.sidebarIconIntro.description}
          </p>
        </div>
      );
    case APP_TOUR_STEP_KEYS.navIcon: {
      const copy = meta.navId ? getNavIconCopy(meta.navId, isMobile) : null;
      if (!copy) return null;
      return (
        <div>
          <h3 className="text-lg font-semibold mb-2">{copy.label}</h3>
          <p className="text-sm text-muted-foreground">{copy.description}</p>
        </div>
      );
    }
    case APP_TOUR_STEP_KEYS.weekMonthToggle:
      return (
        <div>
          <h3 className="text-lg font-semibold mb-2">{APP_TOUR_UI.weekMonthToggle.title}</h3>
          <p className="text-sm text-muted-foreground mb-2">{APP_TOUR_UI.weekMonthToggle.description}</p>
          <p className="text-xs text-muted-foreground">{APP_TOUR_UI.weekMonthToggle.hint}</p>
        </div>
      );
    case APP_TOUR_STEP_KEYS.weekView:
      return (
        <div>
          <h3 className="text-lg font-semibold mb-2">{APP_TOUR_UI.weekView.title}</h3>
          <p className="text-sm text-muted-foreground mb-1">{APP_TOUR_UI.weekView.description}</p>
          <TourBullets items={APP_TOUR_UI.weekView.bullets} />
        </div>
      );
    case APP_TOUR_STEP_KEYS.monthView:
      return (
        <div>
          <h3 className="text-lg font-semibold mb-2">{APP_TOUR_UI.monthView.title}</h3>
          <p className="text-sm text-muted-foreground mb-1">{APP_TOUR_UI.monthView.description}</p>
          <TourBullets items={APP_TOUR_UI.monthView.bullets} />
        </div>
      );
    case APP_TOUR_STEP_KEYS.aiSchedulerButton:
      return (
        <div>
          <h3 className="text-lg font-semibold mb-2">{APP_TOUR_UI.aiSchedulerButton.title}</h3>
          <p className="text-sm text-muted-foreground mb-1">{APP_TOUR_UI.aiSchedulerButton.description}</p>
          <p className="text-xs text-primary font-medium">{APP_TOUR_UI.aiSchedulerButton.hint}</p>
        </div>
      );
    case APP_TOUR_STEP_KEYS.aiSchedulePreview:
      return (
        <div>
          <h3 className="text-lg font-semibold mb-2">{APP_TOUR_UI.aiSchedulePreview.title}</h3>
          <p className="text-sm text-muted-foreground mb-1">{APP_TOUR_UI.aiSchedulePreview.description}</p>
          <TourBullets items={APP_TOUR_UI.aiSchedulePreview.bullets} />
        </div>
      );
    case APP_TOUR_STEP_KEYS.aiReschedulerButton:
      return (
        <div>
          <h3 className="text-lg font-semibold mb-2">{APP_TOUR_UI.aiReschedulerButton.title}</h3>
          <p className="text-sm text-muted-foreground mb-1">{APP_TOUR_UI.aiReschedulerButton.description}</p>
          <p className="text-xs text-primary font-medium">{APP_TOUR_UI.aiReschedulerButton.hint}</p>
        </div>
      );
    case APP_TOUR_STEP_KEYS.rescheduleDialog:
      return (
        <div>
          <h3 className="text-lg font-semibold mb-2">{APP_TOUR_UI.rescheduleDialog.title}</h3>
          <p className="text-sm text-muted-foreground mb-1">{APP_TOUR_UI.rescheduleDialog.description}</p>
          <TourBullets items={APP_TOUR_UI.rescheduleDialog.bullets} />
        </div>
      );
    case APP_TOUR_STEP_KEYS.settingsIntro:
      return (
        <div>
          <h3 className="text-lg font-semibold mb-2">{APP_TOUR_UI.settingsIntro.title}</h3>
          <p className="text-sm text-muted-foreground">{APP_TOUR_UI.settingsIntro.description}</p>
        </div>
      );
    case APP_TOUR_STEP_KEYS.settingsSection: {
      const section = meta.settingsId ? getSettingsSectionCopy(meta.settingsId) : null;
      if (!section) return null;
      return (
        <div>
          <h3 className="text-lg font-semibold mb-2">{section.title}</h3>
          <p className="text-sm text-muted-foreground mb-1">{section.description}</p>
          <p className="text-xs text-muted-foreground">{section.detail}</p>
        </div>
      );
    }
    case APP_TOUR_STEP_KEYS.complete:
      return (
        <div>
          <h3 className="text-lg font-semibold mb-2">{APP_TOUR_UI.complete.title}</h3>
          <p className="text-sm text-muted-foreground">{APP_TOUR_UI.complete.description}</p>
        </div>
      );
    default:
      return null;
  }
}

const DASHBOARD_TARGETS = new Set<string>([
  APP_TOUR_TARGETS.weekMonthToggle,
  APP_TOUR_TARGETS.kanbanBoard,
  APP_TOUR_TARGETS.kanbanMobile,
  APP_TOUR_TARGETS.monthCalendar,
  APP_TOUR_TARGETS.aiScheduler,
  APP_TOUR_TARGETS.aiSchedulePreview,
  APP_TOUR_TARGETS.aiReschedule,
  APP_TOUR_TARGETS.rescheduleDialog,
  APP_TOUR_TARGETS.rescheduleDialogOptions,
  APP_TOUR_TARGETS.aiSchedulerSection,
  APP_TOUR_TARGETS.aiRescheduleSection,
]);

function dispatchTourViewMode(mode: 'week' | 'month') {
  window.dispatchEvent(new CustomEvent('tour-set-view-mode', { detail: { mode } }));
}

function dispatchTourOpenPanel(panel: string) {
  window.dispatchEvent(new CustomEvent('tour-open-panel', { detail: { panel } }));
}

function dispatchTourClosePanel() {
  window.dispatchEvent(new CustomEvent('tour-close-panel'));
}

function dispatchTourOpenAiDialog(dialog: 'schedule-preview' | 'reschedule-day') {
  window.dispatchEvent(new CustomEvent('tour-open-ai-dialog', { detail: { dialog } }));
}

function dispatchTourCloseAiDialog() {
  window.dispatchEvent(new CustomEvent('tour-close-ai-dialog'));
}

function dispatchTourOpenDashboardSchedulePreview() {
  window.dispatchEvent(new CustomEvent('tour-open-schedule-preview'));
}

function dispatchTourOpenDashboardRescheduleDialog() {
  window.dispatchEvent(new CustomEvent('tour-open-reschedule-dialog'));
}

function dispatchTourCloseDashboardDialogs() {
  window.dispatchEvent(new CustomEvent('tour-close-dashboard-dialogs'));
}

function closeAllTourDialogs(isMobile: boolean) {
  dispatchTourCloseAiDialog();
  dispatchTourCloseDashboardDialogs();
  if (isMobile) {
    dispatchTourClosePanel();
  }
}

function scrollTourTargetIntoView(target: string) {
  window.setTimeout(() => {
    const el = document.querySelector(target);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }, TIMING_CONSTANTS.tour.highlightDelay);
}

function isTourTargetReady(target: string): boolean {
  if (target === APP_TOUR_TARGETS.body) return true;
  const el = document.querySelector(target);
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 4 && rect.height > 4 && rect.bottom > 0 && rect.right > 0;
}

function waitForTourTarget(
  target: string,
  onReady: () => void,
  timeoutMs: number = TIMING_CONSTANTS.tour.highlightDelay * 4,
): void {
  const started = performance.now();
  const tick = () => {
    if (isTourTargetReady(target) || performance.now() - started >= timeoutMs) {
      onReady();
      return;
    }
    window.requestAnimationFrame(tick);
  };
  tick();
}

function prepareFixedHeaderTourTarget(target: string) {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  waitForTourTarget(target, () => {
    const el = document.querySelector(target);
    el?.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' });
  });
}

function advanceDelayForStep(nextMeta: AppTourStepMeta | undefined): number {
  if (!nextMeta) return 0;
  if (nextMeta.isFixed) {
    return TIMING_CONSTANTS.tour.highlightDelay + TIMING_CONSTANTS.tour.navigationComplete;
  }
  if (stepNeedsNavigationLeadTime(nextMeta)) {
    return TIMING_CONSTANTS.tour.highlightDelay;
  }
  return 0;
}

function stepNeedsNavigationLeadTime(meta: AppTourStepMeta | undefined): boolean {
  if (!meta) return false;
  return (
    DASHBOARD_TARGETS.has(meta.target)
    || meta.stepKey === APP_TOUR_STEP_KEYS.settingsIntro
    || meta.stepKey === APP_TOUR_STEP_KEYS.settingsSection
  );
}

export function AppTour({ run, onFinish, onNavigate, onShowPricing }: AppTourProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const shouldUseMobileLayout = useMobileLayout();
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const targetRetryTimeoutRef = useRef<number | null>(null);
  const advanceTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (run) {
      setTourStepIndex(0);
    }
  }, [run]);

  useEffect(() => {
    return () => {
      if (targetRetryTimeoutRef.current !== null) {
        window.clearTimeout(targetRetryTimeoutRef.current);
      }
      if (advanceTimeoutRef.current !== null) {
        window.clearTimeout(advanceTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const fetchPricing = async () => {
      if (!user?.id) return;
      try {
        await configureRevenueCat(user.id);
        await getOfferings();
      } catch (error) {
        console.warn('Failed to fetch RevenueCat pricing for app tour:', error);
      }
    };
    fetchPricing();
  }, [user?.id]);

  const stepDefs = useMemo(
    () => buildAppTourStepDefs(shouldUseMobileLayout),
    [shouldUseMobileLayout],
  );

  const steps = useMemo((): Step[] => {
    const placementFor = (p?: AppTourStepMeta['placement']): TourPlacement => {
      if (!p) return shouldUseMobileLayout ? 'top' : 'right';
      if (p === 'center') return 'center';
      return shouldUseMobileLayout && (p === 'right' || p === 'left' || p === 'bottom-end') ? 'top' : p;
    };

    return stepDefs.map((meta) => ({
      target: meta.target,
      placement: placementFor(meta.placement),
      disableBeacon: meta.disableBeacon ?? false,
      content: renderStepContent(meta, shouldUseMobileLayout),
      data: meta,
      disableScrolling: meta.isFixed ?? false,
      disableScrollParentFix: meta.isFixed ?? false,
      isFixed: meta.isFixed ?? false,
      offset: meta.isFixed ? 8 : 0,
      floaterProps: meta.isFixed
        ? { offset: 12, options: { preventOverflow: { boundariesElement: 'viewport' } } }
        : undefined,
      spotlightPadding: meta.stepKey === APP_TOUR_STEP_KEYS.navIcon ? 6 : TOUR_CONSTANTS.spotlight.padding,
    }));
  }, [shouldUseMobileLayout, stepDefs]);

  const getStepMeta = useCallback(
    (index: number) => steps[index]?.data as AppTourStepMeta | undefined,
    [steps],
  );

  const prepareStep = useCallback(
    (index: number) => {
      const meta = getStepMeta(index);
      if (!meta) return;

      const { stepKey, target, settingsId } = meta;

      if (DASHBOARD_TARGETS.has(target)) {
        onNavigate?.(TOUR_CONSTANTS.viewModes.dashboard);
      }

      if (stepKey === APP_TOUR_STEP_KEYS.weekView) {
        dispatchTourViewMode(TOUR_CONSTANTS.viewModes.week);
        closeAllTourDialogs(shouldUseMobileLayout);
      }

      if (stepKey === APP_TOUR_STEP_KEYS.weekMonthToggle) {
        dispatchTourViewMode(TOUR_CONSTANTS.viewModes.week);
        closeAllTourDialogs(shouldUseMobileLayout);
      }

      if (stepKey === APP_TOUR_STEP_KEYS.monthView) {
        onNavigate?.(TOUR_CONSTANTS.viewModes.dashboard);
        dispatchTourViewMode(TOUR_CONSTANTS.viewModes.month);
        closeAllTourDialogs(shouldUseMobileLayout);
      }

      if (stepKey === APP_TOUR_STEP_KEYS.aiSchedulerButton) {
        onNavigate?.(TOUR_CONSTANTS.viewModes.dashboard);
        dispatchTourViewMode(TOUR_CONSTANTS.viewModes.week);
        closeAllTourDialogs(shouldUseMobileLayout);
        if (shouldUseMobileLayout) {
          dispatchTourOpenPanel(TOUR_CONSTANTS.panels.ai);
        }
      }

      if (stepKey === APP_TOUR_STEP_KEYS.aiSchedulePreview) {
        onNavigate?.(TOUR_CONSTANTS.viewModes.dashboard);
        dispatchTourViewMode(TOUR_CONSTANTS.viewModes.week);
        if (shouldUseMobileLayout) {
          dispatchTourOpenPanel(TOUR_CONSTANTS.panels.ai);
          window.setTimeout(() => {
            dispatchTourOpenAiDialog('schedule-preview');
            scrollTourTargetIntoView(APP_TOUR_TARGETS.aiSchedulePreview);
          }, TIMING_CONSTANTS.tour.navigationComplete);
        } else {
          window.setTimeout(() => {
            dispatchTourOpenDashboardSchedulePreview();
            scrollTourTargetIntoView(APP_TOUR_TARGETS.aiSchedulePreview);
          }, TIMING_CONSTANTS.tour.navigationComplete);
        }
      }

      if (stepKey === APP_TOUR_STEP_KEYS.aiReschedulerButton) {
        onNavigate?.(TOUR_CONSTANTS.viewModes.dashboard);
        if (shouldUseMobileLayout) {
          dispatchTourCloseDashboardDialogs();
          dispatchTourCloseAiDialog();
          dispatchTourOpenPanel(TOUR_CONSTANTS.panels.ai);
        } else {
          dispatchTourCloseDashboardDialogs();
          dispatchTourCloseAiDialog();
        }
      }

      if (stepKey === APP_TOUR_STEP_KEYS.rescheduleDialog) {
        onNavigate?.(TOUR_CONSTANTS.viewModes.dashboard);
        if (shouldUseMobileLayout) {
          dispatchTourOpenPanel(TOUR_CONSTANTS.panels.ai);
          window.setTimeout(() => {
            dispatchTourOpenAiDialog('reschedule-day');
            scrollTourTargetIntoView(APP_TOUR_TARGETS.rescheduleDialog);
          }, TIMING_CONSTANTS.tour.navigationComplete);
        } else {
          window.setTimeout(() => {
            dispatchTourOpenDashboardRescheduleDialog();
            scrollTourTargetIntoView(APP_TOUR_TARGETS.rescheduleDialogOptions);
          }, TIMING_CONSTANTS.tour.navigationComplete);
        }
      }

      if (stepKey === APP_TOUR_STEP_KEYS.settingsIntro || stepKey === APP_TOUR_STEP_KEYS.settingsSection) {
        closeAllTourDialogs(shouldUseMobileLayout);
        dispatchTourViewMode(TOUR_CONSTANTS.viewModes.week);
        onNavigate?.('settings');
        if (settingsId) {
          scrollTourTargetIntoView(meta.target);
        }
      }

      if (stepKey === APP_TOUR_STEP_KEYS.navIcon) {
        scrollTourTargetIntoView(meta.target);
      }

      if (
        stepKey === APP_TOUR_STEP_KEYS.aiSchedulerButton
        || stepKey === APP_TOUR_STEP_KEYS.aiReschedulerButton
        || stepKey === APP_TOUR_STEP_KEYS.weekMonthToggle
      ) {
        prepareFixedHeaderTourTarget(meta.target);
      }
    },
    [getStepMeta, onNavigate, shouldUseMobileLayout],
  );

  const handleJoyrideCallback = useCallback(
    (data: CallBackProps) => {
      const { action, status, type, index } = data;
      const meta = getStepMeta(index);

      if (type === EVENTS.STEP_BEFORE) {
        prepareStep(index);
      }

      if (type === EVENTS.TARGET_NOT_FOUND && meta) {
        prepareStep(index);
        if (targetRetryTimeoutRef.current !== null) {
          window.clearTimeout(targetRetryTimeoutRef.current);
        }
        const retry = () => {
          targetRetryTimeoutRef.current = null;
          if (meta.isFixed) {
            prepareFixedHeaderTourTarget(meta.target);
          }
          waitForTourTarget(meta.target, () => setTourStepIndex(index));
        };
        targetRetryTimeoutRef.current = window.setTimeout(
          retry,
          meta.isFixed
            ? TIMING_CONSTANTS.tour.highlightDelay + TIMING_CONSTANTS.tour.navigationComplete
            : TIMING_CONSTANTS.tour.highlightDelay,
        );
        return;
      }

      if (type === EVENTS.STEP_AFTER) {
        if (meta?.stepKey === APP_TOUR_STEP_KEYS.weekMonthToggle) {
          window.setTimeout(() => {
            dispatchTourViewMode(TOUR_CONSTANTS.viewModes.month);
          }, TIMING_CONSTANTS.tour.navigationComplete);
        }

        if (meta?.stepKey === APP_TOUR_STEP_KEYS.monthView) {
          window.setTimeout(() => {
            dispatchTourViewMode(TOUR_CONSTANTS.viewModes.week);
          }, TIMING_CONSTANTS.tour.navigationComplete);
        }

        const nextMeta = getStepMeta(index + 1);
        if (nextMeta && stepNeedsNavigationLeadTime(nextMeta)) {
          prepareStep(index + 1);
        }

        if (action === ACTIONS.NEXT || action === ACTIONS.SKIP) {
          const nextIndex = index + 1;
          if (nextIndex >= steps.length) {
            finishTour();
            return;
          }

          const scheduleAdvance = () => {
            if (advanceTimeoutRef.current !== null) {
              window.clearTimeout(advanceTimeoutRef.current);
            }
            const delay = advanceDelayForStep(nextMeta);
            advanceTimeoutRef.current = window.setTimeout(() => {
              advanceTimeoutRef.current = null;
              if (nextMeta?.isFixed) {
                prepareFixedHeaderTourTarget(nextMeta.target);
                waitForTourTarget(nextMeta.target, () => setTourStepIndex(nextIndex));
              } else {
                setTourStepIndex(nextIndex);
              }
            }, delay);
          };

          scheduleAdvance();
          return;
        }

        if (action === ACTIONS.PREV) {
          setTourStepIndex(Math.max(0, index - 1));
          return;
        }
      }

      if (action === ACTIONS.CLOSE || status === STATUS.SKIPPED) {
        finishTour();
        return;
      }

      if (status === STATUS.FINISHED) {
        finishTour();
      }

      function finishTour() {
        try {
          localStorage.setItem(NOTIFICATION_STORAGE_KEYS.tourCompleted, 'true');
        } catch (error) {
          console.warn('Failed to save tour completion:', error);
        }

        closeAllTourDialogs(shouldUseMobileLayout);

        const isNewSignup =
          window?.localStorage?.getItem(NOTIFICATION_STORAGE_KEYS.newSignup) === 'true';
        if (isNewSignup && subscription.tier === 'free' && onShowPricing) {
          window.setTimeout(() => {
            onShowPricing();
          }, TIMING_CONSTANTS.tour.pricingDialogDelay);
        }

        setTourStepIndex(0);
        onFinish();
      }
    },
    [getStepMeta, onFinish, onShowPricing, prepareStep, shouldUseMobileLayout, steps.length, subscription.tier],
  );

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
      stepIndex={tourStepIndex}
      continuous
      showProgress
      showSkipButton
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
      disableOverlayClose
      disableScrollParentFix
      disableScrolling={false}
      scrollToFirstStep={false}
      scrollOffset={TOUR_CONSTANTS.scroll.offset}
      spotlightPadding={TOUR_CONSTANTS.spotlight.padding}
    />
  );
}
