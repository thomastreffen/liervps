
-- A: Thread participants table
CREATE TABLE public.conversation_thread_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id),
  project_id uuid NOT NULL REFERENCES public.events(id),
  thread_id uuid NOT NULL REFERENCES public.conversation_threads(id) ON DELETE CASCADE,
  participant_type text NOT NULL CHECK (participant_type IN ('internal', 'external')),
  user_account_id uuid REFERENCES public.user_accounts(id),
  email text,
  display_name text,
  added_by uuid REFERENCES public.user_accounts(id),
  added_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraints
CREATE UNIQUE INDEX idx_ctp_internal ON public.conversation_thread_participants (thread_id, user_account_id) WHERE user_account_id IS NOT NULL;
CREATE UNIQUE INDEX idx_ctp_external ON public.conversation_thread_participants (thread_id, email) WHERE email IS NOT NULL;

ALTER TABLE public.conversation_thread_participants ENABLE ROW LEVEL SECURITY;

-- Participants visible to anyone with samtaler access or project admin
CREATE POLICY "participants_select" ON public.conversation_thread_participants
  FOR SELECT TO authenticated
  USING (
    public.is_project_admin(auth.uid(), project_id)
    OR public.has_samtaler_access(auth.uid(), project_id)
  );

-- Only project admin / owner can manage participants
CREATE POLICY "participants_insert" ON public.conversation_thread_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_project_admin(auth.uid(), project_id)
  );

CREATE POLICY "participants_delete" ON public.conversation_thread_participants
  FOR DELETE TO authenticated
  USING (
    public.is_project_admin(auth.uid(), project_id)
  );

-- Add participants_only flag + email fields to conversation_threads
ALTER TABLE public.conversation_threads
  ADD COLUMN participants_only boolean NOT NULL DEFAULT false,
  ADD COLUMN email_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN email_subject text,
  ADD COLUMN email_thread_id text,
  ADD COLUMN last_emailed_at timestamptz;

-- B: Storage bucket for conversation files (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('conversation-files', 'conversation-files', false);

-- Storage policies for conversation-files
CREATE POLICY "conv_files_authenticated_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'conversation-files');

CREATE POLICY "conv_files_authenticated_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'conversation-files');

-- C: Thread access function (accounts for participants_only)
CREATE OR REPLACE FUNCTION public.has_thread_access(_auth_user_id uuid, _thread_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_threads ct
    WHERE ct.id = _thread_id
      AND (
        -- Admin always
        public.is_project_admin(_auth_user_id, ct.project_id)
        -- Open thread: normal samtaler access
        OR (NOT ct.participants_only AND public.has_samtaler_access(_auth_user_id, ct.project_id))
        -- Participants-only: must be listed as internal participant
        OR (ct.participants_only AND EXISTS (
          SELECT 1 FROM conversation_thread_participants ctp
          JOIN user_accounts ua ON ua.id = ctp.user_account_id
          WHERE ctp.thread_id = ct.id
            AND ua.auth_user_id = _auth_user_id
            AND ua.is_active = true
        ))
      )
  )
$$;
