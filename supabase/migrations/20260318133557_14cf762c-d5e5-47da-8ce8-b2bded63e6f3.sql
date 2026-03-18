
-- Add thread_token to task_threads for inbound email matching
ALTER TABLE public.task_threads
  ADD COLUMN IF NOT EXISTS thread_token text UNIQUE DEFAULT gen_random_uuid()::text;

-- Add email-related columns to task_messages
ALTER TABLE public.task_messages
  ADD COLUMN IF NOT EXISTS recipients jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS email_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS raw_headers jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reply_to_address text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS inbound_received_at timestamptz DEFAULT NULL;

-- Generate thread_token for existing rows that don't have one
UPDATE public.task_threads SET thread_token = gen_random_uuid()::text WHERE thread_token IS NULL;

-- Create trigger to auto-generate thread_token on insert
CREATE OR REPLACE FUNCTION public.generate_task_thread_token()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.thread_token IS NULL THEN
    NEW.thread_token := gen_random_uuid()::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_task_thread_token ON public.task_threads;
CREATE TRIGGER trg_generate_task_thread_token
  BEFORE INSERT ON public.task_threads
  FOR EACH ROW EXECUTE FUNCTION public.generate_task_thread_token();
