/**
 * Analytics computation utilities — task metrics, trends, and chart series.
 */

import type { Project, Task } from "../types";
import {
  DAYS_IN_WEEK,
  HOURS_PER_DAY,
  MILLISECONDS_PER_DAY,
  MILLISECONDS_PER_HOUR,
  MINUTES_PER_HOUR,
  PERCENTAGE_MULTIPLIER,
  TIME_PERIODS,
} from "./business-constants";
import { COLOR_PRIMARY } from "./color-theme";
import {
  ANALYTICS_CHART_SERIES,
  ANALYTICS_DEFAULT_CHART_DAYS,
  ANALYTICS_HOUR_BUCKET_COUNT,
  ANALYTICS_HOUR_BUCKET_HOURS,
  ANALYTICS_LABELS,
  ANALYTICS_LIMITS,
  ANALYTICS_STATUS,
  ANALYTICS_TAG_BAR_COLORS,
  ANALYTICS_TIME_FORMAT,
  ANALYTICS_TREND,
  formatAnalyticsPercent,
  getAnalyticsChartDays,
  getAnalyticsDateRangeLabel,
} from "./analytics-constants";

export interface AnalyticsStatusSlice {
  name: string;
  value: number;
  color: string;
}

export interface AnalyticsDayPoint {
  date: string;
  hours: number;
  minutes: number;
}

export interface AnalyticsTaskDayPoint {
  date: string;
  created: number;
  completed: number;
}

export interface AnalyticsTimeBucket {
  name: string;
  value: number;
  color: string;
  startHour: number;
  endHour: number;
}

export interface AnalyticsTagSlice {
  name: string;
  value: number;
  color: string;
  percent: number;
}

export interface AnalyticsProjectRow {
  name: string;
  total: number;
  completed: number;
  completionRate: number;
  color: string;
}

export interface AnalyticsTrend {
  value: number;
  label: string;
}

export interface AnalyticsResult {
  chartDays: number;
  dateRangeLabel: string;
  totalTimeTracked: number;
  tasksWithTime: number;
  avgTimePerTask: number;
  timeTrackingTrend: AnalyticsDayPoint[];
  weeklyTimeTracked: number;
  previousWeekTimeTracked: number;
  weeklyTimeTrend: AnalyticsTrend | null;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  onHoldTasks: number;
  completionRate: number;
  completedThisWeek: number;
  completedPreviousWeek: number;
  completedWeeklyTrend: AnalyticsTrend | null;
  timePatterns: {
    buckets: AnalyticsTimeBucket[];
    peakBucket: AnalyticsTimeBucket | null;
  };
  taskTypes: AnalyticsTagSlice[];
  taskPerDayProgress: AnalyticsTaskDayPoint[];
  projectProgress: AnalyticsProjectRow[];
  avgCompletionTime: number;
  statusDistribution: AnalyticsStatusSlice[];
  hasAnyData: boolean;
}

