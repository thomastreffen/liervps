
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS client_request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS events_client_request_id_unique ON public.events (client_request_id) WHERE client_request_id IS NOT NULL;
