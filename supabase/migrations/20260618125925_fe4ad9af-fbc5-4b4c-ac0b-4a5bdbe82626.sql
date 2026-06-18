-- Phase 1: Materialliste sporbarhet — bestilling, mottak, plukk, levering, aktivitetslogg

-- 1) Utvid material_lists
ALTER TABLE public.material_lists
  ADD COLUMN IF NOT EXISTS picked_by uuid,
  ADD COLUMN IF NOT EXISTS crate_location text,
  ADD COLUMN IF NOT EXISTS picked_comment text,
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatched_by uuid,
  ADD COLUMN IF NOT EXISTS delivered_to_job_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_to_job_by uuid,
  ADD COLUMN IF NOT EXISTS share_token uuid;

CREATE UNIQUE INDEX IF NOT EXISTS material_lists_share_token_idx
  ON public.material_lists(share_token) WHERE share_token IS NOT NULL;

-- 2) Utvid material_list_items
ALTER TABLE public.material_list_items
  ADD COLUMN IF NOT EXISTS quantity_received numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provided_by text,
  ADD COLUMN IF NOT EXISTS procurement_id uuid;

-- 3) material_procurements (bestilling/leveranse pr. materialliste)
CREATE TABLE IF NOT EXISTS public.material_procurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_list_id uuid NOT NULL REFERENCES public.material_lists(id) ON DELETE CASCADE,
  supplier text,
  supplier_order_number text,
  ordered_at timestamptz,
  ordered_by uuid,
  expected_delivery_at timestamptz,
  delivery_method text,
  delivery_location text,
  received_at timestamptz,
  received_by uuid,
  status text NOT NULL DEFAULT 'planned',
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_procurements TO authenticated;
GRANT ALL ON public.material_procurements TO service_role;

ALTER TABLE public.material_procurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view material_procurements" ON public.material_procurements
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.material_lists ml
    WHERE ml.id = material_procurements.material_list_id
      AND is_company_member(auth.uid(), ml.company_id)
  ));
CREATE POLICY "Members can insert material_procurements" ON public.material_procurements
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.material_lists ml
    WHERE ml.id = material_procurements.material_list_id
      AND is_company_member(auth.uid(), ml.company_id)
  ));
CREATE POLICY "Members can update material_procurements" ON public.material_procurements
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.material_lists ml
    WHERE ml.id = material_procurements.material_list_id
      AND is_company_member(auth.uid(), ml.company_id)
  ));
CREATE POLICY "Members can delete material_procurements" ON public.material_procurements
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.material_lists ml
    WHERE ml.id = material_procurements.material_list_id
      AND is_company_member(auth.uid(), ml.company_id)
  ));

CREATE INDEX IF NOT EXISTS material_procurements_list_idx
  ON public.material_procurements(material_list_id);

CREATE TRIGGER trg_material_procurements_updated_at
  BEFORE UPDATE ON public.material_procurements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) material_activity_log
CREATE TABLE IF NOT EXISTS public.material_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_list_id uuid NOT NULL REFERENCES public.material_lists(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_name text,
  actor_type text NOT NULL DEFAULT 'internal',
  event_type text NOT NULL,
  message text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.material_activity_log TO authenticated;
GRANT ALL ON public.material_activity_log TO service_role;

ALTER TABLE public.material_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view material_activity_log" ON public.material_activity_log
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.material_lists ml
    WHERE ml.id = material_activity_log.material_list_id
      AND is_company_member(auth.uid(), ml.company_id)
  ));
CREATE POLICY "Members can insert material_activity_log" ON public.material_activity_log
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.material_lists ml
    WHERE ml.id = material_activity_log.material_list_id
      AND is_company_member(auth.uid(), ml.company_id)
  ));

CREATE INDEX IF NOT EXISTS material_activity_log_list_idx
  ON public.material_activity_log(material_list_id, created_at DESC);
