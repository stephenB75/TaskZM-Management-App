# Hardcode Scan Report
Generated: $(date)

## Summary
This report identifies hardcoded values across the codebase that should be moved to constants files for better maintainability.

## Categories

### 1. Hardcoded Colors (Hex/RGB Values)

#### High Priority - Should be moved to constants:

**src/components/TodayAgendaView.tsx:**
- Line 342: `#E4E0EF`, `#DCD6EB` (gradient colors)
- Line 453: `#B8E6D5`, `#E6D5F0` (gradient colors)
- Line 478: `#B8E6D5` (background color), `green-800`, `green-900` (text colors)

**src/components/TaskDialog.tsx:**
- Line 1318: `#FAF9FC`, `#F9F7FD`, `#F3F0F9` (gradient colors - used in multiple places)
- Line 1456: `#3b82f6` (fallback folder color)
- Line 2693: `#FAF9FC`, `#F9F7FD`, `#F3F0F9` (gradient colors)

**src/components/RichTextEditor.tsx:**
- Line 210: `#fef08a` (yellow highlight color)
- Line 220: `rgba(0, 0, 0, 0.1)` (code background)
- Line 631: `#9ca3af` (color value)

**src/components/AnalyticsPanel.tsx:**
- Line 526: `#8884d8` (chart fill color)

**src/components/ui/alert-dialog.tsx:**
- Line 73: `#FAF9FC`, `#F9F7FD`, `#F3F0F9` (gradient colors)

**src/components/ui/context-menu.tsx:**
- Line 105: `#FAF9FC`, `#F9F7FD`, `#F3F0F9` (gradient colors)

**src/components/ui/popover.tsx:**
- Line 33: `#FAF9FC`, `#F9F7FD`, `#F3F0F9` (gradient colors)

**src/components/ui/dialog.tsx:**
- Similar gradient colors pattern

**src/components/ui/dropdown-menu.tsx:**
- Similar gradient colors pattern

**src/components/ui/select.tsx:**
- Similar gradient colors pattern

#### Recommendation:
Create a `src/lib/ui-colors.ts` file with:
```typescript
export const UI_GRADIENT_COLORS = {
  dialog: {
    from: '#FAF9FC',
    via: '#F9F7FD',
    to: '#F3F0F9',
  },
  timeline: {
    from: '#E4E0EF',
    to: '#DCD6EB',
  },
  // ... other gradients
} as const;
```

### 2. Hardcoded Dimensions/Sizes

#### Found in multiple components:

**Magic numbers for sizing:**
- `280px`, `400px` (card widths)
- `600px` (max heights)
- `1024px` (breakpoints)
- `24px`, `32px`, `48px`, `64px`, `80px`, `100px`, `120px`, `140px`, `160px` (various spacing)

**src/components/DraggableTaskCard.tsx:**
- Line 155: `240`, `360` (available width calculations)
- Line 247: `64` (minimum description height)
- Line 251: `6` (padding calculation)

**src/components/TodayAgendaView.tsx:**
- Line 200: `30` (default minutes)
- Line 222: `72`, `60` (base heights)
- Line 242: `140` (base height for long tasks)
- Line 272: `80` (min height for medium tasks)
- Line 251: `64` (minimum description height)

**src/components/TaskDialog.tsx:**
- Line 1717, 1769, 1954: `max-h-60` (max height for selects)
- Line 1717, 1769, 1954: `z-[200]` (z-index values)

#### Recommendation:
Many of these are already in `task-card-constants.ts`, but some magic numbers remain. Consider:
- Moving breakpoint values to `layout-constants.ts`
- Moving z-index values to a constants file
- Documenting remaining magic numbers with comments

### 3. Hardcoded Text Strings

#### Found in components:

**src/components/TodayAgendaView.tsx:**
- Line 387: "No tasks today"
- Line 397: "Add task"

**src/components/TaskDialog.tsx:**
- Multiple hardcoded labels and messages throughout

