import { supabase } from "@/integrations/supabase/client";

// MCS-tilpassede standardmaler. Generiske punkter — admin redigerer ved behov.
// Tagging via hms_areas + suggested_work_types styrer suggest_hms_areas-rangering.

type ItemType =
  | "yes_no_na" | "text" | "long_text" | "attachment"
  | "risk" | "mitigation" | "signature" | "responsible" | "due_date";

interface SeedItem {
  label: string;
  item_type: ItemType;
  is_required?: boolean;
  help_text?: string;
}
interface SeedSection {
  title: string;
  description?: string;
  items: SeedItem[];
}
interface SeedTemplate {
  kind: "sja" | "checklist";
  name: string;
  description: string;
  category: string;
  hms_areas: string[];
  suggested_work_types: string[];
  requires_near_electrical?: boolean;
  requires_off_hours?: boolean;
  sections: SeedSection[];
}

const sjaCommonHeader: SeedSection = {
  title: "Identifikasjon",
  items: [
    { label: "Oppdrag / prosjekt", item_type: "text", is_required: true },
    { label: "Adresse / lokasjon", item_type: "text", is_required: true },
    { label: "Ansvarlig leder for arbeidet", item_type: "responsible", is_required: true },
    { label: "Dato for utførelse", item_type: "due_date", is_required: true },
    { label: "Beskrivelse av arbeidet", item_type: "long_text", is_required: true },
  ],
};

const sjaCommonClose: SeedSection = {
  title: "Bekreftelse",
  items: [
    { label: "Vernerunde gjennomført før oppstart", item_type: "yes_no_na", is_required: true },
    { label: "Alle deltakere er informert", item_type: "yes_no_na", is_required: true },
    { label: "Bilder fra arbeidsplass", item_type: "attachment" },
    { label: "Signatur ansvarlig", item_type: "signature", is_required: true },
  ],
};

