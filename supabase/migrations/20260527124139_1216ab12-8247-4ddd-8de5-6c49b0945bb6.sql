ALTER TABLE public.order_form_messages
  ADD COLUMN IF NOT EXISTS client_request_id text;

CREATE UNIQUE INDEX IF NOT EXISTS order_form_messages_submission_client_request_id_uidx
  ON public.order_form_messages (submission_id, client_request_id)
  WHERE client_request_id IS NOT NULL;