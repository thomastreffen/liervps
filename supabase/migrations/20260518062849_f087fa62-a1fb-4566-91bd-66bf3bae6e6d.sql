-- 1. Extend hms_incidents
ALTER TABLE public.hms_incidents
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS closed_reason text;

CREATE INDEX IF NOT EXISTS idx_hms_incidents_assigned ON public.hms_incidents(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hms_incidents_status ON public.hms_incidents(company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hms_incidents_project ON public.hms_incidents(project_id) WHERE deleted_at IS NULL;

-- 2. Comments table
CREATE TABLE IF NOT EXISTS public.hms_incident_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.hms_incidents(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  author_id uuid NOT NULL,
  body text NOT NULL,
  attachments jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hms_incident_comments_incident ON public.hms_incident_comments(incident_id);
ALTER TABLE public.hms_incident_comments ENABLE ROW LEVEL SECURITY;

-- 3. Status log table
CREATE TABLE IF NOT EXISTS public.hms_incident_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.hms_incidents(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  reason text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hms_incident_status_log_incident ON public.hms_incident_status_log(incident_id);
ALTER TABLE public.hms_incident_status_log ENABLE ROW LEVEL SECURITY;

-- 4. Helper: can user access an incident (manager OR reporter OR assignee OR project member)
CREATE OR REPLACE FUNCTION public.has_hms_incident_access(_auth_user_id uuid, _incident_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hms_incidents i
    WHERE i.id = _incident_id
      AND i.deleted_at IS NULL
      AND (
        public.has_hms_view(_auth_user_id, i.company_id)
        OR i.reported_by = _auth_user_id
        OR i.assigned_to = _auth_user_id
        OR (i.project_id IS NOT NULL AND public.is_project_member(_auth_user_id, i.project_id))
      )
  )
$$;

-- 5. Extend incidents SELECT policy: include project members and assignee
DROP POLICY IF EXISTS hms_incidents_select ON public.hms_incidents;
CREATE POLICY hms_incidents_select ON public.hms_incidents FOR SELECT
  USING (
    deleted_at IS NULL AND (
      public.has_hms_view(auth.uid(), company_id)
      OR reported_by = auth.uid()
      OR assigned_to = auth.uid()
      OR (project_id IS NOT NULL AND public.is_project_member(auth.uid(), project_id))
    )
  );

-- Extend update: assignee can also update status/comments via comments table
DROP POLICY IF EXISTS hms_incidents_update ON public.hms_incidents;
CREATE POLICY hms_incidents_update ON public.hms_incidents FOR UPDATE
  USING (
    public.has_hms_manage(auth.uid(), company_id)
    OR assigned_to = auth.uid()
    OR (reported_by = auth.uid() AND status = 'open')
  )
  WITH CHECK (
    public.has_hms_manage(auth.uid(), company_id)
    OR assigned_to = auth.uid()
    OR (reported_by = auth.uid() AND status = 'open')
  );

-- 6. Comments RLS
DROP POLICY IF EXISTS hms_incident_comments_select ON public.hms_incident_comments;
CREATE POLICY hms_incident_comments_select ON public.hms_incident_comments FOR SELECT
  USING (public.has_hms_incident_access(auth.uid(), incident_id));

DROP POLICY IF EXISTS hms_incident_comments_insert ON public.hms_incident_comments;
CREATE POLICY hms_incident_comments_insert ON public.hms_incident_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND public.has_hms_incident_access(auth.uid(), incident_id)
  );

-- 7. Status log RLS – read only for those with incident access; insert by trigger
DROP POLICY IF EXISTS hms_incident_status_log_select ON public.hms_incident_status_log;
CREATE POLICY hms_incident_status_log_select ON public.hms_incident_status_log FOR SELECT
  USING (public.has_hms_incident_access(auth.uid(), incident_id));

-- 8. Trigger: log status changes + notify reporter
CREATE OR REPLACE FUNCTION public.on_hms_incident_status_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _actor uuid;
  _title text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    _actor := COALESCE(auth.uid(), NEW.assigned_to);

    INSERT INTO public.hms_incident_status_log (incident_id, company_id, from_status, to_status, reason, changed_by)
    VALUES (NEW.id, NEW.company_id, OLD.status, NEW.status, NEW.closed_reason, _actor);

    -- Notify reporter (if different from actor)
    IF NEW.reported_by IS NOT NULL AND NEW.reported_by <> COALESCE(_actor, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      _title := CASE
        WHEN NEW.status = 'closed' THEN 'HMS-avvik lukket'
        WHEN NEW.status = 'rejected' THEN 'HMS-avvik avvist'
        WHEN NEW.status = 'in_progress' THEN 'HMS-avvik under behandling'
        WHEN NEW.status = 'action_pending' THEN 'Tiltak opprettet på HMS-avvik'
        ELSE 'HMS-avvik status oppdatert'
      END;

      INSERT INTO public.notifications (
        user_id, company_id, type, title, message, priority,
        entity_type, entity_id, link_url, actor_user_id
      ) VALUES (
        NEW.reported_by, NEW.company_id, 'hms.incident.status_changed',
        _title, COALESCE(NEW.title, 'HMS-avvik'),
        'info', 'hms_incident', NEW.id,
        '/hms/incidents/' || NEW.id::text, _actor
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hms_incident_status_change ON public.hms_incidents;
CREATE TRIGGER trg_hms_incident_status_change
AFTER UPDATE ON public.hms_incidents
FOR EACH ROW EXECUTE FUNCTION public.on_hms_incident_status_change();