const EMPTY_ANALYTICS: AnalyticsResult = {
  chartDays: ANALYTICS_DEFAULT_CHART_DAYS,
  dateRangeLabel: "",
  totalTimeTracked: 0,
  tasksWithTime: 0,
  avgTimePerTask: 0,
  timeTrackingTrend: [],
  weeklyTimeTracked: 0,
  previousWeekTimeTracked: 0,
  weeklyTimeTrend: null,
  totalTasks: 0,
  completedTasks: 0,
  inProgressTasks: 0,
  todoTasks: 0,
  onHoldTasks: 0,
  completionRate: 0,
  completedThisWeek: 0,
  completedPreviousWeek: 0,
  completedWeeklyTrend: null,
  timePatterns: { buckets: [], peakBucket: null },
  taskTypes: [],
  taskPerDayProgress: [],
  projectProgress: [],
  avgCompletionTime: 0,
  statusDistribution: [],
  hasAnyData: false,
};

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  try {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isTaskInDateRange(task: Task, maxDate: Date | null): boolean {
  if (!maxDate) return true;
  const dates = [task.createdAt, task.updatedAt, task.completedAt]
    .map(parseDate)
    .filter((d): d is Date => d !== null);
  if (dates.length === 0) return false;
  return dates.some((d) => d >= maxDate);
}

function getArchivedProjectIds(projects: Project[]): Set<string> {
  return new Set(
    projects.filter((project) => project?.archived && project.id).map((project) => project.id),
  );
}

function filterAnalyticsTasks(tasks: Task[], projects: Project[], maxDate: Date | null): Task[] {
  const archivedProjectIds = getArchivedProjectIds(projects);
  return tasks.filter((task) => {
    if (!task) return false;
    if (task.projectId && archivedProjectIds.has(task.projectId)) return false;
    return isTaskInDateRange(task, maxDate);
  });
}

/** Prefer completion date for done tasks; otherwise last update. */
export function getTimeAttributionDate(task: Task): Date | null {
  if (!task.actualTime || task.actualTime <= 0) return null;
  if (task.status === "done" && task.completedAt) {
    return parseDate(task.completedAt);
  }
  return parseDate(task.updatedAt) ?? parseDate(task.createdAt);
}

function getWeekStart(weekOffset: number): Date {
  const start = startOfDay(new Date());
  start.setDate(start.getDate() - start.getDay() + weekOffset * DAYS_IN_WEEK);
  return start;
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString(ANALYTICS_TIME_FORMAT.locale, {
    month: ANALYTICS_TIME_FORMAT.monthStyle,
    day: "numeric",
  });
}

function formatHourLabel(hour: number): string {
  if (hour === 0 || hour === HOURS_PER_DAY) {
    return ANALYTICS_TIME_FORMAT.midnightLabel;
  }
  if (hour === ANALYTICS_TIME_FORMAT.noonHour) {
    return ANALYTICS_TIME_FORMAT.noonLabel;
  }
  if (hour < ANALYTICS_TIME_FORMAT.noonHour) {
    return `${hour} AM`;
  }
  return `${hour - ANALYTICS_TIME_FORMAT.noonHour} PM`;
}

function formatHourBucketLabel(startHour: number, endHour: number): string {
  return `${formatHourLabel(startHour % HOURS_PER_DAY)}–${formatHourLabel(endHour % HOURS_PER_DAY)}`;
}

const TIME_BUCKET_COLORS = [
  ANALYTICS_STATUS.inProgress.color,
  ANALYTICS_CHART_SERIES.created.color,
  ANALYTICS_CHART_SERIES.completed.color,
  ANALYTICS_STATUS.completed.color,
  COLOR_PRIMARY,
  ANALYTICS_STATUS.onHold.color,
] as const;

function buildHourBuckets(hourCounts: number[]): AnalyticsTimeBucket[] {
  const buckets: AnalyticsTimeBucket[] = [];
  for (let index = 0; index < ANALYTICS_HOUR_BUCKET_COUNT; index += 1) {
    const startHour = index * ANALYTICS_HOUR_BUCKET_HOURS;
    const endHour = startHour + ANALYTICS_HOUR_BUCKET_HOURS;
    const value = hourCounts.slice(startHour, endHour).reduce((sum, count) => sum + count, 0);
    if (value <= 0) continue;
    buckets.push({
      name: formatHourBucketLabel(startHour, endHour),
      value,
      color: TIME_BUCKET_COLORS[index % TIME_BUCKET_COLORS.length],
      startHour,
      endHour,
    });
  }
  return buckets;
}

function buildTrend(current: number, previous: number): AnalyticsTrend | null {
  if (current === 0 && previous === 0) return null;
  if (previous === 0) {
    return { value: PERCENTAGE_MULTIPLIER, label: ANALYTICS_LABELS.trendVsLastWeek };
  }
  const change = ((current - previous) / previous) * PERCENTAGE_MULTIPLIER;
  if (Math.abs(change) < ANALYTICS_TREND.flatThresholdPercent) {
    return null;
  }
  return {
    value: Math.round(change),
    label: ANALYTICS_LABELS.trendVsLastWeek,
  };
}

function buildDaySeries(chartDays: number): Date[] {
  return Array.from({ length: chartDays }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (chartDays - 1 - index));
    return startOfDay(date);
  });
}

