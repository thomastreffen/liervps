-- Extend submissions
ALTER TABLE public.hms_submissions
  ADD COLUMN IF NOT EXISTS event_id uuid,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS template_version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS hms_areas text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_hms_submissions_event ON public.hms_submissions(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hms_submissions_status ON public.hms_submissions(status) WHERE deleted_at IS NULL;

-- Extend signatures
ALTER TABLE public.hms_submission_signatures
  ADD COLUMN IF NOT EXISTS signature_type text NOT NULL DEFAULT 'internal_confirm',
  ADD COLUMN IF NOT EXISTS confirmation_text text NOT NULL DEFAULT 'Jeg bekrefter at opplysningene er gjennomgått og at nødvendige risikoreduserende tiltak er vurdert.',
  ADD COLUMN IF NOT EXISTS role_label text,
  ADD COLUMN IF NOT EXISTS template_version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS participant_id uuid REFERENCES public.hms_submission_participants(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE public.hms_submission_signatures
    ADD CONSTRAINT hms_sig_type_check CHECK (signature_type IN ('internal_confirm','drawn_signature'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend participants
ALTER TABLE public.hms_submission_participants
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signature_id uuid REFERENCES public.hms_submission_signatures(id) ON DELETE SET NULL;

-- Storage bucket for HMS attachments + drawn signatures
INSERT INTO storage.buckets (id, name, public)
VALUES ('hms-attachments', 'hms-attachments', false)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "hms_attachments_authenticated_read"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'hms-attachments');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "hms_attachments_authenticated_insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'hms-attachments');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "hms_attachments_owner_update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'hms-attachments' AND owner = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "hms_attachments_owner_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'hms-attachments' AND owner = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
