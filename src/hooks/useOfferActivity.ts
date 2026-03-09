import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type OfferActivityEventType =
  | "offer_created"
  | "offer_sent_email"
  | "offer_sent_link"
  | "offer_viewed"
  | "offer_pdf_downloaded"
  | "offer_email_opened"
  | "offer_link_clicked"
  | "offer_accepted"
  | "offer_rejected"
  | "offer_expired";

export interface OfferActivityEvent {
  id: string;
  offer_id: string;
  company_id: string | null;
  event_type: OfferActivityEventType;
  event_at: string;
  actor_type: "system" | "user" | "customer";
  actor_id: string | null;
  meta: Record<string, any> | null;
}

export const OFFER_EVENT_CONFIG: Record<
  OfferActivityEventType,
  { label: string; icon: string; color: string }
> = {
  offer_created: { label: "Tilbud opprettet", icon: "📝", color: "text-muted-foreground" },
  offer_sent_email: { label: "Tilbud sendt via e-post", icon: "📤", color: "text-primary" },
  offer_sent_link: { label: "Tilbudslenke delt", icon: "🔗", color: "text-primary" },
  offer_viewed: { label: "Kunde åpnet tilbudet", icon: "👁️", color: "text-green-600" },
  offer_pdf_downloaded: { label: "Kunde lastet ned PDF", icon: "📄", color: "text-blue-600" },
  offer_email_opened: { label: "Kunde åpnet e-post", icon: "✉️", color: "text-blue-500" },
  offer_link_clicked: { label: "Kunde klikket lenke", icon: "🔗", color: "text-purple-600" },
  offer_accepted: { label: "Tilbud akseptert", icon: "✅", color: "text-green-600" },
  offer_rejected: { label: "Tilbud avslått", icon: "❌", color: "text-destructive" },
  offer_expired: { label: "Tilbud utløpt", icon: "⏰", color: "text-amber-600" },
};

export function useOfferActivity(offerId: string | null) {
  const [events, setEvents] = useState<OfferActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!offerId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("offer_activity_events" as any)
      .select("*")
      .eq("offer_id", offerId)
      .order("event_at", { ascending: false })
      .limit(50);
    setEvents((data as any as OfferActivityEvent[]) || []);
    setLoading(false);
  }, [offerId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { events, loading, refetch: fetch };
}

/** Log an offer activity event from the client (authenticated) */
export async function logOfferActivity(
  offerId: string,
  eventType: OfferActivityEventType,
  companyId?: string,
  meta?: Record<string, any>
) {
  await supabase.from("offer_activity_events" as any).insert({
    offer_id: offerId,
    event_type: eventType,
    actor_type: "user",
    actor_id: (await supabase.auth.getUser()).data.user?.id || null,
    company_id: companyId || null,
    meta: meta || {},
  });
}

/** Get latest customer activity for multiple offers (dashboard use) */
export function useOfferActivitySummary(offerIds: string[]) {
  const [summaries, setSummaries] = useState<
    Record<string, { lastEvent: OfferActivityEvent | null; customerViewCount: number; isActiveNow: boolean }>
  >({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (offerIds.length === 0) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("offer_activity_events" as any)
        .select("*")
        .in("offer_id", offerIds)
        .in("actor_type", ["customer"])
        .order("event_at", { ascending: false })
        .limit(500);

      const events = (data as any as OfferActivityEvent[]) || [];
      const now = Date.now();
      const result: typeof summaries = {};

      for (const oid of offerIds) {
        const offerEvents = events.filter((e) => e.offer_id === oid);
        const viewCount = offerEvents.filter((e) => e.event_type === "offer_viewed").length;
        const latest = offerEvents[0] || null;
        const isActiveNow = latest ? (now - new Date(latest.event_at).getTime()) < 15 * 60 * 1000 : false;
        result[oid] = { lastEvent: latest, customerViewCount: viewCount, isActiveNow };
      }

      setSummaries(result);
      setLoading(false);
    })();
  }, [offerIds.join(",")]);

  return { summaries, loading };
}
