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

## Flere bilder per produkt (2026-08-14)

Datamodellen støtter nå flere bilder per produkt:

```ts
images?: {
  key: string;                 // lokalt filnavn uten filendelse
  type: "primary" | "indoor" | "outdoor" | "lifestyle" | "detail" | "variant";
  alt: string;
  status: "local_approved" | "needs_approval" | "missing";
}[]
```

- `imageKey` beholdes og brukes som primærbilde når `images` mangler.
- Produktkort viser kun ett bilde (primary → imageKey → egen illustrasjon).
  Ingen karusell på kort.
- Modalen viser stort bilde + miniatyrer når det finnes mer enn ett bilde.
- Bilder uten lokal fil filtreres bort før rendring, så manglende
  sekundærbilder aldri gir ødelagte bildeikoner.

Navnekonvensjon ved flere bilder:

```
mitsubishi-uwano-pure-primary.webp
mitsubishi-uwano-pure-outdoor.webp
mitsubishi-uwano-pure-lifestyle.webp
panasonic-hz-flagship-primary.webp
toshiba-signatur-primary.webp
```

**Status i dag:** alle 22 importerte produktbilder er enkeltbilder, så ingen
produkter har galleri ennå. Nye utedels-, detalj- og miljøbilder kan legges
inn uten kodeendringer – kun fil + `images[]`-oppføring. Godkjenningsgrunnlag
er uendret: «Approved by site owner for use pending dealer/supplier approval
before public launch.»
