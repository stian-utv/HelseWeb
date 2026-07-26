import type { DailyLog } from "../types";
import { parseDateKey, toDateKey } from "../utils/dates";

export type B12Status =
  | { kind: "none" }
  | { kind: "onSchedule"; daysSince: number; intervalDays: number }
  | { kind: "overdue"; daysSince: number; intervalDays: number };

export function daysSinceLastInjection(logs: DailyLog[]): number | null {
  const dates = logs.filter((log) => log.hadB12Injection).map((log) => log.date);
  if (dates.length === 0) return null;

  const last = dates.sort().at(-1)!;
  const lastDate = parseDateKey(last);
  const today = parseDateKey(toDateKey(new Date()));
  const ms = today.getTime() - lastDate.getTime();
  return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)));
}

export function currentB12Status(logs: DailyLog[], intervalDays: number): B12Status {
  const daysSince = daysSinceLastInjection(logs);
  if (daysSince == null) return { kind: "none" };
  if (daysSince > intervalDays) {
    return { kind: "overdue", daysSince, intervalDays };
  }
  return { kind: "onSchedule", daysSince, intervalDays };
}

export function b12CompactTitle(status: B12Status): string {
  switch (status.kind) {
    case "none":
      return "Ingen B12-injeksjoner registrert ennå";
    case "onSchedule":
      return `Sist B12 for ${status.daysSince} dager siden`;
    case "overdue":
      return `B12 kan være forsinket · ${status.daysSince} dager siden`;
  }
}
