
-- Add show_discount toggle to calculations (default OFF)
ALTER TABLE public.calculations
ADD COLUMN IF NOT EXISTS show_discount_in_offer boolean NOT NULL DEFAULT false;
