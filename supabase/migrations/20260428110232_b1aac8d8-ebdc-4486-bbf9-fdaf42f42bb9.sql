-- ============================================================
-- COMMERCIAL CASES — felles kommersielt fundament
-- Fase 1: tabell, koblinger, RLS, backfill-funksjon
-- ============================================================

-- 1) Sekvens for SAK-nummer
CREATE SEQUENCE IF NOT EXISTS public.commercial_case_number_seq START 1;

-- 2) Hovedtabell
CREATE TABLE IF NOT EXISTS public.commercial_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number text UNIQUE,
  company_id uuid NOT NULL,
  title text NOT NULL,

  -- Kunde / kontakt
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  contact_person_id uuid REFERENCES public.customer_contacts(id) ON DELETE SET NULL,

  -- Ansvar
  owner_user_id uuid,            -- auth.users.id (selger/ansvarlig)
  department_id uuid,

  -- Kommersiell tilstand
  phase text NOT NULL DEFAULT 'lead'
    CHECK (phase IN ('lead','qualifying','calculating','quoted','negotiating','won','lost','on_hold')),
  value_estimate numeric(14,2),
  probability_pct integer CHECK (probability_pct BETWEEN 0 AND 100),
  expected_close_date date,

  -- Oppfølging
  next_step text,
  next_step_due_at timestamptz,

  -- Vunnet / tapt
  won_at timestamptz,
  lost_at timestamptz,
  lost_reason text,

  -- Opprinnelse
  source text,                    -- 'postkontoret','lead','manual','calc','offer', ...
  source_ref text,                -- valgfri ekstern referanse
  description text,
  tags text[],

  -- Standard
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);

