ALTER TABLE public.material_list_items ADD COLUMN IF NOT EXISTS unit_price numeric;
ALTER TABLE public.material_products ADD COLUMN IF NOT EXISTS unit_price numeric;