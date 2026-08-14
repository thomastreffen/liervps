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

Filnavnet (uten filendelse) må være identisk med `imageKey` – eller med
`key` i `images[]` – i `src/components/public/product-catalog.ts`.

Format: `<merke>-<modell>` med små bokstaver og bindestrek. Ved flere bilder
per produkt legges bilderollen til på slutten: `-primary`, `-indoor`,
`-outdoor`, `-lifestyle`, `-detail`, `-variant`.

Eksempler:

```
mitsubishi-uwano-pure-primary.webp
mitsubishi-uwano-pure-outdoor.webp
mitsubishi-uwano-pure-lifestyle.webp
panasonic-hz-flagship-primary.webp
toshiba-signatur-primary.webp
```

Enkeltbilde uten rollesuffiks (f.eks. `mitsubishi-kaiteki.webp`) fungerer
fortsatt, og brukes da som primærbilde.

## Anbefalte dimensjoner

- Format: 4:3 (bildeflaten på kortene er 4:3)
- Størrelse: 1200 × 900 px
- Filtype: `.webp` (foretrukket), alternativt `.jpg` eller `.png`
- Filstørrelse: helst under 250 kB
- Bakgrunn: hvit eller nøytral, produktet sentrert med litt luft

## Flere bilder per produkt

Produktkortene viser **alltid kun ett bilde** (første med `type: "primary"`,
ellers `imageKey`, ellers vår egen illustrasjon). Modalen viser galleri med
miniatyrbilder når produktet har flere bilder.

I `product-catalog.ts`:

```ts
images: [
  { key: "mitsubishi-uwano-pure-primary", type: "primary",
    alt: "Mitsubishi Electric UWANO Pure innedel", status: "local_approved" },
  { key: "mitsubishi-uwano-pure-outdoor", type: "outdoor",
    alt: "UWANO Pure utedel", status: "local_approved" },
]
```

Bilder uten lokal fil hoppes over automatisk – manglende sekundærbilder gir
verken tomme miniatyrer eller ødelagte bildeikoner.

## Koble bilde til produktdata

1. Legg filen i riktig merkemappe med riktig filnavn.
2. Sjekk at `imageKey` (eller `images[].key`) matcher filnavnet.
3. Sett `status`/`imageStatus` til `local_approved` når bruksretten er avklart.
4. Oppdater `docs/product-source-notes.md` med hvor bildet kommer fra.

Ingen kodeendringer utover dette er nødvendig – bildene plukkes opp automatisk.


## Store filer

Store bildefiler kan legges på CDN i stedet. Da ligger en `<filnavn>.asset.json`
her i stedet for selve bildet, med samme navnekonvensjon. Begge deler fungerer.
