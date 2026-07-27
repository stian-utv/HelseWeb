export type MedicationKind = "Tilskudd" | "Medisin";

export type TrackerType = "Tall" | "Ja/nei" | "Skala";

export type LabTestType = "B12" | "Folat" | "MMA" | "Homocystein";

export type Medication = {
  id: string;
  name: string;
  kind: MedicationKind;
  isActive: boolean;
  createdAt: string;
};

export type Tracker = {
  id: string;
  name: string;
  type: TrackerType;
  unit: string;
  emoji: string;
  isActive: boolean;
  createdAt: string;
};

/** Composite key: `${date}|${trackerName}` */
export type TrackerValue = {
  id: string;
  date: string;
  trackerName: string;
  value: number;
};

/** Composite key: `${date}|${testType}` */
export type LabResult = {
  id: string;
  date: string;
  testType: LabTestType;
  value: number;
  unit: string;
  note: string;
};

export type DailyLog = {
  date: string;
  healthValue: number;
  note: string;
  hadB12Injection: boolean;
  medications: string[];

  handParesthesia: number;
  balanceIssues: number;
  brainFog: number;
  irritability: number;
  anxiety: number;
  headache: number;
  hadMigraine: boolean;
  hadOrthostaticEpisode: boolean;
  orthostaticSeverity: number;

  nausea: number;
  bloating: number;
  diarrhea: number;
  constipation: number;

  sleepHours: number;
  fatigue: number;

  contextPoorSleep: boolean;
  contextStress: boolean;
  contextExercise: boolean;
  contextAlcohol: boolean;
  contextTravel: boolean;

  /** Symptomer uten eget toppnivå-felt (katalog storage: "extra"). */
  extraSymptoms: Record<string, number>;
};

export type AppSettings = {
  b12IntervalDays: number;
  calendarDisplayKind: "healthScore" | "symptom" | "tracker" | "medication";
  calendarDisplayItemName: string;
  /** IDer fra symptomkatalogen som er aktive i daglogg/grafer. */
  enabledSymptoms: string[];
};

export const DEFAULT_SETTINGS: AppSettings = {
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
  ],
};

export const MEDICATION_KINDS: MedicationKind[] = ["Tilskudd", "Medisin"];
export const TRACKER_TYPES: TrackerType[] = ["Tall", "Ja/nei", "Skala"];

export function createId(): string {
  return crypto.randomUUID();
}

export function trackerValueId(date: string, trackerName: string): string {
  return `${date}|${trackerName}`;
}

export function labResultId(date: string, testType: LabTestType): string {
  return `${date}|${testType}`;
}

export const LAB_TEST_TYPES: LabTestType[] = ["B12", "Folat", "MMA", "Homocystein"];

export function labTestDefaultUnit(testType: LabTestType): string {
  switch (testType) {
    case "B12":
      return "pmol/L";
    case "Folat":
      return "nmol/L";
    case "MMA":
      return "nmol/L";
    case "Homocystein":
      return "µmol/L";
  }
}

export function createEmptyDailyLog(date: string, healthValue = 5): DailyLog {
  return {
    date,
    healthValue,
    note: "",
    hadB12Injection: false,
    medications: [],
    handParesthesia: 0,
    balanceIssues: 0,
    brainFog: 0,
    irritability: 0,
    anxiety: 0,
    headache: 0,
    hadMigraine: false,
    hadOrthostaticEpisode: false,
    orthostaticSeverity: 0,
    nausea: 0,
    bloating: 0,
    diarrhea: 0,
    constipation: 0,
    sleepHours: 0,
    fatigue: 0,
    contextPoorSleep: false,
    contextStress: false,
    contextExercise: false,
    contextAlcohol: false,
    contextTravel: false,
    extraSymptoms: {},
  };
}

/** Eldre feltnavn fra IndexedDB / JSON v2 (før web-opprydding). */
type LegacyDailyLogFields = {
  tinglingHands?: number;
  numbness?: number;
  mood?: number;
  burningPain?: number;
};

function asFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Normaliserer en daglogg til gjeldende modell.
 * Mapper også legacy-felt (mood → irritability, osv.) fra eldre lagring/eksport.
 */
export function normalizeDailyLog(
  partial: Partial<DailyLog> & { date: string } & LegacyDailyLogFields &
    Record<string, unknown>,
): DailyLog {
  const base = createEmptyDailyLog(partial.date, partial.healthValue ?? 5);
  const legacy = partial as LegacyDailyLogFields;

  const handParesthesia =
    partial.handParesthesia !== undefined
      ? asFiniteNumber(partial.handParesthesia)
      : Math.max(asFiniteNumber(legacy.tinglingHands), asFiniteNumber(legacy.numbness));

  const irritability =
    partial.irritability !== undefined
      ? asFiniteNumber(partial.irritability)
      : asFiniteNumber(legacy.mood);

  const anxiety =
    partial.anxiety !== undefined
      ? asFiniteNumber(partial.anxiety)
      : asFiniteNumber(legacy.burningPain);

  return {
    ...base,
    healthValue: asFiniteNumber(partial.healthValue, base.healthValue),
    note: typeof partial.note === "string" ? partial.note : base.note,
    hadB12Injection: Boolean(partial.hadB12Injection),
    medications: Array.isArray(partial.medications)
      ? partial.medications.filter((item): item is string => typeof item === "string")
      : [],
    handParesthesia,
    balanceIssues: asFiniteNumber(partial.balanceIssues),
    brainFog: asFiniteNumber(partial.brainFog),
    irritability,
    anxiety,
    headache: asFiniteNumber(partial.headache),
    hadMigraine: Boolean(partial.hadMigraine),
    hadOrthostaticEpisode: Boolean(partial.hadOrthostaticEpisode),
    orthostaticSeverity: asFiniteNumber(partial.orthostaticSeverity),
    nausea: asFiniteNumber(partial.nausea),
    bloating: asFiniteNumber(partial.bloating),
    diarrhea: asFiniteNumber(partial.diarrhea),
    constipation: asFiniteNumber(partial.constipation),
    sleepHours: asFiniteNumber(partial.sleepHours),
    fatigue: asFiniteNumber(partial.fatigue),
    contextPoorSleep: Boolean(partial.contextPoorSleep),
    contextStress: Boolean(partial.contextStress),
    contextExercise: Boolean(partial.contextExercise),
    contextAlcohol: Boolean(partial.contextAlcohol),
    contextTravel: Boolean(partial.contextTravel),
    extraSymptoms:
      partial.extraSymptoms && typeof partial.extraSymptoms === "object"
        ? { ...(partial.extraSymptoms as Record<string, number>) }
        : {},
  };
}

export function clampTrackerValue(type: TrackerType, value: number): number {
  if (type === "Ja/nei") return value > 0 ? 1 : 0;
  if (type === "Skala") return Math.min(10, Math.max(0, Math.round(value)));
  return Math.max(0, Math.round(value));
}

export function trackerDisplayLabel(tracker: Tracker): string {
  const emoji = tracker.emoji.trim();
  return emoji ? `${emoji} ${tracker.name}` : tracker.name;
}

export function trackerTypeSubtitle(tracker: Tracker): string {
  if (tracker.type === "Tall" && tracker.unit.trim()) {
    return `Tall · ${tracker.unit.trim()}`;
  }
  if (tracker.type === "Skala") return "Skala 0–10";
  return tracker.type;
}
