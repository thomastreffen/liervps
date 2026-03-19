
-- =====================================================
-- TENANT ISOLATION & RBAC HARDENING
-- Grossistintegrasjon, Produktmodul, Innkjøpsmodul
-- =====================================================

-- 1. supplier_secrets: Add RLS policies (currently has NONE for anon/authenticated)
-- Only service_role should ever touch this, but deny all authenticated access explicitly
CREATE POLICY "No direct access to secrets"
  ON public.supplier_secrets FOR SELECT
  TO authenticated
  USING (false);

CREATE POLICY "No direct insert to secrets"
  ON public.supplier_secrets FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "No direct update to secrets"
  ON public.supplier_secrets FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "No direct delete to secrets"
  ON public.supplier_secrets FOR DELETE
  TO authenticated
  USING (false);

-- 2. Tighten supplier_integrations: add SELECT for company members (read-only view)
-- Currently only admin ALL exists, regular users can't see integration status
CREATE POLICY "Users see own company integrations"
  ON public.supplier_integrations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.company_id = supplier_integrations.company_id
        AND um.is_active = true
    )
    OR check_permission_v2(auth.uid(), 'scope.view.all')
  );

-- 3. Create a security definer function for company membership validation
-- Used by edge functions to validate company_id server-side
CREATE OR REPLACE FUNCTION public.is_company_member(_auth_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_memberships
    WHERE user_id = _auth_user_id
      AND company_id = _company_id
      AND is_active = true
  )
$$;

-- 4. Create audit_log entries support for supplier actions
-- (audit_log table already exists, we just need to use it)

-- 5. Add purchasing-specific permission check function
CREATE OR REPLACE FUNCTION public.can_manage_supplier_integrations(_auth_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.check_permission_v2(_auth_user_id, 'admin.manage_users')
    OR public.check_permission_v2(_auth_user_id, 'purchasing.manage_integrations')
$$;
