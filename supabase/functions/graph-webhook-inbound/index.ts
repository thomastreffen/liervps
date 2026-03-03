import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function getGraphToken() {
  const tenantId = Deno.env.get("AZURE_TENANT_ID");
  const clientId = Deno.env.get("AZURE_CLIENT_ID");
  const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET");
  if (!tenantId || !clientId || !clientSecret) return null;
  const resp = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId, client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials",
      }),
    }
  );
  const d = await resp.json();
  return d.access_token || null;
}

/** Core processing logic shared with reprocess function */
async function processMessage(
  message: any,
  supabase: any,
  companyIdHint: string | null,
) {
  const internetMessageId = message.internetMessageId;

  // Idempotency
  if (internetMessageId) {
    const { data: existing } = await supabase
      .from("conversation_email_messages")
      .select("id")
      .eq("outlook_internet_message_id", internetMessageId)
      .maybeSingle();
    if (existing) return { skipped: true, reason: "duplicate" };
  }

  // ── Find thread ──
  let threadId: string | null = null;
  let thread: any = null;

  // Strategy 1: X-MCS-THREAD extended property
  for (const prop of message.singleValueExtendedProperties || []) {
    if (prop.id?.includes("X-MCS-THREAD") && prop.value) {
      const { data } = await supabase.from("conversation_threads").select("*").eq("id", prop.value).single();
      if (data) { thread = data; threadId = data.id; }
      break;
    }
  }

  // Strategy 1b: X-MCS-Thread-Token internet header
  if (!threadId) {
    for (const h of message.internetMessageHeaders || []) {
      if (h.name === "X-MCS-Thread-Token" && h.value) {
        const { data } = await supabase.from("conversation_threads").select("*").eq("inbound_token", h.value).maybeSingle();
        if (data) { thread = data; threadId = data.id; }
        break;
      }
    }
  }

  // Strategy 2: Reply-To / To token
  if (!threadId) {
    const replyTo = message.replyTo?.[0]?.emailAddress?.address || "";
    const toAddrs = (message.toRecipients || []).map((r: any) => r.emailAddress?.address || "");
    const all = [replyTo, ...toAddrs].join(" ");
    const m = all.match(/thread\+([a-f0-9-]+)@/i);
    if (m) {
      const { data } = await supabase.from("conversation_threads").select("*")
        .or(`inbound_token.eq.${m[1]},id.eq.${m[1]}`).maybeSingle();
      if (data) { thread = data; threadId = data.id; }
    }
  }

  // Strategy 3: conversationId → thread
  if (!threadId && message.conversationId) {
    const { data } = await supabase.from("conversation_threads").select("*")
      .eq("email_thread_id", message.conversationId).maybeSingle();
    if (data) { thread = data; threadId = data.id; }
  }

  // Strategy 4: conversationId → email_messages
  if (!threadId && message.conversationId) {
    const { data: em } = await supabase.from("conversation_email_messages").select("thread_id")
      .eq("outlook_conversation_id", message.conversationId).limit(1).maybeSingle();
    if (em) {
      threadId = em.thread_id;
      const { data } = await supabase.from("conversation_threads").select("*").eq("id", threadId).single();
      thread = data;
    }
  }

  // Strategy 5: Subject [JOB-XXXXXX] fallback
  if (!threadId && message.subject) {
    const sm = message.subject.match(/\[JOB-(\d+)\]/);
    if (sm) {
      const { data: proj } = await supabase.from("events").select("id").eq("internal_number", `JOB-${sm[1]}`).maybeSingle();
      if (proj) {
        const { data: t } = await supabase.from("conversation_threads").select("*")
          .eq("project_id", proj.id).eq("email_enabled", true)
          .order("last_activity_at", { ascending: false }).limit(1).maybeSingle();
        if (t) { thread = t; threadId = t.id; }
      }
    }
  }

  if (!threadId || !thread) {
    // Log as ignored
    await supabase.from("conversation_email_messages").insert({
      company_id: companyIdHint || "00000000-0000-0000-0000-000000000000",
      thread_id: "00000000-0000-0000-0000-000000000000",
      direction: "inbound", provider: "graph",
      outlook_message_id: message.id,
      outlook_conversation_id: message.conversationId || null,
      outlook_internet_message_id: internetMessageId || null,
      subject: message.subject,
      from_email: message.from?.emailAddress?.address,
      to_emails: (message.toRecipients || []).map((r: any) => r.emailAddress?.address),
      status: "ignored", error: "No matching thread found",
      processing_status: "ignored",
    }).catch(() => {});
    throw new Error("No matching thread found");
  }

  const senderEmail = message.from?.emailAddress?.address?.toLowerCase();
  const senderName = message.from?.emailAddress?.name || senderEmail;

  // Reopen closed thread
  if (thread.status === "closed") {
    await supabase.from("conversation_threads")
      .update({ status: "open", closed_at: null, closed_by: null }).eq("id", threadId);
    await supabase.from("conversation_posts").insert({
      thread_id: threadId, company_id: thread.company_id,
      post_type: "system",
      body_text: `Tråden ble gjenåpnet av innkommende e-post fra ${senderName}`,
    });
  }

  // Create post
  const { data: post } = await supabase.from("conversation_posts").insert({
    thread_id: threadId, company_id: thread.company_id,
    post_type: "email", subject: message.subject,
    body_html: message.body?.content || "",
    body_text: message.bodyPreview || "",
    from_email: senderEmail, from_name: senderName,
    to_emails: (message.toRecipients || []).map((r: any) => r.emailAddress?.address),
    cc_emails: (message.ccRecipients || []).map((r: any) => r.emailAddress?.address),
    sent_at: message.receivedDateTime || new Date().toISOString(),
    direction: "inbound",
    outlook_message_id: message.id,
    outlook_weblink: message.webLink || null,
  }).select("id").single();

  return { threadId, thread, post, senderEmail, internetMessageId, message };
}

