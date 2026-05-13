-- Trigger: notify HMS managers when high/critical incident is filed
CREATE OR REPLACE FUNCTION public.notify_hms_incident_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid;
  pri text;
BEGIN
  IF NEW.severity IN ('high', 'critical') THEN
    pri := CASE WHEN NEW.severity = 'critical' THEN 'critical' ELSE 'important' END;

    FOR uid IN
      SELECT DISTINCT um.user_id
      FROM public.user_memberships um
      WHERE um.company_id = NEW.company_id
        AND um.is_active = true
        AND public.has_hms_manage(um.user_id, NEW.company_id)
    LOOP
      INSERT INTO public.notifications (
        user_id, company_id, type, title, message,
        priority, entity_type, entity_id, link_url, actor_user_id
      ) VALUES (
        uid,
        NEW.company_id,
        'hms.incident.reported',
        CASE WHEN NEW.severity = 'critical' THEN 'Kritisk HMS-avvik meldt' ELSE 'HMS-avvik meldt (høy)' END,
        COALESCE(NEW.title, 'Nytt HMS-avvik'),
        pri,
        'hms_incident',
        NEW.id,
        '/hms/incidents/' || NEW.id::text,
        NEW.reported_by
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_hms_incident ON public.hms_incidents;
CREATE TRIGGER trg_notify_hms_incident
AFTER INSERT ON public.hms_incidents
FOR EACH ROW EXECUTE FUNCTION public.notify_hms_incident_on_insert();