# Produktkilder og bildestatus – Lier VPS

Internt arbeidsdokument for innholdet i `src/components/public/product-catalog.ts`.
Ingenting herfra vises på nettsiden. Eksterne lenker skal aldri eksponeres mot kunde.

Sist gjennomgått: 2026-08-14

## Prinsipper for tekst

- Kun konservative, kundevennlige formuleringer: "passer ofte for", "aktuelt ved",
  "typisk valgt når", "må vurderes på befaring".
- Ingen priser, ingen "best i test", ingen garanterte besparelser.
- Ytelsestall (SCOP, SEER, dB, kW, energiklasse) er tillatt **kun** som direkte
  gjengivelse av offisielle produsent-/importørdata, lagret i
  `src/components/public/product-specs.ts`. Ingenting estimeres eller
  interpoleres. Mangler en verdi, utelates linjen.
- Lyd- og kuldeklima-notater i `product-catalog.ts` brukes kun der
  produsent/leverandør selv posisjonerer modellen slik, og formuleres som
  posisjonering – ikke som måltall.


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

## Spesifikasjoner (product-specs.ts)

Sist gjennomgått: 2026-08-14. Alle tall er hentet ordrett fra kilden i tabellen.
Kildelenkene (`specSourceUrl` / `specSourceLabel`) er interne og rendres aldri.

| Produkt | Kilde | Gjelder modell | Spesifikasjoner brukt | Mangler |
| --- | --- | --- | --- | --- |
| UWANO Pure | mee.no/uwanopure | UWANO Pure 7000 | SCOP (kaldt klima), energiklasse varme, lyd inne/ute, driftstemp. varme, kuldemedium (R290) | kW nominell/min-maks, kjøleeffekt, SEER, energiklasse kjøling, mål |
| Kaiteki | mee.no/kaiteki | Kaiteki 6300/6600 | SCOP, energiklasse varme, lyd inne/ute, driftstemp. varme, kuldemedium | kW nominell/min-maks, kjøleeffekt, SEER, energiklasse kjøling, mål |
| GUSSURI | mee.no/gussuri | serie | Lyd inne/ute | alt annet – MEE oppgir ikke tabell |
| IGURU | mee.no/iguru | IGURU 6200 | Varmeeffekt nominell, driftstemp. varme, kuldemedium, mål innedel | SCOP, SEER, energiklasser, lyd, kjøleeffekt, mål utedel |
| Furo | mee.no/furo | Furo 5100/6000 | Lyd innedel, garantert kapasitet ved -15/-25 °C | SCOP, SEER, energiklasser, kjøleeffekt, kuldemedium, mål |
| Zen | mee.no/zen | serie | SCOP, lyd innedel, driftstemp. varme, dybde innedel | kW, kjøleeffekt, SEER, energiklasser, lyd utedel, kuldemedium |
| Duo-modellen | mee.no/duo-7000 | Duo 7000 | Kapasitet ved -15 °C, driftstemp. varme, kuldemedium | SCOP, SEER, energiklasser, lyd, mål, kjøleeffekt |
| Nordic Multi | mee.no/nordic-multi | Nordic Multi 2/3/4 | Driftstemp. varme, kuldemedium | SCOP, SEER, energiklasser, lyd, kW, mål |
| Toshiba Signatur | toshibavarmepumper.no/signatur-25 | Signatur 25 | Full tabell: varme nom./maks, kjøling nom./maks, SCOP, SEER, begge energiklasser, lyd inne/ute, -25 °C, R32, mål inne/ute | veiledende areal |
| Toshiba Daiseikai 10 Kontur | toshibavarmepumper.no/toshiba-kontur-25 | Kontur 25 | Full tabell (som over) | veiledende areal |
| Toshiba Daiseikai 10 Ask | toshibavarmepumper.no/toshiba-ask-25 | Ask 25 | Full tabell (som over) | veiledende areal |
| Toshiba Polar | toshibavarmepumper.no/toshiba-polar-25 | Polar 25 | Full tabell (som over) | veiledende areal |
| Toshiba Seiya | toshibavarmepumper.no/toshiba-seiya-nordic-25 | Seiya Nordic 25 | Full tabell (som over) | stillemodus dB, veiledende areal |
| Toshiba Gulvmodell | toshibavarmepumper.no/toshiba-gulvmodell-25 | Gulvmodell 25 | Full tabell. SCOP 4,3 og energiklasse varme A+ fra produktbeskrivelsen; A++ i tabellen gjelder kjøling | veiledende areal |
| Toshiba Multisplitt Nordic | toshibavarmepumper.no/multi-nordic | Multi Nordic, 2 innedeler | Full tabell (samlet kapasitet) | veiledende areal |
| Panasonic HZ Flagship | Panasonic distributørkatalog – KIT-HZ25ZKE | KIT-HZ25ZKE | Varme nom./min-maks, kjøling nom./min-maks, SCOP 5,69, energiklasse varme, lyd inne/ute, -25 °C, R32, mål inne/ute | SEER, energiklasse kjøling, veiledende areal |
| Panasonic NZ | aircon.panasonic.eu (NZ25YKE) + distributørkatalog | KIT-NZ25YKE | Varme nom./min-maks, kjøling nom./min-maks, SCOP 5,0, SEER 8,0, begge energiklasser, lyd inne/ute, -25 °C, R32, mål inne/ute | veiledende areal |
| Panasonic CZ | distributørkatalog – KIT-CZ25ZKE | KIT-CZ25ZKE | Varme, kjøling, SCOP 4,3, energiklasse varme, lyd inne/ute, -25 °C, R32, mål | SEER, energiklasse kjøling, veiledende areal |
| Panasonic LZ | distributørkatalog – KIT-LZ25TKE | KIT-LZ25TKE | Varme, kjøling, SCOP 5,0, energiklasse varme, lyd inne/ute, -15 °C, R32, mål | SEER, energiklasse kjøling, kapasitet ved -25 °C, veiledende areal |
| Panasonic VZ Heatcharge | distributørkatalog – KIT-VZ12-SKE | KIT-VZ12-SKE | Varme, kjøling, SCOP 5,9, energiklasse varme, lyd inne/ute, -25 °C, R32, mål | SEER, energiklasse kjøling, dybde utedel, veiledende areal |
| Panasonic Gulvmodell | distributørkatalog – KIT-Z25CFEA-1 | KIT-Z25CFEA-1 | Varme, kjøling, SCOP 4,7, begge energiklasser, lyd inne/ute, -25 °C, R32, mål | SEER-tall, veiledende areal |

