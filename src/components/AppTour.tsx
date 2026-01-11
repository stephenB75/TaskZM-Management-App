import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Calendar,
  Inbox,
  BarChart3,
  Settings,
  Archive,
  Users,
  Clock,
  Target,
  Tag,
  Award,
  Bell,
  Folder,
} from "lucide-react";
import { Button } from "./ui/button";
import { useTheme } from "../contexts/ThemeContext";
import { useSubscription } from "../contexts/SubscriptionContext";
import { cn } from "../lib/utils";
import { SUBSCRIPTION_UI_TEXT, DEFAULT_MONTHLY_PRICE } from "../lib/subscription-constants";
import { Z_INDEX } from "../lib/layout-constants";
import { TIMING_CONSTANTS } from "../lib/timing-constants";
import { getOfferings } from "../lib/revenuecat";
import { useAuth } from "../contexts/AuthContext";
import { configureRevenueCat } from "../lib/revenuecat";

interface AppTourProps {
  run: boolean;
  onFinish: () => void;
  onNavigate?: (view: string) => void;
  onShowPricing?: () => void;
}

interface TourStep {
  title: string;
  description: string;
  icon: any;
  iconColor: string;
  features?: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
  illustration?:
    | "kanban"
    | "sidebar"
    | "ai"
    | "task"
    | "features"
    | "calendar"
    | "analytics"
    | "inbox"
    | "today";
  screenshot?: string; // Path to screenshot image
  // Navigation and highlighting
  navigateTo?: string; // View to navigate to (e.g., 'dashboard', 'inbox', 'today', 'analytics')
  highlightElement?: string; // data-tour attribute value to highlight
  openPanel?: string; // Panel to open (e.g., 'analytics', 'ai')
  setViewMode?: 'week' | 'month'; // For dashboard view mode
}

