import React, { useMemo, useState, useEffect } from "react";
import { motion } from "motion/react";
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
  Download,
} from "lucide-react";
import { AppHeader } from "./AppHeader";
import { HEADER_MOBILE_SAFE_AREA_SPACER, NAV_BAR_BOTTOM_PADDING_MOBILE, VIEWPORT_BREAKPOINTS } from "../lib/layout-constants";
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
  TIME_PERIODS,
  MINUTES_PER_HOUR,
  HOURS_PER_DAY,
  MILLISECONDS_PER_MINUTE,
  MILLISECONDS_PER_HOUR,
  MILLISECONDS_PER_DAY,
  PERCENTAGE_MULTIPLIER,
  LAST_7_DAYS_OFFSET,
  DAYS_IN_WEEK,
} from "../lib/business-constants";
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
import { cn } from "../lib/utils";
import { ANALYTICS_PDF_CONFIG, ANALYTICS_PDF_BUTTON } from "../lib/analytics-constants";
import jsPDF from "jspdf";

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
              const hours = Math.floor(value / MINUTES_PER_HOUR);
              const minutes = Math.round(value % MINUTES_PER_HOUR);
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
  const gradient = `linear-gradient(180deg, ${getColorWithOpacity(color, 0.14)} 0%, ${getColorWithOpacity(color, 0.06)} 100%)`;
  return (
    <Card className="shadow-sm border border-border" style={{ backgroundImage: gradient, backgroundColor: getColorWithOpacity(color, 0.03) }}>
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
          <div className="text-[11px] text-muted-foreground">
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
  
  // Safety check: ensure tasks and projects are arrays
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeProjects = Array.isArray(projects) ? projects : [];
  
  // Track when panel is mounted to force chart animations
  const [chartKey, setChartKey] = useState(0);
  const [shouldAnimateCard, setShouldAnimateCard] = useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const hasTriggeredAnimationRef = React.useRef(false);
  const observerRef = React.useRef<IntersectionObserver | null>(null);
  
  // Theme-aware colors for charts
  const textColor = isDark ? '#A8A8B8' : '#6B7280'; // muted-foreground
  const textPrimaryColor = isDark ? '#E8E6F0' : '#111827'; // foreground
  const borderColor = isDark ? 'rgba(155, 135, 232, 0.2)' : '#E5E7EB'; // border

  // Calculate date range limit
  const dateRangeLimit = features?.analyticsDaysLimit;
  const maxDate = dateRangeLimit 
    ? new Date(Date.now() - (dateRangeLimit - 1) * MILLISECONDS_PER_DAY) // dateRangeLimit days ago
    : null; // null means unlimited

  // Compute analytics FIRST before using it in useEffect hooks
  const analytics = useMemo(() => {
    if (!Array.isArray(safeTasks) || safeTasks.length === 0) {
      return {
        totalTimeTracked: 0,
        tasksWithTime: 0,
        avgTimePerTask: 0,
        timeTrackingTrend: [],
        weeklyTimeTracked: 0,
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        todoTasks: 0,
        onHoldTasks: 0,
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
      ? safeTasks.filter((t) => {
          try {
            const taskDate = t?.updatedAt ? new Date(t.updatedAt) : (t?.createdAt ? new Date(t.createdAt) : null);
            if (!taskDate || isNaN(taskDate.getTime())) return true; // Include if no date
            return taskDate >= maxDate;
          } catch {
            return true; // Include if date parsing fails
          }
        })
      : safeTasks;

    // Time tracking
    const totalTimeTracked = filteredTasks.reduce((acc, task) => {
      try {
        return acc + (task?.actualTime || 0);
      } catch {
        return acc;
      }
    }, 0);
    const tasksWithTime = filteredTasks.filter((t) => {
      try {
        return t?.actualTime && t.actualTime > 0;
      } catch {
        return false;
      }
    });
    const avgTimePerTask = tasksWithTime.length > 0
      ? tasksWithTime.reduce((acc, t) => {
          try {
            return acc + (t?.actualTime || 0);
          } catch {
            return acc;
          }
        }, 0) / tasksWithTime.length
      : 0;

    // Last 7 days time tracking (or up to dateRangeLimit if set)
    const daysToShow = dateRangeLimit && dateRangeLimit < DAYS_IN_WEEK ? dateRangeLimit : DAYS_IN_WEEK;
    const last7DaysTime = Array.from({ length: daysToShow }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (daysToShow - 1 - i));
      date.setHours(0, 0, 0, 0);
      return date;
    });

    const timeTrackingTrend = last7DaysTime.map((date) => {
      const tasksUpdatedThisDay = filteredTasks.filter((t) => {
        if (!t?.actualTime || t.actualTime <= 0 || !t?.updatedAt) return false;
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
      const timeTracked = tasksUpdatedThisDay.reduce((acc, t) => {
        try {
          return acc + (t?.actualTime || 0);
        } catch {
          return acc;
        }
      }, 0);
      return {
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        hours: (timeTracked / MINUTES_PER_HOUR).toFixed(1),
        minutes: timeTracked,
      };
    });

    // Weekly time
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const tasksTrackedThisWeek = filteredTasks.filter((t) => {
      if (!t?.actualTime || t.actualTime <= 0 || !t?.updatedAt) return false;
      try {
        const updatedDate = new Date(t.updatedAt);
        if (isNaN(updatedDate.getTime())) return false;
        updatedDate.setHours(0, 0, 0, 0);
        return updatedDate >= startOfWeek;
      } catch {
        return false;
      }
    });
    const weeklyTimeTracked = tasksTrackedThisWeek.reduce((acc, t) => {
      try {
        return acc + (t?.actualTime || 0);
      } catch {
        return acc;
      }
    }, 0);

    // Completion metrics (using filtered tasks)
    const totalTasks = filteredTasks.length;
    const completedTasks = filteredTasks.filter((t) => t?.status === "done").length;
    const inProgressTasks = filteredTasks.filter((t) => t?.status === "in-progress").length;
    const todoTasks = filteredTasks.filter((t) => t?.status === "todo").length;
    const onHoldTasks = filteredTasks.filter((t) => t?.status === "on-hold").length;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * PERCENTAGE_MULTIPLIER : 0;

    // Status distribution for pie chart - ensure all values are valid numbers
    const statusDistribution = [
      { name: 'Completed', value: Number(completedTasks) || 0, color: COLOR_SUCCESS },
      { name: 'In Progress', value: Number(inProgressTasks) || 0, color: COLOR_WARNING },
      { name: 'Todo', value: Number(todoTasks) || 0, color: COLOR_INFO },
      { name: 'On Hold', value: Number(onHoldTasks) || 0, color: '#EAB308' }, // Yellow for on-hold status
    ]
      .filter((item): item is { name: string; value: number; color: string } => {
        return (
          item !== null &&
          item !== undefined &&
          typeof item === 'object' &&
          'name' in item &&
          'value' in item &&
          'color' in item &&
          typeof item.name === 'string' &&
          typeof item.value === 'number' &&
          !isNaN(item.value) &&
          item.value > 0 &&
          typeof item.color === 'string'
        );
      })
      .map(item => ({
        name: String(item.name),
        value: Number(item.value),
        color: String(item.color),
      }));

    // Time patterns (using filtered tasks)
    const hourCounts = new Array(HOURS_PER_DAY).fill(0);
    filteredTasks.filter((t) => t?.completedAt).forEach((task) => {
      try {
        if (task?.completedAt) {
          const completedDate = new Date(task.completedAt);
          if (!isNaN(completedDate.getTime())) {
            const hour = completedDate.getHours();
            if (hour >= 0 && hour < HOURS_PER_DAY) hourCounts[hour]++;
          }
        }
      } catch {}
    });

    const morningTasks = hourCounts.slice(TIME_PERIODS.MORNING_START, TIME_PERIODS.MORNING_END).reduce((a, b) => a + b, 0);
    const afternoonTasks = hourCounts.slice(TIME_PERIODS.AFTERNOON_START, TIME_PERIODS.AFTERNOON_END).reduce((a, b) => a + b, 0);
    const eveningTasks = hourCounts.slice(TIME_PERIODS.EVENING_START, TIME_PERIODS.EVENING_END).reduce((a, b) => a + b, 0);
    const nightTasks = [...hourCounts.slice(TIME_PERIODS.DAY_START, TIME_PERIODS.DAY_END), ...hourCounts.slice(TIME_PERIODS.NIGHT_START, TIME_PERIODS.NIGHT_END)].reduce((a, b) => a + b, 0);

    const maxCount = hourCounts.length > 0 ? Math.max(...hourCounts) : 0;
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
      try {
        if (task?.tags && Array.isArray(task.tags)) {
          task.tags.forEach((tag: string) => {
            if (tag) {
              typeCount[tag] = (typeCount[tag] || 0) + 1;
            }
          });
        }
      } catch (error) {
        console.warn('Error processing task tags:', error);
      }
    });
    const taskTypes = Object.entries(typeCount)
      .map(([name, value]) => ({ name, value, color: COLOR_PRIMARY }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Task per day progress
    const last7Days = Array.from({ length: DAYS_IN_WEEK }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (LAST_7_DAYS_OFFSET - i));
      date.setHours(0, 0, 0, 0);
      return date;
    });

    const taskPerDayProgress = last7Days.map((date) => {
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      const completed = filteredTasks.filter((t) => {
        if (!t?.completedAt) return false;
        try {
          const completedDate = new Date(t.completedAt);
          if (isNaN(completedDate.getTime())) return false;
          return completedDate >= date && completedDate < nextDay;
        } catch {
          return false;
        }
      }).length;

      const created = filteredTasks.filter((t) => {
        if (!t?.createdAt) return false;
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
    const projectProgress = Array.isArray(safeProjects) && safeProjects.length > 0
      ? safeProjects
          .map((project) => {
            if (!project || !project.id) return null;
            try {
              const projectTasks = filteredTasks.filter((t) => t?.projectId === project.id);
              const totalProjectTasks = projectTasks.length;
              const completedProjectTasks = projectTasks.filter((t) => t?.status === "done").length;
              const projectCompletionRate = totalProjectTasks > 0
                ? (completedProjectTasks / totalProjectTasks) * PERCENTAGE_MULTIPLIER
                : 0;
              return {
                name: project.name || 'Unnamed Project',
                total: totalProjectTasks,
                completed: completedProjectTasks,
                completionRate: projectCompletionRate,
                color: project.color || COLOR_PRIMARY,
              };
            } catch (error) {
              console.warn('Error processing project for analytics:', error);
              return null;
            }
          })
          .filter((p): p is NonNullable<typeof p> => p !== null)
          .sort((a, b) => b.completionRate - a.completionRate)
          .slice(0, 5)
      : [];

    // Avg completion time (using filtered tasks)
    const completedWithDates = filteredTasks.filter((t) => {
      if (!t?.completedAt || !t?.createdAt) return false;
      try {
        const created = new Date(t?.createdAt);
        const completed = new Date(t?.completedAt);
        return !isNaN(created.getTime()) && !isNaN(completed.getTime());
      } catch {
        return false;
      }
    });
    const avgCompletionTime = completedWithDates.length > 0
      ? completedWithDates.reduce((acc, task) => {
          try {
            if (!task?.createdAt || !task?.completedAt) return acc;
            const created = new Date(task?.createdAt).getTime();
            const completed = new Date(task?.completedAt).getTime();
            if (isNaN(created) || isNaN(completed)) return acc;
            return acc + (completed - created);
          } catch {
            return acc;
          }
        }, 0) / completedWithDates.length / MILLISECONDS_PER_DAY
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
      onHoldTasks,
      completionRate,
      timePatterns,
      taskTypes,
      taskPerDayProgress,
      projectProgress,
      avgCompletionTime,
      statusDistribution,
    };
  }, [safeTasks, safeProjects, maxDate, dateRangeLimit]);

  // Helper function to convert hex color to RGB for jsPDF
  const hexToRgb = (hex: string): [number, number, number] => {
    try {
      const cleanHex = hex.replace('#', '');
      const r = parseInt(cleanHex.substring(0, 2), 16);
      const g = parseInt(cleanHex.substring(2, 4), 16);
      const b = parseInt(cleanHex.substring(4, 6), 16);
      return [r, g, b];
    } catch {
      return [0, 0, 0]; // Default to black if parsing fails
    }
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: ANALYTICS_PDF_CONFIG.orientation,
        unit: ANALYTICS_PDF_CONFIG.unit,
        format: ANALYTICS_PDF_CONFIG.pageSize,
      });

      let yPos = ANALYTICS_PDF_CONFIG.margins.top;
      const pageHeight = doc.internal.pageSize.getHeight();

      // Title
      doc.setFontSize(ANALYTICS_PDF_CONFIG.fontSizes.title);
      const [r, g, b] = hexToRgb(ANALYTICS_PDF_CONFIG.colors.primary);
      doc.setTextColor(r, g, b);
      doc.text(ANALYTICS_PDF_CONFIG.labels.title, ANALYTICS_PDF_CONFIG.margins.left, yPos);
      yPos += ANALYTICS_PDF_CONFIG.spacing.afterTitle;

      // Date
      doc.setFontSize(ANALYTICS_PDF_CONFIG.fontSizes.small);
      const [r2, g2, b2] = hexToRgb(ANALYTICS_PDF_CONFIG.colors.textSecondary);
      doc.setTextColor(r2, g2, b2);
      doc.text(
        `${ANALYTICS_PDF_CONFIG.labels.generated} ${new Date().toLocaleDateString()}`,
        ANALYTICS_PDF_CONFIG.margins.left,
        yPos
      );
      yPos += ANALYTICS_PDF_CONFIG.spacing.afterDate;

      // Summary Statistics
      if (analytics) {
        doc.setFontSize(ANALYTICS_PDF_CONFIG.fontSizes.heading);
        const [r3, g3, b3] = hexToRgb(ANALYTICS_PDF_CONFIG.colors.text);
        doc.setTextColor(r3, g3, b3);
        doc.text(ANALYTICS_PDF_CONFIG.labels.summary, ANALYTICS_PDF_CONFIG.margins.left, yPos);
        yPos += ANALYTICS_PDF_CONFIG.spacing.afterHeading;

        doc.setFontSize(ANALYTICS_PDF_CONFIG.fontSizes.body);
        doc.text(
          `${ANALYTICS_PDF_CONFIG.labels.totalTasks} ${analytics.totalTasks || 0}`,
          ANALYTICS_PDF_CONFIG.margins.left,
          yPos
        );
        yPos += ANALYTICS_PDF_CONFIG.spacing.betweenItems;
        doc.text(
          `${ANALYTICS_PDF_CONFIG.labels.completed} ${analytics.completedTasks || 0}`,
          ANALYTICS_PDF_CONFIG.margins.left,
          yPos
        );
        yPos += ANALYTICS_PDF_CONFIG.spacing.betweenItems;
        doc.text(
          `${ANALYTICS_PDF_CONFIG.labels.inProgress} ${analytics.inProgressTasks || 0}`,
          ANALYTICS_PDF_CONFIG.margins.left,
          yPos
        );
        yPos += ANALYTICS_PDF_CONFIG.spacing.betweenItems;
        doc.text(
          `${ANALYTICS_PDF_CONFIG.labels.completionRate} ${analytics.completionRate?.toFixed(1) || 0}%`,
          ANALYTICS_PDF_CONFIG.margins.left,
          yPos
        );
        yPos += ANALYTICS_PDF_CONFIG.spacing.afterSection;

        // Time Tracking
        doc.setFontSize(ANALYTICS_PDF_CONFIG.fontSizes.heading);
        doc.text(ANALYTICS_PDF_CONFIG.labels.timeTracking, ANALYTICS_PDF_CONFIG.margins.left, yPos);
        yPos += ANALYTICS_PDF_CONFIG.spacing.afterHeading;

        doc.setFontSize(ANALYTICS_PDF_CONFIG.fontSizes.body);
        const totalHours = Math.floor(analytics.totalTimeTracked / MINUTES_PER_HOUR);
        const totalMinutes = Math.round(analytics.totalTimeTracked % MINUTES_PER_HOUR);
        doc.text(
          `${ANALYTICS_PDF_CONFIG.labels.totalTime} ${totalHours}${ANALYTICS_PDF_CONFIG.labels.hours} ${totalMinutes}${ANALYTICS_PDF_CONFIG.labels.minutes}`,
          ANALYTICS_PDF_CONFIG.margins.left,
          yPos
        );
        yPos += ANALYTICS_PDF_CONFIG.spacing.betweenItems;
        const weeklyHours = Math.floor(analytics.weeklyTimeTracked / MINUTES_PER_HOUR);
        const weeklyMinutes = Math.round(analytics.weeklyTimeTracked % MINUTES_PER_HOUR);
        doc.text(
          `${ANALYTICS_PDF_CONFIG.labels.thisWeek} ${weeklyHours}${ANALYTICS_PDF_CONFIG.labels.hours} ${weeklyMinutes}${ANALYTICS_PDF_CONFIG.labels.minutes}`,
          ANALYTICS_PDF_CONFIG.margins.left,
          yPos
        );
        yPos += ANALYTICS_PDF_CONFIG.spacing.betweenItems;
        if (analytics.avgTimePerTask > 0) {
          const avgHours = Math.floor(analytics.avgTimePerTask / MINUTES_PER_HOUR);
          const avgMinutes = Math.round(analytics.avgTimePerTask % MINUTES_PER_HOUR);
          doc.text(
            `${ANALYTICS_PDF_CONFIG.labels.avgPerTask} ${avgHours}${ANALYTICS_PDF_CONFIG.labels.hours} ${avgMinutes}${ANALYTICS_PDF_CONFIG.labels.minutes}`,
            ANALYTICS_PDF_CONFIG.margins.left,
            yPos
          );
          yPos += ANALYTICS_PDF_CONFIG.spacing.afterSection;
        }

        // Status Distribution
        if (analytics.statusDistribution && analytics.statusDistribution.length > 0) {
          doc.setFontSize(ANALYTICS_PDF_CONFIG.fontSizes.heading);
          doc.text(ANALYTICS_PDF_CONFIG.labels.statusDistribution, ANALYTICS_PDF_CONFIG.margins.left, yPos);
          yPos += ANALYTICS_PDF_CONFIG.spacing.afterHeading;

          doc.setFontSize(ANALYTICS_PDF_CONFIG.fontSizes.body);
          analytics.statusDistribution.forEach((status) => {
            if (yPos > pageHeight - ANALYTICS_PDF_CONFIG.margins.bottom - ANALYTICS_PDF_CONFIG.pageBreak.threshold) {
              doc.addPage();
              yPos = ANALYTICS_PDF_CONFIG.margins.top;
            }
            const percentage = analytics.totalTasks > 0
              ? ((status.value / analytics.totalTasks) * PERCENTAGE_MULTIPLIER).toFixed(1)
              : ANALYTICS_PDF_CONFIG.labels.fallbackPercentage;
            doc.text(
              `${status.name}: ${status.value} (${percentage}%)`,
              ANALYTICS_PDF_CONFIG.margins.left,
              yPos
            );
            yPos += ANALYTICS_PDF_CONFIG.spacing.betweenItems;
          });
          yPos += ANALYTICS_PDF_CONFIG.spacing.afterSection;
        }

        // Project Progress
        if (analytics.projectProgress && analytics.projectProgress.length > 0) {
          doc.setFontSize(ANALYTICS_PDF_CONFIG.fontSizes.heading);
          doc.text(ANALYTICS_PDF_CONFIG.labels.projectProgress, ANALYTICS_PDF_CONFIG.margins.left, yPos);
          yPos += ANALYTICS_PDF_CONFIG.spacing.afterHeading;

          doc.setFontSize(ANALYTICS_PDF_CONFIG.fontSizes.body);
          analytics.projectProgress.slice(0, ANALYTICS_PDF_CONFIG.limits.maxProjects).forEach((project) => {
            if (yPos > pageHeight - ANALYTICS_PDF_CONFIG.margins.bottom - ANALYTICS_PDF_CONFIG.pageBreak.threshold) {
              doc.addPage();
              yPos = ANALYTICS_PDF_CONFIG.margins.top;
            }
            doc.text(
              `${project.name}: ${project.completed}/${project.total} (${project.completionRate.toFixed(1)}%)`,
              ANALYTICS_PDF_CONFIG.margins.left,
              yPos
            );
            yPos += ANALYTICS_PDF_CONFIG.spacing.betweenItems;
          });
        }
      }

      // Save PDF
      const fileName = `${ANALYTICS_PDF_CONFIG.fileName}-${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("Error exporting PDF:", error);
    }
  };

  const peakHourLabel =
    analytics.timePatterns.peakHour === 0
      ? "12 AM"
      : analytics.timePatterns.peakHour < 12
        ? `${analytics.timePatterns.peakHour} AM`
        : analytics.timePatterns.peakHour === 12
          ? "12 PM"
          : `${analytics.timePatterns.peakHour - 12} PM`;
  
  // Reset animation state when panel opens
  useEffect(() => {
    hasTriggeredAnimationRef.current = false;
    setChartKey(0);
    setShouldAnimateCard(false);
    
    return () => {
      hasTriggeredAnimationRef.current = false;
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);
  
  // Use IntersectionObserver to detect when the pie chart card is visible and trigger animation
  useEffect(() => {
    // Only proceed if we have status distribution data
    if (!analytics || !analytics.statusDistribution || analytics.statusDistribution.length === 0) {
      return;
    }
    
    if (!cardRef.current) return;
    
    // Clean up any existing observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    
    // Check if card is already visible (e.g., at top of scroll area)
    const checkVisibility = () => {
      if (!cardRef.current) return false;
      try {
        const rect = cardRef.current.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
        return isVisible;
      } catch (error) {
        console.warn('Error checking card visibility:', error);
        return false;
      }
    };
    
    // If already visible, trigger animation immediately
    if (checkVisibility() && !hasTriggeredAnimationRef.current) {
      const timer = setTimeout(() => {
        if (!hasTriggeredAnimationRef.current) {
          setShouldAnimateCard(true);
          setChartKey(prev => prev + 1);
          hasTriggeredAnimationRef.current = true;
        }
      }, 200);
      return () => clearTimeout(timer);
    }
    
    // Otherwise, use IntersectionObserver for when it scrolls into view
    try {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio > 0.1 && !hasTriggeredAnimationRef.current) {
              // Card is visible, trigger animation
              setShouldAnimateCard(true);
              setChartKey(prev => prev + 1);
              hasTriggeredAnimationRef.current = true;
              if (observerRef.current) {
                observerRef.current.disconnect();
                observerRef.current = null;
              }
            }
          });
        },
        { threshold: 0.1, rootMargin: '50px' }
      );
      
      observerRef.current = observer;
      
      // Start observing after a delay to ensure card is in DOM
      const observeTimer = setTimeout(() => {
        if (cardRef.current && observerRef.current) {
          try {
            observerRef.current.observe(cardRef.current);
          } catch (error) {
            console.warn('Error observing card:', error);
          }
        }
      }, 300);
      
      return () => {
        clearTimeout(observeTimer);
        if (observerRef.current) {
          observerRef.current.disconnect();
          observerRef.current = null;
        }
      };
    } catch (error) {
      console.warn('Error setting up IntersectionObserver:', error);
      return;
    }
  }, [analytics?.statusDistribution?.length || 0]); // Use length with safe navigation

  const panelGradient = isDark
    ? 'linear-gradient(180deg, rgba(17,24,39,0.94) 0%, rgba(17,24,39,0.90) 40%, rgba(31,41,55,0.88) 100%)'
    : 'linear-gradient(180deg, rgba(248,245,255,0.96) 0%, rgba(244,240,255,0.94) 40%, rgba(255,255,255,0.92) 100%)';

  return (
    <div 
      className={cn("flex flex-col bg-background", typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.mobile ? 'min-h-full' : 'h-full')} 
      style={{ 
        backgroundImage: panelGradient,
      } as React.CSSProperties}
    >
      <AppHeader
        title="Analytics"
        panelOpen={true}
        isSidePanelHeader={true}
        description="Productivity insights"
        hideDesktopLogo
        actions={
          <div className="flex items-center" style={{ gap: ANALYTICS_PDF_BUTTON.gap }}>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleExportPDF}
              className="h-8 w-8"
              title="Download PDF Report"
            >
              <Download 
                className="w-4 h-4" 
                style={{ width: ANALYTICS_PDF_BUTTON.iconSize, height: ANALYTICS_PDF_BUTTON.iconSize }}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        }
      />

      {/* On mobile, rely on parent scroll container in App.tsx - no ScrollArea */}
      <div className="flex-1 min-h-0">
        {typeof window !== 'undefined' && window.innerWidth >= VIEWPORT_BREAKPOINTS.tablet ? (
        <ScrollArea className="h-full">
            <div className="p-4 space-y-4 pt-4 md:pt-4 pb-safe md:pb-4">
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
                value={`${Math.floor(analytics.totalTimeTracked / MINUTES_PER_HOUR)}h`}
                subtitle={`${Math.round(analytics.totalTimeTracked % MINUTES_PER_HOUR)}m total`}
                icon={Timer}
                color={COLOR_INFO}
              />
              <MetricCard
                title="This Week"
                value={`${Math.floor(analytics.weeklyTimeTracked / MINUTES_PER_HOUR)}h`}
                subtitle={`${Math.round(analytics.weeklyTimeTracked % MINUTES_PER_HOUR)}m`}
                icon={Calendar}
                color={COLOR_WARNING}
              />
            </div>

            {/* Status Distribution - Pie Chart */}
            {analytics?.statusDistribution && 
             Array.isArray(analytics.statusDistribution) && 
             analytics.statusDistribution.length > 0 &&
             analytics.statusDistribution.every(item => item && typeof item === 'object' && 'value' in item && 'name' in item) && (
              <motion.div
                ref={cardRef}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={shouldAnimateCard ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 20, scale: 0.95 }}
                transition={{
                  duration: 0.5,
                  ease: "easeOut",
                  delay: 0.1,
                }}
              >
                <Card className="shadow-sm border border-border bg-card">
                  <CardHeader className="pb-2 pt-3 px-3">
                    <CardTitle className="text-sm font-semibold text-foreground">
                      Task Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <div className="h-56" style={{ minHeight: '224px' }}>
                      {(() => {
                        try {
                          const validData = analytics?.statusDistribution?.filter(
                            (item: any) => item && typeof item === 'object' && item.value > 0 && item.name && item.color
                          ) || [];
                          
                          if (!validData || validData.length === 0) {
                            return (
                              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                No data available
                              </div>
                            );
                          }

                          // Double-check data is valid before rendering
                          const finalData = validData.filter((item: any) => {
                            return (
                              item &&
                              typeof item === 'object' &&
                              typeof item.name === 'string' &&
                              typeof item.value === 'number' &&
                              !isNaN(item.value) &&
                              item.value > 0 &&
                              typeof item.color === 'string'
                            );
                          });

                          if (finalData.length === 0) {
                            return (
                              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                No data available
                              </div>
                            );
                          }

                          return (
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart key={`piechart-${chartKey}`} margin={{ top: 10, right: 10, bottom: 40, left: 10 }}>
                                <Pie
                                  key={`pie-${chartKey}`}
                                  data={finalData}
                                  cx="50%"
                                  cy="45%"
                                  labelLine={false}
                                  label={false}
                                  outerRadius={65}
                                  innerRadius={0}
                                  fill={UI_CHART_COLORS?.primary || COLOR_PRIMARY}
                                  dataKey="value"
                                  isAnimationActive={false}
                                >
                                  {finalData.map((entry: any, index: number) => {
                                    if (!entry || !entry.name || !entry.color) return null;
                                    return (
                                      <Cell 
                                        key={`cell-${chartKey}-${index}-${String(entry.name)}`} 
                                        fill={String(entry.color)} 
                                      />
                                    );
                                  }).filter(Boolean)}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                {finalData.length > 0 && (
                                  <Legend 
                                    verticalAlign="bottom" 
                                    height={36}
                                    iconType="circle"
                                    wrapperStyle={{ paddingTop: '10px' }}
                                    formatter={(value: any) => {
                                      try {
                                        if (!value || typeof value !== 'string') return '';
                                        if (!analytics?.statusDistribution || !analytics?.totalTasks) {
                                          return `${value}: 0%`;
                                        }
                                        const item = analytics.statusDistribution.find((d: any) => d?.name === value);
                                        if (!item || typeof item.value !== 'number') return `${value}: 0%`;
                                        const percent = analytics.totalTasks > 0 
                                          ? ((item.value / analytics.totalTasks) * PERCENTAGE_MULTIPLIER).toFixed(0) 
                                          : '0';
                                        return `${value}: ${percent}%`;
                                      } catch (error) {
                                        console.warn('Error formatting legend:', error);
                                        return value ? `${String(value)}: 0%` : '';
                                      }
                                    }}
                                  />
                                )}
                              </PieChart>
                            </ResponsiveContainer>
                          );
                        } catch (error) {
                          console.error('Error rendering pie chart:', error);
                          return (
                            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                              Error loading chart
                            </div>
                          );
                        }
                      })()}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
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
                  {analytics?.timeTrackingTrend && Array.isArray(analytics.timeTrackingTrend) && analytics.timeTrackingTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.timeTrackingTrend.filter(item => item && typeof item === 'object')} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
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
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      No data available
                    </div>
                  )}
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
                  {analytics?.taskPerDayProgress && Array.isArray(analytics.taskPerDayProgress) && analytics.taskPerDayProgress.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={analytics.taskPerDayProgress.filter(item => item && typeof item === 'object')} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
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
                        isAnimationActive={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="completed" 
                        stroke={COLOR_SUCCESS} 
                        strokeWidth={2} 
                        dot={false} 
                        name="Completed"
                        isAnimationActive={true}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      No data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Time of Day Completion - Bar Chart */}
            {analytics?.timePatterns?.blocks && Array.isArray(analytics.timePatterns.blocks) && analytics.timePatterns.blocks.length > 0 && (
              <Card className="shadow-sm border border-border bg-card">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm font-semibold text-foreground">
                    Completion by Time of Day
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.timePatterns.blocks.filter(item => item && typeof item === 'object')} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
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
            {analytics?.taskTypes && Array.isArray(analytics.taskTypes) && analytics.taskTypes.length > 0 && (
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
                        data={analytics.taskTypes.filter(item => item && typeof item === 'object')}
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
      ) : (
          <div className="p-4 space-y-4 pt-4 md:pt-4" style={{ paddingBottom: typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.tablet ? '2rem' : undefined }}>
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
                value={`${Math.floor(analytics.totalTimeTracked / MINUTES_PER_HOUR)}h`}
                subtitle={`${Math.round(analytics.totalTimeTracked % MINUTES_PER_HOUR)}m total`}
                icon={Timer}
                color={COLOR_INFO}
              />
              <MetricCard
                title="This Week"
                value={`${Math.floor(analytics.weeklyTimeTracked / MINUTES_PER_HOUR)}h`}
                subtitle={`${Math.round(analytics.weeklyTimeTracked % MINUTES_PER_HOUR)}m`}
                icon={Calendar}
                color={COLOR_WARNING}
              />
            </div>

            {/* Status Distribution - Pie Chart */}
            {analytics?.statusDistribution && 
             Array.isArray(analytics.statusDistribution) && 
             analytics.statusDistribution.length > 0 &&
             analytics.statusDistribution.every(item => item && typeof item === 'object' && 'value' in item && 'name' in item) && (
              <motion.div
                ref={cardRef}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={shouldAnimateCard ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 20, scale: 0.95 }}
                transition={{
                  duration: 0.5,
                  ease: "easeOut",
                  delay: 0.1,
                }}
              >
                <Card className="shadow-sm border border-border bg-card">
                  <CardHeader className="pb-2 pt-3 px-3">
                    <CardTitle className="text-sm font-semibold text-foreground">
                      Task Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <div className="h-56" style={{ minHeight: '224px' }}>
                      {(() => {
                        try {
                          const validData = analytics?.statusDistribution?.filter(
                            (item: any) => item && typeof item === 'object' && item.value > 0 && item.name && item.color
                          ) || [];
                          
                          if (!validData || validData.length === 0) {
                            return (
                              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                No data available
                              </div>
                            );
                          }

                          const finalData = validData.filter((item: any) => {
                            return (
                              item &&
                              typeof item === 'object' &&
                              typeof item.name === 'string' &&
                              typeof item.value === 'number' &&
                              !isNaN(item.value) &&
                              item.value > 0 &&
                              typeof item.color === 'string'
                            );
                          });

                          if (finalData.length === 0) {
                            return (
                              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                No data available
                              </div>
                            );
                          }

                          return (
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart key={`piechart-${chartKey}`} margin={{ top: 10, right: 10, bottom: 40, left: 10 }}>
                                <Pie
                                  key={`pie-${chartKey}`}
                                  data={finalData}
                                  cx="50%"
                                  cy="45%"
                                  labelLine={false}
                                  label={false}
                                  outerRadius={65}
                                  innerRadius={0}
                                  fill={UI_CHART_COLORS?.primary || COLOR_PRIMARY}
                                  dataKey="value"
                                  isAnimationActive={false}
                                >
                                  {finalData.map((entry: any, index: number) => {
                                    if (!entry || !entry.name || !entry.color) return null;
                                    return (
                                      <Cell 
                                        key={`cell-${chartKey}-${index}-${String(entry.name)}`} 
                                        fill={String(entry.color)} 
                                      />
                                    );
                                  }).filter(Boolean)}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                {finalData.length > 0 && (
                                  <Legend 
                                    verticalAlign="bottom" 
                                    height={36}
                                    iconType="circle"
                                    wrapperStyle={{ paddingTop: '10px' }}
                                    formatter={(value: any) => {
                                      try {
                                        if (!value || typeof value !== 'string') return '';
                                        if (!analytics?.statusDistribution || !analytics?.totalTasks) {
                                          return `${value}: 0%`;
                                        }
                                        const item = analytics.statusDistribution.find((d: any) => d?.name === value);
                                        if (!item || typeof item.value !== 'number') return `${value}: 0%`;
                                        const percent = analytics.totalTasks > 0 
                                          ? ((item.value / analytics.totalTasks) * PERCENTAGE_MULTIPLIER).toFixed(0) 
                                          : '0';
                                        return `${value}: ${percent}%`;
                                      } catch (error) {
                                        console.warn('Error formatting legend:', error);
                                        return value ? `${String(value)}: 0%` : '';
                                      }
                                    }}
                                  />
                                )}
                              </PieChart>
                            </ResponsiveContainer>
                          );
                        } catch (error) {
                          console.error('Error rendering pie chart:', error);
                          return (
                            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                              Error loading chart
                            </div>
                          );
                        }
                      })()}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
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
                  {analytics?.timeTrackingTrend && Array.isArray(analytics.timeTrackingTrend) && analytics.timeTrackingTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.timeTrackingTrend.filter(item => item && typeof item === 'object')} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
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
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      No data available
                    </div>
                  )}
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
                  {analytics?.taskPerDayProgress && Array.isArray(analytics.taskPerDayProgress) && analytics.taskPerDayProgress.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={analytics.taskPerDayProgress.filter(item => item && typeof item === 'object')} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
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
                        isAnimationActive={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="completed" 
                        stroke={COLOR_SUCCESS} 
                        strokeWidth={2} 
                        dot={false} 
                        name="Completed"
                        isAnimationActive={true}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      No data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Time of Day Completion - Bar Chart */}
            {analytics?.timePatterns?.blocks && Array.isArray(analytics.timePatterns.blocks) && analytics.timePatterns.blocks.length > 0 && (
              <Card className="shadow-sm border border-border bg-card">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm font-semibold text-foreground">
                    Completion by Time of Day
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.timePatterns.blocks.filter(item => item && typeof item === 'object')} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
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
            {analytics?.taskTypes && Array.isArray(analytics.taskTypes) && analytics.taskTypes.length > 0 && (
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
                        data={analytics.taskTypes.filter(item => item && typeof item === 'object')}
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
      )}
      </div>
    </div>
  );
}
