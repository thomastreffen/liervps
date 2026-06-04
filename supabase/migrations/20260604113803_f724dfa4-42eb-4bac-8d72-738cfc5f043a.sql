
-- 1) Mapping-tabell Tripletex <-> MCS events
CREATE TABLE IF NOT EXISTS public.tripletex_project_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  tripletex_project_id text NOT NULL,
  tripletex_project_number text NULL,
  mcs_project_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  last_imported_at timestamptz NULL,
  last_payload_hash text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tripletex_project_mappings TO authenticated;
GRANT ALL ON public.tripletex_project_mappings TO service_role;

ALTER TABLE public.tripletex_project_mappings ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS tripletex_project_mappings_company_ttid_uq
  ON public.tripletex_project_mappings (company_id, tripletex_project_id);

CREATE UNIQUE INDEX IF NOT EXISTS tripletex_project_mappings_company_ttnum_uq
  ON public.tripletex_project_mappings (company_id, tripletex_project_number)
  WHERE tripletex_project_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS tripletex_project_mappings_mcs_idx
  ON public.tripletex_project_mappings (mcs_project_id);

-- Adgangsregler: bruker må være medlem av company (eller superadmin).
-- Vi forutsetter at user_memberships(user_id, company_id) eksisterer i prosjektet.
CREATE POLICY "Members can read tripletex mappings for their company"
  ON public.tripletex_project_mappings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.company_id = tripletex_project_mappings.company_id
    )
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Members can write tripletex mappings for their company"
  ON public.tripletex_project_mappings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.company_id = tripletex_project_mappings.company_id
    )
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.company_id = tripletex_project_mappings.company_id
    )
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- 2) Import-kjøringer (preview + apply)
CREATE TABLE IF NOT EXISTS public.tripletex_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  started_by uuid NULL,
  mode text NOT NULL CHECK (mode IN ('preview','apply')),
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','completed','failed')),
  source_filename text NULL,
  total_rows integer NOT NULL DEFAULT 0,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  preview_payload jsonb NULL,
  error_message text NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.tripletex_import_runs TO authenticated;
GRANT ALL ON public.tripletex_import_runs TO service_role;

ALTER TABLE public.tripletex_import_runs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS tripletex_import_runs_company_idx
  ON public.tripletex_import_runs (company_id, started_at DESC);

CREATE POLICY "Members can read tripletex import runs"
  ON public.tripletex_import_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.company_id = tripletex_import_runs.company_id
    )
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Members can write tripletex import runs"
  ON public.tripletex_import_runs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.company_id = tripletex_import_runs.company_id
    )
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.company_id = tripletex_import_runs.company_id
    )
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- 3) updated_at-triggere (gjenbruker eksisterende update_updated_at_column hvis den finnes)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE OR REPLACE FUNCTION public.update_updated_at_column()
    RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $f$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $f$;
  END IF;
END
$$;

DROP TRIGGER IF EXISTS trg_tripletex_project_mappings_updated_at ON public.tripletex_project_mappings;
CREATE TRIGGER trg_tripletex_project_mappings_updated_at
  BEFORE UPDATE ON public.tripletex_project_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_tripletex_import_runs_updated_at ON public.tripletex_import_runs;
CREATE TRIGGER trg_tripletex_import_runs_updated_at
  BEFORE UPDATE ON public.tripletex_import_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
