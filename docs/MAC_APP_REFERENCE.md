# Mac-app referanse for HelseApp Web

Dette dokumentet beskriver **HelseApp for Mac** slik at webversjonen kan bygges med samme funksjonalitet, datamodell og UX.

**Kildekode (Mac):** lokalt HelseApp-prosjekt (utenfor dette repoet).  
**Eksempel-backup:** bruk egen JSON-eksport fra Mac/web — ikke commit helsebackup til git.

Les dette dokumentet før nye features bygges i webappen.

---

## Navigasjon (Mac sidebar)

| Seksjon | Norsk navn | Beskrivelse |
|---------|------------|-------------|
| `calendar` | Kalender | Daglig registrering, månedsvisning |
| `medication` | Medisin | Medisin/tilskudd + bulk-registrering |
| `trackers` | Trackere | Egendefinerte målinger |
| `labs` | Blodprøver | B12, folat m.m. |
| `insights` | Innsikt | Mønstre og ukeoversikt |
| `trends` | Grafer | Sammenlign over tid |

---

## Daglogg (`DailyLog`)

Hver dag kan ha:

### Kjerne
- `date` — ISO `YYYY-MM-DD` (lokal kalender, ikke UTC)
- `healthValue` — helsescore 1–10
- `note` — fritekst
- `hadB12Injection` — bool
- `medications` — liste med medisinnavn (strenger)

### Nevrologisk / psykisk (UI-felt → lagring)
| UI-label | Lagringsfelt | Skala |
|----------|--------------|-------|
| Prikking/nummenhet | `max(tinglingHands, numbness)` | 0–10 |
| Hjernetåke | `brainFog` | 0–10 |
| Irritasjon | `mood` | 0–10 |
| Angst | `burningPain` | 0–10 |
| Hodepine alvorlighetsgrad | `headache` | 0–10 |
| Migrene | `hadMigraine` | bool |

### Søvn / utmattelse
- `sleepHours` — 0–14 timer
- `fatigue` — 0–10

### Mage/tarm (0–3)
- `nausea`, `bloating`, `diarrhea`, `constipation`

### Klokkemålinger (Garmin)
- `hrv`, `sleepScore`, `stressLevel`, `restingHeartRate`, `bodyBattery`

### Dagskontekst (bool)
- `contextPoorSleep`, `contextStress`, `contextMenstruation`, `contextExercise`, `contextAlcohol`, `contextTravel`

---

## Kalender-visning

Brukeren kan velge hva som vises i kalenderceller:

| Modus | Visning |
|-------|---------|
| `healthScore` | Tall 1–10 + grønn→gul→rød bakgrunn |
| `symptom` | Symptomverdi + symptomfarge |
| `tracker` | Tracker-verdi/emoji |
| `medication` | Grønn hake når medisin tatt |

Symptomer i kalender: utmattelse, søvn, prikking, hjernetåke, irritabilitet, angst, hodepine, kvalme.

Alltid: lilla kant = B12 den dagen.

---

## Farge-logikk

**Helsescore:** grønn (bra) → rød (dårlig), hue 0–0.33  
**Symptom:** omvendt — høyere symptom = sterkere «dårlig» farge (`symptomTint`)  
**GI-symptomer:** 1=lett, 2=moderat, 3=sterk

---

## Medisin

- Typer: `Tilskudd` / `Medisin`
- Aktiv/pause
- **Bulk-registrering:** kalender der man klikker mange dager for én medisin
- Lagres som relasjon på daglogg (web: liste med medisinnavn)

---

## B12

- Intervall (standard 14 dager) i innstillinger
- Banner øverst i kalender med status + **Registrer** (bulk-kalender)
- `hadB12Injection` på daglogg

---

## Trackere

Typer:
- `Tall` — heltall + valgfri enhet
- `Ja/nei` — tilstede/ikke tilstede (kun «ja» vises i kalender)
- `Skala` — 0–10

Lagres som egne `trackerValues` per dag.

---

## Grafer (`TrendsView`)

- Standardperiode: **1 mnd**
- Grupper: Symptomer/form, Klokkemålinger, Medisin/B12
- Normaliseres til 0–10 for sammenligning
- Medisin/B12 som markører (ikke linjer)
- Egendefinert periode: visuell kalender (klikk fra → til → Velg)

---

## Eksport/import (viktig for web!)

Mac-appen eksporterer JSON (`exportFormatVersion: 2`):

```json
{
  "exportFormatVersion": 2,
  "dailyLogs": [ { "date": "2026-07-25", "healthValue": 7, ... } ],
  "medications": [ { "name": "...", "kind": "...", "isActive": true } ],
  "trackers": [ { "name": "...", "type": "Ja/nei", "emoji": "🍺" } ],
  "trackerValues": [ { "date": "2026-07-25", "trackerName": "...", "value": 1 } ],
  "labResults": [ ... ],
  "settings": { "calendarDisplayKind": "healthScore", "b12IntervalDays": 14, ... }
}
```

**Web bør støtte import/eksport av dette formatet** for enkel overgang mellom Mac og nettleser.

Legacy v1-eksporter brukte UTC-datoer (+1 dag ved import i Mac).

---

## Prioritert feature-paritet (forslag)

### Fase 1
- [ ] Kalender + daglogg (helsescore, symptomer, notat)
- [ ] JSON import/eksport (v2)
- [ ] Medisinliste + bulk-registrering
- [ ] B12 banner + bulk-registrering

### Fase 2
- [ ] Kalender-visningsvelger (symptom/medisin/tracker)
- [ ] Trackere
- [ ] Grafer (1 mnd default)

### Fase 3
- [ ] Blodprøver
- [ ] Innsikt
- [ ] PWA offline

---

## Design-prinsipper

- Norsk språk i UI
- Rolige farger, avrundede kort, tydelig hierarki
- Mac-first spacing på desktop; responsivt på mobil
- Ingen konto, ingen server — **IndexedDB** lokalt
- Kort personvernstekst: data forblir på enheten

---

## Nyttige Mac-filer å slå opp

| Fil | Innhold |
|-----|---------|
| `DayDetailView.swift` | Daglogg-skjema |
| `CalendarMonthView.swift` | Kalendergrid |
| `ChartMetrics.swift` | Grafer + kalendersymptomer |
| `BulkDayRegistrationView.swift` | Bulk medisin/B12 |
| `DailyLogExportRecord.swift` | JSON-format |
| `HealthScoreColor.swift` | Fargeberegning |
| `PeriodSelection.swift` | Datovalg i grafer |
