# Produktkilder og bildestatus – Lier VPS

Internt arbeidsdokument for innholdet i `src/components/public/product-catalog.ts`.
Ingenting herfra vises på nettsiden. Eksterne lenker skal aldri eksponeres mot kunde.

Sist gjennomgått: 2026-08-16

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

Sist gjennomgått: 2026-08-14 (Toshiba/Panasonic), 2026-08-16 (Mitsubishi Electric).
Alle tall er hentet ordrett fra kilden i tabellen.
Kildelenkene (`specSourceUrl` / `specSourceLabel`) er interne og rendres aldri.

| Produkt | Kilde | Gjelder modell | Spesifikasjoner brukt | Mangler |
| --- | --- | --- | --- | --- |
| UWANO Pure | mee.no/.../uwanopure/ (6300, 7000, 8700) | UWANO Pure 6300 / 7000 / 8700 | Full tabell per størrelse: varme nom./min-maks, kjøling nom./min-maks, SCOP, SEER, begge energiklasser, lyd inne/ute, kapasitet -15/-25 °C, R290, mål og vekt inne/ute | veiledende areal |
| Kaiteki | mee.no/.../kaiteki/ (6300, 6600, 8700) | Kaiteki 6300 / 6600 / 8700 | Full tabell per størrelse (som over), R32 | veiledende areal |
| GUSSURI | mee.no/.../gussuri/ (4100, 4600, 7300) | GUSSURI 4100 / 4600 / 7300 | Full tabell per størrelse, R32 | kapasitet ved -25 °C (ikke oppgitt), veiledende areal |
| IGURU | mee.no/.../iguru/ (6200, 6600, 7800) | IGURU 6200 / 6600 / 7800 | Full tabell per størrelse, R32 | energiklasse kjøling for 6600, veiledende areal |
| Furo | mee.no/.../furo/ (5100, 6000, 8400) | Furo 5100 / 6000 / 8400 | Full tabell per størrelse, R32 | lyd utedel for 5100 og 8400 (delvis), veiledende areal |
| Zen | mee.no/.../zen/ (Zen 55) | Zen (MSZ-EF35VGK) | Varme/kjøling nom. og min-maks, SCOP, SEER, energiklasser, lyd inne/ute, mål inne/ute, R32 | vekt inne/ute (blank hos MEE), kapasitet -15/-25 °C, veiledende areal |
| Duo-modellen | mee.no/.../duo-7000/ (Duo 7000) | Duo 7000 (MXZ-2F53VFHZ) | Systemdata for utedel: varme/kjøling, SCOP, SEER, energiklasser, lyd, mål og vekt utedel, R32 | innedelsdata – «Avhenger av valgt kombinasjon» |
| Nordic Multi | mee.no/.../nordic-multi/ (Multi 2, 3, 4) | Nordic Multi 2 / 3 / 4 | Systemdata for utedel per størrelse: varme/kjøling, SCOP, SEER, energiklasser, lyd, mål og vekt utedel, R32 | innedelsdata – «Avhenger av valgt kombinasjon»; energiklasse varme for Multi 3 |
| Toshiba Signatur | toshibavarmepumper.no/signatur-25 | Signatur 25 | Full tabell: varme nom./maks, kjøling nom./maks, SCOP, SEER, begge energiklasser, lyd inne/ute, -25 °C, R32, mål inne/ute | veiledende areal |
| Toshiba Daiseikai 10 Kontur | toshibavarmepumper.no/toshiba-kontur-25 | Kontur 25 | Full tabell (som over) | veiledende areal |
| Toshiba Daiseikai 10 Ask | toshibavarmepumper.no/toshiba-ask-25 | Ask 25 | Full tabell (som over) | veiledende areal |
| Toshiba Polar | toshibavarmepumper.no/toshiba-polar-25 | Polar 25 | Full tabell (som over) | veiledende areal |
| Toshiba Seiya | toshibavarmepumper.no/toshiba-seiya-nordic-25 | Seiya Nordic 25 | Full tabell (som over) | stillemodus dB, veiledende areal |
| Toshiba Gulvmodell | toshibavarmepumper.no/toshiba-gulvmodell-25 | Gulvmodell 25 | Full tabell. SCOP 4,3 og energiklasse varme A+ fra produktbeskrivelsen; A++ i tabellen gjelder kjøling | veiledende areal |
| Toshiba Multisplitt Nordic | toshibavarmepumper.no/multi-nordic | Multi Nordic, 2 innedeler | Full tabell (samlet kapasitet) | veiledende areal |
| Panasonic HZ Flagship | aircon.panasonic.eu/NO_no/hzflagship/ | KIT-HZ25ZKE / KIT-HZ35ZKE | Varme nom./min-maks, kjøling nom./min-maks, SCOP 5,69/5,30, energiklasse varme, lyd inne/ute, -25 °C, R32, mål inne/ute, farger Hvit/Grafittgrå | SEER, energiklasse kjøling, veiledende areal |
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
- **Mitsubishi Electric** – gjennomgått 2026-08-16 mot modellsidene på mee.no.
  Hver modellside har HOVEDDATA, VARMEFUNKSJON, KJØLEFUNKSJON, TEKNISKE DATA,
  INNEDEL- og UTEDEL TEKNISKE DATA. Alle tall i `product-specs.ts` er hentet
  ordrett derfra, per størrelse. Fargevarianter (Kaiteki Hairline, UWANO Pure
  Sort) har identiske tekniske tall som standardmodellen og er derfor ikke egne
  rader i `variants[]`.
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