**src/components/AnalyticsPanel.tsx:**
- Chart labels and tooltips

#### Recommendation:
- Most UI text should be in constants files
- Some components already use constants (AuthScreen uses `auth-constants.ts`)
- Consider creating component-specific text constants

### 4. Hardcoded Configuration Values

#### Found in various files:

**src/lib/daily-hours-utils.ts:**
- Line 4: `MAX_HOURS_PER_DAY = 5` (already a constant, good!)

**src/lib/time-conflict.ts:**
- Line 84: `maxHour = 23`, `maxMinute = 0` (could be constants)

**src/components/DraggableTaskCard.tsx:**
- Line 152: Badge width estimates (`60px` average)
- Line 237: Line height (`16px` for 12px font)
- Line 249: Characters per line estimate (`50`)

**src/components/TodayAgendaView.tsx:**
- Line 251: Characters per line estimate (`50`)
- Line 252: Line height (`16px`)

**src/hooks/useAIScheduler.ts:**
- Multiple magic numbers for time calculations

#### Recommendation:
Create a `src/lib/task-calculation-constants.ts`:
```typescript
export const TASK_CALCULATION_CONSTANTS = {
  BADGE_AVERAGE_WIDTH: 60,
  LINE_HEIGHT_12PX: 16,
  CHARACTERS_PER_LINE: 50,
  MAX_HOUR: 23,
  MAX_MINUTE: 0,
  // ... other calculation constants
} as const;
```

### 5. Hardcoded URLs/Endpoints

#### Found:

**src/lib/revenuecat.ts:**
- RevenueCat API endpoints (may be intentional)

**src/lib/api.ts:**
- Supabase function URLs (may be intentional)

#### Recommendation:
- Keep API endpoints in environment variables or config files
- Document which URLs are intentional vs should be configurable

### 6. Console Statements

#### Found:
- 512 console.log/warn/error/debug statements across 34 files

#### Recommendation:
- Most should use the logger utility (`src/lib/logger.ts`)
- Remove debug console statements in production code
- Keep only critical error logging

### 7. Hardcoded Time/Duration Values

#### Found:

**src/lib/daily-hours-utils.ts:**
- `MAX_HOURS_PER_DAY = 5` (already constant ✓)

**src/components/DraggableTaskCard.tsx:**
- `15` (minimum task duration in minutes)
- `45`, `60` (threshold values - already in constants ✓)

**src/contexts/DragDropContext.tsx:**
- `8` (activation distance for drag)
- `9` (default hour)
- `8`, `23` (hour limits)

#### Recommendation:
Move remaining time values to `layout-constants.ts` or `task-calculation-constants.ts`

### 8. Hardcoded Spacing/Padding Values

#### Found:
Many hardcoded Tailwind classes with specific values:
- `px-1.5`, `py-1`, `mt-0.5`, `mb-1.5`, `gap-1`, `space-y-1.5`, etc.

#### Recommendation:
- Most spacing is already in `TASK_CARD_SPACING` constants ✓
- Some components still have inline spacing classes
- Consider if these should be standardized

## Priority Recommendations

### High Priority (Should be fixed):
1. **Gradient colors** - Create `ui-colors.ts` for all gradient definitions
2. **Magic numbers in calculations** - Create `task-calculation-constants.ts`
3. **Console statements** - Replace with logger utility
4. **Hardcoded text strings** - Move to component-specific constants

### Medium Priority:
1. **Z-index values** - Centralize in a constants file
   - Found 13 instances of `z-[200]` in TaskDialog.tsx
   - Found `z-[3]`, `z-[1]` in DraggableTodayAgendaTask.tsx
   - Recommendation: Create `Z_INDEX` constants in `layout-constants.ts`
2. **Breakpoint values** - Ensure all use `layout-constants.ts`
   - Most breakpoints use Tailwind's responsive classes (good)
   - Some hardcoded `1024px` checks found
3. **Time/duration magic numbers** - Move to constants
   - `15`, `30`, `45`, `60` minutes thresholds (some already in constants)
   - `8`, `9`, `23` hour values in drag-drop logic

