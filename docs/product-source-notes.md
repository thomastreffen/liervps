# Produktkilder og bildestatus – Lier VPS

Internt arbeidsdokument for innholdet i `src/components/public/product-catalog.ts`.
Ingenting herfra vises på nettsiden. Eksterne lenker skal aldri eksponeres mot kunde.

Sist gjennomgått: 2026-08-14

## Prinsipper for tekst

- Kun konservative, kundevennlige formuleringer: "passer ofte for", "aktuelt ved",
  "typisk valgt når", "må vurderes på befaring".
- Ingen priser, ingen eksakte ytelsestall (SCOP, dB, kW), ingen "best i test",
  ingen garanterte besparelser.
- Lyd- og kuldeklima-notater brukes kun der produsent/leverandør selv posisjonerer
  modellen slik, og formuleres som posisjonering – ikke som måltall.

## Bildestatus

`missing` = ingen lokal fil ennå (kortet viser vår egen illustrasjon)
`local` = rettighetsklarert fil ligger i `src/assets/lier/products/<merke>/`
`approved-source-needed` = bilde finnes hos leverandør, bruksrett må avklares
`needs_approval` = bildekandidat identifisert hos produsent, bruksrett ikke bekreftet – ikke importert
`local_approved` = rettighetsklarert fil lagret lokalt

| Produkt | Kilde brukt | Hva som er hentet | Bildenøkkel | Bildestatus |
| --- | --- | --- | --- | --- |
| UWANO Pure | MEE – https://mee.no/privat/produktkategori/luft-luft-varmepumper/uwanopure/ | Navn, familieplassering (Toppmodellen), komfortprofil | mitsubishi-uwano-pure | needs_approval (2026-08-14) |
| Kaiteki | MEE – https://mee.no/privat/produktkategori/luft-luft-varmepumper/kaiteki/ | Navn, familieplassering (Bestselgeren), fargevalg | mitsubishi-kaiteki | needs_approval (2026-08-14) |
| GUSSURI | MEE – https://mee.no/privat/produktkategori/luft-luft-varmepumper/gussuri/ | Navn, familieplassering (Komfortmodellen), lydposisjonering | mitsubishi-gussuri | needs_approval (2026-08-14) |
| IGURU | MEE – https://mee.no/privat/produktkategori/luft-luft-varmepumper/iguru/ | Navn, familieplassering (Kompaktmodellen) | mitsubishi-iguru | needs_approval (2026-08-14) |
| Furo | MEE – https://mee.no/privat/produktkategori/luft-luft-varmepumper/furo/ | Navn, familieplassering (Gulvmodellen), plassering | mitsubishi-furo | needs_approval (2026-08-14) |
| Zen | MEE – https://mee.no/privat/produktkategori/luft-luft-varmepumper/zen/ | Navn, familieplassering (Designmodellen) | mitsubishi-zen | needs_approval (2026-08-14) |
| Duo-modellen | MEE – https://mee.no/privat/produktkategori/luft-luft-varmepumper/duo-7000/ | Navn, familieplassering (Duomodellen), to soner / én utedel | mitsubishi-duo-modellen | needs_approval (2026-08-14) |
| Nordic Multi | MEE – https://mee.no/privat/produktkategori/luft-luft-varmepumper/nordic-multi/ | Navn, familieplassering (Multimodellen), nordisk tilpasning | mitsubishi-nordic-multi | needs_approval (2026-08-14) |
| Panasonic HZ Flagship | Distributørkatalog | Toppserie, nanoe X | panasonic-hz | missing |
| Panasonic NZ Etherea | Distributørkatalog | Plassering under toppserie | panasonic-nz | missing |
| Panasonic CZ | Distributørkatalog | Kompakt, innebygget WiFi | panasonic-cz | missing |
| Panasonic LZ | Distributørkatalog | Utskiftingsmodell | panasonic-lz | missing |
| Panasonic VZ Heatcharge | Distributørkatalog | Heatcharge-posisjonering | panasonic-vz | missing |
| Panasonic Gulvmodell | Distributørkatalog | Gulvplassering | panasonic-gulvmodell | missing |
| Panasonic Luft-vann | Distributørkatalog | Vannbåren varme | panasonic-luft-vann | missing |
| Panasonic Multisplitt | Distributørkatalog | Flere innedeler, én utedel | panasonic-multisplitt | missing |
| Panasonic Multisplitt nordisk | Distributørkatalog | Nordisk multiløsning | panasonic-multisplitt-nordisk | missing |
| Panasonic Næring | Distributørkatalog | Næringsserier, drift | panasonic-naering | missing |
| Toshiba Signatur | Distributørkatalog | Design, tekstilfront | toshiba-signatur | missing |
| Toshiba Daiseikai 10 Kontur | Distributørkatalog | Toppmodell, helårsdrift | toshiba-daiseikai-kontur | missing |
| Toshiba Daiseikai 10 Ask | Distributørkatalog | Variant av toppserie | toshiba-daiseikai-ask | missing |
| Toshiba Polar | Distributørkatalog | Kaldt klima | toshiba-polar | missing |
| Toshiba Seiya Nordic | Distributørkatalog | Inngangsmodell, nordisk | toshiba-seiya | missing |
| Toshiba Gulvmodell | Distributørkatalog | Gulvplassering | toshiba-gulvmodell | missing |
| Toshiba Multisplitt | Distributørkatalog | Flere innedeler | toshiba-multisplitt | missing |
| Toshiba Multi Nordic | Distributørkatalog | Nordisk multiløsning | toshiba-multi-nordic | missing |
| Tekstiltrekk til Signatur | Distributørkatalog | Tilbehør | toshiba-signatur-tekstil | missing |
| Større lokaler / flere soner | Egen tekst (merkeuavhengig) | Prosjektert løsning | – | missing |

## Neste steg for bilder

1. Be Mitsubishi Electric Norge, samt distributør for Panasonic og Toshiba,
   om skriftlig bekreftelse på bruk av produktbilder på liervps.no.
2. Last ned kun fra offisiell bildebank etter bekreftelse.
3. Legg filene i `src/assets/lier/products/<merke>/` etter navnekonvensjonen
   i `src/assets/lier/products/README.md`.
4. Sett `imageStatus: "local"` i `product-catalog.ts` og oppdater tabellen over.


Mitsubishi-bilder: se `docs/product-image-import-plan.md`. Ingen MEE-bilder er
importert – bruksrett for forhandler-/partnerbruk er ikke skriftlig bekreftet.
