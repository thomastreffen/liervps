
-- =============================================================
-- PRODUCT MODULE – Foundation Migration
-- Multi-tenant grossist/wholesale integration
-- =============================================================

-- ==================== ENUMS ====================

CREATE TYPE public.supplier_integration_type AS ENUM ('ftp', 'ftps', 'sftp', 'manual', 'api');
CREATE TYPE public.supplier_protocol AS ENUM ('ftp', 'ftps', 'sftp');
CREATE TYPE public.supplier_connection_status AS ENUM ('never_tested', 'ok', 'warning', 'error');
CREATE TYPE public.supplier_sync_frequency AS ENUM ('manual', 'hourly', 'daily');
CREATE TYPE public.product_import_job_type AS ENUM ('connection_test', 'catalog_sync', 'price_sync', 'discount_sync', 'full_sync');
CREATE TYPE public.product_import_job_status AS ENUM ('queued', 'running', 'success', 'partial_success', 'failed');
CREATE TYPE public.product_import_row_status AS ENUM ('parsed', 'failed', 'skipped', 'needs_review');

-- ==================== 1. suppliers ====================

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  integration_type public.supplier_integration_type NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE INDEX idx_suppliers_company ON public.suppliers(company_id);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own company suppliers"
  ON public.suppliers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.company_id = suppliers.company_id
        AND um.is_active = true
    )
    OR public.check_permission_v2(auth.uid(), 'scope.view.all')
  );

CREATE POLICY "Admins manage suppliers"
  ON public.suppliers FOR ALL
  USING (public.check_permission_v2(auth.uid(), 'admin.manage_users'))
  WITH CHECK (public.check_permission_v2(auth.uid(), 'admin.manage_users'));

CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==================== 2. supplier_integrations ====================

CREATE TABLE public.supplier_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  protocol public.supplier_protocol NOT NULL DEFAULT 'sftp',
  host text NOT NULL DEFAULT '',
  port integer NOT NULL DEFAULT 22,
  username text NOT NULL DEFAULT '',
  password_secret_ref text, -- reference to vault/secret, never store plaintext
  remote_base_path text DEFAULT '/',
  catalog_file_pattern text,
  price_file_pattern text,
  discount_file_pattern text,
  invoice_file_pattern text,
  last_connection_status public.supplier_connection_status NOT NULL DEFAULT 'never_tested',
  last_connection_message text,
  last_connected_at timestamptz,
  last_sync_at timestamptz,
  sync_enabled boolean NOT NULL DEFAULT false,
  sync_frequency public.supplier_sync_frequency NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, supplier_id)
);

CREATE INDEX idx_supplier_integrations_company ON public.supplier_integrations(company_id);
CREATE INDEX idx_supplier_integrations_supplier ON public.supplier_integrations(supplier_id);

ALTER TABLE public.supplier_integrations ENABLE ROW LEVEL SECURITY;

-- Only admins can see/manage integrations (contains credentials)
CREATE POLICY "Admins manage integrations"
  ON public.supplier_integrations FOR ALL
  USING (public.check_permission_v2(auth.uid(), 'admin.manage_users'))
  WITH CHECK (public.check_permission_v2(auth.uid(), 'admin.manage_users'));

CREATE TRIGGER update_supplier_integrations_updated_at
  BEFORE UPDATE ON public.supplier_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==================== 3. products ====================

CREATE TABLE public.supplier_catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id) ON DELETE CASCADE,
  el_number text,
  ean text,
  supplier_independent_sku text,
  brand text,
  name text NOT NULL,
  description text,
  unit text,
  category text,
  subcategory text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scp_company ON public.supplier_catalog_products(company_id);
CREATE INDEX idx_scp_el_number ON public.supplier_catalog_products(company_id, el_number) WHERE el_number IS NOT NULL;
CREATE INDEX idx_scp_ean ON public.supplier_catalog_products(company_id, ean) WHERE ean IS NOT NULL;
CREATE INDEX idx_scp_sku ON public.supplier_catalog_products(company_id, supplier_independent_sku) WHERE supplier_independent_sku IS NOT NULL;

ALTER TABLE public.supplier_catalog_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own company products"
  ON public.supplier_catalog_products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.company_id = supplier_catalog_products.company_id
        AND um.is_active = true
    )
    OR public.check_permission_v2(auth.uid(), 'scope.view.all')
  );

CREATE POLICY "Admins manage products"
  ON public.supplier_catalog_products FOR ALL
  USING (public.check_permission_v2(auth.uid(), 'admin.manage_users'))
  WITH CHECK (public.check_permission_v2(auth.uid(), 'admin.manage_users'));

CREATE TRIGGER update_scp_updated_at
  BEFORE UPDATE ON public.supplier_catalog_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==================== 4. supplier_products ====================

CREATE TABLE public.supplier_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.supplier_catalog_products(id) ON DELETE SET NULL,
  supplier_sku text NOT NULL,
  supplier_product_name text,
  supplier_product_description text,
  raw_category text,
  raw_brand text,
  raw_unit text,
  raw_payload jsonb DEFAULT '{}'::jsonb,
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, supplier_id, supplier_sku)
);

CREATE INDEX idx_sp_company ON public.supplier_products(company_id);
CREATE INDEX idx_sp_supplier ON public.supplier_products(supplier_id);
CREATE INDEX idx_sp_product ON public.supplier_products(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_sp_sku ON public.supplier_products(company_id, supplier_sku);

ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own company supplier_products"
  ON public.supplier_products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.company_id = supplier_products.company_id
        AND um.is_active = true
    )
    OR public.check_permission_v2(auth.uid(), 'scope.view.all')
  );

