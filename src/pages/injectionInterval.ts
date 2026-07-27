import { listDailyLogs } from "../storage/localStore";
import type { DailyLog } from "../types";
import { formatPeriodLabel, resolvePeriod, type PeriodPreset } from "../trends/period";
import { healthScoreBackground } from "../utils/healthScoreColor";
import { parseDateKey, toDateKey } from "../utils/dates";

type IntervalPeriod = Extract<PeriodPreset, "threeMonths" | "sixMonths" | "twelveMonths">;
type ResponseView = "days" | "cycles" | "weeks";

let activePeriod: IntervalPeriod = "twelveMonths";
let activeView: ResponseView = "days";

const PERIODS: Array<{ id: IntervalPeriod; label: string }> = [
  { id: "threeMonths", label: "3 mnd" },
  { id: "sixMonths", label: "6 mnd" },
  { id: "twelveMonths", label: "12 mnd" },
];

const VIEWS: Array<{ id: ResponseView; label: string }> = [
  { id: "days", label: "Dager" },
  { id: "cycles", label: "Mellom sprøyter" },
  { id: "weeks", label: "Uker" },
];

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function dayDiff(start: string, end: string): number {
  const a = parseDateKey(start).getTime();
  const b = parseDateKey(end).getTime();
  return Math.max(0, Math.round((b - a) / (24 * 60 * 60 * 1000)));
}

function addDays(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function formatMonthTitle(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Intl.DateTimeFormat("nb-NO", {
    month: "long",
    year: "numeric",
  }).format(new Date(year!, month! - 1, 1));
}

function formatShortDate(dateKey: string, withYear = false): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" as const } : {}),
  }).format(new Date(year!, month! - 1, day));
}

