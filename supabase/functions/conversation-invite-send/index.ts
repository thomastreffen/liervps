import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate caller
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { thread_id, invited_email, invited_name, invite_type } = await req.json();

    if (!thread_id || !invited_email) {
      return new Response(JSON.stringify({ error: "thread_id and invited_email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get thread
    const { data: thread } = await supabase
      .from("conversation_threads")
      .select("*")
      .eq("id", thread_id)
      .single();

    if (!thread) {
      return new Response(JSON.stringify({ error: "Thread not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check allow_participants_invite
    if (!thread.allow_participants_invite) {
      return new Response(JSON.stringify({ error: "Invitations disabled for this thread" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get caller's user_account_id
    const { data: ua } = await supabase
      .from("user_accounts")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!ua) {
      return new Response(JSON.stringify({ error: "No active user account" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller is participant with invite permission
    const { data: callerParticipant } = await supabase
      .from("conversation_thread_participants")
      .select("*")
      .eq("thread_id", thread_id)
      .eq("user_account_id", ua.id)
      .maybeSingle();

    const isAdmin = await checkIsAdmin(supabase, user.id, thread.project_id);

    const isExternal = invite_type === "external";
    const permKey = isExternal ? "can_invite_external" : "can_invite_internal";

    if (!isAdmin) {
      if (!callerParticipant) {
        return new Response(JSON.stringify({ error: "Not a participant" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!callerParticipant[permKey]) {
        return new Response(JSON.stringify({ error: `No ${permKey} permission` }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check for existing pending invite
    const { data: existing } = await supabase
      .from("conversation_thread_invites")
      .select("id")
      .eq("thread_id", thread_id)
      .eq("invited_email", invited_email.toLowerCase().trim())
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "Invite already pending" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create invite
    const participantId = callerParticipant?.id || ua.id;
    const { data: invite, error: insertErr } = await supabase
      .from("conversation_thread_invites")
      .insert({
        thread_id,
        invited_email: invited_email.toLowerCase().trim(),
        invited_name: invited_name || null,
        invited_by_participant_id: callerParticipant?.id,
        company_id: thread.company_id,
      })
      .select()
      .single();

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send invite email via Graph
    const sent = await sendInviteEmail(supabase, thread, invite, invited_email, invited_name);

    return new Response(
      JSON.stringify({ ok: true, invite_id: invite.id, email_sent: sent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function checkIsAdmin(supabase: any, authUserId: string, projectId: string): Promise<boolean> {
  const { data } = await supabase.rpc("is_project_admin", {
    _auth_user_id: authUserId,
    _project_id: projectId,
  });
  return !!data;
}

async function sendInviteEmail(
  supabase: any,
  thread: any,
  invite: any,
  email: string,
  name?: string
): Promise<boolean> {
  try {
    const azureTenantId = Deno.env.get("AZURE_TENANT_ID");
    const azureClientId = Deno.env.get("AZURE_CLIENT_ID");
    const azureClientSecret = Deno.env.get("AZURE_CLIENT_SECRET");

    if (!azureTenantId || !azureClientId || !azureClientSecret) return false;

    const tokenResp = await fetch(
      `https://login.microsoftonline.com/${azureTenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: azureClientId,
          client_secret: azureClientSecret,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials",
        }),
      }
    );
    const { access_token } = await tokenResp.json();
    if (!access_token) return false;

    const systemUrl = "https://mcsressurs.lovable.app";
    const acceptLink = `${systemUrl}/invite/thread/${invite.invite_token}`;

    const bodyHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px;">
        <h2 style="color: #1a1a1a; font-size: 18px;">Du er invitert til en samtale</h2>
        <p style="color: #374151; font-size: 14px; line-height: 1.6;">
          Du har blitt invitert til samtalen <strong>"${thread.title}"</strong>.
        </p>
        <p style="color: #374151; font-size: 14px;">
          Klikk knappen under for å godta invitasjonen og få tilgang til samtalen.
        </p>
        <div style="margin: 24px 0;">
          <a href="${acceptLink}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Godta invitasjon
          </a>
        </div>
        <p style="font-size: 12px; color: #9ca3af;">
          Denne invitasjonen utløper om 48 timer. Invitasjonen gir kun tilgang til denne samtalen, ikke andre deler av prosjektet.
        </p>
      </div>
    `;

    const systemMailbox = "postkontoret@mcsservice.no";
    const draftResp = await fetch(
      `https://graph.microsoft.com/v1.0/users/${systemMailbox}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: `Invitasjon: ${thread.title}`,
          body: { contentType: "HTML", content: bodyHtml },
          toRecipients: [{ emailAddress: { address: email, name: name || email } }],
        }),
      }
    );

    if (!draftResp.ok) return false;
    const draft = await draftResp.json();

    const sendResp = await fetch(
      `https://graph.microsoft.com/v1.0/users/${systemMailbox}/messages/${draft.id}/send`,
      { method: "POST", headers: { Authorization: `Bearer ${access_token}` } }
    );

    return sendResp.ok;
  } catch {
    return false;
  }
}
