-- Add per-technician time overrides to event_technicians
ALTER TABLE public.event_technicians
  ADD COLUMN IF NOT EXISTS start_at timestamptz,
  ADD COLUMN IF NOT EXISTS end_at timestamptz;

COMMENT ON COLUMN public.event_technicians.start_at IS 'Optional per-technician start time override. When NULL, uses parent event start_time.';
COMMENT ON COLUMN public.event_technicians.end_at IS 'Optional per-technician end time override. When NULL, uses parent event end_time.';