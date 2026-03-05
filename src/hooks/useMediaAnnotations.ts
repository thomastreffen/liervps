import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MediaAnnotation {
  id: string;
  post_id: string;
  file_id: string | null;
  annotated_file_id: string | null;
  annotation_json: any;
  linked_object_type: string | null;
  linked_object_ref: string | null;
  linked_object_label: string | null;
  doc_type: string | null;
  created_by: string | null;
  created_at: string;
}

export function useMediaAnnotations(threadId: string | null, postIds: string[]) {
  const [annotations, setAnnotations] = useState<MediaAnnotation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAnnotations = useCallback(async () => {
    if (!threadId || postIds.length === 0) { setAnnotations([]); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from("media_annotations")
      .select("*")
      .in("post_id", postIds)
      .order("created_at", { ascending: true });
    setAnnotations((data as MediaAnnotation[]) || []);
    setLoading(false);
  }, [threadId, postIds.join(",")]);

  useEffect(() => { fetchAnnotations(); }, [fetchAnnotations]);

  // Realtime
  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`media-annotations-${threadId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "media_annotations",
      }, () => fetchAnnotations())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId, fetchAnnotations]);

  const getAnnotationsForPost = useCallback((postId: string) => {
    return annotations.filter(a => a.post_id === postId);
  }, [annotations]);

  // Before/after pair detection
  const beforeAfterPairs = useMemo(() => {
    const pairs = new Set<string>();
    const byLabel = new Map<string, MediaAnnotation[]>();
    for (const a of annotations) {
      if (!a.linked_object_label || !a.doc_type) continue;
      const key = a.linked_object_label.toLowerCase();
      if (!byLabel.has(key)) byLabel.set(key, []);
      byLabel.get(key)!.push(a);
    }
    for (const [label, items] of byLabel) {
      const hasBefore = items.some(i => i.doc_type === "before");
      const hasAfter = items.some(i => i.doc_type === "after");
      if (hasBefore && hasAfter) {
        items.forEach(i => pairs.add(i.post_id));
      }
    }
    return pairs;
  }, [annotations]);

  return { annotations, loading, getAnnotationsForPost, beforeAfterPairs, refresh: fetchAnnotations };
}
