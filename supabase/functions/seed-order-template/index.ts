import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sa = createClient(supabaseUrl, serviceKey);

    // Verify the user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { company_id } = await req.json();
    if (!company_id) return new Response(JSON.stringify({ error: "company_id required" }), { status: 400, headers: corsHeaders });

    // Check if already exists
    const { data: existing } = await sa
      .from("order_form_templates")
      .select("id")
      .eq("company_id", company_id)
      .eq("slug", "bestill-service")
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ ok: true, message: "Template already exists", template_id: existing.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create template
    const { data: tmpl, error: tmplErr } = await sa
      .from("order_form_templates")
      .insert({
        company_id,
        name: "Bestill service",
        slug: "bestill-service",
        category: "Service",
        audience_type: "both",
        internal_title: "Bestill service (intern)",
        external_title: "Bestill service",
        description: "Bestillingsskjema for service- og vedlikeholdsoppdrag. Fyll ut alle relevante seksjoner.",
        confirmation_text: "Takk for bestillingen! Den er registrert i systemet og vil bli behandlet. Du mottar bekreftelse når bestillingen er tildelt.",
        on_submit_action: "queue",
        is_active: true,
        created_by: user.id,
      })
      .select()
      .single();
    if (tmplErr) throw tmplErr;

    const templateId = tmpl.id;

    // Sections and fields definition
    const sections = [
      {
        title: "Bestillingstype", sort_order: 0, fields: [
          { field_key: "bestillingstype", label: "Er dette en intern eller ekstern bestilling?", field_type: "radio", is_required: true, options: ["Intern", "Ekstern"], sort_order: 0 },
          { field_key: "intern_avdeling", label: "Intern avdeling", field_type: "dropdown", is_required: false, options: ["Elektrotavler", "Service", "Prosjekt", "Montasje", "Annet"], sort_order: 1, conditional_logic: { action: "show", rules: [{ field_key: "bestillingstype", operator: "equals", value: "Intern" }], logic: "and" } },
        ],
      },
      {
        title: "Bestiller", sort_order: 1, fields: [
          { field_key: "bestiller_navn", label: "Bestillers navn", field_type: "short_text", is_required: true, sort_order: 0 },
          { field_key: "bestiller_firma", label: "Firma / avdeling", field_type: "short_text", is_required: true, sort_order: 1 },
          { field_key: "bestiller_epost", label: "E-post", field_type: "email", is_required: true, sort_order: 2 },
          { field_key: "bestiller_telefon", label: "Telefon", field_type: "phone", is_required: true, sort_order: 3 },
          { field_key: "bestiller_kontaktperson", label: "Ansvarlig intern kontaktperson", field_type: "short_text", is_required: false, sort_order: 4 },
          { field_key: "kostnadssted", label: "Kostnadssted / prosjektkode", field_type: "short_text", is_required: false, sort_order: 5, conditional_logic: { action: "show", rules: [{ field_key: "bestillingstype", operator: "equals", value: "Intern" }], logic: "and" } },
        ],
      },
      {
        title: "Kunde og anlegg", sort_order: 2, fields: [
          { field_key: "kundenavn", label: "Kundenavn", field_type: "short_text", is_required: true, sort_order: 0 },
          { field_key: "org_nr", label: "Org.nr", field_type: "org_number", is_required: false, sort_order: 1 },
          { field_key: "kunde_kontaktperson", label: "Kontaktperson hos kunde", field_type: "short_text", is_required: false, sort_order: 2 },
          { field_key: "kunde_telefon", label: "Telefon kunde", field_type: "phone", is_required: false, sort_order: 3 },
          { field_key: "kunde_epost", label: "E-post kunde", field_type: "email", is_required: false, sort_order: 4 },
          { field_key: "oppdragssted", label: "Oppdragssted", field_type: "short_text", is_required: false, sort_order: 5 },
          { field_key: "anleggsadresse", label: "Anleggsadresse", field_type: "address", is_required: true, sort_order: 6 },
          { field_key: "fakturaadresse", label: "Fakturaadresse", field_type: "address", is_required: false, sort_order: 7 },
          { field_key: "fakturamerking", label: "Fakturamerking", field_type: "short_text", is_required: false, sort_order: 8 },
          { field_key: "referanse_po", label: "Referanse / PO#", field_type: "short_text", is_required: false, sort_order: 9 },
          { field_key: "po_ikke_opprettet", label: "PO ikke opprettet ennå", field_type: "yes_no", is_required: false, sort_order: 10 },
          { field_key: "midlertidig_referanse", label: "Midlertidig referanse dersom PO mangler", field_type: "short_text", is_required: false, sort_order: 11, conditional_logic: { action: "show", rules: [{ field_key: "po_ikke_opprettet", operator: "equals", value: "true" }], logic: "and" } },
        ],
      },
      {
        title: "Oppdrag", sort_order: 3, fields: [
          { field_key: "oppdragstittel", label: "Kort oppdragstittel", field_type: "short_text", is_required: true, sort_order: 0 },
          { field_key: "type_arbeid", label: "Type arbeid", field_type: "dropdown", is_required: true, options: ["Servicearbeid", "Reklamasjon", "Feilsøking", "Ombygging tavle", "Utvidelse", "Hasteoppdrag", "Forebyggende service", "Annet"], sort_order: 1 },
          { field_key: "arbeidsbeskrivelse", label: "Detaljert arbeidsbeskrivelse", field_type: "long_text", is_required: true, sort_order: 2, help_text: "Beskriv arbeidet så detaljert som mulig" },
          { field_key: "dagens_situasjon", label: "Dagens situasjon", field_type: "long_text", is_required: false, sort_order: 3 },
          { field_key: "oensket_resultat", label: "Hva ønskes levert / sluttresultat", field_type: "long_text", is_required: false, sort_order: 4 },
          { field_key: "hastegrad", label: "Hastegrad", field_type: "radio", is_required: true, options: ["Kritisk stopp", "Høy", "Normal", "Lav"], sort_order: 5 },
          { field_key: "oensket_dato", label: "Ønsket utført dato", field_type: "date", is_required: false, sort_order: 6 },
          { field_key: "tidsvindu", label: "Tidsvindu på stedet", field_type: "short_text", is_required: false, placeholder: "F.eks. 08:00-16:00", sort_order: 7 },
        ],
      },
      {
        title: "Teknisk grunnlag", sort_order: 4, fields: [
          { field_key: "tegninger_vedlagt", label: "Reviderte tegninger vedlagt", field_type: "yes_no", is_required: false, sort_order: 0 },
          { field_key: "bilder_vedlagt", label: "Bilder vedlagt", field_type: "yes_no", is_required: false, sort_order: 1 },
          { field_key: "materialliste_vedlagt", label: "Materialliste vedlagt", field_type: "yes_no", is_required: false, sort_order: 2 },
          { field_key: "enlinjeskjema_vedlagt", label: "Enlinjeskjema vedlagt", field_type: "yes_no", is_required: false, sort_order: 3 },
          { field_key: "fdv_vedlagt", label: "FDV / annen dokumentasjon vedlagt", field_type: "yes_no", is_required: false, sort_order: 4 },
          { field_key: "teknisk_kommentar", label: "Kommentar til teknisk underlag", field_type: "long_text", is_required: false, sort_order: 5 },
        ],
      },
      {
        title: "Material og ansvar", sort_order: 5, fields: [
          { field_key: "materiell_ansvar", label: "Hvem skaffer materiell?", field_type: "radio", is_required: true, options: ["MCS Service skaffer alt", "Bestiller / kunde leverer alt", "Deles mellom partene"], sort_order: 0 },
          { field_key: "hva_leverer_bestiller", label: "Hva leverer bestiller / kunde?", field_type: "long_text", is_required: false, sort_order: 1, conditional_logic: { action: "show", rules: [{ field_key: "materiell_ansvar", operator: "equals", value: "Bestiller / kunde leverer alt" }, { field_key: "materiell_ansvar", operator: "equals", value: "Deles mellom partene" }], logic: "or" } },
          { field_key: "hva_skaffer_service", label: "Hva må service skaffe?", field_type: "long_text", is_required: false, sort_order: 2, conditional_logic: { action: "show", rules: [{ field_key: "materiell_ansvar", operator: "equals", value: "MCS Service skaffer alt" }, { field_key: "materiell_ansvar", operator: "equals", value: "Deles mellom partene" }], logic: "or" } },
          { field_key: "materiell_paa_stedet", label: "Er materiell på stedet?", field_type: "yes_no", is_required: false, sort_order: 3 },
          { field_key: "spesifikke_fabrikater", label: "Må bestemte fabrikater / artikkelnummer brukes?", field_type: "yes_no", is_required: false, sort_order: 4 },
          { field_key: "komponentkrav", label: "Beskrivelse av spesifikke komponentkrav", field_type: "long_text", is_required: false, sort_order: 5, conditional_logic: { action: "show", rules: [{ field_key: "spesifikke_fabrikater", operator: "equals", value: "true" }], logic: "and" } },
        ],
      },
      {
        title: "Gjennomføring / HMS", sort_order: 6, fields: [
          { field_key: "anlegg_i_drift", label: "Er anlegget i drift?", field_type: "yes_no", is_required: false, sort_order: 0 },
          { field_key: "maa_kobles_ut", label: "Må det kobles ut?", field_type: "yes_no", is_required: false, sort_order: 1 },
          { field_key: "koordinerer_utkobling", label: "Hvem koordinerer utkobling?", field_type: "short_text", is_required: false, sort_order: 2 },
          { field_key: "kreves_adgang", label: "Kreves adgang / ledsager?", field_type: "yes_no", is_required: false, sort_order: 3 },
          { field_key: "hms_risiko", label: "HMS-risiko / spesielle forhold", field_type: "long_text", is_required: false, sort_order: 4 },
          { field_key: "spesialutstyr", label: "Kreves spesialutstyr?", field_type: "short_text", is_required: false, sort_order: 5 },
          { field_key: "dokumentere_bilder", label: "Må arbeidet dokumenteres med bilder etterpå?", field_type: "yes_no", is_required: false, sort_order: 6 },
        ],
      },
      {
        title: "Vedlegg", description: "Last opp tegninger, bilder, materiallister og annen dokumentasjon.", sort_order: 7, fields: [
          { field_key: "vedlegg_filer", label: "Filer", field_type: "file_upload", is_required: false, sort_order: 0, help_text: "Tillatte formater: PDF, JPG, PNG, XLSX, DOCX" },
        ],
      },
      {
        title: "Intern kontroll", description: "Kun for interne bestillinger.", sort_order: 8,
        visibility_rules: [{ action: "show", rules: [{ field_key: "bestillingstype", operator: "equals", value: "Intern" }], logic: "and" }],
        fields: [
          { field_key: "kontroll_kundeinfo", label: "Kundeinfo er kontrollert", field_type: "yes_no", is_required: false, sort_order: 0 },
          { field_key: "kontroll_anleggsadresse", label: "Anleggsadresse er kontrollert", field_type: "yes_no", is_required: false, sort_order: 1 },
          { field_key: "kontroll_tegninger", label: "Tegninger er vedlagt eller vurdert ikke tilgjengelig", field_type: "yes_no", is_required: false, sort_order: 2 },
          { field_key: "kontroll_bilder", label: "Bilder er vedlagt eller vurdert ikke nødvendig", field_type: "yes_no", is_required: false, sort_order: 3 },
          { field_key: "kontroll_materialbehov", label: "Materialbehov er avklart", field_type: "yes_no", is_required: false, sort_order: 4 },
          { field_key: "kontroll_po", label: "PO / referanse er avklart eller markert som ikke opprettet", field_type: "yes_no", is_required: false, sort_order: 5 },
          { field_key: "kontroll_klar", label: "Bestillingen er klar for planlegging", field_type: "yes_no", is_required: false, sort_order: 6 },
        ],
      },
      {
        title: "Bekreftelse", sort_order: 9, fields: [
          { field_key: "bekreftelse", label: "Jeg bekrefter at opplysningene er så komplette som mulig", field_type: "yes_no", is_required: true, sort_order: 0 },
        ],
      },
    ];

    // Insert sections and fields
    for (const sec of sections) {
      const { data: sectionRow, error: secErr } = await sa
        .from("order_form_template_sections")
        .insert({
          template_id: templateId,
          title: sec.title,
          description: (sec as any).description || null,
          sort_order: sec.sort_order,
          visibility_rules: (sec as any).visibility_rules || [],
        })
        .select()
        .single();
      if (secErr) throw secErr;

      for (const field of sec.fields) {
        const { error: fieldErr } = await sa
          .from("order_form_template_fields")
          .insert({
            template_id: templateId,
            section_id: sectionRow.id,
            field_key: field.field_key,
            label: field.label,
            field_type: field.field_type,
            placeholder: (field as any).placeholder || null,
            help_text: (field as any).help_text || null,
            is_required: field.is_required,
            options: (field as any).options || null,
            conditional_logic: (field as any).conditional_logic || null,
            sort_order: field.sort_order,
          });
        if (fieldErr) throw fieldErr;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, template_id: templateId, sections: sections.length, fields: sections.reduce((n, s) => n + s.fields.length, 0) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("seed-order-template error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
