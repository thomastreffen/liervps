import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CatalogObject {
  id: string;
  project_id: string;
  object_type: string;
  label: string;
  synonyms: string[];
  meta: any;
  created_at: string;
}

export function useObjectCatalog(projectId: string | null) {
  const [objects, setObjects] = useState<CatalogObject[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchObjects = useCallback(async () => {
    if (!projectId) { setObjects([]); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from("objects_catalog")
      .select("*")
      .eq("project_id", projectId)
      .order("label", { ascending: true });
    setObjects((data as CatalogObject[]) || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchObjects(); }, [fetchObjects]);

  // Realtime
  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`obj-catalog-${projectId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "objects_catalog",
        filter: `project_id=eq.${projectId}`,
      }, () => fetchObjects())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId, fetchObjects]);

  const addObject = useCallback(async (objectType: string, label: string, synonyms: string[] = []) => {
    if (!projectId) return;
    const { error } = await (supabase as any).from("objects_catalog").insert({
      project_id: projectId,
      object_type: objectType,
      label,
      synonyms,
    });
    if (!error) fetchObjects();
    return error;
  }, [projectId, fetchObjects]);

  return { objects, loading, addObject, refresh: fetchObjects };
}
