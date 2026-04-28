-- =========================================================================
-- MCS Calculation Engine — Phase 2: AI-assisted creation
-- =========================================================================
-- 1. Vendor model (data-driven leverandører/serier/komponenter)
-- 2. Cost-price schema (per komponent/serie, gyldighetsperioder)
-- 3. AI draft sessions (utkast + chat-historikk + opplastet underlag)
-- 4. Extend Strømskinne package: opp til 6300A + Eaton/Legrand
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. VENDOR MODEL
-- -------------------------------------------------------------------------

CREATE TABLE public.calc_vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID,                              -- NULL = global standard
  slug TEXT NOT NULL,                           -- 'schneider', 'eaton', 'legrand'
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'busbar',     -- 'busbar', 'switchgear', etc
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, slug, category)
);

CREATE INDEX idx_calc_vendors_category ON public.calc_vendors(category) WHERE is_active = true;
CREATE INDEX idx_calc_vendors_company ON public.calc_vendors(company_id);

ALTER TABLE public.calc_vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read active vendors"
  ON public.calc_vendors FOR SELECT
  TO authenticated
  USING (is_active = true AND (company_id IS NULL OR public.user_has_company_access(auth.uid(), company_id)));

CREATE POLICY "Admins can manage vendors"
  ON public.calc_vendors FOR ALL
  TO authenticated
  USING (public.check_permission_v2(auth.uid(), 'admin.manage_users'))
  WITH CHECK (public.check_permission_v2(auth.uid(), 'admin.manage_users'));

CREATE TRIGGER trg_calc_vendors_updated_at
  BEFORE UPDATE ON public.calc_vendors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Series per vendor (e.g. Schneider Canalis, Eaton xEnergy, Legrand SCP)
CREATE TABLE public.calc_vendor_series (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.calc_vendors(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  conductor_type TEXT,                          -- 'kobber', 'aluminium'
  finish TEXT,                                  -- 'epoxy', 'lakkert', 'ren'
  current_classes INTEGER[] NOT NULL DEFAULT '{}',  -- f.eks {800,1000,1250,1600,2000,2500,3200,4000,5000,6300}
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, slug)
);

CREATE INDEX idx_calc_vendor_series_vendor ON public.calc_vendor_series(vendor_id) WHERE is_active = true;

ALTER TABLE public.calc_vendor_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read active series"
  ON public.calc_vendor_series FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage series"
  ON public.calc_vendor_series FOR ALL
  TO authenticated
  USING (public.check_permission_v2(auth.uid(), 'admin.manage_users'))
  WITH CHECK (public.check_permission_v2(auth.uid(), 'admin.manage_users'));

CREATE TRIGGER trg_calc_vendor_series_updated_at
  BEFORE UPDATE ON public.calc_vendor_series
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Komponenter per serie (straight 1m, vinkel, T-element, terminal, ...)
CREATE TABLE public.calc_vendor_components (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  series_id UUID NOT NULL REFERENCES public.calc_vendor_series(id) ON DELETE CASCADE,
  element_key TEXT NOT NULL,                    -- 'straight_1', 'vinkel', 't_element', ...
  current_class INTEGER,                        -- NULL = gjelder alle, ellers spesifikk klasse
  label TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'stk',
  vendor_part_number TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (series_id, element_key, current_class)
);

CREATE INDEX idx_calc_vendor_components_series ON public.calc_vendor_components(series_id) WHERE is_active = true;

ALTER TABLE public.calc_vendor_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read active components"
  ON public.calc_vendor_components FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage components"
  ON public.calc_vendor_components FOR ALL
  TO authenticated
  USING (public.check_permission_v2(auth.uid(), 'admin.manage_users'))
  WITH CHECK (public.check_permission_v2(auth.uid(), 'admin.manage_users'));

CREATE TRIGGER trg_calc_vendor_components_updated_at
  BEFORE UPDATE ON public.calc_vendor_components
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -------------------------------------------------------------------------
-- 2. COST-PRICE SCHEMA (skjema klart, ingen UI-vedlikehold ennå)
-- -------------------------------------------------------------------------

