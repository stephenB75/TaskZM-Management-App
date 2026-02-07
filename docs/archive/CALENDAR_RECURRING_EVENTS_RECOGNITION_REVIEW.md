# Calendar Recurring Events Recognition Review

## Summary
**The app DOES recognize recurring calendar events in the backend**, but **the frontend does NOT receive or display recurrence information**.

## Backend Recognition ✅

### 1. Database Storage
- Recurring events are stored with:
  - `rrule`: RRULE string (e.g., "FREQ=WEEKLY;BYDAY=MO")
  - `is_recurring`: `true` flag
  - `recurrence_base_id`: `null` for base events

### 2. Event Detection
- `getAppleEventsFromDatabase` correctly identifies base recurring events:
  ```typescript
  if (event.is_recurring && event.rrule && !event.recurrence_base_id) {
    // This is a base recurring event
  }
  ```

### 3. Occurrence Generation
- `generateRecurringOccurrences` correctly expands recurring events on-demand
- Generates occurrences within the requested date range
- Handles all RRULE patterns (DAILY, WEEKLY, MONTHLY, YEARLY, BYDAY, BYMONTHDAY, etc.)

## Frontend Recognition ❌

### 1. Missing Recurrence Fields
The frontend `CalendarEvent` interface does NOT include recurrence information:
```typescript
export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  provider: 'google' | 'apple';
  calendarColor?: string;
  // ❌ Missing: isRecurring, rrule, recurrenceBaseId
}
```

### 2. Backend Not Returning Recurrence Info
When `generateRecurringOccurrences` creates occurrences, it does NOT include recurrence fields:
```typescript
occurrences.push({
  id: `${baseEvent.id}_${timestamp}`,
  title: baseEvent.title,
  start: ...,
  end: ...,
  location: baseEvent.location,
  provider: 'apple' as const,
  providerEventId: ...,
  calendarColor: baseEvent.calendar_color,
  // ❌ Missing: isRecurring, rrule, recurrenceBaseId
});
```

### 3. No Visual Indicator
- `CalendarEventCard` component does NOT show any recurring event indicator
- No Repeat icon (like tasks have)
- No badge or label indicating the event is recurring
- Each occurrence appears as a separate, independent event

## Impact

1. **User Experience**: Users cannot tell which events are recurring vs. one-time events
2. **Functionality**: Frontend cannot distinguish recurring events for any special handling
3. **Consistency**: Tasks show a Repeat icon for recurring tasks, but calendar events don't

## Recommendation

To fully recognize recurring calendar events in the UI:

1. **Update Backend**: Include recurrence fields in `generateRecurringOccurrences` return value
2. **Update Frontend Interface**: Add `isRecurring`, `rrule?`, and `recurrenceBaseId?` to `CalendarEvent` interface
3. **Update Frontend Parsing**: Extract recurrence fields from API response
4. **Add Visual Indicator**: Show Repeat icon in `CalendarEventCard` for recurring events (similar to tasks)

## Current Status

- ✅ **Backend**: Fully recognizes and handles recurring events
- ❌ **Frontend**: Does NOT receive or display recurrence information
- ❌ **UI**: No visual indication that events are recurring

## Conclusion

**The app recognizes recurring calendar events in the backend**, but this information is **not passed to or displayed in the frontend**. Each occurrence appears as a separate event without any indication it's part of a recurring series.
