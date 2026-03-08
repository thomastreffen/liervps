
-- Add billing_status and approval tracking to service_journals
ALTER TABLE public.service_journals
  ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'pending'
    CHECK (billing_status IN ('pending', 'ready_for_billing', 'sent_to_billing', 'billed')),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by_portal_user_id uuid REFERENCES public.customer_portal_users(id),
  ADD COLUMN IF NOT EXISTS approved_version integer,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

-- Invoice basis records
CREATE TABLE public.invoice_basis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.internal_companies(id),
  service_journal_id uuid REFERENCES public.service_journals(id),
  customer_name text NOT NULL,
  customer_id uuid REFERENCES public.customers(id),

  -- Approval info
  approved_at timestamptz NOT NULL,
  approved_by_name text,
  approved_by_portal_user_id uuid REFERENCES public.customer_portal_users(id),
  approved_version integer,

  -- Work summary
  total_hours numeric DEFAULT 0,
  technician_names text[] DEFAULT '{}',
  technician_count integer DEFAULT 0,
  report_count integer DEFAULT 1,
  deviation_count integer DEFAULT 0,
  deviation_notes text,

  -- Status
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'sent_to_billing', 'billed', 'disputed')),
  sent_to_billing_at timestamptz,
  sent_to_billing_by uuid,
  notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (service_journal_id)
);

ALTER TABLE public.invoice_basis ENABLE ROW LEVEL SECURITY;

-- Only internal authenticated users can access
CREATE POLICY "Authenticated users read invoice_basis"
  ON public.invoice_basis FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage invoice_basis"
  ON public.invoice_basis FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
