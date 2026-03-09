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
import { OfferSummaryCard } from "@/components/dashboard/OfferSummaryCard";

export default function SalesDashboard() {
  const nav = useNavigate();
  const [recentOffers, setRecentOffers] = useState<RecentOffer[]>([]);
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [offerStats, setOfferStats] = useState({ totalActive: 0, readyToSend: 0, totalValue: 0 });

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
      const offers = offersRes.data || [];
      const calcs = calcsRes.data || [];

      // Recent offers
      setRecentOffers(
        (offers).map((o: any) => ({
          id: o.id,
          offer_number: o.offer_number,
          status: o.status as OfferStatus,
          total_inc_vat: Number(o.total_inc_vat),
          customer: o.calculations?.customer_name || "",
          created_at: o.created_at,
        }))
      );

      // Offer summary stats
      const activeOffers = offers.filter((o: any) => !["accepted", "rejected", "expired"].includes(o.status));
      const readyToSend = offers.filter((o: any) => o.status === "draft").length;
      const totalValue = activeOffers.reduce((s: number, o: any) => s + Number(o.total_inc_vat || 0), 0);
      setOfferStats({ totalActive: activeOffers.length, readyToSend, totalValue });

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
      const sentOffers = offers.filter((o: any) => o.status === "sent");
      const offersWithoutFollowup = sentOffers.filter((o: any) => (now.getTime() - new Date(o.created_at).getTime()) / 86400000 > 5).length;
      const leadsWithoutNextStep = activeLeads.filter((l: any) => !l.next_action_type && !l.next_action_date).length;
      const befaringLeads = activeLeads.filter((l: any) => l.status === "befaring");
      const befaringWithoutFollowup = befaringLeads.filter((l: any) => !l.updated_at || new Date(l.updated_at) < new Date(d7)).length;
      const leadsWithCalcNoOffer = leads.filter((l: any) => {
        const hasCalc = calcs.some((c: any) => c.lead_id === l.id && c.status === "completed");
        const hasOffer = offers.some((o: any) => o.lead_id === l.id);
        return hasCalc && !hasOffer;
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
          totalValue={offerStats.totalValue}
          loading={loading}
        />
        <div className="lg:col-span-3">
          <SalesPulse />
        </div>
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
