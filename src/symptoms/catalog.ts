import type { DailyLog } from "../types";

export type SymptomCategory = "energi" | "nevrologisk" | "psykisk" | "mage" | "annet";

export type SymptomKind = "scale10" | "gi3" | "sleepHours" | "bool";

export type SymptomStorage =
  | "handParesthesia"
  | "brainFog"
  | "irritability"
  | "anxiety"
  | "headache"
  | "hadMigraine"
  | "balanceIssues"
  | "orthostaticSeverity"
  | "hadOrthostaticEpisode"
  | "nausea"
  | "bloating"
  | "diarrhea"
  | "constipation"
  | "sleepHours"
  | "fatigue"
  | "extra";

export type SymptomDef = {
  id: string;
  label: string;
  category: SymptomCategory;
  kind: SymptomKind;
  description: string;
  storage: SymptomStorage;
  /** Farge i kalender/grafer */
  color: string;
};

export const SYMPTOM_CATEGORIES: Array<{ id: SymptomCategory; title: string }> = [
  { id: "energi", title: "Energi og søvn" },
  { id: "nevrologisk", title: "Nevrologisk" },
  { id: "psykisk", title: "Psykisk form" },
  { id: "mage", title: "Mage og fordøyelse" },
  { id: "annet", title: "Andre vanlige tegn" },
];

/**
 * Symptomer knyttet til B12-mangel.
 * `storage: "extra"` lagres i DailyLog.extraSymptoms.
 */
export const SYMPTOM_CATALOG: SymptomDef[] = [
  {
    id: "fatigue",
    label: "Utmattelse",
    category: "energi",
    kind: "scale10",
    description: "Vedvarende tretthet og lav energi",
    storage: "fatigue",
    color: "#ff9500",
  },
  {
    id: "sleepHours",
    label: "Søvn (timer)",
    category: "energi",
    kind: "sleepHours",
    description: "Hvor mange timer du sov",
    storage: "sleepHours",
    color: "#5856d6",
  },
  {
    id: "daytimeSleepiness",
    label: "Søvnighet på dagtid",
    category: "energi",
    kind: "scale10",
    description: "Trøtthet og døsighet gjennom dagen",
    storage: "extra",
    color: "#5e5ce6",
  },
  {
    id: "handParesthesia",
    label: "Prikking/nummenhet",
    category: "nevrologisk",
    kind: "scale10",
    description: "Parestesier i hender, føtter eller andre steder",
    storage: "handParesthesia",
    color: "#af52de",
  },
  {
    id: "neuropathyPain",
    label: "Brennende smerte",
    category: "nevrologisk",
    kind: "scale10",
    description: "Brennende eller stikkende nevropatisk smerte",
    storage: "extra",
    color: "#bf5af2",
  },
  {
    id: "balanceIssues",
    label: "Balanceproblemer",
    category: "nevrologisk",
    kind: "scale10",
    description: "Ustøhet, dårlig balanse eller koordinasjon",
    storage: "balanceIssues",
    color: "#64d2ff",
  },
  {
    id: "dizziness",
    label: "Svimmelhet",
    category: "nevrologisk",
    kind: "scale10",
    description: "Svimmelhet eller ørhet",
    storage: "extra",
    color: "#70d7ff",
  },
  {
    id: "brainFog",
    label: "Hjernetåke",
    category: "nevrologisk",
    kind: "scale10",
    description: "Uklart tankesett og mental tretthet",
    storage: "brainFog",
    color: "#30b0c7",
  },
  {
    id: "memoryIssues",
    label: "Hukommelsesproblemer",
    category: "nevrologisk",
    kind: "scale10",
    description: "Glemsomhet eller vansker med å huske",
    storage: "extra",
    color: "#40c8e0",
  },
  {
    id: "concentration",
    label: "Konsentrasjonsvansker",
    category: "nevrologisk",
    kind: "scale10",
    description: "Vansker med å holde fokus og fokus",
    storage: "extra",
    color: "#66d4e8",
  },
  {
    id: "headache",
    label: "Hodepine",
    category: "nevrologisk",
    kind: "scale10",
    description: "Alvorlighetsgrad av hodepine",
    storage: "headache",
    color: "#ff3b30",
  },
  {
    id: "migraine",
    label: "Migrene",
    category: "nevrologisk",
    kind: "bool",
    description: "Om dagen hadde migrene",
    storage: "hadMigraine",
    color: "#ff453a",
  },
  {
    id: "muscleWeakness",
    label: "Muskelsvakhet",
    category: "nevrologisk",
    kind: "scale10",
    description: "Svakhet i armer, bein eller generelt",
    storage: "extra",
    color: "#ff6961",
  },
  {
    id: "tinnitus",
    label: "Tinnitus",
    category: "nevrologisk",
    kind: "scale10",
    description: "Øresus eller ringing i ørene",
    storage: "extra",
    color: "#ff9f0a",
  },
  {
    id: "visionIssues",
    label: "Synsforstyrrelser",
    category: "nevrologisk",
    kind: "scale10",
    description: "Uklart syn eller synsforandringer",
    storage: "extra",
    color: "#ffb340",
  },
  {
    id: "irritability",
    label: "Irritasjon",
    category: "psykisk",
    kind: "scale10",
    description: "Irritabilitet og kort lunte",
    storage: "irritability",
    color: "#ff9500",
  },
  {
    id: "anxiety",
    label: "Angst",
    category: "psykisk",
    kind: "scale10",
    description: "Uro, angst eller panikkfølelse",
    storage: "anxiety",
    color: "#ff2d55",
  },
  {
    id: "depression",
    label: "Nedstemthet",
    category: "psykisk",
    kind: "scale10",
    description: "Tristhet eller lavt humør",
    storage: "extra",
    color: "#ff375f",
  },
  {
    id: "nausea",
    label: "Kvalme",
    category: "mage",
    kind: "gi3",
    description: "Kvalme gjennom dagen",
    storage: "nausea",
    color: "#a2845e",
  },
  {
    id: "bloating",
    label: "Oppblåsthet",
    category: "mage",
    kind: "gi3",
    description: "Oppblåst mage",
    storage: "bloating",
    color: "#b89b72",
  },
  {
    id: "diarrhea",
    label: "Diaré",
    category: "mage",
    kind: "gi3",
    description: "Løs mage",
    storage: "diarrhea",
    color: "#c4a882",
  },
  {
    id: "constipation",
    label: "Forstoppelse",
    category: "mage",
    kind: "gi3",
    description: "Treg mage",
    storage: "constipation",
    color: "#8a7048",
  },
  {
    id: "appetiteLoss",
    label: "Nedsatt appetitt",
    category: "mage",
    kind: "scale10",
    description: "Lite matlyst",
    storage: "extra",
    color: "#ac8e60",
  },
  {
    id: "orthostatic",
    label: "Ortostatisk ubehag",
    category: "annet",
    kind: "scale10",
    description: "Ubehag ved å reise seg (svimmel/svak)",
    storage: "orthostaticSeverity",
    color: "#5856d6",
  },
  {
    id: "palpitations",
    label: "Hjertebank",
    category: "annet",
    kind: "scale10",
    description: "Hjertebank eller ujevn puls",
    storage: "extra",
    color: "#ff3b30",
  },
  {
    id: "shortnessOfBreath",
    label: "Kortpustethet",
    category: "annet",
    kind: "scale10",
    description: "Tungpust eller pustebesvær",
    storage: "extra",
    color: "#ff6961",
  },
];

