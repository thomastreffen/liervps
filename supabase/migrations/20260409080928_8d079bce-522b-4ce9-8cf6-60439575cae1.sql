
-- 1. Function: create notification for addressed internal participant
CREATE OR REPLACE FUNCTION public.notify_order_message_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _participant record;
  _submission record;
  _title text;
  _body text;
  _link text;
BEGIN
  -- Only fire for messages with an addressed participant
  IF NEW.addressed_to_participant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Look up participant
  SELECT ofp.user_id, ofp.name, ofp.participant_type
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

  RETURN NEW;
END;
$$;

-- 2. Trigger on order_form_messages
DROP TRIGGER IF EXISTS trg_notify_order_message_participant ON public.order_form_messages;
CREATE TRIGGER trg_notify_order_message_participant
  AFTER INSERT ON public.order_form_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_message_participant();

-- 3. RLS: Allow participants to SELECT the order they're added to
CREATE POLICY "Participants can view their orders"
  ON public.order_form_submissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.order_form_participants ofp
      WHERE ofp.submission_id = order_form_submissions.id
        AND ofp.user_id = auth.uid()
        AND ofp.participant_type = 'internal_user'
    )
  );

-- 4. RLS: Allow participants to read messages on orders they participate in
CREATE POLICY "Participants can read order messages"
  ON public.order_form_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.order_form_participants ofp
      WHERE ofp.submission_id = order_form_messages.submission_id
        AND ofp.user_id = auth.uid()
        AND ofp.participant_type = 'internal_user'
    )
  );

-- 5. RLS: Allow participants to insert messages (reply)
CREATE POLICY "Participants can reply to order messages"
  ON public.order_form_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.order_form_participants ofp
      WHERE ofp.submission_id = order_form_messages.submission_id
        AND ofp.user_id = auth.uid()
        AND ofp.participant_type = 'internal_user'
        AND ofp.can_reply = true
    )
  );
