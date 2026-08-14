# Produktbilder — Lier VPS

Her legges **kun rettighetsklarerte** produktbilder som Lier VPS har lov til å bruke
(offisielt forhandlermateriell, egne foto fra utførte installasjoner, eller bilder
med skriftlig tillatelse fra leverandør).

Ikke tillatt:

- hotlinking til leverandørens bilder
- skraping av bilder fra nett
- tilfeldige produktbilder funnet på internett
- AI-genererte «fake» produktbilder som utgir seg for å være en ekte modell

Mangler bildet, faller kortet automatisk tilbake til vår egen illustrasjon av en
moderne veggmontert varmepumpe. Det er helt greit å la slots stå tomme.

## Mappestruktur

```
src/assets/lier/products/
  mitsubishi/
  panasonic/
  toshiba/
  <merkeuavhengige løsningsbilder>
```

Undermappen er kun for ryddighet. Oppslaget skjer på **filnavnet** (uten filtype).

## Filnavn

Filnavnet må matche nøkkelen i `PRODUCT_IMAGE_KEY` i
`src/components/public/useProductImages.ts`:

| Modell                      | Filnavn (base)               | Mappe        |
| --------------------------- | ---------------------------- | ------------ |
| UWANO Pure                  | `mitsubishi-uwano-pure`      | `mitsubishi` |
| Kaiteki                     | `mitsubishi-kaiteki`         | `mitsubishi` |
| GUSSURI                     | `mitsubishi-gussuri`         | `mitsubishi` |
| Nordic Multi                | `mitsubishi-nordic-multi`    | `mitsubishi` |
| Panasonic HZ Flagship       | `panasonic-hz`               | `panasonic`  |
| Panasonic NZ                | `panasonic-nz`               | `panasonic`  |
| Panasonic VZ Heatcharge     | `panasonic-vz`               | `panasonic`  |
| Panasonic Gulvmodell        | `panasonic-gulvmodell`       | `panasonic`  |
| Toshiba Signatur            | `toshiba-signatur`           | `toshiba`    |
| Toshiba Daiseikai 10 Kontur | `toshiba-daiseikai-kontur`   | `toshiba`    |
| Toshiba Polar               | `toshiba-polar`              | `toshiba`    |
| Toshiba Gulvmodell          | `toshiba-gulvmodell`         | `toshiba`    |

Eksempel: `src/assets/lier/products/toshiba/toshiba-polar.webp`

Godkjente filtyper: `.webp` (anbefalt), `.png`, `.jpg`, `.jpeg`, `.svg`.

## Anbefalte dimensjoner

- Format: **4:3** (bildeflaten på kort og i modal er 4:3)
- Størrelse: **1200 × 900 px** (min. 800 × 600 px)
- Bakgrunn: hvit eller transparent PNG/WebP — produktet fritstilt
- Filstørrelse: helst under 250 kB per bilde
- Produktet bør ha litt luft rundt seg; bildet vises med `object-contain`,
  så det blir aldri strukket eller feil beskåret.

## Slik kobles bildet til produktdata

1. Legg filen i riktig mappe med riktig basenavn (tabellen over).
2. Ferdig — `import.meta.glob` plukker den opp automatisk ved build.

Nytt produkt uten oppføring i tabellen:

1. Legg til modellen i `GROUPS` i `src/components/public/ProductShowcase.tsx`.
2. Legg til `"<Modellnavn>": "<filnavn-base>"` i `PRODUCT_IMAGE_KEY`.
3. Legg bildefilen i riktig merkemappe.

Alternativt kan et enkelt kort peke direkte på en URL via feltet `image` på
produktet — bruk kun til lokale/rettighetsklarerte filer.

## Store filer

Bilder over ~100 kB bør legges på CDN med `lovable-assets` og committes som
`<filnavn>.asset.json` i samme mappe. Pointer-filer plukkes opp automatisk.
