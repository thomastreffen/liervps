import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const REGIME_LABELS: Record<string, string> = {
  nek: "NEK 439 / NEK 400",
  fel: "Forskrift om elektriske lavspenningsanlegg (FEL)",
  fse: "Forskrift om sikkerhet ved arbeid i og drift av elektriske anlegg (FSE)",
  fsl: "Forskrift om sikkerhet ved arbeid i og drift av elektriske anlegg – lavspent (FSL)",
  annet: "Generelt regelverk / andre forskrifter",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "unauthorized", message: "Mangler autorisasjon" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ ok: false, error: "unauthorized", message: "Ugyldig token" }, 401);

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const { fag_request_id, company_id, regime, question, images = [], context, conversation_history = [] } = body;

    if (!fag_request_id || !company_id || !regime || !question) {
      return json({ ok: false, error: "validation_failed", message: "Mangler påkrevde felter" }, 400);
    }

    // Verify company membership
    const { data: membership } = await serviceClient
      .from("user_memberships")
      .select("id")
      .eq("user_id", user.id)
      .eq("company_id", company_id)
      .eq("is_active", true)
      .limit(1);

    const isAdmin = await checkAdmin(serviceClient, user.id);
    if (!isAdmin && (!membership || membership.length === 0)) {
      return json({ ok: false, error: "unauthorized", message: "Ingen tilgang til dette selskapet" }, 403);
    }

    // Verify request belongs to company
    const { data: fagReq } = await serviceClient
      .from("fag_requests")
      .select("id, company_id")
      .eq("id", fag_request_id)
      .single();

    if (!fagReq || fagReq.company_id !== company_id) {
      return json({ ok: false, error: "validation_failed", message: "Forespørselen tilhører ikke dette selskapet" }, 400);
    }

    // Verify image paths
    for (const img of images) {
      if (!img.path?.startsWith(`${company_id}/`)) {
        return json({ ok: false, error: "validation_failed", message: "Bildesti utenfor selskapets mappe" }, 400);
      }
    }

    // Set status = analyzing
    await serviceClient
      .from("fag_requests")
      .update({ status: "analyzing", last_activity_at: new Date().toISOString() })
      .eq("id", fag_request_id);

    // Load company fag profile for specialization
    const { data: fagProfile } = await serviceClient
      .from("fag_company_profiles")
      .select("*")
      .eq("company_id", company_id)
      .maybeSingle();

    // Generate signed URLs for images
    const imageContents: Array<{ type: string; image_url: { url: string } }> = [];
    for (const img of images) {
      const { data: signedData, error: signErr } = await serviceClient.storage
        .from("fag-attachments")
        .createSignedUrl(img.path, 300);
      if (signErr || !signedData?.signedUrl) {
        console.error("Signed URL error:", signErr);
        continue;
      }
      imageContents.push({
        type: "image_url",
        image_url: { url: signedData.signedUrl },
      });
    }

    // Build specialized system prompt
    const regimeLabel = REGIME_LABELS[regime] || regime;
    const specialization = fagProfile?.specialization?.join(", ") || "Tavler og fordelingsanlegg, Lavspent kraftfordeling, Industri og næringsbygg";
    const primaryStandards = fagProfile?.primary_standards?.join(", ") || "NEK 439";
    const secondaryStandards = fagProfile?.secondary_standards?.join(", ") || "NEK 400, FEL, FSE";

    const systemPrompt = `Du er en spesialisert fagassistent for elektrobransjen i Norge.

DITT SPESIALOMRÅDE:
${specialization}

PRIMÆRE REGELVERK: ${primaryStandards}
SEKUNDÆRE REGELVERK: ${secondaryStandards}

Gjeldende regelverksvalg fra bruker: ${regimeLabel}

DIN ROLLE:
- Du er en erfaren fagkollega som gir konkrete, praksisnære råd
- Du kjenner NEK 439-serien (tavlekonstruksjon) svært godt
- Du forstår temperaturstigning, kortslutningsytelse, vernselektivitet, kapslingskrav, strømskinner og dokumentasjonskrav
- Du relaterer svarene til faktisk tavlebygging og fordelingsanlegg

VIKTIG:
- Vær konkret og teknisk presis
- Henvis til spesifikke paragrafer/tabeller der du kan (NEK 439-1, 439-2, 439-3 etc.)
- Merk alltid usikkerhet tydelig
- Hvis bildet er uklart, si det rett ut
- Svar ALLTID på norsk
- Skriv i en uformell, kollegial tone – som en erfaren kollega
- Hold svarene konsise og handlingsrettede
${fagProfile?.custom_system_prompt ? `\nEKSTRA INSTRUKSJONER:\n${fagProfile.custom_system_prompt}` : ""}

Du MÅ svare med gyldig JSON i følgende format:
{
  "summary": "Kort teknisk oppsummering (2-3 setninger, direkte og konkret)",
  "what_i_see": ["Observasjoner fra bildet (hvis vedlagt)"],
  "assessment": [
    {
      "topic": "Emne",
      "guidance": "Konkret vurdering med henvisning til regelverk",
      "confidence": 72
    }
  ],
  "recommendations": ["Praktiske tiltak"],
  "risks": ["Risikoer ved feiltolkning"],
  "followup_questions": ["Naturlige oppfølgingsspørsmål"],
  "disclaimer": "Kort disclaimer"
}`;

    // Build messages with conversation history for follow-up support
    const messages: any[] = [{ role: "system", content: systemPrompt }];

    // Add conversation history if this is a follow-up
    for (const hist of conversation_history) {
      messages.push({ role: hist.role, content: hist.content });
    }

    const userContent: any[] = [
      { type: "text", text: `Regelverk: ${regimeLabel}\n\nSpørsmål: ${question}${context?.notes ? `\n\nKontekst: ${context.notes}` : ""}${context?.site ? `\nSted: ${context.site}` : ""}` },
      ...imageContents,
    ];
    messages.push({ role: "user", content: userContent });

    // Call AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: 0.3,
        tools: [
          {
            type: "function",
            function: {
              name: "fag_assessment",
              description: "Return a structured professional assessment.",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  what_i_see: { type: "array", items: { type: "string" } },
                  assessment: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        topic: { type: "string" },
                        guidance: { type: "string" },
                        confidence: { type: "number" },
                      },
                      required: ["topic", "guidance", "confidence"],
                    },
                  },
                  recommendations: { type: "array", items: { type: "string" } },
                  risks: { type: "array", items: { type: "string" } },
                  followup_questions: { type: "array", items: { type: "string" } },
                  disclaimer: { type: "string" },
                },
                required: ["summary", "assessment", "recommendations", "followup_questions", "disclaimer"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "fag_assessment" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      await serviceClient
        .from("fag_requests")
        .update({ status: "error", last_activity_at: new Date().toISOString() })
        .eq("id", fag_request_id);

      if (aiResponse.status === 429) return json({ ok: false, error: "rate_limited", message: "For mange forespørsler. Prøv igjen om litt." }, 429);
      if (aiResponse.status === 402) return json({ ok: false, error: "payment_required", message: "AI-kreditter er brukt opp." }, 402);
      return json({ ok: false, error: "ai_failed", message: "AI-analyse feilet" }, 500);
    }

    const aiData = await aiResponse.json();

    let rawContent: string;
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      rawContent = toolCall.function.arguments;
    } else {
      rawContent = aiData.choices?.[0]?.message?.content || "{}";
    }
    const usage = aiData.usage;

    let parsed: any;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      console.error("Failed to parse AI JSON:", rawContent);
      await serviceClient
        .from("fag_requests")
        .update({ status: "error", last_activity_at: new Date().toISOString() })
        .eq("id", fag_request_id);
      return json({ ok: false, error: "ai_failed", message: "Kunne ikke tolke AI-respons" }, 500);
    }

    const md = buildMarkdown(parsed);

    const assessments = Array.isArray(parsed.assessment) ? parsed.assessment : [];
    const confidences = assessments.map((a: any) => a.confidence || 0).filter((c: number) => c > 0);
    const avgConfidence = confidences.length > 0 ? Math.round(confidences.reduce((s: number, c: number) => s + c, 0) / confidences.length) : null;

    const followups = Array.isArray(parsed.followup_questions) ? parsed.followup_questions : [];
    const newStatus = followups.length >= 2 ? "needs_followup" : "answered";

    await serviceClient.from("fag_answers").insert({
      fag_request_id,
      company_id,
      answer_markdown: md,
      model: aiData.model || "google/gemini-2.5-flash",
      tokens_in: usage?.prompt_tokens || null,
      tokens_out: usage?.completion_tokens || null,
    });

    await serviceClient
      .from("fag_requests")
      .update({
        status: newStatus,
        ai_summary: parsed.summary || null,
        ai_confidence: avgConfidence,
        ai_followup_questions: followups,
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", fag_request_id);

    return json({
      ok: true,
      fag_request_id,
      status: newStatus,
      ai_confidence: avgConfidence,
      answer_preview: (parsed.summary || "").substring(0, 200),
      answer_markdown: md,
      followup_questions: followups,
    });
  } catch (err: any) {
    console.error("Unexpected error:", err);
    return json({ ok: false, error: "ai_failed", message: err.message || "Ukjent feil" }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function checkAdmin(client: any, userId: string): Promise<boolean> {
  const { data } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role === "admin" || data?.role === "super_admin";
}

function buildMarkdown(parsed: any): string {
  const sections: string[] = [];

  if (parsed.summary) sections.push(`## Oppsummering\n${parsed.summary}`);

  if (Array.isArray(parsed.what_i_see) && parsed.what_i_see.length > 0) {
    sections.push(`## Observasjoner fra bildet\n${parsed.what_i_see.map((s: string) => `- ${s}`).join("\n")}`);
  }

  if (Array.isArray(parsed.assessment) && parsed.assessment.length > 0) {
    const items = parsed.assessment.map((a: any) =>
      `### ${a.topic} (${a.confidence || "?"}% sikkerhet)\n${a.guidance}`
    ).join("\n\n");
    sections.push(`## Vurdering\n${items}`);
  }

  if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
    sections.push(`## Anbefalinger\n${parsed.recommendations.map((r: string) => `- ${r}`).join("\n")}`);
  }

  if (Array.isArray(parsed.risks) && parsed.risks.length > 0) {
    sections.push(`## Risikoer\n${parsed.risks.map((r: string) => `⚠️ ${r}`).join("\n")}`);
  }

  if (Array.isArray(parsed.followup_questions) && parsed.followup_questions.length > 0) {
    sections.push(`## Oppfølgingsspørsmål\n${parsed.followup_questions.map((q: string) => `- ${q}`).join("\n")}`);
  }

  if (parsed.disclaimer) sections.push(`---\n*${parsed.disclaimer}*`);

  return sections.join("\n\n");
}
