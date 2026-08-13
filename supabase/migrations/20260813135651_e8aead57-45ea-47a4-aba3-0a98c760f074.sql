
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS drive_folder_id text,
  ADD COLUMN IF NOT EXISTS drive_folder_url text;

ALTER TABLE public.public_leads
  ADD COLUMN IF NOT EXISTS internal_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS internal_notify_status text;
