ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS google_calendar_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS google_calendar_synced_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_events_google_calendar_event_id
  ON public.events (google_calendar_event_id)
  WHERE google_calendar_event_id IS NOT NULL;