-- HMS bransjeområder (NHO Elektro-inspirert taksonomi)

CREATE TABLE public.hms_area_catalog (
  area_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  legal_reference TEXT,
  sort_order INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hms_area_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hms_area_catalog readable by authenticated"
  ON public.hms_area_catalog FOR SELECT TO authenticated USING (true);

CREATE POLICY "hms_area_catalog manageable by hms.manage"
  ON public.hms_area_catalog FOR ALL TO authenticated
  USING (public.check_permission_v2(auth.uid(), 'hms.manage'))
  WITH CHECK (public.check_permission_v2(auth.uid(), 'hms.manage'));

INSERT INTO public.hms_area_catalog (area_key, label, description, category, legal_reference, sort_order) VALUES
  ('internal_control', 'Internkontroll / NIK', 'Systematisk HMS-arbeid (Internkontrollforskriften).', 'governance', 'Internkontrollforskriften', 10),
  ('hms_training_leader', 'HMS-opplæring for daglig leder', 'Lovpålagt opplæring for daglig leder, AML §3-5.', 'governance', 'AML §3-5', 20),
  ('fse', 'FSE-opplæring', 'Forskrift om sikkerhet ved arbeid i og drift av elektriske anlegg.', 'electrical', 'FSE', 30),
  ('electrical_safety', 'Elsikkerhet', 'Generell elsikkerhet i drift og arbeid.', 'electrical', 'FEL/FSE', 40),
  ('work_near_electrical', 'Arbeid på eller nær elektriske anlegg', 'Risikovurdering ved AUS/spenningsnært arbeid.', 'electrical', 'FSE §10-§14', 50),
  ('electric_shock', 'Strømulykke / strømgjennomgang', 'Rutiner ved strømgjennomgang og lysbueulykker.', 'electrical', 'FSE §32', 60),
  ('serious_incident', 'Alvorlig ulykke', 'Varsling, tiltak og rapportering ved alvorlig hendelse.', 'safety', 'AML §5-2', 70),
  ('ppe', 'Personlig verneutstyr', 'PVU – krav, valg, vedlikehold og opplæring.', 'safety', 'BUF §15', 80),
  ('safety_rep', 'Verneombud', 'Valg, opplæring og rolle for verneombud.', 'governance', 'AML §6', 90),
  ('chemicals', 'Stoffkartotek', 'Sikkerhetsdatablad og kjemikaliestyring.', 'environment', 'FKB', 100),
  ('ee_waste', 'EE-avfall', 'Håndtering og retur av elektrisk og elektronisk avfall.', 'environment', 'Avfallsforskriften kap 1', 110),
  ('asbestos', 'Asbest ved arbeid i eldre bygg', 'Kartlegging og sikker håndtering ved arbeid i bygg fra før 1985.', 'environment', 'BUF kap 4', 120),
  ('sick_leave', 'Sykefravær og HR-rutiner', 'Oppfølging av sykefravær og HR-prosesser.', 'hr', 'Folketrygdloven kap 8', 130),
  ('psychosocial', 'Psykososialt arbeidsmiljø', 'Trivsel, mobbing, varsling, konflikthåndtering.', 'hr', 'AML §4-3', 140);

-- Tagging på eksisterende HMS-tabeller
ALTER TABLE public.hms_handbook_sections ADD COLUMN IF NOT EXISTS hms_areas TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.hms_templates ADD COLUMN IF NOT EXISTS hms_areas TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.hms_template_items ADD COLUMN IF NOT EXISTS hms_areas TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.hms_risk_items ADD COLUMN IF NOT EXISTS hms_areas TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_hms_handbook_sections_areas ON public.hms_handbook_sections USING GIN (hms_areas);
CREATE INDEX IF NOT EXISTS idx_hms_templates_areas ON public.hms_templates USING GIN (hms_areas);
CREATE INDEX IF NOT EXISTS idx_hms_template_items_areas ON public.hms_template_items USING GIN (hms_areas);
CREATE INDEX IF NOT EXISTS idx_hms_risk_items_areas ON public.hms_risk_items USING GIN (hms_areas);

-- Kontekstfelter for forslagsmotor
ALTER TABLE public.hms_templates
  ADD COLUMN IF NOT EXISTS suggested_work_types TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS suggested_project_kinds TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS suggested_building_types TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS requires_min_building_age_years INT,
  ADD COLUMN IF NOT EXISTS requires_near_electrical BOOLEAN,
  ADD COLUMN IF NOT EXISTS requires_off_hours BOOLEAN,
  ADD COLUMN IF NOT EXISTS requires_chemicals BOOLEAN,
  ADD COLUMN IF NOT EXISTS requires_ee_waste BOOLEAN;

ALTER TABLE public.hms_template_items
  ADD COLUMN IF NOT EXISTS suggested_work_types TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS suggested_project_kinds TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS suggested_building_types TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS requires_min_building_age_years INT,
  ADD COLUMN IF NOT EXISTS requires_near_electrical BOOLEAN,
  ADD COLUMN IF NOT EXISTS requires_off_hours BOOLEAN,
  ADD COLUMN IF NOT EXISTS requires_chemicals BOOLEAN,
  ADD COLUMN IF NOT EXISTS requires_ee_waste BOOLEAN;

CREATE TABLE public.hms_area_suggestion_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_key TEXT NOT NULL REFERENCES public.hms_area_catalog(area_key) ON DELETE CASCADE,
  rule_label TEXT NOT NULL,
  work_types TEXT[],
  project_kinds TEXT[],
  building_types TEXT[],
  min_building_age_years INT,
  near_electrical BOOLEAN,
  off_hours BOOLEAN,
  chemicals BOOLEAN,
  ee_waste BOOLEAN,
  score INT NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hms_area_suggestion_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hms_area_suggestion_rules readable by authenticated"
  ON public.hms_area_suggestion_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "hms_area_suggestion_rules manageable by hms.manage"
  ON public.hms_area_suggestion_rules FOR ALL TO authenticated
  USING (public.check_permission_v2(auth.uid(), 'hms.manage'))
  WITH CHECK (public.check_permission_v2(auth.uid(), 'hms.manage'));

CREATE INDEX idx_hms_area_suggestion_rules_area ON public.hms_area_suggestion_rules(area_key) WHERE is_active = true;

INSERT INTO public.hms_area_suggestion_rules
  (area_key, rule_label, work_types, project_kinds, building_types, min_building_age_years, near_electrical, off_hours, chemicals, ee_waste, score) VALUES
  ('fse',                  'Alt elektrisk arbeid',                 NULL, NULL, NULL, NULL, true, NULL, NULL, NULL, 95),
  ('electrical_safety',    'Alt elektrisk arbeid',                 NULL, NULL, NULL, NULL, true, NULL, NULL, NULL, 95),
  ('work_near_electrical', 'Arbeid nær spenning',                  NULL, NULL, NULL, NULL, true, NULL, NULL, NULL, 90),
  ('electric_shock',       'Beredskap ved spenningsnært arbeid',   NULL, NULL, NULL, NULL, true, NULL, NULL, NULL, 70),
  ('ppe',                  'Alle felt-arbeider',                   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 80),
  ('serious_incident',     'Alle prosjekter – beredskap',          NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 60),
  ('work_near_electrical', 'Datacenter-arbeid',                    NULL, ARRAY['datacenter'], NULL, NULL, true, NULL, NULL, NULL, 100),
  ('fse',                  'Tavle / strømskinner',                 ARRAY['tavlemontasje','stromskinner'], NULL, NULL, NULL, true, NULL, NULL, NULL, 100),
  ('work_near_electrical', 'Tavle / strømskinner',                 ARRAY['tavlemontasje','stromskinner'], NULL, NULL, NULL, true, NULL, NULL, NULL, 100),
  ('electric_shock',       'Tavle / strømskinner',                 ARRAY['tavlemontasje','stromskinner'], NULL, NULL, NULL, true, NULL, NULL, NULL, 85),
  ('ppe',                  'Service og næringsbygg',               ARRAY['service'], ARRAY['service','naeringsbygg'], NULL, NULL, NULL, NULL, NULL, NULL, 85),
  ('asbestos',             'Bygg eldre enn 1985',                  NULL, NULL, NULL, 40, NULL, NULL, NULL, NULL, 95),
  ('psychosocial',         'Kveld/natt/helgearbeid',               NULL, NULL, NULL, NULL, NULL, true, NULL, NULL, 60),
  ('serious_incident',     'Kveld/natt/helg – alenearbeid',        NULL, NULL, NULL, NULL, NULL, true, NULL, NULL, 70),
  ('chemicals',            'Kjemikalier i bruk',                   NULL, NULL, NULL, NULL, NULL, NULL, true, NULL, 95),
  ('ee_waste',             'EE-avfall genereres',                  NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, 95),
  ('internal_control',     'Alltid – internkontroll',              NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 30),
  ('safety_rep',           'Alltid – verneombud',                  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 25),
  ('hms_training_leader',  'Alltid – leders HMS-opplæring',        NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 20),
  ('sick_leave',           'Alltid – HR/sykefravær',               NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 20),
  ('psychosocial',         'Alltid – psykososialt baseline',       NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 25);

CREATE OR REPLACE FUNCTION public.suggest_hms_areas(
  _work_types TEXT[] DEFAULT NULL,
  _project_kind TEXT DEFAULT NULL,
  _building_type TEXT DEFAULT NULL,
  _building_age_years INT DEFAULT NULL,
  _near_electrical BOOLEAN DEFAULT NULL,
  _off_hours BOOLEAN DEFAULT NULL,
  _chemicals BOOLEAN DEFAULT NULL,
  _ee_waste BOOLEAN DEFAULT NULL
)
RETURNS TABLE(area_key TEXT, label TEXT, score INT, reasons TEXT[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH matches AS (
    SELECT r.area_key, r.score, r.rule_label
    FROM public.hms_area_suggestion_rules r
    WHERE r.is_active = true
      AND (r.work_types IS NULL OR (_work_types IS NOT NULL AND r.work_types && _work_types))
      AND (r.project_kinds IS NULL OR (_project_kind IS NOT NULL AND _project_kind = ANY (r.project_kinds)))
      AND (r.building_types IS NULL OR (_building_type IS NOT NULL AND _building_type = ANY (r.building_types)))
      AND (r.min_building_age_years IS NULL OR (_building_age_years IS NOT NULL AND _building_age_years >= r.min_building_age_years))
      AND (r.near_electrical IS NULL OR r.near_electrical = COALESCE(_near_electrical, false))
      AND (r.off_hours IS NULL OR r.off_hours = COALESCE(_off_hours, false))
      AND (r.chemicals IS NULL OR r.chemicals = COALESCE(_chemicals, false))
      AND (r.ee_waste IS NULL OR r.ee_waste = COALESCE(_ee_waste, false))
  ),
  agg AS (
    SELECT m.area_key, MAX(m.score) AS score, ARRAY_AGG(DISTINCT m.rule_label) AS reasons
    FROM matches m GROUP BY m.area_key
  )
  SELECT a.area_key, c.label, a.score, a.reasons
  FROM agg a
  JOIN public.hms_area_catalog c ON c.area_key = a.area_key
  WHERE c.is_active = true
  ORDER BY a.score DESC, c.sort_order;
$$;

GRANT EXECUTE ON FUNCTION public.suggest_hms_areas TO authenticated;

CREATE TRIGGER trg_hms_area_catalog_updated
  BEFORE UPDATE ON public.hms_area_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_hms_area_suggestion_rules_updated
  BEFORE UPDATE ON public.hms_area_suggestion_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();