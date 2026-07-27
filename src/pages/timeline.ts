import { b12CompactTitle, currentB12Status, daysSinceLastInjection } from "../b12/status";
import {
  getDailyLog,
  listDailyLogs,
  listLabResults,
  loadSettings,
} from "../storage/localStore";
import { DEFAULT_SETTINGS, type DailyLog, type LabResult } from "../types";
import { openDayDetail } from "./dayDetail";

type TimelineFilter = "all" | "b12" | "labs" | "notes" | "context" | "lowScore";

type TimelineEvent =
  | { kind: "b12"; date: string; log: DailyLog }
  | { kind: "labs"; date: string; labs: LabResult[] }
  | { kind: "note"; date: string; note: string; healthValue: number }
  | {
      kind: "context";
      date: string;
      flags: string[];
      healthValue: number;
    }
  | { kind: "lowScore"; date: string; healthValue: number; note: string };

const CONTEXT_LABELS: Array<{ key: keyof DailyLog; label: string }> = [
  { key: "contextPoorSleep", label: "Dårlig søvn" },
  { key: "contextStress", label: "Stress" },
  { key: "contextExercise", label: "Trening" },
  { key: "contextAlcohol", label: "Alkohol" },
  { key: "contextTravel", label: "Reise" },
];

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDay(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(year, month - 1, day));
}

function formatMonthHeading(dateKey: string): string {
  const [year, month] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("nb-NO", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function formatLabValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1).replace(".", ",");
}

function contextFlags(log: DailyLog): string[] {
  return CONTEXT_LABELS.filter((item) => Boolean(log[item.key])).map((item) => item.label);
}

function buildEvents(logs: DailyLog[], labs: LabResult[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const labsByDate = new Map<string, LabResult[]>();

  for (const lab of labs) {
    const list = labsByDate.get(lab.date) ?? [];
    list.push(lab);
    labsByDate.set(lab.date, list);
  }

  for (const [date, dayLabs] of labsByDate) {
    events.push({ kind: "labs", date, labs: dayLabs });
  }

  for (const log of logs) {
    if (log.hadB12Injection) {
      events.push({ kind: "b12", date: log.date, log });
    }

    const note = log.note.trim();
    if (note) {
      events.push({ kind: "note", date: log.date, note, healthValue: log.healthValue });
    }

    const flags = contextFlags(log);
    if (flags.length > 0) {
      events.push({
        kind: "context",
        date: log.date,
        flags,
        healthValue: log.healthValue,
      });
    }

    if (log.healthValue <= 4) {
      events.push({
        kind: "lowScore",
        date: log.date,
        healthValue: log.healthValue,
        note,
      });
    }
  }

  return events.sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return eventRank(a) - eventRank(b);
  });
}

function eventRank(event: TimelineEvent): number {
  switch (event.kind) {
    case "b12":
      return 0;
    case "labs":
      return 1;
    case "lowScore":
      return 2;
    case "note":
      return 3;
    case "context":
      return 4;
  }
}

function matchesFilter(event: TimelineEvent, filter: TimelineFilter): boolean {
  if (filter === "all") return true;
  if (filter === "b12") return event.kind === "b12";
  if (filter === "labs") return event.kind === "labs";
  if (filter === "notes") return event.kind === "note";
  if (filter === "context") return event.kind === "context";
  return event.kind === "lowScore";
}

