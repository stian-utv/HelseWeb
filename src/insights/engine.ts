import type { DailyLog } from "../types";
import { parseDateKey, toDateKey, weekdaySymbols } from "../utils/dates";

export type WeekDaySummary = {
  dateKey: string;
  weekdayLabel: string;
  log?: DailyLog;
};

export type HealthInsight = {
  id: string;
  tint: string;
  message: string;
};

function addDays(dateKey: string, delta: number): string {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + delta);
  return toDateKey(date);
}

function logsInRange(logs: DailyLog[], startKey: string, endKey: string): DailyLog[] {
  return logs.filter((log) => log.date >= startKey && log.date <= endKey);
}

function averageScore(logs: DailyLog[]): number {
  return logs.reduce((sum, log) => sum + log.healthValue, 0) / logs.length;
}

export function lastSevenDays(logs: DailyLog[], endingOn = new Date()): WeekDaySummary[] {
  const endKey = toDateKey(endingOn);
  const symbols = weekdaySymbols();
  const byDate = new Map(logs.map((log) => [log.date, log]));

  return Array.from({ length: 7 }, (_, offset) => {
    const dateKey = addDays(endKey, offset - 6);
    const date = parseDateKey(dateKey);
    const mondayIndex = (date.getDay() + 6) % 7;
    return {
      dateKey,
      weekdayLabel: symbols[mondayIndex].toUpperCase(),
      log: byDate.get(dateKey),
    };
  });
}

export function weekStats(days: WeekDaySummary[]): {
  loggedDays: number;
  averageScore: string;
  b12Count: number;
} {
  const weekLogs = days.map((day) => day.log).filter((log): log is DailyLog => Boolean(log));
  const loggedDays = weekLogs.length;
  const b12Count = weekLogs.filter((log) => log.hadB12Injection).length;
  if (weekLogs.length === 0) {
    return { loggedDays, averageScore: "–", b12Count };
  }
  const avg = averageScore(weekLogs);
  return {
    loggedDays,
    averageScore: avg.toFixed(1).replace(".", ","),
    b12Count,
  };
}

function appendSymptomInsight(
  results: HealthInsight[],
  logs: DailyLog[],
  id: string,
  label: string,
  tint: string,
  valueOf: (log: DailyLog) => number,
): void {
  const count = logs.filter((log) => valueOf(log) > 0).length;
  if (count < 3) return;
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
  results.push({
    id,
    tint,
    message: `${capitalized} registrert ${count} av siste ${logs.length} dager`,
  });
}

function appendContextComparison(
  results: HealthInsight[],
  logs: DailyLog[],
  id: string,
  label: string,
  tint: string,
  isMatch: (log: DailyLog) => boolean,
): void {
  const withContext = logs.filter(isMatch);
  const withoutContext = logs.filter((log) => !isMatch(log));
  if (withContext.length < 2 || withoutContext.length < 2) return;

  const avgWith = averageScore(withContext);
  const avgWithout = averageScore(withoutContext);
  if (Math.abs(avgWith - avgWithout) < 0.4) return;

  results.push({
    id,
    tint,
    message: `Snitt helsescore ${avgWith.toFixed(1).replace(".", ",")} med ${label} vs ${avgWithout
      .toFixed(1)
      .replace(".", ",")} uten (siste 30 dager)`,
  });
}

export function buildInsights(logs: DailyLog[]): HealthInsight[] {
  const today = toDateKey(new Date());
  const start30 = addDays(today, -29);
  const start14 = addDays(today, -13);
  const start7 = addDays(today, -6);

  const logs30 = logsInRange(logs, start30, today);
  const logs14 = logsInRange(logs, start14, today);
  const logs7 = logsInRange(logs, start7, today);

  if (logs30.length === 0) return [];

  const results: HealthInsight[] = [];

  if (logs7.length >= 2) {
    results.push({
      id: "registration",
      tint: "blue",
      message: `Registrert ${logs7.length} av siste 7 dager`,
    });
  }

  appendSymptomInsight(results, logs14, "headache", "hodepine", "red", (log) => log.headache);
  appendSymptomInsight(results, logs14, "fatigue", "utmattelse", "orange", (log) => log.fatigue);
  appendSymptomInsight(results, logs14, "brainFog", "hjernetåke", "teal", (log) => log.brainFog);
  appendSymptomInsight(results, logs14, "irritability", "irritasjon", "orange", (log) => log.irritability);

  appendContextComparison(
    results,
    logs30,
    "stress",
    "stress",
    "indigo",
    (log) => log.contextStress,
  );
  appendContextComparison(
    results,
    logs30,
    "poorSleep",
    "dårlig søvn",
    "purple",
    (log) => log.contextPoorSleep,
  );

  const lowDays = logs14.filter((log) => log.healthValue <= 4);
  if (lowDays.length >= 2) {
    results.push({
      id: "lowScore",
      tint: "pink",
      message: `${lowDays.length} dager med helsescore 4 eller lavere siste 14 dager`,
    });
  }

  return results.slice(0, 5);
}