CREATE POLICY "Admins manage supplier_products"
  ON public.supplier_products FOR ALL
  USING (public.check_permission_v2(auth.uid(), 'admin.manage_users'))
  WITH CHECK (public.check_permission_v2(auth.uid(), 'admin.manage_users'));

CREATE TRIGGER update_sp_updated_at
  BEFORE UPDATE ON public.supplier_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==================== 5. supplier_prices ====================

CREATE TABLE public.supplier_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  supplier_product_id uuid NOT NULL REFERENCES public.supplier_products(id) ON DELETE CASCADE,
  price_list_name text,
  list_price numeric(12,2) NOT NULL DEFAULT 0,
  discount_percent numeric(7,4),
  net_price numeric(12,2),
  currency text NOT NULL DEFAULT 'NOK',
  valid_from date,
  valid_to date,
  source_file_name text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sprices_company ON public.supplier_prices(company_id);
CREATE INDEX idx_sprices_supplier_product ON public.supplier_prices(supplier_product_id);
CREATE INDEX idx_sprices_supplier ON public.supplier_prices(supplier_id);
CREATE INDEX idx_sprices_validity ON public.supplier_prices(company_id, supplier_product_id, valid_from, valid_to);

ALTER TABLE public.supplier_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own company prices"
  ON public.supplier_prices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.company_id = supplier_prices.company_id
        AND um.is_active = true
    )
    OR public.check_permission_v2(auth.uid(), 'scope.view.all')
  );

CREATE POLICY "Admins manage prices"
  ON public.supplier_prices FOR ALL
  USING (public.check_permission_v2(auth.uid(), 'admin.manage_users'))
  WITH CHECK (public.check_permission_v2(auth.uid(), 'admin.manage_users'));

-- ==================== 6. product_price_cache ====================

CREATE TABLE public.product_price_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.supplier_catalog_products(id) ON DELETE CASCADE,
  best_supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  best_net_price numeric(12,2),
  price_snapshot jsonb DEFAULT '{}'::jsonb,
  recalculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, product_id)
);

CREATE INDEX idx_ppc_company ON public.product_price_cache(company_id);
CREATE INDEX idx_ppc_product ON public.product_price_cache(product_id);

ALTER TABLE public.product_price_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own company price cache"
  ON public.product_price_cache FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.company_id = product_price_cache.company_id
        AND um.is_active = true
    )
    OR public.check_permission_v2(auth.uid(), 'scope.view.all')
  );

CREATE POLICY "Admins manage price cache"
  ON public.product_price_cache FOR ALL
  USING (public.check_permission_v2(auth.uid(), 'admin.manage_users'))
  WITH CHECK (public.check_permission_v2(auth.uid(), 'admin.manage_users'));

-- ==================== 7. product_import_jobs ====================

CREATE TABLE public.product_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  job_type public.product_import_job_type NOT NULL,
  status public.product_import_job_status NOT NULL DEFAULT 'queued',
  started_at timestamptz,
  finished_at timestamptz,
  files_found jsonb DEFAULT '[]'::jsonb,
  rows_processed integer NOT NULL DEFAULT 0,
  rows_inserted integer NOT NULL DEFAULT 0,
  rows_updated integer NOT NULL DEFAULT 0,
  rows_failed integer NOT NULL DEFAULT 0,
  error_log jsonb DEFAULT '[]'::jsonb,
  triggered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pij_company ON public.product_import_jobs(company_id);
CREATE INDEX idx_pij_supplier ON public.product_import_jobs(supplier_id);
CREATE INDEX idx_pij_status ON public.product_import_jobs(status) WHERE status IN ('queued', 'running');

ALTER TABLE public.product_import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own company import jobs"
  ON public.product_import_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.company_id = product_import_jobs.company_id
        AND um.is_active = true
    )
    OR public.check_permission_v2(auth.uid(), 'scope.view.all')
  );

CREATE POLICY "Admins manage import jobs"
  ON public.product_import_jobs FOR ALL
  USING (public.check_permission_v2(auth.uid(), 'admin.manage_users'))
  WITH CHECK (public.check_permission_v2(auth.uid(), 'admin.manage_users'));

-- ==================== 8. product_import_rows ====================

CREATE TABLE public.product_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id) ON DELETE CASCADE,
  import_job_id uuid NOT NULL REFERENCES public.product_import_jobs(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  row_type text,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  parse_status public.product_import_row_status NOT NULL DEFAULT 'parsed',
  error_message text,
  linked_product_id uuid REFERENCES public.supplier_catalog_products(id) ON DELETE SET NULL,
  linked_supplier_product_id uuid REFERENCES public.supplier_products(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pir_job ON public.product_import_rows(import_job_id);
CREATE INDEX idx_pir_company ON public.product_import_rows(company_id);
CREATE INDEX idx_pir_status ON public.product_import_rows(import_job_id, parse_status);

ALTER TABLE public.product_import_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own company import rows"
  ON public.product_import_rows FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.company_id = product_import_rows.company_id
        AND um.is_active = true
    )
    OR public.check_permission_v2(auth.uid(), 'scope.view.all')
  );

CREATE POLICY "Admins manage import rows"
  ON public.product_import_rows FOR ALL
  USING (public.check_permission_v2(auth.uid(), 'admin.manage_users'))
  WITH CHECK (public.check_permission_v2(auth.uid(), 'admin.manage_users'));
