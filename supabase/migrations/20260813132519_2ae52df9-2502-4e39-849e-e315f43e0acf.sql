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
  IF EXISTS (SELECT 1 FROM public.leads WHERE public_lead_id = NEW.id) THEN
    RETURN NEW;
  END IF;

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
    _company, NEW.name, NEW.name, NEW.email, NEW.phone,
    'nettside' || COALESCE(': ' || NEW.lead_source, ''),
    public.public_lead_to_lead_status(NEW.status),
    _notes, NEW.id, NEW.created_at
  );

  RETURN NEW;
END;
$$;