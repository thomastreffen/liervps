-- Extend form_templates with availability, roles, rules, and metadata columns

-- Availability flags
ALTER TABLE public.form_templates ADD COLUMN IF NOT EXISTS available_in_projects boolean NOT NULL DEFAULT false;
ALTER TABLE public.form_templates ADD COLUMN IF NOT EXISTS available_in_documents boolean NOT NULL DEFAULT false;
ALTER TABLE public.form_templates ADD COLUMN IF NOT EXISTS available_in_my_day boolean NOT NULL DEFAULT false;
ALTER TABLE public.form_templates ADD COLUMN IF NOT EXISTS available_in_customer_portal boolean NOT NULL DEFAULT false;
ALTER TABLE public.form_templates ADD COLUMN IF NOT EXISTS shareable_via_link boolean NOT NULL DEFAULT false;
ALTER TABLE public.form_templates ADD COLUMN IF NOT EXISTS internal_only boolean NOT NULL DEFAULT true;

-- Roles
ALTER TABLE public.form_templates ADD COLUMN IF NOT EXISTS allowed_roles text[] NOT NULL DEFAULT '{admin}';

-- Rules
ALTER TABLE public.form_templates ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT false;
ALTER TABLE public.form_templates ADD COLUMN IF NOT EXISTS required_before_completion boolean NOT NULL DEFAULT false;
ALTER TABLE public.form_templates ADD COLUMN IF NOT EXISTS required_before_billing boolean NOT NULL DEFAULT false;
ALTER TABLE public.form_templates ADD COLUMN IF NOT EXISTS required_for_job_types text[] NOT NULL DEFAULT '{}';

-- Metadata
ALTER TABLE public.form_templates ADD COLUMN IF NOT EXISTS form_type text NOT NULL DEFAULT 'checklist';
ALTER TABLE public.form_templates ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.form_templates ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.form_templates ADD COLUMN IF NOT EXISTS archived_at timestamptz;