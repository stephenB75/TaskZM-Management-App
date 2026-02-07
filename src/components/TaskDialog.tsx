import React, { useState, useEffect, useRef } from "react";
// Icons migrated to Icon component
import { Icon } from "./Icon";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { RichTextEditor } from "./RichTextEditor";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { UI_GRADIENT_COLORS, UI_FOLDER_COLORS } from "../lib/ui-colors";
import { Z_INDEX, MAX_HEIGHT, ICON_SIZE_XS } from "../lib/layout-constants";
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { CheckboxSwitch as Switch } from "./ui/checkbox-switch";
import { Slider } from "./ui/slider";
import { Tabs, TabsContent } from "./ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { PomodoroTimer } from "./PomodoroTimer";
import { EmojiPickerPopover } from "./EmojiPickerPopover";
import {
  cn,
  formatDate,
  getDateString,
  validateDependencies,
  getIncompleteDependencies,
  getInitials,
} from "../lib/utils";
import { MINUTES_PER_HOUR, HOURS_PER_DAY, DEFAULT_WEEKDAY_WORK_START, MILLISECONDS_PER_MINUTE, DATE_ONLY_PARSE_SUFFIX } from "../lib/business-constants";
import { useTasks } from "../contexts/TaskContext";
import { useTeam } from "../contexts/TeamContext";
import { useSubscription } from "../contexts/SubscriptionContext";
import { usePermissions } from "../hooks/usePermissions";
import { useCalendar } from "../contexts/CalendarContext";
import { useAI } from "../contexts/AIContext";
import { useAuth } from "../contexts/AuthContext";
import * as api from "../lib/api";
import { toast } from "sonner";
import { logger } from "../lib/logger";
import { TOAST_DURATION_SHORT_MS, TOAST_DURATION_DEFAULT_MS, TOAST_DURATION_MEDIUM_MS, TOAST_DURATION_LONG_MS } from "../lib/layout-constants";
import { TIMING_CONSTANTS } from "../lib/timing-constants";
import { checkTimeConflict, findNextAvailableSlot, formatTime } from "../lib/time-conflict";
import { getCategoryHoursForTask } from "../lib/category-hours-utils";
import { checkDailyLimit, getDailyHoursWarningLevel, getTaskMinutes } from "../lib/daily-hours-utils";
import { useTaskBreakdown } from "../hooks/useTaskBreakdown";
import { ActionPlanPanel } from "./ActionPlanPanel";
import { DEFAULT_TASK_STATUS } from "../lib/task-constants";
import { generateDescription, generateDescriptionOptions, getSuggestivePhrases, buildCompleteDescriptionFromPhrases } from "../lib/description-generator";
import { DESCRIPTION_GENERATION_CONFIG, DESCRIPTION_OPTIONS_DEBOUNCE_MS, TASK_BREAKDOWN_DEBOUNCE_MS, EFFORT_SCORE_THRESHOLDS, DESCRIPTION_UI_CONFIG } from "../lib/ai-config";
import { SETTINGS_PANEL_ICON_SIZE_MEDIUM, SETTINGS_PANEL_ICON_SIZE_SMALL, SETTINGS_PANEL_GAP_SMALL, COMPONENT_DIMENSIONS, ICON_SIZE_SM, ICON_SIZE_MD, TASK_DIALOG_SUBTASK_CHECKBOX_SIZE, VIEWPORT_BREAKPOINTS } from "../lib/layout-constants";
import { COLOR_TEXT_WHITE } from "../lib/color-theme";
import { TASK_DIALOG_UI_TEXT, TASK_DIALOG_FONT_SIZES, TASK_DIALOG_DIMENSIONS, TASK_DIALOG_COLORS, TASK_DIALOG_MENU_WIDTH, TASK_DIALOG_SECTION_SPACING, TASK_DIALOG_MINIMAL_SPACING, TASK_DIALOG_CALENDAR, TASK_DIALOG_TIMEZONE, TASK_DIALOG_TRANSITIONS, TASK_DIALOG_CALCULATIONS } from "../lib/task-dialog-constants";
import { useIsMobile } from "./ui/use-mobile";
import type {
  Task,
  TaskPriority,
  TaskStatus,
  Subtask,
  RecurrenceType,
  RecurrenceConfig,
} from "../types";

interface TaskDialogProps {
  open: boolean;
  onClose: () => void;
  task?: Task | null;
  initialDate?: string;
  initialFolderId?: string | null; // Optional folder ID to assign new tasks to
  onShowUpgradePrompt?: (feature: 'recurringTasks' | 'taskDependencies' | 'taskTemplates') => void;
}

