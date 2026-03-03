import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Folder,
  FileText,
  Image,
  File,
  ChevronRight,
  ArrowLeft,
  Check,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CategoryTile {
  category_key: string;
  display_name: string;
  read_only: boolean;
  icon: string;
  folder_id: string | null;
  web_url: string | null;
  file_count: number;
  exists: boolean;
}

interface SharePointItem {
  id: string;
  name: string;
  isFolder: boolean;
  size: number;
  mimeType: string | null;
  webUrl: string;
  lastModified: string;
}

interface SharePointPickerProps {
  jobId: string;
  onSelect: (
    title: string,
    meta: { drive_id: string; item_id: string; web_url: string; preview_url?: string }
  ) => void;
}

function getFileIcon(item: SharePointItem) {
  if (item.isFolder) return <Folder className="h-5 w-5 text-primary shrink-0" />;
  const ext = item.name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext))
    return <Image className="h-5 w-5 text-green-600 shrink-0" />;
  if (ext === "pdf") return <FileText className="h-5 w-5 text-red-500 shrink-0" />;
  return <File className="h-5 w-5 text-muted-foreground shrink-0" />;
}

export function SharePointPicker({ jobId, onSelect }: SharePointPickerProps) {
  const [tiles, setTiles] = useState<CategoryTile[]>([]);
  const [loadingTiles, setLoadingTiles] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeCategoryName, setActiveCategoryName] = useState("");
  const [items, setItems] = useState<SharePointItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Load curated categories
  const loadTiles = useCallback(async () => {
    setLoadingTiles(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("sharepoint-list", {
        body: { job_id: jobId, view_mode: "curated" },
      });

      // Handle 409 (not linked) gracefully
      if (fnError) {
        const msg = typeof fnError === "object" && fnError.message ? fnError.message : String(fnError);
        if (msg.includes("409") || msg.includes("not_linked") || msg.includes("ikke koblet")) {
          setError("Prosjektet er ikke koblet til SharePoint ennå. Koble først via prosjektinnstillinger.");
          return;
        }
        setError(msg);
        return;
      }
      if (data?.error) {
        if (data.step === "not_linked" || data.error.includes("ikke koblet")) {
          setError("Prosjektet er ikke koblet til SharePoint ennå. Koble først via prosjektinnstillinger.");
          return;
        }
        setError(data.error);
        return;
      }
      setTiles(data?.tiles || []);
    } catch (err: any) {
      const msg = err?.message || "Kunne ikke laste SharePoint-kategorier";
      if (msg.includes("409") || msg.includes("not_linked")) {
        setError("Prosjektet er ikke koblet til SharePoint ennå.");
        return;
      }
      setError(msg);
    } finally {
      setLoadingTiles(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadTiles();
  }, [loadTiles]);

  // Load files in a category
  const loadCategoryFiles = useCallback(
    async (categoryKey: string) => {
      setLoadingItems(true);
      try {
        const { data } = await supabase.functions.invoke("sharepoint-list", {
          body: { job_id: jobId, category_key: categoryKey },
        });
        setItems(data?.items || []);
      } catch {
        setItems([]);
      } finally {
        setLoadingItems(false);
      }
    },
    [jobId]
  );

  const handleSelectFile = (item: SharePointItem) => {
    onSelect(item.name, {
      drive_id: "", // populated from edge function context
      item_id: item.id,
      web_url: item.webUrl,
    });
  };

  if (loadingTiles) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-2">
        <AlertTriangle className="h-6 w-6 text-destructive mx-auto" />
        <p className="text-sm text-destructive">{error}</p>
        <p className="text-xs text-muted-foreground">
          Sjekk at prosjektet er koblet til SharePoint i prosjektinnstillinger.
        </p>
      </div>
    );
  }

  // Inside a category – show files to pick
  if (activeCategory) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => {
            setActiveCategory(null);
            setItems([]);
          }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Alle kategorier
        </button>

        <h3 className="text-lg font-semibold text-foreground">{activeCategoryName}</h3>

        {loadingItems ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Ingen filer i denne kategorien.</p>
        ) : (
          <div className="space-y-1">
            {items
              .filter((i) => !i.isFolder)
              .map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectFile(item)}
                  className={cn(
                    "flex items-center gap-3 w-full rounded-lg border border-border/40 bg-card px-4 py-3",
                    "text-left hover:border-primary/40 hover:bg-primary/[0.02] transition-colors"
                  )}
                >
                  {getFileIcon(item)}
                  <span className="flex-1 text-sm font-medium text-foreground truncate">
                    {item.name}
                  </span>
                  <Check className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100" />
                </button>
              ))}
          </div>
        )}
      </div>
    );
  }

  // Category tiles
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Velg SharePoint-kategori</h3>

      {tiles.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Ingen SharePoint-kategorier konfigurert for dette prosjektet.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tiles.map((tile) => (
            <button
              key={tile.category_key}
              onClick={() => {
                setActiveCategory(tile.category_key);
                setActiveCategoryName(tile.display_name);
                loadCategoryFiles(tile.category_key);
              }}
              className={cn(
                "flex items-center gap-4 rounded-xl border border-border/40 bg-card p-4",
                "text-left transition-all duration-200",
                "hover:shadow-md hover:border-border/70",
                !tile.exists && "opacity-50"
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/8 text-primary shrink-0">
                <Folder className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-medium text-foreground truncate">{tile.display_name}</h4>
                <p className="text-xs text-muted-foreground">
                  {tile.exists ? `${tile.file_count} filer` : "Ikke opprettet"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
