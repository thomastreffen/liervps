import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CALCULATION_STATUS_CONFIG,
  type CalculationStatus,
} from "@/lib/calculation-status";
import {
  Phone,
  Mail,
  FileText,
  ArrowRight,
  Clock,
  AlertCircle,
  Eye,
} from "lucide-react";

interface FollowupOffer {
  id: string;
  customer_name: string;
  project_title: string;
  total_price: number;
  status: CalculationStatus;
  updated_at: string;
  urgency: "overdue" | "soon" | "stale" | "hot";
  customerActive?: boolean;
  customerViewCount?: number;
  hasFollowupTask?: boolean;
}

const URGENCY_CONFIG = {
  hot: { label: "Kunde viser interesse", className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300", icon: "🟢" },
  overdue: { label: "Forfalt", className: "bg-destructive/15 text-destructive", icon: "🔴" },
  soon: { label: "Snart utløper", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300", icon: "🟡" },
  stale: { label: "Ingen aktivitet", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", icon: "🟡" },
};

const STALE_DAYS = 5;
const MAX_ITEMS = 5;

export function MyOffersFollowup() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [offers, setOffers] = useState<FollowupOffer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    (async () => {
      const { data } = await supabase
        .from("calculations")
        .select("id, customer_name, project_title, total_price, status, updated_at, created_at, created_by")
        .is("deleted_at", null)
        .in("status", ["sent", "generated", "draft"])
        .eq("created_by", user.id)
        .order("updated_at", { ascending: true })
        .limit(50);

      if (!data) {
        setLoading(false);
        return;
      }

      const now = Date.now();
      const items: FollowupOffer[] = [];

      // Fetch customer activity for these offers
      const offerIds = data.map((c: any) => c.id);
      const { data: activityData } = await supabase
        .from("offer_activity_events" as any)
        .select("offer_id, event_type, event_at")
        .in("offer_id", offerIds)
        .in("actor_type", ["customer"])
        .order("event_at", { ascending: false })
        .limit(500);

      // Fetch open followup tasks for these offers
      const { data: followupData } = await supabase
        .from("offer_followup_tasks" as any)
        .select("offer_id")
        .in("offer_id", offerIds)
        .in("status", ["open"]);

      const followupOfferIds = new Set((followupData as any[] || []).map((f: any) => f.offer_id));

      const activities = (activityData as any[]) || [];
      const activityByOffer: Record<string, { viewCount: number; lastAt: number; isRecent: boolean }> = {};
      for (const a of activities) {
        if (!activityByOffer[a.offer_id]) {
          activityByOffer[a.offer_id] = { viewCount: 0, lastAt: 0, isRecent: false };
        }
        const entry = activityByOffer[a.offer_id];
        if (a.event_type === "offer_viewed") entry.viewCount++;
        const at = new Date(a.event_at).getTime();
        if (at > entry.lastAt) entry.lastAt = at;
        if (now - at < 24 * 60 * 60 * 1000) entry.isRecent = true;
      }

      for (const c of data) {
        const daysSinceUpdate = (now - new Date(c.updated_at).getTime()) / 86400000;
        const act = activityByOffer[c.id];

        let urgency: FollowupOffer["urgency"] | null = null;
        let customerActive = false;
        let customerViewCount = 0;

        // Hot: customer viewed 2+ times or viewed in last 24h AND not contacted
        if (act && (act.viewCount >= 2 || act.isRecent)) {
          urgency = "hot";
          customerActive = true;
          customerViewCount = act.viewCount;
        } else if (c.status === "sent" && daysSinceUpdate > 14) {
          urgency = "overdue";
        } else if (c.status === "sent" && daysSinceUpdate > STALE_DAYS) {
          urgency = "soon";
        } else if (c.status === "generated" && daysSinceUpdate > 3) {
          urgency = "stale";
        } else if (c.status === "draft" && daysSinceUpdate > 7) {
          urgency = "stale";
        }

        if (urgency) {
          items.push({
            id: c.id,
            customer_name: c.customer_name || "Ukjent kunde",
            project_title: c.project_title || "Uten tittel",
            total_price: Number(c.total_price || 0),
            status: c.status as CalculationStatus,
            updated_at: c.updated_at,
            urgency,
            customerActive,
            customerViewCount: act?.viewCount || 0,
          });
        }
      }

      // Sort: hot first, then overdue, soon, stale
      const urgencyOrder = { hot: -1, overdue: 0, soon: 1, stale: 2 };
      items.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

      setOffers(items.slice(0, MAX_ITEMS));
      setLoading(false);
    })();
  }, [user?.id]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card shadow-sm p-5 space-y-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (offers.length === 0) return null;

  const daysSince = (d: string) => {
    const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (days === 0) return "I dag";
    if (days === 1) return "1 dag siden";
    return `${days} dager siden`;
  };

  return (
    <div className="rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden">
      <div className="p-5 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-destructive/10">
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
          </div>
          <h4 className="text-sm font-semibold text-foreground">
            Dine tilbud som trenger handling
          </h4>
        </div>
        <p className="text-xs text-muted-foreground/60 ml-9">
          {offers.length} tilbud krever oppfølging
        </p>
      </div>

      <div className="divide-y divide-border/30">
        {offers.map((offer) => {
          const urg = URGENCY_CONFIG[offer.urgency];
          const statusCfg = CALCULATION_STATUS_CONFIG[offer.status];

          return (
            <div
              key={offer.id}
              className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors group"
            >
              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium text-foreground truncate">
                    {offer.customer_name}
                  </p>
                  <Badge className={statusCfg.className + " rounded-lg text-[10px] px-1.5 py-0"}>
                    {statusCfg.label}
                  </Badge>
                  <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0 rounded-lg ${urg.className}`}>
                    {urg.icon} {urg.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                  <span className="truncate max-w-[180px]">{offer.project_title}</span>
                  {offer.total_price > 0 && (
                    <>
                      <span>·</span>
                      <span className="font-mono">
                        kr {offer.total_price.toLocaleString("nb-NO", { maximumFractionDigits: 0 })}
                      </span>
                    </>
                  )}
                  <span>·</span>
                  <span className="flex items-center gap-0.5">
                    <Clock className="h-3 w-3" />
                    {daysSince(offer.updated_at)}
                   </span>
                  {offer.customerActive && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-0.5 text-green-600 font-medium">
                        <Eye className="h-3 w-3" />
                        {offer.customerViewCount}× åpnet
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Quick actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg"
                  title="Ring kunde"
                  onClick={(e) => { e.stopPropagation(); }}
                >
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg"
                  title="Send e-post"
                  onClick={(e) => { e.stopPropagation(); }}
                >
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg"
                  title="Åpne tilbud"
                  onClick={(e) => {
                    e.stopPropagation();
                    nav(`/sales/offers/${offer.id}`);
                  }}
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 py-3 border-t border-border/30">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs gap-1.5 rounded-xl text-muted-foreground"
          onClick={() => nav("/sales/offers?filter=followup")}
        >
          Se alle mine tilbud <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