const TEMPLATES: SeedTemplate[] = [
  {
    kind: "sja", category: "datacenter", name: "SJA Datacenter",
    description: "Sikker jobbanalyse for arbeid i datacenter med strenge adgangs- og tilgjengelighetskrav.",
    hms_areas: ["electrical_safety", "fse", "ppe", "internal_control"],
    suggested_work_types: ["datacenter", "tavlemontasje"],
    requires_near_electrical: true,
    sections: [
      sjaCommonHeader,
      {
        title: "Adgang og tilgjengelighet", items: [
          { label: "Tilgang godkjent av kunde", item_type: "yes_no_na", is_required: true },
          { label: "Hot-aisle / cold-aisle hensyn dokumentert", item_type: "long_text" },
          { label: "Påvirkning på driftskritiske systemer vurdert", item_type: "risk", is_required: true },
          { label: "Tiltak for å unngå utilsiktet utløsning av brann/slukkesystem", item_type: "mitigation" },
        ],
      },
      {
        title: "Elektrisk sikkerhet", items: [
          { label: "Spenningsavslag før arbeid?", item_type: "yes_no_na", is_required: true, help_text: "Hvis nei: AUS-prosedyre kreves" },
          { label: "Faresone og avsperring etablert", item_type: "yes_no_na", is_required: true },
          { label: "Sakkyndig leder for arbeidet (FSE)", item_type: "responsible", is_required: true },
        ],
      },
      sjaCommonClose,
    ],
  },
  {
    kind: "sja", category: "naeringsbygg", name: "SJA Næringsbygg",
    description: "Sikker jobbanalyse for elektrisk arbeid i drift­satte næringsbygg.",
    hms_areas: ["electrical_safety", "fse", "ppe"],
    suggested_work_types: ["naeringsbygg", "service"],
    sections: [
      sjaCommonHeader,
      {
        title: "Bygg og brukere", items: [
          { label: "Påvirker arbeidet brukere/leietakere?", item_type: "yes_no_na", is_required: true },
          { label: "Behov for varsling i forkant", item_type: "text" },
          { label: "Risiko for fall fra høyde", item_type: "risk" },
          { label: "Rømningsveier holdes fri", item_type: "yes_no_na", is_required: true },
        ],
      },
      sjaCommonClose,
    ],
  },
  {
    kind: "sja", category: "tavlemontasje", name: "SJA Tavlemontasje",
    description: "Sikker jobbanalyse for montering, ombygging og service på tavle.",
    hms_areas: ["electrical_safety", "fse", "ppe", "ee_waste"],
    suggested_work_types: ["tavlemontasje"],
    requires_near_electrical: true,
    sections: [
      sjaCommonHeader,
      {
        title: "Tavlearbeid", items: [
          { label: "Spenningsavslag av tavle", item_type: "yes_no_na", is_required: true },
          { label: "Lock-out / Tag-out etablert", item_type: "yes_no_na", is_required: true },
          { label: "Nær spenningsførende del?", item_type: "yes_no_na" },
          { label: "Lysbuevernutstyr i bruk (kategori)", item_type: "text" },
          { label: "Fjerning av EE-avfall planlagt", item_type: "yes_no_na" },
        ],
      },
      sjaCommonClose,
    ],
  },
  {
    kind: "sja", category: "stromskinner", name: "SJA Strømskinner",
    description: "Sikker jobbanalyse for montasje og service på strømskinneanlegg.",
    hms_areas: ["electrical_safety", "fse", "ppe"],
    suggested_work_types: ["stromskinner"],
    requires_near_electrical: true,
    sections: [
      sjaCommonHeader,
      {
        title: "Skinnesystem", items: [
          { label: "Spenningsavslag på berørt seksjon", item_type: "yes_no_na", is_required: true },
          { label: "Behov for lift / stillas", item_type: "yes_no_na" },
          { label: "Sertifikat for løfteutstyr verifisert", item_type: "yes_no_na" },
          { label: "Risiko for fallende deler under skinnen", item_type: "risk" },
          { label: "Områdeavsperring under arbeid", item_type: "mitigation" },
        ],
      },
      sjaCommonClose,
    ],
  },
  {
    kind: "sja", category: "service", name: "SJA Serviceoppdrag",
    description: "Lett SJA for kortere serviceoppdrag.",
    hms_areas: ["electrical_safety", "ppe"],
    suggested_work_types: ["service"],
    sections: [
      sjaCommonHeader,
      {
        title: "Risikovurdering", items: [
          { label: "Hovedrisiko identifisert", item_type: "risk", is_required: true },
          { label: "Tiltak", item_type: "mitigation", is_required: true },
          { label: "Verneutstyr i bruk", item_type: "yes_no_na", is_required: true },
        ],
      },
      sjaCommonClose,
    ],
  },
  {
    kind: "sja", category: "near_electrical", name: "SJA Arbeid nær elektriske anlegg",
    description: "Spesifikk SJA når arbeid utføres nær spenningsførende anlegg uten å berøre dem.",
    hms_areas: ["electrical_safety", "fse", "ppe"],
    suggested_work_types: ["service", "naeringsbygg", "datacenter"],
    requires_near_electrical: true,
    sections: [
      sjaCommonHeader,
      {
        title: "Avstand og barrierer", items: [
          { label: "Sikker arbeidsavstand vurdert (FSE §14)", item_type: "yes_no_na", is_required: true },
          { label: "Barriere mellom arbeidsområde og spenningsførende del", item_type: "long_text" },
          { label: "Ekstra observatør tilstede ved behov", item_type: "yes_no_na" },
        ],
      },
      sjaCommonClose,
    ],
  },
  {
    kind: "sja", category: "off_hours", name: "SJA Kveld/natt/alenearbeid",
    description: "SJA for arbeid utenfor normal arbeidstid eller alenearbeid.",
    hms_areas: ["psychosocial", "ppe", "internal_control"],
    suggested_work_types: ["service"],
    requires_off_hours: true,
    sections: [
      sjaCommonHeader,
      {
        title: "Alene-/skiftvurdering", items: [
          { label: "Er arbeidet alenearbeid?", item_type: "yes_no_na", is_required: true },
          { label: "Innsjekksrutine avtalt", item_type: "text", help_text: "Hvem ringes og hvor ofte" },
          { label: "Mobildekning på stedet", item_type: "yes_no_na" },
          { label: "Risiko for tretthet", item_type: "risk" },
        ],
      },
      sjaCommonClose,
    ],
  },
  // CHECKLISTS
  {
    kind: "checklist", category: "onboarding", name: "Sjekkliste HMS-opplæring nyansatt",
    description: "Gjennomgang av HMS for nyansatte i MCS Service.",
    hms_areas: ["internal_control", "fse", "ppe"],
    suggested_work_types: [],
    sections: [
      {
        title: "Generelt", items: [
          { label: "HMS-håndbok lest og forstått", item_type: "yes_no_na", is_required: true },
          { label: "Verneombud presentert", item_type: "yes_no_na", is_required: true },
          { label: "Varslingsrutiner ved avvik", item_type: "yes_no_na", is_required: true },
        ],
      },
      {
        title: "Elektrofag", items: [
          { label: "FSE-opplæring gjennomført", item_type: "yes_no_na", is_required: true },
          { label: "Førstehjelp ved strømulykke gjennomgått", item_type: "yes_no_na", is_required: true },
          { label: "Rutiner for arbeid på/nær anlegg", item_type: "yes_no_na", is_required: true },
        ],
      },
      {
        title: "PVU og utstyr", items: [
          { label: "Personlig verneutstyr utlevert", item_type: "yes_no_na", is_required: true },
          { label: "Bilnøkler / firmabil signert", item_type: "yes_no_na" },
          { label: "Signatur nyansatt", item_type: "signature", is_required: true },
          { label: "Signatur leder", item_type: "signature", is_required: true },
        ],
      },
    ],
  },
  {
    kind: "checklist", category: "ppe", name: "Sjekkliste Verneutstyr",
    description: "Daglig kontroll av personlig verneutstyr før arbeid.",
    hms_areas: ["ppe"],
    suggested_work_types: ["tavlemontasje", "stromskinner", "datacenter", "service"],
    sections: [
      {
        title: "PVU-kontroll", items: [
          { label: "Hjelm i god stand", item_type: "yes_no_na", is_required: true },
          { label: "Vernebriller", item_type: "yes_no_na", is_required: true },
          { label: "Hørselsvern ved behov", item_type: "yes_no_na" },
          { label: "Lysbue-dressing godkjent for spenning", item_type: "yes_no_na" },
          { label: "Hansker innen sertifiseringsdato", item_type: "yes_no_na", is_required: true },
          { label: "Fallsikring kontrollert", item_type: "yes_no_na" },
          { label: "Avvik / ny rekvisisjon", item_type: "long_text" },
        ],
      },
    ],
  },
  {
    kind: "checklist", category: "datacenter_access", name: "Sjekkliste Datacenter adgang og sikkerhet",
    description: "Adgangskontroll og sikkerhet før entring av datacenter.",
    hms_areas: ["internal_control"],
    suggested_work_types: ["datacenter"],
    sections: [
      {
        title: "Adgang", items: [
          { label: "Adgang godkjent og logget hos kunde", item_type: "yes_no_na", is_required: true },
          { label: "Følgesvenn-krav avklart", item_type: "yes_no_na" },
          { label: "Verktøy registrert ved inngang", item_type: "yes_no_na" },
        ],
      },
      {
        title: "Sikkerhet i hall", items: [
          { label: "Slukkesystem-status forstått", item_type: "yes_no_na", is_required: true },
          { label: "Nødavstigning / nødstopp lokalisert", item_type: "yes_no_na", is_required: true },
          { label: "Kabling og kjøling ikke blokkert", item_type: "yes_no_na" },
        ],
      },
    ],
  },
  {
    kind: "checklist", category: "pre_start", name: "Sjekkliste Før jobbstart",
    description: "Hurtigkontroll på arbeidsstedet før oppstart av oppdrag.",
    hms_areas: ["internal_control", "ppe"],
    suggested_work_types: ["service", "tavlemontasje", "stromskinner", "naeringsbygg"],
    sections: [
      {
        title: "Oppstart", items: [
          { label: "Riktig adresse / lokasjon bekreftet", item_type: "yes_no_na", is_required: true },
          { label: "Kontaktperson på stedet truffet", item_type: "yes_no_na" },
          { label: "SJA gjennomgått med team", item_type: "yes_no_na", is_required: true },
          { label: "Verktøy og materiell på plass", item_type: "yes_no_na", is_required: true },
        ],
      },
    ],
  },
  {
    kind: "checklist", category: "post_work", name: "Sjekkliste Sluttkontroll og rydding",
    description: "Avslutning og overlevering etter utført arbeid.",
    hms_areas: ["ee_waste", "internal_control"],
    suggested_work_types: ["service", "tavlemontasje", "stromskinner", "naeringsbygg", "datacenter"],
    sections: [
      {
        title: "Sluttkontroll", items: [
          { label: "Funksjonstest gjennomført", item_type: "yes_no_na", is_required: true },
          { label: "Spenning gjenopprettet", item_type: "yes_no_na", is_required: true },
          { label: "EE-avfall samlet og merket", item_type: "yes_no_na", is_required: true },
          { label: "Arbeidsplassen ryddet", item_type: "yes_no_na", is_required: true },
          { label: "Bilder etter ferdigstillelse", item_type: "attachment" },
          { label: "Overlevert til kunde", item_type: "yes_no_na" },
          { label: "Signatur tekniker", item_type: "signature", is_required: true },
        ],
      },
    ],
  },
];

