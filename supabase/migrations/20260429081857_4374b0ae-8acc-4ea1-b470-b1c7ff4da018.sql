
-- ============================================================================
-- 1) Baseline-profiler: navngitte pris/normgrunnlag per pakke
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.calc_baseline_profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id  uuid NOT NULL REFERENCES public.calc_packages(id) ON DELETE CASCADE,
  company_id  uuid,
  slug        text NOT NULL,
  name        text NOT NULL,
  description text,
  version     integer NOT NULL DEFAULT 1,
  is_active   boolean NOT NULL DEFAULT true,
  -- generelle parametere som er felles for hele profilen
  hourly_rate_cost numeric NOT NULL DEFAULT 0,    -- kr/t kost (intern timesats)
  profit_factor    numeric NOT NULL DEFAULT 1.4,  -- påslag fra kost til salg
  lift_cost_per_day numeric NOT NULL DEFAULT 0,   -- kr/dag for stillas/lift
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_id, company_id, slug, version)
);

CREATE INDEX IF NOT EXISTS idx_calc_baseline_profiles_pkg
  ON public.calc_baseline_profiles(package_id) WHERE is_active;

ALTER TABLE public.calc_baseline_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calc_baseline_profiles select" ON public.calc_baseline_profiles
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR public.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "calc_baseline_profiles write" ON public.calc_baseline_profiles
  FOR ALL TO authenticated
  USING (
    (company_id IS NULL AND public.is_super_admin(auth.uid()))
    OR (company_id IS NOT NULL AND public.user_has_company_access(auth.uid(), company_id))
  )
  WITH CHECK (
    (company_id IS NULL AND public.is_super_admin(auth.uid()))
    OR (company_id IS NOT NULL AND public.user_has_company_access(auth.uid(), company_id))
  );

CREATE TRIGGER trg_calc_baseline_profiles_updated
  BEFORE UPDATE ON public.calc_baseline_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 2) Ampereklasse-rader: én rad per ampere/segment per profil
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.calc_baseline_amp_rows (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL REFERENCES public.calc_baseline_profiles(id) ON DELETE CASCADE,
  amp_key         text NOT NULL,           -- "1600", "1600-2500", "25-40"
  amp_label       text NOT NULL,           -- visningstekst
  amp_min         integer,                 -- nedre grense (A) for matching
  amp_max         integer,                 -- øvre grense (A) for matching
  hours_per_meter numeric NOT NULL DEFAULT 0,
  hours_per_vinkel numeric NOT NULL DEFAULT 0,
  support_cost_per_meter numeric NOT NULL DEFAULT 0,  -- opphengsmateriell kr/m
  trafo_connect_cost numeric NOT NULL DEFAULT 0,      -- trafo/tavle-tilkobling kr/stk
  sort_order      integer NOT NULL DEFAULT 0,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (profile_id, amp_key)
);

CREATE INDEX IF NOT EXISTS idx_calc_baseline_amp_rows_profile
  ON public.calc_baseline_amp_rows(profile_id);

ALTER TABLE public.calc_baseline_amp_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calc_baseline_amp_rows select" ON public.calc_baseline_amp_rows
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.calc_baseline_profiles p
    WHERE p.id = profile_id
      AND (p.company_id IS NULL OR public.user_has_company_access(auth.uid(), p.company_id))
  ));

CREATE POLICY "calc_baseline_amp_rows write" ON public.calc_baseline_amp_rows
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.calc_baseline_profiles p
    WHERE p.id = profile_id
      AND (
        (p.company_id IS NULL AND public.is_super_admin(auth.uid()))
        OR (p.company_id IS NOT NULL AND public.user_has_company_access(auth.uid(), p.company_id))
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.calc_baseline_profiles p
    WHERE p.id = profile_id
      AND (
        (p.company_id IS NULL AND public.is_super_admin(auth.uid()))
        OR (p.company_id IS NOT NULL AND public.user_has_company_access(auth.uid(), p.company_id))
      )
  ));

-- ============================================================================
-- 3) Seed Strømskinne v2 baseline-profiler
-- ============================================================================
DO $$
DECLARE
  _pkg_id uuid := '5b1e9e2a-7f6c-4d2b-9a31-7c2c5b1e9e2a'::uuid;
  _metall_id uuid := 'b1a2c3d4-0001-4000-8000-000000000001'::uuid;
  _epoksy_id uuid := 'b1a2c3d4-0001-4000-8000-000000000002'::uuid;
