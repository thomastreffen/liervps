CREATE OR REPLACE FUNCTION public.format_calculator_summary(_summary jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  k text;
  v jsonb;
  lbl text;
  val text;
  num numeric;
  parts text[] := '{}';
BEGIN
  IF _summary IS NULL OR jsonb_typeof(_summary) <> 'object' THEN
    RETURN NULL;
  END IF;

  FOR k, v IN SELECT key, value FROM jsonb_each(_summary) LOOP
    CONTINUE WHEN v IS NULL OR jsonb_typeof(v) = 'null' OR v::text = '""';

    lbl := CASE k
      WHEN 'estimatedSavings' THEN 'Estimert besparelse'
      WHEN 'estimatedSavingsNok' THEN 'Estimert besparelse'
      WHEN 'estimatedSavingsKwh' THEN 'Estimert besparelse (kWh)'
      WHEN 'savingsLow' THEN 'Besparelse (lavt)'
      WHEN 'savingsExpected' THEN 'Besparelse (forventet)'
      WHEN 'savingsHigh' THEN 'Besparelse (høyt)'
      WHEN 'annualKwh' THEN 'Årlig strømforbruk'
      WHEN 'annualConsumptionKwh' THEN 'Årlig strømforbruk'
      WHEN 'area' THEN 'Areal'
      WHEN 'areaM2' THEN 'Oppvarmet areal'
      WHEN 'electricityPrice' THEN 'Strømpris'
      WHEN 'pumpType' THEN 'Varmepumpetype'
      WHEN 'heatPumpType' THEN 'Varmepumpetype'
      WHEN 'coverageSolution' THEN 'Dekningsløsning'
      WHEN 'standard' THEN 'Boligstandard'
      WHEN 'segment' THEN 'Segment'
      WHEN 'paybackYears' THEN 'Nedbetalingstid'
      WHEN 'installedPrice' THEN 'Installert pris'
      ELSE initcap(replace(regexp_replace(k, '([a-z0-9])([A-Z])', '\1 \2', 'g'), '_', ' '))
    END;

    IF jsonb_typeof(v) = 'number' THEN
      num := (v#>>'{}')::numeric;
      val := CASE
        WHEN k ILIKE '%kwh%' THEN to_char(num, 'FM999G999G990D999') || ' kWh'
        WHEN k ILIKE '%area%' THEN to_char(num, 'FM999G999G990D999') || ' m²'
        WHEN k ILIKE '%electricityprice%' THEN to_char(num, 'FM999G999G990D999') || ' kr/kWh'
        WHEN k ILIKE '%price%' OR k ILIKE '%savings%' OR k ILIKE '%nok%' OR k ILIKE '%kr%' THEN 'kr ' || to_char(num, 'FM999G999G990D999')
        WHEN k ILIKE '%years%' THEN to_char(num, 'FM999G999G990D999') || ' år'
        ELSE to_char(num, 'FM999G999G990D999')
      END;
      val := replace(replace(replace(val, ',', '§'), '.', ','), '§', ' ');
    ELSIF jsonb_typeof(v) = 'boolean' THEN
      val := CASE WHEN v::text = 'true' THEN 'Ja' ELSE 'Nei' END;
    ELSIF jsonb_typeof(v) IN ('object', 'array') THEN
      CONTINUE;
    ELSE
      val := v#>>'{}';
    END IF;

    IF val IS NOT NULL AND val <> '' THEN
      parts := parts || ('  ' || lbl || ': ' || val);
    END IF;
  END LOOP;

  IF array_length(parts, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN array_to_string(parts, E'\n');
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_public_lead_to_leads()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _company uuid;
  _notes text;
  _calc text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.leads WHERE public_lead_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO _company FROM public.internal_companies ORDER BY name LIMIT 1;

  _calc := public.format_calculator_summary(NEW.calculator_summary);

  _notes := concat_ws(E'\n',
    'Henvendelse fra nettsiden',
    'Segment: ' || COALESCE(NEW.segment, '—'),
    'Type: ' || COALESCE(NEW.request_type, '—'),
    CASE WHEN NEW.address IS NOT NULL THEN 'Adresse: ' || NEW.address END,
    CASE WHEN NEW.selected_brand IS NOT NULL THEN 'Merke: ' || NEW.selected_brand END,
    CASE WHEN NEW.selected_product_name IS NOT NULL THEN 'Modell: ' || NEW.selected_product_name END,
    CASE WHEN NEW.selected_solution_name IS NOT NULL THEN 'Løsning: ' || NEW.selected_solution_name END,
    CASE WHEN _calc IS NOT NULL THEN E'\nBeregning fra nettsiden:\n' || _calc END,
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
$function$;