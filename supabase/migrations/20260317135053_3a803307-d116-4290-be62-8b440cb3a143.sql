
-- Products table for reusable product catalog
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.internal_companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  default_unit TEXT NOT NULL DEFAULT 'stk',
  default_unit_price NUMERIC NOT NULL DEFAULT 0,
  default_vat_rate NUMERIC NOT NULL DEFAULT 25,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read products"
  ON public.products FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update products"
  ON public.products FOR UPDATE TO authenticated
  USING (true);
