
-- Table to track escalation reminders per message per user
CREATE TABLE public.task_thread_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.task_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reminder_count int NOT NULL DEFAULT 1,
  last_reminded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one tracking row per message+user
ALTER TABLE public.task_thread_escalations
  ADD CONSTRAINT uq_escalation_message_user UNIQUE (message_id, user_id);

-- Index for efficient lookups by message
CREATE INDEX idx_escalations_message_id ON public.task_thread_escalations(message_id);

-- RLS: only system/service role writes; users can read their own
ALTER TABLE public.task_thread_escalations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own escalations"
  ON public.task_thread_escalations
  FOR SELECT
  USING (user_id = auth.uid());
