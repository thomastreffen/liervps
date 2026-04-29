
-- Tavlemontasje v1 — ny global kalkylepakke
DO $$
DECLARE
  _pkg_id uuid := 'a3f1b8c0-9e4d-4b2a-8c1f-7d5e6a8b9c01'::uuid;
  _rate_id uuid := 'a3f1b8c0-9e4d-4b2a-8c1f-7d5e6a8b9c02'::uuid;
  _norm_id uuid := 'a3f1b8c0-9e4d-4b2a-8c1f-7d5e6a8b9c03'::uuid;
BEGIN
  -- Pakke
  INSERT INTO public.calc_packages (id, company_id, slug, name, category, description, version, is_active, default_sections)
  VALUES (
    _pkg_id, NULL, 'tavlemontasje-v1', 'Tavlemontasje v1',
    'el',
    'Manuell kalkylepakke for tavlemontasje: inntransport, løft, sammenstilling, mekanisk montasje, oppkobling, test, idriftsettelse, dokumentasjon/HMS og kommersiell justering. Generell og fabrikatuavhengig.',
    1, true,
    jsonb_build_array(
      jsonb_build_object('key','prosjekt','label','Prosjekt og rammer','sort',1),
      jsonb_build_object('key','tavledata','label','Tavledata','sort',2),
      jsonb_build_object('key','mekanisk','label','Mekanisk montasje','sort',3),
      jsonb_build_object('key','elektro','label','Elektroarbeid','sort',4),
      jsonb_build_object('key','kommersiell','label','Tillegg og kommersiell','sort',5)
    )
  )
  ON CONFLICT (id) DO NOTHING;

  -- Inputfelter
  INSERT INTO public.calc_package_fields (package_id, field_key, label, field_type, unit, is_required, default_value, options, section_key, help_text, sort_order) VALUES
  -- Seksjon 1: Prosjekt og rammer
  (_pkg_id, 'kunde',           'Kunde',                   'text',   NULL,     false, NULL, '[]'::jsonb, 'prosjekt', NULL, 10),
  (_pkg_id, 'prosjekt',        'Prosjekt',                'text',   NULL,     false, NULL, '[]'::jsonb, 'prosjekt', NULL, 20),
  (_pkg_id, 'lokasjon',        'Lokasjon',                'text',   NULL,     false, NULL, '[]'::jsonb, 'prosjekt', NULL, 30),
  (_pkg_id, 'arbeidstidstype', 'Arbeidstidstype',         'select', NULL,     false, '"dag"'::jsonb,
     '[{"value":"dag","label":"Dag"},{"value":"kveld","label":"Kveld"},{"value":"natt","label":"Natt"},{"value":"helg","label":"Helg"}]'::jsonb,
     'prosjekt', NULL, 40),
  (_pkg_id, 'byggtype',        'Bygg-type',               'select', NULL,     false, '"nybygg"'::jsonb,
     '[{"value":"nybygg","label":"Nybygg"},{"value":"rehab","label":"Rehab"},{"value":"i_drift","label":"Bygg i drift"}]'::jsonb,
     'prosjekt', NULL, 50),
  (_pkg_id, 'tilkomstniva',    'Tilkomstnivå',            'select', NULL,     false, '"normal"'::jsonb,
     '[{"value":"normal","label":"Normalt"},{"value":"hoyde","label":"Arbeid i høyde"},{"value":"trang","label":"Trang adkomst"},{"value":"i_drift","label":"Bygg i drift"}]'::jsonb,
     'prosjekt', NULL, 60),
  (_pkg_id, 'reisetid',        'Reisetid (t/r)',          'number', 't',      false, '0'::jsonb, '[]'::jsonb, 'prosjekt', 'Total reisetid tur/retur', 70),
  (_pkg_id, 'riggtid',         'Riggtid / oppstart',      'number', 't',      false, '0'::jsonb, '[]'::jsonb, 'prosjekt', NULL, 80),
  (_pkg_id, 'ansvarlig',       'Ansvarlig',               'text',   NULL,     false, NULL, '[]'::jsonb, 'prosjekt', NULL, 90),
  (_pkg_id, 'notat',           'Kort notat',              'text',   NULL,     false, NULL, '[]'::jsonb, 'prosjekt', NULL, 100),

  -- Seksjon 2: Tavledata
  (_pkg_id, 'tavletype',       'Tavletype',               'select', NULL,     false, '"hovedtavle"'::jsonb,
     '[{"value":"hovedtavle","label":"Hovedtavle"},{"value":"underfordeling","label":"Underfordeling"},{"value":"seksjonert","label":"Seksjonert tavle"},{"value":"annet","label":"Annet"}]'::jsonb,
     'tavledata', NULL, 10),
  (_pkg_id, 'leverandor',      'Leverandør',              'text',   NULL,     false, NULL, '[]'::jsonb, 'tavledata', NULL, 20),
  (_pkg_id, 'antall_felt',     'Antall felt',             'number', 'felt',   true,  '6'::jsonb, '[]'::jsonb, 'tavledata', 'Driver mekanisk montasjetid', 30),
  (_pkg_id, 'antall_seksjoner','Antall seksjoner',        'number', 'stk',    true,  '1'::jsonb, '[]'::jsonb, 'tavledata', NULL, 40),
  (_pkg_id, 'plassering',      'Plassering',              'select', NULL,     false, '"gulvstaaende"'::jsonb,
     '[{"value":"gulvstaaende","label":"Gulvstående"},{"value":"vegghengt","label":"Vegghengt"}]'::jsonb,
     'tavledata', NULL, 50),
  (_pkg_id, 'hoydeklasse',     'Høydeklasse',             'select', NULL,     false, '"normal"'::jsonb,
     '[{"value":"lav","label":"Lav"},{"value":"normal","label":"Normal"},{"value":"hoy","label":"Høy"}]'::jsonb,
     'tavledata', NULL, 60),
  (_pkg_id, 'breddeklasse',    'Breddeklasse',            'select', NULL,     false, '"normal"'::jsonb,
     '[{"value":"smal","label":"Smal"},{"value":"normal","label":"Normal"},{"value":"bred","label":"Bred"}]'::jsonb,
     'tavledata', NULL, 70),
  (_pkg_id, 'vektklasse',      'Vektklasse',              'select', NULL,     false, '"middels"'::jsonb,
     '[{"value":"lett","label":"Lett"},{"value":"middels","label":"Middels"},{"value":"tung","label":"Tung"}]'::jsonb,
     'tavledata', NULL, 80),
  (_pkg_id, 'leveringsform',   'Leveringsform',           'select', NULL,     false, '"komplett"'::jsonb,
     '[{"value":"komplett","label":"Komplett levering"},{"value":"delt","label":"Delt levering"}]'::jsonb,
     'tavledata', NULL, 90),
  (_pkg_id, 'sokkel_nodvendig','Sokkel / fundament nødvendig','boolean',NULL, false, 'false'::jsonb, '[]'::jsonb, 'tavledata', NULL, 100),

  -- Seksjon 3: Mekanisk montasje
  (_pkg_id, 'inntransport',    'Inntransport',            'select', NULL,     true,  '"middels"'::jsonb,
     '[{"value":"enkel","label":"Enkel"},{"value":"middels","label":"Middels"},{"value":"krevende","label":"Krevende"}]'::jsonb,
     'mekanisk', NULL, 10),
  (_pkg_id, 'loftebehov',      'Løftebehov',              'select', NULL,     false, '"jekketralle"'::jsonb,
     '[{"value":"ingen","label":"Ingen"},{"value":"jekketralle","label":"Jekketralle"},{"value":"kran","label":"Kran"},{"value":"annet","label":"Annet"}]'::jsonb,
     'mekanisk', NULL, 20),
  (_pkg_id, 'sammenstilling_pa_stedet','Sammenstilling på stedet','boolean',NULL, false, 'false'::jsonb, '[]'::jsonb, 'mekanisk', NULL, 30),
  (_pkg_id, 'antall_seksjonsskjoter','Antall seksjonsskjøter','number','stk', false, '0'::jsonb, '[]'::jsonb, 'mekanisk', NULL, 40),
  (_pkg_id, 'oppretting_innfesting','Oppretting / innfesting','select', NULL, false, '"enkel"'::jsonb,
     '[{"value":"enkel","label":"Enkel"},{"value":"krevende","label":"Krevende"}]'::jsonb,
     'mekanisk', NULL, 50),
  (_pkg_id, 'fundament_sokkel_montering','Fundament / sokkel montering','boolean',NULL,false,'false'::jsonb,'[]'::jsonb,'mekanisk',NULL,60),
  (_pkg_id, 'arbeid_i_hoyde',  'Arbeid i høyde',          'boolean',NULL,     false, 'false'::jsonb, '[]'::jsonb, 'mekanisk', NULL, 70),

  -- Seksjon 4: Elektroarbeid
  (_pkg_id, 'antall_innkommende',    'Antall innkommende kabler','number','stk', true, '4'::jsonb, '[]'::jsonb, 'elektro', NULL, 10),
  (_pkg_id, 'antall_utgaende',       'Antall utgående kabler',   'number','stk', true, '20'::jsonb,'[]'::jsonb, 'elektro', NULL, 20),
  (_pkg_id, 'antall_internkoblinger','Antall internkoblinger',   'number','stk', false,'0'::jsonb, '[]'::jsonb, 'elektro', NULL, 30),
  (_pkg_id, 'oppkoblingstype',       'Oppkoblingstype',          'select',NULL,  false,'"middels"'::jsonb,
     '[{"value":"enkel","label":"Enkel"},{"value":"middels","label":"Middels"},{"value":"krevende","label":"Krevende"}]'::jsonb,
     'elektro', NULL, 40),
  (_pkg_id, 'merking_inkludert',         'Merking inkludert',         'boolean',NULL,false,'true'::jsonb,'[]'::jsonb,'elektro',NULL,50),
  (_pkg_id, 'funksjonstest_inkludert',   'Funksjonstest inkludert',   'boolean',NULL,false,'true'::jsonb,'[]'::jsonb,'elektro',NULL,60),
  (_pkg_id, 'idriftsettelse_inkludert',  'Idriftsettelse inkludert',  'boolean',NULL,false,'true'::jsonb,'[]'::jsonb,'elektro',NULL,70),
  (_pkg_id, 'dokumentasjon_hms_inkludert','Dokumentasjon / HMS inkludert','boolean',NULL,false,'true'::jsonb,'[]'::jsonb,'elektro',NULL,80),
  (_pkg_id, 'dokumentasjon_hms_timer',    'Dokumentasjon / HMS — timer','number','t',false,'6'::jsonb,'[]'::jsonb,'elektro','Brukes hvis dokumentasjon/HMS er inkludert',90),

  -- Seksjon 5: Tillegg og kommersiell
  (_pkg_id, 'demontering_gammel_tavle', 'Demontering gammel tavle','boolean',NULL,false,'false'::jsonb,'[]'::jsonb,'kommersiell',NULL,10),
  (_pkg_id, 'bygg_i_drift_tillegg',     'Tillegg: bygg i drift',   'boolean',NULL,false,'false'::jsonb,'[]'::jsonb,'kommersiell',NULL,20),
  (_pkg_id, 'trang_adkomst_tillegg',    'Tillegg: trang adkomst',  'boolean',NULL,false,'false'::jsonb,'[]'::jsonb,'kommersiell',NULL,30),
  (_pkg_id, 'prosjektbuffer_pct',       'Prosjektbuffer (%)',      'percent','%', false,'5'::jsonb,'[]'::jsonb,'kommersiell',NULL,40),
  (_pkg_id, 'usikkerhet_pct',           'Usikkerhetspåslag (%)',   'percent','%', false,'5'::jsonb,'[]'::jsonb,'kommersiell',NULL,50),
  (_pkg_id, 'tilbudspris_override',     'Tilbudspris (overstyring)','number','kr', false,'0'::jsonb,'[]'::jsonb,'kommersiell','Sett fast tilbudspris. 0 = bruk kalkulert.',60),
  (_pkg_id, 'avrunding_step',           'Avrunding (kr)',          'number','kr', false,'0'::jsonb,'[]'::jsonb,'kommersiell','F.eks 1000 for nærmeste tusen.',70)
  ON CONFLICT (package_id, field_key) DO NOTHING;

  -- Sats-tabell
  INSERT INTO public.calc_rate_tables (id, company_id, package_id, name, version, is_active)
  VALUES (_rate_id, NULL, _pkg_id, 'Tavlemontasje v1 — standardrater', 1, true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.calc_rate_table_rows (rate_table_id, rate_key, label, value, unit, sort_order) VALUES
  (_rate_id, 'cost_montor',       'Kost montørtime',      650,  'kr/t', 10),
  (_rate_id, 'sales_montor',      'Salg montørtime',      1100, 'kr/t', 20),
  (_rate_id, 'cost_reise',        'Kost reise',           600,  'kr/t', 30),
  (_rate_id, 'sales_reise',       'Salg reise',           950,  'kr/t', 40),
  (_rate_id, 'cost_rigg',         'Kost rigg',            600,  'kr/t', 50),
  (_rate_id, 'sales_rigg',        'Salg rigg',            950,  'kr/t', 60),
  (_rate_id, 'cost_dokumentasjon','Kost dokumentasjon',   750,  'kr/t', 70),
  (_rate_id, 'sales_dokumentasjon','Salg dokumentasjon',  1250, 'kr/t', 80),
  (_rate_id, 'factor_kveld',      'Tillegg kveld',        0.15, 'pct',  90),
  (_rate_id, 'factor_natt',       'Tillegg natt',         0.30, 'pct',  100),
  (_rate_id, 'factor_helg',       'Tillegg helg',         0.50, 'pct',  110),
  (_rate_id, 'factor_hoyde',      'Tillegg arbeid i høyde',0.10,'pct',  120),
  (_rate_id, 'factor_trang',      'Tillegg trang adkomst',0.10, 'pct',  130),
  (_rate_id, 'factor_i_drift',    'Tillegg bygg i drift', 0.15, 'pct',  140)
  ON CONFLICT DO NOTHING;

  -- Norm-tabell
  INSERT INTO public.calc_norm_tables (id, company_id, package_id, name, version, is_active)
  VALUES (_norm_id, NULL, _pkg_id, 'Tavlemontasje v1 — normtider', 1, true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.calc_norm_table_rows (norm_table_id, element_key, label, hours, unit, sort_order) VALUES
  (_norm_id, 'sammenstilling_per_skjot','Sammenstilling per seksjonsskjøt', 2.5, 't/stk', 10),
  (_norm_id, 'mek_per_felt',            'Mekanisk montasje per felt',       0.6, 't/felt',20),
  (_norm_id, 'oppretting_base',         'Oppretting / innfesting (base)',   4.0, 't/post',30),
  (_norm_id, 'fundament_sokkel',        'Fundament / sokkel',               5.0, 't/post',40),
  (_norm_id, 'merking_base',            'Merking — basetimer',              2.0, 't/post',50),
  (_norm_id, 'merking_per_kabel',       'Merking — per kabel',              0.05,'t/stk', 60),
  (_norm_id, 'funksjonstest_base',      'Funksjonstest — basetimer',        3.0, 't/post',70),
  (_norm_id, 'funksjonstest_per_felt',  'Funksjonstest — per felt',         0.25,'t/felt',80),
  (_norm_id, 'idriftsettelse_base',     'Idriftsettelse',                   4.0, 't/post',90),
  (_norm_id, 'dokumentasjon_hms_base',  'Dokumentasjon / HMS (base)',       6.0, 't/post',100),
  (_norm_id, 'demontering_base',        'Demontering — basetimer',          6.0, 't/post',110),
  (_norm_id, 'demontering_per_felt',    'Demontering — per felt',           0.25,'t/felt',120)
  ON CONFLICT DO NOTHING;
END $$;
