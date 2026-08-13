CREATE TABLE public.public_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  address text,
  segment text NOT NULL DEFAULT 'bolig',
  request_type text NOT NULL DEFAULT 'befaring',
  message text,
  lead_source text,
  selected_brand text,
  selected_product_name text,
  selected_solution_name text,
  calculator_summary jsonb,
  lead_context jsonb,
  page_url text,
  status text NOT NULL DEFAULT 'new',
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_leads_name_len CHECK (char_length(name) BETWEEN 1 AND 200),
  CONSTRAINT public_leads_contact_present CHECK (coalesce(email,'') <> '' OR coalesce(phone,'') <> ''),
  CONSTRAINT public_leads_segment_chk CHECK (segment IN ('bolig','naering')),
  CONSTRAINT public_leads_request_type_chk CHECK (request_type IN ('befaring','modell-anbefaling','losning-anbefaling','service','feilsoking','beregning')),
  CONSTRAINT public_leads_message_len CHECK (message IS NULL OR char_length(message) <= 4000)
);

GRANT INSERT ON public.public_leads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_leads TO authenticated;
GRANT ALL ON public.public_leads TO service_role;

ALTER TABLE public.public_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a public lead"
ON public.public_leads FOR INSERT TO anon, authenticated
WITH CHECK (status = 'new');

CREATE POLICY "Internal users can read public leads"
ON public.public_leads FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Internal users can update public leads"
ON public.public_leads FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Super admins can delete public leads"
ON public.public_leads FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE INDEX public_leads_created_at_idx ON public.public_leads (created_at DESC);
CREATE INDEX public_leads_status_idx ON public.public_leads (status);

CREATE TRIGGER public_leads_touch_updated_at
BEFORE UPDATE ON public.public_leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();