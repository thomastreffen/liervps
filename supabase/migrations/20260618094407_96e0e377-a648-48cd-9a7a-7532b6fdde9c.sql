
-- ===== Deduplication indexes =====
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedup_approval_response
  ON public.notifications (user_id, event_id, type, actor_user_id)
  WHERE actor_user_id IS NOT NULL AND event_id IS NOT NULL
        AND type IN ('approval_response', 'approved', 'rejected', 'time_change_proposed');

CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedup_all_approved
  ON public.notifications (user_id, event_id, type)
  WHERE type = 'all_approved' AND event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedup_new_order
  ON public.notifications (user_id, entity_id, type)
  WHERE type = 'new_order' AND entity_id IS NOT NULL;

-- ===== Helper: list of admin/superadmin user_ids =====
CREATE OR REPLACE FUNCTION public._notif_admin_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin','super_admin')
  UNION
  SELECT DISTINCT ua.auth_user_id
    FROM public.user_roles_v2 urv
    JOIN public.roles r ON r.id = urv.role_id
    JOIN public.user_accounts ua ON ua.id = urv.user_account_id
   WHERE ua.is_active AND ua.auth_user_id IS NOT NULL
     AND r.name IN ('Planlegger/Admin','Superadmin');
$$;

-- ===== Trigger: job_approvals status change → notification =====
CREATE OR REPLACE FUNCTION public.notify_job_approval_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tech_name   text;
  v_job_title   text;
  v_job_number  text;
  v_link        text;
  v_notif_type  text;
  v_message     text;
  v_admin       uuid;
  v_all_approved boolean;
  v_total       int;
  v_approved    int;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('approved','rejected','declined','reschedule_requested','change_request') THEN
    RETURN NEW;
  END IF;

  -- Tech name
  SELECT name INTO v_tech_name
    FROM public.technicians
   WHERE user_id = NEW.technician_user_id
   LIMIT 1;
  v_tech_name := COALESCE(v_tech_name, 'Montør');

  -- Job info
  SELECT title, COALESCE(job_number, internal_number, project_number)
    INTO v_job_title, v_job_number
    FROM public.events
   WHERE id = NEW.job_id;

  v_link := '/projects/' || NEW.job_id::text;
  v_job_number := COALESCE(v_job_number, v_job_title, 'jobb');

  v_notif_type := CASE
    WHEN NEW.status = 'approved' THEN 'approved'
    WHEN NEW.status IN ('rejected','declined') THEN 'rejected'
    ELSE 'time_change_proposed'
  END;

  v_message := CASE
    WHEN NEW.status = 'approved' THEN v_tech_name || ' godkjente ' || v_job_number
    WHEN NEW.status IN ('rejected','declined') THEN v_tech_name || ' avslo ' || v_job_number || COALESCE(' – ' || NEW.comment, '')
    ELSE v_tech_name || ' foreslo nytt tidspunkt for ' || v_job_number
  END;

  FOR v_admin IN SELECT public._notif_admin_user_ids() LOOP
    INSERT INTO public.notifications
      (user_id, event_id, type, title, message, link_url, priority,
       entity_type, entity_id, actor_user_id, actor_name)
    VALUES
      (v_admin, NEW.job_id, v_notif_type, v_job_number, v_message, v_link,
       CASE WHEN NEW.status = 'approved' THEN 'info' ELSE 'important' END,
       'event', NEW.job_id, NEW.technician_user_id, v_tech_name)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Check "all approved"
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'approved')
    INTO v_total, v_approved
    FROM public.job_approvals
   WHERE job_id = NEW.job_id;

  IF v_total > 0 AND v_total = v_approved THEN
    FOR v_admin IN SELECT public._notif_admin_user_ids() LOOP
      INSERT INTO public.notifications
        (user_id, event_id, type, title, message, link_url, priority,
         entity_type, entity_id)
      VALUES
        (v_admin, NEW.job_id, 'all_approved', v_job_number,
         v_job_number || ' er godkjent av alle (' || v_total || ' montører)',
         v_link, 'info', 'event', NEW.job_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_job_approval_change ON public.job_approvals;
CREATE TRIGGER trg_notify_job_approval_change
AFTER UPDATE OF status ON public.job_approvals
FOR EACH ROW EXECUTE FUNCTION public.notify_job_approval_change();

-- ===== Trigger: new order submission → notification =====
CREATE OR REPLACE FUNCTION public.notify_new_order_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin   uuid;
  v_title   text;
  v_msg     text;
  v_link    text;
  v_who     text;
BEGIN
  -- Skip soft-deleted / pre-converted rows
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_who := COALESCE(NULLIF(NEW.submitter_name, ''),
                    NULLIF(NEW.submitter_email, ''),
                    'Ukjent avsender');
  v_title := COALESCE(NULLIF(NEW.summary, ''),
                      'Ny servicebestilling fra ' || v_who);
  v_msg   := 'Ny servicebestilling: ' || v_who
             || COALESCE(' · ' || NEW.priority, '');
  v_link  := '/orders/' || NEW.id::text;

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

DROP TRIGGER IF EXISTS trg_notify_new_order_submission ON public.order_form_submissions;
CREATE TRIGGER trg_notify_new_order_submission
AFTER INSERT ON public.order_form_submissions
FOR EACH ROW EXECUTE FUNCTION public.notify_new_order_submission();
