-- 1. Add priority and push columns to existing notifications table
ALTER TABLE public.notifications 
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS push_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS push_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS actor_user_id uuid,
  ADD COLUMN IF NOT EXISTS actor_name text;

-- Add constraint for priority values
ALTER TABLE public.notifications 
  ADD CONSTRAINT notifications_priority_check 
  CHECK (priority IN ('critical', 'important', 'info'));

-- Add constraint for push_status
ALTER TABLE public.notifications 
  ADD CONSTRAINT notifications_push_status_check 
  CHECK (push_status IN ('pending', 'sent', 'skipped', 'failed'));

-- Index for faster unread queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
  ON public.notifications (user_id, read, created_at DESC) 
  WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_entity 
  ON public.notifications (entity_type, entity_id);

-- 2. Create task_thread_reads for per-user read tracking
CREATE TABLE IF NOT EXISTS public.task_thread_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.task_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  last_read_message_id uuid REFERENCES public.task_messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (thread_id, user_id)
);

ALTER TABLE public.task_thread_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reads"
  ON public.task_thread_reads FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own reads"
  ON public.task_thread_reads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reads"
  ON public.task_thread_reads FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Function to create notifications on new task thread messages
CREATE OR REPLACE FUNCTION public.create_task_thread_notification()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _thread record;
  _recipient record;
  _notif_type text;
  _priority text;
  _title text;
  _body text;
  _link text;
BEGIN
  IF NEW.message_type = 'system_event' THEN
    RETURN NEW;
  END IF;

  SELECT tt.task_id, e.title AS task_title, e.company_id AS event_company_id
  INTO _thread
  FROM task_threads tt
  JOIN events e ON e.id = tt.task_id
  WHERE tt.id = NEW.thread_id;

  IF _thread IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.message_type = 'external_email' AND NEW.direction = 'inbound' THEN
    _notif_type := 'task_thread_inbound_email';
    _priority := 'important';
    _title := 'Nytt e-postsvar på: ' || COALESCE(_thread.task_title, 'Oppgave');
    _body := LEFT(COALESCE(NEW.body, ''), 200);
  ELSIF NEW.message_type = 'internal_message' THEN
    _notif_type := 'task_thread_message';
    _priority := 'info';
    _title := 'Ny melding på: ' || COALESCE(_thread.task_title, 'Oppgave');
    _body := LEFT(COALESCE(NEW.body, ''), 200);
  ELSIF NEW.message_type = 'external_email' AND NEW.direction = 'outbound' THEN
    RETURN NEW;
  ELSE
    RETURN NEW;
  END IF;

  _link := '/projects/plan?openTask=' || _thread.task_id::text;

  FOR _recipient IN
    SELECT DISTINCT t.user_id
    FROM event_technicians et
    JOIN technicians t ON t.id = et.technician_id
    WHERE et.event_id = _thread.task_id
      AND t.user_id IS NOT NULL
      AND t.user_id != COALESCE(NEW.author_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
  LOOP
    INSERT INTO notifications (user_id, company_id, type, priority, title, message, link_url, entity_type, entity_id, actor_user_id, actor_name)
    VALUES (_recipient.user_id, _thread.event_company_id, _notif_type, _priority, _title, _body, _link, 'task_thread', _thread.task_id, NEW.author_user_id, NEW.author_name)
    ON CONFLICT DO NOTHING;
  END LOOP;

  FOR _recipient IN
    SELECT DISTINCT jp.user_id
    FROM job_participants jp
    WHERE jp.job_id = _thread.task_id
      AND jp.user_id IS NOT NULL
      AND jp.user_id != COALESCE(NEW.author_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
  LOOP
    INSERT INTO notifications (user_id, company_id, type, priority, title, message, link_url, entity_type, entity_id, actor_user_id, actor_name)
    VALUES (_recipient.user_id, _thread.event_company_id, _notif_type, _priority, _title, _body, _link, 'task_thread', _thread.task_id, NEW.author_user_id, NEW.author_name)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_thread_notification ON public.task_messages;
CREATE TRIGGER trg_task_thread_notification
  AFTER INSERT ON public.task_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.create_task_thread_notification();

ALTER PUBLICATION supabase_realtime ADD TABLE public.task_thread_reads;