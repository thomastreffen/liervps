-- Extend event_logs.action_type CHECK to allow work_visit_* action types written by
-- create_work_visits_on_project_batch, and make the log insert defensive so a future
-- mismatch cannot block work visit creation.

ALTER TABLE public.event_logs DROP CONSTRAINT IF EXISTS event_logs_action_type_check;
ALTER TABLE public.event_logs ADD CONSTRAINT event_logs_action_type_check
  CHECK (action_type = ANY (ARRAY[
    'created'::text,
    'updated'::text,
    'cancelled'::text,
    'attendee_added'::text,
    'attendee_removed'::text,
    'technician_assigned'::text,
    'scheduled'::text,
    'work_visit_created'::text,
    'work_visit_repaired'::text,
    'work_visit_existing'::text
  ]));

-- Recreate RPC with defensive event_logs insert (BEGIN/EXCEPTION around the log write only)
CREATE OR REPLACE FUNCTION public.create_work_visits_on_project_batch(
  p_root_id uuid,
  p_dates date[],
  p_start_time time,
  p_end_time time,
  p_technician_ids uuid[],
  p_title text DEFAULT NULL,
  p_overnight boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _parent RECORD;
  _root_id uuid := p_root_id;
  _user uuid := auth.uid();
  _results jsonb := '[]'::jsonb;
  _date date;
  _start timestamptz;
  _end timestamptz;
  _tech uuid;
  _event_id uuid;
  _existing_id uuid;
  _status text;
  _inserted_blocks int;
  _existing_block uuid;
  _err_msg text; _err_state text; _err_detail text; _err_hint text;
BEGIN
  SELECT id, company_id, title, project_type, description, address, created_by
    INTO _parent
    FROM public.events
    WHERE id = _root_id AND deleted_at IS NULL;

  IF _parent.id IS NULL THEN
    RAISE EXCEPTION 'Parent project % not found', _root_id;
  END IF;

  FOREACH _date IN ARRAY p_dates LOOP
    BEGIN
      _status := NULL;
      _inserted_blocks := 0;
      _start := (_date::text || ' ' || p_start_time::text)::timestamptz;
      IF p_overnight OR p_end_time <= p_start_time THEN
        _end := ((_date + 1)::text || ' ' || p_end_time::text)::timestamptz;
      ELSE
        _end := (_date::text || ' ' || p_end_time::text)::timestamptz;
      END IF;

      SELECT id INTO _existing_id
        FROM public.events
        WHERE parent_event_id = _root_id
          AND deleted_at IS NULL
          AND start_time = _start
          AND end_time = _end
        LIMIT 1;

      IF _existing_id IS NOT NULL THEN
        _event_id := _existing_id;
        _status := 'existing';
      ELSE
        INSERT INTO public.events (
          title, company_id, project_type, description, address,
          start_time, end_time, status, created_by, parent_event_id
        ) VALUES (
          COALESCE(NULLIF(p_title,''), _parent.title),
          _parent.company_id, _parent.project_type, _parent.description, _parent.address,
          _start, _end, 'scheduled', _user, _root_id
        ) RETURNING id INTO _event_id;
        _status := 'created';
      END IF;

      IF p_technician_ids IS NOT NULL THEN
        FOREACH _tech IN ARRAY p_technician_ids LOOP
          INSERT INTO public.event_technicians (event_id, technician_id)
          VALUES (_event_id, _tech)
          ON CONFLICT DO NOTHING;

          SELECT id INTO _existing_block
            FROM public.schedule_blocks
            WHERE technician_id = _tech
              AND project_id = _event_id
              AND start_at = _start
              AND end_at = _end
              AND deleted_at IS NULL
            LIMIT 1;

          IF _existing_block IS NULL THEN
            INSERT INTO public.schedule_blocks (
              company_id, technician_id, project_id, parent_project_id, source, start_at, end_at,
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

      -- Defensive log insert: never block work-visit creation on log write.
      BEGIN
        INSERT INTO public.event_logs (event_id, action_type, performed_by, change_summary, metadata)
        VALUES (_event_id, 'work_visit_' || _status, _user,
                CASE WHEN _status='created' THEN 'Arbeidsbesøk opprettet'
                     WHEN _status='repaired' THEN 'Arbeidsbesøk reparert (manglende planblokker)'
                     ELSE 'Arbeidsbesøk fantes fra før' END,
                jsonb_build_object('inserted_blocks', _inserted_blocks, 'root_id', _root_id, 'date', _date,
                                   'start', _start, 'end', _end,
                                   'overnight', (_start::date <> _end::date)));
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'event_logs insert failed for event % action_type work_visit_%: %',
          _event_id, _status, SQLERRM;
      END;

      _results := _results || jsonb_build_object(
        'date', _date,
        'event_id', _event_id,
        'status', _status,
        'inserted_blocks', _inserted_blocks,
        'overnight', (_start::date <> _end::date)
      );
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS
        _err_msg = MESSAGE_TEXT,
        _err_state = RETURNED_SQLSTATE,
        _err_detail = PG_EXCEPTION_DETAIL,
        _err_hint = PG_EXCEPTION_HINT;

      RAISE WARNING 'create_work_visits_on_project_batch failed for date % (sqlstate %): % | detail: % | hint: %',
        _date, _err_state, _err_msg, _err_detail, _err_hint;

      _results := _results || jsonb_build_object(
        'date', _date,
        'error', _err_msg,
        'sqlstate', _err_state
      );
    END;
  END LOOP;

  RETURN jsonb_build_object('results', _results);
END;
$fn$;