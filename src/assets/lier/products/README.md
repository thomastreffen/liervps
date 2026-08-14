# Produktbilder – Lier VPS

Bilder som legges her vises automatisk i produktseksjonen på forsiden.

## Rettigheter – les først

Bruk **kun**:

- bilder som er lastet opp til prosjektet av Lier VPS
- offisielle produktbilder fra produsent der bruk er avklart
- bilder fra leverandør-/distributørbildebank der bruk er tillatt

**Aldri**:

- skrape eller laste ned bilder fra tilfeldige nettsider
- hotlinke til bilder på produsent- eller distributørsider
- bruke bilder uten avklart bruksrett

Hvis et bilde mangler, viser kortet vår egen illustrasjon. Det er alltid bedre
enn et ulisensiert bilde, og det vises aldri et ødelagt bildeikon.

## Hvor filene skal ligge

```
src/assets/lier/products/mitsubishi/
src/assets/lier/products/panasonic/
src/assets/lier/products/toshiba/
src/assets/lier/products/            (merkeuavhengige løsninger)
```

Undermappen er kun for ryddighet – oppslaget skjer på filnavnet.

## Filnavn

Filnavnet (uten filendelse) må være identisk med `imageKey` i
`src/components/public/product-catalog.ts`.

Format: `<merke>-<modell>` med små bokstaver og bindestrek.

Eksempler:

```
mitsubishi-uwano-pure.webp
mitsubishi-kaiteki.webp
panasonic-hz.webp
toshiba-daiseikai-kontur.webp
```

## Anbefalte dimensjoner

- Format: 4:3 (bildeflaten på kortene er 4:3)
- Størrelse: 1200 × 900 px
- Filtype: `.webp` (foretrukket), alternativt `.jpg` eller `.png`
- Filstørrelse: helst under 250 kB
- Bakgrunn: hvit eller nøytral, produktet sentrert med litt luft

## Koble bilde til produktdata

1. Legg filen i riktig merkemappe med riktig filnavn.
2. Sjekk at `imageKey` i `product-catalog.ts` matcher filnavnet.
3. Oppdater `imageStatus` fra `missing` til `local` for produktet.
4. Oppdater `docs/product-source-notes.md` med hvor bildet kommer fra.

Ingen kodeendringer utover dette er nødvendig – bildene plukkes opp automatisk.

## Store filer

Store bildefiler kan legges på CDN i stedet. Da ligger en `<filnavn>.asset.json`
her i stedet for selve bildet, med samme navnekonvensjon. Begge deler fungerer.
