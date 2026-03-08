
-- Service journal persistence & versioning
CREATE TABLE public.service_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.internal_companies(id),
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','approved','sent')),
  report_type text NOT NULL DEFAULT 'servicejournal' CHECK (report_type IN ('servicejournal','arbeidsrapport')),
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  signatures jsonb DEFAULT '{}'::jsonb,
  section_visibility jsonb DEFAULT '{}'::jsonb,
  pdf_storage_path text,
  approved_at timestamptz,
  approved_by uuid REFERENCES public.user_accounts(id),
  sent_at timestamptz,
  sent_to_email text,
  created_by uuid REFERENCES public.user_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Share links for read-only access
CREATE TABLE public.service_journal_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES public.service_journals(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  expires_at timestamptz,
  pin_hash text,
  view_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.user_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_service_journals_project ON public.service_journals(project_id);
CREATE INDEX idx_service_journals_status ON public.service_journals(status);
CREATE INDEX idx_service_journal_shares_token ON public.service_journal_shares(token);

-- RLS
ALTER TABLE public.service_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_journal_shares ENABLE ROW LEVEL SECURITY;

-- Journals: project members can read, project admins can write
CREATE POLICY "Project members can view journals"
  ON public.service_journals FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Project admins can insert journals"
  ON public.service_journals FOR INSERT TO authenticated
  WITH CHECK (public.is_project_admin(auth.uid(), project_id));

CREATE POLICY "Project admins can update journals"
  ON public.service_journals FOR UPDATE TO authenticated
  USING (public.is_project_admin(auth.uid(), project_id));

-- Shares: same access as parent journal
CREATE POLICY "Journal members can view shares"
  ON public.service_journal_shares FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.service_journals sj
    WHERE sj.id = journal_id
      AND public.is_project_member(auth.uid(), sj.project_id)
  ));

CREATE POLICY "Project admins can manage shares"
  ON public.service_journal_shares FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.service_journals sj
    WHERE sj.id = journal_id
      AND public.is_project_admin(auth.uid(), sj.project_id)
  ));

CREATE POLICY "Project admins can delete shares"
  ON public.service_journal_shares FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.service_journals sj
    WHERE sj.id = journal_id
      AND public.is_project_admin(auth.uid(), sj.project_id)
  ));

-- Updated_at trigger
CREATE TRIGGER set_service_journals_updated_at
  BEFORE UPDATE ON public.service_journals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
