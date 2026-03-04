ALTER TABLE public.ai_match_runs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (edge functions use service role)
CREATE POLICY "Service role full access" ON public.ai_match_runs
  FOR ALL USING (true) WITH CHECK (true);