import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Folder,
  ChevronRight,
  ArrowLeft,
  Check,
  AlertTriangle,
  ExternalLink,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SpFolder {
  id: string;
  name: string;
  web_url: string;
  child_count: number;
}

interface CategoryMapping {
  category_key: string;
  display_name: string;
  folder_id: string | null;
  folder_path: string | null;
  folder_web_url: string | null;
  mapping_source: "project" | "company" | null;
  exists: boolean;
  file_count: number;
}

interface SharePointCategoryMapperProps {
  jobId: string;
  projectId: string;
  driveId: string;
  onClose: () => void;
  onMappingChanged: () => void;
}

export function SharePointCategoryMapper({
  jobId,
  projectId,
  driveId,
  onClose,
  onMappingChanged,
}: SharePointCategoryMapperProps) {
  const [categories, setCategories] = useState<CategoryMapping[]>([]);
  const [loading, setLoading] = useState(true);

  // Folder picker state
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const [pickerFolders, setPickerFolders] = useState<SpFolder[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerBreadcrumb, setPickerBreadcrumb] = useState<{ id: string; name: string }[]>([]);

  // Auto-detect state
  const [suggestions, setSuggestions] = useState<Map<string, SpFolder>>(new Map());
  const [detectingAuto, setDetectingAuto] = useState(false);

  // Load current tiles (which include mapping info)
  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("sharepoint-list", {
        body: { job_id: jobId, view_mode: "curated" },
      });
      const tiles = (data?.tiles || []).map((t: any) => ({
        category_key: t.category_key,
        display_name: t.display_name,
        folder_id: t.folder_id,
        folder_path: t.folder_path || null,
        folder_web_url: t.web_url,
        mapping_source: t.mapping_source || "company",
        exists: t.exists,
        file_count: t.file_count,
      }));
      setCategories(tiles);
    } catch {
      toast.error("Kunne ikke laste kategorier");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  // Auto-detect: scan root folder and suggest
  const handleAutoDetect = useCallback(async () => {
    setDetectingAuto(true);
    try {
      const { data } = await supabase.functions.invoke("sharepoint-list", {
        body: { job_id: jobId, view_mode: "auto_detect" },
      });
      const folders: SpFolder[] = data?.folders || [];
      const newSuggestions = new Map<string, SpFolder>();

      const patterns: Record<string, RegExp[]> = {
        images: [/bilde/i, /foto/i, /image/i, /anleggsbilder/i],
        reports: [/rapport/i, /service/i, /report/i],
        deviations: [/avvik/i, /deviation/i],
        drawings: [/tegning/i, /drawing/i],
        other: [/tavle/i, /board/i, /diverse/i, /annet/i],
      };

      for (const folder of folders) {
        for (const [catKey, regexes] of Object.entries(patterns)) {
          if (regexes.some(r => r.test(folder.name))) {
            if (!newSuggestions.has(catKey)) {
              newSuggestions.set(catKey, folder);
            }
          }
        }
      }

      setSuggestions(newSuggestions);
      if (newSuggestions.size === 0) {
        toast.info("Ingen automatiske forslag funnet. Velg mapper manuelt.");
      } else {
        toast.success(`${newSuggestions.size} forslag funnet`);
      }
    } catch {
      toast.error("Auto-detektering feilet");
    } finally {
      setDetectingAuto(false);
    }
  }, [jobId]);

  // Browse folders for picker
  const loadPickerFolders = useCallback(async (folderId?: string) => {
    setPickerLoading(true);
    try {
      const { data } = await supabase.functions.invoke("sharepoint-list", {
        body: {
          job_id: jobId,
          view_mode: "raw",
          folder_id: folderId || undefined,
        },
      });
      const items = (data?.items || []).filter((i: any) => i.isFolder);
      setPickerFolders(items.map((i: any) => ({
        id: i.id,
        name: i.name,
        web_url: i.webUrl,
        child_count: i.childCount || 0,
      })));
    } catch {
      setPickerFolders([]);
    } finally {
      setPickerLoading(false);
    }
  }, [jobId]);

  // Open folder picker for a category
  const startPicking = (categoryKey: string) => {
    setPickingFor(categoryKey);
    setPickerBreadcrumb([]);
    setPickerFolders([]);
    loadPickerFolders(); // Load root
  };

  const navigatePickerFolder = (folder: SpFolder) => {
    setPickerBreadcrumb(prev => [...prev, { id: folder.id, name: folder.name }]);
    loadPickerFolders(folder.id);
  };

  const navigatePickerBreadcrumb = (index: number) => {
    const target = pickerBreadcrumb[index];
    setPickerBreadcrumb(prev => prev.slice(0, index + 1));
    loadPickerFolders(target.id);
  };

  const navigatePickerRoot = () => {
    setPickerBreadcrumb([]);
    loadPickerFolders();
  };

  // Save mapping
  const saveMapping = async (categoryKey: string, folder: SpFolder) => {
    const cat = categories.find(c => c.category_key === categoryKey);
    try {
      const { data: session } = await supabase.auth.getSession();
      // Build the breadcrumb path
      const pathParts = pickerBreadcrumb.map(b => b.name);
      pathParts.push(folder.name);
      const folderPath = pathParts.join("/");

      // Upsert project mapping
      const { error } = await supabase
        .from("project_sharepoint_category_mappings" as any)
        .upsert({
          project_id: projectId,
          category_key: categoryKey,
          display_name: cat?.display_name || categoryKey,
          folder_id: folder.id,
          folder_path: folderPath,
          folder_web_url: folder.web_url,
          drive_id: driveId,
        }, { onConflict: "project_id,category_key" });

      if (error) throw error;

      toast.success(`"${cat?.display_name || categoryKey}" mappet til "${folder.name}"`);
      setPickingFor(null);
      setPickerFolders([]);
      setPickerBreadcrumb([]);
      onMappingChanged();
      loadCategories();
    } catch (err: any) {
      toast.error("Kunne ikke lagre mapping", { description: err.message });
    }
  };

  // Accept auto-suggestion
  const acceptSuggestion = async (categoryKey: string, folder: SpFolder) => {
    const cat = categories.find(c => c.category_key === categoryKey);
    try {
      const { error } = await supabase
        .from("project_sharepoint_category_mappings" as any)
        .upsert({
          project_id: projectId,
          category_key: categoryKey,
          display_name: cat?.display_name || categoryKey,
          folder_id: folder.id,
          folder_path: folder.name,
          folder_web_url: folder.web_url,
          drive_id: driveId,
        }, { onConflict: "project_id,category_key" });

      if (error) throw error;

      toast.success(`"${cat?.display_name || categoryKey}" mappet til "${folder.name}"`);
      setSuggestions(prev => {
        const next = new Map(prev);
        next.delete(categoryKey);
        return next;
      });
      onMappingChanged();
      loadCategories();
    } catch (err: any) {
      toast.error("Kunne ikke lagre", { description: err.message });
    }
  };

  // Remove project mapping (revert to company default)
  const removeMapping = async (categoryKey: string) => {
    try {
      const { error } = await supabase
        .from("project_sharepoint_category_mappings" as any)
        .delete()
        .eq("project_id", projectId)
        .eq("category_key", categoryKey);

      if (error) throw error;
      toast.success("Mapping fjernet, bruker selskapstandard");
      onMappingChanged();
      loadCategories();
    } catch (err: any) {
      toast.error("Kunne ikke fjerne mapping", { description: err.message });
    }
  };

  // ── Folder picker view ──
  if (pickingFor) {
    const cat = categories.find(c => c.category_key === pickingFor);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setPickingFor(null); setPickerFolders([]); setPickerBreadcrumb([]); }} className="gap-1 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" /> Tilbake
          </Button>
          <h3 className="text-sm font-semibold">Velg mappe for "{cat?.display_name}"</h3>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
          <button onClick={navigatePickerRoot} className="hover:text-primary">Rot</button>
          {pickerBreadcrumb.map((bc, i) => (
            <span key={bc.id} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              <button onClick={() => navigatePickerBreadcrumb(i)} className="hover:text-primary">{bc.name}</button>
            </span>
          ))}
        </div>

        {pickerLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : pickerFolders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Ingen undermapper her.</p>
        ) : (
          <div className="space-y-1">
            {pickerFolders.map(folder => (
              <div key={folder.id} className="flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2.5 hover:bg-accent/10 transition-colors">
                <Folder className="h-4 w-4 text-primary shrink-0" />
                <button
                  onClick={() => navigatePickerFolder(folder)}
                  className="flex-1 text-left min-w-0"
                >
                  <p className="text-sm font-medium truncate">{folder.name}</p>
                  <p className="text-[11px] text-muted-foreground">{folder.child_count} elementer</p>
                </button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 shrink-0"
                  onClick={() => saveMapping(pickingFor!, folder)}
                >
                  <Check className="h-3 w-3" /> Velg
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Main mapping view ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Kategori-mapping</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleAutoDetect} disabled={detectingAuto}>
            {detectingAuto ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Auto-detect
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Koble hver kategori til riktig SharePoint-mappe for dette prosjektet.
        Mapper uten prosjekt-mapping bruker selskapets standard.
      </p>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {categories.map(cat => {
            const suggestion = suggestions.get(cat.category_key);
            const hasProjectMapping = cat.mapping_source === "project";
            const isMissing = !cat.exists && cat.file_count === 0;

            return (
              <div key={cat.category_key} className={cn(
                "rounded-lg border p-3 space-y-2",
                isMissing && !hasProjectMapping ? "border-amber-300/50 bg-amber-50/50 dark:border-amber-700/30 dark:bg-amber-950/20" : "border-border/40 bg-card"
              )}>
                <div className="flex items-center gap-3">
                  <Folder className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{cat.display_name}</p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {hasProjectMapping ? (
                        <span className="text-primary">Prosjekt-mapping: {cat.folder_path}</span>
                      ) : (
                        <span>Standard: {cat.folder_path || "–"}</span>
                      )}
                      {cat.exists && <span>· {cat.file_count} filer</span>}
                      {!cat.exists && <span className="text-amber-600">· Mappe ikke funnet</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {cat.folder_web_url && (
                      <a href={cat.folder_web_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary p-1">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => startPicking(cat.category_key)}>
                      Velg mappe
                    </Button>
                    {hasProjectMapping && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => removeMapping(cat.category_key)} title="Bruk standard">
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Auto-detect suggestion */}
                {suggestion && !hasProjectMapping && (
                  <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-xs flex-1">
                      Forslag: <strong>{suggestion.name}</strong> ({suggestion.child_count} elementer)
                    </span>
                    <Button variant="default" size="sm" className="h-6 text-xs" onClick={() => acceptSuggestion(cat.category_key, suggestion)}>
                      Bruk
                    </Button>
                  </div>
                )}

                {/* Warning for missing mapping */}
                {isMissing && !hasProjectMapping && !suggestion && (
                  <div className="flex items-center gap-2 text-xs text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Mappen finnes ikke i SharePoint. Velg riktig mappe.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