/** Standardvalg — tilsvarer det som var synlig før. */
export const DEFAULT_ENABLED_SYMPTOMS = [
  "fatigue",
  "sleepHours",
  "handParesthesia",
  "brainFog",
  "irritability",
  "anxiety",
  "headache",
  "nausea",
];

export function symptomById(id: string): SymptomDef | undefined {
  return SYMPTOM_CATALOG.find((item) => item.id === id);
}

export function normalizeEnabledSymptoms(ids: string[] | undefined): string[] {
  const known = new Set(SYMPTOM_CATALOG.map((item) => item.id));
  const filtered = (ids ?? []).filter((id) => known.has(id));
  return filtered.length > 0 ? filtered : [...DEFAULT_ENABLED_SYMPTOMS];
}

export function enabledSymptomDefs(enabledIds: string[]): SymptomDef[] {
  const enabled = new Set(normalizeEnabledSymptoms(enabledIds));
  return SYMPTOM_CATALOG.filter((item) => enabled.has(item.id));
}

export function getSymptomValue(log: DailyLog, symptom: SymptomDef): number {
  switch (symptom.storage) {
    case "handParesthesia":
      return log.handParesthesia;
    case "brainFog":
      return log.brainFog;
    case "irritability":
      return log.irritability;
    case "anxiety":
      return log.anxiety;
    case "headache":
      return log.headache;
    case "hadMigraine":
      return log.hadMigraine ? 1 : 0;
    case "balanceIssues":
      return log.balanceIssues;
    case "orthostaticSeverity":
      return log.orthostaticSeverity;
    case "hadOrthostaticEpisode":
      return log.hadOrthostaticEpisode ? 1 : 0;
    case "nausea":
      return log.nausea;
    case "bloating":
      return log.bloating;
    case "diarrhea":
      return log.diarrhea;
    case "constipation":
      return log.constipation;
    case "sleepHours":
      return log.sleepHours;
    case "fatigue":
      return log.fatigue;
    case "extra":
      return log.extraSymptoms[symptom.id] ?? 0;
  }
}

export function applySymptomValue(log: DailyLog, symptom: SymptomDef, value: number): void {
  const rounded = Math.round(value);

  switch (symptom.storage) {
    case "handParesthesia":
      log.handParesthesia = clamp(rounded, 0, 10);
      break;
    case "brainFog":
      log.brainFog = clamp(rounded, 0, 10);
      break;
    case "irritability":
      log.irritability = clamp(rounded, 0, 10);
      break;
    case "anxiety":
      log.anxiety = clamp(rounded, 0, 10);
      break;
    case "headache":
      log.headache = clamp(rounded, 0, 10);
      break;
    case "hadMigraine":
      log.hadMigraine = rounded > 0;
      break;
    case "balanceIssues":
      log.balanceIssues = clamp(rounded, 0, 10);
      break;
    case "orthostaticSeverity":
      log.orthostaticSeverity = clamp(rounded, 0, 10);
      log.hadOrthostaticEpisode = log.orthostaticSeverity > 0;
      break;
    case "hadOrthostaticEpisode":
      log.hadOrthostaticEpisode = rounded > 0;
      break;
    case "nausea":
      log.nausea = clamp(rounded, 0, 3);
      break;
    case "bloating":
      log.bloating = clamp(rounded, 0, 3);
      break;
    case "diarrhea":
      log.diarrhea = clamp(rounded, 0, 3);
      break;
    case "constipation":
      log.constipation = clamp(rounded, 0, 3);
      break;
    case "sleepHours":
      log.sleepHours = clamp(rounded, 0, 14);
      break;
    case "fatigue":
      log.fatigue = clamp(rounded, 0, 10);
      break;
    case "extra":
      if (rounded <= 0) {
        delete log.extraSymptoms[symptom.id];
      } else {
        log.extraSymptoms[symptom.id] = clamp(
          rounded,
          0,
          symptom.kind === "gi3" ? 3 : symptom.kind === "sleepHours" ? 14 : 10,
        );
      }
      break;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
