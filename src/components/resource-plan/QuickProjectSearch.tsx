import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, FolderKanban, ExternalLink, CalendarPlus, Loader2, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface SearchResult {
  id: string;
  title: string;
  customer: string | null;
  internal_number: string | null;
  job_number: string | null;
  address: string | null;
  status: string;
  project_number: string | null;
  external_tripletex_id: string | null;
  technicians: { id: string; name: string }[];
  sortScore: number;
}

interface QuickProjectSearchProps {
  onPlanProject: (projectId: string, projectTitle: string) => void;
}

export function QuickProjectSearch({ onPlanProject }: QuickProjectSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const computeSortScore = (row: any, q: string): number => {
    const lq = q.toLowerCase();
    if (row.internal_number?.toLowerCase() === lq) return 0;
    if (row.job_number?.toLowerCase() === lq) return 1;
    if (row.internal_number?.toLowerCase().includes(lq)) return 2;
    if (row.job_number?.toLowerCase().includes(lq)) return 3;
    if (row.title?.toLowerCase().includes(lq)) return 4;
    if (row.customer?.toLowerCase().includes(lq)) return 5;
    if (row.address?.toLowerCase().includes(lq)) return 6;
    if (row.project_number?.toLowerCase().includes(lq)) return 7;
    if (row.external_tripletex_id?.toLowerCase().includes(lq)) return 8;
    if (row.description?.toLowerCase().includes(lq)) return 9;
    return 10;
  };

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase
        .from("events")
        .select(`
          id, title, customer, internal_number, job_number, address, status,
          project_number, external_tripletex_id, description,
          event_technicians ( technician_id, technicians ( id, name ) )
        `)
        .is("deleted_at", null)
        .or(
          `title.ilike.%${q}%,customer.ilike.%${q}%,internal_number.ilike.%${q}%,job_number.ilike.%${q}%,address.ilike.%${q}%,project_number.ilike.%${q}%,external_tripletex_id.ilike.%${q}%,description.ilike.%${q}%`
        )
        .order("updated_at", { ascending: false })
        .limit(20);

      const mapped: SearchResult[] = (data || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        customer: e.customer,
        internal_number: e.internal_number,
        job_number: e.job_number,
        address: e.address,
        status: e.status,
        project_number: e.project_number,
        external_tripletex_id: e.external_tripletex_id,
        technicians: (e.event_technicians || [])
          .filter((et: any) => et.technicians)
          .map((et: any) => ({ id: et.technicians.id, name: et.technicians.name })),
        sortScore: computeSortScore(e, q),
      }));

      mapped.sort((a, b) => a.sortScore - b.sortScore);
      setResults(mapped.slice(0, 10));
      setOpen(true);
    } catch (err) {
      console.error("[QuickSearch] error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 250);
  }, [doSearch]);

  const handleClear = useCallback(() => {
    setQuery("");
    setResults([]);
    setOpen(false);
  }, []);

  const handlePlan = useCallback((r: SearchResult) => {
    setOpen(false);
    setQuery("");
    onPlanProject(r.id, r.title);
  }, [onPlanProject]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && results.length > 0) {
      e.preventDefault();
      handlePlan(results[0]);
    }
  }, [results, handlePlan]);

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      scheduled: "Planlagt",
      confirmed: "Bekreftet",
      in_progress: "Pågår",
      completed: "Ferdig",
      pending: "Venter",
      cancelled: "Kansellert",
    };
    return map[s] || s;
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Søk prosjekt, kunde eller JOB-ID..."
          className="h-8 pl-8 pr-8 text-xs w-[260px] rounded-lg border-border/40 bg-background"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {loading && <Loader2 className="absolute right-2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-[420px] max-h-[360px] overflow-y-auto rounded-lg border border-border bg-popover shadow-lg z-50">
          <div className="p-1 space-y-0.5">
            {results.map((r) => (
              <div
                key={r.id}
                className="flex items-start justify-between gap-2 rounded-md px-2.5 py-2 hover:bg-accent/50 transition-colors group"
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <FolderKanban className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {r.internal_number && (
                        <span className="text-[9px] font-mono font-bold bg-primary/10 text-primary rounded px-1 py-0.5 shrink-0">
                          {r.internal_number}
                        </span>
                      )}
                      <span className="text-sm font-medium truncate">{r.title}</span>
                    </div>
                    {r.customer && (
                      <p className="text-[11px] text-muted-foreground truncate">{r.customer}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <Badge variant="outline" className="text-[9px] h-4 px-1">
                        {statusLabel(r.status)}
                      </Badge>
                      {r.job_number && (
                        <span className="text-[9px] text-muted-foreground">#{r.job_number}</span>
                      )}
                      {r.project_number && (
                        <span className="text-[9px] text-muted-foreground">P:{r.project_number}</span>
                      )}
                      {r.external_tripletex_id && (
                        <span className="text-[9px] text-muted-foreground">TX:{r.external_tripletex_id}</span>
                      )}
                      {r.technicians.length > 0 && (
                        <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                          <User className="h-2.5 w-2.5" />
                          {r.technicians.map((t) => t.name.split(" ")[0]).join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2 rounded gap-0.5"
                    onClick={() => {
                      setOpen(false);
                      setQuery("");
                      navigate(`/projects/${r.id}`);
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Åpne
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 text-[10px] px-2 rounded gap-0.5"
                    onClick={() => handlePlan(r)}
                  >
                    <CalendarPlus className="h-3 w-3" />
                    Planlegg
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute top-full left-0 mt-1 w-[340px] rounded-lg border border-border bg-popover shadow-lg z-50 p-4 text-center">
          <p className="text-xs text-muted-foreground">Ingen treff – prøv JOB-ID, kunde eller prosjektnavn</p>
        </div>
      )}
    </div>
  );
}
