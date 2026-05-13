import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ShieldCheck, BookOpen, ClipboardCheck, AlertTriangle, Clock, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface KpiCard {
  title: string;
  value: number | string;
  hint: string;
  href: string;
  icon: React.ElementType;
  tone: "ok" | "warn" | "alert" | "neutral";
}

export default function HmsOverviewPage() {
  const { activeCompanyId } = useCompanyContext();

  const { data, isLoading } = useQuery({
    queryKey: ["hms-overview", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const cid = activeCompanyId!;
      const sb = supabase as any;
      const countOf = async (p: any): Promise<number> => {
        const { count } = await p;
        return count ?? 0;
      };
      const handbooks = await countOf(
        sb.from("hms_handbooks").select("id", { count: "exact", head: true })
          .eq("company_id", cid).is("deleted_at", null)
      );
      const openAlerts = await countOf(
        sb.from("worktime_alerts").select("id", { count: "exact", head: true })
          .eq("company_id", cid).eq("status", "open")
      );
      const criticalAlerts = await countOf(
        sb.from("worktime_alerts").select("id", { count: "exact", head: true })
          .eq("company_id", cid).eq("status", "open").eq("severity", "critical")
      );
      const pendingOvertime = await countOf(
        sb.from("overtime_approvals").select("id", { count: "exact", head: true })
          .eq("company_id", cid).eq("status", "pending")
      );
      const openActions = await countOf(
        sb.from("hms_action_items").select("id", { count: "exact", head: true })
          .eq("company_id", cid).in("status", ["open", "in_progress"])
      );
      const profiles = await countOf(
        sb.from("employee_work_profiles").select("id", { count: "exact", head: true })
          .eq("company_id", cid).eq("is_active", true)
      );
      return { handbooks, openAlerts, criticalAlerts, pendingOvertime, openActions, profiles };
    },
  });

  const cards: KpiCard[] = [
    {
      title: "Håndbøker",
      value: data?.handbooks ?? 0,
      hint: "Aktive HMS- og arbeidshåndbøker",
      href: "/hms/handbooks",
      icon: BookOpen,
      tone: "neutral",
    },
    {
      title: "Aktive ansatte",
      value: data?.profiles ?? 0,
      hint: "Med arbeidstidsprofil",
      href: "/hms/aml",
      icon: Users,
      tone: "neutral",
    },
    {
      title: "AML-varsler",
      value: data?.openAlerts ?? 0,
      hint: data?.criticalAlerts
        ? `${data.criticalAlerts} kritisk${data.criticalAlerts === 1 ? "" : "e"}`
        : "Ingen åpne kritiske",
      href: "/hms/aml",
      icon: AlertTriangle,
      tone: data?.criticalAlerts ? "alert" : data?.openAlerts ? "warn" : "ok",
    },
    {
      title: "Overtid til godkjenning",
      value: data?.pendingOvertime ?? 0,
      hint: "Venter på leder",
      href: "/hms/aml",
      icon: Clock,
      tone: data?.pendingOvertime ? "warn" : "ok",
    },
    {
      title: "Åpne tiltak",
      value: data?.openActions ?? 0,
      hint: "Fra SJA, risiko og avvik",
      href: "/hms",
      icon: ClipboardCheck,
      tone: data?.openActions ? "warn" : "ok",
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
            <ShieldCheck className="h-3.5 w-3.5" />
            HMS &amp; HR
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Kontrollsenter</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Oversikt over håndbøker, SJA, risiko og arbeidsmiljølovens grenser. Brukes av ledere
            og HMS-ansvarlige for å se status, åpne saker og det som krever handling i dag.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/hms/handbooks">Håndbøker</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/hms/aml">AML-status</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((c) => (
          <Link key={c.title} to={c.href} className="group">
            <Card className="h-full transition-all border-border/60 hover:border-primary/40 hover:shadow-sm">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {c.title}
                </CardTitle>
                <c.icon
                  className={
                    c.tone === "alert"
                      ? "h-4 w-4 text-destructive"
                      : c.tone === "warn"
                      ? "h-4 w-4 text-amber-500"
                      : c.tone === "ok"
                      ? "h-4 w-4 text-emerald-500"
                      : "h-4 w-4 text-muted-foreground"
                  }
                />
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-semibold tracking-tight">
                  {isLoading ? "–" : c.value}
                </div>
                <div className="text-xs text-muted-foreground">{c.hint}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Kommer i runde B</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>Malmotor for SJA og sjekklister, mobilutfylling, Tripletex-import og AML-motor som regner ut grensene.</p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="outline">SJA-maler</Badge>
            <Badge variant="outline">Mobilutfylling</Badge>
            <Badge variant="outline">Tripletex-import</Badge>
            <Badge variant="outline">AML-motor</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
