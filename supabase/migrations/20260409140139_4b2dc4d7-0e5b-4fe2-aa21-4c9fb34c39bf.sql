
-- Anon needs to UPDATE order_form_messages to mark replied_at
CREATE POLICY "Anon can mark messages as replied"
ON public.order_form_messages
FOR UPDATE
TO anon
USING (
  public.submission_has_tracking_token(submission_id)
  AND message_type = 'request_info'
)
WITH CHECK (
  public.submission_has_tracking_token(submission_id)
);

-- Anon needs to SELECT order_form_messages to check remaining open requests
CREATE POLICY "Anon can read messages via tracking token"
ON public.order_form_messages
FOR SELECT
TO anon
USING (
  is_visible_to_customer = true
  AND public.submission_has_tracking_token(submission_id)
);
