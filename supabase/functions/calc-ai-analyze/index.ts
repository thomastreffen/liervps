// Edge function: calc-ai-analyze
// Analyserer AI-utkast for kalkyler. Henter draft + meldinger + vedlegg,
// bygger en multimodal prompt mot Lovable AI Gateway, og oppdaterer drafts
// med strukturert forslag (input + linjer + confidence).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const MODEL = "google/gemini-2.5-pro";

const SYSTEM_PROMPT = `Du er en erfaren norsk elektroingeniør som analyserer underlag for strømskinneprosjekter.
Din oppgave er å hjelpe en kalkulatør med å fylle ut et førsteutkast — IKKE å låse svaret.

Returner et strukturert forslag via tool-call. Vær ærlig om usikkerhet:
- Bruk confidence 0-100 per felt (0 = bare gjetning, 100 = direkte avlest fra underlag).
- Skriv klare antakelser og åpne spørsmål når informasjon mangler.
- Foreslå rimelige estimater også når underlaget er tynt — men marker lav confidence.

Pakke: Strømskinne (busbar). Felter du kan foreslå:
- leverandor: 'schneider' | 'eaton' | 'legrand'
- serie: kort tekst (f.eks. 'Canalis KT', 'xEnergy XPR', 'SCP')
- ledertype: 'kobber' | 'aluminium'
- utforelse: 'epoxy' | 'lakkert' | 'ren'
- stromklasse: '800' | '1000' | '1250' | '1600' | '2000' | '2500' | '3200' | '4000' | '5000' | '6300'
- qty_straight_1, qty_straight_2, qty_straight_3 (antall stk)
- qty_vinkel, qty_t_element, qty_term_std, qty_term_nonstd, qty_skjot, qty_oppheng (antall stk)
- vertikal: boolean, qty_vertikal: antall vertikale strekk
- total_lengde_m: estimert total lengde i meter
- arbeidstidstype, tilkomstniva, reisetid, riggtid, risiko (la stå hvis ingen indikasjon)`;

const TOOL = {
  type: "function",
  function: {
    name: "submit_calc_proposal",
    description: "Send strukturert kalkyleforslag tilbake.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Kort oppsummering (2-4 setninger) av hva du har tolket fra underlaget." },
        assumptions: {
          type: "array", items: { type: "string" },
          description: "Antakelser du har gjort der underlaget er uklart.",
        },
        open_questions: {
          type: "array", items: { type: "string" },
          description: "Spørsmål brukeren bør svare på for å øke kvaliteten.",
        },
        proposed_input: {
          type: "object",
          description: "Foreslåtte verdier per inputfelt med confidence.",
          additionalProperties: {
            type: "object",
            properties: {
              value: {},
              confidence: { type: "number", minimum: 0, maximum: 100 },
              reason: { type: "string" },
            },
            required: ["value", "confidence"],
          },
        },
        overall_confidence: { type: "number", minimum: 0, maximum: 100 },
      },
      required: ["summary", "proposed_input", "overall_confidence"],
    },
  },
};

const MAX_INLINE_BYTES = 18 * 1024 * 1024; // ~18 MB safety limit per file

