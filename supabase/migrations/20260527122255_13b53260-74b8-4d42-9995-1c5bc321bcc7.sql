
ALTER TABLE public.order_form_messages DROP CONSTRAINT IF EXISTS valid_source;
ALTER TABLE public.order_form_messages
  ADD CONSTRAINT valid_source
  CHECK (source = ANY (ARRAY[
    'app'::text,
    'email'::text,
    'system'::text,
    'public_tracking_customer'::text,
    'public_tracking_internal'::text
  ]));

ALTER TABLE public.order_form_messages DROP CONSTRAINT IF EXISTS order_form_messages_sender_type_check;
ALTER TABLE public.order_form_messages
  ADD CONSTRAINT order_form_messages_sender_type_check
  CHECK (sender_type = ANY (ARRAY[
    'admin'::text,
    'customer'::text,
    'system'::text,
    'internal'::text
  ]));
