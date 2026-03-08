import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ApproveRequest {
  journal_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth: get portal user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: authUser } } = await callerClient.auth.getUser();
    if (!authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get portal user
    const { data: portalUser } = await supabase
      .from("customer_portal_users")
      .select("id, full_name, account_id, email")
      .eq("auth_user_id", authUser.id)
      .eq("status", "active")
      .maybeSingle();

    if (!portalUser) {
      return new Response(JSON.stringify({ error: "Portal user not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: ApproveRequest = await req.json();
    const { journal_id } = body;

    if (!journal_id) {
      return new Response(JSON.stringify({ error: "journal_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get journal
    const { data: journal, error: jErr } = await supabase
      .from("service_journals")
      .select("id, project_id, version, status, company_id, billing_status")
      .eq("id", journal_id)
      .maybeSingle();

    if (!journal || jErr) {
      return new Response(JSON.stringify({ error: "Journal not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify portal user has access to this project
    const { data: access } = await supabase
      .from("customer_portal_project_access")
      .select("project_id")
      .eq("project_id", journal.project_id)
      .or(`portal_user_id.eq.${portalUser.id}${portalUser.account_id ? `,account_id.eq.${portalUser.account_id}` : ""}`)
      .maybeSingle();

    if (!access) {
      return new Response(JSON.stringify({ error: "No access to project" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check journal is in review state
    if (journal.status !== "review") {
      return new Response(JSON.stringify({ error: `Cannot approve journal in status '${journal.status}'` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();

    // 1. Update journal: approve + lock + billing status
    const { error: updateErr } = await supabase
      .from("service_journals")
      .update({
        status: "approved",
        approved_at: now,
        approved_by_portal_user_id: portalUser.id,
        approved_version: journal.version,
        locked_at: now,
        billing_status: "ready_for_billing",
        updated_at: now,
      })
      .eq("id", journal_id);

    if (updateErr) {
      console.error("Journal update error:", updateErr);
      return new Response(JSON.stringify({ error: "Failed to approve journal" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get project details for invoice basis
    const { data: project } = await supabase
      .from("events")
      .select("id, title, customer_name, customer_id, company_id")
      .eq("id", journal.project_id)
      .maybeSingle();

    // 3. Get work hours from schedule_blocks
    const { data: blocks } = await supabase
      .from("schedule_blocks")
      .select("start_at, end_at, technician_name")
      .eq("project_id", journal.project_id)
      .is("deleted_at", null);

    let totalHours = 0;
    const techNames = new Set<string>();
    (blocks || []).forEach((b: any) => {
      if (b.start_at && b.end_at) {
        const diff = (new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 3600000;
        totalHours += Math.max(0, diff);
      }
      if (b.technician_name) techNames.add(b.technician_name);
    });

    // 4. Count deviations
    const { count: deviationCount } = await supabase
      .from("job_tasks")
      .select("id", { count: "exact", head: true })
      .eq("project_id", journal.project_id)
      .eq("is_deviation", true);

    // 5. Count total reports for this project
    const { count: reportCount } = await supabase
      .from("service_journals")
      .select("id", { count: "exact", head: true })
      .eq("project_id", journal.project_id);

    // 6. Create invoice_basis record
    const techNamesArr = [...techNames];
    const { error: ibErr } = await supabase
      .from("invoice_basis")
      .upsert({
        project_id: journal.project_id,
        company_id: project?.company_id || journal.company_id,
        service_journal_id: journal_id,
        customer_name: project?.customer_name || "Ukjent kunde",
        customer_id: project?.customer_id || null,
        approved_at: now,
        approved_by_name: portalUser.full_name,
        approved_by_portal_user_id: portalUser.id,
        approved_version: journal.version,
        total_hours: Math.round(totalHours * 100) / 100,
        technician_names: techNamesArr,
        technician_count: techNamesArr.length,
        report_count: reportCount || 1,
        deviation_count: deviationCount || 0,
        status: "ready",
        updated_at: now,
      }, { onConflict: "service_journal_id" });

    if (ibErr) {
      console.error("Invoice basis error:", ibErr);
    }

    // 7. Log to activity_log
    await supabase.from("activity_log").insert({
      entity_type: "service_journal",
      entity_id: journal_id,
      action: "customer_approved",
      description: `Rapport v${journal.version} godkjent av ${portalUser.full_name} (kundeportal)`,
      type: "approval",
      visibility: "internal",
      metadata: {
        project_id: journal.project_id,
        version: journal.version,
        approved_by_portal_user: portalUser.id,
        approved_by_name: portalUser.full_name,
        billing_status: "ready_for_billing",
      },
    });

    // 8. Log billing status change
    await supabase.from("activity_log").insert({
      entity_type: "project",
      entity_id: journal.project_id,
      action: "billing_status_changed",
      description: `Oppdrag markert som "Klar for fakturagrunnlag" etter kundegodkjenning`,
      type: "system",
      visibility: "internal",
      metadata: {
        journal_id,
        version: journal.version,
        new_status: "ready_for_billing",
      },
    });

    return new Response(
      JSON.stringify({ success: true, billing_status: "ready_for_billing" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("portal-approve-journal error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