// Fixed Mini Calendar Component - Always visible
function FixedMiniCalendar({
  scheduledDate,
  dueDate,
  activeField,
  onDateSelect,
  onFieldChange,
}: {
  scheduledDate: Date | undefined;
  dueDate: Date | undefined;
  activeField: "scheduled" | "due";
  onDateSelect: (date: Date | undefined, field: "scheduled" | "due") => void;
  onFieldChange: (field: "scheduled" | "due") => void;
}) {
  const [viewDate, setViewDate] = useState(() => {
    // Initialize view date based on active field
    if (activeField === "scheduled" && scheduledDate) return scheduledDate;
    if (activeField === "due" && dueDate) return dueDate;
    return new Date();
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Sync view date when active field changes
  useEffect(() => {
    if (activeField === "scheduled" && scheduledDate) {
      setViewDate(scheduledDate);
    } else if (activeField === "due" && dueDate) {
      setViewDate(dueDate);
    } else if (!scheduledDate && !dueDate) {
      setViewDate(new Date());
    }
  }, [activeField, scheduledDate, dueDate]);

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
    
    // Generate calendar grid days (5 weeks = 35 days)
    for (let i = 0; i < TASK_DIALOG_CALENDAR.DAYS_IN_GRID; i++) {
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

  const isSelected = (date: Date, field: "scheduled" | "due") => {
    const selectedDate = field === "scheduled" ? scheduledDate : dueDate;
    if (!selectedDate) return false;
    return date.getDate() === selectedDate.getDate() &&
           date.getMonth() === selectedDate.getMonth() &&
           date.getFullYear() === selectedDate.getFullYear();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === viewDate.getMonth() &&
           date.getFullYear() === viewDate.getFullYear();
  };

  const weekDays = TASK_DIALOG_CALENDAR.WEEK_DAYS_SHORT;
  const activeDate = activeField === "scheduled" ? scheduledDate : dueDate;

  return (
    <div className={cn("w-full bg-white/70 dark:bg-card/60 text-foreground dark:text-foreground rounded-lg border-0", TASK_DIALOG_MINIMAL_SPACING.cardPadding)}>
      {/* Toggle Buttons (Scheduled / Due Date / Clear) - min-w-0 + truncate so content doesn't spill on mobile */}
      <div className={cn("flex gap-1 sm:gap-2 mb-2 min-w-0", TASK_DIALOG_MINIMAL_SPACING.statusPriorityRowGap)}>
        <Button
          type="button"
          variant={activeField === "scheduled" ? "default" : "outline"}
          size="sm"
          onClick={() => onFieldChange("scheduled")}
          className={cn(
            "flex-1 min-w-0 overflow-hidden rounded-lg px-2 sm:px-3",
            activeField === "scheduled"
              ? "bg-primary text-primary-foreground"
              : "border-primary/20 hover:border-primary/40 hover:bg-primary/5"
          )}
          style={{
            fontSize: TASK_DIALOG_FONT_SIZES.xs,
            height: TASK_DIALOG_DIMENSIONS.inputHeight.small,
          }}
          title={TASK_DIALOG_UI_TEXT.scheduledDate}
        >
          <span className="flex items-center justify-center gap-1 sm:gap-1.5 min-w-0 flex-1 overflow-hidden">
            <Icon name="calendar" size={TASK_DIALOG_CALENDAR.ICON_SIZE} className="shrink-0" weight="duotone" />
            <span className="truncate">{TASK_DIALOG_UI_TEXT.scheduledDate}</span>
          </span>
        </Button>
        <Button
          type="button"
          variant={activeField === "due" ? "default" : "outline"}
          size="sm"
          onClick={() => onFieldChange("due")}
          className={cn(
            "flex-1 min-w-0 overflow-hidden rounded-lg px-2 sm:px-3",
            activeField === "due"
              ? "bg-primary text-primary-foreground"
              : "border-primary/20 hover:border-primary/40 hover:bg-primary/5"
          )}
          style={{
            fontSize: TASK_DIALOG_FONT_SIZES.xs,
            height: TASK_DIALOG_DIMENSIONS.inputHeight.small,
          }}
          title={TASK_DIALOG_UI_TEXT.dueDate}
        >
          <span className="flex items-center justify-center gap-1 sm:gap-1.5 min-w-0 flex-1 overflow-hidden">
            <Icon name="alert-circle" size={SETTINGS_PANEL_ICON_SIZE_SMALL} className="shrink-0" />
            <span className="truncate">{TASK_DIALOG_UI_TEXT.dueDate}</span>
          </span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onDateSelect(undefined, activeField)}
          className="flex-1 min-w-0 overflow-hidden rounded-lg px-2 sm:px-3 border-primary/20 hover:border-primary/40 hover:bg-primary/5"
          style={{
            fontSize: TASK_DIALOG_FONT_SIZES.xs,
            height: TASK_DIALOG_DIMENSIONS.inputHeight.small,
          }}
          title={TASK_DIALOG_UI_TEXT.clear}
        >
          <span className="flex items-center justify-center min-w-0 overflow-hidden">
            <span className="truncate">{TASK_DIALOG_UI_TEXT.clear}</span>
          </span>
        </Button>
      </div>

      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={goToPreviousMonth}
          className="h-7 w-7"
        >
          <Icon name="chevron-left" size={ICON_SIZE_MD} />
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{monthName}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={goToToday}
            className="px-2 text-primary hover:bg-primary/10"
            style={{ 
              height: TASK_DIALOG_DIMENSIONS.calendarButton.height,
              fontSize: TASK_DIALOG_FONT_SIZES.xs,
            }}
          >
            Today
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={goToNextMonth}
          className="h-7 w-7"
        >
          <Icon name="chevron-right" size={ICON_SIZE_MD} />
        </Button>
      </div>

      {/* Week day headers - Fixed alignment */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center font-medium text-muted-foreground py-1 flex items-center justify-center"
            style={{ fontSize: TASK_DIALOG_FONT_SIZES.calendarDayHeader }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Date grid - showing 35 days (5 weeks) - Fixed alignment */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          const dateStr = getDateString(date);
          const day = date.getDate();
          const isTodayDate = isToday(date);
          const isSelectedScheduled = isSelected(date, "scheduled");
          const isSelectedDue = isSelected(date, "due");
          const isCurrentMonthDate = isCurrentMonth(date);

          return (
            <button
              key={`${dateStr}-${index}`}
              type="button"
              onClick={() => onDateSelect(date, activeField)}
              className={cn(
                "w-full rounded-md font-medium transition-all hover:scale-105 flex items-center justify-center",
                isSelectedScheduled && activeField === "scheduled"
                  ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30"
                  : isSelectedDue && activeField === "due"
                  ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30"
                  : isSelectedScheduled && activeField !== "scheduled"
                  ? "bg-primary/30 text-primary font-medium"
                  : isSelectedDue && activeField !== "due"
                  ? "bg-primary/30 text-primary font-medium"
                  : isTodayDate
                  ? "bg-primary/20 text-primary font-bold ring-1 ring-primary/30"
                  : isCurrentMonthDate
                  ? "text-foreground hover:bg-primary/10"
                  : "text-muted-foreground/50 hover:bg-muted/50"
              )}
              style={{ 
                height: TASK_DIALOG_DIMENSIONS.dateButton.height,
                fontSize: TASK_DIALOG_FONT_SIZES.xs,
              }}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Selected date info */}
      {activeDate && (
        <div className="mt-3 pt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="calendar" size={14} className="text-primary" weight="duotone" />
            <span className="text-xs font-medium text-foreground">
              {activeDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
              onClick={() => {
              onDateSelect(undefined, activeField);
            }}
            className="px-2"
            style={{
              height: TASK_DIALOG_DIMENSIONS.calendarButton.height,
              fontSize: TASK_DIALOG_FONT_SIZES.xs,
            }}
          >
            {TASK_DIALOG_UI_TEXT.clear}
          </Button>
        </div>
      )}
    </div>
  );
}

// Single Date Mini Calendar Component - For recurrence end date
function SingleDateMiniCalendar({
  selectedDate,
  onDateSelect,
  label = "Select Date",
}: {
  selectedDate: Date | undefined;
  onDateSelect: (date: Date | undefined) => void;
  label?: string;
}) {
  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) return selectedDate;
    return new Date();
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Sync view date when selected date changes
  useEffect(() => {
    if (selectedDate) {
      setViewDate(selectedDate);
    } else if (!selectedDate) {
      setViewDate(new Date());
    }
  }, [selectedDate]);

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
    
    // Generate calendar grid days (5 weeks = 35 days)
    for (let i = 0; i < TASK_DIALOG_CALENDAR.DAYS_IN_GRID; i++) {
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
    if (!selectedDate) return false;
    return date.getDate() === selectedDate.getDate() &&
           date.getMonth() === selectedDate.getMonth() &&
           date.getFullYear() === selectedDate.getFullYear();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === viewDate.getMonth() &&
           date.getFullYear() === viewDate.getFullYear();
  };

  const weekDays = TASK_DIALOG_CALENDAR.WEEK_DAYS_SHORT;

  return (
    <div className="w-full bg-white/80 dark:bg-card/80 text-foreground dark:text-foreground rounded-lg p-3">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={goToPreviousMonth}
          className="h-7 w-7"
        >
          <Icon name="chevron-left" size={ICON_SIZE_MD} />
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{monthName}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={goToToday}
            className="px-2 text-primary hover:bg-primary/10"
            style={{ 
              height: TASK_DIALOG_DIMENSIONS.calendarButton.height,
              fontSize: TASK_DIALOG_FONT_SIZES.xs,
            }}
          >
            Today
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={goToNextMonth}
          className="h-7 w-7"
        >
          <Icon name="chevron-right" size={ICON_SIZE_MD} />
        </Button>
      </div>

      {/* Week day headers - Fixed alignment */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center font-medium text-muted-foreground py-1 flex items-center justify-center"
            style={{ fontSize: TASK_DIALOG_FONT_SIZES.calendarDayHeader }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Date grid - showing 35 days (5 weeks) - Fixed alignment */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          const dateStr = getDateString(date);
          const day = date.getDate();
          const isTodayDate = isToday(date);
          const isSelectedDate = isSelected(date);
          const isCurrentMonthDate = isCurrentMonth(date);

          return (
            <button
              key={`${dateStr}-${index}`}
              type="button"
              onClick={() => onDateSelect(date)}
              className={cn(
                "w-full rounded-md font-medium transition-all hover:scale-105 flex items-center justify-center",
                isSelectedDate
                  ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30"
                  : isTodayDate
                  ? "bg-primary/20 text-primary font-bold ring-1 ring-primary/30"
                  : isCurrentMonthDate
                  ? "text-foreground hover:bg-primary/10"
                  : "text-muted-foreground/50 hover:bg-muted/50"
              )}
              style={{ 
                height: TASK_DIALOG_DIMENSIONS.dateButton.height,
                fontSize: TASK_DIALOG_FONT_SIZES.xs,
              }}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Selected date info */}
      {selectedDate && (
        <div className="mt-3 pt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="calendar" size={14} className="text-primary" weight="duotone" />
            <span className="text-xs font-medium text-foreground">
              {selectedDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onDateSelect(undefined);
            }}
            className="px-2"
            style={{
              height: TASK_DIALOG_DIMENSIONS.calendarButton.height,
              fontSize: TASK_DIALOG_FONT_SIZES.xs,
            }}
          >
            {TASK_DIALOG_UI_TEXT.clear}
          </Button>
        </div>
      )}
    </div>
  );
}

export function TaskDialog({
  open,
  onClose,
  task,
  initialDate,
  initialFolderId,
  onShowUpgradePrompt,
}: TaskDialogProps) {
  const { accessToken, getSessionToken } = useAuth();
  const isMobile = useIsMobile();
  const [subtaskCheckboxSize, setSubtaskCheckboxSize] = useState(TASK_DIALOG_SUBTASK_CHECKBOX_SIZE.laptop);
  useEffect(() => {
    const update = () => {
      const w = typeof window !== 'undefined' ? window.innerWidth : VIEWPORT_BREAKPOINTS.tablet;
      if (w < VIEWPORT_BREAKPOINTS.mobile) setSubtaskCheckboxSize(TASK_DIALOG_SUBTASK_CHECKBOX_SIZE.mobile);
      else if (w < VIEWPORT_BREAKPOINTS.tablet) setSubtaskCheckboxSize(TASK_DIALOG_SUBTASK_CHECKBOX_SIZE.tablet);
      else setSubtaskCheckboxSize(TASK_DIALOG_SUBTASK_CHECKBOX_SIZE.laptop);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  const {
    addTask,
    updateTask,
    deleteTask,
    availableTags,
    addAvailableTag,
    tasks,
    projects,
    folders,
    hoursSettings,
    workspaceId,
    syncWithServer,
  } = useTasks();
  const { teamMembers, getTeamMember } = useTeam();
  const { hasFeature, features } = useSubscription();
  const { calendarStatus, syncTask: syncTaskToCalendar } = useCalendar();
  const { settings: aiSettings } = useAI();
  const permissionsResult = usePermissions();
  const permissions = permissionsResult || {
    canCreateTask: true,
    canEditTask: true,
    canDeleteTask: true,
    canAssignTask: true,
    canManageTeam: true,
    canViewAnalytics: true,
    role: 'admin' as const,
  };
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] =
    useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [dueMonth, setDueMonth] = useState<string>("");
  const [dueDay, setDueDay] = useState<string>("");
  const [dueYear, setDueYear] = useState<string>("");
  const [scheduledDate, setScheduledDate] = useState<
    Date | undefined
  >();
  const [scheduledMonth, setScheduledMonth] = useState<string>("");
  const [scheduledDay, setScheduledDay] = useState<string>("");
  const [scheduledYear, setScheduledYear] = useState<string>("");
  const [activeDateField, setActiveDateField] = useState<"scheduled" | "due">("scheduled");
  const [projectId, setProjectId] = useState("default");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [selectedTagValue, setSelectedTagValue] = useState<string>("");
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [selectedAssigneeValue, setSelectedAssigneeValue] = useState<string>("");
  const [selectedDependencyValue, setSelectedDependencyValue] = useState<string>("");
  const [subtaskInput, setSubtaskInput] = useState("");
  const [estimatedTime, setEstimatedTime] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("0");
  const [estimatedMinutes, setEstimatedMinutes] = useState("0");
  const [scheduledTime, setScheduledTime] = useState("");
  const [scheduledHours, setScheduledHours] = useState("");
  const [scheduledMinutes, setScheduledMinutes] = useState("");
  const [timeFormat, setTimeFormat] = useState<"12hr" | "24hr">("12hr");
  const [timePeriod, setTimePeriod] = useState<"AM" | "PM">("AM");
  const [activeTab, setActiveTab] = useState<string>("basic");
  
  // Conflict detection state
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [pendingTaskData, setPendingTaskData] = useState<{
    taskData: Partial<Task>;
    requestedTime: Date;
    alternativeTime: Date;
  } | null>(null);
  const [dependencies, setDependencies] = useState<string[]>(
    [],
  );
  const [timezone, setTimezone] = useState("local");
  const [recurrenceType, setRecurrenceType] =
    useState<RecurrenceType>("none");
  const [recurrenceInterval, setRecurrenceInterval] =
    useState(1);
  const [recurrenceDaysOfWeek, setRecurrenceDaysOfWeek] =
    useState<number[]>([]);
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] =
    useState<number | undefined>();
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<
    Date | undefined
  >();
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] =
    useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);

  // AI Task Breakdown - Real-time analysis
  const { breakdown, isLoading: isBreakdownLoading, error: breakdownError } = useTaskBreakdown(
    title,
    description,
    { debounceMs: TASK_BREAKDOWN_DEBOUNCE_MS, enabled: true }
  );

  // Description options state - generated from title keywords/phrases and effort score
  // AI Flow:
  // 1. User enters title → useTaskBreakdown extracts keywords/phrases and determines effort score
  // 2. When title has content and description is empty → generate description options using effort score
  // 3. User selects description → useTaskBreakdown automatically regenerates action plan (watches description)
  // 4. Action plan subtasks are created from the chosen description
  const [descriptionOptions, setDescriptionOptions] = useState<Array<{ description: string; domain: string; confidence: number }>>([]);
  const [isLoadingDescriptionOptions, setIsLoadingDescriptionOptions] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);

  // Helper function to update scheduled time
  const updateScheduledTime = (
    hours: string,
    minutes: string,
    format: "12hr" | "24hr",
    period: "AM" | "PM"
  ) => {
    if (!hours || !minutes) {
      setScheduledTime("");
      return;
    }

    const minutesInt = parseInt(minutes, 10);
    let hourInt = parseInt(hours, 10);

    if (Number.isNaN(hourInt) || Number.isNaN(minutesInt)) {
      setScheduledTime("");
      return;
    }

    if (format === "12hr") {
      if (period === "PM" && hourInt !== 12) {
        hourInt += 12;
      } else if (period === "AM" && hourInt === 12) {
        hourInt = 0;
      }
    }

    if (hourInt < 0 || hourInt > 23 || minutesInt < 0 || minutesInt > 59) {
      setScheduledTime("");
      return;
    }

    const paddedHours = hourInt.toString().padStart(2, "0");
    const paddedMinutes = minutesInt.toString().padStart(2, "0");
    setScheduledTime(`${paddedHours}:${paddedMinutes}`);
  };

  // Track the task ID we've initialized from to prevent re-initialization on object reference changes
  const initializedTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Only process when dialog is open
    if (!open) {
      // Reset state when dialog closes
      initializedTaskIdRef.current = null;
      return;
    }

    // Get current task ID
    const currentTaskId = task?.id || null;
    
    // If we've already initialized from this task ID, don't re-initialize
    // This prevents reverting user changes when task object reference changes
    // IMPORTANT: This also prevents resetting the description field when AI generates a description
    if (initializedTaskIdRef.current === currentTaskId && currentTaskId !== null) {
      return;
    }

    // Debug logging removed - only log when dialog is actually opening
    if (open && task) {
      logger.debug('TaskDialog opening:', { taskId: task.id, taskName: task.title });
    }

    if (task) {
      try {
        // Validate task has required fields - but don't close dialog, just use defaults
        if (!task || typeof task !== 'object' || !task.id) {
          logger.warn('TaskDialog: Invalid task or missing ID', { task });
          toast.error('Invalid task: missing ID');
          // Don't close dialog - let user see the error
          return;
        }

        // Ensure task is a valid object with all required properties - use defaults if missing
        const safeTitle = typeof task.title === 'string' ? task.title : 'Untitled Task';
        const safeStatus = typeof task.status === 'string' ? task.status : ((task.status as any) || DEFAULT_TASK_STATUS);
        const safePriority = typeof task.priority === 'string' ? task.priority : ((task.priority as any) || 'medium');
        
        if (typeof task.title !== 'string') {
          logger.warn('TaskDialog: Task title is not a string, using default', task);
        }
        if (typeof task.status !== 'string') {
          logger.warn('TaskDialog: Task status is not a string, using default', task);
        }
        if (typeof task.priority !== 'string') {
          logger.warn('TaskDialog: Task priority is not a string, using default', task);
        }

        setTitle(safeTitle);
        setDescription(task.description?.toString() || "");
        setStatus(safeStatus as TaskStatus);
        setPriority(safePriority as TaskPriority);
        
        // Safely parse due date
        let due: Date | undefined;
        if (task.dueDate) {
          try {
            due = new Date(task.dueDate);
            if (isNaN(due.getTime())) {
              due = undefined;
            }
          } catch (e) {
            due = undefined;
          }
        }
        setDueDate(due);
        if (due) {
          setDueMonth((due.getMonth() + 1).toString());
          setDueDay(due.getDate().toString());
          setDueYear(due.getFullYear().toString());
        } else {
          setDueMonth("");
          setDueDay("");
          setDueYear("");
        }

        // Extract date and time from scheduledDate
        if (task.scheduledDate) {
          try {
            const date = new Date(task.scheduledDate);
            if (!isNaN(date.getTime())) {
              setScheduledDate(date);
              setScheduledMonth((date.getMonth() + 1).toString());
              setScheduledDay(date.getDate().toString());
              setScheduledYear(date.getFullYear().toString());
              // Format time as HH:MM and set format/period
              const hours = date.getHours();
              const minutes = date.getMinutes();
              
              // Determine format and period based on hours
              if (hours === 0) {
                setScheduledHours("12");
                setTimePeriod("AM");
                setTimeFormat("12hr");
              } else if (hours < 12) {
                setScheduledHours(hours.toString());
                setTimePeriod("AM");
                setTimeFormat("12hr");
              } else if (hours === 12) {
                setScheduledHours("12");
                setTimePeriod("PM");
                setTimeFormat("12hr");
              } else {
                setScheduledHours((hours - 12).toString());
                setTimePeriod("PM");
                setTimeFormat("12hr");
              }
              
              setScheduledMinutes(minutes.toString().padStart(2, "0"));
              setScheduledTime(`${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`);
            } else {
              // Invalid date, reset
              setScheduledDate(undefined);
              setScheduledMonth("");
              setScheduledDay("");
              setScheduledYear("");
              setScheduledTime("");
              setScheduledHours("");
              setScheduledMinutes("");
              setTimeFormat("12hr");
              setTimePeriod("AM");
            }
          } catch (e) {
            // Error parsing date, reset
            setScheduledDate(undefined);
            setScheduledMonth("");
            setScheduledDay("");
            setScheduledYear("");
            setScheduledTime("");
            setScheduledHours("");
            setScheduledMinutes("");
            setTimeFormat("12hr");
            setTimePeriod("AM");
          }
        } else {
          setScheduledDate(undefined);
          setScheduledMonth("");
          setScheduledDay("");
          setScheduledYear("");
          setScheduledTime("");
          setScheduledHours("");
          setScheduledMinutes("");
          setTimeFormat("12hr");
          setTimePeriod("AM");
        }

        setProjectId(task.projectId || "default");
        // Find folder by checking if any folder name is in the task's tags
        const taskTags = Array.isArray(task.tags) ? task.tags : [];
        try {
          if (folders && Array.isArray(folders) && folders.length > 0) {
            const matchingFolder = folders.find(f => {
              try {
                return f && typeof f === 'object' && f.name && typeof f.name === 'string' && taskTags.includes(f.name);
              } catch (e) {
                return false;
              }
            });
            setFolderId(matchingFolder?.id || null);
          } else {
            setFolderId(null);
          }
        } catch (error) {
          logger.error('Error finding folder for task:', error);
          setFolderId(null);
        }
        setTags(taskTags);
        // For recurring tasks, load subtasks per occurrence so toggling only affects this occurrence, not the series
        const occurrenceDateStr = initialDate ? getDateString(new Date(initialDate)) : (task.scheduledDate ? getDateString(new Date(task.scheduledDate)) : undefined);
        const isRecurring = task.recurrence && task.recurrence.type !== 'none';
        if (isRecurring && occurrenceDateStr) {
          const occurrenceSubtaskId = `${task.id}_subtasks_${occurrenceDateStr}`;
          const occurrenceSubtaskTask = tasks.find((t) => t.id === occurrenceSubtaskId);
          if (occurrenceSubtaskTask && Array.isArray(occurrenceSubtaskTask.subtasks)) {
            setSubtasks(occurrenceSubtaskTask.subtasks);
          } else {
            // No saved state for this occurrence: show same subtask list but all unchecked
            const baseSubtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
            setSubtasks(baseSubtasks.map((st) => ({ ...st, completed: false })));
          }
        } else {
          setSubtasks(Array.isArray(task.subtasks) ? task.subtasks : []);
        }
        setEstimatedTime(
          task.estimatedTime ? String(task.estimatedTime) : "",
        );
        // Convert minutes to hours and minutes
        if (task.estimatedTime) {
          const hours = Math.floor(task.estimatedTime / MINUTES_PER_HOUR);
          const minutes = task.estimatedTime % MINUTES_PER_HOUR;
          setEstimatedHours(String(hours));
          setEstimatedMinutes(String(minutes));
        } else {
          setEstimatedHours("0");
          setEstimatedMinutes("0");
        }
        setDependencies(Array.isArray(task.dependencies) ? task.dependencies : []);

        // Set recurrence values with safe defaults
        let recurrence: RecurrenceConfig;
        if (task.recurrence && typeof task.recurrence === 'object') {
          recurrence = {
            type: (task.recurrence.type && typeof task.recurrence.type === 'string') ? task.recurrence.type : 'none',
            interval: (typeof task.recurrence.interval === 'number' && task.recurrence.interval > 0) ? task.recurrence.interval : 1,
            daysOfWeek: Array.isArray(task.recurrence.daysOfWeek) ? task.recurrence.daysOfWeek : undefined,
            dayOfMonth: (typeof task.recurrence.dayOfMonth === 'number') ? task.recurrence.dayOfMonth : undefined,
            endDate: task.recurrence.endDate || null,
          };
        } else {
          recurrence = { type: 'none', interval: 1 };
        }
        
        setRecurrenceType(recurrence.type || "none");
        setRecurrenceInterval(recurrence.interval || 1);
        setRecurrenceDaysOfWeek(
          Array.isArray(recurrence.daysOfWeek) ? recurrence.daysOfWeek : [],
        );
        setRecurrenceDayOfMonth(recurrence.dayOfMonth);
        if (recurrence.endDate) {
          try {
            const endDate = new Date(recurrence.endDate);
            setRecurrenceEndDate(isNaN(endDate.getTime()) ? undefined : endDate);
          } catch (e) {
            setRecurrenceEndDate(undefined);
          }
        } else {
          setRecurrenceEndDate(undefined);
        }
        setAssignedTo(Array.isArray(task.assignedTo) ? task.assignedTo : []);
      } catch (error) {
        logger.error('Error loading task into dialog:', error, task);
        toast.error('Error loading task details. Some fields may be missing.');
        // Don't close dialog - use safe defaults instead
        try {
          setTitle(task?.title?.toString() || 'Untitled Task');
          setDescription(task?.description?.toString() || '');
          setStatus((task?.status as TaskStatus) || 'todo');
          setPriority((task?.priority as TaskPriority) || 'medium');
          setTags(Array.isArray(task?.tags) ? task.tags : []);
          setSubtasks(Array.isArray(task?.subtasks) ? task.subtasks : []);
        } catch (fallbackError) {
          logger.error('Error setting fallback values:', fallbackError);
        }
      }
    } else {
      // Reset for new task
      setTitle("");
      setDescription("");
      setStatus("todo");
      setPriority("medium");
      setDueDate(undefined);
      setDueMonth("");
      setDueDay("");
      setDueYear("");
      const initDate = initialDate ? new Date(initialDate) : undefined;
      setScheduledDate(initDate);
      if (initDate) {
        setScheduledMonth((initDate.getMonth() + 1).toString());
        setScheduledDay(initDate.getDate().toString());
        setScheduledYear(initDate.getFullYear().toString());
      } else {
        setScheduledMonth("");
        setScheduledDay("");
        setScheduledYear("");
      }
      setProjectId("default");
      setFolderId(initialFolderId || null);
      setTags([]);
      setTagInput("");
      setSelectedTagValue("");
      setSelectedAssigneeValue("");
      setSelectedDependencyValue("");
      setSubtasks([]);
      setEstimatedTime("");
      setEstimatedHours("0");
      setEstimatedMinutes("0");
      setScheduledTime(""); // No default time - let AI choose based on parameters
      setScheduledHours("");
      setScheduledMinutes("");
      setTimeFormat("12hr");
      setTimePeriod("AM");
      setDependencies([]);
      setTimezone("local");
      setRecurrenceType("none");
      setRecurrenceInterval(1);
      setRecurrenceDaysOfWeek([]);
        setRecurrenceDayOfMonth(undefined);
        setRecurrenceEndDate(undefined);
        setAssignedTo([]);
    }
    
    // Mark this task ID as initialized
    initializedTaskIdRef.current = currentTaskId;
  }, [task?.id, initialDate, open, folders]); // Use task?.id instead of task to prevent re-initialization on object reference changes

  // Generate description options when title changes and breakdown has effort score
  // AI Flow Step 2: Uses keywords/phrases from user input (title) to analyze effort and suggest descriptions
  // The breakdown hook (Step 1) extracts keywords/phrases and determines effort score from the title
  // This effect generates description options based on that effort score
  useEffect(() => {
    // Only generate options if:
    // 1. Dialog is open
    // 2. Title has content (user has entered task title)
    // 3. Description is empty (so we show options for user to choose)
    // 4. Breakdown has effort score (meaning keywords/phrases were analyzed from title)
    // 5. Not currently loading breakdown
    // 6. Not currently generating description (prevent conflicts)
    // CRITICAL: Check description first to prevent race conditions when AI generates description
    if (!open || !title.trim() || description.trim() || !breakdown?.effortScore || isBreakdownLoading || isGeneratingDescription) {
      setDescriptionOptions([]);
      setIsLoadingDescriptionOptions(false);
      return;
    }

    // Debounce description option generation
    setIsLoadingDescriptionOptions(true);
    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      // Double-check conditions after debounce (description might have been set by AI)
      if (cancelled || description.trim() || isGeneratingDescription) {
        setIsLoadingDescriptionOptions(false);
        return;
      }
      
      try {
        logger.debug('AI: Generating description options from title keywords/phrases', {
          title,
          effortScore: breakdown.effortScore,
          domain: breakdown.domain,
          keywordsExtracted: 'Yes (via useTaskBreakdown)',
        });

        // Use session token when available so OpenAI (server) is tried first
        const token = accessToken ?? await getSessionToken();

        // Generate description options using effort score from breakdown
        // generateDescriptionOptions internally uses extractKeywordsFromTaskName and 
        // extractTermsFromTaskNameWithBrowserAI to extract keywords/phrases from title
        // The effort score adjusts the detail level of descriptions (low effort = concise, high effort = detailed)
        const options = await generateDescriptionOptions(
          title, // Keywords/phrases are extracted from this title
          breakdown.effortScore, // Determined from title analysis
          token,
          description,
          breakdown.actionPlan?.steps?.map((s) => s.action)
        );

        // Triple-check conditions after async operation (description might have been set during async call)
        if (cancelled || description.trim() || isGeneratingDescription) {
          setIsLoadingDescriptionOptions(false);
          return;
        }

        logger.debug('AI: Description options generated', {
          count: options.length,
          options: options.map(o => ({ domain: o.domain, confidence: o.confidence })),
        });

        setDescriptionOptions(options);
      } catch (error) {
        if (cancelled) return;
        logger.error('AI: Failed to generate description options:', error);
        setDescriptionOptions([]);
      } finally {
        if (!cancelled) {
          setIsLoadingDescriptionOptions(false);
        }
      }
    }, DESCRIPTION_OPTIONS_DEBOUNCE_MS); // Debounce delay after breakdown is ready

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      setIsLoadingDescriptionOptions(false);
    };
  }, [open, title, description, breakdown?.effortScore, isBreakdownLoading, isGeneratingDescription, accessToken, getSessionToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Yield to browser so loading state can paint before heavy sync work
      await new Promise((resolve) => setTimeout(resolve, 0));

    // Default scheduled time (from business constants) when user doesn't set a time
    const [defaultScheduledHour, defaultScheduledMin] = DEFAULT_WEEKDAY_WORK_START.split(':').map(Number);
    // Duration for slot search (used when assigning default time so tasks don't all get same time)
    const durationForSlot = ((parseInt(estimatedHours) || 0) * MINUTES_PER_HOUR + (parseInt(estimatedMinutes) || 0)) || MINUTES_PER_HOUR;

    // Combine scheduledDate and scheduledTime
    let finalScheduledDate = null;
    // Use month/day/year selectors if available, otherwise fall back to scheduledDate
    let dateToUse = scheduledDate;
    if (scheduledMonth && scheduledDay && scheduledYear) {
      const month = parseInt(scheduledMonth) - 1;
      const day = parseInt(scheduledDay);
      const year = parseInt(scheduledYear);
      if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
        const constructedDate = new Date(year, month, day);
        if (!isNaN(constructedDate.getTime())) {
          dateToUse = constructedDate;
        }
      }
    }
    
    if (dateToUse) {
      const dateWithTime = new Date(dateToUse);

      // Validate the base date
      if (isNaN(dateWithTime.getTime())) {
        // Silently handle invalid date
      } else {
        // Use scheduledHours and scheduledMinutes if available, otherwise fall back to scheduledTime
        if (scheduledHours && scheduledMinutes) {
          let hours = parseInt(scheduledHours);
          const minutes = parseInt(scheduledMinutes);
          
          // Convert 12hr to 24hr if needed
          if (timeFormat === "12hr") {
            if (timePeriod === "PM" && hours !== 12) {
              hours += 12;
            } else if (timePeriod === "AM" && hours === 12) {
              hours = 0;
            }
          }
          
          // Validate parsed time values
          if (!isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours < HOURS_PER_DAY && minutes >= 0 && minutes < MINUTES_PER_HOUR) {
            dateWithTime.setHours(hours, minutes, 0, 0);
          } else if (recurrenceType !== "none") {
            dateWithTime.setHours(defaultScheduledHour, defaultScheduledMin, 0, 0);
            const slot = findNextAvailableSlot(task?.id ?? null, dateWithTime, durationForSlot, tasks ?? []);
            dateWithTime.setTime(slot.getTime());
          }
        } else if (scheduledTime) {
          // Fallback to old format if needed
          const [hours, minutes] = scheduledTime
            .split(":")
            .map(Number);
          // Validate parsed time values
          if (!isNaN(hours) && !isNaN(minutes)) {
            dateWithTime.setHours(hours, minutes, 0, 0);
          } else if (recurrenceType !== "none") {
            dateWithTime.setHours(defaultScheduledHour, defaultScheduledMin, 0, 0);
            const slot = findNextAvailableSlot(task?.id ?? null, dateWithTime, durationForSlot, tasks ?? []);
            dateWithTime.setTime(slot.getTime());
          }
        } else if (recurrenceType !== "none") {
          dateWithTime.setHours(defaultScheduledHour, defaultScheduledMin, 0, 0);
          const slot = findNextAvailableSlot(task?.id ?? null, dateWithTime, durationForSlot, tasks ?? []);
          dateWithTime.setTime(slot.getTime());
        }

        // Final validation before converting to ISO
        if (!isNaN(dateWithTime.getTime())) {
          // If a specific timezone is selected (not "local"), convert the time to UTC
          // based on the selected timezone
          if (timezone && timezone !== "local") {
            try {
              // Extract date and time components from the local date
              const year = dateWithTime.getFullYear();
              const month = dateWithTime.getMonth();
              const day = dateWithTime.getDate();
              const hour = dateWithTime.getHours();
              const minute = dateWithTime.getMinutes();
              const second = dateWithTime.getSeconds();
              
              // Create a date string representing the time in the selected timezone
              // We need to find the UTC time that, when displayed in the selected timezone,
              // equals our target time
              const targetTzFormatter = new Intl.DateTimeFormat("en-US", {
                timeZone: timezone,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              });
              
              // Try different UTC offsets to find the correct UTC time
              // that produces our target time in the selected timezone
              let found = false;
              for (let offsetHours = TASK_DIALOG_TIMEZONE.MIN_OFFSET_HOURS; offsetHours <= TASK_DIALOG_TIMEZONE.MAX_OFFSET_HOURS; offsetHours++) {
                const testUTC = new Date(Date.UTC(year, month, day, hour - offsetHours, minute, second));
                const testParts = targetTzFormatter.formatToParts(testUTC);
                const getPart = (type: string) => parseInt(testParts.find(p => p.type === type)?.value || "0", 10);
                
                const testYear = getPart("year");
                const testMonth = getPart("month") - 1; // JS months are 0-indexed
                const testDay = getPart("day");
                const testHour = getPart("hour");
                const testMinute = getPart("minute");
                
                if (testYear === year && testMonth === month && testDay === day && 
                    testHour === hour && testMinute === minute) {
                  finalScheduledDate = testUTC.toISOString();
                  found = true;
                  break;
                }
              }
              
              // Fallback: if conversion failed, use the original date
              if (!found) {
                finalScheduledDate = dateWithTime.toISOString();
              }
            } catch (error) {
              console.warn('Error converting timezone:', error);
              // Fallback to local timezone conversion
              finalScheduledDate = dateWithTime.toISOString();
            }
          } else {
            // Use local timezone (default behavior)
            finalScheduledDate = dateWithTime.toISOString();
          }
        }
      }
    }

    // Gate: Task dependencies require Pro Yearly
    if (dependencies.length > 0 && !hasFeature('taskDependencies')) {
      // Dispatch event to trigger upgrade prompt
      window.dispatchEvent(new CustomEvent('showUpgradePrompt', { 
        detail: { feature: 'taskDependencies' } 
      }));
      if (onShowUpgradePrompt) {
        onShowUpgradePrompt('taskDependencies');
      }
      return;
    }

    // Validate dependencies
    const currentTaskForValidation =
      task || ({ id: "new", dependencies: [] } as unknown as Task);
    const validation = validateDependencies(
      currentTaskForValidation,
      dependencies,
      tasks,
    );

    if (!validation.valid) {
      toast.error("Invalid Dependencies", {
        description: validation.error,
      });
      return;
    }

    // Convert hours and minutes to total minutes
    const totalMinutes =
      (parseInt(estimatedHours) || 0) * MINUTES_PER_HOUR +
      (parseInt(estimatedMinutes) || 0);

    // Validate recurrence configuration
    if (recurrenceType !== "none") {
      // Gate: Recurring tasks require Pro (monthly or yearly)
      if (!hasFeature('recurringTasks')) {
        // Dispatch event to trigger upgrade prompt (recurring tasks available in Pro Monthly)
        window.dispatchEvent(new CustomEvent('showUpgradePrompt', { 
          detail: { feature: 'recurringTasks' } 
        }));
        if (onShowUpgradePrompt) {
          onShowUpgradePrompt('recurringTasks');
        }
        return;
      }
      
      // Check recurring tasks limit for Pro Monthly (5 active recurring tasks)
      if (features.recurringTasksLimit !== undefined) {
        // Count active recurring tasks (excluding the current task if editing)
        const activeRecurringTasks = Array.isArray(tasks) ? tasks.filter(t => 
          t && 
          t.recurrence && 
          t.recurrence.type !== 'none' && 
          t.status !== 'done' &&
          t.id !== task?.id // Exclude current task if editing
        ) : [];
        
        if (activeRecurringTasks.length >= features.recurringTasksLimit) {
          toast.error('Recurring Tasks Limit Reached', {
            description: `You've reached the limit of ${features.recurringTasksLimit} active recurring tasks on Pro Monthly. Upgrade to Pro Yearly for unlimited recurring tasks.`,
            action: {
              label: 'Upgrade',
              onClick: () => {
                window.dispatchEvent(new CustomEvent('showUpgradePrompt', { 
                  detail: { feature: 'recurringTasks' } 
                }));
              },
            },
          });
          return;
        }
      }
      if (recurrenceType === "weekly" && (!recurrenceDaysOfWeek || recurrenceDaysOfWeek.length === 0)) {
        toast.error("Weekly Recurrence Required", {
          description: "Please select at least one day of the week for weekly recurrence.",
        });
        return;
      }
      if (recurrenceType === "monthly" && (!recurrenceDayOfMonth || 
          recurrenceDayOfMonth < TIMING_CONSTANTS.calendar.minDayOfMonth || 
          recurrenceDayOfMonth > TIMING_CONSTANTS.calendar.maxDayOfMonth)) {
        toast.error("Monthly Recurrence Required", {
          description: `Please select a valid day of the month (${TIMING_CONSTANTS.calendar.minDayOfMonth}-${TIMING_CONSTANTS.calendar.maxDayOfMonth}) for monthly recurrence.`,
        });
        return;
      }
      if (recurrenceInterval < TIMING_CONSTANTS.calendar.minRecurrenceInterval || 
          recurrenceInterval > TIMING_CONSTANTS.calendar.maxRecurrenceInterval) {
        toast.error("Invalid Recurrence Interval", {
          description: `Recurrence interval must be between ${TIMING_CONSTANTS.calendar.minRecurrenceInterval} and ${TIMING_CONSTANTS.calendar.maxRecurrenceInterval}.`,
        });
        return;
      }
    }

    // Build recurrence config
    const recurrenceConfig: RecurrenceConfig = {
      type: recurrenceType,
      interval: recurrenceType !== "none" ? recurrenceInterval : 1,
      daysOfWeek:
        recurrenceType === "weekly" && recurrenceDaysOfWeek.length > 0
          ? recurrenceDaysOfWeek
          : undefined,
      dayOfMonth:
        recurrenceType === "monthly" && recurrenceDayOfMonth
          ? recurrenceDayOfMonth
          : undefined,
      endDate: recurrenceType !== "none" && recurrenceEndDate
        ? recurrenceEndDate.toISOString()
        : null,
    };

    // For recurring tasks with no scheduledDate: allow unscheduling if already scheduled; auto-fill first occurrence only when creating
    if (recurrenceType !== "none" && !finalScheduledDate && !task?.scheduledDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let firstOccurrenceDate: Date | null = null;
      
      if (recurrenceType === "daily") {
        // First occurrence is today so "every N days" includes today
        firstOccurrenceDate = new Date(today);
      } else if (recurrenceType === "weekly" && recurrenceDaysOfWeek && recurrenceDaysOfWeek.length > 0) {
        const currentDay = today.getDay();
        const sortedDays = [...recurrenceDaysOfWeek].sort((a, b) => a - b);
        // Find the next matching day (including today if it matches)
        const nextDayInWeek = sortedDays.find(day => day >= currentDay);
        
        if (nextDayInWeek !== undefined) {
          firstOccurrenceDate = new Date(today);
          firstOccurrenceDate.setDate(today.getDate() + (nextDayInWeek - currentDay));
          // If it's today, move to the next occurrence
          if (firstOccurrenceDate.getTime() === today.getTime()) {
            // Find the next occurrence after today
            const nextAfterToday = sortedDays.find(day => day > currentDay);
            if (nextAfterToday !== undefined) {
              firstOccurrenceDate.setDate(today.getDate() + (nextAfterToday - currentDay));
            } else {
              // First occurrence is in the next interval week
              const daysUntilNextWeek = TIMING_CONSTANTS.calendar.daysPerWeek - currentDay;
              const daysToFirstDay = sortedDays[0];
              const daysToAdd = daysUntilNextWeek + daysToFirstDay + (TIMING_CONSTANTS.calendar.daysPerWeek * (recurrenceInterval - 1));
              firstOccurrenceDate.setDate(today.getDate() + daysToAdd);
            }
          }
        } else {
          // First occurrence is in the next interval week
          const daysUntilNextWeek = TIMING_CONSTANTS.calendar.daysPerWeek - currentDay;
          const daysToFirstDay = sortedDays[0];
          const daysToAdd = daysUntilNextWeek + daysToFirstDay + (TIMING_CONSTANTS.calendar.daysPerWeek * (recurrenceInterval - 1));
          firstOccurrenceDate = new Date(today);
          firstOccurrenceDate.setDate(today.getDate() + daysToAdd);
        }
      } else if (recurrenceType === "monthly") {
        if (recurrenceDayOfMonth) {
          firstOccurrenceDate = new Date(today.getFullYear(), today.getMonth(), recurrenceDayOfMonth);
          if (firstOccurrenceDate < today) {
            // If the day has passed this month, move to next month
            firstOccurrenceDate.setMonth(today.getMonth() + recurrenceInterval);
          }
        } else {
          // Use the same day of month
          firstOccurrenceDate = new Date(today);
          firstOccurrenceDate.setMonth(today.getMonth() + recurrenceInterval);
        }
      }
      
      if (firstOccurrenceDate) {
        const taskDuration = durationForSlot;
        // Use explicit time from form when valid; otherwise select appropriate time from next available timeslot (no hardcoding)
        if (scheduledHours && scheduledMinutes) {
          let hours = parseInt(scheduledHours, 10);
          const minutes = parseInt(scheduledMinutes, 10);
          if (timeFormat === "12hr") {
            if (timePeriod === "PM" && hours !== 12) hours += 12;
            else if (timePeriod === "AM" && hours === 12) hours = 0;
          }
          if (!Number.isNaN(hours) && !Number.isNaN(minutes) && hours >= 0 && hours < HOURS_PER_DAY && minutes >= 0 && minutes < MINUTES_PER_HOUR) {
            firstOccurrenceDate.setHours(hours, minutes, 0, 0);
          } else {
            firstOccurrenceDate.setHours(defaultScheduledHour, defaultScheduledMin, 0, 0);
            const slot = findNextAvailableSlot(task?.id ?? null, firstOccurrenceDate, taskDuration, tasks ?? []);
            firstOccurrenceDate.setTime(slot.getTime());
          }
        } else {
          firstOccurrenceDate.setHours(defaultScheduledHour, defaultScheduledMin, 0, 0);
          const slot = findNextAvailableSlot(task?.id ?? null, firstOccurrenceDate, taskDuration, tasks ?? []);
          firstOccurrenceDate.setTime(slot.getTime());
        }
        finalScheduledDate = firstOccurrenceDate.toISOString();
      }
    }

    // Ensure tags is always an array
    const taskTags = Array.isArray(tags) ? tags.filter(tag => tag && tag.trim()) : [];

    // Calculate estimatedTime: use user input if provided, otherwise use AI estimator
    let finalEstimatedTime: number | null = null;
    if (totalMinutes > 0) {
      // User has manually set a duration
      finalEstimatedTime = totalMinutes;
    } else {
      // No user-set duration: use AI Duration Estimator
      // Create a temporary task object for the estimator
      const tempTask: Task = {
        id: task?.id || 'temp',
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        dueDate: (() => {
          let dateToUse = dueDate;
          if (dueMonth && dueDay && dueYear) {
            const month = parseInt(dueMonth) - 1;
            const day = parseInt(dueDay);
            const year = parseInt(dueYear);
            if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
              const constructedDate = new Date(year, month, day);
              if (!isNaN(constructedDate.getTime())) {
                dateToUse = constructedDate;
              }
            }
          }
          return dateToUse ? dateToUse.toISOString() : null;
        })(),
        scheduledDate: finalScheduledDate,
        projectId,
        folderId: folderId || null,
        tags: taskTags,
        subtasks,
        estimatedTime: null, // Explicitly null to trigger AI estimator
        notes: '',
        dependencies,
        recurrence: recurrenceConfig,
        assignedTo,
        createdBy: task?.createdBy || 'local',
        createdAt: task?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
        actualTime: null,
      };
      
      // Use AI Duration Estimator to get estimated duration
      const aiEstimatedMinutes = getTaskMinutes(tempTask);
      finalEstimatedTime = aiEstimatedMinutes > 0 ? aiEstimatedMinutes : null;
      
      console.log('🤖 TaskDialog: AI Duration Estimator triggered for new task', {
        taskTitle: title.trim(),
        taskDescription: description.trim(),
        taskPriority: priority,
        aiEstimatedMinutes,
        finalEstimatedTime,
      });
    }

    const taskData = {
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      dueDate: (() => {
        let dateToUse = dueDate;
        if (dueMonth && dueDay && dueYear) {
          const month = parseInt(dueMonth) - 1;
          const day = parseInt(dueDay);
          const year = parseInt(dueYear);
          if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
            const constructedDate = new Date(year, month, day);
            if (!isNaN(constructedDate.getTime())) {
              dateToUse = constructedDate;
            }
          }
        }
        return dateToUse ? dateToUse.toISOString() : null;
      })(),
      scheduledDate: finalScheduledDate,
      projectId,
      folderId: folderId || null,
      tags: taskTags,
      subtasks,
      estimatedTime: finalEstimatedTime,
      notes: '', // Notes section removed
      dependencies,
      recurrence: recurrenceConfig,
      assignedTo,
    };

    // Check if user is actually changing the scheduled time
    // If editing an existing task, compare with original scheduled time
    // Declare outside the if block to ensure it's accessible
    let timeHasChanged = true; // Default to true for new tasks
    if (task && task.scheduledDate && finalScheduledDate) {
      const originalScheduledTime = new Date(task.scheduledDate);
      const scheduledDateTime = new Date(finalScheduledDate);
      // Compare times (ignore milliseconds)
      const originalTime = originalScheduledTime.getTime();
      const newTime = scheduledDateTime.getTime();
      // Consider times equal if within 1 minute (to account for rounding)
      timeHasChanged = Math.abs(newTime - originalTime) > MILLISECONDS_PER_MINUTE;
    }
    
    // Check for time conflicts if scheduled date is set
    if (finalScheduledDate) {
      const scheduledDateTime = new Date(finalScheduledDate);
      // Use finalEstimatedTime (which includes AI estimate) for conflict checking
      const taskDuration = finalEstimatedTime || 30; // Use AI-estimated duration, fallback to 30 minutes
      const taskId = task?.id || null;
      
      // Create temporary task for category hours check
      const tempTask: Task = {
        ...(task || {}),
        id: taskId || 'temp',
        tags: taskData.tags || task?.tags || [],
      } as Task;
      
      // Get category hours if applicable
      const categoryHours = getCategoryHoursForTask(tempTask, scheduledDateTime, hoursSettings);
      
      // Check if scheduling for today and ensure time is after current time
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const scheduledDateOnly = new Date(scheduledDateTime);
      scheduledDateOnly.setHours(0, 0, 0, 0);
      const isToday = scheduledDateOnly.getTime() === today.getTime();
      
      // If scheduling for today and time is in the past, only suggest alternative if time has changed
      let finalScheduledTime = scheduledDateTime;
      if (isToday && scheduledDateTime.getTime() < now.getTime() && timeHasChanged) {
        const alternativeTime = findNextAvailableSlot(
          taskId,
          now,
          taskDuration,
          tasks,
          {
            ensureAfterCurrentTime: true,
            categoryHours: categoryHours,
          }
        );
        
        if (alternativeTime.getHours() < HOURS_PER_DAY) {
          setPendingTaskData({
            taskData,
            requestedTime: scheduledDateTime,
            alternativeTime,
          });
          setConflictDialogOpen(true);
          return;
        } else {
          toast.error('No available time slots', {
            description: 'No available slots after current time within category hours and 5-hour limit.',
          });
          return;
        }
      } else if (isToday && scheduledDateTime.getTime() < now.getTime() && !timeHasChanged) {
        // Time hasn't changed but is in the past - this is okay for existing tasks
        // Just proceed with the update (user might be editing other properties)
        finalScheduledTime = scheduledDateTime;
      }
      
      // Only check for conflicts if time has changed
      // If time hasn't changed, the task is already at this time slot, so no conflict check needed
      if (timeHasChanged) {
        const conflictingTask = checkTimeConflict(
          taskId,
          scheduledDateTime,
          taskDuration,
          tasks
        );

        if (conflictingTask) {
          // Find next available slot
          const alternativeTime = findNextAvailableSlot(
            taskId,
            scheduledDateTime,
            taskDuration,
            tasks,
            {
              ensureAfterCurrentTime: isToday,
              categoryHours: categoryHours,
            }
          );
          
          // Only show dialog if alternative time is different and valid
          if (alternativeTime.getTime() !== scheduledDateTime.getTime() && alternativeTime.getHours() < HOURS_PER_DAY) {
            // Store the pending task data and show dialog
            setPendingTaskData({
              taskData,
              requestedTime: scheduledDateTime,
              alternativeTime,
            });
            setConflictDialogOpen(true);
            return; // Don't submit yet
          } else {
            // No valid alternative found, show error
            const reason = isToday && scheduledDateTime.getTime() < now.getTime()
              ? 'Selected time is in the past. Please choose a time after the current time.'
              : 'Time slot is already taken or outside category hours. Please choose a different time slot.';
            toast.error('Time slot unavailable', {
              description: reason,
            });
            return;
          }
        }
      }
      
      finalScheduledTime = scheduledDateTime;
      
      // Check 5-hour daily limit if scheduling for today
      // Only check if time has changed OR if estimated time has changed (which affects daily hours)
      if (isToday) {
        // Check if this is an existing task that's already scheduled for today
        const isExistingTaskOnToday = task && task.scheduledDate && 
          (() => {
            const existingDate = new Date(task.scheduledDate);
            existingDate.setHours(0, 0, 0, 0);
            return existingDate.getTime() === today.getTime();
          })();
        
        // Check if estimated time has changed
        // Use finalEstimatedTime (which includes AI estimate) for comparison
        const estimatedTimeHasChanged = task 
          ? (task.estimatedTime || 0) !== (finalEstimatedTime || 0)
          : true; // New task, so it's a change
        
        // Only check daily limit if time has changed OR estimated time has changed
        // If neither changed, the task is already accounted for in daily hours
        if (timeHasChanged || estimatedTimeHasChanged) {
          // Create a temporary task object for limit checking
          // Use finalEstimatedTime (which includes AI estimate) instead of totalMinutes
          const tempTaskForLimit: Task = {
            ...(task || {}),
            id: taskId || 'temp',
            estimatedTime: finalEstimatedTime, // Use AI-estimated duration if available
          } as Task;
          
          const maxHoursPerDay = aiSettings.maxHoursPerDay;
          const limitCheck = checkDailyLimit(scheduledDateOnly, tempTaskForLimit, tasks, maxHoursPerDay);
          const warningLevel = getDailyHoursWarningLevel(limitCheck.currentHours, limitCheck.newTotalHours - limitCheck.currentHours, maxHoursPerDay);
          
          if (limitCheck.wouldExceed) {
            // Only suggest alternative time if time has changed
            // If only estimated time changed, show error but don't relocate
            if (timeHasChanged) {
              // Would exceed limit - try to find a slot that fits
              const alternativeTime = findNextAvailableSlot(
                taskId,
                finalScheduledTime,
                taskDuration,
                tasks,
                {
                  ensureAfterCurrentTime: isToday,
                  categoryHours: categoryHours,
                }
              );
              
              // Check if alternative time would also exceed limit
              const altLimitCheck = checkDailyLimit(alternativeTime, tempTaskForLimit, tasks, maxHoursPerDay);
              if (altLimitCheck.wouldExceed) {
                const message = isExistingTaskOnToday 
                  ? `Updating this task would exceed the ${maxHoursPerDay}-hour daily limit. Current: ${limitCheck.currentHours.toFixed(1)}h, Task: ${(limitCheck.newTotalHours - limitCheck.currentHours).toFixed(1)}h, Total: ${limitCheck.newTotalHours.toFixed(1)}h`
                  : `This task would exceed the ${maxHoursPerDay}-hour daily limit. Current: ${limitCheck.currentHours.toFixed(1)}h, Adding: ${(limitCheck.newTotalHours - limitCheck.currentHours).toFixed(1)}h, Total: ${limitCheck.newTotalHours.toFixed(1)}h`;
                
                toast.error('Daily limit exceeded', {
                  description: message,
                  duration: TOAST_DURATION_LONG_MS,
                });
                return;
              }
              
              // Use alternative time that fits within limit
              finalScheduledTime = alternativeTime;
              taskData.scheduledDate = finalScheduledTime.toISOString();
            } else {
              // Only estimated time changed, but would exceed limit
              // Don't relocate, just show error
              const message = `Updating this task's duration would exceed the ${maxHoursPerDay}-hour daily limit. Current: ${limitCheck.currentHours.toFixed(1)}h, Task: ${(limitCheck.newTotalHours - limitCheck.currentHours).toFixed(1)}h, Total: ${limitCheck.newTotalHours.toFixed(1)}h`;
              
              toast.error('Daily limit exceeded', {
                description: message,
                duration: TOAST_DURATION_LONG_MS,
              });
              return;
            }
          }
          
          if (warningLevel === 'warning' && !limitCheck.wouldExceed) {
            // Close to limit - show warning but allow
            const message = isExistingTaskOnToday
              ? `Today already has ${limitCheck.currentHours.toFixed(1)}h scheduled. Updating this task will bring it to ${limitCheck.newTotalHours.toFixed(1)}h (limit: ${maxHoursPerDay}h)`
              : `Today already has ${limitCheck.currentHours.toFixed(1)}h scheduled. Adding this task will bring it to ${limitCheck.newTotalHours.toFixed(1)}h (limit: ${maxHoursPerDay}h)`;
            
            toast.warning('Approaching daily limit', {
              description: message,
              duration: TOAST_DURATION_MEDIUM_MS,
            });
          }
        }
      }
    }

    // No conflict, proceed with submission
    let savedTask: Task;
    if (task) {
      // For recurring tasks opened from a specific day, save subtasks only to that occurrence so the series is unaffected
      const occurrenceDateStr = initialDate ? getDateString(new Date(initialDate)) : (task.scheduledDate ? getDateString(new Date(task.scheduledDate)) : undefined);
      const isRecurringWithOccurrence = task.recurrence?.type !== 'none' && occurrenceDateStr;
      if (isRecurringWithOccurrence) {
        const occurrenceSubtaskId = `${task.id}_subtasks_${occurrenceDateStr}`;
        const occurrenceScheduled = finalScheduledDate ? new Date(finalScheduledDate) : (task.scheduledDate ? new Date(task.scheduledDate) : new Date(occurrenceDateStr + DATE_ONLY_PARSE_SUFFIX));
        const occurrenceDateOnly = new Date(occurrenceDateStr + DATE_ONLY_PARSE_SUFFIX);
        occurrenceDateOnly.setHours(occurrenceScheduled.getHours(), occurrenceScheduled.getMinutes(), occurrenceScheduled.getSeconds(), occurrenceScheduled.getMilliseconds());
        await updateTask(occurrenceSubtaskId, {
          ...taskData,
          subtasks,
          recurrence: { type: 'none', interval: 1 },
          scheduledDate: occurrenceDateOnly.toISOString(),
        });
        savedTask = { ...task, ...taskData, id: occurrenceSubtaskId, subtasks } as Task;
      } else {
        await updateTask(task.id, taskData);
        savedTask = { ...task, ...taskData } as Task;
      }
    } else {
      await addTask(taskData);
      // After adding, the task will be in the tasks list - find it by matching properties
      // Note: This is a workaround since addTask returns void
      savedTask = { ...taskData, id: `temp-${Date.now()}` } as Task;
    }

    // Auto-sync to calendar if task has scheduled date and calendar is connected
    if (finalScheduledDate && hasFeature('calendarSync')) {
      // Only sync to Google and Apple Calendar
      const providersToSync: Array<'google' | 'apple'> = [];
      if (calendarStatus.google) providersToSync.push('google');
      if (calendarStatus.apple) providersToSync.push('apple');
      
      if (providersToSync.length > 0) {
        // Sync to all connected providers
        for (const provider of providersToSync) {
          try {
            await syncTaskToCalendar(savedTask.id, provider);
          } catch (error) {
            // Silently fail - don't block task creation/update
            logger.debug('Failed to sync task to calendar:', error);
          }
        }
      }
    }

    onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConflictConfirm = async () => {
    if (pendingTaskData) {
      // Update scheduled date to alternative time
      const updatedTaskData = {
        ...pendingTaskData.taskData,
        scheduledDate: pendingTaskData.alternativeTime.toISOString(),
      };
      
      if (task) {
        await updateTask(task.id, updatedTaskData);
      } else {
        await addTask(updatedTaskData);
      }
      
      toast.success(`Task scheduled for ${formatTime(pendingTaskData.alternativeTime)}`);
    }
    setConflictDialogOpen(false);
    setPendingTaskData(null);
    onClose();
  };

  const handleConflictCancel = () => {
    setConflictDialogOpen(false);
    setPendingTaskData(null);
    // Don't close dialog, let user adjust the time
  };

  const addTag = async () => {
    const tagToAdd = tagInput.trim();
    if (tagToAdd && !tags.includes(tagToAdd)) {
      setTags([...tags, tagToAdd]);
      setTagInput("");
      // Add to available tags if it's a new tag
      if (availableTags && !availableTags.includes(tagToAdd)) {
        try {
          await addAvailableTag(tagToAdd);
        } catch (error) {
          // Silently fail - tag will still be added to this task
          logger.debug('Failed to add tag to available tags:', error);
        }
      }
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const addSubtask = () => {
    if (subtaskInput.trim()) {
      const newSubtask: Subtask = {
        id: `subtask_${Date.now()}`,
        title: subtaskInput.trim(),
        completed: false,
        createdAt: new Date().toISOString(),
        assignedTo: [], // Initialize empty assignment
      };
      setSubtasks([...subtasks, newSubtask]);
      setSubtaskInput("");
    }
  };

  const assignSubtaskToMember = (subtaskId: string, memberId: string) => {
    setSubtasks(
      subtasks.map((st) =>
        st.id === subtaskId
          ? {
              ...st,
              assignedTo: st.assignedTo?.includes(memberId)
                ? st.assignedTo.filter((id) => id !== memberId)
                : [...(st.assignedTo || []), memberId],
            }
          : st
      )
    );
  };

  const toggleSubtask = (subtaskId: string) => {
    setSubtasks(
      subtasks.map((st) =>
        st.id === subtaskId
          ? { ...st, completed: !st.completed }
          : st,
      ),
    );
  };

  const removeSubtask = (subtaskId: string) => {
    setSubtasks(subtasks.filter((st) => st.id !== subtaskId));
  };

  const handlePomodoroTimeUpdate = async (minutes: number) => {
    if (task) {
      try {
        // UPDATED: For recurring tasks, track time on the base task to maintain series progress
        // Time tracking is on the initial/base task, not per-occurrence
        const isRecurringTask = task.recurrence && task.recurrence.type !== 'none';
        if (isRecurringTask) {
          // Extract base task ID (remove any existing occurrence suffix)
          const baseTaskId = task.id.includes('__') 
            ? task.id.split('__')[0] 
            : task.id.includes('_completed_')
              ? task.id.split('_completed_')[0]
              : task.id;
          
          // Update the base task with tracked time - this maintains progress across the series
          await updateTask(baseTaskId, {
            actualTime: minutes,
          });
        } else {
          // Non-recurring task - update normally
          await updateTask(task.id, {
            actualTime: minutes,
          });
        }
        toast.success(
          `Time tracked: ${Math.floor(minutes / MINUTES_PER_HOUR)}h ${minutes % MINUTES_PER_HOUR}m`,
        );
      } catch (error) {
        // Error handled by toast
        toast.error("Failed to track time");
      }
    }
  };

  const addDependency = (taskId: string) => {
    if (!dependencies.includes(taskId)) {
      setDependencies([...dependencies, taskId]);
    }
  };

  const removeDependency = (taskId: string) => {
    setDependencies(dependencies.filter((id) => id !== taskId));
  };

  const handleDelete = async () => {
    if (!task) return;

    // Check permissions
    if (!permissions.canDeleteTask) {
      toast.error('Permission Denied', {
        description: 'Viewer role does not have permission to delete tasks. Please contact an admin.',
      });
      return;
    }

    try {
      await deleteTask(task.id);
      toast.success("Task deleted", {
        description: "The task has been permanently deleted.",
      });
      setShowDeleteConfirm(false);
      onClose();
    } catch (error) {
      toast.error("Failed to delete task", {
        description: "Something went wrong. Please try again.",
      });
    }
  };

  const handleDuplicate = async () => {
    if (!task) return;

    try {
      // Create a copy of the task with new IDs for subtasks
      const duplicatedSubtasks = Array.isArray(task.subtasks) 
        ? task.subtasks.map((subtask) => ({
            ...subtask,
            id: `subtask_${Date.now()}_${Math.random()}`,
            completed: false, // Reset subtask completion status
            createdAt: new Date().toISOString(),
          }))
        : [];

      // Safely extract recurrence config
      let recurrenceConfig: RecurrenceConfig;
      if (task.recurrence && typeof task.recurrence === 'object') {
        recurrenceConfig = {
          type: (task.recurrence.type && typeof task.recurrence.type === 'string') ? task.recurrence.type : 'none',
          interval: (typeof task.recurrence.interval === 'number' && task.recurrence.interval > 0) ? task.recurrence.interval : 1,
          daysOfWeek: Array.isArray(task.recurrence.daysOfWeek) ? [...task.recurrence.daysOfWeek] : undefined,
          dayOfMonth: (typeof task.recurrence.dayOfMonth === 'number') ? task.recurrence.dayOfMonth : undefined,
          endDate: task.recurrence.endDate || null,
        };
      } else {
        recurrenceConfig = {
          type: "none" as RecurrenceType,
          interval: 1,
        };
      }

      const duplicatedTaskData = {
        title: `${task.title || 'Untitled Task'} (Copy)`,
        description: task.description || '',
        status: "todo" as TaskStatus, // Reset status to todo
        priority: task.priority || 'medium',
        dueDate: task.dueDate || null,
        scheduledDate: task.scheduledDate || null,
        projectId: task.projectId || 'default',
        tags: Array.isArray(task.tags) ? [...task.tags] : [], // Copy tags array
        subtasks: duplicatedSubtasks,
        estimatedTime: (typeof task.estimatedTime === 'number') ? task.estimatedTime : null,
        notes: '',
        dependencies: [], // Don't copy dependencies to avoid circular references
        recurrence: recurrenceConfig,
        assignedTo: Array.isArray(task.assignedTo) ? [...task.assignedTo] : [], // Copy assigned users
      };

      await addTask(duplicatedTaskData);
      toast.success("Task duplicated", {
        description: `"${task.title}" has been duplicated successfully.`,
      });
      onClose();
    } catch (error) {
      toast.error("Failed to duplicate task", {
        description: "Something went wrong. Please try again.",
      });
    }
  };

  // Get available tasks for dependencies (exclude self and completed tasks)
  const availableTasksForDependencies = Array.isArray(tasks) ? tasks.filter(
    (t) => t && t.id && t.id !== task?.id && t.status !== "done",
  ) : [];

  // Convert time between timezones
  const getTimezoneDisplay = () => {
    if (!scheduledTime || timezone === "local") return null;

    try {
      const date = new Date(`2000-01-01T${scheduledTime}:00`);
      const formatter = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: timezone,
      });
      return formatter.format(date);
    } catch (error) {
      return null;
    }
  };

  // Debug logging removed - only log when dialog is actually open with a task
  if (open && task) {
    logger.debug('TaskDialog rendering:', { taskId: task.id });
  }

  return (
    <Dialog 
      open={open} 
      modal={true}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <DialogContent
        hideCloseButton
        className={cn(
          "max-h-[90vh] min-h-0 overflow-hidden flex flex-col w-[95vw] sm:w-full rounded-2xl p-0 gap-0 !border-0 !bg-transparent !shadow-none sm:!shadow-xl",
          TASK_DIALOG_COLORS.dialogMaxWidth,
          "text-foreground dark:text-foreground"
        )}
      >
        {/* Single panel: yellow gradient only (no outer white box); close on panel */}
        <div className={cn(
          "relative flex-1 flex flex-col min-h-0 overflow-hidden rounded-2xl shadow-xl",
          TASK_DIALOG_COLORS.contentCardBg,
          TASK_DIALOG_MINIMAL_SPACING.dialogInnerPadding
        )}>
          {/* Close button on yellow gradient panel */}
          <button
            type="button"
            onClick={onClose}
            className={cn(TASK_DIALOG_MINIMAL_SPACING.closeButtonPosition, "text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-colors")}
            aria-label="Close"
          >
            <Icon name="x" size={ICON_SIZE_MD} aria-hidden />
          </button>
          {/* Tabs at top */}
          <nav className={cn("flex flex-row items-center gap-1 pb-3 border-b border-border/50 mb-3", TASK_DIALOG_MINIMAL_SPACING.navPaddingRightForClose)} aria-label="Task sections">
            <button
              type="button"
              onClick={() => setActiveTab('basic')}
              className={cn(
                "rounded-md py-2 px-3 text-xs sm:text-sm font-medium",
                activeTab === 'basic' ? "bg-primary/15 text-primary" : "text-foreground hover:bg-primary/10"
              )}
            >
              {TASK_DIALOG_UI_TEXT.taskInfoTitle}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('scheduling')}
              className={cn(
                "rounded-md py-2 px-3 text-xs sm:text-sm font-medium",
                activeTab === 'scheduling' ? "bg-primary/15 text-primary" : "text-foreground hover:bg-primary/10"
              )}
            >
              {TASK_DIALOG_UI_TEXT.schedule.desktop}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('organization')}
              className={cn(
                "rounded-md py-2 px-3 text-xs sm:text-sm font-medium",
                activeTab === 'organization' ? "bg-primary/15 text-primary" : "text-foreground hover:bg-primary/10"
              )}
            >
              {TASK_DIALOG_UI_TEXT.organize.header ?? TASK_DIALOG_UI_TEXT.organize.desktop}
            </button>
          </nav>
        <DialogTitle className="sr-only">
          {activeTab === 'basic'
            ? TASK_DIALOG_UI_TEXT.taskInfoTitle
            : activeTab === 'scheduling'
              ? TASK_DIALOG_UI_TEXT.schedule.desktop
              : TASK_DIALOG_UI_TEXT.organize.header ?? TASK_DIALOG_UI_TEXT.organize.desktop}
        </DialogTitle>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(e as any);
          }}
          className="flex-1 overflow-hidden flex flex-col min-h-0"
        >
          {/* Tabbed Interface - single column (reference: no right menu) */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 flex overflow-hidden flex-col">
              {/* Content Area - single column */}
              <div className={cn(
                "flex-1 overflow-y-auto",
                TASK_DIALOG_MINIMAL_SPACING.contentPadding
              )}>
                {/* Basic Info Tab - Reference: warm surface only; Task Name, Description, Status, Priority with generous spacing; no inner card */}
                <TabsContent value="basic" className={cn("mt-0", TASK_DIALOG_MINIMAL_SPACING.basicContentSpaceY)}>
                  {/* Task Name - reference: bold label, white rounded borderless input; emoji picker for title */}
                  <div className={TASK_DIALOG_MINIMAL_SPACING.fieldSpaceY}>
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="title" className="text-xs sm:text-sm font-bold text-foreground">{TASK_DIALOG_UI_TEXT.taskNameMinimal}</Label>
                      <EmojiPickerPopover
                        triggerTitle="Insert emoji"
                        onSelect={(emoji) => {
                          const input = titleInputRef.current;
                          if (input) {
                            const start = input.selectionStart ?? title.length;
                            const end = input.selectionEnd ?? title.length;
                            setTitle(title.slice(0, start) + emoji + title.slice(end));
                            setTimeout(() => {
                              input.focus();
                              input.setSelectionRange(start + emoji.length, start + emoji.length);
                            }, 0);
                          } else {
                            setTitle(title + emoji);
                          }
                        }}
                      />
                    </div>
                    <div className="flex gap-1 mt-1">
                      <Input
                        ref={titleInputRef}
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={TASK_DIALOG_UI_TEXT.taskNamePlaceholder}
                        autoFocus
                        disabled={task ? !permissions.canEditTask : !permissions.canCreateTask}
                        className={cn(TASK_DIALOG_COLORS.inputFieldBg, "rounded-lg focus-visible:ring-2 focus-visible:ring-primary/30 h-9 sm:h-10 text-sm min-w-0 flex-1")}
                      />
                    </div>
                  </div>

                  {/* Description - reference: bold label, white rounded area; emoji picker for description */}
                  <div className={cn(TASK_DIALOG_MINIMAL_SPACING.fieldSpaceY, "pt-0.5")}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 min-w-0">
                      <Label htmlFor="description" className="text-xs sm:text-sm font-bold text-foreground">{TASK_DIALOG_UI_TEXT.descriptionMinimal}</Label>
                      <EmojiPickerPopover
                        triggerTitle="Insert emoji"
                        onSelect={(emoji) => setDescription(description + emoji)}
                      />
                    </div>
                    {title.trim() && (
                      <div className="flex items-center gap-1">
                        {/* Redo/Regenerate Description Button - Only show if description exists */}
                        {description.trim() && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isGeneratingDescription || isBreakdownLoading}
                            onClick={() => {
                              if (isGeneratingDescription) return; // Prevent multiple clicks
                              setIsGeneratingDescription(true);
                              // Defer async operation to avoid blocking click handler
                              setTimeout(async () => {
                                try {
                                  // Use session token when available so OpenAI (server) is tried first
                                  const token = accessToken ?? await getSessionToken();
                                  // Force regeneration by passing empty description to get fresh result
                                  // This ensures we get a new/modified description rather than reusing the existing one
                                  const generated = await generateDescription(
                                    title, 
                                    token, 
                                    '', 
                                    breakdown?.effortScore,
                                    breakdown?.actionPlan?.steps?.map((s) => s.action)
                                  );
                                logger.debug('AI Refresh description result:', { 
                                  hasDescription: !!generated.description, 
                                  descriptionLength: generated.description?.length || 0,
                                  confidence: generated.confidence,
                                  domain: generated.domain,
                                  previousDescription: description.substring(0, DESCRIPTION_UI_CONFIG.DESCRIPTION_PREVIEW_LENGTH),
                                  newDescription: generated.description?.substring(0, DESCRIPTION_UI_CONFIG.DESCRIPTION_PREVIEW_LENGTH)
                                });
                                
                                if (generated.description && generated.description.trim().length > 0) {
                                  // Replace existing description with regenerated one
                                  // Ensure description starts at first line (remove leading whitespace)
                                  const cleanedDescription = generated.description.trim().replace(/^\s+/, '');
                                  setDescription(cleanedDescription);
                                  toast.success('Description regenerated', {
                                    description: `Regenerated based on ${generated.domain} context. AI Action Plan will update automatically.`,
                                  });
                                } else {
                                  logger.warn('Regenerated description is empty:', generated);
                                  toast.error('Failed to regenerate description', {
                                    description: 'The AI could not generate a description. Please try again or enter description manually.',
                                  });
                                }
                                } catch (error) {
                                  logger.warn('Description regeneration failed:', error);
                                  toast.error('Failed to regenerate description', {
                                    description: 'Please try again',
                                  });
                                } finally {
                                  setIsGeneratingDescription(false);
                                }
                              }, 0); // Defer to next event loop tick
                            }}
                            className={cn(
                              "border-2 border-primary/30 dark:border-primary/50",
                              "hover:border-primary/50 dark:hover:border-primary/70",
                              "hover:bg-accent/50 dark:hover:bg-accent/30",
                              `transition-all ${TASK_DIALOG_TRANSITIONS.BUTTON_HOVER_DURATION_CLASS}`,
                              "font-medium",
                              isGeneratingDescription && "opacity-50 cursor-not-allowed"
                            )}
                            style={{ 
                              height: COMPONENT_DIMENSIONS.taskDialog.aiButton.height,
                              paddingLeft: COMPONENT_DIMENSIONS.taskDialog.aiButton.paddingX,
                              paddingRight: COMPONENT_DIMENSIONS.taskDialog.aiButton.paddingX,
                              fontSize: COMPONENT_DIMENSIONS.taskDialog.aiButton.textSize,
                              gap: SETTINGS_PANEL_GAP_SMALL 
                            }}
                            title="Redo/Regenerate description (replaces current)"
                          >
                            <Icon 
                              name="arrow-clockwise"
                              size={COMPONENT_DIMENSIONS.taskDialog.aiButton.iconSize}
                              weight={isGeneratingDescription ? "regular" : "duotone"}
                              className={cn(
                                isGeneratingDescription && "animate-spin"
                              )}
                            />
                            <span className="hidden lg:inline">Redo</span>
                          </Button>
                        )}
                        {/* Generate New Description Button - Appends to existing or creates new */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isGeneratingDescription || isBreakdownLoading}
                          onClick={() => {
                            if (isGeneratingDescription) return; // Prevent multiple clicks
                            setIsGeneratingDescription(true);
                            // Defer async operation to avoid blocking click handler
                            setTimeout(async () => {
                              try {
                                // Use session token when available so OpenAI (server) is tried first
                                const token = accessToken ?? await getSessionToken();
                                logger.debug('AI Generate button clicked:', { title, hasAccessToken: !!(accessToken ?? token), effortScore: breakdown?.effortScore });
                                const generated = await generateDescription(title, token, description, breakdown?.effortScore, breakdown?.actionPlan?.steps?.map((s) => s.action));
                                logger.debug('AI Generate result received:', {
                                hasDescription: !!generated.description,
                                descriptionLength: generated.description?.length || 0,
                                descriptionPreview: generated.description?.substring(0, DESCRIPTION_UI_CONFIG.DESCRIPTION_PREVIEW_LENGTH) || 'empty',
                                confidence: generated.confidence,
                                domain: generated.domain
                              });
                              
                              if (generated.description && generated.description.trim().length > 0) {
                                const newDescription = description 
                                  ? `${description}${DESCRIPTION_GENERATION_CONFIG.descriptionSeparator}${generated.description}`
                                  : generated.description;
                                
                                logger.debug('Setting description:', { 
                                  oldLength: description.length,
                                  newLength: newDescription.length,
                                  newDescriptionPreview: newDescription.substring(0, DESCRIPTION_UI_CONFIG.DESCRIPTION_PREVIEW_LENGTH),
                                  oldDescription: description.substring(0, Math.floor(DESCRIPTION_UI_CONFIG.DESCRIPTION_PREVIEW_LENGTH * TASK_DIALOG_CALCULATIONS.DESCRIPTION_PREVIEW_RATIO)),
                                  newDescription: newDescription.substring(0, Math.floor(DESCRIPTION_UI_CONFIG.DESCRIPTION_PREVIEW_LENGTH * TASK_DIALOG_CALCULATIONS.DESCRIPTION_PREVIEW_RATIO))
                                });
                                
                                setDescription(newDescription);
                                
                                // Log after state update to verify it was set (only in development)
                                if (process.env.NODE_ENV === 'development') {
                                  setTimeout(() => {
                                    logger.debug('Description state after update:', { 
                                      currentDescription: description,
                                      expectedDescription: newDescription.substring(0, DESCRIPTION_UI_CONFIG.DESCRIPTION_PREVIEW_LENGTH)
                                    });
                                  }, TIMING_CONSTANTS.STATE_UPDATE_LOG_DELAY);
                                }
                                
                                toast.success('AI description generated', {
                                  description: `Generated based on ${generated.domain} context. AI Action Plan will update automatically.`,
                                });
                              } else {
                                logger.warn('AI Generate returned empty description:', generated);
                                toast.error('Failed to generate description', {
                                  description: 'The AI could not generate a description. Please try again or enter description manually.',
                                });
                              }
                              } catch (error) {
                                logger.warn('Description generation failed:', error);
                                toast.error('Failed to generate description', {
                                  description: 'Please try again or enter description manually',
                                });
                              } finally {
                                setIsGeneratingDescription(false);
                              }
                            }, 0); // Defer to next event loop tick
                          }}
                          style={{ 
                            height: COMPONENT_DIMENSIONS.taskDialog.aiButton.height,
                            paddingLeft: COMPONENT_DIMENSIONS.taskDialog.aiButton.paddingX,
                            paddingRight: COMPONENT_DIMENSIONS.taskDialog.aiButton.paddingX,
                            fontSize: COMPONENT_DIMENSIONS.taskDialog.aiButton.textSize,
                            gap: SETTINGS_PANEL_GAP_SMALL 
                          }}
                          title="Generate new description (appends to existing)"
                        >
                          <Icon 
                            name="sparkles" 
                            size={COMPONENT_DIMENSIONS.taskDialog.aiButton.iconSize} 
                            weight="duotone"
                          />
                          <span className="hidden lg:inline">AI Generate</span>
                        </Button>
                      </div>
                    )}
                  </div>
                  <RichTextEditor
                    value={description}
                    onChange={(newDescription) => {
                      setDescription(newDescription);
                    }}
                    placeholder={COMPONENT_DIMENSIONS.taskDialog.descriptionTextarea.placeholder}
                    rows={COMPONENT_DIMENSIONS.taskDialog.descriptionTextarea.rows}
                    className={cn(
                      TASK_DIALOG_COLORS.inputFieldBg,
                      "rounded-lg",
                      COMPONENT_DIMENSIONS.taskDialog.descriptionTextarea.focusClassName
                    )}
                  />
                  </div>

                  {/* AI Analysis - under task name and description; components constrained to block borders */}
                  {(title.trim() || description.trim()) && (
                    <div className={cn(
                      cn(TASK_DIALOG_COLORS.inputFieldBg, "text-foreground rounded-xl"),
                      TASK_DIALOG_MINIMAL_SPACING.cardPadding,
                      "border-2 border-primary/20 shadow-md hover:shadow-lg transition-shadow overflow-hidden min-w-0"
                    )}>
                      {isBreakdownLoading ? (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm min-w-0">
                          <Icon name="sparkles" size={ICON_SIZE_MD} weight="duotone" className="animate-pulse shrink-0" />
                          <span className="truncate">Analyzing task...</span>
                        </div>
                      ) : breakdownError ? (
                        <div className="flex items-center gap-2 text-destructive text-sm min-w-0 overflow-hidden">
                          <span className="truncate">Error analyzing task: {breakdownError.message}</span>
                        </div>
                      ) : breakdown ? (
                        <div className="space-y-2 min-w-0 overflow-hidden">
                          <div className="flex items-center gap-2 min-w-0">
                            <Icon name="sparkles" size={ICON_SIZE_MD} weight="duotone" className="text-primary shrink-0" />
                            <span className="font-semibold text-foreground truncate">AI Analysis</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm min-w-0">
                            <Badge variant="outline" className="text-xs border-primary/30 shrink-0 max-w-full truncate">
                              {breakdown.domain.charAt(0).toUpperCase() + breakdown.domain.slice(1)}
                            </Badge>
                            {breakdown.estimatedMinutes > 0 && (
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 rounded shrink-0">
                                <Icon name="clock" size={SETTINGS_PANEL_ICON_SIZE_SMALL} className="text-primary shrink-0" />
                                <span className="text-xs font-medium text-foreground whitespace-nowrap">
                                  {Math.floor(breakdown.estimatedMinutes / MINUTES_PER_HOUR)}h {breakdown.estimatedMinutes % MINUTES_PER_HOUR}m
                                </span>
                              </div>
                            )}
                            {breakdown.effortScore > 0 && (
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 rounded shrink-0">
                                <span className="text-xs font-medium text-foreground whitespace-nowrap">
                                  Effort: {breakdown.effortScore.toFixed(EFFORT_SCORE_THRESHOLDS.DISPLAY_DECIMAL_PLACES)}/{EFFORT_SCORE_THRESHOLDS.DISPLAY_MAX}
                                </span>
                              </div>
                            )}
                            {breakdown.primaryVerb && breakdown.primaryVerb !== DESCRIPTION_UI_CONFIG.UNKNOWN_VERB && (
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 rounded min-w-0 max-w-full overflow-hidden">
                                <span className="text-xs font-medium text-foreground capitalize truncate">{breakdown.primaryVerb}</span>
                              </div>
                            )}
                          </div>
                          {!description.trim() && (isLoadingDescriptionOptions || descriptionOptions.length > 0) && (
                            <div className="flex flex-col gap-2 min-w-0 overflow-hidden">
                              <span className="text-xs text-muted-foreground truncate">
                                {isLoadingDescriptionOptions ? 'Generating description options...' : 'Choose a description:'}
                              </span>
                              {!isLoadingDescriptionOptions && descriptionOptions.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 min-w-0">
                                  {descriptionOptions.slice(0, DESCRIPTION_UI_CONFIG.MAX_DESCRIPTION_OPTIONS).map((option, idx) => (
                                    <Badge
                                      key={idx}
                                      variant="secondary"
                                      className="cursor-pointer hover:bg-primary/10 text-xs max-w-full min-w-0 truncate"
                                      onClick={async () => {
                                        setDescription(option.description);
                                        setDescriptionOptions([]);
                                        toast.success('Description selected', { description: 'AI Action Plan will update automatically based on your description.' });
                                      }}
                                      title={option.description}
                                    >
                                      <span className="truncate block">
                                        {option.description.length > DESCRIPTION_UI_CONFIG.DESCRIPTION_PREVIEW_LENGTH ? `${option.description.substring(0, DESCRIPTION_UI_CONFIG.DESCRIPTION_PREVIEW_LENGTH)}...` : option.description}
                                      </span>
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {!description.trim() && breakdown && title.trim() && !isLoadingDescriptionOptions && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-muted-foreground hover:text-foreground w-fit"
                              onClick={() => {
                                const { phrases, keywords, verbs, nouns } = getSuggestivePhrases(title, description);
                                const desc = buildCompleteDescriptionFromPhrases(title, phrases, keywords, verbs, nouns);
                                if (desc) {
                                  setDescription(desc);
                                  setDescriptionOptions([]);
                                  toast.success('Description built', { description: 'Accurate sentence or paragraph from suggested phrases. Action Plan will update.' });
                                } else {
                                  toast.info('Not enough terms', { description: 'Add more detail to the task title for better phrases.' });
                                }
                              }}
                            >
                              Build description from phrases
                            </Button>
                          )}
                          {description.trim() && breakdown.descriptionAnalysis && breakdown.descriptionAnalysis.suggestions.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 min-w-0">
                              {breakdown.descriptionAnalysis.suggestions.slice(0, DESCRIPTION_UI_CONFIG.MAX_SUGGESTIONS_DISPLAY).map((suggestion, idx) => (
                                <Badge key={idx} variant="secondary" className="cursor-pointer hover:bg-primary/10 text-xs max-w-full min-w-0 truncate" onClick={() => { const newDescription = description ? `${description}${DESCRIPTION_GENERATION_CONFIG.descriptionSeparator}${suggestion}` : suggestion; setDescription(newDescription); }} title={suggestion}>
                                  <span className="truncate block">{suggestion}</span>
                                </Badge>
                              ))}
                            </div>
                          )}
                          {breakdown.actionPlan && breakdown.actionPlan.suggestedSubtasks.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 min-w-0">
                              {breakdown.actionPlan.suggestedSubtasks.slice(0, 3).map((subtask, idx) => (
                                <Badge key={idx} variant="secondary" className="cursor-pointer hover:bg-primary/10 text-xs max-w-full min-w-0 truncate" onClick={() => { const newSubtask: Subtask = { id: `subtask-${Date.now()}-${idx}`, title: subtask, completed: false, createdAt: new Date().toISOString() }; setSubtasks([...subtasks, newSubtask]); toast.success('Added as subtask', { description: subtask }); }} title={subtask}>
                                  <span className="truncate block">+ {subtask}</span>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Status - horizontal pills; responsive text and wrap */}
                  <div className={TASK_DIALOG_MINIMAL_SPACING.fieldSpaceY}>
                    <Label className="text-xs sm:text-sm font-bold text-foreground">{TASK_DIALOG_UI_TEXT.status}</Label>
                    <div className={cn("flex flex-wrap", TASK_DIALOG_MINIMAL_SPACING.pillGap)}>
                      {(['todo', 'in-progress', 'done', 'on-hold'] as const).map((value) => {
                        const label = value === 'todo' ? TASK_DIALOG_UI_TEXT.statusOptions.todo
                          : value === 'in-progress' ? TASK_DIALOG_UI_TEXT.statusOptions.inProgress
                          : value === 'done' ? TASK_DIALOG_UI_TEXT.statusOptions.done
                          : TASK_DIALOG_UI_TEXT.statusOptions.onHold;
                        const isSelected = status === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => (task ? permissions.canEditTask : permissions.canCreateTask) && setStatus(value)}
                            disabled={task ? !permissions.canEditTask : !permissions.canCreateTask}
                            className={cn(
                              "px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors",
                              isSelected ? TASK_DIALOG_COLORS.pillSelected : TASK_DIALOG_COLORS.pillUnselected
                            )}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Priority Level - horizontal pills; responsive */}
                  <div className={TASK_DIALOG_MINIMAL_SPACING.fieldSpaceY}>
                    <Label className="text-xs sm:text-sm font-bold text-foreground">{TASK_DIALOG_UI_TEXT.priorityLevelLabel}</Label>
                    <div className={cn("flex flex-wrap", TASK_DIALOG_MINIMAL_SPACING.pillGap)}>
                      {(['low', 'medium', 'high', 'urgent'] as const).map((value) => {
                        const label = TASK_DIALOG_UI_TEXT.priorityOptions[value];
                        const isSelected = priority === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => (task ? permissions.canEditTask : permissions.canCreateTask) && setPriority(value)}
                            disabled={task ? !permissions.canEditTask : !permissions.canCreateTask}
                            className={cn(
                              "px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors",
                              isSelected ? TASK_DIALOG_COLORS.pillSelected : TASK_DIALOG_COLORS.pillUnselected
                            )}
                          >
                            {label}
                          </button>
                        );
                        })}
                    </div>
                  </div>

              </TabsContent>

                {/* Scheduling Tab - reference: warm surface; prominent date, Scheduled/Due/Clear, calendar, 12HR/24HR; no inner card */}
                <TabsContent value="scheduling" className={cn("mt-0", TASK_DIALOG_MINIMAL_SPACING.basicContentSpaceY)}>
                  {/* Prominent date line - reference: "Wed, JAN 31, 2026" large bold, uppercase month */}
                  {(scheduledDate || dueDate) && (() => {
                    const activeDate = activeDateField === 'scheduled' ? scheduledDate : dueDate;
                    if (!activeDate) return null;
                    const parts = activeDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).split(' ');
                    if (parts.length >= 2) parts[1] = parts[1].toUpperCase(); // JAN
                    const formatted = parts.join(' ');
                    return (
                      <div className="text-lg sm:text-xl font-bold text-foreground mb-3">
                        {formatted}
                      </div>
                    );
                  })()}
                  {/* Fixed Mini Calendar */}
                  <div className="w-full flex justify-center py-2">
                    <FixedMiniCalendar
                      scheduledDate={scheduledDate}
                      dueDate={dueDate}
                      activeField={activeDateField}
                      onDateSelect={(date, field) => {
                        if (!date) {
                          // Clear action
                          if (field === "scheduled") {
                            setScheduledDate(undefined);
                            setScheduledMonth("");
                            setScheduledDay("");
                            setScheduledYear("");
                            setScheduledTime("");
                            setScheduledHours("");
                            setScheduledMinutes("");
                          } else {
                            setDueDate(undefined);
                            setDueMonth("");
                            setDueDay("");
                            setDueYear("");
                          }
                        } else {
                          // Set date
                          if (field === "scheduled") {
                            setScheduledDate(date);
                            setScheduledMonth((date.getMonth() + 1).toString());
                            setScheduledDay(date.getDate().toString());
                            setScheduledYear(date.getFullYear().toString());
                          } else {
                            setDueDate(date);
                            setDueMonth((date.getMonth() + 1).toString());
                            setDueDay(date.getDate().toString());
                            setDueYear(date.getFullYear().toString());
                          }
                        }
                      }}
                      onFieldChange={setActiveDateField}
                    />
                  </div>

                  {/* Schedule: Date, 12HR/24HR, time, Due date with clear */}
                  <div className="pt-4">
                    <div className={cn("grid grid-cols-1 sm:grid-cols-2", TASK_DIALOG_MINIMAL_SPACING.scheduleGridGap)}>
                      {/* Scheduled: date line + time (12HR/24HR, hour, min, AM/PM, clear) */}
                      <div className={TASK_DIALOG_MINIMAL_SPACING.scheduleColumnSpaceY}>
                        <Label className="text-sm font-semibold flex items-center gap-2 text-foreground">
                          <Icon name="calendar" size={ICON_SIZE_XS} className="text-primary" weight="duotone" />
                          {TASK_DIALOG_UI_TEXT.scheduledSectionTitle}
                        </Label>
                        {scheduledDate && (
                          <div className="text-xs text-muted-foreground bg-primary/10 rounded px-2 py-1">
                            {scheduledDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            {scheduledTime && ` at ${scheduledTime}`}
                          </div>
                        )}

                        {scheduledDate && (
                          <div className="space-y-3">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1">
                              <Icon name="clock" size={ICON_SIZE_XS} />
                              {TASK_DIALOG_UI_TEXT.timeLabel}
                            </Label>
                            {/* Time section full width, inline: 12HR/24HR, Hour, Min, AM/PM, Clear */}
                            <div className={cn("flex flex-nowrap items-center w-full min-w-0 overflow-x-auto", TASK_DIALOG_MINIMAL_SPACING.scheduleTimeRowGap)}>
                            <ToggleGroup
                              type="single"
                              value={timeFormat}
                              onValueChange={(value) => {
                                if (value !== "12hr" && value !== "24hr") return;
                                setTimeFormat(value);
                                if (scheduledHours) {
                                  const parsedHours = parseInt(scheduledHours, 10);
                                  if (Number.isNaN(parsedHours)) return;
                                  if (value === "12hr") {
                                    let newHours = parsedHours;
                                    let newPeriod: "AM" | "PM" = "AM";
                                    if (parsedHours === 0) {
                                      newHours = 12;
                                      newPeriod = "AM";
                                    } else if (parsedHours === 12) {
                                      newHours = 12;
                                      newPeriod = "PM";
                                    } else if (parsedHours > 12) {
                                      newHours = parsedHours - 12;
                                      newPeriod = "PM";
                                    } else {
                                      newPeriod = "AM";
                                    }
                                    const newHoursStr = newHours.toString();
                                    setScheduledHours(newHoursStr);
                                    setTimePeriod(newPeriod);
                                    if (scheduledMinutes) {
                                      updateScheduledTime(newHoursStr, scheduledMinutes, "12hr", newPeriod);
                                    }
                                  } else {
                                    let convertedHours = parsedHours;
                                    if (timePeriod === "PM" && parsedHours !== 12) {
                                      convertedHours = parsedHours + 12;
                                    } else if (timePeriod === "AM" && parsedHours === 12) {
                                      convertedHours = 0;
                                    }
                                    const convertedStr = convertedHours.toString();
                                    setScheduledHours(convertedStr);
                                    if (scheduledMinutes) {
                                      updateScheduledTime(convertedStr, scheduledMinutes, "24hr", timePeriod);
                                    }
                                  }
                                }
                              }}
                              variant="outline"
                              size="sm"
                              className="flex-shrink-0 h-9 sm:h-10 [&>button]:h-9 [&>button]:sm:h-10 [&>button]:px-3 [&>button]:sm:px-4 [&>button]:text-xs [&>button]:sm:text-sm"
                            >
                              <ToggleGroupItem value="12hr" aria-label="12-hour format">
                                12HR
                              </ToggleGroupItem>
                              <ToggleGroupItem value="24hr" aria-label="24-hour format">
                                24HR
                              </ToggleGroupItem>
                            </ToggleGroup>

                            {/* Hour Select */}
                            <div className={cn("flex-1 min-w-0 relative z-10", COMPONENT_DIMENSIONS.taskDialog.minWidth.combined)}>
                              <Select
                                value={scheduledHours || undefined}
                                onValueChange={(value) => {
                                  setScheduledHours(value);
                                  if (value && scheduledMinutes) {
                                    updateScheduledTime(value, scheduledMinutes.padStart(2, "0"), timeFormat, timePeriod || "AM");
                                  } else if (value) {
                                    updateScheduledTime(value, "00", timeFormat, timePeriod || "AM");
                                  } else {
                                    setScheduledTime("");
                                    setScheduledMinutes("");
                                  }
                                }}
                              >
                                <SelectTrigger className={cn(TASK_DIALOG_COLORS.inputFieldBg, "h-9 sm:h-10 text-sm cursor-pointer rounded-lg")}>
                                  <SelectValue placeholder="Hour" />
                                </SelectTrigger>
                                <SelectContent 
                                  className="max-h-60"
                                  style={{ zIndex: Z_INDEX.SELECT_CONTENT }}
                                >
                                  {timeFormat === "12hr" 
                                    ? Array.from({ length: 12 }, (_, i) => {
                                        const hour = i + 1;
                                        return (
                                          <SelectItem key={hour} value={hour.toString()} className="cursor-pointer">
                                            {hour.toString().padStart(2, "0")}
                                          </SelectItem>
                                        );
                                      })
                                    : Array.from({ length: 24 }, (_, i) => (
                                        <SelectItem key={i} value={i.toString()} className="cursor-pointer">
                                          {i.toString().padStart(2, "0")}
                                        </SelectItem>
                                      ))
                                  }
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Minute Select */}
                            <div className={cn("flex-1 min-w-0 relative z-20", COMPONENT_DIMENSIONS.taskDialog.minWidth.combined)}>
                              <Select
                                value={
                                  scheduledMinutes && scheduledMinutes.length > 0 
                                    ? scheduledMinutes.padStart(2, "0") 
                                    : undefined
                                }
                                onValueChange={(value) => {
                                  // Value from SelectItem is already padded (00-59)
                                  const paddedValue = value.padStart(2, "0");
                                  setScheduledMinutes(paddedValue);
                                  if (paddedValue && scheduledHours) {
                                    updateScheduledTime(scheduledHours, paddedValue, timeFormat, timePeriod);
                                  } else if (paddedValue) {
                                    updateScheduledTime("00", paddedValue, timeFormat, timePeriod);
                                  } else {
                                    if (scheduledHours) {
                                      updateScheduledTime(scheduledHours, "00", timeFormat, timePeriod);
                                    } else {
                                      setScheduledTime("");
                                    }
                                  }
                                }}
                                disabled={false}
                              >
                                <SelectTrigger 
                                  className={cn(TASK_DIALOG_COLORS.inputFieldBg, "h-9 sm:h-10 text-sm cursor-pointer pointer-events-auto rounded-lg")}
                                  aria-label="Select minutes"
                                >
                                  <SelectValue placeholder="Min" />
                                </SelectTrigger>
                                <SelectContent 
                                  className="max-h-60"
                                  style={{ zIndex: Z_INDEX.SELECT_CONTENT }}
                                >
                                  {Array.from({ length: 60 }, (_, i) => {
                                    const minuteValue = i.toString().padStart(2, "0");
                                    return (
                                      <SelectItem 
                                        key={i} 
                                        value={minuteValue}
                                        className="cursor-pointer"
                                      >
                                        {minuteValue}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* AM/PM Select (only for 12HR format) */}
                            {timeFormat === "12hr" && (
                              <div className={cn("flex-1 relative z-10 min-w-0", COMPONENT_DIMENSIONS.taskDialog.minWidth.combined)}>
                                <Select
                                  value={timePeriod || "AM"}
                                  onValueChange={(value) => {
                                    const newPeriod = value as "AM" | "PM";
                                    setTimePeriod(newPeriod);
                                    if (scheduledHours && scheduledMinutes) {
                                      updateScheduledTime(scheduledHours, scheduledMinutes, timeFormat, newPeriod);
                                    } else if (scheduledHours) {
                                      updateScheduledTime(scheduledHours, "00", timeFormat, newPeriod);
                                    }
                                  }}
                                >
                                  <SelectTrigger className={cn(TASK_DIALOG_COLORS.inputFieldBg, "h-9 sm:h-10 text-sm cursor-pointer rounded-lg")}>
                                    <SelectValue placeholder="AM/PM" />
                                  </SelectTrigger>
                                  <SelectContent style={{ zIndex: Z_INDEX.SELECT_CONTENT }}>
                                    <SelectItem value="AM" className="cursor-pointer">AM</SelectItem>
                                    <SelectItem value="PM" className="cursor-pointer">PM</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            {/* Clear time: grouped with time controls on the right */}
                            {(scheduledHours || scheduledMinutes) && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setScheduledHours("");
                                  setScheduledMinutes("");
                                  setScheduledTime("");
                                }}
                                className="h-9 sm:h-10 px-3 text-xs sm:text-sm text-muted-foreground hover:text-foreground shrink-0"
                              >
                                {TASK_DIALOG_UI_TEXT.clear}
                              </Button>
                            )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Due Date: label, clear when set, input shows selected date */}
                      <div className={TASK_DIALOG_MINIMAL_SPACING.scheduleColumnSpaceY}>
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <Label className="text-sm font-semibold flex items-center gap-2 shrink-0">
                            <Icon name="alert-circle" size={ICON_SIZE_XS} className="text-primary" />
                            {TASK_DIALOG_UI_TEXT.dueDate}
                          </Label>
                          {dueDate && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDueDate(undefined);
                                setDueMonth("");
                                setDueDay("");
                                setDueYear("");
                              }}
                              className="h-6 text-xs text-muted-foreground hover:text-foreground shrink-0"
                              title={TASK_DIALOG_UI_TEXT.clear}
                            >
                              {TASK_DIALOG_UI_TEXT.clear}
                            </Button>
                          )}
                        </div>
                        {dueDate && (
                          <div className="text-xs text-muted-foreground bg-primary/10 rounded px-2 py-1">
                            {dueDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        )}
                        <Input
                          type="text"
                          placeholder={TASK_DIALOG_UI_TEXT.dueDatePlaceholder}
                        value={dueDate ? 
                          `${(dueDate.getMonth() + 1).toString().padStart(2, '0')}/${dueDate.getDate().toString().padStart(2, '0')}/${dueDate.getFullYear()}` 
                          : ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Allow typing date in MM/DD/YYYY format
                          if (value.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
                            const [month, day, year] = value.split('/').map(Number);
                            if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900) {
                              const date = new Date(year, month - 1, day);
                              if (!isNaN(date.getTime())) {
                                setDueDate(date);
                                setDueMonth(month.toString());
                                setDueDay(day.toString());
                                setDueYear(year.toString());
                                setActiveDateField("due");
                              }
                            }
                          } else if (value === '') {
                            setDueDate(undefined);
                            setDueMonth("");
                            setDueDay("");
                            setDueYear("");
                          }
                        }}
                        onBlur={(e) => {
                          // Validate on blur
                          const value = e.target.value;
                          if (value && !value.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                            // If invalid format, try to parse or clear
                            const date = new Date(value);
                            if (!isNaN(date.getTime())) {
                              setDueDate(date);
                              setDueMonth((date.getMonth() + 1).toString());
                              setDueDay(date.getDate().toString());
                              setDueYear(date.getFullYear().toString());
                              setActiveDateField("due");
                              // Update input to correct format
                              e.target.value = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
                            }
                          }
                        }}
                        className={cn(TASK_DIALOG_COLORS.inputFieldBg, "text-foreground rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm h-10")}
                      />
                      </div>
                    </div>
                  </div>

                  {/* Estimated Time with Slider */}
                  <div className="pt-4 space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Icon name="clock" size={ICON_SIZE_XS} className="text-primary" />
                        Estimated Time
                      </Label>
                      <div className="text-sm font-medium text-primary">
                        {estimatedHours}h {estimatedMinutes}m
                      </div>
                    </div>
                    
                    {/* Hours Slider */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Hours</span>
                        <span>{estimatedHours}</span>
                      </div>
                      <Slider
                        value={[parseInt(estimatedHours) || 0]}
                        onValueChange={(values) => setEstimatedHours(values[0].toString())}
                        min={0}
                        max={8}
                        step={1}
                        className="w-full"
                      />
                    </div>

                    {/* Minutes Slider */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Minutes</span>
                        <span>{estimatedMinutes}</span>
                      </div>
                      <Slider
                        value={[parseInt(estimatedMinutes) || 0]}
                        onValueChange={(values) => {
                          const value = values[0];
                          if (value >= 0 && value <= 59) {
                            setEstimatedMinutes(value.toString());
                          }
                        }}
                        min={0}
                        max={59}
                        step={5}
                        className="w-full"
                      />
                    </div>
                  </div>

                  {/* Timezone Selector */}
                  {scheduledDate && (
                    <div className="pt-4 space-y-2 sm:space-y-3">
                      <Label className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
                        <Icon name="globe" size={ICON_SIZE_XS} />
                        Timezone
                      </Label>
                      <Select
                        value={timezone}
                        onValueChange={setTimezone}
                      >
                        <SelectTrigger className={cn(TASK_DIALOG_COLORS.inputFieldBg, "h-10 text-foreground rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent 
                          className="max-h-60"
                          style={{ zIndex: Z_INDEX.SELECT_CONTENT }}
                        >
                          <SelectItem value="local">Local Time</SelectItem>
                          <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                          <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                          <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                          <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                          <SelectItem value="Europe/London">London (GMT)</SelectItem>
                          <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                          <SelectItem value="Europe/Berlin">Berlin (CET)</SelectItem>
                          <SelectItem value="Europe/Moscow">Moscow (MSK)</SelectItem>
                          <SelectItem value="Asia/Dubai">Dubai (GST)</SelectItem>
                          <SelectItem value="Asia/Kolkata">India (IST)</SelectItem>
                          <SelectItem value="Asia/Singapore">Singapore (SGT)</SelectItem>
                          <SelectItem value="Asia/Shanghai">China (CST)</SelectItem>
                          <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                          <SelectItem value="Australia/Sydney">Sydney (AEDT)</SelectItem>
                          <SelectItem value="Pacific/Auckland">Auckland (NZDT)</SelectItem>
                        </SelectContent>
                      </Select>
                      {timezone !== "local" &&
                        scheduledTime &&
                        getTimezoneDisplay() && (
                          <p className="text-xs text-muted-foreground">
                            📍 Selected timezone: {getTimezoneDisplay()}
                          </p>
                        )}
                      </div>
                    )}
              </TabsContent>

              {/* Organization & Advanced Tab - Folder, Tags, Subtasks, etc. */}
                <TabsContent value="organization" className={cn("mt-0", TASK_DIALOG_MINIMAL_SPACING.cardSpaceY)}>
                  {/* Folder Selector */}
                  {folders.length > 0 && (
                    <div className={cn(
                      cn(TASK_DIALOG_COLORS.inputFieldBg, "text-foreground rounded-xl"),
                      cn(TASK_DIALOG_MINIMAL_SPACING.cardPadding, "space-y-2"),
                      "border-2 border-primary/20 shadow-md hover:shadow-lg transition-shadow",
                      "mb-3 sm:mb-4"
                    )}>
                      <Label htmlFor="folder" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                        <Icon name="folder" size={ICON_SIZE_MD} className="text-primary" />
                        Folder
                      </Label>
                      <Select
                        value={folderId || "none"}
                        onValueChange={(value) => {
                          const newFolderId = value === "none" ? null : value;
                          setFolderId(newFolderId);
                          if (newFolderId && folders && Array.isArray(folders)) {
                            try {
                              const selectedFolder = folders.find(f => f && f.id === newFolderId);
                              if (selectedFolder && selectedFolder.name && !tags.includes(selectedFolder.name)) {
                                setTags([...tags, selectedFolder.name]);
                              }
                            } catch (error) {
                              logger.error('Error finding selected folder:', error);
                            }
                          } else if (folderId && folders && Array.isArray(folders)) {
                            try {
                              const previousFolder = folders.find(f => f && f.id === folderId);
                              if (previousFolder && previousFolder.name && tags.includes(previousFolder.name)) {
                                setTags(tags.filter(tag => tag !== previousFolder.name));
                              }
                            } catch (error) {
                              logger.error('Error finding previous folder:', error);
                            }
                          }
                        }}
                      >
                        <SelectTrigger className={cn(TASK_DIALOG_COLORS.inputFieldBg, "h-10 text-foreground rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20")}>
                          <SelectValue placeholder="No folder" />
                        </SelectTrigger>
                        <SelectContent style={{ zIndex: Z_INDEX.SELECT_CONTENT }}>
                          <SelectItem value="none">No folder</SelectItem>
                          {folders && Array.isArray(folders) ? folders.filter(folder => folder && folder.id && folder.name).map((folder) => (
                            <SelectItem key={folder.id} value={folder.id}>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: folder.color || UI_FOLDER_COLORS.fallback }} />
                                <span>{folder.name}</span>
                              </div>
                            </SelectItem>
                          )) : null}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className={cn(
                    "rounded-xl border border-primary/15 shadow-sm",
                    TASK_DIALOG_MINIMAL_SPACING.cardPadding,
                    TASK_DIALOG_MINIMAL_SPACING.cardSpaceY,
                    TASK_DIALOG_COLORS.minimalCardBg,
                    "text-foreground dark:text-foreground"
                  )}>
                    <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Icon name="tag" size={ICON_SIZE_SM} className="text-primary" />
                      Assign Tags
                    </Label>
                  {/* Tag Input with Select from Available Tags */}
                  <div className="flex gap-2">
                    <Select
                      value={selectedTagValue || undefined}
                      onValueChange={(value) => {
                        if (value && value !== "new") {
                          if (!tags.includes(value)) {
                            setTags([...tags, value]);
                          }
                          setSelectedTagValue("");
                        } else if (value === "new") {
                          // Focus on input for new tag
                          setSelectedTagValue("");
                        }
                      }}
                    >
                      <SelectTrigger className={cn(TASK_DIALOG_COLORS.inputFieldBg, "flex-1 h-10 text-foreground rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20")}>
                        <SelectValue placeholder="Select or add tag..." />
                      </SelectTrigger>
                      <SelectContent style={{ zIndex: Z_INDEX.SELECT_CONTENT }}>
                        {availableTags && availableTags.length > 0 ? (
                          availableTags
                            .filter((tag) => !tags.includes(tag))
                            .map((tag) => (
                              <SelectItem key={tag} value={tag}>
                              <div className="flex items-center gap-2">
                                  <Icon name="tag" size={ICON_SIZE_XS} className="text-primary" />
                                  <span>{tag}</span>
                                </div>
                              </SelectItem>
                            ))
                        ) : null}
                        <SelectItem value="new">
                          <div className="flex items-center gap-2">
                            <Icon name="plus" size={ICON_SIZE_XS} className="text-primary" />
                            <span>Create new tag</span>
                              </div>
                            </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* New Tag Input */}
                  <div className="flex gap-2">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      placeholder="Enter new tag name..."
                      className={cn(TASK_DIALOG_COLORS.inputFieldBg, "rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 h-10")}
                    />
                    <Button
                      type="button"
                      onClick={addTag}
                      variant="outline"
                      size="icon"
                      className="border hover:border-primary hover:bg-primary/10 h-10 w-10"
                    >
                      <Icon name="plus" size={ICON_SIZE_MD} />
                    </Button>
                  </div>

                  {/* Display Selected Tags */}
                  {tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                      {tags.map((tag) => (
                            <Badge
                          key={tag}
                              variant="secondary"
                              className="cursor-pointer hover:bg-destructive/10 border border-primary/30 px-3 py-1"
                          onClick={() => removeTag(tag)}
                            >
                              <div className="flex items-center gap-1.5">
                            <Icon name="tag" size={ICON_SIZE_XS} className="text-primary" />
                            <span>{tag}</span>
                                <Icon name="x" size={ICON_SIZE_XS} className="ml-1" />
                              </div>
                            </Badge>
                      ))}
                      </div>
                    )}
                  </div>

                {/* Step 4: Create Subtask */}
                <div className={cn(
                  cn(TASK_DIALOG_COLORS.inputFieldBg, "text-foreground rounded-xl"),
                  cn(TASK_DIALOG_MINIMAL_SPACING.cardPadding, "space-y-3"),
                  "border-2 border-primary/20 shadow-md hover:shadow-lg transition-shadow"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">4</span>
                    </div>
                    <Label className="text-base font-semibold text-foreground flex items-center gap-2">
                      <Icon name="list-checks" size={ICON_SIZE_MD} className="text-primary" />
                      Create Subtask
                    </Label>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={subtaskInput}
                      onChange={(e) => setSubtaskInput(e.target.value)}
                      onKeyPress={(e) =>
                        e.key === "Enter" &&
                        (e.preventDefault(), addSubtask())
                      }
                      placeholder="Enter subtask name..."
                      className={cn(TASK_DIALOG_COLORS.inputFieldBg, "rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 h-10")}
                    />
                    <Button
                      type="button"
                      onClick={addSubtask}
                      variant="outline"
                      size="icon"
                      className="border hover:border-primary hover:bg-primary/10 h-10 w-10"
                    >
                      <Icon name="plus" size={ICON_SIZE_MD} />
                    </Button>
                  </div>
                  {subtasks.length > 0 && (
                    <div className="space-y-2 mt-3">
                      {subtasks.map((subtask) => {
                        return (
                          <div
                            key={subtask.id}
                            className="flex items-start gap-2 p-2 rounded-lg bg-primary/5 dark:bg-card border-2 border-primary/20"
                          >
                            <Checkbox
                              checked={subtask.completed}
                              onCheckedChange={() => toggleSubtask(subtask.id)}
                              className="mt-1 shrink-0"
                              style={{
                                width: subtaskCheckboxSize,
                                height: subtaskCheckboxSize,
                                minWidth: subtaskCheckboxSize,
                                minHeight: subtaskCheckboxSize,
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <span
                                className={cn(
                                  "text-sm block",
                                  subtask.completed && "line-through text-muted-foreground",
                                )}
                              >
                                {subtask.title}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSubtask(subtask.id)}
                              className="h-7 w-7 p-0 flex-shrink-0"
                            >
                              <Icon name="x" size={ICON_SIZE_MD} />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Separator className="bg-primary/20" />

                {/* Recurrence with Toggle - Moved from Advanced */}
                <div className={cn(
                  cn(TASK_DIALOG_COLORS.inputFieldBg, "text-foreground rounded-xl"),
                  "p-4 sm:p-5 space-y-4 sm:space-y-5",
                  "border-2 border-primary/20 shadow-md hover:shadow-lg transition-shadow"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon name="repeat" size={ICON_SIZE_MD} className="text-primary" />
                      <Label className="text-sm font-semibold">Repeat Task</Label>
                      {!hasFeature('recurringTasks') && (
                        <Badge variant="secondary" className="ml-2 bg-gradient-to-r from-primary/20 to-primary/30 text-primary-foreground">
                          PRO
                        </Badge>
                      )}
                    </div>
                    <Switch
                      checked={recurrenceType !== "none"}
                      onCheckedChange={(checked) => {
                        if (!hasFeature('recurringTasks')) {
                          window.dispatchEvent(new CustomEvent('showUpgradePrompt', { 
                            detail: { feature: 'recurringTasks' } 
                          }));
                          if (onShowUpgradePrompt) {
                            onShowUpgradePrompt('recurringTasks');
                          }
                          return;
                        }
                        if (!checked) {
                          setRecurrenceType("none");
                          setRecurrenceDaysOfWeek([]);
                          setRecurrenceDayOfMonth(undefined);
                          setRecurrenceEndDate(undefined);
                        } else {
                          setRecurrenceType("daily");
                        }
                      }}
                      disabled={!hasFeature('recurringTasks')}
                    />
                  </div>

                  {recurrenceType !== "none" && (
                    <div className="space-y-4 sm:space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs sm:text-sm font-medium">Frequency</Label>
                          <Select
                            value={recurrenceType}
                            onValueChange={(value) => {
                              try {
                                const newType = value as RecurrenceType;
                                setRecurrenceType(newType);
                                
                                if (newType === "none") {
                                  setRecurrenceDaysOfWeek([]);
                                  setRecurrenceDayOfMonth(undefined);
                                  setRecurrenceEndDate(undefined);
                                } else if (newType === "daily") {
                                  setRecurrenceDaysOfWeek([]);
                                  setRecurrenceDayOfMonth(undefined);
                                } else if (newType === "weekly") {
                                  setRecurrenceDayOfMonth(undefined);
                                } else if (newType === "monthly") {
                                  setRecurrenceDaysOfWeek([]);
                                  setRecurrenceDayOfMonth((prev) => prev || 1);
                                }
                              } catch (error) {
                                logger.error('Error setting recurrence type:', error);
                                toast.error('Failed to set recurrence type', {
                                  description: error instanceof Error ? error.message : 'Please try again',
                                  duration: TOAST_DURATION_SHORT_MS,
                                });
                              }
                            }}
                          >
                            <SelectTrigger className={cn(TASK_DIALOG_COLORS.inputFieldBg, "h-10 text-foreground rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20")}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent style={{ zIndex: Z_INDEX.SELECT_CONTENT }}>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Repeat Every</span>
                            <span className="font-medium text-primary">{recurrenceInterval} {recurrenceType === "daily" ? "day(s)" : recurrenceType === "weekly" ? "week(s)" : "month(s)"}</span>
                          </div>
                          <Slider
                            value={[recurrenceInterval]}
                            onValueChange={(values) => setRecurrenceInterval(values[0])}
                            min={1}
                            max={30}
                            step={1}
                            className="w-full"
                          />
                        </div>
                      </div>

                      {/* Weekly: Days of Week */}
                      {recurrenceType === "weekly" && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Repeat on</Label>
                          <div className="flex flex-wrap gap-2">
                            {TASK_DIALOG_CALENDAR.WEEK_DAYS_FULL.map((day, index) => (
                              <Badge
                                key={index}
                                variant={
                                  recurrenceDaysOfWeek.includes(index)
                                    ? "default"
                                    : "outline"
                                }
                                className={cn(
                                  "cursor-pointer border-primary/20",
                                  recurrenceDaysOfWeek.includes(index)
                                    ? "bg-primary text-primary-foreground"
                                    : "hover:bg-primary/10"
                                )}
                                onClick={() => {
                                  if (recurrenceDaysOfWeek.includes(index)) {
                                    setRecurrenceDaysOfWeek(
                                      recurrenceDaysOfWeek.filter((d) => d !== index),
                                    );
                                  } else {
                                    setRecurrenceDaysOfWeek(
                                      [...recurrenceDaysOfWeek, index].sort(),
                                    );
                                  }
                                }}
                              >
                                {day}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Monthly: Day of Month */}
                      {recurrenceType === "monthly" && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Day of month</Label>
                          <Select
                            value={recurrenceDayOfMonth?.toString() || "1"}
                            onValueChange={(value) =>
                              setRecurrenceDayOfMonth(parseInt(value))
                            }
                          >
                            <SelectTrigger className={cn(TASK_DIALOG_COLORS.inputFieldBg, "h-10 text-foreground rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20")}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent 
                              className="max-h-60"
                              style={{ zIndex: Z_INDEX.SELECT_CONTENT }}
                            >
                              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                                <SelectItem key={day} value={day.toString()}>
                                  {day}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* End Date for Recurrence */}
                      {(recurrenceType === "daily" || recurrenceType === "weekly" || recurrenceType === "monthly") && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Ends</Label>
                          <div className={cn(
                            cn("w-full flex justify-center", TASK_DIALOG_COLORS.inputFieldBg, "text-foreground rounded-xl"),
                            cn(TASK_DIALOG_MINIMAL_SPACING.cardPadding, "py-2"),
                            "border-2 border-primary/20 shadow-md hover:shadow-lg transition-shadow"
                          )}>
                            <SingleDateMiniCalendar
                              selectedDate={recurrenceEndDate}
                              onDateSelect={(date) => {
                                setRecurrenceEndDate(date);
                              }}
                              label="End Date"
                            />
                          </div>
                          {!recurrenceEndDate && (
                            <p className="text-xs text-muted-foreground text-center">
                              No end date set - task will repeat indefinitely
                            </p>
                          )}
                        </div>
                      )}

                      {/* Recurrence Summary */}
                      {(recurrenceType === "daily" || recurrenceType === "weekly" || recurrenceType === "monthly") && (
                        <div className="p-3 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20">
                          <p className="text-xs text-muted-foreground">
                            {recurrenceType === "daily" &&
                              `Repeats every ${recurrenceInterval} day${recurrenceInterval > 1 ? "s" : ""}`}
                            {recurrenceType === "weekly" && (
                              <>
                                Repeats every {recurrenceInterval} week{recurrenceInterval > 1 ? "s" : ""}
                                {recurrenceDaysOfWeek.length > 0 &&
                                  ` on ${recurrenceDaysOfWeek.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")}`}
                              </>
                            )}
                            {recurrenceType === "monthly" &&
                              `Repeats every ${recurrenceInterval} month${recurrenceInterval > 1 ? "s" : ""} on day ${recurrenceDayOfMonth || 1}`}
                            {recurrenceEndDate &&
                              ` until ${formatDate(recurrenceEndDate.toISOString())}`}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Separator className="bg-primary/20" />

                {/* Task Dependencies - Pro Yearly Feature */}
                <div className={cn(
                  cn(TASK_DIALOG_COLORS.inputFieldBg, "text-foreground rounded-xl"),
                  cn(TASK_DIALOG_MINIMAL_SPACING.cardPadding, "space-y-2"),
                  "border-2 border-primary/20 shadow-md hover:shadow-lg transition-shadow"
                )}>
                  <div className="flex items-center gap-2">
                    <Icon name="link-2" size={ICON_SIZE_MD} className="text-primary" />
                    <Label className="text-sm font-semibold">Dependencies</Label>
                    {!hasFeature('taskDependencies') && (
                      <Badge variant="secondary" className="ml-2 bg-gradient-to-r from-primary/20 to-primary/30 text-primary-foreground">
                        PRO YEARLY
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {hasFeature('taskDependencies') 
                      ? 'Select tasks that must be completed before this task can be started'
                      : 'Upgrade to Pro Yearly to use task dependencies'}
                  </p>

                  {hasFeature('taskDependencies') ? (
                    <>
                      <Select
                        value={selectedDependencyValue || undefined}
                        onValueChange={(value) => {
                          if (value && !dependencies.includes(value)) {
                            addDependency(value);
                            setSelectedDependencyValue("");
                          }
                        }}
                      >
                        <SelectTrigger className={cn(TASK_DIALOG_COLORS.inputFieldBg, "h-10 text-foreground border-2 border-primary/30 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20")}>
                          <SelectValue placeholder="Add dependency..." />
                        </SelectTrigger>
                        <SelectContent style={{ zIndex: Z_INDEX.SELECT_CONTENT }}>
                          {availableTasksForDependencies
                            .filter((t) => !dependencies.includes(t.id))
                            .map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "text-xs px-2 py-0.5 rounded",
                                    t.status === 'in-progress' && "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
                                    t.status === 'todo' && "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
                                    t.status === 'on-hold' && "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                                  )}>
                                    {t.status}
                                  </span>
                                  <span>{t.title}</span>
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>

                      {dependencies.length > 0 && (
                        <div className="space-y-2 mt-3">
                          {dependencies.map((depId) => {
                            const depTask = tasks.find((t) => t?.id === depId);
                            if (!depTask) return null;
                            const incompleteDeps = getIncompleteDependencies(depTask, tasks);
                            const isBlocked = incompleteDeps.length > 0;
                            const isComplete = depTask.status === "done";

                            return (
                              <div
                                key={depId}
                                className={cn(
                                  "flex items-start gap-2 p-2 rounded-lg border-2",
                                  isComplete
                                    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                                    : isBlocked
                                    ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                                    : "bg-primary/5 dark:bg-card border-primary/20"
                                )}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Icon name="link-2" size={ICON_SIZE_XS} className={cn(
                                      "flex-shrink-0",
                                      isComplete ? "text-green-600 dark:text-green-400" : "text-primary"
                                    )} />
                                    <span
                                      className={cn(
                                        "text-sm font-medium",
                                        isComplete && "line-through text-muted-foreground"
                                      )}
                                    >
                                      {depTask.title}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge
                                      variant="secondary"
                                      className={cn(
                                        "text-xs",
                                        depTask.status === 'done' && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
                                        depTask.status === 'in-progress' && "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
                                        depTask.status === 'todo' && "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
                                        depTask.status === 'on-hold' && "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                                      )}
                                    >
                                      {depTask.status}
                                    </Badge>
                                    {isBlocked && (
                                      <span className="text-xs text-yellow-600 dark:text-yellow-400">
                                        Blocked by {incompleteDeps.length} dependency{incompleteDeps.length > 1 ? 'ies' : 'y'}
                                      </span>
                                    )}
                                    {isComplete && (
                                      <span className="text-xs text-green-600 dark:text-green-400">
                                        Complete
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeDependency(depId)}
                                  className="h-7 w-7 p-0 flex-shrink-0"
                                >
                                  <Icon name="x" size={ICON_SIZE_MD} />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('showUpgradePrompt', { 
                          detail: { feature: 'taskDependencies' } 
                        }));
                        if (onShowUpgradePrompt) {
                          onShowUpgradePrompt('taskDependencies');
                        }
                      }}
                      className="w-full border-2 border-primary/30 hover:border-primary hover:bg-primary/10"
                    >
                      Upgrade to Pro Yearly
                    </Button>
                  )}
                </div>

                <Separator className="bg-primary/20" />

                {/* Team Assignment - Moved from Advanced */}
                {teamMembers.length > 0 && (
                  <div className={cn(
                    cn(TASK_DIALOG_COLORS.inputFieldBg, "text-foreground rounded-xl"),
                    cn(TASK_DIALOG_MINIMAL_SPACING.cardPadding, "space-y-2"),
                    "border-2 border-primary/20 shadow-md hover:shadow-lg transition-shadow"
                  )}>
                    <div className="flex items-center gap-2">
                      <Icon name="users" size={ICON_SIZE_MD} className="text-primary" />
                      <Label className="text-sm font-semibold">Assign To</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Select team members to assign this task
                    </p>

                    <Select
                      value={selectedAssigneeValue || undefined}
                      onValueChange={(value) => {
                        if (value && !assignedTo.includes(value)) {
                          setAssignedTo([...assignedTo, value]);
                          setSelectedAssigneeValue("");
                        }
                      }}
                    >
                      <SelectTrigger className={cn(TASK_DIALOG_COLORS.inputFieldBg, "h-10 text-foreground rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20")}>
                        <SelectValue placeholder="Add assignee..." />
                      </SelectTrigger>
                      <SelectContent style={{ zIndex: Z_INDEX.SELECT_CONTENT }}>
                        {teamMembers
                          .filter((member) => !assignedTo.includes(member.id))
                          .map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-xs font-medium">
                                  {member.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase()}
                                </div>
                                <span>{member.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>

                    {assignedTo.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {assignedTo.map((memberId) => {
                          const member = getTeamMember(memberId);
                          if (!member) return null;

                          return (
                            <Badge
                              key={memberId}
                              variant="secondary"
                              className="cursor-pointer hover:bg-destructive/10 transition-colors border-primary/20"
                              onClick={() =>
                                setAssignedTo(assignedTo.filter((id) => id !== memberId))
                              }
                            >
                              <div className="flex items-center" style={{ gap: COMPONENT_DIMENSIONS.taskDialog.assignee.gap }}>
                                {member.avatar ? (
                                  <div 
                                    className="rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0"
                                    style={{ 
                                      width: COMPONENT_DIMENSIONS.taskDialog.assignee.avatarSize,
                                      height: COMPONENT_DIMENSIONS.taskDialog.assignee.avatarSize,
                                    }}
                                  >
                                    <img
                                      src={member.avatar}
                                      alt={member.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        // Fallback to initials if image fails to load
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        const parent = target.parentElement;
                                        if (parent) {
                                          const fallback = document.createElement('div');
                                          fallback.className = `${TASK_DIALOG_COLORS.assigneeFallbackGradient} flex items-center justify-center font-medium w-full h-full`;
                                          fallback.style.fontSize = TASK_DIALOG_FONT_SIZES.assigneeFallback;
                                          fallback.textContent = getInitials(member.name);
                                          parent.appendChild(fallback);
                                        }
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <div 
                                    className={`rounded-full ${TASK_DIALOG_COLORS.assigneeFallbackGradient} flex items-center justify-center font-medium flex-shrink-0`}
                                    style={{
                                      width: COMPONENT_DIMENSIONS.taskDialog.assignee.avatarSize,
                                      height: COMPONENT_DIMENSIONS.taskDialog.assignee.avatarSize,
                                      fontSize: TASK_DIALOG_FONT_SIZES.assigneeFallback,
                                    }}
                                  >
                                    {getInitials(member.name)}
                                  </div>
                                )}
                                <span className="font-medium" style={{ fontSize: COMPONENT_DIMENSIONS.taskDialog.assignee.textSize }}>{member.name}</span>
                                <Icon name="x" size={ICON_SIZE_XS} className="ml-1 flex-shrink-0" />
                              </div>
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <Separator className="bg-primary/20" />

                {/* Pomodoro Timer - Moved from Advanced */}
                {task && hasFeature("pomodoroTimer") && (() => {
                  // For recurring tasks, use occurrence-specific ID for pomodoro timer to ensure each occurrence has its own timer state
                  // This prevents the timer from being shared across all occurrences in the series
                  const isRecurringTask = task.recurrence && task.recurrence.type !== 'none';
                  const pomodoroTimerId = isRecurringTask && task.scheduledDate
                    ? `${task.id}__${getDateString(new Date(task.scheduledDate))}`
                    : task.id;
                  
                  // For recurring tasks, get the correct occurrence's time (completed occurrence if exists, otherwise current task)
                  let occurrenceTime = task.actualTime || 0;
                  if (isRecurringTask && task.scheduledDate) {
                    const scheduledDate = new Date(task.scheduledDate);
                    scheduledDate.setHours(0, 0, 0, 0);
                    const scheduledDateKey = getDateString(scheduledDate);
                    const completedOccurrenceId = `${task.id}_completed_${scheduledDateKey}`;
                    const completedOccurrence = tasks.find(t => t.id === completedOccurrenceId);
                    if (completedOccurrence && completedOccurrence.actualTime) {
                      occurrenceTime = completedOccurrence.actualTime;
                    }
                  }
                  
                  return (
                    <div className={cn(
                    cn(TASK_DIALOG_COLORS.inputFieldBg, "text-foreground rounded-xl"),
                    cn(TASK_DIALOG_MINIMAL_SPACING.cardPadding, "space-y-2"),
                    "border-2 border-primary/20 shadow-md hover:shadow-lg transition-shadow"
                  )}>
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        🍅 Pomodoro Timer
                      </Label>
                      <PomodoroTimer
                        taskId={pomodoroTimerId}
                        taskTitle={task.title}
                        onTimeUpdate={handlePomodoroTimeUpdate}
                        compact={false}
                        initialTime={occurrenceTime}
                        estimatedTime={task.estimatedTime || undefined}
                      />
                    </div>
                  );
                })()}
                </TabsContent>

                {/* Advanced Tab - Removed (merged into Organization) */}
              </div>
            </div>
          </Tabs>

          {/* Footer - Reference: two prominent buttons - red cancel, purple + CREATE */}
          <div
            className={cn(
              "flex flex-col gap-3 pt-5 sm:pt-6"
            )}
            style={{
              paddingLeft: 0,
              paddingRight: 0,
              paddingBottom: COMPONENT_DIMENSIONS.taskDialog.footer.padding.bottom,
            }}
          >
            {/* Secondary row: Duplicate / Delete - icon-only below lg for spacing */}
            {task && (
              <div className="flex gap-1 sm:gap-2 justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDuplicate}
                  className="text-foreground hover:bg-primary/10 h-8 w-8 lg:h-8 lg:w-auto lg:px-3 lg:min-w-0 rounded-lg flex items-center justify-center"
                  title={TASK_DIALOG_UI_TEXT.buttonTooltips.duplicate}
                >
                  <Icon name="copy" size={16} className="shrink-0 lg:mr-1.5" />
                  <span className="hidden lg:inline">{TASK_DIALOG_UI_TEXT.duplicate.desktop}</span>
                </Button>
                {task.status !== "done" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-destructive hover:bg-destructive/10 h-8 w-8 lg:h-8 lg:w-auto lg:px-3 lg:min-w-0 rounded-lg flex items-center justify-center"
                    title={TASK_DIALOG_UI_TEXT.buttonTooltips.delete}
                  >
                    <Icon name="trash-2" size={16} className="shrink-0 lg:mr-1.5" />
                    <span className="hidden lg:inline">{TASK_DIALOG_UI_TEXT.delete.desktop}</span>
                  </Button>
                )}
              </div>
            )}
            {/* Primary row: cancel and Create/Update - icon-only below lg, text on desktop */}
            <div className="flex gap-2 sm:gap-4">
              <Button
                type="button"
                variant="destructive"
                onClick={onClose}
                className={cn(
                  TASK_DIALOG_COLORS.footerCancel,
                  "flex-1 lg:flex-initial font-semibold h-10 sm:h-12 rounded-xl text-sm sm:text-base min-w-0",
                  "px-3 lg:px-6 flex items-center justify-center"
                )}
                title={TASK_DIALOG_UI_TEXT.buttonTooltips.cancel}
              >
                <Icon name="x" size={22} className="shrink-0 lg:hidden" style={{ color: 'inherit' }} aria-hidden />
                <span className="hidden lg:inline">{TASK_DIALOG_UI_TEXT.cancel}</span>
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || (task ? !permissions.canEditTask : !permissions.canCreateTask)}
                className={cn(
                  TASK_DIALOG_COLORS.footerCreate,
                  "flex-1 lg:flex-initial font-semibold h-10 sm:h-12 rounded-xl text-sm sm:text-base shadow-md min-w-0",
                  "px-3 lg:px-6 flex items-center justify-center"
                )}
                style={{ color: COLOR_TEXT_WHITE }}
                title={task ? TASK_DIALOG_UI_TEXT.buttonTooltips.updateTask : TASK_DIALOG_UI_TEXT.buttonTooltips.createTask}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Icon name="circle-notch" size={18} style={{ color: COLOR_TEXT_WHITE }} className="animate-spin shrink-0" />
                    <span className="hidden lg:inline">{TASK_DIALOG_UI_TEXT.saving}</span>
                  </span>
                ) : (
                  <>
                    {task ? (
                      <>
                        <Icon name="check" size={22} className="shrink-0 lg:hidden" style={{ color: COLOR_TEXT_WHITE }} aria-hidden />
                        <span className="hidden lg:inline">{TASK_DIALOG_UI_TEXT.updateTask}</span>
                      </>
                    ) : (
                      <>
                        <Icon name="plus" size={22} className="shrink-0 lg:hidden" style={{ color: COLOR_TEXT_WHITE }} aria-hidden />
                        <span className="hidden lg:inline lg:flex lg:items-center lg:gap-2">
                          <Icon name="plus" size={18} style={{ color: COLOR_TEXT_WHITE }} />
                          {TASK_DIALOG_UI_TEXT.createTask}
                        </span>
                      </>
                    )}
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
        </div>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
      >
        <AlertDialogContent className="bg-white dark:bg-popover border-primary/20">
          <AlertDialogHeader>
            <AlertDialogTitle>{TASK_DIALOG_UI_TEXT.deleteConfirmation.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {task?.title && TASK_DIALOG_UI_TEXT.deleteConfirmation.description(task.title)}
              {TASK_DIALOG_UI_TEXT.deleteConfirmation.cannotUndo}
              {task?.subtasks && task.subtasks.length > 0 && (
                <span className="block mt-2 text-amber-600">
                  {TASK_DIALOG_UI_TEXT.deleteConfirmation.hasSubtasks(task.subtasks.length)}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{TASK_DIALOG_UI_TEXT.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {TASK_DIALOG_UI_TEXT.deleteTask}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Conflict Resolution Dialog */}
      <AlertDialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{TASK_DIALOG_UI_TEXT.conflictResolution.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingTaskData && TASK_DIALOG_UI_TEXT.conflictResolution.description(
                formatTime(pendingTaskData.requestedTime),
                formatTime(pendingTaskData.alternativeTime)
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleConflictCancel}>
              {TASK_DIALOG_UI_TEXT.cancel}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConflictConfirm}>
              {pendingTaskData && TASK_DIALOG_UI_TEXT.conflictResolution.useAlternative(formatTime(pendingTaskData.alternativeTime))}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