function enumerateDates(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function injectionDates(logs: DailyLog[]): string[] {
  return logs
    .filter((log) => log.hadB12Injection)
    .map((log) => log.date)
    .sort((a, b) => a.localeCompare(b));
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function dayCell(options: {
  date: string;
  score: number | null;
  injection: boolean;
  size?: "sm" | "md";
}): string {
  const { date, score, injection, size = "sm" } = options;
  const bg = healthScoreBackground(score);
  const title =
    score == null
      ? `${formatShortDate(date)} · ingen logg`
      : `${formatShortDate(date)} · form ${score}/10${injection ? " · B12" : ""}`;

  return `
    <span
      class="resp-day ${size === "md" ? "is-md" : ""} ${injection ? "is-injection" : ""} ${score == null ? "is-empty" : ""}"
      style="background:${bg}"
      title="${escapeHtml(title)}"
    >
      ${injection ? `<span class="resp-day-mark" aria-hidden="true"></span>` : ""}
    </span>
  `;
}

function renderDaysView(
  dates: string[],
  logsByDate: Map<string, DailyLog>,
  injectionSet: Set<string>,
): string {
  const byMonth = new Map<string, string[]>();
  for (const date of dates) {
    const key = date.slice(0, 7);
    const list = byMonth.get(key) ?? [];
    list.push(date);
    byMonth.set(key, list);
  }

  return [...byMonth.entries()]
    .reverse()
    .map(([month, monthDates]) => {
      const firstWeekday = parseDateKey(monthDates[0]!).getDay();
      // Monday-based offset
      const pad = (firstWeekday + 6) % 7;
      const pads = Array.from({ length: pad }, () => `<span class="resp-day is-pad"></span>`).join(
        "",
      );

      return `
        <section class="resp-month">
          <h3>${escapeHtml(formatMonthTitle(month))}</h3>
          <div class="resp-weekday-labels" aria-hidden="true">
            <span>ma</span><span>ti</span><span>on</span><span>to</span><span>fr</span><span>lø</span><span>sø</span>
          </div>
          <div class="resp-month-grid">
            ${pads}
            ${monthDates
              .map((date) => {
                const log = logsByDate.get(date);
                return dayCell({
                  date,
                  score: log?.healthValue ?? null,
                  injection: injectionSet.has(date),
                });
              })
              .join("")}
          </div>
        </section>
      `;
    })
    .join("");
}

function renderCyclesView(
  injections: string[],
  logsByDate: Map<string, DailyLog>,
  periodEnd: string,
): string {
  if (injections.length === 0) {
    return `<div class="empty-state compact"><p>Ingen B12-injeksjoner i perioden.</p></div>`;
  }

  const cycles: Array<{ start: string; end: string }> = [];
  for (let i = 0; i < injections.length; i += 1) {
    const start = injections[i]!;
    const endExclusive = injections[i + 1] ?? addDays(periodEnd, 1);
    cycles.push({ start, end: addDays(endExclusive, -1) });
  }

  // Nyeste først — alle sykluser i valgt periode
  const ordered = cycles.slice().reverse();
  const spanYears = ordered.some((cycle) => cycle.start.slice(0, 4) !== periodEnd.slice(0, 4));

  return `
    <div class="resp-cycles">
      ${ordered
        .map((cycle) => {
          const length = dayDiff(cycle.start, cycle.end) + 1;
          const days = enumerateDates(cycle.start, cycle.end);
          const scores = days
            .map((date) => logsByDate.get(date)?.healthValue)
            .filter((value): value is number => value != null);
          const avg = average(scores);

          return `
            <article class="resp-cycle">
              <div class="resp-cycle-meta">
                <strong>${escapeHtml(formatShortDate(cycle.start, spanYears))}</strong>
                <span>${length} dager${avg != null ? ` · snitt ${avg.toFixed(1).replace(".", ",")}` : ""}</span>
              </div>
              <div class="resp-cycle-strip">
                ${days
                  .map((date, index) => {
                    const log = logsByDate.get(date);
                    return dayCell({
                      date,
                      score: log?.healthValue ?? null,
                      injection: index === 0,
                      size: "md",
                    });
                  })
                  .join("")}
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderWeeksView(
  dates: string[],
  logsByDate: Map<string, DailyLog>,
  injectionSet: Set<string>,
): string {
  type WeekBucket = { start: string; end: string; scores: number[]; injections: number };
  const weeks: WeekBucket[] = [];

  for (const date of dates) {
    const d = parseDateKey(date);
    const mondayOffset = (d.getDay() + 6) % 7;
    const monday = addDays(date, -mondayOffset);
    let week = weeks.find((item) => item.start === monday);
    if (!week) {
      week = { start: monday, end: addDays(monday, 6), scores: [], injections: 0 };
      weeks.push(week);
    }
    const log = logsByDate.get(date);
    if (log) week.scores.push(log.healthValue);
    if (injectionSet.has(date)) week.injections += 1;
  }

  // Nyeste uker øverst
  const ordered = weeks.slice().reverse();

  return `
    <div class="resp-weeks">
      ${ordered
        .map((week) => {
          const avg = average(week.scores);
          const bg = healthScoreBackground(avg == null ? null : Math.round(avg));
          const label = `${formatShortDate(week.start)} – ${formatShortDate(week.end)}`;
          return `
            <div class="resp-week" title="${escapeHtml(label)}">
              <div class="resp-week-bar" style="background:${bg}">
                ${
                  week.injections > 0
                    ? `<span class="resp-week-b12">${week.injections}× B12</span>`
                    : ""
                }
              </div>
              <div class="resp-week-meta">
                <span>${escapeHtml(formatShortDate(week.start))}</span>
                <strong>${avg == null ? "—" : avg.toFixed(1).replace(".", ",")}</strong>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function legendMarkup(): string {
  const samples = [2, 4, 6, 8, 10];
  return `
    <div class="resp-legend" aria-hidden="true">
      <span class="resp-legend-label">Dårlig</span>
      ${samples
        .map(
          (score) =>
            `<span class="resp-legend-swatch" style="background:${healthScoreBackground(score)}"></span>`,
        )
        .join("")}
      <span class="resp-legend-label">Bra</span>
      <span class="resp-legend-injection"><span class="resp-day-mark"></span> B12-sprøyte</span>
    </div>
  `;
}

/** Behandlingsrespons: farget tidslinje for form vs. injeksjoner. */
export async function renderInjectionIntervalPanel(root: HTMLElement): Promise<void> {
  const scrollY = window.scrollY;
  const logs = await listDailyLogs();
  const period = resolvePeriod(activePeriod, "", "")!;
  const dates = enumerateDates(period.start, period.end);
  const periodLogs = logs.filter((log) => log.date >= period.start && log.date <= period.end);
  const logsByDate = new Map(periodLogs.map((log) => [log.date, log]));
  const injections = injectionDates(periodLogs);
  const injectionSet = new Set(injections);

  let body = "";
  if (activeView === "days") {
    body = renderDaysView(dates, logsByDate, injectionSet);
  } else if (activeView === "cycles") {
    body = renderCyclesView(injections, logsByDate, period.end);
  } else {
    body = renderWeeksView(dates, logsByDate, injectionSet);
  }

  const leadByView: Record<ResponseView, string> = {
    days: "Hver rute er en dag. Grønt = god form, rødt = dårlig. Lilla prikk = B12. Se om fargen synker mellom sprøytene.",
    cycles:
      "Én stripe per sprøytesyklus. Jo mer fargen går mot rødt før neste sprøyte, jo mer tyder det på at intervallet er for langt — typisk behov for minst ukentlig.",
    weeks:
      "Hver linje er en uke. Fargen er snittformen. B12-merke viser uker med injeksjon. Sammenlign uker med og uten sprøyte.",
  };

  root.innerHTML = `
    <div class="interval-panel">
      <p class="interval-lead">${escapeHtml(leadByView[activeView])}</p>

      <div class="resp-controls">
        <div class="period-pills" role="tablist" aria-label="Periode">
          ${PERIODS.map(
            (item) => `
            <button
              type="button"
              class="period-pill ${activePeriod === item.id ? "is-selected" : ""}"
              data-interval-period="${item.id}"
            >${item.label}</button>
          `,
          ).join("")}
        </div>
        <div class="page-tabs resp-view-tabs" role="tablist" aria-label="Visning">
          ${VIEWS.map(
            (view) => `
            <button
              type="button"
              class="page-tab ${activeView === view.id ? "is-active" : ""}"
              data-resp-view="${view.id}"
              role="tab"
              aria-selected="${activeView === view.id}"
            >${view.label}</button>
          `,
          ).join("")}
        </div>
      </div>

      <p class="hint">${escapeHtml(formatPeriodLabel(period))} · ${injections.length} sprøyter</p>
      ${legendMarkup()}
      ${body}
    </div>
  `;

  root.querySelectorAll<HTMLButtonElement>("[data-interval-period]").forEach((button) => {
    button.addEventListener("click", () => {
      activePeriod = (button.dataset.intervalPeriod as IntervalPeriod) || "twelveMonths";
      void renderInjectionIntervalPanel(root).then(() => {
        window.scrollTo(0, scrollY);
      });
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-resp-view]").forEach((button) => {
    button.addEventListener("click", () => {
      activeView = (button.dataset.respView as ResponseView) || "days";
      void renderInjectionIntervalPanel(root).then(() => {
        window.scrollTo(0, scrollY);
      });
    });
  });

  requestAnimationFrame(() => {
    window.scrollTo(0, scrollY);
  });
}
