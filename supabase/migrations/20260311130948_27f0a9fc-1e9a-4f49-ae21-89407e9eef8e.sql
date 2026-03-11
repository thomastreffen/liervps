
-- Company fag profiles for AI context specialization
CREATE TABLE public.fag_company_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id) ON DELETE CASCADE,
  specialization text[] NOT NULL DEFAULT ARRAY['Tavler og fordelingsanlegg', 'Lavspent kraftfordeling', 'Industri og næringsbygg'],
  primary_standards text[] NOT NULL DEFAULT ARRAY['NEK 439'],
  secondary_standards text[] NOT NULL DEFAULT ARRAY['NEK 400', 'FEL', 'FSE'],
  default_regime text NOT NULL DEFAULT 'nek',
  custom_system_prompt text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.fag_company_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own company fag profile"
  ON public.fag_company_profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.company_id = fag_company_profiles.company_id
        AND um.is_active = true
    )
    OR public.is_admin()
  );

CREATE POLICY "Admins can manage fag profiles"
  ON public.fag_company_profiles FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Add follow-up support: link fag_requests to parent for threading
ALTER TABLE public.fag_requests ADD COLUMN IF NOT EXISTS parent_request_id uuid REFERENCES public.fag_requests(id);