### Low Priority (May be acceptable):
1. **Tailwind utility classes** - These are often intentional and part of the design system
2. **Component-specific spacing** - May be intentional for specific layouts

## Files Already Using Constants (Good Examples):
- ✅ `src/components/DraggableTaskCard.tsx` - Uses `task-card-constants.ts`
- ✅ `src/components/SettingsPanel.tsx` - Uses `layout-constants.ts`
- ✅ `src/components/AuthScreen.tsx` - Uses `auth-constants.ts`
- ✅ `src/lib/daily-hours-utils.ts` - Uses `MAX_HOURS_PER_DAY` constant

## Detailed Findings

### Z-Index Values (13 instances found)
**src/components/TaskDialog.tsx:**
- Lines 1375, 1395, 1447, 1717, 1769, 1805, 1954, 2016, 2158, 2292, 2379, 2498, 2574: `z-[200]` for SelectContent

**src/components/DraggableTodayAgendaTask.tsx:**
- Line 159: `z-[3]` for badge
- Line 209: `z-[1]` for timeline line

**Recommendation:**
```typescript
// Add to layout-constants.ts
export const Z_INDEX = {
  SELECT_CONTENT: 200,
  BADGE: 3,
  TIMELINE_LINE: 1,
  DROPDOWN: 9999, // Already used in Team/Folder panels
  // ... other z-index values
} as const;
```

### Magic Numbers in Calculations

**src/components/DraggableTaskCard.tsx:**
- Line 155: `240`, `360` (available width for badge wrapping)
- Line 247: `64` (minimum description height)
- Line 251: `6` (padding calculation)
- Line 152: `60` (average badge width estimate)
- Line 237: `16` (line height for 12px font)
- Line 249: `50` (characters per line estimate)

**src/components/TodayAgendaView.tsx:**
- Line 200: `30` (default minutes)
- Line 222: `72`, `60` (base heights)
- Line 242: `140` (base height for long tasks)
- Line 272: `80` (min height for medium tasks)
- Line 251: `64` (minimum description height)
- Line 252: `16` (line height)
- Line 211: `60` (average badge width)
- Line 212: `240`, `360` (available width)

**src/contexts/DragDropContext.tsx:**
- Line 53: `8` (activation distance in pixels)
- Line 101: `9` (default hour)
- Line 141: `8`, `23` (hour limits)

**Recommendation:**
Create `src/lib/task-calculation-constants.ts`:
```typescript
export const TASK_CALCULATION_CONSTANTS = {
  // Badge calculations
  BADGE_AVERAGE_WIDTH: 60,
  AVAILABLE_WIDTH_MOBILE: 240,
  AVAILABLE_WIDTH_DESKTOP: 360,
  
  // Description calculations
  LINE_HEIGHT_12PX: 16,
  CHARACTERS_PER_LINE: 50,
  MIN_DESCRIPTION_HEIGHT: 64,
  DESCRIPTION_PADDING: 6,
  
  // Height calculations
  BASE_HEIGHT_SHORT_MOBILE: 72,
  BASE_HEIGHT_SHORT_DESKTOP: 60,
  BASE_HEIGHT_LONG: 140,
  MIN_HEIGHT_MEDIUM: 80,
  DEFAULT_DURATION_MINUTES: 30,
  
  // Drag and drop
  DRAG_ACTIVATION_DISTANCE: 8,
  DEFAULT_HOUR: 9,
  HOUR_MIN: 8,
  HOUR_MAX: 23,
} as const;
```

## Next Steps:
1. Create `src/lib/ui-colors.ts` for gradient colors
2. Create `src/lib/task-calculation-constants.ts` for calculation magic numbers
3. Add Z-index constants to `layout-constants.ts`
4. Replace console statements with logger utility
5. Review and consolidate remaining hardcoded values
6. Document intentional hardcoded values (e.g., Tailwind utility classes)

