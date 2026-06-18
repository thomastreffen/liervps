
-- ============ material_lists ============
CREATE TABLE public.material_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.order_form_submissions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.internal_companies(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'utkast',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  ordered_at timestamptz,
  received_at timestamptz,
  picked_at timestamptz,
  sent_with_installer_at timestamptz,
  consumption_registered_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT material_lists_target_chk CHECK (job_id IS NOT NULL OR order_id IS NOT NULL)
);
CREATE INDEX idx_material_lists_job ON public.material_lists(job_id);
CREATE INDEX idx_material_lists_order ON public.material_lists(order_id);
CREATE INDEX idx_material_lists_company ON public.material_lists(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_lists TO authenticated;
GRANT ALL ON public.material_lists TO service_role;
ALTER TABLE public.material_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view material_lists"
  ON public.material_lists FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can insert material_lists"
  ON public.material_lists FOR INSERT
  WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can update material_lists"
  ON public.material_lists FOR UPDATE
  USING (public.is_company_member(auth.uid(), company_id))
  WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can delete material_lists"
  ON public.material_lists FOR DELETE
  USING (public.is_company_member(auth.uid(), company_id));

-- ============ material_list_items ============
CREATE TABLE public.material_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_list_id uuid NOT NULL REFERENCES public.material_lists(id) ON DELETE CASCADE,
  elnr text,
  supplier_sku text,
  description text NOT NULL,
  quantity_ordered numeric NOT NULL DEFAULT 0,
  quantity_picked numeric NOT NULL DEFAULT 0,
  quantity_used numeric NOT NULL DEFAULT 0,
  quantity_returned numeric NOT NULL DEFAULT 0,
  return_overridden boolean NOT NULL DEFAULT false,
  unit text NOT NULL DEFAULT 'stk',
  supplier text,
  source text NOT NULL DEFAULT 'manual',
  ai_confidence text,
  ai_reason text,
  comment text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_material_list_items_list ON public.material_list_items(material_list_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_list_items TO authenticated;
GRANT ALL ON public.material_list_items TO service_role;
ALTER TABLE public.material_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view material_list_items"
  ON public.material_list_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.material_lists ml
    WHERE ml.id = material_list_id
      AND public.is_company_member(auth.uid(), ml.company_id)
  ));
CREATE POLICY "Members can insert material_list_items"
  ON public.material_list_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.material_lists ml
    WHERE ml.id = material_list_id
      AND public.is_company_member(auth.uid(), ml.company_id)
  ));
CREATE POLICY "Members can update material_list_items"
  ON public.material_list_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.material_lists ml
    WHERE ml.id = material_list_id
      AND public.is_company_member(auth.uid(), ml.company_id)
  ));
CREATE POLICY "Members can delete material_list_items"
  ON public.material_list_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.material_lists ml
    WHERE ml.id = material_list_id
      AND public.is_company_member(auth.uid(), ml.company_id)
  ));

-- Auto return = picked - used unless manually overridden
CREATE OR REPLACE FUNCTION public.material_item_autoreturn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.return_overridden IS NOT TRUE THEN
    NEW.quantity_returned := GREATEST(COALESCE(NEW.quantity_picked,0) - COALESCE(NEW.quantity_used,0), 0);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_material_item_autoreturn
  BEFORE INSERT OR UPDATE ON public.material_list_items
  FOR EACH ROW EXECUTE FUNCTION public.material_item_autoreturn();

-- Generic updated_at
CREATE OR REPLACE FUNCTION public.material_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_material_lists_updated
  BEFORE UPDATE ON public.material_lists
  FOR EACH ROW EXECUTE FUNCTION public.material_touch_updated_at();

-- ============ material_templates ============
CREATE TABLE public.material_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_material_templates_company ON public.material_templates(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_templates TO authenticated;
GRANT ALL ON public.material_templates TO service_role;
ALTER TABLE public.material_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view material_templates"
  ON public.material_templates FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members manage material_templates"
  ON public.material_templates FOR ALL
  USING (public.is_company_member(auth.uid(), company_id))
  WITH CHECK (public.is_company_member(auth.uid(), company_id));

CREATE TRIGGER trg_material_templates_updated
  BEFORE UPDATE ON public.material_templates
  FOR EACH ROW EXECUTE FUNCTION public.material_touch_updated_at();

-- ============ material_template_items ============
CREATE TABLE public.material_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.material_templates(id) ON DELETE CASCADE,
  elnr text,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'stk',
  supplier text,
  comment text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_material_template_items_tpl ON public.material_template_items(template_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_template_items TO authenticated;
GRANT ALL ON public.material_template_items TO service_role;
ALTER TABLE public.material_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members access material_template_items"
  ON public.material_template_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.material_templates t
    WHERE t.id = template_id AND public.is_company_member(auth.uid(), t.company_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.material_templates t
    WHERE t.id = template_id AND public.is_company_member(auth.uid(), t.company_id)
  ));

-- ============ material_products ============
CREATE TABLE public.material_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id) ON DELETE CASCADE,
  elnr text,
  description text NOT NULL,
  unit text NOT NULL DEFAULT 'stk',
  supplier text,
  supplier_sku text,
  category text,
  active boolean NOT NULL DEFAULT true,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_material_products_company ON public.material_products(company_id);
CREATE INDEX idx_material_products_elnr ON public.material_products(elnr);
CREATE INDEX idx_material_products_search ON public.material_products USING gin (to_tsvector('simple', coalesce(description,'') || ' ' || coalesce(elnr,'') || ' ' || coalesce(supplier_sku,'')));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_products TO authenticated;
GRANT ALL ON public.material_products TO service_role;
ALTER TABLE public.material_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view material_products"
  ON public.material_products FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members manage material_products"
  ON public.material_products FOR ALL
  USING (public.is_company_member(auth.uid(), company_id))
  WITH CHECK (public.is_company_member(auth.uid(), company_id));

CREATE TRIGGER trg_material_products_updated
  BEFORE UPDATE ON public.material_products
  FOR EACH ROW EXECUTE FUNCTION public.material_touch_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.material_lists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.material_list_items;
