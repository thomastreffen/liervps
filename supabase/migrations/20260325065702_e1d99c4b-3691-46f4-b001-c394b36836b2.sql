ALTER TABLE public.order_form_templates
  ADD COLUMN IF NOT EXISTS requires_login boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_in_catalog boolean NOT NULL DEFAULT true;