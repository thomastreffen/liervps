
-- Add deleted_reason column
ALTER TABLE public.schedule_blocks ADD COLUMN IF NOT EXISTS deleted_reason text;

-- Add partial unique index on (company_id, calendar_id, outlook_event_id) for active outlook blocks
CREATE UNIQUE INDEX IF NOT EXISTS schedule_blocks_outlook_event_uniq
  ON public.schedule_blocks (company_id, calendar_id, outlook_event_id)
  WHERE outlook_event_id IS NOT NULL AND deleted_at IS NULL;

-- Index for overlap queries
CREATE INDEX IF NOT EXISTS schedule_blocks_tech_range_idx
  ON public.schedule_blocks (company_id, technician_id, start_at, end_at)
  WHERE deleted_at IS NULL;

-- Index for project lookups
CREATE INDEX IF NOT EXISTS schedule_blocks_project_idx
  ON public.schedule_blocks (company_id, project_id)
  WHERE deleted_at IS NULL;

-- Create orphan sweep function
CREATE OR REPLACE FUNCTION public.sweep_orphan_schedule_blocks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _unlinked int;
BEGIN
  -- Unlink blocks pointing to soft-deleted or non-existing projects
  WITH orphans AS (
    SELECT sb.id, sb.outlook_subject, sb.title
    FROM schedule_blocks sb
    LEFT JOIN events e ON e.id = sb.project_id AND e.deleted_at IS NULL
    WHERE sb.project_id IS NOT NULL
      AND sb.deleted_at IS NULL
      AND (e.id IS NULL)
  )
  UPDATE schedule_blocks sb
  SET project_id = NULL,
      match_state = 'external',
      match_reason = 'Auto-renset: prosjekt slettet',
      title = COALESCE(sb.outlook_subject, sb.title, 'Ekstern blokk'),
      updated_at = now()
  FROM orphans o
  WHERE sb.id = o.id;

  GET DIAGNOSTICS _unlinked = ROW_COUNT;

  RETURN jsonb_build_object('unlinked', _unlinked);
END;
$$;
