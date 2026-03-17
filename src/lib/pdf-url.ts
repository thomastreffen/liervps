import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves a PDF URL for an offer.
 * If the stored value is a storage path (no protocol), generates a fresh signed URL.
 * If it's already a full URL (legacy), returns it as-is.
 */
export async function getOfferPdfUrl(storedUrl: string): Promise<string | null> {
  if (!storedUrl) return null;

  // Legacy: already a full URL
  if (storedUrl.startsWith("http")) {
    // Try to extract storage path from legacy public URL pattern
    const publicMatch = storedUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/calculation-attachments\/(.+?)(?:\?|$)/);
    if (publicMatch) {
      const path = decodeURIComponent(publicMatch[1]);
      const { data, error } = await supabase.storage
        .from("calculation-attachments")
        .createSignedUrl(path, 3600);
      if (!error && data?.signedUrl) return data.signedUrl;
    }
    // If extraction failed, return original (may not work for private bucket)
    return storedUrl;
  }

  // New format: plain storage path
  const { data, error } = await supabase.storage
    .from("calculation-attachments")
    .createSignedUrl(storedUrl, 3600);
  if (error || !data?.signedUrl) {
    console.error("Failed to create signed URL for", storedUrl, error);
    return null;
  }
  return data.signedUrl;
}
