import { normalizeEnabledSymptoms } from "../symptoms/catalog";
import {
  DEFAULT_LAB_ANALYSES,
  DEFAULT_SETTINGS,
  createId,
  labResultId,
  normalizeDailyLog,
  trackerValueId,
  type AppSettings,
  type DailyLog,
  type LabAnalysis,
  type LabResult,
  type Medication,
  type Tracker,
  type TrackerValue,
} from "../types";

const DB_NAME = "helseapp-web";
const DB_VERSION = 4;

type StoreName =
  | "dailyLogs"
  | "settings"
  | "medications"
  | "trackers"
  | "trackerValues"
  | "labResults"
  | "labAnalyses";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("dailyLogs")) {
        db.createObjectStore("dailyLogs", { keyPath: "date" });
      }

      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains("medications")) {
        db.createObjectStore("medications", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("trackers")) {
        db.createObjectStore("trackers", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("trackerValues")) {
        const store = db.createObjectStore("trackerValues", { keyPath: "id" });
        store.createIndex("byDate", "date", { unique: false });
        store.createIndex("byTrackerName", "trackerName", { unique: false });
      }

      if (!db.objectStoreNames.contains("labResults")) {
        db.createObjectStore("labResults", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("labAnalyses")) {
        db.createObjectStore("labAnalyses", { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Kunne ikke åpne database"));
  });
}

async function withStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = run(store);

    transaction.oncomplete = () => {
      if (request instanceof IDBRequest) {
        resolve(request.result);
      } else {
        resolve(undefined);
      }
    };

    transaction.onerror = () => reject(transaction.error ?? new Error("Database-feil"));
  });
}

async function withStores(
  storeNames: StoreName[],
  mode: IDBTransactionMode,
  run: (stores: Record<StoreName, IDBObjectStore>) => void,
): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    const stores = Object.fromEntries(
      storeNames.map((name) => [name, transaction.objectStore(name)]),
    ) as Record<StoreName, IDBObjectStore>;

    run(stores);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Database-feil"));
  });
}

// ——— Daily logs ———

export async function saveDailyLog(log: DailyLog): Promise<void> {
  await withStore("dailyLogs", "readwrite", (store) => store.put(normalizeDailyLog(log)));
}

export async function getDailyLog(date: string): Promise<DailyLog | undefined> {
  const log = await withStore<DailyLog>("dailyLogs", "readonly", (store) => store.get(date));
  return log ? normalizeDailyLog(log) : undefined;
}

export async function listDailyLogs(): Promise<DailyLog[]> {
  const logs = await withStore<DailyLog[]>("dailyLogs", "readonly", (store) => store.getAll());
  return (logs ?? []).map((log) => normalizeDailyLog(log));
}

export async function deleteDailyLog(date: string): Promise<void> {
  await withStores(["dailyLogs", "trackerValues"], "readwrite", (stores) => {
    stores.dailyLogs.delete(date);
    const index = stores.trackerValues.index("byDate");
    const request = index.openCursor(IDBKeyRange.only(date));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
  });
}

// ——— Settings ———

export async function saveSettings(settings: AppSettings): Promise<void> {
  await withStore("settings", "readwrite", (store) =>
    store.put({ key: "app", value: settings }),
  );
}

export async function loadSettings(): Promise<AppSettings | undefined> {
  const record = await withStore<{ key: string; value: Partial<AppSettings> }>(
    "settings",
    "readonly",
    (store) => store.get("app"),
  );

  if (!record?.value) return undefined;

  return {
    ...DEFAULT_SETTINGS,
    ...record.value,
    enabledSymptoms: normalizeEnabledSymptoms(record.value.enabledSymptoms),
  };
}

// ——— Medications ———

export async function listMedications(): Promise<Medication[]> {
  const items = await withStore<Medication[]>("medications", "readonly", (store) => store.getAll());
  return (items ?? []).sort((a, b) => a.name.localeCompare(b.name, "nb"));
}

