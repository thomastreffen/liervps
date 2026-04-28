ALTER TABLE public.calc_ai_drafts
  ADD COLUMN IF NOT EXISTS case_id uuid REFERENCES public.calc_cases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_calc_ai_drafts_case_id ON public.calc_ai_drafts(case_id) WHERE case_id IS NOT NULL;