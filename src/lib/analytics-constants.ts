/**
 * Analytics Panel Constants
 * Centralized configuration for analytics panel styling, charts, and PDF export
 */

import {
  DAYS_IN_WEEK,
  HOURS_PER_DAY,
  MINUTES_PER_HOUR,
  PERCENTAGE_MULTIPLIER,
} from "./business-constants";
import {
  COLOR_ANALYTICS_BLUE,
  COLOR_ANALYTICS_GREEN,
  COLOR_ANALYTICS_ORANGE,
  COLOR_BACKGROUND_DARK_COLOR,
  COLOR_BACKGROUND_GRAY,
  COLOR_BACKGROUND_WHITE,
  COLOR_BORDER_LIGHT,
  COLOR_INFO,
  COLOR_PASTEL_LAVENDER,
  COLOR_PASTEL_LILAC,
  COLOR_PASTEL_MINT,
  COLOR_PASTEL_PEACH,
  COLOR_PASTEL_PINK,
  COLOR_PASTEL_SKY,
  COLOR_PRIMARY,
  COLOR_SUCCESS,
  COLOR_TEXT_MUTED,
  COLOR_TEXT_PRIMARY,
  COLOR_TEXT_SECONDARY,
  COLOR_WARNING,
} from "./color-theme";
import {
  HEADER_BUTTON_SIZE,
  HEADER_GAP_SMALL,
  MOBILE_PADDING_BOTTOM,
  SETTINGS_PANEL_ICON_SIZE_MEDIUM,
} from "./layout-constants";

/** Default chart window when subscription has unlimited history */
export const ANALYTICS_DEFAULT_CHART_DAYS = DAYS_IN_WEEK;

/** Hour buckets for completion-by-time chart (HOURS_PER_DAY must be divisible) */
export const ANALYTICS_HOUR_BUCKET_HOURS = 4;
export const ANALYTICS_HOUR_BUCKET_COUNT = HOURS_PER_DAY / ANALYTICS_HOUR_BUCKET_HOURS;

export const ANALYTICS_LIMITS = {
  maxProjects: 5,
  maxTags: 5,
  maxTagNameLength: 18,
} as const;

export const ANALYTICS_STATUS = {
  completed: { label: "Completed", color: COLOR_SUCCESS },
  inProgress: { label: "In Progress", color: COLOR_WARNING },
  todo: { label: "Todo", color: COLOR_INFO },
  onHold: { label: "On Hold", color: COLOR_ANALYTICS_ORANGE },
} as const;

export const ANALYTICS_TAG_BAR_COLORS = [
  COLOR_PRIMARY,
  COLOR_ANALYTICS_BLUE,
  COLOR_ANALYTICS_GREEN,
  COLOR_ANALYTICS_ORANGE,
  COLOR_PASTEL_LAVENDER,
  COLOR_PASTEL_SKY,
  COLOR_PASTEL_MINT,
  COLOR_PASTEL_PEACH,
  COLOR_PASTEL_LILAC,
  COLOR_PASTEL_PINK,
] as const;

export const ANALYTICS_CHART_SERIES = {
  created: { name: "Created", color: COLOR_INFO },
  completed: { name: "Completed", color: COLOR_SUCCESS },
  hours: { name: "Hours", color: COLOR_PRIMARY },
  tasksCompleted: { name: "Tasks completed", color: COLOR_TEXT_SECONDARY },
} as const;

export const ANALYTICS_THEME = {
  dark: {
    textMuted: COLOR_TEXT_MUTED,
    textPrimary: "#E8E6F0",
    border: "rgba(155, 135, 232, 0.2)",
    panelGradient:
      "linear-gradient(180deg, rgba(17,24,39,0.94) 0%, rgba(17,24,39,0.90) 40%, rgba(31,41,55,0.88) 100%)",
  },
  light: {
    textMuted: COLOR_TEXT_SECONDARY,
    textPrimary: COLOR_TEXT_PRIMARY,
    border: COLOR_BORDER_LIGHT,
    panelGradient:
      "linear-gradient(180deg, rgba(248,245,255,0.96) 0%, rgba(244,240,255,0.94) 40%, rgba(255,255,255,0.92) 100%)",
  },
} as const;