Deno.serve(async (req) => {
  // Graph validation handshake
  const url = new URL(req.url);
  const validationToken = url.searchParams.get("validationToken");
  if (validationToken) {
    return new Response(validationToken, { headers: { "Content-Type": "text/plain" } });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const webhookReceivedAt = new Date();

  try {
    const body = await req.json();
    const notifications = body.value || [];

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const accessToken = await getGraphToken();
    if (!accessToken) {
      console.error("Missing Azure credentials for inbound webhook");
      return new Response(JSON.stringify({ error: "Missing Azure credentials" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;

    for (const notification of notifications) {
      const notifStart = Date.now();
      let companyId: string | null = null;

      try {
        // ── Validate subscription + clientState ──
        const clientState = notification.clientState;
        if (clientState) {
          companyId = clientState.replace("mcs-", "");
          const { data: subRecord } = await supabase
            .from("ms_graph_subscriptions")
            .select("id, company_id")
            .eq("subscription_id", notification.subscriptionId || "")
            .eq("client_state", clientState)
            .eq("status", "active")
            .maybeSingle();

          if (!subRecord) {
            console.warn("ClientState mismatch or unknown subscription:", notification.subscriptionId);
            // Dead letter – unknown subscription
            await supabase.from("conversation_email_dead_letters").insert({
              company_id: companyId,
              subscription_id: notification.subscriptionId,
              raw_payload: notification,
              error: "Unknown subscription or clientState mismatch",
              status: "pending",
            });
            continue;
          }
          companyId = subRecord.company_id;
        }

        const resourceUrl = notification.resource;
        if (!resourceUrl) continue;

        // Fetch message from Graph
        const msgResp = await fetch(`https://graph.microsoft.com/v1.0/${resourceUrl}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!msgResp.ok) {
          const errText = await msgResp.text();
          console.error(`Failed to fetch message: ${msgResp.status}`);
          await supabase.from("conversation_email_dead_letters").insert({
            company_id: companyId,
            subscription_id: notification.subscriptionId,
            raw_payload: notification,
            error: `Graph fetch failed: ${msgResp.status} ${errText.slice(0, 500)}`,
            status: "pending",
          });
          continue;
        }

        const message = await msgResp.json();

        // Check idempotency before heavy processing
        if (message.internetMessageId) {
          const { data: dup } = await supabase
            .from("conversation_email_messages")
            .select("id").eq("outlook_internet_message_id", message.internetMessageId).maybeSingle();
          if (dup) {
            console.log(`Already processed: ${message.internetMessageId}`);
            continue;
          }
          // Also check dead letters to avoid duplicates there
          const { data: dlDup } = await supabase
            .from("conversation_email_dead_letters")
            .select("id").eq("internet_message_id", message.internetMessageId).maybeSingle();
          if (dlDup) {
            console.log(`Already in dead letters: ${message.internetMessageId}`);
            continue;
          }
        }

        // ── Process message ──
        const result = await processMessage(message, supabase, companyId);

        if (result.skipped) {
          // Duplicate – already logged
          continue;
        }

        const { threadId, thread, post } = result;

        // Handle attachments
        if (message.hasAttachments && post) {
          try {
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
                  const { error: upErr } = await supabase.storage
                    .from("conversation-files")
                    .upload(filePath, bytes, { contentType: att.contentType });
                  if (!upErr) {
                    await supabase.from("conversation_attachments").insert({
                      post_id: post.id, file_name: att.name,
                      file_size: att.size || bytes.length,
                      mime_type: att.contentType || null, storage_path: filePath,
                    });
                  }
                }
              }
            } else {
              await attResp.text();
            }
          } catch (attErr) {
            console.error("Attachment processing error:", attErr);
          }
        }

        const processingMs = Date.now() - notifStart;

        // Log email message with observability
        await supabase.from("conversation_email_messages").insert({
          company_id: thread.company_id, thread_id: threadId,
          post_id: post?.id || null, direction: "inbound", provider: "graph",
          outlook_message_id: message.id,
          outlook_conversation_id: message.conversationId || null,
          outlook_internet_message_id: message.internetMessageId || null,
          subject: message.subject,
          from_email: message.from?.emailAddress?.address,
          to_emails: (message.toRecipients || []).map((r: any) => r.emailAddress?.address),
          cc_emails: (message.ccRecipients || []).map((r: any) => r.emailAddress?.address),
          status: "received",
          processing_status: "ok",
          webhook_received_at: webhookReceivedAt.toISOString(),
          processed_at: new Date().toISOString(),
          processing_duration_ms: processingMs,
        });

        processed++;
      } catch (notifErr: any) {
        console.error("Error processing notification:", notifErr);

        // ── Dead letter ──
        const rawPayload = {
          ...notification,
          _fetched_message_id: notification.resource,
        };
        await supabase.from("conversation_email_dead_letters").insert({
          company_id: companyId,
          subscription_id: notification.subscriptionId || null,
          raw_payload: rawPayload,
          graph_message_id: notification.resource || null,
          error: String(notifErr),
          status: "pending",
        }).catch((dlErr: any) => console.error("Failed to write dead letter:", dlErr));
      }
    }

    // Always return 200 to Graph to prevent retry storms
    return new Response(
      JSON.stringify({ processed, total: notifications.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Inbound webhook error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

export { processMessage };
