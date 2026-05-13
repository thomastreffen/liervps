import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ShieldAlert, Plus, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";

const SEV_LABEL: Record<string, string> = { low: "Lav", medium: "Middels", high: "Høy", critical: "Kritisk" };
const SEV_TONE: Record<string, string> = {
  critical: "bg-rose-50 text-rose-700 border-rose-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};
const TYPE_LABEL: Record<string, string> = {
  hms: "HMS-avvik",
  near_miss: "Nestenulykke",
  personal_injury: "Personskade",
  material_damage: "Materiell skade",
  quality: "Kvalitet",
  environment: "Miljø",
  observation: "Observasjon",
};

export default function HmsIncidentsListPage() {
  const { activeCompanyId } = useCompanyContext();
  const navigate = useNavigate();
  const { id: highlightId } = useParams();

  const { data: incidents, isLoading } = useQuery({
    queryKey: ["hms-incidents", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const sb = supabase as any;
      const { data } = await sb
        .from("hms_incidents")
        .select("id, title, description, severity, status, incident_type, location, occurred_at, created_at, reported_by, project_id")
        .eq("company_id", activeCompanyId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100);
      return (data ?? []) as any[];
    },
  });

  const grouped = useMemo(() => {
    const open = (incidents ?? []).filter((i) => i.status !== "closed");
    const closed = (incidents ?? []).filter((i) => i.status === "closed");
    return { open, closed };
  }, [incidents]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/60">
        <div className="px-4 py-3 max-w-3xl mx-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Tilbake">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">HMS</div>
            <div className="text-base font-semibold flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-rose-600" /> Avvik / RUH
            </div>
          </div>
          <Button asChild size="sm">
            <Link to="/hms/incidents/new"><Plus className="h-4 w-4 mr-1" /> Meld</Link>
          </Button>
        </div>
      </header>

      <div className="px-4 py-4 max-w-3xl mx-auto space-y-6">
        {isLoading && <div className="text-sm text-muted-foreground py-12 text-center">Laster…</div>}

        {!isLoading && (incidents ?? []).length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <div className="text-sm">Ingen avvik registrert ennå.</div>
            <Button asChild className="mt-4"><Link to="/hms/incidents/new">Meld første avvik</Link></Button>
          </div>
        )}

        {grouped.open.length > 0 && (
          <Section title={`Åpne (${grouped.open.length})`}>
            {grouped.open.map((i) => <IncidentRow key={i.id} i={i} highlight={i.id === highlightId} />)}
          </Section>
        )}

        {grouped.closed.length > 0 && (
          <Section title={`Lukket (${grouped.closed.length})`}>
            {grouped.closed.map((i) => <IncidentRow key={i.id} i={i} />)}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-1">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function IncidentRow({ i, highlight }: { i: any; highlight?: boolean }) {
  return (
    <Card className={cn(
      "transition",
      highlight && "ring-2 ring-primary border-primary/40",
    )}>
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{i.title}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {TYPE_LABEL[i.incident_type] ?? i.incident_type}
              {i.location ? ` · ${i.location}` : ""}
              {" · "}
              {formatDistanceToNow(new Date(i.occurred_at || i.created_at), { addSuffix: true, locale: nb })}
            </div>
          </div>
          <Badge variant="outline" className={cn("text-[10px]", SEV_TONE[i.severity] ?? "")}>
            {(i.severity === "critical" || i.severity === "high") && <AlertTriangle className="h-3 w-3 mr-0.5" />}
            {SEV_LABEL[i.severity] ?? i.severity}
          </Badge>
        </div>
        {i.description && (
          <div className="text-xs text-muted-foreground line-clamp-2">{i.description}</div>
        )}
        <div className="flex items-center justify-between pt-0.5">
          <Badge variant="outline" className="text-[10px]">
            {i.status === "closed" ? "Lukket" : i.status === "in_progress" ? "Pågår" : "Åpen"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
