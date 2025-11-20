# Daily Hours Limit Warning System - Implementation Summary

## Overview
Implemented warnings when users drag or add tasks to the today agenda timeline if the day is close to or would exceed the 5-hour daily limit.

## Implementation Details

### 1. **New Utility Module: `src/lib/daily-hours-utils.ts`**
   - **`calculateDailyHours()`**: Calculates total hours scheduled for a specific date
   - **`checkDailyLimit()`**: Checks if adding a task would exceed the daily limit
   - **`getDailyHoursWarningLevel()`**: Determines warning level ('none', 'warning', 'error')
   - **`estimateTaskHours()`**: Estimates task duration using the same logic as AI scheduler for consistency
   - Uses the same estimation algorithm as `useAIScheduler` to ensure consistency

### 2. **Updated DragDropContext (`src/contexts/DragDropContext.tsx`)**
   - Added 5-hour limit checking when tasks are dragged to the today agenda
   - **Warning Levels**:
     - **Error**: Task would exceed 5-hour limit → Prevents scheduling, shows error toast
     - **Warning**: Day has 4+ hours or adding task brings total to 4+ hours → Shows warning toast but allows scheduling
   - Checks occur after time conflict validation but before scheduling

### 3. **Updated TaskDialog (`src/components/TaskDialog.tsx`)**
   - Added 5-hour limit checking when tasks are scheduled for today via the task dialog
   - Only checks if the scheduled date is today
   - Same warning levels as drag-and-drop:
     - **Error**: Prevents task creation/update if it would exceed limit
     - **Warning**: Shows warning but allows task creation/update if close to limit

## Warning Behavior

### **Error (Would Exceed Limit)**
- **When**: Adding task would bring total to 5+ hours
- **Action**: Prevents scheduling, shows error toast
- **Message**: "Daily limit exceeded"
- **Description**: Shows current hours, task hours, and total hours

### **Warning (Close to Limit)**
- **When**: Day has 4+ hours scheduled OR adding task brings total to 4+ hours
- **Action**: Shows warning toast but allows scheduling
- **Message**: "Approaching daily limit"
- **Description**: Shows current hours and what total will be after adding task

## Example Scenarios

### Scenario 1: Day Already Has 4.5 Hours
- User drags a 1-hour task to today
- **Result**: Warning toast (4.5h + 1h = 5.5h, exceeds limit)
- **Action**: Prevents scheduling

### Scenario 2: Day Has 3.8 Hours
- User adds a 1-hour task for today
- **Result**: Warning toast (3.8h + 1h = 4.8h, close to limit)
- **Action**: Allows scheduling with warning

### Scenario 3: Day Has 2 Hours
- User drags a 0.5-hour task to today
- **Result**: No warning (2h + 0.5h = 2.5h, well below limit)
- **Action**: Allows scheduling normally

## Technical Notes

1. **Task Duration Estimation**: Uses the same intelligent estimation as the AI scheduler, considering:
   - User-set `estimatedTime` (if available)
   - Task priority
   - Description length
   - Subtasks count
   - Title keywords
   - Task status
   - Dependencies
   - Tags

2. **Date Comparison**: Uses date-only comparison (ignores time) to determine if a task is scheduled for "today"

3. **Exclusion Logic**: When calculating daily hours, excludes:
   - Completed tasks (`status === 'done'`)
   - The task being added/updated (to avoid double-counting)

4. **Recurrence Support**: Uses `isDateInRecurrence()` to properly handle recurring tasks

## Testing Checklist

- [ ] Drag task to today when day has < 4 hours → No warning
- [ ] Drag task to today when day has 4+ hours → Warning shown
- [ ] Drag task to today when adding would exceed 5 hours → Error, prevents scheduling
- [ ] Add task via dialog for today when day has < 4 hours → No warning
- [ ] Add task via dialog for today when day has 4+ hours → Warning shown
- [ ] Add task via dialog for today when adding would exceed 5 hours → Error, prevents creation
- [ ] Update task scheduled for today when it would exceed limit → Error, prevents update
- [ ] Schedule task for future date → No limit check (only checks today)
- [ ] Verify task duration estimation matches AI scheduler logic

## Files Modified

1. `src/lib/daily-hours-utils.ts` (new file)
2. `src/contexts/DragDropContext.tsx`
3. `src/components/TaskDialog.tsx`

