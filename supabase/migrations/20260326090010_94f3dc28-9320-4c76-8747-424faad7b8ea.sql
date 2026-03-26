
-- 1. Add new columns to order_form_templates for ticket system
ALTER TABLE public.order_form_templates
  ADD COLUMN IF NOT EXISTS internal_help_text text,
  ADD COLUMN IF NOT EXISTS external_help_text text,
  ADD COLUMN IF NOT EXISTS default_status text DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS default_priority text DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS default_handling_rule text DEFAULT 'queue';

-- 2. Add new columns to order_form_submissions for ticket workflow
ALTER TABLE public.order_form_submissions
  ADD COLUMN IF NOT EXISTS channel text DEFAULT 'public_form',
  ADD COLUMN IF NOT EXISTS submitter_name text,
  ADD COLUMN IF NOT EXISTS submitter_email text,
  ADD COLUMN IF NOT EXISTS submitter_user_id uuid,
  ADD COLUMN IF NOT EXISTS linked_case_id uuid REFERENCES public.cases(id),
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid;

-- 3. Create order_form_categories table for admin-managed categories
CREATE TABLE IF NOT EXISTS public.order_form_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id),
  name text NOT NULL,
  slug text NOT NULL,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, slug)
);

ALTER TABLE public.order_form_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view categories"
  ON public.order_form_categories FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage categories"
  ON public.order_form_categories FOR ALL
  TO authenticated USING (public.is_admin());

-- Allow anon to view categories for public catalog
CREATE POLICY "Anon can view active categories"
  ON public.order_form_categories FOR SELECT
  TO anon USING (is_active = true);

-- 4. Add category_id FK to templates (link to managed categories)
ALTER TABLE public.order_form_templates
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.order_form_categories(id);

-- 5. Create catalog_settings table for editable portal header
CREATE TABLE IF NOT EXISTS public.order_form_catalog_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id) UNIQUE,
  title text DEFAULT 'Bestillinger og henvendelser',
  subtitle text DEFAULT 'Velg riktig kategori og skjema for å sende inn en bestilling, melding eller forespørsel.',
  help_text text,
  contact_info text,
  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.order_form_catalog_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view catalog settings"
  ON public.order_form_catalog_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage catalog settings"
  ON public.order_form_catalog_settings FOR ALL
  TO authenticated USING (public.is_admin());

CREATE POLICY "Anon can view catalog settings"
  ON public.order_form_catalog_settings FOR SELECT
  TO anon USING (is_active = true);
