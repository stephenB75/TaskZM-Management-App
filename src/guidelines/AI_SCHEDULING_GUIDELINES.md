# AI Task Scheduling Guidelines

## Overview
This document establishes the core principles and rules that the AI Scheduler must follow when placing tasks in the calendar. These guidelines ensure consistent, logical, and user-friendly task scheduling.

## Core Principles

### 1. Task Type Differentiation

#### Recurring Tasks
- **Identification**: Tasks with `recurrence.type !== 'none'`
- **Behavior**: 
  - Recurring tasks appear on MULTIPLE days based on their recurrence pattern
  - They have a base `scheduledDate` that represents the first occurrence
  - Use `isDateInRecurrence()` to check if a recurring task applies to a specific date
  - When scheduling, calculate the FIRST occurrence date using `calculateFirstOccurrenceDate()`
  - Recurring tasks must be visible on ALL days they occur for conflict detection
- **Scheduling Rules**:
  - Schedule to the first valid occurrence date (never today, always future)
  - The time assigned applies to ALL occurrences of that recurring task
  - When checking conflicts, check if the recurring task applies to the target date using `isDateInRecurrence()`
  - Do NOT create separate task instances for each occurrence - one task represents all occurrences

#### Regular (Non-Recurring) Tasks
- **Identification**: Tasks with `recurrence.type === 'none'` or no recurrence property
- **Behavior**:
  - Regular tasks appear on ONE specific date
  - They have a single `scheduledDate` that represents when they occur
  - Use direct date comparison to check if a regular task applies to a date
- **Scheduling Rules**:
  - Schedule to a single specific date and time
  - Check conflicts by comparing `scheduledDate` directly with the target date

### 2. Finding Available Time Slots

#### Process
1. **Identify Target Date**: Determine which date the task should be scheduled on
2. **Get All Tasks for Date**: 
   - For regular tasks: Filter by exact `scheduledDate` match
   - For recurring tasks: Use `isDateInRecurrence()` to find all recurring tasks that apply to the date
   - Include tasks already scheduled in the current batch (from the plan)
3. **Filter Valid Tasks**: Only include tasks with valid scheduled times (not midnight/00:00:00)
4. **Check Category Hours**: Ensure the task fits within its category's allowed hours
5. **Find Available Slot**: Use `findNextAvailableSlot()` to find the next open time
6. **Verify No Conflicts**: Ensure the task doesn't overlap with any existing tasks

#### Conflict Detection
- **Time Overlap**: Two tasks conflict if their time ranges overlap
- **Same Start Time**: Tasks with the same start time (within 1 minute) conflict
- **Check All Tasks**: Must check against:
  - Existing scheduled tasks in the database
  - Tasks already scheduled in the current batch (from the plan)
  - Recurring tasks that apply to the target date (using `isDateInRecurrence()`)

### 3. Chronological Order

#### Requirement
Tasks must be scheduled in chronological order (earliest to latest) within each day.

#### Implementation
- When multiple tasks are scheduled for the same day, they must be ordered by start time
- Use `findNextAvailableSlot()` which automatically places tasks after existing tasks
- When distributing tasks evenly, ensure the time slot calculation maintains chronological order
- After scheduling, tasks should be sortable by `scheduledDate` to show chronological order

#### Verification
- All tasks for a day should be sortable by `scheduledDate.getTime()`
- No task should be scheduled before a task that was already scheduled earlier in the batch
- Gaps between tasks are acceptable, but tasks should not overlap

### 4. Category Hours Rules

#### Categories
- **Work**: Business and professional tasks
- **Personal**: Personal and family tasks  
- **Projects**: Project-related tasks

#### Rules
1. **Respect Category Hours**: 
   - Each category has defined start and end times for weekdays and weekends
   - Tasks must be scheduled within their category's allowed hours
   - Use `getCategoryHoursForTask()` to get the category hours for a task
   - Use `getCategoryTimeSlot()` to find a time within category hours

2. **Category Hours Settings**:
   - If `respectHours` is enabled, strictly enforce category hours
   - If `forceCategoryHours` is true, always use category hours even if `respectHours` is disabled
   - If category hours are disabled, use default category hours as fallback

3. **Time Distribution**:
   - Distribute tasks evenly across the category's time window
   - Use `DEFAULT_TIME_SLOTS` to create multiple time slots for even distribution
   - Calculate time slot based on: `(totalCategoryTasksCount % DEFAULT_TIME_SLOTS)`

4. **Gap Finding**:
   - First, try to find gaps between existing tasks in the same category
   - If no gaps, place after the last task in the category
   - If category is full, move to next day or return null

5. **Category Boundaries**:
   - Never schedule a task before the category start time
   - Never schedule a task that would end after the category end time
   - Verify task duration fits: `taskStart + duration <= categoryEnd`

### 5. Scheduling Process Flow

#### Step-by-Step Process

1. **Identify Tasks to Schedule**
   - Get unscheduled tasks using `getUnscheduledTasks()`
   - Filter by options (e.g., only tasks without due dates)
   - Sort by priority and status if priority-based scheduling is enabled

