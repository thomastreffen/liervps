
-- Restore the two accidentally deleted projects (3rd time)
UPDATE events SET deleted_at = NULL, deleted_by = NULL
WHERE id IN ('cf4363bf-fb49-4980-9e27-b8cd4475263c', '6d13dc06-470e-4b6b-a119-bc3a5e71de96')
  AND deleted_at IS NOT NULL;
