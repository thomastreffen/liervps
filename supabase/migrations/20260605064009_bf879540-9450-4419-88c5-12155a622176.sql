
ALTER TABLE public.order_form_submission_attachments
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_reason text;

CREATE INDEX IF NOT EXISTS order_form_submission_attachments_active_idx
  ON public.order_form_submission_attachments (submission_id)
  WHERE deleted_at IS NULL;

-- Replace tracking RPC: exclude deleted + restrict per-message visibility
CREATE OR REPLACE FUNCTION public.get_submission_attachments_by_token(_token text)
RETURNS SETOF public.order_form_submission_attachments
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.*
  FROM public.order_form_submission_attachments a
  JOIN public.order_form_submissions s ON s.id = a.submission_id
  WHERE s.public_tracking_token = _token
    AND s.deleted_at IS NULL
    AND a.deleted_at IS NULL
    AND (
      a.message_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.order_form_messages m
        WHERE m.id = a.message_id
          AND m.is_visible_to_customer = true
      )
    )
  ORDER BY a.uploaded_at ASC;
$$;

-- Lookup one attachment by (token, attachment_id) for the public fetch endpoint
CREATE OR REPLACE FUNCTION public.get_attachment_by_token(_token text, _attachment_id uuid)
RETURNS public.order_form_submission_attachments
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.*
  FROM public.order_form_submission_attachments a
  JOIN public.order_form_submissions s ON s.id = a.submission_id
  WHERE s.public_tracking_token = _token
    AND s.deleted_at IS NULL
    AND a.id = _attachment_id
    AND a.deleted_at IS NULL
    AND (
      a.message_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.order_form_messages m
        WHERE m.id = a.message_id
          AND m.is_visible_to_customer = true
      )
    )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_attachment_by_token(text, uuid) TO anon, authenticated;
