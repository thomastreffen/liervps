-- Add reply_to_message_id for reply-to-message feature
ALTER TABLE public.task_messages
ADD COLUMN reply_to_message_id uuid REFERENCES public.task_messages(id) ON DELETE SET NULL;

CREATE INDEX idx_task_messages_reply_to ON public.task_messages(reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;