export async function listActiveMedications(): Promise<Medication[]> {
  return (await listMedications()).filter((item) => item.isActive);
}

export async function saveMedication(medication: Medication): Promise<void> {
  await withStore("medications", "readwrite", (store) => store.put(medication));
}

export async function deleteMedication(id: string): Promise<void> {
  await withStore("medications", "readwrite", (store) => store.delete(id));
}

export async function renameMedicationInLogs(oldName: string, newName: string): Promise<void> {
  if (oldName === newName) return;

  const logs = await listDailyLogs();
  await withStore("dailyLogs", "readwrite", (store) => {
    for (const log of logs) {
      if (!log.medications.includes(oldName)) continue;
      const next = {
        ...log,
        medications: Array.from(
          new Set(log.medications.map((name) => (name === oldName ? newName : name))),
        ).sort((a, b) => a.localeCompare(b, "nb")),
      };
      store.put(normalizeDailyLog(next));
    }
  });
}

// ——— Trackers ———

export async function listTrackers(): Promise<Tracker[]> {
  const items = await withStore<Tracker[]>("trackers", "readonly", (store) => store.getAll());
  return (items ?? []).sort((a, b) => a.name.localeCompare(b.name, "nb"));
}

export async function listActiveTrackers(): Promise<Tracker[]> {
  return (await listTrackers()).filter((item) => item.isActive);
}

export async function saveTracker(tracker: Tracker): Promise<void> {
  await withStore("trackers", "readwrite", (store) => store.put(tracker));
}

export async function deleteTracker(id: string, trackerName: string): Promise<void> {
  await withStores(["trackers", "trackerValues"], "readwrite", (stores) => {
    stores.trackers.delete(id);
    const index = stores.trackerValues.index("byTrackerName");
    const request = index.openCursor(IDBKeyRange.only(trackerName));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
  });
}

export async function renameTrackerValues(oldName: string, newName: string): Promise<void> {
  if (oldName === newName) return;

  const values = await listTrackerValues();
  await withStore("trackerValues", "readwrite", (store) => {
    for (const value of values) {
      if (value.trackerName !== oldName) continue;
      store.delete(value.id);
      const next: TrackerValue = {
        ...value,
        id: trackerValueId(value.date, newName),
        trackerName: newName,
      };
      store.put(next);
    }
  });
}

// ——— Tracker values ———

export async function listTrackerValues(): Promise<TrackerValue[]> {
  const items = await withStore<TrackerValue[]>("trackerValues", "readonly", (store) =>
    store.getAll(),
  );
  return items ?? [];
}

export async function listTrackerValuesForDate(date: string): Promise<TrackerValue[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("trackerValues", "readonly");
    const store = transaction.objectStore("trackerValues");
    const index = store.index("byDate");
    const request = index.getAll(IDBKeyRange.only(date));

    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error ?? new Error("Kunne ikke hente tracker-verdier"));
  });
}

export async function saveTrackerValue(value: TrackerValue): Promise<void> {
  await withStore("trackerValues", "readwrite", (store) =>
    store.put({
      ...value,
      id: trackerValueId(value.date, value.trackerName),
    }),
  );
}

export async function deleteTrackerValue(date: string, trackerName: string): Promise<void> {
  await withStore("trackerValues", "readwrite", (store) =>
    store.delete(trackerValueId(date, trackerName)),
  );
}

export async function replaceTrackerValuesForDate(
  date: string,
  values: Array<{ trackerName: string; value: number }>,
): Promise<void> {
  const existing = await listTrackerValuesForDate(date);

  await withStore("trackerValues", "readwrite", (store) => {
    for (const item of existing) {
      store.delete(item.id);
    }

    for (const value of values) {
      store.put({
        id: trackerValueId(date, value.trackerName),
        date,
        trackerName: value.trackerName,
        value: value.value,
      } satisfies TrackerValue);
    }
  });
}

// ——— Lab analyses ———

