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

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the user from the JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { work_package_id, action } = await req.json();
    if (!work_package_id || !action) throw new Error("Missing work_package_id or action");
    if (!["approve", "reject"].includes(action)) throw new Error("Invalid action");

    // Get the work package
    const { data: wp, error: wpError } = await supabase
      .from("events")
      .select("id, title, parent_project_id, customer_visible, customer_approval_status, work_package_type, company_id")
      .eq("id", work_package_id)
      .is("deleted_at", null)
      .single();

    if (wpError || !wp) throw new Error("Work package not found");
    if (!wp.customer_visible) throw new Error("Work package not visible to customer");

    // Verify portal access - user must have access to the parent project
    const { data: portalUser } = await supabase
      .from("customer_portal_users")
      .select("id, full_name, account_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!portalUser) throw new Error("Not a portal user");

    // Check project access
    const { data: access } = await supabase
      .from("customer_portal_project_access")
      .select("id")
      .eq("project_id", wp.parent_project_id)
      .or(`portal_user_id.eq.${portalUser.id}${portalUser.account_id ? `,account_id.eq.${portalUser.account_id}` : ""}`)
      .maybeSingle();

    if (!access) throw new Error("No access to this project");

    const newStatus = action === "approve" ? "approved" : "rejected";
    const now = new Date().toISOString();

    // Update work package
    const { error: updateError } = await supabase
      .from("events")
      .update({
        customer_approval_status: newStatus,
        customer_approved_by: portalUser.full_name || user.email,
        customer_approved_at: now,
      })
      .eq("id", work_package_id);

    if (updateError) throw updateError;

    // Log in activity_log
    await supabase.from("activity_log").insert({
      entity_type: "job",
      entity_id: wp.parent_project_id,
      action: `work_package_${action}d`,
      type: "status_change",
      title: `Arbeidspakke ${action === "approve" ? "godkjent" : "avvist"} av kunde`,
      description: `"${wp.title}" – ${action === "approve" ? "godkjent" : "avvist"} av ${portalUser.full_name || user.email}`,
      performed_by: user.id,
      visibility: "shared",
      metadata: {
        work_package_id: wp.id,
        work_package_type: wp.work_package_type,
        action,
        portal_user_name: portalUser.full_name,
      },
    });

    // If approved and type is additional_work or change, auto-set ready_for_billing
    if (action === "approve" && ["additional_work", "change"].includes(wp.work_package_type)) {
      await supabase
        .from("events")
        .update({ customer_approval_status: "ready_for_billing" })
        .eq("id", work_package_id);
    }

    return new Response(
      JSON.stringify({ ok: true, status: newStatus }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
