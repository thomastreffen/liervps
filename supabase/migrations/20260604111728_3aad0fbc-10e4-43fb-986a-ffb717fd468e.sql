
ALTER TABLE public.order_form_participants DROP CONSTRAINT IF EXISTS valid_participant_type;
ALTER TABLE public.order_form_participants
  ADD CONSTRAINT valid_participant_type
  CHECK (participant_type = ANY (ARRAY['internal_user','customer_contact','external_email','customer','technician']));

ALTER TABLE public.order_form_participants
  ADD COLUMN IF NOT EXISTS technician_id uuid,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS added_by uuid,
  ADD COLUMN IF NOT EXISTS added_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_message_id uuid,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE public.order_form_participants SET display_name = name WHERE display_name IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ofp_submission_user
  ON public.order_form_participants(submission_id, user_id)
  WHERE user_id IS NOT NULL AND is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ofp_submission_technician
  ON public.order_form_participants(submission_id, technician_id)
  WHERE technician_id IS NOT NULL AND is_active = true;

CREATE TABLE IF NOT EXISTS public.order_form_message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.order_form_messages(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES public.order_form_submissions(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.order_form_participants(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  reader_type text NOT NULL,
  user_id uuid,
  tracking_token_hash text,
  user_agent text
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ofmr_message_participant
  ON public.order_form_message_reads(message_id, participant_id);
CREATE INDEX IF NOT EXISTS idx_ofmr_submission ON public.order_form_message_reads(submission_id);
CREATE INDEX IF NOT EXISTS idx_ofmr_message ON public.order_form_message_reads(message_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_form_message_reads TO authenticated;
GRANT ALL ON public.order_form_message_reads TO service_role;
ALTER TABLE public.order_form_message_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal users can read message reads" ON public.order_form_message_reads;
CREATE POLICY "Internal users can read message reads"
  ON public.order_form_message_reads FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.order_form_submissions s
      WHERE s.id = order_form_message_reads.submission_id
        AND s.deleted_at IS NULL
        AND (public.user_has_company_access(auth.uid(), s.company_id)
             OR public.has_cross_company_order_access(auth.uid(), s.id))
    )
  );

CREATE OR REPLACE FUNCTION public.mark_messages_read_internal(_submission_id uuid, _message_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  _uid uuid := auth.uid();
  _company_id uuid;
  _participant_id uuid;
  _full_name text;
  _email text;
  _last_msg_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT company_id INTO _company_id FROM order_form_submissions
    WHERE id = _submission_id AND deleted_at IS NULL;
  IF _company_id IS NULL THEN RAISE EXCEPTION 'Submission not found'; END IF;
  IF NOT (public.user_has_company_access(_uid, _company_id)
          OR public.has_cross_company_order_access(_uid, _submission_id)) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT id INTO _participant_id FROM order_form_participants
    WHERE submission_id = _submission_id AND user_id = _uid AND is_active = true LIMIT 1;

  IF _participant_id IS NULL THEN
    SELECT p.full_name, p.email INTO _full_name, _email
    FROM user_accounts ua LEFT JOIN people p ON p.id = ua.person_id
    WHERE ua.auth_user_id = _uid AND ua.is_active = true LIMIT 1;
    INSERT INTO order_form_participants (
      submission_id, participant_type, user_id, name, display_name, email,
      role_label, visibility, added_by, is_active
    ) VALUES (
      _submission_id, 'internal_user', _uid,
      COALESCE(_full_name, 'Intern bruker'),
      COALESCE(_full_name, 'Intern bruker'),
      _email, 'Intern', 'internal', _uid, true
    ) RETURNING id INTO _participant_id;
  END IF;

  SELECT id INTO _last_msg_id FROM order_form_messages
    WHERE submission_id = _submission_id ORDER BY created_at DESC LIMIT 1;

  INSERT INTO order_form_message_reads (message_id, submission_id, participant_id, reader_type, user_id)
  SELECT m.id, _submission_id, _participant_id, 'internal_user', _uid
  FROM order_form_messages m
  WHERE m.submission_id = _submission_id AND m.id = ANY(_message_ids)
  ON CONFLICT (message_id, participant_id) DO NOTHING;

  UPDATE order_form_participants
    SET last_seen_at = now(),
        last_seen_message_id = COALESCE(_last_msg_id, last_seen_message_id)
    WHERE id = _participant_id;

  RETURN jsonb_build_object('participant_id', _participant_id);
END;
$fn$;
REVOKE ALL ON FUNCTION public.mark_messages_read_internal(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_messages_read_internal(uuid, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_messages_read_by_token(_tracking_token text, _message_ids uuid[], _user_agent text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  _submission_id uuid;
  _participant_id uuid;
  _last_msg_id uuid;
  _customer_name text;
  _customer_email text;
BEGIN
  SELECT id, COALESCE(submitter_name, 'Kunde'), submitter_email
    INTO _submission_id, _customer_name, _customer_email
  FROM order_form_submissions
  WHERE public_tracking_token = _tracking_token AND deleted_at IS NULL LIMIT 1;
  IF _submission_id IS NULL THEN RAISE EXCEPTION 'Invalid tracking token'; END IF;

  SELECT id INTO _participant_id FROM order_form_participants
    WHERE submission_id = _submission_id AND participant_type = 'customer' AND is_active = true
    ORDER BY created_at ASC LIMIT 1;
  IF _participant_id IS NULL THEN
    INSERT INTO order_form_participants (submission_id, participant_type, name, display_name, email, role_label, visibility, is_active)
    VALUES (_submission_id, 'customer', _customer_name, _customer_name, _customer_email, 'Bestiller', 'shared_with_customer', true)
    RETURNING id INTO _participant_id;
  END IF;

  SELECT id INTO _last_msg_id FROM order_form_messages
    WHERE submission_id = _submission_id AND is_visible_to_customer = true
    ORDER BY created_at DESC LIMIT 1;

  INSERT INTO order_form_message_reads (message_id, submission_id, participant_id, reader_type, user_agent, tracking_token_hash)
  SELECT m.id, _submission_id, _participant_id, 'customer', _user_agent, md5(_tracking_token)
  FROM order_form_messages m
  WHERE m.submission_id = _submission_id AND m.id = ANY(_message_ids) AND m.is_visible_to_customer = true
  ON CONFLICT (message_id, participant_id) DO NOTHING;

  UPDATE order_form_participants
    SET last_seen_at = now(), last_seen_message_id = COALESCE(_last_msg_id, last_seen_message_id)
    WHERE id = _participant_id;
  UPDATE order_form_submissions SET customer_last_viewed_at = now() WHERE id = _submission_id;

  RETURN jsonb_build_object('participant_id', _participant_id, 'submission_id', _submission_id);
END;
$fn$;
REVOKE ALL ON FUNCTION public.mark_messages_read_by_token(text, uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_messages_read_by_token(text, uuid[], text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.upsert_internal_conversation_participant(
  _submission_id uuid, _user_id uuid DEFAULT NULL, _technician_id uuid DEFAULT NULL,
  _display_name text DEFAULT NULL, _email text DEFAULT NULL, _phone text DEFAULT NULL,
  _role_label text DEFAULT 'Intern', _visibility text DEFAULT 'internal'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  _uid uuid := auth.uid();
  _company_id uuid;
  _participant_id uuid;
  _ptype text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF _user_id IS NULL AND _technician_id IS NULL THEN RAISE EXCEPTION 'Need user_id or technician_id'; END IF;
  SELECT company_id INTO _company_id FROM order_form_submissions WHERE id = _submission_id AND deleted_at IS NULL;
  IF _company_id IS NULL THEN RAISE EXCEPTION 'Submission not found'; END IF;
  IF NOT public.user_has_company_access(_uid, _company_id) THEN RAISE EXCEPTION 'Access denied'; END IF;

  _ptype := CASE WHEN _technician_id IS NOT NULL THEN 'technician' ELSE 'internal_user' END;

  IF _user_id IS NOT NULL THEN
    SELECT id INTO _participant_id FROM order_form_participants
      WHERE submission_id = _submission_id AND user_id = _user_id;
  ELSE
    SELECT id INTO _participant_id FROM order_form_participants
      WHERE submission_id = _submission_id AND technician_id = _technician_id;
  END IF;

  IF _participant_id IS NULL THEN
    INSERT INTO order_form_participants (
      submission_id, participant_type, user_id, technician_id, name, display_name, email, phone, role_label, visibility, added_by, is_active
    ) VALUES (
      _submission_id, _ptype, _user_id, _technician_id,
      COALESCE(_display_name, 'Deltaker'), COALESCE(_display_name, 'Deltaker'),
      _email, _phone, _role_label, _visibility, _uid, true
    ) RETURNING id INTO _participant_id;
  ELSE
    UPDATE order_form_participants SET
      is_active = true,
      display_name = COALESCE(_display_name, display_name),
      email = COALESCE(_email, email),
      phone = COALESCE(_phone, phone),
      role_label = COALESCE(_role_label, role_label),
      visibility = COALESCE(_visibility, visibility)
    WHERE id = _participant_id;
  END IF;
  RETURN _participant_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.upsert_internal_conversation_participant(uuid, uuid, uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_internal_conversation_participant(uuid, uuid, uuid, text, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.deactivate_conversation_participant(_participant_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  _uid uuid := auth.uid();
  _company_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;
  SELECT s.company_id INTO _company_id FROM order_form_participants p
    JOIN order_form_submissions s ON s.id = p.submission_id WHERE p.id = _participant_id;
  IF _company_id IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF NOT public.user_has_company_access(_uid, _company_id) THEN RAISE EXCEPTION 'Denied'; END IF;
  UPDATE order_form_participants SET is_active = false WHERE id = _participant_id;
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.deactivate_conversation_participant(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_message_reads_by_token(_tracking_token text)
RETURNS TABLE(message_id uuid, internal_read_count int, internal_first_read_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  RETURN QUERY
  SELECT r.message_id,
         sum(CASE WHEN p.participant_type IN ('internal_user','technician') THEN 1 ELSE 0 END)::int,
         min(CASE WHEN p.participant_type IN ('internal_user','technician') THEN r.read_at END)
  FROM order_form_message_reads r
  JOIN order_form_participants p ON p.id = r.participant_id
  JOIN order_form_submissions s ON s.id = r.submission_id
  WHERE s.public_tracking_token = _tracking_token AND s.deleted_at IS NULL
  GROUP BY r.message_id;
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.get_message_reads_by_token(text) TO anon, authenticated;

DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_form_message_reads;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

INSERT INTO order_form_participants (submission_id, participant_type, name, display_name, email, role_label, visibility, is_active)
SELECT s.id, 'customer', COALESCE(s.submitter_name, 'Kunde'), COALESCE(s.submitter_name, 'Kunde'),
       s.submitter_email, 'Bestiller', 'shared_with_customer', true
FROM order_form_submissions s
WHERE s.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM order_form_participants p WHERE p.submission_id = s.id AND p.participant_type = 'customer');

INSERT INTO order_form_participants (submission_id, participant_type, user_id, name, display_name, email, role_label, visibility, is_active)
SELECT DISTINCT ON (m.submission_id, m.sender_user_id)
  m.submission_id, 'internal_user', m.sender_user_id,
  COALESCE(p.full_name, m.sender_name, 'Intern'),
  COALESCE(p.full_name, m.sender_name, 'Intern'),
  p.email, 'Intern', 'internal', true
FROM order_form_messages m
LEFT JOIN user_accounts ua ON ua.auth_user_id = m.sender_user_id
LEFT JOIN people p ON p.id = ua.person_id
WHERE m.sender_user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM order_form_participants pp WHERE pp.submission_id = m.submission_id AND pp.user_id = m.sender_user_id);
