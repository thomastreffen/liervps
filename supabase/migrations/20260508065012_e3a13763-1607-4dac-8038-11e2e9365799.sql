DROP FUNCTION IF EXISTS public.get_other_submissions_by_token(text);

CREATE OR REPLACE FUNCTION public.get_other_submissions_by_token(_token text)
RETURNS TABLE(
  id uuid,
  submission_no text,
  status text,
  external_status text,
  template_name text,
  oppdragssted text,
  oppdragstittel text,
  adresse text,
  postnummer text,
  poststed text,
  submitted_at timestamp with time zone,
  last_activity_at timestamp with time zone,
  public_tracking_token text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH cur AS (
    SELECT id, company_id, submitter_email
    FROM public.order_form_submissions
    WHERE public_tracking_token = _token
      AND deleted_at IS NULL
    LIMIT 1
  )
  SELECT
    s.id,
    s.submission_no,
    s.status,
    s.external_status,
    t.name AS template_name,
    NULLIF(s.summary->>'oppdragssted','') AS oppdragssted,
    NULLIF(s.summary->>'oppdragstittel','') AS oppdragstittel,
    NULLIF(s.summary->>'adresse','') AS adresse,
    NULLIF(s.summary->>'postnummer','') AS postnummer,
    NULLIF(s.summary->>'poststed','') AS poststed,
    s.submitted_at,
    s.last_activity_at,
    s.public_tracking_token
  FROM public.order_form_submissions s
  LEFT JOIN public.order_form_templates t ON t.id = s.template_id
  JOIN cur ON cur.company_id = s.company_id
  WHERE s.deleted_at IS NULL
    AND s.id <> cur.id
    AND s.public_tracking_token IS NOT NULL
    AND cur.submitter_email IS NOT NULL
    AND lower(s.submitter_email) = lower(cur.submitter_email)
  ORDER BY
    CASE WHEN s.status IN ('closed','rejected') THEN 1 ELSE 0 END,
    COALESCE(s.last_activity_at, s.submitted_at) DESC
  LIMIT 50;
$$;
