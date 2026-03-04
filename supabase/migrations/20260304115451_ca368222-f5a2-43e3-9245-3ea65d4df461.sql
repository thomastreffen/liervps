-- Add project_aliases to events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS project_aliases text[] DEFAULT '{}';

-- Add ai_match_reason to schedule_blocks for tracking AI suggestions
ALTER TABLE public.schedule_blocks ADD COLUMN IF NOT EXISTS ai_match_reason text;
ALTER TABLE public.schedule_blocks ADD COLUMN IF NOT EXISTS ai_confidence integer;

-- AI match logging table
CREATE TABLE IF NOT EXISTS public.ai_match_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_block_id uuid REFERENCES public.schedule_blocks(id) ON DELETE CASCADE NOT NULL,
  event_subject text,
  chosen_project_id uuid,
  confidence integer NOT NULL DEFAULT 0,
  reason text,
  extracted_signals text[],
  outcome text NOT NULL DEFAULT 'no_change', -- 'auto', 'suggestion', 'no_change'
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_ai_match_runs_block ON public.ai_match_runs(schedule_block_id);

-- GIN index for alias matching
CREATE INDEX IF NOT EXISTS idx_events_project_aliases ON public.events USING gin(project_aliases);