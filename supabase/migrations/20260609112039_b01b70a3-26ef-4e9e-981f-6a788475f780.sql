ALTER TABLE public.order_form_submissions
  ADD COLUMN IF NOT EXISTS source_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_order_form_submissions_source_lead_id
  ON public.order_form_submissions(source_lead_id)
  WHERE source_lead_id IS NOT NULL AND deleted_at IS NULL;