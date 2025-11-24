import React, { useMemo, useState, useEffect } from "react";
import {
  X,
  TrendingUp,
  Clock,
  Target,
  Timer,
  CheckCircle2,
  Calendar,
  BarChart3,
  Activity,
  Zap,
  PieChart as PieChartIcon,
} from "lucide-react";
import { AppHeader } from "./AppHeader";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ComposedChart,
  Area,
} from "recharts";
import { useTasks } from "../contexts/TaskContext";
import { useSubscription } from "../contexts/SubscriptionContext";
import { useTheme } from "../contexts/ThemeContext";
import {
  COLOR_PRIMARY,
  COLOR_SUCCESS,
  COLOR_INFO,
  COLOR_WARNING,
  COLOR_ERROR,
  COLOR_ANALYTICS_BLUE,
  COLOR_ANALYTICS_GREEN,
  COLOR_ANALYTICS_ORANGE,
  COLOR_PASTEL_LAVENDER,
  COLOR_PASTEL_SKY,
  COLOR_PASTEL_MINT,
  COLOR_PASTEL_PEACH,
  COLOR_PASTEL_LILAC,
  COLOR_PASTEL_PINK,
  COLOR_BACKGROUND_LIGHT,
  COLOR_BACKGROUND_WHITE,
  COLOR_TEXT_PRIMARY,
  COLOR_TEXT_SECONDARY,
  COLOR_TEXT_MUTED,
  COLOR_BORDER_LIGHT,
  getColorWithOpacity,
} from "../lib/color-theme";
import { UI_CHART_COLORS, UI_ANALYTICS_COLORS } from "../lib/ui-colors";

interface AnalyticsPanelProps {
  onClose: () => void;
}

// Use app color theme
const CHART_COLORS = {
  primary: COLOR_PRIMARY,
  success: COLOR_SUCCESS,
  info: COLOR_INFO,
  warning: COLOR_WARNING,
  error: COLOR_ERROR,
  pastelLavender: COLOR_PASTEL_LAVENDER,
  pastelSky: COLOR_PASTEL_SKY,
  pastelMint: COLOR_PASTEL_MINT,
  pastelPeach: COLOR_PASTEL_PEACH,
  pastelLilac: COLOR_PASTEL_LILAC,
  pastelPink: COLOR_PASTEL_PINK,
};

