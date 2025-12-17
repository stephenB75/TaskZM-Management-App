import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Plus,
  Calendar as CalendarIcon,
  Tag,
  Users,
  Clock,
  Repeat,
  Link2,
  AlertCircle,
  Globe,
  Trash2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Settings,
  ListChecks,
  Copy,
  Folder,
} from "lucide-react";
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
import { Z_INDEX, MAX_HEIGHT } from "../lib/layout-constants";
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { CheckboxSwitch as Switch } from "./ui/checkbox-switch";
import { Slider } from "./ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { PomodoroTimer } from "./PomodoroTimer";
import {
  cn,
  formatDate,
  getDateString,
  validateDependencies,
  getIncompleteDependencies,
  getInitials,
} from "../lib/utils";
import { MINUTES_PER_HOUR, HOURS_PER_DAY } from "../lib/business-constants";
import { useTasks } from "../contexts/TaskContext";
import { useTeam } from "../contexts/TeamContext";
import { useSubscription } from "../contexts/SubscriptionContext";
import { useCalendar } from "../contexts/CalendarContext";
import { toast } from "sonner";
import { logger } from "../lib/logger";
import { TOAST_DURATION_SHORT_MS } from "../lib/layout-constants";
import { TIMING_CONSTANTS } from "../lib/timing-constants";
import { checkTimeConflict, findNextAvailableSlot, formatTime } from "../lib/time-conflict";
import { getCategoryHoursForTask } from "../lib/category-hours-utils";
import { checkDailyLimit, getDailyHoursWarningLevel, MAX_HOURS_PER_DAY, getTaskMinutes } from "../lib/daily-hours-utils";
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
  onDateSelect: (date: Date, field: "scheduled" | "due") => void;
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

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const activeDate = activeField === "scheduled" ? scheduledDate : dueDate;

  return (
    <div className="w-full bg-white/80 dark:bg-card/80 rounded-lg p-3 border-2 border-primary/30 shadow-lg">
      {/* Toggle Buttons */}
      <div className="flex gap-2 mb-3">
        <Button
          type="button"
          variant={activeField === "scheduled" ? "default" : "outline"}
          size="sm"
          onClick={() => onFieldChange("scheduled")}
          className={cn(
            "flex-1 text-xs h-8",
            activeField === "scheduled"
              ? "bg-primary text-primary-foreground"
              : "border-primary/20 hover:border-primary/40 hover:bg-primary/5"
          )}
        >
          <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
          Scheduled Date
        </Button>
        <Button
          type="button"
          variant={activeField === "due" ? "default" : "outline"}
          size="sm"
          onClick={() => onFieldChange("due")}
          className={cn(
            "flex-1 text-xs h-8",
            activeField === "due"
              ? "bg-primary text-primary-foreground"
              : "border-primary/20 hover:border-primary/40 hover:bg-primary/5"
          )}
        >
          <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
          Due Date
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
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{monthName}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={goToToday}
            className="h-6 px-2 text-xs text-primary hover:bg-primary/10"
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
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week day headers - Fixed alignment */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-[10px] font-medium text-muted-foreground py-1 flex items-center justify-center"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Date grid - showing 35 days (5 weeks) - Fixed alignment */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          const dateStr = date.toISOString().split('T')[0];
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
                "h-8 w-full rounded-md text-xs font-medium transition-all hover:scale-105 flex items-center justify-center",
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
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Selected date info */}
      {activeDate && (
        <div className="mt-3 pt-3 border-t border-primary/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-3.5 w-3.5 text-primary" />
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
              onDateSelect(undefined!, activeField);
            }}
            className="h-6 px-2 text-xs"
          >
            Clear
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
    if (!selectedDate) return false;
    return date.getDate() === selectedDate.getDate() &&
           date.getMonth() === selectedDate.getMonth() &&
           date.getFullYear() === selectedDate.getFullYear();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === viewDate.getMonth() &&
           date.getFullYear() === viewDate.getFullYear();
  };

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div className="w-full bg-white/80 dark:bg-card/80 rounded-lg p-3 border-2 border-primary/30 shadow-lg">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={goToPreviousMonth}
          className="h-7 w-7"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{monthName}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={goToToday}
            className="h-6 px-2 text-xs text-primary hover:bg-primary/10"
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
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week day headers - Fixed alignment */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-[10px] font-medium text-muted-foreground py-1 flex items-center justify-center"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Date grid - showing 35 days (5 weeks) - Fixed alignment */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          const dateStr = date.toISOString().split('T')[0];
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
                "h-8 w-full rounded-md text-xs font-medium transition-all hover:scale-105 flex items-center justify-center",
                isSelectedDate
                  ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30"
                  : isTodayDate
                  ? "bg-primary/20 text-primary font-bold ring-1 ring-primary/30"
                  : isCurrentMonthDate
                  ? "text-foreground hover:bg-primary/10"
                  : "text-muted-foreground/50 hover:bg-muted/50"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Selected date info */}
      {selectedDate && (
        <div className="mt-3 pt-3 border-t border-primary/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-3.5 w-3.5 text-primary" />
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
            className="h-6 px-2 text-xs"
          >
            Clear
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
  } = useTasks();
  const { teamMembers, getTeamMember } = useTeam();
  const { hasFeature, features } = useSubscription();
  const { calendarStatus, syncTask: syncTaskToCalendar } = useCalendar();
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
  const [notes, setNotes] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [scheduledHours, setScheduledHours] = useState("");
  const [scheduledMinutes, setScheduledMinutes] = useState("");
  const [timeFormat, setTimeFormat] = useState<"12hr" | "24hr">("12hr");
  const [timePeriod, setTimePeriod] = useState<"AM" | "PM">("AM");
  
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
        const safeTitle = typeof task.title === 'string' ? task.title : (task.title?.toString() || 'Untitled Task');
        const safeStatus = typeof task.status === 'string' ? task.status : ((task.status as any) || 'todo');
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
        setSubtasks(Array.isArray(task.subtasks) ? task.subtasks : []);
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
        setNotes(task.notes || "");
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
      setNotes("");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      return;
    }

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
          }
        } else if (scheduledTime) {
          // Fallback to old format if needed
          const [hours, minutes] = scheduledTime
            .split(":")
            .map(Number);
          // Validate parsed time values
          if (!isNaN(hours) && !isNaN(minutes)) {
            dateWithTime.setHours(hours, minutes, 0, 0);
          }
        }

        // Final validation before converting to ISO
        if (!isNaN(dateWithTime.getTime())) {
          finalScheduledDate = dateWithTime.toISOString();
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
      task || ({ id: "new", dependencies: [] } as Task);
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
      (parseInt(estimatedHours) || 0) * 60 +
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
        const activeRecurringTasks = tasks.filter(t => 
          t.recurrence && 
          t.recurrence.type !== 'none' && 
          t.status !== 'done' &&
          t.id !== task?.id // Exclude current task if editing
        );
        
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
        notes: notes,
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
      notes: notes, // Preserve HTML formatting from RichTextEditor
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
      timeHasChanged = Math.abs(newTime - originalTime) > 60 * 1000;
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
          
          const limitCheck = checkDailyLimit(scheduledDateOnly, tempTaskForLimit, tasks);
          const warningLevel = getDailyHoursWarningLevel(limitCheck.currentHours, limitCheck.newTotalHours - limitCheck.currentHours);
          
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
              const altLimitCheck = checkDailyLimit(alternativeTime, tempTaskForLimit, tasks);
              if (altLimitCheck.wouldExceed) {
                const message = isExistingTaskOnToday 
                  ? `Updating this task would exceed the ${MAX_HOURS_PER_DAY}-hour daily limit. Current: ${limitCheck.currentHours.toFixed(1)}h, Task: ${(limitCheck.newTotalHours - limitCheck.currentHours).toFixed(1)}h, Total: ${limitCheck.newTotalHours.toFixed(1)}h`
                  : `This task would exceed the ${MAX_HOURS_PER_DAY}-hour daily limit. Current: ${limitCheck.currentHours.toFixed(1)}h, Adding: ${(limitCheck.newTotalHours - limitCheck.currentHours).toFixed(1)}h, Total: ${limitCheck.newTotalHours.toFixed(1)}h`;
                
                toast.error('Daily limit exceeded', {
                  description: message,
                  duration: 5000,
                });
                return;
              }
              
              // Use alternative time that fits within limit
              finalScheduledTime = alternativeTime;
              taskData.scheduledDate = finalScheduledTime.toISOString();
            } else {
              // Only estimated time changed, but would exceed limit
              // Don't relocate, just show error
              const message = `Updating this task's duration would exceed the ${MAX_HOURS_PER_DAY}-hour daily limit. Current: ${limitCheck.currentHours.toFixed(1)}h, Task: ${(limitCheck.newTotalHours - limitCheck.currentHours).toFixed(1)}h, Total: ${limitCheck.newTotalHours.toFixed(1)}h`;
              
              toast.error('Daily limit exceeded', {
                description: message,
                duration: 5000,
              });
              return;
            }
          }
          
          if (warningLevel === 'warning' && !limitCheck.wouldExceed) {
            // Close to limit - show warning but allow
            const message = isExistingTaskOnToday
              ? `Today already has ${limitCheck.currentHours.toFixed(1)}h scheduled. Updating this task will bring it to ${limitCheck.newTotalHours.toFixed(1)}h (limit: ${MAX_HOURS_PER_DAY}h)`
              : `Today already has ${limitCheck.currentHours.toFixed(1)}h scheduled. Adding this task will bring it to ${limitCheck.newTotalHours.toFixed(1)}h (limit: ${MAX_HOURS_PER_DAY}h)`;
            
            toast.warning('Approaching daily limit', {
              description: message,
              duration: 4000,
            });
          }
        }
      }
    }

    // No conflict, proceed with submission
    let savedTask: Task;
    if (task) {
      await updateTask(task.id, taskData);
      savedTask = { ...task, ...taskData };
    } else {
      savedTask = await addTask(taskData);
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
        await updateTask(task.id, {
          actualTime: minutes,
        });
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
        notes: task.notes || '',
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
  const availableTasksForDependencies = tasks.filter(
    (t) => t.id !== task?.id && t.status !== "done",
  );

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
      <DialogContent className={`max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col w-[95vw] sm:w-full ${UI_GRADIENT_COLORS.dialog.className} dark:from-gray-950 dark:via-gray-900 dark:to-gray-950`}>
        <DialogHeader className="flex-shrink-0 pb-4 sm:pb-5 md:pb-6 border-b border-primary/25 dark:border-primary/30">
          <DialogTitle className="text-lg sm:text-xl md:text-2xl font-semibold text-foreground dark:text-foreground">
            {task ? "Edit Task" : "Create New Task"}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground dark:text-muted-foreground">
            {task
              ? "Update the task details below."
              : "Fill in the details to create a new task."}
          </DialogDescription>
        </DialogHeader>

        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(e as any);
          }}
          className="flex-1 overflow-hidden flex flex-col"
        >
          {/* Tabbed Interface */}
          <Tabs defaultValue="basic" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full justify-start px-4 sm:px-6 mb-4 bg-transparent border-b border-primary/10 rounded-none h-auto py-2 sm:py-3">
              <TabsTrigger value="basic" className="text-xs sm:text-sm">
                <span className="hidden sm:inline">Basic Info</span>
                <span className="sm:hidden">Basic</span>
              </TabsTrigger>
              <TabsTrigger value="scheduling" className="text-xs sm:text-sm">
                <CalendarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                <span className="hidden sm:inline">Schedule</span>
                <span className="sm:hidden">Time</span>
              </TabsTrigger>
              <TabsTrigger value="organization" className="text-xs sm:text-sm">
                <Tag className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                <span className="hidden sm:inline">Organize</span>
                <span className="sm:hidden">Tags</span>
              </TabsTrigger>
              <TabsTrigger value="advanced" className="text-xs sm:text-sm">
                <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                <span className="hidden sm:inline">Advanced</span>
                <span className="sm:hidden">More</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 px-4 sm:px-6 pb-4">
              {/* Basic Info Tab - Redesigned Flow */}
              <TabsContent value="basic" className="mt-0 space-y-4 sm:space-y-5">
                {/* Step 1: Name the Task */}
                <div className="space-y-3 sm:space-y-4 bg-white dark:bg-card rounded-lg p-4 sm:p-5 border-2 border-primary/30 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">1</span>
                    </div>
                    <Label htmlFor="title" className="text-base font-semibold text-foreground">Task Name *</Label>
                  </div>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter task name..."
                    autoFocus
                    className="bg-white dark:bg-card border-2 border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/20 h-11 text-base"
                  />
                </div>

                {/* Step 2: Quick Actions Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2 bg-white dark:bg-card rounded-lg p-4 border-2 border-primary/30 shadow-sm">
                    <Label htmlFor="status" className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-primary">2</span>
                      </div>
                      Status
                    </Label>
                    <Select
                      value={status}
                      onValueChange={(value) =>
                        setStatus(value as TaskStatus)
                      }
                    >
                      <SelectTrigger className="bg-white dark:bg-card border-2 border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/20 h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent style={{ zIndex: Z_INDEX.SELECT_CONTENT }}>
                        <SelectItem value="todo">To Do</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                        <SelectItem value="on-hold">On Hold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 bg-white dark:bg-card rounded-lg p-4 border-2 border-primary/30 shadow-sm">
                    <Label htmlFor="priority" className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-primary">3</span>
                      </div>
                      Priority
                    </Label>
                    <Select
                      value={priority}
                      onValueChange={(value) =>
                        setPriority(value as TaskPriority)
                      }
                    >
                      <SelectTrigger className="bg-white dark:bg-card border-2 border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/20 h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent style={{ zIndex: Z_INDEX.SELECT_CONTENT }}>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Description - Optional */}
                <div className="space-y-2 bg-white dark:bg-card rounded-lg p-4 border-2 border-primary/30 shadow-sm">
                  <Label htmlFor="description" className="text-sm font-semibold text-foreground">Description (Optional)</Label>
                  <RichTextEditor
                    value={description}
                    onChange={setDescription}
                    placeholder="Add a description..."
                    rows={3}
                    className="focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary"
                  />
                </div>

                {/* Folder Selector */}
                {folders.length > 0 && (
                  <div className="space-y-2 bg-white dark:bg-card rounded-lg p-4 border-2 border-primary/30 shadow-sm">
                    <Label htmlFor="folder" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <Folder className="w-4 h-4 text-primary" />
                      Folder
                    </Label>
                    <Select
                      value={folderId || "none"}
                      onValueChange={(value) => {
                        const newFolderId = value === "none" ? null : value;
                        setFolderId(newFolderId);
                        
                        // Also add folder name as a tag when folder is selected
                        if (newFolderId && folders && Array.isArray(folders)) {
                          try {
                            const selectedFolder = folders.find(f => f && f.id === newFolderId);
                            if (selectedFolder && selectedFolder.name && !tags.includes(selectedFolder.name)) {
                              setTags([...tags, selectedFolder.name]);
                            }
                          } catch (error) {
                            logger.error('Error finding selected folder:', error);
                          }
                        } else {
                          // Remove folder name from tags when folder is deselected
                          // Find the folder that was previously selected
                          if (folderId && folders && Array.isArray(folders)) {
                            try {
                              const previousFolder = folders.find(f => f && f.id === folderId);
                              if (previousFolder && previousFolder.name && tags.includes(previousFolder.name)) {
                                setTags(tags.filter(tag => tag !== previousFolder.name));
                              }
                            } catch (error) {
                              logger.error('Error finding previous folder:', error);
                            }
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="h-10 bg-white dark:bg-card border-2 border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/20">
                        <SelectValue placeholder="No folder" />
                      </SelectTrigger>
                      <SelectContent style={{ zIndex: Z_INDEX.SELECT_CONTENT }}>
                        <SelectItem value="none">No folder</SelectItem>
                        {folders && Array.isArray(folders) ? folders
                          .filter(folder => folder && folder.id && folder.name)
                          .map((folder) => (
                            <SelectItem key={folder.id} value={folder.id}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded"
                                  style={{ backgroundColor: folder.color || UI_FOLDER_COLORS.fallback }}
                                />
                                <span>{folder.name}</span>
                              </div>
                            </SelectItem>
                          )) : null}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </TabsContent>

              {/* Scheduling Tab - Step 2: Select Date */}
              <TabsContent value="scheduling" className="mt-0 space-y-4 sm:space-y-5">
                <div className="space-y-4 sm:space-y-5">
                  {/* Fixed Mini Calendar - Keep as is per requirements */}
                  <div className="w-full flex justify-center py-2 bg-white dark:bg-card rounded-lg p-4 border-2 border-primary/30 shadow-sm">
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

                  {/* Time Selection - Two Column Layout */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white dark:bg-card rounded-lg p-4 border-2 border-primary/30 shadow-sm">
                    {/* Scheduled Date & Time */}
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold flex items-center gap-2 text-foreground">
                        <CalendarIcon className="w-4 h-4 text-primary" />
                        Scheduled Date & Time
                      </Label>
                      {scheduledDate && (
                        <div className="text-xs text-muted-foreground bg-primary/10 rounded px-2 py-1">
                          {scheduledDate.toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          })}
                          {scheduledTime && ` at ${scheduledTime}`}
                        </div>
                      )}

                      {/* Time Picker */}
                      {scheduledDate && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Scheduled Time (Optional)
                            </Label>
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
                                className="h-5 text-xs text-muted-foreground hover:text-foreground"
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                          {/* Inline layout: Format toggle, Hour, Minute, AM/PM */}
                          <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap w-full">
                            {/* Time Format Toggle */}
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                              <Button
                                type="button"
                                variant={timeFormat === "12hr" ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                  setTimeFormat("12hr");
                                  // Convert current time to 12hr if needed
                                  if (scheduledHours) {
                                    const parsedHours = parseInt(scheduledHours, 10);
                                    if (!Number.isNaN(parsedHours)) {
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
                                    }
                                  }
                                }}
                                className="h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm"
                              >
                                12HR
                              </Button>
                              <Button
                                type="button"
                                variant={timeFormat === "24hr" ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                  setTimeFormat("24hr");
                                  // Convert current time to 24hr if needed
                                  if (scheduledHours) {
                                    const parsedHours = parseInt(scheduledHours, 10);
                                    if (!Number.isNaN(parsedHours)) {
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
                                className="h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm"
                              >
                                24HR
                              </Button>
                            </div>

                            {/* Hour Select */}
                            <div className="flex-1 min-w-[70px] sm:min-w-[90px] relative z-10">
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
                                <SelectTrigger className="bg-white dark:bg-card/80 border-primary/20 h-9 sm:h-10 text-sm cursor-pointer">
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
                            <div className="flex-1 min-w-[70px] sm:min-w-[90px] relative z-20">
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
                                  className="bg-white dark:bg-card/80 border-primary/20 h-9 sm:h-10 text-sm cursor-pointer pointer-events-auto"
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
                              <div className="flex-1 min-w-[70px] sm:min-w-[90px] relative z-10">
                                <Select
                                  value={timePeriod || "AM"}
                                  onValueChange={(value) => {
                                    const newPeriod = value as "AM" | "PM";
                                    setTimePeriod(newPeriod);
                                    if (scheduledHours && scheduledMinutes) {
                                      updateScheduledTime(scheduledHours, scheduledMinutes, timeFormat, newPeriod);
                                    } else if (scheduledHours) {
                                      // If only hours are set, update with default minutes
                                      updateScheduledTime(scheduledHours, "00", timeFormat, newPeriod);
                                    }
                                  }}
                                >
                                  <SelectTrigger className="bg-white dark:bg-card/80 border-primary/20 h-9 sm:h-10 text-sm cursor-pointer">
                                    <SelectValue placeholder="AM/PM" />
                                  </SelectTrigger>
                                  <SelectContent style={{ zIndex: Z_INDEX.SELECT_CONTENT }}>
                                    <SelectItem value="AM" className="cursor-pointer">AM</SelectItem>
                                    <SelectItem value="PM" className="cursor-pointer">PM</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                          {scheduledDate && !scheduledTime && (
                            <p className="text-xs text-muted-foreground">
                              💡 Leave time empty to let AI schedule based on your preferences
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Due Date */}
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-primary" />
                          Due Date
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
                            className="h-6 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Clear
                          </Button>
                        )}
                      </div>

                      {/* Date Input */}
                      <Input
                        type="text"
                        placeholder="MM/DD/YYYY"
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
                        className="bg-white dark:bg-card border-2 border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm h-10"
                      />
                    </div>
                  </div>

                  {/* Estimated Time with Slider */}
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
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
                    <div className="space-y-2 sm:space-y-3">
                      <Label className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5" />
                        Timezone
                      </Label>
                      <Select
                        value={timezone}
                        onValueChange={setTimezone}
                      >
                        <SelectTrigger className="h-10 bg-white dark:bg-card border-2 border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/20">
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
                </div>
              </TabsContent>

              {/* Organization Tab - Step 3: Assign Tags, Step 4: Create Subtask, Step 5: Add Dependency */}
              <TabsContent value="organization" className="mt-0 space-y-4 sm:space-y-5">
                {/* Step 3: Assign Tags */}
                  <div className="space-y-3 bg-white dark:bg-card rounded-lg p-4 border-2 border-primary/30 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">3</span>
                      </div>
                      <Label className="text-base font-semibold text-foreground flex items-center gap-2">
                      <Tag className="w-4 h-4 text-primary" />
                      Assign Tags
                      </Label>
                    </div>
                  
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
                      <SelectTrigger className="flex-1 h-10 bg-white dark:bg-card border-2 border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/20">
                        <SelectValue placeholder="Select or add tag..." />
                      </SelectTrigger>
                      <SelectContent style={{ zIndex: Z_INDEX.SELECT_CONTENT }}>
                        {availableTags && availableTags.length > 0 ? (
                          availableTags
                            .filter((tag) => !tags.includes(tag))
                            .map((tag) => (
                              <SelectItem key={tag} value={tag}>
                              <div className="flex items-center gap-2">
                                  <Tag className="w-3 h-3 text-primary" />
                                  <span>{tag}</span>
                                </div>
                              </SelectItem>
                            ))
                        ) : null}
                        <SelectItem value="new">
                          <div className="flex items-center gap-2">
                            <Plus className="w-3 h-3 text-primary" />
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
                      className="bg-white dark:bg-card border-2 border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/20 h-10"
                    />
                    <Button
                      type="button"
                      onClick={addTag}
                      variant="outline"
                      size="icon"
                      className="border-2 border-primary/30 hover:border-primary hover:bg-primary/10 h-10 w-10"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Display Selected Tags */}
                  {tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                      {tags.map((tag) => (
                            <Badge
                          key={tag}
                              variant="secondary"
                              className="cursor-pointer hover:bg-destructive/10 border-2 border-primary/30 px-3 py-1"
                          onClick={() => removeTag(tag)}
                            >
                              <div className="flex items-center gap-1.5">
                            <Tag className="w-3 h-3 text-primary" />
                            <span>{tag}</span>
                                <X className="w-3 h-3 ml-1" />
                              </div>
                            </Badge>
                      ))}
                      </div>
                    )}
                  </div>

                {/* Step 4: Create Subtask */}
                <div className="space-y-3 bg-white dark:bg-card rounded-lg p-4 border-2 border-primary/30 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">4</span>
                    </div>
                    <Label className="text-base font-semibold text-foreground flex items-center gap-2">
                      <ListChecks className="w-4 h-4 text-primary" />
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
                      className="bg-white dark:bg-card border-2 border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/20 h-10"
                    />
                    <Button
                      type="button"
                      onClick={addSubtask}
                      variant="outline"
                      size="icon"
                      className="border-2 border-primary/30 hover:border-primary hover:bg-primary/10 h-10 w-10"
                    >
                      <Plus className="w-4 h-4" />
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
                              className="mt-1"
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
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Step 5: Add Dependency */}
                <div className="space-y-3 bg-white dark:bg-card rounded-lg p-4 border-2 border-primary/30 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">5</span>
                    </div>
                    <Label className="text-base font-semibold text-foreground flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-primary" />
                      Add Dependency
                    </Label>
                    {!hasFeature('taskDependencies') && (
                      <Badge variant="secondary" className="ml-auto bg-gradient-to-r from-primary/20 to-primary/30 text-primary-foreground">
                        PRO YEARLY
                      </Badge>
                    )}
                  </div>
                  {!hasFeature('taskDependencies') ? (
                    <div className="space-y-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
                      <p className="text-sm text-muted-foreground">
                        Task Dependencies is a Pro Yearly feature. Upgrade to link related tasks and manage task relationships.
                      </p>
                    </div>
                  ) : (
                    <>
                      {availableTasksForDependencies.length > 0 ? (
                    <Select
                      value={selectedDependencyValue || undefined}
                      onValueChange={(value) => {
                        if (value) {
                          addDependency(value);
                          setSelectedDependencyValue("");
                        }
                      }}
                    >
                      <SelectTrigger className="h-10 bg-white dark:bg-card border-2 border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/20">
                        <SelectValue placeholder="Select a task..." />
                      </SelectTrigger>
                      <SelectContent style={{ zIndex: Z_INDEX.SELECT_CONTENT }}>
                        {availableTasksForDependencies
                          .filter((t) => !dependencies.includes(t.id))
                          .map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs border-primary/30">
                                  {t.status}
                                </Badge>
                                <span className="truncate">{t.title}</span>
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      No available tasks to add as dependencies
                    </p>
                  )}

                  {dependencies.length > 0 && (
                    <div className="space-y-2 mt-3">
                      {dependencies.map((depId) => {
                        const depTask = tasks.find((t) => t.id === depId);
                        if (!depTask) return null;
                        const isComplete = depTask.status === "done";
                        return (
                          <div
                            key={depId}
                            className={cn(
                              "flex items-center gap-2 p-2 rounded-lg border-2",
                              isComplete
                                ? "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                                : "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800",
                            )}
                          >
                            {isComplete ? (
                              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                <span className="text-white text-xs">✓</span>
                              </div>
                            ) : (
                              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{depTask.title}</p>
                              <p className="text-xs text-muted-foreground">
                                Status: {depTask.status} · Priority: {depTask.priority}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeDependency(depId)}
                              className="h-7 w-7 p-0"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                    </>
                  )}
                </div>
              </TabsContent>

              {/* Advanced Tab */}
              <TabsContent value="advanced" className="mt-0 space-y-4 sm:space-y-5">
                <div className="space-y-4 sm:space-y-5 bg-white dark:bg-card rounded-lg p-4 border-2 border-primary/30 shadow-sm">
                  {/* Recurrence with Toggle */}
                  <div className="space-y-4 sm:space-y-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Repeat className="w-4 h-4 text-primary" />
                        <Label className="text-sm font-semibold">Repeat Task</Label>
                        {!hasFeature('recurringTasks') && (
                          <Badge variant="secondary" className="ml-2 bg-gradient-to-r from-primary/20 to-primary/30 text-primary-foreground">
                            PRO YEARLY
                          </Badge>
                        )}
                      </div>
                      <Switch
                        checked={recurrenceType !== "none"}
                        onCheckedChange={(checked) => {
                          if (!hasFeature('recurringTasks')) {
                            toast.error('Recurring Tasks is a Pro Yearly feature', {
                              description: 'Upgrade to Pro Yearly to create recurring tasks.',
                            });
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
                      <div className="space-y-4 sm:space-y-5 pl-6 border-l-2 border-primary/20">
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
                          <SelectTrigger className="h-10 bg-white dark:bg-card border-2 border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/20">
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
                          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => (
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
                          <SelectTrigger className="h-10 bg-white dark:bg-card border-2 border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/20">
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
                    {recurrenceType !== "none" && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Ends</Label>
                        <div className="w-full flex justify-center py-2 bg-white dark:bg-card rounded-lg p-4 border-2 border-primary/30 shadow-sm">
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
                        {recurrenceType !== "none" && (
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

                  {/* Team Assignment */}
                  {teamMembers.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
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
                            // Reset the select after adding
                            setSelectedAssigneeValue("");
                          }
                        }}
                      >
                        <SelectTrigger className="h-10 bg-white dark:bg-card border-2 border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/20">
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
                                <div className="flex items-center gap-1.5">
                                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-[10px] font-medium">
                                    {getInitials(member.name)}
                                  </div>
                                  <span>{member.name}</span>
                                  <X className="w-3 h-3 ml-1" />
                                </div>
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <Separator className="bg-primary/20" />

                  {/* Dependencies */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-primary" />
                      <Label className="text-sm font-semibold">Task Dependencies</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Select tasks that must be completed before this task can start
                    </p>

                    {availableTasksForDependencies.length > 0 ? (
                      <Select
                        value={selectedDependencyValue || undefined}
                        onValueChange={(value) => {
                          if (value) {
                            addDependency(value);
                            // Reset the select after adding
                            setSelectedDependencyValue("");
                          }
                        }}
                      >
                        <SelectTrigger className="h-10 bg-white dark:bg-card border-2 border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/20">
                          <SelectValue placeholder="Add a dependency..." />
                        </SelectTrigger>
                        <SelectContent style={{ zIndex: Z_INDEX.SELECT_CONTENT }}>
                          {availableTasksForDependencies
                            .filter((t) => !dependencies.includes(t.id))
                            .map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs border-primary/20">
                                    {t.status}
                                  </Badge>
                                  <span className="truncate">{t.title}</span>
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        No available tasks to add as dependencies
                      </p>
                    )}

                    {dependencies.length > 0 && (
                      <div className="space-y-2 mt-3">
                        {dependencies.map((depId) => {
                          const depTask = tasks.find((t) => t.id === depId);
                          if (!depTask) return null;

                          const isComplete = depTask.status === "done";

                          return (
                            <div
                              key={depId}
                              className={cn(
                                "flex items-center gap-2 p-2 rounded-lg border",
                                isComplete
                                  ? "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                                  : "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800",
                              )}
                            >
                              {isComplete ? (
                                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white text-xs">✓</span>
                                </div>
                              ) : (
                                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">{depTask.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  Status: {depTask.status} · Priority: {depTask.priority}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeDependency(depId)}
                                className="h-7 w-7 p-0"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {task &&
                      dependencies.length > 0 &&
                      getIncompleteDependencies({ ...task, dependencies }, tasks).length > 0 && (
                        <div className="flex items-start gap-2 p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                          <div className="text-xs text-amber-800 dark:text-amber-200">
                            <p className="font-medium">Task is blocked</p>
                            <p>This task cannot be started until all dependencies are completed.</p>
                          </div>
                        </div>
                      )}
                  </div>

                  <Separator className="bg-primary/20" />

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-sm font-semibold">Notes</Label>
                    <RichTextEditor
                      value={notes}
                      onChange={setNotes}
                      placeholder="Additional notes... (Press Enter for new paragraphs)"
                      rows={4}
                      className="bg-white dark:bg-card/80"
                    />
                  </div>

                  {/* Pomodoro Timer */}
                  {task && hasFeature("pomodoroTimer") && (
                    <>
                      <Separator className="bg-primary/20" />
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                          🍅 Pomodoro Timer
                        </Label>
                        <PomodoroTimer
                          taskId={task.id}
                          taskTitle={task.title}
                          onTimeUpdate={handlePomodoroTimeUpdate}
                          compact={false}
                          initialTime={task.actualTime || 0}
                          estimatedTime={task.estimatedTime || undefined}
                        />
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>

          {/* Footer Actions - Single Set for All Tabs */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-4 pt-4 sm:pt-5 md:pt-6 pb-2 sm:pb-3 border-t-2 border-primary/30 bg-white dark:bg-card">
            {/* Left side - Action buttons (only for edit mode) */}
            {task && (
              <div className="flex gap-2 sm:gap-3 order-2 sm:order-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDuplicate}
                  className="gap-1.5 sm:gap-2 border-2 border-primary/30 hover:border-primary hover:bg-primary/10 h-10 px-4 text-sm font-medium"
                >
                  <Copy className="w-4 h-4" />
                  <span className="hidden sm:inline">Duplicate</span>
                  <span className="sm:hidden">Dup</span>
                </Button>
                {task.status !== "done" && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="gap-1.5 sm:gap-2 h-10 px-4 text-sm font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Delete</span>
                    <span className="sm:hidden">Del</span>
                  </Button>
                )}
              </div>
            )}

            {/* Right side - Cancel and Submit */}
            <div className="flex gap-2 sm:gap-3 order-1 sm:order-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="border-2 border-primary/30 hover:border-primary hover:bg-primary/10 h-10 px-5 text-sm font-medium flex-1 sm:flex-initial"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-primary hover:bg-primary/90 text-white h-10 px-5 text-sm font-medium flex-1 sm:flex-initial min-w-[140px] shadow-md"
              >
                {task ? "Update Task" : "Create Task"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
      >
        <AlertDialogContent className="bg-white dark:bg-popover border-primary/20">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{task?.title}"?
              This action cannot be undone.
              {task?.subtasks && task.subtasks.length > 0 && (
                <span className="block mt-2 text-amber-600">
                  This task has {task.subtasks.length} subtask{task.subtasks.length !== 1 ? "s" : ""} that will also be deleted.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Conflict Resolution Dialog */}
      <AlertDialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Time Slot Already Taken</AlertDialogTitle>
            <AlertDialogDescription>
              The time slot {pendingTaskData && formatTime(pendingTaskData.requestedTime)} is already occupied by another task.
              Would you like to schedule this task at {pendingTaskData && formatTime(pendingTaskData.alternativeTime)} instead?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleConflictCancel}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConflictConfirm}>
              Use {pendingTaskData && formatTime(pendingTaskData.alternativeTime)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

