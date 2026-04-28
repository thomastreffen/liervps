-- Cleanup function: soft-delete tomme kalkyler eldre enn 1 time, og hard-delete forlatte AI-utkast eldre enn 7 dager
CREATE OR REPLACE FUNCTION public.cleanup_empty_calculations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _calc_count int := 0;
  _draft_count int := 0;
BEGIN
  -- Soft-delete kalkyler som er tomme (ingen pris/kost) og ikke endret på 1 time
  UPDATE public.calculations
  SET deleted_at = now(),
      updated_at = now()
  WHERE deleted_at IS NULL
    AND COALESCE(total_price, 0) = 0
    AND COALESCE(total_labor, 0) = 0
    AND (project_title IS NULL OR project_title ILIKE 'uten navn%')
    AND updated_at < now() - interval '1 hour';
  GET DIAGNOSTICS _calc_count = ROW_COUNT;

  -- Hard-delete forlatte AI-utkast (ingen case_id, ingen system-mapping, eldre enn 7 dager)
  DELETE FROM public.calc_ai_drafts
  WHERE case_id IS NULL
    AND (system_calculation_map IS NULL OR system_calculation_map = '{}'::jsonb)
    AND (ai_summary IS NULL OR length(ai_summary) < 10)
    AND updated_at < now() - interval '7 days';
  GET DIAGNOSTICS _draft_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'soft_deleted_calculations', _calc_count,
    'hard_deleted_drafts', _draft_count,
    'ran_at', now()
  );
END;
$$;