
-- Add deleted_at for soft-delete on schedule_blocks
ALTER TABLE public.schedule_blocks ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Add source value 'linked_outlook' support (source is text, no enum change needed)
-- Add index for filtering non-deleted blocks
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_not_deleted 
  ON public.schedule_blocks (start_at, end_at) 
  WHERE deleted_at IS NULL;
