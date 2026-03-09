
-- Import log table
CREATE TABLE public.import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type text NOT NULL CHECK (import_type IN ('project', 'quote')),
  file_name text NOT NULL,
  file_hash text,
  imported_by uuid NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  total_rows int NOT NULL DEFAULT 0,
  created_count int NOT NULL DEFAULT 0,
  updated_count int NOT NULL DEFAULT 0,
  ignored_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'partial')),
  summary_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Import results table
CREATE TABLE public.import_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_log_id uuid NOT NULL REFERENCES public.import_logs(id) ON DELETE CASCADE,
  external_key text,
  entity_type text NOT NULL,
  action_taken text NOT NULL CHECK (action_taken IN ('created', 'updated', 'ignored', 'failed', 'skipped')),
  status text NOT NULL DEFAULT 'ok',
  message text,
  raw_payload_json jsonb,
  resolved_entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- External Tripletex identifiers on events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS external_tripletex_id text;
CREATE INDEX IF NOT EXISTS idx_events_tripletex_id ON public.events (external_tripletex_id) WHERE external_tripletex_id IS NOT NULL;

-- External Tripletex identifiers on customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS external_tripletex_id text;
CREATE INDEX IF NOT EXISTS idx_customers_tripletex_id ON public.customers (external_tripletex_id) WHERE external_tripletex_id IS NOT NULL;

-- External Tripletex identifiers on offers
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS external_tripletex_number text;
CREATE INDEX IF NOT EXISTS idx_offers_tripletex_number ON public.offers (external_tripletex_number) WHERE external_tripletex_number IS NOT NULL;

-- External Tripletex identifiers on calculations  
ALTER TABLE public.calculations ADD COLUMN IF NOT EXISTS external_tripletex_number text;

-- RLS for import_logs
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage import_logs" ON public.import_logs
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- RLS for import_results
ALTER TABLE public.import_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage import_results" ON public.import_results
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
