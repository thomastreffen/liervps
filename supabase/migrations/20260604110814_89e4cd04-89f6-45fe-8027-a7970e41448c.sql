
CREATE OR REPLACE FUNCTION public.dry_run_duplicate_schedule_blocks()
RETURNS TABLE(
  duplicate_key text,
  keep_id uuid,
  duplicate_ids uuid[],
  job_id uuid,
  project_id uuid,
  technician_id uuid,
  start_at timestamptz,
  end_at timestamptz,
  source text,
  count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT
      sb.id, sb.job_id, sb.project_id, sb.technician_id, sb.start_at, sb.end_at, sb.source, sb.created_at,
      row_number() OVER (
        PARTITION BY sb.job_id, sb.project_id, sb.technician_id, sb.start_at, sb.end_at, sb.source
        ORDER BY sb.created_at ASC NULLS LAST, sb.id ASC
      ) AS rn,
      count(*) OVER (
        PARTITION BY sb.job_id, sb.project_id, sb.technician_id, sb.start_at, sb.end_at, sb.source
      ) AS dc
    FROM public.schedule_blocks sb
    WHERE sb.deleted_at IS NULL
  )
  SELECT
    concat_ws('|',
      coalesce(r.job_id::text, ''),
      coalesce(r.project_id::text, ''),
      r.technician_id::text,
      r.start_at::text,
      r.end_at::text,
      r.source::text
    ) AS duplicate_key,
    (array_agg(r.id ORDER BY r.created_at ASC NULLS LAST, r.id ASC) FILTER (WHERE r.rn = 1))[1] AS keep_id,
    array_agg(r.id ORDER BY r.created_at ASC NULLS LAST, r.id ASC) FILTER (WHERE r.rn > 1) AS duplicate_ids,
    r.job_id,
    r.project_id,
    r.technician_id,
    r.start_at,
    r.end_at,
    r.source::text,
    max(r.dc)::bigint AS count
  FROM ranked r
  WHERE r.dc > 1
  GROUP BY r.job_id, r.project_id, r.technician_id, r.start_at, r.end_at, r.source
  ORDER BY r.start_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.apply_duplicate_schedule_blocks_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _affected int;
  _groups int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only super_admin may run schedule-block cleanup';
  END IF;

  WITH ranked AS (
    SELECT
      sb.id,
      row_number() OVER (
        PARTITION BY sb.job_id, sb.project_id, sb.technician_id, sb.start_at, sb.end_at, sb.source
        ORDER BY sb.created_at ASC NULLS LAST, sb.id ASC
      ) AS rn,
      count(*) OVER (
        PARTITION BY sb.job_id, sb.project_id, sb.technician_id, sb.start_at, sb.end_at, sb.source
      ) AS dc
    FROM public.schedule_blocks sb
    WHERE sb.deleted_at IS NULL
  ),
  to_delete AS (
    SELECT id FROM ranked WHERE rn > 1 AND dc > 1
  ),
  upd AS (
    UPDATE public.schedule_blocks sb
    SET deleted_at = now(),
        deleted_reason = 'duplicate_schedule_block_cleanup',
        updated_at = now()
    FROM to_delete td
    WHERE sb.id = td.id
      AND sb.deleted_at IS NULL
    RETURNING sb.id
  )
  SELECT count(*) INTO _affected FROM upd;

  SELECT count(*) INTO _groups FROM public.dry_run_duplicate_schedule_blocks();

  RAISE NOTICE '[schedule_blocks cleanup] soft-deleted % rows, remaining duplicate groups: %', _affected, _groups;

  RETURN jsonb_build_object(
    'soft_deleted', _affected,
    'remaining_duplicate_groups', _groups,
    'ran_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.dry_run_duplicate_schedule_blocks() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_duplicate_schedule_blocks_cleanup() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dry_run_duplicate_schedule_blocks() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_duplicate_schedule_blocks_cleanup() TO authenticated, service_role;
