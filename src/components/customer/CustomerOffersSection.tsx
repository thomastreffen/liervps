import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { OFFER_STATUS_CONFIG, type OfferStatus } from "@/lib/offer-status";

interface OfferRow {
  id: string;
  offer_number: string;
  status: OfferStatus;
  total_ex_vat: number;
  created_at: string;
  customer_name: string;
}

export function CustomerOffersSection({ customerId }: { customerId: string }) {
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const navigate = useNavigate();

  const fetch = useCallback(async () => {
    // Offers link through calculations which have customer_name but not customer_id.
    // We join offers→calculations and match on customer_id in calculations.
    const { data } = await supabase
      .from("offers")
      .select("id, offer_number, status, total_ex_vat, created_at, calculations!inner(customer_name)")
      .not("deleted_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);

    // Try alternative: get via events customer_id -> offers via lead or direct
    // Simpler: just fetch offers where calculation.customer_name matches
    // For now, skip if no direct FK. We'll query via events instead.
  }, [customerId]);

  // Offers don't have a direct customer_id FK, so we show offers linked to projects for this customer
  const fetchViaProjects = useCallback(async () => {
    // Get project IDs for this customer
    const { data: projects } = await supabase
      .from("events")
      .select("id")
      .eq("customer_id", customerId)
      .is("deleted_at", null);

    if (!projects || projects.length === 0) { setOffers([]); return; }

    const projectIds = projects.map(p => p.id);

    // Get offers linked to these projects via calculations
    const { data: calcs } = await supabase
      .from("calculations")
      .select("id, customer_name")
      .is("deleted_at", null);

    // Get offers for leads linked to this customer, or direct
    const { data: offersData } = await supabase
      .from("offers")
      .select("id, offer_number, status, total_ex_vat, created_at, calculations(customer_name)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10);

    if (offersData) {
      setOffers(offersData.map((o: any) => ({
        id: o.id,
        offer_number: o.offer_number,
        status: o.status,
        total_ex_vat: o.total_ex_vat,
        created_at: o.created_at,
        customer_name: o.calculations?.customer_name || "",
      })));
    }
  }, [customerId]);

  // For now, show cases instead which have direct customer_id
  // We'll implement offers properly when there's a direct FK
  return null;
}