2. **For Each Task**:
   a. **Determine Task Type**:
      - Check if recurring: `task.recurrence && task.recurrence.type !== 'none'`
      - If recurring, calculate first occurrence date
      - If regular, use calculated date from distribution
   
   b. **Find Target Date**:
      - For recurring: Use `calculateFirstOccurrenceDate()` - must be in future
      - For regular: Use round-robin or priority-based distribution
      - Ensure date is within the scheduling period
   
   c. **Get All Tasks for Target Date**:
      - Get existing tasks from `dailyTasks` for the date
      - Get tasks from current plan for the same date
      - For recurring tasks in existing tasks, use `isDateInRecurrence()` to check if they apply
      - Filter to only include tasks with valid scheduled times
   
   d. **Calculate Time Slot**:
      - Get task category using `getTaskCategory()`
      - Count existing tasks in same category for the date
      - Count tasks in plan in same category for the date
      - Calculate time slot: `(existingCount + planCount) % DEFAULT_TIME_SLOTS`
   
   e. **Get Category Time**:
      - Call `getCategoryTimeSlot()` with:
        - Task
        - Schedule date
        - Time slot number
        - Force category hours flag
        - All tasks for the day (existing + plan)
        - Task duration in minutes
      - This returns a time within category hours
   
   f. **Find Available Slot**:
      - Create proposed time from category time
      - Call `findNextAvailableSlot()` with:
        - Task ID
        - Proposed time
        - Task duration
        - All valid tasks for the day
        - Category hours constraints
      - This ensures no conflicts and respects category hours
   
   g. **Final Conflict Check**:
      - Before adding to plan, check for conflicts one more time
      - Use updated tasks from plan with their final scheduled times
      - If conflict found, adjust time and re-check
   
   h. **Add to Plan**:
      - Add task to plan with final scheduled date and time
      - Add to `dailyTasks` for the scheduled date
      - For recurring tasks, add to `dailyTasks` for ALL days they occur on
      - Update daily hours tracking

3. **Apply Plan**:
   - For each task in plan, call `updateTask()` with `scheduledDate`
   - Tasks are saved sequentially to database

### 6. Special Cases

#### Recurring Tasks on Multiple Days
- When a recurring task is scheduled, it must be added to `dailyTasks` for ALL days it occurs on
- Use `isDateInRecurrence()` to check each day in the date range
- This ensures subsequent tasks can see the recurring task on all its occurrence days
- When filtering `existingTasksForDay`, use `isDateInRecurrence()` for recurring tasks instead of direct date comparison

#### Tasks Exceeding Daily Limit
- Maximum 5 hours per day (`MAX_HOURS_PER_DAY`)
- If a task would exceed the limit, move to next day
- Track days that exceed limit in `daysExceedingLimit` array
- Tasks that exceed limit are added to `exceedsLimit` array

#### Minimum Hours Enforcement
- If `enforceMinimumHours` is enabled, try to fill days to reach `MIN_HOURS_PER_DAY`
- Prioritize days that need more hours to reach minimum
- This helps create more balanced schedules

#### Priority-Based Scheduling
- If enabled, schedule urgent tasks first (day 0)
- Distribute high priority tasks across first few days
- Distribute medium/low priority tasks evenly across period
- Use `PRIORITY_WEIGHTS` and `STATUS_WEIGHTS` for sorting

### 7. Error Handling

#### Invalid Dates
- If date parsing fails, include task in schedule (will be rescheduled)
- Log warning for invalid dates

#### No Available Slots
- If no slot found within category hours, try next day
- If no slot found in entire period, add to `exceedsLimit`
- Never schedule a task that conflicts with existing tasks

#### Category Hours Disabled
- If category hours are disabled but `forceCategoryHours` is true, use default category hours
- Default hours are defined in `DEFAULT_CATEGORY_HOURS` constant

## Code References

### Key Functions
- `getUnscheduledTasks()`: Get tasks that need scheduling
- `calculateFirstOccurrenceDate()`: Calculate first occurrence for recurring tasks
- `isDateInRecurrence()`: Check if recurring task applies to a date
- `getCategoryTimeSlot()`: Get time within category hours
- `findNextAvailableSlot()`: Find next available time slot without conflicts
- `getCategoryHoursForTask()`: Get category hours for a task
- `getTaskCategory()`: Determine task category from tags

### Key Constants
- `MAX_HOURS_PER_DAY`: 5 hours maximum per day
- `MIN_HOURS_PER_DAY`: Minimum hours to reach per day
- `DEFAULT_TIME_SLOTS`: Number of time slots for distribution
- `TIME_ROUNDING_INTERVAL_MINUTES`: 15 minutes - rounds times to nearest interval
- `DEFAULT_CATEGORY_HOURS`: Default hours for each category

### Key Data Structures
- `dailyTasks`: Map of date keys to arrays of tasks for that day
- `dailyHours`: Map of date keys to total hours scheduled for that day
- `plan`: Array of tasks with their scheduled dates (being built during scheduling)
- `daysExceedingLimit`: Array of days that exceed the 5-hour limit

## Validation Checklist

Before adding a task to the plan, verify:
- [ ] Task type is correctly identified (recurring vs regular)
- [ ] Target date is in the future (never today)
- [ ] All tasks for the date are visible (existing + plan + recurring)
- [ ] Category hours are respected
- [ ] No time conflicts exist
- [ ] Task fits within category end time (start + duration <= end)
- [ ] Task is in chronological order with other tasks
- [ ] Daily hour limit is not exceeded
- [ ] For recurring tasks, added to all occurrence days in `dailyTasks`

## Summary

The AI Scheduler must:
1. **Differentiate** between recurring and regular tasks
2. **Find available time** by checking all tasks (existing + plan + recurring)
3. **Maintain chronological order** within each day
4. **Respect category hours** for each task category
5. **Prevent conflicts** by checking all tasks on the target date
6. **Handle recurring tasks** by making them visible on all occurrence days

These guidelines ensure consistent, conflict-free, and user-friendly task scheduling.

