
-- 1. Add price_source to supplier_prices to track VL/PL/RL origin
ALTER TABLE public.supplier_prices ADD COLUMN IF NOT EXISTS price_source text;
COMMENT ON COLUMN public.supplier_prices.price_source IS 'Origin record type: vl_gross, pl_list, pl_net, rl_discount';

-- 2. Create supplier_price_history for tracking price changes over time
CREATE TABLE public.supplier_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id),
  supplier_id uuid NOT NULL,
  supplier_product_id uuid NOT NULL,
  catalog_product_id uuid REFERENCES public.supplier_catalog_products(id),
  change_type text NOT NULL, -- 'new', 'increase', 'decrease', 'removed'
  old_list_price numeric,
  new_list_price numeric,
  old_net_price numeric,
  new_net_price numeric,
  old_discount_percent numeric,
  new_discount_percent numeric,
  price_source text, -- vl_gross, pl_list, pl_net, rl_discount
  source_file_name text,
  import_job_id uuid,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view price history"
  ON public.supplier_price_history FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE INDEX idx_sph_company_supplier ON public.supplier_price_history(company_id, supplier_id);
CREATE INDEX idx_sph_product ON public.supplier_price_history(supplier_product_id);
CREATE INDEX idx_sph_recorded ON public.supplier_price_history(recorded_at DESC);

-- 3. Add import summary stats columns to product_import_jobs
ALTER TABLE public.product_import_jobs
  ADD COLUMN IF NOT EXISTS summary_stats jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.product_import_jobs.summary_stats IS 'Post-sync report: null_prices, suspect_prices, valid_el_numbers, missing_el_numbers, prices_preserved, sample_products';

-- 4. Add price_preserved flag to supplier_prices to track when old price is kept
ALTER TABLE public.supplier_prices ADD COLUMN IF NOT EXISTS price_preserved boolean DEFAULT false;
COMMENT ON COLUMN public.supplier_prices.price_preserved IS 'True if this price was retained because new feed had no price for this product';
