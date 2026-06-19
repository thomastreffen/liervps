ALTER TABLE public.material_list_items
  ADD COLUMN IF NOT EXISTS ai_source_type text,
  ADD COLUMN IF NOT EXISTS ai_source_file text,
  ADD COLUMN IF NOT EXISTS ai_source_page text,
  ADD COLUMN IF NOT EXISTS ai_source_label text,
  ADD COLUMN IF NOT EXISTS ai_component_reference text,
  ADD COLUMN IF NOT EXISTS manufacturer text;