export const ANALYTICS_CHART_LAYOUT = {
  pie: {
    outerRadiusMobilePx: 52,
    outerRadiusDesktopPx: 68,
    innerRadiusPx: 42,
    heightMobilePx: 240,
    heightDesktopPx: 224,
    centerCyPercent: 45,
    legendHeightPx: 36,
    legendPaddingTopPx: 10,
    margin: { top: 10, right: 10, bottom: 40, left: 10 },
  },
  line: {
    heightMobilePx: 192,
    heightDesktopPx: 160,
    strokeWidthPx: 2,
    dotRadiusPx: 3,
    activeDotRadiusPx: 5,
    areaFillOpacity: 0.15,
    margin: { top: 5, right: 10, left: 0, bottom: 0 },
  },
  composed: {
    heightMobilePx: 192,
    heightDesktopPx: 160,
    barRadiusPx: 4,
    margin: { top: 5, right: 10, left: 0, bottom: 0 },
  },
  bar: {
    heightMobilePx: 192,
    heightDesktopPx: 160,
    barRadiusPx: 6,
    margin: { top: 5, right: 10, left: 0, bottom: 0 },
  },
  tagBar: {
    heightMobilePx: 192,
    heightDesktopPx: 160,
    yAxisWidthMobilePx: 72,
    yAxisWidthDesktopPx: 88,
    barRadiusEndPx: 6,
    margin: { top: 5, right: 10, left: 60, bottom: 0 },
  },
  axisTickFontSizePx: 10,
  gridStrokeDasharray: "3 3",
  cartesianVertical: false,
} as const;

export const ANALYTICS_KPI = {
  gridCols: 2,
  gridGapClass: "gap-3",
  iconSizePx: 16,
  cardPaddingClass: "p-4",
  titleClass: "text-xs font-medium mb-1 text-muted-foreground",
  valueClass: "text-xl font-bold mb-0.5 text-foreground",
  subtitleClass: "text-[11px] text-muted-foreground",
  trendPositiveClass: "text-xs font-medium",
  trendNegativeClass: "text-xs font-medium",
} as const;

export const ANALYTICS_ANIMATION = {
  cardDelaySeconds: 0.1,
  cardDurationSeconds: 0.5,
  cardInitialY: 20,
  cardInitialScale: 0.95,
  intersectionThreshold: 0.1,
  intersectionRootMarginPx: 50,
  observeDelayMs: 300,
  visibilityTriggerDelayMs: 200,
} as const;

export const ANALYTICS_LABELS = {
  panelTitle: "Analytics",
  panelDescriptionPrefix: "Productivity insights",
  allTimeRange: "All time",
  lastDaysRange: (days: number) => `Last ${days} days`,
  dateRangeSeparator: " · ",
  noData: "No data available",
  chartError: "Error loading chart",
  emptyPanelHint: "Complete tasks and track time to see insights here.",
  peakPeriodPrefix: "Peak period:",
  avgCompletionDays: "Avg to complete",
  avgCompletionDaysUnit: "days",
  tasksCompletedAxis: "Tasks completed",
  completionCenterLabel: "done",
  projectTasksSuffix: "tasks",
  pdfGenerating: "Generating PDF...",
  downloadPdfTitle: "Download PDF Report",
  chartTimeTracked: (days: number) => `Time Tracked (${days} Days)`,
  chartTasksCreatedCompleted: "Tasks Created vs Completed",
  chartCompletionByTimeOfDay: "Completion by Time of Day",
  chartTopTaskTags: "Top Task Tags",
  chartTaskStatus: "Task Status",
  chartProjectProgress: "Project Progress",
  trendVsLastWeek: "vs last week",
} as const;

export const ANALYTICS_METRIC_TITLES = {
  totalTasks: "Total Tasks",
  completed: "Completed",
  inProgress: "In Progress",
  timeTracked: "Time Tracked",
  thisWeek: "This Week",
  tasksWithTime: (count: number) => `${count} tasks with time`,
  completedThisWeek: (count: number) => `${count} completed`,
  completionRateSuffix: " rate",
} as const;

export const ANALYTICS_METRIC_ICONS = {
  totalTasks: "target",
  completed: "check-circle",
  inProgress: "play",
  timeTracked: "timer",
  thisWeek: "calendar",
  avgCompletion: "clock",
} as const;

export const ANALYTICS_METRIC_COLORS = {
  totalTasks: COLOR_PRIMARY,
  completed: COLOR_SUCCESS,
  inProgress: COLOR_WARNING,
  timeTracked: COLOR_INFO,
  thisWeek: COLOR_ANALYTICS_ORANGE,
  avgCompletion: COLOR_ANALYTICS_BLUE,
} as const;

export const ANALYTICS_TREND = {
  /** Treat |change| below this as flat (no arrow) */
  flatThresholdPercent: 1,
  decimalPlaces: 0,
} as const;

export const ANALYTICS_TIME_FORMAT = {
  locale: "en-US",
  monthStyle: "short" as const,
  hour12: true,
  noonHour: 12,
  midnightLabel: "12 AM",
  noonLabel: "12 PM",
} as const;

export const ANALYTICS_COMPLETION_RATE = {
  decimalPlaces: 0,
  centerDecimalPlaces: 0,
} as const;

