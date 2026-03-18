
-- ══════════════════════════════════════════════
-- Task Thread System: per-task messaging
-- ══════════════════════════════════════════════

-- 1. task_threads – one thread per task/event
CREATE TABLE public.task_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id),
  task_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NULL,
  UNIQUE(task_id)
);

-- 2. task_messages – messages in a thread
CREATE TABLE public.task_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id),
  thread_id uuid NOT NULL REFERENCES public.task_threads(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  message_type text NOT NULL DEFAULT 'internal_message'
    CHECK (message_type IN ('internal_message', 'external_email', 'system_event')),
  direction text NULL
    CHECK (direction IS NULL OR direction IN ('inbound', 'outbound', 'internal', 'system')),
  body text NULL,
  body_html text NULL,
  subject text NULL,
  author_user_id uuid NULL,
  author_name text NULL,
  author_email text NULL,
  external_message_id text NULL,
  external_in_reply_to text NULL,
  external_references text[] NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz NULL,
  deleted_at timestamptz NULL
);

-- 3. task_message_attachments
CREATE TABLE public.task_message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id),
  message_id uuid NOT NULL REFERENCES public.task_messages(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NULL,
  mime_type text NULL,
  uploaded_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_task_threads_task_id ON public.task_threads(task_id);
CREATE INDEX idx_task_threads_company_id ON public.task_threads(company_id);
CREATE INDEX idx_task_messages_thread_id ON public.task_messages(thread_id);
CREATE INDEX idx_task_messages_task_id ON public.task_messages(task_id);
CREATE INDEX idx_task_messages_company_id ON public.task_messages(company_id);
CREATE INDEX idx_task_messages_created_at ON public.task_messages(created_at);
CREATE INDEX idx_task_message_attachments_message_id ON public.task_message_attachments(message_id);

-- Trigger for updated_at on task_threads
CREATE TRIGGER set_task_threads_updated_at
  BEFORE UPDATE ON public.task_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to update last_message_at on new messages
CREATE OR REPLACE FUNCTION public.update_task_thread_last_message()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.task_threads
  SET last_message_at = NEW.created_at
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_task_message_update_thread
  AFTER INSERT ON public.task_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_task_thread_last_message();

-- Enable realtime for task_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_messages;

-- ══════════════════════════════════════════════
-- RLS Policies
-- ══════════════════════════════════════════════

ALTER TABLE public.task_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_message_attachments ENABLE ROW LEVEL SECURITY;

-- task_threads
CREATE POLICY "Users can view task threads"
  ON public.task_threads FOR SELECT TO authenticated
  USING (
    public.check_permission_v2(auth.uid(), 'task_thread.view')
    OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
  );

CREATE POLICY "Users can insert task threads"
  ON public.task_threads FOR INSERT TO authenticated
  WITH CHECK (
    public.check_permission_v2(auth.uid(), 'task_thread.view')
    OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
  );

CREATE POLICY "Users can update task threads"
  ON public.task_threads FOR UPDATE TO authenticated
  USING (
    public.check_permission_v2(auth.uid(), 'task_thread.manage')
    OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
  );

-- task_messages
CREATE POLICY "Users can view task messages"
  ON public.task_messages FOR SELECT TO authenticated
  USING (
    public.check_permission_v2(auth.uid(), 'task_thread.view')
    OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
  );

CREATE POLICY "Users can insert internal messages"
  ON public.task_messages FOR INSERT TO authenticated
  WITH CHECK (
    public.check_permission_v2(auth.uid(), 'task_thread.comment_internal')
    OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
  );

CREATE POLICY "Users can soft-delete own messages"
  ON public.task_messages FOR UPDATE TO authenticated
  USING (
    author_user_id = auth.uid()
    OR public.check_permission_v2(auth.uid(), 'task_thread.manage')
    OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
  );

-- task_message_attachments
CREATE POLICY "Users can view task message attachments"
  ON public.task_message_attachments FOR SELECT TO authenticated
  USING (
    public.check_permission_v2(auth.uid(), 'task_thread.view')
    OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
  );

CREATE POLICY "Users can upload task message attachments"
  ON public.task_message_attachments FOR INSERT TO authenticated
  WITH CHECK (
    public.check_permission_v2(auth.uid(), 'task_thread.upload_attachments')
    OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
  );

-- Storage bucket for task thread attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-thread-files', 'task-thread-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS for task-thread-files
CREATE POLICY "Authenticated users can upload task thread files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-thread-files');

CREATE POLICY "Authenticated users can read task thread files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'task-thread-files');
