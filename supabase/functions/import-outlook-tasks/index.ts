import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const azureClientId = Deno.env.get("AZURE_CLIENT_ID");
    const azureTenantId = Deno.env.get("AZURE_TENANT_ID");
    const azureClientSecret = Deno.env.get("AZURE_CLIENT_SECRET");

    if (!azureClientId || !azureTenantId || !azureClientSecret) {
      return new Response(JSON.stringify({ error: "MS not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's MS tokens
    const { data: userData } = await sb.auth.admin.getUserById(user.id);
    const msTokens = userData?.user?.user_metadata?.ms_tokens;
    if (!msTokens?.access_token) {
      return new Response(JSON.stringify({ error: "No MS token", ms_reauth: true }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch recent calendar events
    const now = new Date();
    const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const calRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${startDate}&endDateTime=${endDate}&$top=100&$select=id,subject,start,end,categories,body`,
      {
        headers: { Authorization: `Bearer ${msTokens.access_token}` },
      }
    );

    if (!calRes.ok) {
      const errText = await calRes.text();
      return new Response(JSON.stringify({ error: "Graph error", status: calRes.status, detail: errText }), {
        status: calRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const calData = await calRes.json();
    const events = calData.value || [];

    // Filter: only events with "TASK:" prefix or "Driftflyt" category
    const taskEvents = events.filter((ev: any) => {
      const subject = (ev.subject || "").trim();
      const categories = ev.categories || [];
      return subject.startsWith("TASK:") || categories.includes("Driftflyt");
    });

    // Get user's company
    const { data: userAccount } = await sb.from("user_accounts")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .single();

    const { data: scope } = await sb.from("user_scopes")
      .select("company_id")
      .eq("user_account_id", userAccount?.id || "")
      .limit(1)
      .single();

    const companyId = scope?.company_id;
    if (!companyId) {
      return new Response(JSON.stringify({ error: "No company found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const ev of taskEvents) {
      const calEventId = ev.id;
      const subject = (ev.subject || "").replace(/^TASK:\s*/, "").trim();

      // Check if task already exists
      const { data: existing } = await sb.from("tasks")
        .select("id")
        .eq("calendar_event_id", calEventId)
        .eq("owner_user_id", user.id)
        .limit(1)
        .single();

      const taskData = {
        title: subject || "Importert oppgave",
        planned_start_at: ev.start?.dateTime ? new Date(ev.start.dateTime + "Z").toISOString() : null,
        planned_end_at: ev.end?.dateTime ? new Date(ev.end.dateTime + "Z").toISOString() : null,
        calendar_provider: "outlook",
        calendar_event_id: calEventId,
      };

      if (existing) {
        await sb.from("tasks").update(taskData).eq("id", existing.id);
        updated++;
      } else {
        await sb.from("tasks").insert({
          ...taskData,
          company_id: companyId,
          created_by: user.id,
          owner_user_id: user.id,
          status: "open",
          priority: "medium",
        });
        imported++;
      }
    }

    skipped = events.length - taskEvents.length;

    return new Response(JSON.stringify({ imported, updated, skipped, total_events: events.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
