# AI Reschedule Function Review & Fixes

## Issues Found

### 1. **Tasks Always Pushed Forward**
- **Problem**: The `generateSchedulePlan` function always started from "tomorrow", causing tasks to be pushed forward even when rescheduling for today, current week, or current month.
- **Impact**: When rescheduling a day/week/month, tasks were being scheduled in the future instead of within the selected period.

### 2. **No Date Range Constraints**
- **Problem**: The reschedule functions didn't pass date constraints to `generateSchedulePlan`, allowing tasks to be scheduled outside the selected period.
- **Impact**: Tasks could be scheduled beyond the selected day/week/month.

### 3. **Starting from Tomorrow**
- **Problem**: Even when rescheduling "today", the system started from tomorrow.
- **Impact**: Today's tasks couldn't be rescheduled within today.

## Fixes Applied

### 1. **Added Date Range Support to `generateSchedulePlan`**
- Added optional `dateRange` parameter: `{ startDate: Date; endDate: Date }`
- When provided, scheduling is constrained to the date range
- Default behavior (no date range) still works for general scheduling

### 2. **Updated Reschedule Functions**

#### **`rescheduleDay(date)`**
- Creates date range for the selected day (start and end of same day)
- If selected date is today or in the past, uses today as start
- Passes date range to `generateSchedulePlan` to constrain scheduling

#### **`rescheduleWeek(startDate)`**
- Creates date range for the selected week (Monday to Sunday, 7 days)
- Passes date range to `generateSchedulePlan` to constrain scheduling

#### **`rescheduleMonth(date)`**
- Creates date range for the selected month (first day to last day of month)
- Passes date range to `generateSchedulePlan` to constrain scheduling

### 3. **Updated Scheduling Logic**
- Changed base date from "tomorrow" to `startDate` when date range is provided
- Tasks are scheduled starting from the beginning of the selected period
- Only pushes tasks forward if:
  - The current day is full (5-hour limit)
  - No space available in earlier days within the range
- Added date range validation in the search loop to prevent scheduling outside the range

### 4. **Improved Due Date Handling**
- Due date adjustments now respect the date range constraint
- Tasks won't be scheduled outside the selected period even if due date suggests it

## How It Works Now

### **Day Reschedule**
1. User selects a date (can be today, tomorrow, or any future date)
2. System gets all tasks scheduled for that day
3. Unschedules those tasks
4. Reschedules them within the same day
5. Only pushes to next day if the selected day is full

### **Week Reschedule**
1. User selects a date (week is calculated from Monday)
2. System gets all tasks scheduled for that week
3. Unschedules those tasks
4. Reschedules them within the week (Monday to Sunday)
5. Distributes tasks across the week, only pushing forward if earlier days are full

### **Month Reschedule**
1. User selects a date (month is calculated)
2. System gets all tasks scheduled for that month
3. Unschedules those tasks
4. Reschedules them within the month (1st to last day)
5. Distributes tasks across the month, only pushing forward if earlier days are full

## Key Improvements

✅ **Respects Selected Period**: Tasks stay within the selected day/week/month
✅ **Starts from Beginning**: Scheduling starts from the start of the selected period, not tomorrow
✅ **Only Pushes Forward When Necessary**: Tasks only move to later dates if earlier dates are full
✅ **Maintains Priority Logic**: Priority-based scheduling still works within the constraints
✅ **Handles Today**: Can now reschedule today's tasks within today

## Testing Recommendations

1. **Test Day Reschedule**:
   - Select today's date
   - Verify tasks are rescheduled within today
   - Select a future date
   - Verify tasks stay within that day

2. **Test Week Reschedule**:
   - Select current week
   - Verify tasks are distributed across the week
   - Verify tasks don't go beyond Sunday

3. **Test Month Reschedule**:
   - Select current month
   - Verify tasks are distributed across the month
   - Verify tasks don't go beyond the last day of the month

4. **Test Full Day**:
   - Create enough tasks to fill a day (5+ hours)
   - Reschedule that day
   - Verify excess tasks are marked as exceeding limit, not pushed forward

