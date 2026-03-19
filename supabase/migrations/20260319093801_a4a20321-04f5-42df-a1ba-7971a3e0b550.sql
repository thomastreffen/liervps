
-- Update notification trigger to use message priority
CREATE OR REPLACE FUNCTION public.create_task_thread_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _thread record;
  _recipient record;
  _notif_type text;
  _priority text;
  _title text;
  _body text;
  _link text;
  _msg_priority text;
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

  _msg_priority := COALESCE(NEW.priority, 'normal');

  IF NEW.message_type = 'external_email' AND NEW.direction = 'inbound' THEN
    _notif_type := 'task_thread_inbound_email';
    _priority := CASE 
      WHEN _msg_priority = 'urgent' THEN 'critical'
      WHEN _msg_priority = 'important' THEN 'important'
      ELSE 'important'
    END;
    _title := 'Nytt e-postsvar på: ' || COALESCE(_thread.task_title, 'Oppgave');
    _body := LEFT(COALESCE(NEW.body, ''), 200);
  ELSIF NEW.message_type = 'internal_message' THEN
    _notif_type := 'task_thread_message';
    _priority := CASE 
      WHEN _msg_priority = 'urgent' THEN 'critical'
      WHEN _msg_priority = 'important' THEN 'important'
      ELSE 'info'
    END;
    _title := CASE
      WHEN _msg_priority = 'urgent' THEN '🔴 HASTER: ' || COALESCE(_thread.task_title, 'Oppgave')
      WHEN _msg_priority = 'important' THEN '⚠️ Viktig: ' || COALESCE(_thread.task_title, 'Oppgave')
      ELSE 'Ny melding på: ' || COALESCE(_thread.task_title, 'Oppgave')
    END;
    _body := LEFT(COALESCE(NEW.body, ''), 200);
  ELSIF NEW.message_type = 'external_email' AND NEW.direction = 'outbound' THEN
    _notif_type := 'task_thread_message';
    _priority := CASE 
      WHEN _msg_priority = 'urgent' THEN 'critical'
      WHEN _msg_priority = 'important' THEN 'important'
      ELSE 'info'
    END;
    _title := CASE
      WHEN _msg_priority = 'urgent' THEN '🔴 HASTER: ' || COALESCE(_thread.task_title, 'Oppgave')
      WHEN _msg_priority = 'important' THEN '⚠️ Viktig: ' || COALESCE(_thread.task_title, 'Oppgave')
      ELSE 'Ny melding på: ' || COALESCE(_thread.task_title, 'Oppgave')
    END;
    _body := LEFT(COALESCE(NEW.body, ''), 200);
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
$function$;
