-- Composite indexes for overlap queries on schedule_blocks
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_tech_time
  ON public.schedule_blocks (technician_id, start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_company_tech_time
  ON public.schedule_blocks (company_id, technician_id, start_at, end_at);

-- Index for confirmation count queries
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_match_state
  ON public.schedule_blocks (match_state) WHERE match_state = 'needs_confirmation';