// PDF Export Configuration
export const ANALYTICS_PDF_CONFIG = {
  fileName: "TaskZM-Analytics-Report",
  pageSize: "a4" as const,
  orientation: "portrait" as const,
  unit: "mm" as const,
  margins: {
    top: 20,
    right: 15,
    bottom: 20,
    left: 15,
  },
  fontSizes: {
    title: 18,
    heading: 14,
    body: 10,
    small: 8,
  },
  colors: {
    primary: COLOR_PRIMARY,
    text: COLOR_TEXT_PRIMARY,
    textSecondary: COLOR_TEXT_SECONDARY,
    border: COLOR_TEXT_MUTED,
    boxBackground: COLOR_BACKGROUND_GRAY,
    boxBorder: COLOR_PRIMARY,
    success: COLOR_SUCCESS,
  },
  spacing: {
    afterTitle: 10,
    afterTitleExtra: 2,
    afterDate: 15,
    afterDateExtra: 5,
    afterHeading: 8,
    afterHeadingExtra: 3,
    betweenItems: 6,
    afterSection: 8,
    afterSectionExtra: 5,
    boxSpacing: 5,
    projectRowExtra: 3,
  },
  pageBreak: {
    threshold: 20,
  },
  limits: {
    maxProjects: ANALYTICS_LIMITS.maxProjects,
  },
  chart: {
    width: 170,
    height: 100,
    spacing: 12,
    quality: 3,
    backgroundColor: {
      dark: COLOR_BACKGROUND_DARK_COLOR,
      light: COLOR_BACKGROUND_WHITE,
    },
    imageFormat: "image/png",
    pdfImageFormat: "PNG",
    waitForRender: 1000,
    fallbackWaitForRender: 500,
    reflowDelay: 200,
  },
  progress: {
    initial: 10,
    afterTitle: 15,
    chartStart: 20,
    chartEnd: 80,
    beforeSave: 90,
    complete: 100,
    resetDelay: 500,
  },
  pdfSpacing: {
    textOffset: 3,
    verticalOffset: 4,
    metricBoxHeight: 16,
    metricBoxLabelY: 5.5,
    metricBoxValueY: 12,
    metricBoxRowSpacing: 18,
    chartBoxPadding: 18,
    chartTitleOffset: 2,
    chartBottomSpacing: 6,
    projectRowHeight: 12,
    projectRowOffset: 2,
    separatorThreshold: 5,
  },
  pdfStyling: {
    borderWidth: 1,
    separatorWidthMultiplier: 0.5,
    titleFontSizeIncrease: 2,
  },
  labels: {
    title: "TaskZM Analytics Report",
    generated: "Generated:",
    summary: "Summary",
    timeTracking: "Time Tracking",
    statusDistribution: "Task Status",
    projectProgress: ANALYTICS_LABELS.chartProjectProgress,
    totalTasks: "Total Tasks:",
    completed: "Completed:",
    inProgress: "In Progress:",
    completionRate: "Completion Rate:",
    totalTime: "Total Time:",
    thisWeek: "This Week:",
    avgPerTask: "Avg per Task:",
    avgCompletion: "Avg to Complete:",
    hours: "h",
    minutes: "m",
    days: "d",
    fallbackPercentage: "0.0",
    chartTimeTracked: ANALYTICS_LABELS.chartTimeTracked(ANALYTICS_DEFAULT_CHART_DAYS),
    chartTasksCreatedCompleted: ANALYTICS_LABELS.chartTasksCreatedCompleted,
    chartCompletionByTimeOfDay: ANALYTICS_LABELS.chartCompletionByTimeOfDay,
    chartTopTaskTags: ANALYTICS_LABELS.chartTopTaskTags,
  },
} as const;

export const ANALYTICS_PDF_BUTTON = {
  size: HEADER_BUTTON_SIZE,
  iconSize: SETTINGS_PANEL_ICON_SIZE_MEDIUM,
  gap: HEADER_GAP_SMALL,
} as const;

export const ANALYTICS_PANEL_LAYOUT = {
  contentPaddingClass: "p-4 space-y-4 pt-4 md:pt-4",
  mobilePaddingBottom: MOBILE_PADDING_BOTTOM,
  progressBarHeightClass: "h-1.5",
  headerCloseIconSizePx: 16,
  headerActionButtonClass: "h-8 w-8",
} as const;

export function getAnalyticsChartDays(dateRangeLimit: number | undefined): number {
  if (dateRangeLimit === undefined) {
    return ANALYTICS_DEFAULT_CHART_DAYS;
  }
  return Math.min(dateRangeLimit, ANALYTICS_DEFAULT_CHART_DAYS);
}

export function getAnalyticsDateRangeLabel(dateRangeLimit: number | undefined): string {
  if (dateRangeLimit === undefined) {
    return ANALYTICS_LABELS.allTimeRange;
  }
  return ANALYTICS_LABELS.lastDaysRange(dateRangeLimit);
}

export function formatAnalyticsHoursAxis(value: number): string {
  return `${value}${ANALYTICS_PDF_CONFIG.labels.hours}`;
}

export function formatAnalyticsPercent(value: number, decimalPlaces = ANALYTICS_COMPLETION_RATE.decimalPlaces): string {
  return `${value.toFixed(decimalPlaces)}%`;
}
