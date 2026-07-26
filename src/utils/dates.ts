const nbDate = new Intl.DateTimeFormat("nb-NO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const nbMonthYear = new Intl.DateTimeFormat("nb-NO", {
  month: "long",
  year: "numeric",
});

/** Lokal kalenderdato YYYY-MM-DD (ikke UTC). */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function formatMonthYear(date: Date): string {
  return nbMonthYear.format(date);
}

export function formatDayHeading(date: Date): string {
  const raw = nbDate.format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Mandag først (nb-NO). */
export function weekdaySymbols(): string[] {
  const formatter = new Intl.DateTimeFormat("nb-NO", { weekday: "short" });
  // 2024-01-01 is Monday
  return Array.from({ length: 7 }, (_, i) => {
    const label = formatter.format(new Date(2024, 0, 1 + i));
    return label.replace(/\.$/, "");
  });
}

export function daysInMonthGrid(month: Date): (Date | null)[] {
  const first = startOfMonth(month);
  const year = first.getFullYear();
  const monthIndex = first.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  // Monday = 0 … Sunday = 6
  const leadingBlanks = (first.getDay() + 6) % 7;

  const cells: (Date | null)[] = Array.from({ length: leadingBlanks }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, monthIndex, day));
  }
  return cells;
}
