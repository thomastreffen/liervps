import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

async function getAppToken(): Promise<string | null> {
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
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    }
  );
  const d = await resp.json();
  return d.access_token || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const respond = (data: any, status = 200) =>
    new Response(JSON.stringify(data, null, 2), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return respond({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return respond({ error: "Invalid session" }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const msToken = await getAppToken();
    if (!msToken) return respond({ error: "Could not acquire Graph token" }, 500);

    const body = await req.json().catch(() => ({}));
    const action = body.action || "list_inbox";
    const mailboxAddress = body.mailbox || "postkontoret@mcsservice.no";

    // ── ACTION: List latest 10 inbox messages ──
    if (action === "list_inbox") {
      const top = body.top || 10;
      const url = `${GRAPH_BASE}/users/${encodeURIComponent(mailboxAddress)}/mailFolders('Inbox')/messages?$top=${top}&$orderby=receivedDateTime desc&$select=id,subject,receivedDateTime,from,toRecipients,isRead,internetMessageId,conversationId,internetMessageHeaders`;
      
      console.log(`[inbox-debug] Listing inbox: ${url}`);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${msToken}` } });
      
      if (!res.ok) {
        const errText = await res.text();
        return respond({ error: `Graph error ${res.status}`, details: errText.substring(0, 500) });
      }
      
      const data = await res.json();
      const messages = (data.value || []).map((m: any) => ({
        id: m.id,
        subject: m.subject,
        receivedDateTime: m.receivedDateTime,
        from: m.from?.emailAddress?.address,
        fromName: m.from?.emailAddress?.name,
        to: (m.toRecipients || []).map((r: any) => r.emailAddress?.address),
        isRead: m.isRead,
        internetMessageId: m.internetMessageId,
        conversationId: m.conversationId,
        hasThreadToken: (m.toRecipients || []).some((r: any) => /thread\+/i.test(r.emailAddress?.address || "")),
        xMcsHeaders: (m.internetMessageHeaders || [])
          .filter((h: any) => h.name?.toLowerCase().startsWith("x-mcs"))
          .map((h: any) => ({ name: h.name, value: h.value })),
        inReplyTo: (m.internetMessageHeaders || []).find((h: any) => h.name?.toLowerCase() === "in-reply-to")?.value || null,
      }));

      // Check which are already processed
      for (const msg of messages) {
        const { data: caseItem } = await supabaseAdmin
          .from("case_items").select("id, case_id").eq("external_id", msg.id).maybeSingle();
        msg.processed_as_case = caseItem ? { case_item_id: caseItem.id, case_id: caseItem.case_id } : null;

        if (msg.internetMessageId) {
          const { data: convMsg } = await supabaseAdmin
            .from("conversation_email_messages").select("id, thread_id")
            .eq("outlook_internet_message_id", msg.internetMessageId).maybeSingle();
          msg.processed_as_conversation = convMsg ? { email_msg_id: convMsg.id, thread_id: convMsg.thread_id } : null;
        }
      }

      return respond({
        action: "list_inbox",
        mailbox: mailboxAddress,
        count: messages.length,
        messages,
      });
    }

    // ── ACTION: Search mailbox globally ──
    if (action === "search") {
      const query = body.query || "";
      if (!query) return respond({ error: "Missing 'query' parameter" }, 400);
      
      const url = `${GRAPH_BASE}/users/${encodeURIComponent(mailboxAddress)}/messages?$search="${encodeURIComponent(query)}"&$top=10&$select=id,subject,receivedDateTime,from,toRecipients,parentFolderId,isRead,internetMessageId`;
      
      console.log(`[inbox-debug] Searching: ${url}`);
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${msToken}`,
          ConsistencyLevel: "eventual",
        },
      });
      
      if (!res.ok) {
        const errText = await res.text();
        return respond({ error: `Graph search error ${res.status}`, details: errText.substring(0, 500) });
      }
      
      const data = await res.json();
      const messages = (data.value || []).map((m: any) => ({
        id: m.id,
        subject: m.subject,
        receivedDateTime: m.receivedDateTime,
        from: m.from?.emailAddress?.address,
        to: (m.toRecipients || []).map((r: any) => r.emailAddress?.address),
        parentFolderId: m.parentFolderId,
        isRead: m.isRead,
        internetMessageId: m.internetMessageId,
      }));

      return respond({
        action: "search",
        mailbox: mailboxAddress,
        query,
        count: messages.length,
        messages,
      });
    }

    // ── ACTION: List folders ──
    if (action === "list_folders") {
      const url = `${GRAPH_BASE}/users/${encodeURIComponent(mailboxAddress)}/mailFolders?$top=50&$select=id,displayName,totalItemCount,unreadItemCount`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${msToken}` } });
      if (!res.ok) {
        const errText = await res.text();
        return respond({ error: `Graph error ${res.status}`, details: errText.substring(0, 500) });
      }
      const data = await res.json();
      return respond({
        action: "list_folders",
        mailbox: mailboxAddress,
        folders: (data.value || []).map((f: any) => ({
          id: f.id, displayName: f.displayName,
          totalItemCount: f.totalItemCount,
          unreadItemCount: f.unreadItemCount,
        })),
      });
    }

    // ── ACTION: Check delta status ──
    if (action === "delta_status") {
      const { data: mb } = await supabaseAdmin
        .from("mailboxes").select("*").eq("address", mailboxAddress).maybeSingle();
      
      return respond({
        action: "delta_status",
        mailbox: mailboxAddress,
        mailbox_record: mb ? {
          id: mb.id,
          is_enabled: mb.is_enabled,
          has_delta_link: !!mb.graph_delta_link,
          delta_link_preview: mb.graph_delta_link ? mb.graph_delta_link.substring(0, 100) + "..." : null,
          last_sync_at: mb.last_sync_at,
          last_sync_error: mb.last_sync_error,
          last_sync_count: mb.last_sync_count,
        } : null,
      });
    }

    // ── ACTION: Reset delta link ──
    if (action === "reset_delta") {
      await supabaseAdmin.from("mailboxes").update({ graph_delta_link: null }).eq("address", mailboxAddress);
      return respond({ action: "reset_delta", mailbox: mailboxAddress, status: "ok" });
    }

    // ── ACTION: Check specific message ──
    if (action === "check_message") {
      const messageId = body.message_id;
      if (!messageId) return respond({ error: "Missing 'message_id'" }, 400);
      
      const url = `${GRAPH_BASE}/users/${encodeURIComponent(mailboxAddress)}/messages/${messageId}?$select=id,subject,receivedDateTime,from,toRecipients,ccRecipients,parentFolderId,isRead,internetMessageId,conversationId,internetMessageHeaders,body`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${msToken}` } });
      if (!res.ok) {
        const errText = await res.text();
        return respond({ error: `Graph error ${res.status}`, details: errText.substring(0, 500) });
      }
      const msg = await res.json();
      
      // Get folder name
      let folderName = "unknown";
      if (msg.parentFolderId) {
        const fRes = await fetch(
          `${GRAPH_BASE}/users/${encodeURIComponent(mailboxAddress)}/mailFolders/${msg.parentFolderId}?$select=displayName`,
          { headers: { Authorization: `Bearer ${msToken}` } }
        );
        if (fRes.ok) {
          const fData = await fRes.json();
          folderName = fData.displayName;
        }
      }

      return respond({
        action: "check_message",
        mailbox: mailboxAddress,
        message: {
          id: msg.id,
          subject: msg.subject,
          receivedDateTime: msg.receivedDateTime,
          from: msg.from?.emailAddress,
          to: (msg.toRecipients || []).map((r: any) => r.emailAddress),
          cc: (msg.ccRecipients || []).map((r: any) => r.emailAddress),
          parentFolderId: msg.parentFolderId,
          folderName,
          isRead: msg.isRead,
          internetMessageId: msg.internetMessageId,
          conversationId: msg.conversationId,
          bodyPreview: (msg.body?.content || "").substring(0, 300),
          headers: (msg.internetMessageHeaders || [])
            .filter((h: any) => 
              h.name?.toLowerCase().startsWith("x-mcs") ||
              h.name?.toLowerCase() === "in-reply-to" ||
              h.name?.toLowerCase() === "references" ||
              h.name?.toLowerCase() === "x-original-to" ||
              h.name?.toLowerCase().includes("original-recipients")
            ),
        },
      });
    }

    return respond({ error: `Unknown action: ${action}. Supported: list_inbox, search, list_folders, delta_status, reset_delta, check_message` }, 400);
  } catch (err) {
    console.error("[inbox-debug] Error:", err);
    return respond({ error: String(err) }, 500);
  }
});