Toshiba-kildene publiserer kun 25-varianten med full tabell og har derfor
ingen variantsammenlikning – ingenting er estimert eller interpolert.

### Mitsubishi Electric – kilde per variant (gjennomgått 2026-08-16)

Alle URL-er ligger under
`https://mee.no/privat/produktkategori/luft-luft-varmepumper/`.

| Serie | Variant (modellbetegnelse) | Understi |
| --- | --- | --- |
| UWANO Pure | UWANO Pure 6300 (MSZ-RZ25VUHZ) | uwanopure/uwanopure-6300/ |
| UWANO Pure | UWANO Pure 7000 (MSZ-RZ35VUHZ) | uwanopure/uwanopure-7000/ |
| UWANO Pure | UWANO Pure 8700 (MSZ-RZ50VUHZ) | uwanopure/uwanopure-8700/ |
| Kaiteki | Kaiteki 6300 (MSZ-LN25VGHZ) | kaiteki/kaiteki-6300/ |
| Kaiteki | Kaiteki 6600 (MSZ-LN35VGHZ) | kaiteki/kaiteki-6600/ |
| Kaiteki | Kaiteki 8700 (MSZ-LN50VGHZ) | kaiteki/kaiteki-8700/ |
| GUSSURI | GUSSURI 4100 (MSZ-AY25VGK) | gussuri/gussuri-4100/ |
| GUSSURI | GUSSURI 4600 (MSZ-AY35VGK) | gussuri/gussuri-4600/ |
| GUSSURI | GUSSURI 7300 (MSZ-AY50VGK) | gussuri/gussuri-7300/ |
| IGURU | IGURU 6200 (MSZ-FT25VGK) | iguru/iguru-6200/ |
| IGURU | IGURU 6600 (MSZ-FT35VGK) | iguru/iguru-6600/ |
| IGURU | IGURU 7800 (MSZ-FT50VGK) | iguru/iguru-7800/ |
| Furo | Furo 5100 (MFZ-KW25VGHZ) | furo/kirigamine-furo-3400/ |
| Furo | Furo 6000 (MFZ-KW35VGHZ) | furo/kirigamine-furo-4300/ |
| Furo | Furo 8400 (MFZ-KW50VGHZ) | furo/furo-8400/ |
| Zen | Zen (MSZ-EF35VGK) | zen/zen-55/ |
| Duo-modellen | Duo 7000 (MXZ-2F53VFHZ) | duo-7000/kirigamine-duo-6400-2/ |
| Nordic Multi | Nordic Multi 2 (MXZ-2F53VFH) | nordic-multi/7571-2/ |
| Nordic Multi | Nordic Multi 3 (MXZ-3F54VF) | nordic-multi/nordic-multi-3/ |
| Nordic Multi | Nordic Multi 4 (MXZ-4F72VF) | nordic-multi/nordic-multi-4/ |

