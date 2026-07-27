import {
  clearAllAppData,
  saveDailyLog,
  saveLabAnalysis,
  saveLabResult,
  saveMedication,
  saveSettings,
  saveTracker,
  saveTrackerValue,
} from "../storage/localStore";
import {
  createEmptyDailyLog,
  createId,
  labResultId,
  trackerValueId,
  type DailyLog,
  type LabAnalysis,
  type LabResult,
  type Medication,
  type Tracker,
  type TrackerValue,
} from "../types";
import { toDateKey } from "../utils/dates";

/** Bump for å tvinge ny innlasting av testdata. */
export const DEMO_SEED_VERSION = "b12-year-v4-ukentlig-behov";
const SEED_STORAGE_KEY = "helseapp-web-demo-seed";

/** Deterministisk 0–1 fra heltall (stabil testdata). */
function rnd(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function dayIndexFrom(start: string, dateKey: string): number {
  const a = new Date(`${start}T12:00:00`).getTime();
  const b = new Date(`${dateKey}T12:00:00`).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

/**
 * Demo-narrativ (vanlig problemstilling):
 * Opplading → ukentlig (stabil) → hver 3. uke (synker i uke 2–3) →
 * månedlig (tydelig forverring) → tilbake til ukentlig (stabiliseres).
 * Poenget: formen peker mot behov for minst ukentlig injeksjon.
 */
type InjectionPhase = {
  from: number;
  to: number;
  every: number;
  anchor: number;
};

const INJECTION_PHASES: InjectionPhase[] = [
  // Opplading: daglig i 5 dager
  { from: 0, to: 4, every: 1, anchor: 0 },
  // Ukentlig ~8 uker — formen holder seg
  { from: 5, to: 67, every: 7, anchor: 11 },
  // Forsøk: hver 3. uke — gradvis dårligere mot slutten av syklusen
  { from: 68, to: 160, every: 21, anchor: 74 },
  // Forsøk: månedlig — tydelig tilbakefall etter ~1–2 uker
  { from: 161, to: 280, every: 28, anchor: 186 },
  // Tilbake til ukentlig — stabiliseres igjen
  { from: 281, to: 9999, every: 7, anchor: 281 },
];

function phaseForDay(treatmentDay: number): InjectionPhase | null {
  if (treatmentDay < 0) return null;
  return INJECTION_PHASES.find((phase) => treatmentDay >= phase.from && treatmentDay <= phase.to) ?? null;
}

function isInjectionDay(treatmentDay: number): boolean {
  const phase = phaseForDay(treatmentDay);
  if (!phase) return false;
  if (treatmentDay < phase.anchor && phase.every > 1) return false;
  return (treatmentDay - phase.anchor) % phase.every === 0;
}

function daysSinceLastInjection(treatmentDay: number): number | null {
  if (treatmentDay < 0) return null;
  for (let d = treatmentDay; d >= 0; d -= 1) {
    if (isInjectionDay(d)) return treatmentDay - d;
  }
  return null;
}

/**
 * Strain etter dager siden sprøyte — uavhengig av planlagt intervall.
 * Ukentlig: mild svekkelse. 3 uker / 1 mnd: klar forverring etter uke 1.
 */
function cycleStrain(treatmentDay: number): number {
  const since = daysSinceLastInjection(treatmentDay);
  if (since == null) return 0.45;
  if (since <= 3) return 0;
  if (since <= 7) return ((since - 3) / 4) * 0.22;
  if (since <= 14) return 0.22 + ((since - 7) / 7) * 0.45;
  if (since <= 21) return 0.67 + ((since - 14) / 7) * 0.22;
  return Math.min(1, 0.89 + ((since - 21) / 14) * 0.11);
}

/**
 * Baseline: bedring under lasting/ukentlig, litt lavere under lange intervaller
 * (akkumulert underdose), bedring igjen ved ukentlig.
 */
function recoveryProgress(treatmentDay: number): number {
  if (treatmentDay < 0) return 0;
  if (treatmentDay <= 4) return 0.14;
  if (treatmentDay <= 67) return lerp(0.22, 0.88, (treatmentDay - 4) / 63);
  if (treatmentDay <= 160) return lerp(0.85, 0.72, (treatmentDay - 67) / 93);
  if (treatmentDay <= 280) return lerp(0.7, 0.4, (treatmentDay - 160) / 120);
  return lerp(0.38, 0.86, Math.min(1, (treatmentDay - 281) / 90));
}

function shouldLogDay(treatmentDay: number, seed: number): boolean {
  if (treatmentDay < 0) return rnd(seed) > 0.5;
  // Nesten daglig etter behandlingsstart — trengs for intervall-analysen
  return rnd(seed) > 0.06;
}

export function isDemoSeedInstalled(): boolean {
  try {
    return localStorage.getItem(SEED_STORAGE_KEY) === DEMO_SEED_VERSION;
  } catch {
    return false;
  }
}

function markSeedInstalled(): void {
  try {
    localStorage.setItem(SEED_STORAGE_KEY, DEMO_SEED_VERSION);
    localStorage.setItem("helseapp-web-welcome-v1", "1");
  } catch {
    // ignore
  }
}

/**
 * Erstatter all appdata med et B12-årsforløp (juli 2025 → i dag)
 * som viser at lengre intervall enn ukentlig gir systematisk forverring.
 */
export async function seedDemoB12Year(options: { force?: boolean } = {}): Promise<void> {
  if (!options.force && isDemoSeedInstalled()) return;

  const today = toDateKey(new Date());
  const start = "2025-07-01";
  const treatmentStart = "2025-07-15";

  await clearAllAppData();

  const createdAt = `${start}T09:00:00.000Z`;

  const medications: Medication[] = [
    { id: createId(), name: "Folsyre", kind: "Tilskudd", isActive: true, createdAt },
    { id: createId(), name: "Magnesium", kind: "Tilskudd", isActive: true, createdAt },
    { id: createId(), name: "Jern", kind: "Tilskudd", isActive: false, createdAt },
  ];

  const trackers: Tracker[] = [
    {
      id: createId(),
      name: "Skritt",
      type: "Tall",
      unit: "skritt",
      emoji: "",
      isActive: true,
      createdAt,
    },
    {
      id: createId(),
      name: "Treningsøkt",
      type: "Ja/nei",
      unit: "",
      emoji: "",
      isActive: true,
      createdAt,
    },
  ];

  const analyses: LabAnalysis[] = [
    { id: createId(), name: "B12", unit: "pmol/L", isActive: true, createdAt },
    { id: createId(), name: "Folat", unit: "nmol/L", isActive: true, createdAt },
    { id: createId(), name: "MMA", unit: "nmol/L", isActive: true, createdAt },
    { id: createId(), name: "Homocystein", unit: "µmol/L", isActive: true, createdAt },
    { id: createId(), name: "Ferritin", unit: "µg/L", isActive: true, createdAt },
  ];

  for (const item of medications) await saveMedication(item);
  for (const item of trackers) await saveTracker(item);
  for (const item of analyses) await saveLabAnalysis(item);

  await saveSettings({
    b12IntervalDays: 7,
    calendarDisplayKind: "healthScore",
    calendarDisplayItemName: "",
    enabledSymptoms: [
      "fatigue",
      "sleepHours",
      "handParesthesia",
      "brainFog",
      "irritability",
      "anxiety",
      "headache",
      "nausea",
      "balanceIssues",
      "orthostatic",
      "daytimeSleepiness",
      "concentration",
      "neuropathyPain",
      "depression",
    ],
  });

  const labPanels: Array<{
    date: string;
    note: string;
    b12: number;
    folat: number;
    mma: number;
    hcy: number;
    ferritin: number;
  }> = [
    {
      date: "2025-07-01",
      note: "Utredning hos fastlege — lav B12, forhøyet MMA/homocystein",
      b12: 128,
      folat: 11,
      mma: 520,
      hcy: 19.2,
      ferritin: 26,
    },
    {
      date: "2025-08-20",
      note: "Etter opplading + ukentlig — markører bedret, form stabil",
      b12: 920,
      folat: 19,
      mma: 220,
      hcy: 11.5,
      ferritin: 34,
    },
    {
      date: "2025-11-05",
      note: "Kontroll under hver-3.-uke — B12 synker mot slutten av syklusen",
      b12: 410,
      folat: 21,
      mma: 210,
      hcy: 12.2,
      ferritin: 36,
    },
    {
      date: "2026-02-10",
      note: "Månedlig intervall — symptomer tilbake, MMA/homocystein stiger",
      b12: 265,
      folat: 20,
      mma: 310,
      hcy: 15.1,
      ferritin: 33,
    },
    {
      date: "2026-05-15",
      note: "Etter ny periode med ukentlig — bedring igjen",
      b12: 580,
      folat: 24,
      mma: 155,
      hcy: 9.4,
      ferritin: 42,
    },
    {
      date: "2026-07-10",
      note: "Oppfølging — jevn form på ukentlig regime",
      b12: 545,
      folat: 25,
      mma: 140,
      hcy: 8.7,
      ferritin: 48,
    },
  ];

  for (const panel of labPanels) {
    if (panel.date > today) continue;
    const rows: Array<{ testType: string; value: number; unit: string }> = [
      { testType: "B12", value: panel.b12, unit: "pmol/L" },
      { testType: "Folat", value: panel.folat, unit: "nmol/L" },
      { testType: "MMA", value: panel.mma, unit: "nmol/L" },
      { testType: "Homocystein", value: panel.hcy, unit: "µmol/L" },
      { testType: "Ferritin", value: panel.ferritin, unit: "µg/L" },
    ];
    for (const [index, row] of rows.entries()) {
      const lab: LabResult = {
        id: labResultId(panel.date, row.testType),
        date: panel.date,
        testType: row.testType,
        value: row.value,
        unit: row.unit,
        note: index === 0 ? panel.note : "",
      };
      await saveLabResult(lab);
    }
  }

  const notes: Array<{ date: string; text: string }> = [
    { date: "2025-07-01", text: "Blodprøvesvar hos fastlege: B12-mangel. Henvisning/start behandling." },
    { date: "2025-07-15", text: "Opplading: hydroksokobalamin daglig i 5 dager." },
    { date: "2025-07-19", text: "Siste daglige sprøyte. Fortsetter ukentlig en periode." },
    { date: "2025-07-26", text: "Første ukentlige injeksjon. Mer klar i hodet." },
    { date: "2025-09-15", text: "Ukentlig har fungert bra — jevn energi gjennom uka. Prøver å trappe ned til hver 3. uke." },
    {
      date: "2025-10-20",
      text: "Hver 3. uke: de første dagene OK, men uke 2–3 merker jeg tretthet, hjernetåke og prikking.",
    },
    {
      date: "2025-12-10",
      text: "Fortsatt hver 3. uke. Tydelig at jeg synker før neste sprøyte — vurderer hyppigere.",
    },
    {
      date: "2026-01-18",
      text: "Avtalt månedlig vedlikehold. Håper det holder, men er skeptisk etter 3-ukersperioden.",
    },
    {
      date: "2026-02-15",
      text: "Månedlig: etter ~10–14 dager er jeg merkbart dårligere. Uke 3–4 er tøffe.",
    },
    {
      date: "2026-03-20",
      text: "Langt mellom dosene. Utmattelse, prikking og dårlig konsentrasjon er tilbake for fullt.",
    },
    {
      date: "2026-04-22",
      text: "Kontakter fastlege. Dataene viser klart forverring når intervallet er over én uke. Tilbake til ukentlig.",
    },
    { date: "2026-05-20", text: "Ukentlig igjen — formen er mer forutsigbar, mindre «dal» før sprøyten." },
    { date: "2026-06-25", text: "Bekreftet: trenger minst ukentlig. Lengre intervaller gir systematisk tilbakefall." },
    { date: "2026-07-12", text: "Følger med på formen mellom sprøytene — ukentlig holder." },
  ];
  const noteByDate = new Map(notes.map((item) => [item.date, item.text]));

  let offset = 0;
  while (true) {
    const date = addDays(start, offset);
    if (date > today) break;

    const treatmentDay = dayIndexFrom(treatmentStart, date);
    const seed = offset * 17 + 3;
    offset += 1;

    if (!shouldLogDay(treatmentDay, seed)) continue;

    const progress = recoveryProgress(treatmentDay);
    const strain = cycleStrain(treatmentDay);
    const stressBump = rnd(seed + 1) > 0.93;
    const illnessBump = rnd(seed + 2) > 0.975;
    const poorSleep = rnd(seed + 3) > 0.9 || strain > 0.75;
    const travel = rnd(seed + 4) > 0.97;
    const alcohol = rnd(seed + 5) > 0.95;
    const exercise = progress > 0.35 && strain < 0.55 && rnd(seed + 6) > 0.72;

    const eventDip = (stressBump ? 1.0 : 0) + (illnessBump ? 1.4 : 0) + (poorSleep ? 0.5 : 0);
    // Sterkere syklus-dip slik at 3 uker / 1 mnd synes tydelig i oversikt
    const cycleDip = strain * 3.8;
    const baseHealth = lerp(2.8, 8.2, progress);
    const healthValue = clamp(
      baseHealth + (rnd(seed + 7) - 0.45) * 0.7 - eventDip - cycleDip,
      1,
      10,
    );

    const symptomLevel = (severe: number, mild: number) => {
      const baseline = lerp(severe, mild, progress);
      const cycleBump = strain * (severe - mild) * 1.05;
      return clamp(baseline + cycleBump + (rnd(seed + severe * 5) - 0.5) * 0.9 + eventDip * 0.45, 0, 10);
    };

    const hadB12 = isInjectionDay(treatmentDay);
    const tookFolate = treatmentDay >= 0 && rnd(seed + 8) > 0.18;
    const tookMag = treatmentDay >= 0 && rnd(seed + 9) > 0.25;

    const fatigue = symptomLevel(9, 2.5);
    const brainFog = symptomLevel(8, 2);
    const handParesthesia = symptomLevel(8, 2);
    const neuropathyPain = symptomLevel(7, 1);
    const concentration = symptomLevel(8, 2);
    const daytimeSleepiness = symptomLevel(7, 2);
    const irritability = symptomLevel(6, 1.5);
    const anxiety = symptomLevel(5, 1);
    const depression = symptomLevel(6, 1);
    const headache = symptomLevel(5, 1);
    const balanceIssues = symptomLevel(5, 1);
    const orthostaticSeverity = symptomLevel(6, 0);
    const nausea = clamp(lerp(2, 0, progress) + (strain > 0.7 ? 1 : 0), 0, 3);

    const sleepHours = clamp(
      lerp(5.5, 7.5, progress) - strain * 1.2 + (poorSleep ? -1.2 : 0) + (rnd(seed + 11) - 0.5) * 0.8,
      3,
      10,
    );

    const log: DailyLog = {
      ...createEmptyDailyLog(date, healthValue),
      note: noteByDate.get(date) ?? "",
      hadB12Injection: hadB12,
      medications: [...(tookFolate ? ["Folsyre"] : []), ...(tookMag ? ["Magnesium"] : [])],
      fatigue,
      sleepHours,
      handParesthesia,
      brainFog,
      irritability,
      anxiety,
      headache,
      balanceIssues,
      orthostaticSeverity,
      hadOrthostaticEpisode: orthostaticSeverity > 0,
      nausea,
      bloating: clamp(lerp(1, 0, progress) + (rnd(seed + 12) > 0.9 ? 1 : 0), 0, 3),
      diarrhea: rnd(seed + 13) > 0.95 ? 1 : 0,
      constipation: rnd(seed + 14) > 0.93 ? 1 : 0,
      hadMigraine: rnd(seed + 15) > 0.985,
      contextPoorSleep: poorSleep,
      contextStress: stressBump,
      contextExercise: exercise,
      contextAlcohol: alcohol,
      contextTravel: travel,
      extraSymptoms: {
        daytimeSleepiness,
        concentration,
        neuropathyPain,
        depression,
      },
    };

    await saveDailyLog(log);

    if (rnd(seed + 20) > 0.28) {
      const steps = clamp(
        lerp(1800, 9000, progress) * (1 - strain * 0.35) + (rnd(seed + 21) - 0.5) * 2000,
        400,
        14000,
      );
      const stepValue: TrackerValue = {
        id: trackerValueId(date, "Skritt"),
        date,
        trackerName: "Skritt",
        value: steps,
      };
      await saveTrackerValue(stepValue);
    }

    if (exercise || (strain < 0.4 && rnd(seed + 22) > 0.88)) {
      await saveTrackerValue({
        id: trackerValueId(date, "Treningsøkt"),
        date,
        trackerName: "Treningsøkt",
        value: 1,
      });
    }
  }

  markSeedInstalled();
}
