/**
 * order-message-email-send
 * 
 * Sends email notification to an internal participant when addressed in an order message.
 * Uses Microsoft Graph API via the system mailbox (postkontoret@mcsservice.no).
 * 
 * Reply-to: order-msg+{participant_inbound_token}@mcsservice.no
 * X-MCS-Order-Msg-Token header for robust inbound matching
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const MAILBOX = "postkontoret@mcsservice.no";
const DOMAIN = "mcsservice.no";

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function getGraphToken(): Promise<string | null> {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { message_id } = body;

    if (!message_id) return json({ error: "message_id required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch the message with participant info
    const { data: message, error: msgErr } = await supabase
      .from("order_form_messages")
      .select("*")
      .eq("id", message_id)
      .single();

    if (msgErr || !message) {
      console.error("MESSAGE_NOT_FOUND", { message_id, error: msgErr?.message });
      return json({ error: "Message not found" }, 404);
    }

    if (!message.addressed_to_participant_id) {
      console.log("NO_ADDRESSED_PARTICIPANT", { message_id });
      return json({ skipped: true, reason: "no_addressed_participant" });
    }

    // Get the addressed participant
    const { data: participant } = await supabase
      .from("order_form_participants")
      .select("*")
      .eq("id", message.addressed_to_participant_id)
      .single();

    if (!participant || participant.participant_type !== "internal_user" || !participant.user_id) {
      console.log("SKIP_NON_INTERNAL", { participant_type: participant?.participant_type });
      return json({ skipped: true, reason: "not_internal_user" });
    }

    if (!participant.receives_notifications) {
      console.log("SKIP_NOTIFICATIONS_OFF", { participant_id: participant.id });
      return json({ skipped: true, reason: "notifications_off" });
    }

    // Get participant's email from people table via user_accounts
    const { data: userAccount } = await supabase
      .from("user_accounts")
      .select("id, people:people!user_accounts_person_id_fkey(full_name, email)")
      .eq("auth_user_id", participant.user_id)
      .eq("is_active", true)
      .maybeSingle();

    const person = Array.isArray((userAccount as any)?.people) 
      ? (userAccount as any).people[0] 
      : (userAccount as any)?.people;
    const recipientEmail = participant.email || person?.email;
    const recipientName = participant.name || person?.full_name || "Deltaker";

    if (!recipientEmail) {
      console.error("NO_EMAIL_FOR_PARTICIPANT", { participant_id: participant.id });
      return json({ error: "No email for participant" }, 400);
    }

    // Get submission details
    const { data: submission } = await supabase
      .from("order_form_submissions")
      .select("id, submission_no, company_id, submitter_name, submitter_email, summary")
      .eq("id", message.submission_id)
      .single();

    if (!submission) return json({ error: "Submission not found" }, 404);

    // Get order context from submission values
    const { data: values } = await supabase
      .from("order_form_submission_values")
      .select("field_key, value")
      .eq("submission_id", submission.id);

    const valMap: Record<string, string> = {};
    for (const v of (values || [])) {
      valMap[v.field_key] = v.value;
    }

    // Extract context fields by looking for common patterns
    const customerName = Object.entries(valMap).find(([k]) => k.includes("firmanavn") || k.includes("kunde_navn"))?.[1] || submission.submitter_name || "";
    const address = Object.entries(valMap).find(([k]) => k.includes("oppdragssted") && !k.includes("postnr") && !k.includes("post"))?.[1] || "";
    const description = Object.entries(valMap).find(([k]) => k.includes("arbeidsbeskrivelse") || k.includes("beskrivelse"))?.[1] || "";

    // Build email
    const orderRef = submission.submission_no || message.submission_id.slice(0, 8);
    const replyToAddress = `order-msg+${participant.inbound_token}@${DOMAIN}`;
    const subject = `[${orderRef}] Melding til deg`;
    const senderName = message.sender_name || "MCS";

    const appBaseUrl = "https://mcsressurs.lovable.app";
    const orderLink = `${appBaseUrl}/orders/${submission.id}`;

    const bodyHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; padding: 20px;">
        <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #1a1a1a;">Bestilling ${escapeHtml(orderRef)}</h3>
          ${customerName ? `<p style="margin: 4px 0; color: #555;"><strong>Kunde:</strong> ${escapeHtml(customerName)}</p>` : ""}
          ${submission.submitter_name ? `<p style="margin: 4px 0; color: #555;"><strong>Bestiller:</strong> ${escapeHtml(submission.submitter_name)}</p>` : ""}
          ${address ? `<p style="margin: 4px 0; color: #555;"><strong>Oppdragssted:</strong> ${escapeHtml(address)}</p>` : ""}
          ${description ? `<p style="margin: 4px 0; color: #555; font-size: 13px;"><strong>Oppdrag:</strong> ${escapeHtml(description.substring(0, 200))}${description.length > 200 ? "…" : ""}</p>` : ""}
        </div>
        <div style="margin-bottom: 16px;">
          <p style="margin: 0 0 4px 0; color: #888; font-size: 12px;">Melding fra ${escapeHtml(senderName)}:</p>
          <div style="white-space: pre-wrap; color: #1a1a1a; line-height: 1.6; background: #fff; border-left: 3px solid #2563eb; padding: 12px 16px;">
${escapeHtml(message.body)}
          </div>
        </div>
        <div style="margin: 16px 0;">
          <a href="${orderLink}" target="_blank" style="display: inline-block; background: #2563eb; color: #ffffff; font-size: 14px; font-weight: 600; padding: 10px 20px; border-radius: 6px; text-decoration: none;">Åpne bestillingen i MCS</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
        <p style="color: #888; font-size: 12px;">
          Svar direkte på denne e-posten for å legge svaret i bestillingstråden.<br/>
          Svaret blir registrert som intern melding på bestilling ${escapeHtml(orderRef)}.
        </p>
      </div>`;

    // Get Graph token
    const accessToken = await getGraphToken();
    if (!accessToken) return json({ error: "Graph token error" }, 500);

    // Build Graph API email payload
    const emailHeaders = [
      { name: "X-MCS-Order-Msg-Token", value: participant.inbound_token },
      { name: "X-MCS-Entity", value: "order_message" },
      { name: "X-MCS-Submission-ID", value: submission.id },
    ];

    const graphPayload: any = {
      message: {
        subject,
        body: { contentType: "HTML", content: bodyHtml },
        from: { emailAddress: { address: MAILBOX, name: "MCS Ressurs" } },
        toRecipients: [{ emailAddress: { address: recipientEmail, name: recipientName } }],
        replyTo: [{ emailAddress: { address: replyToAddress, name: `Bestilling ${orderRef}` } }],
        internetMessageHeaders: emailHeaders,
      },
      saveToSentItems: true,
    };

    console.log("ORDER_EMAIL_SEND_START", {
      message_id,
      submission_no: orderRef,
      recipient: recipientEmail,
      reply_to: replyToAddress,
    });

    const graphResp = await fetch(
      `https://graph.microsoft.com/v1.0/users/${MAILBOX}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(graphPayload),
      }
    );

    if (!graphResp.ok) {
      const errText = await graphResp.text();
      console.error("ORDER_EMAIL_SEND_FAILED", { status: graphResp.status, error: errText.substring(0, 500) });
      return json({ error: `Graph send failed: ${graphResp.status}` }, 500);
    }

    console.log("ORDER_EMAIL_SEND_SUCCESS", {
      message_id,
      submission_no: orderRef,
      recipient: recipientEmail,
    });

    return json({ ok: true, recipient: recipientEmail });
  } catch (err) {
    console.error("ORDER_EMAIL_SEND_UNHANDLED", String(err));
    return json({ error: String(err) }, 500);
  }
});
