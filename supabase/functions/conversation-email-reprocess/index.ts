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
    const { dead_letter_id } = await req.json();
    if (!dead_letter_id) {
      return new Response(JSON.stringify({ error: "dead_letter_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch dead letter
    const { data: dl, error: dlErr } = await supabase
      .from("conversation_email_dead_letters")
      .select("*")
      .eq("id", dead_letter_id)
      .single();

    if (dlErr || !dl) {
      return new Response(JSON.stringify({ error: "Dead letter not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (dl.status === "reprocessed") {
      return new Response(JSON.stringify({ error: "Already reprocessed" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Graph token to re-fetch message if needed
    const tenantId = Deno.env.get("AZURE_TENANT_ID");
    const clientId = Deno.env.get("AZURE_CLIENT_ID");
    const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET");

    let accessToken: string | null = null;
    if (tenantId && clientId && clientSecret) {
      const tokenResp = await fetch(
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
      const td = await tokenResp.json();
      accessToken = td.access_token || null;
    }

    const newAttempt = (dl.attempt_count || 0) + 1;

    try {
      // Try to fetch the message from Graph if we have a resource URL
      let message: any = null;
      const resourceUrl = dl.raw_payload?.resource || dl.raw_payload?._fetched_message_id;

      if (resourceUrl && accessToken) {
        const msgResp = await fetch(`https://graph.microsoft.com/v1.0/${resourceUrl}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (msgResp.ok) {
          message = await msgResp.json();
        } else {
          await msgResp.text();
        }
      }

      // If we can't fetch from Graph, try using graph_message_id
      if (!message && dl.graph_message_id && accessToken) {
        // Try as a direct resource path
        const msgResp = await fetch(`https://graph.microsoft.com/v1.0/${dl.graph_message_id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (msgResp.ok) {
          message = await msgResp.json();
        } else {
          await msgResp.text();
        }
      }

      if (!message) {
        throw new Error("Could not fetch message from Graph for reprocessing");
      }

      // ── Run the same matching logic as the webhook ──
      const internetMessageId = message.internetMessageId;

      // Idempotency
      if (internetMessageId) {
        const { data: existing } = await supabase
          .from("conversation_email_messages")
          .select("id")
          .eq("outlook_internet_message_id", internetMessageId)
          .maybeSingle();
        if (existing) {
          await supabase.from("conversation_email_dead_letters").update({
            status: "reprocessed", attempt_count: newAttempt,
            error: "Already processed (duplicate found)", updated_at: new Date().toISOString(),
          }).eq("id", dead_letter_id);
          return new Response(JSON.stringify({ status: "duplicate", message: "Already processed" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Find thread
      let threadId: string | null = null;
      let thread: any = null;

      // Strategy 1: Extended properties
      for (const prop of message.singleValueExtendedProperties || []) {
        if (prop.id?.includes("X-MCS-THREAD") && prop.value) {
          const { data } = await supabase.from("conversation_threads").select("*").eq("id", prop.value).single();
          if (data) { thread = data; threadId = data.id; }
          break;
        }
      }

      // Strategy 1b: Internet headers
      if (!threadId) {
        for (const h of message.internetMessageHeaders || []) {
          if (h.name === "X-MCS-Thread-Token" && h.value) {
            const { data } = await supabase.from("conversation_threads").select("*").eq("inbound_token", h.value).maybeSingle();
            if (data) { thread = data; threadId = data.id; }
            break;
          }
        }
      }

      // Strategy 2: Reply-To token
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

      // Strategy 3: conversationId
      if (!threadId && message.conversationId) {
        const { data } = await supabase.from("conversation_threads").select("*")
          .eq("email_thread_id", message.conversationId).maybeSingle();
        if (data) { thread = data; threadId = data.id; }
      }

      // Strategy 4: email_messages conversationId
      if (!threadId && message.conversationId) {
        const { data: em } = await supabase.from("conversation_email_messages").select("thread_id")
          .eq("outlook_conversation_id", message.conversationId).limit(1).maybeSingle();
        if (em) {
          threadId = em.thread_id;
          const { data } = await supabase.from("conversation_threads").select("*").eq("id", threadId).single();
          thread = data;
        }
      }

      if (!threadId || !thread) {
        throw new Error("No matching thread found");
      }

      const senderEmail = message.from?.emailAddress?.address?.toLowerCase();
      const senderName = message.from?.emailAddress?.name || senderEmail;

      // Reopen if closed
      if (thread.status === "closed") {
        await supabase.from("conversation_threads")
          .update({ status: "open", closed_at: null, closed_by: null }).eq("id", threadId);
        await supabase.from("conversation_posts").insert({
          thread_id: threadId, company_id: thread.company_id,
          post_type: "system",
          body_text: `Tråden ble gjenåpnet av reprocessert e-post fra ${senderName}`,
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

      // Handle attachments
      if (message.hasAttachments && post && accessToken && resourceUrl) {
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
                  .from("conversation-files").upload(filePath, bytes, { contentType: att.contentType });
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
          console.error("Reprocess attachment error:", attErr);
        }
      }

      // Log email
      await supabase.from("conversation_email_messages").insert({
        company_id: thread.company_id, thread_id: threadId,
        post_id: post?.id || null, direction: "inbound", provider: "graph",
        outlook_message_id: message.id,
        outlook_conversation_id: message.conversationId || null,
        outlook_internet_message_id: internetMessageId || null,
        subject: message.subject, from_email: senderEmail,
        to_emails: (message.toRecipients || []).map((r: any) => r.emailAddress?.address),
        status: "received", processing_status: "ok",
        processed_at: new Date().toISOString(),
      });

      // Mark dead letter as reprocessed
      await supabase.from("conversation_email_dead_letters").update({
        status: "reprocessed", attempt_count: newAttempt,
        error: null, updated_at: new Date().toISOString(),
      }).eq("id", dead_letter_id);

      return new Response(JSON.stringify({ status: "reprocessed", thread_id: threadId, post_id: post?.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (processErr: any) {
      // Update dead letter with new error
      const newStatus = newAttempt >= 5 ? "failed" : "pending";
      await supabase.from("conversation_email_dead_letters").update({
        status: newStatus, attempt_count: newAttempt,
        error: String(processErr), updated_at: new Date().toISOString(),
      }).eq("id", dead_letter_id);

      return new Response(JSON.stringify({ error: String(processErr), attempt: newAttempt, status: newStatus }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("Reprocess error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