async function listLabAnalysesRaw(): Promise<LabAnalysis[]> {
  const items = await withStore<LabAnalysis[]>("labAnalyses", "readonly", (store) => store.getAll());
  return (items ?? []).sort((a, b) => a.name.localeCompare(b.name, "nb"));
}

/** Lister lagrede analyser uten å fylle inn standardkatalog. */
export async function listStoredLabAnalyses(): Promise<LabAnalysis[]> {
  return listLabAnalysesRaw();
}

export async function listLabAnalyses(): Promise<LabAnalysis[]> {
  const existing = await listLabAnalysesRaw();
  if (existing.length > 0) return existing;

  const seeded: LabAnalysis[] = DEFAULT_LAB_ANALYSES.map((item) => ({
    id: createId(),
    name: item.name,
    unit: item.unit,
    isActive: true,
    createdAt: new Date().toISOString(),
  }));

  await withStore("labAnalyses", "readwrite", (store) => {
    for (const analysis of seeded) store.put(analysis);
  });

  return seeded.sort((a, b) => a.name.localeCompare(b.name, "nb"));
}

export async function listActiveLabAnalyses(): Promise<LabAnalysis[]> {
  return (await listLabAnalyses()).filter((item) => item.isActive);
}

export async function saveLabAnalysis(analysis: LabAnalysis): Promise<void> {
  await withStore("labAnalyses", "readwrite", (store) => store.put(analysis));
}

export async function deleteLabAnalysis(id: string): Promise<void> {
  await withStore("labAnalyses", "readwrite", (store) => store.delete(id));
}

export async function renameLabResults(oldName: string, newName: string): Promise<void> {
  if (oldName === newName) return;

  const results = await listLabResults();
  await withStore("labResults", "readwrite", (store) => {
    for (const result of results) {
      if (result.testType !== oldName) continue;
      store.delete(result.id);
      store.put({
        ...result,
        id: labResultId(result.date, newName),
        testType: newName,
      } satisfies LabResult);
    }
  });
}

export async function ensureLabAnalysisForName(name: string, unit = ""): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const analyses = await listLabAnalysesRaw();
  if (analyses.some((item) => item.name === trimmed)) return;
  await saveLabAnalysis({
    id: createId(),
    name: trimmed,
    unit,
    isActive: true,
    createdAt: new Date().toISOString(),
  });
}

// ——— Lab results ———

export async function listLabResults(): Promise<LabResult[]> {
  const items = await withStore<LabResult[]>("labResults", "readonly", (store) => store.getAll());
  return (items ?? []).sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    return byDate !== 0 ? byDate : a.testType.localeCompare(b.testType, "nb");
  });
}

export async function saveLabResult(result: LabResult): Promise<void> {
  await withStore("labResults", "readwrite", (store) =>
    store.put({
      ...result,
      id: labResultId(result.date, result.testType),
    }),
  );
}

export async function deleteLabResult(id: string): Promise<void> {
  await withStore("labResults", "readwrite", (store) => store.delete(id));
}

export async function clearAllAppData(): Promise<void> {
  await withStores(
    [
      "labResults",
      "labAnalyses",
      "trackerValues",
      "dailyLogs",
      "trackers",
      "medications",
      "settings",
    ],
    "readwrite",
    (stores) => {
      stores.labResults.clear();
      stores.labAnalyses.clear();
      stores.trackerValues.clear();
      stores.dailyLogs.clear();
      stores.trackers.clear();
      stores.medications.clear();
      stores.settings.clear();
    },
  );
}

export async function getStorageSummary(): Promise<{
  logCount: number;
  medicationCount: number;
  trackerCount: number;
  hasSettings: boolean;
}> {
  const [logs, medications, trackers, settings] = await Promise.all([
    listDailyLogs(),
    listMedications(),
    listTrackers(),
    loadSettings(),
  ]);

  return {
    logCount: logs.length,
    medicationCount: medications.length,
    trackerCount: trackers.length,
    hasSettings: Boolean(settings),
  };
}
