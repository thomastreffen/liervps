
-- =============================================
-- Conversation Engine v2 – Schema Extensions
-- =============================================

-- 1. Add new columns to conversation_threads
ALTER TABLE public.conversation_threads
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','closed')),
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid,
  ADD COLUMN IF NOT EXISTS is_formal_decision boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS decision_summary text,
  ADD COLUMN IF NOT EXISTS decision_marked_by uuid,
  ADD COLUMN IF NOT EXISTS decision_marked_at timestamptz,
  ADD COLUMN IF NOT EXISTS thread_category text NOT NULL DEFAULT 'normal'
    CHECK (thread_category IN ('normal','risk','change')),
  ADD COLUMN IF NOT EXISTS linked_offer_id uuid,
  ADD COLUMN IF NOT EXISTS linked_order_id uuid,
  ADD COLUMN IF NOT EXISTS linked_order_line_id uuid,
  ADD COLUMN IF NOT EXISTS inbound_token text;

-- Generate unique inbound_token for existing threads
UPDATE public.conversation_threads
SET inbound_token = gen_random_uuid()::text
WHERE inbound_token IS NULL;

-- Make inbound_token unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_conv_threads_inbound_token
  ON public.conversation_threads (inbound_token);

-- 2. Create conversation_email_messages table
CREATE TABLE IF NOT EXISTS public.conversation_email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id),
  thread_id uuid NOT NULL REFERENCES public.conversation_threads(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.conversation_posts(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('outbound','inbound')),
  provider text NOT NULL DEFAULT 'graph',
  outlook_message_id text,
  outlook_conversation_id text,
  outlook_internet_message_id text,
  subject text,
  from_email text,
  to_emails text[],
  cc_emails text[],
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','sent','failed','received','ignored')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cem_outlook_message_id
  ON public.conversation_email_messages (outlook_message_id) WHERE outlook_message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cem_internet_message_id
  ON public.conversation_email_messages (outlook_internet_message_id) WHERE outlook_internet_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cem_thread_id ON public.conversation_email_messages (thread_id);

-- Enable RLS
ALTER TABLE public.conversation_email_messages ENABLE ROW LEVEL SECURITY;

-- RLS: inherit thread access
CREATE POLICY "Users with thread access can view email messages"
  ON public.conversation_email_messages
  FOR SELECT
  USING (public.has_thread_access(auth.uid(), thread_id));

-- Add receive_email column to participants
ALTER TABLE public.conversation_thread_participants
  ADD COLUMN IF NOT EXISTS receive_email boolean NOT NULL DEFAULT true;

-- Enable realtime for email messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_email_messages;
