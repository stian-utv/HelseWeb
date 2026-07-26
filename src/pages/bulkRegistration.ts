import { getDailyLog, listDailyLogs, saveDailyLog } from "../storage/localStore";
import { createEmptyDailyLog, type Medication } from "../types";
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

export type BulkRegistrationKind =
  | { type: "b12" }
  | { type: "medication"; medication: Medication };

type Options = {
  kind: BulkRegistrationKind;
  onSaved?: () => void;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function kindMeta(kind: BulkRegistrationKind): {
  title: string;
  subtitle: string;
  accent: "purple" | "green";
} {
  if (kind.type === "b12") {
    return {
      title: "B12-injeksjoner",
      subtitle: "Trykk på dagene du fikk B12-injeksjon. Du kan velge mange dager.",
      accent: "purple",
    };
  }
  return {
    title: kind.medication.name,
    subtitle: "Trykk på dagene medisin ble tatt. Du kan velge mange dager.",
    accent: "green",
  };
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

function isFutureDate(dateKey: string, todayKey: string): boolean {
  return dateKey > todayKey;
}

export async function openBulkDayRegistration(options: Options): Promise<void> {
  const meta = kindMeta(options.kind);
  const logs = await listDailyLogs();
  const initial = new Set<string>();

  for (const log of logs) {
    if (options.kind.type === "b12") {
      if (log.hadB12Injection) initial.add(log.date);
    } else if (log.medications.includes(options.kind.medication.name)) {
      initial.add(log.date);
    }
  }

  const selected = new Set(initial);
  const todayKey = toDateKey(new Date());
  let displayedMonth = startOfMonth(new Date());
  const latest = [...initial].sort().at(-1);
  if (latest) {
    const [y, m] = latest.split("-").map(Number);
    displayedMonth = startOfMonth(new Date(y, m - 1, 1));
  }

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal bulk-modal" role="dialog" aria-modal="true" aria-labelledby="bulk-title">
      <header class="modal-header">
        <div>
          <p class="modal-kicker">Bulk-registrering</p>
          <h2 id="bulk-title">${escapeHtml(meta.title)}</h2>
        </div>
        <div class="modal-actions">
          <button type="button" class="button button-ghost" data-action="cancel">Avbryt</button>
          <button type="button" class="button button-primary" data-action="save">Ferdig</button>
        </div>
      </header>
      <div class="bulk-body"></div>
    </div>
  `;

  const body = overlay.querySelector<HTMLElement>(".bulk-body")!;
  const saveButton = overlay.querySelector<HTMLButtonElement>('[data-action="save"]')!;

  const close = () => overlay.remove();

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  overlay.querySelector('[data-action="cancel"]')?.addEventListener("click", close);

  const render = () => {
    const hasChanges = !setsEqual(selected, initial);
    const added = [...selected].filter((day) => !initial.has(day)).length;
    const removed = [...initial].filter((day) => !selected.has(day)).length;
    const canGoNext = !isSameMonth(displayedMonth, new Date());
    const cells = daysInMonthGrid(displayedMonth);

    saveButton.textContent = hasChanges ? "Lagre" : "Ferdig";

    body.innerHTML = `
      <div class="bulk-intro tint-${meta.accent}">
        <p>${escapeHtml(meta.subtitle)}</p>
      </div>

      <div class="bulk-calendar tint-${meta.accent}">
        <header class="month-header">
          <button type="button" class="icon-button" data-action="prev-month" aria-label="Forrige måned">‹</button>
          <h3 class="month-title">${formatMonthYear(displayedMonth)}</h3>
          <button type="button" class="icon-button" data-action="next-month" aria-label="Neste måned" ${
            canGoNext ? "" : "disabled"
          }>›</button>
        </header>
        <div class="weekday-header">
          ${weekdaySymbols()
            .map((day) => `<div class="weekday">${day}</div>`)
            .join("")}
        </div>
        <div class="day-grid bulk-day-grid">
          ${cells
            .map((day) => {
              if (!day) return `<div class="day-cell day-cell-empty" aria-hidden="true"></div>`;
              const key = toDateKey(day);
              const future = isFutureDate(key, todayKey);
              const isSelected = selected.has(key);
              const today = isToday(day);
              const classes = [
                "bulk-day",
                isSelected ? "is-selected" : "",
                future ? "is-future" : "",
                today ? "is-today" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return `
                <button
                  type="button"
                  class="${classes}"
                  data-date="${key}"
                  ${future ? "disabled" : ""}
                  aria-pressed="${isSelected}"
                >
                  ${day.getDate()}
                </button>
              `;
            })
            .join("")}
        </div>
      </div>

      <div class="bulk-summary tint-${meta.accent}">
        <strong>${selected.size} dager valgt</strong>
        ${
          hasChanges
            ? `
          <div class="bulk-delta">
            ${added > 0 ? `<span class="bulk-added">+${added} nye dager</span>` : ""}
            ${removed > 0 ? `<span class="bulk-removed">−${removed} dager fjernes</span>` : ""}
          </div>
        `
            : `<p>Ingen endringer — trykk Ferdig for å lukke</p>`
        }
      </div>
    `;

    body.querySelector('[data-action="prev-month"]')?.addEventListener("click", () => {
      displayedMonth = addMonths(displayedMonth, -1);
      render();
    });

    body.querySelector('[data-action="next-month"]')?.addEventListener("click", () => {
      if (!canGoNext) return;
      displayedMonth = addMonths(displayedMonth, 1);
      render();
    });

    body.querySelectorAll<HTMLButtonElement>("button.bulk-day").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.date;
        if (!key || isFutureDate(key, todayKey)) return;
        if (selected.has(key)) selected.delete(key);
        else selected.add(key);
        render();
      });
    });
  };

  saveButton.addEventListener("click", async () => {
    if (setsEqual(selected, initial)) {
      close();
      return;
    }

    saveButton.disabled = true;

    const toAdd = [...selected].filter((day) => !initial.has(day));
    const toRemove = [...initial].filter((day) => !selected.has(day));

    for (const date of toAdd) {
      const existing = await getDailyLog(date);
      const log = existing ?? createEmptyDailyLog(date, 0);
      if (options.kind.type === "b12") {
        log.hadB12Injection = true;
      } else {
        const name = options.kind.medication.name;
        if (!log.medications.includes(name)) {
          log.medications = [...log.medications, name];
        }
      }
      await saveDailyLog(log);
    }

    for (const date of toRemove) {
      const existing = await getDailyLog(date);
      if (!existing) continue;
      if (options.kind.type === "b12") {
        existing.hadB12Injection = false;
      } else {
        const name = options.kind.medication.name;
        existing.medications = existing.medications.filter((item) => item !== name);
      }
      await saveDailyLog(existing);
    }

    close();
    options.onSaved?.();
  });

  document.body.appendChild(overlay);
  render();
}
