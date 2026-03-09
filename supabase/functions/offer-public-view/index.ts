import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const action = pathParts[pathParts.length - 1] || "view";

    // --- GET: Fetch offer by public token ---
    if (req.method === "GET" && action === "offer-public-view") {
      const token = url.searchParams.get("token");
      if (!token) {
        return new Response(JSON.stringify({ error: "Missing token" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch offer with calculation + items
      const { data: offer, error: offerErr } = await sb
        .from("offers")
        .select(`
          id, offer_number, status, total_ex_vat, total_inc_vat, valid_until,
          created_at, generated_pdf_url, accepted_at, accepted_name, accepted_email,
          rejected_at, rejected_comment, calculation_id,
          calculations(
            customer_name, customer_email, project_title, description,
            company_id
          )
        `)
        .eq("public_token", token)
        .is("deleted_at", null)
        .single();

      if (offerErr || !offer) {
        return new Response(JSON.stringify({ error: "Offer not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch line items
      const { data: items } = await sb
        .from("calculation_items")
        .select("id, title, description, type, quantity, unit, unit_price, total_price")
        .eq("calculation_id", offer.calculation_id)
        .order("created_at", { ascending: true });

      // Fetch company info for branding
      const companyId = (offer.calculations as any)?.company_id;
      let company = null;
      if (companyId) {
        const { data: cs } = await sb
          .from("company_settings")
          .select("company_name, logo_url, phone, email, address, postal_code, city, org_number, website")
          .eq("id", companyId)
          .single();
        company = cs;
      }

      // Log view event
      await sb.from("offer_activity_events").insert({
        offer_id: offer.id,
        event_type: "offer_viewed",
        actor_type: "customer",
        meta: {
          user_agent: req.headers.get("user-agent") || "",
          ip_hash: await hashIp(req.headers.get("x-forwarded-for") || "unknown"),
        },
      });

      return new Response(
        JSON.stringify({ offer, items: items || [], company }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- POST: Accept or reject ---
    if (req.method === "POST") {
      const body = await req.json();
      const { token, action: offerAction, name, email, comment } = body;

      if (!token || !offerAction) {
        return new Response(JSON.stringify({ error: "Missing fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Look up offer
      const { data: offer, error: findErr } = await sb
        .from("offers")
        .select("id, status, calculation_id")
        .eq("public_token", token)
        .is("deleted_at", null)
        .single();

      if (findErr || !offer) {
        return new Response(JSON.stringify({ error: "Offer not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent double-action
      if (["accepted", "rejected"].includes(offer.status)) {
        return new Response(
          JSON.stringify({ error: "Offer already " + offer.status, status: offer.status }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const clientIp = req.headers.get("x-forwarded-for") || "unknown";
      const ipHash = await hashIp(clientIp);
      const now = new Date().toISOString();

      if (offerAction === "accept") {
        await sb.from("offers").update({
          status: "accepted",
          accepted_at: now,
          accepted_ip: ipHash,
          accepted_name: name || null,
          accepted_email: email || null,
          accepted_comment: comment || null,
        }).eq("id", offer.id);

        // Update calculation status
        await sb.from("calculations").update({ status: "accepted" }).eq("id", offer.calculation_id);

        // Log activity event
        await sb.from("offer_activity_events").insert({
          offer_id: offer.id,
          event_type: "offer_accepted",
          actor_type: "customer",
          meta: { name, email, comment, ip_hash: ipHash, timestamp: now },
        });

        // Log to activity_log
        await sb.from("activity_log").insert({
          entity_type: "offer",
          entity_id: offer.id,
          action: "accepted",
          description: `Tilbud digitalt akseptert av ${name || "kunde"}`,
          metadata: { name, email, comment, ip_hash: ipHash },
        });

        return new Response(JSON.stringify({ ok: true, status: "accepted" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (offerAction === "reject") {
        await sb.from("offers").update({
          status: "rejected",
          rejected_at: now,
          rejected_comment: comment || null,
        }).eq("id", offer.id);

        await sb.from("calculations").update({ status: "rejected" }).eq("id", offer.calculation_id);

        await sb.from("offer_activity_events").insert({
          offer_id: offer.id,
          event_type: "offer_rejected",
          actor_type: "customer",
          meta: { comment, ip_hash: ipHash, timestamp: now },
        });

        await sb.from("activity_log").insert({
          entity_type: "offer",
          entity_id: offer.id,
          action: "rejected",
          description: `Tilbud avslått av kunde${comment ? ": " + comment : ""}`,
          metadata: { comment, ip_hash: ipHash },
        });

        return new Response(JSON.stringify({ ok: true, status: "rejected" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("offer-public-view error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function hashIp(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + "offer-salt-2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
