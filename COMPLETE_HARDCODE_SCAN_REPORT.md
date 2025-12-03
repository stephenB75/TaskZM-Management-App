# Complete Hardcode Scan Report
Generated: 2024

## Summary
This comprehensive scan identifies ALL remaining hardcoded values across the codebase that should be moved to constants files for better maintainability, consistency, and theming support.

## Categories

### 1. Hardcoded Text Sizes (HIGH PRIORITY)

#### SettingsPanel.tsx (40+ instances)
- **Line 413**: `text-[11px]`
- **Line 896**: `text-[10px]`
- **Lines 1033, 1045, 1060, 1076, 1092, 1111, 1124, 1147, 1161, 1175, 1203, 1227, 1239, 1252, 1264, 1285**: `text-[10px] md:text-xs` (17 instances)
- **Lines 2010, 2014, 2016, 2020**: `text-[10px]` (4 instances)
- **Lines 2039, 2117, 2195, 2273**: `text-[10px]` in badges (4 instances)
- **Lines 2085, 2163, 2241**: `text-[10px]` in progress labels (3 instances)
- **Lines 2496, 2508, 2528**: `text-[10px]` in version info (3 instances)

#### TodayAgendaView.tsx
- **Line 600**: `text-[9px]`
- **Line 605**: `text-[9px]`

#### NotificationsPanel.tsx
- **Line 510**: `text-[10px]`

#### InboxView.tsx
- **Line 596**: `text-[10px]`
- **Line 637**: `text-[8px]`

#### TaskCard Constants (Already in constants but referenced)
- `TASK_CARD_BADGE_SIZES` uses `text-[10px]` and `text-[11px]` - these are in constants but could use `COMMON_TEXT_SIZES`

**Recommendation**: Use `COMMON_TEXT_SIZES` from `text-size-constants.ts` or add more specific constants.

### 2. Hardcoded Dimensions & Spacing (MEDIUM PRIORITY)

#### TodayAgendaView.tsx
- **Line 406**: `min-h-[400px]` (drop zone minimum height)
- **Line 410**: `zIndex: 100` (should use `Z_INDEX.DROP_ZONE`)
- **Line 474**: `min-h-[300px]` (empty state minimum height)
- **Line 67**: `60000` (1 minute interval - should use `TIMING_CONSTANTS.intervals.timeUpdate`)
- **Line 175**: `100` (setTimeout delay - should use `TIMING_CONSTANTS.delays.scroll`)

#### SettingsPanel.tsx
- **Line 2433**: `w-[120px]` (logo width)

#### NotificationsPanel.tsx
- **Line 445**: `w-[180px]` (select width)

#### TaskDialog.tsx
- **Line 1449**: `max-w-3xl lg:max-w-4xl max-h-[90vh]` (dialog dimensions)
- **Lines 1807, 1849, 1902**: `min-w-[70px] sm:min-w-[90px]` (minimum widths)
- **Line 2872**: `min-w-[140px]` (button min width)

#### DraggableTodayAgendaTask.tsx
- **Line 435**: `max-w-[386px]` (dragging max width - already in `TASK_CARD_LAYOUT_METRICS.dragging`)
- **Line 678**: `max-w-[calc(100%-60px)]` and `max-w-[calc(100%-80px)]` (already in constants)

#### PricingDialog.tsx
- **Line 558**: `max-w-[95vw] sm:max-w-[90vw] md:max-w-[850px] max-h-[95vh]`

#### AIRecommendationPanel.tsx
- **Line 605**: `max-w-2xl max-h-[80vh]`
- **Line 619**: `max-h-[50vh]`
- **Line 754**: `h-[calc(100vh-8rem)]`

#### AppTour.tsx
- **Line 846**: `max-h-[400px] sm:max-h-[500px] md:max-h-[600px]`

### 3. Hardcoded Timeout/Delay Values (MEDIUM PRIORITY)

#### Already in TIMING_CONSTANTS but not used:
- **TodayAgendaView.tsx Line 67**: `60000` → should use `TIMING_CONSTANTS.intervals.timeUpdate`
- **TodayAgendaView.tsx Line 175**: `100` → should use `TIMING_CONSTANTS.delays.scroll`
- **TodayAgendaView.tsx Line 396**: `100` → should use `TIMING_CONSTANTS.delays.scroll`

