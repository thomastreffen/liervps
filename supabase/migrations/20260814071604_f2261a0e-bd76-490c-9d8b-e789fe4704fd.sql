ALTER TABLE public.calculations
  ADD COLUMN IF NOT EXISTS pdf_drive_file_id text,
  ADD COLUMN IF NOT EXISTS pdf_drive_url text,
  ADD COLUMN IF NOT EXISTS pdf_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_content_hash text;