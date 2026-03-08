
-- Customer portal users table
CREATE TABLE public.customer_portal_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  phone text,
  company_id uuid REFERENCES public.internal_companies(id),
  customer_id uuid REFERENCES public.customers(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disabled')),
  invited_by uuid,
  invited_at timestamptz DEFAULT now(),
  activated_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(email)
);

-- Link customer portal users to specific projects
CREATE TABLE public.customer_portal_project_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id uuid REFERENCES public.customer_portal_users(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(portal_user_id, project_id)
);

-- Enable RLS
ALTER TABLE public.customer_portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_portal_project_access ENABLE ROW LEVEL SECURITY;

-- RLS: Customer portal users can only see themselves
CREATE POLICY "Portal users can read own profile"
  ON public.customer_portal_users FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_admin());

-- RLS: Admins can manage portal users
CREATE POLICY "Admins can manage portal users"
  ON public.customer_portal_users FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- RLS: Portal users can see their own project access
CREATE POLICY "Portal users can read own project access"
  ON public.customer_portal_project_access FOR SELECT
  TO authenticated
  USING (
    portal_user_id IN (
      SELECT id FROM public.customer_portal_users WHERE auth_user_id = auth.uid()
    )
    OR public.is_admin()
  );

-- RLS: Admins can manage project access
CREATE POLICY "Admins can manage project access"
  ON public.customer_portal_project_access FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Add customer_user to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'customer_user';
