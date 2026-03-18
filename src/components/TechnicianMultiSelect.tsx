import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { User, Loader2, Search, Check } from "lucide-react";
import { useCompanyContext } from "@/hooks/useCompanyContext";

interface DBTech {
  id: string;
  name: string;
  user_id: string | null;
}

interface TechnicianMultiSelectProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function TechnicianMultiSelect({ selectedIds, onChange, disabled }: TechnicianMultiSelectProps) {
  const { activeCompanyId } = useCompanyContext();
  const [technicians, setTechnicians] = useState<DBTech[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    async function load() {
      // Get plannable person_ids from employment_profiles for active company
      let epQuery = supabase
        .from("employment_profiles")
        .select("person_id")
        .eq("is_plannable_resource", true)
        .is("archived_at", null);

      if (activeCompanyId) {
        epQuery = epQuery.eq("company_id", activeCompanyId);
      }

      const { data: profiles } = await epQuery;
      if (!profiles || profiles.length === 0) {
        setTechnicians([]);
        setLoading(false);
        return;
      }

      const personIds = [...new Set(profiles.map((p: any) => p.person_id))];

      const { data: accounts } = await supabase
        .from("user_accounts")
        .select("auth_user_id")
        .in("person_id", personIds)
        .eq("is_active", true);

      const authUserIds = (accounts || []).map((a: any) => a.auth_user_id).filter(Boolean);

      if (authUserIds.length === 0) {
        setTechnicians([]);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("technicians")
        .select("id, name, user_id")
        .not("user_id", "is", null)
        .is("archived_at", null)
        .in("user_id", authUserIds)
        .order("name");

      const raw = data || [];
      const seen = new Set<string>();
      const unique = raw.filter((t) => {
        if (!t.id || !t.user_id || seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });
      setTechnicians(unique);
      setLoading(false);
    }
    load();
  }, [activeCompanyId]);

  const safeSelectedIds = Array.isArray(selectedIds) ? selectedIds : [];

  const toggle = (id: string) => {
    const safePrev = Array.isArray(safeSelectedIds) ? [...safeSelectedIds] : [];
    const next = safePrev.includes(id)
      ? safePrev.filter(x => x !== id)
      : [...safePrev, id];
    onChange(next);
  };

  const safeTechnicians = Array.isArray(technicians)
    ? technicians.filter(t => t && typeof t.id === "string" && t.id.length > 0)
    : [];

  const filtered = search
    ? safeTechnicians.filter((t) => t.name?.toLowerCase().includes(search.toLowerCase()))
    : safeTechnicians;

  return (
    <div className="space-y-1.5">
      <Label>Montør(er)</Label>
      <div className="rounded-md border bg-background">
        <div className="flex items-center gap-2 px-2 py-1.5 border-b">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk montør..."
            className="h-7 border-0 p-0 text-sm shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="h-40 overflow-y-auto">
          <div className="p-1 space-y-0.5">
            {loading ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">Ingen treff</p>
            ) : (
              filtered.map((tech) => {
                const checked = safeSelectedIds.includes(tech.id);
                return (
                  <button
                    type="button"
                    key={`tech-${tech.id}`}
                    onClick={() => toggle(tech.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors",
                      checked ? "bg-accent" : "hover:bg-secondary"
                    )}
                  >
                    <div className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                      checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
                    )}>
                      {checked && <Check className="h-3 w-3" />}
                    </div>
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <User className="h-3 w-3" />
                    </div>
                    <span className="text-sm">{typeof tech.name === "string" ? tech.name : JSON.stringify(tech.name)}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
      {safeSelectedIds.length === 0 && (
        <p className="text-xs text-destructive">Velg minst én montør</p>
      )}
    </div>
  );
}
