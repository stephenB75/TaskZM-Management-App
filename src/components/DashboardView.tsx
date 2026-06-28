import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion } from "motion/react";
import { TodayAgendaView } from "./TodayAgendaView";
import { SevenDayKanban } from "./SevenDayKanban";
import { Confetti } from "./Confetti";
import { MonthCalendarView } from "./MonthCalendarView";
import { Icon } from "./Icon";
import {
  END_OF_DAY_HOUR,
  END_OF_DAY_MINUTE,
  END_OF_DAY_SECOND,
  END_OF_DAY_MILLISECOND,
  TWO_WEEKS_DAYS,
  DAYS_IN_WEEK,
  RECURRENCE_OCCURRENCE_ID_SUFFIX_COMPLETED,
  RECURRENCE_SERIES_OCCURRENCE_SEPARATOR,
} from "../lib/business-constants";
import { isDateInRecurrence } from "../lib/recurrence";
import { isSeriesBaseTask, hasSeriesOccurrenceForDate, dedupeTasksForDay } from "../lib/utils";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { CheckboxSwitch as Switch } from "./ui/checkbox-switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";
import { AIRecommendationPanel } from "./AIRecommendationPanel";
import { AppHeader } from "./AppHeader";
import { DashboardSchedulerActionButton } from "./DashboardSchedulerActionButton";
import { useTasks } from "../contexts/TaskContext";
import { useSubscription } from "../contexts/SubscriptionContext";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useCalendar } from "../contexts/CalendarContext";
import { logger } from "../lib/logger";
import { useAI } from "../contexts/AIContext";
import { useAIScheduler, type ScheduleResult } from "../hooks/useAIScheduler";
import { useCalendarEventCounts } from "../hooks/useCalendarEvents";
import { cn, sanitizeHTML, hasHTMLTags, getDateString, getWeekStart } from "../lib/utils";
import { toast } from "../lib/toast-wrapper";
import { playTaskCompleteSound } from "../lib/toast-sound";
import type { Task } from "../types";
import { 
  getCheckboxSizePxForWidth,
  getCheckboxVisualSizePxForWidth,
  TOGGLE_SWITCH_DIMENSIONS, 
  TOGGLE_SWITCH_SPACING, 
  TOGGLE_SWITCH_TEXT_SIZES, 
  HEADER_MOBILE_SAFE_AREA_SPACER, 
  VIEWPORT_BREAKPOINTS,
  HEADER_GAP_SMALL,
  HEADER_GAP_MEDIUM,
  HEADER_GAP_LARGE,
  HEADER_GAP_XSMALL,
  HEADER_CONTENT_PADDING_LEFT_MOBILE,
  HEADER_CONTENT_PADDING_LEFT_DESKTOP,
  HEADER_BUTTON_SCALE_SMALL,
  HEADER_BUTTON_SCALE_DESKTOP,
  HEADER_DESCRIPTION_SIZE,
  ICON_SIZE_XS,
  ICON_SIZE_SM,
  ICON_SIZE_MD,
  ICON_SIZE_LG,
  CALENDAR_CAROUSEL_DOTS_MAX_HEIGHT_PX,
  CALENDAR_CAROUSEL_DOTS_ROW_MAX_WIDTH_PX,
  CALENDAR_CAROUSEL_DOTS_MIN_HEIGHT_PX,
  CALENDAR_CAROUSEL_DONE_DOT_OPACITY,
  CALENDAR_CAROUSEL_DOT_SIZE_SMALL_PX,
  CALENDAR_CAROUSEL_DOT_SIZE_PX,
  CALENDAR_CAROUSEL_DAYS_PER_WEEK,
  CALENDAR_CAROUSEL_DAY_ABBREV_LENGTH,
  CALENDAR_DAY_NAMES,
  CALENDAR_CAROUSEL_NAV_BUTTON_SIZE_PX,
  CALENDAR_CAROUSEL_DAY_HEADER_FONT_SIZE,
  CALENDAR_CAROUSEL_DAY_HEADER_FONT_SIZE_SM,
  CALENDAR_CAROUSEL_GRID_GAP,
  CALENDAR_CAROUSEL_MAX_WIDTH_VIEWPORT,
  CALENDAR_CAROUSEL_PADDING_X,
  CALENDAR_CAROUSEL_PADDING_X_SM,
  CALENDAR_CAROUSEL_LAYOUT_FULL,
  CALENDAR_CAROUSEL_PADDING_B,
  CALENDAR_CAROUSEL_PADDING_B_SM,
  DASHBOARD_VIEW_HEADER_LABELS,
  DASHBOARD_WEEK_CAROUSEL,
  MOBILE_PADDING_BOTTOM,
  TOAST_DURATION_SHORT_MS,
  TOAST_DURATION_MEDIUM_MS,
} from "../lib/layout-constants";
import { UI_GRADIENT_COLORS, UI_INBOX_GRADIENTS } from "../lib/ui-colors";
import { TOGGLE_SWITCH_COLORS } from "../lib/ui-colors";
import { KANBAN_ANIMATION, KANBAN_WEEK_GROUP_HEADER, formatKanbanWeekGroupDateRange } from "../lib/kanban-constants";
import { useMobileLayout } from "../hooks/useMobileLayout";

interface DashboardViewProps {
  mobileView: "today" | "week";
  onMobileViewChange: (view: "today" | "week") => void;
  aiPanelOpen: boolean;
  onAiPanelChange: (open: boolean) => void;
  hideAgenda?: boolean;
  panelOpen?: boolean; // Indicates if a side panel is open (for header adjustment)
  panelKey?: string | number; // Key to track panel transitions
}

interface SchedulePlan {
  task: Task;
  scheduledDate: Date;
  reason?: string;
}

const getTwoWeekDateRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const mondayOffset = (day + (DAYS_IN_WEEK - 1)) % DAYS_IN_WEEK;
  start.setDate(start.getDate() - mondayOffset);
  const end = new Date(start);
  end.setDate(end.getDate() + (TWO_WEEKS_DAYS - 1));
  end.setHours(END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND, END_OF_DAY_MILLISECOND);
  return { startDate: start, endDate: end };
};

