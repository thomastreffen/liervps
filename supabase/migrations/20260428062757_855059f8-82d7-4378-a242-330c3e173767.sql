
-- =========================================================
-- KALKYLEMOTOR (Fase 1) — pakker, felter, satser, normtider, linjer
-- =========================================================

-- Helper: super_admin check
CREATE OR REPLACE FUNCTION public.is_super_admin(_auth_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(_auth_user_id, 'super_admin'::app_role) $$;

-- ---------- calc_packages ----------
CREATE TABLE public.calc_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NULL,
  slug text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  description text,
  version int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  default_sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (company_id, slug, version)
);
CREATE INDEX idx_calc_packages_company ON public.calc_packages(company_id) WHERE is_active;
ALTER TABLE public.calc_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calc_packages select" ON public.calc_packages FOR SELECT TO authenticated
  USING (company_id IS NULL OR public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "calc_packages insert" ON public.calc_packages FOR INSERT TO authenticated
  WITH CHECK ((company_id IS NULL AND public.is_super_admin(auth.uid()))
              OR (company_id IS NOT NULL AND public.user_has_company_access(auth.uid(), company_id)));
CREATE POLICY "calc_packages update" ON public.calc_packages FOR UPDATE TO authenticated
  USING ((company_id IS NULL AND public.is_super_admin(auth.uid()))
         OR (company_id IS NOT NULL AND public.user_has_company_access(auth.uid(), company_id)));
CREATE POLICY "calc_packages delete" ON public.calc_packages FOR DELETE TO authenticated
  USING ((company_id IS NULL AND public.is_super_admin(auth.uid()))
         OR (company_id IS NOT NULL AND public.user_has_company_access(auth.uid(), company_id)));

CREATE TRIGGER trg_calc_packages_updated BEFORE UPDATE ON public.calc_packages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- calc_package_fields ----------
CREATE TABLE public.calc_package_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.calc_packages(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL, -- text|number|percent|date|boolean|select|multiselect|lookup|derived
  unit text,
  is_required boolean NOT NULL DEFAULT false,
  default_value jsonb,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  visibility_rule jsonb,
  validation_rule jsonb,
  section_key text NOT NULL DEFAULT 'general',
  help_text text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_id, field_key)
);
ALTER TABLE public.calc_package_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calc_package_fields select" ON public.calc_package_fields FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.calc_packages p WHERE p.id = package_id
    AND (p.company_id IS NULL OR public.user_has_company_access(auth.uid(), p.company_id))));
CREATE POLICY "calc_package_fields write" ON public.calc_package_fields FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.calc_packages p WHERE p.id = package_id
    AND ((p.company_id IS NULL AND public.is_super_admin(auth.uid()))
         OR (p.company_id IS NOT NULL AND public.user_has_company_access(auth.uid(), p.company_id)))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.calc_packages p WHERE p.id = package_id
    AND ((p.company_id IS NULL AND public.is_super_admin(auth.uid()))
         OR (p.company_id IS NOT NULL AND public.user_has_company_access(auth.uid(), p.company_id)))));

-- ---------- calc_rate_tables ----------
CREATE TABLE public.calc_rate_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NULL,
  package_id uuid NULL REFERENCES public.calc_packages(id) ON DELETE SET NULL,
  name text NOT NULL,
  version int NOT NULL DEFAULT 1,
  valid_from date,
  valid_to date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.calc_rate_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calc_rate_tables select" ON public.calc_rate_tables FOR SELECT TO authenticated
  USING (company_id IS NULL OR public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "calc_rate_tables write" ON public.calc_rate_tables FOR ALL TO authenticated
  USING ((company_id IS NULL AND public.is_super_admin(auth.uid()))
         OR (company_id IS NOT NULL AND public.user_has_company_access(auth.uid(), company_id)))
  WITH CHECK ((company_id IS NULL AND public.is_super_admin(auth.uid()))
              OR (company_id IS NOT NULL AND public.user_has_company_access(auth.uid(), company_id)));
CREATE TRIGGER trg_calc_rate_tables_updated BEFORE UPDATE ON public.calc_rate_tables
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- calc_rate_table_rows ----------
CREATE TABLE public.calc_rate_table_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_table_id uuid NOT NULL REFERENCES public.calc_rate_tables(id) ON DELETE CASCADE,
  rate_key text NOT NULL,
  label text,
  value numeric NOT NULL DEFAULT 0,
  unit text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0
);
CREATE INDEX idx_calc_rate_rows_table ON public.calc_rate_table_rows(rate_table_id);
ALTER TABLE public.calc_rate_table_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calc_rate_rows select" ON public.calc_rate_table_rows FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.calc_rate_tables t WHERE t.id = rate_table_id
    AND (t.company_id IS NULL OR public.user_has_company_access(auth.uid(), t.company_id))));
