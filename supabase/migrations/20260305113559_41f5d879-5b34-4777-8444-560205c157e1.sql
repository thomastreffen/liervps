
-- Module registry: global on/off for each module
CREATE TABLE public.module_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text UNIQUE NOT NULL,
  label text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Per-user overrides
CREATE TABLE public.module_user_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text NOT NULL REFERENCES public.module_settings(module_key) ON DELETE CASCADE,
  user_account_id uuid NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(module_key, user_account_id)
);

-- RLS
ALTER TABLE public.module_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_user_overrides ENABLE ROW LEVEL SECURITY;

-- Everyone can read module_settings
CREATE POLICY "Authenticated users can read module_settings"
  ON public.module_settings FOR SELECT TO authenticated USING (true);

-- Only superadmin can modify module_settings
CREATE POLICY "Superadmin can manage module_settings"
  ON public.module_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Users can read their own overrides; superadmin can read all
CREATE POLICY "Users read own module overrides"
  ON public.module_user_overrides FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR user_account_id = public.get_user_account_id(auth.uid())
  );

-- Superadmin can manage all overrides
CREATE POLICY "Superadmin can manage module overrides"
  ON public.module_user_overrides FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Seed default modules
INSERT INTO public.module_settings (module_key, label, sort_order) VALUES
  ('overview', 'Hjem', 1),
  ('projects', 'Prosjekter', 2),
  ('resource_plan', 'Ressursplan', 3),
  ('inbox', 'Postkontoret', 4),
  ('sales', 'Salg', 5),
  ('customers', 'Kunder', 6),
  ('admin_company', 'Firma', 10),
  ('admin_org', 'Organisasjon', 11),
  ('admin_people', 'Personer', 12),
  ('admin_roles', 'Roller', 13),
  ('admin_postkontor', 'Postkontoret (admin)', 14),
  ('admin_forms', 'Skjemamaler', 15),
  ('admin_integrations', 'Integrasjoner', 16),
  ('admin_integration_health', 'Integrasjonshelse', 17),
  ('admin_system_health', 'Systemhelse', 18),
  ('admin_data_integrity', 'Dataintegritet', 19),
  ('admin_contract_cron', 'Kontraktvarsler', 20),
  ('admin_microsoft', 'Microsoft', 21),
  ('admin_settings', 'Innstillinger', 22),
  ('admin_trash', 'Papirkurv', 23);
