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

| Produkt | Kilde brukt | Hva som er hentet | Bildenøkkel | Bildestatus |
| --- | --- | --- | --- | --- |
| UWANO Pure | Mitsubishi Electric Norge (produsent) | Serieplassering, komfortprofil | mitsubishi-uwano-pure | missing |
| Kaiteki | Mitsubishi Electric Norge | Serieplassering, fargevalg | mitsubishi-kaiteki | missing |
| GUSSURI | Mitsubishi Electric Norge | Komfort-/lydposisjonering | mitsubishi-gussuri | missing |
| IGURU | Mitsubishi Electric Norge | Kompaktposisjonering | mitsubishi-iguru | missing |
| Furo | Mitsubishi Electric Norge | Gulvmodell, plassering | mitsubishi-furo | missing |
| Zen | Mitsubishi Electric Norge | Designposisjonering | mitsubishi-zen | missing |
| Duo-modellen | Mitsubishi Electric Norge | To soner / én utedel | mitsubishi-duo | missing |
| Nordic Multi | Mitsubishi Electric Norge | Multiløsning, nordisk tilpasning | mitsubishi-nordic-multi | missing |
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
