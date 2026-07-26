import {
  clearAllAppData,
  listDailyLogs,
  listLabResults,
  listMedications,
  listTrackers,
  listTrackerValues,
  loadSettings,
  saveDailyLog,
  saveLabResult,
  saveMedication,
  saveSettings,
  saveTracker,
  saveTrackerValue,
} from "../storage/localStore";
import { normalizeEnabledSymptoms } from "../symptoms/catalog";
import {
  clampTrackerValue,
  createId,
  DEFAULT_SETTINGS,
  handParesthesia,
  LAB_TEST_TYPES,
  MEDICATION_KINDS,
  TRACKER_TYPES,
  type AppSettings,
  type DailyLog,
  type LabResult,
  type LabTestType,
  type Medication,
  type MedicationKind,
  type Tracker,
  type TrackerType,
} from "../types";
import { parseDateKey, toDateKey } from "../utils/dates";
import { stringifySorted } from "../utils/json";
import {
  IMPORT_LIMITS,
  assertArrayLength,
  assertImportByteSize,
  truncateText,
} from "./importLimits";

export { IMPORT_LIMITS, formatMaxImportSize } from "./importLimits";

export const EXPORT_FORMAT_VERSION = 2;

export type ImportMode = "merge" | "replace";

export type ImportResult = {
  dailyLogs: number;
  medications: number;
  trackers: number;
  trackerValues: number;
  labResults: number;
};