async function buildAttachmentParts(
  supabase: ReturnType<typeof createClient>,
  attachments: any[],
): Promise<any[]> {
  const parts: any[] = [];
  for (const att of attachments ?? []) {
    if (!att.path) continue;
    const mime = att.mime_type ?? "application/octet-stream";
    if (!mime.startsWith("image/") && mime !== "application/pdf") {
      console.log("[calc-ai-analyze] skipping unsupported mime", mime);
      continue;
    }
    try {
      const { data, error } = await supabase.storage
        .from(att.bucket ?? "calc-ai-drafts")
        .download(att.path);
      if (error || !data) {
        console.warn("[calc-ai-analyze] download failed", att.path, error?.message);
        continue;
      }
      const buf = new Uint8Array(await data.arrayBuffer());
      if (buf.byteLength > MAX_INLINE_BYTES) {
        console.warn("[calc-ai-analyze] file too large, skipping", att.path, buf.byteLength);
        continue;
      }
      const base64 = encodeBase64(buf);
      parts.push({
        type: "image_url",
        image_url: { url: `data:${mime};base64,${base64}` },
      });
      console.log("[calc-ai-analyze] attached", att.path, mime, buf.byteLength, "bytes");
    } catch (e) {
      console.warn("[calc-ai-analyze] error preparing attachment", att.path, e);
    }
  }
  return parts;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userResp } = await userClient.auth.getUser();
    if (!userResp?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { draft_id, user_message } = await req.json();
    if (!draft_id) {
      return new Response(JSON.stringify({ error: "draft_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Hent draft
    const { data: draft, error: draftErr } = await admin
      .from("calc_ai_drafts")
      .select("*")
      .eq("id", draft_id)
      .maybeSingle();
    if (draftErr || !draft) {
      return new Response(JSON.stringify({ error: "Draft not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (draft.user_id !== userResp.user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Markér som analyzing
    await admin.from("calc_ai_drafts")
      .update({ status: "analyzing" }).eq("id", draft_id);

    // Hent tidligere chat-meldinger
    const { data: history } = await admin
      .from("calc_ai_draft_messages")
      .select("role, content")
      .eq("draft_id", draft_id)
      .order("created_at", { ascending: true });

    // Lagre brukerens nye melding (om det finnes)
    if (user_message && typeof user_message === "string" && user_message.trim()) {
      await admin.from("calc_ai_draft_messages").insert({
        draft_id,
        role: "user",
        content: user_message.trim(),
      });
    }

    // Bygg multimodal user-content
    const attachmentParts = await buildAttachmentParts(admin, draft.attachments ?? []);
    const baseText = [
      draft.initial_description ? `Bruker-beskrivelse: ${draft.initial_description}` : "",
      user_message ? `Ny instruks fra bruker: ${user_message}` : "",
      draft.ai_proposed_input && Object.keys(draft.ai_proposed_input).length
        ? `Tidligere forslag (skal forbedres ut fra ny info):\n${JSON.stringify(draft.ai_proposed_input, null, 2)}`
        : "",
    ].filter(Boolean).join("\n\n");

    const userContent: any[] = [{ type: "text", text: baseText || "Analyser vedlagt underlag." }];
    userContent.push(...attachmentParts);

    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(history ?? []).filter(m => m.role !== "system").map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
      { role: "user", content: userContent },
    ];

    // Kall Lovable AI
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "submit_calc_proposal" } },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI gateway error", aiResp.status, txt);
      await admin.from("calc_ai_drafts").update({ status: "draft" }).eq("id", draft_id);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit. Prøv igjen om litt." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI-kreditt brukt opp. Legg til kreditter i workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("Missing tool call", JSON.stringify(aiJson).slice(0, 500));
      await admin.from("calc_ai_drafts").update({ status: "draft" }).eq("id", draft_id);
      return new Response(JSON.stringify({ error: "AI returned no proposal" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let proposal: any;
    try {
      proposal = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Tool args parse failed", e);
      await admin.from("calc_ai_drafts").update({ status: "draft" }).eq("id", draft_id);
      return new Response(JSON.stringify({ error: "AI returned malformed proposal" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const summary = String(proposal.summary ?? "");
    const assumptions = Array.isArray(proposal.assumptions) ? proposal.assumptions : [];
    const openQuestions = Array.isArray(proposal.open_questions) ? proposal.open_questions : [];
    const proposedInput = proposal.proposed_input ?? {};
    const overall = Number(proposal.overall_confidence ?? 0);

    // Oppdater draft
    await admin.from("calc_ai_drafts").update({
      status: "ready",
      ai_summary: summary,
      ai_assumptions: assumptions,
      ai_open_questions: openQuestions,
      ai_proposed_input: proposedInput,
      overall_confidence: overall,
      model_used: MODEL,
    }).eq("id", draft_id);

    // Lagre AI-meldingen som chat-historikk
    await admin.from("calc_ai_draft_messages").insert({
      draft_id,
      role: "assistant",
      content: summary || "Forslag oppdatert.",
      proposal_diff: proposedInput,
      metadata: {
        overall_confidence: overall,
        assumptions,
        open_questions: openQuestions,
      },
    });

    return new Response(JSON.stringify({
      ok: true,
      summary, assumptions, open_questions: openQuestions,
      proposed_input: proposedInput, overall_confidence: overall,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("calc-ai-analyze error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
