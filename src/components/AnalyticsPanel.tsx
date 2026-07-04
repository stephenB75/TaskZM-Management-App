"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "./AppHeader";
import { Icon } from "./Icon";
import { AnalyticsDashboardContent } from "./analytics/AnalyticsDashboardContent";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { ScrollArea } from "./ui/scroll-area";
import { exportAnalyticsPdf } from "../lib/analytics-pdf-export";
import {
  ANALYTICS_ANIMATION,
  ANALYTICS_LABELS,
  ANALYTICS_PANEL_LAYOUT,
  ANALYTICS_PDF_BUTTON,
  ANALYTICS_PDF_CONFIG,
  ANALYTICS_THEME,
  getAnalyticsDateRangeLabel,
} from "../lib/analytics-constants";
import { computeAnalytics } from "../lib/analytics-utils";
import { useMobileLayout } from "../hooks/useMobileLayout";
import { useSubscription } from "../contexts/SubscriptionContext";
import { useTasks } from "../contexts/TaskContext";
import { useTheme } from "../contexts/ThemeContext";
import {
  VIEWPORT_BREAKPOINTS,
} from "../lib/layout-constants";
import { cn } from "../lib/utils";

interface AnalyticsPanelProps {
  onClose: () => void;
}

export function AnalyticsPanel({ onClose }: AnalyticsPanelProps) {
  const { tasks, projects } = useTasks();
  const { features } = useSubscription();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === "dark";
  const isCompactCharts = useMobileLayout();
  const useScrollArea =
    typeof window !== "undefined" && window.innerWidth >= VIEWPORT_BREAKPOINTS.tablet;

  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeProjects = Array.isArray(projects) ? projects : [];
  const dateRangeLimit = features?.analyticsDaysLimit;

  const analytics = useMemo(
    () => computeAnalytics(safeTasks, safeProjects, dateRangeLimit),
    [safeTasks, safeProjects, dateRangeLimit],
  );

  const panelDescription = `${ANALYTICS_LABELS.panelDescriptionPrefix}${ANALYTICS_LABELS.dateRangeSeparator}${getAnalyticsDateRangeLabel(dateRangeLimit)}`;

  const [chartKey, setChartKey] = useState(0);
  const [shouldAnimateCard, setShouldAnimateCard] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const hasTriggeredAnimationRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const statusChartRef = useRef<HTMLDivElement>(null);
  const timeTrendChartRef = useRef<HTMLDivElement>(null);
  const tasksCreatedCompletedChartRef = useRef<HTMLDivElement>(null);
  const timeOfDayChartRef = useRef<HTMLDivElement>(null);
  const topTagsChartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hasTriggeredAnimationRef.current = false;
    setChartKey(0);
    setShouldAnimateCard(false);
    return () => {
      hasTriggeredAnimationRef.current = false;
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!analytics.statusDistribution.length || !cardRef.current) return;

    observerRef.current?.disconnect();
    observerRef.current = null;

    const isVisible = () => {
      if (!cardRef.current) return false;
      const rect = cardRef.current.getBoundingClientRect();
      return rect.top < window.innerHeight && rect.bottom > 0;
    };

    if (isVisible() && !hasTriggeredAnimationRef.current) {
      const timer = setTimeout(() => {
        if (!hasTriggeredAnimationRef.current) {
          setShouldAnimateCard(true);
          setChartKey((prev) => prev + 1);
          hasTriggeredAnimationRef.current = true;
        }
      }, ANALYTICS_ANIMATION.visibilityTriggerDelayMs);
      return () => clearTimeout(timer);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (
            entry.isIntersecting &&
            entry.intersectionRatio > ANALYTICS_ANIMATION.intersectionThreshold &&
            !hasTriggeredAnimationRef.current
          ) {
            setShouldAnimateCard(true);
            setChartKey((prev) => prev + 1);
            hasTriggeredAnimationRef.current = true;
            observerRef.current?.disconnect();
            observerRef.current = null;
          }
        });
      },
      {
        threshold: ANALYTICS_ANIMATION.intersectionThreshold,
        rootMargin: `${ANALYTICS_ANIMATION.intersectionRootMarginPx}px`,
      },
    );

    observerRef.current = observer;
    const observeTimer = setTimeout(() => {
      if (cardRef.current && observerRef.current) {
        observerRef.current.observe(cardRef.current);
      }
    }, ANALYTICS_ANIMATION.observeDelayMs);

    return () => {
      clearTimeout(observeTimer);
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [analytics.statusDistribution.length]);

  const handleExportPDF = async () => {
    setIsGeneratingPDF(true);
    setPdfProgress(0);
    try {
      await exportAnalyticsPdf({
        analytics,
        isDark,
        statusChartRef,
        timeTrendChartRef,
        tasksCreatedCompletedChartRef,
        timeOfDayChartRef,
        topTagsChartRef,
        onProgress: setPdfProgress,
      });
    } catch (error) {
      console.error("Error exporting PDF:", error);
    } finally {
      setTimeout(() => {
        setIsGeneratingPDF(false);
        setPdfProgress(0);
      }, ANALYTICS_PDF_CONFIG.progress.resetDelay);
    }
  };

  const dashboard = (
    <AnalyticsDashboardContent
      analytics={analytics}
      isDark={isDark}
      isCompactCharts={isCompactCharts}
      chartKey={chartKey}
      shouldAnimateCard={shouldAnimateCard}
      cardRef={cardRef}
      statusChartRef={statusChartRef}
      timeTrendChartRef={timeTrendChartRef}
      tasksCreatedCompletedChartRef={tasksCreatedCompletedChartRef}
      timeOfDayChartRef={timeOfDayChartRef}
      topTagsChartRef={topTagsChartRef}
    />
  );

  const panelGradient = isDark ? ANALYTICS_THEME.dark.panelGradient : ANALYTICS_THEME.light.panelGradient;

  return (
    <div
      className={cn(
        "flex flex-col bg-background",
        typeof window !== "undefined" && window.innerWidth < VIEWPORT_BREAKPOINTS.mobile
          ? "min-h-full"
          : "h-full",
      )}
      data-tour="analytics-panel"
      style={{ backgroundImage: panelGradient } as React.CSSProperties}
    >
      <AppHeader
        title={ANALYTICS_LABELS.panelTitle}
        panelOpen
        isSidePanelHeader
        description={panelDescription}
        hideDesktopLogo
        actions={
          <div className="flex items-center" style={{ gap: ANALYTICS_PDF_BUTTON.gap }}>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleExportPDF}
              disabled={isGeneratingPDF}
              className={ANALYTICS_PANEL_LAYOUT.headerActionButtonClass}
              title={ANALYTICS_LABELS.downloadPdfTitle}
            >
              <Icon
                name="download"
                size={ANALYTICS_PDF_BUTTON.iconSize}
                className={cn(isGeneratingPDF && "animate-spin")}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={isGeneratingPDF}
              className={ANALYTICS_PANEL_LAYOUT.headerActionButtonClass}
            >
              <Icon name="x" size={ANALYTICS_PANEL_LAYOUT.headerCloseIconSizePx} />
            </Button>
          </div>
        }
      />

      {isGeneratingPDF ? (
        <div className="px-4 py-2 border-b border-border/40 bg-background/50">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">{ANALYTICS_LABELS.pdfGenerating}</span>
            <span className="text-xs font-medium text-primary">{pdfProgress}%</span>
          </div>
          <Progress value={pdfProgress} className={ANALYTICS_PANEL_LAYOUT.progressBarHeightClass} />
        </div>
      ) : null}

      <div className="flex-1 min-h-0">
        {useScrollArea ? (
          <ScrollArea className="h-full">
            <div className={cn(ANALYTICS_PANEL_LAYOUT.contentPaddingClass, "pb-safe md:pb-4")}>
              {dashboard}
            </div>
          </ScrollArea>
        ) : (
          <div
            className={ANALYTICS_PANEL_LAYOUT.contentPaddingClass}
            style={{
              paddingBottom:
                typeof window !== "undefined" && window.innerWidth < VIEWPORT_BREAKPOINTS.tablet
                  ? ANALYTICS_PANEL_LAYOUT.mobilePaddingBottom
                  : undefined,
            }}
          >
            {dashboard}
          </div>
        )}
      </div>
    </div>
  );
}
