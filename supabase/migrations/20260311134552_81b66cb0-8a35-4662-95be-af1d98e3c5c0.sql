
ALTER TABLE public.fag_requests 
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz;
