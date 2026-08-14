import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ConversionLead {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  company_id: string | null;
  public_lead_id?: string | null;
}

export interface PublicLeadContext {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  segment: string | null;
  request_type: string | null;
  message: string | null;
  lead_source: string | null;
  selected_brand: string | null;
  selected_product_name: string | null;
  selected_solution_name: string | null;
  calculator_summary: any;
}

export interface BefaringContext {
  id: string;
  title: string;
  address: string | null;
  description: string | null;
  start_time: string;
  end_time: string;
  status: string | null;
}

export interface CustomerMatch {
  id: string;
  name: string;
  main_email: string | null;
  main_phone: string | null;
}

export interface LeadConversionContext {
  loading: boolean;
  publicLead: PublicLeadContext | null;
  befaring: BefaringContext | null;
  customerMatches: CustomerMatch[];
}

const digits = (v?: string | null) => (v || "").replace(/\D/g, "");

/**
 * Loads everything needed to prefill an offer draft or a job from a lead:
 * website context, the most recent befaring, and possible existing customers.
 */
export function useLeadConversionContext(lead: ConversionLead, enabled: boolean): LeadConversionContext {
  const [loading, setLoading] = useState(false);
  const [publicLead, setPublicLead] = useState<PublicLeadContext | null>(null);
  const [befaring, setBefaring] = useState<BefaringContext | null>(null);
  const [customerMatches, setCustomerMatches] = useState<CustomerMatch[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const [plRes, befRes] = await Promise.all([
        lead.public_lead_id
          ? supabase.from("public_leads").select("*").eq("id", lead.public_lead_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
        supabase
          .from("events")
          .select("id, title, address, description, start_time, end_time, status")
          .eq("source_lead_id", lead.id)
          .ilike("title", "Befaring%")
          .is("deleted_at", null)
          .order("start_time", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (cancelled) return;
      const pl = (plRes as any)?.data as PublicLeadContext | null;
      setPublicLead(pl || null);
      setBefaring(((befRes as any)?.data as BefaringContext) || null);

      // ── Customer matching on email / phone — never auto-create ──
      const email = (lead.email || pl?.email || "").trim().toLowerCase();
      const phone = digits(lead.phone || pl?.phone);
      const filters: string[] = [];
      if (email) filters.push(`main_email.ilike.${email}`);
      if (phone.length >= 6) filters.push(`main_phone.ilike.%${phone.slice(-8)}%`);

      if (filters.length) {
        const { data } = await supabase
          .from("customers")
          .select("id, name, main_email, main_phone")
          .is("deleted_at", null)
          .or(filters.join(","))
          .limit(5);
        if (!cancelled) setCustomerMatches((data as any) || []);
      } else {
        setCustomerMatches([]);
      }

      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, lead.id, lead.public_lead_id, lead.email, lead.phone]);

  return { loading, publicLead, befaring, customerMatches };
}

export function segmentLabel(segment?: string | null): "bolig" | "næring" {
  const s = (segment || "").toLowerCase();
  return s === "naering" || s === "næring" ? "næring" : "bolig";
}
