
-- ============ Permissions ============
INSERT INTO public.permissions (key, module, description) VALUES
  ('security.view', 'security', 'Se sikkerhetsstatus og prosjektkrav'),
  ('security.manage', 'security', 'Endre sikkerhetsstatus og prosjektkrav'),
  ('security.sensitive.view', 'security', 'Se sensitive sikkerhetsnotater'),
  ('security.export', 'security', 'Eksportere sikkerhetsdata'),
  ('security.audit.view', 'security', 'Se sikkerhets-revisjonslogg')
ON CONFLICT (key) DO NOTHING;

-- Grant to Superadmin (all)
INSERT INTO public.role_permissions (role_id, permission_key, allowed)
SELECT 'b0000000-0000-0000-0000-000000000004'::uuid, k, true
FROM unnest(ARRAY['security.view','security.manage','security.sensitive.view','security.export','security.audit.view']) AS k
ON CONFLICT (role_id, permission_key) DO UPDATE SET allowed = true;

-- Grant view + manage to Planlegger/Admin
INSERT INTO public.role_permissions (role_id, permission_key, allowed)
SELECT 'b0000000-0000-0000-0000-000000000003'::uuid, k, true
FROM unnest(ARRAY['security.view','security.manage']) AS k
ON CONFLICT (role_id, permission_key) DO UPDATE SET allowed = true;

-- ============ person_security_profiles ============
CREATE TABLE public.person_security_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  clearance_status text NOT NULL DEFAULT 'unknown',
  clearance_level text NULL,
  clearance_valid_until date NULL,
  pob_status text NOT NULL DEFAULT 'not_required',
  nda_status text NOT NULL DEFAULT 'not_required',
  sensitive_note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_security_profiles TO authenticated;
GRANT ALL ON public.person_security_profiles TO service_role;
ALTER TABLE public.person_security_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security view profiles" ON public.person_security_profiles
  FOR SELECT TO authenticated
  USING (public.check_permission(auth.uid(), 'security.view') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "security manage profiles" ON public.person_security_profiles
  FOR ALL TO authenticated
  USING (public.check_permission(auth.uid(), 'security.manage') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.check_permission(auth.uid(), 'security.manage') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER set_psp_updated_at BEFORE UPDATE ON public.person_security_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ person_customer_authorizations ============
CREATE TABLE public.person_customer_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  project_id uuid NULL REFERENCES public.events(id) ON DELETE SET NULL,
  authorization_status text NOT NULL DEFAULT 'not_started',
  interview_date date NULL,
  valid_until date NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_customer_authorizations TO authenticated;
GRANT ALL ON public.person_customer_authorizations TO service_role;
ALTER TABLE public.person_customer_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security view auths" ON public.person_customer_authorizations
  FOR SELECT TO authenticated
  USING (public.check_permission(auth.uid(), 'security.view') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "security manage auths" ON public.person_customer_authorizations
  FOR ALL TO authenticated
  USING (public.check_permission(auth.uid(), 'security.manage') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.check_permission(auth.uid(), 'security.manage') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_pca_person ON public.person_customer_authorizations(person_id);
CREATE INDEX idx_pca_project ON public.person_customer_authorizations(project_id);

CREATE TRIGGER set_pca_updated_at BEFORE UPDATE ON public.person_customer_authorizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ project_security_requirements ============
CREATE TABLE public.project_security_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  requires_clearance boolean NOT NULL DEFAULT false,
  requires_customer_authorization boolean NOT NULL DEFAULT false,
  requires_pob boolean NOT NULL DEFAULT false,
  requires_nda boolean NOT NULL DEFAULT false,
  customer_name text NULL,
  deadline date NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_security_requirements TO authenticated;
GRANT ALL ON public.project_security_requirements TO service_role;
ALTER TABLE public.project_security_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security view project req" ON public.project_security_requirements
  FOR SELECT TO authenticated
  USING (public.check_permission(auth.uid(), 'security.view') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "security manage project req" ON public.project_security_requirements
  FOR ALL TO authenticated
  USING (public.check_permission(auth.uid(), 'security.manage') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.check_permission(auth.uid(), 'security.manage') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER set_psr_updated_at BEFORE UPDATE ON public.project_security_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ security_audit_log ============
CREATE TABLE public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.security_audit_log TO authenticated;
GRANT ALL ON public.security_audit_log TO service_role;
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security audit view" ON public.security_audit_log
  FOR SELECT TO authenticated
  USING (public.check_permission(auth.uid(), 'security.audit.view') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "security audit insert" ON public.security_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX idx_sal_target ON public.security_audit_log(target_type, target_id);
