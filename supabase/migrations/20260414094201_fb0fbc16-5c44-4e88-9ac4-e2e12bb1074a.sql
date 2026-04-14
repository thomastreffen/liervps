
ALTER TABLE public.order_form_messages
  ADD COLUMN IF NOT EXISTS email_notification_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_notification_sent_at timestamptz;
