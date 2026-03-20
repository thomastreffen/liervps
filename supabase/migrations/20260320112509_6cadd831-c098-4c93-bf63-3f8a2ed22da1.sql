
-- Cleanup: null out invalid el-numbers on catalog products
-- Valid el-numbers are 4-8 digit numeric strings only.
-- Model codes like "IZMX40B3-V20F-1" were incorrectly stored as el-numbers.
-- This preserves all other data and is non-destructive.

UPDATE public.supplier_catalog_products
SET el_number = NULL
WHERE el_number IS NOT NULL
  AND el_number !~ '^\d{4,8}$';