// Function to create tour steps with dynamic pricing
const createTourSteps = (monthlyPrice: string = DEFAULT_MONTHLY_PRICE): TourStep[] => [
  {
    title: "Welcome to TaskZM! 🎉",
    description:
      "Your neurodivergent-friendly task management companion designed to reduce overwhelm and boost focus with calming colors and smooth animations.",
    icon: Sparkles,
    iconColor: "from-[#E6D5F0] to-[#9B87E8]",
    navigateTo: "dashboard",
    features: [
      {
        icon: "🎨",
        title: "Calming Design",
        description: "Pastel colors reduce visual stress",
      },
      {
        icon: "🤖",
        title: "AI Planning",
        description: "Smart task scheduling",
      },
      {
        icon: "⚡",
        title: "Quick Capture",
        description: "Brain dump instantly",
      },
    ],
  },
  {
    title: "7-Day Kanban Board",
    description:
      "Your main workspace showing the upcoming week at a glance. Each day is color-coded with calming pastel colors for easy visual scanning. Drag tasks between days, click + to add new tasks, and use the Pomodoro timer for focused work sessions.",
    icon: Calendar,
    iconColor: "from-[#C9E4F7] to-[#B8E6D5]",
    illustration: "kanban",
    navigateTo: "dashboard",
    setViewMode: "week",
    highlightElement: "kanban",
    features: [
      {
        icon: "👆",
        title: "Drag & Drop",
        description: "Move tasks between days",
      },
      {
        icon: "🎨",
        title: "Color-Coded",
        description: "Each day has unique colors",
      },
      {
        icon: "➕",
        title: "Quick Add",
        description: "Click + to create tasks",
      },
      {
        icon: "⏱️",
        title: "Pomodoro",
        description: "Built-in focus timer",
      },
    ],
  },
  {
    title: "Task Cards",
    description:
      "Each task card shows priority, category, duration, and description. Click any task to edit details, add subtasks, set dependencies, or start a Pomodoro session. Tasks can be dragged to reschedule or marked complete.",
    icon: Target,
    iconColor: "from-[#FFD6BA] to-[#FFA875]",
    illustration: "task",
    navigateTo: "dashboard",
    setViewMode: "week",
    highlightElement: "add-task",
    features: [
      {
        icon: "✅",
        title: "Subtasks",
        description: "Break work into steps",
      },
      {
        icon: "⏱️",
        title: "Pomodoro Timer",
        description: "Built-in focus sessions",
      },
      {
        icon: "🎯",
        title: "Priorities",
        description: "Urgent, High, Medium, Low",
      },
      {
        icon: "🏷️",
        title: "Tags",
        description: "Organize with custom tags",
      },
    ],
  },
  {
    title: "Sidebar Navigation",
    description:
      "Access all your tools through the icon sidebar on the left. Click any icon to open a sliding panel with smooth animations. The sidebar gives you quick access to Today Agenda, Inbox, Analytics, Team, and more.",
    icon: BarChart3,
    iconColor: "from-[#E6D5F0] to-[#9B87E8]",
    illustration: "sidebar",
    navigateTo: "dashboard",
    highlightElement: "sidebar",
    features: [
      {
        icon: "🔔",
        title: "Notifications",
        description: "Task & timer alerts",
      },
      {
        icon: "📅",
        title: "Today Agenda",
        description: "Timeline view of today",
      },
      {
        icon: "📥",
        title: "Inbox",
        description: "Unscheduled task capture",
      },
      {
        icon: "📊",
        title: "Analytics",
        description: "Track your progress",
      },
    ],
  },
  {
    title: "Today Agenda",
    description:
      "See all your tasks for today in a timeline view. Tasks are arranged chronologically with their scheduled times. This view helps you see your day at a glance and manage your time effectively.",
    icon: Clock,
    iconColor: "from-[#B8E6D5] to-[#9FD9BF]",
    illustration: "today",
    navigateTo: "today",
    highlightElement: "today-panel",
    features: [
      {
        icon: "⏰",
        title: "Timeline View",
        description: "See tasks by time",
      },
      {
        icon: "📋",
        title: "Daily Overview",
        description: "All today's tasks",
      },
      {
        icon: "✅",
        title: "Quick Complete",
        description: "Mark tasks done",
      },
    ],
  },
  {
    title: "Inbox",
    description:
      "Capture all your unscheduled tasks in the Inbox. This is your brain dump area where you can quickly add tasks without worrying about scheduling. Later, use AI Scheduler or manually schedule them to your week.",
    icon: Inbox,
    iconColor: "from-[#C9E4F7] to-[#E6D5F0]",
    illustration: "inbox",
    navigateTo: "inbox",
    highlightElement: "inbox-panel",
    features: [
      {
        icon: "📝",
        title: "Quick Capture",
        description: "Add tasks instantly",
      },
      {
        icon: "🤖",
        title: "AI Scheduling",
        description: "Schedule all at once",
      },
      {
        icon: "📅",
        title: "Manual Schedule",
        description: "Drag to specific days",
      },
    ],
  },
  {
    title: "Calendar Month View",
    description:
      "Switch to month view to see your entire month at a glance. This view shows all scheduled tasks across the month, helping you plan ahead and see your workload distribution.",
    icon: Calendar,
    iconColor: "from-[#E6D5F0] to-[#C9E4F7]",
    illustration: "calendar",
    navigateTo: "dashboard",
    setViewMode: "month",
    features: [
      {
        icon: "📅",
        title: "Month Overview",
        description: "See entire month",
      },
      {
        icon: "📊",
        title: "Workload Planning",
        description: "Plan ahead",
      },
      {
        icon: "🔄",
        title: "Easy Switching",
        description: "Toggle week/month view",
      },
    ],
  },
  {
    title: "AI Scheduler ✨",
    description:
      "Let AI intelligently distribute your unscheduled tasks across the week based on priorities, time estimates, task categories, and your custom working hours. The AI respects your calendar events and daily hour limits.",
    icon: Sparkles,
    iconColor: "from-[#E6D5F0] to-[#C9E4F7]",
    illustration: "ai",
    navigateTo: "dashboard",
    openPanel: "ai",
    features: [
      {
        icon: "⚙️",
        title: "Smart Analysis",
        description: "Considers all task details",
      },
      {
        icon: "⏰",
        title: "Category Hours",
        description: "Respects work/life balance",
      },
      {
        icon: "🎯",
        title: "Priority-Based",
        description: "Urgent tasks first",
      },
      {
        icon: "🔄",
        title: "Re-Schedule",
        description: "Reschedule days/weeks",
      },
      {
        icon: "💎",
        title: SUBSCRIPTION_UI_TEXT.upgradePrompt.proFeature,
        description: SUBSCRIPTION_UI_TEXT.upgradePrompt.proFeaturePrice(monthlyPrice),
      },
    ],
  },
  {
    title: "Analytics & Reporting",
    description:
      "Track your productivity with detailed analytics. View completion rates, time spent, task distribution, and export comprehensive PDF reports. Analytics help you understand your work patterns and improve your productivity.",
    icon: BarChart3,
    iconColor: "from-[#F4D9F4] to-[#D4A6D4]",
    illustration: "analytics",
    navigateTo: "analytics",
    openPanel: "analytics",
    features: [
      {
        icon: "📊",
        title: "Completion Rates",
        description: "Track task completion",
      },
      {
        icon: "⏱️",
        title: "Time Analytics",
        description: "See time spent",
      },
      {
        icon: "📈",
        title: "Trends",
        description: "Productivity patterns",
      },
      {
        icon: "📄",
        title: "PDF Reports",
        description: "Export detailed reports",
      },
      {
        icon: "💎",
        title: SUBSCRIPTION_UI_TEXT.upgradePrompt.proFeature,
        description: SUBSCRIPTION_UI_TEXT.upgradePrompt.proFeaturePrice(monthlyPrice),
      },
    ],
  },
  {
    title: "Smart Category Hours ⏰",
    description:
      "Set specific working hours for different task types. AI respects your schedule when planning tasks across work, personal, and project categories.",
    icon: Clock,
    iconColor: "from-[#B8E6D5] to-[#9FD9BF]",
    features: [
      {
        icon: "💼",
        title: "Work Hours",
        description: "9 AM - 5 PM on weekdays",
      },
      {
        icon: "🏠",
        title: "Personal Time",
        description: "Evenings and weekends",
      },
      {
        icon: "🚀",
        title: "Project Hours",
        description: "Flexible scheduling",
      },
      {
        icon: "📊",
        title: "AI Integration",
        description: "Smart task distribution",
      },
    ],
  },
  {
    title: "Achievement System 🏆",
    description:
      "Quietly earn achievements as you complete tasks! Four categories track your progress: Completion Milestones, Streaks, Focus, and Special awards.",
    icon: Award,
    iconColor: "from-[#F4D9F4] to-[#D4A6D4]",
    features: [
      {
        icon: "🎯",
        title: "Completion",
        description: "Task milestones",
      },
      {
        icon: "🔥",
        title: "Streaks",
        description: "Daily consistency",
      },
      {
        icon: "⏰",
        title: "Focus",
        description: "Pomodoro sessions",
      },
      {
        icon: "✨",
        title: "Special",
        description: "Unique accomplishments",
      },
    ],
  },
  {
    title: "Folders & Organization 📁",
    description:
      "Create folders to organize tasks by project or category. Drag and drop tasks into folders, or assign them using tags. Each folder shows task counts and helps you stay organized.",
    icon: Tag,
    iconColor: "from-[#B8E6D5] to-[#C9E4F7]",
    features: [
      {
        icon: "📁",
        title: "Create Folders",
        description: "Organize by project",
      },
      {
        icon: "🏷️",
        title: "Tag-Based",
        description: "Auto-assign via tags",
      },
      {
        icon: "👆",
        title: "Drag & Drop",
        description: "Move tasks easily",
      },
      {
        icon: "📊",
        title: "Task Counts",
        description: "See folder stats",
      },
    ],
  },
  {
    title: "Notifications & Alerts 🔔",
    description:
      "Stay on top of your tasks with smart notifications. Get alerts for overdue tasks, tasks due soon, Pomodoro timer completions, achievement unlocks, and team updates.",
    icon: Clock,
    iconColor: "from-[#FFD6BA] to-[#FFA875]",
    features: [
      {
        icon: "⏰",
        title: "Due Date Alerts",
        description: "Never miss deadlines",
      },
      {
        icon: "⏱️",
        title: "Pomodoro Complete",
        description: "Timer notifications",
      },
      {
        icon: "🏆",
        title: "Achievement Unlocks",
        description: "Celebrate your progress",
      },
      {
        icon: "👥",
        title: "Team Updates",
        description: "Member notifications",
      },
      {
        icon: "🔔",
        title: "Badge Counts",
        description: "App icon indicators",
      },
    ],
  },
  {
    title: "Calendar Integration 📅",
    description:
      "Sync your tasks with Google Calendar, Apple Calendar, and Outlook (coming soon). Keep all your events and tasks in one place with automatic bidirectional sync. Pro Monthly includes 1 calendar connection; Pro Yearly includes unlimited connections.",
    icon: Calendar,
    iconColor: "from-[#C9E4F7] to-[#E6D5F0]",
    features: [
      {
        icon: "🔗",
        title: "Google Calendar",
        description: "Full OAuth sync",
      },
      {
        icon: "🍎",
        title: "Apple Calendar",
        description: "CalDAV support",
      },
      {
        icon: "🔄",
        title: "Auto Sync",
        description: "Bidirectional updates",
      },
      {
        icon: "💎",
        title: SUBSCRIPTION_UI_TEXT.upgradePrompt.proFeature,
        description: SUBSCRIPTION_UI_TEXT.upgradePrompt.proFeaturePrice(monthlyPrice),
      },
    ],
  },
  {
    title: "Unlock Pro Features 💎",
    description:
      `Upgrade to TaskZM Pro for just ${monthlyPrice}/month and unlock unlimited AI scheduling, calendar sync, analytics dashboard, recurring tasks, task rollover, advanced Pomodoro, and more!`,
    icon: Sparkles,
    iconColor: "from-[#E6D5F0] to-[#9B87E8]",
    illustration: "features",
    features: [
      {
        icon: "✨",
        title: "Unlimited AI Scheduler",
        description: "Smart task planning",
      },
      {
        icon: "📅",
        title: "Calendar Sync",
        description: "1 calendar (Monthly)",
      },
      {
        icon: "📊",
        title: "Analytics Dashboard",
        description: "30-day history (Monthly)",
      },
      {
        icon: "🔄",
        title: "Recurring Tasks",
        description: "Up to 5 active (Monthly)",
      },
      {
        icon: "⏰",
        title: "Advanced Pomodoro",
        description: "History & stats",
      },
      {
        icon: "👥",
        title: "Team Collaboration",
        description: "Unlimited (Yearly)",
      },
    ],
  },
  {
    title: "You're All Set! 🚀",
    description:
      "Explore Analytics for insights, Archive for completed tasks, Team collaboration, Calendar sync, and cross-platform mobile apps. Plus Task Rollover to never miss incomplete tasks!",
    icon: Sparkles,
    iconColor: "from-[#C9E4F7] to-[#B8E6D5]",
    illustration: "features",
    features: [
      {
        icon: "📊",
        title: "Analytics",
        description: "Track productivity",
      },
      {
        icon: "🔄",
        title: "Task Rollover",
        description: "Auto-move incomplete",
      },
      {
        icon: "📱",
        title: "Mobile Apps",
        description: "iOS & Android",
      },
      {
        icon: "🔗",
        title: "Calendar Sync",
        description: "Google, Outlook, Apple",
      },
    ],
  },
];

