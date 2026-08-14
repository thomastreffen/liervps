# Bildeimport – produktbilder Lier VPS

Internt arbeidsdokument. Ingenting herfra vises på nettsiden, og ingen eksterne
lenker eksponeres mot kunde.

Sist gjennomgått: 2026-08-14

## Godkjenningsgrunnlag

> «Approved by site owner for use pending dealer/supplier approval before public launch.»

Nettstedseier har bekreftet at produktbilder fra merke-/distributørkildene under
kan brukes på liervps.no i utviklings- og pre-launch-fasen. Nettstedet skal ikke
lanseres offentlig før forhandler-/leverandørstatus er formelt godkjent.

## Teknisk policy

- Bilder lastes ned og lagres lokalt i repoet. Ingen hotlinking.
- Konvertert til `.webp` (kvalitet 82), maks 1200 px lengste side.
- Sideforhold bevares. Vises i fast 4:3-slot med `object-contain` – aldri
  beskåret eller strukket.
- Mangler et bilde, beholdes vår egen illustrasjon som fallback.
- Importerte bilder markeres `imageStatus: "local_approved"` i
  `product-catalog.ts`.

## Importerte bilder (2026-08-14)

### Mitsubishi Electric — kilde: mee.no (produsent Norge)

| Produkt | Filnavn | Kildeside |
| --- | --- | --- |
| UWANO Pure | `mitsubishi-uwano-pure.webp` | mee.no · uwanopure |
| GUSSURI | `mitsubishi-gussuri.webp` | mee.no · gussuri |
| Kaiteki | `mitsubishi-kaiteki.webp` | mee.no · kaiteki |
| IGURU | `mitsubishi-iguru.webp` | mee.no · iguru |
| Furo | `mitsubishi-furo.webp` | mee.no · furo |
| Zen | `mitsubishi-zen.webp` | mee.no · zen |
| Duo-modellen | `mitsubishi-duo-modellen.webp` | mee.no · duo-7000 |
| Nordic Multi | `mitsubishi-nordic-multi.webp` | mee.no · nordic-multi |

### Toshiba — kilde: toshibavarmepumper.no (ABK-Qviller, importør)

| Produkt | Filnavn | Kildeside |
| --- | --- | --- |
| Signatur | `toshiba-signatur.webp` | signatur-25 |
| Daiseikai 10 Kontur | `toshiba-daiseikai-10-kontur.webp` | toshiba-kontur-25 |
| Daiseikai 10 Ask | `toshiba-daiseikai-10-ask.webp` | toshiba-ask-25 |
| Polar | `toshiba-polar.webp` | toshiba-polar-25 |
| Seiya Nordic | `toshiba-seiya-nordic.webp` | toshiba-seiya-nordic-25 |
| Gulvmodell | `toshiba-gulvmodell.webp` | toshiba-gulvmodell-25 |
| Multi Nordic | `toshiba-multi-nordic.webp` | multi-nordic |

### Panasonic — kilde: varmepumpeservice.no (distributørkatalog)

| Produkt | Filnavn | Kildeartikkel |
| --- | --- | --- |
| HZ Flagship | `panasonic-hz-flagship.webp` | KIT-HZ25ZKE |
| NZ Etherea | `panasonic-nz-etherea.webp` | KIT-NZ25YKE |
| CZ | `panasonic-cz.webp` | KIT-CZ25ZKE |
| Gulvmodell | `panasonic-gulvmodell.webp` | KIT-Z25CFEA-1 |
| LZ Retro Fit | `panasonic-lz-retro-fit.webp` | KIT-LZ25TKE |
| VZ Heatcharge | `panasonic-vz-heatcharge.webp` | KIT-VZ12-SKE |
| Multisplitt | `panasonic-multisplitt.webp` | CU-3Z52TBE (utedel) |

## Fortsatt uten bilde (fallback-illustrasjon)

