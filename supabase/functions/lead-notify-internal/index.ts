/**
 * Internal Gmail notification for a new website lead.
 *
 * Called (fire-and-forget) right after a public_leads insert — also by anonymous
 * website visitors. It must NEVER surface an error to the visitor: every outcome
 * returns HTTP 200 with a status field.
 *
 * Body: { public_lead_id: string, origin?: string }
 * Returns: { status: "sent" | "no_token" | "skipped" | "not_found" | "error" }
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { calcSummaryBlock } from "../_shared/calc-summary.ts";
import { SCOPE_GMAIL_SEND, ensureFreshAccessToken, gmailSendText, loadAnyInternalToken } from "../_shared/google-token.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEFAULT_RECIPIENT = "post@liervps.no";
const DEFAULT_ORIGIN = "https://liervps.lovable.app";

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function segmentLabel(segment?: string | null) {
  const s = (segment ?? "").toLowerCase();
  if (s.startsWith("n")) return "næring";
  if (s.startsWith("b")) return "bolig";
  return segment || "—";
}

function buildSubject(pl: any): string {
  const product = [pl.selected_brand, pl.selected_product_name].filter(Boolean).join(" ");
  if (product) return `Ny nettsidehenvendelse: ${product}`;
  if (pl.selected_solution_name) return `Ny nettsidehenvendelse: ${pl.selected_solution_name}`;
  if (pl.calculator_summary) return `Ny beregning fra nettsiden: ${segmentLabel(pl.segment)}`;
  return "Ny befaring fra nettsiden";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: { public_lead_id?: string; origin?: string };
  try { body = await req.json(); } catch { return json({ status: "error", code: "bad_json" }); }
  const publicLeadId = body.public_lead_id ?? "";
  if (!UUID_RE.test(publicLeadId)) return json({ status: "error", code: "bad_id" });

  const origin = typeof body.origin === "string" && /^https:\/\/[\w.-]+$/.test(body.origin)
    ? body.origin
    : DEFAULT_ORIGIN;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: pl } = await admin.from("public_leads").select("*").eq("id", publicLeadId).maybeSingle();
    if (!pl) return json({ status: "not_found" });
    if (pl.internal_notified_at) return json({ status: "skipped", code: "already_notified" });

    // Internal recipient: company settings e-mail, fallback to default.
    const { data: cs } = await admin.from("company_settings").select("email").limit(1).maybeSingle();
    const recipient = (cs?.email as string | null)?.trim() || DEFAULT_RECIPIENT;

    // Internal deep link to the lead in Lier VPS.
    const { data: lead } = await admin.from("leads").select("id").eq("public_lead_id", publicLeadId).maybeSingle();
    const link = lead?.id ? `${origin}/sales/leads/${lead.id}` : `${origin}/sales/leads`;

    const tokenRow = await loadAnyInternalToken(admin, [SCOPE_GMAIL_SEND]);
    if (!tokenRow) {
      console.info("[lead-notify-internal] Gmail not connected, internal notification skipped");
      await admin.from("public_leads")
        .update({ internal_notify_status: "no_token" })
        .eq("id", publicLeadId);
      return json({ status: "no_token" });
    }
    const accessToken = await ensureFreshAccessToken(admin, tokenRow);
    if (!accessToken) {
      console.info("[lead-notify-internal] Gmail not connected, internal notification skipped");
      await admin.from("public_leads").update({ internal_notify_status: "no_token" }).eq("id", publicLeadId);
      return json({ status: "no_token" });
    }

    const calc = pl.calculator_summary ? calcSummaryBlock(pl.calculator_summary) : "";
    const text = [
      "Ny henvendelse fra nettsiden.",
      "",
      `Navn: ${pl.name ?? "—"}`,
      `Telefon: ${pl.phone ?? "—"}`,
      `E-post: ${pl.email ?? "—"}`,
      `Adresse/poststed: ${pl.address ?? "—"}`,
      `Segment: ${segmentLabel(pl.segment)}`,
      `Type henvendelse: ${pl.request_type ?? "—"}`,
      `Kilde: ${pl.lead_source ?? "—"}`,
      pl.selected_brand ? `Merke: ${pl.selected_brand}` : null,
      pl.selected_product_name ? `Modell: ${pl.selected_product_name}` : null,
      pl.selected_solution_name ? `Løsning: ${pl.selected_solution_name}` : null,
      calc ? `\nBeregning fra nettsiden:\n${calc}` : null,
      pl.message ? `\nKundens melding:\n${pl.message}` : null,
      "",
      `Åpne henvendelsen i Lier VPS: ${link}`,
    ].filter((l) => l !== null).join("\n");

    const from = tokenRow.provider_account_email || recipient;
    const messageId = await gmailSendText(accessToken, from, [recipient], buildSubject(pl), text);

    await admin.from("public_leads")
      .update({ internal_notified_at: new Date().toISOString(), internal_notify_status: "sent" })
      .eq("id", publicLeadId);

    return json({ status: "sent", message_id: messageId, recipient });
  } catch (e) {
    console.error("[lead-notify-internal] failed", e);
    await admin.from("public_leads").update({ internal_notify_status: "error" }).eq("id", publicLeadId);
    return json({ status: "error", code: "send_failed" });
  }
});
