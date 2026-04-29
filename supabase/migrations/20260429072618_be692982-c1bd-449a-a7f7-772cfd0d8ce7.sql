
-- Kalibrer Strømskinne v2 entreprenørfelter
DO $$
DECLARE
  _pkg uuid := '5b1e9e2a-7f6c-4d2b-9a31-7c2c5b1e9e2a';
BEGIN
  -- Tavletilkobling EL1: konservativt utgangspunkt 24 timer (én normal tavle)
  UPDATE public.calc_package_fields
  SET default_value = '24', is_required = true,
      help_text = 'Timer for tilkobling i hovedtavle (EL1). Realistisk per tavle: 16–60 t avhengig av størrelse og kompleksitet.'
  WHERE package_id = _pkg AND field_key = 'tavletilkobling_el1';

  -- Tavletilkobling EL2 (sekundær): default 0, men ikke required (mange prosjekter har bare EL1)
  UPDATE public.calc_package_fields
  SET help_text = 'Timer for tilkobling i sekundærtavle (EL2). Sett 0 hvis kun én tavle.'
  WHERE package_id = _pkg AND field_key = 'tavletilkobling_el2';

  -- Kontroll og momenttrekking: 12 timer som baseline, must-confirm
  UPDATE public.calc_package_fields
  SET default_value = '12', is_required = true,
      help_text = 'Kontroll og momenttrekking av alle tilkoblinger. Tommelfingerregel: 0,2–0,3 t per skjøt + 4 t for terminaler.'
  WHERE package_id = _pkg AND field_key = 'kontroll_moment_timer';

  -- Dokumentasjon / HMS: 16 timer baseline
  UPDATE public.calc_package_fields
  SET default_value = '16', is_required = true,
      help_text = 'FDV-dokumentasjon, sluttkontroll, HMS-rapportering. Typisk 12–24 t for normalt prosjekt.'
  WHERE package_id = _pkg AND field_key = 'dokumentasjon_hms_timer';

  -- Rigg / oppstart: 12 timer baseline
  UPDATE public.calc_package_fields
  SET default_value = '12', is_required = true,
      help_text = 'Rigg, oppstart, sikring av arbeidssted, opp/nedrigg. Typisk 8–24 t.'
  WHERE package_id = _pkg AND field_key = 'rigg_oppstart_timer';

  -- Småmateriell: 15 000 kr baseline
  UPDATE public.calc_package_fields
  SET default_value = '15000', is_required = true,
      help_text = 'Forbruksmateriell, kabelsko, merking, småjern, tetting. Typisk 10–40 000 kr avhengig av prosjekt.'
  WHERE package_id = _pkg AND field_key = 'smamateriell_belop';

  -- Prosjektbuffer: default 5%
  UPDATE public.calc_package_fields
  SET default_value = '5',
      help_text = 'Påslag på salg for å dekke ikke-spesifiserte poster. Typisk 3–8 % for kjente prosjekter, 8–15 % for komplekse.'
  WHERE package_id = _pkg AND field_key = 'prosjektbuffer_pct';

  -- Usikkerhetspåslag: default 5%
  UPDATE public.calc_package_fields
  SET default_value = '5',
      help_text = 'Påslag for risiko og usikkerhet i underlaget. Øk for tegninger med åpne spørsmål.'
  WHERE package_id = _pkg AND field_key = 'usikkerhet_pct';
END $$;