-- Indekser
CREATE INDEX IF NOT EXISTS idx_commercial_cases_company ON public.commercial_cases(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_commercial_cases_owner ON public.commercial_cases(owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_commercial_cases_phase ON public.commercial_cases(phase) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_commercial_cases_customer ON public.commercial_cases(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_commercial_cases_next_step_due ON public.commercial_cases(next_step_due_at) WHERE deleted_at IS NULL AND next_step_due_at IS NOT NULL;

-- Generér SAK-nummer
CREATE OR REPLACE FUNCTION public.generate_commercial_case_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.case_number IS NULL OR NEW.case_number = '' THEN
    NEW.case_number := 'SAK-' || EXTRACT(YEAR FROM now())::text || '-'
                       || LPAD(nextval('public.commercial_case_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commercial_cases_number ON public.commercial_cases;
CREATE TRIGGER trg_commercial_cases_number
BEFORE INSERT ON public.commercial_cases
FOR EACH ROW EXECUTE FUNCTION public.generate_commercial_case_number();

DROP TRIGGER IF EXISTS trg_commercial_cases_updated ON public.commercial_cases;
CREATE TRIGGER trg_commercial_cases_updated
BEFORE UPDATE ON public.commercial_cases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.commercial_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commercial_cases_select"
  ON public.commercial_cases FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.user_has_company_access(auth.uid(), company_id)
  );

CREATE POLICY "commercial_cases_insert"
  ON public.commercial_cases FOR INSERT
  WITH CHECK (
    public.user_has_company_access(auth.uid(), company_id)
  );

CREATE POLICY "commercial_cases_update"
  ON public.commercial_cases FOR UPDATE
  USING (public.user_has_company_access(auth.uid(), company_id))
  WITH CHECK (public.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "commercial_cases_delete"
  ON public.commercial_cases FOR DELETE
  USING (public.user_has_company_access(auth.uid(), company_id));

-- 3) Koblingskolonner på eksisterende moduler (alle nullable)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS commercial_case_id uuid REFERENCES public.commercial_cases(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_leads_commercial_case ON public.leads(commercial_case_id) WHERE commercial_case_id IS NOT NULL;

ALTER TABLE public.calc_cases
  ADD COLUMN IF NOT EXISTS commercial_case_id uuid REFERENCES public.commercial_cases(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_calc_cases_commercial_case ON public.calc_cases(commercial_case_id) WHERE commercial_case_id IS NOT NULL;

ALTER TABLE public.calculations
  ADD COLUMN IF NOT EXISTS commercial_case_id uuid REFERENCES public.commercial_cases(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_calculations_commercial_case ON public.calculations(commercial_case_id) WHERE commercial_case_id IS NOT NULL;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS commercial_case_id uuid REFERENCES public.commercial_cases(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_events_commercial_case ON public.events(commercial_case_id) WHERE commercial_case_id IS NOT NULL;

ALTER TABLE public.order_form_submissions
  ADD COLUMN IF NOT EXISTS commercial_case_id uuid REFERENCES public.commercial_cases(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_order_submissions_commercial_case ON public.order_form_submissions(commercial_case_id) WHERE commercial_case_id IS NOT NULL;

-- 4) Aktivitetslogg utvides
ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS commercial_case_id uuid REFERENCES public.commercial_cases(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_activity_log_commercial_case
  ON public.activity_log(commercial_case_id, created_at DESC)
  WHERE commercial_case_id IS NOT NULL;

-- 5) Backfill-funksjon (manuell kjøring; oppretter saker KUN for aktive objekter)
CREATE OR REPLACE FUNCTION public.backfill_commercial_cases_for_active()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _from_leads int := 0;
  _from_calc_cases int := 0;
  _from_calculations int := 0;
  _from_events int := 0;
  _new_id uuid;
  r record;
BEGIN
  -- Leads som er åpne (ikke vunnet/tapt/konvertert) og uten sak
  FOR r IN
    SELECT l.id, l.company_id, COALESCE(l.title, l.subject, 'Lead') AS title,
           l.customer_id, l.contact_person_id, l.created_by
    FROM public.leads l
    WHERE l.commercial_case_id IS NULL
      AND COALESCE(l.deleted_at, NULL) IS NULL
      AND COALESCE(l.status, 'open') NOT IN ('won','lost','converted','closed')
  LOOP
    INSERT INTO public.commercial_cases (company_id, title, customer_id, contact_person_id, created_by, source, phase)
    VALUES (r.company_id, r.title, r.customer_id, r.contact_person_id, r.created_by, 'lead', 'lead')
    RETURNING id INTO _new_id;
    UPDATE public.leads SET commercial_case_id = _new_id WHERE id = r.id;
    _from_leads := _from_leads + 1;
  END LOOP;

  -- Kalkylesaker (calc_cases) som er aktive og uten sak
  FOR r IN
    SELECT cc.id, cc.company_id, COALESCE(cc.title, 'Kalkylesak') AS title, cc.created_by
    FROM public.calc_cases cc
    WHERE cc.commercial_case_id IS NULL
      AND cc.deleted_at IS NULL
  LOOP
    INSERT INTO public.commercial_cases (company_id, title, created_by, source, phase)
    VALUES (r.company_id, r.title, r.created_by, 'calc', 'calculating')
    RETURNING id INTO _new_id;
    UPDATE public.calc_cases SET commercial_case_id = _new_id WHERE id = r.id;
    _from_calc_cases := _from_calc_cases + 1;
  END LOOP;

  -- Frittstående kalkyler/tilbud (uten calc_case og uten commercial_case)
  FOR r IN
    SELECT c.id, c.company_id, COALESCE(c.project_title, 'Kalkyle/Tilbud') AS title,
           c.created_by, c.total_price
    FROM public.calculations c
    WHERE c.commercial_case_id IS NULL
      AND c.deleted_at IS NULL
      AND c.case_id IS NULL
  LOOP
    INSERT INTO public.commercial_cases (company_id, title, created_by, source, phase, value_estimate)
    VALUES (r.company_id, r.title, r.created_by, 'calc', 'calculating', r.total_price)
    RETURNING id INTO _new_id;
    UPDATE public.calculations SET commercial_case_id = _new_id WHERE id = r.id;
    _from_calculations := _from_calculations + 1;
  END LOOP;

  -- Aktive prosjekter (events) som ikke er ferdige/avlyst og uten sak
  FOR r IN
    SELECT e.id, e.company_id, COALESCE(e.title, 'Prosjekt') AS title, e.created_by
    FROM public.events e
    WHERE e.commercial_case_id IS NULL
      AND e.deleted_at IS NULL
      AND COALESCE(e.status, 'planned') NOT IN ('completed','cancelled','archived')
      AND COALESCE(e.project_type, 'project') = 'project'
  LOOP
    INSERT INTO public.commercial_cases (company_id, title, created_by, source, phase, won_at)
    VALUES (r.company_id, r.title, r.created_by, 'project', 'won', now())
    RETURNING id INTO _new_id;
    UPDATE public.events SET commercial_case_id = _new_id WHERE id = r.id;
    _from_events := _from_events + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'from_leads', _from_leads,
    'from_calc_cases', _from_calc_cases,
    'from_calculations', _from_calculations,
    'from_events', _from_events,
    'ran_at', now()
  );
END;
$$;