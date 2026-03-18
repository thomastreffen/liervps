-- Digest delivery tracking table
CREATE TABLE IF NOT EXISTS public.task_thread_digest_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid REFERENCES public.internal_companies(id),
  digest_type text NOT NULL DEFAULT 'task_thread_daily_summary',
  summary_date date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  item_count integer NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE(user_id, digest_type, summary_date)
);

ALTER TABLE public.task_thread_digest_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON public.task_thread_digest_deliveries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_task_thread_reads_user_id ON public.task_thread_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_task_messages_thread_created ON public.task_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_task_messages_type_author ON public.task_messages(message_type, author_user_id);
CREATE INDEX IF NOT EXISTS idx_task_threads_task_id ON public.task_threads(task_id);
CREATE INDEX IF NOT EXISTS idx_digest_deliveries_user_date ON public.task_thread_digest_deliveries(user_id, summary_date);