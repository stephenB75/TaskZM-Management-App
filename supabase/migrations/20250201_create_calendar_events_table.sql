-- Create calendar_events table for synced external calendar events (Apple CalDAV, Google, Outlook)
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  location TEXT,
  source TEXT NOT NULL DEFAULT 'icloud',
  calendar_href TEXT,
  calendar_color TEXT,
  external_updated_at TIMESTAMPTZ,
  rrule TEXT,
  recurrence_base_id TEXT,
  is_recurring BOOLEAN DEFAULT false,
  is_readonly BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_source ON calendar_events(user_id, source);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_start ON calendar_events(user_id, source, start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_color ON calendar_events(calendar_color);
CREATE INDEX IF NOT EXISTS idx_calendar_events_recurrence_base_id ON calendar_events(recurrence_base_id) WHERE recurrence_base_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_is_recurring ON calendar_events(is_recurring) WHERE is_recurring = true;

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own calendar events" ON calendar_events;
CREATE POLICY "Users can view their own calendar events" ON calendar_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own calendar events" ON calendar_events;
CREATE POLICY "Users can insert their own calendar events" ON calendar_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own calendar events" ON calendar_events;
CREATE POLICY "Users can update their own calendar events" ON calendar_events
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own calendar events" ON calendar_events;
CREATE POLICY "Users can delete their own calendar events" ON calendar_events
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role has full access to calendar events" ON calendar_events;
CREATE POLICY "Service role has full access to calendar events" ON calendar_events
  FOR ALL USING (true) WITH CHECK (true);
