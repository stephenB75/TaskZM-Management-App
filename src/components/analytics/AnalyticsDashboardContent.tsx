"use client";

import React from "react";
import { motion } from "motion/react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Icon } from "../Icon";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";
import {
  ANALYTICS_ANIMATION,
  ANALYTICS_CHART_LAYOUT,
  ANALYTICS_CHART_SERIES,
  ANALYTICS_COMPLETION_RATE,
  ANALYTICS_KPI,
  ANALYTICS_LABELS,
  ANALYTICS_LIMITS,
  ANALYTICS_METRIC_TITLES,
  ANALYTICS_METRIC_COLORS,
  ANALYTICS_METRIC_ICONS,
  ANALYTICS_PDF_CONFIG,
  ANALYTICS_THEME,
  formatAnalyticsHoursAxis,
} from "../../lib/analytics-constants";
import {
  AnalyticsResult,
  AnalyticsTrend,
  formatAnalyticsCompletionDays,
  formatAnalyticsDurationLabel,
  formatAnalyticsTrendPercent,
  getAnalyticsLegendPercent,
} from "../../lib/analytics-utils";
import { MINUTES_PER_HOUR } from "../../lib/business-constants";
import { COLOR_ERROR, COLOR_SUCCESS, getColorWithOpacity } from "../../lib/color-theme";
import { cn } from "../../lib/utils";

type ChartTooltipEntry = {
  color?: string;
  name?: string;
  value?: number;
  dataKey?: string;
  payload?: { percent?: number; minutes?: number };
};

interface AnalyticsTooltipProps {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string;
}

function AnalyticsTooltip({ active, payload, label }: AnalyticsTooltipProps) {
  if (!active || !payload?.length) return null;

  const formatValue = (entry: ChartTooltipEntry) => {
    const value = entry.value ?? 0;
    const dataKey = entry.dataKey ?? "";
    if (dataKey.includes("minutes") || dataKey.includes("hours")) {
      return formatAnalyticsDurationLabel(value);
    }
    if (dataKey === "hours") {
      return formatAnalyticsDurationLabel(value * MINUTES_PER_HOUR);
    }
    if (typeof entry.payload?.percent === "number") {
      return `${value} (${entry.payload.percent.toFixed(ANALYTICS_COMPLETION_RATE.decimalPlaces)}%)`;
    }
    return value.toLocaleString();
  };

  return (
    <div className="bg-card p-2 rounded-md shadow-lg border border-border text-xs">
      {label ? <p className="font-semibold mb-1 text-foreground">{label}</p> : null}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
          </div>
          <span className="font-semibold text-foreground">{formatValue(entry)}</span>
        </div>
      ))}
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  iconName,
  color,
  trend,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  iconName: string;
  color: string;
  trend?: AnalyticsTrend | null;
}) {
  const trendLabel = formatAnalyticsTrendPercent(trend ?? null);
  const gradient = `linear-gradient(180deg, ${getColorWithOpacity(color, 0.14)} 0%, ${getColorWithOpacity(color, 0.06)} 100%)`;

  return (
    <Card
      className="shadow-sm border border-border"
      style={{ backgroundImage: gradient, backgroundColor: getColorWithOpacity(color, 0.03) }}
    >
      <CardContent className={ANALYTICS_KPI.cardPaddingClass}>
        <div className="flex items-start justify-between mb-2">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: getColorWithOpacity(color, 0.1) }}
          >
            <Icon name={iconName} size={ANALYTICS_KPI.iconSizePx} style={{ color }} />
          </div>
          {trendLabel ? (
            <div
              className={cn(
                trend && trend.value >= 0
                  ? ANALYTICS_KPI.trendPositiveClass
                  : ANALYTICS_KPI.trendNegativeClass,
              )}
              style={{ color: trend && trend.value >= 0 ? COLOR_SUCCESS : COLOR_ERROR }}
            >
              {trendLabel} {ANALYTICS_LABELS.trendVsLastWeek}
            </div>
          ) : null}
        </div>
        <div className={ANALYTICS_KPI.titleClass}>{title}</div>
        <div className={ANALYTICS_KPI.valueClass}>{value}</div>
        {subtitle ? <div className={ANALYTICS_KPI.subtitleClass}>{subtitle}</div> : null}
      </CardContent>
    </Card>
  );
}