BEGIN
  INSERT INTO public.calc_baseline_profiles
    (id, package_id, company_id, slug, name, description, version, is_active,
     hourly_rate_cost, profit_factor, lift_cost_per_day, metadata)
  VALUES
    (_metall_id, _pkg_id, NULL, 'metallkapslet-v1', 'Metallkapslet baseline v1',
     'Intern Scanel-baseline for metallkapslede strømskinner (25/40–6300 A). Kvalitetssikret av tre interne fagpersoner.',
     1, true, 700, 1.4, 250,
     jsonb_build_object('source', 'Scanel internt Excel-grunnlag (Mal 3)')),
    (_epoksy_id, _pkg_id, NULL, 'epoksy-v1', 'Epoksy baseline v1',
     'Intern Scanel-baseline for epoksy/Betobar LR-skinner (630–5000 A). Kvalitetssikret av tre interne fagpersoner.',
     1, true, 720, 1.4, 300,
     jsonb_build_object('source', 'Scanel internt Excel-grunnlag (Mal 3)'))
  ON CONFLICT (package_id, company_id, slug, version) DO NOTHING;

  -- Metallkapslet rader
  INSERT INTO public.calc_baseline_amp_rows
    (profile_id, amp_key, amp_label, amp_min, amp_max, hours_per_meter, hours_per_vinkel, support_cost_per_meter, trafo_connect_cost, sort_order)
  VALUES
    (_metall_id, '25-40',  'Lysskinne 25–40 A', 25,   40,   0.75, 0,     50,  0,     10),
    (_metall_id, '160',    '160 A',             100,  160,  1.75, 0.5,   75,  0,     20),
    (_metall_id, '250',    '250 A',             161,  250,  1.0,  0.5,   75,  0,     30),
    (_metall_id, '400',    '400 A',             251,  400,  1.25, 0.5,   75,  0,     40),
    (_metall_id, '630',    '630 A',             401,  630,  1.5,  0.5,   75,  10000, 50),
    (_metall_id, '800',    '800 A',             631,  800,  1.75, 0.5,   75,  10000, 60),
    (_metall_id, '1000',   '1000 A',            801,  1000, 2.0,  0.5,   100, 10000, 70),
    (_metall_id, '1250',   '1250 A',            1001, 1250, 2.25, 0.5,   100, 10000, 80),
    (_metall_id, '1600',   '1600 A',            1251, 1600, 2.5,  0.75,  100, 15000, 90),
    (_metall_id, '2000',   '2000 A',            1601, 2000, 2.75, 0.75,  150, 15000, 100),
    (_metall_id, '2500',   '2500 A',            2001, 2500, 3.0,  1.0,   150, 20000, 110),
    (_metall_id, '3200',   '3200 A',            2501, 3200, 4.0,  1.0,   150, 20000, 120),
    (_metall_id, '4000',   '4000 A',            3201, 4000, 4.5,  1.0,   150, 20000, 130),
    (_metall_id, '5000',   '5000 A',            4001, 5000, 4.75, 1.0,   150, 25000, 140),
    (_metall_id, '6300',   '6300 A',            5001, 6300, 5.0,  1.5,   150, 25000, 150)
  ON CONFLICT (profile_id, amp_key) DO NOTHING;

  -- Epoksy rader
  INSERT INTO public.calc_baseline_amp_rows
    (profile_id, amp_key, amp_label, amp_min, amp_max, hours_per_meter, hours_per_vinkel, support_cost_per_meter, trafo_connect_cost, sort_order)
  VALUES
    (_epoksy_id, '630-1250',  'Betobar LR 630–1250 A',   630,  1250, 5.0, 2.0, 200, 15000, 10),
    (_epoksy_id, '1600-2500', 'Betobar LR 1600–2500 A',  1251, 2500, 6.0, 3.0, 250, 20000, 20),
    (_epoksy_id, '3200-5000', 'Betobar LR 3200–5000 A',  2501, 5000, 7.0, 4.0, 300, 25000, 30)
  ON CONFLICT (profile_id, amp_key) DO NOTHING;
END $$;

-- ============================================================================
-- 4) Nytt felt på Strømskinne v2: baseline_profile
-- ============================================================================
INSERT INTO public.calc_package_fields
  (package_id, field_key, label, field_type, unit, is_required, default_value, options, section_key, help_text, sort_order)
VALUES (
  '5b1e9e2a-7f6c-4d2b-9a31-7c2c5b1e9e2a',
  'baseline_profile',
  'Baseline-profil',
  'select',
  NULL,
  false,
  '"metallkapslet-v1"'::jsonb,
  '[
    {"value":"metallkapslet-v1","label":"Metallkapslet baseline v1"},
    {"value":"epoksy-v1","label":"Epoksy baseline v1"},
    {"value":"legacy","label":"Legacy (gamle normer)"}
  ]'::jsonb,
  'tekniske',
  'Velger hvilket internt pris- og normgrunnlag (timer/m, timer/vinkel, support kr/m, trafo kr) som brukes. Valgte amp-rader hentes fra baseline-tabellen.',
  5
)
ON CONFLICT (package_id, field_key) DO UPDATE
  SET label = EXCLUDED.label,
      field_type = EXCLUDED.field_type,
      options = EXCLUDED.options,
      default_value = EXCLUDED.default_value,
      help_text = EXCLUDED.help_text,
      section_key = EXCLUDED.section_key,
      sort_order = EXCLUDED.sort_order;
