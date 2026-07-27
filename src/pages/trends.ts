import { enabledSymptomDefs, normalizeEnabledSymptoms } from "../symptoms/catalog";
import {
  listActiveMedications,
  listActiveTrackers,
  listDailyLogs,
  listTrackerValues,
  loadSettings,
} from "../storage/localStore";
import { DEFAULT_SETTINGS, type DailyLog } from "../types";
import { parseDateKey } from "../utils/dates";
import {
  buildMetrics,
  GROUP_LIMITS,
  normalizedValue,
  QUICK_PRESETS,
  type ChartMetric,
  type ChartPoint,
  type MetricGroup,
} from "../trends/metrics";
import {
  defaultPeriod,
  formatPeriodLabel,
  openDateRangePicker,
  PERIOD_PRESETS,
  resolvePeriod,
  type DatePeriod,
  type PeriodPreset,
} from "../trends/period";

type TrendsState = {
  preset: PeriodPreset;
  customStart: string;
  customEnd: string;
  selected: Set<string>;
  pickerExpanded: boolean;
};

const state: TrendsState = {
  preset: "oneMonth",
  customStart: defaultPeriod().start,
  customEnd: defaultPeriod().end,
  selected: new Set(["healthScore", "fatigue"]),
  pickerExpanded: false,
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function currentPeriod(): DatePeriod | null {
  return resolvePeriod(state.preset, state.customStart, state.customEnd);
}

function filterLogs(logs: DailyLog[], period: DatePeriod): DailyLog[] {
  return logs
    .filter((log) => log.date >= period.start && log.date <= period.end)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function countSelectedInGroup(metrics: ChartMetric[], group: MetricGroup): number {
  return metrics.filter((metric) => metric.group === group && state.selected.has(metric.id)).length;
}

function toggleMetric(metric: ChartMetric, metrics: ChartMetric[]): void {
  if (state.selected.has(metric.id)) {
    state.selected.delete(metric.id);
    return;
  }
  if (countSelectedInGroup(metrics, metric.group) >= GROUP_LIMITS[metric.group]) return;
  if (state.selected.size >= 16) return;
  state.selected.add(metric.id);
}

function applyQuickPreset(ids: readonly string[], available: Set<string>): void {
  state.selected = new Set(ids.filter((id) => available.has(id)));
  if (state.selected.size === 0) state.selected.add("healthScore");
}

function catmullRomPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;
  if (points.length === 2) {
    return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`;
  }

  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i === 0 ? 0 : i - 1]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1]!;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function renderChart(
  series: Array<{ metric: ChartMetric; points: ChartPoint[] }>,
  period: DatePeriod,
): string {
  const width = 920;
  const height = state.pickerExpanded ? 320 : 440;
  const pad = { top: 20, right: 16, bottom: 36, left: 36 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const start = parseDateKey(period.start).getTime();
  const end = parseDateKey(period.end).getTime();
  const span = Math.max(end - start, 1);

  const xFor = (date: string) => pad.left + ((parseDateKey(date).getTime() - start) / span) * innerW;
  const yFor = (value: number) => pad.top + (1 - value / 10) * innerH;

  const yTicks = [0, 2, 4, 6, 8, 10];
  const xTickCount = 5;
  const xTicks = Array.from({ length: xTickCount }, (_, i) => {
    const t = start + (span * i) / (xTickCount - 1);
    return new Date(t);
  });

  const fmt = new Intl.DateTimeFormat("nb-NO", { month: "short", day: "numeric" });

  const grid = yTicks
    .map((tick) => {
      const y = yFor(tick);
      return `
        <line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="rgba(0,0,0,0.08)" />
        <text x="${pad.left - 8}" y="${y + 4}" text-anchor="end" class="chart-tick">${tick}</text>
      `;
    })
    .join("");

  const xLabels = xTicks
    .map((date) => {
      const x = pad.left + ((date.getTime() - start) / span) * innerW;
      return `<text x="${x}" y="${height - 10}" text-anchor="middle" class="chart-tick">${fmt.format(date)}</text>`;
    })
    .join("");

  const paths = series
    .map(({ metric, points }) => {
      if (points.length === 0) return "";
      if (metric.plotsAsEventMarker) {
        return points
          .map(
            (point) =>
              `<circle cx="${xFor(point.date)}" cy="${yFor(10)}" r="6" fill="${metric.color}"><title>${escapeHtml(metric.label)} · ${escapeHtml(point.rawDescription)}</title></circle>`,
          )
          .join("");
      }

      const coords = points.map((point) => ({
        x: xFor(point.date),
        y: yFor(point.normalized),
      }));
      const d = catmullRomPath(coords);
      const dots = points
        .map(
          (point) =>
            `<circle cx="${xFor(point.date)}" cy="${yFor(point.normalized)}" r="3.2" fill="${metric.color}"><title>${escapeHtml(metric.label)} · ${escapeHtml(point.rawDescription)}</title></circle>`,
        )
        .join("");
      return `<path d="${d}" fill="none" stroke="${metric.color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />${dots}`;
    })
    .join("");

  return `
    <svg class="trends-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Graf over valgte datapunkter">
      ${grid}
      ${xLabels}
      ${paths}
    </svg>
  `;
}

