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

  tinglingHands: number;
  numbness: number;
  balanceIssues: number;
  brainFog: number;
  mood: number;
  burningPain: number;
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

  hrv: number;
  sleepScore: number;
  stressLevel: number;
  restingHeartRate: number;
  bodyBattery: number;

  contextPoorSleep: boolean;
  contextStress: boolean;
  contextMenstruation: boolean;
  contextExercise: boolean;
  contextAlcohol: boolean;
  contextTravel: boolean;

  /** Ekstra B12-symptomer uten egne Mac-felt. */
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
    tinglingHands: 0,
    numbness: 0,
    balanceIssues: 0,
    brainFog: 0,
    mood: 0,
    burningPain: 0,
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
    hrv: 0,
    sleepScore: 0,
    stressLevel: 0,
    restingHeartRate: 0,
    bodyBattery: 0,
    contextPoorSleep: false,
    contextStress: false,
    contextMenstruation: false,
    contextExercise: false,
    contextAlcohol: false,
    contextTravel: false,
    extraSymptoms: {},
  };
}

/** Prikking/nummenhet — max av tinglingHands og numbness (som Mac). */
export function handParesthesia(log: Pick<DailyLog, "tinglingHands" | "numbness">): number {
  return Math.max(log.tinglingHands, log.numbness);
}

export function normalizeDailyLog(partial: Partial<DailyLog> & { date: string }): DailyLog {
  return {
    ...createEmptyDailyLog(partial.date, partial.healthValue ?? 5),
    ...partial,
    medications: partial.medications ?? [],
    extraSymptoms: { ...(partial.extraSymptoms ?? {}) },
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
