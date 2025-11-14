import React, { useMemo } from "react";
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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ComposedChart,
  Line,
} from "recharts";
import { useTasks } from "../contexts/TaskContext";
import { motion } from "motion/react";
import {
  COLOR_ANALYTICS_BLUE,
  COLOR_ANALYTICS_GREEN,
  COLOR_ANALYTICS_ORANGE,
  COLOR_SUCCESS,
  COLOR_INFO,
  COLOR_WARNING,
  getColorWithOpacity,
} from "../lib/color-theme";

interface AnalyticsPanelProps {
  onClose: () => void;
}

// Clean, professional color palette
const ANALYTICS_COLORS = {
  background: '#FAFAFA',
  cardBackground: '#FFFFFF',
  border: '#E5E7EB',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  grid: '#F3F4F6',
  primary: COLOR_ANALYTICS_BLUE,
  success: COLOR_ANALYTICS_GREEN,
  warning: COLOR_ANALYTICS_ORANGE,
  accent: '#8B5CF6',
};

// Enhanced Custom Tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div
        className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-xl border"
        style={{ 
          borderColor: ANALYTICS_COLORS.border,
          minWidth: '120px'
        }}
      >
        <p className="text-sm font-semibold mb-2" style={{ color: ANALYTICS_COLORS.textPrimary }}>
          {label}
        </p>
        {payload.map((entry: any, index: number) => {
          const formatValue = (value: number, dataKey: string) => {
            if (dataKey.includes('Time') || dataKey.includes('minutes')) {
              const hours = Math.floor(value / 60);
              const minutes = Math.round(value % 60);
              return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
            }
            return value.toLocaleString();
          };

          return (
            <div key={index} className="flex items-center justify-between gap-3 mb-1 last:mb-0">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs" style={{ color: ANALYTICS_COLORS.textSecondary }}>
                  {entry.name}:
                </span>
              </div>
              <span className="text-xs font-bold" style={{ color: ANALYTICS_COLORS.textPrimary }}>
                {formatValue(entry.value, entry.dataKey)}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
}

// Enhanced Radial Progress Component
function RadialProgress({
  value,
  size = 120,
  strokeWidth = 12,
  color,
  label,
  subtitle,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  label?: string;
  subtitle?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        <defs>
          <linearGradient id={`radial-${label}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
        </defs>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ANALYTICS_COLORS.grid}
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#radial-${label})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color: ANALYTICS_COLORS.textPrimary }}>
          {Math.round(value)}%
        </span>
        {label && (
          <span className="text-xs font-medium mt-1" style={{ color: ANALYTICS_COLORS.textSecondary }}>
            {label}
          </span>
        )}
        {subtitle && (
          <span className="text-[10px] mt-0.5" style={{ color: ANALYTICS_COLORS.textMuted }}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
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
        hours: timeTracked / 60,
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
    const eveningTasks = hourCounts.slice(18, 22).reduce((a, b) => a + b, 0);
    const nightTasks = [...hourCounts.slice(0, 6), ...hourCounts.slice(22, 24)].reduce((a, b) => a + b, 0);

    const maxCount = Math.max(...hourCounts);
    const peakHour = maxCount > 0 ? hourCounts.indexOf(maxCount) : 12;

    const timePatterns = {
      blocks: [
        { name: "Morning\n(6AM-12PM)", value: morningTasks, color: ANALYTICS_COLORS.warning },
        { name: "Afternoon\n(12PM-6PM)", value: afternoonTasks, color: ANALYTICS_COLORS.primary },
        { name: "Evening\n(6PM-10PM)", value: eveningTasks, color: ANALYTICS_COLORS.success },
        { name: "Night\n(10PM-6AM)", value: nightTasks, color: ANALYTICS_COLORS.accent },
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
      .map(([name, value]) => ({ name, value, color: ANALYTICS_COLORS.primary }))
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
              color: project.color || ANALYTICS_COLORS.primary,
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
    <div className="h-full flex flex-col" style={{ backgroundColor: ANALYTICS_COLORS.background }}>
      <AppHeader
        title="Analytics Dashboard"
        panelOpen={true}
        isSidePanelHeader={true}
        description="Comprehensive insights into your productivity"
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
          <div className="p-6 space-y-6 pt-6 md:pt-6 pb-safe md:pb-6" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}>
            
            {/* KPI Cards Row - Enhanced with icons and better spacing */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              <Card className="shadow-sm border-0" style={{ backgroundColor: ANALYTICS_COLORS.cardBackground, borderColor: ANALYTICS_COLORS.border }}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-lg" style={{ backgroundColor: getColorWithOpacity(ANALYTICS_COLORS.primary, 0.1) }}>
                      <Target className="w-5 h-5" style={{ color: ANALYTICS_COLORS.primary }} />
                    </div>
                  </div>
                  <div className="text-sm font-medium mb-1" style={{ color: ANALYTICS_COLORS.textSecondary }}>
                    Total Tasks
                  </div>
                  <div className="text-3xl font-bold mb-1" style={{ color: ANALYTICS_COLORS.textPrimary }}>
                    {analytics.totalTasks.toLocaleString()}
                  </div>
                  <div className="text-xs" style={{ color: ANALYTICS_COLORS.textMuted }}>
                    All tasks created
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-0" style={{ backgroundColor: ANALYTICS_COLORS.cardBackground, borderColor: ANALYTICS_COLORS.border }}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-lg" style={{ backgroundColor: getColorWithOpacity(ANALYTICS_COLORS.success, 0.1) }}>
                      <CheckCircle2 className="w-5 h-5" style={{ color: ANALYTICS_COLORS.success }} />
                    </div>
                  </div>
                  <div className="text-sm font-medium mb-1" style={{ color: ANALYTICS_COLORS.textSecondary }}>
                    Completed
                  </div>
                  <div className="text-3xl font-bold mb-1" style={{ color: ANALYTICS_COLORS.success }}>
                    {analytics.completedTasks.toLocaleString()}
                  </div>
                  <div className="text-xs" style={{ color: ANALYTICS_COLORS.textMuted }}>
                    {analytics.totalTasks > 0 ? `${Math.round(analytics.completionRate)}% completion rate` : 'No tasks yet'}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-0" style={{ backgroundColor: ANALYTICS_COLORS.cardBackground, borderColor: ANALYTICS_COLORS.border }}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-lg" style={{ backgroundColor: getColorWithOpacity(ANALYTICS_COLORS.primary, 0.1) }}>
                      <Timer className="w-5 h-5" style={{ color: ANALYTICS_COLORS.primary }} />
                    </div>
                  </div>
                  <div className="text-sm font-medium mb-1" style={{ color: ANALYTICS_COLORS.textSecondary }}>
                    Time Tracked
                  </div>
                  <div className="text-3xl font-bold mb-1" style={{ color: ANALYTICS_COLORS.primary }}>
                    {Math.floor(analytics.totalTimeTracked / 60)}h {Math.round(analytics.totalTimeTracked % 60)}m
                  </div>
                  <div className="text-xs" style={{ color: ANALYTICS_COLORS.textMuted }}>
                    Total Pomodoro time
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-0" style={{ backgroundColor: ANALYTICS_COLORS.cardBackground, borderColor: ANALYTICS_COLORS.border }}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-lg" style={{ backgroundColor: getColorWithOpacity(ANALYTICS_COLORS.accent, 0.1) }}>
                      <Calendar className="w-5 h-5" style={{ color: ANALYTICS_COLORS.accent }} />
                    </div>
                  </div>
                  <div className="text-sm font-medium mb-1" style={{ color: ANALYTICS_COLORS.textSecondary }}>
                    This Week
                  </div>
                  <div className="text-3xl font-bold mb-1" style={{ color: ANALYTICS_COLORS.accent }}>
                    {Math.floor(analytics.weeklyTimeTracked / 60)}h {Math.round(analytics.weeklyTimeTracked % 60)}m
                  </div>
                  <div className="text-xs" style={{ color: ANALYTICS_COLORS.textMuted }}>
                    Time tracked this week
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Completion Rate & Open Tasks Gauges - Enhanced */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-4"
            >
              <Card className="shadow-sm border-0" style={{ backgroundColor: ANALYTICS_COLORS.cardBackground, borderColor: ANALYTICS_COLORS.border }}>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-semibold" style={{ color: ANALYTICS_COLORS.textPrimary }}>
                    Completion Rate
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-6">
                  <RadialProgress
                    value={analytics.completionRate}
                    color={ANALYTICS_COLORS.success}
                    label="Overall"
                    subtitle={`${analytics.completedTasks} of ${analytics.totalTasks} tasks`}
                  />
                </CardContent>
              </Card>

              <Card className="shadow-sm border-0" style={{ backgroundColor: ANALYTICS_COLORS.cardBackground, borderColor: ANALYTICS_COLORS.border }}>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-semibold" style={{ color: ANALYTICS_COLORS.textPrimary }}>
                    Open Tasks
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-6">
                  <RadialProgress
                    value={analytics.totalTasks > 0 ? ((analytics.totalTasks - analytics.completedTasks) / analytics.totalTasks) * 100 : 0}
                    color={ANALYTICS_COLORS.warning}
                    label="Remaining"
                    subtitle={`${analytics.totalTasks - analytics.completedTasks} tasks open`}
                  />
                </CardContent>
              </Card>
            </motion.div>

            {/* Time Tracked Trend - Enhanced Area Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="shadow-sm border-0" style={{ backgroundColor: ANALYTICS_COLORS.cardBackground, borderColor: ANALYTICS_COLORS.border }}>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-semibold" style={{ color: ANALYTICS_COLORS.textPrimary }}>
                    Time Tracked (Last 7 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={analytics.timeTrackingTrend}
                        margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="timeGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={ANALYTICS_COLORS.primary} stopOpacity={0.4} />
                            <stop offset="100%" stopColor={ANALYTICS_COLORS.primary} stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={ANALYTICS_COLORS.grid} vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: ANALYTICS_COLORS.textSecondary }}
                        />
                        <YAxis
                          tickFormatter={(value) => `${value}h`}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: ANALYTICS_COLORS.textSecondary }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="hours"
                          stroke={ANALYTICS_COLORS.primary}
                          strokeWidth={3}
                          fill="url(#timeGradient)"
                          name="Hours"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Tasks Created vs Completed - Enhanced Composed Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card className="shadow-sm border-0" style={{ backgroundColor: ANALYTICS_COLORS.cardBackground, borderColor: ANALYTICS_COLORS.border }}>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-semibold" style={{ color: ANALYTICS_COLORS.textPrimary }}>
                    Tasks Created vs. Completed (Last 7 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={analytics.taskPerDayProgress}
                        margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={ANALYTICS_COLORS.success} stopOpacity={0.4} />
                            <stop offset="100%" stopColor={ANALYTICS_COLORS.success} stopOpacity={0.05} />
                          </linearGradient>
                          <linearGradient id="createdGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={ANALYTICS_COLORS.primary} stopOpacity={0.4} />
                            <stop offset="100%" stopColor={ANALYTICS_COLORS.primary} stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={ANALYTICS_COLORS.grid} vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: ANALYTICS_COLORS.textSecondary }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: ANALYTICS_COLORS.textSecondary }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend 
                          wrapperStyle={{ paddingTop: '12px', fontSize: '12px' }} 
                          iconType="circle" 
                          iconSize={8}
                        />
                        <Area
                          type="monotone"
                          dataKey="completed"
                          stroke={ANALYTICS_COLORS.success}
                          strokeWidth={2}
                          fill="url(#completedGrad)"
                          name="Completed"
                        />
                        <Area
                          type="monotone"
                          dataKey="created"
                          stroke={ANALYTICS_COLORS.primary}
                          strokeWidth={2}
                          fill="url(#createdGrad)"
                          name="Created"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Task Completion by Time of Day - Enhanced Bar Chart */}
            {analytics.timePatterns.blocks.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="shadow-sm border-0" style={{ backgroundColor: ANALYTICS_COLORS.cardBackground, borderColor: ANALYTICS_COLORS.border }}>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base font-semibold" style={{ color: ANALYTICS_COLORS.textPrimary }}>
                      Task Completion by Time of Day
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={analytics.timePatterns.blocks}
                          margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={ANALYTICS_COLORS.grid} vertical={false} />
                          <XAxis
                            dataKey="name"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 11, fill: ANALYTICS_COLORS.textSecondary }}
                            interval={0}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 11, fill: ANALYTICS_COLORS.textSecondary }}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                            {analytics.timePatterns.blocks.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="text-center mt-4">
                      <div className="text-sm" style={{ color: ANALYTICS_COLORS.textSecondary }}>
                        Peak completion hour:{" "}
                        <span className="font-semibold" style={{ color: ANALYTICS_COLORS.textPrimary }}>
                          {peakHourLabel}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Top Task Tags - Enhanced Horizontal Bar Chart */}
            {analytics.taskTypes.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <Card className="shadow-sm border-0" style={{ backgroundColor: ANALYTICS_COLORS.cardBackground, borderColor: ANALYTICS_COLORS.border }}>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base font-semibold" style={{ color: ANALYTICS_COLORS.textPrimary }}>
                      Top Task Tags
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={analytics.taskTypes}
                          layout="vertical"
                          margin={{ top: 10, right: 20, left: 20, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={ANALYTICS_COLORS.grid} horizontal />
                          <XAxis
                            type="number"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 11, fill: ANALYTICS_COLORS.textSecondary }}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 11, fill: ANALYTICS_COLORS.textPrimary }}
                            width={90}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="value" fill={ANALYTICS_COLORS.primary} radius={[0, 8, 8, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Project Progress - Enhanced Table */}
            {analytics.projectProgress.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="shadow-sm border-0" style={{ backgroundColor: ANALYTICS_COLORS.cardBackground, borderColor: ANALYTICS_COLORS.border }}>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base font-semibold" style={{ color: ANALYTICS_COLORS.textPrimary }}>
                      Project Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${ANALYTICS_COLORS.border}` }}>
                            <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: ANALYTICS_COLORS.textSecondary }}>
                              Project
                            </th>
                            <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: ANALYTICS_COLORS.textSecondary }}>
                              Completed
                            </th>
                            <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: ANALYTICS_COLORS.textSecondary }}>
                              Total
                            </th>
                            <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: ANALYTICS_COLORS.textSecondary }}>
                              Progress
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.projectProgress.map((project, index) => (
                            <tr key={index} style={{ borderBottom: `1px solid ${ANALYTICS_COLORS.grid}` }}>
                              <td className="py-4 px-4 text-sm font-medium" style={{ color: ANALYTICS_COLORS.textPrimary }}>
                                {project.name}
                              </td>
                              <td className="py-4 px-4 text-sm text-right" style={{ color: ANALYTICS_COLORS.textPrimary }}>
                                {project.completed}
                              </td>
                              <td className="py-4 px-4 text-sm text-right" style={{ color: ANALYTICS_COLORS.textPrimary }}>
                                {project.total}
                              </td>
                              <td className="py-4 px-4 text-sm text-right font-semibold" style={{ color: ANALYTICS_COLORS.success }}>
                                {project.completionRate.toFixed(0)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