function metricChip(metric: ChartMetric): string {
  const selected = state.selected.has(metric.id);
  return `
    <button
      type="button"
      class="metric-chip ${selected ? "is-selected" : ""}"
      data-metric="${escapeHtml(metric.id)}"
      style="--metric-color:${metric.color}"
    >
      ${escapeHtml(metric.label)}
    </button>
  `;
}

export async function renderTrendsPage(
  root: HTMLElement,
  options: { embedded?: boolean } = {},
): Promise<void> {
  const [logs, medications, trackers, trackerValues, storedSettings] = await Promise.all([
    listDailyLogs(),
    listActiveMedications(),
    listActiveTrackers(),
    listTrackerValues(),
    loadSettings(),
  ]);

  const settings = storedSettings ?? DEFAULT_SETTINGS;
  const enabledSymptoms = normalizeEnabledSymptoms(settings.enabledSymptoms);
  const symptomDefs = new Map(
    enabledSymptomDefs(enabledSymptoms).map((def) => [def.id, def] as const),
  );
  const metrics = buildMetrics(trackers, medications, enabledSymptoms);
  const metricsById = new Map(metrics.map((metric) => [metric.id, metric]));
  const trackersByName = new Map(trackers.map((tracker) => [tracker.name, tracker]));

  // Drop selected metrics that are no longer available
  for (const id of [...state.selected]) {
    if (!metricsById.has(id)) state.selected.delete(id);
  }
  if (state.selected.size === 0) {
    state.selected = new Set(["healthScore", "fatigue"].filter((id) => metricsById.has(id)));
    if (state.selected.size === 0) state.selected.add("healthScore");
  }

  const period = currentPeriod();

  if (!period) {
    root.innerHTML = `<div class="trends-page"><p class="hint">Fra-dato må være før til-dato.</p></div>`;
    return;
  }

  const periodLogs = filterLogs(logs, period);
  const selectedMetrics = [...state.selected]
    .map((id) => metricsById.get(id))
    .filter((metric): metric is ChartMetric => Boolean(metric));

  const series = selectedMetrics.map((metric) => ({
    metric,
    points: periodLogs
      .map((log) => normalizedValue(metric, log, trackerValues, trackersByName, symptomDefs))
      .filter((point): point is ChartPoint => Boolean(point)),
  }));

  const daysWithData = new Set(series.flatMap((item) => item.points.map((point) => point.date))).size;
  const wellness = metrics.filter((metric) => metric.group === "wellness");
  const treatment = metrics.filter((metric) => metric.group === "treatment");

  const selectedLabels = selectedMetrics.map((metric) => metric.label).join(", ");
  const scaleNotes = [
    ...new Set(selectedMetrics.map((metric) => metric.legendScaleNote).filter(Boolean)),
  ] as string[];

  root.innerHTML = `
    <div class="trends-page ${options.embedded ? "is-embedded" : ""}">
      ${
        options.embedded
          ? ""
          : `
        <header class="page-title-block">
          <h1>Grafer</h1>
          <p>Sammenlign symptomer og medisin over tid.</p>
        </header>
      `
      }

      <section class="insight-section">
        <h2>Tidsrom</h2>
        <div class="period-pills">
          ${PERIOD_PRESETS.map(
            (preset) => `
            <button type="button" class="period-pill ${state.preset === preset.id ? "is-selected" : ""}" data-preset="${preset.id}">
              ${preset.label}
            </button>
          `,
          ).join("")}
        </div>
        <p class="hint">Valgt periode: ${escapeHtml(formatPeriodLabel(period))}${
          daysWithData ? ` · ${daysWithData} dager med data` : ""
        }</p>
      </section>

      <section class="insight-section">
        <button type="button" class="picker-toggle" data-action="toggle-picker">
          <div>
            <h2>Datapunkter</h2>
            <p class="hint">${state.selected.size}/16 valgt${selectedLabels ? ` · ${escapeHtml(selectedLabels)}` : ""}</p>
          </div>
          <span>${state.pickerExpanded ? "Minimer" : "Velg"}</span>
        </button>

        ${
          state.pickerExpanded
            ? `
          <div class="metric-picker">
            <div class="quick-pills">
              <button type="button" data-quick="health">Helse</button>
              <button type="button" data-quick="neuro">Nevrologisk</button>
              <button type="button" data-quick="medication">Medisin</button>
            </div>

            <div class="metric-group">
              <h3>Symptomer og form</h3>
              <p class="hint">Aktive symptomer (fra fanen Symptomer) · velg opptil 8.</p>
              <div class="metric-grid">${wellness.map(metricChip).join("")}</div>
            </div>

            <div class="metric-group">
              <h3>Injeksjoner, medisin og tilskudd</h3>
              <p class="hint">Vises som markører på dager noe ble tatt. Velg opptil 5.</p>
              ${
                treatment.length <= 1 && medications.length === 0
                  ? `<p class="hint">Ingen aktive medisiner eller tilskudd registrert.</p>`
                  : ""
              }
              <div class="metric-grid">${treatment.map(metricChip).join("")}</div>
            </div>

            <button type="button" class="button button-ghost" data-action="collapse-picker">Minimer og vis graf</button>
          </div>
        `
            : ""
        }
      </section>

      <section class="insight-section">
        <h2>Utvikling</h2>
        ${
          selectedMetrics.length === 0
            ? `<div class="empty-chart"><strong>Ingen datapunkter valgt</strong><p>Velg minst én variabel over, eller bruk et hurtigvalg.</p></div>`
            : periodLogs.length === 0
              ? `<div class="empty-chart"><strong>Ingen data i perioden</strong><p>Registrer dager i kalenderen for å se grafer.</p></div>`
              : renderChart(series, period)
        }
      </section>

      <section class="insight-section">
        <h2>Tolkning</h2>
        <p class="hint">
          Symptomer tegnes som linjer (logges 0–5). Injeksjoner, medisin og tilskudd vises som markører
          på toppen (10) på dager de ble tatt.
        </p>
        ${scaleNotes.map((note) => `<p class="hint">${escapeHtml(note)}</p>`).join("")}
        <div class="legend-list">
          ${series
            .map(({ metric, points }) => {
              const count = points.length;
              let detail = `${count} punkter`;
              if (metric.plotsAsEventMarker) {
                detail = count === 1 ? "1 dag" : `${count} dager`;
              } else if (count > 0) {
                const avg =
                  points.reduce((sum, point) => sum + point.normalized, 0) / points.length;
                detail = `${count} d · snitt ${avg.toFixed(1).replace(".", ",")}`;
              }
              return `
                <div class="legend-row">
                  <span class="legend-dot" style="background:${metric.color}"></span>
                  <span>${escapeHtml(metric.label)}</span>
                  <strong>${escapeHtml(detail)}</strong>
                </div>
              `;
            })
            .join("")}
        </div>
      </section>
    </div>
  `;

  bindTrends(root, metrics, options);
}

