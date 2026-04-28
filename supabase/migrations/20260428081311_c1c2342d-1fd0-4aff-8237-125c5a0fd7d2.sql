ALTER TABLE public.calc_ai_drafts
ADD COLUMN IF NOT EXISTS system_calculation_map jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.calc_ai_drafts.system_calculation_map IS
'Mapping fra system-index (string) til calculation_id. Lar én draft ha flere kalkyler (én per foreslått system).';