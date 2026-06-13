
-- 1) Repair mis-parented tasks (parent_project_id pointed to another task)
UPDATE public.events
SET parent_project_id = '7ad754f5-7080-4cae-90bf-3af8127b5048'
WHERE id = 'bb28fb2b-3f2f-4432-ad9e-d7e2a1f3db8a';

UPDATE public.events
SET parent_project_id = 'f9359604-122e-427c-894b-6266659b68ea'
WHERE id = '606458cb-e4f0-4453-a2fb-b6da3b22e446';

-- 2) Backfill missing schedule_blocks for known orphans (event + technicians exist, no blocks)
INSERT INTO public.schedule_blocks (company_id, technician_id, project_id, job_id, source, start_at, end_at, title, match_state, match_confidence, match_reason)
SELECT e.company_id, et.technician_id, COALESCE(e.parent_project_id, e.id), e.id, 'manual',
       COALESCE(et.start_at, e.start_time), COALESCE(et.end_at, e.end_time),
       e.title, 'manual', 100, 'Reparert etter delvis opprettelse'
FROM public.events e
JOIN public.event_technicians et ON et.event_id = e.id
WHERE e.id IN ('606458cb-e4f0-4453-a2fb-b6da3b22e446','d88a94ac-5a4f-4faf-a3d7-ed38f3e9b131')
  AND NOT EXISTS (
    SELECT 1 FROM public.schedule_blocks sb
    WHERE sb.job_id = e.id AND sb.technician_id = et.technician_id AND sb.deleted_at IS NULL
  );

-- 3) Idempotency: unique partial index on client_request_id
CREATE UNIQUE INDEX IF NOT EXISTS events_client_request_id_unique
  ON public.events (client_request_id)
  WHERE deleted_at IS NULL AND client_request_id IS NOT NULL;

-- 4) Transactional RPC: create work visit on existing project, idempotent + parent normalization
CREATE OR REPLACE FUNCTION public.create_work_visit_on_project(
  p_parent_id uuid,
  p_client_request_id uuid,
  p_title text,
  p_start timestamptz,
  p_end timestamptz,
  p_technician_ids uuid[],
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
  _event_id uuid;
  _status text := 'created';
  _existing record;
  _tech uuid;
  _inserted_blocks int := 0;
BEGIN
  IF p_parent_id IS NULL OR p_client_request_id IS NULL OR p_start IS NULL OR p_end IS NULL THEN
    RAISE EXCEPTION 'missing required parameters';
  END IF;

  -- Resolve true root project (walk up if parent itself is a task)
  SELECT id, parent_project_id, project_type, company_id, title, customer, address, postal_code, city,
         location_details, site_contact_name, site_contact_phone, access_notes, map_link, description,
         customer_practical_info, source_order_form_id
    INTO _parent FROM public.events WHERE id = p_parent_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'parent project not found'; END IF;

  _root_id := CASE WHEN _parent.project_type = 'task' AND _parent.parent_project_id IS NOT NULL
                   THEN _parent.parent_project_id ELSE _parent.id END;

  -- Reload from root if changed
  IF _root_id <> _parent.id THEN
    SELECT id, parent_project_id, project_type, company_id, title, customer, address, postal_code, city,
           location_details, site_contact_name, site_contact_phone, access_notes, map_link, description,
           customer_practical_info, source_order_form_id
      INTO _parent FROM public.events WHERE id = _root_id AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'root project not found'; END IF;
  END IF;

  -- Idempotency: look up existing event by client_request_id
  SELECT id INTO _existing FROM public.events
   WHERE client_request_id = p_client_request_id AND deleted_at IS NULL LIMIT 1;

  IF FOUND THEN
    _event_id := _existing.id;
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
      p_start, p_end,
      COALESCE(p_technician_ids[1], _user),
      'requested', _user, p_client_request_id, _parent.company_id, _parent.source_order_form_id
    ) RETURNING id INTO _event_id;
  END IF;

  -- Upsert event_technicians (idempotent)
  IF p_technician_ids IS NOT NULL THEN
    FOREACH _tech IN ARRAY p_technician_ids LOOP
      INSERT INTO public.event_technicians (event_id, technician_id, start_at, end_at)
      VALUES (_event_id, _tech, p_start, p_end)
      ON CONFLICT (event_id, technician_id) DO UPDATE
        SET start_at = EXCLUDED.start_at, end_at = EXCLUDED.end_at;
    END LOOP;

    -- Insert missing schedule_blocks (idempotent by tech+start+end+job)
    FOREACH _tech IN ARRAY p_technician_ids LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.schedule_blocks sb
        WHERE sb.job_id = _event_id AND sb.technician_id = _tech
          AND sb.start_at = p_start AND sb.end_at = p_end AND sb.deleted_at IS NULL
      ) THEN
        INSERT INTO public.schedule_blocks (
          company_id, technician_id, project_id, job_id, source, start_at, end_at,
          title, match_state, match_confidence, match_reason
        ) VALUES (
          _parent.company_id, _tech, _root_id, _event_id, 'manual', p_start, p_end,
          COALESCE(NULLIF(p_title,''), _parent.title),
          'manual', 100, 'Arbeidsbesøk via planlegger'
        );
        _inserted_blocks := _inserted_blocks + 1;
      END IF;
    END LOOP;
  END IF;

  -- Event log
  INSERT INTO public.event_logs (event_id, action_type, performed_by, change_summary, metadata)
  VALUES (_event_id, 'work_visit_' || _status, _user,
          CASE WHEN _status='existing' THEN 'Arbeidsbesøk fantes fra før, fullført' ELSE 'Arbeidsbesøk opprettet' END,
          jsonb_build_object('inserted_blocks', _inserted_blocks, 'root_id', _root_id));

  IF _status = 'existing' AND _inserted_blocks > 0 THEN
    _status := 'repaired';
  END IF;

  RETURN jsonb_build_object(
    'event_id', _event_id,
    'root_project_id', _root_id,
    'status', _status,
    'inserted_blocks', _inserted_blocks
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_work_visit_on_project(uuid, uuid, text, timestamptz, timestamptz, uuid[], jsonb) TO authenticated;