function bindTrends(
  root: HTMLElement,
  metrics: ChartMetric[],
  options: { embedded?: boolean },
): void {
  const rerender = () => {
    void renderTrendsPage(root, options);
  };

  root.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const preset = button.dataset.preset as PeriodPreset;
      if (preset === "custom") {
        openDateRangePicker({
          initialStart: state.customStart,
          initialEnd: state.customEnd,
          onConfirm: (start, end) => {
            state.preset = "custom";
            state.customStart = start;
            state.customEnd = end;
            rerender();
          },
        });
        return;
      }
      state.preset = preset;
      rerender();
    });
  });

  root.querySelector('[data-action="toggle-picker"]')?.addEventListener("click", () => {
    state.pickerExpanded = !state.pickerExpanded;
    rerender();
  });

  root.querySelector('[data-action="collapse-picker"]')?.addEventListener("click", () => {
    state.pickerExpanded = false;
    rerender();
  });

  const available = new Set(metrics.map((metric) => metric.id));
  root.querySelectorAll<HTMLButtonElement>("[data-quick]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.quick as keyof typeof QUICK_PRESETS;
      applyQuickPreset(QUICK_PRESETS[key], available);
      rerender();
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-metric]").forEach((button) => {
    button.addEventListener("click", () => {
      const metric = metrics.find((item) => item.id === button.dataset.metric);
      if (!metric) return;
      toggleMetric(metric, metrics);
      rerender();
    });
  });
}