function eventCard(event: TimelineEvent): string {
  const meta = `<time datetime="${escapeHtml(event.date)}">${escapeHtml(formatDay(event.date))}</time>`;

  if (event.kind === "b12") {
    return `
      <button type="button" class="timeline-card tint-purple" data-date="${escapeHtml(event.date)}">
        <span class="timeline-dot" aria-hidden="true"></span>
        <div class="timeline-card-body">
          <div class="timeline-card-top">
            <span class="timeline-kind">B12-injeksjon</span>
            ${meta}
          </div>
          <p class="timeline-title">Injeksjon registrert</p>
          <p class="timeline-detail">Helsescore ${event.log.healthValue}/10</p>
        </div>
      </button>
    `;
  }

  if (event.kind === "labs") {
    const lines = event.labs
      .map(
        (lab) =>
          `<li><strong>${escapeHtml(lab.testType)}</strong> ${escapeHtml(formatLabValue(lab.value))} ${escapeHtml(lab.unit)}${
            lab.note ? ` · ${escapeHtml(lab.note)}` : ""
          }</li>`,
      )
      .join("");
    return `
      <button type="button" class="timeline-card tint-teal" data-date="${escapeHtml(event.date)}">
        <span class="timeline-dot" aria-hidden="true"></span>
        <div class="timeline-card-body">
          <div class="timeline-card-top">
            <span class="timeline-kind">Blodprøve</span>
            ${meta}
          </div>
          <p class="timeline-title">${event.labs.length === 1 ? escapeHtml(event.labs[0]!.testType) : `${event.labs.length} analyser`}</p>
          <ul class="timeline-lab-list">${lines}</ul>
        </div>
      </button>
    `;
  }

  if (event.kind === "note") {
    return `
      <button type="button" class="timeline-card tint-blue" data-date="${escapeHtml(event.date)}">
        <span class="timeline-dot" aria-hidden="true"></span>
        <div class="timeline-card-body">
          <div class="timeline-card-top">
            <span class="timeline-kind">Notat</span>
            ${meta}
          </div>
          <p class="timeline-title">${escapeHtml(event.note.slice(0, 120))}${event.note.length > 120 ? "…" : ""}</p>
          <p class="timeline-detail">Helsescore ${event.healthValue}/10</p>
        </div>
      </button>
    `;
  }

  if (event.kind === "context") {
    return `
      <button type="button" class="timeline-card tint-orange" data-date="${escapeHtml(event.date)}">
        <span class="timeline-dot" aria-hidden="true"></span>
        <div class="timeline-card-body">
          <div class="timeline-card-top">
            <span class="timeline-kind">Livshendelse</span>
            ${meta}
          </div>
          <p class="timeline-title">${escapeHtml(event.flags.join(" · "))}</p>
          <p class="timeline-detail">Helsescore ${event.healthValue}/10</p>
        </div>
      </button>
    `;
  }

  return `
    <button type="button" class="timeline-card tint-red" data-date="${escapeHtml(event.date)}">
      <span class="timeline-dot" aria-hidden="true"></span>
      <div class="timeline-card-body">
        <div class="timeline-card-top">
          <span class="timeline-kind">Lav helsescore</span>
          ${meta}
        </div>
        <p class="timeline-title">Score ${event.healthValue}/10</p>
        ${
          event.note
            ? `<p class="timeline-detail">${escapeHtml(event.note.slice(0, 100))}${event.note.length > 100 ? "…" : ""}</p>`
            : ""
        }
      </div>
    </button>
  `;
}

function groupByMonth(events: TimelineEvent[]): Array<{ monthKey: string; events: TimelineEvent[] }> {
  const groups: Array<{ monthKey: string; events: TimelineEvent[] }> = [];
  for (const event of events) {
    const monthKey = event.date.slice(0, 7);
    const last = groups.at(-1);
    if (last && last.monthKey === monthKey) {
      last.events.push(event);
    } else {
      groups.push({ monthKey, events: [event] });
    }
  }
  return groups;
}

