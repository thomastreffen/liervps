
-- RLS policies for schedule_sync_state (service role only - used by edge functions)
CREATE POLICY "Service role full access" ON public.schedule_sync_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- RLS policies for schedule_sync_runs (service role for writes, authenticated for reads)
CREATE POLICY "Service role full access" ON public.schedule_sync_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view sync runs" ON public.schedule_sync_runs
  FOR SELECT TO authenticated USING (true);