#### Not yet in constants:
- **SettingsPanel.tsx Line 1134**: `setTimeout` with no delay specified (needs investigation)
- **TodayAgendaView.tsx Line 393**: `setTimeout` with no delay specified (needs investigation)
- **NotificationsPanel.tsx Lines 355, 371, 372**: `setTimeout` with no delay specified (needs investigation)
- **NotificationContext.tsx Lines 353, 428**: `setTimeout` with delays (need to check values)
- **NotificationContext.tsx Line 530**: `setInterval` with `settings.checkInterval * 60 * 1000`
- **PricingDialog.tsx Lines 416, 433, 492, 509**: `5000` and `50000` → should use `TIMING_CONSTANTS.timeouts.configuration` and `TIMING_CONSTANTS.timeouts.purchase`
- **useAIScheduler.ts Lines 1537, 1604, 1674**: `100` → should use `TIMING_CONSTANTS.delays.aiScheduler`
- **main.tsx Lines 258, 314-318, 326, 340, 351, 404, 409**: Multiple `setTimeout` calls with various delays → should use `TIMING_CONSTANTS.delays.splashScreen`
- **CalendarContext.tsx Lines 210, 232, 238**: `setTimeout` and `setInterval` calls
- **TaskContext.tsx Line 1082**: `THROTTLE_MS = 1000` → should be in constants
- **TaskContext.tsx Line 1121**: `60000` (1 minute) → should use `TIMING_CONSTANTS.intervals.timeUpdate`
- **PomodoroContext.tsx Line 512**: `setInterval` with 1 second (1000ms) → should be in constants

### 4. Hardcoded Z-Index Values (LOW PRIORITY)

#### Already in Z_INDEX constants but not used:
- **TodayAgendaView.tsx Line 410**: `zIndex: 100` → should use `Z_INDEX.DROP_ZONE`
- **TodayAgendaView.tsx Line 440**: `z-50` (time indicator) → should use `Z_INDEX.TIME_INDICATOR`

#### Not yet in constants:
- **DragDropContext.tsx Line 999**: `zIndex: 99999` (very high z-index)
- **navigation-menu.tsx Line 148**: `z-[1]` (low z-index)

### 5. Hardcoded Color Values (LOW PRIORITY - Some intentional)

#### SettingsPanel.tsx
- **Lines 1322-1325**: Tag colors still hardcoded:
  - `'bg-[#B4E4CE]/30'`
  - `'bg-[#E6D5F0]/30'`
  - `'bg-[#FDD5B4]/30'`
  - `'bg-[#C9E4F7]/30'`
- **Line 840**: `dark:from-[#D4C5F9]/5 dark:to-[#C9E4F7]/5` (dark mode variants)
- **Lines 2338, 2416**: Gradient colors in award functions:
  - `'#8A7A9A'`, `'#6A8AAA'`, `'#5A8A7A'`

#### SettingsPanel.tsx - Award Badge Colors
- **Line 2039**: `bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300`
- **Line 2117**: `bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300`
- **Line 2195**: `bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300`
- **Line 2273**: `bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300`
- **Lines 2010, 2014, 2018**: Gradient backgrounds for award stats:
  - `from-blue-50 to-cyan-50`
  - `from-amber-50 to-orange-50`
  - `from-purple-50 to-pink-50`

#### TodayAgendaView.tsx
- **Line 625**: `[&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800` (rich text mark colors)

#### InboxView.tsx
- **Line 637**: `bg-gradient-to-br from-purple-100 to-pink-100 text-purple-700` (avatar gradient)

### 6. Hardcoded Magic Numbers in Calculations (LOW PRIORITY)

#### SettingsPanel.tsx
- **Lines 2511-2512**: Time calculations:
  - `Math.floor(diffMs / 60000)` (minutes)
  - `Math.floor(diffMs / 3600000)` (hours)
  - Should use constants: `60000` = 1 minute, `3600000` = 1 hour

#### NotificationsPanel.tsx
- **Line 155**: `settings.reminderTime * 60 * 1000` (convert minutes to ms)
- **Line 181**: `(1000 * 60)` (convert seconds to minutes)

#### TodayAgendaView.tsx
- **Line 376**: Comment mentions `200px` - should reference constant

### 7. Hardcoded URLs (REVIEW NEEDED - Some intentional)

Most URLs are environment-specific and intentional. However, consider:
- Supabase function URLs (should use environment variables)
- External API endpoints (should be in `api-endpoints.ts`)
- OAuth URLs (should be in `auth-constants.ts` or `api-endpoints.ts`)

