
-- 1. Tabell for eksterne forslag
CREATE TABLE IF NOT EXISTS public.material_external_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_list_id uuid NOT NULL REFERENCES public.material_lists(id) ON DELETE CASCADE,
  share_token uuid,
  suggested_by_name text,
  suggested_by_email text,
  elnr text,
  description text,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'stk',
  provided_by text,
  comment text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mes_list ON public.material_external_suggestions(material_list_id);
CREATE INDEX IF NOT EXISTS idx_mes_status ON public.material_external_suggestions(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_external_suggestions TO authenticated;
GRANT ALL ON public.material_external_suggestions TO service_role;

ALTER TABLE public.material_external_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view suggestions" ON public.material_external_suggestions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.material_lists ml
    WHERE ml.id = material_list_id
      AND public.is_company_member(auth.uid(), ml.company_id)
  ));

CREATE POLICY "Members can update suggestions" ON public.material_external_suggestions
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.material_lists ml
    WHERE ml.id = material_list_id
      AND public.is_company_member(auth.uid(), ml.company_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.material_lists ml
    WHERE ml.id = material_list_id
      AND public.is_company_member(auth.uid(), ml.company_id)
  ));

CREATE POLICY "Members can delete suggestions" ON public.material_external_suggestions
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.material_lists ml
    WHERE ml.id = material_list_id
      AND public.is_company_member(auth.uid(), ml.company_id)
  ));

CREATE TRIGGER trg_mes_updated
  BEFORE UPDATE ON public.material_external_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.material_touch_updated_at();

-- 2. Anonym lesefunksjon via share_token
CREATE OR REPLACE FUNCTION public.get_shared_material_list(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list public.material_lists%ROWTYPE;
  v_items jsonb;
  v_procs jsonb;
  v_job_title text;
  v_job_number text;
  v_customer text;
  v_address text;
BEGIN
  SELECT * INTO v_list FROM public.material_lists WHERE share_token = p_token LIMIT 1;
  IF v_list.id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_list.job_id IS NOT NULL THEN
    SELECT title, job_number, customer, address
      INTO v_job_title, v_job_number, v_customer, v_address
    FROM public.events WHERE id = v_list.job_id;
  ELSIF v_list.order_id IS NOT NULL THEN
    SELECT
      COALESCE(summary->>'oppdragstittel', 'Bestilling'),
      submission_no,
      COALESCE(summary->>'kundenavn', summary->>'firmanavn'),
      COALESCE(summary->>'oppdragssted', summary->>'adresse')
      INTO v_job_title, v_job_number, v_customer, v_address
    FROM public.order_form_submissions WHERE id = v_list.order_id;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'elnr', i.elnr,
    'description', i.description,
    'quantity_ordered', i.quantity_ordered,
    'quantity_picked', i.quantity_picked,
    'quantity_received', i.quantity_received,
    'unit', i.unit,
    'provided_by', i.provided_by,
    'supplier', i.supplier,
    'comment', i.comment,
    'sort_order', i.sort_order
  ) ORDER BY i.sort_order, i.created_at), '[]'::jsonb)
    INTO v_items
  FROM public.material_list_items i
  WHERE i.material_list_id = v_list.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'supplier', p.supplier,
    'supplier_order_number', p.supplier_order_number,
    'expected_delivery_at', p.expected_delivery_at,
    'received_at', p.received_at,
    'status', p.status
  ) ORDER BY p.created_at), '[]'::jsonb)
    INTO v_procs
  FROM public.material_procurements p
  WHERE p.material_list_id = v_list.id;

  RETURN jsonb_build_object(
    'list', jsonb_build_object(
      'status', v_list.status,
      'crate_location', v_list.crate_location,
      'ordered_at', v_list.ordered_at,
      'received_at', v_list.received_at,
      'picked_at', v_list.picked_at,
      'dispatched_at', v_list.dispatched_at,
      'delivered_to_job_at', v_list.delivered_to_job_at,
      'completed_at', v_list.completed_at
    ),
    'job', jsonb_build_object(
      'title', v_job_title,
      'job_number', v_job_number,
      'customer', v_customer,
      'address', v_address
    ),
    'items', v_items,
    'procurements', v_procs
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_material_list(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_material_list(uuid) TO anon, authenticated;

-- 3. Anonym opprettelse av forslag
CREATE OR REPLACE FUNCTION public.create_material_suggestion(
  p_token uuid,
  p_name text,
  p_email text,
  p_elnr text,
  p_description text,
  p_quantity numeric,
  p_unit text,
  p_provided_by text,
  p_comment text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list_id uuid;
  v_id uuid;
BEGIN
  SELECT id INTO v_list_id FROM public.material_lists WHERE share_token = p_token LIMIT 1;
  IF v_list_id IS NULL THEN
    RAISE EXCEPTION 'Ugyldig delingslenke';
  END IF;

  IF COALESCE(p_quantity, 0) <= 0 THEN
    RAISE EXCEPTION 'Antall må være større enn 0';
  END IF;

  IF (COALESCE(p_elnr, '') = '' AND COALESCE(p_description, '') = '') THEN
    RAISE EXCEPTION 'Enten elnr eller beskrivelse må fylles ut';
  END IF;

  INSERT INTO public.material_external_suggestions(
    material_list_id, share_token, suggested_by_name, suggested_by_email,
    elnr, description, quantity, unit, provided_by, comment, status
  ) VALUES (
    v_list_id, p_token, NULLIF(p_name, ''), NULLIF(p_email, ''),
    NULLIF(p_elnr, ''), NULLIF(p_description, ''),
    p_quantity, COALESCE(NULLIF(p_unit, ''), 'stk'),
    NULLIF(p_provided_by, ''), NULLIF(p_comment, ''), 'pending'
  ) RETURNING id INTO v_id;

  -- Loggfør
  INSERT INTO public.material_activity_log(material_list_id, actor_id, actor_name, actor_type, event_type, message, metadata)
  VALUES (
    v_list_id, NULL, COALESCE(NULLIF(p_name, ''), 'Bestiller'), 'external',
    'suggestion_created',
    'Bestiller foreslo materiell: ' || COALESCE(NULLIF(p_description, ''), NULLIF(p_elnr, ''), '—'),
    jsonb_build_object('suggestion_id', v_id)
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_material_suggestion(uuid, text, text, text, text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_material_suggestion(uuid, text, text, text, text, numeric, text, text, text) TO anon, authenticated;
