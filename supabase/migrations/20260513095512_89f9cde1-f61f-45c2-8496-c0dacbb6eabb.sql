
-- Add kind column with valid values for handbook taxonomy
ALTER TABLE public.hms_handbooks
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'hms_handbook';

-- Backfill kind from legacy handbook_type if present
UPDATE public.hms_handbooks
SET kind = CASE
  WHEN handbook_type = 'employee' THEN 'employee_handbook'
  WHEN handbook_type = 'work' THEN 'employee_handbook'
  WHEN handbook_type = 'procedure' THEN 'procedure'
  WHEN handbook_type = 'safety_rule' THEN 'safety_rule'
  ELSE 'hms_handbook'
END
WHERE kind = 'hms_handbook' AND handbook_type IS NOT NULL;

-- Idempotent CHECK constraint
ALTER TABLE public.hms_handbooks DROP CONSTRAINT IF EXISTS hms_handbooks_kind_check;
ALTER TABLE public.hms_handbooks
  ADD CONSTRAINT hms_handbooks_kind_check
  CHECK (kind IN ('hms_handbook', 'employee_handbook', 'procedure', 'safety_rule'));

-- Prevent duplicate seeds: one of each kind per company (only for active rows)
CREATE UNIQUE INDEX IF NOT EXISTS uq_hms_handbooks_company_kind_title
  ON public.hms_handbooks (company_id, kind, title)
  WHERE deleted_at IS NULL;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
