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
  getTourStepAdvanceDelayMs,
  getTourStepWaitTimeoutMs,
  isAppTourDialogStep,
  isAppTourSettingsSectionStep,
  isAppTourSettingsStep,
  queryVisibleTourTarget,
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
  APP_TOUR_TARGETS.aiSchedulePreviewMobile,
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

function dispatchTourActiveChanged(active: boolean) {
  window.dispatchEvent(new CustomEvent('tour-active-changed', { detail: { active } }));
}

function dispatchTourExpandSettingsSection(sectionId: string) {
  window.dispatchEvent(new CustomEvent('tour-expand-settings-section', { detail: { sectionId } }));
}

function scrollTourTargetIntoView(target: string) {
  window.setTimeout(() => {
    const el = queryVisibleTourTarget(target);
    if (!el || el.getAttribute('data-slot') === 'dialog-content') return;
    const behavior: ScrollBehavior = target.includes('settings-') ? 'instant' : 'smooth';
    el.scrollIntoView({ behavior, block: 'nearest', inline: 'nearest' });
  }, TIMING_CONSTANTS.tour.navigationComplete);
}
function closeTourDashboardDialogs() {
  dispatchTourCloseAiDialog();
  dispatchTourCloseDashboardDialogs();
}

function closeAllTourDialogs(isMobile: boolean) {
  closeTourDashboardDialogs();
  if (isMobile) {
    dispatchTourClosePanel();
  }
}

function isTourTargetReady(target: string): boolean {
  if (target === APP_TOUR_TARGETS.body) return true;
  return queryVisibleTourTarget(target) !== null;
}

function preloadSettingsPanelForTour() {
  void import('./SettingsPanel');
}

function waitForTourTarget(
  target: string,
  onReady: () => void,
  timeoutMs: number = getTourStepWaitTimeoutMs(undefined),
  onTimeout?: () => void,
): void {
  const started = performance.now();
  const tick = () => {
    if (isTourTargetReady(target)) {
      onReady();
      return;
    }
    if (performance.now() - started >= timeoutMs) {
      onTimeout?.();
      return;
    }
    window.requestAnimationFrame(tick);
  };
  tick();
}

function waitForTourTargetWithRetry(
  target: string,
  onReady: () => void,
  meta: AppTourStepMeta | undefined,
): void {
  const timeoutMs = getTourStepWaitTimeoutMs(meta);
  waitForTourTarget(target, onReady, timeoutMs, () => {
    waitForTourTarget(target, onReady, timeoutMs, onReady);
  });
}

function prepareFixedHeaderTourTarget(target: string) {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  const waitMs = TIMING_CONSTANTS.tour.highlightDelay * TIMING_CONSTANTS.tour.targetWait.viewSwitchMultiplier;
  waitForTourTarget(target, () => {
    const el = queryVisibleTourTarget(target);
    el?.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' });
  }, waitMs);
}

function stepNeedsNavigationLeadTime(meta: AppTourStepMeta | undefined): boolean {
  if (!meta) return false;
  if (isAppTourSettingsSectionStep(meta)) return false;
  return (
    DASHBOARD_TARGETS.has(meta.target)
    || meta.stepKey === APP_TOUR_STEP_KEYS.settingsIntro
  );
}

/** Popper options so every step keeps the tooltip (and Next button) inside the viewport. */
function buildTourFloaterProps() {
  return {
    offset: TOUR_CONSTANTS.floater.offset,
    disableFlip: false,
    options: {
      flip: {
        enabled: true,
        padding: TOUR_CONSTANTS.floater.viewportPadding,
      },
      preventOverflow: {
        boundariesElement: 'viewport' as const,
        padding: TOUR_CONSTANTS.floater.viewportPadding,
      },
    },
  };
}

function resolveTourPlacement(
  placement: AppTourStepMeta['placement'] | undefined,
  isMobile: boolean,
): TourPlacement {
  if (!placement) return isMobile ? 'top' : 'right';
  if (placement === 'center') return 'center';
  if (placement === 'auto') return 'auto';
  if (
    isMobile
    && (placement === 'right' || placement === 'left' || placement === 'bottom-end' || placement === 'bottom-start')
  ) {
    return 'top';
  }
  return placement;
}

