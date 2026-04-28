
DO $$
DECLARE
  _pkg_id uuid;
  _norm_id uuid;
  _norm2_id uuid;
  _rate_id uuid;
BEGIN
  -- Pakke
  INSERT INTO public.calc_packages (company_id, slug, name, category, description, version, is_active, default_sections)
  VALUES (NULL, 'stromskinne-v1', 'Strømskinne — Epoxy kobber', 'elkraft',
    'Kalkyle for montasje av epoxy-isolert kobber strømskinne. Beregner normtid, justeringer og pris basert på elementer, oppheng og montasjeforhold.',
    1, true,
    '[
      {"key":"tekniske","label":"Tekniske valg","sort":1},
      {"key":"mengder","label":"Mengder","sort":2},
      {"key":"forhold","label":"Tillegg & forhold","sort":3}
    ]'::jsonb)
  RETURNING id INTO _pkg_id;

  -- Felter
  INSERT INTO public.calc_package_fields (package_id, field_key, label, field_type, unit, is_required, default_value, options, section_key, sort_order, help_text) VALUES
    (_pkg_id, 'leverandor',     'Leverandør',           'select',  NULL,    true,  '"Schneider"'::jsonb, '[{"value":"Schneider","label":"Schneider"},{"value":"Siemens","label":"Siemens"},{"value":"ABB","label":"ABB"},{"value":"EAE","label":"EAE"}]'::jsonb, 'tekniske', 1, NULL),
    (_pkg_id, 'serie',          'Serie',                'text',    NULL,    false, '""'::jsonb,           '[]'::jsonb, 'tekniske', 2, 'F.eks. Canalis KS'),
    (_pkg_id, 'ledertype',      'Ledertype',            'select',  NULL,    true,  '"kobber"'::jsonb,    '[{"value":"kobber","label":"Kobber"},{"value":"aluminium","label":"Aluminium"}]'::jsonb, 'tekniske', 3, NULL),
    (_pkg_id, 'stromklasse',    'Strømklasse',          'select',  'A',     true,  '"2500"'::jsonb,      '[{"value":"800","label":"800 A"},{"value":"1250","label":"1250 A"},{"value":"1600","label":"1600 A"},{"value":"2000","label":"2000 A"},{"value":"2500","label":"2500 A"},{"value":"3200","label":"3200 A"},{"value":"4000","label":"4000 A"}]'::jsonb, 'tekniske', 4, NULL),
    (_pkg_id, 'utforelse',      'Utførelse',            'select',  NULL,    false, '"standard"'::jsonb,  '[{"value":"standard","label":"Standard"},{"value":"brannklasse","label":"Brannklasse"}]'::jsonb, 'tekniske', 5, NULL),

    (_pkg_id, 'qty_straight_1', 'Straight 1 m',         'number',  'stk',   false, '0'::jsonb, '[]'::jsonb, 'mengder', 10, NULL),
    (_pkg_id, 'qty_straight_2', 'Straight 2 m',         'number',  'stk',   false, '0'::jsonb, '[]'::jsonb, 'mengder', 11, NULL),
    (_pkg_id, 'qty_straight_3', 'Straight 3 m',         'number',  'stk',   false, '0'::jsonb, '[]'::jsonb, 'mengder', 12, NULL),
    (_pkg_id, 'qty_vinkel',     'Vinkler',              'number',  'stk',   false, '0'::jsonb, '[]'::jsonb, 'mengder', 13, NULL),
    (_pkg_id, 'qty_t_element',  'T-element',            'number',  'stk',   false, '0'::jsonb, '[]'::jsonb, 'mengder', 14, NULL),
    (_pkg_id, 'qty_term_std',   'Terminal standard',    'number',  'stk',   false, '0'::jsonb, '[]'::jsonb, 'mengder', 15, NULL),
    (_pkg_id, 'qty_term_nonstd','Terminal non-standard','number',  'stk',   false, '0'::jsonb, '[]'::jsonb, 'mengder', 16, NULL),
    (_pkg_id, 'qty_skjot',      'Skjøter',              'number',  'stk',   false, '0'::jsonb, '[]'::jsonb, 'mengder', 17, NULL),
    (_pkg_id, 'qty_oppheng',    'Oppheng',              'number',  'stk',   false, '0'::jsonb, '[]'::jsonb, 'mengder', 18, NULL),

    (_pkg_id, 'vertikal',           'Vertikal montasje',     'boolean', NULL,  false, 'false'::jsonb, '[]'::jsonb, 'forhold', 20, 'Sett på hvis hele eller deler av strekket er vertikalt'),
    (_pkg_id, 'qty_vertikal',       'Antall vertikale tillegg','number','stk', false, '0'::jsonb, '[]'::jsonb, 'forhold', 21, NULL),
    (_pkg_id, 'arbeidstidstype',    'Arbeidstidstype',       'select',  NULL,  true,  '"dag"'::jsonb, '[{"value":"dag","label":"Dagtid"},{"value":"kveld","label":"Kveld"},{"value":"natt","label":"Natt"},{"value":"helg","label":"Helg"}]'::jsonb, 'forhold', 22, NULL),
    (_pkg_id, 'reisetid',           'Reisetid (timer, t/r)','number','t',    false, '0'::jsonb, '[]'::jsonb, 'forhold', 23, 'Total reisetid tur/retur for ett montørlag'),
    (_pkg_id, 'riggtid',            'Riggtid (timer)',       'number','t',    false, '0'::jsonb, '[]'::jsonb, 'forhold', 24, NULL),
    (_pkg_id, 'tilkomstniva',       'Tilkomstnivå',          'select', NULL,  true,  '"normal"'::jsonb, '[{"value":"normal","label":"Normal"},{"value":"hoyde","label":"Arbeid i høyde"},{"value":"trang","label":"Trang/krevende"},{"value":"i_drift","label":"Bygg i drift"}]'::jsonb, 'forhold', 25, NULL),
    (_pkg_id, 'risiko',             'Risikofaktor',          'percent','%',   false, '0'::jsonb, '[]'::jsonb, 'forhold', 26, 'Påslag på timer for usikkerhet (0–30%)');

  -- Normtidstabell: 2500A
  INSERT INTO public.calc_norm_tables (company_id, package_id, name, version, source, is_active)
  VALUES (NULL, _pkg_id, 'Strømskinne normtid 2500A', 1, 'LRC08-internt', true)
  RETURNING id INTO _norm_id;
  INSERT INTO public.calc_norm_table_rows (norm_table_id, element_key, label, hours, unit, context) VALUES
    (_norm_id, 'straight_1', 'Straight 1 m',          1.2, 'stk', '{"stromklasse":"2500"}'),
    (_norm_id, 'straight_2', 'Straight 2 m',          1.6, 'stk', '{"stromklasse":"2500"}'),
    (_norm_id, 'straight_3', 'Straight 3 m',          2.1, 'stk', '{"stromklasse":"2500"}'),
    (_norm_id, 'vinkel',     'Vinkel',                2.8, 'stk', '{"stromklasse":"2500"}'),
    (_norm_id, 't_element',  'T-element',             3.2, 'stk', '{"stromklasse":"2500"}'),
    (_norm_id, 'term_std',   'Terminal standard',     1.8, 'stk', '{"stromklasse":"2500"}'),
    (_norm_id, 'term_nonstd','Terminal non-standard', 2.6, 'stk', '{"stromklasse":"2500"}'),
    (_norm_id, 'skjot',      'Skjøt',                 1.4, 'stk', '{"stromklasse":"2500"}'),
    (_norm_id, 'oppheng',    'Oppheng',               0.6, 'stk', '{"stromklasse":"2500"}'),
    (_norm_id, 'vertikal',   'Vertikalt tillegg',     0.4, 'stk', '{"stromklasse":"2500"}');

  -- Normtidstabell: 1600A (litt lavere)
  INSERT INTO public.calc_norm_tables (company_id, package_id, name, version, source, is_active)
  VALUES (NULL, _pkg_id, 'Strømskinne normtid 1600A', 1, 'LRC08-internt', true)
  RETURNING id INTO _norm2_id;
  INSERT INTO public.calc_norm_table_rows (norm_table_id, element_key, label, hours, unit, context) VALUES
    (_norm2_id, 'straight_1', 'Straight 1 m',          0.9, 'stk', '{"stromklasse":"1600"}'),
    (_norm2_id, 'straight_2', 'Straight 2 m',          1.3, 'stk', '{"stromklasse":"1600"}'),
    (_norm2_id, 'straight_3', 'Straight 3 m',          1.7, 'stk', '{"stromklasse":"1600"}'),
    (_norm2_id, 'vinkel',     'Vinkel',                2.2, 'stk', '{"stromklasse":"1600"}'),
    (_norm2_id, 't_element',  'T-element',             2.6, 'stk', '{"stromklasse":"1600"}'),
    (_norm2_id, 'term_std',   'Terminal standard',     1.4, 'stk', '{"stromklasse":"1600"}'),
    (_norm2_id, 'term_nonstd','Terminal non-standard', 2.0, 'stk', '{"stromklasse":"1600"}'),
    (_norm2_id, 'skjot',      'Skjøt',                 1.1, 'stk', '{"stromklasse":"1600"}'),
    (_norm2_id, 'oppheng',    'Oppheng',               0.5, 'stk', '{"stromklasse":"1600"}'),
    (_norm2_id, 'vertikal',   'Vertikalt tillegg',     0.3, 'stk', '{"stromklasse":"1600"}');

  -- Satstabell
  INSERT INTO public.calc_rate_tables (company_id, package_id, name, version, is_active)
  VALUES (NULL, _pkg_id, 'Standard satser strømskinne', 1, true)
  RETURNING id INTO _rate_id;
  INSERT INTO public.calc_rate_table_rows (rate_table_id, rate_key, label, value, unit, sort_order) VALUES
    (_rate_id, 'cost_montor',     'Intern kostsats montør',  650, 'NOK/t', 1),
    (_rate_id, 'sales_montor',    'Salgssats montør',        1150,'NOK/t', 2),
    (_rate_id, 'cost_reise',      'Intern reisesats',        450, 'NOK/t', 3),
    (_rate_id, 'sales_reise',     'Salgs-reisesats',         950, 'NOK/t', 4),
    (_rate_id, 'cost_rigg',       'Intern riggsats',         650, 'NOK/t', 5),
    (_rate_id, 'sales_rigg',      'Salgs-riggsats',          1150,'NOK/t', 6),
    (_rate_id, 'factor_kveld',    'Tillegg kveldsarbeid',    0.15,'faktor',10),
    (_rate_id, 'factor_natt',     'Tillegg nattarbeid',      0.50,'faktor',11),
    (_rate_id, 'factor_helg',     'Tillegg helgearbeid',     1.00,'faktor',12),
    (_rate_id, 'factor_hoyde',    'Tillegg arbeid i høyde',  0.15,'faktor',13),
    (_rate_id, 'factor_trang',    'Tillegg trang tilkomst',  0.20,'faktor',14),
    (_rate_id, 'factor_i_drift',  'Tillegg bygg i drift',    0.25,'faktor',15);
END $$;
