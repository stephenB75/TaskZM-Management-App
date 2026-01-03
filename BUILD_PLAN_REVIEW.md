# Build Plan Review - Issues Found

## Overview
Review of the UI Enhancements build plan implementation revealed several instructions that were not fully followed. This document lists all issues that need to be addressed.

---

## 1. Task Card Dropdown Tab - Colors Not Using Theme Constants ❌

**Plan Requirement:**
- Use `COLOR_PRIMARY`, `COLOR_BACKGROUND_LIGHT_COLOR`, `COLOR_BACKGROUND_DARK_COLOR` from `color-theme.ts`
- Use spacing from `TASK_CARD_SPACING` constants

**Current Implementation:**
- Uses hardcoded colors: `"border-gray-700"`, `"bg-gray-900/95"`, `"bg-white"`, `"text-gray-100"`, `"text-gray-800"`, `"hover:bg-gray-800/50"`, `"hover:bg-gray-100/50"`
- `TASK_CARD_DROPDOWN_COLORS` constant exists but has hardcoded values instead of referencing theme constants
- Dropdown implementation doesn't use `TASK_CARD_DROPDOWN_COLORS` at all

**Files to Fix:**
- `src/lib/task-card-constants.ts` - Update `TASK_CARD_DROPDOWN_COLORS` to use theme constants
- `src/components/DraggableTaskCard.tsx` - Use `TASK_CARD_DROPDOWN_COLORS` and `TASK_CARD_SPACING` constants

---

## 2. AI Breakdown in Task Card - Hardcoded Colors ❌

**Plan Requirement:**
- Use domain colors from `ActionPlanPanel.tsx` (which should use constants)
- Use spacing from `TASK_CARD_SPACING` constants

**Current Implementation:**
- Uses hardcoded purple colors: `"bg-purple-950/20"`, `"border-purple-800/30"`, `"bg-purple-50/50"`, `"border-purple-200"`, `"text-purple-300"`, `"text-purple-700"`, `"text-purple-400"`, `"text-purple-600"`, `"text-purple-200"`, `"text-purple-800"`
- Should use domain-specific colors based on detected domain (business, home, personal, world, mixed)
- `ActionPlanPanel.tsx` has `DOMAIN_COLORS` but they're also hardcoded Tailwind classes, not constants

**Files to Fix:**
- `src/components/DraggableTaskCard.tsx` - Use domain colors from `breakdown.domain` instead of hardcoded purple
- `src/components/ActionPlanPanel.tsx` - Consider extracting `DOMAIN_COLORS` to constants file

---

## 3. MAX_HOURS_PER_DAY Still Used in Multiple Files ❌

**Plan Requirement:**
- Update all 21 references to `MAX_HOURS_PER_DAY` to use `AIContext.maxHoursPerDay` instead of constant
- Keep `MAX_HOURS_PER_DAY` constant as default fallback only

**Current Implementation:**
- `MAX_HOURS_PER_DAY` still used in:
  - `src/components/TaskDialog.tsx` (4 references - lines 1473, 1474, 1489)
  - `src/hooks/useAIScheduler.ts` (likely 4 references)
  - `src/contexts/DragDropContext.tsx` (likely 2 references)
  - `src/lib/daily-hours-utils.ts` (likely 3 references)
  - `src/lib/ai-config.ts` (1 reference - default fallback, this is OK)

**Files to Fix:**
- `src/components/TaskDialog.tsx` - Use `aiSettings.maxHoursPerDay` from `useAI()` hook
- `src/hooks/useAIScheduler.ts` - Use context value
- `src/contexts/DragDropContext.tsx` - Use context value
- `src/lib/daily-hours-utils.ts` - Accept `maxHoursPerDay` as parameter or use helper function

---

## 4. Settings AI Toggles - Not Using Constants ❌

**Plan Requirement:**
- Use `TOGGLE_SWITCH_DIMENSIONS` from `layout-constants.ts`
- Use `SETTINGS_PANEL_TEXT_SIZE_MEDIUM` from `layout-constants.ts`
- Use `SETTINGS_PANEL_SPACING_MEDIUM` from `layout-constants.ts`

