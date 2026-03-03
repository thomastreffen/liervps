
-- 1. Add allow_participants_invite to conversation_threads
ALTER TABLE public.conversation_threads
  ADD COLUMN IF NOT EXISTS allow_participants_invite boolean NOT NULL DEFAULT true;

-- 2. Add can_invite columns to conversation_thread_participants
ALTER TABLE public.conversation_thread_participants
  ADD COLUMN IF NOT EXISTS can_invite_internal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_invite_external boolean NOT NULL DEFAULT false;

-- 3. Create conversation_thread_invites table
CREATE TABLE public.conversation_thread_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.conversation_threads(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  invited_name text,
  invited_by_participant_id uuid NOT NULL REFERENCES public.conversation_thread_participants(id) ON DELETE CASCADE,
  invite_token text NOT NULL DEFAULT gen_random_uuid()::text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX idx_thread_invites_token ON public.conversation_thread_invites(invite_token);
CREATE INDEX idx_thread_invites_thread_status ON public.conversation_thread_invites(thread_id, status);
CREATE INDEX idx_thread_invites_email ON public.conversation_thread_invites(invited_email);

-- Updated_at trigger
CREATE TRIGGER update_thread_invites_updated_at
  BEFORE UPDATE ON public.conversation_thread_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.conversation_thread_invites ENABLE ROW LEVEL SECURITY;

-- Admin can manage invites
CREATE POLICY "Admin can manage thread invites"
  ON public.conversation_thread_invites
  FOR ALL
  TO authenticated
  USING (
    public.check_permission_v2(auth.uid(), 'admin.manage_users')
    OR public.is_project_admin(auth.uid(), (
      SELECT ct.project_id FROM public.conversation_threads ct WHERE ct.id = thread_id
    ))
  );

-- Participants with invite permission can create invites
CREATE POLICY "Participants can create invites"
  ON public.conversation_thread_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversation_thread_participants ctp
      JOIN public.user_accounts ua ON ua.id = ctp.user_account_id
      WHERE ctp.id = invited_by_participant_id
        AND ua.auth_user_id = auth.uid()
        AND ua.is_active = true
    )
  );

-- Thread participants can view invites for their thread
CREATE POLICY "Thread participants can view invites"
  ON public.conversation_thread_invites
  FOR SELECT
  TO authenticated
  USING (
    public.has_thread_access(auth.uid(), thread_id)
  );

-- Allow anon select by token for accept flow
CREATE POLICY "Anyone can view invite by token"
  ON public.conversation_thread_invites
  FOR SELECT
  TO anon
  USING (true);
