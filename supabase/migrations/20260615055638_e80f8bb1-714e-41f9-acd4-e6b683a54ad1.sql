
CREATE OR REPLACE FUNCTION public.create_work_visits_on_project_batch(
  p_parent_id uuid,
  p_client_request_id uuid,
  p_title text,
  p_technician_ids uuid[],
  p_dates jsonb,                 -- [{date: 'YYYY-MM-DD', start: ISO, end: ISO}, ...]
  p_extra jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _parent record;
  _root_id uuid;
  _results jsonb := '[]'::jsonb;
  _row jsonb;
  _date text;
  _start timestamptz;
  _end timestamptz;
  _per_req uuid;
  _event_id uuid;
  _existing_id uuid;
  _status text;
  _inserted_blocks int;
  _tech uuid;
  _err_msg text;
BEGIN
  IF p_parent_id IS NULL OR p_client_request_id IS NULL OR p_dates IS NULL OR jsonb_array_length(p_dates) = 0 THEN
    RAISE EXCEPTION 'missing required parameters';
  END IF;

  -- Resolve true root project (normalize parent-on-task)
  SELECT id, parent_project_id, project_type, company_id, title, customer, address, postal_code, city,
         location_details, site_contact_name, site_contact_phone, access_notes, map_link, description,
         customer_practical_info, source_order_form_id
    INTO _parent FROM public.events WHERE id = p_parent_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'parent project not found'; END IF;

  _root_id := CASE WHEN _parent.project_type = 'task' AND _parent.parent_project_id IS NOT NULL
                   THEN _parent.parent_project_id ELSE _parent.id END;

  IF _root_id <> _parent.id THEN
    SELECT id, parent_project_id, project_type, company_id, title, customer, address, postal_code, city,
           location_details, site_contact_name, site_contact_phone, access_notes, map_link, description,
           customer_practical_info, source_order_form_id
      INTO _parent FROM public.events WHERE id = _root_id AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'root project not found'; END IF;
  END IF;

  FOR _row IN SELECT * FROM jsonb_array_elements(p_dates)
  LOOP
    BEGIN
      _date := _row->>'date';
      _start := (_row->>'start')::timestamptz;
      _end := (_row->>'end')::timestamptz;
      _status := 'created';
      _inserted_blocks := 0;
      _event_id := NULL;

      IF _date IS NULL OR _start IS NULL OR _end IS NULL THEN
        _results := _results || jsonb_build_object('date', _date, 'status', 'failed', 'error', 'invalid date entry');
        CONTINUE;
      END IF;

      -- Deterministic per-date idempotency key
      _per_req := md5(p_client_request_id::text || '|' || _date)::uuid;

      -- Duplicate guard: same parent + tech + date + start_time on active task
      IF p_technician_ids IS NOT NULL AND array_length(p_technician_ids, 1) > 0 THEN
        SELECT e.id INTO _existing_id
        FROM public.events e
        WHERE e.parent_project_id = _root_id
          AND e.project_type = 'task'
          AND e.deleted_at IS NULL
          AND e.start_time = _start
          AND EXISTS (
            SELECT 1 FROM public.event_technicians et
            WHERE et.event_id = e.id AND et.technician_id = ANY(p_technician_ids)
          )
        LIMIT 1;
      END IF;

      -- Idempotency: by deterministic client_request_id
      IF _existing_id IS NULL THEN
        SELECT id INTO _existing_id FROM public.events
         WHERE client_request_id = _per_req AND deleted_at IS NULL LIMIT 1;
      END IF;

      IF _existing_id IS NOT NULL THEN
        _event_id := _existing_id;
        _status := 'existing';
      ELSE
        INSERT INTO public.events (
          parent_project_id, project_type, title, customer, address, postal_code, city,
          location_details, site_contact_name, site_contact_phone, access_notes, map_link,
          description, customer_practical_info, start_time, end_time, technician_id, status,
          created_by, client_request_id, company_id, source_order_form_id
        ) VALUES (
          _root_id, 'task',
          COALESCE(NULLIF(p_title,''), _parent.title),
          _parent.customer, _parent.address, _parent.postal_code, _parent.city,
          _parent.location_details, _parent.site_contact_name, _parent.site_contact_phone,
          _parent.access_notes, _parent.map_link, _parent.description, _parent.customer_practical_info,
          _start, _end,
          COALESCE(p_technician_ids[1], _user),
          'requested', _user, _per_req, _parent.company_id, _parent.source_order_form_id
        ) RETURNING id INTO _event_id;
      END IF;

      -- Upsert event_technicians
      IF p_technician_ids IS NOT NULL THEN
        FOREACH _tech IN ARRAY p_technician_ids LOOP
          INSERT INTO public.event_technicians (event_id, technician_id, start_at, end_at)
          VALUES (_event_id, _tech, _start, _end)
          ON CONFLICT (event_id, technician_id) DO UPDATE
            SET start_at = EXCLUDED.start_at, end_at = EXCLUDED.end_at;
        END LOOP;

        FOREACH _tech IN ARRAY p_technician_ids LOOP
          IF NOT EXISTS (
            SELECT 1 FROM public.schedule_blocks sb
            WHERE sb.job_id = _event_id AND sb.technician_id = _tech
              AND sb.start_at = _start AND sb.end_at = _end AND sb.deleted_at IS NULL
          ) THEN
            INSERT INTO public.schedule_blocks (
              company_id, technician_id, project_id, job_id, source, start_at, end_at,
              title, match_state, match_confidence, match_reason
            ) VALUES (
              _parent.company_id, _tech, _root_id, _event_id, 'manual', _start, _end,
              COALESCE(NULLIF(p_title,''), _parent.title),
              'manual', 100, 'Arbeidsbesøk via planlegger'
            );
            _inserted_blocks := _inserted_blocks + 1;
          END IF;
        END LOOP;
      END IF;

      IF _status = 'existing' AND _inserted_blocks > 0 THEN
        _status := 'repaired';
      END IF;

      INSERT INTO public.event_logs (event_id, action_type, performed_by, change_summary, metadata)
      VALUES (_event_id, 'work_visit_' || _status, _user,
              CASE WHEN _status='created' THEN 'Arbeidsbesøk opprettet'
                   WHEN _status='repaired' THEN 'Arbeidsbesøk reparert (manglende planblokker)'
                   ELSE 'Arbeidsbesøk fantes fra før' END,
              jsonb_build_object('inserted_blocks', _inserted_blocks, 'root_id', _root_id, 'date', _date));

      _results := _results || jsonb_build_object(
        'date', _date,
        'event_id', _event_id,
        'status', _status,
        'inserted_blocks', _inserted_blocks
      );
    EXCEPTION WHEN OTHERS THEN
      _err_msg := SQLERRM;
      _results := _results || jsonb_build_object(
        'date', _date,
        'status', 'failed',
        'error', _err_msg
      );
    END;
  END LOOP;

  RETURN jsonb_build_object('root_project_id', _root_id, 'results', _results);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_work_visits_on_project_batch(uuid, uuid, text, uuid[], jsonb, jsonb) TO authenticated;