// Illustration components
function KanbanIllustration() {
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:gap-2 p-2 sm:p-3 md:p-4">
      {["Mon", "Tue", "Wed"].map((day, i) => (
        <motion.div
          key={day}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="rounded-lg sm:rounded-xl p-1.5 sm:p-2 space-y-1 sm:space-y-1.5"
          style={{
            background:
              i === 0
                ? "linear-gradient(135deg, rgba(180, 228, 206, 0.3) 0%, rgba(159, 217, 191, 0.2) 100%)"
                : i === 1
                  ? "linear-gradient(135deg, rgba(201, 228, 247, 0.3) 0%, rgba(168, 218, 255, 0.2) 100%)"
                  : "linear-gradient(135deg, rgba(230, 213, 240, 0.3) 0%, rgba(199, 184, 234, 0.2) 100%)",
          }}
        >
          <div className="text-[9px] sm:text-[10px] font-medium text-center opacity-70">
            {day}
          </div>
          {[1, 2].map((task) => (
            <div
              key={task}
              className="h-6 sm:h-7 md:h-8 rounded-md sm:rounded-lg bg-white/80 dark:bg-card/80 shadow-sm"
            />
          ))}
        </motion.div>
      ))}
    </div>
  );
}

function SidebarIllustration() {
  const icons = [Bell, Calendar, Inbox, Folder, Users, BarChart3];
  return (
    <div className="flex justify-center gap-1.5 sm:gap-2 p-2 sm:p-3 md:p-4 flex-wrap">
      {icons.map((Icon, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.1 }}
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center"
          style={{
            background:
              i === 0
                ? "linear-gradient(135deg, #E6D5F0 0%, #C9E4F7 100%)"
                : "rgba(155, 135, 232, 0.1)",
          }}
        >
          <Icon
            className="w-4 h-4 sm:w-5 sm:h-5"
            style={{ color: i === 0 ? "#9B87E8" : "#A8A8B8" }}
          />
        </motion.div>
      ))}
    </div>
  );
}

