-- Fase 3: Commercial cases blir CRM-hjerte
-- 1) Auto-opprett sak ved insert i leads/calc_cases/calculations når customer finnes og sak ikke er satt

CREATE OR REPLACE FUNCTION public.auto_create_commercial_case_for_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_id uuid;
BEGIN
  IF NEW.commercial_case_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.commercial_cases (company_id, title, customer_id, contact_person_id, created_by, source, phase)
  VALUES (
    NEW.company_id,
    COALESCE(NEW.title, NEW.subject, 'Lead'),
    NEW.customer_id,
    NEW.contact_person_id,
    NEW.created_by,
    'lead',
    'lead'
  )
  RETURNING id INTO _new_id;
  NEW.commercial_case_id := _new_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_auto_commercial_case ON public.leads;
CREATE TRIGGER trg_leads_auto_commercial_case
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_commercial_case_for_lead();


CREATE OR REPLACE FUNCTION public.auto_create_commercial_case_for_calc_case()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_id uuid;
  _customer_id uuid;
BEGIN
  IF NEW.commercial_case_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  -- calc_cases har ikke alltid customer_id direkte; sjekk om kolonnen finnes via dynamic lookup
  BEGIN
    EXECUTE 'SELECT ($1).customer_id' INTO _customer_id USING NEW;
  EXCEPTION WHEN undefined_column THEN
    _customer_id := NULL;
  END;
  IF _customer_id IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.commercial_cases (company_id, title, customer_id, created_by, source, phase)
  VALUES (NEW.company_id, COALESCE(NEW.title, 'Kalkylesak'), _customer_id, NEW.created_by, 'calc', 'calculating')
  RETURNING id INTO _new_id;
  NEW.commercial_case_id := _new_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calc_cases_auto_commercial_case ON public.calc_cases;
CREATE TRIGGER trg_calc_cases_auto_commercial_case
  BEFORE INSERT ON public.calc_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_commercial_case_for_calc_case();


CREATE OR REPLACE FUNCTION public.auto_create_commercial_case_for_calculation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_id uuid;
  _case_commercial_id uuid;
BEGIN
  IF NEW.commercial_case_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  -- Hvis kalkylen er knyttet til en calc_case, arver den dens commercial_case
  IF NEW.case_id IS NOT NULL THEN
    SELECT commercial_case_id INTO _case_commercial_id
    FROM public.calc_cases WHERE id = NEW.case_id;
    IF _case_commercial_id IS NOT NULL THEN
      NEW.commercial_case_id := _case_commercial_id;
      RETURN NEW;
    END IF;
  END IF;
  -- Revisjoner arver fra rot
  IF NEW.parent_offer_id IS NOT NULL THEN
    SELECT commercial_case_id INTO _case_commercial_id
    FROM public.calculations WHERE id = NEW.parent_offer_id;
    IF _case_commercial_id IS NOT NULL THEN
      NEW.commercial_case_id := _case_commercial_id;
      RETURN NEW;
    END IF;
  END IF;
  -- Frittstående: krever customer
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.commercial_cases (company_id, title, customer_id, contact_person_id, created_by, source, phase, value_estimate)
  VALUES (
    NEW.company_id,
    COALESCE(NEW.project_title, 'Kalkyle/Tilbud'),
    NEW.customer_id,
    NEW.contact_person_id,
    NEW.created_by,
    'calc',
    'calculating',
    NEW.total_price
  )
  RETURNING id INTO _new_id;
  NEW.commercial_case_id := _new_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calculations_auto_commercial_case ON public.calculations;
CREATE TRIGGER trg_calculations_auto_commercial_case
  BEFORE INSERT ON public.calculations
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_commercial_case_for_calculation();


-- 2) RPC for trygg CRM-oppdatering med activity-logg
CREATE OR REPLACE FUNCTION public.update_commercial_case_crm(
  _case_id uuid,
  _phase text DEFAULT NULL,
  _owner_user_id uuid DEFAULT NULL,
  _next_step text DEFAULT NULL,
  _next_step_due_at timestamptz DEFAULT NULL,
  _value_estimate numeric DEFAULT NULL,
  _probability_pct numeric DEFAULT NULL,
  _expected_close_date date DEFAULT NULL,
  _description text DEFAULT NULL
)
RETURNS public.commercial_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing public.commercial_cases;
  _updated public.commercial_cases;
  _summary text;
  _changes text[] := ARRAY[]::text[];
BEGIN
  SELECT * INTO _existing FROM public.commercial_cases WHERE id = _case_id AND deleted_at IS NULL;
  IF _existing.id IS NULL THEN
    RAISE EXCEPTION 'Commercial case not found: %', _case_id;
  END IF;

  IF NOT public.user_has_company_access(auth.uid(), _existing.company_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.commercial_cases SET
    phase              = COALESCE(_phase, phase),
    owner_user_id      = COALESCE(_owner_user_id, owner_user_id),
    next_step          = COALESCE(_next_step, next_step),
    next_step_due_at   = COALESCE(_next_step_due_at, next_step_due_at),
    value_estimate     = COALESCE(_value_estimate, value_estimate),
    probability_pct    = COALESCE(_probability_pct, probability_pct),
    expected_close_date = COALESCE(_expected_close_date, expected_close_date),
    description        = COALESCE(_description, description),
    won_at             = CASE WHEN _phase = 'won' AND _existing.won_at IS NULL THEN now() ELSE won_at END,
    lost_at            = CASE WHEN _phase = 'lost' AND _existing.lost_at IS NULL THEN now() ELSE lost_at END,
    updated_at         = now()
  WHERE id = _case_id
  RETURNING * INTO _updated;

  -- Bygg change-summary
  IF _phase IS NOT NULL AND _phase IS DISTINCT FROM _existing.phase THEN
    _changes := array_append(_changes, 'fase: ' || COALESCE(_existing.phase,'—') || ' → ' || _phase);
  END IF;
  IF _owner_user_id IS NOT NULL AND _owner_user_id IS DISTINCT FROM _existing.owner_user_id THEN
    _changes := array_append(_changes, 'ansvarlig endret');
  END IF;
  IF _next_step IS NOT NULL AND _next_step IS DISTINCT FROM _existing.next_step THEN
    _changes := array_append(_changes, 'neste steg oppdatert');
  END IF;
  IF _value_estimate IS NOT NULL AND _value_estimate IS DISTINCT FROM _existing.value_estimate THEN
    _changes := array_append(_changes, 'verdi oppdatert');
  END IF;

  IF array_length(_changes, 1) > 0 THEN
    _summary := array_to_string(_changes, ', ');
    INSERT INTO public.activity_log (
      entity_type, entity_id, commercial_case_id,
      action, type, title, description,
      performed_by, visibility, metadata
    ) VALUES (
      'commercial_case', _case_id, _case_id,
      'crm_update', 'status_change', 'Sak oppdatert', _summary,
      auth.uid(), 'internal',
      jsonb_build_object('summary', _summary)
    );
  END IF;

  RETURN _updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_commercial_case_crm(uuid, text, uuid, text, timestamptz, numeric, numeric, date, text) TO authenticated;