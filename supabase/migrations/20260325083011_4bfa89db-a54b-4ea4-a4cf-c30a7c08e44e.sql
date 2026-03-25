
ALTER TABLE public.order_form_submissions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;

-- Allow anon to still read non-deleted submissions for public forms
-- Update existing anon policy is not needed since the existing one doesn't filter deleted_at

-- RLS: authenticated users should only see non-deleted by default (handled in app code)
