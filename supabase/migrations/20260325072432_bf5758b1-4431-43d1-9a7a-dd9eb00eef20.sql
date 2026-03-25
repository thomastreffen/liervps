-- Drop all supplier/product/purchase module tables in correct order (respecting FK dependencies)

-- First drop tables that reference others
DROP TABLE IF EXISTS public.purchase_order_lines CASCADE;
DROP TABLE IF EXISTS public.purchase_orders CASCADE;
DROP TABLE IF EXISTS public.product_import_rows CASCADE;
DROP TABLE IF EXISTS public.product_import_jobs CASCADE;
DROP TABLE IF EXISTS public.product_price_cache CASCADE;
DROP TABLE IF EXISTS public.supplier_prices CASCADE;
DROP TABLE IF EXISTS public.supplier_price_history CASCADE;
DROP TABLE IF EXISTS public.supplier_products CASCADE;
DROP TABLE IF EXISTS public.supplier_catalog_products CASCADE;
DROP TABLE IF EXISTS public.supplier_secrets CASCADE;
DROP TABLE IF EXISTS public.supplier_integrations CASCADE;
DROP TABLE IF EXISTS public.suppliers CASCADE;

-- Drop related enums
DROP TYPE IF EXISTS public.product_import_job_status CASCADE;
DROP TYPE IF EXISTS public.product_import_job_type CASCADE;
DROP TYPE IF EXISTS public.product_import_row_status CASCADE;
DROP TYPE IF EXISTS public.supplier_connection_status CASCADE;
DROP TYPE IF EXISTS public.supplier_protocol CASCADE;
DROP TYPE IF EXISTS public.supplier_sync_frequency CASCADE;

-- Drop related sequences
DROP SEQUENCE IF EXISTS public.purchase_order_number_seq CASCADE;

-- Drop related function
DROP FUNCTION IF EXISTS public.generate_purchase_order_number() CASCADE;
DROP FUNCTION IF EXISTS public.can_manage_supplier_integrations(uuid) CASCADE;