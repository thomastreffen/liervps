ALTER TABLE public.calculations ADD COLUMN IF NOT EXISTS offer_accepted_at timestamptz;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS source_calculation_id uuid REFERENCES public.calculations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_events_source_calculation_id ON public.events(source_calculation_id) WHERE source_calculation_id IS NOT NULL;