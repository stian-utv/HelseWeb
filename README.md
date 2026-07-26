# HelseApp Web

> **Ansvarsfraskrivelse / hobbyprosjekt**  
> Dette er et **privat hobbyprosjekt** laget for å teste og logge for egen del. Det er **ikke** et produkt, en tjeneste, medisinsk verktøy eller profesjonell løsning. Det er **ikke ment** som diagnose, behandling, helsefaglig veiledning eller erstatning for kontakt med helsepersonell. Bruk skjer **helt på eget ansvar**, uten garantier. Utvikleren påtar seg **intet ansvar** for konsekvenser av bruk, feil, datatap eller tolkning av innhold. Se også avsnittet [Ansvarsfraskrivelse (viktig)](#ansvarsfraskrivelse-viktig) lenger ned.

Nettleserbasert versjon av HelseApp for daglig logging av helsescore, symptomer, medisin/B12, trackere, blodprøver, innsikt og grafer.

Appen er **statisk** (ingen backend) og lagres som vanlige filer. Den kan hostes gratis på **GitHub Pages**.

## Hvordan appen fungerer

- Alt lagres **lokalt i nettleseren** via IndexedDB på enheten din.
- **Ingen konto**, ingen innlogging, ingen sky-synkronisering.
- Data sendes **ikke** til noen server fra appen selv.
- Du kan **eksportere/importere JSON** (v2, kompatibel med Mac-appen) via Data-menyen — dette er også måten du tar sikkerhetskopi på.
- Sletter du nettleserdata, bruker privat modus, eller bytter enhet/nettleser, kan loggen forsvinne hvis du ikke har eksportert.

## Kom i gang lokalt

```bash
npm install
npm run dev
```

Åpne adressen Vite viser (vanligvis `http://localhost:5173`).

```bash
npm run build    # bygger til dist/
npm run preview  # forhåndsvis produksjonsbygget
```

## Publisere på GitHub Pages

Repoet har allerede GitHub Actions-workflow: `.github/workflows/deploy-pages.yml`.

### 1. Opprett repo og push

```bash
# Fra prosjektmappen (første gang)
git add .
git commit -m "Initial commit: HelseApp Web"
gh repo create HelseWeb --public --source=. --remote=origin --push
```

Eller opprett repo manuelt på GitHub og:

```bash
git remote add origin git@github.com:<brukernavn>/HelseWeb.git
git add .
git commit -m "Initial commit: HelseApp Web"
git push -u origin main
```

### 2. Skru på Pages

I GitHub-repoet:

1. **Settings → Pages**
2. Under **Build and deployment**, velg **GitHub Actions** som kilde

Ved push til `main` (eller manuell kjøring av workflowen) bygges og publiseres siden.

Adressen blir typisk:

`https://<brukernavn>.github.io/HelseWeb/`

> Workflowen setter `VITE_BASE` til `/<repo-navn>/`. Hvis du endrer repo-navn, oppdateres dette automatisk.

### 3. Valgfritt: eget domenenavn

Hvis du bruker custom domain på root (uten undermappe), sett `VITE_BASE` til `/` i workflowen før build.

## Personvern

- Appen er laget for **lokal, personlig bruk**.
- Utvikleren mottar ikke helseopplysningene dine gjennom denne appen.
- GitHub (eller annen host) leverer bare de statiske filene (HTML/JS/CSS). Selve loggdataene ligger i nettleseren hos brukeren.
- Vær oppmerksom på at andre med tilgang til samme brukerprofil/enhet i teorien kan se lokal nettleserdata.

## Ansvarsfraskrivelse (viktig)

**HelseApp Web er ikke medisinsk rådgivning, diagnose, behandling eller erstatning for kontakt med helsepersonell.**

Appen tilbys «som den er» (`AS IS`), uten garantier av noe slag — verken uttrykkelige eller underforståtte — inkludert, men ikke begrenset til, garanti om egnethet for et bestemt formål, pålitelighet, tilgjengelighet eller at data ikke går tapt.

Ved å bruke appen aksepterer du at:

1. Du bruker den **på eget ansvar**.
2. Du selv er ansvarlig for beslutninger knyttet til egen helse, medisinering og oppfølging.
3. Du selv er ansvarlig for **sikkerhetskopiering** (JSON-eksport) og for tap av data ved sletting av nettleserlagring, feil, oppdateringer eller andre hendelser.
4. Utvikleren / rettighetshaver påtar seg **intet ansvar** for direkte eller indirekte tap, skade, feilbehandling, feilaktig tolkning av logger, datatap eller andre konsekvenser som følger av bruk eller manglende mulighet til å bruke appen.
5. Innhold, beregninger (f.eks. B12-intervall) og visualiseringer er kun hjelpemidler for personlig oversikt og kan være ufullstendige eller feil.

Hvis du er usikker på symptomer, prøvesvar eller behandling: kontakt lege eller annet kvalifisert helsepersonell.

## Lisens / bruk

Koden i dette repoet kan brukes og deles fritt til personlige formål med mindre annet er oppgitt senere. Appen leveres uten support-forpliktelse.

## Utvikling

Se `docs/MAC_APP_REFERENCE.md` for datamodell og feature-paritet med Mac-appen.
