-- Add calendar_color column to calendar_events table
-- This stores the hex color of the Apple Calendar that the event belongs to

ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS calendar_color TEXT;

-- Create an index for potential filtering by calendar color
CREATE INDEX IF NOT EXISTS idx_calendar_events_color ON calendar_events(calendar_color);

