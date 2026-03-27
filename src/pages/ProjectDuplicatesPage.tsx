import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, GitMerge, Eye, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useCompanyContext } from "@/hooks/useCompanyContext";

interface DuplicateGroup {
  key: string;
  matchType: string;
  projects: {
    id: string;
    title: string;
    project_number: string | null;
    external_tripletex_id: string | null;
    customer: string | null;
    status: string;
    created_at: string;
    task_count: number;
  }[];
}

export default function ProjectDuplicatesPage() {
  const { activeCompanyId } = useCompanyContext();
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    findDuplicates();
  }, [activeCompanyId]);

  const findDuplicates = async () => {
    setLoading(true);
    const { data: projects } = await supabase
      .from("events")
      .select("id, title, project_number, external_tripletex_id, customer, status, created_at, normalized_name, company_id")
      .is("deleted_at", null)
      .is("merged_into_project_id" as any, null)
      .order("created_at", { ascending: true });

    if (!projects) { setLoading(false); return; }

    const filtered = activeCompanyId
      ? projects.filter((p: any) => p.company_id === activeCompanyId)
      : projects;

    // Count tasks per project
    const ids = filtered.map(p => p.id);
    const taskCounts = new Map<string, number>();
    if (ids.length > 0) {
      const { data: tasks } = await supabase
        .from("events")
        .select("id, parent_project_id")
        .in("parent_project_id", ids)
        .is("deleted_at", null);
      for (const t of tasks || []) {
        const pid = (t as any).parent_project_id;
        taskCounts.set(pid, (taskCounts.get(pid) || 0) + 1);
      }
    }

    const dupGroups: DuplicateGroup[] = [];
    const used = new Set<string>();

    // 1. By project_number
    const byPn = new Map<string, typeof filtered>();
    for (const p of filtered) {
      if (!(p as any).project_number) continue;
      const key = ((p as any).project_number as string).toLowerCase();
      if (!byPn.has(key)) byPn.set(key, []);
      byPn.get(key)!.push(p);
    }
    for (const [key, group] of byPn) {
      if (group.length < 2) continue;
      const ids = group.map(p => p.id);
      if (ids.some(id => used.has(id))) continue;
      ids.forEach(id => used.add(id));
      dupGroups.push({
        key: `pn-${key}`,
        matchType: "Samme prosjektnr",
        projects: group.map(p => ({
          id: p.id, title: p.title,
          project_number: (p as any).project_number,
          external_tripletex_id: (p as any).external_tripletex_id,
          customer: p.customer, status: p.status,
          created_at: p.created_at,
          task_count: taskCounts.get(p.id) || 0,
        })),
      });
    }

    // 2. By external_tripletex_id
    const byTx = new Map<string, typeof filtered>();
    for (const p of filtered) {
      if (!(p as any).external_tripletex_id) continue;
      const key = ((p as any).external_tripletex_id as string).toLowerCase();
      if (!byTx.has(key)) byTx.set(key, []);
      byTx.get(key)!.push(p);
    }
    for (const [key, group] of byTx) {
      if (group.length < 2) continue;
      const ids = group.map(p => p.id);
      if (ids.some(id => used.has(id))) continue;
      ids.forEach(id => used.add(id));
      dupGroups.push({
        key: `tx-${key}`,
        matchType: "Samme Tripletex-ID",
        projects: group.map(p => ({
          id: p.id, title: p.title,
          project_number: (p as any).project_number,
          external_tripletex_id: (p as any).external_tripletex_id,
          customer: p.customer, status: p.status,
          created_at: p.created_at,
          task_count: taskCounts.get(p.id) || 0,
        })),
      });
    }

    // 3. By normalized_name
    const byName = new Map<string, typeof filtered>();
    for (const p of filtered) {
      const nn = (p as any).normalized_name;
      if (!nn || nn.length < 5) continue;
      if (!byName.has(nn)) byName.set(nn, []);
      byName.get(nn)!.push(p);
    }
    for (const [key, group] of byName) {
      if (group.length < 2) continue;
      const ids = group.map(p => p.id);
      if (ids.some(id => used.has(id))) continue;
      ids.forEach(id => used.add(id));
      dupGroups.push({
        key: `name-${key}`,
        matchType: "Identisk navn",
        projects: group.map(p => ({
          id: p.id, title: p.title,
          project_number: (p as any).project_number,
          external_tripletex_id: (p as any).external_tripletex_id,
          customer: p.customer, status: p.status,
          created_at: p.created_at,
          task_count: taskCounts.get(p.id) || 0,
        })),
      });
    }

    setGroups(dupGroups);
    setLoading(false);
  };

  const handleMerge = async (group: DuplicateGroup, masterId: string) => {
    setMerging(group.key);
    try {
      const duplicateIds = group.projects.filter(p => p.id !== masterId).map(p => p.id);

      for (const dupId of duplicateIds) {
        // Move event_technicians
        await (supabase as any).from("event_technicians")
          .update({ event_id: masterId })
          .eq("event_id", dupId);

        // Move schedule_blocks
        await (supabase as any).from("schedule_blocks")
          .update({ project_id: masterId })
          .eq("project_id", dupId)
          .is("deleted_at", null);

        // Move child tasks
        await (supabase as any).from("events")
          .update({ parent_project_id: masterId })
          .eq("parent_project_id", dupId);

        // Mark as merged
        await (supabase as any).from("events")
          .update({
            merged_into_project_id: masterId,
            deleted_at: new Date().toISOString(),
            delete_reason: `Slått sammen med ${masterId}`,
          })
          .eq("id", dupId);
      }

      toast.success(`${duplicateIds.length} duplikat(er) slått sammen`);
      setDismissed(prev => new Set([...prev, group.key]));
      findDuplicates();
    } catch (err: any) {
      toast.error("Feil ved sammenslåing", { description: err?.message });
    } finally {
      setMerging(null);
    }
  };

  const visibleGroups = groups.filter(g => !dismissed.has(g.key));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Mulige duplikater</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Prosjekter med identisk prosjektnr, Tripletex-ID eller navn. Velg master og slå sammen.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : visibleGroups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">Ingen duplikater funnet</p>
            <p className="text-xs text-muted-foreground mt-1">Alle prosjekter har unike identifikatorer.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">{visibleGroups.length} duplikatgruppe(r) funnet</p>
          {visibleGroups.map(group => (
            <Card key={group.key}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <GitMerge className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">{group.matchType}</CardTitle>
                  <Badge variant="outline" className="text-[10px]">{group.projects.length} prosjekter</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {group.projects.map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {p.project_number && (
                          <span className="text-[10px] font-mono font-bold bg-primary/10 text-primary rounded px-1.5 py-0.5">
                            {p.project_number}
                          </span>
                        )}
                        <span className="text-sm font-medium truncate">{p.title}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        {p.customer && <span>{p.customer}</span>}
                        <span>{p.task_count} oppgaver</span>
                        <span>{new Date(p.created_at).toLocaleDateString("nb-NO")}</span>
                        {p.external_tripletex_id && <span className="text-[9px]">TX:{p.external_tripletex_id}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] px-2 gap-1"
                        onClick={() => window.open(`/projects/${p.id}`, "_blank")}
                      >
                        <Eye className="h-3 w-3" />
                        Åpne
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-[10px] px-2 gap-1"
                        disabled={merging === group.key}
                        onClick={() => handleMerge(group, p.id)}
                      >
                        {merging === group.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitMerge className="h-3 w-3" />}
                        Behold som master
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-[10px] text-muted-foreground"
                  onClick={() => setDismissed(prev => new Set([...prev, group.key]))}
                >
                  Ignorer forslag
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
