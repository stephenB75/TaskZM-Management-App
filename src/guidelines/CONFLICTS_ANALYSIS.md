# AI Scheduling Guidelines - Conflicts Analysis

## Identified Conflicts and Inconsistencies

### 1. **"Never Today" Rule - Inconsistent Application**

**Conflict Location:**
- Line 19: Recurring tasks - "Schedule to the first valid occurrence date (never today, always future)"
- Line 248: Validation checklist - "Target date is in the future (never today)" (applies to all tasks)
- Line 125: Process flow - "For recurring: Use `calculateFirstOccurrenceDate()` - must be in future"
- Line 126: Process flow - "For regular: Use round-robin or priority-based distribution" (no mention of "never today")

**Issue:**
- The "never today" rule is explicitly stated for recurring tasks but not clearly stated for regular tasks in the main sections
- The validation checklist applies "never today" to all tasks, but the regular task scheduling rules section doesn't mention this constraint
- This creates ambiguity about whether regular tasks can be scheduled for today

**Recommendation:**
- Clarify in the Regular Tasks section whether they can be scheduled for today or must be future-dated
- Or, if regular tasks CAN be scheduled for today, remove "never today" from the validation checklist

---

### 2. **Midnight Task Filtering vs Safeguards**

**Conflict Location:**
- Line 42: "Filter Valid Tasks: Only include tasks with valid scheduled times (not midnight/00:00:00)"
- Code implementation: Multiple safeguards prevent scheduling tasks at midnight

**Issue:**
- Guidelines say to filter out tasks at midnight when checking conflicts
- But code also has safeguards to prevent NEW tasks from being scheduled at midnight
- This is actually not a conflict - filtering existing midnight tasks is different from preventing new ones
- However, the wording could be clearer about WHY we filter them (they're invalid/placeholder times)

**Recommendation:**
- Clarify that midnight times are considered invalid/placeholder times
- Explain that we filter them from conflict checks AND prevent scheduling new tasks at midnight

---

### 3. **Calendar Events - "Avoid" vs "Check for Conflicts"**

**Conflict Location:**
- Line 55: "Calendar events are checked via `findNextAvailableSlot()` with `calendarEvents` option"
- Line 57: "Calendar events are external commitments and should be avoided when scheduling tasks"

**Issue:**
- "Should be avoided" is ambiguous - does this mean:
  - Don't schedule tasks at the same time as calendar events? (conflict checking)
  - Don't schedule tasks on days with calendar events? (avoidance)
  - Prefer days without calendar events? (preference)

**Recommendation:**
- Clarify that "avoided" means "don't conflict with" (same as conflict checking)
- Or, if it means something different, specify the exact behavior

---

### 4. **Even Distribution vs Chronological Order**

**Conflict Location:**
- Line 67: "When distributing tasks evenly, ensure the time slot calculation maintains chronological order"
- Line 95: "Distribute tasks evenly across the category's time window"
- Line 66: "Use `findNextAvailableSlot()` which automatically places tasks after existing tasks"

**Issue:**
- "Even distribution" suggests spacing tasks evenly across the time window
- "Chronological order" suggests tasks should be placed sequentially (one after another)
- These can conflict if "even distribution" means equal spacing (e.g., 9am, 11am, 1pm) vs sequential (9am, 9:30am, 10am)

**Recommendation:**
- Clarify what "even distribution" means:
  - Does it mean equal spacing across the category window?
  - Or does it mean distributing tasks across multiple time slots (DEFAULT_TIME_SLOTS) but still maintaining chronological order?
- The current implementation seems to use DEFAULT_TIME_SLOTS for distribution while maintaining chronological order, which should be clarified

---

### 5. **Category Hours Disabled but ForceCategoryHours True**

**Conflict Location:**
- Line 90: "If `respectHours` is enabled, strictly enforce category hours"
- Line 91: "If `forceCategoryHours` is true, always use category hours even if `respectHours` is disabled"
- Line 217: "If category hours are disabled but `forceCategoryHours` is true, use default category hours"

**Issue:**
- The logic seems contradictory but might be intentional
- If `respectHours` is disabled, category hours are "disabled"
- But if `forceCategoryHours` is true, we should use category hours anyway
- Line 217 says to use "default category hours" in this case, which clarifies the behavior

**Recommendation:**
- This is actually clear but could be better organized
- Consider reordering to show the priority: `forceCategoryHours` > `respectHours` > default category hours

---

### 6. **Regular Tasks - Missing "Never Today" Explicit Statement**

**Conflict Location:**
- Line 30-32: Regular Tasks Scheduling Rules - No mention of "never today"
- Line 248: Validation checklist - "Target date is in the future (never today)" (applies to all tasks)

**Issue:**
- Regular tasks section doesn't explicitly state they can't be scheduled for today
- But validation checklist says all tasks must be future-dated
- This creates ambiguity

**Recommendation:**
- Add explicit statement to Regular Tasks section: "Schedule to a future date (never today)"
- Or clarify if regular tasks CAN be scheduled for today (in which case, update validation checklist)

---

### 7. **"Gap Finding" vs "Even Distribution"**

**Conflict Location:**
- Line 99-102: "Gap Finding" - First try to find gaps, then place after last task, then move to next day
- Line 95-97: "Time Distribution" - Distribute tasks evenly across category window using DEFAULT_TIME_SLOTS

**Issue:**
- Gap finding suggests placing tasks in available gaps (which might not be evenly spaced)
- Even distribution suggests spacing tasks evenly across the window
- These strategies can conflict

**Recommendation:**
- Clarify the priority: Does gap finding take precedence over even distribution?
- Or does even distribution only apply when there are no gaps?
- The current flow seems to be: try gaps first, then use even distribution if no gaps

---

## Summary of Required Fixes

1. **Clarify "never today" rule** - Explicitly state whether it applies to regular tasks or not
2. **Clarify calendar events "avoidance"** - Define what "avoid" means (conflict checking vs preference)
3. **Clarify "even distribution"** - Define what it means and how it relates to chronological order
4. **Clarify gap finding vs distribution** - Define priority and when each strategy applies
5. **Reorganize category hours logic** - Show clear priority order

## Non-Conflicts (Clarifications Needed)

- Midnight task filtering - Not a conflict, but wording could be clearer
- Category hours disabled + forceCategoryHours - Not a conflict, but could be better organized

