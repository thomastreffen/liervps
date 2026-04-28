import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type OfferSourceKind = "calc_case" | "calculation";

/**
 * Returnerer ID til AKTIVT tilbud (rot, ikke revisjon, ikke slettet) for en gitt kilde.
 * Én kilde = ett aktivt tilbudsløp. Brukes for å bytte mellom "Opprett tilbud" og "Åpne tilbud".
 */
export function useActiveOfferForSource(sourceKind: OfferSourceKind | null, sourceId: string | null | undefined) {
  const [offerId, setOfferId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!!sourceId);

  useEffect(() => {
    let cancelled = false;
    if (!sourceKind || !sourceId) {
      setOfferId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const { data, error } = await supabase.rpc("get_active_offer_for_source", {
        _source_kind: sourceKind,
        _source_id: sourceId,
      });
      if (cancelled) return;
      if (error) {
        console.warn("[useActiveOfferForSource]", error);
        setOfferId(null);
      } else {
        setOfferId((data as string | null) ?? null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceKind, sourceId]);

  return { offerId, loading, exists: !!offerId };
}
