
-- 1) company_reminder_settings
DROP POLICY IF EXISTS "Admins can manage company settings" ON public.company_reminder_settings;
DROP POLICY IF EXISTS "Users can view own company settings" ON public.company_reminder_settings;

CREATE POLICY "Members view company reminder settings"
  ON public.company_reminder_settings FOR SELECT TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Admins manage company reminder settings"
  ON public.company_reminder_settings FOR ALL TO authenticated
  USING (public.is_admin() AND public.user_has_company_access(auth.uid(), company_id))
  WITH CHECK (public.is_admin() AND public.user_has_company_access(auth.uid(), company_id));

-- 2) form_templates
DROP POLICY IF EXISTS "Auth users view form_templates" ON public.form_templates;

CREATE POLICY "Members view form_templates"
  ON public.form_templates FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (company_id IS NULL OR public.user_has_company_access(auth.uid(), company_id))
  );

-- 3) offer_comments — scope via calculations.company_id
DROP POLICY IF EXISTS "Authenticated users can view offer comments" ON public.offer_comments;

CREATE POLICY "Members view offer_comments"
  ON public.offer_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.calculations c
      WHERE c.id = offer_comments.calculation_id
        AND public.user_has_company_access(auth.uid(), c.company_id)
    )
  );

-- 4) order_lines — scope via calculations.company_id
DROP POLICY IF EXISTS "Authenticated users can manage order lines" ON public.order_lines;

CREATE POLICY "Members read order_lines"
  ON public.order_lines FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.calculations c
      WHERE c.id = order_lines.calculation_id
        AND public.user_has_company_access(auth.uid(), c.company_id)
    )
  );

CREATE POLICY "Members write order_lines"
  ON public.order_lines FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.calculations c
      WHERE c.id = order_lines.calculation_id
        AND public.user_has_company_access(auth.uid(), c.company_id)
    )
  );

CREATE POLICY "Members update order_lines"
  ON public.order_lines FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.calculations c
      WHERE c.id = order_lines.calculation_id
        AND public.user_has_company_access(auth.uid(), c.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.calculations c
      WHERE c.id = order_lines.calculation_id
        AND public.user_has_company_access(auth.uid(), c.company_id)
    )
  );

CREATE POLICY "Members delete order_lines"
  ON public.order_lines FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.calculations c
      WHERE c.id = order_lines.calculation_id
        AND public.user_has_company_access(auth.uid(), c.company_id)
    )
  );

-- 5) products — tighten INSERT/UPDATE
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;

CREATE POLICY "Members insert products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Members update products"
  ON public.products FOR UPDATE TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id))
  WITH CHECK (public.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Members delete products"
  ON public.products FOR DELETE TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id));

-- 6) superoffice_settings
DROP POLICY IF EXISTS "Auth users view superoffice_settings" ON public.superoffice_settings;

CREATE POLICY "Members view superoffice_settings"
  ON public.superoffice_settings FOR SELECT TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id));

-- 7) tenant_settings (global key/value — admin only)
DROP POLICY IF EXISTS "Authenticated can view tenant_settings" ON public.tenant_settings;

CREATE POLICY "Admins view tenant_settings"
  ON public.tenant_settings FOR SELECT TO authenticated
  USING (public.is_admin());

-- 8) user_accounts — own row or same-company members
DROP POLICY IF EXISTS "Authenticated can read user_accounts" ON public.user_accounts;

CREATE POLICY "Users read own or same-company accounts"
  ON public.user_accounts FOR SELECT TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.is_active = true
        AND um.company_id = user_accounts.company_id
    )
  );

-- 9) user_roles_v2 / user_permission_overrides_v2 / user_scopes — own row only (admin via existing ALL policy)
DROP POLICY IF EXISTS "Authenticated read user_roles_v2" ON public.user_roles_v2;
DROP POLICY IF EXISTS "Authenticated read overrides_v2" ON public.user_permission_overrides_v2;
DROP POLICY IF EXISTS "Authenticated read user_scopes" ON public.user_scopes;

CREATE POLICY "Users read own role assignments"
  ON public.user_roles_v2 FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_accounts ua
      WHERE ua.id = user_roles_v2.user_account_id
        AND ua.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users read own permission overrides"
  ON public.user_permission_overrides_v2 FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_accounts ua
      WHERE ua.id = user_permission_overrides_v2.user_account_id
        AND ua.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users read own scopes"
  ON public.user_scopes FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_accounts ua
      WHERE ua.id = user_scopes.user_account_id
        AND ua.auth_user_id = auth.uid()
    )
  );
