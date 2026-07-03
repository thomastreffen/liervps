// Lier VPS startstruktur for håndbøker.
// Tekstene er interne UTKAST tilpasset Lier VPS og må kvalitetssikres
// internt før publisering. Ingen eksterne kilder kopieres direkte.

export interface HandbookChapterSeed {
  title: string;
  body: string;
}

export type HandbookKind = "hms_handbook" | "employee_handbook" | "procedure" | "safety_rule";

export interface HandbookSeed {
  kind: HandbookKind;
  title: string;
  description: string;
  chapters: HandbookChapterSeed[];
}

interface ChapterSpec {
  title: string;
  formaal: string;
  omfang: string;
  ansvar: string;
  rutine: string;
  dokumentasjon: string;
  avvik: string;
  henvisninger: string;
  opplaering?: string;
}

const renderChapter = (c: ChapterSpec): string =>
  `# ${c.title}\n\n` +
  `> Internt UTKAST. Skal kvalitetssikres av HMS-leder før publisering.\n\n` +
  `## Formål\n${c.formaal}\n\n` +
  `## Omfang\n${c.omfang}\n\n` +
  `## Ansvar\n${c.ansvar}\n\n` +
  `## Rutine\n${c.rutine}\n\n` +
  `## Dokumentasjon i Lier VPS\n${c.dokumentasjon}\n\n` +
  `## Avvik og oppfølging\n${c.avvik}\n\n` +
  `## Henvisninger\n${c.henvisninger}\n` +
  (c.opplaering ? `\n## Bekreftelse / opplæring\n${c.opplaering}\n` : "");

const ALL = (arr: ReadonlyArray<{ omfang?: string; opplaering?: string } & Omit<ChapterSpec, "omfang" | "opplaering">>): ChapterSpec[] =>
  arr.map((c) => ({
    ...c,
    omfang: c.omfang ?? "Gjelder alle ansatte og innleide i Lier VPS som omfattes av kapittelet, samt eksterne underleverandører på Lier VPS-oppdrag der det er relevant.",
  }));

