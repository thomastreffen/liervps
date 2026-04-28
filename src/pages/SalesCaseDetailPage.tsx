import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EntityView, type EntityTab } from "@/components/entity/EntityView";
import { ActivityTimeline, type ActivityEntry } from "@/components/entity/ActivityTimeline";
import { Calculator, FileText, Target, FolderKanban, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

const PHASE_LABELS: Record<string, string> = {
  lead: "Lead",
  qualifying: "Kvalifisering",
  calculating: "Kalkulerer",
  quoted: "Tilbud sendt",
  negotiating: "Forhandling",
  won: "Vunnet",
  lost: "Tapt",
};

interface Case {
  id: string;
  case_number: string | null;
  title: string;
  description: string | null;
  phase: string;
  next_step: string | null;
  next_step_due_at: string | null;
  owner_user_id: string | null;
  customer_id: string | null;
  contact_person_id: string | null;
  value_estimate: number | null;
  probability_pct: number | null;
  expected_close_date: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

interface RelatedRefs {
  leads: Array<{ id: string; title: string | null; lead_ref_code: string | null; status: string | null }>;
  calc_cases: Array<{ id: string; title: string | null }>;
  calculations: Array<{ id: string; project_title: string | null; offer_number: string | null; status: string | null; total_price: number | null; parent_offer_id: string | null; version_number: number | null; case_id: string | null }>;
  events: Array<{ id: string; title: string | null; project_number: string | null; status: string | null }>;
}

const fmtNOK = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(n);

export default function SalesCaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [data, setData] = useState<Case | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [contactName, setContactName] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [related, setRelated] = useState<RelatedRefs>({ leads: [], calc_cases: [], calculations: [], events: [] });
  const [activities, setActivities] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: c, error } = await supabase
          .from("commercial_cases")
          .select("*")
          .eq("id", id)
          .is("deleted_at", null)
          .maybeSingle();

        if (error || !c) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (cancelled) return;
        setData(c as any);

        const [custRes, contactRes, ownerRes, leadsRes, calcCaseRes, calcRes, eventRes, actRes] = await Promise.all([
          c.customer_id ? supabase.from("customers").select("name").eq("id", c.customer_id).maybeSingle() : Promise.resolve({ data: null }),
          c.contact_person_id ? supabase.from("customer_contacts").select("name").eq("id", c.contact_person_id).maybeSingle() : Promise.resolve({ data: null }),
          c.owner_user_id ? supabase.from("technicians").select("name").eq("user_id", c.owner_user_id).maybeSingle() : Promise.resolve({ data: null }),
          supabase.from("leads").select("id, title, subject, lead_ref_code, status").eq("commercial_case_id", id),
          supabase.from("calc_cases").select("id, title").eq("commercial_case_id", id).is("deleted_at", null),
          supabase.from("calculations").select("id, project_title, offer_number, status, total_price, parent_offer_id, version_number, case_id").eq("commercial_case_id", id).is("deleted_at", null).order("version_number", { ascending: false }),
          supabase.from("events").select("id, title, project_number, status").eq("commercial_case_id", id).is("deleted_at", null),
          supabase.from("activity_log").select("*").eq("commercial_case_id", id).order("created_at", { ascending: false }).limit(200),
        ]);

        if (cancelled) return;

        setCustomerName((custRes.data as any)?.name ?? null);
        setContactName((contactRes.data as any)?.name ?? null);
        setOwnerName((ownerRes.data as any)?.name ?? null);

        setRelated({
          leads: ((leadsRes.data || []) as any[]).map(l => ({
            id: l.id, title: l.title || l.subject, lead_ref_code: l.lead_ref_code, status: l.status,
          })),
          calc_cases: (calcCaseRes.data || []) as any[],
          calculations: (calcRes.data || []) as any[],
          events: (eventRes.data || []) as any[],
        });

        // Resolve performer names for activity
        const acts = (actRes.data || []) as any[];
        const performerIds = [...new Set(acts.map(a => a.performed_by).filter(Boolean))];
        let techMap = new Map<string, string>();
        if (performerIds.length) {
          const { data: techs } = await supabase.from("technicians").select("user_id, name").in("user_id", performerIds);
          techMap = new Map((techs || []).map((t: any) => [t.user_id, t.name]));
        }
        setActivities(acts.map(a => ({
          id: a.id,
          type: a.type || "note",
          action: a.action,
          title: a.title,
          description: a.description,
          created_at: a.created_at,
          performer_name: techMap.get(a.performed_by) || "System",
          microsoft_event_id: a.microsoft_event_id,
          microsoft_message_id: a.microsoft_message_id,
          visibility: a.visibility,
          metadata: a.metadata as any,
        })));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const phaseBadge = data && (
    <Badge
      variant={
        data.phase === "won" ? "success"
        : data.phase === "lost" ? "destructive"
        : data.phase === "quoted" || data.phase === "negotiating" ? "warning"
        : "secondary"
      }
    >
      {PHASE_LABELS[data.phase] || data.phase}
    </Badge>
  );

  const overviewTab: EntityTab = {
    value: "overview",
    label: "Oversikt",
    content: (
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Kunde</h3>
          <div className="space-y-1.5 text-sm">
            <div><span className="text-muted-foreground">Kunde:</span> <span className="font-medium">{customerName || "—"}</span></div>
            <div><span className="text-muted-foreground">Kontaktperson:</span> <span className="font-medium">{contactName || "—"}</span></div>
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Sak</h3>
          <div className="space-y-1.5 text-sm">
            <div><span className="text-muted-foreground">Ansvarlig:</span> <span className="font-medium">{ownerName || "—"}</span></div>
            <div><span className="text-muted-foreground">Estimert verdi:</span> <span className="font-medium">{fmtNOK(data?.value_estimate ?? null)}</span></div>
            <div><span className="text-muted-foreground">Sannsynlighet:</span> <span className="font-medium">{data?.probability_pct != null ? `${data.probability_pct}%` : "—"}</span></div>
            <div><span className="text-muted-foreground">Forventet lukket:</span> <span className="font-medium">{data?.expected_close_date ? format(new Date(data.expected_close_date), "d. MMM yyyy", { locale: nb }) : "—"}</span></div>
          </div>
        </Card>

        <Card className="p-5 space-y-3 md:col-span-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Neste steg</h3>
          {data?.next_step ? (
            <div className="text-sm">
              <p className="text-foreground">{data.next_step}</p>
              {data.next_step_due_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  Frist {format(new Date(data.next_step_due_at), "d. MMM yyyy", { locale: nb })}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Ingen neste steg er satt enda.</p>
          )}
        </Card>

        {data?.description && (
          <Card className="p-5 space-y-3 md:col-span-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Beskrivelse</h3>
            <p className="text-sm whitespace-pre-wrap">{data.description}</p>
          </Card>
        )}

        <Card className="p-5 space-y-3 md:col-span-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Relaterte objekter</h3>
          <div className="space-y-2">
            {related.leads.map(l => (
              <button key={l.id} onClick={() => navigate(`/sales/leads/${l.id}`)}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-border/40 hover:bg-accent/40 transition text-left">
                <Target className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{l.title || "Lead"}</div>
                  {l.lead_ref_code && <div className="text-xs text-muted-foreground font-mono">{l.lead_ref_code}</div>}
                </div>
                {l.status && <Badge variant="outline" className="text-xs">{l.status}</Badge>}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
            {related.calc_cases.map(cc => (
              <button key={cc.id} onClick={() => navigate(`/sales/calc-engine/case/${cc.id}`)}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-border/40 hover:bg-accent/40 transition text-left">
                <Calculator className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{cc.title || "Kalkylesak"}</div>
                  <div className="text-xs text-muted-foreground">Samlesak</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
            {related.events.map(ev => (
              <button key={ev.id} onClick={() => navigate(`/projects/${ev.id}`)}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-border/40 hover:bg-accent/40 transition text-left">
                <FolderKanban className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{ev.title || "Prosjekt"}</div>
                  {ev.project_number && <div className="text-xs text-muted-foreground font-mono">{ev.project_number}</div>}
                </div>
                {ev.status && <Badge variant="outline" className="text-xs">{ev.status}</Badge>}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
            {related.leads.length === 0 && related.calc_cases.length === 0 && related.events.length === 0 && related.calculations.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">Ingen koblede objekter enda.</p>
            )}
          </div>
        </Card>
      </div>
    ),
  };

  const calcTab: EntityTab = {
    value: "calc",
    label: "Kalkyler",
    count: related.calc_cases.length + related.calculations.filter(c => !c.case_id && !c.parent_offer_id).length,
    content: (
      <div className="space-y-2">
        {related.calc_cases.length === 0 && related.calculations.filter(c => !c.case_id).length === 0 && (
          <p className="text-sm text-muted-foreground">Ingen kalkyler knyttet til denne saken.</p>
        )}
        {related.calc_cases.map(cc => (
          <button key={cc.id} onClick={() => navigate(`/sales/calc-engine/case/${cc.id}`)}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/40 hover:bg-accent/40 transition text-left">
            <Calculator className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium">{cc.title || "Kalkylesak"}</div>
              <div className="text-xs text-muted-foreground">Samlesak</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
        {related.calculations.filter(c => !c.case_id).map(c => (
          <button key={c.id} onClick={() => navigate(`/sales/calc-engine/${c.id}`)}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/40 hover:bg-accent/40 transition text-left">
            <Calculator className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium">{c.project_title || "Kalkyle"}</div>
              <div className="text-xs text-muted-foreground">{fmtNOK(c.total_price)}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    ),
  };

  // Offers = root calculations (parent_offer_id null) that act as offers
  const offers = related.calculations.filter(c => !c.parent_offer_id);
  const offerTab: EntityTab = {
    value: "offers",
    label: "Tilbud",
    count: offers.length,
    content: (
      <div className="space-y-2">
        {offers.length === 0 && (
          <p className="text-sm text-muted-foreground">Ingen tilbud opprettet enda.</p>
        )}
        {offers.map(o => (
          <button key={o.id} onClick={() => navigate(`/sales/offers/${o.id}`)}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/40 hover:bg-accent/40 transition text-left">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium">{o.project_title || "Tilbud"}</div>
              <div className="text-xs text-muted-foreground">
                {o.offer_number && <span className="font-mono">{o.offer_number} · </span>}
                {fmtNOK(o.total_price)}
                {o.version_number && o.version_number > 1 && <span> · v{o.version_number}</span>}
              </div>
            </div>
            {o.status && <Badge variant="outline" className="text-xs">{o.status}</Badge>}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    ),
  };

  const activityTab: EntityTab = {
    value: "activity",
    label: "Aktivitet",
    count: activities.length,
    content: (
      <Card className="p-5">
        <ActivityTimeline activities={activities} emptyMessage="Ingen aktivitet logget enda." />
      </Card>
    ),
  };

  return (
    <EntityView
      name={data?.title || "Sak"}
      refCode={data?.case_number}
      subtitle={customerName || undefined}
      statusBadge={phaseBadge}
      tabs={[overviewTab, activityTab, calcTab, offerTab]}
      defaultTab="overview"
      onBack={() => navigate("/sales/cases")}
      loading={loading}
      notFound={notFound}
      notFoundMessage="Sak ikke funnet"
    />
  );
}
