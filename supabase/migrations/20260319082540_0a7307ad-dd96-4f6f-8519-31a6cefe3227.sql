ALTER TABLE public.ms_graph_subscriptions
  ADD COLUMN IF NOT EXISTS mailbox_email text,
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_message text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ms_graph_sub_active_mailbox
  ON public.ms_graph_subscriptions (mailbox_email)
  WHERE status = 'active';