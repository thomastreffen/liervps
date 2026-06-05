ALTER TABLE public.order_form_submission_attachments
ADD COLUMN IF NOT EXISTS message_id uuid NULL;

CREATE INDEX IF NOT EXISTS order_form_submission_attachments_message_id_idx
  ON public.order_form_submission_attachments (message_id)
  WHERE message_id IS NOT NULL;