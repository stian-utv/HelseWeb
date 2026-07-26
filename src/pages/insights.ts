import { b12CompactTitle, currentB12Status } from "../b12/status";
import { buildInsights, lastSevenDays, weekStats } from "../insights/engine";
import { listDailyLogs, listLabResults, loadSettings } from "../storage/localStore";
import { DEFAULT_SETTINGS, type LabResult } from "../types";
import { openB12SettingsModal } from "../ui/b12SettingsModal";
import { parseDateKey } from "../utils/dates";
import { healthScoreBackground } from "../utils/healthScoreColor";
import { openBulkDayRegistration } from "./bulkRegistration";
import { openDayDetail } from "./dayDetail";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatLabValue(lab: LabResult): string {
  const whole = Number.isInteger(lab.value);
  const value = whole ? String(lab.value) : lab.value.toFixed(1).replace(".", ",");
  return lab.unit ? `${value} ${lab.unit}` : value;
}

function formatLabDate(dateKey: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parseDateKey(dateKey));
}

export async function renderInsightsPage(root: HTMLElement): Promise<void> {
  const [logs, labs, storedSettings] = await Promise.all([
    listDailyLogs(),
    listLabResults(),
    loadSettings(),
  ]);
  const settings = storedSettings ?? DEFAULT_SETTINGS;
  const days = lastSevenDays(logs);
  const stats = weekStats(days);
  const insights = buildInsights(logs);
  const b12 = currentB12Status(logs, settings.b12IntervalDays);
  const latestLabs = labs.slice(0, 3);

  root.innerHTML = `
    <div class="insights-page">
      <header class="page-title-block">
        <h1>Innsikt</h1>
        <p>Mønstre og ukeoversikt basert på lokal data.</p>
      </header>

      <section class="insight-section">
        <h2>B12</h2>
        <div class="b12-banner ${b12.kind === "overdue" ? "is-overdue" : ""}">
          <div>
            <strong>${escapeHtml(b12CompactTitle(b12))}</strong>
            <p>Intervall: hver ${settings.b12IntervalDays}. dag</p>
          </div>
          <div class="b12-actions">
            <button type="button" class="button button-ghost" data-action="b12-settings">Innstillinger</button>
            <button type="button" class="button button-primary b12-register" data-action="register-b12">Registrer</button>
          </div>
        </div>
      </section>

      <section class="insight-section">
        <h2>Siste 7 dager</h2>
        <div class="week-grid">
          ${days
            .map((day) => {
              const score = day.log?.healthValue;
              const bg = healthScoreBackground(score);
              return `
                <button type="button" class="week-day ${day.log?.hadB12Injection ? "has-b12" : ""}" data-date="${day.dateKey}">
                  <span class="week-day-label">${escapeHtml(day.weekdayLabel)}</span>
                  <span class="week-day-score" style="background:${bg}">${score ?? "–"}</span>
                </button>
              `;
            })
            .join("")}
        </div>
        <div class="week-stats">
          <div class="week-stat"><span>Registrert</span><strong>${stats.loggedDays}/7</strong></div>
          <div class="week-stat"><span>Snitt score</span><strong>${stats.averageScore}</strong></div>
          <div class="week-stat"><span>B12</span><strong>${stats.b12Count}</strong></div>
        </div>
      </section>

      <section class="insight-section">
        <h2>Mønstre</h2>
        ${
          logs.length === 0
            ? `<p class="hint">Registrer noen dager i kalenderen for å se mønstre her.</p>`
            : insights.length === 0
              ? `<p class="hint">Fortsett å logge – mønstre vises når du har litt mer data.</p>`
              : `<div class="insight-list">
                  ${insights
                    .map(
                      (insight) => `
                    <div class="insight-row tint-${insight.tint}">
                      <span class="insight-dot" aria-hidden="true"></span>
                      <p>${escapeHtml(insight.message)}</p>
                    </div>
                  `,
                    )
                    .join("")}
                </div>`
        }
      </section>

      <section class="insight-section">
        <h2>Siste blodprøver</h2>
        ${
          latestLabs.length === 0
            ? `<p class="hint">Ingen blodprøver registrert ennå.</p>`
            : `<div class="lab-list">
                ${latestLabs
                  .map(
                    (lab) => `
                  <div class="lab-row">
                    <div>
                      <strong>${escapeHtml(lab.testType)}</strong>
                      <span>${escapeHtml(formatLabDate(lab.date))}</span>
                    </div>
                    <strong class="lab-value">${escapeHtml(formatLabValue(lab))}</strong>
                  </div>
                `,
                  )
                  .join("")}
              </div>`
        }
      </section>
    </div>
  `;

  root.querySelectorAll<HTMLButtonElement>("[data-date]").forEach((button) => {
    button.addEventListener("click", () => {
      const dateKey = button.dataset.date!;
      void openDayDetail({
        dateKey,
        existingLog: logs.find((log) => log.date === dateKey),
        onClose: () => {},
        onSaved: () => {
          void renderInsightsPage(root);
        },
      });
    });
  });

  root.querySelector('[data-action="register-b12"]')?.addEventListener("click", () => {
    void openBulkDayRegistration({
      kind: { type: "b12" },
      onSaved: () => {
        void renderInsightsPage(root);
      },
    });
  });

  root.querySelector('[data-action="b12-settings"]')?.addEventListener("click", () => {
    void openB12SettingsModal({
      onSaved: () => {
        void renderInsightsPage(root);
      },
    });
  });
}
