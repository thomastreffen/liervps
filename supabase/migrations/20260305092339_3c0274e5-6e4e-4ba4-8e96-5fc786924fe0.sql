
-- Add reply_to_post_id to conversation_posts
ALTER TABLE public.conversation_posts 
  ADD COLUMN IF NOT EXISTS reply_to_post_id uuid REFERENCES public.conversation_posts(id) ON DELETE SET NULL;

-- Add is_pinned to conversation_posts
ALTER TABLE public.conversation_posts 
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

-- Create message_reactions table
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.conversation_posts(id) ON DELETE CASCADE,
  user_account_id uuid NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_account_id, emoji)
);

-- Enable RLS
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can read reactions for threads they can access
CREATE POLICY "Authenticated users can read reactions"
  ON public.message_reactions FOR SELECT TO authenticated
  USING (true);

-- RLS: authenticated users can insert their own reactions
CREATE POLICY "Users can insert own reactions"
  ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (
    user_account_id = public.get_user_account_id(auth.uid())
  );

-- RLS: users can delete their own reactions
CREATE POLICY "Users can delete own reactions"
  ON public.message_reactions FOR DELETE TO authenticated
  USING (
    user_account_id = public.get_user_account_id(auth.uid())
  );

-- Enable realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
