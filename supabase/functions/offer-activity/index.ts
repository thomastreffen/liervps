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
    // Expected: /offer-activity or /offer-activity/track or /offer-activity/pixel

    const action = pathParts[pathParts.length - 1] || "log";

    // --- Public tracking pixel (GET) ---
    if (action === "pixel" && req.method === "GET") {
      const offerId = url.searchParams.get("oid");
      if (offerId) {
        await sb.from("offer_activity_events").insert({
          offer_id: offerId,
          event_type: "offer_email_opened",
          actor_type: "customer",
          meta: {
            user_agent: req.headers.get("user-agent") || "",
            ip_hash: await hashIp(req.headers.get("x-forwarded-for") || "unknown"),
          },
        });
      }
      // Return 1x1 transparent GIF
      const gif = new Uint8Array([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80,
        0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04,
        0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01,
        0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
      ]);
      return new Response(gif, {
        headers: {
          ...corsHeaders,
          "Content-Type": "image/gif",
          "Cache-Control": "no-store, no-cache",
        },
      });
    }

    // --- Public tracking redirect (GET) ---
    if (action === "redirect" && req.method === "GET") {
      const offerId = url.searchParams.get("oid");
      const target = url.searchParams.get("url");
      if (offerId) {
        await sb.from("offer_activity_events").insert({
          offer_id: offerId,
          event_type: "offer_link_clicked",
          actor_type: "customer",
          meta: {
            target_url: target || "",
            user_agent: req.headers.get("user-agent") || "",
            ip_hash: await hashIp(req.headers.get("x-forwarded-for") || "unknown"),
          },
        });
      }
      return Response.redirect(target || supabaseUrl, 302);
    }

    // --- Public view tracking (POST) ---
    if (action === "track" && req.method === "POST") {
      const body = await req.json();
      const { offer_id, event_type } = body;

      if (!offer_id || !event_type) {
        return new Response(JSON.stringify({ error: "Missing offer_id or event_type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Only allow public event types
      const publicTypes = ["offer_viewed", "offer_pdf_downloaded", "offer_email_opened", "offer_link_clicked"];
      if (!publicTypes.includes(event_type)) {
        return new Response(JSON.stringify({ error: "Invalid public event type" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await sb.from("offer_activity_events").insert({
        offer_id,
        event_type,
        actor_type: "customer",
        meta: {
          user_agent: req.headers.get("user-agent") || "",
          ip_hash: await hashIp(req.headers.get("x-forwarded-for") || "unknown"),
          ...((body.meta as Record<string, unknown>) || {}),
        },
      });

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Authenticated log (POST, default) ---
    if (req.method === "POST") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authErr } = await authClient.auth.getUser();
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { offer_id, event_type, company_id, meta } = body;

      if (!offer_id || !event_type) {
        return new Response(JSON.stringify({ error: "Missing fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await sb.from("offer_activity_events").insert({
        offer_id,
        event_type,
        actor_type: "user",
        actor_id: user.id,
        company_id: company_id || null,
        meta: meta || {},
      });

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- GET: fetch activity for offer ---
    if (req.method === "GET") {
      const offerId = url.searchParams.get("offer_id");
      if (!offerId) {
        return new Response(JSON.stringify({ error: "Missing offer_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await sb
        .from("offer_activity_events")
        .select("*")
        .eq("offer_id", offerId)
        .order("event_at", { ascending: false })
        .limit(50);

      return new Response(JSON.stringify({ data, error }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("offer-activity error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function hashIp(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + "offer-salt-2024");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
