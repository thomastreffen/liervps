ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS location_details text,
  ADD COLUMN IF NOT EXISTS site_contact_name text,
  ADD COLUMN IF NOT EXISTS site_contact_phone text,
  ADD COLUMN IF NOT EXISTS access_notes text,
  ADD COLUMN IF NOT EXISTS map_link text,
  ADD COLUMN IF NOT EXISTS customer_practical_info text;