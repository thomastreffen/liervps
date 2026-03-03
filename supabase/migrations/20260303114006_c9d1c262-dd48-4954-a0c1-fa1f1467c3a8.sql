
-- Table: ms_graph_subscriptions
CREATE TABLE public.ms_graph_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id),
  subscription_id text NOT NULL UNIQUE,
  resource text NOT NULL,
  change_type text NOT NULL DEFAULT 'created',
  notification_url text NOT NULL,
  client_state text NOT NULL,
  expiration_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','error','disabled')),
  last_renewed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ms_graph_subscriptions_company_status ON public.ms_graph_subscriptions (company_id, status);
CREATE INDEX idx_ms_graph_subscriptions_expiration ON public.ms_graph_subscriptions (expiration_at);

ALTER TABLE public.ms_graph_subscriptions ENABLE ROW LEVEL SECURITY;

-- Only superadmin / company admin can manage subscriptions
CREATE POLICY "Admin manages subscriptions"
  ON public.ms_graph_subscriptions
  FOR ALL
  TO authenticated
  USING (public.check_permission_v2(auth.uid(), 'admin.manage_users'))
  WITH CHECK (public.check_permission_v2(auth.uid(), 'admin.manage_users'));

-- Add unique indexes on conversation_email_messages for idempotency (if not already present)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cem_outlook_message_id
  ON public.conversation_email_messages (outlook_message_id)
  WHERE outlook_message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cem_outlook_internet_message_id
  ON public.conversation_email_messages (outlook_internet_message_id)
  WHERE outlook_internet_message_id IS NOT NULL;

-- Add inbound_token default generation trigger for conversation_threads
CREATE OR REPLACE FUNCTION public.generate_inbound_token()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.inbound_token IS NULL THEN
    NEW.inbound_token := gen_random_uuid()::text;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_inbound_token
  BEFORE INSERT ON public.conversation_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_inbound_token();

-- Backfill existing threads without inbound_token
UPDATE public.conversation_threads
SET inbound_token = gen_random_uuid()::text
WHERE inbound_token IS NULL;
