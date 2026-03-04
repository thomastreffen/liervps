
-- Delta link tracking per technician/calendar
CREATE TABLE IF NOT EXISTS public.schedule_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
  calendar_id text NOT NULL,
  delta_link text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (technician_id, calendar_id)
);

ALTER TABLE public.schedule_sync_state ENABLE ROW LEVEL SECURITY;

-- Sync run logging
CREATE TABLE IF NOT EXISTS public.schedule_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  techs_processed int NOT NULL DEFAULT 0,
  events_fetched int NOT NULL DEFAULT 0,
  upserts int NOT NULL DEFAULT 0,
  needs_confirmation int NOT NULL DEFAULT 0,
  errors text[],
  continuation_token text,
  status text NOT NULL DEFAULT 'running'
);

ALTER TABLE public.schedule_sync_runs ENABLE ROW LEVEL SECURITY;

-- Enable pg_cron and pg_net
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
