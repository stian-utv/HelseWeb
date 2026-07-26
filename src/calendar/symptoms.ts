import {
  enabledSymptomDefs,
  getSymptomValue,
  normalizeEnabledSymptoms,
  symptomById as catalogSymptomById,
  type SymptomDef,
} from "../symptoms/catalog";
import { storageAverageToUi, storageToUiScale } from "../symptoms/uiScale";
import type { DailyLog } from "../types";
import { giSymptomTint, healthScoreBackground, symptomTint } from "../utils/healthScoreColor";

export type CalendarSymptomId = string;

export type CalendarSymptom = {
  id: string;
  label: string;
  subtitle: string;
  tintClass: string;
  def: SymptomDef;
};

function subtitleFor(def: SymptomDef): string {
  if (def.kind === "sleepHours") return "Timer søvn per natt";
  if (def.kind === "gi3") return "Grad 0–3";
  if (def.kind === "bool") return "Ja/nei";
  return "Skala 0–5 med farge";
}

export function calendarSymptomsFromEnabled(enabledIds: string[]): CalendarSymptom[] {
  return enabledSymptomDefs(normalizeEnabledSymptoms(enabledIds))
    .filter((def) => def.kind !== "bool" || def.id === "migraine")
    .map((def) => ({
      id: def.id,
      label: def.label,
      subtitle: subtitleFor(def),
      tintClass: "custom",
      def,
    }));
}

export function symptomById(id: string): CalendarSymptom | undefined {
  const def = catalogSymptomById(id);
  if (!def) return undefined;
  return {
    id: def.id,
    label: def.label,
    subtitle: subtitleFor(def),
    tintClass: "custom",
    def,
  };
}

export function symptomNumericValue(id: string, log: DailyLog): number | null {
  const def = catalogSymptomById(id);
  if (!def) return null;

  if (def.id === "migraine" || def.kind === "bool") {
    const value = getSymptomValue(log, def);
    return value > 0 ? value : null;
  }

  if (def.id === "headache") {
    if (log.headache > 0) return log.headache;
    return log.hadMigraine ? 1 : null;
  }

  const value = getSymptomValue(log, def);
  return value > 0 ? value : null;
}

export function symptomCellLabel(id: string, log: DailyLog): string | null {
  const def = catalogSymptomById(id);
  if (!def) return null;

  if (def.id === "headache" && log.headache === 0 && log.hadMigraine) return "M";
  if (def.kind === "bool") return getSymptomValue(log, def) > 0 ? "Ja" : null;
  if (def.kind === "sleepHours") return log.sleepHours > 0 ? String(log.sleepHours) : null;
  if (def.kind === "gi3") {
    const value = getSymptomValue(log, def);
    return value > 0 ? String(value) : null;
  }

  const value = symptomNumericValue(id, log);
  if (value == null) return null;
  if (def.kind === "scale10") return String(storageToUiScale(value));
  return String(Math.round(value));
}

export function symptomCellBackground(id: string, log: DailyLog | undefined): string {
  if (!log) return "rgba(128, 128, 128, 0.15)";
  const def = catalogSymptomById(id);
  if (!def) return "rgba(128, 128, 128, 0.15)";

  if (def.kind === "gi3") return giSymptomTint(getSymptomValue(log, def));
  if (def.kind === "sleepHours") {
    if (log.sleepHours <= 0) return "rgba(128, 128, 128, 0.15)";
    const equivalent = Math.min(10, Math.max(1, Math.round((log.sleepHours / 14) * 10)));
    return healthScoreBackground(equivalent);
  }
  if (def.id === "headache" && log.headache === 0 && log.hadMigraine) {
    return symptomTint(5);
  }
  if (def.kind === "bool") {
    return getSymptomValue(log, def) > 0 ? symptomTint(6) : "rgba(128, 128, 128, 0.15)";
  }

  const value = symptomNumericValue(id, log);
  if (value == null) return "rgba(128, 128, 128, 0.15)";
  return symptomTint(Math.round(value));
}

export function formatSymptomAverage(id: string, logs: DailyLog[]): string {
  const values = logs
    .map((log) => symptomNumericValue(id, log))
    .filter((value): value is number => value != null);
  if (values.length === 0) return "–";
  const average = values.reduce((a, b) => a + b, 0) / values.length;
  const def = catalogSymptomById(id);
  if (def?.kind === "sleepHours") return `${average.toFixed(1).replace(".", ",")} t`;
  if (def?.kind === "scale10") {
    return storageAverageToUi(average).toFixed(1).replace(".", ",");
  }
  return average.toFixed(1).replace(".", ",");
}

export function formatSymptomRange(id: string, logs: DailyLog[]): string {
  const values = logs
    .map((log) => symptomNumericValue(id, log))
    .filter((value): value is number => value != null);
  if (values.length === 0) return "–";
  const low = Math.min(...values);
  const high = Math.max(...values);
  const def = catalogSymptomById(id);
  if (def?.kind === "sleepHours") {
    const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));
    return low === high ? `${fmt(low)} t` : `${fmt(low)} – ${fmt(high)} t`;
  }
  if (def?.kind === "scale10") {
    const uiLow = storageToUiScale(low);
    const uiHigh = storageToUiScale(high);
    return uiLow === uiHigh ? String(uiLow) : `${uiLow} – ${uiHigh}`;
  }
  if (low === high) return String(Math.round(low));
  return `${Math.round(low)} – ${Math.round(high)}`;
}
