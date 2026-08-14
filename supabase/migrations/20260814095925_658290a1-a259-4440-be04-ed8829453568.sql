CREATE TABLE public.integration_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'google',
  service text NOT NULL,
  status text NOT NULL DEFAULT 'ok',
  error_code text,
  last_failed_at timestamptz,
  last_success_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT integration_health_provider_service_key UNIQUE (provider, service)
);

GRANT SELECT ON public.integration_health TO authenticated;
GRANT ALL ON public.integration_health TO service_role;

ALTER TABLE public.integration_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read integration health"
ON public.integration_health
FOR SELECT
TO authenticated
USING (public.is_admin() OR public.is_super_admin(auth.uid()));

INSERT INTO public.integration_health (provider, service, status)
VALUES ('google','gmail','unknown'), ('google','calendar','unknown'), ('google','drive','unknown');