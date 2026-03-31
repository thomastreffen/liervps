
-- Add explicit notification recipient fields to order_form_submissions
ALTER TABLE public.order_form_submissions
  ADD COLUMN IF NOT EXISTS notification_recipient_email text,
  ADD COLUMN IF NOT EXISTS notification_recipient_name text,
  ADD COLUMN IF NOT EXISTS notification_recipient_phone text,
  ADD COLUMN IF NOT EXISTS notification_recipient_source text DEFAULT 'auto';

-- Comment explaining the source field values
COMMENT ON COLUMN public.order_form_submissions.notification_recipient_source IS 'auto = resolved from form fields, manual = overridden by admin';

-- Backfill existing submissions: use submitter_email as notification_recipient_email
UPDATE public.order_form_submissions
SET notification_recipient_email = submitter_email,
    notification_recipient_name = submitter_name,
    notification_recipient_source = 'auto'
WHERE notification_recipient_email IS NULL
  AND submitter_email IS NOT NULL;