// Mini Calendar Component for AI Re-scheduler (matching TaskDialog style)
// Supports multi-day selection (up to 3 days) in "day" mode
function RescheduleMiniCalendar({
  rescheduleType,
  rescheduleDate,
  selectedDates = [],
  onTypeChange,
  onDateSelect,
  onMultiDateSelect,
}: {
  rescheduleType: "day" | "week" | "month";
  rescheduleDate: Date | undefined;
  selectedDates?: Date[];
  onTypeChange: (type: "day" | "week" | "month") => void;
  onDateSelect: (date: Date | undefined) => void;
  onMultiDateSelect?: (dates: Date[]) => void;
}) {
  const MAX_MULTI_SELECT_DAYS = 3;
  
  const [viewDate, setViewDate] = useState(() => {
    try {
      if (selectedDates.length > 0) {
        return selectedDates[0];
      }
      if (rescheduleDate && rescheduleDate instanceof Date && !isNaN(rescheduleDate.getTime())) {
        return rescheduleDate;
      }
      return new Date();
    } catch (error) {
      logger.error('Error initializing viewDate:', error);
      return new Date();
    }
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Sync view date when rescheduleDate changes
  useEffect(() => {
    try {
      if (selectedDates.length > 0) {
        setViewDate(selectedDates[0]);
      } else if (rescheduleDate && rescheduleDate instanceof Date && !isNaN(rescheduleDate.getTime())) {
        setViewDate(rescheduleDate);
      }
    } catch (error) {
      logger.error('Error syncing viewDate:', error);
    }
  }, [rescheduleDate, selectedDates]);

  // Generate days for the current month view
  const getDays = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay(); // 0 = Sunday
    
    const days: Date[] = [];
    const startDate = new Date(year, month, 1);
    
    // Adjust to start from a Sunday
    const daysToSubtract = startDay;
    startDate.setDate(startDate.getDate() - daysToSubtract);
    
    // Generate 35 days (5 weeks) for a full calendar grid
    for (let i = 0; i < 35; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }
    
    return days;
  };

  const days = getDays();
  const monthName = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const goToPreviousMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setViewDate(new Date());
  };

  const isToday = (date: Date) => {
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const isSelected = (date: Date) => {
    try {
      // For multi-day selection in "day" mode
      if (rescheduleType === "day" && selectedDates.length > 0) {
        return selectedDates.some(d => 
          d.getDate() === date.getDate() &&
          d.getMonth() === date.getMonth() &&
          d.getFullYear() === date.getFullYear()
        );
      }
      // For week/month modes, use single date
      if (!rescheduleDate || !(rescheduleDate instanceof Date) || isNaN(rescheduleDate.getTime())) {
        return false;
      }
      return date.getDate() === rescheduleDate.getDate() &&
             date.getMonth() === rescheduleDate.getMonth() &&
             date.getFullYear() === rescheduleDate.getFullYear();
    } catch (error) {
      logger.error('Error checking if date is selected:', error);
      return false;
    }
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === viewDate.getMonth() &&
           date.getFullYear() === viewDate.getFullYear();
  };

  const isDisabled = (date: Date) => {
    return date < today;
  };

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const handleDateClick = (date: Date) => {
    if (isDisabled(date)) return;
    try {
      // Multi-day selection for "day" mode
      if (rescheduleType === "day" && onMultiDateSelect) {
        const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        const isAlreadySelected = selectedDates.some(d => 
          `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === dateKey
        );
        
        if (isAlreadySelected) {
          // Remove the date
          const newDates = selectedDates.filter(d => 
            `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` !== dateKey
          );
          onMultiDateSelect(newDates);
        } else if (selectedDates.length < MAX_MULTI_SELECT_DAYS) {
          // Add the date (max 3)
          onMultiDateSelect([...selectedDates, date]);
        }
        // Also update single date to first selected for compatibility
        if (selectedDates.length === 0) {
          onDateSelect(date);
        }
      } else {
        // Single date selection for week/month modes
        onDateSelect(date);
      }
    } catch (error) {
      console.error('Error selecting date:', error);
    }
  };

  const getDisplayDate = () => {
    try {
      if (rescheduleType === "day" && selectedDates.length > 0) {
        // Show multiple selected dates
        if (selectedDates.length === 1) {
          return selectedDates[0].toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          });
        } else {
          const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
          return `${sortedDates.length} days: ${sortedDates.map(d => 
            d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          ).join(', ')}`;
        }
      }
      
      if (!rescheduleDate) return null;
      
      if (rescheduleType === "week") {
        const monday = new Date(rescheduleDate);
        const day = monday.getDay();
        const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
        monday.setDate(diff);
        return `Week starting: ${monday.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })}`;
      } else if (rescheduleType === "month") {
        return rescheduleDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      } else {
        return rescheduleDate.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
    } catch (error) {
      logger.error('Error formatting display date:', error);
      return null;
    }
  };

  return (
    <div className="w-full bg-white/80 dark:bg-gray-800/95 dark:border-gray-600 rounded-lg p-3 border-2 border-primary/30 dark:border-primary/20 shadow-lg">
      {/* Toggle Buttons */}
      <div className="flex gap-2 mb-3" data-tour="reschedule-dialog-options">
        <Button
          type="button"
          variant={rescheduleType === "day" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            try {
              onTypeChange("day");
            } catch (error) {
              logger.error('Error changing type to day:', error);
            }
          }}
          className={cn(
            "flex-1 text-xs h-8",
            rescheduleType === "day"
              ? "bg-primary text-primary-foreground"
              : "border-primary/20 hover:border-primary/40 hover:bg-primary/5 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          )}
        >
          <Icon name="calendar" size={ICON_SIZE_SM} className="mr-1.5" />
          Days
        </Button>
        <Button
          type="button"
          variant={rescheduleType === "week" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            try {
              onTypeChange("week");
            } catch (error) {
              logger.error('Error changing type to week:', error);
            }
          }}
          className={cn(
            "flex-1 text-xs h-8",
            rescheduleType === "week"
              ? "bg-primary text-primary-foreground"
              : "border-primary/20 hover:border-primary/40 hover:bg-primary/5 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          )}
        >
          <Icon name="calendar-days" size={ICON_SIZE_SM} className="mr-1.5" />
          Week
        </Button>
        <Button
          type="button"
          variant={rescheduleType === "month" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            try {
              onTypeChange("month");
            } catch (error) {
              logger.error('Error changing type to month:', error);
            }
          }}
          className={cn(
            "flex-1 text-xs h-8",
            rescheduleType === "month"
              ? "bg-primary text-primary-foreground"
              : "border-primary/20 hover:border-primary/40 hover:bg-primary/5 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          )}
        >
          <Icon name="calendar-days" size={ICON_SIZE_SM} className="mr-1.5" />
          Month
        </Button>
      </div>

      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-3 text-foreground dark:text-gray-100">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={goToPreviousMonth}
          className="h-7 w-7 dark:text-gray-200 dark:hover:bg-white/10"
        >
          <Icon name="chevron-left" size={ICON_SIZE_MD} />
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{monthName}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={goToToday}
            className="h-6 px-2 text-xs text-primary hover:bg-primary/10 dark:text-primary-foreground dark:hover:bg-primary/30"
          >
            Today
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={goToNextMonth}
          className="h-7 w-7 dark:text-gray-200 dark:hover:bg-white/10"
        >
          <Icon name="chevron-right" size={ICON_SIZE_MD} />
        </Button>
      </div>

      {/* Week day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-[10px] font-medium text-muted-foreground dark:text-gray-400 py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Date grid - showing 35 days (5 weeks) */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          const dateStr = getDateString(date);
          const day = date.getDate();
          const isTodayDate = isToday(date);
          const isSelectedDate = isSelected(date);
          const isCurrentMonthDate = isCurrentMonth(date);
          const isDisabledDate = isDisabled(date);

          return (
            <button
              key={`${dateStr}-${index}`}
              type="button"
              onClick={() => handleDateClick(date)}
              disabled={isDisabledDate}
              className={cn(
                "h-8 w-8 rounded-md text-xs font-medium transition-all hover:scale-110",
                isDisabledDate
                  ? "text-muted-foreground/30 dark:text-gray-600 cursor-not-allowed opacity-50"
                  : isSelectedDate
                  ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30"
                  : isTodayDate
                  ? "bg-primary/20 text-primary font-bold ring-1 ring-primary/30 hover:bg-primary/30 dark:bg-primary/50 dark:text-primary-foreground dark:hover:bg-primary/60"
                  : isCurrentMonthDate
                  ? "text-foreground hover:bg-primary/10 dark:text-gray-100 dark:hover:bg-gray-700"
                  : "text-muted-foreground/50 hover:bg-muted/50 dark:text-gray-500 dark:hover:bg-gray-700"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Selected date info */}
      {(rescheduleDate || (rescheduleType === "day" && selectedDates.length > 0)) && (
        <div className="mt-3 pt-3 border-t border-primary/20 dark:border-gray-600 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="calendar" size={ICON_SIZE_SM} className="text-primary" />
            <span className="text-xs font-medium text-foreground dark:text-gray-200">
              {getDisplayDate()}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onDateSelect(undefined);
              if (onMultiDateSelect) onMultiDateSelect([]);
            }}
            className="h-6 px-2 text-xs"
          >
            Clear
          </Button>
        </div>
      )}
      
      {/* Hint for multi-day selection */}
      {rescheduleType === "day" && (
        <div className="mt-2 text-[10px] text-muted-foreground text-center">
          Select up to 3 days to shuffle tasks between them
        </div>
      )}
    </div>
  );
}

export function DashboardView({
  mobileView,
  onMobileViewChange,
  aiPanelOpen,
  onAiPanelChange,
  hideAgenda = false,
  panelOpen = false,
  panelKey,
}: DashboardViewProps) {
  // Hooks must be called unconditionally (React Rules of Hooks)
  // Context hooks will throw if used outside providers - that's expected
  // and should be caught by Error Boundary, not try-catch here
  const tasksContext = useTasks();
  const subscriptionContext = useSubscription();
  const { settings: aiSettings } = useAI();
  const aiSchedulerContext = useAIScheduler();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const { accessToken } = useAuth();
  const { calendarStatus } = useCalendar();
  const shouldUseMobileLayout = useMobileLayout(); // Use mobile layout for tablets in portrait/landscape
  
  // Track screen size for responsive button sizing
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [showActionText, setShowActionText] = useState(false); // Show text labels for AI Suggestions and Re-Scheduler
  const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : VIEWPORT_BREAKPOINTS.desktop);
  useEffect(() => {
    let resizeTimeoutId: NodeJS.Timeout;
    const RESIZE_DEBOUNCE_MS = 150; // Debounce resize to reduce forced reflows

    const checkScreenSize = () => {
      // Use requestAnimationFrame to batch layout reads
      requestAnimationFrame(() => {
        const width = window.innerWidth;
        setIsSmallScreen(width >= VIEWPORT_BREAKPOINTS.tablet && width < VIEWPORT_BREAKPOINTS.desktop);
        // Show text labels only on screens >= 1400px to prevent overlap
        setShowActionText(width >= 1400);
        setScreenWidth(width);
      });
    };

    const debouncedCheckScreenSize = () => {
      if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId);
      }
      resizeTimeoutId = setTimeout(checkScreenSize, RESIZE_DEBOUNCE_MS);
    };

    // Initial check
    checkScreenSize();

    // Listen for resize with debouncing
    window.addEventListener('resize', debouncedCheckScreenSize, { passive: true });
    
    return () => {
      window.removeEventListener('resize', debouncedCheckScreenSize);
      if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId);
      }
    };
  }, []);

  // Calculate progressive button scale based on screen width
  // Desktop (1280px+): HEADER_BUTTON_SCALE_DESKTOP (0.85)
  // Small desktop (1024-1279px): Interpolated between 0.8 and 0.85
  // Tablet (768-1023px): HEADER_BUTTON_SCALE_SMALL (0.8)
  // Progressive scaling between breakpoints for smooth transitions
  const getButtonScale = () => {
    if (screenWidth >= VIEWPORT_BREAKPOINTS.desktop) {
      return HEADER_BUTTON_SCALE_DESKTOP; // 0.85
    } else if (screenWidth >= VIEWPORT_BREAKPOINTS.tablet) {
      // Between tablet and desktop: interpolate from 0.8 to 0.85
      const ratio = (screenWidth - VIEWPORT_BREAKPOINTS.tablet) / (VIEWPORT_BREAKPOINTS.desktop - VIEWPORT_BREAKPOINTS.tablet);
      return HEADER_BUTTON_SCALE_SMALL + (HEADER_BUTTON_SCALE_DESKTOP - HEADER_BUTTON_SCALE_SMALL) * ratio;
    } else {
      return HEADER_BUTTON_SCALE_SMALL; // 0.8
    }
  };

  const buttonScale = getButtonScale();
  
  // Confetti when marking a task complete (week view / today agenda in dashboard)
  const [confetti, setConfetti] = useState<{ show: boolean; origin: { x: number; y: number } | null }>({
    show: false,
    origin: null,
  });
  const confettiTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTaskComplete = useCallback((originElement?: HTMLElement | null) => {
    playTaskCompleteSound();
    let origin: { x: number; y: number } | null = null;
    if (originElement) {
      const rect = originElement.getBoundingClientRect();
      origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    setConfetti({ show: true, origin });
  }, []);

  useEffect(() => {
    return () => {
      if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
    };
  }, []);

  // Extract values with safe defaults
  const tasks = tasksContext?.tasks || [];
  const updateTask = tasksContext?.updateTask;
  const hasFeature = subscriptionContext?.hasFeature;
  const features = subscriptionContext?.features;
  const rescheduleDay = aiSchedulerContext?.rescheduleDay;
  const rescheduleDaysFunc = aiSchedulerContext?.rescheduleDays;
  const rescheduleWeek = aiSchedulerContext?.rescheduleWeek;
  const rescheduleMonth = aiSchedulerContext?.rescheduleMonth;
  const getScheduledTasksForDay = aiSchedulerContext?.getScheduledTasksForDay;
  const getScheduledTasksForWeek = aiSchedulerContext?.getScheduledTasksForWeek;
  const getScheduledTasksForMonth = aiSchedulerContext?.getScheduledTasksForMonth;
  const generateSchedulePlan = aiSchedulerContext?.generateSchedulePlan;

  // Safe wrapper for hasFeature
  const safeHasFeature = (feature: keyof import('../types').SubscriptionFeatures): boolean => {
    if (!hasFeature) return false;
    try {
      return hasFeature(feature);
    } catch (error) {
      logger.error('Error checking feature:', feature, error);
      return false;
    }
  };
  const [viewMode, setViewMode] = useState<"week" | "month">(
    "week",
  );

  // Listen for tour view mode changes
  useEffect(() => {
    const handleDashboardSetViewMode = (event: CustomEvent<{ mode: 'week' | 'month' }>) => {
      setViewMode(event.detail.mode);
    };

    window.addEventListener('dashboard-set-view-mode', handleDashboardSetViewMode as EventListener);

    return () => {
      window.removeEventListener('dashboard-set-view-mode', handleDashboardSetViewMode as EventListener);
    };
  }, []);
  const [showSchedulePreview, setShowSchedulePreview] =
    useState(false);
  const [schedulePlan, setSchedulePlan] = useState<
    SchedulePlan[]
  >([]);
  // Which AI schedule suggestions are selected to accept (task ids)
  const [selectedPlanTaskIds, setSelectedPlanTaskIds] = useState<Set<string>>(new Set());
  // Day index within the visible week carousel (0 = first column, respects week-start preference)
  const getDayIndexInVisibleWeek = (date: Date) => {
    const dayOfWeek = date.getDay(); // 0 (Sun) - 6 (Sat)
    if (getWeekStart() === 'sunday') {
      return dayOfWeek;
    }
    return (dayOfWeek + 6) % 7; // Monday = 0
  };

  const getCurrentDayIndex = () => getDayIndexInVisibleWeek(new Date());

  const getTomorrowDayIndex = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return getDayIndexInVisibleWeek(tomorrow);
  };

  const [mobileDayIndex, setMobileDayIndex] = useState(getTomorrowDayIndex());
  const [mobileWeekOffset, setMobileWeekOffset] = useState(0);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  
  // Swipe detection state for mobile calendar carousel
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  
  // Minimum swipe distance (in pixels) to trigger navigation
  const minSwipeDistance = 50;
  
  // Maximum vertical movement allowed (to distinguish horizontal swipes from vertical scrolls)
  const maxVerticalMovement = 30;
  const [rescheduleType, setRescheduleType] = useState<"day" | "week" | "month" | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined);
  const [rescheduleDates, setRescheduleDates] = useState<Date[]>([]); // Multi-day selection (up to 3)
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Tour demo: open/close dashboard scheduling dialogs without running AI
  useEffect(() => {
    const handleTourOpenSchedulePreview = () => {
      setSchedulePlan([]);
      setSelectedPlanTaskIds(new Set());
      setShowSchedulePreview(true);
    };

    const handleTourOpenRescheduleDialog = () => {
      setRescheduleType('day');
      setRescheduleDate(new Date());
      setRescheduleDates([]);
      setShowRescheduleDialog(true);
    };

    const handleTourCloseDashboardDialogs = () => {
      setShowSchedulePreview(false);
      setShowRescheduleDialog(false);
      setRescheduleType(null);
      setRescheduleDate(undefined);
      setRescheduleDates([]);
    };

    window.addEventListener('tour-open-schedule-preview', handleTourOpenSchedulePreview);
    window.addEventListener('tour-open-reschedule-dialog', handleTourOpenRescheduleDialog);
    window.addEventListener('tour-close-dashboard-dialogs', handleTourCloseDashboardDialogs);

    return () => {
      window.removeEventListener('tour-open-schedule-preview', handleTourOpenSchedulePreview);
      window.removeEventListener('tour-open-reschedule-dialog', handleTourOpenRescheduleDialog);
      window.removeEventListener('tour-close-dashboard-dialogs', handleTourCloseDashboardDialogs);
    };
  }, []);

  // Generate week columns for mobile day selector with week offset
  // Use getWeekStart() to respect user's week start preference (Sunday or Monday)
  const getWeekColumns = (weekOffset = 0) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start from the first day of the week based on weekStart setting
    const weekStart = getWeekStart();
    const startOfWeek = new Date(today);
    const dayOfWeek = startOfWeek.getDay(); // 0 (Sun) - 6 (Sat)
    
    let weekStartOffset: number;
    if (weekStart === 'sunday') {
      // Start from Sunday of the current week
      weekStartOffset = dayOfWeek === 0 ? 0 : dayOfWeek; // If today is Sunday, offset is 0
    } else {
      // Start from Monday of the current week
      weekStartOffset = (dayOfWeek + 6) % 7; // Convert to Monday=0
    }
    
    startOfWeek.setDate(startOfWeek.getDate() - weekStartOffset + weekOffset * 7);

    const daysToShow = CALENDAR_CAROUSEL_DAYS_PER_WEEK;

    return Array.from({ length: daysToShow }, (_, i) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);

      const dow = date.getDay();

      // Normalize date to local midnight to ensure consistent date string format
      // This prevents timezone issues when comparing dates
      // Use getDateString() for consistency with calendar event grouping
      const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dateString = getDateString(normalizedDate);

      return {
        date,
        dayName: CALENDAR_DAY_NAMES[dow],
        dateString,
        weekNumber: Math.floor(i / CALENDAR_CAROUSEL_DAYS_PER_WEEK) + 1,
        dayIndex: i,
      };
    });
  };

  // Memoize week columns first so visibleRange and calendar hooks never read an uninitialized value (TDZ-safe)
  const weekColumns = useMemo(
    () => getWeekColumns(mobileWeekOffset),
    [mobileWeekOffset]
  );

  const mobileWeekDateRange = useMemo(() => {
    const start = weekColumns[0]?.date;
    const end = weekColumns[weekColumns.length - 1]?.date;
    if (!start || !end) return null;
    return formatKanbanWeekGroupDateRange(start, end);
  }, [weekColumns]);

  const dashboardHeaderTitle = useMemo((): string | React.ReactNode => {
    if (
      shouldUseMobileLayout &&
      mobileView === "week" &&
      viewMode === "week" &&
      mobileWeekDateRange
    ) {
      return (
        <span className="inline-flex items-baseline gap-1.5 min-w-0 max-w-full">
          <span className="flex-shrink-0">{DASHBOARD_VIEW_HEADER_LABELS.week}</span>
          <span
            className="text-muted-foreground font-medium truncate normal-case tracking-normal"
            style={{ fontSize: HEADER_DESCRIPTION_SIZE }}
          >
            {mobileWeekDateRange}
          </span>
        </span>
      );
    }
    if (shouldUseMobileLayout) {
      if (mobileView === "today") return DASHBOARD_VIEW_HEADER_LABELS.today;
      return viewMode === "month"
        ? DASHBOARD_VIEW_HEADER_LABELS.month
        : DASHBOARD_VIEW_HEADER_LABELS.week;
    }
    return DASHBOARD_VIEW_HEADER_LABELS.dashboard;
  }, [shouldUseMobileLayout, mobileView, viewMode, mobileWeekDateRange]);

  // Compute visible date range (weekColumns is already initialized above)
  const visibleRange = React.useMemo(() => {
    if (!weekColumns.length) return null;
    const start = new Date(weekColumns[0].date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(weekColumns[weekColumns.length - 1].date);
    end.setHours(23, 59, 59, 999);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
    };
  }, [weekColumns]);

  // Fetch calendar events for the visible week to show dots on mobile day selector using optimized hook
  const startDate = useMemo(() => {
    if (!visibleRange) return new Date();
    return new Date(visibleRange.startIso);
  }, [visibleRange?.startIso]);

  const endDate = useMemo(() => {
    if (!visibleRange) return new Date();
    return new Date(visibleRange.endIso);
  }, [visibleRange?.endIso]);

  const { eventCounts: calendarEventsByDateData } = useCalendarEventCounts(
    startDate,
    endDate,
    {
      enabled: !!accessToken && !!visibleRange,
      debounceMs: 300,
    }
  );

  // Update day index to tomorrow when returning to current week
  useEffect(() => {
    if (mobileWeekOffset === 0) {
      setMobileDayIndex(getTomorrowDayIndex());
    }
  }, [mobileWeekOffset]);

  const handleWeekChange = (direction: "prev" | "next") => {
    if (direction === "next") {
      setMobileWeekOffset((prev) => prev + 1);
      setMobileDayIndex(0); // Reset to first day when going to next week
    } else {
      const newOffset = Math.max(0, mobileWeekOffset - 1);
      setMobileWeekOffset(newOffset);
      // If returning to current week (offset 0), set to tomorrow's day index
      if (newOffset === 0) {
        setMobileDayIndex(getTomorrowDayIndex());
      } else {
        setMobileDayIndex(0); // Reset to first day when going to previous week
      }
    }
  };

  // Touch handlers for swipe navigation
  const onTouchStart = (e: React.TouchEvent) => {
    // Only handle swipes on the calendar grid, not on buttons
    const target = e.target as HTMLElement;
    if (target.closest('button')) {
      return; // Don't interfere with button clicks
    }
    
    setTouchEnd(null); // Reset touchEnd
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart || !touchEnd) {
      setTouchStart(null);
      setTouchEnd(null);
      return;
    }
    
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = Math.abs(touchStart.y - touchEnd.y);
    
    // Only trigger swipe if horizontal movement is greater than vertical (horizontal swipe)
    // and exceeds minimum distance
    if (distanceY < maxVerticalMovement && Math.abs(distanceX) > minSwipeDistance) {
      const isLeftSwipe = distanceX > minSwipeDistance;
      const isRightSwipe = distanceX < -minSwipeDistance;

      if (isLeftSwipe) {
        // Swipe left = next week
        e.preventDefault(); // Prevent default to avoid conflicts
        handleWeekChange("next");
      } else if (isRightSwipe && mobileWeekOffset > 0) {
        // Swipe right = previous week (only if not at current week)
        e.preventDefault(); // Prevent default to avoid conflicts
        handleWeekChange("prev");
      }
    }
    
    // Reset touch state
    setTouchStart(null);
    setTouchEnd(null);
  };

  const getTasksForDay = useCallback((dateString: string) => {
    // Parse the date string to a Date object for recurring task check
    // dateString is in format "YYYY-MM-DD", parse it to local midnight
    const [year, month, day] = dateString.split('-').map(Number);
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      console.warn(`Invalid dateString format: ${dateString}`);
      return [];
    }
    // Create date in local timezone to match task scheduledDate normalization
    const checkDate = new Date(year, month - 1, day, 0, 0, 0, 0); // month is 0-indexed, set to midnight
    
    if (isNaN(checkDate.getTime())) {
      console.warn(`Invalid date created from dateString: ${dateString}`);
      return [];
    }
    
    const matchingTasks = tasks.filter((task) => {
      // Skip tasks without scheduled dates
      if (!task.scheduledDate) return false;
      
      try {
        // Use isDateInRecurrence to handle both recurring and non-recurring tasks
        // This ensures recurring tasks are counted on all days they occur
        // Include all tasks (including done) for dot display
        const matches = isDateInRecurrence(task, checkDate);
        
        // Debug: Log why tasks are/aren't matching
        if (import.meta.env.DEV && task.scheduledDate) {
          const taskDate = new Date(task.scheduledDate);
          const taskDateOnly = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
          const checkDateOnly = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());
          if (taskDateOnly.getTime() === checkDateOnly.getTime() && !matches) {
            console.warn(`[getTasksForDay] Task ${task.id} scheduledDate matches ${dateString} but isDateInRecurrence returned false`, {
              taskDate: task.scheduledDate,
              checkDate: dateString,
              taskRecurrence: task.recurrence,
              taskStatus: task.status
            });
          }
        }
        
        if (!matches) return false;
        // Show base only when no occurrence for this day; hide base when an occurrence exists (no duplicate).
        if (isSeriesBaseTask(task) && hasSeriesOccurrenceForDate(tasks, task.id, dateString)) return false;
        // Second line of defense: if this task's id is a base (no __) and an occurrence exists for this day, hide it. Catches base when recurrence was stripped after load/sync.
        if (!task.id.includes(RECURRENCE_SERIES_OCCURRENCE_SEPARATOR) && hasSeriesOccurrenceForDate(tasks, task.id, dateString)) return false;
        // Avoid duplicate: if this is a base recurring task and we have a completed occurrence for this day, show only the completed occurrence
        if (task.recurrence && task.recurrence.type !== 'none') {
          const completedOccurrenceId = `${task.id}${RECURRENCE_OCCURRENCE_ID_SUFFIX_COMPLETED}${dateString}`;
          if (tasks.some((t) => t.id === completedOccurrenceId)) return false;
        }
        return true;
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error(`Error checking task ${task.id} for date ${dateString}:`, error, task);
        }
        return false;
      }
    });
    
    // Debug logging (remove in production)
    if (import.meta.env.DEV) {
      if (matchingTasks.length > 0) {
        console.log(`Date ${dateString}: Found ${matchingTasks.length} task(s):`, 
          matchingTasks.map(t => ({ id: t.id, title: t.title, scheduledDate: t.scheduledDate, status: t.status }))
        );
      }
      // Also log total tasks for debugging
      const tasksWithScheduledDate = tasks.filter(t => t.scheduledDate);
      if (tasksWithScheduledDate.length > 0 && matchingTasks.length === 0) {
        console.log(`Date ${dateString}: No tasks matched. Total tasks with scheduledDate: ${tasksWithScheduledDate.length}`);
      }
    }
    
    return dedupeTasksForDay(matchingTasks, dateString);
  }, [tasks]);

  const handleScheduleUnscheduledTasks = async () => {
    if (!safeHasFeature('aiScheduler')) {
      toast.error('AI Scheduler is a Pro feature', {
        description: 'Upgrade to Pro to unlock AI-powered task scheduling.',
      });
      return;
    }

    if (features?.aiSchedulerLimit !== undefined) {
      const { hasReachedLimit, incrementAIUsage } = require('../lib/ai-scheduler-usage');
      if (hasReachedLimit(features.aiSchedulerLimit)) {
        toast.error('AI Scheduler limit reached', {
          description: `You've used ${features.aiSchedulerLimit}/${features.aiSchedulerLimit} AI suggestions this week. Upgrade to Pro for unlimited AI scheduling.`,
          action: {
            label: 'Upgrade',
            onClick: () => window.dispatchEvent(new CustomEvent('show-pricing-dialog')),
          },
        });
        return;
      }
      incrementAIUsage();
    }

    // Consistent definition: unscheduled = scheduledDate === null/undefined and not done
    // This includes: regular tasks, recurring tasks, and rollover tasks
    const unscheduledTasks = tasks.filter((t) => !t.scheduledDate && t.status !== "done");
    if (unscheduledTasks.length === 0) {
      toast.info("No unscheduled tasks found", {
        description: "All your tasks are already scheduled!",
      });
      return;
    }

    if (!generateSchedulePlan) {
      toast.error('Unable to start AI Scheduler', {
        description: 'Please try again in a moment.',
      });
      return;
    }

    // AI Suggestions: Generate suggestions using category hours for two week period
    // Start from TODAY (current date) to allow same-day scheduling
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + (TWO_WEEKS_DAYS - 1)); // 14 days total (today + 13 more)
    end.setHours(END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND, END_OF_DAY_MILLISECOND);
    const range = { startDate: today, endDate: end };
    const result = await generateSchedulePlan(undefined, range, { 
      forceCategoryHours: true,
      enforceMinimumHours: true // Always enforce 5-hour minimum before pushing to next day
    });

    if (result.scheduled.length === 0 && result.exceedsLimit.length === 0) {
      toast.info("No available time slots", {
        description: "AI Scheduler couldn't find any openings within the next two weeks.",
      });
      return;
    }

    setSchedulePlan(result.scheduled);
    setShowSchedulePreview(true);

    if (result.exceedsLimit.length > 0) {
      toast.warning(
        `${result.exceedsLimit.length} task${result.exceedsLimit.length === 1 ? '' : 's'} need manual scheduling`,
        {
          description: 'No available slots within the next two weeks for these tasks.',
          duration: 5000,
        }
      );
    }
  };

  const confirmScheduling = () => {
    const toApply = schedulePlan.filter((p) => selectedPlanTaskIds.has(p.task.id));
    if (toApply.length === 0) {
      toast.info("No suggestions selected", {
        description: "Select at least one suggestion to accept.",
      });
      return;
    }
    toApply.forEach(({ task, scheduledDate }) => {
      if (!updateTask) {
        console.error('updateTask is not available');
        return;
      }
      updateTask(task.id, {
        scheduledDate: scheduledDate.toISOString(),
      });
    });

    toast.success(
      `Successfully scheduled ${toApply.length} task${toApply.length === 1 ? "" : "s"}!`,
      {
        description:
          "Your selected tasks are now distributed across upcoming days",
        duration: TOAST_DURATION_SHORT_MS,
      },
    );

    setShowSchedulePreview(false);
    setSchedulePlan([]);
    setSelectedPlanTaskIds(new Set());
  };

  const togglePlanSelection = (taskId: string) => {
    setSelectedPlanTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const selectAllPlanSuggestions = () => {
    setSelectedPlanTaskIds(new Set(schedulePlan.map((p) => p.task.id)));
  };

  const deselectAllPlanSuggestions = () => {
    setSelectedPlanTaskIds(new Set());
  };

  const formatScheduleDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleOpenRescheduleDialog = useCallback(() => {
    if (isRescheduling) return;
    if (!safeHasFeature('aiScheduler')) {
      toast.error('Re-schedule is a Pro feature', {
        description: 'Upgrade to Pro to unlock AI-powered task rescheduling.',
      });
      return;
    }
    try {
      setShowRescheduleDialog(true);
    } catch (error) {
      console.error('Error opening reschedule dialog:', error);
      toast.error('Failed to open reschedule dialog', {
        description: 'Please try again',
        duration: TOAST_DURATION_SHORT_MS,
      });
    }
  }, [isRescheduling, safeHasFeature]);

  const handleRandomReschedule = async (type: "day" | "week" | "month", selectedDate?: Date, selectedDates: Date[] = []) => {
    // Check if user has access to AI Scheduler feature
    if (!safeHasFeature('aiScheduler')) {
      toast.error('Re-schedule is a Pro feature', {
        description: 'Upgrade to Pro to unlock AI-powered task rescheduling.',
      });
      return;
    }
    
    // For day mode with multi-selection, check selectedDates
    const hasMultipleDays = type === "day" && selectedDates.length > 1;
    
    if (!selectedDate && selectedDates.length === 0) {
      toast.error("Please select a date", {
        description: "You must select a specific date, week, or month to reschedule.",
        duration: 3000,
      });
      return;
    }

    // Validate date (for single date mode)
    if (!hasMultipleDays && selectedDate && (!(selectedDate instanceof Date) || isNaN(selectedDate.getTime()))) {
      toast.error("Invalid date selected", {
        description: "Please select a valid date.",
        duration: 3000,
      });
      return;
    }

    setIsRescheduling(true);
    setShowRescheduleDialog(false);
    setRescheduleDates([]); // Clear multi-selection after starting
    
    try {
      let result: ScheduleResult | undefined;
      let taskCount = 0;
      let description = "";

      try {
        if (type === "day") {
          // Handle multi-day selection (up to 3 days)
          if (hasMultipleDays) {
            // Count total tasks across all selected days
            const seenTaskIds = new Set<string>();
            for (const date of selectedDates) {
              const dayTasks = getScheduledTasksForDay ? getScheduledTasksForDay(date) : [];
              dayTasks.forEach((t: Task) => seenTaskIds.add(t.id));
            }
            taskCount = seenTaskIds.size;
            
            if (taskCount === 0) {
              const dateStr = selectedDates.map(d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })).join(', ');
              toast.info("No tasks found", {
                description: `No scheduled tasks found for ${dateStr}`,
                duration: 3000,
              });
              setIsRescheduling(false);
              return;
            }
            
            if (!rescheduleDaysFunc) {
              throw new Error('rescheduleDays is not available');
            }
            result = await rescheduleDaysFunc(selectedDates);
            const dateStr = selectedDates.map(d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })).join(', ');
            description = `Rescheduled ${result?.scheduled?.length || 0} task${(result?.scheduled?.length || 0) === 1 ? '' : 's'} across ${selectedDates.length} days (${dateStr})`;
          } else {
            // Single day selection
            const targetDate = new Date(selectedDate!);
            targetDate.setHours(0, 0, 0, 0);
            
            taskCount = getScheduledTasksForDay ? getScheduledTasksForDay(targetDate).length : 0;
            if (taskCount === 0) {
              toast.info("No tasks found", {
                description: `No scheduled tasks found for ${targetDate.toLocaleDateString()}`,
                duration: 3000,
              });
              setIsRescheduling(false);
              return;
            }
            
            if (!rescheduleDay) {
              throw new Error('rescheduleDay is not available');
            }
            result = await rescheduleDay(targetDate);
            description = `Rescheduled ${result?.scheduled?.length || 0} task${(result?.scheduled?.length || 0) === 1 ? '' : 's'} for ${targetDate.toLocaleDateString()}`;
          }
        } else if (type === "week") {
          // Calculate Monday of the selected week
          if (!selectedDate) {
            throw new Error('selectedDate is required for week reschedule');
          }
          const monday = new Date(selectedDate);
          const day = monday.getDay();
          const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
          monday.setDate(diff);
          monday.setHours(0, 0, 0, 0);
          
          taskCount = getScheduledTasksForWeek ? getScheduledTasksForWeek(monday).length : 0;
          if (taskCount === 0) {
            toast.info("No tasks found", {
              description: `No scheduled tasks found for the week starting ${monday.toLocaleDateString()}`,
              duration: 3000,
            });
            setIsRescheduling(false);
            return;
          }
          
          if (!rescheduleWeek) {
            throw new Error('rescheduleWeek is not available');
          }
          result = await rescheduleWeek(monday);
          description = `Rescheduled ${result?.scheduled?.length || 0} task${(result?.scheduled?.length || 0) === 1 ? '' : 's'} for the week starting ${monday.toLocaleDateString()}`;
        } else {
          // Use first day of the selected month
          if (!selectedDate) {
            throw new Error('selectedDate is required for month reschedule');
          }
          const targetMonth = new Date(selectedDate);
          targetMonth.setDate(1);
          targetMonth.setHours(0, 0, 0, 0);
          
          taskCount = getScheduledTasksForMonth ? getScheduledTasksForMonth(targetMonth).length : 0;
          if (taskCount === 0) {
            toast.info("No tasks found", {
              description: `No scheduled tasks found for ${targetMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
              duration: 3000,
            });
            setIsRescheduling(false);
            return;
          }
          
          if (!rescheduleMonth) {
            throw new Error('rescheduleMonth is not available');
          }
          result = await rescheduleMonth(targetMonth);
          description = `Rescheduled ${result?.scheduled?.length || 0} task${(result?.scheduled?.length || 0) === 1 ? '' : 's'} for ${targetMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
        }
      } catch (rescheduleError) {
        console.error(`Error during ${type} reschedule:`, rescheduleError);
        throw rescheduleError;
      }

      // Ensure result exists and has expected structure
      if (!result || typeof result !== 'object') {
        throw new Error("Invalid result from reschedule function");
      }

      // Safely access result properties with defaults
      const scheduledCount = result.scheduled?.length || 0;
      const exceedsLimitCount = result.exceedsLimit?.length || 0;
      const daysExceedingLimitCount = result.daysExceedingLimit?.length || 0;

      const maxHours = aiSettings.maxHoursPerDay ?? 5;
      // Check if any tasks exceeded the limit (couldn't be scheduled)
      if (exceedsLimitCount > 0) {
        toast.warning(
          `${exceedsLimitCount} task${exceedsLimitCount === 1 ? '' : 's'} could not be rescheduled`,
          {
            description: `These tasks exceed the ${maxHours}-hour daily limit and need manual scheduling.`,
            duration: 5000,
          }
        );
      }

      // Check if any days exceed the daily hour limit
      if (daysExceedingLimitCount > 0) {
        toast.warning(
          `${daysExceedingLimitCount} day${daysExceedingLimitCount === 1 ? '' : 's'} exceed${daysExceedingLimitCount === 1 ? 's' : ''} the ${maxHours}-hour limit`,
          {
            description: "Some tasks may need manual adjustment.",
            duration: 5000,
          }
        );
      }

      if (scheduledCount > 0) {
        toast.success(`Rescheduled ${scheduledCount} task${scheduledCount === 1 ? '' : 's'}!`, {
          description,
          duration: 4000,
        });
      } else if (exceedsLimitCount === 0 && daysExceedingLimitCount === 0) {
        toast.info("No tasks were rescheduled", {
          description: "No scheduled tasks were found for the selected period.",
          duration: 3000,
        });
      }
    } catch (error) {
      console.error("Rescheduling error:", error);
      toast.error("Rescheduling failed", {
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        duration: 4000,
      });
    } finally {
      setIsRescheduling(false);
    }
  };

  return (
    <>
      <Confetti
        trigger={confetti.show}
        origin={confetti.origin}
        onComplete={() => {
          if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
          confettiTimeoutRef.current = setTimeout(() => {
            setConfetti({ show: false, origin: null });
            confettiTimeoutRef.current = null;
          }, CONFETTI_RESET_DELAY_MS);
        }}
      />
      <div className={cn("h-full flex flex-col min-w-0 w-full max-w-full overflow-x-hidden", UI_GRADIENT_COLORS.dialog.className, "dark:from-gray-950 dark:via-gray-900 dark:to-gray-950")}>
      {/* Header - Using AppHeader for consistency */}
      <AppHeader
        title={dashboardHeaderTitle}
        panelOpen={panelOpen}
        panelKey={panelKey}
        actions={
          <div 
            className="flex items-center min-w-0"
            style={{ 
              gap: isSmallScreen ? HEADER_GAP_MEDIUM : HEADER_GAP_LARGE,
              flexShrink: 0,
              flexBasis: 'auto',
              paddingRight: isSmallScreen ? HEADER_CONTENT_PADDING_LEFT_MOBILE : HEADER_CONTENT_PADDING_LEFT_DESKTOP,
            }}
          >
            {/* View mode toggle — desktop only */}
            {!shouldUseMobileLayout && (
              <div 
                className="flex items-center"
                style={{ 
                  gap: isSmallScreen ? HEADER_GAP_XSMALL : HEADER_GAP_SMALL,
                }}
              >
                <div 
                  className={cn(
                    "flex items-center rounded-full border",
                    TOGGLE_SWITCH_SPACING.container.gapClass,
                    TOGGLE_SWITCH_SPACING.container.padding.horizontalClass,
                    TOGGLE_SWITCH_SPACING.container.padding.verticalClass,
                    TOGGLE_SWITCH_COLORS.container.background.light,
                    TOGGLE_SWITCH_COLORS.container.background.dark,
                    TOGGLE_SWITCH_COLORS.container.border.light,
                    TOGGLE_SWITCH_COLORS.container.border.dark
                  )}
                  style={{ transform: `scale(${buttonScale})` }}
                  data-tour="week-month-toggle"
                >
              <Icon
                name="calendar"
                size={TOGGLE_SWITCH_DIMENSIONS.icon.size}
                className={cn(
                  "transition-colors",
                  viewMode === "week"
                    ? TOGGLE_SWITCH_COLORS.text.active.light + " " + TOGGLE_SWITCH_COLORS.text.active.dark
                    : TOGGLE_SWITCH_COLORS.text.inactive.light + " " + TOGGLE_SWITCH_COLORS.text.inactive.dark,
                )}
              />
              <span
                className={cn(
                  TOGGLE_SWITCH_TEXT_SIZES.label.small,
                  "font-medium transition-colors",
                  viewMode === "week"
                    ? TOGGLE_SWITCH_COLORS.text.active.light + " " + TOGGLE_SWITCH_COLORS.text.active.dark
                    : TOGGLE_SWITCH_COLORS.text.inactive.light + " " + TOGGLE_SWITCH_COLORS.text.inactive.dark,
                )}
              >
                Week
              </span>
              <Switch
                checked={viewMode === "month"}
                onCheckedChange={(checked) =>
                  setViewMode(checked ? "month" : "week")
                }
                className={TOGGLE_SWITCH_SPACING.container.margin.switchClass}
              />
              <span
                className={cn(
                  TOGGLE_SWITCH_TEXT_SIZES.label.small,
                  "font-medium transition-colors",
                  viewMode === "month"
                    ? TOGGLE_SWITCH_COLORS.text.active.light + " " + TOGGLE_SWITCH_COLORS.text.active.dark
                    : TOGGLE_SWITCH_COLORS.text.inactive.light + " " + TOGGLE_SWITCH_COLORS.text.inactive.dark,
                )}
              >
                Month
              </span>
              <Icon
                name="calendar-days"
                size={TOGGLE_SWITCH_DIMENSIONS.icon.size}
                className={cn(
                  "transition-colors",
                  viewMode === "month"
                    ? TOGGLE_SWITCH_COLORS.text.active.light + " " + TOGGLE_SWITCH_COLORS.text.active.dark
                    : TOGGLE_SWITCH_COLORS.text.inactive.light + " " + TOGGLE_SWITCH_COLORS.text.inactive.dark,
                )}
              />
                </div>
              </div>
            )}

            {/* AI Scheduler Buttons - Desktop Only (not mobile/tablet) */}
            <div
              className={cn(!shouldUseMobileLayout ? 'flex items-center flex-shrink-0' : 'hidden')}
              style={{ gap: isSmallScreen ? HEADER_GAP_SMALL : HEADER_GAP_MEDIUM }}
            >
              <DashboardSchedulerActionButton
                label={
                  showActionText
                    ? DASHBOARD_VIEW_HEADER_LABELS.aiSchedulerSuggestionsLong
                    : DASHBOARD_VIEW_HEADER_LABELS.aiSchedulerSuggestionsShort
                }
                icon="zap"
                variant="primary"
                onClick={handleScheduleUnscheduledTasks}
                isSmallScreen={isSmallScreen}
                scale={buttonScale}
                data-tour="ai-scheduler"
              />
              <DashboardSchedulerActionButton
                label={DASHBOARD_VIEW_HEADER_LABELS.reschedule}
                icon="calendar-dots"
                variant="secondary"
                onClick={handleOpenRescheduleDialog}
                disabled={isRescheduling}
                iconSpinning={isRescheduling}
                isSmallScreen={isSmallScreen}
                scale={buttonScale}
                data-tour="re-schedule"
              />
            </div>
          </div>
        }
      />
      {/* Mobile/Tablet 7-Day Calendar - Only show on mobile/tablet when viewing week */}
      {mobileView === "week" && shouldUseMobileLayout && (
        <div 
          className="border-b border-primary/8 bg-white/40 dark:bg-card/40 backdrop-blur-sm flex-shrink-0 min-w-0 w-full max-w-full overflow-x-hidden overflow-y-visible"
          style={{
            paddingTop: DASHBOARD_WEEK_CAROUSEL.paddingTopPx,
            maxWidth: CALENDAR_CAROUSEL_MAX_WIDTH_VIEWPORT,
          }}
        >
          <div
            className="calendar-carousel-inner min-w-0 w-full max-w-full overflow-hidden box-border"
            style={{
              ['--carousel-padding-x-sm' as string]: CALENDAR_CAROUSEL_PADDING_X_SM,
              ['--carousel-padding-b-sm' as string]: CALENDAR_CAROUSEL_PADDING_B_SM,
              paddingLeft: `max(${CALENDAR_CAROUSEL_PADDING_X}, env(safe-area-inset-left))`,
              paddingRight: `max(${CALENDAR_CAROUSEL_PADDING_X}, env(safe-area-inset-right))`,
              paddingBottom: CALENDAR_CAROUSEL_PADDING_B,
              maxWidth: CALENDAR_CAROUSEL_LAYOUT_FULL,
            }}
          >
            {/* Week navigation — date range shown in AppHeader */}
            <div
              className="flex items-center justify-between"
              style={{ marginBottom: DASHBOARD_WEEK_CAROUSEL.navRowMarginBottomPx }}
            >
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleWeekChange("prev")}
                disabled={mobileWeekOffset === 0}
                className="flex-shrink-0 rounded-full hover:bg-muted/50"
                style={{
                  width: CALENDAR_CAROUSEL_NAV_BUTTON_SIZE_PX,
                  height: CALENDAR_CAROUSEL_NAV_BUTTON_SIZE_PX,
                  opacity: DASHBOARD_WEEK_CAROUSEL.navButtonOpacity,
                }}
              >
                <Icon name="chevron-left" size={ICON_SIZE_MD} />
              </Button>

              {mobileWeekOffset === 0 ? (
                <span
                  className="uppercase font-semibold border bg-primary/10 text-primary border-primary/20 dark:bg-primary/15 dark:border-primary/30"
                  style={{
                    fontSize: KANBAN_WEEK_GROUP_HEADER.badge.fontSizePx,
                    paddingLeft: KANBAN_WEEK_GROUP_HEADER.badge.paddingX,
                    paddingRight: KANBAN_WEEK_GROUP_HEADER.badge.paddingX,
                    paddingTop: KANBAN_WEEK_GROUP_HEADER.badge.paddingY,
                    paddingBottom: KANBAN_WEEK_GROUP_HEADER.badge.paddingY,
                    letterSpacing: `${KANBAN_WEEK_GROUP_HEADER.badge.letterSpacingEm}em`,
                    borderRadius: KANBAN_WEEK_GROUP_HEADER.badge.borderRadiusPx,
                  }}
                >
                  This week
                </span>
              ) : (
                <span className="w-6" aria-hidden />
              )}

              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleWeekChange("next")}
                className="flex-shrink-0 rounded-full hover:bg-muted/50"
                style={{
                  width: CALENDAR_CAROUSEL_NAV_BUTTON_SIZE_PX,
                  height: CALENDAR_CAROUSEL_NAV_BUTTON_SIZE_PX,
                  opacity: DASHBOARD_WEEK_CAROUSEL.navButtonOpacity,
                }}
              >
                <Icon name="chevron-right" size={ICON_SIZE_MD} />
              </Button>
            </div>

            {/* 7-Day Calendar Grid - Swipeable Carousel */}
            <div 
              className="grid select-none min-w-0 w-full max-w-full overflow-hidden box-border calendar-carousel-grid"
              style={{ 
                gridTemplateColumns: `repeat(${CALENDAR_CAROUSEL_DAYS_PER_WEEK}, minmax(0, 1fr))`,
                gap: CALENDAR_CAROUSEL_GRID_GAP,
                width: CALENDAR_CAROUSEL_LAYOUT_FULL,
                maxWidth: CALENDAR_CAROUSEL_LAYOUT_FULL,
                ['--carousel-header-font-sm' as string]: CALENDAR_CAROUSEL_DAY_HEADER_FONT_SIZE_SM,
              }}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              {/* Day Headers */}
              {weekColumns.map((column) => (
                <div
                  key={`header-${column.dateString}`}
                  className="text-center sm:text-xs font-medium text-muted-foreground py-1 min-w-0 overflow-hidden calendar-carousel-header-cell"
                  style={{ fontSize: CALENDAR_CAROUSEL_DAY_HEADER_FONT_SIZE }}
                >
                  {column.dayName.substring(0, CALENDAR_CAROUSEL_DAY_ABBREV_LENGTH)}
                </div>
              ))}
              
              {/* Date Cells */}
                  {weekColumns.map((column, index) => {
                    const isSelected = index === mobileDayIndex;
                    const dayTasks = getTasksForDay(column.dateString);
                    const dayEventCount = calendarEventsByDateData[column.dateString] ?? 0;
                    
                    // Debug: Log tasks and events for this day in development
                    if (import.meta.env.DEV) {
                      if (dayTasks.length > 0 || dayEventCount > 0) {
                        console.log(`[Mobile Calendar] ${column.dateString}: ${dayTasks.length} task(s), ${dayEventCount} event(s)`, {
                          tasks: dayTasks.map(t => ({ id: t.id, title: t.title, scheduledDate: t.scheduledDate, status: t.status })),
                          eventCount: dayEventCount
                        });
                      }
                    }
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isToday = 
                  column.date.getFullYear() === today.getFullYear() &&
                  column.date.getMonth() === today.getMonth() &&
                  column.date.getDate() === today.getDate();

                    return (
                      <button
                        key={column.dateString}
                        onClick={() => setMobileDayIndex(index)}
                        type="button"
                        className={cn(
                      "flex flex-col items-center justify-center py-2 rounded-lg transition-all relative min-w-0 w-full overflow-hidden",
                          isSelected
                            ? cn(UI_INBOX_GRADIENTS.emptyState.className, "text-primary shadow-md border-2 border-primary/30")
                        : isToday
                        ? "bg-primary/10 text-primary border border-primary/20"
                            : "bg-white/50 dark:bg-card/50 hover:bg-white dark:hover:bg-card border border-transparent",
                        )}
                      >
                        <span
                          className={cn(
                            "text-sm sm:text-base font-semibold leading-none flex-shrink-0",
                            isSelected
                          ? "text-primary"
                          : isToday
                              ? "text-primary"
                              : "text-foreground",
                          )}
                        >
                          {column.date.getDate()}
                        </span>
                        {/* Show dots for all tasks and events - one dot per item; wrap at 4 per row, never exceed cell width */}
                        {(dayTasks.length > 0 || dayEventCount > 0) && (
                          <div 
                            className="flex flex-wrap items-center justify-center content-center gap-0.5 mt-1 flex-shrink-0 overflow-hidden box-border max-w-full"
                            style={{ 
                              maxHeight: `${CALENDAR_CAROUSEL_DOTS_MAX_HEIGHT_PX}px`,
                              minHeight: `${CALENDAR_CAROUSEL_DOTS_MIN_HEIGHT_PX}px`,
                              width: CALENDAR_CAROUSEL_LAYOUT_FULL,
                              maxWidth: `min(${CALENDAR_CAROUSEL_LAYOUT_FULL}, ${CALENDAR_CAROUSEL_DOTS_ROW_MAX_WIDTH_PX}px)`,
                              minWidth: 0,
                            }}
                          >
                            {/* Task dots (primary) - one per task */}
                            {dayTasks.map((task, taskIndex) => {
                              if (!task) return null;
                              const isDone = task.status === 'done';
                              return (
                                <div
                                  key={`task-${task.id}-${taskIndex}`}
                                  className={cn(
                                    "rounded-full flex-shrink-0",
                                    isSelected
                                      ? isDone ? "bg-primary/70" : "bg-primary"
                                      : isDone ? "bg-primary/60" : "bg-primary/80",
                                  )}
                                  style={{ 
                                    display: 'block', 
                                    opacity: isDone ? CALENDAR_CAROUSEL_DONE_DOT_OPACITY : 1,
                                    width: CALENDAR_CAROUSEL_DOT_SIZE_SMALL_PX,
                                    height: CALENDAR_CAROUSEL_DOT_SIZE_SMALL_PX,
                                  }}
                                  aria-label={`Task: ${task.title || 'Untitled task'}`}
                                  title={task.title || 'Untitled task'}
                                />
                              );
                            })}
                            {/* Event dots (blue) - one per calendar event */}
                            {dayEventCount > 0 && Array.from({ length: dayEventCount }).map((_, eventIndex) => (
                              <div
                                key={`event-${column.dateString}-${eventIndex}`}
                                className={cn(
                                  "rounded-full flex-shrink-0",
                                  isSelected ? "bg-blue-500" : "bg-blue-500/70",
                                )}
                                style={{
                                  width: CALENDAR_CAROUSEL_DOT_SIZE_SMALL_PX,
                                  height: CALENDAR_CAROUSEL_DOT_SIZE_SMALL_PX,
                                }}
                                aria-label={`Calendar event ${eventIndex + 1}`}
                                title={`${dayEventCount} calendar event${dayEventCount !== 1 ? 's' : ''}`}
                              />
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
            </div>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className={cn("flex-1 flex min-h-0 min-w-0", shouldUseMobileLayout ? "overflow-x-hidden" : "overflow-hidden")}>
        {/* Desktop: Today Agenda Sidebar — not mounted on mobile/tablet (avoids duplicate TodayAgendaView work) */}
        {!hideAgenda && !shouldUseMobileLayout && (
          <motion.div
            className="hidden xl:flex flex-col w-64 h-full min-h-0 border-r border-primary/10 bg-white/50 dark:bg-background/50 backdrop-blur-sm"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: KANBAN_ANIMATION.duration, ease: KANBAN_ANIMATION.ease }}
          >
            <TodayAgendaView hideHeader={true} />
          </motion.div>
        )}

        {/* Mobile: Tabbed View | Desktop: Kanban/Calendar */}
        <motion.div
          className={cn("flex-1 min-w-0", shouldUseMobileLayout ? "min-h-0 overflow-x-hidden w-full max-w-full flex flex-col" : "overflow-hidden")}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: KANBAN_ANIMATION.duration,
            delay: KANBAN_ANIMATION.delay,
            ease: KANBAN_ANIMATION.ease,
          }}
        >
          {/* Desktop: Full Kanban or Calendar (not mobile/tablet) */}
          {!shouldUseMobileLayout && (
            <div
              className="h-full min-h-0 flex flex-col"
              data-tour="kanban-board"
            >
              {viewMode === "week" ? (
                <SevenDayKanban viewMode={viewMode} onTaskComplete={handleTaskComplete} />
              ) : (
                <MonthCalendarView />
              )}
            </div>
          )}

          {/* Mobile/Tablet: Tabbed Content (one-column layout) */}
          {shouldUseMobileLayout && (
            <div className={cn("flex-1 min-h-0 flex flex-col w-full max-w-full min-w-0 overflow-x-hidden")} style={{ backgroundColor: 'transparent' }}>
              {mobileView === "today" ? (
                <TodayAgendaView hideHeader={true} />
              ) : viewMode === "week" ? (
                <SevenDayKanban
                  mobileMode
                  viewMode={viewMode}
                  mobileDayIndex={mobileDayIndex}
                  mobileWeekOffset={mobileWeekOffset}
                  onMobileWeekChange={setMobileWeekOffset}
                  mobileAboveChromeOffsetPx={DASHBOARD_WEEK_CAROUSEL.estimatedHeightPx}
                  onTaskComplete={handleTaskComplete}
                />
              ) : (
                <MonthCalendarView mobileMode />
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* AI Recommendations Side Panel */}
      <Sheet open={aiPanelOpen} onOpenChange={onAiPanelChange}>
        <SheetContent
          side="right"
          className={cn("w-full sm:w-[360px] md:w-[400px] bg-gradient-to-b from-white", `to-[${UI_GRADIENT_COLORS.dialog.via}]`, "dark:from-gray-900 dark:to-gray-800")}
          data-tour="ai-recommendations-panel"
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <div className={cn("p-2 rounded-lg", UI_INBOX_GRADIENTS.emptyState.className)}>
                <Icon name="sparkles" size={ICON_SIZE_LG} className="text-primary" />
              </div>
              AI Recommendations
            </SheetTitle>
            <SheetDescription>
              Smart scheduling suggestions powered by AI
            </SheetDescription>
          </SheetHeader>
          <AIRecommendationPanel
            onClose={() => onAiPanelChange(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Schedule Preview Dialog */}
      <Dialog
        open={showSchedulePreview}
        onOpenChange={setShowSchedulePreview}
      >
        <DialogContent className="max-w-2xl max-h-[80vh]" data-tour="ai-schedule-preview-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="calendar" size={ICON_SIZE_LG} className="text-primary" />
              Review AI Scheduling Plan
            </DialogTitle>
            <DialogDescription>
              Choose which suggestions to accept. Your{" "}
              {schedulePlan.length} unscheduled task
              {schedulePlan.length === 1 ? "" : "s"} across
              upcoming days
            </DialogDescription>
            <div className="flex items-center gap-3 pt-1" data-tour="ai-schedule-preview-options">
              <button
                type="button"
                onClick={selectAllPlanSuggestions}
                className="text-xs text-primary hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={deselectAllPlanSuggestions}
                className="text-xs text-muted-foreground hover:underline"
              >
                Deselect all
              </button>
              <span className="text-xs text-muted-foreground">
                {selectedPlanTaskIds.size} of {schedulePlan.length} selected
              </span>
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[50vh] pr-4">
            <div className="space-y-3">
              {schedulePlan.map(
                ({ task, scheduledDate, reason }, index) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className={cn("p-4", UI_INBOX_GRADIENTS.card.className, !selectedPlanTaskIds.has(task.id) && "opacity-75")}>
                      <div className="flex items-start gap-3">
                        <div
                          className="mt-1 shrink-0 flex-shrink-0 flex items-center justify-center"
                          style={{ minWidth: getCheckboxSizePxForWidth(screenWidth), minHeight: getCheckboxSizePxForWidth(screenWidth) }}
                        >
                          <Checkbox
                            checked={selectedPlanTaskIds.has(task.id)}
                            onCheckedChange={() => togglePlanSelection(task.id)}
                            className="flex-shrink-0"
                            style={{ width: getCheckboxVisualSizePxForWidth(screenWidth), height: getCheckboxVisualSizePxForWidth(screenWidth), minWidth: getCheckboxVisualSizePxForWidth(screenWidth), minHeight: getCheckboxVisualSizePxForWidth(screenWidth) }}
                            aria-label={`Accept schedule for ${task.title}`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className="font-medium text-sm">
                              {task.title}
                            </h4>
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  task.priority === "urgent" &&
                                    "border-red-400 text-red-700 bg-red-50 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800",
                                  task.priority === "high" &&
                                    "border-orange-400 text-orange-700 bg-orange-50",
                                  task.priority === "medium" &&
                                    "border-blue-400 text-blue-700 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800",
                                  task.priority === "low" &&
                                    "border-gray-400 text-gray-700 dark:text-foreground bg-gray-50 dark:bg-muted/20",
                                )}
                              >
                                {task.priority}
                              </Badge>
                              {task.status ===
                                "in-progress" && (
                                <Badge
                                  variant="outline"
                                  className="text-xs border-green-400 text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800"
                                >
                                  active
                                </Badge>
                              )}
                            </div>
                          </div>
                          {task.description && (
                            <div 
                              className={cn(
                                "text-[10px] text-muted-foreground mb-2 line-clamp-4 break-words px-1.5",
                                // Rich text formatting styles - only apply if HTML is present
                                // Note: Rich text editor font size changes will override this base size via inline styles
                                hasHTMLTags(task.description) && "[&_strong]:font-bold [&_b]:font-bold",
                                hasHTMLTags(task.description) && "[&_em]:italic [&_i]:italic",
                                hasHTMLTags(task.description) && "[&_u]:underline",
                                hasHTMLTags(task.description) && "[&_s]:line-through [&_strike]:line-through",
                                hasHTMLTags(task.description) && "[&_ul]:list-disc [&_ul]:ml-3",
                                hasHTMLTags(task.description) && "[&_ol]:list-decimal [&_ol]:ml-3",
                                hasHTMLTags(task.description) && "[&_li]:ml-1",
                                hasHTMLTags(task.description) && "[&_p]:my-0.5 [&_p]:break-words"
                              )}
                              {...(hasHTMLTags(task.description) 
                                ? { dangerouslySetInnerHTML: { __html: sanitizeHTML(task.description) } }
                                : { children: task.description }
                              )}
                            />
                          )}

                          {/* AI Reasoning */}
                          {reason && (
                            <div className="mb-2 flex items-start gap-1.5 p-2 rounded-md bg-primary/5 border border-primary/10">
                              <Icon name="brain" size={ICON_SIZE_XS} className="text-primary mt-0.5 flex-shrink-0" />
                              <span className="text-xs text-primary/80 italic">
                                {reason}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-xs flex-wrap">
                            <div className="flex items-center gap-1">
                              <Icon name="calendar" size={ICON_SIZE_XS} className="text-primary" />
                              <span className="text-foreground/70">
                                {formatScheduleDate(
                                  scheduledDate,
                                )}
                              </span>
                            </div>
                            {task.estimatedTime && (
                              <div className="flex items-center gap-1">
                                <span className="text-foreground/30">
                                  •
                                </span>
                                <Icon name="clock" size={ICON_SIZE_XS} className="text-foreground/50" />
                                <span className="text-foreground/70">
                                  {task.estimatedTime} min
                                </span>
                              </div>
                            )}
                            {task.dueDate && (
                              <div className="flex items-center gap-1">
                                <span className="text-foreground/30">
                                  •
                                </span>
                                <Icon name="target" size={ICON_SIZE_XS} className="text-foreground/50" />
                                <span className="text-foreground/70">
                                  Due{" "}
                                  {new Date(
                                    task.dueDate,
                                  ).toLocaleDateString(
                                    "en-US",
                                    {
                                      month: "short",
                                      day: "numeric",
                                    },
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ),
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSchedulePreview(false)}
              className="rounded-full"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmScheduling}
              disabled={selectedPlanTaskIds.size === 0}
              className="rounded-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 disabled:opacity-50"
            >
              <Icon name="sparkles" size={ICON_SIZE_MD} className="mr-2" />
              Accept {selectedPlanTaskIds.size > 0 ? `${selectedPlanTaskIds.size} selected` : "selected"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Re-schedule Dialog */}
      <Dialog open={showRescheduleDialog} onOpenChange={(open) => {
        try {
          setShowRescheduleDialog(open);
          if (!open) {
            setRescheduleType(null);
            setRescheduleDate(undefined);
            setRescheduleDates([]);
          }
        } catch (error) {
          console.error('Error handling dialog open change:', error);
        }
      }}>
        <DialogContent
          className="sm:max-w-md border border-primary/10"
          data-tour="reschedule-dialog"
          style={{
            backgroundImage: isDark
              ? 'linear-gradient(180deg, rgba(17,24,39,0.96) 0%, rgba(17,24,39,0.9) 100%)'
              : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,240,255,0.95) 100%)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="refresh-cw" size={ICON_SIZE_LG} className="text-primary" />
              AI Re-schedule Tasks
            </DialogTitle>
            <DialogDescription>
              Select a time period and date to reschedule tasks. Tasks will be unscheduled and then rescheduled using AI.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Mini Calendar with Type Toggle */}
            {rescheduleType ? (
              <RescheduleMiniCalendar
                rescheduleType={rescheduleType}
                rescheduleDate={rescheduleDate}
                selectedDates={rescheduleDates}
                onTypeChange={(type) => {
                  try {
                    setRescheduleType(type);
                    setRescheduleDate(undefined);
                    setRescheduleDates([]); // Clear multi-selection when type changes
                  } catch (error) {
                    console.error('Error changing reschedule type:', error);
                    toast.error('Failed to change period type', {
                      description: 'Please try again',
                      duration: 3000,
                    });
                  }
                }}
                onDateSelect={(date) => {
                  try {
                    setRescheduleDate(date);
                  } catch (error) {
                    console.error('Error selecting date:', error);
                    toast.error('Failed to select date', {
                      description: 'Please try again',
                      duration: 3000,
                    });
                  }
                }}
                onMultiDateSelect={(dates) => {
                  try {
                    setRescheduleDates(dates);
                    // Also set single date to first selected for compatibility
                    if (dates.length > 0) {
                      setRescheduleDate(dates[0]);
                    } else {
                      setRescheduleDate(undefined);
                    }
                  } catch (error) {
                    console.error('Error selecting multiple dates:', error);
                  }
                }}
              />
            ) : (
              /* Type Selection - shown when no type selected */
              <div className="space-y-2">
                <Label className="text-sm font-medium">Select Period Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      try {
                        setRescheduleType("day");
                      } catch (error) {
                        console.error('Error setting reschedule type to day:', error);
                        toast.error('Failed to select period type', {
                          description: 'Please try again',
                          duration: 3000,
                        });
                      }
                    }}
                  >
                    Days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      try {
                        setRescheduleType("week");
                      } catch (error) {
                        console.error('Error setting reschedule type to week:', error);
                        toast.error('Failed to select period type', {
                          description: 'Please try again',
                          duration: 3000,
                        });
                      }
                    }}
                  >
                    Week
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      try {
                        setRescheduleType("month");
                      } catch (error) {
                        console.error('Error setting reschedule type to month:', error);
                        toast.error('Failed to select period type', {
                          description: 'Please try again',
                          duration: 3000,
                        });
                      }
                    }}
                  >
                    Month
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  setShowRescheduleDialog(false);
                  setRescheduleType(null);
                  setRescheduleDate(undefined);
                  setRescheduleDates([]);
                } catch (error) {
                  console.error('Error closing reschedule dialog:', error);
                }
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                try {
                  // For day mode, allow either single date or multi-date selection
                  const hasValidDaySelection = rescheduleType === "day" && (rescheduleDates.length > 0 || rescheduleDate);
                  const hasValidOtherSelection = rescheduleType && rescheduleType !== "day" && rescheduleDate;
                  
                  if (hasValidDaySelection || hasValidOtherSelection) {
                    handleRandomReschedule(rescheduleType!, rescheduleDate, rescheduleDates);
                  } else {
                    toast.error("Please select a date", {
                      description: "You must select both a period type and a date.",
                      duration: 3000,
                    });
                  }
                } catch (error) {
                  console.error('Error in reschedule button click:', error);
                  toast.error('Failed to start rescheduling', {
                    description: 'Please try again',
                    duration: 3000,
                  });
                }
              }}
              disabled={!rescheduleType || (!rescheduleDate && rescheduleDates.length === 0) || isRescheduling}
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              <Icon name="refresh-cw" size={ICON_SIZE_MD} className={cn("mr-2", isRescheduling && "animate-spin")} />
              {isRescheduling ? "Rescheduling..." : rescheduleDates.length > 1 ? `Reschedule ${rescheduleDates.length} Days` : "Reschedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}