function summaryMarkup(
  logs: DailyLog[],
  labs: LabResult[],
  intervalDays: number,
): string {
  const status = currentB12Status(logs, intervalDays);
  const daysSince = daysSinceLastInjection(logs);
  const lastInjection = logs
    .filter((log) => log.hadB12Injection)
    .map((log) => log.date)
    .sort()
    .at(-1);
  const latestLabs = labs.slice(0, 4);
  const injectionCount = logs.filter((log) => log.hadB12Injection).length;

  return `
    <section class="timeline-summary" aria-label="Behandlingsstatus">
      <article class="timeline-summary-card">
        <p class="timeline-summary-label">B12</p>
        <p class="timeline-summary-value">${escapeHtml(b12CompactTitle(status))}</p>
        <p class="timeline-summary-meta">
          ${
            lastInjection
              ? `Siste: ${escapeHtml(formatDay(lastInjection))} · ${injectionCount} totalt`
              : "Ingen injeksjoner ennå"
          }
          ${daysSince != null ? ` · Intervall ${intervalDays} dager` : ""}
        </p>
      </article>
      <article class="timeline-summary-card">
        <p class="timeline-summary-label">Blodprøver</p>
        <p class="timeline-summary-value">${labs.length} registrert</p>
        <p class="timeline-summary-meta">
          ${
            latestLabs.length === 0
              ? "Ingen prøver ennå"
              : latestLabs
                  .map((lab) => `${lab.testType} ${formatLabValue(lab.value)}`)
                  .join(" · ")
          }
        </p>
      </article>
    </section>
  `;
}

let activeFilter: TimelineFilter = "all";

/** Tidslinjeinnhold uten side-shell (brukes under Oversikt-fanen). */
export async function renderTimelinePanel(
  root: HTMLElement,
  onChanged: () => void,
): Promise<void> {
  const [logs, labs, settings] = await Promise.all([
    listDailyLogs(),
    listLabResults(),
    loadSettings(),
  ]);
  const intervalDays = settings?.b12IntervalDays ?? DEFAULT_SETTINGS.b12IntervalDays;
  const allEvents = buildEvents(logs, labs);
  const filtered = allEvents.filter((event) => matchesFilter(event, activeFilter));
  const groups = groupByMonth(filtered);

  const filters: Array<{ id: TimelineFilter; label: string }> = [
    { id: "all", label: "Alle" },
    { id: "b12", label: "B12" },
    { id: "labs", label: "Blodprøver" },
    { id: "notes", label: "Notater" },
    { id: "context", label: "Livshendelser" },
    { id: "lowScore", label: "Lav score" },
  ];

  root.innerHTML = `
    <div class="timeline-page">
      ${summaryMarkup(logs, labs, intervalDays)}

      <div class="timeline-filters" role="tablist" aria-label="Filtrer tidslinje">
        ${filters
          .map(
            (filter) => `
          <button
            type="button"
            class="timeline-filter ${activeFilter === filter.id ? "is-active" : ""}"
            data-filter="${filter.id}"
            role="tab"
            aria-selected="${activeFilter === filter.id}"
          >${filter.label}</button>
        `,
          )
          .join("")}
      </div>

      ${
        filtered.length === 0
          ? `
        <div class="empty-state">
          <h2>Ingen hendelser ennå</h2>
          <p>Når du logger B12, blodprøver, notater eller dager med lav score, dukker de opp her.</p>
        </div>
      `
          : `
        <div class="timeline">
          ${groups
            .map(
              (group) => `
            <section class="timeline-month">
              <h2 class="timeline-month-title">${escapeHtml(formatMonthHeading(`${group.monthKey}-01`))}</h2>
              <div class="timeline-rail">
                ${group.events.map(eventCard).join("")}
              </div>
            </section>
          `,
            )
            .join("")}
        </div>
      `
      }
    </div>
  `;

  root.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = (button.dataset.filter as TimelineFilter) || "all";
      void renderTimelinePanel(root, onChanged);
    });
  });

  root.querySelectorAll<HTMLButtonElement>(".timeline-card[data-date]").forEach((button) => {
    button.addEventListener("click", async () => {
      const dateKey = button.dataset.date;
      if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
      const existingLog = await getDailyLog(dateKey);
      await openDayDetail({
        dateKey,
        existingLog,
        onClose: () => {},
        onSaved: () => {
          onChanged();
        },
      });
    });
  });
}
