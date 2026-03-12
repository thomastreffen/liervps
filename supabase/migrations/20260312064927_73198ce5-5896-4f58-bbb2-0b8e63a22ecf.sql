ALTER TABLE public.internal_companies 
  ADD COLUMN IF NOT EXISTS operating_profile text NOT NULL DEFAULT 'office';