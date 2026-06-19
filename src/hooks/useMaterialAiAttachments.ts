import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MaterialAiAttachment {
  name: string;
  url?: string | null;
  path?: string | null;
  bucket?: string | null;
  mime?: string | null;
}

/**
 * Resolves attachments available to the AI material assistant for a given
 * job (events.attachments) or order (order_form_submission_attachments).
 */
export function useMaterialAiAttachments(opts: {
  jobId?: string | null;
  orderId?: string | null;
}) {
  const { jobId, orderId } = opts;
  const [attachments, setAttachments] = useState<MaterialAiAttachment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        if (jobId) {
          const { data } = await supabase
            .from("events")
            .select("attachments")
            .eq("id", jobId)
            .maybeSingle();
          const raw = Array.isArray((data as { attachments?: unknown } | null)?.attachments)
            ? ((data as { attachments?: { name: string; url: string }[] }).attachments ?? [])
            : [];
          if (!cancelled) {
            setAttachments(
              raw.map((a) => ({
                name: a.name,
                url: a.url,
                mime: /\.pdf$/i.test(a.name) ? "application/pdf" : undefined,
              })),
            );
          }
        } else if (orderId) {
          const { data } = await supabase
            .from("order_form_submission_attachments")
            .select("file_name, original_filename, file_path, mime_type")
            .eq("submission_id", orderId)
            .is("deleted_at", null);
          if (!cancelled) {
            setAttachments(
              (data ?? []).map((a) => ({
                name: a.original_filename ?? a.file_name,
                path: a.file_path,
                bucket: "order-form-attachments",
                mime: a.mime_type,
              })),
            );
          }
        } else if (!cancelled) {
          setAttachments([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [jobId, orderId]);

  return { attachments, loading };
}