export async function seedMcsStandardTemplates(companyId: string): Promise<number> {
  const sb = supabase as any;
  let created = 0;

  for (const tpl of TEMPLATES) {
    // Skip if a template with same name+kind already exists
    const { data: existing } = await sb
      .from("hms_templates")
      .select("id")
      .eq("company_id", companyId)
      .eq("name", tpl.name)
      .eq("kind", tpl.kind)
      .is("deleted_at", null)
      .maybeSingle();
    if (existing) continue;

    const { data: t, error: tErr } = await sb
      .from("hms_templates")
      .insert({
        company_id: companyId,
        kind: tpl.kind,
        name: tpl.name,
        description: tpl.description,
        category: tpl.category,
        hms_areas: tpl.hms_areas,
        suggested_work_types: tpl.suggested_work_types,
        requires_near_electrical: tpl.requires_near_electrical ?? null,
        requires_off_hours: tpl.requires_off_hours ?? null,
      })
      .select("id")
      .single();
    if (tErr || !t) throw tErr ?? new Error("Kunne ikke opprette mal");

    for (let si = 0; si < tpl.sections.length; si++) {
      const sec = tpl.sections[si];
      const { data: section, error: sErr } = await sb
        .from("hms_template_sections")
        .insert({
          template_id: t.id,
          ordering: si,
          title: sec.title,
          description: sec.description ?? null,
        })
        .select("id")
        .single();
      if (sErr || !section) throw sErr ?? new Error("Kunne ikke opprette seksjon");

      const items = sec.items.map((it, idx) => ({
        template_id: t.id,
        section_id: section.id,
        ordering: idx,
        item_type: it.item_type,
        label: it.label,
        help_text: it.help_text ?? null,
        is_required: !!it.is_required,
      }));
      if (items.length) {
        const { error: iErr } = await sb.from("hms_template_items").insert(items);
        if (iErr) throw iErr;
      }
    }
    created++;
  }
  return created;
}