### Uten spesifikasjoner (viser ingen Nøkkeldata-blokk)

Panasonic Multisplitt, Panasonic Multisplitt nordisk, Panasonic Luft/vann,
Panasonic Næring, Toshiba Multisplitt, Tekstiltrekk til Signatur,
Større lokaler / flere soner.

### Trenger manuell verifisering

- **Panasonic Multisplitt (CU-3Z52TBE)** – distributørens produktside svarte 404
  ved gjennomgang. Spesifikasjoner må hentes på nytt.
- **Mitsubishi Electric samlet** – MEE publiserer ikke fullstendige
  spesifikasjonstabeller offentlig. Kun tall som står eksplisitt i teksten er
  brukt. Bør suppleres fra offisielle datablad/produktark når disse er tilgjengelige.
- **Veiledende areal** – ingen av kildene oppgir dette. Feltet
  `suitableAreaIndicative` er derfor tomt for alle produkter.

## Varianter i serien (oppdatert 2026-08-15)

`product-specs.ts` støtter nå `variants[]` – flere offisielt dokumenterte
størrelser per serie. Modalen viser en sammenlikningstabell («Størrelser i
serien») når serien har to eller flere dokumenterte størrelser.

| Serie | Dokumenterte størrelser | Kilde |
| --- | --- | --- |
| Panasonic HZ Flagship | KIT-HZ25ZKE, KIT-HZ35ZKE | distributørkatalog |
| Panasonic NZ | KIT-NZ25YKE, KIT-NZ35YKE, KIT-NZ50YKE | distributørkatalog |
| Panasonic CZ | KIT-CZ25ZKE, KIT-CZ35ZKE | distributørkatalog |
| Panasonic LZ | KIT-LZ25TKE, KIT-LZ35TKE | distributørkatalog |
| Panasonic Gulvmodell | KIT-Z25CFEA-1, KIT-Z35CFEA-1 | distributørkatalog |

Toshiba-kildene publiserer kun 25-varianten med full tabell, og Mitsubishi
Electric publiserer ikke variantvise tabeller offentlig. Disse har derfor
ingen variantsammenlikning – ingenting er estimert eller interpolert.
