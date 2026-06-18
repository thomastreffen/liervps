
# Materialliste / Plukkliste-modul

Bygger en integrert materialflyt per jobb/bestilling: opprett liste, plukk, forbruk, retur, print, eksport, standardpakker, og klargjør AI-forslag. Første versjon — praktisk flyt, ikke fullt lagersystem.

## Datamodell (migrasjon)

Nye tabeller i `public`:

- `material_lists` — én per jobb/ordre. Felter: `job_id`, `order_id`, `company_id`, `status`, tidsstempler for hver fase (`ordered_at`, `received_at`, `picked_at`, `sent_with_installer_at`, `consumption_registered_at`, `completed_at`), `notes`, `created_by`, `approved_by`.
- `material_list_items` — linjer. Felter: `elnr`, `supplier_sku`, `description`, `quantity_ordered/picked/used/returned`, `return_overridden`, `unit`, `supplier`, `source` (manual/template/copied/ai/added_after), `ai_confidence`, `ai_reason`, `comment`, `sort_order`. DB-trigger: hvis ikke overstyrt, `quantity_returned = picked - used`.
- `material_templates` + `material_template_items` — standardpakker (company-scoped).
- `material_products` — intern produktdatabase (elnr, beskrivelse, enhet, leverandør, supplier_sku, kategori, active).

GRANT + RLS for alle: lest/skrevet av `authenticated` innenfor egen `company_id` via eksisterende `user_memberships` / `has_role` mønster. Triggere for `updated_at`. Realtime publisering på `material_lists` og `material_list_items`.

## Frontend

### Ny fane på jobbkort
`src/components/project/ProjectSubnav.tsx` + `src/pages/JobDetail.tsx` får ny tab `materiell` mellom Skjemaer og Service. Ny komponent `src/components/material/MaterialTab.tsx` viser jobbinfo-header, status-badge og enten tomtilstand med "Opprett materialliste" eller selve listen.

### Tabell/kortvisning
`MaterialItemsTable.tsx` (desktop) + `MaterialItemCard.tsx` (mobil, via `useIsMobile`). Inline-redigering av antall, plukket, brukt; retur auto-beregnet med override-toggle. Knapper: Legg til vare, Legg til standardpakke, Kopier fra tidligere jobb, Foreslå med AI, Skriv ut plukkliste, Eksporter CSV, Registrer forbruk, Ferdigstill.

### Hurtigregistrering forbruk
`MaterialConsumptionSheet.tsx` — full-screen sheet på mobil, én linje av gangen eller liste. Hurtigknapper "Brukt alt" / "Ikke brukt" / "Mangler". "Legg til ekstra vare" — kilde `added_after`.

### Vare-søk
`AddMaterialItemDialog.tsx` — søkefelt mot `material_products` (elnr, beskrivelse, supplier_sku) + manuell linje hvis ingen treff.

### Standardpakker
`AddTemplateDialog.tsx` — velg pakke, antall ganger, preview linjer. Admin-side `src/pages/MaterialTemplatesPage.tsx` for CRUD på pakker.

### Kopier fra tidligere jobb
`CopyFromJobDialog.tsx` — lister jobber på samme `customer` eller `address` med eksisterende materialliste.

### AI-forslag
`AiSuggestMaterialsDialog.tsx` — knapp åpner godkjenningsvisning. Sender kontekst til ny edge function `material-ai-suggest` (Lovable AI Gateway, structured tool calling). Returnerer forslag — bruker godkjenner/redigerer/avviser linje for linje. Tekst: "AI-forslag må kontrolleres før bestilling." Edge function-stubb implementeres med Lovable AI; ingen autobestilling.

### PDF-plukkliste
`src/pages/MaterialPickListPrintPage.tsx` på rute `/jobs/:id/pickliste` — ren A4-layout, kun print-CSS, ingen meny. Topp: MCS-logo, jobbinfo, plassholder QR-kode (bruker eksisterende QR hvis tilgjengelig, ellers tekst-lenke). Tabell med avkrysning, elnr, beskrivelse, antall, enhet, kommentar, retur. Bunn: signaturfelt + instruksjon.

### CSV-eksport
Helper `src/lib/material-csv.ts` — bygger CSV med jobbnummer, kunde, adresse, elnr, beskrivelse, antall, enhet, leverandør, kommentar. Lastes ned via blob.

### Hooks
- `useMaterialList(jobId)` — fetch + realtime subscribe.
- `useMaterialTemplates(companyId)`.
- `useMaterialProducts()` — søk.

## Sikkerhet
- RLS per company via `user_memberships`.
- AI-edge function krever auth (401 hvis mangler).
- AI overskriver aldri eksisterende linjer; legger til som forslag.
- `updated_at`-triggere på alle tabeller.

## QA-sjekkliste etter bygg
- TypeScript-build grønn.
- Eksisterende JobDetail-faner fungerer.
- Materialliste kan opprettes fra både jobb og ordre (samme komponent, ulik FK).
- Print-side rendrer rent A4 uten sidemeny.
- Mobil: kort-layout, store touch-mål, hurtigknapper synlige.

## Ut av scope (første versjon)
- Faktisk lagerbeholdning / antall på hylle.
- Direkte integrasjon mot Onninen/Ahlsell/EFObasen (kun datamodell klar).
- Automatisk innkjøpsordre.
- Strekkode-skanning (kan legges til senere).

Bekreft, så starter jeg med migrasjon + minimal end-to-end flyt (fane, opprett liste, legg til linjer, print, CSV) først, deretter standardpakker → kopier → AI-stub → produktsøk.
