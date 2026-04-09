
CREATE OR REPLACE FUNCTION public.notify_order_message_participant()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _participant record;
  _submission record;
  _title text;
  _body text;
  _link text;
  _supabase_url text;
  _service_key text;
BEGIN
  -- Only fire for messages with an addressed participant
  IF NEW.addressed_to_participant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Look up participant
  SELECT ofp.user_id, ofp.name, ofp.participant_type, ofp.receives_notifications
  INTO _participant
  FROM order_form_participants ofp
  WHERE ofp.id = NEW.addressed_to_participant_id;

  -- Only notify internal users with a user_id
  IF _participant IS NULL OR _participant.user_id IS NULL OR _participant.participant_type != 'internal_user' THEN
    RETURN NEW;
  END IF;

  -- Don't notify yourself
  IF _participant.user_id = NEW.sender_user_id THEN
    RETURN NEW;
  END IF;

  -- Look up submission for context
  SELECT ofs.id, ofs.submission_no, ofs.company_id,
         COALESCE(ofs.summary, '') AS summary
  INTO _submission
  FROM order_form_submissions ofs
  WHERE ofs.id = NEW.submission_id;

  IF _submission IS NULL THEN
    RETURN NEW;
  END IF;

  _title := 'Melding til deg på bestilling ' || COALESCE(_submission.submission_no, '#');
  _body := LEFT(COALESCE(NEW.body, ''), 200);
  _link := '/orders/' || _submission.id::text;

  -- Create in-app notification
  INSERT INTO notifications (
    user_id, company_id, type, priority, title, message, link_url,
    entity_type, entity_id, actor_user_id, actor_name
  ) VALUES (
    _participant.user_id,
    _submission.company_id,
    'order_message_addressed',
    'important',
    _title,
    _body,
    _link,
    'order_form_submission',
    _submission.id,
    NEW.sender_user_id,
    NEW.sender_name
  );

  -- Trigger email send via pg_net (fire-and-forget to edge function)
  IF _participant.receives_notifications THEN
    _supabase_url := current_setting('app.settings.supabase_url', true);
    _service_key := current_setting('app.settings.service_role_key', true);
    
    BEGIN
      PERFORM net.http_post(
        COALESCE(_supabase_url, 'https://nmqycanqumelmfpdmkpr.supabase.co') || '/functions/v1/order-message-email-send',
        jsonb_build_object('message_id', NEW.id),
        jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(_service_key, current_setting('supabase.service_role_key', true))
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not trigger order email: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$function$;
