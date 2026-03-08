
-- Customer accounts (one per customer organization)
CREATE TABLE public.customer_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  org_number text,
  customer_id uuid REFERENCES public.customers(id),
  company_id uuid REFERENCES public.internal_companies(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;

-- Add account_id and portal_role to portal users
ALTER TABLE public.customer_portal_users
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.customer_accounts(id),
  ADD COLUMN IF NOT EXISTS portal_role text NOT NULL DEFAULT 'customer_user'
    CHECK (portal_role IN ('customer_admin', 'customer_user', 'customer_finance'));

-- Link project access to accounts too (account-wide access)
ALTER TABLE public.customer_portal_project_access
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.customer_accounts(id);

-- RLS for customer_accounts
CREATE POLICY "Portal users can read own account"
  ON public.customer_accounts FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT account_id FROM public.customer_portal_users WHERE auth_user_id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY "Admins can manage accounts"
  ON public.customer_accounts FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Customer admins can read other users in their account
CREATE POLICY "Portal users can read account members"
  ON public.customer_portal_users FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR (
      account_id IS NOT NULL
      AND account_id IN (
        SELECT cpu2.account_id FROM public.customer_portal_users cpu2
        WHERE cpu2.auth_user_id = auth.uid() AND cpu2.portal_role = 'customer_admin'
      )
    )
    OR public.is_admin()
  );

-- Account-level project access: all users in account see account's projects
CREATE POLICY "Account users can read account project access"
  ON public.customer_portal_project_access FOR SELECT
  TO authenticated
  USING (
    portal_user_id IN (SELECT id FROM public.customer_portal_users WHERE auth_user_id = auth.uid())
    OR (
      account_id IS NOT NULL
      AND account_id IN (SELECT account_id FROM public.customer_portal_users WHERE auth_user_id = auth.uid())
    )
    OR public.is_admin()
  );
