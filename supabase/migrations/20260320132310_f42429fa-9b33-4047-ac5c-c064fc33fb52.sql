
ALTER TABLE public.product_import_jobs 
  ADD COLUMN IF NOT EXISTS last_successful_batch integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error_batch integer,
  ADD COLUMN IF NOT EXISTS last_error_message text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS dispatch_retries integer DEFAULT 0;

-- Clean up old stale running jobs (no heartbeat for 30+ minutes)
UPDATE public.product_import_jobs
SET status = 'failed',
    finished_at = now(),
    error_message = 'Automatisk avsluttet: ingen aktivitet i over 30 minutter',
    failed_step = 'stale_cleanup'
WHERE status IN ('running', 'queued')
  AND last_heartbeat_at < now() - interval '30 minutes';