type RawExport = {
  exportFormatVersion?: number;
  dailyLogs?: unknown[];
  medications?: unknown[];
  trackers?: unknown[];
  trackerValues?: unknown[];
  labResults?: unknown[];
  settings?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function isDateKey(value: string): boolean {
  if (!DATE_KEY.test(value)) return false;
  const date = parseDateKey(value);
  return toDateKey(date) === value;
}

/** Legacy v1 UTC dates: shift +1 calendar day (same as Mac). */
function shiftDateKey(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function resolveDateKey(raw: string, legacyUTC: boolean): string | null {
  if (!isDateKey(raw)) return null;
  return legacyUTC ? shiftDateKey(raw, 1) : raw;
}

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([stringifySorted(data)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function dailyLogToExport(log: DailyLog) {
  const paresthesia = handParesthesia(log);
  return {
    date: log.date,
    healthValue: log.healthValue,
    note: log.note,
    hadB12Injection: log.hadB12Injection,
    medications: [...log.medications].sort((a, b) => a.localeCompare(b, "nb")),
    tinglingHands: paresthesia,
    burningPain: log.burningPain,
    numbness: log.numbness,
    balanceIssues: log.balanceIssues,
    brainFog: log.brainFog,
    headache: log.headache,
    hadMigraine: log.hadMigraine,
    mood: log.mood,
    irritability: log.mood,
    anxiety: log.burningPain,
    hadOrthostaticEpisode: log.hadOrthostaticEpisode,
    orthostaticSeverity: log.orthostaticSeverity,
    nausea: log.nausea,
    bloating: log.bloating,
    diarrhea: log.diarrhea,
    constipation: log.constipation,
    sleepHours: log.sleepHours,
    fatigue: log.fatigue,
    hrv: log.hrv,
    sleepScore: log.sleepScore,
    stressLevel: log.stressLevel,
    restingHeartRate: log.restingHeartRate,
    bodyBattery: log.bodyBattery,
    contextPoorSleep: log.contextPoorSleep,
    contextStress: log.contextStress,
    contextMenstruation: log.contextMenstruation,
    contextExercise: log.contextExercise,
    contextAlcohol: log.contextAlcohol,
    contextTravel: log.contextTravel,
    extraSymptoms: log.extraSymptoms ?? {},
  };
}

function parseDailyLogRecord(
  raw: unknown,
  legacyUTC: boolean,
  knownMedicationNames: Set<string>,
): DailyLog | null {
  const record = asRecord(raw);
  if (!record) return null;

  const date = resolveDateKey(asString(record.date), legacyUTC);
  const healthValue = asNumber(record.healthValue, NaN);
  if (!date || healthValue < 1 || healthValue > 10) return null;

  const numbness = asNumber(record.numbness);
  const decodedTingling = asNumber(record.tinglingHands);
  let burningPain = asNumber(record.burningPain);
  let mood = asNumber(record.mood);
  const irritability = asNumber(record.irritability);
  const anxiety = asNumber(record.anxiety);

  if (mood === 0 && irritability > 0) mood = irritability;
  if (burningPain === 0 && anxiety > 0) burningPain = anxiety;

  let diarrhea = asNumber(record.diarrhea);
  const constipation = asNumber(record.constipation);
  const stomachPain = asNumber(record.stomachPain);
  if (diarrhea === 0 && constipation === 0 && stomachPain > 0) {
    diarrhea = Math.min(stomachPain, 3);
  }

  const medications = asStringArray(record.medications)
    .map((name) => truncateText(name.trim(), IMPORT_LIMITS.maxNameChars))
    .filter((name) => knownMedicationNames.has(name))
    .slice(0, IMPORT_LIMITS.maxMedications)
    .sort((a, b) => a.localeCompare(b, "nb"));

  return {
    date,
    healthValue: Math.round(healthValue),
    note: truncateText(asString(record.note), IMPORT_LIMITS.maxNoteChars),
    hadB12Injection: asBool(record.hadB12Injection),
    medications,
    tinglingHands: Math.max(decodedTingling, numbness),
    numbness,
    balanceIssues: asNumber(record.balanceIssues),
    brainFog: asNumber(record.brainFog),
    mood,
    burningPain,
    headache: asNumber(record.headache),
    hadMigraine: asBool(record.hadMigraine),
    hadOrthostaticEpisode: asBool(record.hadOrthostaticEpisode),
    orthostaticSeverity: asNumber(record.orthostaticSeverity),
    nausea: asNumber(record.nausea),
    bloating: asNumber(record.bloating),
    diarrhea,
    constipation,
    sleepHours: asNumber(record.sleepHours),
    fatigue: asNumber(record.fatigue),
    hrv: asNumber(record.hrv),
    sleepScore: asNumber(record.sleepScore),
    stressLevel: asNumber(record.stressLevel),
    restingHeartRate: asNumber(record.restingHeartRate),
    bodyBattery: asNumber(record.bodyBattery),
    contextPoorSleep: asBool(record.contextPoorSleep),
    contextStress: asBool(record.contextStress),
    contextMenstruation: asBool(record.contextMenstruation),
    contextExercise: asBool(record.contextExercise),
    contextAlcohol: asBool(record.contextAlcohol),
    contextTravel: asBool(record.contextTravel),
    extraSymptoms: parseExtraSymptoms(record.extraSymptoms),
  };
}

function parseExtraSymptoms(raw: unknown): Record<string, number> {
  const record = asRecord(raw);
  if (!record) return {};
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(record)) {
    if (Object.keys(result).length >= IMPORT_LIMITS.maxExtraSymptomKeys) break;
    const safeKey = truncateText(key.trim(), IMPORT_LIMITS.maxNameChars);
    if (!safeKey || typeof value !== "number" || !Number.isFinite(value)) continue;
    result[safeKey] = value;
  }
  return result;
}

function parseSettings(raw: unknown): AppSettings | null {
  const record = asRecord(raw);
  if (!record) return null;

  const kind = asString(record.calendarDisplayKind, DEFAULT_SETTINGS.calendarDisplayKind);
  const allowed = ["healthScore", "symptom", "tracker", "medication"] as const;
  const calendarDisplayKind = allowed.includes(kind as (typeof allowed)[number])
    ? (kind as AppSettings["calendarDisplayKind"])
    : DEFAULT_SETTINGS.calendarDisplayKind;

  const enabledRaw = Array.isArray(record.enabledSymptoms)
    ? record.enabledSymptoms.filter((item): item is string => typeof item === "string")
    : undefined;

  return {
    b12IntervalDays: Math.max(1, Math.round(asNumber(record.b12IntervalDays, 7))),
    calendarDisplayKind,
    calendarDisplayItemName: asString(record.calendarDisplayItemName),
    enabledSymptoms: normalizeEnabledSymptoms(enabledRaw),
  };
}

export async function exportJsonBackup(): Promise<void> {
  const [dailyLogs, medications, trackers, trackerValues, labResults, settings] = await Promise.all([
    listDailyLogs(),
    listMedications(),
    listTrackers(),
    listTrackerValues(),
    listLabResults(),
    loadSettings(),
  ]);

  const payload = {
    exportFormatVersion: EXPORT_FORMAT_VERSION,
    dailyLogs: dailyLogs
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(dailyLogToExport),
    medications: medications
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "nb"))
      .map((med) => ({
        name: med.name,
        kind: med.kind,
        isActive: med.isActive,
      })),
    trackers: trackers
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "nb"))
      .map((tracker) => ({
        name: tracker.name,
        type: tracker.type,
        unit: tracker.unit,
        emoji: tracker.emoji,
        isActive: tracker.isActive,
      })),
    trackerValues: trackerValues
      .slice()
      .sort((a, b) => {
        const byDate = a.date.localeCompare(b.date);
        return byDate !== 0 ? byDate : a.trackerName.localeCompare(b.trackerName, "nb");
      })
      .map((value) => ({
        date: value.date,
        trackerName: value.trackerName,
        value: value.value,
      })),
    labResults: labResults
      .slice()
      .sort((a, b) => {
        const byDate = a.date.localeCompare(b.date);
        return byDate !== 0 ? byDate : a.testType.localeCompare(b.testType, "nb");
      })
      .map((lab) => ({
        date: lab.date,
        testType: lab.testType,
        value: lab.value,
        unit: lab.unit,
        note: lab.note,
      })),
    settings: settings ?? DEFAULT_SETTINGS,
  };

  downloadJson("helseapp-backup.json", payload);
}

