import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Briefcase, Loader2, Search, Calculator, FileText, Target, FolderKanban } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

interface CaseRow {
  id: string;
  case_number: string | null;
  title: string;
  phase: string;
  next_step: string | null;
  next_step_due_at: string | null;
  owner_user_id: string | null;
  customer_id: string | null;
  value_estimate: number | null;
  updated_at: string;
  customer_name?: string;
  owner_name?: string;
  counts: {
    leads: number;
    calc_cases: number;
    calculations: number;
    events: number;
  };
  last_activity_at?: string | null;
}

const PHASE_LABELS: Record<string, string> = {
  lead: "Lead",
  qualifying: "Kvalifisering",
  calculating: "Kalkulerer",
  quoted: "Tilbud sendt",
  negotiating: "Forhandling",
  won: "Vunnet",
  lost: "Tapt",
};

function phaseBadge(phase: string) {
  const variant: any =
    phase === "won" ? "success"
    : phase === "lost" ? "destructive"
    : phase === "quoted" || phase === "negotiating" ? "warning"
    : "secondary";
  return <Badge variant={variant}>{PHASE_LABELS[phase] || phase}</Badge>;
}

export default function SalesCasesListPage() {
  const navigate = useNavigate();
  const { activeCompanyId } = useCompanyContext();
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!activeCompanyId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: cases } = await supabase
          .from("commercial_cases")
          .select("id, case_number, title, phase, next_step, next_step_due_at, owner_user_id, customer_id, value_estimate, updated_at")
          .eq("company_id", activeCompanyId)
          .is("deleted_at", null)
          .order("updated_at", { ascending: false })
          .limit(200);

        const list = (cases || []) as any[];
        const ids = list.map(c => c.id);
        const customerIds = [...new Set(list.map(c => c.customer_id).filter(Boolean))];
        const ownerIds = [...new Set(list.map(c => c.owner_user_id).filter(Boolean))];

        const [custRes, ownerRes, leadsRes, calcCaseRes, calcRes, eventRes, actRes] = await Promise.all([
          customerIds.length
            ? supabase.from("customers").select("id, name").in("id", customerIds)
            : Promise.resolve({ data: [] as any[] }),
          ownerIds.length
            ? supabase.from("technicians").select("user_id, name").in("user_id", ownerIds)
            : Promise.resolve({ data: [] as any[] }),
          ids.length
            ? supabase.from("leads").select("id, commercial_case_id").in("commercial_case_id", ids)
            : Promise.resolve({ data: [] as any[] }),
          ids.length
            ? supabase.from("calc_cases").select("id, commercial_case_id").in("commercial_case_id", ids).is("deleted_at", null)
            : Promise.resolve({ data: [] as any[] }),
          ids.length
            ? supabase.from("calculations").select("id, commercial_case_id, parent_offer_id").in("commercial_case_id", ids).is("deleted_at", null)
            : Promise.resolve({ data: [] as any[] }),
          ids.length
            ? supabase.from("events").select("id, commercial_case_id").in("commercial_case_id", ids).is("deleted_at", null)
            : Promise.resolve({ data: [] as any[] }),
          ids.length
            ? supabase.from("activity_log").select("commercial_case_id, created_at").in("commercial_case_id", ids).order("created_at", { ascending: false })
            : Promise.resolve({ data: [] as any[] }),
        ]);

        const custMap = new Map((custRes.data || []).map((c: any) => [c.id, c.name]));
        const ownerMap = new Map((ownerRes.data || []).map((o: any) => [o.user_id, o.name]));
        const leadCount = new Map<string, number>();
        const calcCaseCount = new Map<string, number>();
        const calcCount = new Map<string, number>();
        const eventCount = new Map<string, number>();
        const lastAct = new Map<string, string>();

        (leadsRes.data || []).forEach((r: any) => leadCount.set(r.commercial_case_id, (leadCount.get(r.commercial_case_id) || 0) + 1));
        (calcCaseRes.data || []).forEach((r: any) => calcCaseCount.set(r.commercial_case_id, (calcCaseCount.get(r.commercial_case_id) || 0) + 1));
        // Only count root offers (parent_offer_id null) so revisions don't inflate
        (calcRes.data || []).forEach((r: any) => {
          if (r.parent_offer_id) return;
          calcCount.set(r.commercial_case_id, (calcCount.get(r.commercial_case_id) || 0) + 1);
        });
        (eventRes.data || []).forEach((r: any) => eventCount.set(r.commercial_case_id, (eventCount.get(r.commercial_case_id) || 0) + 1));
        (actRes.data || []).forEach((r: any) => {
          if (!lastAct.has(r.commercial_case_id)) lastAct.set(r.commercial_case_id, r.created_at);
        });

        const enriched: CaseRow[] = list.map(c => ({
          ...c,
          customer_name: c.customer_id ? custMap.get(c.customer_id) : undefined,
          owner_name: c.owner_user_id ? ownerMap.get(c.owner_user_id) : undefined,
          counts: {
            leads: leadCount.get(c.id) || 0,
            calc_cases: calcCaseCount.get(c.id) || 0,
            calculations: calcCount.get(c.id) || 0,
            events: eventCount.get(c.id) || 0,
          },
          last_activity_at: lastAct.get(c.id) || null,
        }));

        if (!cancelled) setRows(enriched);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeCompanyId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.title.toLowerCase().includes(q) ||
      (r.customer_name || "").toLowerCase().includes(q) ||
      (r.case_number || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-primary/10 p-2.5">
          <Briefcase className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">Saker</h1>
          <p className="text-sm text-muted-foreground">
            Salgssaker som binder lead, kalkyle, tilbud og prosjekt sammen.
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Søk tittel, kunde eller saksnr..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {search ? "Ingen treff." : "Ingen saker enda. Saker opprettes automatisk fra lead, kalkyle eller prosjekt."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sak</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead>Fase</TableHead>
                <TableHead>Ansvarlig</TableHead>
                <TableHead>Neste steg</TableHead>
                <TableHead>Koblet til</TableHead>
                <TableHead className="text-right">Sist aktivitet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer hover:bg-accent/30"
                  onClick={() => navigate(`/sales/cases/${r.id}`)}
                >
                  <TableCell>
                    <div className="font-medium text-foreground">{r.title}</div>
                    {r.case_number && (
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{r.case_number}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.customer_name || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>{phaseBadge(r.phase)}</TableCell>
                  <TableCell className="text-sm">
                    {r.owner_name || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm max-w-[220px]">
                    {r.next_step ? (
                      <div className="truncate" title={r.next_step}>
                        {r.next_step}
                        {r.next_step_due_at && (
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(r.next_step_due_at), "d. MMM", { locale: nb })}
                          </div>
                        )}
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {r.counts.leads > 0 && (
                        <Badge variant="outline" className="gap-1"><Target className="h-3 w-3" />{r.counts.leads}</Badge>
                      )}
                      {(r.counts.calc_cases > 0 || r.counts.calculations > 0) && (
                        <Badge variant="outline" className="gap-1">
                          <Calculator className="h-3 w-3" />
                          {r.counts.calc_cases + r.counts.calculations}
                        </Badge>
                      )}
                      {r.counts.calculations > 0 && (
                        <Badge variant="outline" className="gap-1"><FileText className="h-3 w-3" />{r.counts.calculations}</Badge>
                      )}
                      {r.counts.events > 0 && (
                        <Badge variant="outline" className="gap-1"><FolderKanban className="h-3 w-3" />{r.counts.events}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {r.last_activity_at
                      ? format(new Date(r.last_activity_at), "d. MMM HH:mm", { locale: nb })
                      : format(new Date(r.updated_at), "d. MMM", { locale: nb })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
