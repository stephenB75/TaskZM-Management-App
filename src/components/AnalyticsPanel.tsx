import React, { useMemo, useId } from "react";
import {
  X,
  TrendingUp,
  Clock,
  Target,
  Activity,
  Timer,
  CheckCircle2,
  Calendar,
  BarChart3,
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
  AreaChart,
  Area,
  PieChart,
  Pie,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useTasks } from "../contexts/TaskContext";
import { motion } from "motion/react";

interface AnalyticsPanelProps {
  onClose: () => void;
}

// Professional dashboard colors (inspired by Power BI)
const DASHBOARD_COLORS = {
  primary: '#0078D4', // Blue
  secondary: '#107C10', // Green
  accent: '#FFB900', // Yellow/Orange
  neutral: '#6B6B6B', // Gray
  success: '#107C10', // Green
  warning: '#FFB900', // Yellow
  info: '#0078D4', // Blue
  lightBlue: '#4A90E2',
  lightGreen: '#7ED321',
  lightGray: '#E8E8E8',
  darkGray: '#323130',
  textPrimary: '#323130',
  textSecondary: '#605E5C',
  border: '#EDEBE9',
};

// Gauge Chart Component
function GaugeChart({
  value,
  max,
  label,
  color = DASHBOARD_COLORS.primary,
}: {
  value: number;
  max: number;
  label: string;
  color?: string;
}) {
  const percentage = Math.min((value / max) * 100, 100);
  const radius = 60;
  const circumference = Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="140" height="80" className="transform -rotate-90">
          <defs>
            <linearGradient id={`gauge-${label}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="1" />
            </linearGradient>
          </defs>
          {/* Background arc */}
          <path
            d={`M 20 ${radius + 20} A ${radius} ${radius} 0 0 1 ${radius * 2 + 20} ${radius + 20}`}
            fill="none"
            stroke={DASHBOARD_COLORS.lightGray}
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <path
            d={`M 20 ${radius + 20} A ${radius} ${radius} 0 0 1 ${radius * 2 + 20} ${radius + 20}`}
            fill="none"
            stroke={`url(#gauge-${label})`}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center mt-8">
            <div className="text-2xl font-bold" style={{ color: DASHBOARD_COLORS.textPrimary }}>
              {value.toLocaleString()}
            </div>
            <div className="text-xs font-medium" style={{ color: DASHBOARD_COLORS.textSecondary }}>
              {label}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Custom Tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div
        className="bg-white p-3 rounded-lg shadow-lg border"
        style={{ borderColor: DASHBOARD_COLORS.border }}
      >
        <p className="text-sm font-semibold mb-2" style={{ color: DASHBOARD_COLORS.textPrimary }}>
          {label}
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs" style={{ color: DASHBOARD_COLORS.textSecondary }}>
              {entry.name}:
            </span>
            <span className="text-sm font-bold" style={{ color: DASHBOARD_COLORS.textPrimary }}>
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export function AnalyticsPanel({ onClose }: AnalyticsPanelProps) {
  const { tasks, projects } = useTasks();

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
      };
    }

    // Time tracking
    const totalTimeTracked = tasks.reduce((acc, task) => acc + (task.actualTime || 0), 0);
    const tasksWithTime = tasks.filter((t) => t.actualTime && t.actualTime > 0);
    const avgTimePerTask = tasksWithTime.length > 0
      ? tasksWithTime.reduce((acc, t) => acc + (t.actualTime || 0), 0) / tasksWithTime.length
      : 0;

    // Last 7 days time tracking
    const last7DaysTime = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      date.setHours(0, 0, 0, 0);
      return date;
    });

    const timeTrackingTrend = last7DaysTime.map((date) => {
      const tasksUpdatedThisDay = tasks.filter((t) => {
        if (!t.actualTime || t.actualTime <= 0 || !t.updatedAt) return false;
        try {
          const updatedDate = new Date(t.updatedAt);
          if (isNaN(updatedDate.getTime())) return false;
          updatedDate.setHours(0, 0, 0, 0);
          return updatedDate.getTime() === date.getTime();
        } catch {
          return false;
        }
      });
      const timeTracked = tasksUpdatedThisDay.reduce((acc, t) => acc + (t.actualTime || 0), 0);
      return {
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        minutes: timeTracked,
      };
    });

    // Weekly time
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const tasksTrackedThisWeek = tasks.filter((t) => {
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

    // Completion metrics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === "done").length;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Time patterns
    const hourCounts = new Array(24).fill(0);
    tasks.filter((t) => t.completedAt).forEach((task) => {
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
    const eveningTasks = hourCounts.slice(18, 24).reduce((a, b) => a + b, 0);
    const nightTasks = [...hourCounts.slice(0, 6)].reduce((a, b) => a + b, 0);

    const maxCount = Math.max(...hourCounts);
    const peakHour = maxCount > 0 ? hourCounts.indexOf(maxCount) : 12;

    const timePatterns = {
      blocks: [
        { name: "Morning", value: morningTasks, color: DASHBOARD_COLORS.accent },
        { name: "Afternoon", value: afternoonTasks, color: DASHBOARD_COLORS.primary },
        { name: "Evening", value: eveningTasks, color: DASHBOARD_COLORS.secondary },
        { name: "Night", value: nightTasks, color: DASHBOARD_COLORS.neutral },
      ].filter((block) => block.value > 0),
      peakHour,
    };

    // Task types
    const typeCount: Record<string, number> = {};
    tasks.forEach((task) => {
      task.tags?.forEach((tag) => {
        typeCount[tag] = (typeCount[tag] || 0) + 1;
      });
    });
    const taskTypes = Object.entries(typeCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

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
      const completed = tasks.filter((t) => {
        if (!t.completedAt) return false;
        try {
          const completedDate = new Date(t.completedAt);
          if (isNaN(completedDate.getTime())) return false;
          return completedDate >= date && completedDate < nextDay;
        } catch {
          return false;
        }
      }).length;
      const created = tasks.filter((t) => {
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

    // Project progress
    const projectProgress = Array.isArray(projects) && projects.length > 0
      ? projects
          .map((project) => {
            if (!project || !project.id) return null;
            const projectTasks = tasks.filter((t) => t.projectId === project.id);
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
            };
          })
          .filter((p): p is NonNullable<typeof p> => p !== null)
          .sort((a, b) => b.completionRate - a.completionRate)
          .slice(0, 5)
      : [];

    // Avg completion time
    const completedWithDates = tasks.filter((t) => {
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
      completionRate,
      timePatterns,
      taskTypes,
      taskPerDayProgress,
      projectProgress,
      avgCompletionTime,
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
    <div className="h-full flex flex-col bg-white dark:bg-gray-950">
      <AppHeader
        title="Analytics"
        panelOpen={true}
        isSidePanelHeader={true}
        description="Task performance insights"
        hideDesktopLogo
        actions={
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        }
      />
      <div className="md:hidden h-[64px]" />

      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6 pt-6 md:pt-4 pb-safe md:pb-4" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}>
            
            {/* KPI Cards Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border shadow-sm">
                <CardContent className="p-4">
                  <div className="text-xs font-medium mb-1" style={{ color: DASHBOARD_COLORS.textSecondary }}>
                    Total Tasks
                  </div>
                  <div className="text-2xl font-bold" style={{ color: DASHBOARD_COLORS.textPrimary }}>
                    {analytics.totalTasks.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
              <Card className="border shadow-sm">
                <CardContent className="p-4">
                  <div className="text-xs font-medium mb-1" style={{ color: DASHBOARD_COLORS.textSecondary }}>
                    Completed
                  </div>
                  <div className="text-2xl font-bold" style={{ color: DASHBOARD_COLORS.success }}>
                    {analytics.completedTasks.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
              <Card className="border shadow-sm">
                <CardContent className="p-4">
                  <div className="text-xs font-medium mb-1" style={{ color: DASHBOARD_COLORS.textSecondary }}>
                    Time Tracked
                  </div>
                  <div className="text-2xl font-bold" style={{ color: DASHBOARD_COLORS.primary }}>
                    {Math.floor(analytics.totalTimeTracked / 60)}h {analytics.totalTimeTracked % 60}m
                  </div>
                </CardContent>
              </Card>
              <Card className="border shadow-sm">
                <CardContent className="p-4">
                  <div className="text-xs font-medium mb-1" style={{ color: DASHBOARD_COLORS.textSecondary }}>
                    This Week
                  </div>
                  <div className="text-2xl font-bold" style={{ color: DASHBOARD_COLORS.info }}>
                    {Math.floor(analytics.weeklyTimeTracked / 60)}h {analytics.weeklyTimeTracked % 60}m
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Gauge Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold" style={{ color: DASHBOARD_COLORS.textPrimary }}>
                    Completion Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <GaugeChart
                    value={Math.round(analytics.completionRate)}
                    max={100}
                    label="%"
                    color={DASHBOARD_COLORS.success}
                  />
                </CardContent>
              </Card>
              <Card className="border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold" style={{ color: DASHBOARD_COLORS.textPrimary }}>
                    Open Tasks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <GaugeChart
                    value={analytics.totalTasks - analytics.completedTasks}
                    max={Math.max(analytics.totalTasks, 100)}
                    label="tasks"
                    color={DASHBOARD_COLORS.accent}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Time Tracking Trend - Area Chart */}
            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold" style={{ color: DASHBOARD_COLORS.textPrimary }}>
                  Time Tracked (Last 7 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.timeTrackingTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="timeGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={DASHBOARD_COLORS.primary} stopOpacity={0.6} />
                          <stop offset="100%" stopColor={DASHBOARD_COLORS.primary} stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={DASHBOARD_COLORS.lightGray} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: DASHBOARD_COLORS.textSecondary }}
                        stroke={DASHBOARD_COLORS.border}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: DASHBOARD_COLORS.textSecondary }}
                        stroke={DASHBOARD_COLORS.border}
                        tickFormatter={(value) => `${Math.floor(value / 60)}h`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="minutes"
                        stroke={DASHBOARD_COLORS.primary}
                        strokeWidth={2}
                        fill="url(#timeGradient)"
                        name="Minutes"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Productivity Trend - Area Chart */}
            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold" style={{ color: DASHBOARD_COLORS.textPrimary }}>
                  Tasks Created vs Completed (Last 7 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.taskPerDayProgress} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={DASHBOARD_COLORS.success} stopOpacity={0.6} />
                          <stop offset="100%" stopColor={DASHBOARD_COLORS.success} stopOpacity={0.1} />
                        </linearGradient>
                        <linearGradient id="createdGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={DASHBOARD_COLORS.primary} stopOpacity={0.6} />
                          <stop offset="100%" stopColor={DASHBOARD_COLORS.primary} stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={DASHBOARD_COLORS.lightGray} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: DASHBOARD_COLORS.textSecondary }}
                        stroke={DASHBOARD_COLORS.border}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: DASHBOARD_COLORS.textSecondary }}
                        stroke={DASHBOARD_COLORS.border}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="completed"
                        stroke={DASHBOARD_COLORS.success}
                        strokeWidth={2}
                        fill="url(#completedGrad)"
                        name="Completed"
                      />
                      <Area
                        type="monotone"
                        dataKey="created"
                        stroke={DASHBOARD_COLORS.primary}
                        strokeWidth={2}
                        fill="url(#createdGrad)"
                        name="Created"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Time Patterns - Stacked Bar Chart */}
            {analytics.timePatterns.blocks.length > 0 && (
              <Card className="border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold" style={{ color: DASHBOARD_COLORS.textPrimary }}>
                    Task Completion by Time of Day
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={analytics.timePatterns.blocks}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={DASHBOARD_COLORS.lightGray} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: DASHBOARD_COLORS.textSecondary }}
                          stroke={DASHBOARD_COLORS.border}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: DASHBOARD_COLORS.textSecondary }}
                          stroke={DASHBOARD_COLORS.border}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {analytics.timePatterns.blocks.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 text-center text-sm" style={{ color: DASHBOARD_COLORS.textSecondary }}>
                    Peak Hour: <span className="font-semibold" style={{ color: DASHBOARD_COLORS.textPrimary }}>{peakHourLabel}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Task Types - Horizontal Bar Chart */}
            {analytics.taskTypes.length > 0 && (
              <Card className="border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold" style={{ color: DASHBOARD_COLORS.textPrimary }}>
                    Top Task Tags
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={analytics.taskTypes}
                        layout="vertical"
                        margin={{ top: 10, right: 20, left: 80, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={DASHBOARD_COLORS.lightGray} horizontal />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 11, fill: DASHBOARD_COLORS.textSecondary }}
                          stroke={DASHBOARD_COLORS.border}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 11, fill: DASHBOARD_COLORS.textSecondary }}
                          stroke={DASHBOARD_COLORS.border}
                          width={75}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" fill={DASHBOARD_COLORS.primary} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Project Progress - Table */}
            {analytics.projectProgress.length > 0 && (
              <Card className="border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold" style={{ color: DASHBOARD_COLORS.textPrimary }}>
                    Project Progress
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b" style={{ borderColor: DASHBOARD_COLORS.border }}>
                          <th className="text-left py-2 px-4 text-xs font-semibold" style={{ color: DASHBOARD_COLORS.textSecondary }}>
                            Project
                          </th>
                          <th className="text-right py-2 px-4 text-xs font-semibold" style={{ color: DASHBOARD_COLORS.textSecondary }}>
                            Completed
                          </th>
                          <th className="text-right py-2 px-4 text-xs font-semibold" style={{ color: DASHBOARD_COLORS.textSecondary }}>
                            Total
                          </th>
                          <th className="text-right py-2 px-4 text-xs font-semibold" style={{ color: DASHBOARD_COLORS.textSecondary }}>
                            Progress
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.projectProgress.map((project, index) => (
                          <tr key={index} className="border-b" style={{ borderColor: DASHBOARD_COLORS.border }}>
                            <td className="py-3 px-4 text-sm font-medium" style={{ color: DASHBOARD_COLORS.textPrimary }}>
                              {project.name}
                            </td>
                            <td className="py-3 px-4 text-sm text-right" style={{ color: DASHBOARD_COLORS.textPrimary }}>
                              {project.completed}
                            </td>
                            <td className="py-3 px-4 text-sm text-right" style={{ color: DASHBOARD_COLORS.textPrimary }}>
                              {project.total}
                            </td>
                            <td className="py-3 px-4 text-sm text-right font-semibold" style={{ color: DASHBOARD_COLORS.success }}>
                              {project.completionRate.toFixed(0)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
