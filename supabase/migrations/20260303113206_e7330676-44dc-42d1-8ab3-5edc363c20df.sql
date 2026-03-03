
-- Backfill: ensure all existing projects (events) have project_spaces
-- Only insert if they don't already exist
INSERT INTO public.project_spaces (project_id, space_key, is_enabled)
SELECT e.id, k.space_key, true
FROM public.events e
CROSS JOIN (VALUES ('samtaler'), ('oppgaver'), ('dokumenter'), ('tidsplan')) AS k(space_key)
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_spaces ps
  WHERE ps.project_id = e.id AND ps.space_key = k.space_key
)
ON CONFLICT (project_id, space_key) DO NOTHING;

-- Backfill: ensure all projects have at least one owner member (created_by)
INSERT INTO public.project_members (project_id, user_account_id, member_type, role)
SELECT e.id, ua.id, 'internal', 'owner'
FROM public.events e
JOIN public.user_accounts ua ON ua.auth_user_id = e.created_by AND ua.is_active = true
WHERE e.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = e.id AND pm.role = 'owner'
  )
ON CONFLICT DO NOTHING;

-- Add receive_email column to conversation_thread_participants if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversation_thread_participants' AND column_name = 'receive_email'
  ) THEN
    ALTER TABLE public.conversation_thread_participants ADD COLUMN receive_email boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Add linked_order_line_id to conversation_threads if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversation_threads' AND column_name = 'linked_order_line_id'
  ) THEN
    ALTER TABLE public.conversation_threads ADD COLUMN linked_order_line_id uuid;
  END IF;
END $$;

-- Ensure conversation_email_messages table exists (if not created by prior migration)
CREATE TABLE IF NOT EXISTS public.conversation_email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id),
  thread_id uuid NOT NULL REFERENCES public.conversation_threads(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.conversation_posts(id),
  direction text NOT NULL CHECK (direction IN ('outbound','inbound')),
  provider text NOT NULL DEFAULT 'graph',
  outlook_message_id text,
  outlook_conversation_id text,
  outlook_internet_message_id text,
  subject text,
  from_email text,
  to_emails text[],
  cc_emails text[],
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','received','ignored')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on conversation_email_messages
ALTER TABLE public.conversation_email_messages ENABLE ROW LEVEL SECURITY;

-- RLS: allow authenticated users to read email messages for threads they have access to
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'conversation_email_messages' AND policyname = 'Thread access for email messages'
  ) THEN
    CREATE POLICY "Thread access for email messages"
    ON public.conversation_email_messages
    FOR SELECT
    TO authenticated
    USING (public.has_thread_access(auth.uid(), thread_id));
  END IF;
END $$;

-- Create unique indexes for idempotency on email messages (if not exist)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cem_outlook_msg_id ON public.conversation_email_messages (outlook_message_id) WHERE outlook_message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cem_internet_msg_id ON public.conversation_email_messages (outlook_internet_message_id) WHERE outlook_internet_message_id IS NOT NULL;

-- Create storage policies for conversation-files bucket (if not exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Users can upload conversation files'
  ) THEN
    CREATE POLICY "Users can upload conversation files"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'conversation-files');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Users can read conversation files'
  ) THEN
    CREATE POLICY "Users can read conversation files"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'conversation-files');
  END IF;
END $$;
