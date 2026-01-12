-- Add recurrence support columns to calendar_events table
-- Run this in the Supabase SQL Editor

-- Add columns for recurrence support
ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS rrule TEXT,
ADD COLUMN IF NOT EXISTS recurrence_base_id TEXT,
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;

-- Add index for recurrence_base_id to efficiently query recurring event instances
CREATE INDEX IF NOT EXISTS idx_calendar_events_recurrence_base_id 
ON calendar_events(recurrence_base_id) 
WHERE recurrence_base_id IS NOT NULL;

-- Add index for is_recurring to efficiently filter recurring events
CREATE INDEX IF NOT EXISTS idx_calendar_events_is_recurring 
ON calendar_events(is_recurring) 
WHERE is_recurring = true;

-- Add comment to document the columns
COMMENT ON COLUMN calendar_events.rrule IS 'Original RRULE string for recurring events (e.g., FREQ=WEEKLY;INTERVAL=1;BYDAY=MO)';
COMMENT ON COLUMN calendar_events.recurrence_base_id IS 'Links expanded instances to the base recurring event (uses external_id of base event)';
COMMENT ON COLUMN calendar_events.is_recurring IS 'Flag indicating if this event is part of a recurring series';
