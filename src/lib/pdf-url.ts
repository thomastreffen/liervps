import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves a PDF URL for an offer.
 * If the stored value is a storage path (no protocol), generates a fresh signed URL.
 * If it's already a full URL (legacy), extracts the path and generates a fresh signed URL.
 */
export async function getOfferPdfUrl(storedUrl: string): Promise<string | null> {
  if (!storedUrl) return null;

  let storagePath: string;

  if (storedUrl.startsWith("http")) {
    // Legacy: extract storage path from full URL
    const publicMatch = storedUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/calculation-attachments\/(.+?)(?:\?|$)/);
    if (publicMatch) {
      storagePath = decodeURIComponent(publicMatch[1]);
    } else {
      return storedUrl;
    }
  } else {
    storagePath = storedUrl;
  }

  const { data, error } = await supabase.storage
    .from("calculation-attachments")
    .createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) {
    console.error("Failed to create signed URL for", storagePath, error);
    return null;
  }
  return data.signedUrl;
}

/**
 * Fetches a PDF from a signed URL and returns a blob: URL suitable for iframe embedding.
 * This avoids X-Frame-Options blocking from Supabase storage.
 */
export async function fetchPdfAsBlobUrl(signedUrl: string): Promise<string> {
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/**
 * Given a Supabase storage signed URL for a PDF, fetches it and returns a blob URL for iframe use.
 * Combines getOfferPdfUrl + fetchPdfAsBlobUrl for convenience.
 */
export async function getOfferPdfBlobUrl(storedUrl: string): Promise<string | null> {
  const signedUrl = await getOfferPdfUrl(storedUrl);
  if (!signedUrl) return null;
  return fetchPdfAsBlobUrl(signedUrl);
}
