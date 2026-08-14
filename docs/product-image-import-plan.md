# Bildeimport – Mitsubishi Electric (MEE)

Internt arbeidsdokument. Ingenting herfra vises på nettsiden, og ingen eksterne
lenker eksponeres mot kunde.

Sist gjennomgått: 2026-08-14

## Status

Produktdata (navn, familieplassering, konservative beskrivelser) er verifisert
mot MEEs produktsider. **Ingen bilder er importert.** MEE oppgir ikke på
produktsidene at bildene fritt kan brukes i forhandler-/partnermarkedsføring,
og bruksretten er derfor uavklart. Etter regelen «ved uklar bruksrett – ikke
importer» står alle Mitsubishi-produkter med `imageStatus: "needs_approval"`,
og kortene viser vår egen illustrasjon.

## Neste steg

1. Be Mitsubishi Electric Norge om skriftlig bekreftelse på bruk av
   produktbilder på liervps.no (forhandler-/partnerbruk).
2. Ved bekreftelse: last ned fra offisiell bildebank (ikke fra nettsiden),
   konverter til `.webp`, behold sideforhold, maks ~250 kB.
3. Lagre som filnavnene under i `src/assets/lier/products/mitsubishi/`.
4. Sett `imageStatus: "local_approved"` i `product-catalog.ts` og oppdater
   `docs/product-source-notes.md`.

## Kildekandidater (kun til intern oppfølging)

| Produkt | MEE produktside | Ønsket filnavn | Bildekandidat på siden |
| --- | --- | --- | --- |
| UWANO Pure | /privat/produktkategori/luft-luft-varmepumper/uwanopure/ | mitsubishi-uwano-pure.webp | toppbilde + interiørbilde av innedel |
| GUSSURI | /privat/produktkategori/luft-luft-varmepumper/gussuri/ | mitsubishi-gussuri.webp | toppbilde + innedel i stue |
| Kaiteki | /privat/produktkategori/luft-luft-varmepumper/kaiteki/ | mitsubishi-kaiteki.webp | toppbilde + fargevarianter |
| IGURU | /privat/produktkategori/luft-luft-varmepumper/iguru/ | mitsubishi-iguru.webp | toppbilde av innedel |
| Furo | /privat/produktkategori/luft-luft-varmepumper/furo/ | mitsubishi-furo.webp | gulvmodell i stue |
| Zen | /privat/produktkategori/luft-luft-varmepumper/zen/ | mitsubishi-zen.webp | toppbilde, hvit og sort variant |
| Duo-modellen | /privat/produktkategori/luft-luft-varmepumper/duo-7000/ | mitsubishi-duo-modellen.webp | utedel med to innedeler |
| Nordic Multi | /privat/produktkategori/luft-luft-varmepumper/nordic-multi/ | mitsubishi-nordic-multi.webp | toppbilde multiløsning |

Hotlinking er ikke tillatt. Bildene skal aldri lastes fra mee.no i drift.
