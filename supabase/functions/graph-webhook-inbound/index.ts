import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle Graph validation token
  const url = new URL(req.url);
  const validationToken = url.searchParams.get("validationToken");
  if (validationToken) {
    return new Response(validationToken, {
      headers: { "Content-Type": "text/plain" },
    });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const notifications = body.value || [];

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const azureTenantId = Deno.env.get("AZURE_TENANT_ID");
    const azureClientId = Deno.env.get("AZURE_CLIENT_ID");
    const azureClientSecret = Deno.env.get("AZURE_CLIENT_SECRET");

    if (!azureTenantId || !azureClientId || !azureClientSecret) {
      console.error("Missing Azure credentials for inbound webhook");
      return new Response(JSON.stringify({ error: "Missing Azure credentials" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Graph access token
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
      console.error("Failed to acquire Graph token for inbound");
      return new Response(JSON.stringify({ error: "Token failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemMailbox = "postkontoret@mcsservice.no";
    let processed = 0;

    for (const notification of notifications) {
      try {
        const resourceUrl = notification.resource;
        if (!resourceUrl) continue;

        // Fetch the message from Graph
        const msgResp = await fetch(
          `https://graph.microsoft.com/v1.0/${resourceUrl}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!msgResp.ok) {
          console.error(`Failed to fetch message: ${msgResp.status}`);
          await msgResp.text();
          continue;
        }

        const message = await msgResp.json();
        const internetMessageId = message.internetMessageId;

        // Idempotency check
        if (internetMessageId) {
          const { data: existing } = await supabase
            .from("conversation_email_messages")
            .select("id")
            .eq("outlook_internet_message_id", internetMessageId)
            .maybeSingle();

          if (existing) {
            console.log(`Already processed: ${internetMessageId}`);
            continue;
          }
        }

        // Find thread via multiple strategies
        let threadId: string | null = null;
        let thread: any = null;

        // Strategy 1: Check custom header X-MCS-THREAD
        const singleValueProps = message.singleValueExtendedProperties || [];
        for (const prop of singleValueProps) {
          if (prop.id?.includes("X-MCS-THREAD") && prop.value) {
            const { data } = await supabase
              .from("conversation_threads")
              .select("*")
              .eq("id", prop.value)
              .single();
            if (data) { thread = data; threadId = data.id; }
            break;
          }
        }

        // Strategy 2: Check reply-to address for inbound_token
        if (!threadId) {
          const replyTo = message.replyTo?.[0]?.emailAddress?.address || "";
          const tokenMatch = replyTo.match(/thread\+([a-f0-9-]+)@/i);
          if (tokenMatch) {
            const token = tokenMatch[1];
            const { data } = await supabase
              .from("conversation_threads")
              .select("*")
              .or(`inbound_token.eq.${token},id.eq.${token}`)
              .maybeSingle();
            if (data) { thread = data; threadId = data.id; }
          }
        }

        // Strategy 3: Match via conversationId
        if (!threadId && message.conversationId) {
          const { data } = await supabase
            .from("conversation_threads")
            .select("*")
            .eq("email_thread_id", message.conversationId)
            .maybeSingle();
          if (data) { thread = data; threadId = data.id; }
        }

        // Strategy 4: Check conversation_email_messages for matching conversationId
        if (!threadId && message.conversationId) {
          const { data: emailMsg } = await supabase
            .from("conversation_email_messages")
            .select("thread_id")
            .eq("outlook_conversation_id", message.conversationId)
            .limit(1)
            .maybeSingle();
          if (emailMsg) {
            threadId = emailMsg.thread_id;
            const { data } = await supabase
              .from("conversation_threads")
              .select("*")
              .eq("id", threadId)
              .single();
            thread = data;
          }
        }

        if (!threadId || !thread) {
          console.log("Could not match inbound email to thread, skipping");
          // Log as ignored
          await supabase.from("conversation_email_messages").insert({
            company_id: thread?.company_id || "00000000-0000-0000-0000-000000000000",
            thread_id: thread?.id || "00000000-0000-0000-0000-000000000000",
            direction: "inbound",
            provider: "graph",
            outlook_message_id: message.id,
            outlook_conversation_id: message.conversationId || null,
            outlook_internet_message_id: internetMessageId || null,
            subject: message.subject,
            from_email: message.from?.emailAddress?.address,
            to_emails: (message.toRecipients || []).map((r: any) => r.emailAddress?.address),
            status: "ignored",
            error: "No matching thread found",
          }).then(() => {}).catch(() => {});
          continue;
        }

        // Validate sender is a participant or has access
        const senderEmail = message.from?.emailAddress?.address?.toLowerCase();
        const senderName = message.from?.emailAddress?.name || senderEmail;

        // Sanitize body
        const bodyContent = message.body?.content || "";
        const bodyText = message.bodyPreview || "";

        // If thread was closed, reopen it
        if (thread.status === "closed") {
          await supabase
            .from("conversation_threads")
            .update({ status: "open", closed_at: null, closed_by: null })
            .eq("id", threadId);

          // System post about reopening
          await supabase.from("conversation_posts").insert({
            thread_id: threadId,
            company_id: thread.company_id,
            post_type: "system",
            body_text: `Tråden ble gjenåpnet av innkommende e-post fra ${senderName}`,
          });
        }

        // Create conversation_post
        const { data: post } = await supabase
          .from("conversation_posts")
          .insert({
            thread_id: threadId,
            company_id: thread.company_id,
            post_type: "email",
            subject: message.subject,
            body_html: bodyContent,
            body_text: bodyText,
            from_email: senderEmail,
            from_name: senderName,
            to_emails: (message.toRecipients || []).map((r: any) => r.emailAddress?.address),
            cc_emails: (message.ccRecipients || []).map((r: any) => r.emailAddress?.address),
            sent_at: message.receivedDateTime || new Date().toISOString(),
            direction: "inbound",
            outlook_message_id: message.id,
            outlook_weblink: message.webLink || null,
          })
          .select("id")
          .single();

        // Handle attachments
        if (message.hasAttachments && post) {
          const attResp = await fetch(
            `https://graph.microsoft.com/v1.0/${resourceUrl}/attachments`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          if (attResp.ok) {
            const attData = await attResp.json();
            for (const att of attData.value || []) {
              if (att["@odata.type"] === "#microsoft.graph.fileAttachment" && att.contentBytes) {
                const bytes = Uint8Array.from(atob(att.contentBytes), c => c.charCodeAt(0));
                const filePath = `${thread.company_id}/${thread.project_id}/${threadId}/${Date.now()}_${att.name}`;

                const { error: uploadErr } = await supabase.storage
                  .from("conversation-files")
                  .upload(filePath, bytes, { contentType: att.contentType });

                if (!uploadErr) {
                  await supabase.from("conversation_attachments").insert({
                    post_id: post.id,
                    file_name: att.name,
                    file_size: att.size || bytes.length,
                    mime_type: att.contentType || null,
                    storage_path: filePath,
                  });
                }
              }
            }
          } else {
            await attResp.text();
          }
        }

        // Log inbound email
        await supabase.from("conversation_email_messages").insert({
          company_id: thread.company_id,
          thread_id: threadId,
          post_id: post?.id || null,
          direction: "inbound",
          provider: "graph",
          outlook_message_id: message.id,
          outlook_conversation_id: message.conversationId || null,
          outlook_internet_message_id: internetMessageId || null,
          subject: message.subject,
          from_email: senderEmail,
          to_emails: (message.toRecipients || []).map((r: any) => r.emailAddress?.address),
          cc_emails: (message.ccRecipients || []).map((r: any) => r.emailAddress?.address),
          status: "received",
        });

        processed++;
      } catch (notifErr) {
        console.error("Error processing notification:", notifErr);
      }
    }

    return new Response(
      JSON.stringify({ processed, total: notifications.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Inbound webhook error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
