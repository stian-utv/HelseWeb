import {
  calendarSymptomsFromEnabled,
  formatSymptomAverage,
  formatSymptomRange,
  symptomById,
  symptomCellBackground,
  symptomCellLabel,
  symptomNumericValue,
} from "../calendar/symptoms";
import { normalizeEnabledSymptoms } from "../symptoms/catalog";
import { b12CompactTitle, currentB12Status } from "../b12/status";
import {
  listActiveMedications,
  listActiveTrackers,
  listDailyLogs,
  listTrackerValues,
  loadSettings,
  saveSettings,
} from "../storage/localStore";
import {
  DEFAULT_SETTINGS,
  trackerDisplayLabel,
  type AppSettings,
  type DailyLog,
  type Medication,
  type Tracker,
  type TrackerValue,
} from "../types";
import { openB12SettingsModal } from "../ui/b12SettingsModal";
import {
  addMonths,
  daysInMonthGrid,
  formatMonthYear,
  isSameMonth,
  isToday,
  startOfMonth,
  toDateKey,
  weekdaySymbols,
} from "../utils/dates";
import {
  healthScoreBackground,
  healthScoreTextOpacity,
  symptomTint,
} from "../utils/healthScoreColor";
import { openBulkDayRegistration } from "./bulkRegistration";
import { openDayDetail } from "./dayDetail";

type DisplayContext = {
  settings: AppSettings;
  logs: DailyLog[];
  medications: Medication[];
  trackers: Tracker[];
  trackerValuesByDay: Map<string, TrackerValue>;
  calendarSymptoms: ReturnType<typeof calendarSymptomsFromEnabled>;
};

type SummaryCard = {
  title: string;
  value: string;
  tint: string;
  style?: string;
};

let displayedMonth = startOfMonth(new Date());
let logsByDay = new Map<string, DailyLog>();

