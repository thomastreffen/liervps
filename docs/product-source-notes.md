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
| UWANO Pure | MEE – mee.no/uwanopure | Navn, familieplassering (Toppmodellen), komfortprofil, produktbilde | mitsubishi-uwano-pure | local_approved (2026-08-14) |
| Kaiteki | MEE – mee.no/kaiteki | Navn, familieplassering (Bestselgeren), fargevalg, produktbilde | mitsubishi-kaiteki | local_approved (2026-08-14) |
| GUSSURI | MEE – mee.no/gussuri | Navn, familieplassering (Komfortmodellen), lydposisjonering, produktbilde | mitsubishi-gussuri | local_approved (2026-08-14) |
| IGURU | MEE – mee.no/iguru | Navn, familieplassering (Kompaktmodellen), produktbilde | mitsubishi-iguru | local_approved (2026-08-14) |
| Furo | MEE – mee.no/furo | Navn, familieplassering (Gulvmodellen), plassering, produktbilde | mitsubishi-furo | local_approved (2026-08-14) |
| Zen | MEE – mee.no/zen | Navn, familieplassering (Designmodellen), produktbilde | mitsubishi-zen | local_approved (2026-08-14) |
| Duo-modellen | MEE – mee.no/duo-7000 | Navn, familieplassering (Duomodellen), produktbilde | mitsubishi-duo-modellen | local_approved (2026-08-14) |
| Nordic Multi | MEE – mee.no/nordic-multi | Navn, familieplassering (Multimodellen), produktbilde | mitsubishi-nordic-multi | local_approved (2026-08-14) |
| Panasonic HZ Flagship | Distributørkatalog – KIT-HZ25ZKE | Toppserie, nanoe X, produktbilde | panasonic-hz-flagship | local_approved (2026-08-14) |
| Panasonic NZ Etherea | Distributørkatalog – KIT-NZ25YKE | Plassering under toppserie, produktbilde | panasonic-nz-etherea | local_approved (2026-08-14) |
| Panasonic CZ | Distributørkatalog – KIT-CZ25ZKE | Kompakt, innebygget WiFi, produktbilde | panasonic-cz | local_approved (2026-08-14) |
| Panasonic LZ | Distributørkatalog – KIT-LZ25TKE | Utskiftingsmodell, produktbilde | panasonic-lz-retro-fit | local_approved (2026-08-14) |
| Panasonic VZ Heatcharge | Distributørkatalog – KIT-VZ12-SKE | Heatcharge-posisjonering, produktbilde | panasonic-vz-heatcharge | local_approved (2026-08-14) |
| Panasonic Gulvmodell | Distributørkatalog – KIT-Z25CFEA-1 | Gulvplassering, produktbilde | panasonic-gulvmodell | local_approved (2026-08-14) |
| Panasonic Multisplitt | Distributørkatalog – CU-3Z52TBE | Flere innedeler, én utedel, produktbilde (utedel) | panasonic-multisplitt | local_approved (2026-08-14) |
| Panasonic Luft-vann | Distributørkatalog | Vannbåren varme | panasonic-luft-vann | missing |
| Panasonic Multisplitt nordisk | Distributørkatalog | Nordisk multiløsning | panasonic-multisplitt-nordisk | missing |
| Panasonic Næring | Distributørkatalog | Næringsserier, drift | panasonic-naering | missing |
| Toshiba Signatur | Toshiba Norge (ABK-Qviller) – signatur-25 | Navn, designposisjonering, produktbilde | toshiba-signatur | local_approved (2026-08-14) |
| Toshiba Daiseikai 10 Kontur | Toshiba Norge – toshiba-kontur-25 | Navn, toppmodell-plassering, produktbilde | toshiba-daiseikai-10-kontur | local_approved (2026-08-14) |
| Toshiba Daiseikai 10 Ask | Toshiba Norge – toshiba-ask-25 | Navn, designklasse, produktbilde | toshiba-daiseikai-10-ask | local_approved (2026-08-14) |
| Toshiba Polar | Toshiba Norge – toshiba-polar-25 | Navn, kompakt nordisk modell, produktbilde | toshiba-polar | local_approved (2026-08-14) |
| Toshiba Seiya Nordic | Toshiba Norge – toshiba-seiya-nordic-25 | Navn, inngangsmodell, produktbilde | toshiba-seiya-nordic | local_approved (2026-08-14) |
| Toshiba Gulvmodell | Toshiba Norge – toshiba-gulvmodell-25 | Navn, gulvmodell, produktbilde | toshiba-gulvmodell | local_approved (2026-08-14) |
| Toshiba Multi Nordic | Toshiba Norge – multi-nordic | Navn, multiløsning kaldt klima, produktbilde | toshiba-multi-nordic | local_approved (2026-08-14) |
| Toshiba Multisplitt | Distributørkatalog | Flere innedeler | toshiba-multisplitt | missing |
| Tekstiltrekk til Signatur | Distributørkatalog | Tilbehør | toshiba-signatur-tekstil | missing |
| Større lokaler / flere soner | Egen tekst (merkeuavhengig) | Prosjektert løsning | – | missing |

## Bildeimport – godkjenningsgrunnlag

> «Approved by site owner for use pending dealer/supplier approval before public launch.»

22 produktbilder er lastet ned lokalt, konvertert til `.webp` og lagret i
`src/assets/lier/products/<merke>/`. Ingen hotlinking. Formell forhandler-/
leverandørgodkjenning må foreligge før offentlig lansering – se
`docs/product-image-import-plan.md` for full oversikt per bilde.
