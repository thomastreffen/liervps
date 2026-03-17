
-- Add soft-delete columns to tables that are missing them

-- cases
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;

-- customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;

-- customer_accounts
ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;

-- technicians
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;
