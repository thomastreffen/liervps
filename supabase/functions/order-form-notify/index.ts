import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const MAILBOX = "postkontoret@mcsservice.no";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { submission_id, notification_type } = body;
    // notification_type: "new_order" | "confirmation" | "missing_info" | "critical_alert"

    if (!submission_id || !notification_type) {
      return json({ error: "submission_id and notification_type required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch submission with template
    const { data: submission, error: subErr } = await supabase
      .from("order_form_submissions")
      .select("*, order_form_templates(name, send_email_to)")
      .eq("id", submission_id)
      .single();

    if (subErr || !submission) {
      console.error("SUBMISSION_NOT_FOUND", { submission_id, error: subErr });
      return json({ error: "Submission not found" }, 404);
    }

    // Fetch field values
    const { data: values } = await supabase
      .from("order_form_submission_values")
      .select("field_key, value")
      .eq("submission_id", submission_id);

    const valMap: Record<string, any> = {};
    (values || []).forEach((v: any) => { valMap[v.field_key] = v.value; });

    // Fetch attachments
    const { data: attachments } = await supabase
      .from("order_form_submission_attachments")
      .select("file_name, category")
      .eq("submission_id", submission_id);

    const summary = submission.summary || {};
    const template = (submission as any).order_form_templates;
    const appUrl = supabaseUrl.replace(".supabase.co", "").includes("localhost")
      ? "http://localhost:8080"
      : "https://mcsressurs.lovable.app";
    const detailUrl = `${appUrl}/orders/${submission_id}`;

    // Smart fallback resolution for key fields
    const kundenavn = valMap.kundenavn || valMap.firmanavn || valMap.kunde_navn || summary.kundenavn || summary.firmanavn || "Ikke angitt";
    const oppdragstittel = valMap.oppdragstittel || valMap.oppdragssted || summary.oppdragstittel || template?.name || "Bestilling";
    const hastegrad = valMap.hastegrad || summary.hastegrad || "Normal";
    const bestillingstype = submission.requester_type === "internal" ? "Intern" : "Ekstern";
    const priorityEmoji = hastegrad === "Kritisk stopp" ? "🔴" : hastegrad === "Høy" ? "🟠" : "";
    const bestillerNavn = valMap.bestiller_navn || valMap.kontaktperson || valMap.kontaktperson_navn || summary.bestiller_navn || valMap.bestiller_epost || "Ikke angitt";
    const bestillerEpost = valMap.bestiller_epost || valMap.epost_kunde || valMap.epost || "";
    const bestillerTelefon = valMap.bestiller_telefon || valMap.telefon_kunde || valMap.telefon || "";
    const anleggsadresse = valMap.anleggsadresse || valMap.oppdragssted || valMap.adresse || "";
    const materialansvar = valMap.materialansvar || "Ikke angitt";
    const referanse = valMap.referanse_po || valMap.fakturamerking_po || valMap.midlertidig_referanse || valMap.po_nummer || "Ikke angitt";
    const onsketDato = valMap.onsket_utfort_dato || valMap.onsket_dato || "Ikke angitt";
    const arbeidsbeskrivelse = valMap.detaljert_arbeidsbeskrivelse || valMap.arbeidsbeskrivelse || valMap.beskrivelse || "";

    // Build email based on type
    let subject = "";
    let bodyHtml = "";
    let recipients: string[] = [];

    if (notification_type === "new_order") {
      subject = `${priorityEmoji ? priorityEmoji + " " : ""}[Ny bestilling] ${submission.submission_no} | ${kundenavn} | ${hastegrad}`;
      
      const sendTo = template?.send_email_to;
      recipients = Array.isArray(sendTo) && sendTo.length > 0 ? sendTo : [MAILBOX];

      // Add extra recipients for critical
      if (hastegrad === "Kritisk stopp" && !recipients.includes(MAILBOX)) {
        recipients.push(MAILBOX);
      }

      bodyHtml = buildNewOrderEmail({
        submissionNo: submission.submission_no,
        templateName: template?.name || "Bestillingsskjema",
        kundenavn,
        oppdragstittel,
        hastegrad,
        bestillingstype,
        onsketDato,
        bestillerNavn,
        bestillerEpost,
        bestillerTelefon,
        anleggsadresse,
        materialansvar,
        referanse,
        arbeidsbeskrivelse,
        attachments: attachments || [],
        detailUrl,
        qualityScore: submission.quality_score,
      });

      // Update notification_sent_at
      await supabase.from("order_form_submissions")
        .update({ notification_sent_at: new Date().toISOString() })
        .eq("id", submission_id);

    } else if (notification_type === "confirmation") {
      if (!bestillerEpost) {
        console.log("NO_BESTILLER_EMAIL", { submission_id });
        return json({ success: false, reason: "no_bestiller_email" });
      }

      subject = `Bestilling mottatt: ${submission.submission_no} - ${oppdragstittel}`;
      recipients = [bestillerEpost];

      bodyHtml = buildConfirmationEmail({
        submissionNo: submission.submission_no,
        kundenavn,
        oppdragstittel,
        detailUrl,
      });

      await supabase.from("order_form_submissions")
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq("id", submission_id);

    } else if (notification_type === "missing_info") {
      if (!bestillerEpost) {
        return json({ success: false, reason: "no_bestiller_email" });
      }

      const { missing_items, free_text } = body;
      subject = `Forespørsel om mer info: ${submission.submission_no} - ${oppdragstittel}`;
      recipients = [bestillerEpost];

      bodyHtml = buildMissingInfoEmail({
        submissionNo: submission.submission_no,
        kundenavn,
        oppdragstittel,
        missingItems: missing_items || [],
        freeText: free_text || "",
        detailUrl,
      });
    }

    if (recipients.length === 0) {
      return json({ success: false, reason: "no_recipients" });
    }

    // Get Graph token and send
    const tokenResult = await getGraphToken();
    if (tokenResult.error) {
      console.error("GRAPH_TOKEN_ERROR", tokenResult.error);
      await supabase.from("order_form_submissions")
        .update({ notification_error: tokenResult.error })
        .eq("id", submission_id);
      return json({ success: false, error: tokenResult.error });
    }

    const sendResult = await sendMailViaGraph(tokenResult.token!, {
      subject,
      bodyHtml,
      recipients,
      mailbox: MAILBOX,
      saveToSentItems: true,
    });

    if (sendResult.error) {
      console.error("SEND_FAILED", { error: sendResult.error, statusCode: sendResult.statusCode });
      await supabase.from("order_form_submissions")
        .update({ notification_error: sendResult.error })
        .eq("id", submission_id);
      
      await supabase.from("order_form_activity_log").insert({
        submission_id,
        event_type: "notification_failed",
        payload: { type: notification_type, error: sendResult.error, recipients },
      });

      return json({ success: false, error: sendResult.error });
    }

    // Log success
    await supabase.from("order_form_activity_log").insert({
      submission_id,
      event_type: "notification_sent",
      payload: { type: notification_type, recipients, subject },
    });

    console.log("EMAIL_SENT", { submission_id, notification_type, recipients });
    return json({ success: true, recipients });

  } catch (err) {
    console.error("ORDER_FORM_NOTIFY_ERROR", String(err));
    return json({ error: String(err) }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

// ── Email builders ──

function buildNewOrderEmail(p: {
  submissionNo: string; templateName: string; kundenavn: string; oppdragstittel: string;
  hastegrad: string; bestillingstype: string; onsketDato: string;
  bestillerNavn: string; bestillerEpost: string; bestillerTelefon: string;
  anleggsadresse: string; materialansvar: string; referanse: string;
  arbeidsbeskrivelse: string; attachments: any[]; detailUrl: string;
  qualityScore: string;
}): string {
  const hasteBg = p.hastegrad === "Kritisk stopp" ? "#FEE2E2" : p.hastegrad === "Høy" ? "#FFF7ED" : "#F0FDF4";
  const hasteFg = p.hastegrad === "Kritisk stopp" ? "#991B1B" : p.hastegrad === "Høy" ? "#9A3412" : "#166534";
  const qualityBg = p.qualityScore === "red" ? "#FEE2E2" : p.qualityScore === "yellow" ? "#FEF3C7" : "#DCFCE7";
  const qualityLabel = p.qualityScore === "red" ? "Utilstrekkelig" : p.qualityScore === "yellow" ? "Noe mangler" : "Komplett";

  const attHtml = p.attachments.length > 0
    ? `<tr><td style="padding:6px 12px;color:#6B7280;font-size:13px;">Vedlegg</td><td style="padding:6px 12px;font-size:13px;">${p.attachments.map((a: any) => `${a.file_name} (${a.category || "Annet"})`).join("<br/>")}</td></tr>`
    : "";

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:20px;">
  <div style="background:${hasteBg};border-radius:8px;padding:16px;margin-bottom:16px;">
    <h2 style="margin:0 0 4px;color:${hasteFg};font-size:18px;">Ny bestilling: ${p.submissionNo}</h2>
    <p style="margin:0;color:${hasteFg};font-size:14px;">${p.kundenavn} · ${p.oppdragstittel}</p>
    <p style="margin:4px 0 0;color:${hasteFg};font-size:12px;opacity:0.8;">Skjema: ${p.templateName}</p>
  </div>
  <div style="display:flex;gap:8px;margin-bottom:16px;">
    <span style="background:${hasteBg};color:${hasteFg};padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600;">${p.hastegrad}</span>
    <span style="background:#EFF6FF;color:#1E40AF;padding:4px 10px;border-radius:4px;font-size:12px;">${p.bestillingstype}</span>
    <span style="background:${qualityBg};padding:4px 10px;border-radius:4px;font-size:12px;">${qualityLabel}</span>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:13px;">
    <tr style="background:#F9FAFB"><td style="padding:6px 12px;color:#6B7280;">Bestiller</td><td style="padding:6px 12px;">${p.bestillerNavn}${p.bestillerTelefon ? ` · ${p.bestillerTelefon}` : ""}${p.bestillerEpost ? ` · ${p.bestillerEpost}` : ""}</td></tr>
    <tr><td style="padding:6px 12px;color:#6B7280;">Kunde</td><td style="padding:6px 12px;">${p.kundenavn}</td></tr>
    <tr style="background:#F9FAFB"><td style="padding:6px 12px;color:#6B7280;">Adresse</td><td style="padding:6px 12px;">${p.anleggsadresse || "Ikke angitt"}</td></tr>
    <tr><td style="padding:6px 12px;color:#6B7280;">Ønsket dato</td><td style="padding:6px 12px;">${p.onsketDato}</td></tr>
    <tr style="background:#F9FAFB"><td style="padding:6px 12px;color:#6B7280;">Material</td><td style="padding:6px 12px;">${p.materialansvar}</td></tr>
    <tr><td style="padding:6px 12px;color:#6B7280;">Referanse</td><td style="padding:6px 12px;">${p.referanse}</td></tr>
    ${attHtml}
  </table>
  ${p.arbeidsbeskrivelse ? `<div style="margin:16px 0;padding:12px;background:#F9FAFB;border-radius:6px;font-size:13px;"><strong>Beskrivelse:</strong><br/>${p.arbeidsbeskrivelse.replace(/\n/g, "<br/>")}</div>` : ""}
  <div style="margin:20px 0;">
    <a href="${p.detailUrl}" style="display:inline-block;background:#2563EB;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;">Åpne bestilling i MCS</a>
  </div>
  <p style="color:#9CA3AF;font-size:11px;">Denne e-posten er sendt automatisk fra MCS Ressurs.</p>
</div>`;
}

function buildConfirmationEmail(p: {
  submissionNo: string; kundenavn: string; oppdragstittel: string; detailUrl: string;
}): string {
  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:20px;">
  <div style="background:#DCFCE7;border-radius:8px;padding:16px;margin-bottom:16px;">
    <h2 style="margin:0 0 4px;color:#166534;font-size:18px;">✅ Bestilling mottatt</h2>
    <p style="margin:0;color:#166534;font-size:14px;">${p.submissionNo}</p>
  </div>
  <p style="font-size:14px;color:#374151;">Hei,</p>
  <p style="font-size:14px;color:#374151;">Vi har mottatt bestillingen din for <strong>${p.oppdragstittel}</strong> (kunde: ${p.kundenavn}).</p>
  <p style="font-size:14px;color:#374151;">Bestillingen er registrert med nummer <strong>${p.submissionNo}</strong> og vil bli behandlet av vårt serviceteam.</p>
  <p style="font-size:14px;color:#374151;">Du vil bli kontaktet dersom vi trenger mer informasjon.</p>
  <p style="color:#9CA3AF;font-size:11px;margin-top:24px;">Denne e-posten er sendt automatisk fra MCS Service.</p>
</div>`;
}

function buildMissingInfoEmail(p: {
  submissionNo: string; kundenavn: string; oppdragstittel: string;
  missingItems: string[]; freeText: string; detailUrl: string;
}): string {
  const itemsHtml = p.missingItems.length > 0
    ? `<ul style="margin:8px 0;padding-left:20px;">${p.missingItems.map(i => `<li style="font-size:14px;color:#374151;margin:4px 0;">${i}</li>`).join("")}</ul>`
    : "";
  const freeTextHtml = p.freeText ? `<div style="margin:12px 0;padding:12px;background:#FEF3C7;border-radius:6px;font-size:13px;">${p.freeText.replace(/\n/g, "<br/>")}</div>` : "";

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:20px;">
  <div style="background:#FEF3C7;border-radius:8px;padding:16px;margin-bottom:16px;">
    <h2 style="margin:0 0 4px;color:#92400E;font-size:18px;">⚠️ Vi trenger mer informasjon</h2>
    <p style="margin:0;color:#92400E;font-size:14px;">${p.submissionNo} · ${p.kundenavn} · ${p.oppdragstittel}</p>
  </div>
  <p style="font-size:14px;color:#374151;">Hei,</p>
  <p style="font-size:14px;color:#374151;">For å kunne behandle bestillingen din trenger vi følgende informasjon:</p>
  ${itemsHtml}
  ${freeTextHtml}
  <p style="font-size:14px;color:#374151;">Vennligst ta kontakt med oss eller oppdater bestillingen.</p>
  <p style="color:#9CA3AF;font-size:11px;margin-top:24px;">Denne e-posten er sendt automatisk fra MCS Service.</p>
</div>`;
}

// ── Graph helpers (same pattern as conversation-email-send) ──

async function getGraphToken(): Promise<{ token?: string; error?: string }> {
  const tenantId = Deno.env.get("AZURE_TENANT_ID");
  const clientId = Deno.env.get("AZURE_CLIENT_ID");
  const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET");

  if (!tenantId || !clientId || !clientSecret) {
    return { error: "Missing Azure credentials" };
  }

  try {
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

    if (!resp.ok) {
      const errText = await resp.text();
      return { error: `Token error ${resp.status}: ${errText}` };
    }

    const data = await resp.json();
    return { token: data.access_token };
  } catch (err) {
    return { error: `Token fetch failed: ${String(err)}` };
  }
}

async function sendMailViaGraph(
  token: string,
  opts: { subject: string; bodyHtml: string; recipients: string[]; mailbox: string; saveToSentItems: boolean }
): Promise<{ error?: string; statusCode?: number }> {
  const payload = {
    message: {
      subject: opts.subject,
      body: { contentType: "HTML", content: opts.bodyHtml },
      toRecipients: opts.recipients.map((e) => ({
        emailAddress: { address: e },
      })),
    },
    saveToSentItems: opts.saveToSentItems,
  };

  try {
    const resp = await fetch(
      `https://graph.microsoft.com/v1.0/users/${opts.mailbox}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (resp.status === 202 || resp.status === 200) {
      return {};
    }

    const errText = await resp.text();
    return { error: `Graph ${resp.status}: ${errText}`, statusCode: resp.status };
  } catch (err) {
    return { error: `Network error: ${String(err)}` };
  }
}
