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
import type { Task, TaskPriority } from "../types";
import {
  COLOR_PRIMARY,
  COLOR_GRADIENT_START,
  COLOR_GRADIENT_MID,
  COLOR_GRADIENT_END,
  COLOR_PASTEL_SKY,
  COLOR_PASTEL_MINT,
  COLOR_PASTEL_LAVENDER,
  COLOR_PASTEL_PINK,
  COLOR_PASTEL_PEACH,
  COLOR_BORDER_LIGHT,
  COLOR_BORDER_MEDIUM,
  COLOR_TEXT_SECONDARY,
  COLOR_BACKGROUND_WHITE,
  COLOR_SUCCESS,
  COLOR_INFO,
  COLOR_WARNING,
  COLOR_AWARD_STREAK,
  getColorWithOpacity,
} from "../lib/color-theme";

interface AnalyticsPanelProps {
  onClose: () => void;
}

// Enhanced Radial Progress Component - Power BI Style
function RadialProgress({
  value,
  size = 120,
  strokeWidth = 12,
  color,
  label,
  gradientStart,
  gradientEnd,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  label?: string;
  gradientStart?: string;
  gradientEnd?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;
  const gradientId = `radial-gradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className="transform -rotate-90 drop-shadow-lg"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradientStart || color} stopOpacity="1" />
            <stop offset="100%" stopColor={gradientEnd || color} stopOpacity="0.8" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-100 dark:text-gray-800"
          opacity={0.3}
        />
        {/* Progress circle with gradient */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          filter="url(#glow)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span 
          className="text-2xl font-bold"
          style={{ 
            background: gradientStart && gradientEnd 
              ? `linear-gradient(135deg, ${gradientStart}, ${gradientEnd})`
              : color,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {Math.round(value)}%
        </span>
        {label && (
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

// Enhanced Custom Tooltip - Power BI Style
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div 
        className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-2xl border-2 backdrop-blur-lg"
        style={{ 
          borderColor: getColorWithOpacity(COLOR_PRIMARY, 0.2),
          boxShadow: `0 8px 32px ${getColorWithOpacity(COLOR_PRIMARY, 0.15)}`
        }}
      >
        <p className="text-sm mb-2 font-bold" style={{ color: COLOR_PRIMARY }}>{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => {
            // Format time in hours and minutes
            const formatTime = (minutes: number) => {
              const hours = Math.floor(minutes / 60);
              const mins = Math.round(minutes % 60);
              if (hours > 0) {
                return `${hours}h ${mins}m`;
              }
              return `${mins}m`;
            };
            
            const value = entry.dataKey === 'minutes' 
              ? formatTime(entry.value)
              : typeof entry.value === "number"
                ? entry.value.toFixed(1)
                : entry.value;
            
            return (
              <div key={index} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                    {entry.name}:
                  </span>
                  <span 
                    className="text-sm font-bold"
                    style={{ color: entry.color }}
                  >
                    {value}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
}

// Custom Y-axis formatter for time display
const formatYAxisTime = (value: number) => {
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}m`;
};

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
    <div className="h-full flex flex-col bg-gradient-to-br from-[#E6D5F0]/35 via-[#C9E4F7]/35 to-[#B8E6D5]/35 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      {/* Header */}
      <AppHeader
        title="Analytics"
        panelOpen={true}
        isSidePanelHeader={true}
        description="Visual insights & Pomodoro tracking"
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
      {/* Spacer for fixed header on mobile */}
      <div className="md:hidden h-[64px]" />

      {/* Content */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4 pt-6 md:pt-4 pb-safe md:pb-4" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}>
            {/* Pomodoro Time Tracking - Redesigned Hero Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
            >
              <Card 
                className="relative overflow-hidden border-2 shadow-lg"
                style={{ 
                  borderColor: getColorWithOpacity(COLOR_PRIMARY, 0.4),
                  background: `linear-gradient(to bottom right, ${getColorWithOpacity(COLOR_PASTEL_LAVENDER, 0.8)}, ${getColorWithOpacity(COLOR_PASTEL_SKY, 0.8)}, ${getColorWithOpacity(COLOR_PASTEL_MINT, 0.8)})`
                }}
              >
                {/* Decorative background elements */}
                <div 
                  className="absolute top-0 right-0 w-40 h-40 rounded-full -mr-20 -mt-20 blur-xl"
                  style={{ 
                    background: `linear-gradient(to bottom right, ${getColorWithOpacity(COLOR_PRIMARY, 0.15)}, ${getColorWithOpacity(COLOR_GRADIENT_MID, 0.15)})`
                  }}
                />
                <div 
                  className="absolute bottom-0 left-0 w-32 h-32 rounded-full -ml-16 -mb-16 blur-xl"
                  style={{ 
                    background: `linear-gradient(to top right, ${getColorWithOpacity(COLOR_PASTEL_PINK, 0.1)}, ${getColorWithOpacity(COLOR_GRADIENT_END, 0.1)})`
                  }}
                />
                
                <CardHeader className="pb-3 pt-5 relative z-10">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2.5 text-lg font-bold">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
                        style={{ 
                          background: `linear-gradient(to bottom right, ${COLOR_PRIMARY}, ${COLOR_GRADIENT_MID})`
                        }}
                      >
                        <Timer className="w-5 h-5 text-white" />
                      </div>
                      <span 
                        className="bg-clip-text text-transparent"
                        style={{ 
                          backgroundImage: `linear-gradient(to right, ${COLOR_GRADIENT_START}, ${COLOR_GRADIENT_MID}, ${COLOR_GRADIENT_END})`
                        }}
                      >
                        Pomodoro Time Tracking
                      </span>
                    </CardTitle>
                    <Badge 
                      variant="outline" 
                      className="bg-white/60 dark:bg-gray-900/60"
                      style={{ borderColor: getColorWithOpacity(COLOR_PRIMARY, 0.3) }}
                    >
                      <Award className="w-3 h-3 mr-1.5" style={{ color: COLOR_PRIMARY }} />
                      {analytics.tasksWithTime} tasks
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="relative z-10 pb-5">
                  {/* Main Stats Grid - Redesigned */}
                  <div className="flex flex-row sm:grid sm:grid-cols-3 gap-2 sm:gap-4 mb-4 overflow-x-auto">
                    {/* Total Time */}
                    <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm rounded-2xl p-3 sm:p-4 border border-white/50 dark:border-gray-800/50 shadow-md hover:shadow-lg transition-shadow flex-shrink-0 min-w-[100px] sm:min-w-0">
                      <div className="flex flex-col items-center">
                        <div 
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 shadow-sm"
                          style={{ 
                            background: `linear-gradient(to bottom right, ${COLOR_GRADIENT_START}, ${COLOR_GRADIENT_MID})`
                          }}
                        >
                          <Timer className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </div>
                        <div 
                          className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent mb-1"
                          style={{ 
                            backgroundImage: `linear-gradient(to right, ${COLOR_GRADIENT_START}, ${COLOR_GRADIENT_MID})`
                          }}
                        >
                          {Math.floor(analytics.totalTimeTracked / 60)}
                          <span className="text-lg text-gray-500 dark:text-gray-400">h</span>{" "}
                          {analytics.totalTimeTracked % 60}
                          <span className="text-lg text-gray-500 dark:text-gray-400">m</span>
                        </div>
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-1">
                          Total Time
                        </p>
                      </div>
                    </div>
                    
                    {/* This Week */}
                    <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm rounded-2xl p-3 sm:p-4 border border-white/50 dark:border-gray-800/50 shadow-md hover:shadow-lg transition-shadow flex-shrink-0 min-w-[100px] sm:min-w-0">
                      <div className="flex flex-col items-center">
                        <div 
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 shadow-sm"
                          style={{ 
                            background: `linear-gradient(to bottom right, ${COLOR_PASTEL_MINT}, ${COLOR_GRADIENT_END})`
                          }}
                        >
                          <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </div>
                        <div 
                          className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent mb-1"
                          style={{ 
                            backgroundImage: `linear-gradient(to right, ${COLOR_PASTEL_MINT}, ${COLOR_GRADIENT_END})`
                          }}
                        >
                          {Math.floor(analytics.weeklyTimeTracked / 60)}
                          <span className="text-lg text-gray-500 dark:text-gray-400">h</span>{" "}
                          {analytics.weeklyTimeTracked % 60}
                          <span className="text-lg text-gray-500 dark:text-gray-400">m</span>
                        </div>
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-1">
                          This Week
                        </p>
                      </div>
                    </div>
                    
                    {/* Avg/Task */}
                    <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm rounded-2xl p-3 sm:p-4 border border-white/50 dark:border-gray-800/50 shadow-md hover:shadow-lg transition-shadow flex-shrink-0 min-w-[100px] sm:min-w-0">
                      <div className="flex flex-col items-center">
                        <div 
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 shadow-sm"
                          style={{ 
                            background: `linear-gradient(to bottom right, ${COLOR_WARNING}, ${COLOR_AWARD_STREAK})`
                          }}
                        >
                          <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </div>
                        <div 
                          className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent mb-1"
                          style={{ 
                            backgroundImage: `linear-gradient(to right, ${COLOR_WARNING}, ${COLOR_AWARD_STREAK})`
                          }}
                        >
                          {Math.floor(analytics.avgTimePerTask / 60)}
                          <span className="text-lg text-gray-500 dark:text-gray-400">h</span>{" "}
                          {Math.round(analytics.avgTimePerTask % 60)}
                          <span className="text-lg text-gray-500 dark:text-gray-400">m</span>
                        </div>
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-1">
                          Avg/Task
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Summary Footer */}
                  <div className="flex items-center justify-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm rounded-xl p-3 border border-white/50 dark:border-gray-800/50">
                    <div className="flex items-center gap-1.5">
                      <div 
                        className="w-2 h-2 rounded-full animate-pulse"
                        style={{ backgroundColor: COLOR_PRIMARY }}
                      />
                      <span>Active tracking across {analytics.tasksWithTime} tasks</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Time Tracking Trend Chart - Enhanced Power BI Style */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <Card 
                className="relative overflow-hidden border-2 shadow-xl"
                style={{ 
                  borderColor: getColorWithOpacity(COLOR_PRIMARY, 0.3),
                  background: `linear-gradient(135deg, ${getColorWithOpacity(COLOR_PRIMARY, 0.08)}, ${getColorWithOpacity(COLOR_PASTEL_SKY, 0.12)})`
                }}
              >
                {/* Decorative elements */}
                <div 
                  className="absolute top-0 right-0 w-40 h-40 rounded-full -mr-20 -mt-20 blur-3xl opacity-20"
                  style={{ backgroundColor: COLOR_PRIMARY }}
                />
                <CardHeader className="pb-3 relative z-10">
                  <CardTitle className="flex items-center gap-2.5 text-base font-bold">
                    <div 
                      className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
                      style={{ 
                        background: `linear-gradient(135deg, ${COLOR_GRADIENT_START}, ${COLOR_GRADIENT_MID})` 
                      }}
                    >
                      <Activity className="w-5 h-5 text-white" />
                    </div>
                    <span style={{ color: COLOR_PRIMARY }}>
                      Time Tracked (Last 7 Days)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="h-72">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <ComposedChart
                        data={analytics.timeTrackingTrend}
                        margin={{
                          top: 20,
                          right: 20,
                          left: 0,
                          bottom: 10,
                        }}
                      >
                        <defs>
                          <linearGradient
                            id="timeBarGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor={COLOR_GRADIENT_START}
                              stopOpacity={1}
                            />
                            <stop
                              offset="50%"
                              stopColor={COLOR_GRADIENT_MID}
                              stopOpacity={0.9}
                            />
                            <stop
                              offset="100%"
                              stopColor={COLOR_GRADIENT_END}
                              stopOpacity={0.8}
                            />
                          </linearGradient>
                          <linearGradient
                            id="timeLineGradient"
                            x1="0"
                            y1="0"
                            x2="1"
                            y2="0"
                          >
                            <stop
                              offset="0%"
                              stopColor={COLOR_GRADIENT_START}
                              stopOpacity={1}
                            />
                            <stop
                              offset="50%"
                              stopColor={COLOR_GRADIENT_MID}
                              stopOpacity={1}
                            />
                            <stop
                              offset="100%"
                              stopColor={COLOR_GRADIENT_END}
                              stopOpacity={1}
                            />
                          </linearGradient>
                          <filter id="barGlow">
                            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                            <feMerge>
                              <feMergeNode in="coloredBlur"/>
                              <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                          </filter>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={COLOR_BORDER_LIGHT}
                          opacity={0.3}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: COLOR_TEXT_SECONDARY, fontWeight: 500 }}
                          stroke={COLOR_BORDER_MEDIUM}
                          style={{ fontFamily: 'system-ui' }}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: COLOR_TEXT_SECONDARY, fontWeight: 500 }}
                          width={50}
                          stroke={COLOR_BORDER_MEDIUM}
                          tickFormatter={formatYAxisTime}
                          style={{ fontFamily: 'system-ui' }}
                        />
                        <Tooltip 
                          content={<CustomTooltip />}
                          cursor={{ stroke: COLOR_PRIMARY, strokeWidth: 1, strokeDasharray: '5 5' }}
                        />
                        <Bar
                          dataKey="minutes"
                          fill="url(#timeBarGradient)"
                          radius={[10, 10, 0, 0]}
                          name="Time Tracked"
                          filter="url(#barGlow)"
                        />
                        <Line
                          type="monotone"
                          dataKey="minutes"
                          stroke="url(#timeLineGradient)"
                          strokeWidth={4}
                          dot={{ 
                            fill: COLOR_PRIMARY, 
                            strokeWidth: 3, 
                            stroke: COLOR_BACKGROUND_WHITE,
                            r: 6,
                            filter: "url(#barGlow)"
                          }}
                          activeDot={{ 
                            r: 9, 
                            fill: COLOR_PRIMARY,
                            stroke: COLOR_BACKGROUND_WHITE,
                            strokeWidth: 3,
                            filter: "url(#barGlow)"
                          }}
                          name="Trend"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Enhanced Summary Stats */}
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div 
                      className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm rounded-xl p-3 border-2 shadow-md"
                      style={{ borderColor: getColorWithOpacity(COLOR_GRADIENT_START, 0.2) }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div 
                          className="w-3 h-3 rounded shadow-sm"
                          style={{ background: `linear-gradient(135deg, ${COLOR_GRADIENT_START}, ${COLOR_GRADIENT_END})` }}
                        />
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                          Daily Average
                        </span>
                      </div>
                      <p className="text-lg font-bold" style={{ color: COLOR_PRIMARY }}>
                        {(() => {
                          const avg = analytics.timeTrackingTrend.reduce((sum, d) => sum + d.minutes, 0) / analytics.timeTrackingTrend.length;
                          const hours = Math.floor(avg / 60);
                          const mins = Math.round(avg % 60);
                          return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                        })()}
                      </p>
                    </div>
                    <div 
                      className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm rounded-xl p-3 border-2 shadow-md"
                      style={{ borderColor: getColorWithOpacity(COLOR_PRIMARY, 0.2) }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div 
                          className="w-3 h-3 rounded-full shadow-sm"
                          style={{ backgroundColor: COLOR_PRIMARY }}
                        />
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                          Peak Time
                        </span>
                      </div>
                      <p className="text-lg font-bold" style={{ color: COLOR_PRIMARY }}>
                        {(() => {
                          const peak = Math.max(...analytics.timeTrackingTrend.map(d => d.minutes));
                          const hours = Math.floor(peak / 60);
                          const mins = Math.round(peak % 60);
                          return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                        })()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Completion Rate with Enhanced Radial Progress - Power BI Style */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card 
                className="relative overflow-hidden border-2 shadow-xl"
                style={{ 
                  borderColor: getColorWithOpacity(COLOR_SUCCESS, 0.3),
                  background: `linear-gradient(135deg, ${getColorWithOpacity(COLOR_SUCCESS, 0.1)}, ${getColorWithOpacity(COLOR_PASTEL_MINT, 0.15)})`
                }}
              >
                {/* Decorative elements */}
                <div 
                  className="absolute top-0 right-0 w-32 h-32 rounded-full -mr-16 -mt-16 blur-2xl opacity-30"
                  style={{ backgroundColor: COLOR_SUCCESS }}
                />
                <CardHeader className="pb-3 relative z-10">
                  <CardTitle className="flex items-center gap-2.5 text-base font-bold">
                    <div 
                      className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
                      style={{ 
                        background: `linear-gradient(135deg, ${COLOR_SUCCESS}, ${COLOR_PASTEL_MINT})`
                      }}
                    >
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <span style={{ color: COLOR_SUCCESS }}>
                      Overall Progress
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="flex items-center justify-around gap-4">
                    <div className="flex flex-col items-center">
                      <RadialProgress
                        value={analytics.completionRate}
                        size={120}
                        strokeWidth={12}
                        color={COLOR_SUCCESS}
                        label="Complete"
                        gradientStart={COLOR_SUCCESS}
                        gradientEnd={COLOR_PASTEL_MINT}
                      />
                    </div>
                    <div className="flex flex-col gap-3 flex-1">
                      <div 
                        className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm rounded-xl p-3 border-2 shadow-md hover:shadow-lg transition-all"
                        style={{ borderColor: getColorWithOpacity(COLOR_SUCCESS, 0.2) }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle2 className="w-4 h-4" style={{ color: COLOR_SUCCESS }} />
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                            Completed
                          </p>
                        </div>
                        <p className="text-2xl font-bold" style={{ color: COLOR_SUCCESS }}>
                          {analytics.completedTasks}
                        </p>
                      </div>
                      <div 
                        className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm rounded-xl p-3 border-2 shadow-md hover:shadow-lg transition-all"
                        style={{ borderColor: getColorWithOpacity(COLOR_INFO, 0.2) }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Target className="w-4 h-4" style={{ color: COLOR_INFO }} />
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                            Total Tasks
                          </p>
                        </div>
                        <p className="text-2xl font-bold" style={{ color: COLOR_INFO }}>
                          {analytics.totalTasks}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div 
                    className="mt-4 bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm rounded-xl p-3 border-2"
                    style={{ borderColor: getColorWithOpacity(COLOR_SUCCESS, 0.15) }}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" style={{ color: COLOR_SUCCESS }} />
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                          Avg Completion Time
                        </span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: COLOR_SUCCESS }}>
                        {analytics.avgCompletionTime.toFixed(1)} days
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Productivity Trend - Enhanced Area Chart - Power BI Style */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card 
                className="relative overflow-hidden border-2 shadow-xl"
                style={{ 
                  borderColor: getColorWithOpacity(COLOR_INFO, 0.3),
                  background: `linear-gradient(135deg, ${getColorWithOpacity(COLOR_INFO, 0.08)}, ${getColorWithOpacity(COLOR_PASTEL_SKY, 0.12)})`
                }}
              >
                {/* Decorative elements */}
                <div 
                  className="absolute top-0 right-0 w-40 h-40 rounded-full -mr-20 -mt-20 blur-3xl opacity-20"
                  style={{ backgroundColor: COLOR_INFO }}
                />
                <CardHeader className="pb-3 relative z-10">
                  <CardTitle className="flex items-center gap-2.5 text-base font-bold">
                    <div 
                      className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
                      style={{ 
                        background: `linear-gradient(135deg, ${COLOR_INFO}, ${COLOR_PASTEL_SKY})`
                      }}
                    >
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <span style={{ color: COLOR_INFO }}>
                      Productivity Trend (7 Days)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="h-64">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <AreaChart
                        data={analytics.taskPerDayProgress}
                        margin={{
                          top: 15,
                          right: 15,
                          left: 0,
                          bottom: 10,
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
                              offset="0%"
                              stopColor={COLOR_SUCCESS}
                              stopOpacity={0.6}
                            />
                            <stop
                              offset="50%"
                              stopColor={COLOR_SUCCESS}
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="100%"
                              stopColor={COLOR_SUCCESS}
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
                              offset="0%"
                              stopColor={COLOR_INFO}
                              stopOpacity={0.6}
                            />
                            <stop
                              offset="50%"
                              stopColor={COLOR_INFO}
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="100%"
                              stopColor={COLOR_INFO}
                              stopOpacity={0.05}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={COLOR_BORDER_LIGHT}
                          opacity={0.3}
                        />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: COLOR_TEXT_SECONDARY, fontWeight: 500 }}
                          stroke={COLOR_BORDER_MEDIUM}
                          style={{ fontFamily: 'system-ui' }}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: COLOR_TEXT_SECONDARY, fontWeight: 500 }}
                          width={40}
                          stroke={COLOR_BORDER_MEDIUM}
                          style={{ fontFamily: 'system-ui' }}
                        />
                        <Tooltip 
                          content={<CustomTooltip />}
                          cursor={{ stroke: COLOR_PRIMARY, strokeWidth: 1, strokeDasharray: '5 5' }}
                        />
                        <Legend
                          wrapperStyle={{
                            fontSize: "11px",
                            paddingTop: "10px",
                            fontWeight: 500,
                          }}
                          iconSize={12}
                          iconType="circle"
                        />
                        <Area
                          type="monotone"
                          dataKey="completed"
                          stroke={COLOR_SUCCESS}
                          strokeWidth={3}
                          fill="url(#completedGrad)"
                          name="Completed"
                          dot={{ fill: COLOR_SUCCESS, strokeWidth: 2, stroke: COLOR_BACKGROUND_WHITE, r: 4 }}
                          activeDot={{ r: 6, fill: COLOR_SUCCESS, stroke: COLOR_BACKGROUND_WHITE, strokeWidth: 2 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="created"
                          stroke={COLOR_INFO}
                          strokeWidth={3}
                          fill="url(#createdGrad)"
                          name="Created"
                          dot={{ fill: COLOR_INFO, strokeWidth: 2, stroke: COLOR_BACKGROUND_WHITE, r: 4 }}
                          activeDot={{ r: 6, fill: COLOR_INFO, stroke: COLOR_BACKGROUND_WHITE, strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Time Patterns - Enhanced Donut Chart - Power BI Style */}
            {analytics.timePatterns.blocks.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card 
                  className="relative overflow-hidden border-2 shadow-xl"
                  style={{ 
                    borderColor: getColorWithOpacity(COLOR_WARNING, 0.3),
                    background: `linear-gradient(135deg, ${getColorWithOpacity(COLOR_WARNING, 0.1)}, ${getColorWithOpacity(COLOR_PASTEL_PEACH, 0.15)})`
                  }}
                >
                  {/* Decorative elements */}
                  <div 
                    className="absolute bottom-0 left-0 w-36 h-36 rounded-full -ml-18 -mb-18 blur-3xl opacity-20"
                    style={{ backgroundColor: COLOR_WARNING }}
                  />
                  <CardHeader className="pb-3 relative z-10">
                    <CardTitle className="flex items-center gap-2.5 text-base font-bold">
                      <div 
                        className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
                        style={{ 
                          background: `linear-gradient(135deg, ${COLOR_WARNING}, ${COLOR_AWARD_STREAK})`
                        }}
                      >
                        <Clock className="w-5 h-5 text-white" />
                      </div>
                      <span style={{ color: COLOR_WARNING }}>
                        Time Patterns
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <div className="flex items-center justify-around gap-6">
                      <div className="relative">
                        <ResponsiveContainer
                          width={140}
                          height={140}
                        >
                          <PieChart>
                            <defs>
                              <filter id="pieGlow">
                                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                                <feMerge>
                                  <feMergeNode in="coloredBlur"/>
                                  <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                              </filter>
                            </defs>
                            <Pie
                              data={analytics.timePatterns.blocks}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={60}
                              paddingAngle={4}
                              dataKey="value"
                              stroke={COLOR_BACKGROUND_WHITE}
                              strokeWidth={2}
                            >
                              {analytics.timePatterns.blocks.map(
                                (entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={entry.color}
                                    filter="url(#pieGlow)"
                                  />
                                ),
                              )}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <div 
                            className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                            style={{ 
                              background: `linear-gradient(135deg, ${COLOR_WARNING}, ${COLOR_AWARD_STREAK})`
                            }}
                          >
                            <Clock className="w-6 h-6 text-white" />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2.5 flex-1">
                        {analytics.timePatterns.blocks.map(
                          (block, index) => (
                            <div
                              key={index}
                              className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm rounded-xl p-3 border-2 shadow-md hover:shadow-lg transition-all"
                              style={{ borderColor: getColorWithOpacity(block.color, 0.3) }}
                            >
                              <div className="flex items-center gap-2.5 mb-1">
                                <div
                                  className="w-4 h-4 rounded-full shadow-sm"
                                  style={{
                                    backgroundColor: block.color,
                                  }}
                                />
                                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                                  {block.name}
                                </p>
                              </div>
                              <p className="text-xl font-bold" style={{ color: block.color }}>
                                {block.value} tasks
                              </p>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                    <div 
                      className="mt-4 bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm rounded-xl p-3 border-2 text-center"
                      style={{ borderColor: getColorWithOpacity(COLOR_WARNING, 0.2) }}
                    >
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Zap className="w-4 h-4" style={{ color: COLOR_WARNING }} />
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                          Peak Hour
                        </p>
                      </div>
                      <p className="text-lg font-bold" style={{ color: COLOR_WARNING }}>
                        {peakHourLabel}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Task Types - Enhanced Horizontal Bar Chart - Power BI Style */}
            {analytics.taskTypes.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <Card 
                  className="relative overflow-hidden border-2 shadow-xl"
                  style={{ 
                    borderColor: getColorWithOpacity(COLOR_PRIMARY, 0.3),
                    background: `linear-gradient(135deg, ${getColorWithOpacity(COLOR_PRIMARY, 0.08)}, ${getColorWithOpacity(COLOR_PASTEL_LAVENDER, 0.12)})`
                  }}
                >
                  {/* Decorative elements */}
                  <div 
                    className="absolute top-0 right-0 w-40 h-40 rounded-full -mr-20 -mt-20 blur-3xl opacity-20"
                    style={{ backgroundColor: COLOR_PRIMARY }}
                  />
                  <CardHeader className="pb-3 relative z-10">
                    <CardTitle className="flex items-center gap-2.5 text-base font-bold">
                      <div 
                        className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
                        style={{ 
                          background: `linear-gradient(135deg, ${COLOR_PRIMARY}, ${COLOR_PASTEL_LAVENDER})`
                        }}
                      >
                        <Target className="w-5 h-5 text-white" />
                      </div>
                      <span style={{ color: COLOR_PRIMARY }}>
                        Top Task Tags
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <div className="h-64">
                      <ResponsiveContainer
                        width="100%"
                        height="100%"
                      >
                        <BarChart
                          data={analytics.taskTypes}
                          layout="vertical"
                          margin={{
                            top: 10,
                            right: 20,
                            left: 80,
                            bottom: 10,
                          }}
                        >
                          <defs>
                            <linearGradient
                              id="barGradient"
                              x1="0"
                              y1="0"
                              x2="1"
                              y2="0"
                            >
                              <stop
                                offset="0%"
                                stopColor={COLOR_GRADIENT_START}
                                stopOpacity={0.9}
                              />
                              <stop
                                offset="50%"
                                stopColor={COLOR_GRADIENT_MID}
                                stopOpacity={0.8}
                              />
                              <stop
                                offset="100%"
                                stopColor={COLOR_GRADIENT_END}
                                stopOpacity={0.7}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={COLOR_BORDER_LIGHT}
                            opacity={0.3}
                            horizontal={true}
                            vertical={false}
                          />
                          <XAxis
                            type="number"
                            tick={{ fontSize: 11, fill: COLOR_TEXT_SECONDARY, fontWeight: 500 }}
                            stroke={COLOR_BORDER_MEDIUM}
                            style={{ fontFamily: 'system-ui' }}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fontSize: 11, fill: COLOR_TEXT_SECONDARY, fontWeight: 500 }}
                            stroke={COLOR_BORDER_MEDIUM}
                            width={75}
                            style={{ fontFamily: 'system-ui' }}
                          />
                          <Tooltip
                            content={<CustomTooltip />}
                            cursor={{ fill: getColorWithOpacity(COLOR_PRIMARY, 0.1) }}
                          />
                          <Bar
                            dataKey="value"
                            fill="url(#barGradient)"
                            radius={[0, 8, 8, 0]}
                            name="Tasks"
                          >
                            {analytics.taskTypes.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={`url(#barGradient)`}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Project Progress - Enhanced Card Design - Power BI Style */}
            {analytics.projectProgress.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card 
                  className="relative overflow-hidden border-2 shadow-xl"
                  style={{ 
                    borderColor: getColorWithOpacity(COLOR_PRIMARY, 0.3),
                    background: `linear-gradient(135deg, ${getColorWithOpacity(COLOR_PRIMARY, 0.08)}, ${getColorWithOpacity(COLOR_PASTEL_LILAC, 0.12)})`
                  }}
                >
                  {/* Decorative elements */}
                  <div 
                    className="absolute bottom-0 left-0 w-36 h-36 rounded-full -ml-18 -mb-18 blur-3xl opacity-20"
                    style={{ backgroundColor: COLOR_PRIMARY }}
                  />
                  <CardHeader className="pb-3 relative z-10">
                    <CardTitle className="flex items-center gap-2.5 text-base font-bold">
                      <div 
                        className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
                        style={{ 
                          background: `linear-gradient(135deg, ${COLOR_PRIMARY}, ${COLOR_PASTEL_LILAC})`
                        }}
                      >
                        <Activity className="w-5 h-5 text-white" />
                      </div>
                      <span style={{ color: COLOR_PRIMARY }}>
                        Project Progress
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative z-10 space-y-3">
                    {analytics.projectProgress.map(
                      (project, index) => (
                        <div 
                          key={index} 
                          className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm rounded-xl p-4 border-2 shadow-md hover:shadow-lg transition-all"
                          style={{ borderColor: getColorWithOpacity(project.color, 0.3) }}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm"
                                style={{
                                  backgroundColor: project.color,
                                }}
                              />
                              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                                {project.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                {project.completed}/{project.total}
                              </span>
                              <Badge
                                className="text-xs h-5 px-2 font-bold shadow-sm"
                                style={{ 
                                  backgroundColor: getColorWithOpacity(project.color, 0.2),
                                  color: project.color,
                                  borderColor: getColorWithOpacity(project.color, 0.3)
                                }}
                              >
                                {project.completionRate.toFixed(0)}%
                              </Badge>
                            </div>
                          </div>
                          <div className="relative">
                            <Progress
                              value={project.completionRate}
                              className="h-3 rounded-full overflow-hidden"
                              style={{
                                backgroundColor: getColorWithOpacity(project.color, 0.1),
                              }}
                            />
                            <div
                              className="absolute top-0 left-0 h-3 rounded-full transition-all duration-500"
                              style={{
                                width: `${project.completionRate}%`,
                                background: `linear-gradient(90deg, ${project.color}, ${getColorWithOpacity(project.color, 0.7)})`,
                                boxShadow: `0 2px 8px ${getColorWithOpacity(project.color, 0.4)}`,
                              }}
                            />
                          </div>
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