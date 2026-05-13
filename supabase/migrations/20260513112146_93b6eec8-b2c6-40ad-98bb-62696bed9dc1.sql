-- Extend hms_incidents with attachments + proposed action
ALTER TABLE public.hms_incidents
  ADD COLUMN IF NOT EXISTS proposed_action text,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Allow file storage under hms-attachments/incidents/{incident_id}/*
CREATE OR REPLACE FUNCTION public.has_hms_attachment_access(_auth_user_id uuid, _name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH parts AS (
    SELECT (storage.foldername(_name))[1] AS root,
           NULLIF((storage.foldername(_name))[2], '') AS second
  )
  SELECT
    EXISTS (
      SELECT 1
      FROM parts p
      JOIN public.hms_submissions s
        ON s.id = (p.second)::uuid
      WHERE p.root = 'submissions'
        AND s.deleted_at IS NULL
        AND (
          public.has_hms_view(_auth_user_id, s.company_id)
          OR s.submitted_by = _auth_user_id
        )
    )
    OR EXISTS (
      SELECT 1
      FROM parts p
      JOIN public.hms_incidents i
        ON i.id = (p.second)::uuid
      WHERE p.root = 'incidents'
        AND i.deleted_at IS NULL
        AND (
          public.has_hms_view(_auth_user_id, i.company_id)
          OR i.reported_by = _auth_user_id
        )
    )
    -- New incident draft uploads (incident not yet created): allow user's own draft folder
    OR EXISTS (
      SELECT 1
      FROM parts p
      WHERE p.root = 'incident-drafts'
        AND p.second = _auth_user_id::text
    );
$function$;