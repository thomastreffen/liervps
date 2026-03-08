CREATE TYPE public.work_package_type AS ENUM ('deviation', 'additional_work', 'change', 'internal_task');

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS parent_project_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS work_package_type public.work_package_type,
  ADD COLUMN IF NOT EXISTS customer_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS documentation_status text NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_events_parent_project_id ON public.events(parent_project_id) WHERE parent_project_id IS NOT NULL;