### 8. Hardcoded Animation/Transition Values (LOW PRIORITY)

Multiple components use:
- `duration-200` (200ms) → should use `TIMING_CONSTANTS.animations.default`
- `duration-300` (300ms) → should use `TIMING_CONSTANTS.animations.medium`
- `transition-all duration-200`
- `transition-colors duration-300`

**Note**: These are Tailwind classes and may be acceptable as-is, but could be standardized.

### 9. Hardcoded Shadow Values (LOW PRIORITY)

#### task-card-constants.ts
- **Lines 346, 351**: Shadow values:
  - `shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.12)]`
  - These are already in constants, which is good.

## Priority Recommendations

### High Priority (Should be fixed):
1. **Text Sizes in SettingsPanel** - 40+ instances of `text-[10px]` and `text-[11px]`
2. **Timeout/Delay Values** - Many `setTimeout`/`setInterval` calls not using `TIMING_CONSTANTS`
3. **Z-Index Values** - Should use `Z_INDEX` constants

### Medium Priority (Should be considered):
1. **Hardcoded Dimensions** - Move to appropriate constants files
2. **Tag Colors in SettingsPanel** - Still hardcoded (lines 1322-1325)
3. **Award Badge Colors** - Multiple hardcoded color classes

### Low Priority (Nice to have):
1. **Animation Durations** - Standardize if needed
2. **Magic Numbers in Calculations** - Add time conversion constants
3. **Shadow Values** - Already in constants (good!)

## Files to Update

### 1. Update `src/lib/timing-constants.ts`
Add missing constants:
```typescript
export const TIMING_CONSTANTS = {
  // ... existing ...
  intervals: {
    // ... existing ...
    pomodoro: 1000, // 1 second for pomodoro timer
    activityCheck: 60000, // 1 minute for activity checking
  },
  delays: {
    // ... existing ...
    throttle: 1000, // Throttle delay for activity tracking
  },
  timeConversions: {
    minutesToMs: 60000,
    hoursToMs: 3600000,
    secondsToMs: 1000,
  },
} as const;
```

### 2. Update `src/lib/text-size-constants.ts`
Add more specific constants for SettingsPanel:
```typescript
export const SETTINGS_PANEL_TEXT_SIZES = {
  helper: 'text-[10px] md:text-xs',
  badge: 'text-[10px]',
  label: 'text-[10px]',
  small: 'text-[11px]',
} as const;
```

### 3. Update `src/lib/ui-colors.ts`
Add award badge colors and tag colors:
```typescript
export const UI_AWARD_BADGE_COLORS = {
  blue: {
    light: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
  },
  orange: { /* ... */ },
  purple: { /* ... */ },
  pink: { /* ... */ },
} as const;

export const UI_TAG_COLORS = {
  mint: 'bg-[#B4E4CE]/30',
  lavender: 'bg-[#E6D5F0]/30',
  peach: 'bg-[#FDD5B4]/30',
  blue: 'bg-[#C9E4F7]/30',
} as const;
```

### 4. Update `src/lib/layout-constants.ts`
Add dimension constants:
```typescript
export const DIALOG_DIMENSIONS = {
  taskDialog: {
    maxWidth: 'max-w-3xl lg:max-w-4xl',
    maxHeight: 'max-h-[90vh]',
    width: 'w-[95vw] sm:w-full',
  },
  pricingDialog: {
    maxWidth: 'max-w-[95vw] sm:max-w-[90vw] md:max-w-[850px]',
    maxHeight: 'max-h-[95vh]',
  },
} as const;
```

## Implementation Notes

- Many hardcoded Tailwind utility classes (like `px-1.5`, `py-1`) are intentional and acceptable
- Some hardcoded values in comments are documentation and don't need to be constants
- Environment-specific URLs (like Supabase project URLs) are expected to be dynamic
- Some inline styles may be necessary for dynamic values
- Animation durations in Tailwind classes may be acceptable as-is

## Next Steps

1. **High Priority**: Refactor text sizes in SettingsPanel
2. **High Priority**: Replace hardcoded timeout/delay values with `TIMING_CONSTANTS`
3. **High Priority**: Use `Z_INDEX` constants where hardcoded z-index values exist
4. **Medium Priority**: Move tag colors and award badge colors to constants
5. **Medium Priority**: Add dimension constants for dialogs
6. **Low Priority**: Standardize animation durations (if needed)

