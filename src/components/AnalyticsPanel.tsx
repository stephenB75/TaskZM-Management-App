import React, { useMemo } from "react";
import {
  X,
  TrendingUp,
  Clock,
  BarChart3,
  Target,
  Calendar,
  Activity,
  Zap,
  Timer,
  Award,
  CheckCircle2,
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
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
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
import type { Task, TaskPriority } from "../types";

interface AnalyticsPanelProps {
  onClose: () => void;
}

// Custom Radial Progress Component
function RadialProgress({
  value,
  size = 100,
  strokeWidth = 10,
  color,
  label,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  label?: string;
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
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200 dark:text-gray-700"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg" style={{ color }}>
          {Math.round(value)}%
        </span>
        {label && (
          <span className="text-[10px] text-gray-500">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

// Custom Tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="text-xs mb-0.5">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p
            key={index}
            className="text-[10px]"
            style={{ color: entry.color }}
          >
            {entry.name}:{" "}
            {typeof entry.value === "number"
              ? entry.value.toFixed(1)
              : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export function AnalyticsPanel({
  onClose,
}: AnalyticsPanelProps) {
  const { tasks, projects } = useTasks();

  const analytics = useMemo(() => {
    const now = new Date();

    // Time tracking analytics (from Pomodoro timer)
    // Calculate total time tracked across ALL tasks (actualTime is cumulative per task)
    const totalTimeTracked = tasks.reduce(
      (acc, task) => acc + (task.actualTime || 0),
      0,
    ); // in minutes
    
    // Filter tasks that have tracked time
    const tasksWithTime = tasks.filter(
      (t) => t.actualTime && t.actualTime > 0,
    );
    
    // Calculate average time per task (only for tasks with tracked time)
    const avgTimePerTask =
      tasksWithTime.length > 0
        ? tasksWithTime.reduce(
            (acc, t) => acc + (t.actualTime || 0),
            0,
          ) / tasksWithTime.length
        : 0;

    // Time tracked in last 7 days
    // Show tasks that were updated (time tracked) on each day
    const last7DaysTime = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      date.setHours(0, 0, 0, 0);
      return date;
    });

    const timeTrackingTrend = last7DaysTime.map((date) => {
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      // Find tasks that have tracked time and were updated on this specific day
      // This shows when time was actively tracked
      const tasksUpdatedThisDay = tasks.filter((t) => {
        if (!t.actualTime || t.actualTime <= 0) return false;
        if (!t.updatedAt) return false;
        
        const updatedDate = new Date(t.updatedAt);
        updatedDate.setHours(0, 0, 0, 0);
        return updatedDate.getTime() === date.getTime();
      });

      // Sum up the actualTime for tasks updated on this day
      // Note: Since actualTime is cumulative, we show the total time for tasks that were actively tracked that day
      const timeTracked = tasksUpdatedThisDay.reduce((acc, t) => {
        return acc + (t.actualTime || 0);
      }, 0);

      return {
        date: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        minutes: timeTracked,
        hours: Math.round((timeTracked / 60) * 10) / 10,
      };
    });

    // This week's total time
    // Show all tasks with tracked time that have been updated this week
    const startOfWeek = new Date();
    startOfWeek.setDate(
      startOfWeek.getDate() - startOfWeek.getDay(),
    );
    startOfWeek.setHours(0, 0, 0, 0);

    // Get all tasks that have tracked time and were updated this week
    // This shows the total time tracked for tasks that were actively worked on this week
    const tasksTrackedThisWeek = tasks.filter((t) => {
      // Must have tracked time
      if (!t.actualTime || t.actualTime <= 0) return false;
      // Must have been updated this week (indicates active tracking)
      if (!t.updatedAt) return false;
      const updatedDate = new Date(t.updatedAt);
      updatedDate.setHours(0, 0, 0, 0);
      return updatedDate >= startOfWeek;
    });

    // Sum up all tracked time for tasks updated this week
    const weeklyTimeTracked = tasksTrackedThisWeek.reduce(
      (acc, t) => acc + (t.actualTime || 0),
      0
    );

    // Completion metrics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(
      (t) => t.status === "done",
    ).length;
    const completionRate =
      totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Time Patterns Analysis
    const timePatterns = (() => {
      const hourCounts = new Array(24).fill(0);
      const completedTasksList = tasks.filter(
        (t) => t.completedAt,
      );

      completedTasksList.forEach((task) => {
        const hour = new Date(task.completedAt!).getHours();
        hourCounts[hour]++;
      });

      // Group into time blocks
      const morningTasks = hourCounts
        .slice(6, 12)
        .reduce((a, b) => a + b, 0);
      const afternoonTasks = hourCounts
        .slice(12, 18)
        .reduce((a, b) => a + b, 0);
      const eveningTasks = hourCounts
        .slice(18, 24)
        .reduce((a, b) => a + b, 0);
      const nightTasks = [...hourCounts.slice(0, 6)].reduce(
        (a, b) => a + b,
        0,
      );

      return {
        hourly: Array.from({ length: 24 }, (_, i) => ({
          hour: i,
          label:
            i === 0
              ? "12 AM"
              : i < 12
                ? `${i} AM`
                : i === 12
                  ? "12 PM"
                  : `${i - 12} PM`,
          count: hourCounts[i],
        })).filter((_, i) => i >= 6 && i < 22), // Show 6 AM to 10 PM
        blocks: [
          {
            name: "Morning",
            value: morningTasks,
            color: "#FFD1A4",
            fill: "#FFD1A4",
          },
          {
            name: "Afternoon",
            value: afternoonTasks,
            color: "#A4D4FF",
            fill: "#A4D4FF",
          },
          {
            name: "Evening",
            value: eveningTasks,
            color: "#C4B5FD",
            fill: "#C4B5FD",
          },
          {
            name: "Night",
            value: nightTasks,
            color: "#93C5FD",
            fill: "#93C5FD",
          },
        ].filter((block) => block.value > 0),
        peakHour: hourCounts.indexOf(Math.max(...hourCounts)),
      };
    })();

    // Task Types Distribution
    const taskTypes = (() => {
      const typeCount: Record<string, number> = {};
      tasks.forEach((task) => {
        task.tags?.forEach((tag) => {
          typeCount[tag] = (typeCount[tag] || 0) + 1;
        });
      });

      return Object.entries(typeCount)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6); // Top 6 types
    })();

    // Task Per Day Progress (Last 7 days for compact view)
    const taskPerDayProgress = (() => {
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        date.setHours(0, 0, 0, 0);
        return date;
      });

      return last7Days.map((date) => {
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const completed = tasks.filter((t) => {
          if (!t.completedAt) return false;
          const completedDate = new Date(t.completedAt);
          return (
            completedDate >= date && completedDate < nextDay
          );
        }).length;

        const created = tasks.filter((t) => {
          const createdDate = new Date(t.createdAt);
          return createdDate >= date && createdDate < nextDay;
        }).length;

        return {
          date: date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          completed,
          created,
        };
      });
    })();

    // Project Progress
    const projectProgress = (() => {
      if (!projects || projects.length === 0) {
        return [];
      }

      return projects
        .map((project) => {
          const projectTasks = tasks.filter(
            (t) => t.projectId === project.id,
          );
          const totalProjectTasks = projectTasks.length;
          const completedProjectTasks = projectTasks.filter(
            (t) => t.status === "done",
          ).length;
          const projectCompletionRate =
            totalProjectTasks > 0
              ? (completedProjectTasks / totalProjectTasks) *
                100
              : 0;

          return {
            name: project.name,
            total: totalProjectTasks,
            completed: completedProjectTasks,
            completionRate: projectCompletionRate,
            color: project.color || "#7B68EE",
          };
        })
        .sort((a, b) => b.completionRate - a.completionRate)
        .slice(0, 5);
    })();

    // Task Durations
    const completedWithDates = tasks.filter(
      (t) => t.completedAt && t.createdAt,
    );
    const avgCompletionTime =
      completedWithDates.length > 0
        ? completedWithDates.reduce((acc, task) => {
            const created = new Date(task.createdAt).getTime();
            const completed = new Date(
              task.completedAt!,
            ).getTime();
            return acc + (completed - created);
          }, 0) /
          completedWithDates.length /
          (1000 * 60 * 60 * 24)
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
    <div className="h-full flex flex-col bg-gradient-to-br from-[#E6D5F0]/30 via-[#C9E4F7]/30 to-[#B8E6D5]/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      {/* Header */}
      <AppHeader
        title="Analytics"
        description="Visual insights & Pomodoro tracking"
        hideDesktopLogo
      />
      {/* Spacer for fixed header on mobile */}
      <div className="md:hidden h-[64px]" />

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4 pb-safe md:pb-4">
            {/* Pomodoro Time Tracking - Hero Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
            >
              <Card className="relative overflow-hidden border-[#7B68EE]/30 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#7B68EE]/20 to-purple-500/20 rounded-full -mr-16 -mt-16" />
                <CardHeader className="pb-2 relative z-10">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Timer className="w-4 h-4 text-[#7B68EE]" />
                    Pomodoro Time Tracking
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/60 dark:bg-gray-900/40 rounded-xl p-3 text-center">
                      <div className="text-2xl bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent mb-1">
                        {Math.floor(
                          analytics.totalTimeTracked / 60,
                        )}
                        h {analytics.totalTimeTracked % 60}m
                      </div>
                      <p className="text-[9px] text-gray-600 dark:text-gray-400">
                        Total Time
                      </p>
                    </div>
                    <div className="bg-white/60 dark:bg-gray-900/40 rounded-xl p-3 text-center">
                      <div className="text-2xl bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-1">
                        {Math.floor(
                          analytics.weeklyTimeTracked / 60,
                        )}
                        h {analytics.weeklyTimeTracked % 60}m
                      </div>
                      <p className="text-[9px] text-gray-600 dark:text-gray-400">
                        This Week
                      </p>
                    </div>
                    <div className="bg-white/60 dark:bg-gray-900/40 rounded-xl p-3 text-center">
                      <div className="text-2xl bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent mb-1">
                        {Math.floor(
                          analytics.avgTimePerTask / 60,
                        )}
                        h{" "}
                        {Math.round(
                          analytics.avgTimePerTask % 60,
                        )}
                        m
                      </div>
                      <p className="text-[9px] text-gray-600 dark:text-gray-400">
                        Avg/Task
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 bg-white/40 dark:bg-gray-900/30 rounded-lg p-2">
                    <Award className="w-3 h-3 text-[#7B68EE]" />
                    <span>
                      Tracked across {analytics.tasksWithTime}{" "}
                      tasks
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Time Tracking Trend Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <Card className="border-[#7B68EE]/20">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Activity className="w-4 h-4 text-[#7B68EE]" />
                    Time Tracked (Last 7 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-44">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <BarChart
                        data={analytics.timeTrackingTrend}
                        margin={{
                          top: 5,
                          right: 5,
                          left: -15,
                          bottom: 5,
                        }}
                      >
                        <defs>
                          <linearGradient
                            id="barGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#7B68EE"
                              stopOpacity={0.9}
                            />
                            <stop
                              offset="95%"
                              stopColor="#7B68EE"
                              stopOpacity={0.6}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#e5e7eb"
                          opacity={0.5}
                        />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 9 }}
                          stroke="#9ca3af"
                        />
                        <YAxis
                          tick={{ fontSize: 9 }}
                          width={30}
                          stroke="#9ca3af"
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar
                          dataKey="hours"
                          fill="url(#barGradient)"
                          radius={[6, 6, 0, 0]}
                          name="Hours"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Completion Rate with Radial Progress */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-green-200/40 dark:border-green-900/40 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    Overall Progress
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-around">
                    <div className="flex flex-col items-center">
                      <RadialProgress
                        value={analytics.completionRate}
                        size={90}
                        strokeWidth={8}
                        color="#22c55e"
                        label="Complete"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="bg-white/60 dark:bg-gray-900/40 rounded-lg p-2 min-w-[100px]">
                        <p className="text-[9px] text-gray-600 dark:text-gray-400">
                          Completed
                        </p>
                        <p className="text-xl text-green-600">
                          {analytics.completedTasks}
                        </p>
                      </div>
                      <div className="bg-white/60 dark:bg-gray-900/40 rounded-lg p-2 min-w-[100px]">
                        <p className="text-[9px] text-gray-600 dark:text-gray-400">
                          Total Tasks
                        </p>
                        <p className="text-xl text-blue-600">
                          {analytics.totalTasks}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 bg-white/40 dark:bg-gray-900/30 rounded-lg p-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-600 dark:text-gray-400">
                        Avg Completion
                      </span>
                      <span className="text-green-600">
                        {analytics.avgCompletionTime.toFixed(1)}{" "}
                        days
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Productivity Trend - Area Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card className="border-blue-200/40 dark:border-blue-900/40">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    Productivity Trend (7 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-44">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <AreaChart
                        data={analytics.taskPerDayProgress}
                        margin={{
                          top: 5,
                          right: 5,
                          left: -15,
                          bottom: 5,
                        }}
                      >
                        <defs>
                          <linearGradient
                            id="completedGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#22c55e"
                              stopOpacity={0.4}
                            />
                            <stop
                              offset="95%"
                              stopColor="#22c55e"
                              stopOpacity={0.05}
                            />
                          </linearGradient>
                          <linearGradient
                            id="createdGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#3b82f6"
                              stopOpacity={0.4}
                            />
                            <stop
                              offset="95%"
                              stopColor="#3b82f6"
                              stopOpacity={0.05}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#e5e7eb"
                          opacity={0.5}
                        />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 9 }}
                          stroke="#9ca3af"
                        />
                        <YAxis
                          tick={{ fontSize: 9 }}
                          width={30}
                          stroke="#9ca3af"
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                          wrapperStyle={{
                            fontSize: "10px",
                            paddingTop: "5px",
                          }}
                          iconSize={8}
                        />
                        <Area
                          type="monotone"
                          dataKey="completed"
                          stroke="#22c55e"
                          strokeWidth={2}
                          fill="url(#completedGrad)"
                          name="Done"
                        />
                        <Area
                          type="monotone"
                          dataKey="created"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          fill="url(#createdGrad)"
                          name="Created"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Time Patterns with Donut */}
            {analytics.timePatterns.blocks.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="border-[#FFD1A4]/40 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-orange-600" />
                      Time Patterns
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-around">
                      <div className="relative">
                        <ResponsiveContainer
                          width={110}
                          height={110}
                        >
                          <PieChart>
                            <Pie
                              data={
                                analytics.timePatterns.blocks
                              }
                              cx="50%"
                              cy="50%"
                              innerRadius={30}
                              outerRadius={45}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {analytics.timePatterns.blocks.map(
                                (entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={entry.color}
                                  />
                                ),
                              )}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <Clock className="w-4 h-4 text-orange-600" />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {analytics.timePatterns.blocks.map(
                          (block, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-2 bg-white/60 dark:bg-gray-900/40 rounded-lg px-2 py-1"
                            >
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{
                                  backgroundColor: block.color,
                                }}
                              />
                              <div className="flex-1">
                                <p className="text-[9px] text-gray-600 dark:text-gray-400">
                                  {block.name}
                                </p>
                                <p className="text-sm">
                                  {block.value}
                                </p>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                    <div className="mt-2 bg-white/40 dark:bg-gray-900/30 rounded-lg p-2 text-center">
                      <p className="text-[9px] text-gray-600 dark:text-gray-400">
                        Peak Hour
                      </p>
                      <p className="text-sm text-orange-600">
                        {peakHourLabel}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Task Types - Compact Bar */}
            {analytics.taskTypes.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <Card className="border-cyan-200/40 dark:border-cyan-900/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Target className="w-4 h-4 text-cyan-600" />
                      Top Task Tags
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-40">
                      <ResponsiveContainer
                        width="100%"
                        height="100%"
                      >
                        <BarChart
                          data={analytics.taskTypes}
                          margin={{
                            top: 5,
                            right: 5,
                            left: -15,
                            bottom: 25,
                          }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#e5e7eb"
                            opacity={0.5}
                          />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 9 }}
                            angle={-35}
                            textAnchor="end"
                            height={40}
                            stroke="#9ca3af"
                          />
                          <YAxis
                            tick={{ fontSize: 9 }}
                            width={30}
                            stroke="#9ca3af"
                          />
                          <Tooltip
                            content={<CustomTooltip />}
                          />
                          <Bar
                            dataKey="value"
                            fill="#06b6d4"
                            radius={[5, 5, 0, 0]}
                            name="Count"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Project Progress */}
            {analytics.projectProgress.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="border-purple-200/40 dark:border-purple-900/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Activity className="w-4 h-4 text-purple-600" />
                      Project Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    {analytics.projectProgress.map(
                      (project, index) => (
                        <div key={index} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{
                                  backgroundColor:
                                    project.color,
                                }}
                              />
                              <span className="text-xs truncate">
                                {project.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-[9px] text-muted-foreground">
                                {project.completed}/
                                {project.total}
                              </span>
                              <Badge
                                variant="secondary"
                                className="text-[9px] h-4 px-1.5"
                              >
                                {project.completionRate.toFixed(
                                  0,
                                )}
                                %
                              </Badge>
                            </div>
                          </div>
                          <Progress
                            value={project.completionRate}
                            className="h-1.5"
                          />
                        </div>
                      ),
                    )}
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