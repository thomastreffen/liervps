
-- Fix INSERT policy on conversation_inbox_items to be more restrictive
DROP POLICY IF EXISTS "System can insert inbox items" ON public.conversation_inbox_items;

CREATE POLICY "Users with thread access can insert inbox items"
  ON public.conversation_inbox_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversation_threads ct
      WHERE ct.id = conversation_inbox_items.thread_id
        AND public.has_thread_access(auth.uid(), ct.project_id)
    )
  );

-- Fix INSERT policy on message_action_suggestions to allow service role
DROP POLICY IF EXISTS "Users with thread access can insert suggestions" ON public.message_action_suggestions;

CREATE POLICY "Authenticated users can insert suggestions"
  ON public.message_action_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversation_posts cp
      WHERE cp.id = message_action_suggestions.post_id
        AND public.has_thread_access(auth.uid(), cp.thread_id)
    )
  );