CREATE POLICY "calc_rate_rows write" ON public.calc_rate_table_rows FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.calc_rate_tables t WHERE t.id = rate_table_id
    AND ((t.company_id IS NULL AND public.is_super_admin(auth.uid()))
         OR (t.company_id IS NOT NULL AND public.user_has_company_access(auth.uid(), t.company_id)))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.calc_rate_tables t WHERE t.id = rate_table_id
    AND ((t.company_id IS NULL AND public.is_super_admin(auth.uid()))
         OR (t.company_id IS NOT NULL AND public.user_has_company_access(auth.uid(), t.company_id)))));

-- ---------- calc_norm_tables ----------
CREATE TABLE public.calc_norm_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NULL,
  package_id uuid NULL REFERENCES public.calc_packages(id) ON DELETE SET NULL,
  name text NOT NULL,
  version int NOT NULL DEFAULT 1,
  source text,
  valid_from date,
  valid_to date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.calc_norm_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calc_norm_tables select" ON public.calc_norm_tables FOR SELECT TO authenticated
  USING (company_id IS NULL OR public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "calc_norm_tables write" ON public.calc_norm_tables FOR ALL TO authenticated
  USING ((company_id IS NULL AND public.is_super_admin(auth.uid()))
         OR (company_id IS NOT NULL AND public.user_has_company_access(auth.uid(), company_id)))
  WITH CHECK ((company_id IS NULL AND public.is_super_admin(auth.uid()))
              OR (company_id IS NOT NULL AND public.user_has_company_access(auth.uid(), company_id)));
CREATE TRIGGER trg_calc_norm_tables_updated BEFORE UPDATE ON public.calc_norm_tables
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- calc_norm_table_rows ----------
CREATE TABLE public.calc_norm_table_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  norm_table_id uuid NOT NULL REFERENCES public.calc_norm_tables(id) ON DELETE CASCADE,
  element_key text NOT NULL,
  label text,
  hours numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'stk',
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0
);
CREATE INDEX idx_calc_norm_rows_table ON public.calc_norm_table_rows(norm_table_id);
ALTER TABLE public.calc_norm_table_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calc_norm_rows select" ON public.calc_norm_table_rows FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.calc_norm_tables t WHERE t.id = norm_table_id
    AND (t.company_id IS NULL OR public.user_has_company_access(auth.uid(), t.company_id))));
CREATE POLICY "calc_norm_rows write" ON public.calc_norm_table_rows FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.calc_norm_tables t WHERE t.id = norm_table_id
    AND ((t.company_id IS NULL AND public.is_super_admin(auth.uid()))
         OR (t.company_id IS NOT NULL AND public.user_has_company_access(auth.uid(), t.company_id)))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.calc_norm_tables t WHERE t.id = norm_table_id
    AND ((t.company_id IS NULL AND public.is_super_admin(auth.uid()))
         OR (t.company_id IS NOT NULL AND public.user_has_company_access(auth.uid(), t.company_id)))));

-- ---------- Utvid calculations ----------
ALTER TABLE public.calculations
  ADD COLUMN IF NOT EXISTS package_id uuid REFERENCES public.calc_packages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rate_table_id uuid REFERENCES public.calc_rate_tables(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS norm_table_id uuid REFERENCES public.calc_norm_tables(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS totals_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ---------- calculation_lines ----------
CREATE TABLE public.calculation_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calculation_id uuid NOT NULL REFERENCES public.calculations(id) ON DELETE CASCADE,
  line_key text,
  source_type text NOT NULL DEFAULT 'rule', -- rule|component|manual|adjustment
  source_ref text,
  description text NOT NULL,
  qty numeric NOT NULL DEFAULT 0,
  unit text,
  norm_hours numeric NOT NULL DEFAULT 0,
  adjusted_hours numeric NOT NULL DEFAULT 0,
  cost_amount numeric NOT NULL DEFAULT 0,
  sales_amount numeric NOT NULL DEFAULT 0,
  is_internal_only boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  is_overridden boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_calc_lines_calc ON public.calculation_lines(calculation_id);
ALTER TABLE public.calculation_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calc_lines select" ON public.calculation_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.calculations c WHERE c.id = calculation_id
    AND c.deleted_at IS NULL
    AND (c.company_id IS NULL OR public.user_has_company_access(auth.uid(), c.company_id))));
CREATE POLICY "calc_lines write" ON public.calculation_lines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.calculations c WHERE c.id = calculation_id
    AND c.deleted_at IS NULL
    AND (c.company_id IS NULL OR public.user_has_company_access(auth.uid(), c.company_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.calculations c WHERE c.id = calculation_id
    AND c.deleted_at IS NULL
    AND (c.company_id IS NULL OR public.user_has_company_access(auth.uid(), c.company_id))));

CREATE TRIGGER trg_calc_lines_updated BEFORE UPDATE ON public.calculation_lines
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
