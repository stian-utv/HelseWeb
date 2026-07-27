import { b12CompactTitle, currentB12Status } from "../b12/status";
import { enabledSymptomDefs, getSymptomValue, normalizeEnabledSymptoms } from "../symptoms/catalog";
import { storageAverageToUi } from "../symptoms/uiScale";
import {
  listDailyLogs,
  listLabResults,
  loadSettings,
} from "../storage/localStore";
import { DEFAULT_SETTINGS, type DailyLog, type LabResult } from "../types";
import { formatPeriodLabel, resolvePeriod, type PeriodPreset } from "../trends/period";

type LongTermPeriod = Extract<PeriodPreset, "threeMonths" | "sixMonths" | "twelveMonths">;

let activePeriod: LongTermPeriod = "threeMonths";

const PERIODS: Array<{ id: LongTermPeriod; label: string }> = [
  { id: "threeMonths", label: "3 mnd" },
  { id: "sixMonths", label: "6 mnd" },
  { id: "twelveMonths", label: "12 mnd" },
];

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

function formatLabValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1).replace(".", ",");
}

function formatScore(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function daysBetweenInclusive(start: string, end: string): number {
  const a = new Date(`${start}T12:00:00`).getTime();
  const b = new Date(`${end}T12:00:00`).getTime();
  return Math.max(1, Math.round((b - a) / (24 * 60 * 60 * 1000)) + 1);
}

function dayDiff(start: string, end: string): number {
  const a = new Date(`${start}T12:00:00`).getTime();
  const b = new Date(`${end}T12:00:00`).getTime();
  return Math.max(0, Math.round((b - a) / (24 * 60 * 60 * 1000)));
}

function trendLabel(first: number | null, second: number | null): string {
  if (first == null || second == null) return "For lite data";
  const delta = second - first;
  if (Math.abs(delta) < 0.3) return "Stabilt";
  return delta > 0 ? `Opp ${formatScore(delta)}` : `Ned ${formatScore(Math.abs(delta))}`;
}

function sparkline(values: number[]): string {
  if (values.length === 0) {
    return `<div class="longterm-spark empty">Ingen helsescore i perioden</div>`;
  }

  const width = 320;
  const height = 72;
  const pad = 6;
  const min = Math.min(...values, 1);
  const max = Math.max(...values, 10);
  const span = Math.max(max - min, 1);

  const points = values.map((value, index) => {
    const x = pad + (index / Math.max(values.length - 1, 1)) * (width - pad * 2);
    const y = pad + (1 - (value - min) / span) * (height - pad * 2);
    return `${x},${y}`;
  });

  return `
    <svg class="longterm-spark" viewBox="0 0 ${width} ${height}" role="img" aria-label="Helsescore over perioden">
      <polyline
        fill="none"
        stroke="var(--indigo)"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        points="${points.join(" ")}"
      />
    </svg>
  `;
}

function labSeries(labs: LabResult[]): Array<{
  name: string;
  unit: string;
  latest: LabResult;
  previous?: LabResult;
  count: number;
}> {
  const byType = new Map<string, LabResult[]>();
  for (const lab of labs) {
    const list = byType.get(lab.testType) ?? [];
    list.push(lab);
    byType.set(lab.testType, list);
  }

  return [...byType.entries()]
    .map(([name, items]) => {
      const sorted = items.slice().sort((a, b) => a.date.localeCompare(b.date));
      const latest = sorted.at(-1)!;
      const previous = sorted.length > 1 ? sorted.at(-2) : undefined;
      return {
        name,
        unit: latest.unit,
        latest,
        previous,
        count: sorted.length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "nb"));
}

export async function renderLongTermPanel(root: HTMLElement): Promise<void> {
  const scrollY = window.scrollY;
  const [logs, labs, settings] = await Promise.all([
    listDailyLogs(),
    listLabResults(),
    loadSettings(),
  ]);

  const period = resolvePeriod(activePeriod, "", "")!;
  const periodLogs = logs
    .filter((log) => log.date >= period.start && log.date <= period.end)
    .sort((a, b) => a.date.localeCompare(b.date));
  const periodLabs = labs.filter((lab) => lab.date >= period.start && lab.date <= period.end);

  const intervalDays = settings?.b12IntervalDays ?? DEFAULT_SETTINGS.b12IntervalDays;
  const enabled = normalizeEnabledSymptoms(settings?.enabledSymptoms);
  const symptoms = enabledSymptomDefs(enabled).filter((item) => item.kind !== "bool");

  const scores = periodLogs.map((log) => log.healthValue);
  const avgScore = average(scores);
  const mid = Math.floor(periodLogs.length / 2);
  const firstHalf = average(periodLogs.slice(0, mid).map((log) => log.healthValue));
  const secondHalf = average(periodLogs.slice(mid).map((log) => log.healthValue));

  const spanDays = daysBetweenInclusive(period.start, period.end);
  const coverage = Math.round((periodLogs.length / spanDays) * 100);
  const injections = periodLogs.filter((log) => log.hadB12Injection);
  const lowDays = periodLogs.filter((log) => log.healthValue <= 4).length;
  const status = currentB12Status(logs, intervalDays);

  const injectionDates = injections.map((log) => log.date).sort();
  let avgInjectionGap: number | null = null;
  if (injectionDates.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < injectionDates.length; i += 1) {
      gaps.push(dayDiff(injectionDates[i - 1]!, injectionDates[i]!));
    }
    avgInjectionGap = average(gaps);
  }

  const symptomAverages = symptoms
    .map((symptom) => {
      const values = periodLogs
        .map((log) => getSymptomValue(log, symptom))
        .filter((value) => value > 0);
      const avg = average(values);
      return {
        label: symptom.label,
        color: symptom.color,
        avg,
        count: values.length,
        display:
          avg == null
            ? null
            : symptom.kind === "sleepHours"
              ? `${formatScore(avg)} t`
              : symptom.kind === "gi3"
                ? formatScore(avg)
                : formatScore(storageAverageToUi(avg)),
      };
    })
    .filter((item) => item.avg != null)
    .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
    .slice(0, 6);

  const contextCounts = CONTEXT_LABELS.map((item) => ({
    label: item.label,
    count: periodLogs.filter((log) => Boolean(log[item.key])).length,
  })).filter((item) => item.count > 0);

  const labsOverview = labSeries(periodLabs);

  root.innerHTML = `
    <div class="longterm-panel">
      <div class="period-pills" role="tablist" aria-label="Periode">
        ${PERIODS.map(
          (item) => `
          <button
            type="button"
            class="period-pill ${activePeriod === item.id ? "is-selected" : ""}"
            data-longterm-period="${item.id}"
          >${item.label}</button>
        `,
        ).join("")}
      </div>
      <p class="hint">Valgt periode: ${escapeHtml(formatPeriodLabel(period))}</p>

      <section class="longterm-stats" aria-label="Nøkkeltall">
        <article class="longterm-stat">
          <p class="longterm-stat-label">Snitt helsescore</p>
          <p class="longterm-stat-value">${avgScore == null ? "—" : formatScore(avgScore)}</p>
          <p class="longterm-stat-meta">${trendLabel(firstHalf, secondHalf)} siste halvdel</p>
        </article>
        <article class="longterm-stat">
          <p class="longterm-stat-label">Registrering</p>
          <p class="longterm-stat-value">${periodLogs.length} dager</p>
          <p class="longterm-stat-meta">${coverage}% av perioden · ${lowDays} med score ≤ 4</p>
        </article>
        <article class="longterm-stat">
          <p class="longterm-stat-label">B12</p>
          <p class="longterm-stat-value">${injections.length} inj.</p>
          <p class="longterm-stat-meta">
            ${
              avgInjectionGap == null
                ? escapeHtml(b12CompactTitle(status))
                : `Snittintervall ${formatScore(avgInjectionGap)} dager`
            }
          </p>
        </article>
        <article class="longterm-stat">
          <p class="longterm-stat-label">Blodprøver</p>
          <p class="longterm-stat-value">${periodLabs.length}</p>
          <p class="longterm-stat-meta">${labsOverview.length} ulike analyser</p>
        </article>
      </section>

      <section class="longterm-block">
        <h2>Helsescore</h2>
        ${sparkline(scores)}
        <p class="hint">Hver punkt er en registrert dag i perioden (eldst → nyest).</p>
      </section>

      <section class="longterm-block">
        <h2>Blodprøver i perioden</h2>
        ${
          labsOverview.length === 0
            ? `<p class="hint">Ingen blodprøver i dette tidsrommet.</p>`
            : `
          <div class="longterm-lab-grid">
            ${labsOverview
              .map((item) => {
                const delta =
                  item.previous != null ? item.latest.value - item.previous.value : null;
                const deltaText =
                  delta == null
                    ? "Første i perioden"
                    : delta === 0
                      ? "Uendret fra forrige"
                      : `${delta > 0 ? "+" : ""}${formatLabValue(delta)} fra forrige`;
                return `
                  <article class="longterm-lab-card">
                    <p class="longterm-stat-label">${escapeHtml(item.name)}</p>
                    <p class="longterm-stat-value">
                      ${escapeHtml(formatLabValue(item.latest.value))}
                      <span class="longterm-unit">${escapeHtml(item.unit)}</span>
                    </p>
                    <p class="longterm-stat-meta">${escapeHtml(deltaText)} · ${item.count} måling${item.count === 1 ? "" : "er"}</p>
                  </article>
                `;
              })
              .join("")}
          </div>
        `
        }
      </section>

      <section class="longterm-block">
        <h2>Symptomer (snitt når registrert)</h2>
        ${
          symptomAverages.length === 0
            ? `<p class="hint">Ingen symptomverdier over 0 i perioden.</p>`
            : `
          <div class="longterm-symptom-list">
            ${symptomAverages
              .map(
                (item) => `
              <div class="longterm-symptom-row">
                <span class="legend-dot" style="background:${item.color}"></span>
                <span>${escapeHtml(item.label)}</span>
                <strong>${escapeHtml(item.display ?? "—")}</strong>
                <span class="hint">${item.count} d</span>
              </div>
            `,
              )
              .join("")}
          </div>
        `
        }
      </section>

      ${
        contextCounts.length > 0
          ? `
        <section class="longterm-block">
          <h2>Livshendelser</h2>
          <div class="longterm-context-pills">
            ${contextCounts
              .map(
                (item) => `
              <span class="longterm-context-pill">${escapeHtml(item.label)} · ${item.count}</span>
            `,
              )
              .join("")}
          </div>
        </section>
      `
          : ""
      }
    </div>
  `;

  root.querySelectorAll<HTMLButtonElement>("[data-longterm-period]").forEach((button) => {
    button.addEventListener("click", () => {
      activePeriod = (button.dataset.longtermPeriod as LongTermPeriod) || "threeMonths";
      void renderLongTermPanel(root).then(() => {
        window.scrollTo(0, scrollY);
      });
    });
  });

  requestAnimationFrame(() => {
    window.scrollTo(0, scrollY);
  });
}