export function AppTour({ run, onFinish, onNavigate, onShowPricing }: AppTourProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const shouldUseMobileLayout = useMobileLayout();
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [joyrideActive, setJoyrideActive] = useState(false);
  const targetRetryTimeoutRef = useRef<number | null>(null);
  const advanceTimeoutRef = useRef<number | null>(null);
  const preparedStepIndexRef = useRef<number | null>(null);
  const settingsPanelReadyRef = useRef(false);
  const tourFinishingRef = useRef(false);

  const stepDefs = useMemo(
    () => buildAppTourStepDefs(shouldUseMobileLayout),
    [shouldUseMobileLayout],
  );

  const markSettingsPanelReadyIfNeeded = useCallback((target: string) => {
    if (
      target === APP_TOUR_TARGETS.settingsPanel
      || target.startsWith('[data-tour="settings-')
    ) {
      settingsPanelReadyRef.current = true;
    }
  }, []);

  const activateJoyrideForStep = useCallback((index: number) => {
    const meta = stepDefs[index];
    if (!meta || meta.target === APP_TOUR_TARGETS.body) {
      setJoyrideActive(true);
      return;
    }
    setJoyrideActive(false);
    waitForTourTargetWithRetry(
      meta.target,
      () => {
        markSettingsPanelReadyIfNeeded(meta.target);
        setJoyrideActive(true);
      },
      meta,
    );
  }, [stepDefs, markSettingsPanelReadyIfNeeded]);

  useEffect(() => {
    const handleSettingsPanelReady = () => {
      settingsPanelReadyRef.current = true;
    };
    window.addEventListener('settings-panel-tour-ready', handleSettingsPanelReady);
    return () => {
      window.removeEventListener('settings-panel-tour-ready', handleSettingsPanelReady);
    };
  }, []);

  useEffect(() => {
    dispatchTourActiveChanged(run);
    if (!run) {
      closeAllTourDialogs(shouldUseMobileLayout);
      settingsPanelReadyRef.current = false;
      tourFinishingRef.current = false;
    } else {
      preloadSettingsPanelForTour();
    }
    return () => {
      dispatchTourActiveChanged(false);
    };
  }, [run, shouldUseMobileLayout]);

  useEffect(() => {
    if (run) {
      setTourStepIndex(0);
      setJoyrideActive(false);
      preparedStepIndexRef.current = null;
      settingsPanelReadyRef.current = false;
      tourFinishingRef.current = false;
      window.requestAnimationFrame(() => activateJoyrideForStep(0));
    } else {
      setJoyrideActive(false);
      preparedStepIndexRef.current = null;
    }
  }, [run, activateJoyrideForStep]);

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

  const steps = useMemo((): Step[] => {
    const tourFloaterProps = buildTourFloaterProps();

    return stepDefs.map((meta) => ({
      target: meta.target,
      placement: resolveTourPlacement(meta.placement, shouldUseMobileLayout),
      disableBeacon: meta.disableBeacon ?? false,
      content: renderStepContent(meta, shouldUseMobileLayout),
      data: meta,
      disableScrolling: meta.isFixed ?? isAppTourDialogStep(meta),
      disableScrollParentFix: meta.isFixed ?? false,
      isFixed: meta.isFixed ?? false,
      offset: meta.isFixed ? TOUR_CONSTANTS.floater.offset : 0,
      floaterProps: tourFloaterProps,
      spotlightPadding: meta.stepKey === APP_TOUR_STEP_KEYS.navIcon ? 6 : TOUR_CONSTANTS.spotlight.padding,
      ...(isAppTourDialogStep(meta) ? { spotlightClicks: true } : {}),
    }));
  }, [shouldUseMobileLayout, stepDefs]);

  const getStepMeta = useCallback(
    (index: number) => stepDefs[index],
    [stepDefs],
  );

  const prepareStep = useCallback(
    (index: number) => {
      const meta = getStepMeta(index);
      if (!meta) return;
      preparedStepIndexRef.current = index;

      const { stepKey, target } = meta;

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
        const previewTarget = shouldUseMobileLayout
          ? APP_TOUR_TARGETS.aiSchedulePreviewMobile
          : APP_TOUR_TARGETS.aiSchedulePreview;
        if (!isTourTargetReady(previewTarget)) {
          closeAllTourDialogs(shouldUseMobileLayout);
          if (shouldUseMobileLayout) {
            dispatchTourOpenPanel(TOUR_CONSTANTS.panels.ai);
            window.setTimeout(() => {
              dispatchTourOpenAiDialog('schedule-preview');
              scrollTourTargetIntoView(previewTarget);
            }, TIMING_CONSTANTS.tour.navigationComplete);
          } else {
            dispatchTourOpenDashboardSchedulePreview();
            scrollTourTargetIntoView(previewTarget);
          }
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
        preloadSettingsPanelForTour();
        const rescheduleTarget = APP_TOUR_TARGETS.rescheduleDialog;
        if (!isTourTargetReady(rescheduleTarget)) {
          if (shouldUseMobileLayout) {
            closeAllTourDialogs(shouldUseMobileLayout);
            dispatchTourOpenPanel(TOUR_CONSTANTS.panels.ai);
            window.setTimeout(() => {
              dispatchTourOpenAiDialog('reschedule-day');
              scrollTourTargetIntoView(rescheduleTarget);
            }, TIMING_CONSTANTS.tour.navigationComplete);
          } else {
            dispatchTourCloseAiDialog();
            dispatchTourCloseDashboardDialogs();
            dispatchTourOpenDashboardRescheduleDialog();
            scrollTourTargetIntoView(rescheduleTarget);
          }
        }
      }

      if (stepKey === APP_TOUR_STEP_KEYS.weekView || stepKey === APP_TOUR_STEP_KEYS.monthView) {
        scrollTourTargetIntoView(meta.target);
      }

      if (stepKey === APP_TOUR_STEP_KEYS.settingsIntro || stepKey === APP_TOUR_STEP_KEYS.settingsSection) {
        closeAllTourDialogs(shouldUseMobileLayout);
        dispatchTourViewMode(TOUR_CONSTANTS.viewModes.week);
        preloadSettingsPanelForTour();
        onNavigate?.('settings');
        if (stepKey === APP_TOUR_STEP_KEYS.settingsSection && meta.settingsId) {
          dispatchTourExpandSettingsSection(meta.settingsId);
        }
        scrollTourTargetIntoView(meta.target);
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
        if (preparedStepIndexRef.current !== index) {
          prepareStep(index);
        }
      }

      if (type === EVENTS.TARGET_NOT_FOUND && meta) {
        setJoyrideActive(false);
        if (preparedStepIndexRef.current !== index) {
          prepareStep(index);
        }
        if (targetRetryTimeoutRef.current !== null) {
          window.clearTimeout(targetRetryTimeoutRef.current);
        }
        const retry = () => {
          targetRetryTimeoutRef.current = null;
          if (meta.isFixed) {
            prepareFixedHeaderTourTarget(meta.target);
          }
          waitForTourTargetWithRetry(meta.target, () => {
            markSettingsPanelReadyIfNeeded(meta.target);
            setJoyrideActive(true);
          }, meta);
        };
        targetRetryTimeoutRef.current = window.setTimeout(
          retry,
          getTourStepAdvanceDelayMs(meta),
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

          if (meta && isAppTourDialogStep(meta)) {
            setJoyrideActive(false);
            closeTourDashboardDialogs();
            if (shouldUseMobileLayout) {
              dispatchTourClosePanel();
            }
          }

          const scheduleAdvance = () => {
            if (advanceTimeoutRef.current !== null) {
              window.clearTimeout(advanceTimeoutRef.current);
            }
            if (!nextMeta) {
              setTourStepIndex(nextIndex);
              return;
            }

            const advanceToStep = () => {
              markSettingsPanelReadyIfNeeded(nextMeta.target);
              waitForTourTargetWithRetry(nextMeta.target, () => {
                markSettingsPanelReadyIfNeeded(nextMeta.target);
                setJoyrideActive(true);
              }, nextMeta);
            };

            // Body / welcome-style steps — no target wait or joyride pause.
            if (nextMeta.target === APP_TOUR_TARGETS.body) {
              setTourStepIndex(nextIndex);
              setJoyrideActive(true);
              return;
            }

            // Settings sections after the panel is loaded — keep tooltip alive between steps.
            const fastSettingsStep =
              isAppTourSettingsSectionStep(nextMeta) && settingsPanelReadyRef.current;

            setTourStepIndex(nextIndex);
            prepareStep(nextIndex);
            if (nextMeta.isFixed) {
              prepareFixedHeaderTourTarget(nextMeta.target);
            }

            if (fastSettingsStep) {
              advanceToStep();
              return;
            }

            setJoyrideActive(false);
            const delay = getTourStepAdvanceDelayMs(nextMeta);
            const showNextStep = () => {
              advanceTimeoutRef.current = null;
              advanceToStep();
            };
            if (delay <= 0) {
              showNextStep();
              return;
            }
            advanceTimeoutRef.current = window.setTimeout(showNextStep, delay);
          };

          scheduleAdvance();
          return;
        }

        if (action === ACTIONS.PREV) {
          const prevIndex = Math.max(0, index - 1);
          const prevMeta = getStepMeta(prevIndex);
          setTourStepIndex(prevIndex);
          setJoyrideActive(false);
          if (prevMeta) {
            prepareStep(prevIndex);
            waitForTourTargetWithRetry(prevMeta.target, () => {
              markSettingsPanelReadyIfNeeded(prevMeta.target);
              setJoyrideActive(true);
            }, prevMeta);
          } else {
            setJoyrideActive(true);
          }
          return;
        }
      }

      if (action === ACTIONS.CLOSE || status === STATUS.SKIPPED) {
        finishTour();
        return;
      }

      if (status === STATUS.FINISHED) {
        const onLastStep = index >= steps.length - 1;
        const userCompleted =
          action === ACTIONS.NEXT || action === ACTIONS.SKIP || action === ACTIONS.CLOSE;
        if (onLastStep && userCompleted) {
          finishTour();
        }
        return;
      }

      function finishTour() {
        if (tourFinishingRef.current) return;
        tourFinishingRef.current = true;
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
        setJoyrideActive(false);
        onFinish();
      }
    },
    [getStepMeta, markSettingsPanelReadyIfNeeded, onFinish, onShowPricing, prepareStep, shouldUseMobileLayout, steps.length, subscription.tier],
  );

  const joyrideStyles = {
    options: {
      primaryColor: TOUR_CONSTANTS.colors.primary,
      textColor: isDark ? TOUR_CONSTANTS.colors.text.dark : TOUR_CONSTANTS.colors.text.light,
      backgroundColor: isDark ? TOUR_CONSTANTS.colors.background.dark : TOUR_CONSTANTS.colors.background.light,
      overlayColor: isDark ? TOUR_CONSTANTS.colors.overlay.dark : TOUR_CONSTANTS.colors.overlay.light,
      arrowColor: isDark ? TOUR_CONSTANTS.colors.arrow.dark : TOUR_CONSTANTS.colors.arrow.light,
      zIndex: Z_INDEX.APP_TOUR,
      width: TOUR_CONSTANTS.cardWidth,
    },
    tooltip: {
      borderRadius: TOUR_CONSTANTS.tooltip.borderRadius,
      padding: TOUR_CONSTANTS.tooltip.padding,
      maxWidth: TOUR_CONSTANTS.cardWidth,
    },
    tooltipContainer: {
      textAlign: 'left' as const,
    },
    tooltipContent: {
      maxHeight: `min(${TOUR_CONSTANTS.tooltip.maxContentHeightVh}vh, calc(100vh - ${TOUR_CONSTANTS.tooltip.footerReservePx}px - ${TOUR_CONSTANTS.floater.viewportPadding * 2}px))`,
      overflowY: 'auto' as const,
    },
    tooltipFooter: {
      flexShrink: 0,
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
      run={run && joyrideActive}
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
      floaterProps={buildTourFloaterProps()}
      disableOverlayClose
      disableScrollParentFix
      disableScrolling={false}
      scrollToFirstStep={false}
      scrollOffset={TOUR_CONSTANTS.scroll.offset}
      spotlightPadding={TOUR_CONSTANTS.spotlight.padding}
    />
  );
}
