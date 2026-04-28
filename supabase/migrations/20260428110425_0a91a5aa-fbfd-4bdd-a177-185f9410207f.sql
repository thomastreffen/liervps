-- 1) Nye kolonner
ALTER TABLE public.calculations
  ADD COLUMN IF NOT EXISTS source_kind text
    CHECK (source_kind IN ('calc_case','calculation')),
  ADD COLUMN IF NOT EXISTS parent_offer_id uuid REFERENCES public.calculations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1;

-- 2) Unik regel: ett aktivt tilbudsrot (versjon 1, ikke slettet, ikke revisjon) per kilde
-- Vi tillater calc_case → bruker source_case_id; calculation → bruker source_case_item_id
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_offer_per_calc_case
  ON public.calculations (source_case_id)
  WHERE source_kind = 'calc_case'
    AND parent_offer_id IS NULL
    AND deleted_at IS NULL
    AND source_case_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_offer_per_calculation
  ON public.calculations (source_case_item_id)
  WHERE source_kind = 'calculation'
    AND parent_offer_id IS NULL
    AND deleted_at IS NULL
    AND source_case_item_id IS NOT NULL;

-- 3) Indekser for raskt oppslag
CREATE INDEX IF NOT EXISTS idx_calculations_parent_offer
  ON public.calculations(parent_offer_id) WHERE parent_offer_id IS NOT NULL;

-- 4) Hjelpefunksjon: returnerer aktivt tilbud (rot) for en kilde
CREATE OR REPLACE FUNCTION public.get_active_offer_for_source(
  _source_kind text,
  _source_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.calculations
  WHERE source_kind = _source_kind
    AND parent_offer_id IS NULL
    AND deleted_at IS NULL
    AND (
      (_source_kind = 'calc_case'    AND source_case_id      = _source_id) OR
      (_source_kind = 'calculation' AND source_case_item_id = _source_id)
    )
  LIMIT 1;
$$;