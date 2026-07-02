
-- Fase A: Provider-abstraksjon for integrasjoner
CREATE TABLE public.integration_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.internal_companies(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('sso','calendar','mail','files','meetings')),
  provider TEXT NOT NULL CHECK (provider IN ('google','microsoft','none')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, scope)
);

GRANT SELECT ON public.integration_providers TO authenticated;
GRANT ALL ON public.integration_providers TO service_role;
ALTER TABLE public.integration_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read provider config for their company"
ON public.integration_providers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id = auth.uid()
      AND um.company_id = integration_providers.company_id
      AND um.is_active = true
  )
  OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'super_admin')
);

CREATE POLICY "Super admins manage provider config"
ON public.integration_providers FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'super_admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'super_admin'));

CREATE TABLE public.user_integration_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID REFERENCES public.internal_companies(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google','microsoft')),
  scope TEXT NOT NULL CHECK (scope IN ('sso','calendar','mail','files','meetings','full')),
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  granted_scopes TEXT[] NOT NULL DEFAULT '{}',
  provider_account_email TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, scope)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_integration_tokens TO authenticated;
GRANT ALL ON public.user_integration_tokens TO service_role;
ALTER TABLE public.user_integration_tokens ENABLE ROW LEVEL SECURITY;

-- Users can see WHETHER they have a token (metadata columns only, tokens themselves shouldn't be pulled to client)
CREATE POLICY "Users can view own token rows"
ON public.user_integration_tokens FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own tokens (disconnect)"
ON public.user_integration_tokens FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Inserts/updates only via service role (edge functions), so no INSERT/UPDATE policy for authenticated

CREATE OR REPLACE FUNCTION public._integration_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_integration_providers_touch
BEFORE UPDATE ON public.integration_providers
FOR EACH ROW EXECUTE FUNCTION public._integration_touch_updated_at();

CREATE TRIGGER trg_user_integration_tokens_touch
BEFORE UPDATE ON public.user_integration_tokens
FOR EACH ROW EXECUTE FUNCTION public._integration_touch_updated_at();

-- Helper: resolve active provider for a company + scope
CREATE OR REPLACE FUNCTION public.get_active_provider(_company_id UUID, _scope TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT provider FROM public.integration_providers
  WHERE company_id = _company_id AND scope = _scope AND is_active = true
  LIMIT 1;
$$;
