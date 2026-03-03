import { useState, useEffect } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, File } from "lucide-react";

interface FileHoverPreviewProps {
  children: React.ReactNode;
  name: string;
  mimeType: string | null;
  storageUrl?: string | null;
  bucket?: string | null;
  filePath?: string | null;
}

function isImageMime(mime: string | null, name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return !!(mime?.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext));
}

function buildProxyUrl(bucket: string, filePath: string): string {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const params = new URLSearchParams({ bucket, path: filePath });
  return `https://${projectId}.supabase.co/functions/v1/file-preview?${params.toString()}`;
}

function extractStorageInfo(url: string): { bucket: string; path: string } | null {
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
  if (!match) return null;
  return { bucket: match[1], path: decodeURIComponent(match[2]) };
}

export function FileHoverPreview({ children, name, mimeType, storageUrl, bucket, filePath }: FileHoverPreviewProps) {
  if (!isImageMime(mimeType, name)) {
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
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      let resolvedBucket = bucket;
      let resolvedPath = filePath;

      if (!resolvedBucket || !resolvedPath) {
        if (storageUrl) {
          const info = extractStorageInfo(storageUrl);
          if (info) {
            resolvedBucket = info.bucket;
            resolvedPath = info.path;
          }
        }
      }

      if (resolvedBucket && resolvedPath && token) {
        try {
          const proxyUrl = buildProxyUrl(resolvedBucket, resolvedPath);
          const response = await fetch(proxyUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            if (!cancelled) { setUrl(blobUrl); setLoading(false); }
            return;
          }
        } catch {
          // fall through
        }
      }

      // Fallback to direct URL
      if (!cancelled) { setUrl(storageUrl || null); setLoading(false); }
    })();
    return () => {
      cancelled = true;
      if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
    };
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
