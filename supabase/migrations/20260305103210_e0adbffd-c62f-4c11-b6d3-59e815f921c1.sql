
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Objects catalog per project
CREATE TABLE public.objects_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  object_type text NOT NULL DEFAULT 'other',
  label text NOT NULL,
  synonyms text[] DEFAULT '{}',
  meta jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX idx_objects_catalog_project_type ON public.objects_catalog(project_id, object_type);
CREATE INDEX idx_objects_catalog_label_trgm ON public.objects_catalog USING gin (label gin_trgm_ops);
ALTER TABLE public.objects_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view objects in accessible projects" ON public.objects_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert objects" ON public.objects_catalog FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update objects" ON public.objects_catalog FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Drawing assets
CREATE TABLE public.drawing_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  file_id uuid,
  drawing_type text DEFAULT 'other',
  extracted_text text,
  key_entities jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.drawing_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view drawing assets" ON public.drawing_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert drawing assets" ON public.drawing_assets FOR INSERT TO authenticated WITH CHECK (true);

-- Image text extracts (OCR results)
CREATE TABLE public.image_text_extracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  file_id uuid,
  extracted_text text,
  detected_entities jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.image_text_extracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view image text extracts" ON public.image_text_extracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert image text extracts" ON public.image_text_extracts FOR INSERT TO authenticated WITH CHECK (true);

-- Media annotations
CREATE TABLE public.media_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  file_id uuid,
  annotated_file_id uuid,
  annotation_json jsonb NOT NULL DEFAULT '{}',
  linked_object_type text,
  linked_object_ref text,
  linked_object_label text,
  doc_type text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_media_annotations_post ON public.media_annotations(post_id);
CREATE INDEX idx_media_annotations_doc_type ON public.media_annotations(doc_type);
ALTER TABLE public.media_annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view media annotations" ON public.media_annotations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert media annotations" ON public.media_annotations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update media annotations" ON public.media_annotations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.media_annotations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.image_text_extracts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.objects_catalog;
