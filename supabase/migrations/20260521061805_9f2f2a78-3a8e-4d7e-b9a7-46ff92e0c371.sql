
CREATE OR REPLACE FUNCTION public.get_linked_event_for_tracking_token(_token text)
RETURNS TABLE (
  id uuid,
  title text,
  start_time timestamptz,
  end_time timestamptz,
  status text,
  address text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.title, e.start_time, e.end_time, e.status::text, e.address
  FROM public.order_form_submissions s
  JOIN public.events e ON e.id = s.linked_event_id
  WHERE s.public_tracking_token = _token
    AND s.deleted_at IS NULL
    AND s.linked_event_id IS NOT NULL
    AND e.deleted_at IS NULL
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_linked_event_for_tracking_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_linked_event_for_tracking_token(text) TO authenticated;
