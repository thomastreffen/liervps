
-- RPC to get activity log by tracking token (no is_visible_to_customer filter)
CREATE OR REPLACE FUNCTION public.get_submission_activity_by_token(_token text)
RETURNS SETOF order_form_activity_log
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT al.* FROM public.order_form_activity_log al
  JOIN public.order_form_submissions s ON s.id = al.submission_id
  WHERE s.public_tracking_token = _token
    AND s.deleted_at IS NULL
  ORDER BY al.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_submission_activity_by_token(text) TO anon;
