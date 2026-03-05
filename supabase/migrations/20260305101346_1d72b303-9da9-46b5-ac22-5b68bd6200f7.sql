
-- Sprint 3: Context fields on conversation_posts
ALTER TABLE public.conversation_posts
  ADD COLUMN IF NOT EXISTS context_location_text text,
  ADD COLUMN IF NOT EXISTS context_object_type text,
  ADD COLUMN IF NOT EXISTS context_object_ref text,
  ADD COLUMN IF NOT EXISTS context_tags text[] DEFAULT '{}';

-- Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_conv_posts_thread_created ON public.conversation_posts (thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conv_posts_context_tags ON public.conversation_posts USING GIN (context_tags);
CREATE INDEX IF NOT EXISTS idx_conv_posts_context_object_type ON public.conversation_posts (context_object_type) WHERE context_object_type IS NOT NULL;

-- Sprint 4: AI action suggestions table
CREATE TABLE IF NOT EXISTS public.message_action_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.conversation_posts(id) ON DELETE CASCADE,
  suggested_actions jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz,
  clicked_action_type text,
  clicked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_msg_action_post ON public.message_action_suggestions (post_id);

ALTER TABLE public.message_action_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with thread access can view suggestions"
  ON public.message_action_suggestions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_posts cp
      WHERE cp.id = message_action_suggestions.post_id
        AND public.has_thread_access(auth.uid(), cp.thread_id)
    )
  );

CREATE POLICY "Users with thread access can insert suggestions"
  ON public.message_action_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversation_posts cp
      WHERE cp.id = message_action_suggestions.post_id
        AND public.has_thread_access(auth.uid(), cp.thread_id)
    )
  );

CREATE POLICY "Users with thread access can update suggestions"
  ON public.message_action_suggestions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_posts cp
      WHERE cp.id = message_action_suggestions.post_id
        AND public.has_thread_access(auth.uid(), cp.thread_id)
    )
  );

-- Sprint 5: Inbox state table
CREATE TABLE IF NOT EXISTS public.conversation_inbox_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.conversation_posts(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES public.conversation_threads(id) ON DELETE CASCADE,
  target_user_account_id uuid NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'mention',
  handled_at timestamptz,
  handled_by uuid REFERENCES public.user_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, target_user_account_id, reason)
);

CREATE INDEX IF NOT EXISTS idx_inbox_user ON public.conversation_inbox_items (target_user_account_id, handled_at);
CREATE INDEX IF NOT EXISTS idx_inbox_thread ON public.conversation_inbox_items (thread_id);

ALTER TABLE public.conversation_inbox_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own inbox items"
  ON public.conversation_inbox_items FOR SELECT
  TO authenticated
  USING (
    target_user_account_id = public.get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can update own inbox items"
  ON public.conversation_inbox_items FOR UPDATE
  TO authenticated
  USING (
    target_user_account_id = public.get_user_account_id(auth.uid())
  );

CREATE POLICY "System can insert inbox items"
  ON public.conversation_inbox_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_action_suggestions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_inbox_items;
