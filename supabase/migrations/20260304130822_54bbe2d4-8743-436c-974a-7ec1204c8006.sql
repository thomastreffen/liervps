
-- Add client_request_id to events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS client_request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS events_client_request_id_uniq ON public.events(client_request_id) WHERE client_request_id IS NOT NULL;

-- Add client_request_id to service_jobs
ALTER TABLE public.service_jobs ADD COLUMN IF NOT EXISTS client_request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS service_jobs_client_request_id_uniq ON public.service_jobs(client_request_id) WHERE client_request_id IS NOT NULL;

-- Add client_request_id to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS client_request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS tasks_client_request_id_uniq ON public.tasks(client_request_id) WHERE client_request_id IS NOT NULL;

-- Add client_request_id to schedule_blocks (for system-created blocks)
ALTER TABLE public.schedule_blocks ADD COLUMN IF NOT EXISTS client_request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS schedule_blocks_client_request_id_uniq ON public.schedule_blocks(client_request_id) WHERE client_request_id IS NOT NULL;
