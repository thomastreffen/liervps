
CREATE OR REPLACE FUNCTION public.get_submission_messages_by_token(_token text)
RETURNS SETOF public.order_form_messages
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.*
  FROM public.order_form_messages m
  JOIN public.order_form_submissions s ON s.id = m.submission_id
  WHERE s.public_tracking_token = _token
    AND s.deleted_at IS NULL
    AND m.is_visible_to_customer = true
  ORDER BY m.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_submission_comments_by_token(_token text)
RETURNS SETOF public.order_form_comments
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.*
  FROM public.order_form_comments c
  JOIN public.order_form_submissions s ON s.id = c.submission_id
  WHERE s.public_tracking_token = _token
    AND s.deleted_at IS NULL
    AND c.visibility IN ('shared','customer')
  ORDER BY c.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_submission_attachments_by_token(_token text)
RETURNS SETOF public.order_form_submission_attachments
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.*
  FROM public.order_form_submission_attachments a
  JOIN public.order_form_submissions s ON s.id = a.submission_id
  WHERE s.public_tracking_token = _token
    AND s.deleted_at IS NULL
  ORDER BY a.uploaded_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_submission_values_by_token(_token text)
RETURNS SETOF public.order_form_submission_values
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT v.*
  FROM public.order_form_submission_values v
  JOIN public.order_form_submissions s ON s.id = v.submission_id
  WHERE s.public_tracking_token = _token
    AND s.deleted_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_submission_messages_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_submission_comments_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_submission_attachments_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_submission_values_by_token(text) TO anon, authenticated;
