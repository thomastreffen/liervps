// MCS startstruktur for håndbøker.
// Tekstene er interne UTKAST tilpasset MCS Service og må kvalitetssikres
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
  ansvar: string;
  rutine: string;
  dokumentasjon: string;
  avvik: string;
  henvisninger: string;
}

const renderChapter = (c: ChapterSpec): string =>
  `# ${c.title}\n\n` +
  `> Internt UTKAST. Skal kvalitetssikres av HMS-leder før publisering.\n\n` +
  `## Formål\n${c.formaal}\n\n` +
  `## Ansvar\n${c.ansvar}\n\n` +
  `## Rutine\n${c.rutine}\n\n` +
  `## Dokumentasjon i MCS Kontrollsenter\n${c.dokumentasjon}\n\n` +
  `## Avvik og oppfølging\n${c.avvik}\n\n` +
  `## Henvisninger\n${c.henvisninger}\n`;

const ARB: ChapterSpec[] = [
  {
    title: "Arbeidstid",
    formaal: "Sikre at arbeidstid planlegges og registreres i tråd med arbeidsmiljøloven og MCS' interne ordning.",
    ansvar: "Driftsleder planlegger oppdrag innenfor avtalt ordning. Den enkelte ansatte fører korrekte timer i Tripletex/MCS Kontrollsenter.",
    rutine: "Normalarbeidstid avtales pr. ansatt. Avvik fra ordningen skal varsles driftsleder samme dag. Skift, beredskap og vakt registreres med riktig kategori.",
    dokumentasjon: "Timer importeres fra Tripletex til MCS Kontrollsenter. AML-modulen overvåker dags-, ukes- og periodegrenser.",
    avvik: "Brudd på dagsgrense, ukesgrense eller hviletid genererer AML-varsel. Driftsleder skal kvittere ut og iverksette tiltak.",
    henvisninger: "Arbeidsmiljøloven kap. 10. Intern ordning for arbeidstid (vedlegg).",
  },
  {
    title: "Overtid",
    formaal: "Sikre at overtid kun benyttes ved særlig behov, godkjennes på forhånd og kompenseres riktig.",
    ansvar: "Driftsleder vurderer behov og gir forhåndsgodkjenning. Ansatt registrerer overtid med begrunnelse.",
    rutine: "Overtid skal som hovedregel forhåndsgodkjennes. Akutt overtid godkjennes så snart som mulig i etterkant via MCS Kontrollsenter.",
    dokumentasjon: "Overtid synliggjøres i Ressursplan og AML. Pending godkjenninger vises i HMS-dashboard.",
    avvik: "Ikke-godkjent overtid behandles av nærmeste leder. Brudd på maksgrenser løftes til daglig leder.",
    henvisninger: "Arbeidsmiljøloven §10-6. Intern overtidsavtale.",
  },
  {
    title: "Godkjenning av overtid",
    formaal: "Tydelig prosess for hvem som godkjenner overtid og hvordan godkjenning dokumenteres.",
    ansvar: "Driftsleder er primær godkjenner. Daglig leder ved overskridelser eller systematisk bruk.",
    rutine: "Overtidsforespørsel sendes via MCS Kontrollsenter eller muntlig + bekreftet skriftlig samme arbeidsdag. Godkjenning loggføres med tidspunkt og godkjenner.",
    dokumentasjon: "Alle godkjenninger lagres i `overtime_approvals` og er sporbare i ansattprofil.",
    avvik: "Manglende godkjenning skal lukkes innen 7 dager, ellers løftes saken.",
    henvisninger: "Intern overtidsavtale. Arbeidsmiljøloven §10-6.",
  },
  {
    title: "Pauser",
    formaal: "Sikre lovpålagte og helsemessig nødvendige pauser i løpet av arbeidsdagen.",
    ansvar: "Den enkelte er ansvarlig for å ta pauser. Driftsleder legger til rette for at det er praktisk mulig.",
    rutine: "Minst 30 minutters pause ved arbeidsdag over 5,5 timer. Pause regnes som arbeidstid kun hvis ansatt ikke fritt kan forlate arbeidsstedet.",
    dokumentasjon: "Pauser registreres ikke separat, men avvik (manglende pause pga drift) skal noteres i timeoppføringen.",
    avvik: "Gjentatte avvik tas opp i medarbeidersamtale og vernerunde.",
    henvisninger: "Arbeidsmiljøloven §10-9.",
  },
  {
    title: "Hviletid",
    formaal: "Sikre at ansatte får tilstrekkelig sammenhengende hvile mellom arbeidsperioder.",
    ansvar: "Driftsleder planlegger oppdrag for å unngå brudd på hviletid. Ansatt skal varsle ved risiko for brudd.",
    rutine: "Minst 11 timer sammenhengende hvile pr. 24t og 35 timer pr. 7 dager, hvis ikke annet er avtalt.",
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
    ansvar: "Driftsleder vurderer behov og innhenter samtykke. Vernombud orienteres ved fast nattarbeid.",
    rutine: "Nattarbeid (kl. 21–06) og søndagsarbeid skal være begrunnet i drift, beredskap eller særlig oppdrag. Skiftplan kommuniseres skriftlig.",
    dokumentasjon: "Nattøkter merkes i timeoppføring og synliggjøres i AML.",
    avvik: "Faste mønstre uten avtale er avvik og skal lukkes.",
    henvisninger: "Arbeidsmiljøloven §10-11 og §10-10.",
  },
  {
    title: "Fravær og sykefravær",
    formaal: "Tydelig melderutine ved fravær og oppfølging i tråd med IA-prinsipper.",
    ansvar: "Ansatt melder fravær så tidlig som mulig. Nærmeste leder følger opp etter fastsatt plan.",
    rutine: "Sykefravær meldes pr. telefon før arbeidstidens start. Egenmelding registreres i MCS Kontrollsenter. Sykmelding leveres digitalt. Oppfølgingssamtale innen 4 uker.",
    dokumentasjon: "Fravær registreres i fraværsmodulen og synkroniseres mot Outlook (Out of Office).",
    avvik: "Manglende melding eller dokumentasjon følges opp individuelt.",
    henvisninger: "Folketrygdloven kap. 8. IA-avtalen.",
  },
  {
    title: "Bruk av MCS Kontrollsenter",
    formaal: "Sikre at alle ansatte bruker MCS Kontrollsenter som primært arbeidsverktøy.",
    ansvar: "Alle ansatte er ansvarlige for å holde sine oppgaver, timer, SJA og avvik oppdatert i systemet.",
    rutine: "Logg inn via Microsoft 365. Bruk mobilversjon i felt. Skriv kort, klart og faktabasert. Last opp bilder ved behov.",
    dokumentasjon: "Aktivitet logges automatisk i `activity_log`. Dokumenter lagres i prosjektmappen.",
    avvik: "Tekniske feil meldes til IT/systemansvarlig med skjermbilde.",
    henvisninger: "Brukerveiledning MCS Kontrollsenter (intern).",
  },
  {
    title: "HMS-ansvar",
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
    rutine: "Bruk avviksskjema i MCS Kontrollsenter. Beskriv hva, hvor, når og foreslått tiltak. Vernombud orienteres om HMS-avvik.",
    dokumentasjon: "Avvik følges fra meldt til lukket med tiltak og ansvarlig.",
    avvik: "Gjengangere analyseres i ledelsens gjennomgang.",
    henvisninger: "Arbeidsmiljøloven kap. 2A om varsling.",
  },
];

