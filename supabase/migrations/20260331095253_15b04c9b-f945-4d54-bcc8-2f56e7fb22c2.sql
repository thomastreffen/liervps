
-- Cross-company scoped access grants for order assignments
CREATE TABLE public.cross_company_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entity_type text NOT NULL DEFAULT 'order_form_submission',
  entity_id uuid NOT NULL,
  source_company_id uuid REFERENCES public.internal_companies(id),
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  reason text NOT NULL DEFAULT 'assignment',
  UNIQUE (user_id, entity_type, entity_id)
);

ALTER TABLE public.cross_company_access_grants ENABLE ROW LEVEL SECURITY;

-- Admin/service can manage grants
CREATE POLICY "Admins manage cross-company grants"
  ON public.cross_company_access_grants
  FOR ALL
  TO authenticated
  USING (public.is_admin());

-- Users can see their own grants
CREATE POLICY "Users see own grants"
  ON public.cross_company_access_grants
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Function to check if user has cross-company access to an order
CREATE OR REPLACE FUNCTION public.has_cross_company_order_access(_auth_user_id uuid, _submission_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cross_company_access_grants
    WHERE user_id = _auth_user_id
      AND entity_type = 'order_form_submission'
      AND entity_id = _submission_id
      AND revoked_at IS NULL
  )
$$;

-- Index for fast lookups
CREATE INDEX idx_cross_company_grants_user_entity ON public.cross_company_access_grants(user_id, entity_type, entity_id) WHERE revoked_at IS NULL;