CREATE TABLE public.calc_cost_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID,                              -- NULL = global standardpris
  vendor_id UUID REFERENCES public.calc_vendors(id) ON DELETE CASCADE,
  series_id UUID REFERENCES public.calc_vendor_series(id) ON DELETE CASCADE,
  component_id UUID REFERENCES public.calc_vendor_components(id) ON DELETE CASCADE,
  element_key TEXT,                             -- fallback dersom man priser per element_key uten komponent-id
  current_class INTEGER,
  cost_amount NUMERIC(14,2) NOT NULL,
  recommended_sales_amount NUMERIC(14,2),
  currency TEXT NOT NULL DEFAULT 'NOK',
  unit TEXT NOT NULL DEFAULT 'stk',
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_to DATE,                                -- NULL = aktiv
  source TEXT NOT NULL DEFAULT 'manual',        -- 'manual', 'import', 'override'
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_calc_cost_prices_lookup ON public.calc_cost_prices(component_id, valid_from, valid_to);
CREATE INDEX idx_calc_cost_prices_series ON public.calc_cost_prices(series_id, element_key, current_class);
CREATE INDEX idx_calc_cost_prices_company ON public.calc_cost_prices(company_id);

ALTER TABLE public.calc_cost_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read cost prices in their scope"
  ON public.calc_cost_prices FOR SELECT
  TO authenticated
  USING (company_id IS NULL OR public.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Admins can manage cost prices"
  ON public.calc_cost_prices FOR ALL
  TO authenticated
  USING (public.check_permission_v2(auth.uid(), 'admin.manage_users'))
  WITH CHECK (public.check_permission_v2(auth.uid(), 'admin.manage_users'));

CREATE TRIGGER trg_calc_cost_prices_updated_at
  BEFORE UPDATE ON public.calc_cost_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -------------------------------------------------------------------------
-- 3. AI DRAFT SESSIONS (utkast + chat + opplastet underlag)
-- -------------------------------------------------------------------------

CREATE TABLE public.calc_ai_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID,
  user_id UUID,                                 -- auth.users.id som startet utkastet
  package_id UUID NOT NULL REFERENCES public.calc_packages(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft',         -- 'draft', 'analyzing', 'ready', 'applied', 'discarded'
  initial_description TEXT,                     -- bruker-tekst ved oppstart
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{path, name, mime_type, size, bucket}]
  ai_summary TEXT,
  ai_assumptions TEXT[] NOT NULL DEFAULT '{}',
  ai_open_questions TEXT[] NOT NULL DEFAULT '{}',
  ai_proposed_input JSONB NOT NULL DEFAULT '{}'::jsonb,    -- { field_key: { value, confidence, reason } }
  ai_proposed_lines JSONB NOT NULL DEFAULT '[]'::jsonb,    -- ekstra linjer med confidence
  overall_confidence NUMERIC(5,2),              -- 0-100
  model_used TEXT,
  applied_calculation_id UUID REFERENCES public.calculations(id) ON DELETE SET NULL,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_calc_ai_drafts_user ON public.calc_ai_drafts(user_id, status);
CREATE INDEX idx_calc_ai_drafts_company ON public.calc_ai_drafts(company_id);

ALTER TABLE public.calc_ai_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own AI drafts or company drafts"
  ON public.calc_ai_drafts FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (company_id IS NOT NULL AND public.user_has_company_access(auth.uid(), company_id))
  );

CREATE POLICY "Users can create AI drafts for themselves"
  ON public.calc_ai_drafts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own AI drafts"
  ON public.calc_ai_drafts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own AI drafts"
  ON public.calc_ai_drafts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_calc_ai_drafts_updated_at
  BEFORE UPDATE ON public.calc_ai_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Chat-meldinger / korrigeringer i AI-review
CREATE TABLE public.calc_ai_draft_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID NOT NULL REFERENCES public.calc_ai_drafts(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                           -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  proposal_diff JSONB,                          -- hva AI endret i forslaget i denne meldingen
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_calc_ai_draft_messages_draft ON public.calc_ai_draft_messages(draft_id, created_at);

ALTER TABLE public.calc_ai_draft_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read messages on their drafts"
  ON public.calc_ai_draft_messages FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.calc_ai_drafts d
    WHERE d.id = draft_id
      AND (d.user_id = auth.uid() OR (d.company_id IS NOT NULL AND public.user_has_company_access(auth.uid(), d.company_id)))
  ));

CREATE POLICY "Users can insert messages on their drafts"
  ON public.calc_ai_draft_messages FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.calc_ai_drafts d
    WHERE d.id = draft_id AND d.user_id = auth.uid()
  ));

