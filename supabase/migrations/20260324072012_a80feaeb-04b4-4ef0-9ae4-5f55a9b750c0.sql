
ALTER TABLE public.order_form_submissions
  ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS notification_error text,
  ADD COLUMN IF NOT EXISTS converted_to_id uuid;

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS source_order_form_id uuid REFERENCES public.order_form_submissions(id);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS source_order_form_id uuid REFERENCES public.order_form_submissions(id);
