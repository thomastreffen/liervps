
-- Contact person tags (company-scoped, same pattern as customer_tags)
CREATE TABLE public.customer_contact_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_contact_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage contact tags"
  ON public.customer_contact_tags FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Contact person tag relations (junction table)
CREATE TABLE public.customer_contact_tag_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.customer_contacts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.customer_contact_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contact_id, tag_id)
);

ALTER TABLE public.customer_contact_tag_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage contact tag relations"
  ON public.customer_contact_tag_relations FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