-- -------------------------------------------------------------------------
-- 4. STORAGE BUCKET for AI-utkast (private)
-- -------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('calc-ai-drafts', 'calc-ai-drafts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can read their own calc-ai-draft files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'calc-ai-drafts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload to their own calc-ai-draft folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'calc-ai-drafts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own calc-ai-draft files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'calc-ai-drafts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- -------------------------------------------------------------------------
-- 5. SEED: leverandører + serier for Strømskinne
-- -------------------------------------------------------------------------

INSERT INTO public.calc_vendors (company_id, slug, name, category, sort_order) VALUES
  (NULL, 'schneider', 'Schneider Electric', 'busbar', 10),
  (NULL, 'eaton',     'Eaton',              'busbar', 20),
  (NULL, 'legrand',   'Legrand',            'busbar', 30)
ON CONFLICT (company_id, slug, category) DO NOTHING;

-- Serier (med strømklasser opp til 6300A)
INSERT INTO public.calc_vendor_series (vendor_id, slug, name, conductor_type, finish, current_classes, sort_order)
SELECT v.id, s.slug, s.name, s.conductor_type, s.finish, s.current_classes, s.sort_order
FROM (VALUES
  ('schneider', 'canalis-kt',    'Canalis KT',     'kobber',    'epoxy', ARRAY[800,1000,1250,1600,2000,2500,3200,4000,5000,6300], 10),
  ('schneider', 'canalis-ks',    'Canalis KS',     'kobber',    'epoxy', ARRAY[100,160,250,400,630,800,1000], 20),
  ('eaton',     'xenergy-xpr',   'xEnergy XPR',    'aluminium', 'lakkert', ARRAY[800,1250,1600,2000,2500,3200,4000,5000,6300], 10),
  ('eaton',     'xenergy-xprc',  'xEnergy XPR-C',  'kobber',    'epoxy', ARRAY[1600,2500,3200,4000,5000,6300], 20),
  ('legrand',   'scp',           'SCP',            'aluminium', 'lakkert', ARRAY[800,1000,1250,1600,2000,2500,3200,4000,5000], 10),
  ('legrand',   'scp-cu',        'SCP Cu',         'kobber',    'epoxy', ARRAY[1600,2500,3200,4000,5000,6300], 20)
) AS s(vendor_slug, slug, name, conductor_type, finish, current_classes, sort_order)
JOIN public.calc_vendors v ON v.slug = s.vendor_slug AND v.category = 'busbar' AND v.company_id IS NULL
ON CONFLICT (vendor_id, slug) DO NOTHING;

-- -------------------------------------------------------------------------
-- 6. UPDATE Strømskinne package: utvid strømklasser
-- -------------------------------------------------------------------------

-- Erstatt valgmulighetene for stromklasse-feltet
UPDATE public.calc_package_fields
SET options = '[
  {"value":"800","label":"800 A"},
  {"value":"1000","label":"1000 A"},
  {"value":"1250","label":"1250 A"},
  {"value":"1600","label":"1600 A"},
  {"value":"2000","label":"2000 A"},
  {"value":"2500","label":"2500 A"},
  {"value":"3200","label":"3200 A"},
  {"value":"4000","label":"4000 A"},
  {"value":"5000","label":"5000 A"},
  {"value":"6300","label":"6300 A"}
]'::jsonb
WHERE field_key = 'stromklasse'
  AND package_id IN (SELECT id FROM public.calc_packages WHERE slug = 'stromskinne-v1');

-- Legg til (eller oppdater) leverandør-felt med datadrevet kilde
INSERT INTO public.calc_package_fields (
  package_id, field_key, label, field_type, unit, is_required,
  default_value, options, section_key, help_text, sort_order
)
SELECT 
  p.id, 'leverandor', 'Leverandør', 'lookup', NULL, false,
  '"schneider"'::jsonb,
  '[{"value":"schneider","label":"Schneider Electric"},{"value":"eaton","label":"Eaton"},{"value":"legrand","label":"Legrand"}]'::jsonb,
  'grunnlag', 'Velg leverandør for strømskinnesystemet', 5
FROM public.calc_packages p
WHERE p.slug = 'stromskinne-v1'
  AND NOT EXISTS (
    SELECT 1 FROM public.calc_package_fields f
    WHERE f.package_id = p.id AND f.field_key = 'leverandor'
  );

UPDATE public.calc_package_fields
SET options = '[
  {"value":"schneider","label":"Schneider Electric"},
  {"value":"eaton","label":"Eaton"},
  {"value":"legrand","label":"Legrand"}
]'::jsonb,
field_type = 'lookup'
WHERE field_key = 'leverandor'
  AND package_id IN (SELECT id FROM public.calc_packages WHERE slug = 'stromskinne-v1');
