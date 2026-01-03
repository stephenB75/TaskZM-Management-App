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
} as const;

// Button Configuration
export const ANALYTICS_PDF_BUTTON = {
  size: HEADER_BUTTON_SIZE,
  iconSize: SETTINGS_PANEL_ICON_SIZE_MEDIUM,
  gap: HEADER_GAP_SMALL,
} as const;