const ARB: ChapterSpec[] = ALL([
  {
    title: "Innledning og formål",
    formaal: "Beskrive hensikten med Arbeidshåndboken og hvordan den brukes i hverdagen i Lier VPS.",
    omfang: "Gjelder alle ansatte i Lier VPS. Innleide og lærlinger orienteres ved oppstart.",
    ansvar: "Daglig leder eier håndboken. HMS-leder vedlikeholder innholdet. Driftsleder følger opp at egne ansatte har lest gjeldende versjon.",
    rutine: "Håndboken finnes i Lier VPS under HMS & HR → Håndbøker. Endringer publiseres som ny versjon. Ansatte varsles og må bekrefte ny versjon.",
    dokumentasjon: "Lesebekreftelser, versjonshistorikk og endringslogg lagres i Lier VPS.",
    avvik: "Manglende lesebekreftelse innen frist følges opp av nærmeste leder.",
    henvisninger: "Arbeidsmiljøloven. Internkontrollforskriften.",
    opplaering: "Nye ansatte gjennomgår håndboken sammen med driftsleder i løpet av første uke.",
  },
  {
    title: "Roller og ansvar",
    formaal: "Tydeliggjøre hvem som har ansvar for hva i den daglige driften.",
    ansvar: "Daglig leder, driftsleder, prosjektleder, FSE-ansvarlig, vernombud og ansatt – hver med definerte oppgaver.",
    rutine: "Rolleoversikt revideres ved organisasjonsendring og minst én gang i året. Stedfortreder skal være avklart.",
    dokumentasjon: "Rolleoversikt vedlikeholdes i Lier VPS.",
    avvik: "Uklare roller løftes til ledelsens gjennomgang.",
    henvisninger: "Arbeidsmiljøloven kap. 2 og 6.",
  },
  {
    title: "Arbeidstid",
    formaal: "Sikre at arbeidstid planlegges og registreres i tråd med arbeidsmiljøloven og Lier VPS' interne ordning.",
    ansvar: "Driftsleder planlegger oppdrag innenfor avtalt ordning. Den enkelte ansatte fører korrekte timer i Tripletex og Lier VPS.",
    rutine: "Normalarbeidstid avtales pr. ansatt. Avvik fra ordningen skal varsles driftsleder samme dag. Skift, beredskap og vakt registreres med riktig kategori.",
    dokumentasjon: "Timer importeres fra Tripletex til Lier VPS. AML-modulen overvåker dags-, ukes- og periodegrenser.",
    avvik: "Brudd på dagsgrense, ukesgrense eller hviletid genererer AML-varsel. Driftsleder kvitterer ut og iverksetter tiltak.",
    henvisninger: "Arbeidsmiljøloven kap. 10. Intern ordning for arbeidstid.",
  },
  {
    title: "Registrering av arbeidstid",
    formaal: "Sikre at all arbeidstid registreres fortløpende, korrekt og sporbart.",
    ansvar: "Den enkelte registrerer egne timer. Driftsleder kontrollerer og godkjenner i Tripletex.",
    rutine: "Timer føres samme dag, senest neste arbeidsdag. Bruk riktig oppdragsnummer, aktivitet og lønnsart. Reise, beredskap og pauser føres iht. kategori.",
    dokumentasjon: "Timer importeres til Lier VPS og brukes i AML, Ressursplan og Fakturagrunnlag.",
    avvik: "Manglende eller feil registrering rettes ved neste import. Mønsterfeil tas opp i medarbeidersamtale.",
    henvisninger: "Arbeidsmiljøloven §10-7. Bokføringsloven §10.",
  },
  {
    title: "Overtid",
    formaal: "Sikre at overtid kun benyttes ved særlig og tidsavgrenset behov, godkjennes på forhånd og kompenseres riktig.",
    ansvar: "Driftsleder vurderer behov og gir forhåndsgodkjenning. Ansatt registrerer overtid med begrunnelse.",
    rutine: "Overtid skal som hovedregel forhåndsgodkjennes. Akutt overtid godkjennes så snart som mulig i etterkant via Lier VPS. Maksgrenser i AML overvåkes løpende.",
    dokumentasjon: "Overtid synliggjøres i Ressursplan og AML. Ventende godkjenninger vises i HMS-dashboard.",
    avvik: "Ikke-godkjent overtid behandles av nærmeste leder. Brudd på maksgrenser løftes til daglig leder.",
    henvisninger: "Arbeidsmiljøloven §10-6. Intern overtidsavtale.",
  },
  {
    title: "Godkjenning av overtid",
    formaal: "Tydelig prosess for hvem som godkjenner overtid og hvordan godkjenning dokumenteres.",
    ansvar: "Driftsleder er primær godkjenner. Daglig leder ved overskridelser eller systematisk bruk.",
    rutine: "Overtidsforespørsel sendes via Lier VPS eller muntlig + bekreftet skriftlig samme arbeidsdag. Godkjenning loggføres med tidspunkt og godkjenner.",
    dokumentasjon: "Alle godkjenninger lagres i overtime_approvals og er sporbare i ansattprofil.",
    avvik: "Manglende godkjenning skal lukkes innen 7 dager, ellers løftes saken.",
    henvisninger: "Intern overtidsavtale. Arbeidsmiljøloven §10-6.",
  },
  {
    title: "Pauser",
    formaal: "Sikre lovpålagte og helsemessig nødvendige pauser i løpet av arbeidsdagen.",
    ansvar: "Den enkelte er ansvarlig for å ta pauser. Driftsleder legger til rette for at det er praktisk mulig.",
    rutine: "Minst 30 minutters pause ved arbeidsdag over 5,5 timer. Pause regnes som arbeidstid kun hvis ansatt ikke fritt kan forlate arbeidsstedet.",
    dokumentasjon: "Pauser registreres ikke separat, men avvik (manglende pause pga. drift) skal noteres i timeoppføringen.",
    avvik: "Gjentatte avvik tas opp i medarbeidersamtale og vernerunde.",
    henvisninger: "Arbeidsmiljøloven §10-9.",
  },
  {
    title: "Hviletid",
    formaal: "Sikre at ansatte får tilstrekkelig sammenhengende hvile mellom arbeidsperioder.",
    ansvar: "Driftsleder planlegger oppdrag for å unngå brudd på hviletid. Ansatt skal varsle ved risiko for brudd.",
    rutine: "Minst 11 timer sammenhengende hvile pr. 24t og 35 timer pr. 7 dager hvis ikke annet er avtalt. Kompenserende hvile gis ved godkjente avvik.",
    dokumentasjon: "AML-modulen analyserer hviletid basert på registrerte timer. Importerte filer uten klokkeslett gir periodebasert kontroll.",
    avvik: "Brudd skal håndteres umiddelbart med kompenserende hvile.",
    henvisninger: "Arbeidsmiljøloven §10-8.",
  },
  {
    title: "Reisetid",
    formaal: "Tydelige regler for hva som regnes som reisetid og hvordan det kompenseres.",
    ansvar: "Driftsleder definerer hva som er normal vs. pålagt reise. Ansatt fører reise i Tripletex.",
    rutine: "Reise mellom oppdrag i arbeidstiden er arbeidstid. Reise hjemmefra til fast oppmøtested er som hovedregel ikke arbeidstid. Pålagt reise utenfor normal arbeidstid kompenseres etter avtale.",
    dokumentasjon: "Reisetid føres som egen aktivitet i timeregistrering.",
    avvik: "Tvil om kategorisering avklares med driftsleder før timene godkjennes.",
    henvisninger: "Intern reisetidsavtale.",
  },
  {
    title: "Natt- og helgearbeid",
    formaal: "Sikre forsvarlig planlegging og kompensasjon for arbeid utenfor normal arbeidstid.",
    ansvar: "Driftsleder vurderer behov og innhenter samtykke. Verneombud orienteres ved fast nattarbeid.",
    rutine: "Nattarbeid (kl. 21–06) og søndagsarbeid skal være begrunnet i drift, beredskap eller særlig oppdrag. Skiftplan kommuniseres skriftlig.",
    dokumentasjon: "Nattøkter merkes i timeoppføring og synliggjøres i AML.",
    avvik: "Faste mønstre uten avtale er avvik og skal lukkes.",
    henvisninger: "Arbeidsmiljøloven §10-11 og §10-10.",
  },
  {
    title: "Fravær og sykefravær",
    formaal: "Tydelig melderutine ved fravær og oppfølging i tråd med IA-prinsipper.",
    ansvar: "Ansatt melder fravær så tidlig som mulig. Nærmeste leder følger opp etter fastsatt plan.",
    rutine: "Sykefravær meldes pr. telefon før arbeidstidens start. Egenmelding registreres i Lier VPS. Sykmelding leveres digitalt. Oppfølgingssamtale innen 4 uker.",
    dokumentasjon: "Fravær registreres i fraværsmodulen og synkroniseres mot Outlook (Out of Office).",
    avvik: "Manglende melding eller dokumentasjon følges opp individuelt.",
    henvisninger: "Folketrygdloven kap. 8. IA-avtalen.",
  },
  {
    title: "Ferie",
    formaal: "Sikre forutsigbar ferieavvikling og overholdelse av ferieloven.",
    ansvar: "Driftsleder fastsetter hovedferien etter dialog med ansatt. HR registrerer ferie i Tripletex.",
    rutine: "Ferieønsker meldes innen frist hvert år. Hovedferie gis i perioden 1. juni – 30. september. Restferie planlegges fortløpende.",
    dokumentasjon: "Ferie synes i Fraværsmodulen og Ressursplan.",
    avvik: "Endringer skal være skriftlige og avtalt med driftsleder.",
    henvisninger: "Ferieloven.",
  },
  {
    title: "Bruk av Lier VPS",
    formaal: "Sikre at alle ansatte bruker Lier VPS som primært arbeidsverktøy.",
    ansvar: "Alle ansatte er ansvarlige for å holde sine oppgaver, timer, SJA og avvik oppdatert i systemet.",
    rutine: "Logg inn via Google. Bruk mobilversjon i felt. Skriv kort, klart og faktabasert. Last opp bilder ved behov.",
    dokumentasjon: "Aktivitet logges automatisk i activity_log. Dokumenter lagres i prosjektmappen.",
    avvik: "Tekniske feil meldes til IT/systemansvarlig med skjermbilde.",
    henvisninger: "Brukerveiledning Lier VPS (intern).",
    opplaering: "Nye brukere får intro av driftsleder. Mobilbruk demonstreres på første oppdrag.",
  },
  {
    title: "AML-overvåking i Lier VPS",
    formaal: "Beskrive hvordan Lier VPS bruker AML-modulen til å overvåke arbeidstid og overtid.",
    ansvar: "HMS-leder eier regelsettet. Driftsleder følger opp varsler for sine ansatte.",
    rutine: "Timer importeres fra Tripletex. AML-modulen kontrollerer dag, uke og periode. Overtidsvarsler følges opp av leder. Overtid skal ha særskilt og tidsavgrenset behov. Mangler i datagrunnlag, for eksempel manglende start- og sluttid i Tripletex månedsoversikt, gjør at enkelte 24-timers vurderinger blir periodebaserte – dette er kommentert i hvert varsel.",
    dokumentasjon: "AML-varsler, kvitteringer og løsninger lagres i hms_alerts og activity_log.",
    avvik: "Kritiske varsler skal kvitteres innen 7 dager. Mønsterbrudd løftes til daglig leder.",
    henvisninger: "Arbeidsmiljøloven kap. 10.",
  },
  {
    title: "HMS-ansvar for ansatte",
    formaal: "Klargjøre den enkeltes ansvar for egen og kollegers sikkerhet.",
    ansvar: "Daglig leder har øverste HMS-ansvar. Driftsleder har operativt ansvar pr. oppdrag. Hver ansatt er ansvarlig for egen sikkerhet og å varsle om risiko.",
    rutine: "Stopp arbeidet ved akutt fare. Bruk verneutstyr. Følg SJA og prosedyrer. Meld avvik straks.",
    dokumentasjon: "SJA, avvik og vernerunder registreres i HMS-modulen.",
    avvik: "Brudd på sikkerhetsregler kan medføre stans av oppdrag og personalsak.",
    henvisninger: "Internkontrollforskriften. Arbeidsmiljøloven kap. 2.",
  },
  {
    title: "Avvik og varsling",
    formaal: "Sikre lav terskel for å melde avvik og kritikkverdige forhold.",
    ansvar: "Alle ansatte kan og skal melde avvik. HMS-leder behandler. Daglig leder ved varsling om kritikkverdige forhold.",
    rutine: "Bruk avviksskjema i Lier VPS. Beskriv hva, hvor, når og foreslått tiltak. Verneombud orienteres om HMS-avvik.",
    dokumentasjon: "Avvik følges fra meldt til lukket med tiltak og ansvarlig.",
    avvik: "Gjengangere analyseres i ledelsens gjennomgang.",
    henvisninger: "Arbeidsmiljøloven kap. 2A om varsling.",
  },
  {
    title: "Arbeid hos kunde",
    formaal: "Sikre profesjonell og forsvarlig opptreden hos kunde.",
    ansvar: "Driftsleder for oppdraget. Den enkelte representerer Lier VPS i felt.",
    rutine: "Meld ankomst til kontaktperson. Følg kundens HMS-regime og adgangsrutiner. Rydd og dokumenter ved avslutning. Kommuniser eventuelle avvik direkte til kunde og Lier VPS.",
    dokumentasjon: "Sluttdokumentasjon, bilder og signaturer arkiveres i prosjektet.",
    avvik: "Avvik som påvirker kundens drift varsles umiddelbart både til kunde og driftsleder.",
    henvisninger: "Kundespesifikke prosedyrer.",
  },
  {
    title: "Datacenter-rutiner",
    formaal: "Egne arbeidsregler for arbeid i datacenter.",
    ansvar: "Driftsleder for datacenteroppdraget.",
    rutine: "Følg kundens sikkerhetsregime: adgang, ESD, kjøling, brann, dobbeltgulv og redundans. Aldri jobb alene på kritiske systemer uten klarering. Verktøy og kabler skal være sikret.",
    dokumentasjon: "Adgangslogg og arbeidstillatelser oppbevares pr. oppdrag.",
    avvik: "Hendelser eskaleres umiddelbart til kunden og driftsleder.",
    henvisninger: "Kundespesifikke prosedyrer (vedlegg pr. kunde).",
  },
  {
    title: "Næringsbygg-rutiner",
    formaal: "Standard arbeidsmetode i næringsbygg, kontor og forretning.",
    ansvar: "Driftsleder pr. oppdrag.",
    rutine: "Avklar adgang, brannrutiner, åpningstider og sikring av arbeidsområde. Begrens støy og støv i driftstid. Rydd dagens arbeid før avslutning.",
    dokumentasjon: "Adgangs- og nøkkelhåndtering loggføres.",
    avvik: "Skader på inventar eller bygg meldes som RUH og til kunde.",
    henvisninger: "Internkontrollforskriften.",
  },
  {
    title: "Tavle og strømskinner",
    formaal: "Sikker arbeidsmetode på tavler og strømskinneanlegg.",
    ansvar: "FSE-ansvarlig leder arbeidet. Sertifisert tavlemontør utfører arbeid i tavle.",
    rutine: "Spenningstest, jording, skilting og avskjerming før arbeid. Bruk lysbueverntøy ved arbeid på eller nær spenning. Trekk dokumentert moment. Sluttkontroll og termografi etter behov.",
    dokumentasjon: "Sluttkontroll og termografi lagres pr. anlegg.",
    avvik: "Funn ved kontroll behandles som risikoflagg i prosjektet.",
    henvisninger: "FSE. NEK 439. NEK 400.",
  },
  {
    title: "Bekreftelse lest og forstått",
    formaal: "Bekrefte at den ansatte har lest og forstått innholdet i Arbeidshåndboken.",
    ansvar: "Den enkelte ansatte. Driftsleder følger opp ved manglende bekreftelse.",
    rutine: "Bekreftelse skjer i Lier VPS etter publisering av ny versjon. Tekst: \"Jeg har lest og forstått denne håndboken.\"",
    dokumentasjon: "Lesebekreftelser lagres med tidspunkt, bruker og versjon.",
    avvik: "Manglende bekreftelse innen frist eskaleres til daglig leder.",
    henvisninger: "Internkontrollforskriften §5.",
    opplaering: "Ved vesentlige endringer kan det kreves muntlig gjennomgang i tillegg til lesebekreftelse.",
  },
]);

