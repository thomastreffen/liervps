import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchActiveLeads } from "@/lib/lead-queries";
import { type OfferStatus } from "@/lib/offer-status";
import { type LeadStatus } from "@/lib/lead-status";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { SalesHeader } from "@/components/dashboard/SalesHeader";
import { SalesActionRequired, buildActionItems, type ActionItem } from "@/components/dashboard/SalesActionRequired";
import { RecentOffersList, type RecentOffer } from "@/components/dashboard/SalesRecentLists";
import {
  FileText, Send, AlertTriangle, Clock, ChevronRight, ArrowRight, TrendingUp,
} from "lucide-react";

interface KpiItem {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  route: string;
  highlight?: boolean;
}

export default function SalesDashboard() {
  const nav = useNavigate();
  const { activeCompanyId } = useCompanyContext();
  const [recentOffers, setRecentOffers] = useState<RecentOffer[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KpiItem[]>([]);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();

      const leadsRes = await fetchActiveLeads("id, company_name, status, lead_ref_code, updated_at, next_action_date, next_action_type", activeCompanyId);
      let calcsQuery = supabase
        .from("calculations")
        .select("id, project_title, customer_name, status, total_price, created_at, lead_id")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (activeCompanyId) calcsQuery = calcsQuery.eq("company_id", activeCompanyId);
      const calcsRes = await calcsQuery;

      const leads = leadsRes.data || [];
      const calcs = calcsRes.data || [];

      // Recent offers (max 5)
      setRecentOffers(
        calcs.slice(0, 5).map((c: any) => ({
          id: c.id,
          offer_number: c.project_title || "Uten tittel",
          status: (c.status || "draft") as OfferStatus,
          total_inc_vat: Number(c.total_price || 0),
          customer: c.customer_name || "",
          created_at: c.created_at,
        }))
      );

      // KPIs — max 4
      const activeCalcs = calcs.filter((c: any) => !["accepted", "rejected", "converted"].includes(c.status));
      const openPipeline = activeCalcs.reduce((s: number, c: any) => s + Number(c.total_price || 0), 0);
      const sentOffers = calcs.filter((c: any) => c.status === "sent");
      const needsFollowup = sentOffers.filter((c: any) => {
        const age = (now.getTime() - new Date(c.created_at).getTime()) / 86400000;
        return age > 5;
      }).length;

      const fmt = (v: number) =>
        v >= 1_000_000
          ? `${(v / 1_000_000).toLocaleString("nb-NO", { maximumFractionDigits: 1 })}M`
          : v >= 1_000
            ? `${(v / 1_000).toLocaleString("nb-NO", { maximumFractionDigits: 0 })}k`
            : v.toLocaleString("nb-NO", { maximumFractionDigits: 0 });

      // Build action items
      const activeLeads = leads.filter((l: any) => !["won", "lost"].includes(l.status));
      const inactiveLeads = activeLeads.filter((l: any) => !l.updated_at || new Date(l.updated_at) < new Date(d7)).length;
      const offersWithoutFollowup = needsFollowup;
      const leadsWithoutNextStep = activeLeads.filter((l: any) => !l.next_action_type && !l.next_action_date).length;
      const befaringLeads = activeLeads.filter((l: any) => l.status === "befaring");
      const befaringWithoutFollowup = befaringLeads.filter((l: any) => !l.updated_at || new Date(l.updated_at) < new Date(d7)).length;
      const acceptedCalcs = calcs.filter((c: any) => c.status === "accepted");
      const leadsWithCalcNoOffer = leads.filter((l: any) => {
        return calcs.some((c: any) => c.lead_id === l.id && ["generated", "sent"].includes(c.status));
      }).length;

      const actionCount = inactiveLeads + offersWithoutFollowup + leadsWithoutNextStep;

      setKpis([
        {
          label: "Aktive tilbud",
          value: activeCalcs.length,
          icon: <FileText className="h-4 w-4 text-primary" />,
          route: "/sales/offers",
        },
        {
          label: "Pipeline-verdi",
          value: openPipeline > 0 ? `kr ${fmt(openPipeline)}` : "—",
          icon: <TrendingUp className="h-4 w-4 text-primary" />,
          route: "/sales/pipeline",
        },
        {
          label: "Krever handling",
          value: actionCount,
          icon: <AlertTriangle className="h-4 w-4 text-warning" />,
          route: "#actions",
          highlight: actionCount > 0,
        },
        {
          label: "Uten oppfølging",
          value: offersWithoutFollowup,
          icon: <Clock className="h-4 w-4 text-destructive" />,
          route: "/sales/offers?filter=no_followup",
          highlight: offersWithoutFollowup > 0,
        },
      ]);

      setActions(buildActionItems({
        inactiveLeads,
        offersWithoutFollowup,
        leadsWithoutNextStep,
        calcsWithoutOffer: leadsWithCalcNoOffer,
        befaringWithoutFollowup,
        acceptedOffers: acceptedCalcs.length,
      }));

      setLoading(false);
    })();
  }, [activeCompanyId]);

  return (
    <div className="space-y-6 max-w-[1100px] mx-auto pb-8">
      {/* Header */}
      <SalesHeader />

      {/* KPI row — max 4 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-4 sm:px-6">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border/30 bg-card p-4 animate-pulse">
                <div className="h-6 w-12 bg-muted/40 rounded mb-1" />
                <div className="h-3 w-20 bg-muted/30 rounded" />
              </div>
            ))
          : kpis.map((kpi) => (
              <button
                key={kpi.label}
                onClick={() => {
                  if (kpi.route === "#actions") {
                    document.getElementById("actions-section")?.scrollIntoView({ behavior: "smooth" });
                  } else {
                    nav(kpi.route);
                  }
                }}
                className={`rounded-xl border bg-card p-4 text-left
                  hover:shadow-card-hover transition-all duration-200 group cursor-pointer
                  ${kpi.highlight ? "border-destructive/30" : "border-border/30"}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {kpi.icon}
                  <span className={`text-xl font-bold ${kpi.highlight ? "text-destructive" : "text-foreground"}`}>
                    {kpi.value}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground/60">{kpi.label}</p>
              </button>
            ))}
      </div>

      {/* Main: Krever handling */}
      <div className="px-4 sm:px-6" id="actions-section">
        <SalesActionRequired actions={actions} loading={loading} />
      </div>

      {/* Secondary: Siste tilbud */}
      <div className="px-4 sm:px-6">
        <RecentOffersList offers={recentOffers} loading={loading} />
      </div>
    </div>
  );
}
