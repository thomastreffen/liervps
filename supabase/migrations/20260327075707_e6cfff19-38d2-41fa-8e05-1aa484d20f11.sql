
-- Add normalized_name, merged_into_project_id, external_system, external_project_id to events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS normalized_name text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS merged_into_project_id uuid REFERENCES public.events(id);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS external_system text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS external_project_id text;

-- Populate normalized_name from existing titles
UPDATE public.events SET normalized_name = lower(trim(regexp_replace(title, '\s+', ' ', 'g'))) WHERE normalized_name IS NULL AND title IS NOT NULL;

-- Populate external_system and external_project_id from existing external_tripletex_id
UPDATE public.events SET external_system = 'tripletex', external_project_id = external_tripletex_id WHERE external_tripletex_id IS NOT NULL AND external_system IS NULL;

-- Index for fast normalized_name lookups
CREATE INDEX IF NOT EXISTS idx_events_normalized_name ON public.events (company_id, normalized_name) WHERE deleted_at IS NULL AND normalized_name IS NOT NULL;

-- Unique constraint: (company_id, project_number) when project_number is not null
CREATE UNIQUE INDEX IF NOT EXISTS uq_events_company_project_number ON public.events (company_id, project_number) WHERE project_number IS NOT NULL AND deleted_at IS NULL AND merged_into_project_id IS NULL;

-- Unique constraint: (company_id, external_system, external_project_id) when external_project_id is not null
CREATE UNIQUE INDEX IF NOT EXISTS uq_events_company_external_id ON public.events (company_id, external_system, external_project_id) WHERE external_project_id IS NOT NULL AND deleted_at IS NULL AND merged_into_project_id IS NULL;

-- Index for merged_into lookups
CREATE INDEX IF NOT EXISTS idx_events_merged_into ON public.events (merged_into_project_id) WHERE merged_into_project_id IS NOT NULL;

-- Trigger to auto-populate normalized_name on insert/update
CREATE OR REPLACE FUNCTION public.set_normalized_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.title IS NOT NULL THEN
    NEW.normalized_name := lower(trim(regexp_replace(NEW.title, '\s+', ' ', 'g')));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_normalized_name ON public.events;
CREATE TRIGGER trg_set_normalized_name
  BEFORE INSERT OR UPDATE OF title ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_normalized_name();
