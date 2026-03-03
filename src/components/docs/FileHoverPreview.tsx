import { useState, useEffect } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, File } from "lucide-react";

interface FileHoverPreviewProps {
  children: React.ReactNode;
  name: string;
  mimeType: string | null;
  /** Either a storage path or public URL */
  storageUrl?: string | null;
  bucket?: string | null;
  filePath?: string | null;
}

function isPreviewableMime(mime: string | null, name: string): "image" | "pdf" | null {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (mime?.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "image";
  if (mime?.includes("pdf") || ext === "pdf") return "pdf";
  return null;
}

export function FileHoverPreview({ children, name, mimeType, storageUrl, bucket, filePath }: FileHoverPreviewProps) {
  const previewType = isPreviewableMime(mimeType, name);
  
  // Only show hover preview for images
  if (previewType !== "image") {
    return <>{children}</>;
  }

  return (
    <HoverCard openDelay={400} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="right" className="w-64 p-2" align="start">
        <HoverImagePreview
          bucket={bucket}
          filePath={filePath}
          storageUrl={storageUrl}
          name={name}
        />
      </HoverCardContent>
    </HoverCard>
  );
}

function HoverImagePreview({ bucket, filePath, storageUrl, name }: { bucket?: string | null; filePath?: string | null; storageUrl?: string | null; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let result: string | null = null;
      if (bucket && filePath) {
        const { data } = await supabase.storage
          .from(bucket)
          .createSignedUrl(filePath, 300, { download: false });
        result = data?.signedUrl || storageUrl || null;
      } else if (storageUrl) {
        // Try to extract and sign
        const match = storageUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)/);
        if (match) {
          const { data } = await supabase.storage
            .from(match[1])
            .createSignedUrl(decodeURIComponent(match[2]), 300, { download: false });
          result = data?.signedUrl || storageUrl;
        } else {
          result = storageUrl;
        }
      }
      if (!cancelled) { setUrl(result); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [bucket, filePath, storageUrl]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        <File className="h-8 w-8 opacity-30" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      className="w-full h-auto max-h-48 object-contain rounded"
    />
  );
}
