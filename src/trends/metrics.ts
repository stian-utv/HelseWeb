import {
  enabledSymptomDefs,
  getSymptomValue,
  normalizeEnabledSymptoms,
  type SymptomDef,
} from "../symptoms/catalog";
import { storageToUiScale } from "../symptoms/uiScale";
import { handParesthesia, type DailyLog, type Medication, type Tracker, type TrackerValue } from "../types";

export type MetricGroup = "wellness" | "treatment";

export type ChartMetric = {
  id: string;
  label: string;
  group: MetricGroup;
  color: string;
  plotsAsEventMarker: boolean;
  legendScaleNote?: string;
};

const TRACKER_COLORS = ["#ff2d55", "#00c7be", "#32ade6", "#ffd60a", "#8e8e93"];
const MEDICATION_COLORS = ["#32ade6", "#ff2d55", "#00c7be", "#ffd60a", "#5856d6", "#ff9500"];

function hashHue(name: string, palette: string[]): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

function metricFromSymptom(def: SymptomDef): ChartMetric {
  return {
    id: def.id,
    label: def.label,
    group: "wellness",
    color: def.color,
    plotsAsEventMarker: def.kind === "bool",
    legendScaleNote:
      def.kind === "sleepHours"
        ? "Skaleres fra timer (0–14) til 0–10."
        : def.kind === "gi3"
          ? "Skaleres fra 0–3 til 0–10."
          : def.kind === "scale10"
            ? "Logges som 0–5; sammenlignes internt på 0–10."
            : undefined,
  };
}

export function buildMetrics(
  trackers: Tracker[],
  medications: Medication[],
  enabledSymptomIds: string[],
): ChartMetric[] {
  const symptoms = enabledSymptomDefs(normalizeEnabledSymptoms(enabledSymptomIds)).map(
    metricFromSymptom,
  );

  const trackerMetrics = trackers
    .filter((tracker) => tracker.isActive)
    .map(
      (tracker): ChartMetric => ({
        id: `tracker-${tracker.name}`,
        label: tracker.name,
        group: "wellness",
        color: hashHue(tracker.name, TRACKER_COLORS),
        plotsAsEventMarker: false,
      }),
    );

  const treatment: ChartMetric[] = [
    {
      id: "b12Injection",
      label: "B12-injeksjon",
      group: "treatment",
      color: "#af52de",
      plotsAsEventMarker: true,
    },
    ...medications
      .filter((med) => med.isActive)
      .map(
        (med): ChartMetric => ({
          id: `medication-${med.name}`,
          label: med.name,
          group: "treatment",
          color: hashHue(med.name, MEDICATION_COLORS),
          plotsAsEventMarker: true,
        }),
      ),
  ];

  return [
    {
      id: "healthScore",
      label: "Helsescore",
      group: "wellness",
      color: "#34c759",
      plotsAsEventMarker: false,
    },
    ...symptoms,
    ...trackerMetrics,
    ...treatment,
  ];
}

export type ChartPoint = {
  date: string;
  normalized: number;
  rawDescription: string;
};

export function normalizedValue(
  metric: ChartMetric,
  log: DailyLog,
  trackerValues: TrackerValue[],
  trackersByName: Map<string, Tracker>,
  symptomDefs: Map<string, SymptomDef>,
): ChartPoint | null {
  const date = log.date;

  if (metric.id === "healthScore") {
    return { date, normalized: log.healthValue, rawDescription: String(log.healthValue) };
  }

  if (metric.id === "b12Injection") {
    return log.hadB12Injection
      ? { date, normalized: 10, rawDescription: "Injeksjon" }
      : null;
  }

  if (metric.id.startsWith("medication-")) {
    const name = metric.id.slice("medication-".length);
    return log.medications.includes(name)
      ? { date, normalized: 10, rawDescription: "Tatt" }
      : null;
  }

  if (metric.id.startsWith("tracker-")) {
    const name = metric.id.slice("tracker-".length);
    const tracker = trackersByName.get(name);
    const value = trackerValues.find((item) => item.date === date && item.trackerName === name);
    if (!tracker || !value) return null;
    if (tracker.type === "Ja/nei") {
      return value.value >= 1 ? { date, normalized: 10, rawDescription: "Ja" } : null;
    }
    if (tracker.type === "Skala") {
      return { date, normalized: value.value, rawDescription: String(value.value) };
    }
    return {
      date,
      normalized: Math.min(value.value, 10),
      rawDescription: tracker.unit ? `${value.value} ${tracker.unit}` : String(value.value),
    };
  }

  const def = symptomDefs.get(metric.id);
  if (!def) return null;

  if (def.kind === "bool") {
    const on = getSymptomValue(log, def) > 0;
    return on ? { date, normalized: 10, rawDescription: "Ja" } : null;
  }

  const raw = getSymptomValue(log, def);
  if (raw <= 0) return null;

  if (def.kind === "sleepHours") {
    return {
      date,
      normalized: (raw / 14) * 10,
      rawDescription: `${raw} t`,
    };
  }

  if (def.kind === "gi3") {
    return {
      date,
      normalized: (raw / 3) * 10,
      rawDescription: raw === 1 ? "Lett" : raw === 2 ? "Moderat" : "Kraftig",
    };
  }

  // handParesthesia uses max of fields
  if (def.id === "handParesthesia") {
    const value = handParesthesia(log);
    return value > 0
      ? { date, normalized: value, rawDescription: String(storageToUiScale(value)) }
      : null;
  }

  if (def.kind === "scale10") {
    return {
      date,
      normalized: raw,
      rawDescription: String(storageToUiScale(raw)),
    };
  }

  return { date, normalized: raw, rawDescription: String(raw) };
}

export const GROUP_LIMITS: Record<MetricGroup, number> = {
  wellness: 8,
  treatment: 5,
};

export const QUICK_PRESETS = {
  health: ["healthScore", "fatigue", "irritability"],
  neuro: ["healthScore", "handParesthesia", "brainFog", "headache"],
  medication: ["healthScore", "b12Injection"],
} as const;
