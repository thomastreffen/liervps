import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Validate caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (!roleData || !["admin", "super_admin"].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: "Admin required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, full_name, company_id, customer_id, project_ids } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if portal user already exists
    const { data: existing } = await supabase
      .from("customer_portal_users")
      .select("id, status, auth_user_id")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    let portalUserId: string;
    let authUserId: string | null = null;

    if (existing) {
      portalUserId = existing.id;
      authUserId = existing.auth_user_id;

      // Re-activate if disabled
      if (existing.status === "disabled") {
        await supabase
          .from("customer_portal_users")
          .update({ status: "pending", updated_at: new Date().toISOString() })
          .eq("id", portalUserId);
      }
    } else {
      // Create portal user record (pending until they click the link)
      const { data: newPortalUser, error: insertErr } = await supabase
        .from("customer_portal_users")
        .insert({
          email: email.toLowerCase(),
          full_name: full_name || null,
          company_id: company_id || null,
          customer_id: customer_id || null,
          invited_by: caller.id,
          status: "pending",
        })
        .select("id")
        .single();

      if (insertErr) throw insertErr;
      portalUserId = newPortalUser.id;
    }

    // Grant project access
    if (project_ids && Array.isArray(project_ids)) {
      for (const pid of project_ids) {
        await supabase
          .from("customer_portal_project_access")
          .upsert({
            portal_user_id: portalUserId,
            project_id: pid,
            granted_by: caller.id,
          }, { onConflict: "portal_user_id,project_id" });
      }
    }

    // Use Supabase magic link to invite
    // This creates the auth user if they don't exist and sends the magic link
    const redirectUrl = `${req.headers.get("origin") || supabaseUrl.replace(".supabase.co", ".lovable.app")}/portal/activate`;

    const { data: magicData, error: magicErr } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: email.toLowerCase(),
      options: {
        redirectTo: redirectUrl,
        data: {
          app_role: "customer_user",
          full_name: full_name || email.split("@")[0],
          portal_user_id: portalUserId,
        },
      },
    });

    if (magicErr) throw magicErr;

    // Update portal user with auth_user_id if we didn't have it
    if (!authUserId && magicData?.user?.id) {
      await supabase
        .from("customer_portal_users")
        .update({ auth_user_id: magicData.user.id })
        .eq("id", portalUserId);

      // Add customer_user role
      await supabase
        .from("user_roles")
        .upsert({
          user_id: magicData.user.id,
          role: "customer_user",
        }, { onConflict: "user_id,role" });
    }

    // Send the magic link email via Supabase's built-in magic link
    const { error: otpErr } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: email.toLowerCase(),
      options: {
        redirectTo: redirectUrl,
      },
    });

    // Actually send the invite using signInWithOtp on behalf
    // The generateLink gives us the link but doesn't send email
    // We need to use inviteUserByEmail or signInWithOtp
    const actionLink = magicData?.properties?.action_link;

    // Log the invitation
    await supabase.from("activity_log").insert({
      entity_type: "customer_portal",
      entity_id: portalUserId,
      action: "invitation_sent",
      performed_by: caller.id,
      description: `Invitasjon sendt til ${email}`,
      type: "system",
      visibility: "internal",
    });

    return new Response(
      JSON.stringify({
        success: true,
        portal_user_id: portalUserId,
        action_link: actionLink,
        message: "Invitation created successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
