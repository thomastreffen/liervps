
-- Order lines table for Tripletex-compatible offer structure
CREATE TABLE public.order_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  calculation_id UUID NOT NULL REFERENCES public.calculations(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  line_type TEXT NOT NULL DEFAULT 'product' CHECK (line_type IN ('product', 'text')),
  description TEXT NOT NULL DEFAULT '',
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'stk',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC NOT NULL DEFAULT 0,
  vat_rate NUMERIC NOT NULL DEFAULT 25,
  total_ex_vat NUMERIC GENERATED ALWAYS AS (
    ROUND(quantity * unit_price * (1 - discount_percent / 100), 2)
  ) STORED,
  total_inc_vat NUMERIC GENERATED ALWAYS AS (
    ROUND(quantity * unit_price * (1 - discount_percent / 100) * (1 + vat_rate / 100), 2)
  ) STORED,
  suggested_by_ai BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage order lines"
  ON public.order_lines
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Index
CREATE INDEX idx_order_lines_calculation_id ON public.order_lines(calculation_id);
