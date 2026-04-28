-- Samlekalkyle (kalkylesak) som binder flere calculations sammen
CREATE TABLE public.calc_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  title text NOT NULL,
  customer_name text,
  description text,
  source_draft_id uuid REFERENCES public.calc_ai_drafts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);

ALTER TABLE public.calc_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage calc_cases"
  ON public.calc_cases FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Users in same company can view calc_cases"
  ON public.calc_cases FOR SELECT
  USING (company_id IS NULL OR user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can insert calc_cases for their company"
  ON public.calc_cases FOR INSERT
  WITH CHECK (company_id IS NULL OR user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update own calc_cases"
  ON public.calc_cases FOR UPDATE
  USING (created_by = auth.uid() OR (company_id IS NOT NULL AND user_has_company_access(auth.uid(), company_id)));

CREATE TRIGGER update_calc_cases_updated_at
  BEFORE UPDATE ON public.calc_cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Koble calculations til en sak (valgfritt — frittstående kalkyler har NULL)
ALTER TABLE public.calculations
  ADD COLUMN IF NOT EXISTS case_id uuid REFERENCES public.calc_cases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS case_system_key text,
  ADD COLUMN IF NOT EXISTS case_sort_order int DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_calculations_case_id ON public.calculations(case_id) WHERE case_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calc_cases_source_draft ON public.calc_cases(source_draft_id) WHERE source_draft_id IS NOT NULL;