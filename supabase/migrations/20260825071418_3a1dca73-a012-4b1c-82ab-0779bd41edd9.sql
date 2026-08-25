ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS google_calendar_sync_status TEXT NULL,
  ADD COLUMN IF NOT EXISTS google_calendar_sync_error TEXT NULL;

CREATE TABLE IF NOT EXISTS public.google_calendar_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NULL,
  user_id UUID NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  google_event_id TEXT NULL,
  error_code TEXT NULL,
  error_detail TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gcal_sync_log_created_at ON public.google_calendar_sync_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gcal_sync_log_event ON public.google_calendar_sync_log (event_id);

GRANT SELECT ON public.google_calendar_sync_log TO authenticated;
GRANT ALL ON public.google_calendar_sync_log TO service_role;

ALTER TABLE public.google_calendar_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gcal_sync_log_admin_read" ON public.google_calendar_sync_log;
CREATE POLICY "gcal_sync_log_admin_read"
ON public.google_calendar_sync_log
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);