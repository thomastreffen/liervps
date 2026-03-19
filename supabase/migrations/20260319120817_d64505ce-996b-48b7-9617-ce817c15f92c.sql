
-- =============================================
-- PURCHASE MODULE – Phase 1
-- =============================================

-- Status enum for purchase orders
CREATE TYPE public.purchase_order_status AS ENUM (
  'draft', 'confirmed', 'sent', 'partially_received', 'received', 'cancelled'
);

-- Purchase orders – one per supplier per order event
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.internal_companies(id),
  project_id UUID REFERENCES public.events(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  parent_order_id UUID REFERENCES public.purchase_orders(id),
  order_number TEXT NOT NULL DEFAULT '',
  status public.purchase_order_status NOT NULL DEFAULT 'draft',
  title TEXT NOT NULL DEFAULT '',
  notes TEXT,
  total_ex_vat NUMERIC NOT NULL DEFAULT 0,
  total_inc_vat NUMERIC NOT NULL DEFAULT 0,
  preferred_supplier_threshold NUMERIC NOT NULL DEFAULT 5,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
);

-- Purchase order lines
CREATE TABLE public.purchase_order_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.internal_companies(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  catalog_product_id UUID REFERENCES public.supplier_catalog_products(id),
  supplier_product_id UUID REFERENCES public.supplier_products(id),
  description TEXT NOT NULL DEFAULT '',
  el_number TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'stk',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC NOT NULL DEFAULT 0,
  net_price NUMERIC NOT NULL DEFAULT 0,
  total_ex_vat NUMERIC GENERATED ALWAYS AS (quantity * net_price) STORED,
  vat_rate NUMERIC NOT NULL DEFAULT 25,
  best_available_price NUMERIC,
  best_available_supplier_id UUID REFERENCES public.suppliers(id),
  chosen_supplier_id UUID REFERENCES public.suppliers(id),
  price_saving NUMERIC GENERATED ALWAYS AS (
    CASE WHEN best_available_price IS NOT NULL AND net_price > best_available_price
      THEN (net_price - best_available_price) * quantity
      ELSE 0
    END
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_po_company ON public.purchase_orders(company_id);
CREATE INDEX idx_po_project ON public.purchase_orders(project_id);
CREATE INDEX idx_po_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX idx_po_status ON public.purchase_orders(status);
CREATE INDEX idx_pol_order ON public.purchase_order_lines(purchase_order_id);
CREATE INDEX idx_pol_catalog ON public.purchase_order_lines(catalog_product_id);

-- Sequence for order numbers
CREATE SEQUENCE public.purchase_order_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_purchase_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'PO-' || EXTRACT(YEAR FROM now())::text || '-' || LPAD(nextval('public.purchase_order_number_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_purchase_order_number
  BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_purchase_order_number();

-- Updated_at triggers
CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_order_lines_updated_at
  BEFORE UPDATE ON public.purchase_order_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;

-- Purchase orders policies (company-scoped via membership)
CREATE POLICY "Users can view purchase orders in their company"
  ON public.purchase_orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.company_id = purchase_orders.company_id
        AND um.is_active = true
    )
    OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
  );

CREATE POLICY "Users can create purchase orders in their company"
  ON public.purchase_orders FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.company_id = purchase_orders.company_id
        AND um.is_active = true
    )
    OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
  );

CREATE POLICY "Users can update purchase orders in their company"
  ON public.purchase_orders FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.company_id = purchase_orders.company_id
        AND um.is_active = true
    )
    OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
  );

CREATE POLICY "Users can delete purchase orders in their company"
  ON public.purchase_orders FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
  );

-- Purchase order lines policies
CREATE POLICY "Users can view lines in their company"
  ON public.purchase_order_lines FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.company_id = purchase_order_lines.company_id
        AND um.is_active = true
    )
    OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
  );

CREATE POLICY "Users can manage lines in their company"
  ON public.purchase_order_lines FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.company_id = purchase_order_lines.company_id
        AND um.is_active = true
    )
    OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
  );

CREATE POLICY "Users can update lines in their company"
  ON public.purchase_order_lines FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.company_id = purchase_order_lines.company_id
        AND um.is_active = true
    )
    OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
  );

CREATE POLICY "Users can delete lines in their company"
  ON public.purchase_order_lines FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.company_id = purchase_order_lines.company_id
        AND um.is_active = true
    )
    OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
  );
