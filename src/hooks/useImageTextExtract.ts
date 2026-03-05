import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ImageTextExtract {
  id: string;
  post_id: string;
  file_id: string | null;
  extracted_text: string | null;
  detected_entities: any;
  created_at: string;
}

export function useImageTextExtract(postId: string | null) {
  const [extract, setExtract] = useState<ImageTextExtract | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchExtract = useCallback(async () => {
    if (!postId) return;
    const { data } = await (supabase as any)
      .from("image_text_extracts")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setExtract(data as ImageTextExtract | null);
  }, [postId]);

  useEffect(() => { fetchExtract(); }, [fetchExtract]);

  // Realtime for async OCR results
  useEffect(() => {
    if (!postId) return;
    const channel = supabase
      .channel(`img-text-${postId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "image_text_extracts",
      }, (payload: any) => {
        if (payload.new?.post_id === postId) setExtract(payload.new);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [postId]);

  const triggerOCR = useCallback(async (fileUrl: string) => {
    if (!postId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-image-text", {
        body: { post_id: postId, file_url: fileUrl },
      });
      if (error) console.warn("OCR failed:", error);
      if (data) setExtract(data);
    } catch (err) {
      console.warn("OCR invocation failed:", err);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  return { extract, loading, triggerOCR, refresh: fetchExtract };
}
