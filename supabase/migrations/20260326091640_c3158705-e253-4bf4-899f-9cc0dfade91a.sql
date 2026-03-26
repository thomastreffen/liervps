ALTER TABLE public.order_form_categories
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS show_in_catalog boolean NOT NULL DEFAULT true;