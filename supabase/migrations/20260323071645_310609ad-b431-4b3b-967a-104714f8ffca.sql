-- Step 1: Create a temp table mapping duplicate IDs to keeper IDs
-- Keeper = the row with best identifiers (el_number not null > ean not null > earliest created)
CREATE TEMP TABLE _dedup_map AS
WITH ranked AS (
  SELECT id, name, brand, company_id, el_number, ean, created_at,
    ROW_NUMBER() OVER (
      PARTITION BY company_id, name, COALESCE(brand, '')
      ORDER BY 
        (CASE WHEN el_number IS NOT NULL THEN 0 ELSE 1 END),
        (CASE WHEN ean IS NOT NULL THEN 0 ELSE 1 END),
        created_at ASC,
        id ASC
    ) as rn
  FROM supplier_catalog_products
  WHERE is_active = true
),
keepers AS (
  SELECT id as keeper_id, name, brand, company_id
  FROM ranked WHERE rn = 1
),
dupes AS (
  SELECT r.id as dupe_id, k.keeper_id
  FROM ranked r
  JOIN keepers k ON k.company_id = r.company_id 
    AND k.name = r.name 
    AND COALESCE(k.brand, '') = COALESCE(r.brand, '')
  WHERE r.rn > 1
)
SELECT dupe_id, keeper_id FROM dupes;

-- Step 2: Repoint supplier_products from dupe to keeper
UPDATE supplier_products sp
SET product_id = dm.keeper_id
FROM _dedup_map dm
WHERE sp.product_id = dm.dupe_id;

-- Step 3: Delete price_cache for dupes
DELETE FROM product_price_cache
WHERE product_id IN (SELECT dupe_id FROM _dedup_map);

-- Step 4: Soft-delete duplicate catalog products
UPDATE supplier_catalog_products
SET is_active = false, updated_at = now()
WHERE id IN (SELECT dupe_id FROM _dedup_map);

DROP TABLE _dedup_map;