const HMS: ChapterSpec[] = ALL([
  {
    title: "Internkontroll",
    formaal: "Sikre systematisk HMS-arbeid i Lier VPS i tråd med internkontrollforskriften.",
    ansvar: "Daglig leder er ansvarlig for systemet. HMS-leder forvalter dokumentasjon og årshjul.",
    rutine: "Årshjul med vernerunder, ledelsens gjennomgang, risikovurderinger, opplæring og revisjon av prosedyrer.",
    dokumentasjon: "Hele systemet ligger i Lier VPS / HMS-modulen.",
    avvik: "Manglende gjennomføring av planlagte aktiviteter er avvik og skal lukkes med ny dato.",
    henvisninger: "Internkontrollforskriften.",
  },
  {
    title: "HMS-mål",
    formaal: "Sette tydelige, målbare HMS-mål og følge dem opp.",
    ansvar: "Daglig leder fastsetter målene. HMS-leder rapporterer status.",
    rutine: "Mål settes årlig. Status rapporteres kvartalsvis. Eksempler: 0 alvorlige skader, sykefravær < x%, antall RUH > y, andel SJA-fullføring 100%.",
    dokumentasjon: "Mål og status synes i HMS-dashboard og ledelsens gjennomgang.",
    avvik: "Avvik fra mål utløser tiltaksplan.",
    henvisninger: "Internkontrollforskriften §5 nr. 4.",
  },
  {
    title: "Roller og ansvar",
    formaal: "Tydeliggjøre HMS-roller i organisasjonen.",
    ansvar: "Daglig leder, HMS-leder, driftsleder, vernombud, ansatt – hver med definert ansvar.",
    rutine: "Roller revideres årlig og ved organisasjonsendringer. Verneombud velges for 2 år.",
    dokumentasjon: "Rolleoversikt vedlikeholdes i Lier VPS.",
    avvik: "Uklare roller løftes til ledelsens gjennomgang.",
    henvisninger: "Arbeidsmiljøloven kap. 6 og 7.",
  },
  {
    title: "Medvirkning",
    formaal: "Sikre at ansatte og verneombud medvirker i HMS-arbeidet.",
    ansvar: "Verneombud representerer ansatte. Driftsleder legger til rette for medvirkning.",
    rutine: "Faste HMS-punkter på personalmøter. Vernerunder med deltakelse fra verneombud. Innspill til prosedyrer kan meldes via Lier VPS.",
    dokumentasjon: "Møtereferater og innspill loggføres.",
    avvik: "Manglende medvirkning er avvik mot internkontroll.",
    henvisninger: "Arbeidsmiljøloven kap. 6.",
  },
  {
    title: "Opplæring og kompetanse",
    formaal: "Sikre at alle har nødvendig kompetanse for sine oppgaver.",
    ansvar: "Driftsleder kartlegger behov. HMS-leder forvalter opplæringsplan.",
    rutine: "Kompetanseplan oppdateres årlig. FSE-kurs årlig. Førstehjelp hvert 12. mnd. for utsatte grupper. Sertifikater fornyes før utløp.",
    dokumentasjon: "Kompetanse og kurs registreres i Lier VPS.",
    avvik: "Arbeid uten gyldig sertifisering er avvik og stoppes.",
    henvisninger: "Arbeidsmiljøloven §3-2. FSE.",
    opplaering: "Ny ansatt får sjekkliste for opplæring og fadder de første 4 ukene.",
  },
  {
    title: "SJA – sikker jobbanalyse",
    formaal: "Identifisere og redusere risiko før oppstart av oppdrag med særlig fare.",
    ansvar: "Den som leder arbeidet er ansvarlig for at SJA gjennomføres. Alle deltakere skal signere.",
    rutine: "Bruk SJA-mal i HMS-modulen. Gjennomgå farer, tiltak, verneutstyr og beredskap. Signer før arbeidet starter.",
    dokumentasjon: "SJA lagres på oppdraget med signaturer.",
    avvik: "Manglende SJA på risikofylt arbeid stopper oppdraget.",
    henvisninger: "FSE §14. Internkontrollforskriften.",
  },
  {
    title: "Risikovurdering",
    formaal: "Kartlegge og redusere risiko i drift og prosjekter.",
    ansvar: "HMS-leder fasiliterer. Driftsleder gjennomfører for sine oppdrag.",
    rutine: "Identifiser risiko, vurder sannsynlighet og konsekvens, beslutt tiltak, sett ansvarlig og frist.",
    dokumentasjon: "Risikovurderinger arkiveres pr. aktivitet eller oppdrag.",
    avvik: "Manglende vurdering på kritiske aktiviteter er avvik.",
    henvisninger: "Internkontrollforskriften §5.",
  },
  {
    title: "Sjekklister",
    formaal: "Standardisere kontroll og dokumentasjon på tilbakevendende oppgaver.",
    ansvar: "HMS-leder forvalter maler. Den som utfører oppgaven fyller ut.",
    rutine: "Bruk sjekklister i HMS-modulen for sluttkontroll, tavle, termografi, vernerunde m.m. Påkrevde skjemaer blokkerer fullføring av oppdrag.",
    dokumentasjon: "Utfylte sjekklister lagres i submissions og kobles til oppdrag.",
    avvik: "Manglende eller mangelfullt utfylt sjekkliste er avvik.",
    henvisninger: "Internkontrollforskriften §5.",
  },
  {
    title: "Vernerunder",
    formaal: "Avdekke risiko, mangler og forbedringsmuligheter i arbeidsmiljøet.",
    ansvar: "HMS-leder planlegger. Driftsleder gjennomfører sammen med verneombud.",
    rutine: "Vernerunde minst 2 ganger per år, og ved oppstart av store prosjekter. Funn registreres som tiltak med ansvarlig og frist.",
    dokumentasjon: "Rapporter lagres i HMS-modulen.",
    avvik: "Funn som ikke lukkes innen frist løftes.",
    henvisninger: "Arbeidsmiljøloven §3-1.",
  },
  {
    title: "Avvik og RUH",
    formaal: "Lav terskel for å melde uønskede hendelser og forbedringsforslag.",
    ansvar: "Alle melder. HMS-leder behandler.",
    rutine: "Meld i Lier VPS. Beskriv hendelsen, ev. skade, umiddelbare tiltak og forslag til forbedring.",
    dokumentasjon: "RUH/avvik følges til lukket med tiltak.",
    avvik: "Gjengangere analyseres og kan utløse ny prosedyre.",
    henvisninger: "Internkontrollforskriften §5 nr. 7.",
  },
  {
    title: "Tiltak og lukking",
    formaal: "Sikre at avvik og funn faktisk lukkes med kontrollerbar effekt.",
    ansvar: "Tiltakseier er ansvarlig for gjennomføring. HMS-leder verifiserer lukking.",
    rutine: "Hvert tiltak skal ha ansvarlig, frist og verifiseringskriterium. Lukking krever dokumentasjon (bilde, signatur eller kommentar).",
    dokumentasjon: "Tiltaksregister vedlikeholdes i HMS-modulen.",
    avvik: "Tiltak som ikke lukkes innen frist eskaleres automatisk.",
    henvisninger: "Internkontrollforskriften §5.",
  },
  {
    title: "FSE og elsikkerhet",
    formaal: "Sikre at alt arbeid på elektriske anlegg utføres iht. FSE.",
    ansvar: "Driftsleder/installatør er ansvarlig for at FSE-krav oppfylles. Alle som arbeider med el må ha gyldig FSE-opplæring.",
    rutine: "Årlig FSE-kurs. Førstehjelpskurs hvert 12. mnd. for utsatte grupper. Spenningstest, jording og skilting før arbeid.",
    dokumentasjon: "Opplæring og repetisjon registreres i kompetanseoversikt.",
    avvik: "Arbeid uten gyldig FSE er avvik og stoppes.",
    henvisninger: "Forskrift om sikkerhet ved arbeid i og drift av elektriske anlegg (FSE).",
    opplaering: "Årlig FSE-repetisjon dokumenteres med signatur og dato.",
  },
  {
    title: "Arbeid på eller nær elektriske anlegg",
    formaal: "Beskrive sikker arbeidsmetode ved arbeid nær spenningsførende deler.",
    ansvar: "Ansvarlig for arbeidet etter FSE skal utpekes før oppstart.",
    rutine: "Velg metode: utkoblet, nær spenning eller under spenning. Sikre med tiltak iht. valgt metode. Bruk personlig verneutstyr og isolerte verktøy.",
    dokumentasjon: "Metode dokumenteres i SJA og oppdragslogg.",
    avvik: "Endring av metode underveis krever ny risikovurdering.",
    henvisninger: "FSE §10–§17.",
  },
  {
    title: "Strømulykke / strømgjennomgang",
    formaal: "Sikre rask, korrekt håndtering ved strømulykke.",
    ansvar: "Alle på stedet handler iht. tiltakskort. Driftsleder varsles umiddelbart.",
    rutine: "Bryt strøm hvis trygt. Tilkall lege/AMK uansett ved strømgjennomgang. Skadet person skal til legevakt for kontroll, selv uten synlige skader.",
    dokumentasjon: "Hendelse meldes som RUH og rapporteres til DSB ved alvorlig skade.",
    avvik: "Manglende varsling er alvorlig brudd.",
    henvisninger: "FSE. DSBs veileder for strømulykker.",
  },
  {
    title: "Alvorlig ulykke",
    formaal: "Tydelig beredskap ved alvorlig personskade eller dødsfall.",
    ansvar: "Daglig leder er kriseleder. HMS-leder koordinerer rapportering.",
    rutine: "Sikre stedet, varsle nødetater, varsle pårørende via politiet, varsle Arbeidstilsynet og politiet, ta vare på spor og dokumentasjon.",
    dokumentasjon: "Hendelseslogg opprettes umiddelbart. Egen rapport til myndigheter.",
    avvik: "Avvik fra beredskap evalueres i ettertid.",
    henvisninger: "Arbeidsmiljøloven §5-2. Internkontrollforskriften.",
  },
  {
    title: "Personlig verneutstyr",
    formaal: "Sikre at riktig personlig verneutstyr (PVU) brukes.",
    ansvar: "Lier VPS dekker pålagt PVU. Ansatt skal bruke og vedlikeholde det.",
    rutine: "Vernesko, hjelm, briller, hørselvern, hansker og lysbueverntøy etter behov. Sjekk utstyr før bruk. Defekt utstyr byttes umiddelbart.",
    dokumentasjon: "Utlevering registreres pr. ansatt.",
    avvik: "Manglende eller feil bruk er avvik.",
    henvisninger: "Forskrift om utførelse av arbeid §15.",
  },
  {
    title: "Arbeid i datacenter",
    formaal: "Egne sikkerhetskrav for arbeid i datacenter.",
    ansvar: "Driftsleder for datacenteroppdraget.",
    rutine: "Følg kundens sikkerhetsregime. ESD, kjøling, brann, dobbeltgulv, redundans. Aldri jobb alene på kritiske systemer uten klarering.",
    dokumentasjon: "Adgangslogg og arbeidstillatelser oppbevares pr. oppdrag.",
    avvik: "Hendelser eskaleres umiddelbart til kunden.",
    henvisninger: "Kundespesifikke prosedyrer.",
  },
  {
    title: "Arbeid i næringsbygg",
    formaal: "Sikker og hensynsfull arbeidsmetode i næringsbygg.",
    ansvar: "Driftsleder pr. oppdrag.",
    rutine: "Avklar adgang, brannrutiner, åpningstider og sikring av arbeidsområde. Begrens støy og støv i driftstid.",
    dokumentasjon: "Adgangs- og nøkkelhåndtering loggføres.",
    avvik: "Skader på inventar eller bygg meldes som RUH og til kunde.",
    henvisninger: "Internkontrollforskriften.",
  },
  {
    title: "Tavlemontasje og strømskinner",
    formaal: "Sikker montasje, kontroll og service på tavler og strømskinneanlegg.",
    ansvar: "FSE-ansvarlig leder arbeidet. Sertifisert tavlemontør utfører arbeidet i tavle.",
    rutine: "Spenningstest, jording, skilting og avskjerming før arbeid. Bruk lysbueverntøy ved arbeid på eller nær spenning. Trekk dokumentert moment. Sluttkontroll og termografi etter behov.",
    dokumentasjon: "Sluttkontroll og termografi lagres pr. anlegg.",
    avvik: "Funn ved kontroll behandles som risikoflagg i prosjektet.",
    henvisninger: "FSE. NEK 439. NEK 400.",
  },
  {
    title: "Kjemikalier og stoffkartotek",
    formaal: "Sikre forsvarlig bruk og oppbevaring av kjemikalier.",
    ansvar: "HMS-leder forvalter stoffkartotek. Ansatt leser sikkerhetsdatablad før bruk.",
    rutine: "Bruk kun godkjente produkter. Oppbevar etter datablad. Bruk anbefalt PVU. Avhend riktig.",
    dokumentasjon: "Stoffkartotek vedlikeholdes i Lier VPS.",
    avvik: "Søl, eksponering eller manglende datablad meldes som RUH.",
    henvisninger: "Forskrift om utførelse av arbeid kap. 3.",
  },
  {
    title: "Asbest og eldre bygg",
    formaal: "Forhindre eksponering for asbest og andre helsefarlige stoffer i eldre bygg.",
    ansvar: "Driftsleder vurderer behov for kartlegging før arbeid i bygg fra før 1985.",
    rutine: "Stopp ved mistanke om asbest. Ikke bor, kapp eller riv før prøve er tatt. Bruk sertifisert firma for sanering.",
    dokumentasjon: "Kartlegging og sanering arkiveres på oppdraget.",
    avvik: "Mistanke uten stopp er alvorlig avvik.",
    henvisninger: "Forskrift om utførelse av arbeid kap. 4.",
  },
  {
    title: "EE-avfall og miljø",
    formaal: "Sikre miljøriktig håndtering av elektrisk og elektronisk avfall.",
    ansvar: "Driftsleder pr. oppdrag. Ansatt sorterer på riktig måte.",
    rutine: "EE-avfall sorteres separat og leveres til godkjent mottak. Kabel, lysstoffrør, batterier og kondensatorer behandles som farlig avfall.",
    dokumentasjon: "Leveringskvittering arkiveres pr. oppdrag.",
    avvik: "Feil håndtering meldes som RUH.",
    henvisninger: "Avfallsforskriften kap. 1.",
  },
  {
    title: "Beredskap",
    formaal: "Sikre rask og riktig respons ved brann, ulykke, ran eller IT-hendelse.",
    ansvar: "Daglig leder er beredskapsleder. Driftsleder leder lokal respons.",
    rutine: "Tiltakskort for de viktigste scenarier finnes i Lier VPS. Beredskapsøvelse minst årlig.",
    dokumentasjon: "Øvelser og hendelser loggføres og evalueres.",
    avvik: "Manglende øvelse er avvik mot internkontroll.",
    henvisninger: "Internkontrollforskriften §5 nr. 6.",
  },
  {
    title: "Ledelsens gjennomgang",
    formaal: "Sikre at ledelsen jevnlig vurderer at HMS-systemet fungerer og fastsetter forbedringer.",
    ansvar: "Daglig leder gjennomfører. HMS-leder forbereder underlag.",
    rutine: "Minst én gang i året. Gjennomgang av mål, avvik, RUH, vernerunder, kompetanse, ulykker og status på tiltak. Beslutt forbedringer for neste periode.",
    dokumentasjon: "Referat med beslutninger arkiveres i HMS-modulen.",
    avvik: "Manglende gjennomgang er alvorlig avvik mot internkontroll.",
    henvisninger: "Internkontrollforskriften §5 nr. 8.",
  },
]);

export const Lier VPS_HANDBOOK_SEEDS: HandbookSeed[] = [
  {
    kind: "employee_handbook",
    title: "Arbeidshåndbok – Lier VPS",
    description:
      "Arbeidstid, registrering, overtid, pauser, hviletid, reisetid, natt/helg, fravær, ferie, AML-overvåking, bruk av Lier VPS, kunde-/datacenter-/næringsbygg-rutiner, tavle og strømskinner, HMS-ansvar, avvik og lesebekreftelse.",
    chapters: ARB.map((c) => ({ title: c.title, body: renderChapter(c) })),
  },
  {
    kind: "hms_handbook",
    title: "HMS-håndbok – Lier VPS",
    description:
      "Internkontroll, HMS-mål, roller, medvirkning, opplæring, SJA, risiko, sjekklister, vernerunder, avvik/RUH, tiltak, FSE og elsikkerhet, strømulykke, alvorlig ulykke, PVU, datacenter, næringsbygg, tavlemontasje og strømskinner, kjemikalier, asbest, EE-avfall, beredskap og ledelsens gjennomgang.",
    chapters: HMS.map((c) => ({ title: c.title, body: renderChapter(c) })),
  },
];
