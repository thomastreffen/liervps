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
    const { post_id } = await req.json();
    if (!post_id) {
      return new Response(JSON.stringify({ error: "post_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Get post
    const { data: post, error: postErr } = await supabase
      .from("conversation_posts")
      .select("*")
      .eq("id", post_id)
      .single();

    if (postErr || !post) {
      return new Response(JSON.stringify({ error: "Post not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get thread
    const { data: thread } = await supabase
      .from("conversation_threads")
      .select("*")
      .eq("id", post.thread_id)
      .single();

    if (!thread || !thread.email_enabled) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "email_disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Get participants with receive_email = true, excluding the author
    const { data: participants } = await supabase
      .from("conversation_thread_participants")
      .select("*, user_accounts:user_account_id(id, people:person_id(full_name, email))")
      .eq("thread_id", thread.id)
      .eq("receive_email", true);

    const recipientEmails: string[] = [];
    for (const p of participants || []) {
      // Skip the author
      if (p.user_account_id && p.user_account_id === post.author_id) continue;

      if (p.participant_type === "external" && p.email) {
        recipientEmails.push(p.email);
      } else if (p.user_accounts?.people?.email) {
        const person = Array.isArray(p.user_accounts.people)
          ? p.user_accounts.people[0]
          : p.user_accounts.people;
        if (person?.email) recipientEmails.push(person.email);
      }
    }

    if (recipientEmails.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no_recipients" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Get project info for subject line
    const { data: project } = await supabase
      .from("events")
      .select("title, internal_number, customer_id, customers:customer_id(name)")
      .eq("id", thread.project_id)
      .single();

    const jobRef = project?.internal_number || "";
    const customerName =
      (Array.isArray(project?.customers)
        ? project.customers[0]?.name
        : (project?.customers as any)?.name) || "";
    const subject =
      thread.email_subject ||
      `[${jobRef}] ${customerName ? customerName + " | " : ""}${thread.title}`;

    // 5. Build email body
    const systemUrl = Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", "")
      || "https://mcsressurs.lovable.app";
    const threadLink = `${systemUrl}/projects/${thread.project_id}/conversations/${thread.id}`;

    const bodyHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px;">
        <p style="color: #374151; font-size: 14px; line-height: 1.6;">
          ${post.body_html || (post.body_text || "").replace(/\n/g, "<br/>")}
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
        <p style="font-size: 12px; color: #9ca3af;">
          Denne meldingen ble sendt fra prosjektsamtalen "${thread.title}".
          <br/>
          <a href="${threadLink}" style="color: #2563eb;">Åpne i systemet →</a>
        </p>
      </div>
    `;

    // 6. Send via Microsoft Graph
    const azureTenantId = Deno.env.get("AZURE_TENANT_ID");
    const azureClientId = Deno.env.get("AZURE_CLIENT_ID");
    const azureClientSecret = Deno.env.get("AZURE_CLIENT_SECRET");

    if (!azureTenantId || !azureClientId || !azureClientSecret) {
      // Log as failed
      await supabase.from("conversation_email_messages").insert({
        company_id: thread.company_id,
        thread_id: thread.id,
        post_id: post.id,
        direction: "outbound",
        subject,
        to_emails: recipientEmails,
        status: "failed",
        error: "Missing Azure credentials",
      });
      return new Response(
        JSON.stringify({ error: "Azure credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get access token
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
    const tokenData = await tokenResp.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      await supabase.from("conversation_email_messages").insert({
        company_id: thread.company_id,
        thread_id: thread.id,
        post_id: post.id,
        direction: "outbound",
        subject,
        to_emails: recipientEmails,
        status: "failed",
        error: "Token acquisition failed",
      });
      return new Response(
        JSON.stringify({ error: "Failed to get Graph token" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TODO: Replace with system mailbox UPN
    const systemMailbox = "postkontoret@mcsservice.no";

    // Create draft
    const draftResp = await fetch(
      `https://graph.microsoft.com/v1.0/users/${systemMailbox}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject,
          body: { contentType: "HTML", content: bodyHtml },
          toRecipients: recipientEmails.map((e) => ({
            emailAddress: { address: e },
          })),
          replyTo: [
            {
              emailAddress: {
                address: `thread+${thread.inbound_token || thread.id}@mcsservice.no`,
                name: thread.title,
              },
            },
          ],
          singleValueExtendedProperties: [
            {
              id: "String {00020386-0000-0000-C000-000000000046} Name X-MCS-THREAD",
              value: thread.id,
            },
          ],
        }),
      }
    );

    if (!draftResp.ok) {
      const errText = await draftResp.text();
      await supabase.from("conversation_email_messages").insert({
        company_id: thread.company_id,
        thread_id: thread.id,
        post_id: post.id,
        direction: "outbound",
        subject,
        to_emails: recipientEmails,
        status: "failed",
        error: `Draft failed: ${errText}`,
      });
      return new Response(
        JSON.stringify({ error: "Draft creation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const draft = await draftResp.json();

    // Send
    const sendResp = await fetch(
      `https://graph.microsoft.com/v1.0/users/${systemMailbox}/messages/${draft.id}/send`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const status = sendResp.ok ? "sent" : "failed";
    const error = sendResp.ok ? null : await sendResp.text();

    // Log
    await supabase.from("conversation_email_messages").insert({
      company_id: thread.company_id,
      thread_id: thread.id,
      post_id: post.id,
      direction: "outbound",
      provider: "graph",
      outlook_message_id: draft.id,
      outlook_conversation_id: draft.conversationId || null,
      outlook_internet_message_id: draft.internetMessageId || null,
      subject,
      from_email: systemMailbox,
      to_emails: recipientEmails,
      status,
      error,
    });

    // Update thread
    await supabase
      .from("conversation_threads")
      .update({
        last_emailed_at: new Date().toISOString(),
        email_subject: subject,
        email_thread_id: draft.conversationId || thread.email_thread_id,
      })
      .eq("id", thread.id);

    return new Response(
      JSON.stringify({ sent: true, recipients: recipientEmails.length, status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
