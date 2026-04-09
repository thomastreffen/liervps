
-- Helper: check if submission has a tracking token (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.submission_has_tracking_token(_submission_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.order_form_submissions
    WHERE id = _submission_id
      AND public_tracking_token IS NOT NULL
      AND deleted_at IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.submission_has_tracking_token(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.submission_has_tracking_token(uuid) TO authenticated;

-- Update anon INSERT policy on order_form_messages
DROP POLICY IF EXISTS "Anon can insert customer replies" ON public.order_form_messages;
CREATE POLICY "Anon can insert customer replies"
ON public.order_form_messages
FOR INSERT
TO anon
WITH CHECK (
  sender_type = 'customer'
  AND is_visible_to_customer = true
  AND public.submission_has_tracking_token(submission_id)
);

-- Update anon INSERT policy on order_form_comments
DROP POLICY IF EXISTS "anon_insert_customer_reply" ON public.order_form_comments;
CREATE POLICY "anon_insert_customer_reply"
ON public.order_form_comments
FOR INSERT
TO anon
WITH CHECK (
  is_customer_reply = true
  AND visibility = 'shared'
  AND public.submission_has_tracking_token(submission_id)
);

-- Update anon INSERT policy on order_form_submission_attachments
DROP POLICY IF EXISTS "anon_insert_attachments_by_token" ON public.order_form_submission_attachments;
CREATE POLICY "anon_insert_attachments_by_token"
ON public.order_form_submission_attachments
FOR INSERT
TO anon
WITH CHECK (
  public.submission_has_tracking_token(submission_id)
);

-- Also need anon UPDATE on order_form_submissions for customer_last_reply_at etc.
-- Create a helper for anon updates scoped by submission_id
DROP POLICY IF EXISTS "Anon can update submission via tracking token" ON public.order_form_submissions;
CREATE POLICY "Anon can update submission via tracking token"
ON public.order_form_submissions
FOR UPDATE
TO anon
USING (
  public_tracking_token IS NOT NULL
  AND deleted_at IS NULL
)
WITH CHECK (
  public_tracking_token IS NOT NULL
  AND deleted_at IS NULL
);

-- Anon INSERT on order_form_activity_log for customer replies
DROP POLICY IF EXISTS "Anon can insert activity log" ON public.order_form_activity_log;
CREATE POLICY "Anon can insert activity log"
ON public.order_form_activity_log
FOR INSERT
TO anon
WITH CHECK (
  public.submission_has_tracking_token(submission_id)
);
