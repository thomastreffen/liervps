CREATE OR REPLACE FUNCTION public.notify_new_order_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid;
  v_title text;
  v_msg text;
  v_link text;
  v_who text;
  v_summary_text text;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_who := COALESCE(
    NULLIF(NEW.submitter_name, ''),
    NULLIF(NEW.submitter_email, ''),
    'Ukjent avsender'
  );

  IF NEW.summary IS NOT NULL AND jsonb_typeof(NEW.summary) = 'object' THEN
    v_summary_text := COALESCE(
      NULLIF(NEW.summary ->> 'oppdragstittel', ''),
      NULLIF(NEW.summary ->> 'firmanavn', ''),
      NULLIF(NEW.summary ->> 'kundenavn', ''),
      NULLIF(NEW.summary ->> 'bestiller_navn', '')
    );
  ELSIF NEW.summary IS NOT NULL AND jsonb_typeof(NEW.summary) IN ('string', 'number', 'boolean') THEN
    v_summary_text := NULLIF(btrim(NEW.summary #>> '{}'), '');
  END IF;

  v_title := COALESCE(v_summary_text, 'Ny servicebestilling fra ' || v_who);
  v_msg := 'Ny servicebestilling: ' || v_who || COALESCE(' · ' || NEW.priority, '');
  v_link := '/orders/' || NEW.id::text;

  FOR v_admin IN SELECT public._notif_admin_user_ids() LOOP
    INSERT INTO public.notifications
      (user_id, type, title, message, link_url, priority,
       entity_type, entity_id, company_id)
    VALUES
      (v_admin, 'new_order', v_title, v_msg, v_link, 'important',
       'order_submission', NEW.id, NEW.company_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;