function parseKeySafe(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function displayLabel(ctx: DisplayContext): string {
  const { settings, trackers, medications } = ctx;
  switch (settings.calendarDisplayKind) {
    case "healthScore":
      return "Helsescore";
    case "symptom":
      return symptomById(settings.calendarDisplayItemName)?.label ?? "Velg symptom";
    case "tracker": {
      const tracker = trackers.find((item) => item.name === settings.calendarDisplayItemName);
      return tracker ? trackerDisplayLabel(tracker) : "Velg tracker";
    }
    case "medication": {
      const med = medications.find((item) => item.name === settings.calendarDisplayItemName);
      return med?.name ?? "Velg medisin";
    }
  }
}

function selectedTracker(ctx: DisplayContext): Tracker | undefined {
  if (ctx.settings.calendarDisplayKind !== "tracker") return undefined;
  return ctx.trackers.find((item) => item.name === ctx.settings.calendarDisplayItemName);
}

function selectedMedication(ctx: DisplayContext): Medication | undefined {
  if (ctx.settings.calendarDisplayKind !== "medication") return undefined;
  return ctx.medications.find((item) => item.name === ctx.settings.calendarDisplayItemName);
}

function selectedSymptomId(ctx: DisplayContext): string | undefined {
  if (ctx.settings.calendarDisplayKind !== "symptom") return undefined;
  const id = ctx.settings.calendarDisplayItemName;
  return ctx.calendarSymptoms.some((item) => item.id === id) ? id : undefined;
}

function trackerShowsInCalendar(tracker: Tracker, value: number): boolean {
  return tracker.type === "Ja/nei" ? value >= 1 : true;
}

function trackerCalendarLabel(tracker: Tracker, value: number): string | null {
  if (!trackerShowsInCalendar(tracker, value)) return null;
  if (tracker.type === "Ja/nei") return tracker.emoji.trim() ? null : "Ja";
  if (tracker.type === "Skala") return value === 0 ? null : String(value);
  return String(value);
}

function indicatorIcons(log: DailyLog | undefined): string {
  if (!log) return `<div class="day-indicators"></div>`;

  const icons: string[] = [];
  if (log.hadB12Injection) {
    icons.push(
      `<span class="day-icon day-icon-b12" title="B12-injeksjon" aria-hidden="true">${syringeIcon()}</span>`,
    );
  }
  if (log.note.trim()) {
    icons.push(`<span class="day-icon" title="Notat" aria-hidden="true">${noteIcon()}</span>`);
  }
  if (log.medications.length > 0) {
    icons.push(`<span class="day-icon" title="Medisin" aria-hidden="true">${pillsIcon()}</span>`);
  }
  if (log.headache > 0 || log.hadMigraine) {
    icons.push(`<span class="day-icon" title="Hodepine" aria-hidden="true">${boltIcon()}</span>`);
  }

  return `<div class="day-indicators">${icons.join("")}</div>`;
}

function dayCellContent(
  day: Date,
  ctx: DisplayContext,
): {
  center: string;
  bg: string;
  opacity: number;
  ariaExtra: string;
  showIndicators: boolean;
} {
  const key = toDateKey(day);
  const log = logsByDay.get(key);
  const tracker = selectedTracker(ctx);
  const medication = selectedMedication(ctx);
  const symptomId = selectedSymptomId(ctx);

  if (tracker) {
    const value = ctx.trackerValuesByDay.get(key);
    const show = value != null && trackerShowsInCalendar(tracker, value.value);
    const label = value != null ? trackerCalendarLabel(tracker, value.value) : null;
    const emoji = tracker.emoji.trim();
    let center = `<span class="day-score-wrap">`;
    if (show) {
      if (emoji) center += `<span class="day-tracker-emoji">${escapeHtml(emoji)}</span>`;
      if (label) center += `<span class="day-score">${escapeHtml(label)}</span>`;
    }
    center += `</span>`;

    return {
      center,
      bg: healthScoreBackground(log?.healthValue),
      opacity: healthScoreTextOpacity(log?.healthValue),
      ariaExtra: show ? `, ${tracker.name}` : "",
      showIndicators: false,
    };
  }

  if (medication) {
    const took = log?.medications.includes(medication.name) === true;
    return {
      center: `<span class="day-med-mark ${took ? "is-taken" : ""}" aria-hidden="true">${
        took ? checkIcon() : circleIcon()
      }</span>`,
      bg: healthScoreBackground(log?.healthValue),
      opacity: healthScoreTextOpacity(log?.healthValue),
      ariaExtra: took ? `, ${medication.name} tatt` : "",
      showIndicators: false,
    };
  }

  if (symptomId) {
    if (!log) {
      return {
        center: `<span class="day-score"></span>`,
        bg: "rgba(128, 128, 128, 0.15)",
        opacity: 1,
        ariaExtra: "",
        showIndicators: false,
      };
    }

    const label = symptomCellLabel(symptomId, log);
    return {
      center: `<span class="day-score">${label ?? ""}</span>`,
      bg: symptomCellBackground(symptomId, log),
      opacity: 0.85,
      ariaExtra: label ? `, ${symptomById(symptomId)?.label ?? ""} ${label}` : "",
      showIndicators: false,
    };
  }

  const score = log?.healthValue;
  const showScore = score != null && score >= 1 && score <= 10;
  return {
    center: `<span class="day-score">${showScore ? score : ""}</span>`,
    bg: healthScoreBackground(score),
    opacity: healthScoreTextOpacity(score),
    ariaExtra: showScore ? `, helsescore ${score}` : "",
    showIndicators: true,
  };
}

function dayCell(day: Date | null, ctx: DisplayContext): string {
  if (!day) {
    return `<div class="day-cell day-cell-empty" aria-hidden="true"></div>`;
  }

  const key = toDateKey(day);
  const log = logsByDay.get(key);
  const today = isToday(day);
  const b12 = log?.hadB12Injection === true;
  const content = dayCellContent(day, ctx);

  const classes = [
    "day-cell",
    "day-cell-button",
    today ? "is-today" : "",
    b12 ? "has-b12" : "",
    log ? "has-log" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <button
      type="button"
      class="${classes}"
      data-date="${key}"
      style="--day-bg: ${content.bg}; --day-fg-opacity: ${content.opacity};"
      aria-label="${key}${content.ariaExtra}"
    >
      <span class="day-number">${day.getDate()}</span>
      ${content.center}
      ${content.showIndicators ? indicatorIcons(log) : `<div class="day-indicators"></div>`}
    </button>
  `;
}

function monthSummary(month: Date, ctx: DisplayContext): string {
  const monthLogs = ctx.logs.filter((log) => isSameMonth(parseKeySafe(log.date), month));
  const scores = monthLogs.map((log) => log.healthValue).filter((v) => v >= 1 && v <= 10);
  const avg =
    scores.length === 0
      ? "–"
      : (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1).replace(".", ",");
  const avgInt =
    scores.length === 0
      ? null
      : Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const min = scores.length ? Math.min(...scores) : null;
  const max = scores.length ? Math.max(...scores) : null;
  const range = min == null || max == null ? "–" : min === max ? `${min}` : `${min}–${max}`;
  const b12Count = monthLogs.filter((log) => log.hadB12Injection).length;

  const cards: SummaryCard[] = [
    { title: "Registrerte dager", value: String(monthLogs.length), tint: "blue" },
    {
      title: "Snitt helsescore",
      value: avg,
      tint: "score",
      style: avgInt != null ? `background: ${healthScoreBackground(avgInt)}22;` : "",
    },
    { title: "B12-injeksjoner", value: String(b12Count), tint: "purple" },
  ];

  const tracker = selectedTracker(ctx);
  const medication = selectedMedication(ctx);
  const symptomId = selectedSymptomId(ctx);

  if (tracker) {
    const monthValues = [...ctx.trackerValuesByDay.values()].filter((value) =>
      isSameMonth(parseKeySafe(value.date), month),
    );

    if (tracker.type === "Ja/nei") {
      const yesCount = monthValues.filter((value) => value.value >= 1).length;
      cards.push({
        title: tracker.emoji.trim()
          ? `Dager med ${tracker.emoji}`
          : `Dager med ${tracker.name.toLowerCase()}`,
        value: yesCount === 1 ? "1 dag" : `${yesCount} dager`,
        tint: "orange",
      });
    } else {
      const avgValue =
        monthValues.length === 0
          ? "–"
          : (monthValues.reduce((sum, value) => sum + value.value, 0) / monthValues.length)
              .toFixed(1)
              .replace(".", ",");
      const unit = tracker.type === "Tall" && tracker.unit.trim() ? ` ${tracker.unit.trim()}` : "";
      cards.push({
        title: tracker.emoji.trim()
          ? `Snitt ${tracker.emoji}`
          : `Snitt ${tracker.name.toLowerCase()}`,
        value: avgValue === "–" ? "–" : `${avgValue}${unit}`,
        tint: "orange",
      });
    }
  } else if (symptomId) {
    const symptom = symptomById(symptomId)!;
    const daysWith = monthLogs.filter((log) => symptomNumericValue(symptomId, log) != null).length;
    cards.push(
      {
        title: `Snitt ${symptom.label.toLowerCase()}`,
        value: formatSymptomAverage(symptomId, monthLogs),
        tint: symptom.tintClass,
      },
      {
        title: `Dager med ${symptom.label.toLowerCase()}`,
        value: daysWith === 1 ? "1 dag" : `${daysWith} dager`,
        tint: symptom.tintClass,
      },
      {
        title: "Verdispenn",
        value: formatSymptomRange(symptomId, monthLogs),
        tint: "indigo",
      },
    );
  } else if (medication) {
    const days = monthLogs.filter((log) => log.medications.includes(medication.name)).length;
    cards.push({
      title: `Dager med ${medication.name}`,
      value: String(days),
      tint: "green",
    });
  } else {
    cards.push(
      { title: "Score-spenn", value: range, tint: "indigo" },
      {
        title: "Dager med notat",
        value: String(monthLogs.filter((log) => log.note.trim()).length),
        tint: "teal",
      },
      {
        title: "Dager med hodepine",
        value: String(monthLogs.filter((log) => log.headache > 0 || log.hadMigraine).length),
        tint: "red",
      },
      {
        title: "Dager med medisin",
        value: String(monthLogs.filter((log) => log.medications.length > 0).length),
        tint: "green",
      },
    );
  }

  return `
    <aside class="summary-panel">
      <h2>Oppsummering</h2>
      <p class="summary-caption">${formatMonthYear(month)}</p>
      <div class="summary-cards">
        ${cards
          .map(
            (card) => `
          <div class="summary-card tint-${card.tint}" style="${card.style ?? ""}">
            <div class="summary-card-title">${escapeHtml(card.title)}</div>
            <div class="summary-card-value">${escapeHtml(card.value)}</div>
          </div>
        `,
          )
          .join("")}
      </div>
    </aside>
  `;
}

function legend(ctx: DisplayContext): string {
  const tracker = selectedTracker(ctx);
  const medication = selectedMedication(ctx);
  const symptomId = selectedSymptomId(ctx);

  if (tracker) {
    return `
      <div class="calendar-legend">
        <span class="legend-item">Viser ${escapeHtml(tracker.name.toLowerCase())}</span>
        <span class="legend-item legend-b12">${syringeIcon()} B12-injeksjon</span>
      </div>
    `;
  }

  if (medication) {
    return `
      <div class="calendar-legend">
        <span class="legend-item">${checkIconSmall()} Viser når ${escapeHtml(medication.name)} er tatt</span>
        <span class="legend-item legend-b12">${syringeIcon()} B12-injeksjon</span>
      </div>
    `;
  }

  if (symptomId) {
    const symptom = symptomById(symptomId)!;
    const isUiScale5 = symptom.def.kind === "scale10";
    const maxLabel = isUiScale5 ? "5" : symptom.def.kind === "gi3" ? "3" : "10";
    const stopCount = isUiScale5 ? 5 : symptom.def.kind === "gi3" ? 3 : 10;
    const stops = Array.from({ length: stopCount }, (_, i) => {
      const storage = isUiScale5 ? (i + 1) * 2 : i + 1;
      return symptomTint(storage);
    }).join(", ");
    return `
      <div class="calendar-legend">
        <span class="legend-item">Viser ${escapeHtml(symptom.label.toLowerCase())}</span>
        <div class="legend-score">
          <span>0</span>
          <div class="legend-gradient" style="background: linear-gradient(90deg, ${stops});"></div>
          <span>${maxLabel}</span>
        </div>
        <span class="legend-item legend-b12">${syringeIcon()} B12-injeksjon</span>
      </div>
    `;
  }

  const stops = Array.from({ length: 10 }, (_, i) => healthScoreBackground(i + 1)).join(", ");
  return `
    <div class="calendar-legend">
      <div class="legend-score">
        <span>1</span>
        <div class="legend-gradient" style="background: linear-gradient(90deg, ${stops});"></div>
        <span>10</span>
      </div>
      <span class="legend-item legend-b12">${syringeIcon()} B12-injeksjon</span>
      <span class="legend-item">${noteIcon()} Notat</span>
      <span class="legend-item">${pillsIcon()} Medisin</span>
      <span class="legend-item">${boltIcon()} Hodepine</span>
    </div>
  `;
}

function b12BannerMarkup(ctx: DisplayContext): string {
  const status = currentB12Status(ctx.logs, ctx.settings.b12IntervalDays);
  return `
    <div class="b12-banner ${status.kind === "overdue" ? "is-overdue" : ""}">
      <div class="b12-banner-text">
        <strong>${escapeHtml(b12CompactTitle(status))}</strong>
        <p>Intervall: hver ${ctx.settings.b12IntervalDays}. dag</p>
      </div>
      <div class="b12-actions">
        <button type="button" class="button button-primary b12-register" data-action="register-b12">
          Registrer
        </button>
        <button
          type="button"
          class="icon-button b12-settings-button"
          data-action="b12-settings"
          aria-label="B12-innstillinger"
        >
          ${slidersIcon()}
        </button>
      </div>
    </div>
  `;
}

function renderCalendarMarkup(ctx: DisplayContext): string {
  const cells = daysInMonthGrid(displayedMonth);
  const showTodayJump = !isSameMonth(displayedMonth, new Date());
  const label = displayLabel(ctx);

  return `
    <div class="calendar-page">
      ${b12BannerMarkup(ctx)}

      <div class="calendar-toolbar">
        <button type="button" class="display-pill is-button" data-action="open-display-picker">
          <span class="display-pill-label">Visning:</span>
          <span class="display-pill-value">${escapeHtml(label)}</span>
          <span class="display-pill-chevron" aria-hidden="true">${chevronDown()}</span>
        </button>
      </div>

      <div class="calendar-layout">
        <section class="month-card">
          <header class="month-header">
            <button type="button" class="icon-button" data-action="prev-month" aria-label="Forrige måned">
              ${chevronLeft()}
            </button>
            <div class="month-title-block">
              <h1 class="month-title">${formatMonthYear(displayedMonth)}</h1>
              ${
                showTodayJump
                  ? `<button type="button" class="today-jump" data-action="jump-today">I dag</button>`
                  : ""
              }
            </div>
            <button type="button" class="icon-button" data-action="next-month" aria-label="Neste måned">
              ${chevronRight()}
            </button>
          </header>

          <div class="weekday-header">
            ${weekdaySymbols()
              .map((day) => `<div class="weekday">${day}</div>`)
              .join("")}
          </div>

          <div class="day-grid">
            ${cells.map((day) => dayCell(day, ctx)).join("")}
          </div>

          ${legend(ctx)}
        </section>

        ${monthSummary(displayedMonth, ctx)}
      </div>
    </div>
  `;
}

function normalizeSettings(
  settings: AppSettings,
  trackers: Tracker[],
  medications: Medication[],
): AppSettings {
  const enabledSymptoms = normalizeEnabledSymptoms(settings.enabledSymptoms);
  let next: AppSettings = { ...settings, enabledSymptoms };

  if (
    next.calendarDisplayKind === "tracker" &&
    !trackers.some((item) => item.name === next.calendarDisplayItemName)
  ) {
    next = { ...next, calendarDisplayKind: "healthScore", calendarDisplayItemName: "" };
  }
  if (
    next.calendarDisplayKind === "medication" &&
    !medications.some((item) => item.name === next.calendarDisplayItemName)
  ) {
    next = { ...next, calendarDisplayKind: "healthScore", calendarDisplayItemName: "" };
  }
  if (
    next.calendarDisplayKind === "symptom" &&
    !enabledSymptoms.includes(next.calendarDisplayItemName)
  ) {
    next = { ...next, calendarDisplayKind: "healthScore", calendarDisplayItemName: "" };
  }
  return next;
}

async function loadContext(): Promise<DisplayContext> {
  const [logs, medications, trackers, trackerValues, storedSettings] = await Promise.all([
    listDailyLogs(),
    listActiveMedications(),
    listActiveTrackers(),
    listTrackerValues(),
    loadSettings(),
  ]);

  logsByDay = new Map(logs.map((log) => [log.date, log]));
  const settings = normalizeSettings(storedSettings ?? DEFAULT_SETTINGS, trackers, medications);

  const tracker =
    settings.calendarDisplayKind === "tracker"
      ? trackers.find((item) => item.name === settings.calendarDisplayItemName)
      : undefined;

  const trackerValuesByDay = new Map<string, TrackerValue>();
  if (tracker) {
    for (const value of trackerValues) {
      if (value.trackerName === tracker.name) {
        trackerValuesByDay.set(value.date, value);
      }
    }
  }

  return {
    settings,
    logs,
    medications,
    trackers,
    trackerValuesByDay,
    calendarSymptoms: calendarSymptomsFromEnabled(settings.enabledSymptoms),
  };
}

export async function renderCalendarPage(root: HTMLElement): Promise<void> {
  const ctx = await loadContext();
  root.innerHTML = renderCalendarMarkup(ctx);
  bindCalendar(root, ctx);
}

function bindCalendar(root: HTMLElement, ctx: DisplayContext): void {
  root.querySelector('[data-action="prev-month"]')?.addEventListener("click", async () => {
    displayedMonth = addMonths(displayedMonth, -1);
    await renderCalendarPage(root);
  });

  root.querySelector('[data-action="next-month"]')?.addEventListener("click", async () => {
    displayedMonth = addMonths(displayedMonth, 1);
    await renderCalendarPage(root);
  });

  root.querySelector('[data-action="jump-today"]')?.addEventListener("click", async () => {
    displayedMonth = startOfMonth(new Date());
    await renderCalendarPage(root);
  });

  root.querySelector('[data-action="open-display-picker"]')?.addEventListener("click", () => {
    openDisplayPicker(root, ctx);
  });

  root.querySelector('[data-action="register-b12"]')?.addEventListener("click", () => {
    void openBulkDayRegistration({
      kind: { type: "b12" },
      onSaved: () => {
        void renderCalendarPage(root);
      },
    });
  });

  root.querySelector('[data-action="b12-settings"]')?.addEventListener("click", () => {
    void openB12SettingsModal({
      onSaved: () => {
        void renderCalendarPage(root);
      },
    });
  });

  root.querySelectorAll<HTMLButtonElement>(".day-cell-button").forEach((button) => {
    button.addEventListener("click", () => {
      const dateKey = button.dataset.date;
      if (!dateKey) return;

      void openDayDetail({
        dateKey,
        existingLog: logsByDay.get(dateKey),
        onClose: () => {},
        onSaved: () => {
          void renderCalendarPage(root);
        },
      });
    });
  });
}

function openDisplayPicker(root: HTMLElement, ctx: DisplayContext): void {
  const { settings, trackers, medications } = ctx;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const option = (
    kind: AppSettings["calendarDisplayKind"],
    itemName: string,
    title: string,
    subtitle: string,
  ) => {
    const selected =
      settings.calendarDisplayKind === kind &&
      (kind === "healthScore" || settings.calendarDisplayItemName === itemName);
    return `
      <button
        type="button"
        class="display-option ${selected ? "is-selected" : ""}"
        data-kind="${kind}"
        data-item="${escapeHtml(itemName)}"
      >
        <span class="display-option-text">
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(subtitle)}</small>
        </span>
        ${selected ? `<span class="display-option-check">${checkIconSmall()}</span>` : ""}
      </button>
    `;
  };

  overlay.innerHTML = `
    <div class="modal editor-modal display-picker-modal" role="dialog" aria-modal="true" aria-labelledby="display-picker-title">
      <header class="modal-header">
        <div>
          <p class="modal-kicker">Kalender</p>
          <h2 id="display-picker-title">Visning i kalender</h2>
        </div>
        <div class="modal-actions">
          <button type="button" class="button button-primary" data-action="close-picker">Ferdig</button>
        </div>
      </header>
      <div class="editor-body display-picker-body">
        <section class="display-section">
          <h3>Standard</h3>
          ${option("healthScore", "", "Helsescore", "Farge og tall 1–10")}
        </section>

        <section class="display-section">
          <h3>Symptomer</h3>
          ${
            ctx.calendarSymptoms.length > 0
              ? ctx.calendarSymptoms
                  .map((symptom) =>
                    option("symptom", symptom.id, symptom.label, symptom.subtitle),
                  )
                  .join("")
              : `<p class="hint">Aktiver symptomer under fanen Symptomer for å vise dem her.</p>`
          }
          <p class="hint">Viser registrert verdi med farge — høyere symptom gir sterkere farge.</p>
        </section>

        ${
          trackers.length > 0
            ? `
          <section class="display-section">
            <h3>Trackere (${trackers.length})</h3>
            ${trackers
              .map((tracker) =>
                option(
                  "tracker",
                  tracker.name,
                  trackerDisplayLabel(tracker),
                  tracker.type === "Ja/nei"
                    ? "Viser dager med «ja»"
                    : tracker.type === "Skala"
                      ? "Skala 0–10"
                      : tracker.unit.trim()
                        ? `Tall · ${tracker.unit}`
                        : "Tall",
                ),
              )
              .join("")}
          </section>
        `
            : ""
        }

        ${
          medications.length > 0
            ? `
          <section class="display-section">
            <h3>Medisin (${medications.length})</h3>
            ${medications
              .map((med) => option("medication", med.name, med.name, "Grønn hake når tatt"))
              .join("")}
          </section>
        `
            : ""
        }
      </div>
    </div>
  `;

  const close = () => overlay.remove();

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  overlay.querySelector('[data-action="close-picker"]')?.addEventListener("click", close);

  overlay.querySelectorAll<HTMLButtonElement>(".display-option").forEach((button) => {
    button.addEventListener("click", async () => {
      const kind = button.dataset.kind as AppSettings["calendarDisplayKind"] | undefined;
      const itemName = button.dataset.item ?? "";
      if (!kind) return;

      const next: AppSettings = {
        ...ctx.settings,
        calendarDisplayKind: kind,
        calendarDisplayItemName: kind === "healthScore" ? "" : itemName,
      };
      await saveSettings(next);
      close();
      await renderCalendarPage(root);
    });
  });

  document.body.appendChild(overlay);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function syringeIcon(): string {
  return `<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M11.2 1.2 12.8 2.8 11.5 4.1l1.4 1.4-1.1 1.1-1.4-1.4-1.6 1.6 4.2 4.2-.7.7-4.2-4.2-1.3 1.3.9.9-.7.7-.9-.9L4.3 12l-1.5-.2.2-1.5 1.5-1.5-.9-.9.7-.7.9.9 1.3-1.3L3.2 3.5l.7-.7 4.2 4.2 1.6-1.6-1.4-1.4 1.1-1.1 1.4 1.4z"/></svg>`;
}

function noteIcon(): string {
  return `<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M3 2h7l3 3v9H3V2zm7 1.2V5h1.8L10 3.2zM5 7h6v1H5V7zm0 2.5h6v1H5v-1zm0 2.5h4v1H5v-1z"/></svg>`;
}

function pillsIcon(): string {
  return `<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M10.8 1.6a3.2 3.2 0 0 1 0 4.5L6.1 10.8a3.2 3.2 0 1 1-4.5-4.5l4.7-4.7a3.2 3.2 0 0 1 4.5 0zM2.7 7.4a1.8 1.8 0 0 0 2.5 2.5l1.6-1.6-2.5-2.5-1.6 1.6zm9.1-4.7a1.8 1.8 0 0 0-2.5 0L7.7 4.3l2.5 2.5 1.6-1.6a1.8 1.8 0 0 0 0-2.5zM9 9.5l1.2-1.2 2.8 2.8a1.8 1.8 0 1 1-2.5 2.5L9 11.8V9.5z"/></svg>`;
}

function boltIcon(): string {
  return `<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M9.2 1 4 9h3.2L6.8 15 13 7H9.5L9.2 1z"/></svg>`;
}

function checkIcon(): string {
  return `<svg viewBox="0 0 16 16" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M8 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zm3.1 4.2L7.2 10l-2.3-2.3-.9.9 3.2 3.2 4.8-5.2-.9-.9z"/></svg>`;
}

function checkIconSmall(): string {
  return `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M8 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zm3.1 4.2L7.2 10l-2.3-2.3-.9.9 3.2 3.2 4.8-5.2-.9-.9z"/></svg>`;
}

function circleIcon(): string {
  return `<svg viewBox="0 0 16 16" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="8" cy="8" r="5.2"/></svg>`;
}

function slidersIcon(): string {
  return `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M2 4.5h5.1a2 2 0 0 0 3.8 0H14V3H10.9a2 2 0 0 0-3.8 0H2v1.5zm0 8h1.1a2 2 0 0 0 3.8 0H14V11H6.9a2 2 0 0 0-3.8 0H2v1.5z"/></svg>`;
}

function chevronLeft(): string {
  return `<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor"><path d="M10.5 3.2 5.7 8l4.8 4.8-.9.9L4 8l5.6-5.7.9.9z"/></svg>`;
}

function chevronRight(): string {
  return `<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor"><path d="M5.5 3.2 10.3 8l-4.8 4.8.9.9L12 8 6.4 2.3l-.9.9z"/></svg>`;
}

function chevronDown(): string {
  return `<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M3.2 5.5 8 10.3l4.8-4.8.9.9L8 12 2.3 6.4l.9-.9z"/></svg>`;
}
