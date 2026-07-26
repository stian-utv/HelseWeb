import {
  addMonths,
  daysInMonthGrid,
  formatMonthYear,
  parseDateKey,
  toDateKey,
  weekdaySymbols,
} from "../utils/dates";

export type PeriodPreset = "oneMonth" | "threeMonths" | "sixMonths" | "twelveMonths" | "custom";

export type DatePeriod = {
  start: string;
  end: string;
};

export const PERIOD_PRESETS: Array<{ id: PeriodPreset; label: string }> = [
  { id: "oneMonth", label: "1 mnd" },
  { id: "threeMonths", label: "3 mnd" },
  { id: "sixMonths", label: "6 mnd" },
  { id: "twelveMonths", label: "12 mnd" },
  { id: "custom", label: "Egendefinert" },
];

export function defaultPeriod(): DatePeriod {
  return resolvePeriod("oneMonth", toDateKey(new Date()), toDateKey(new Date()))!;
}

export function resolvePeriod(
  preset: PeriodPreset,
  customStart: string,
  customEnd: string,
): DatePeriod | null {
  const end = toDateKey(new Date());

  if (preset === "custom") {
    if (customStart > customEnd) return null;
    return { start: customStart, end: customEnd };
  }

  const endDate = parseDateKey(end);
  const months =
    preset === "oneMonth" ? 1 : preset === "threeMonths" ? 3 : preset === "sixMonths" ? 6 : 12;
  const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - months, endDate.getDate());
  return { start: toDateKey(startDate), end };
}

export function formatPeriodLabel(period: DatePeriod): string {
  const fmt = new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${fmt.format(parseDateKey(period.start))} – ${fmt.format(parseDateKey(period.end))}`;
}

export function openDateRangePicker(options: {
  initialStart: string;
  initialEnd: string;
  onConfirm: (start: string, end: string) => void;
}): void {
  let start = options.initialStart;
  let end = options.initialEnd;
  let selecting: "start" | "end" | "done" = "start";
  let month = parseDateKey(start);

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const render = () => {
    const cells = daysInMonthGrid(month);
    const stepText =
      selecting === "start"
        ? "Trykk på startdato i kalenderen"
        : selecting === "end"
          ? "Trykk på sluttdato — perioden fylles ut underveis"
          : "Periode valgt. Trykk «Velg periode» for å bekrefte.";

    overlay.innerHTML = `
      <div class="modal editor-modal range-picker-modal" role="dialog" aria-modal="true">
        <header class="modal-header">
          <div>
            <p class="modal-kicker">Egendefinert periode</p>
            <h2>Velg periode</h2>
          </div>
          <div class="modal-actions">
            <button type="button" class="button button-ghost" data-action="cancel">Avbryt</button>
          </div>
        </header>
        <div class="editor-body">
          <p class="range-step">${stepText}</p>
          <div class="range-calendar">
            <header class="month-header">
              <button type="button" class="icon-button" data-action="prev">${chevronLeft()}</button>
              <div class="month-title-block">
                <h3 class="month-title">${formatMonthYear(month)}</h3>
              </div>
              <button type="button" class="icon-button" data-action="next">${chevronRight()}</button>
            </header>
            <div class="weekday-header">
              ${weekdaySymbols().map((day) => `<div class="weekday">${day}</div>`).join("")}
            </div>
            <div class="day-grid range-day-grid">
              ${cells
                .map((day) => {
                  if (!day) return `<div class="day-cell day-cell-empty"></div>`;
                  const key = toDateKey(day);
                  const isStart = key === start;
                  const isEnd = key === end;
                  const inRange = start && end && key >= start && key <= end;
                  return `
                    <button type="button" class="range-day ${isStart || isEnd ? "is-endpoint" : ""} ${inRange ? "in-range" : ""}" data-date="${key}">
                      ${day.getDate()}
                    </button>
                  `;
                })
                .join("")}
            </div>
          </div>
          <div class="modal-actions" style="justify-content: flex-end;">
            <button type="button" class="button button-ghost" data-action="reset">Nullstill</button>
            <button type="button" class="button button-primary" data-action="confirm" ${
              selecting === "done" ? "" : "disabled"
            }>Velg periode</button>
          </div>
        </div>
      </div>
    `;

    overlay.querySelector('[data-action="cancel"]')?.addEventListener("click", () => overlay.remove());
    overlay.querySelector('[data-action="prev"]')?.addEventListener("click", () => {
      month = addMonths(month, -1);
      render();
    });
    overlay.querySelector('[data-action="next"]')?.addEventListener("click", () => {
      month = addMonths(month, 1);
      render();
    });
    overlay.querySelector('[data-action="reset"]')?.addEventListener("click", () => {
      start = toDateKey(new Date());
      end = start;
      selecting = "start";
      month = parseDateKey(start);
      render();
    });
    overlay.querySelector('[data-action="confirm"]')?.addEventListener("click", () => {
      if (selecting !== "done") return;
      options.onConfirm(start, end);
      overlay.remove();
    });
    overlay.querySelectorAll<HTMLButtonElement>("[data-date]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.date!;
        if (selecting === "start" || selecting === "done") {
          start = key;
          end = key;
          selecting = "end";
        } else {
          if (key < start) {
            end = start;
            start = key;
          } else {
            end = key;
          }
          selecting = "done";
        }
        render();
      });
    });
  };

  document.body.appendChild(overlay);
  render();
}

function chevronLeft(): string {
  return `<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor"><path d="M10.5 3.2 5.7 8l4.8 4.8-.9.9L4 8l5.6-5.7.9.9z"/></svg>`;
}

function chevronRight(): string {
  return `<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor"><path d="M5.5 3.2 10.3 8l-4.8 4.8.9.9L12 8 6.4 2.3l-.9.9z"/></svg>`;
}
