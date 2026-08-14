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
  numtxt text;
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
      numtxt := trim(to_char(num, 'FM999G999G990D999'));
      numtxt := regexp_replace(numtxt, '[.,]$', '');
      -- to_char uses ',' as group separator and '.' as decimal: convert to nb-NO
      numtxt := replace(replace(replace(numtxt, ',', '§'), '.', ','), '§', ' ');
      val := CASE
        WHEN k ILIKE '%kwh%' THEN numtxt || ' kWh'
        WHEN k ILIKE '%area%' THEN numtxt || ' m²'
        WHEN k ILIKE '%electricityprice%' THEN numtxt || ' kr/kWh'
        WHEN k ILIKE '%price%' OR k ILIKE '%savings%' OR k ILIKE '%nok%' OR k ILIKE '%kr%' THEN 'kr ' || numtxt
        WHEN k ILIKE '%years%' THEN numtxt || ' år'
        ELSE numtxt
      END;
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