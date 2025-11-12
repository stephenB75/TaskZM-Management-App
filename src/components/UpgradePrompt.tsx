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
import {
  Sparkles,
  Zap,
  BarChart3,
  Clock,
  RotateCcw,
  Timer,
  Users,
  Calendar,
} from "lucide-react";

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
    | "calendarSync";
}

const featureConfig = {
  aiScheduler: {
    icon: Sparkles,
    title: "AI Scheduler",
    description:
      "Let AI intelligently schedule your tasks based on priority, category hours, and your preferences.",
    benefits: [
      "Smart task scheduling",
      "Respects your category hours",
      "Priority-based optimization",
      "Saves hours of planning time",
    ],
  },
  taskHours: {
    icon: Clock,
    title: "Task Hours",
    description:
      "Set custom working hours for different task categories (Work, Personal, Projects) with separate weekday and weekend schedules.",
    benefits: [
      "Weekday/weekend hour settings",
      "Category-specific hours",
      "Better work-life balance",
      "AI respects your boundaries",
    ],
  },
  analytics: {
    icon: BarChart3,
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
    icon: RotateCcw,
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
    icon: Timer,
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
    icon: Users,
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
    icon: Calendar,
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
};

export function UpgradePrompt({
  open,
  onOpenChange,
  onUpgrade,
  feature,
}: UpgradePromptProps) {
  const config = featureConfig[feature];
  const Icon = config.icon;

  const handleUpgrade = () => {
    onOpenChange(false);
    onUpgrade();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-[#D4C5F9]/20 flex items-center justify-center">
              <Icon className="w-5 h-5 text-[#D4C5F9]" />
            </div>
            <AlertDialogTitle>
              Unlock {config.title}
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
                      <Sparkles className="w-4 h-4 text-[#D4C5F9] flex-shrink-0 mt-0.5" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-[#D4C5F9]/10 border border-[#D4C5F9]/20 rounded-lg p-3">
                <p className="text-sm">
                  <span className="text-[#D4C5F9]">
                    ✨ Special Offer:
                  </span>{" "}
                  Get all Pro features for just{" "}
                  <strong>$3.99/month</strong>
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Maybe Later</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleUpgrade}
            className="bg-[#D4C5F9] hover:bg-[#D4C5F9]/90 text-gray-800"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Upgrade to Pro
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}