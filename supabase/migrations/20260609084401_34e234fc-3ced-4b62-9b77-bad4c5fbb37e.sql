CREATE UNIQUE INDEX IF NOT EXISTS schedule_blocks_unique_active_logical_key
ON public.schedule_blocks (
  job_id,
  project_id,
  technician_id,
  start_at,
  end_at,
  source
)
NULLS NOT DISTINCT
WHERE deleted_at IS NULL;