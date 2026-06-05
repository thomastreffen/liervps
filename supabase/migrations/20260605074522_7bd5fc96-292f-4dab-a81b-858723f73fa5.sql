
ALTER TABLE public.order_form_submission_attachments
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS original_filename text,
  ADD COLUMN IF NOT EXISTS renamed_at timestamptz,
  ADD COLUMN IF NOT EXISTS renamed_by uuid;

-- Backfill original_filename from file_name where missing
UPDATE public.order_form_submission_attachments
SET original_filename = file_name
WHERE original_filename IS NULL;

-- RPC to rename (set display name / description) an attachment, with company-membership check
CREATE OR REPLACE FUNCTION public.rename_submission_attachment(
  _attachment_id uuid,
  _display_name text,
  _description text DEFAULT NULL
)
RETURNS public.order_form_submission_attachments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _row public.order_form_submission_attachments;
  _company uuid;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT s.company_id INTO _company
  FROM public.order_form_submission_attachments a
  JOIN public.order_form_submissions s ON s.id = a.submission_id
  WHERE a.id = _attachment_id;

  IF _company IS NULL THEN
    RAISE EXCEPTION 'Attachment not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id = _uid AND um.company_id = _company
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.order_form_submission_attachments
  SET display_name = NULLIF(btrim(_display_name), ''),
      description  = NULLIF(btrim(_description), ''),
      renamed_at   = now(),
      renamed_by   = _uid
  WHERE id = _attachment_id
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rename_submission_attachment(uuid, text, text) TO authenticated;

-- Re-create token RPCs (no schema shape change needed since RETURNS SETOF table — new cols included automatically),
-- but bump definition to be explicit and idempotent.
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
      (
        a.message_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.order_form_messages m
          WHERE m.id = a.message_id AND m.is_visible_to_customer = true
        )
      )
      OR (
        a.message_id IS NULL
        AND COALESCE(a.category, '') <> 'Intern'
      )
    )
  ORDER BY a.uploaded_at ASC;
$$;
