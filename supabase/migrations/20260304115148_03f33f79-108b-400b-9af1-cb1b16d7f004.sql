ALTER TABLE public.schedule_blocks
  ADD COLUMN IF NOT EXISTS outlook_subject text,
  ADD COLUMN IF NOT EXISTS outlook_location text,
  ADD COLUMN IF NOT EXISTS outlook_preview text,
  ADD COLUMN IF NOT EXISTS outlook_weblink text,
  ADD COLUMN IF NOT EXISTS outlook_organizer text;