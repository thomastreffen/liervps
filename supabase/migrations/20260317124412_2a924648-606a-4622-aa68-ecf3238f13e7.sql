
-- Add customer_id FK to calculations for linking offers to customer entities
ALTER TABLE public.calculations
ADD COLUMN customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX idx_calculations_customer_id ON public.calculations(customer_id);
