
CREATE OR REPLACE FUNCTION public.notify_order_message_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _submission record;
  _title text;
  _body text;
  _link text;
  _sender_label text;
  _snippet text;
  _user_id uuid;
  _notified uuid[] := ARRAY[]::uuid[];
BEGIN
  -- Only customer / external-originated messages trigger internal notifications
  IF NEW.sender_type IS NULL OR NEW.sender_type NOT IN ('customer', 'external', 'bestiller') THEN
    RETURN NEW;
  END IF;

  SELECT id, submission_no, company_id, assigned_to, submitted_by,
         COALESCE(submitter_name, notification_recipient_name, 'Bestiller') AS who
    INTO _submission
    FROM order_form_submissions
   WHERE id = NEW.submission_id;

  IF _submission IS NULL THEN
    RETURN NEW;
  END IF;

  _sender_label := COALESCE(NULLIF(NEW.sender_name, ''), _submission.who, 'Bestiller');
  _snippet := LEFT(regexp_replace(COALESCE(NEW.body, ''), E'\\s+', ' ', 'g'), 140);
  _title := 'Ny melding på bestilling ' || COALESCE(_submission.submission_no, '#');
  _body := _sender_label || COALESCE(': ' || NULLIF(_snippet, ''), '');
  _link := '/orders/' || _submission.id::text;

  -- Assignee
  IF _submission.assigned_to IS NOT NULL THEN
    _notified := array_append(_notified, _submission.assigned_to);
  END IF;
  -- Submitter (if internal)
  IF _submission.submitted_by IS NOT NULL THEN
    _notified := array_append(_notified, _submission.submitted_by);
  END IF;
  -- Internal participants with receives_notifications
  FOR _user_id IN
    SELECT DISTINCT ofp.user_id
      FROM order_form_participants ofp
     WHERE ofp.submission_id = NEW.submission_id
       AND ofp.participant_type = 'internal_user'
       AND ofp.user_id IS NOT NULL
       AND ofp.is_active
       AND ofp.receives_notifications
  LOOP
    _notified := array_append(_notified, _user_id);
  END LOOP;

  -- Fallback: company admins if no recipient found
  IF array_length(_notified, 1) IS NULL THEN
    FOR _user_id IN SELECT public._notif_admin_user_ids() LOOP
      _notified := array_append(_notified, _user_id);
    END LOOP;
  END IF;

  -- Dedup + insert, skip the sender themselves
  FOR _user_id IN SELECT DISTINCT unnest(_notified) LOOP
    IF NEW.sender_user_id IS NOT NULL AND _user_id = NEW.sender_user_id THEN
      CONTINUE;
    END IF;
    BEGIN
      INSERT INTO notifications
        (user_id, company_id, type, priority, title, message, link_url,
         entity_type, entity_id, actor_name)
      VALUES
        (_user_id, _submission.company_id, 'order_message', 'important',
         _title, _body, _link, 'order_message', NEW.id, _sender_label);
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        INSERT INTO order_form_activity_log (submission_id, event_type, payload)
        VALUES (NEW.submission_id, 'notification_failed', jsonb_build_object(
          'notification_type', 'customer_message',
          'message_id', NEW.id,
          'user_id', _user_id,
          'error', SQLERRM,
          'sqlstate', SQLSTATE
        ));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END;
  END LOOP;

  BEGIN
    INSERT INTO order_form_activity_log (submission_id, event_type, payload)
    VALUES (NEW.submission_id, 'customer_message_received',
      jsonb_build_object(
        'message_id', NEW.id,
        'sender_type', NEW.sender_type,
        'sender_name', NEW.sender_name,
        'snippet', _snippet,
        'notified_user_ids', to_jsonb(_notified)
      ));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_order_message_customer ON public.order_form_messages;
CREATE TRIGGER trg_notify_order_message_customer
  AFTER INSERT ON public.order_form_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_message_customer();

-- Enable realtime so the order list / detail can react live
ALTER TABLE public.order_form_messages REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'order_form_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.order_form_messages';
  END IF;
END$$;