function AIIllustration() {
  return (
    <div className="p-2 sm:p-3 md:p-4 space-y-1.5 sm:space-y-2">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: "100%" }}
        transition={{ delay: TIMING_CONSTANTS.tour.animation.delay, duration: TIMING_CONSTANTS.tour.animation.duration }}
        className="h-1.5 sm:h-2 rounded-full"
        style={{
          background:
            "linear-gradient(90deg, #E6D5F0 0%, #9B87E8 50%, #C9E4F7 100%)",
        }}
      />
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: "75%" }}
        transition={{ delay: 0.4, duration: 0.8 }}
        className="h-1.5 sm:h-2 rounded-full"
        style={{
          background:
            "linear-gradient(90deg, #C9E4F7 0%, #B8E6D5 100%)",
        }}
      />
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: "90%" }}
        transition={{ delay: 0.6, duration: 0.8 }}
        className="h-1.5 sm:h-2 rounded-full"
        style={{
          background:
            "linear-gradient(90deg, #B8E6D5 0%, #FFD6BA 100%)",
        }}
      />
    </div>
  );
}

function TaskIllustration() {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:gap-2 p-2 sm:p-3 md:p-4">
      {[
        { icon: "⏱️", color: "rgba(201, 228, 247, 0.3)" },
        { icon: "⏰", color: "rgba(184, 230, 213, 0.3)" },
        { icon: "🎯", color: "rgba(230, 213, 240, 0.3)" },
        { icon: "🏷️", color: "rgba(255, 214, 186, 0.3)" },
      ].map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.1 }}
          className="h-12 sm:h-14 md:h-16 rounded-lg sm:rounded-xl flex items-center justify-center text-xl sm:text-2xl"
          style={{ background: item.color }}
        >
          {item.icon}
        </motion.div>
      ))}
    </div>
  );
}

function FeaturesIllustration() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 p-2 sm:p-3 md:p-4">
      {[
        { icon: "📊", color: "rgba(230, 213, 240, 0.3)" },
        { icon: "🗄️", color: "rgba(184, 230, 213, 0.3)" },
        { icon: "🏆", color: "rgba(201, 228, 247, 0.3)" },
        { icon: "🔗", color: "rgba(255, 214, 186, 0.3)" },
      ].map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="h-16 sm:h-20 md:h-20 rounded-lg sm:rounded-xl flex items-center justify-center text-2xl sm:text-3xl"
          style={{ background: item.color }}
        >
          {item.icon}
        </motion.div>
      ))}
    </div>
  );
}

function CalendarIllustration() {
  return (
    <div className="grid grid-cols-7 gap-1 p-2 sm:p-3 md:p-4">
      {Array.from({ length: 14 }, (_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.02 }}
          className="h-8 sm:h-10 rounded-md flex items-center justify-center text-[10px] sm:text-xs"
          style={{
            background: i % 7 === 0 || i % 7 === 6 
              ? "rgba(230, 213, 240, 0.2)" 
              : "rgba(201, 228, 247, 0.2)",
          }}
        >
          {i + 1}
        </motion.div>
      ))}
    </div>
  );
}

