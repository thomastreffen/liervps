
-- Add job_id column to schedule_blocks with ON DELETE SET NULL
ALTER TABLE public.schedule_blocks
ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.events(id) ON DELETE SET NULL;

-- Index for quick lookup by job_id
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_job_id
ON public.schedule_blocks (job_id) WHERE job_id IS NOT NULL AND deleted_at IS NULL;
