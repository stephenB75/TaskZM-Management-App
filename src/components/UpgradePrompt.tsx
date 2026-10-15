import React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "./ui/alert-dialog";
// Icons migrated to Icon component
import { Icon } from "./Icon";
import { SUBSCRIPTION_UI_TEXT, DEFAULT_MONTHLY_PRICE } from "../lib/subscription-constants";
import { UI_UPGRADE_PROMPT_COLORS } from "../lib/ui-colors";
import { ICON_SIZE_MD } from "../lib/layout-constants";

interface UpgradePromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpgrade: () => void;
  feature:
    | "aiScheduler"
    | "taskHours"
    | "analytics"
    | "taskRollover"
    | "pomodoroTimer"
    | "teamFeatures"
    | "calendarSync"
    | "recurringTasks"
    | "taskDependencies"
    | "taskTemplates";
}

const featureConfig = {
  aiScheduler: {
    iconName: "sparkles",
    title: "Auto Scheduler",
    description:
      "Automatically schedule your tasks based on priority, category hours, and your preferences.",
    benefits: [
      "Smart task scheduling",
      "Respects your category hours",
      "Priority-based optimization",
      "Saves hours of planning time",
    ],
  },
  taskHours: {
    iconName: "clock",
    title: "Task Hours",
    description:
      "Set custom working hours for different task categories (Work, Personal, Projects) with separate weekday and weekend schedules.",
    benefits: [
      "Weekday/weekend hour settings",
      "Category-specific hours",
      "Better work-life balance",
      "The scheduler respects your boundaries",
    ],
  },
  analytics: {
    iconName: "bar-chart",
    title: "Analytics Dashboard",
    description:
      "Track your productivity with detailed insights, completion rates, and visual trends over time.",
    benefits: [
      "Task completion statistics",
      "Productivity trends",
      "Priority breakdowns",
      "Time tracking insights",
    ],
  },
  taskRollover: {
    iconName: "rotate-ccw",
    title: "Task Rollover",
    description:
      "Automatically roll over incomplete tasks to the next day, ensuring nothing falls through the cracks.",
    benefits: [
      "Automatic rollover",
      "Never miss a task",
      "Smart rescheduling",
      "Stress-free planning",
    ],
  },
  pomodoroTimer: {
    iconName: "timer",
    title: "Pomodoro Timer",
    description:
      "Focus better with the built-in Pomodoro timer featuring 25/5/15 minute intervals and automatic session tracking.",
    benefits: [
      "25-minute focus sessions",
      "5-minute short breaks",
      "15-minute long breaks",
      "Automatic time tracking",
    ],
  },
  teamFeatures: {
    iconName: "users",
    title: "Team Collaboration",
    description:
      "Collaborate with your team by managing members, assigning tasks, and tracking team progress.",
    benefits: [
      "Manage team members",
      "Role-based access control",
      "Assign tasks to team",
      "Team notifications",
    ],
  },
  calendarSync: {
    iconName: "calendar",
    title: "Calendar Sync",
    description:
      "Sync your tasks with Google, Outlook (Coming Soon), and Apple Calendar for a unified view of your schedule.",
    benefits: [
      "Google Calendar sync",
      "Outlook Calendar sync (Coming Soon)",
      "Apple Calendar sync",
      "Automatic bidirectional sync",
    ],
  },
  recurringTasks: {
    iconName: "rotate-ccw",
    title: "Recurring Tasks",
    description:
      "Create tasks that repeat automatically on a schedule - daily, weekly, or monthly. Perfect for routines, meetings, and regular maintenance.",
    benefits: [
      "Daily, weekly, monthly recurrence",
      "Automatic task creation",
      "Set end dates or repeat forever",
      "Perfect for routines and habits",
    ],
  },
  taskDependencies: {
    iconName: "link-2",
    title: "Task Dependencies",
    description:
      "Link related tasks together so you can see what needs to be done first. Manage complex projects with clear task relationships.",
    benefits: [
      "Link related tasks",
      "Visualize task relationships",
      "Prevent starting tasks too early",
      "Better project management",
    ],
  },
  taskTemplates: {
    iconName: "copy",
    title: "Task Templates",
    description:
      "Save task patterns and reuse them instantly. Create templates for common workflows, meetings, or project setups.",
    benefits: [
      "Save task patterns",
      "Quick task creation",
      "Consistent workflows",
      "Time-saving templates",
    ],
  },
};

export function UpgradePrompt({
  open,
  onOpenChange,
  onUpgrade,
  feature,
}: UpgradePromptProps) {
  const config = featureConfig[feature];

  const handleUpgrade = () => {
    onOpenChange(false);
    onUpgrade();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-full ${UI_UPGRADE_PROMPT_COLORS.accentBgOpacity20} flex items-center justify-center`}>
              <Icon name={config.iconName} size={20} weight="duotone" className={UI_UPGRADE_PROMPT_COLORS.accentTextClass} />
            </div>
            <AlertDialogTitle>
              {SUBSCRIPTION_UI_TEXT.upgradePrompt.unlock(config.title)}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="text-left space-y-4 text-sm text-muted-foreground">
              <p>{config.description}</p>

              <div className="space-y-2">
                <p className="text-sm">
                  With TaskZM Pro, you get:
                </p>
                <ul className="space-y-1.5">
                  {config.benefits.map((benefit, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm"
                    >
                      <Icon name="sparkles" size={16} weight="duotone" className={`${UI_UPGRADE_PROMPT_COLORS.accentTextClass} flex-shrink-0 mt-0.5`} />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={`${UI_UPGRADE_PROMPT_COLORS.accentBgOpacity10} ${UI_UPGRADE_PROMPT_COLORS.accentBorderOpacity20} rounded-lg p-3`}>
                <p className="text-sm font-medium">
                  <span className={UI_UPGRADE_PROMPT_COLORS.accentTextClass}>
                    {SUBSCRIPTION_UI_TEXT.upgradePrompt.specialOffer}
                  </span>{" "}
                  {SUBSCRIPTION_UI_TEXT.upgradePrompt.getProFeatures(DEFAULT_MONTHLY_PRICE).split(DEFAULT_MONTHLY_PRICE).map((part, i, arr) => 
                    i === arr.length - 1 ? part : (
                      <React.Fragment key={i}>
                        {part}
                        <strong className="text-foreground">{DEFAULT_MONTHLY_PRICE}</strong>
                      </React.Fragment>
                    )
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Start your free trial or cancel anytime
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{SUBSCRIPTION_UI_TEXT.upgradePrompt.maybeLater}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleUpgrade}
            className={`${UI_UPGRADE_PROMPT_COLORS.accentClass} ${UI_UPGRADE_PROMPT_COLORS.accentHoverClass} text-gray-800 dark:text-white`}
          >
            <Icon name="sparkles" size={ICON_SIZE_MD} weight="duotone" className="mr-2" />
            {SUBSCRIPTION_UI_TEXT.upgradePrompt.upgradeToPro}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}