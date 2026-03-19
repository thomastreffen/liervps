
-- Add priority column to task_messages
ALTER TABLE public.task_messages
ADD COLUMN priority text NOT NULL DEFAULT 'normal';

-- Add check constraint for allowed values
ALTER TABLE public.task_messages
ADD CONSTRAINT task_messages_priority_check
CHECK (priority IN ('normal', 'important', 'urgent'));

-- Index for queries filtering by priority
CREATE INDEX idx_task_messages_priority ON public.task_messages (priority) WHERE priority != 'normal';
