ALTER TABLE public.employment_profiles
  ADD COLUMN IF NOT EXISTS relationship_type text NOT NULL DEFAULT 'employee',
  ADD COLUMN IF NOT EXISTS include_in_hms_people boolean NOT NULL DEFAULT true;

ALTER TABLE public.employment_profiles
  DROP CONSTRAINT IF EXISTS employment_profiles_relationship_type_check;

ALTER TABLE public.employment_profiles
  ADD CONSTRAINT employment_profiles_relationship_type_check
  CHECK (relationship_type IN ('employee','contractor','board','external_access','system_access','other'));

CREATE INDEX IF NOT EXISTS idx_employment_profiles_hms_filter
  ON public.employment_profiles (company_id, include_in_hms_people);