function AnalyticsIllustration() {
  return (
    <div className="p-2 sm:p-3 md:p-4 space-y-2 flex items-end justify-center gap-2 h-24 sm:h-32">
      {[75, 60, 85, 50].map((height, i) => (
        <motion.div
          key={i}
          initial={{ height: 0 }}
          animate={{ height: `${height}%` }}
          transition={{ delay: i * 0.1, duration: 0.5 }}
          className="rounded-t-lg w-12 sm:w-16"
          style={{
            background: i === 0
              ? "linear-gradient(180deg, #E6D5F0 0%, #9B87E8 100%)"
              : i === 1
                ? "linear-gradient(180deg, #C9E4F7 0%, #B3D9F2 100%)"
                : i === 2
                  ? "linear-gradient(180deg, #B8E6D5 0%, #9FD9BF 100%)"
                  : "linear-gradient(180deg, #FFD6BA 0%, #FFA875 100%)",
          }}
        />
      ))}
    </div>
  );
}

function InboxIllustration() {
  return (
    <div className="p-2 sm:p-3 md:p-4 space-y-1.5 sm:space-y-2">
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className="h-8 sm:h-10 rounded-lg"
          style={{
            background: i === 1
              ? "rgba(201, 228, 247, 0.3)"
              : i === 2
                ? "rgba(184, 230, 213, 0.3)"
                : "rgba(230, 213, 240, 0.3)",
          }}
        />
      ))}
    </div>
  );
}

function TodayIllustration() {
  return (
    <div className="p-2 sm:p-3 md:p-4 space-y-2">
      {[
        { time: "9:00 AM", height: 40 },
        { time: "2:00 PM", height: 60 },
        { time: "4:30 PM", height: 30 },
      ].map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="flex items-center gap-2"
        >
          <div className="text-[10px] sm:text-xs opacity-70 w-16 sm:w-20">
            {item.time}
          </div>
          <div
            className="rounded-lg flex-1"
            style={{
              height: `${item.height}px`,
              background: i === 0
                ? "linear-gradient(135deg, rgba(201, 228, 247, 0.4) 0%, rgba(184, 230, 213, 0.4) 100%)"
                : i === 1
                  ? "linear-gradient(135deg, rgba(230, 213, 240, 0.4) 0%, rgba(199, 184, 234, 0.4) 100%)"
                  : "linear-gradient(135deg, rgba(255, 214, 186, 0.4) 0%, rgba(255, 168, 117, 0.4) 100%)",
            }}
          />
        </motion.div>
      ))}
    </div>
  );
}

