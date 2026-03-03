
-- Add INSERT policy for conversation_email_messages (edge functions use service_role, but allow authenticated inserts for system)
CREATE POLICY "Authenticated users can insert email messages for accessible threads"
  ON public.conversation_email_messages
  FOR INSERT
  WITH CHECK (public.has_thread_access(auth.uid(), thread_id));

CREATE POLICY "Thread members can update email message status"
  ON public.conversation_email_messages
  FOR UPDATE
  USING (public.has_thread_access(auth.uid(), thread_id));