export async function importJsonBackup(text: string, mode: ImportMode): Promise<ImportResult> {
  assertImportByteSize(new TextEncoder().encode(text).byteLength);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Filen inneholder ugyldige data.");
  }

  let exportPayload: RawExport;
  let legacyUTC = false;

  if (Array.isArray(parsed)) {
    assertArrayLength(parsed, IMPORT_LIMITS.maxDailyLogs, "dailyLogs");
    exportPayload = { exportFormatVersion: 1, dailyLogs: parsed };
    legacyUTC = true;
  } else {
    const record = asRecord(parsed);
    if (!record) throw new Error("Filen inneholder ugyldige data.");
    exportPayload = {
      exportFormatVersion: asNumber(record.exportFormatVersion, 1),
      dailyLogs: assertArrayLength(record.dailyLogs, IMPORT_LIMITS.maxDailyLogs, "dailyLogs"),
      medications: assertArrayLength(
        record.medications,
        IMPORT_LIMITS.maxMedications,
        "medications",
      ),
      trackers: assertArrayLength(record.trackers, IMPORT_LIMITS.maxTrackers, "trackers"),
      trackerValues: assertArrayLength(
        record.trackerValues,
        IMPORT_LIMITS.maxTrackerValues,
        "trackerValues",
      ),
      labResults: assertArrayLength(
        record.labResults,
        IMPORT_LIMITS.maxLabResults,
        "labResults",
      ),
      settings: record.settings,
    };
    const version = asNumber(exportPayload.exportFormatVersion, 1);
    legacyUTC = version < 2;
  }

  if (mode === "replace") {
    await clearAllAppData();
  }

  const existingMedications = await listMedications();
  const medicationsByName = new Map(existingMedications.map((med) => [med.name, med]));
  let newMedications = 0;

  for (const raw of exportPayload.medications ?? []) {
    const record = asRecord(raw);
    if (!record) continue;
    const name = truncateText(asString(record.name).trim(), IMPORT_LIMITS.maxNameChars);
    if (!name) continue;

    const kindRaw = asString(record.kind, "Tilskudd") as MedicationKind;
    const kind = MEDICATION_KINDS.includes(kindRaw) ? kindRaw : "Tilskudd";
    const isActive = asBool(record.isActive, true);
    const existing = medicationsByName.get(name);

    if (existing) {
      const updated: Medication = { ...existing, kind, isActive };
      await saveMedication(updated);
      medicationsByName.set(name, updated);
    } else {
      const created: Medication = {
        id: createId(),
        name,
        kind,
        isActive,
        createdAt: new Date().toISOString(),
      };
      await saveMedication(created);
      medicationsByName.set(name, created);
      newMedications += 1;
    }
  }

  const existingTrackers = await listTrackers();
  const trackersByName = new Map(existingTrackers.map((tracker) => [tracker.name, tracker]));
  let newTrackers = 0;

  for (const raw of exportPayload.trackers ?? []) {
    const record = asRecord(raw);
    if (!record) continue;
    const name = truncateText(asString(record.name).trim(), IMPORT_LIMITS.maxNameChars);
    if (!name) continue;

    const typeRaw = asString(record.type, "Tall") as TrackerType;
    const type = TRACKER_TYPES.includes(typeRaw) ? typeRaw : "Tall";
    const unit =
      type === "Tall" ? truncateText(asString(record.unit), IMPORT_LIMITS.maxUnitChars) : "";
    const emoji = Array.from(asString(record.emoji).trim()).slice(0, 2).join("");
    const isActive = asBool(record.isActive, true);
    const existing = trackersByName.get(name);

    if (existing) {
      const updated: Tracker = { ...existing, type, unit, emoji, isActive };
      await saveTracker(updated);
      trackersByName.set(name, updated);
    } else {
      const created: Tracker = {
        id: createId(),
        name,
        type,
        unit,
        emoji,
        isActive,
        createdAt: new Date().toISOString(),
      };
      await saveTracker(created);
      trackersByName.set(name, created);
      newTrackers += 1;
    }
  }

  let trackerValueCount = 0;
  for (const raw of exportPayload.trackerValues ?? []) {
    const record = asRecord(raw);
    if (!record) continue;
    const date = resolveDateKey(asString(record.date), legacyUTC);
    const trackerName = truncateText(
      asString(record.trackerName).trim(),
      IMPORT_LIMITS.maxNameChars,
    );
    const tracker = trackersByName.get(trackerName);
    if (!date || !tracker) continue;

    await saveTrackerValue({
      id: `${date}|${trackerName}`,
      date,
      trackerName,
      value: clampTrackerValue(tracker.type, asNumber(record.value)),
    });
    trackerValueCount += 1;
  }

  let newLabs = 0;
  const existingLabs = await listLabResults();
  const labsByKey = new Map(existingLabs.map((lab) => [`${lab.date}|${lab.testType}`, lab]));

  for (const raw of exportPayload.labResults ?? []) {
    const record = asRecord(raw);
    if (!record) continue;
    const date = resolveDateKey(asString(record.date), legacyUTC);
    if (!date) continue;

    const testTypeRaw = asString(record.testType, "B12") as LabTestType;
    const testType = LAB_TEST_TYPES.includes(testTypeRaw) ? testTypeRaw : "B12";
    const key = `${date}|${testType}`;
    const existing = labsByKey.get(key);
    const next: LabResult = {
      id: key,
      date,
      testType,
      value: asNumber(record.value),
      unit: truncateText(asString(record.unit), IMPORT_LIMITS.maxUnitChars),
      note: truncateText(asString(record.note), IMPORT_LIMITS.maxNoteChars),
    };

    await saveLabResult(next);
    if (!existing) newLabs += 1;
    labsByKey.set(key, next);
  }

  const settings = parseSettings(exportPayload.settings);
  if (settings) {
    await saveSettings(settings);
  }

  const knownMedicationNames = new Set(medicationsByName.keys());
  let dailyLogCount = 0;

  for (const raw of exportPayload.dailyLogs ?? []) {
    const log = parseDailyLogRecord(raw, legacyUTC, knownMedicationNames);
    if (!log) continue;
    await saveDailyLog(log);
    dailyLogCount += 1;
  }

  return {
    dailyLogs: dailyLogCount,
    medications: newMedications,
    trackers: newTrackers,
    trackerValues: trackerValueCount,
    labResults: newLabs,
  };
}

export function formatImportSummary(result: ImportResult): string {
  return `Importerte ${result.dailyLogs} dagslogger, ${result.medications} medisiner, ${result.trackers} trackere, ${result.trackerValues} tracker-verdier og ${result.labResults} blodprøver.`;
}