export function AppTour({
  run,
  onFinish,
  onNavigate,
  onShowPricing,
}: AppTourProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<
    "forward" | "backward"
  >("forward");
  const [monthlyPrice, setMonthlyPrice] = useState<string>(DEFAULT_MONTHLY_PRICE);
  const [screenshotFailed, setScreenshotFailed] = useState<Record<number, boolean>>({});
  const prevRunRef = React.useRef(false);
  const hasInitializedRef = React.useRef(false);
  const currentStepRef = React.useRef(0);
  const isNavigatingRef = React.useRef(false);

  // Fetch RevenueCat pricing when component mounts or user changes
  useEffect(() => {
    const fetchPricing = async () => {
      if (!user?.id) return;
      
      try {
        // Configure RevenueCat if needed
        await configureRevenueCat(user.id);
        
        // Get offerings from RevenueCat
        const offerings = await getOfferings();
        
        if (offerings.monthly?.priceString) {
          setMonthlyPrice(offerings.monthly.priceString);
        }
      } catch (error) {
        console.warn('Failed to fetch RevenueCat pricing for app tour:', error);
        // Keep default price if fetch fails
      }
    };

    fetchPricing();
  }, [user?.id]);

  // Update tour steps when monthly price changes
  const dynamicTourSteps = React.useMemo(() => {
    return createTourSteps(monthlyPrice);
  }, [monthlyPrice]);

  const step = dynamicTourSteps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === dynamicTourSteps.length - 1;
  // Check if current step is the pricing step (second to last)
  const isPricingStep = currentStep === dynamicTourSteps.length - 2;

  // Sync ref with state
  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  // Handle navigation and highlighting when step changes
  useEffect(() => {
    if (!run || !onNavigate) return;
    
    const step = dynamicTourSteps[currentStep];
    if (!step) return;
    
    // Navigate to the view specified in the step
    if (step.navigateTo && !isNavigatingRef.current) {
      isNavigatingRef.current = true;
      onNavigate(step.navigateTo);
      
      // Handle view mode changes for dashboard
      if (step.navigateTo === 'dashboard' && step.setViewMode) {
        // Dispatch custom event to change view mode
        window.dispatchEvent(new CustomEvent('tour-set-view-mode', { 
          detail: { mode: step.setViewMode } 
        }));
      }
      
      // Handle panel opening
      if (step.openPanel) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('tour-open-panel', { 
            detail: { panel: step.openPanel } 
          }));
        }, TIMING_CONSTANTS.tour.navigationComplete);
      }
      
      // Reset navigation flag after a delay
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, TIMING_CONSTANTS.tour.navigationReset);
    }
    
    // Highlight element if specified
    if (step.highlightElement) {
      setTimeout(() => {
        const element = document.querySelector(`[data-tour="${step.highlightElement}"]`);
        if (element) {
          // Scroll element into view with offset to account for tour card on desktop
          const rect = element.getBoundingClientRect();
          const isDesktop = window.innerWidth >= 640;
          const scrollOffset = isDesktop ? 200 : 0; // Account for tour card on desktop
          window.scrollTo({
            top: window.scrollY + rect.top - (window.innerHeight / 2) + (scrollOffset / 2),
            behavior: 'smooth'
          });
          // Add highlight class
          element.classList.add('tour-highlight');
        }
      }, TIMING_CONSTANTS.tour.highlightDelay);
    } else {
      // Remove highlight from any previously highlighted elements
      document.querySelectorAll('.tour-highlight').forEach(el => {
        el.classList.remove('tour-highlight');
      });
    }
  }, [currentStep, run, onNavigate, dynamicTourSteps]);

  // Only reset when tour starts (run changes from false to true)
  // Don't reset when tour is running or closing
  useEffect(() => {
    // Only reset if run changed from false to true (tour just started)
    const wasRunning = prevRunRef.current;
    
    // CRITICAL: Prevent any resets if tour is already initialized and running
    // This prevents the tour from resetting when parent re-renders
    if (run && hasInitializedRef.current && wasRunning) {
      // Tour is already running - don't reset, just update ref
      prevRunRef.current = run;
      return;
    }
    
    if (run && !wasRunning && !hasInitializedRef.current) {
      // Tour just started - reset to first step
      setCurrentStep(0);
      currentStepRef.current = 0;
      setDirection("forward");
      hasInitializedRef.current = true;
      // Navigate to dashboard only once at the start
      if (onNavigate && !isNavigatingRef.current) {
        isNavigatingRef.current = true;
        onNavigate("dashboard");
        // Reset navigation flag after a short delay
        setTimeout(() => {
          isNavigatingRef.current = false;
        }, TIMING_CONSTANTS.tour.initializationReset);
      }
    } else if (!run && wasRunning) {
      // Tour was closed - reset initialization flag for next time
      hasInitializedRef.current = false;
      currentStepRef.current = 0;
      // Remove all highlight classes
      document.querySelectorAll('.tour-highlight').forEach(el => {
        el.classList.remove('tour-highlight');
      });
    }
    // Update ref to track previous run state
    prevRunRef.current = run;
    // Only depend on run, not onNavigate to prevent unnecessary resets
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  const handleNext = () => {
    setCurrentStep((prevStep) => {
      const nextStep = prevStep + 1;
      if (nextStep >= dynamicTourSteps.length) {
        // Mark tour as completed
        localStorage.setItem('taskzm_tour_completed', 'true');
        
        // Show pricing dialog for new free users after tour
        const isNewSignup = window?.localStorage?.getItem('taskzm_is_new_signup') === 'true';
        if (isNewSignup && subscription.tier === 'free' && onShowPricing) {
          // Small delay to let tour close smoothly
          setTimeout(() => {
            onShowPricing();
          }, TIMING_CONSTANTS.tour.pricingDialogDelay);
        }
        
        onFinish();
        return prevStep;
      } else {
        setDirection("forward");
        currentStepRef.current = nextStep;
        return nextStep;
      }
    });
  };

  const handlePrev = () => {
    setCurrentStep((prevStep) => {
      if (prevStep > 0) {
        const prevStepValue = prevStep - 1;
        setDirection("backward");
        currentStepRef.current = prevStepValue;
        return prevStepValue;
      }
      return prevStep;
    });
  };

  const handleSkip = () => {
    // Mark tour as completed even if skipped
    localStorage.setItem('taskzm_tour_completed', 'true');
    
    // Show pricing dialog for new free users even if tour is skipped
    const isNewSignup = window?.localStorage?.getItem('taskzm_is_new_signup') === 'true';
    if (isNewSignup && subscription.tier === 'free' && onShowPricing) {
      setTimeout(() => {
        onShowPricing();
      }, TIMING_CONSTANTS.tour.pricingDialogDelay);
    }
    
    onFinish();
  };

  if (!run) return null;

  const Icon = step.icon;

  // Calculate spotlight position for highlighted element
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  
  useEffect(() => {
    if (!run || !step.highlightElement) {
      setSpotlightRect(null);
      return;
    }
    
    const updateSpotlight = () => {
      const element = document.querySelector(`[data-tour="${step.highlightElement}"]`);
      if (element) {
        const rect = element.getBoundingClientRect();
        // Add padding around the element for better visibility
        const padding = 12;
        const newRect = new DOMRect(
          Math.max(0, rect.left - padding),
          Math.max(0, rect.top - padding),
          rect.width + (padding * 2),
          rect.height + (padding * 2)
        );
        setSpotlightRect(newRect);
      } else {
        setSpotlightRect(null);
      }
    };
    
    // Initial update with delay to allow navigation
    const timeout = setTimeout(updateSpotlight, TIMING_CONSTANTS.tour.highlightDelay);
    
    // Update on scroll/resize
    window.addEventListener('scroll', updateSpotlight, true);
    window.addEventListener('resize', updateSpotlight);
    
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('scroll', updateSpotlight, true);
      window.removeEventListener('resize', updateSpotlight);
    };
  }, [run, step.highlightElement, currentStep]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {run && (
        <>
          {/* Spotlight Overlay - Dark background with cutout for highlighted area */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none"
            style={{
              zIndex: Z_INDEX.APP_TOUR - 1,
            }}
          >
            {/* Dark overlay with spotlight cutout - only show if element is highlighted */}
            {spotlightRect && (
              <div 
                className="absolute inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                style={{
                  clipPath: `polygon(
                    0% 0%, 
                    0% 100%, 
                    ${Math.max(0, spotlightRect.left)}px 100%, 
                    ${Math.max(0, spotlightRect.left)}px ${Math.max(0, spotlightRect.top)}px, 
                    ${Math.min(window.innerWidth, spotlightRect.right)}px ${Math.max(0, spotlightRect.top)}px, 
                    ${Math.min(window.innerWidth, spotlightRect.right)}px ${Math.min(window.innerHeight, spotlightRect.bottom)}px, 
                    ${Math.max(0, spotlightRect.left)}px ${Math.min(window.innerHeight, spotlightRect.bottom)}px, 
                    ${Math.max(0, spotlightRect.left)}px 100%, 
                    100% 100%, 
                    100% 0%
                  )`,
                }}
              />
            )}
          </motion.div>

          {/* Tour Card - Positioned to side/bottom, compact design */}
          <motion.div
            key={currentStep}
            initial={{
              opacity: 0,
              scale: 0.95,
              y: direction === "forward" ? 20 : -20,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              scale: 0.95,
              y: direction === "forward" ? -20 : 20,
            }}
            transition={{
              type: "spring",
              damping: TIMING_CONSTANTS.tour.animation.springDamping,
              stiffness: TIMING_CONSTANTS.tour.animation.springStiffness,
            }}
            className={cn(
              "fixed bottom-4 left-4 right-4 sm:right-auto sm:left-auto sm:top-1/2 sm:-translate-y-1/2 sm:right-4 sm:w-96",
              "rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border border-primary/25 dark:border-primary/20",
              "bg-card/95 dark:bg-card/95 backdrop-blur-md",
              "pointer-events-auto"
            )}
            style={{
              zIndex: Z_INDEX.APP_TOUR,
              boxShadow: isDark
                ? "0 20px 60px rgba(0, 0, 0, 0.5), 0 8px 20px rgba(155, 135, 232, 0.3)"
                : "0 20px 60px rgba(155, 135, 232, 0.2), 0 8px 20px rgba(155, 135, 232, 0.15)",
            }}
          >
            {/* Header */}
            <div className="relative overflow-hidden">
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  background: `linear-gradient(135deg, ${
                    currentStep === 0
                      ? "rgba(230, 213, 240, 0.5)"
                      : currentStep === 1
                        ? "rgba(201, 228, 247, 0.5)"
                        : currentStep === 2
                          ? "rgba(230, 213, 240, 0.5)"
                          : currentStep === 3
                            ? "rgba(230, 213, 240, 0.5)"
                            : currentStep === 4
                              ? "rgba(255, 214, 186, 0.5)"
                              : "rgba(244, 217, 244, 0.5)"
                  } 0%, ${
                    currentStep === 0
                      ? "rgba(201, 228, 247, 0.3)"
                      : currentStep === 1
                        ? "rgba(184, 230, 213, 0.3)"
                        : currentStep === 2
                          ? "rgba(201, 228, 247, 0.3)"
                          : currentStep === 3
                            ? "rgba(201, 228, 247, 0.3)"
                            : currentStep === 4
                              ? "rgba(255, 201, 140, 0.3)"
                              : "rgba(212, 166, 212, 0.3)"
                  } 100%)`,
                }}
              />

              <div className="relative p-4 sm:p-6 md:p-8 pb-4 sm:pb-5 md:pb-6">
                {/* Close Button */}
                <button
                  onClick={handleSkip}
                  className={cn(
                    "absolute top-2 right-2 sm:top-3 sm:right-3 md:top-4 md:right-4 p-1.5 sm:p-2 rounded-full transition-all",
                    "hover:bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                {/* Icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    type: "spring",
                    damping: 20,
                    stiffness: 150,
                    delay: 0.1,
                  }}
                  className={cn(
                    "inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl mb-3 sm:mb-4",
                    `bg-gradient-to-br ${step.iconColor}`,
                  )}
                  style={{
                    boxShadow:
                      "0 4px 12px rgba(155, 135, 232, 0.2)",
                  }}
                >
                  <Icon className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white" />
                </motion.div>

                {/* Title */}
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 sm:mb-2.5 md:mb-3 pr-8 sm:pr-10 bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent"
                >
                  {step.title}
                </motion.h2>

                {/* Description */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-xs sm:text-sm leading-relaxed text-muted-foreground"
                >
                  {step.description}
                </motion.p>
              </div>
            </div>

            {/* Screenshot or Illustration */}
            {step.screenshot && !screenshotFailed[currentStep] ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className={cn(
                  "mx-4 sm:mx-6 md:mx-8 mb-3 sm:mb-4 rounded-xl sm:rounded-2xl overflow-hidden",
                  "bg-muted/50 border border-primary/10 shadow-lg",
                )}
              >
                <img
                  key={`screenshot-${currentStep}`}
                  src={step.screenshot}
                  alt={step.title}
                  className="w-full h-auto object-contain max-h-[400px] sm:max-h-[500px] md:max-h-[600px]"
                  loading="eager"
                  onError={(e) => {
                    console.warn('Screenshot failed to load, falling back to illustration:', step.screenshot);
                    setScreenshotFailed(prev => ({ ...prev, [currentStep]: true }));
                  }}
                  onLoad={() => {
                    console.log('Screenshot loaded successfully:', step.screenshot);
                  }}
                />
              </motion.div>
            ) : step.illustration && (
              <div
                className={cn(
                  "mx-4 sm:mx-6 md:mx-8 mb-3 sm:mb-4 rounded-xl sm:rounded-2xl overflow-hidden",
                  isDark ? "bg-black/20" : "bg-muted",
                )}
              >
                {step.illustration === "kanban" && (
                  <KanbanIllustration />
                )}
                {step.illustration === "sidebar" && (
                  <SidebarIllustration />
                )}
                {step.illustration === "ai" && (
                  <AIIllustration />
                )}
                {step.illustration === "task" && (
                  <TaskIllustration />
                )}
                {step.illustration === "features" && (
                  <FeaturesIllustration />
                )}
                {step.illustration === "calendar" && (
                  <CalendarIllustration />
                )}
                {step.illustration === "analytics" && (
                  <AnalyticsIllustration />
                )}
                {step.illustration === "inbox" && (
                  <InboxIllustration />
                )}
                {step.illustration === "today" && (
                  <TodayIllustration />
                )}
              </div>
            )}

            {/* Features Grid */}
            {step.features && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="px-4 sm:px-6 md:px-8 pb-4 sm:pb-5 md:pb-6"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {step.features.map((feature, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + i * 0.05 }}
                      className={cn(
                        "p-2.5 sm:p-3 rounded-lg sm:rounded-xl border",
                        isDark
                          ? "bg-white/5 border-white/10"
                          : "bg-muted/50 border-border",
                      )}
                    >
                      <div className="flex items-start gap-2 sm:gap-2.5">
                        <div className="text-lg sm:text-xl flex-shrink-0">
                          {feature.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs sm:text-sm font-medium mb-0.5 text-foreground">
                            {feature.title}
                          </div>
                          <div className="text-[10px] sm:text-xs leading-snug text-muted-foreground">
                            {feature.description}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Footer */}
            <div
              className="px-4 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6 border-t border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4"
            >
              {/* Progress Dots */}
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 flex-shrink-0 min-w-0">
                {dynamicTourSteps.map((_, i) => (
                  <motion.div
                    key={i}
                    className={cn(
                      "rounded-full transition-all flex-shrink-0",
                      i === currentStep ? "w-6 sm:w-8 h-1.5 sm:h-2" : "w-1.5 sm:w-2 h-1.5 sm:h-2",
                      i === currentStep
                        ? "bg-gradient-to-r from-primary via-primary to-accent shadow-lg shadow-primary/40"
                        : "bg-muted-foreground/20 dark:bg-muted-foreground/20",
                    )}
                    animate={{
                      width: i === currentStep ? undefined : undefined,
                    }}
                    transition={{
                      type: "spring",
                      damping: 20,
                      stiffness: 300,
                    }}
                  />
                ))}
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {!isFirst && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrev}
                    className="rounded-lg sm:rounded-xl text-xs sm:text-sm px-3 sm:px-4 h-8 sm:h-9 border-border hover:bg-muted"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
                    <span className="hidden sm:inline">Back</span>
                  </Button>
                )}

                {/* Show upgrade button on pricing step for free users */}
                {isPricingStep && subscription.tier === 'free' && onShowPricing ? (
                <Button
                  size="sm"
                    onClick={() => {
                      onShowPricing();
                      handleNext();
                    }}
                  className="rounded-lg sm:rounded-xl bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground border-0 shadow-lg shadow-primary/30 text-xs sm:text-sm px-3 sm:px-4 h-8 sm:h-9 flex-1 sm:flex-initial"
                  >
                    <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                    <span className="text-xs sm:text-sm">Upgrade to Pro</span>
                  </Button>
                ) : null}

                <Button
                  size="sm"
                  onClick={handleNext}
                  className={cn(
                    "rounded-lg sm:rounded-xl bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground border-0 shadow-lg shadow-primary/30 text-xs sm:text-sm px-3 sm:px-4 h-8 sm:h-9",
                    isPricingStep && subscription.tier === 'free' ? "flex-1 sm:flex-initial" : "flex-1 sm:flex-initial"
                  )}
                >
                  {isLast ? (
                    <span className="text-xs sm:text-sm">Get Started! 🎉</span>
                  ) : isPricingStep ? (
                    <>
                      <span className="hidden sm:inline">Skip</span>
                      <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-0.5 sm:ml-1" />
                    </>
                  ) : (
                    <>
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-0.5 sm:ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}