export function computeAnalytics(
  tasks: Task[],
  projects: Project[],
  dateRangeLimit: number | undefined,
): AnalyticsResult {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeProjects = Array.isArray(projects) ? projects : [];
  const chartDays = getAnalyticsChartDays(dateRangeLimit);
  const maxDate = dateRangeLimit
    ? startOfDay(new Date(Date.now() - (dateRangeLimit - 1) * MILLISECONDS_PER_DAY))
    : null;

  if (safeTasks.length === 0) {
    return {
      ...EMPTY_ANALYTICS,
      chartDays,
      dateRangeLabel: getAnalyticsDateRangeLabel(dateRangeLimit),
    };
  }

  const filteredTasks = filterAnalyticsTasks(safeTasks, safeProjects, maxDate);

  const totalTimeTracked = filteredTasks.reduce((acc, task) => acc + (task.actualTime ?? 0), 0);
  const tasksWithTime = filteredTasks.filter((task) => (task.actualTime ?? 0) > 0);
  const avgTimePerTask =
    tasksWithTime.length > 0
      ? tasksWithTime.reduce((acc, task) => acc + (task.actualTime ?? 0), 0) / tasksWithTime.length
      : 0;

  const daySeries = buildDaySeries(chartDays);
  const timeTrackingTrend: AnalyticsDayPoint[] = daySeries.map((date) => {
    const dayStart = date.getTime();
    const dayEnd = dayStart + MILLISECONDS_PER_DAY;
    const minutes = filteredTasks.reduce((acc, task) => {
      const attribution = getTimeAttributionDate(task);
      if (!attribution) return acc;
      const time = attribution.getTime();
      if (time < dayStart || time >= dayEnd) return acc;
      if (maxDate && attribution < maxDate) return acc;
      return acc + (task.actualTime ?? 0);
    }, 0);
    return {
      date: formatShortDate(date),
      hours: minutes / MINUTES_PER_HOUR,
      minutes,
    };
  });

  const currentWeekStart = getWeekStart(0);
  const previousWeekStart = getWeekStart(-1);

  const sumTimeInWeek = (weekStart: Date): number => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + DAYS_IN_WEEK);
    return filteredTasks.reduce((acc, task) => {
      const attribution = getTimeAttributionDate(task);
      if (!attribution) return acc;
      if (attribution < weekStart || attribution >= weekEnd) return acc;
      return acc + (task.actualTime ?? 0);
    }, 0);
  };

  const weeklyTimeTracked = sumTimeInWeek(currentWeekStart);
  const previousWeekTimeTracked = sumTimeInWeek(previousWeekStart);

  const countCompletedInWeek = (weekStart: Date): number => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + DAYS_IN_WEEK);
    return filteredTasks.filter((task) => {
      const completed = parseDate(task.completedAt);
      return completed !== null && completed >= weekStart && completed < weekEnd;
    }).length;
  };

  const completedThisWeek = countCompletedInWeek(currentWeekStart);
  const completedPreviousWeek = countCompletedInWeek(previousWeekStart);

  const totalTasks = filteredTasks.length;
  const completedTasks = filteredTasks.filter((task) => task.status === "done").length;
  const inProgressTasks = filteredTasks.filter((task) => task.status === "in-progress").length;
  const todoTasks = filteredTasks.filter((task) => task.status === "todo").length;
  const onHoldTasks = filteredTasks.filter((task) => task.status === "on-hold").length;
  const completionRate =
    totalTasks > 0 ? (completedTasks / totalTasks) * PERCENTAGE_MULTIPLIER : 0;

  const statusDistribution: AnalyticsStatusSlice[] = [
    { name: ANALYTICS_STATUS.completed.label, value: completedTasks, color: ANALYTICS_STATUS.completed.color },
    { name: ANALYTICS_STATUS.inProgress.label, value: inProgressTasks, color: ANALYTICS_STATUS.inProgress.color },
    { name: ANALYTICS_STATUS.todo.label, value: todoTasks, color: ANALYTICS_STATUS.todo.color },
    { name: ANALYTICS_STATUS.onHold.label, value: onHoldTasks, color: ANALYTICS_STATUS.onHold.color },
  ].filter((item) => item.value > 0);

  const hourCounts = new Array(HOURS_PER_DAY).fill(0);
  filteredTasks.forEach((task) => {
    const completed = parseDate(task.completedAt);
    if (!completed) return;
    const hour = completed.getHours();
    if (hour >= TIME_PERIODS.DAY_START && hour < HOURS_PER_DAY) {
      hourCounts[hour] += 1;
    }
  });

  const buckets = buildHourBuckets(hourCounts);
  const peakBucket =
    buckets.length > 0
      ? buckets.reduce((peak, bucket) => (bucket.value > peak.value ? bucket : peak), buckets[0])
      : null;

  const typeCount: Record<string, number> = {};
  filteredTasks.forEach((task) => {
    if (!Array.isArray(task.tags)) return;
    task.tags.forEach((tag) => {
      if (!tag) return;
      typeCount[tag] = (typeCount[tag] ?? 0) + 1;
    });
  });
  const taggedTaskTotal = Object.values(typeCount).reduce((sum, count) => sum + count, 0);
  const taskTypes: AnalyticsTagSlice[] = Object.entries(typeCount)
    .map(([name, value], index) => ({
      name,
      value,
      color: ANALYTICS_TAG_BAR_COLORS[index % ANALYTICS_TAG_BAR_COLORS.length],
      percent: taggedTaskTotal > 0 ? (value / taggedTaskTotal) * PERCENTAGE_MULTIPLIER : 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, ANALYTICS_LIMITS.maxTags);

  const progressDays = buildDaySeries(chartDays);
  const taskPerDayProgress: AnalyticsTaskDayPoint[] = progressDays.map((date) => {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const completed = filteredTasks.filter((task) => {
      const completedAt = parseDate(task.completedAt);
      return completedAt !== null && completedAt >= date && completedAt < nextDay;
    }).length;
    const created = filteredTasks.filter((task) => {
      const createdAt = parseDate(task.createdAt);
      return createdAt !== null && createdAt >= date && createdAt < nextDay;
    }).length;
    return {
      date: formatShortDate(date),
      completed,
      created,
    };
  });

  const projectProgress: AnalyticsProjectRow[] =
    safeProjects.length > 0
      ? safeProjects
          .filter((project) => project && project.id && !project.archived)
          .map((project) => {
            const projectTasks = filteredTasks.filter((task) => task.projectId === project.id);
            const total = projectTasks.length;
            const completed = projectTasks.filter((task) => task.status === "done").length;
            const completionRateForProject =
              total > 0 ? (completed / total) * PERCENTAGE_MULTIPLIER : 0;
            return {
              name: project.name || "Unnamed Project",
              total,
              completed,
              completionRate: completionRateForProject,
              color: project.color || COLOR_PRIMARY,
            };
          })
          .filter((row) => row.total > 0)
          .sort((a, b) => b.total - a.total || b.completionRate - a.completionRate)
          .slice(0, ANALYTICS_LIMITS.maxProjects)
      : [];

  const completedWithDates = filteredTasks.filter((task) => {
    const created = parseDate(task.createdAt);
    const completed = parseDate(task.completedAt);
    return created !== null && completed !== null;
  });
  const avgCompletionTime =
    completedWithDates.length > 0
      ? completedWithDates.reduce((acc, task) => {
          const created = parseDate(task.createdAt)!.getTime();
          const completed = parseDate(task.completedAt)!.getTime();
          return acc + (completed - created);
        }, 0) /
        completedWithDates.length /
        MILLISECONDS_PER_DAY
      : 0;

  return {
    chartDays,
    dateRangeLabel: getAnalyticsDateRangeLabel(dateRangeLimit),
    totalTimeTracked,
    tasksWithTime: tasksWithTime.length,
    avgTimePerTask,
    timeTrackingTrend,
    weeklyTimeTracked,
    previousWeekTimeTracked,
    weeklyTimeTrend: buildTrend(weeklyTimeTracked, previousWeekTimeTracked),
    totalTasks,
    completedTasks,
    inProgressTasks,
    todoTasks,
    onHoldTasks,
    completionRate,
    completedThisWeek,
    completedPreviousWeek,
    completedWeeklyTrend: buildTrend(completedThisWeek, completedPreviousWeek),
    timePatterns: { buckets, peakBucket },
    taskTypes,
    taskPerDayProgress,
    projectProgress,
    avgCompletionTime,
    statusDistribution,
    hasAnyData: filteredTasks.length > 0,
  };
}

export function formatAnalyticsDuration(minutes: number): { hours: number; minutes: number } {
  return {
    hours: Math.floor(minutes / MINUTES_PER_HOUR),
    minutes: Math.round(minutes % MINUTES_PER_HOUR),
  };
}

export function formatAnalyticsDurationLabel(minutes: number): string {
  const { hours, minutes: mins } = formatAnalyticsDuration(minutes);
  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${mins}m`;
}

export function formatAnalyticsCompletionDays(days: number): string {
  if (days <= 0) {
    return "—";
  }
  return `${days.toFixed(1)}`;
}

export function formatAnalyticsTrendPercent(trend: AnalyticsTrend | null): string | null {
  if (!trend) return null;
  const sign = trend.value >= 0 ? "+" : "";
  return `${sign}${trend.value}%`;
}

export function getAnalyticsLegendPercent(value: number, total: number): string {
  if (total <= 0) return formatAnalyticsPercent(0, ANALYTICS_COMPLETION_RATE.decimalPlaces);
  return formatAnalyticsPercent((value / total) * PERCENTAGE_MULTIPLIER, ANALYTICS_COMPLETION_RATE.decimalPlaces);
}
