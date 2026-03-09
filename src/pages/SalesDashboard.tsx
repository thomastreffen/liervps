import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchActiveLeads } from "@/lib/lead-queries";
import { type OfferStatus } from "@/lib/offer-status";
import { type LeadStatus } from "@/lib/lead-status";
import { SalesPulse } from "@/components/dashboard/SalesPulse";
import { SalesHeader } from "@/components/dashboard/SalesHeader";
import { SalesActionRequired, buildActionItems, type ActionItem } from "@/components/dashboard/SalesActionRequired";
import { SalesRecommendations, buildRecommendations, type Recommendation } from "@/components/dashboard/SalesRecommendations";
import { RecentOffersList, RecentLeadsList, type RecentOffer, type RecentLead } from "@/components/dashboard/SalesRecentLists";
import { OfferSummaryCard, STATUS_WEIGHTS } from "@/components/dashboard/OfferSummaryCard";
import { MyOffersFollowup } from "@/components/dashboard/MyOffersFollowup";
import { DashboardFollowupTasks } from "@/components/dashboard/DashboardFollowupTasks";

export default function SalesDashboard() {
  const nav = useNavigate();
  const [recentOffers, setRecentOffers] = useState<RecentOffer[]>([]);
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [offerStats, setOfferStats] = useState({
    totalActive: 0,
    readyToSend: 0,
    openPipeline: 0,
    weightedPipeline: 0,
    biggestOffer: null as { id: string; customer: string; amount: number } | null,
    needsFollowup: 0,
    activeCustomers24h: 0,
  });

  useEffect(() => {
    (async () => {
      const now = new Date();
      const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();

      const leadsRes = await fetchActiveLeads("id, company_name, status, lead_ref_code, updated_at, next_action_date, next_action_type");
      const [calcsRes] = await Promise.all([
        supabase
          .from("calculations")
          .select("id, project_title, customer_name, status, total_price, created_at, lead_id")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      const leads = leadsRes.data || [];
      const calcs = calcsRes.data || [];

      // Recent offers (from calculations table — matches /sales/offers/:id route)
      const recentCalcs = calcs.slice(0, 6);
      setRecentOffers(
        recentCalcs.map((c: any) => ({
          id: c.id,
          offer_number: c.project_title || "Uten tittel",
          status: (c.status || "draft") as OfferStatus,
          total_inc_vat: Number(c.total_price || 0),
          customer: c.customer_name || "",
          created_at: c.created_at,
        }))
      );

      // Offer summary stats
      const activeCalcs = calcs.filter((c: any) => !["accepted", "rejected", "converted"].includes(c.status));
      const readyToSend = calcs.filter((c: any) => c.status === "draft").length;
      const openPipeline = activeCalcs.reduce((s: number, c: any) => s + Number(c.total_price || 0), 0);
      const weightedPipeline = activeCalcs.reduce((s: number, c: any) => {
        const w = STATUS_WEIGHTS[c.status as string] ?? 0.1;
        return s + Number(c.total_price || 0) * w;
      }, 0);

      // Biggest open offer
      const sorted = [...activeCalcs].sort((a: any, b: any) => Number(b.total_price || 0) - Number(a.total_price || 0));
      const biggest = sorted[0];
      const biggestOffer = biggest && Number(biggest.total_price || 0) > 0
        ? { id: biggest.id, customer: biggest.customer_name || "Ukjent", amount: Number(biggest.total_price) }
        : null;

      // Needs follow-up: sent > 5 days ago
      const needsFollowup = calcs.filter((c: any) => {
        if (c.status !== "sent") return false;
        const age = (now.getTime() - new Date(c.created_at).getTime()) / 86400000;
        return age > 5;
      }).length;

      // Count active customers in last 24h
      const d24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const { count: activeCount } = await supabase
        .from("offer_activity_events" as any)
        .select("offer_id", { count: "exact", head: true })
        .in("actor_type", ["customer"])
        .gte("event_at", d24h);

      setOfferStats({ totalActive: activeCalcs.length, readyToSend, openPipeline, weightedPipeline, biggestOffer, needsFollowup, activeCustomers24h: activeCount || 0 });

      // Recent leads
      setRecentLeads(
        leads
          .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, 6)
          .map((l: any) => ({
            id: l.id,
            company_name: l.company_name,
            status: l.status as LeadStatus,
            ref_code: l.lead_ref_code,
            updated_at: l.updated_at,
          }))
      );

      // Build action items
      const activeLeads = leads.filter((l: any) => !["won", "lost"].includes(l.status));
      const inactiveLeads = activeLeads.filter((l: any) => !l.updated_at || new Date(l.updated_at) < new Date(d7)).length;
      const sentCalcs = calcs.filter((c: any) => c.status === "sent");
      const offersWithoutFollowup = sentCalcs.filter((c: any) => (now.getTime() - new Date(c.created_at).getTime()) / 86400000 > 5).length;
      const leadsWithoutNextStep = activeLeads.filter((l: any) => !l.next_action_type && !l.next_action_date).length;
      const befaringLeads = activeLeads.filter((l: any) => l.status === "befaring");
      const befaringWithoutFollowup = befaringLeads.filter((l: any) => !l.updated_at || new Date(l.updated_at) < new Date(d7)).length;
      const leadsWithCalcNoOffer = leads.filter((l: any) => {
        const hasCalc = calcs.some((c: any) => c.lead_id === l.id && ["generated", "sent"].includes(c.status));
        return hasCalc;
      }).length;

      setActions(buildActionItems({
        inactiveLeads,
        offersWithoutFollowup,
        leadsWithoutNextStep,
        calcsWithoutOffer: leadsWithCalcNoOffer,
        befaringWithoutFollowup,
      }));

      // Build recommendations
      const newLeadsCount = activeLeads.filter((l: any) => l.status === "new").length;
      const befaringDoneCount = befaringLeads.length;

      setRecommendations(buildRecommendations({
        inactiveLeads,
        newLeadsCount,
        befaringDoneCount,
        leadsWithoutNextStep,
        offersWithoutFollowup,
      }));

      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-8">
      {/* Header with title + segmented tabs */}
      <SalesHeader />

      {/* Offer summary card + KPI Gauges */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 px-4 sm:px-6">
        <OfferSummaryCard
          totalActive={offerStats.totalActive}
          readyToSend={offerStats.readyToSend}
          openPipeline={offerStats.openPipeline}
          weightedPipeline={offerStats.weightedPipeline}
          biggestOffer={offerStats.biggestOffer}
          needsFollowup={offerStats.needsFollowup}
          activeCustomers24h={offerStats.activeCustomers24h}
          loading={loading}
        />
        <div className="lg:col-span-3">
          <SalesPulse />
        </div>
      </div>

      {/* Personal follow-up */}
      <div className="px-4 sm:px-6">
        <MyOffersFollowup />
      </div>

      {/* Action-driven sections */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 px-4 sm:px-6">
        <div className="lg:col-span-3 space-y-4">
          <SalesRecommendations recommendations={recommendations} loading={loading} />
        </div>
        <div className="lg:col-span-2">
          <SalesActionRequired actions={actions} loading={loading} />
        </div>
      </div>

      {/* Recent offers + leads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-4 sm:px-6">
        <RecentOffersList offers={recentOffers} loading={loading} />
        <RecentLeadsList leads={recentLeads} loading={loading} />
      </div>
    </div>
  );
}