const HMS: ChapterSpec[] = [
  {
    title: "Internkontroll",
    formaal: "Sikre systematisk HMS-arbeid i MCS Service i tråd med internkontrollforskriften.",
    ansvar: "Daglig leder er ansvarlig for systemet. HMS-leder forvalter dokumentasjon og årshjul.",
    rutine: "Årshjul med vernerunder, ledelsens gjennomgang, risikovurderinger, opplæring og revisjon av prosedyrer.",
    dokumentasjon: "Hele systemet ligger i MCS Kontrollsenter / HMS-modulen.",
    avvik: "Manglende gjennomføring av planlagte aktiviteter er avvik og skal lukkes med ny dato.",
    henvisninger: "Internkontrollforskriften.",
  },
  {
    title: "Roller og ansvar",
    formaal: "Tydeliggjøre HMS-roller i organisasjonen.",
    ansvar: "Daglig leder, HMS-leder, driftsleder, vernombud, ansatt – hver med definert ansvar.",
    rutine: "Roller revideres årlig og ved organisasjonsendringer. Verneombud velges for 2 år.",
    dokumentasjon: "Rolleoversikt vedlikeholdes i MCS Kontrollsenter.",
    avvik: "Uklare roller løftes til ledelsens gjennomgang.",
    henvisninger: "Arbeidsmiljøloven kap. 6 og 7.",
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
    dokumentasjon: "Risikovurderinger arkiveres pr. aktivitet/oppdrag.",
    avvik: "Manglende vurdering på kritiske aktiviteter er avvik.",
    henvisninger: "Internkontrollforskriften §5.",
  },
  {
    title: "Avvik og RUH",
    formaal: "Lav terskel for å melde uønskede hendelser og forbedringsforslag.",
    ansvar: "Alle melder. HMS-leder behandler.",
    rutine: "Meld i MCS Kontrollsenter. Beskriv hendelsen, ev. skade, umiddelbare tiltak og forslag til forbedring.",
    dokumentasjon: "RUH/avvik følges til lukket med tiltak.",
    avvik: "Gjengangere analyseres og kan utløse ny prosedyre.",
    henvisninger: "Internkontrollforskriften §5 nr. 7.",
  },
  {
    title: "FSE og elsikkerhet",
    formaal: "Sikre at alt arbeid på elektriske anlegg utføres iht. FSE.",
    ansvar: "Driftsleder/installatør er ansvarlig for at FSE-krav oppfylles. Alle som arbeider med el må ha gyldig FSE-opplæring.",
    rutine: "Årlig FSE-kurs. Førstehjelpskurs hvert 12. mnd. for utsatte grupper. Spenningstest, jording og skilting før arbeid.",
    dokumentasjon: "Opplæring og repetisjon registreres i kompetanseoversikt.",
    avvik: "Arbeid uten gyldig FSE er avvik og stoppes.",
    henvisninger: "Forskrift om sikkerhet ved arbeid i og drift av elektriske anlegg (FSE).",
  },
  {
    title: "Arbeid nær elektriske anlegg",
    formaal: "Beskrive sikker arbeidsmetode ved arbeid nær spenningsførende deler.",
    ansvar: "Ansvarlig for arbeidet etter FSE skal utpekes før oppstart.",
    rutine: "Velg metode: utkoblet, nær eller under spenning. Sikre med tiltak iht. valgt metode. Alltid bruk personlig verneutstyr og isolerte verktøy.",
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
    rutine: "Sikre stedet, varsle nødetater, varsle pårørende via politiet, varsle Arbeidstilsynet/politiet, ta vare på spor og dokumentasjon.",
    dokumentasjon: "Hendelseslogg opprettes umiddelbart. Egen rapport til myndigheter.",
    avvik: "Avvik fra beredskap evalueres i ettertid.",
    henvisninger: "Arbeidsmiljøloven §5-2. Internkontrollforskriften.",
  },
  {
    title: "Verneutstyr",
    formaal: "Sikre at riktig personlig verneutstyr (PVU) brukes.",
    ansvar: "MCS dekker pålagt PVU. Ansatt skal bruke og vedlikeholde det.",
    rutine: "Vernesko, hjelm, briller, hørselvern, hansker og lysbueverntøy etter behov. Sjekk utstyr før bruk.",
    dokumentasjon: "Utlevering registreres pr. ansatt.",
    avvik: "Defekt utstyr skiftes umiddelbart.",
    henvisninger: "Forskrift om utførelse av arbeid §15.",
  },
  {
    title: "Datacenter",
    formaal: "Egne sikkerhetskrav for arbeid i datacenter.",
    ansvar: "Driftsleder for datacenteroppdraget.",
    rutine: "Følg kundens sikkerhetsregime. Adgang, ESD, kjøling, brann, dobbeltgulv, redundans. Aldri jobb alene på kritiske systemer uten klarering.",
    dokumentasjon: "Adgangslogg og arbeidstillatelser oppbevares pr. oppdrag.",
    avvik: "Hendelser i datacenter eskaleres umiddelbart til kunden.",
    henvisninger: "Kundespesifikke prosedyrer (vedlegg pr. kunde).",
  },
  {
    title: "Næringsbygg",
    formaal: "Standard arbeidsmetode i næringsbygg, kontor og forretning.",
    ansvar: "Driftsleder pr. oppdrag.",
    rutine: "Avklar adgang, brannrutiner, åpningstider og sikring av arbeidsområde. Begrens støy og støv i driftstid.",
    dokumentasjon: "Adgangs- og nøkkelhåndtering loggføres.",
    avvik: "Skader på inventar/bygg meldes som RUH og til kunde.",
    henvisninger: "Internkontrollforskriften.",
  },
  {
    title: "Tavler og strømskinner",
    formaal: "Sikker montasje, kontroll og service på tavler og strømskinneanlegg.",
    ansvar: "FSE-ansvarlig leder arbeidet. Sertifisert tavlemontør utfører arbeidet i tavle.",
    rutine: "Spenningstest, jording, skilting og avskjerming før arbeid. Bruk lysbueverntøy ved arbeid på/nær spenning. Trekk dokumentert moment. Sluttkontroll og termografi etter behov.",
    dokumentasjon: "Sluttkontroll og termografi lagres pr. anlegg.",
    avvik: "Funn ved kontroll behandles som risikoflagg i prosjektet.",
    henvisninger: "FSE. NEK 439. NEK 400.",
  },
  {
    title: "Kjemikalier og stoffkartotek",
    formaal: "Sikre forsvarlig bruk og oppbevaring av kjemikalier.",
    ansvar: "HMS-leder forvalter stoffkartotek. Ansatt leser sikkerhetsdatablad før bruk.",
    rutine: "Bruk kun godkjente produkter. Oppbevar etter datablad. Bruk anbefalt PVU. Avhend riktig.",
    dokumentasjon: "Stoffkartotek vedlikeholdes i MCS Kontrollsenter.",
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
    title: "EE-avfall",
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
    rutine: "Tiltakskort for de viktigste scenarier finnes i MCS Kontrollsenter. Beredskapsøvelse minst årlig.",
    dokumentasjon: "Øvelser og hendelser loggføres og evalueres.",
    avvik: "Manglende øvelse er avvik mot internkontroll.",
    henvisninger: "Internkontrollforskriften §5 nr. 6.",
  },
];

export const MCS_HANDBOOK_SEEDS: HandbookSeed[] = [
  {
    kind: "employee_handbook",
    title: "Arbeidshåndbok – MCS Service",
    description:
      "Arbeidstid, overtid, pauser, hviletid, reisetid, natt/helg, fravær, bruk av MCS Kontrollsenter, HMS-ansvar og avvik.",
    chapters: ARB.map((c) => ({ title: c.title, body: renderChapter(c) })),
  },
  {
    kind: "hms_handbook",
    title: "HMS-håndbok – MCS Service",
    description:
      "Internkontroll, roller, SJA, risiko, avvik, FSE, elsikkerhet, ulykker, verneutstyr, datacenter, næringsbygg, tavler, kjemikalier, asbest, EE-avfall og beredskap.",
    chapters: HMS.map((c) => ({ title: c.title, body: renderChapter(c) })),
  },
];