- Panasonic Luft-vann, Panasonic Multisplitt nordisk, Panasonic Næringsserier
- Toshiba Multisplitt (ikke-nordisk), Toshiba tekstiltrekk
- «Større lokaler / flere soner» (merkeuavhengig løsning)

## Før offentlig lansering

1. Innhent skriftlig forhandler-/leverandørgodkjenning fra Mitsubishi Electric
   Norge, ABK-Qviller (Toshiba) og Panasonic-distributør.
2. Bytt ev. til bilder fra offisiell bildebank hvis leverandør ønsker det.
3. Oppdater dette dokumentet og `docs/product-source-notes.md`.

## Flere bilder per produkt (oppdatert 2026-08-15)

Datamodellen støtter flere bilder per produkt via `images[]`
(`primary | indoor | outdoor | lifestyle | detail | variant`). Galleriene er
samlet i `PRODUCT_GALLERIES` i `product-catalog.ts` og kobles automatisk på
produktet via `imageKey`. Kortene viser kun primærbildet; modalen viser
galleri med miniatyrer. Bilder uten lokal fil filtreres bort.

Totalt 77 lokale produktbilder i 22 gallerier.

| Bildenøkkel | Roller | Antall |
| --- | --- | --- |
| `mitsubishi-duo-modellen` | primary, detail, lifestyle | 3 |
| `mitsubishi-furo` | primary, detail, indoor, lifestyle | 4 |
| `mitsubishi-gussuri` | primary, detail, indoor, lifestyle, outdoor | 5 |
| `mitsubishi-iguru` | primary, indoor, lifestyle | 3 |
| `mitsubishi-kaiteki` | primary, indoor, lifestyle, variant | 4 |
| `mitsubishi-nordic-multi` | primary, lifestyle | 2 |
| `mitsubishi-uwano-pure` | primary, detail, indoor, lifestyle, outdoor | 5 |
| `mitsubishi-zen` | primary, indoor, lifestyle, outdoor, variant | 5 |
| `panasonic-cz` | primary, indoor | 2 |
| `panasonic-gulvmodell` | primary, detail, indoor, outdoor, variant | 5 |
| `panasonic-hz-flagship` | primary, indoor, lifestyle, outdoor, variant | 5 |
| `panasonic-lz-retro-fit` | primary, indoor, outdoor | 3 |
| `panasonic-multisplitt` | primary | 1 |
| `panasonic-nz-etherea` | primary, indoor, outdoor, variant | 4 |
| `panasonic-vz-heatcharge` | primary, indoor, outdoor | 3 |
| `toshiba-daiseikai-10-ask` | primary, lifestyle, variant | 3 |
| `toshiba-daiseikai-10-kontur` | primary, detail, lifestyle | 3 |
| `toshiba-gulvmodell` | primary, detail, lifestyle | 3 |
| `toshiba-multi-nordic` | primary, lifestyle | 2 |
| `toshiba-polar` | primary, detail, indoor, lifestyle | 4 |
| `toshiba-seiya-nordic` | primary, detail, indoor, lifestyle | 4 |
| `toshiba-signatur` | primary, detail, lifestyle, variant | 4 |

Godkjenningsgrunnlag er uendret: «Approved by site owner for use pending
dealer/supplier approval before public launch.» Sekundærbildene er hentet fra
de samme merke-/importørsidene som primærbildene (mee.no,
toshibavarmepumper.no, distributørkatalog Panasonic), lastet ned lokalt og
konvertert til `.webp` (maks 1200 px, kvalitet 82, hvit bakgrunn der kilden
var transparent PNG). Ingen hotlinking.

Bilder som ble vurdert og forkastet: måltegninger på sort bakgrunn
(Mitsubishi IGURU), sertifiseringsgrafikk (Toshiba Ask) og app-skjermbilder
(Toshiba Multi Nordic) – ikke produktrelevante nok for kundevendt galleri.
