
-- Project-level SharePoint category mappings
CREATE TABLE public.project_sharepoint_category_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  category_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  folder_id TEXT NOT NULL,
  folder_path TEXT NOT NULL,
  folder_web_url TEXT,
  drive_id TEXT NOT NULL,
  site_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, category_key)
);

ALTER TABLE public.project_sharepoint_category_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view project mappings"
ON public.project_sharepoint_category_mappings
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can manage project mappings"
ON public.project_sharepoint_category_mappings
FOR ALL TO authenticated
USING (public.check_permission_v2(auth.uid(), 'admin.manage_users') OR public.is_project_admin(auth.uid(), project_id))
WITH CHECK (public.check_permission_v2(auth.uid(), 'admin.manage_users') OR public.is_project_admin(auth.uid(), project_id));

CREATE TRIGGER update_project_sp_mappings_updated_at
BEFORE UPDATE ON public.project_sharepoint_category_mappings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
