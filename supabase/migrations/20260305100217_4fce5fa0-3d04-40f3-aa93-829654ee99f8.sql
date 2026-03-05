
-- Message read tracking for "Seen by X" feature
CREATE TABLE public.message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.conversation_posts(id) ON DELETE CASCADE,
  user_account_id uuid NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_account_id)
);

ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert their own read receipt
CREATE POLICY "Users can mark messages as read"
  ON public.message_reads FOR INSERT TO authenticated
  WITH CHECK (
    user_account_id IN (
      SELECT id FROM public.user_accounts WHERE auth_user_id = auth.uid() AND is_active = true
    )
  );

-- Anyone in the thread can see read receipts
CREATE POLICY "Thread members can view reads"
  ON public.message_reads FOR SELECT TO authenticated
  USING (true);

-- Index for fast lookups
CREATE INDEX idx_message_reads_post_id ON public.message_reads(post_id);
CREATE INDEX idx_message_reads_user_account ON public.message_reads(user_account_id);

-- Enable realtime for message_reads
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
