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
    text: "#111827", // Darker for better contrast
    textSecondary: "#4B5563", // Darker for better readability
    border: "#9CA3AF", // Medium gray - more visible than light gray
    boxBackground: "#F9FAFB", // Light background for metric boxes
    boxBorder: "#9B87E8", // Primary color for box borders - more visible
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
  chart: {
    width: 170, // Chart width in mm (fits A4 with margins)
    height: 100, // Increased height for better visibility
    spacing: 12, // Spacing between charts in mm
    quality: 3, // Increased quality multiplier for html2canvas (prevents warping)
    backgroundColor: {
      dark: '#1a1a1a', // Dark theme background color for chart capture
      light: '#ffffff', // Light theme background color for chart capture
    },
    imageFormat: 'image/png', // Image format for chart capture
    pdfImageFormat: 'PNG', // Image format for PDF (jsPDF format)
    waitForRender: 1000, // Wait time in ms for charts to render before capture (increased for better SVG rendering)
    fallbackWaitForRender: 500, // Fallback wait time in ms if waitForRender is not available
    reflowDelay: 200, // Delay in ms for forcing reflow to ensure charts are rendered
  },
  progress: {
    initial: 10, // Initial progress percentage when PDF generation starts
    afterTitle: 15, // Progress percentage after title is added
    chartStart: 20, // Starting progress percentage for chart capture phase
    chartEnd: 80, // Ending progress percentage for chart capture phase
    beforeSave: 90, // Progress percentage before saving PDF
    complete: 100, // Progress percentage when PDF generation is complete
    resetDelay: 500, // Delay in ms before resetting progress state after completion
  },
  pdfSpacing: {
    textOffset: 3, // Horizontal offset for text in PDF (mm)
    verticalOffset: 4, // Vertical offset for text in PDF (mm)
    metricBoxHeight: 16, // Height of metric boxes in PDF (mm)
    metricBoxLabelY: 5.5, // Y position for metric box label text (mm from top of box)
    metricBoxValueY: 12, // Y position for metric box value text (mm from top of box)
    metricBoxRowSpacing: 18, // Spacing between metric box rows in PDF (mm)
    chartBoxPadding: 18, // Additional padding for chart boxes (chart height + title + padding) in PDF (mm)
  },
  pdfStyling: {
    borderWidth: 1, // Border width for boxes and charts in PDF (mm)
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
    // Chart titles
    chartTimeTracked: "Time Tracked (7 Days)",
    chartTasksCreatedCompleted: "Tasks Created vs Completed",
    chartCompletionByTimeOfDay: "Completion by Time of Day",
    chartTopTaskTags: "Top Task Tags",
  },
} as const;

// Button Configuration
export const ANALYTICS_PDF_BUTTON = {
  size: HEADER_BUTTON_SIZE,
  iconSize: SETTINGS_PANEL_ICON_SIZE_MEDIUM,
  gap: HEADER_GAP_SMALL,
} as const;