// Compact Custom Tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div
        className="bg-card p-2 rounded-md shadow-lg border border-border text-xs"
      >
        <p className="font-semibold mb-1 text-foreground">
          {label}
        </p>
        {payload.map((entry: any, index: number) => {
          const formatValue = (value: number) => {
            if (entry.dataKey?.includes('Time') || entry.dataKey?.includes('minutes') || entry.dataKey?.includes('hours')) {
              const hours = Math.floor(value / 60);
              const minutes = Math.round(value % 60);
              return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
            }
            return value.toLocaleString();
          };

          return (
            <div key={index} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-muted-foreground">
                  {entry.name}:
                </span>
              </div>
              <span className="font-semibold text-foreground">
                {formatValue(entry.value)}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
}

// Compact Metric Card Component
function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  trend,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  trend?: { value: number; label: string };
}) {
  return (
    <Card className="shadow-sm border border-border bg-card">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="p-2 rounded-lg" style={{ backgroundColor: getColorWithOpacity(color, 0.1) }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          {trend && (
            <div className="text-xs font-medium" style={{ color: trend.value >= 0 ? COLOR_SUCCESS : COLOR_ERROR }}>
              {trend.value >= 0 ? '+' : ''}{trend.value}%
            </div>
          )}
        </div>
        <div className="text-xs font-medium mb-1 text-muted-foreground">
          {title}
        </div>
        <div className="text-xl font-bold mb-0.5 text-foreground">
          {value}
        </div>
        {subtitle && (
          <div className="text-[10px] text-muted-foreground">
            {subtitle}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AnalyticsPanel({ onClose }: AnalyticsPanelProps) {
  const { tasks, projects } = useTasks();
  const { features } = useSubscription();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  
  // Theme-aware colors for charts
  const textColor = isDark ? '#A8A8B8' : '#6B7280'; // muted-foreground
  const textPrimaryColor = isDark ? '#E8E6F0' : '#111827'; // foreground
  const borderColor = isDark ? 'rgba(155, 135, 232, 0.2)' : '#E5E7EB'; // border

  // Calculate date range limit
  const dateRangeLimit = features?.analyticsDaysLimit;
  const maxDate = dateRangeLimit 
    ? new Date(Date.now() - (dateRangeLimit - 1) * 24 * 60 * 60 * 1000) // dateRangeLimit days ago
    : null; // null means unlimited

  const analytics = useMemo(() => {
    if (!Array.isArray(tasks)) {
      return {
        totalTimeTracked: 0,
        tasksWithTime: 0,
        avgTimePerTask: 0,
        timeTrackingTrend: [],
        weeklyTimeTracked: 0,
        totalTasks: 0,
        completedTasks: 0,
        completionRate: 0,
        timePatterns: { hourly: [], blocks: [], peakHour: 12 },
        taskTypes: [],
        taskPerDayProgress: [],
        projectProgress: [],
        avgCompletionTime: 0,
        statusDistribution: [],
      };
    }

    // Filter tasks by date range limit if set
    const filteredTasks = maxDate 
      ? tasks.filter((t) => {
          try {
            const taskDate = t.updatedAt ? new Date(t.updatedAt) : (t.createdAt ? new Date(t.createdAt) : null);
            if (!taskDate || isNaN(taskDate.getTime())) return true; // Include if no date
            return taskDate >= maxDate;
          } catch {
            return true; // Include if date parsing fails
          }
        })
      : tasks;

    // Time tracking
    const totalTimeTracked = filteredTasks.reduce((acc, task) => acc + (task.actualTime || 0), 0);
    const tasksWithTime = filteredTasks.filter((t) => t.actualTime && t.actualTime > 0);
    const avgTimePerTask = tasksWithTime.length > 0
      ? tasksWithTime.reduce((acc, t) => acc + (t.actualTime || 0), 0) / tasksWithTime.length
      : 0;

    // Last 7 days time tracking (or up to dateRangeLimit if set)
    const daysToShow = dateRangeLimit && dateRangeLimit < 7 ? dateRangeLimit : 7;
    const last7DaysTime = Array.from({ length: daysToShow }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (daysToShow - 1 - i));
      date.setHours(0, 0, 0, 0);
      return date;
    });

    const timeTrackingTrend = last7DaysTime.map((date) => {
      const tasksUpdatedThisDay = filteredTasks.filter((t) => {
        if (!t.actualTime || t.actualTime <= 0 || !t.updatedAt) return false;
        try {
          const updatedDate = new Date(t.updatedAt);
          if (isNaN(updatedDate.getTime())) return false;
          // Apply date range limit if set
          if (maxDate && updatedDate < maxDate) return false;
          updatedDate.setHours(0, 0, 0, 0);
          return updatedDate.getTime() === date.getTime();
        } catch {
          return false;
        }
      });
      const timeTracked = tasksUpdatedThisDay.reduce((acc, t) => acc + (t.actualTime || 0), 0);
      return {
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        hours: (timeTracked / 60).toFixed(1),
        minutes: timeTracked,
      };
    });

    // Weekly time
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const tasksTrackedThisWeek = filteredTasks.filter((t) => {
      if (!t.actualTime || t.actualTime <= 0 || !t.updatedAt) return false;
      try {
        const updatedDate = new Date(t.updatedAt);
        if (isNaN(updatedDate.getTime())) return false;
        updatedDate.setHours(0, 0, 0, 0);
        return updatedDate >= startOfWeek;
      } catch {
        return false;
      }
    });
    const weeklyTimeTracked = tasksTrackedThisWeek.reduce((acc, t) => acc + (t.actualTime || 0), 0);

    // Completion metrics (using filtered tasks)
    const totalTasks = filteredTasks.length;
    const completedTasks = filteredTasks.filter((t) => t.status === "done").length;
    const inProgressTasks = filteredTasks.filter((t) => t.status === "in-progress").length;
    const todoTasks = filteredTasks.filter((t) => t.status === "todo").length;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Status distribution for pie chart
    const statusDistribution = [
      { name: 'Completed', value: completedTasks, color: COLOR_SUCCESS },
      { name: 'In Progress', value: inProgressTasks, color: COLOR_WARNING },
      { name: 'Todo', value: todoTasks, color: COLOR_INFO },
    ].filter(item => item.value > 0);

    // Time patterns (using filtered tasks)
    const hourCounts = new Array(24).fill(0);
    filteredTasks.filter((t) => t.completedAt).forEach((task) => {
      try {
        if (task.completedAt) {
          const completedDate = new Date(task.completedAt);
          if (!isNaN(completedDate.getTime())) {
            const hour = completedDate.getHours();
            if (hour >= 0 && hour < 24) hourCounts[hour]++;
          }
        }
      } catch {}
    });

    const morningTasks = hourCounts.slice(6, 12).reduce((a, b) => a + b, 0);
    const afternoonTasks = hourCounts.slice(12, 18).reduce((a, b) => a + b, 0);
    const eveningTasks = hourCounts.slice(18, 22).reduce((a, b) => a + b, 0);
    const nightTasks = [...hourCounts.slice(0, 6), ...hourCounts.slice(22, 24)].reduce((a, b) => a + b, 0);

    const maxCount = Math.max(...hourCounts);
    const peakHour = maxCount > 0 ? hourCounts.indexOf(maxCount) : 12;

    const timePatterns = {
      blocks: [
        { name: "Morning", value: morningTasks, color: CHART_COLORS.warning },
        { name: "Afternoon", value: afternoonTasks, color: CHART_COLORS.info },
        { name: "Evening", value: eveningTasks, color: CHART_COLORS.success },
        { name: "Night", value: nightTasks, color: CHART_COLORS.primary },
      ].filter((block) => block.value > 0),
      peakHour,
    };

    // Task types (using filtered tasks)
    const typeCount: Record<string, number> = {};
    filteredTasks.forEach((task) => {
      task.tags?.forEach((tag) => {
        typeCount[tag] = (typeCount[tag] || 0) + 1;
      });
    });
    const taskTypes = Object.entries(typeCount)
      .map(([name, value]) => ({ name, value, color: COLOR_PRIMARY }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Task per day progress
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      date.setHours(0, 0, 0, 0);
      return date;
    });

    const taskPerDayProgress = last7Days.map((date) => {
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      const completed = filteredTasks.filter((t) => {
        if (!t.completedAt) return false;
        try {
          const completedDate = new Date(t.completedAt);
          if (isNaN(completedDate.getTime())) return false;
          return completedDate >= date && completedDate < nextDay;
        } catch {
          return false;
        }
      }).length;

      const created = filteredTasks.filter((t) => {
        if (!t.createdAt) return false;
        try {
          const createdDate = new Date(t.createdAt);
          if (isNaN(createdDate.getTime())) return false;
          return createdDate >= date && createdDate < nextDay;
        } catch {
          return false;
        }
      }).length;

      return {
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        completed,
        created,
      };
    });

    // Project progress (using filtered tasks)
    const projectProgress = Array.isArray(projects) && projects.length > 0
      ? projects
          .map((project) => {
            if (!project || !project.id) return null;
            const projectTasks = filteredTasks.filter((t) => t.projectId === project.id);
            const totalProjectTasks = projectTasks.length;
            const completedProjectTasks = projectTasks.filter((t) => t.status === "done").length;
            const projectCompletionRate = totalProjectTasks > 0
              ? (completedProjectTasks / totalProjectTasks) * 100
              : 0;
            return {
              name: project.name || 'Unnamed Project',
              total: totalProjectTasks,
              completed: completedProjectTasks,
              completionRate: projectCompletionRate,
              color: project.color || COLOR_PRIMARY,
            };
          })
          .filter((p): p is NonNullable<typeof p> => p !== null)
          .sort((a, b) => b.completionRate - a.completionRate)
          .slice(0, 5)
      : [];

    // Avg completion time (using filtered tasks)
    const completedWithDates = filteredTasks.filter((t) => {
      if (!t.completedAt || !t.createdAt) return false;
      try {
        const created = new Date(t.createdAt);
        const completed = new Date(t.completedAt);
        return !isNaN(created.getTime()) && !isNaN(completed.getTime());
      } catch {
        return false;
      }
    });
    const avgCompletionTime = completedWithDates.length > 0
      ? completedWithDates.reduce((acc, task) => {
          try {
            const created = new Date(task.createdAt).getTime();
            const completed = new Date(task.completedAt!).getTime();
            if (isNaN(created) || isNaN(completed)) return acc;
            return acc + (completed - created);
          } catch {
            return acc;
          }
        }, 0) / completedWithDates.length / (1000 * 60 * 60 * 24)
      : 0;

    return {
      totalTimeTracked,
      tasksWithTime: tasksWithTime.length,
      avgTimePerTask,
      timeTrackingTrend,
      weeklyTimeTracked,
      totalTasks,
      completedTasks,
      inProgressTasks,
      todoTasks,
      completionRate,
      timePatterns,
      taskTypes,
      taskPerDayProgress,
      projectProgress,
      avgCompletionTime,
      statusDistribution,
    };
  }, [tasks, projects]);

  const peakHourLabel =
    analytics.timePatterns.peakHour === 0
      ? "12 AM"
      : analytics.timePatterns.peakHour < 12
        ? `${analytics.timePatterns.peakHour} AM`
        : analytics.timePatterns.peakHour === 12
          ? "12 PM"
          : `${analytics.timePatterns.peakHour - 12} PM`;

  return (
    <div className="h-full flex flex-col bg-background">
      <AppHeader
        title="Analytics"
        panelOpen={true}
        isSidePanelHeader={true}
        description="Productivity insights"
        hideDesktopLogo
        actions={
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        }
      />
      <div className="md:hidden h-[64px]" />

      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4 pt-4 md:pt-4 pb-safe md:pb-4" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}>
            
            {/* Compact KPI Metrics Row */}
            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                title="Total Tasks"
                value={analytics.totalTasks}
                icon={Target}
                color={COLOR_PRIMARY}
              />
              <MetricCard
                title="Completed"
                value={analytics.completedTasks}
                subtitle={`${Math.round(analytics.completionRate)}% rate`}
                icon={CheckCircle2}
                color={COLOR_SUCCESS}
              />
              <MetricCard
                title="Time Tracked"
                value={`${Math.floor(analytics.totalTimeTracked / 60)}h`}
                subtitle={`${Math.round(analytics.totalTimeTracked % 60)}m total`}
                icon={Timer}
                color={COLOR_INFO}
              />
              <MetricCard
                title="This Week"
                value={`${Math.floor(analytics.weeklyTimeTracked / 60)}h`}
                subtitle={`${Math.round(analytics.weeklyTimeTracked % 60)}m`}
                icon={Calendar}
                color={COLOR_WARNING}
              />
            </div>

            {/* Status Distribution - Pie Chart */}
            {analytics.statusDistribution.length > 0 && (
              <Card className="shadow-sm border border-border bg-card">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm font-semibold text-foreground">
                    Task Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="h-56" style={{ minHeight: '224px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart key={chartKey} margin={{ top: 10, right: 10, bottom: 40, left: 10 }}>
                        <Pie
                          data={analytics.statusDistribution}
                          cx="50%"
                          cy="45%"
                          labelLine={false}
                          label={false}
                          outerRadius={65}
                          innerRadius={0}
                          fill={UI_CHART_COLORS.primary}
                          dataKey="value"
                          isAnimationActive={true}
                          animationBegin={0}
                          animationDuration={800}
                          animationEasing="ease-out"
                        >
                          {analytics.statusDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend 
                          verticalAlign="bottom" 
                          height={36}
                          iconType="circle"
                          wrapperStyle={{ paddingTop: '10px' }}
                          formatter={(value, entry: any) => {
                            const item = analytics.statusDistribution.find(d => d.name === value);
                            const percent = item ? ((item.value / analytics.totalTasks) * 100).toFixed(0) : '0';
                            return (
                              <span className="text-[11px] text-muted-foreground">
                                {value}: {percent}%
                              </span>
                            );
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Time Tracked Trend - Line Chart */}
              <Card className="shadow-sm border border-border bg-card">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm font-semibold text-foreground">
                    Time Tracked (7 Days)
                  </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.timeTrackingTrend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={borderColor} vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10, fill: textColor }}
                      />
                      <YAxis
                        tickFormatter={(value) => `${value}h`}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10, fill: textColor }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="hours"
                        stroke={COLOR_PRIMARY}
                        strokeWidth={2}
                        dot={{ fill: COLOR_PRIMARY, r: 3 }}
                        activeDot={{ r: 5 }}
                        name="Hours"
                        isAnimationActive={true}
                        animationBegin={0}
                        animationDuration={800}
                        animationEasing="ease-out"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Tasks Created vs Completed - Composed Chart */}
              <Card className="shadow-sm border border-border bg-card">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm font-semibold text-foreground">
                    Tasks Created vs Completed
                  </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={analytics.taskPerDayProgress} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={borderColor} vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10, fill: textColor }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10, fill: textColor }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar 
                        dataKey="created" 
                        fill={COLOR_INFO} 
                        radius={[4, 4, 0, 0]} 
                        name="Created"
                        isAnimationActive={true}
                        animationBegin={0}
                        animationDuration={800}
                        animationEasing="ease-out"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="completed" 
                        stroke={COLOR_SUCCESS} 
                        strokeWidth={2} 
                        dot={false} 
                        name="Completed"
                        isAnimationActive={true}
                        animationBegin={200}
                        animationDuration={800}
                        animationEasing="ease-out"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Time of Day Completion - Bar Chart */}
            {analytics.timePatterns.blocks.length > 0 && (
              <Card className="shadow-sm border border-border bg-card">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm font-semibold text-foreground">
                    Completion by Time of Day
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.timePatterns.blocks} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={borderColor} vertical={false} />
                        <XAxis
                          dataKey="name"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 10, fill: textColor }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 10, fill: textColor }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar 
                          dataKey="value" 
                          radius={[6, 6, 0, 0]}
                          isAnimationActive={true}
                          animationBegin={0}
                          animationDuration={800}
                          animationEasing="ease-out"
                        >
                          {analytics.timePatterns.blocks.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="text-center mt-2">
                    <div className="text-xs text-muted-foreground">
                      Peak: <span className="font-semibold text-foreground">{peakHourLabel}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Top Task Tags - Horizontal Bar Chart */}
            {analytics.taskTypes.length > 0 && (
              <Card className="shadow-sm border border-border bg-card">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm font-semibold text-foreground">
                    Top Task Tags
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={analytics.taskTypes}
                        layout="vertical"
                        margin={{ top: 5, right: 10, left: 60, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={borderColor} horizontal />
                        <XAxis
                          type="number"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 10, fill: textColor }}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 10, fill: textPrimaryColor }}
                          width={55}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar 
                          dataKey="value" 
                          fill={COLOR_PRIMARY} 
                          radius={[0, 6, 6, 0]}
                          isAnimationActive={true}
                          animationBegin={0}
                          animationDuration={800}
                          animationEasing="ease-out"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Project Progress - Compact Table */}
            {analytics.projectProgress.length > 0 && (
              <Card className="shadow-sm border border-border bg-card">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm font-semibold text-foreground">
                    Project Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="space-y-2">
                    {analytics.projectProgress.map((project, index) => (
                      <div key={index} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate text-foreground">
                            {project.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {project.completed}/{project.total} tasks
                          </div>
                        </div>
                        <div className="text-xs font-semibold ml-2" style={{ color: COLOR_SUCCESS }}>
                          {project.completionRate.toFixed(0)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
