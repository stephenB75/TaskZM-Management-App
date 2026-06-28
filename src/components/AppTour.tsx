/**
 * App Tour Component
 * Guided walkthrough focused on navigation, Week/Month views, AI scheduling, and settings.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Joyride, { CallBackProps, STATUS, Step, EVENTS } from 'react-joyride';
import { useTheme } from '../contexts/ThemeContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAuth } from '../contexts/AuthContext';
import { SUBSCRIPTION_UI_TEXT, DEFAULT_MONTHLY_PRICE } from '../lib/subscription-constants';
import { getOfferings, configureRevenueCat } from '../lib/revenuecat';
import { Z_INDEX, TOUR_CONSTANTS } from '../lib/layout-constants';
import { TIMING_CONSTANTS } from '../lib/timing-constants';
import { NOTIFICATION_STORAGE_KEYS } from '../lib/notification-constants';
import { useMobileLayout } from '../hooks/useMobileLayout';
import {
  APP_TOUR_UI,
  APP_TOUR_TARGETS,
  APP_TOUR_STEP_KEYS,
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

function TourIconDescriptions({
  items,
}: {
  items: readonly { label: string; description: string }[];
}) {
  return (
    <ul className="text-xs text-muted-foreground space-y-1.5 mt-2 ml-1">
      {items.map((item) => (
        <li key={item.label}>
          <span className="font-medium text-foreground">{item.label}</span>
          {' — '}
          {item.description}
        </li>
      ))}
    </ul>
  );
}

function renderStepContent(stepKey: AppTourStepMeta['stepKey'], isMobile: boolean): React.ReactNode {
  switch (stepKey) {
    case APP_TOUR_STEP_KEYS.welcome:
      return (
        <div>
          <h3 className="text-lg font-semibold mb-2">{APP_TOUR_UI.welcome.title}</h3>
          <p className="text-sm text-muted-foreground">{APP_TOUR_UI.welcome.description}</p>
        </div>
      );
    case APP_TOUR_STEP_KEYS.navigation:
      return (
        <div>
          <h3 className="text-lg font-semibold mb-2">{APP_TOUR_UI.navigation.title}</h3>
          <p className="text-sm text-muted-foreground mb-1">
            {isMobile ? APP_TOUR_UI.navigation.mobileIntro : APP_TOUR_UI.navigation.desktopIntro}
          </p>
          <TourIconDescriptions
            items={isMobile ? APP_TOUR_UI.navigation.mobileTabs : APP_TOUR_UI.navigation.desktopIcons}
          />
        </div>
      );
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
    case APP_TOUR_STEP_KEYS.switchToMonth:
      return (
        <div>
          <h3 className="text-lg font-semibold mb-2">{APP_TOUR_UI.switchToMonth.title}</h3>
          <p className="text-sm text-muted-foreground">{APP_TOUR_UI.switchToMonth.description}</p>
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
    case APP_TOUR_STEP_KEYS.switchToWeek:
      return (
        <div>
          <h3 className="text-lg font-semibold mb-2">{APP_TOUR_UI.switchToWeek.title}</h3>
          <p className="text-sm text-muted-foreground">{APP_TOUR_UI.switchToWeek.description}</p>
        </div>
      );
    case APP_TOUR_STEP_KEYS.aiScheduler:
      return (
        <div>
          <h3 className="text-lg font-semibold mb-2">{APP_TOUR_UI.aiScheduler.title}</h3>
          <p className="text-sm text-muted-foreground mb-1">{APP_TOUR_UI.aiScheduler.description}</p>
          <TourBullets items={APP_TOUR_UI.aiScheduler.bullets} />
          {isMobile && (
            <p className="text-xs text-muted-foreground mt-2">{APP_TOUR_UI.aiScheduler.mobileNote}</p>
          )}
        </div>
      );
    case APP_TOUR_STEP_KEYS.aiSchedulePreview:
      return (
        <div>
          <h3 className="text-lg font-semibold mb-2">{APP_TOUR_UI.aiSchedulePreview.title}</h3>
          <p className="text-sm text-muted-foreground mb-1">{APP_TOUR_UI.aiSchedulePreview.description}</p>
          <p className="text-xs text-muted-foreground">{APP_TOUR_UI.aiSchedulePreview.hint}</p>
        </div>
      );
    case APP_TOUR_STEP_KEYS.closeSchedulePreview:
      return (
        <div>
          <h3 className="text-lg font-semibold mb-2">{APP_TOUR_UI.closeSchedulePreview.title}</h3>
          <p className="text-sm text-muted-foreground">{APP_TOUR_UI.closeSchedulePreview.description}</p>
        </div>
      );
    case APP_TOUR_STEP_KEYS.aiRescheduler:
      return (
        <div>
          <h3 className="text-lg font-semibold mb-2">{APP_TOUR_UI.aiRescheduler.title}</h3>
          <p className="text-sm text-muted-foreground mb-1">{APP_TOUR_UI.aiRescheduler.description}</p>
          <TourBullets items={APP_TOUR_UI.aiRescheduler.bullets} />
          {isMobile && (
            <p className="text-xs text-muted-foreground mt-2">{APP_TOUR_UI.aiRescheduler.mobileNote}</p>
          )}
        </div>
      );
    case APP_TOUR_STEP_KEYS.rescheduleDialog:
      return (
        <div>
          <h3 className="text-lg font-semibold mb-2">{APP_TOUR_UI.rescheduleDialog.title}</h3>
          <p className="text-sm text-muted-foreground mb-1">{APP_TOUR_UI.rescheduleDialog.description}</p>
          <p className="text-xs text-muted-foreground">{APP_TOUR_UI.rescheduleDialog.hint}</p>
        </div>
      );
    case APP_TOUR_STEP_KEYS.openSettings:
      return (
        <div>
          <h3 className="text-lg font-semibold mb-2">{APP_TOUR_UI.openSettings.title}</h3>
          <p className="text-sm text-muted-foreground">{APP_TOUR_UI.openSettings.description}</p>
        </div>
      );
    case APP_TOUR_STEP_KEYS.settingsPanel:
      return (
        <div>
          <h3 className="text-lg font-semibold mb-2">{APP_TOUR_UI.settingsPanel.title}</h3>
          <p className="text-sm text-muted-foreground mb-2">{APP_TOUR_UI.settingsPanel.intro}</p>
          <ul className="text-xs text-muted-foreground space-y-1.5">
            {APP_TOUR_UI.settingsPanel.sections.map((section) => (
              <li key={section.title}>
                <span className="font-medium capitalize">{section.title}</span>
                {' — '}
                {section.detail}
              </li>
            ))}
          </ul>
        </div>
      );
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

const TOUR_STEP_DEFS: AppTourStepMeta[] = [
  { stepKey: APP_TOUR_STEP_KEYS.welcome, target: APP_TOUR_TARGETS.body, placement: 'center', disableBeacon: true },
  { stepKey: APP_TOUR_STEP_KEYS.navigation, target: APP_TOUR_TARGETS.sidebar, placement: 'right', desktopOnly: true },
  { stepKey: APP_TOUR_STEP_KEYS.navigation, target: APP_TOUR_TARGETS.bottomNav, placement: 'top', mobileOnly: true },
  { stepKey: APP_TOUR_STEP_KEYS.weekMonthToggle, target: APP_TOUR_TARGETS.weekMonthToggle, placement: 'bottom', desktopOnly: true },
  { stepKey: APP_TOUR_STEP_KEYS.weekView, target: APP_TOUR_TARGETS.kanbanBoard, placement: 'bottom', desktopOnly: true },
  { stepKey: APP_TOUR_STEP_KEYS.weekView, target: APP_TOUR_TARGETS.kanbanMobile, placement: 'top', mobileOnly: true },
  { stepKey: APP_TOUR_STEP_KEYS.switchToMonth, target: APP_TOUR_TARGETS.body, placement: 'center', disableBeacon: true },
  { stepKey: APP_TOUR_STEP_KEYS.monthView, target: APP_TOUR_TARGETS.monthCalendar, placement: 'bottom' },
  { stepKey: APP_TOUR_STEP_KEYS.switchToWeek, target: APP_TOUR_TARGETS.body, placement: 'center', disableBeacon: true },
  { stepKey: APP_TOUR_STEP_KEYS.aiScheduler, target: APP_TOUR_TARGETS.aiScheduler, placement: 'bottom', desktopOnly: true },
  { stepKey: APP_TOUR_STEP_KEYS.aiScheduler, target: APP_TOUR_TARGETS.aiRecommendationsPanel, placement: 'left', mobileOnly: true },
  { stepKey: APP_TOUR_STEP_KEYS.aiSchedulePreview, target: APP_TOUR_TARGETS.aiSchedulePreview, placement: 'left' },
  { stepKey: APP_TOUR_STEP_KEYS.closeSchedulePreview, target: APP_TOUR_TARGETS.body, placement: 'center', disableBeacon: true },
  { stepKey: APP_TOUR_STEP_KEYS.aiRescheduler, target: APP_TOUR_TARGETS.aiReschedule, placement: 'bottom', desktopOnly: true },
  { stepKey: APP_TOUR_STEP_KEYS.aiRescheduler, target: APP_TOUR_TARGETS.aiRecommendationsPanel, placement: 'left', mobileOnly: true },
  { stepKey: APP_TOUR_STEP_KEYS.rescheduleDialog, target: APP_TOUR_TARGETS.rescheduleDialog, placement: 'left' },
  { stepKey: APP_TOUR_STEP_KEYS.openSettings, target: APP_TOUR_TARGETS.body, placement: 'center', disableBeacon: true },
  { stepKey: APP_TOUR_STEP_KEYS.settingsPanel, target: APP_TOUR_TARGETS.settingsPanel, placement: 'left' },
  { stepKey: APP_TOUR_STEP_KEYS.complete, target: APP_TOUR_TARGETS.body, placement: 'center', disableBeacon: true },
];

const DASHBOARD_TARGETS = new Set<string>([
  APP_TOUR_TARGETS.weekMonthToggle,
  APP_TOUR_TARGETS.kanbanBoard,
  APP_TOUR_TARGETS.kanbanMobile,
  APP_TOUR_TARGETS.monthCalendar,
  APP_TOUR_TARGETS.aiScheduler,
  APP_TOUR_TARGETS.aiSchedulePreview,
  APP_TOUR_TARGETS.aiReschedule,
  APP_TOUR_TARGETS.rescheduleDialog,
  APP_TOUR_TARGETS.aiSchedulerSection,
  APP_TOUR_TARGETS.aiRescheduleSection,
  APP_TOUR_TARGETS.aiRecommendationsPanel,
]);

function dispatchTourViewMode(mode: 'week' | 'month') {
  window.dispatchEvent(
    new CustomEvent('tour-set-view-mode', { detail: { mode } }),
  );
}

function dispatchTourOpenPanel(panel: string) {
  window.dispatchEvent(new CustomEvent('tour-open-panel', { detail: { panel } }));
}

function dispatchTourClosePanel() {
  window.dispatchEvent(new CustomEvent('tour-close-panel'));
}

function dispatchTourOpenAiDialog(dialog: 'schedule-preview' | 'reschedule-day') {
  window.dispatchEvent(
    new CustomEvent('tour-open-ai-dialog', { detail: { dialog } }),
  );
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

export function AppTour({ run, onFinish, onNavigate, onShowPricing }: AppTourProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const shouldUseMobileLayout = useMobileLayout();
  const [, setMonthlyPrice] = useState<string>(DEFAULT_MONTHLY_PRICE);

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

  const steps = useMemo((): Step[] => {
    const placementFor = (p?: AppTourStepMeta['placement']): TourPlacement => {
      if (!p) return shouldUseMobileLayout ? 'top' : 'right';
      if (p === 'center') return 'center';
      return shouldUseMobileLayout && (p === 'right' || p === 'left') ? 'top' : p;
    };

    return TOUR_STEP_DEFS.filter((def) => {
      if (def.desktopOnly && shouldUseMobileLayout) return false;
      if (def.mobileOnly && !shouldUseMobileLayout) return false;
      return true;
    }).map((def) => ({
      target: def.target,
      placement: placementFor(def.placement),
      disableBeacon: def.disableBeacon ?? false,
      content: renderStepContent(def.stepKey, shouldUseMobileLayout),
      data: { stepKey: def.stepKey },
    }));
  }, [shouldUseMobileLayout]);

  const getStepKey = useCallback(
    (index: number) => {
      const step = steps[index];
      return (step?.data as { stepKey?: AppTourStepMeta['stepKey'] } | undefined)?.stepKey;
    },
    [steps],
  );

  const prepareStep = useCallback(
    (index: number) => {
      const step = steps[index];
      if (!step) return;

      const target = step.target as string;
      const stepKey = getStepKey(index);

      if (DASHBOARD_TARGETS.has(target)) {
        onNavigate?.(TOUR_CONSTANTS.viewModes.dashboard);
      }

      if (stepKey === APP_TOUR_STEP_KEYS.monthView) {
        dispatchTourViewMode(TOUR_CONSTANTS.viewModes.month);
      }

      if (stepKey === APP_TOUR_STEP_KEYS.weekView) {
        dispatchTourViewMode(TOUR_CONSTANTS.viewModes.week);
      }

      if (stepKey === APP_TOUR_STEP_KEYS.aiScheduler && shouldUseMobileLayout) {
        dispatchTourOpenPanel(TOUR_CONSTANTS.panels.ai);
      }

      if (stepKey === APP_TOUR_STEP_KEYS.aiSchedulePreview) {
        if (shouldUseMobileLayout) {
          dispatchTourOpenPanel(TOUR_CONSTANTS.panels.ai);
          window.setTimeout(() => {
            dispatchTourOpenAiDialog('schedule-preview');
          }, TIMING_CONSTANTS.tour.navigationComplete);
        } else {
          dispatchTourOpenDashboardSchedulePreview();
        }
      }

      if (stepKey === APP_TOUR_STEP_KEYS.aiRescheduler && shouldUseMobileLayout) {
        dispatchTourOpenPanel(TOUR_CONSTANTS.panels.ai);
      }

      if (stepKey === APP_TOUR_STEP_KEYS.rescheduleDialog) {
        if (shouldUseMobileLayout) {
          dispatchTourOpenPanel(TOUR_CONSTANTS.panels.ai);
          window.setTimeout(() => {
            dispatchTourOpenAiDialog('reschedule-day');
          }, TIMING_CONSTANTS.tour.navigationComplete);
        } else {
          dispatchTourOpenDashboardRescheduleDialog();
        }
      }

      if (stepKey === APP_TOUR_STEP_KEYS.settingsPanel) {
        onNavigate?.('settings');
      }
    },
    [getStepKey, onNavigate, shouldUseMobileLayout, steps],
  );

  const handleJoyrideCallback = useCallback(
    (data: CallBackProps) => {
      const { status, type, index } = data;
      const stepKey = getStepKey(index);

      if (type === EVENTS.STEP_BEFORE) {
        prepareStep(index);
      }

      if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
        if (stepKey === APP_TOUR_STEP_KEYS.switchToMonth) {
          window.setTimeout(() => {
            dispatchTourViewMode(TOUR_CONSTANTS.viewModes.month);
          }, TIMING_CONSTANTS.tour.navigationComplete);
        }

        if (stepKey === APP_TOUR_STEP_KEYS.switchToWeek) {
          window.setTimeout(() => {
            dispatchTourViewMode(TOUR_CONSTANTS.viewModes.week);
          }, TIMING_CONSTANTS.tour.navigationComplete);
        }

        if (stepKey === APP_TOUR_STEP_KEYS.closeSchedulePreview) {
          window.setTimeout(() => {
            if (shouldUseMobileLayout) {
              dispatchTourCloseAiDialog();
            } else {
              dispatchTourCloseDashboardDialogs();
            }
          }, TIMING_CONSTANTS.tour.navigationComplete);
        }

        if (stepKey === APP_TOUR_STEP_KEYS.openSettings) {
          window.setTimeout(() => {
            dispatchTourClosePanel();
            dispatchTourCloseAiDialog();
            dispatchTourCloseDashboardDialogs();
            onNavigate?.('settings');
          }, TIMING_CONSTANTS.tour.navigationComplete);
        }
      }

      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        try {
          localStorage.setItem(NOTIFICATION_STORAGE_KEYS.tourCompleted, 'true');
        } catch (error) {
          console.warn('Failed to save tour completion:', error);
        }

        dispatchTourClosePanel();
        dispatchTourCloseAiDialog();
        dispatchTourCloseDashboardDialogs();

        const isNewSignup =
          window?.localStorage?.getItem(NOTIFICATION_STORAGE_KEYS.newSignup) === 'true';
        if (isNewSignup && subscription.tier === 'free' && onShowPricing) {
          window.setTimeout(() => {
            onShowPricing();
          }, TIMING_CONSTANTS.tour.pricingDialogDelay);
        }

        onFinish();
      }
    },
    [getStepKey, onFinish, onNavigate, onShowPricing, prepareStep, shouldUseMobileLayout, subscription.tier],
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
      disableScrolling={false}
      scrollOffset={TOUR_CONSTANTS.scroll.offset}
      spotlightPadding={TOUR_CONSTANTS.spotlight.padding}
    />
  );
}
