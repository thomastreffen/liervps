
-- Dead letter table for failed inbound webhook processing
CREATE TABLE public.conversation_email_dead_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.internal_companies(id),
  subscription_id text,
  raw_payload jsonb NOT NULL,
  headers jsonb,
  graph_message_id text,
  internet_message_id text,
  error text,
  attempt_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reprocessed','ignored','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dead_letters_company_status ON public.conversation_email_dead_letters (company_id, status);
CREATE INDEX idx_dead_letters_internet_msg ON public.conversation_email_dead_letters (internet_message_id);
CREATE INDEX idx_dead_letters_created ON public.conversation_email_dead_letters (created_at);

ALTER TABLE public.conversation_email_dead_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages dead letters"
  ON public.conversation_email_dead_letters
  FOR ALL TO authenticated
  USING (public.check_permission_v2(auth.uid(), 'admin.manage_users'))
  WITH CHECK (public.check_permission_v2(auth.uid(), 'admin.manage_users'));

-- Extend conversation_email_messages with observability columns
ALTER TABLE public.conversation_email_messages
  ADD COLUMN IF NOT EXISTS processing_duration_ms int,
  ADD COLUMN IF NOT EXISTS webhook_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'ok' CHECK (processing_status IN ('ok','dead_letter','duplicate','ignored'));
