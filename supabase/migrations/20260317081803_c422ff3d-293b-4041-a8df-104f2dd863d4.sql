
-- Customer tags table
CREATE TABLE public.customer_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.internal_companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);

ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view customer tags"
  ON public.customer_tags FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage customer tags"
  ON public.customer_tags FOR ALL TO authenticated
  USING (public.check_permission_v2(auth.uid(), 'admin.manage_users'));

-- Customer tag relations (many-to-many)
CREATE TABLE public.customer_tag_relations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.customer_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_id, tag_id)
);

ALTER TABLE public.customer_tag_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tag relations"
  ON public.customer_tag_relations FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage tag relations"
  ON public.customer_tag_relations FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete tag relations"
  ON public.customer_tag_relations FOR DELETE TO authenticated
  USING (true);

-- Customer value levels per company
CREATE TABLE public.customer_value_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.internal_companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

ALTER TABLE public.customer_value_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view value levels"
  ON public.customer_value_levels FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage value levels"
  ON public.customer_value_levels FOR ALL TO authenticated
  USING (public.check_permission_v2(auth.uid(), 'admin.manage_users'));

-- Add customer_value column to customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS customer_value TEXT;

-- Add products_of_interest to customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS products_of_interest TEXT[] DEFAULT '{}';

-- Seed default value levels for all existing companies
INSERT INTO public.customer_value_levels (company_id, code, label, color, sort_order)
SELECT c.id, vals.code, vals.label, vals.color, vals.sort_order
FROM public.internal_companies c
CROSS JOIN (VALUES
  ('A', 'Superkunde', '#22c55e', 1),
  ('B', 'God kunde', '#eab308', 2),
  ('C', 'Normal', '#f97316', 3),
  ('D', 'Lav verdi', '#ef4444', 4)
) AS vals(code, label, color, sort_order)
WHERE c.is_active = true
ON CONFLICT (company_id, code) DO NOTHING;
