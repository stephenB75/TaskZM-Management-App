/**
 * Analytics Panel Constants
 * Centralized configuration for analytics panel styling and PDF export
 */

import { HEADER_BUTTON_SIZE, SETTINGS_PANEL_ICON_SIZE_MEDIUM, HEADER_GAP_SMALL } from "./layout-constants";

// PDF Export Configuration
export const ANALYTICS_PDF_CONFIG = {
  fileName: "TaskZM-Analytics-Report",
  pageSize: "a4" as const,
  orientation: "portrait" as const,
  unit: "mm" as const,
  margins: {
    top: 20,
    right: 15,
    bottom: 20,
    left: 15,
  },
  fontSizes: {
    title: 18,
    heading: 14,
    body: 10,
    small: 8,
  },
  colors: {
    primary: "#9B87E8",
    text: "#1F2937",
    textSecondary: "#6B7280",
    border: "#E5E7EB",
  },
  spacing: {
    afterTitle: 10,
    afterDate: 15,
    afterHeading: 8,
    betweenItems: 6,
    afterSection: 8,
  },
  pageBreak: {
    threshold: 20, // Minimum space from bottom before adding new page
  },
  limits: {
    maxProjects: 5,
  },
  labels: {
    title: "TaskZM Analytics Report",
    generated: "Generated:",
    summary: "Summary",
    timeTracking: "Time Tracking",
    statusDistribution: "Status Distribution",
    projectProgress: "Project Progress",
    totalTasks: "Total Tasks:",
    completed: "Completed:",
    inProgress: "In Progress:",
    completionRate: "Completion Rate:",
    totalTime: "Total Time:",
    thisWeek: "This Week:",
    avgPerTask: "Avg per Task:",
    hours: "h",
    minutes: "m",
    fallbackPercentage: "0.0",
  },
} as const;

// Button Configuration
export const ANALYTICS_PDF_BUTTON = {
  size: HEADER_BUTTON_SIZE,
  iconSize: SETTINGS_PANEL_ICON_SIZE_MEDIUM,
  gap: HEADER_GAP_SMALL,
} as const;

