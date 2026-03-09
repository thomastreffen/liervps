
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS accepted_name text,
  ADD COLUMN IF NOT EXISTS accepted_email text,
  ADD COLUMN IF NOT EXISTS accepted_comment text,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_comment text;
