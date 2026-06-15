
-- 1) Repair existing orphan tasks: promote to standalone project so invariant holds
UPDATE public.events
SET project_type = 'project'
WHERE project_type = 'task'
  AND parent_project_id IS NULL
  AND deleted_at IS NULL;

-- 2) Repair task chains (task whose parent is also a task -> point to root)
WITH RECURSIVE chain AS (
  SELECT c.id AS task_id, p.id AS parent_id, p.parent_project_id AS grand, p.project_type AS parent_type
  FROM public.events c
  JOIN public.events p ON p.id = c.parent_project_id
  WHERE c.project_type = 'task' AND p.project_type = 'task' AND c.deleted_at IS NULL
),
roots AS (
  SELECT e.id, e.parent_project_id
  FROM public.events e
)
UPDATE public.events e
SET parent_project_id = (
  WITH RECURSIVE up AS (
    SELECT id, parent_project_id, project_type FROM public.events WHERE id = e.parent_project_id
    UNION ALL
    SELECT n.id, n.parent_project_id, n.project_type
    FROM public.events n
    JOIN up ON up.parent_project_id = n.id
    WHERE up.project_type = 'task'
  )
  SELECT id FROM up WHERE project_type <> 'task' ORDER BY 1 LIMIT 1
)
WHERE e.project_type = 'task'
  AND e.parent_project_id IS NOT NULL
  AND e.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.events p WHERE p.id = e.parent_project_id AND p.project_type = 'task'
  );

-- 3) Repair schedule_blocks whose project_id does not match task.parent_project_id
UPDATE public.schedule_blocks sb
SET project_id = e.parent_project_id
FROM public.events e
WHERE sb.job_id = e.id
  AND e.project_type = 'task'
  AND e.parent_project_id IS NOT NULL
  AND sb.project_id IS DISTINCT FROM e.parent_project_id;

-- 4) Guard trigger on events: forbid orphan tasks and task->task chains
CREATE OR REPLACE FUNCTION public.enforce_task_parent_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  parent_type text;
BEGIN
  IF NEW.project_type = 'task' THEN
    IF NEW.parent_project_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_TASK: project_type=task requires parent_project_id (event %)', NEW.id
        USING ERRCODE = 'check_violation';
    END IF;
    SELECT project_type INTO parent_type FROM public.events WHERE id = NEW.parent_project_id;
    IF parent_type = 'task' THEN
      RAISE EXCEPTION 'INVALID_TASK_CHAIN: parent_project_id % is itself a task; tasks must point to root project', NEW.parent_project_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_task_parent_integrity ON public.events;
CREATE TRIGGER trg_enforce_task_parent_integrity
  BEFORE INSERT OR UPDATE OF project_type, parent_project_id
  ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_task_parent_integrity();

-- 5) Guard trigger on schedule_blocks: project_id must match task.parent_project_id when job is task
CREATE OR REPLACE FUNCTION public.enforce_schedule_block_project_match()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  ev_type text;
  ev_parent uuid;
BEGIN
  IF NEW.job_id IS NULL THEN RETURN NEW; END IF;
  SELECT project_type, parent_project_id INTO ev_type, ev_parent
  FROM public.events WHERE id = NEW.job_id;
  IF ev_type = 'task' THEN
    IF ev_parent IS NULL THEN
      RAISE EXCEPTION 'INVALID_BLOCK: schedule_block.job_id % is task without parent_project_id', NEW.job_id
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.project_id IS DISTINCT FROM ev_parent THEN
      RAISE EXCEPTION 'INVALID_BLOCK_PROJECT: schedule_block.project_id (%) must match task.parent_project_id (%) for job %',
        NEW.project_id, ev_parent, NEW.job_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_schedule_block_project_match ON public.schedule_blocks;
CREATE TRIGGER trg_enforce_schedule_block_project_match
  BEFORE INSERT OR UPDATE OF job_id, project_id
  ON public.schedule_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_schedule_block_project_match();
