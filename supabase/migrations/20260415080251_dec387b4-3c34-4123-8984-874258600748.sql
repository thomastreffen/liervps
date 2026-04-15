
ALTER TABLE public.event_logs
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS performer_name text DEFAULT NULL;
