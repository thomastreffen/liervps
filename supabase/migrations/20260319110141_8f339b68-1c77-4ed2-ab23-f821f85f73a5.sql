
-- ============================================================
-- Secure password storage for supplier integrations
-- Only accessible via service_role (no RLS policies for authenticated users)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.supplier_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL UNIQUE REFERENCES public.supplier_integrations(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  encrypted_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_secrets ENABLE ROW LEVEL SECURITY;

-- Intentionally NO policies for authenticated users.
-- Only service_role can access this table, ensuring passwords
-- are never exposed to the frontend.

CREATE TRIGGER update_supplier_secrets_updated_at
  BEFORE UPDATE ON public.supplier_secrets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_supplier_secrets_integration ON public.supplier_secrets(integration_id);
CREATE INDEX idx_supplier_secrets_company ON public.supplier_secrets(company_id);
