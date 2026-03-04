
-- Add guardrail columns to ai_match_runs
ALTER TABLE public.ai_match_runs
  ADD COLUMN IF NOT EXISTS final_decision text DEFAULT 'no_change',
  ADD COLUMN IF NOT EXISTS guardrail_reason text,
  ADD COLUMN IF NOT EXISTS guardrail_signals jsonb DEFAULT '[]'::jsonb;

-- Create confirmation_learnings table for signal-to-project mappings
CREATE TABLE IF NOT EXISTS public.confirmation_learnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  technician_id uuid NOT NULL,
  project_id uuid NOT NULL,
  signal_tokens text[] NOT NULL DEFAULT '{}',
  alias_hits text[] DEFAULT '{}',
  customer_hits text[] DEFAULT '{}',
  source_block_id uuid REFERENCES public.schedule_blocks(id) ON DELETE SET NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days')
);

CREATE INDEX idx_confirmation_learnings_lookup
  ON public.confirmation_learnings (technician_id, project_id, expires_at);

CREATE INDEX idx_confirmation_learnings_tokens
  ON public.confirmation_learnings USING GIN (signal_tokens);

-- Enable RLS but allow service role access (edge functions use service role)
ALTER TABLE public.confirmation_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on confirmation_learnings"
  ON public.confirmation_learnings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated read confirmation_learnings"
  ON public.confirmation_learnings FOR SELECT
  TO authenticated
  USING (true);
