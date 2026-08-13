ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS public_lead_id uuid REFERENCES public.public_leads(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS leads_public_lead_id_key ON public.leads(public_lead_id) WHERE public_lead_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.public_lead_to_lead_status(_s text)
RETURNS public.lead_status
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _s
    WHEN 'contacted' THEN 'contacted'::lead_status
    WHEN 'befaring_booked' THEN 'befaring'::lead_status
    WHEN 'offer_sent' THEN 'tilbud_sendt'::lead_status
    WHEN 'won' THEN 'won'::lead_status
    WHEN 'lost' THEN 'lost'::lead_status
    ELSE 'new'::lead_status
  END
$$;

CREATE OR REPLACE FUNCTION public.sync_public_lead_to_leads()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company uuid;
  _notes text;
BEGIN
  SELECT id INTO _company FROM public.internal_companies ORDER BY name LIMIT 1;

  _notes := concat_ws(E'\n',
    'Henvendelse fra nettsiden',
    'Segment: ' || COALESCE(NEW.segment, '—'),
    'Type: ' || COALESCE(NEW.request_type, '—'),
    CASE WHEN NEW.address IS NOT NULL THEN 'Adresse: ' || NEW.address END,
    CASE WHEN NEW.selected_brand IS NOT NULL THEN 'Merke: ' || NEW.selected_brand END,
    CASE WHEN NEW.selected_product_name IS NOT NULL THEN 'Modell: ' || NEW.selected_product_name END,
    CASE WHEN NEW.selected_solution_name IS NOT NULL THEN 'Løsning: ' || NEW.selected_solution_name END,
    CASE WHEN NEW.calculator_summary IS NOT NULL THEN 'Beregning: ' || NEW.calculator_summary::text END,
    CASE WHEN NEW.message IS NOT NULL THEN E'\nMelding:\n' || NEW.message END
  );

  INSERT INTO public.leads (
    company_id, company_name, contact_name, email, phone,
    source, status, notes, public_lead_id, created_at
  ) VALUES (
    _company,
    NEW.name,
    NEW.name,
    NEW.email,
    NEW.phone,
    'nettside' || COALESCE(': ' || NEW.lead_source, ''),
    public.public_lead_to_lead_status(NEW.status),
    _notes,
    NEW.id,
    NEW.created_at
  )
  ON CONFLICT (public_lead_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_public_lead_to_leads ON public.public_leads;
CREATE TRIGGER trg_public_lead_to_leads
AFTER INSERT ON public.public_leads
FOR EACH ROW EXECUTE FUNCTION public.sync_public_lead_to_leads();

CREATE OR REPLACE FUNCTION public.sync_lead_status_to_public_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _s text;
BEGIN
  IF NEW.public_lead_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.deleted_at IS NOT NULL THEN _s := 'deleted';
  ELSIF NEW.archived_at IS NOT NULL THEN _s := 'archived';
  ELSE
    _s := CASE NEW.status::text
      WHEN 'contacted' THEN 'contacted'
      WHEN 'befaring' THEN 'befaring_booked'
      WHEN 'tilbud_sendt' THEN 'offer_sent'
      WHEN 'forhandling' THEN 'offer_sent'
      WHEN 'qualified' THEN 'contacted'
      WHEN 'won' THEN 'won'
      WHEN 'lost' THEN 'lost'
      ELSE 'new'
    END;
  END IF;
  UPDATE public.public_leads
     SET status = _s, updated_at = now()
   WHERE id = NEW.public_lead_id AND status IS DISTINCT FROM _s;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_status_to_public_lead ON public.leads;
CREATE TRIGGER trg_lead_status_to_public_lead
AFTER UPDATE OF status, archived_at, deleted_at ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.sync_lead_status_to_public_lead();

-- Backfill existing public leads
DO $backfill$
DECLARE r public.public_leads;
BEGIN
  FOR r IN SELECT * FROM public.public_leads pl
           WHERE NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.public_lead_id = pl.id)
  LOOP
    PERFORM 1;
    INSERT INTO public.leads (company_id, company_name, contact_name, email, phone, source, status, notes, public_lead_id, created_at)
    VALUES (
      (SELECT id FROM public.internal_companies ORDER BY name LIMIT 1),
      r.name, r.name, r.email, r.phone,
      'nettside' || COALESCE(': ' || r.lead_source, ''),
      public.public_lead_to_lead_status(r.status),
      concat_ws(E'\n', 'Henvendelse fra nettsiden',
        'Segment: ' || COALESCE(r.segment,'—'),
        'Type: ' || COALESCE(r.request_type,'—'),
        CASE WHEN r.address IS NOT NULL THEN 'Adresse: ' || r.address END,
        CASE WHEN r.selected_brand IS NOT NULL THEN 'Merke: ' || r.selected_brand END,
        CASE WHEN r.selected_product_name IS NOT NULL THEN 'Modell: ' || r.selected_product_name END,
        CASE WHEN r.selected_solution_name IS NOT NULL THEN 'Løsning: ' || r.selected_solution_name END,
        CASE WHEN r.calculator_summary IS NOT NULL THEN 'Beregning: ' || r.calculator_summary::text END,
        CASE WHEN r.message IS NOT NULL THEN E'\nMelding:\n' || r.message END),
      r.id, r.created_at
    ) ON CONFLICT (public_lead_id) DO NOTHING;
  END LOOP;
END
$backfill$;

-- Internal users may read/update public website leads
GRANT SELECT, UPDATE ON public.public_leads TO authenticated;
DROP POLICY IF EXISTS "Authenticated can read public leads" ON public.public_leads;
CREATE POLICY "Authenticated can read public leads"
  ON public.public_leads FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can update public leads" ON public.public_leads;
CREATE POLICY "Authenticated can update public leads"
  ON public.public_leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);