export interface AnalyticsDashboardContentProps {
  analytics: AnalyticsResult;
  isDark: boolean;
  isCompactCharts: boolean;
  chartKey: number;
  shouldAnimateCard: boolean;
  cardRef: React.RefObject<HTMLDivElement | null>;
  statusChartRef: React.RefObject<HTMLDivElement | null>;
  timeTrendChartRef: React.RefObject<HTMLDivElement | null>;
  tasksCreatedCompletedChartRef: React.RefObject<HTMLDivElement | null>;
  timeOfDayChartRef: React.RefObject<HTMLDivElement | null>;
  topTagsChartRef: React.RefObject<HTMLDivElement | null>;
}

export function AnalyticsDashboardContent({
  analytics,
  isDark,
  isCompactCharts,
  chartKey,
  shouldAnimateCard,
  cardRef,
  statusChartRef,
  timeTrendChartRef,
  tasksCreatedCompletedChartRef,
  timeOfDayChartRef,
  topTagsChartRef,
}: AnalyticsDashboardContentProps) {
  const theme = isDark ? ANALYTICS_THEME.dark : ANALYTICS_THEME.light;
  const pieLayout = ANALYTICS_CHART_LAYOUT.pie;
  const lineHeight = isCompactCharts
    ? ANALYTICS_CHART_LAYOUT.line.heightMobilePx
    : ANALYTICS_CHART_LAYOUT.line.heightDesktopPx;
  const pieHeight = isCompactCharts
    ? ANALYTICS_CHART_LAYOUT.pie.heightMobilePx
    : ANALYTICS_CHART_LAYOUT.pie.heightDesktopPx;
  const pieOuterRadius = isCompactCharts ? pieLayout.outerRadiusMobilePx : pieLayout.outerRadiusDesktopPx;
  const tagYAxisWidth = isCompactCharts
    ? ANALYTICS_CHART_LAYOUT.tagBar.yAxisWidthMobilePx
    : ANALYTICS_CHART_LAYOUT.tagBar.yAxisWidthDesktopPx;

  const totalTimeLabel = formatAnalyticsDurationLabel(analytics.totalTimeTracked);
  const weeklyTimeLabel = formatAnalyticsDurationLabel(analytics.weeklyTimeTracked);
  const avgCompletionLabel =
    analytics.avgCompletionTime > 0
      ? `${formatAnalyticsCompletionDays(analytics.avgCompletionTime)} ${ANALYTICS_LABELS.avgCompletionDaysUnit}`
      : "—";

  if (!analytics.hasAnyData) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <p className="text-sm text-muted-foreground">{ANALYTICS_LABELS.noData}</p>
        <p className="text-xs text-muted-foreground/80 mt-2">{ANALYTICS_LABELS.emptyPanelHint}</p>
      </div>
    );
  }

  const statusData = analytics.statusDistribution;

  return (
    <div className="space-y-4">
      <div className={cn("grid grid-cols-2", ANALYTICS_KPI.gridGapClass)}>
        <MetricCard
          title={ANALYTICS_METRIC_TITLES.totalTasks}
          value={analytics.totalTasks}
          iconName={ANALYTICS_METRIC_ICONS.totalTasks}
          color={ANALYTICS_METRIC_COLORS.totalTasks}
        />
        <MetricCard
          title={ANALYTICS_METRIC_TITLES.completed}
          value={analytics.completedTasks}
          subtitle={
            getAnalyticsLegendPercent(analytics.completedTasks, analytics.totalTasks) +
            ANALYTICS_METRIC_TITLES.completionRateSuffix
          }
          iconName={ANALYTICS_METRIC_ICONS.completed}
          color={ANALYTICS_METRIC_COLORS.completed}
          trend={analytics.completedWeeklyTrend}
        />
        <MetricCard
          title={ANALYTICS_METRIC_TITLES.inProgress}
          value={analytics.inProgressTasks}
          iconName={ANALYTICS_METRIC_ICONS.inProgress}
          color={ANALYTICS_METRIC_COLORS.inProgress}
        />
        <MetricCard
          title={ANALYTICS_LABELS.avgCompletionDays}
          value={avgCompletionLabel}
          iconName={ANALYTICS_METRIC_ICONS.avgCompletion}
          color={ANALYTICS_METRIC_COLORS.avgCompletion}
        />
        <MetricCard
          title={ANALYTICS_METRIC_TITLES.timeTracked}
          value={totalTimeLabel}
          subtitle={ANALYTICS_METRIC_TITLES.tasksWithTime(analytics.tasksWithTime)}
          iconName={ANALYTICS_METRIC_ICONS.timeTracked}
          color={ANALYTICS_METRIC_COLORS.timeTracked}
        />
        <MetricCard
          title={ANALYTICS_METRIC_TITLES.thisWeek}
          value={weeklyTimeLabel}
          subtitle={ANALYTICS_METRIC_TITLES.completedThisWeek(analytics.completedThisWeek)}
          iconName={ANALYTICS_METRIC_ICONS.thisWeek}
          color={ANALYTICS_METRIC_COLORS.thisWeek}
          trend={analytics.weeklyTimeTrend}
        />
      </div>

      {statusData.length > 0 ? (
        <motion.div
          ref={cardRef}
          initial={{
            opacity: 0,
            y: ANALYTICS_ANIMATION.cardInitialY,
            scale: ANALYTICS_ANIMATION.cardInitialScale,
          }}
          animate={
            shouldAnimateCard
              ? { opacity: 1, y: 0, scale: 1 }
              : {
                  opacity: 0,
                  y: ANALYTICS_ANIMATION.cardInitialY,
                  scale: ANALYTICS_ANIMATION.cardInitialScale,
                }
          }
          transition={{
            duration: ANALYTICS_ANIMATION.cardDurationSeconds,
            ease: "easeOut",
            delay: ANALYTICS_ANIMATION.cardDelaySeconds,
          }}
        >
          <Card className="shadow-sm border border-border bg-card">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-sm font-semibold text-foreground">
                {ANALYTICS_LABELS.chartTaskStatus}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div
                ref={statusChartRef}
                className="relative"
                style={{ minHeight: pieHeight, width: "100%" }}
                data-chart-ref={ANALYTICS_PDF_CONFIG.labels.statusDistribution}
              >
                <ResponsiveContainer width="100%" height={pieHeight}>
                  <PieChart key={`piechart-${chartKey}`} margin={pieLayout.margin}>
                    <Pie
                      key={`pie-${chartKey}`}
                      data={statusData}
                      cx="50%"
                      cy={`${pieLayout.centerCyPercent}%`}
                      labelLine={false}
                      label={false}
                      outerRadius={pieOuterRadius}
                      innerRadius={pieLayout.innerRadiusPx}
                      dataKey="value"
                      isAnimationActive={false}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${chartKey}-${index}-${entry.name}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<AnalyticsTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      height={pieLayout.legendHeightPx}
                      iconType="circle"
                      wrapperStyle={{ paddingTop: pieLayout.legendPaddingTopPx }}
                      formatter={(value: string) => {
                        const item = statusData.find((row) => row.name === value);
                        if (!item) return value;
                        return `${value}: ${getAnalyticsLegendPercent(item.value, analytics.totalTasks)}`;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  style={{ paddingBottom: pieLayout.legendHeightPx + pieLayout.legendPaddingTopPx }}
                >
                  <div className="text-center">
                    <div className="text-lg font-bold text-foreground">
                      {analytics.completionRate.toFixed(ANALYTICS_COMPLETION_RATE.centerDecimalPlaces)}%
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      {ANALYTICS_LABELS.completionCenterLabel}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : null}

      <Card className="shadow-sm border border-border bg-card">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-sm font-semibold text-foreground">
            {ANALYTICS_LABELS.chartTimeTracked(analytics.chartDays)}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div
            ref={timeTrendChartRef}
            style={{ height: lineHeight, width: "100%" }}
            data-chart-ref={ANALYTICS_PDF_CONFIG.labels.chartTimeTracked}
          >
            {analytics.timeTrackingTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.timeTrackingTrend} margin={ANALYTICS_CHART_LAYOUT.line.margin}>
                  <CartesianGrid
                    strokeDasharray={ANALYTICS_CHART_LAYOUT.gridStrokeDasharray}
                    stroke={theme.border}
                    vertical={ANALYTICS_CHART_LAYOUT.cartesianVertical}
                  />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: ANALYTICS_CHART_LAYOUT.axisTickFontSizePx, fill: theme.textMuted }}
                  />
                  <YAxis
                    tickFormatter={formatAnalyticsHoursAxis}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: ANALYTICS_CHART_LAYOUT.axisTickFontSizePx, fill: theme.textMuted }}
                  />
                  <Tooltip content={<AnalyticsTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="hours"
                    stroke="none"
                    fill={ANALYTICS_CHART_SERIES.hours.color}
                    fillOpacity={ANALYTICS_CHART_LAYOUT.line.areaFillOpacity}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="hours"
                    stroke={ANALYTICS_CHART_SERIES.hours.color}
                    strokeWidth={ANALYTICS_CHART_LAYOUT.line.strokeWidthPx}
                    dot={{
                      fill: ANALYTICS_CHART_SERIES.hours.color,
                      r: ANALYTICS_CHART_LAYOUT.line.dotRadiusPx,
                    }}
                    activeDot={{ r: ANALYTICS_CHART_LAYOUT.line.activeDotRadiusPx }}
                    name={ANALYTICS_CHART_SERIES.hours.name}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                {ANALYTICS_LABELS.noData}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border border-border bg-card">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-sm font-semibold text-foreground">
            {ANALYTICS_LABELS.chartTasksCreatedCompleted}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div
            ref={tasksCreatedCompletedChartRef}
            style={{ height: lineHeight, width: "100%" }}
            data-chart-ref={ANALYTICS_PDF_CONFIG.labels.chartTasksCreatedCompleted}
          >
            {analytics.taskPerDayProgress.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={analytics.taskPerDayProgress}
                  margin={ANALYTICS_CHART_LAYOUT.composed.margin}
                >
                  <CartesianGrid
                    strokeDasharray={ANALYTICS_CHART_LAYOUT.gridStrokeDasharray}
                    stroke={theme.border}
                    vertical={ANALYTICS_CHART_LAYOUT.cartesianVertical}
                  />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: ANALYTICS_CHART_LAYOUT.axisTickFontSizePx, fill: theme.textMuted }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: ANALYTICS_CHART_LAYOUT.axisTickFontSizePx, fill: theme.textMuted }}
                  />
                  <Tooltip content={<AnalyticsTooltip />} />
                  <Legend
                    verticalAlign="top"
                    height={pieLayout.legendHeightPx}
                    iconType="circle"
                    wrapperStyle={{ fontSize: ANALYTICS_CHART_LAYOUT.axisTickFontSizePx }}
                  />
                  <Bar
                    dataKey="created"
                    fill={ANALYTICS_CHART_SERIES.created.color}
                    radius={[
                      ANALYTICS_CHART_LAYOUT.composed.barRadiusPx,
                      ANALYTICS_CHART_LAYOUT.composed.barRadiusPx,
                      0,
                      0,
                    ]}
                    name={ANALYTICS_CHART_SERIES.created.name}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    stroke={ANALYTICS_CHART_SERIES.completed.color}
                    strokeWidth={ANALYTICS_CHART_LAYOUT.line.strokeWidthPx}
                    dot={false}
                    name={ANALYTICS_CHART_SERIES.completed.name}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                {ANALYTICS_LABELS.noData}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {analytics.timePatterns.buckets.length > 0 ? (
        <Card className="shadow-sm border border-border bg-card">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm font-semibold text-foreground">
              {ANALYTICS_LABELS.chartCompletionByTimeOfDay}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div
              ref={timeOfDayChartRef}
              style={{ height: lineHeight, width: "100%" }}
              data-chart-ref={ANALYTICS_PDF_CONFIG.labels.chartCompletionByTimeOfDay}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics.timePatterns.buckets}
                  margin={ANALYTICS_CHART_LAYOUT.bar.margin}
                >
                  <CartesianGrid
                    strokeDasharray={ANALYTICS_CHART_LAYOUT.gridStrokeDasharray}
                    stroke={theme.border}
                    vertical={ANALYTICS_CHART_LAYOUT.cartesianVertical}
                  />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: ANALYTICS_CHART_LAYOUT.axisTickFontSizePx, fill: theme.textMuted }}
                    interval={0}
                    angle={isCompactCharts ? -25 : 0}
                    textAnchor={isCompactCharts ? "end" : "middle"}
                    height={isCompactCharts ? ANALYTICS_CHART_LAYOUT.tagBar.yAxisWidthMobilePx / 2 : undefined}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: ANALYTICS_CHART_LAYOUT.axisTickFontSizePx, fill: theme.textMuted }}
                    label={{
                      value: ANALYTICS_LABELS.tasksCompletedAxis,
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: ANALYTICS_CHART_LAYOUT.axisTickFontSizePx, fill: theme.textMuted },
                    }}
                  />
                  <Tooltip content={<AnalyticsTooltip />} />
                  <Bar
                    dataKey="value"
                    radius={[
                      ANALYTICS_CHART_LAYOUT.bar.barRadiusPx,
                      ANALYTICS_CHART_LAYOUT.bar.barRadiusPx,
                      0,
                      0,
                    ]}
                    isAnimationActive={false}
                  >
                    {analytics.timePatterns.buckets.map((entry, index) => (
                      <Cell key={`time-bucket-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {analytics.timePatterns.peakBucket ? (
              <div className="text-center mt-2">
                <div className="text-xs text-muted-foreground">
                  {ANALYTICS_LABELS.peakPeriodPrefix}{" "}
                  <span className="font-semibold text-foreground">
                    {analytics.timePatterns.peakBucket.name}
                  </span>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {analytics.taskTypes.length > 0 ? (
        <Card className="shadow-sm border border-border bg-card">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm font-semibold text-foreground">
              {ANALYTICS_LABELS.chartTopTaskTags}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div
              ref={topTagsChartRef}
              style={{ height: lineHeight, width: "100%" }}
              data-chart-ref={ANALYTICS_PDF_CONFIG.labels.chartTopTaskTags}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics.taskTypes.map((tag) => ({
                    ...tag,
                    percent: tag.percent,
                  }))}
                  layout="vertical"
                  margin={{
                    ...ANALYTICS_CHART_LAYOUT.tagBar.margin,
                    left: tagYAxisWidth,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray={ANALYTICS_CHART_LAYOUT.gridStrokeDasharray}
                    stroke={theme.border}
                    horizontal
                  />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: ANALYTICS_CHART_LAYOUT.axisTickFontSizePx, fill: theme.textMuted }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: ANALYTICS_CHART_LAYOUT.axisTickFontSizePx, fill: theme.textPrimary }}
                    width={tagYAxisWidth}
                    tickFormatter={(value: string) =>
                      value.length > ANALYTICS_LIMITS.maxTagNameLength
                        ? `${value.slice(0, ANALYTICS_LIMITS.maxTagNameLength)}…`
                        : value
                    }
                  />
                  <Tooltip
                    content={
                      <AnalyticsTooltip />
                    }
                  />
                  <Bar
                    dataKey="value"
                    radius={[
                      0,
                      ANALYTICS_CHART_LAYOUT.tagBar.barRadiusEndPx,
                      ANALYTICS_CHART_LAYOUT.tagBar.barRadiusEndPx,
                      0,
                    ]}
                    isAnimationActive={false}
                  >
                    {analytics.taskTypes.map((entry, index) => (
                      <Cell key={`tag-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {analytics.projectProgress.length > 0 ? (
        <Card className="shadow-sm border border-border bg-card">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm font-semibold text-foreground">
              {ANALYTICS_LABELS.chartProjectProgress}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="space-y-3">
              {analytics.projectProgress.map((project, index) => (
                <div key={`${project.name}-${index}`} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate text-foreground">{project.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {project.completed}/{project.total} {ANALYTICS_LABELS.projectTasksSuffix}
                      </div>
                    </div>
                    <div className="text-xs font-semibold shrink-0" style={{ color: COLOR_SUCCESS }}>
                      {project.completionRate.toFixed(ANALYTICS_COMPLETION_RATE.decimalPlaces)}%
                    </div>
                  </div>
                  <Progress value={project.completionRate} className="h-1.5" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
