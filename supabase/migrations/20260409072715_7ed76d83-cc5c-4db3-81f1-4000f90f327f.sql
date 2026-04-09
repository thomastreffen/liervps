
ALTER TABLE public.order_form_messages
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by_user_id uuid;

COMMENT ON COLUMN public.order_form_messages.review_status IS 'pending | approved | insufficient';