**Current Implementation:**
- Toggle switches use default styling without referencing constants
- Text sizes use hardcoded `"text-sm"` and `"text-xs"` classes
- Spacing uses hardcoded `"gap-3"` and `"py-1"` classes

**Files to Fix:**
- `src/components/SettingsPanel.tsx` - Apply constants to toggle switches, text sizes, and spacing

---

## 5. AI Function Explanation Text Missing ❌

**Plan Requirement:**
- Add `AI_FUNCTION_EXPLANATION` summary text to Settings Panel AI section
- Constant should be defined in `src/lib/ai-config.ts`

**Current Implementation:**
- No explanation text displayed in Settings Panel AI section
- `AI_FUNCTION_EXPLANATION` constant exists in `ai-config.ts` but not used

**Files to Fix:**
- `src/components/SettingsPanel.tsx` - Display `AI_FUNCTION_EXPLANATION` text in AI section

---

## 6. Inbox Header - Verify Constants Usage ✅ (Mostly Complete)

**Plan Requirement:**
- Use `HEADER_GAP_SMALL` or `PANEL_GAP_SMALL` for button spacing
- Make all buttons inline

**Current Implementation:**
- ✅ Uses `HEADER_GAP_SMALL` for button spacing (line 568)
- ✅ Buttons are inline
- ✅ "Unschedule" button implemented

**Status:** Complete

---

## 7. Today Agenda Date Display ✅ (Complete)

**Plan Requirement:**
- Use `HEADER_DESCRIPTION_SIZE` from `layout-constants.ts`
- Use `HEADER_GAP_MEDIUM` from `layout-constants.ts`

**Current Implementation:**
- ✅ Uses `HEADER_DESCRIPTION_SIZE` (lines 603, 610)
- ✅ Uses `HEADER_DESCRIPTION_MARGIN_TOP` (line 611)

**Status:** Complete

---

## 8. AI Description Generator ✅ (Complete)

**Plan Requirement:**
- Use `SETTINGS_PANEL_ICON_SIZE_MEDIUM` from `layout-constants.ts`
- Use `SETTINGS_PANEL_GAP_SMALL` from `layout-constants.ts`

**Current Implementation:**
- ✅ Uses `SETTINGS_PANEL_ICON_SIZE_MEDIUM` (line 1935)
- ✅ Uses `SETTINGS_PANEL_GAP_SMALL` (line 1931)

**Status:** Complete

---

## 9. Analytics PDF Download ✅ (Complete)

**Plan Requirement:**
- Use `HEADER_BUTTON_SIZE` from `layout-constants.ts`
- Use `SETTINGS_PANEL_ICON_SIZE_MEDIUM` from `layout-constants.ts`
- Use `HEADER_GAP_SMALL` from `layout-constants.ts`

**Current Implementation:**
- ✅ Uses `ANALYTICS_PDF_CONFIG` constants from `analytics-constants.ts`

**Status:** Complete

---

## Summary

### ✅ Completed Correctly:
1. Task Card Standard Heights
2. Logo Change to Black
3. Analytics PDF Download
4. AI Description Generator Button
5. Today Agenda Date Display
6. Inbox Header Reorganization

### ❌ Needs Fixing:
1. **Task Card Dropdown Tab** - Not using theme color constants
2. **AI Breakdown in Task Card** - Using hardcoded purple instead of domain colors
3. **MAX_HOURS_PER_DAY** - Still used in 8+ locations instead of context value
4. **Settings AI Toggles** - Not using toggle/text size constants
5. **AI Function Explanation** - Text not displayed in Settings Panel

---

## Priority Order for Fixes

1. **HIGH**: Fix MAX_HOURS_PER_DAY references (affects functionality)
2. **MEDIUM**: Fix dropdown and AI breakdown colors (affects consistency)
3. **LOW**: Fix Settings toggles constants and add explanation text (affects polish)