Felt som mangler hos MEE og derfor står tomt: veiledende areal (alle),
vekt inne/ute for Zen, energiklasse kjøling for IGURU 6600, energiklasse varme
for Nordic Multi 3, kapasitet ved -25 °C for GUSSURI og Nordic Multi/Duo.
Duo og Nordic Multi viser «Avhenger av valgt kombinasjon» for innedelsdata.

## Farger og utførelser (gjennomgått 2026-08-16)

Datamodell: `colorOptions?: string[]` og `colorNote?: string` på produktnivå i
`product-specs.ts` (`COLOR_DATA`), med `colorOptions` også tilgjengelig på
variantnivå (`ProductSpecVariant`) dersom en farge kun gjelder én størrelse.
Vises inline under «Farger og utførelser». Kort viser kun en liten tag
(«Flere farger» / «Tekstiltrekk»). Ingen eksterne lenker rendres.

| Produkt | Farger/utførelser | Kilde | Merknad |
| --- | --- | --- | --- |
| Kaiteki | Hvit, Perlehvit, Safirsort, Rubinrød | mee.no/…/kaiteki/ | Perlehvit/safirsort/rubinrød har Hairline-struktur; fjernkontroll i samme utførelse. Gjelder alle tre størrelser (6300/6600/8700) |
| UWANO Pure | Hvit, Sort | mee.no/…/uwanopure/ | Begge matt finish |
| Zen | Hvit, Sølv, Sort | mee.no/…/zen/ | Hvit → hvit fjernkontroll; sølv/sort → sort fjernkontroll |
| Nordic Multi | – | mee.no/…/nordic-multi/ | Kun kombinasjonsnotat: avhenger av valgte innedeler |
| Duo-modellen | – | mee.no/…/duo-7000/ | Kun kombinasjonsnotat |
| Toshiba Signatur | Skifer + Granitt (inkludert tekstiltrekk); tilvalg: Elvegress, Friskus, Hav, Kjærlighet, Kornåker, Nattsvart, Perle, Sand, Skogbunn, Solgul, Stormhav, Ullhvit | toshibavarmepumper.no/varmepumper-luft-luft/signatur-25/ og /tilbehor/tekstiltrekk-toshiba-signatur/ | Tilvalg tydelig merket; utvalg og pris avklares ved bestilling |
| Panasonic HZ Flagship | Hvit, Grafittgrå | aircon.panasonic.eu/NO_no/hzflagship/ | Fargevalg gjelder innedelen |

### Ingen publiserte fargevalg hos kilden (feltet står tomt)

GUSSURI, IGURU, Furo (mee.no nevner ingen fargevarianter),
Toshiba Daiseikai 10 Kontur, Toshiba Daiseikai 10 Ask, Toshiba Polar,
Toshiba Seiya Nordic, Toshiba Gulvmodell, Toshiba Multi Nordic
(ABK-Qviller oppgir ingen fargetabell).

### Trenger manuell verifisering

- **Panasonic (NZ, CZ, LZ, VZ, gulvmodell, multisplitt)** – den norske
  distributørkatalogen oppgir ikke fargevalg per modell. Ingen farger er lagt
  inn. Må bekreftes mot Panasonic/distributør før eventuell publisering.
- **Toshiba Polar** – nettsiden nevner «Signatur og Polar sort» i
  brukermanual-titler, men ingen offisiell fargetabell. Ikke lagt inn.
