import { renderInjectionIntervalPanel } from "./injectionInterval";
import { renderLongTermPanel } from "./longTerm";
import { renderTimelinePanel } from "./timeline";
import { renderTrendsPage } from "./trends";

export type OverviewTab = "timeline" | "longterm" | "interval" | "charts";

let activeTab: OverviewTab = "timeline";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const TABS: Array<{ id: OverviewTab; label: string; hint: string }> = [
  { id: "timeline", label: "Tidslinje", hint: "Hendelser dag for dag" },
  { id: "longterm", label: "Langsiktig", hint: "Helhetsbilde over måneder" },
  {
    id: "interval",
    label: "Behandlingsrespons",
    hint: "Form og B12-sprøyter på samme tidslinje",
  },
  { id: "charts", label: "Grafer", hint: "Sammenlign datapunkter" },
];

export async function renderOverviewPage(root: HTMLElement): Promise<void> {
  const active = TABS.find((tab) => tab.id === activeTab) ?? TABS[0]!;

  root.innerHTML = `
    <div class="overview-page overview-shell">
      <header class="overview-header">
        <div>
          <h1>Oversikt</h1>
          <p>${escapeHtml(active.hint)}</p>
        </div>
      </header>

      <div class="page-tabs" role="tablist" aria-label="Oversiktsvisning">
        ${TABS.map(
          (tab) => `
          <button
            type="button"
            class="page-tab ${activeTab === tab.id ? "is-active" : ""}"
            data-overview-tab="${tab.id}"
            role="tab"
            aria-selected="${activeTab === tab.id}"
          >${tab.label}</button>
        `,
        ).join("")}
      </div>

      <div id="overview-panel" class="overview-panel"></div>
    </div>
  `;

  root.querySelectorAll<HTMLButtonElement>("[data-overview-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTab = (button.dataset.overviewTab as OverviewTab) || "timeline";
      void renderOverviewPage(root);
    });
  });

  const panel = root.querySelector<HTMLElement>("#overview-panel");
  if (!panel) return;

  if (activeTab === "timeline") {
    await renderTimelinePanel(panel, () => {
      void renderOverviewPage(root);
    });
    return;
  }

  if (activeTab === "longterm") {
    await renderLongTermPanel(panel);
    return;
  }

  if (activeTab === "interval") {
    await renderInjectionIntervalPanel(panel);
    return;
  }

  await renderTrendsPage(panel, { embedded: true });
}
