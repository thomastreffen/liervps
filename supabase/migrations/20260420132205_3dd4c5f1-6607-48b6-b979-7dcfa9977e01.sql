
-- ============================================================================
-- Auto-sync schedule_blocks with event_technicians
-- Ensures the calendar (which now renders only schedule_blocks) always
-- shows assignments without relying on event-fallback rendering.
-- ============================================================================

-- 1. Trigger function: create/update/soft-delete schedule_blocks based on event_technicians
CREATE OR REPLACE FUNCTION public.sync_schedule_block_for_event_technician()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event RECORD;
  _start_at TIMESTAMPTZ;
  _end_at TIMESTAMPTZ;
  _existing_block_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Soft-delete linked auto-generated blocks for this assignment
    UPDATE public.schedule_blocks
    SET deleted_at = now(),
        deleted_reason = 'event_technician removed',
        updated_at = now()
    WHERE project_id = OLD.event_id
      AND technician_id = OLD.technician_id
      AND source IN ('manual', 'system')
      AND deleted_at IS NULL;
    RETURN OLD;
  END IF;

  -- Look up event for company_id, fallback times, title
  SELECT id, company_id, start_time, end_time, title, address, deleted_at
  INTO _event
  FROM public.events
  WHERE id = NEW.event_id;

  IF _event.id IS NULL OR _event.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Use per-tech overrides when available, else fall back to event times
  _start_at := COALESCE(NEW.start_at, _event.start_time);
  _end_at := COALESCE(NEW.end_at, _event.end_time);

  IF _start_at IS NULL OR _end_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find any existing non-deleted block for this assignment that overlaps the
  -- assignment time window. We only auto-manage blocks created by us
  -- (source IN ('manual','system')). Outlook-imported blocks are left alone.
  SELECT id INTO _existing_block_id
  FROM public.schedule_blocks
  WHERE project_id = NEW.event_id
    AND technician_id = NEW.technician_id
    AND source IN ('manual', 'system')
    AND deleted_at IS NULL
    AND start_at = _start_at
    AND end_at = _end_at
  LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    -- Only create a new block if no exact-match block exists
    IF _existing_block_id IS NULL THEN
      INSERT INTO public.schedule_blocks (
        company_id, technician_id, project_id, source,
        start_at, end_at, title, location,
        match_state, match_confidence, match_reason
      ) VALUES (
        _event.company_id, NEW.technician_id, NEW.event_id, 'manual',
        _start_at, _end_at, COALESCE(_event.title, 'Prosjektarbeid'), _event.address,
        'manual', 100, 'Auto-synkronisert fra event_technicians'
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- If start/end changed and there's no exact-match block, update the most
    -- recent active block for this assignment to the new times. This keeps a
    -- single block per (event, technician) when planner edits times.
    IF (OLD.start_at IS DISTINCT FROM NEW.start_at) OR (OLD.end_at IS DISTINCT FROM NEW.end_at) THEN
      IF _existing_block_id IS NULL THEN
        UPDATE public.schedule_blocks
        SET start_at = _start_at,
            end_at = _end_at,
            updated_at = now()
        WHERE id = (
          SELECT id FROM public.schedule_blocks
          WHERE project_id = NEW.event_id
            AND technician_id = NEW.technician_id
            AND source IN ('manual', 'system')
            AND deleted_at IS NULL
          ORDER BY updated_at DESC
          LIMIT 1
        );

        -- If no block existed at all, create one
        IF NOT FOUND THEN
          INSERT INTO public.schedule_blocks (
            company_id, technician_id, project_id, source,
            start_at, end_at, title, location,
            match_state, match_confidence, match_reason
          ) VALUES (
            _event.company_id, NEW.technician_id, NEW.event_id, 'manual',
            _start_at, _end_at, COALESCE(_event.title, 'Prosjektarbeid'), _event.address,
            'manual', 100, 'Auto-synkronisert fra event_technicians (update)'
          );
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_schedule_block_for_event_tech ON public.event_technicians;

CREATE TRIGGER trg_sync_schedule_block_for_event_tech
AFTER INSERT OR UPDATE OR DELETE ON public.event_technicians
FOR EACH ROW
EXECUTE FUNCTION public.sync_schedule_block_for_event_technician();


-- 2. When the event itself is updated (start_time/end_time) and a technician
-- has no per-tech override, update the matching schedule_blocks.
CREATE OR REPLACE FUNCTION public.sync_schedule_blocks_for_event_time_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.start_time IS DISTINCT FROM NEW.start_time) OR (OLD.end_time IS DISTINCT FROM NEW.end_time) THEN
    UPDATE public.schedule_blocks sb
    SET start_at = NEW.start_time,
        end_at = NEW.end_time,
        updated_at = now()
    FROM public.event_technicians et
    WHERE sb.project_id = NEW.id
      AND et.event_id = NEW.id
      AND et.technician_id = sb.technician_id
      AND et.start_at IS NULL
      AND et.end_at IS NULL
      AND sb.source IN ('manual', 'system')
      AND sb.deleted_at IS NULL;
  END IF;

  -- Soft-delete blocks when event itself is soft-deleted
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE public.schedule_blocks
    SET deleted_at = now(),
        deleted_reason = 'event soft-deleted',
        updated_at = now()
    WHERE project_id = NEW.id
      AND source IN ('manual', 'system')
      AND deleted_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_schedule_blocks_for_event_time_change ON public.events;

CREATE TRIGGER trg_sync_schedule_blocks_for_event_time_change
AFTER UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.sync_schedule_blocks_for_event_time_change();


-- 3. Backfill: create schedule_blocks for any active event_technicians that
-- don't yet have one. This covers pre-existing data so the calendar shows
-- everything correctly after the rendering switch.
INSERT INTO public.schedule_blocks (
  company_id, technician_id, project_id, source,
  start_at, end_at, title, location,
  match_state, match_confidence, match_reason
)
SELECT
  e.company_id,
  et.technician_id,
  e.id,
  'manual',
  COALESCE(et.start_at, e.start_time),
  COALESCE(et.end_at, e.end_time),
  COALESCE(e.title, 'Prosjektarbeid'),
  e.address,
  'manual',
  100,
  'Backfill: opprettet fra eksisterende event_technicians'
FROM public.event_technicians et
JOIN public.events e ON e.id = et.event_id
WHERE e.deleted_at IS NULL
  AND e.start_time IS NOT NULL
  AND e.end_time IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.schedule_blocks sb
    WHERE sb.project_id = et.event_id
      AND sb.technician_id = et.technician_id
      AND sb.deleted_at IS NULL
      AND sb.source IN ('manual', 'system')
  );
