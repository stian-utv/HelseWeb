import { renderCalendarPage } from "./pages/calendar";
import { renderLabsPage } from "./pages/labs";
import { renderMedicationsPage } from "./pages/medications";
import { renderSymptomsPage } from "./pages/symptoms";
import { renderTrackersPage } from "./pages/trackers";
import { renderTrendsPage } from "./pages/trends";
import { bindDataTransferMenu, dataMenuMarkup } from "./ui/dataTransferMenu";

export type AppSection =
  | "calendar"
  | "medication"
  | "trackers"
  | "symptoms"
  | "labs"
  | "trends";

const sections: Array<{
  id: AppSection;
  title: string;
  subtitle: string;
  tint: string;
  icon: string;
}> = [
  {
    id: "calendar",
    title: "Kalender",
    subtitle: "Daglig registrering",
    tint: "blue",
    icon: calendarIcon(),
  },
  {
    id: "medication",
    title: "Medisin",
    subtitle: "Tilskudd og medisin",
    tint: "green",
    icon: pillsIcon(),
  },
  {
    id: "trackers",
    title: "Trackere",
    subtitle: "Egne målinger",
    tint: "orange",
    icon: chartIcon(),
  },
  {
    id: "symptoms",
    title: "Symptomer",
    subtitle: "Tilpass dagloggen",
    tint: "pink",
    icon: heartIcon(),
  },
  {
    id: "labs",
    title: "Blodprøver",
    subtitle: "B12, folat m.m.",
    tint: "purple",
    icon: vialIcon(),
  },
  {
    id: "trends",
    title: "Grafer",
    subtitle: "Sammenlign over tid",
    tint: "teal",
    icon: trendsIcon(),
  },
];

let currentSection: AppSection = "calendar";

export async function renderApp(root: HTMLElement): Promise<void> {
  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-header-top">
            <div>
              <h1>HelseApp</h1>
              <p class="sidebar-tagline">Loggfør helsen din dag for dag.</p>
            </div>
            ${dataMenuMarkup()}
          </div>
          <p class="app-disclaimer">
            Et hobbyprosjekt til egen testing — ikke medisinsk råd, og bruk skjer på eget ansvar.
            Det du logger blir liggende i nettleseren på denne enheten. Hvis flere bruker samme
            nettleser, eller den synker mellom telefon og PC, kan andre også se loggen din.
          </p>
        </div>
        <div class="sidebar-menu">
          <p class="sidebar-menu-label">Meny</p>
          <nav class="sidebar-nav" aria-label="Hovedmeny">
            ${sections
              .map(
                (section) => `
              <button
                type="button"
                class="sidebar-row tint-${section.tint} ${section.id === currentSection ? "is-selected" : ""}"
                data-section="${section.id}"
              >
                <span class="sidebar-row-icon" aria-hidden="true">${section.icon}</span>
                <span class="sidebar-row-text">
                  <span class="sidebar-row-title">${section.title}</span>
                  <span class="sidebar-row-subtitle">${section.subtitle}</span>
                </span>
              </button>
            `,
              )
              .join("")}
          </nav>
        </div>
      </aside>
      <main class="main-pane">
        <div class="main-content" id="main-content"></div>
      </main>
    </div>
  `;

  root.querySelectorAll<HTMLButtonElement>("[data-section]").forEach((button) => {
    button.addEventListener("click", () => {
      const section = button.dataset.section as AppSection | undefined;
      if (!section) return;
      if (section === currentSection) {
        void showSection(root, section);
        return;
      }
      currentSection = section;
      root.querySelectorAll(".sidebar-row").forEach((row) => {
        row.classList.toggle("is-selected", row.getAttribute("data-section") === section);
      });
      void showSection(root, section);
    });
  });

  bindDataTransferMenu(root, {
    onImported: () => {
      void showSection(root, currentSection);
    },
  });

  await showSection(root, currentSection);
}

async function showSection(root: HTMLElement, section: AppSection): Promise<void> {
  const content = root.querySelector<HTMLElement>("#main-content");
  if (!content) return;

  if (section === "calendar") {
    await renderCalendarPage(content);
    return;
  }

  if (section === "medication") {
    await renderMedicationsPage(content);
    return;
  }

  if (section === "trackers") {
    await renderTrackersPage(content);
    return;
  }

  if (section === "symptoms") {
    await renderSymptomsPage(content);
    return;
  }

  if (section === "labs") {
    await renderLabsPage(content);
    return;
  }

  if (section === "trends") {
    await renderTrendsPage(content);
    return;
  }
}

function calendarIcon(): string {
  return `<svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor"><path d="M6 2v2H4.5A1.5 1.5 0 0 0 3 5.5v11A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 15.5 4H14V2h-1.5v2h-5V2H6zm9.5 6h-11v7.5h11V8z"/></svg>`;
}

function pillsIcon(): string {
  return `<svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor"><path d="M13.2 2.2a3.8 3.8 0 0 1 0 5.4L7.6 13.2a3.8 3.8 0 1 1-5.4-5.4l5.6-5.6a3.8 3.8 0 0 1 5.4 0zM3.8 8.9a2 2 0 0 0 2.8 2.8l1.9-1.9-2.8-2.8-1.9 1.9zm10.5-5.2a2 2 0 0 0-2.8 0L9.6 5.6l2.8 2.8 1.9-1.9a2 2 0 0 0 0-2.8z"/></svg>`;
}

function chartIcon(): string {
  return `<svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor"><path d="M3 16h14v1.5H3V16zm2-1V9h2.2v6H5zm4.4 0V5h2.2v10H9.4zm4.4 0v-4H16v4h-2.2z"/></svg>`;
}

function heartIcon(): string {
  return `<svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor"><path d="M10 17.2 8.6 15.9C4.4 12.1 1.7 9.6 1.7 6.6A3.9 3.9 0 0 1 5.6 2.7c1.3 0 2.5.6 3.3 1.5L10 5.4l1.1-1.2c.8-.9 2-1.5 3.3-1.5a3.9 3.9 0 0 1 3.9 3.9c0 3-2.7 5.5-6.9 9.3L10 17.2z"/></svg>`;
}

function vialIcon(): string {
  return `<svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor"><path d="M8 2h4v2.2l3.2 5.2c.5.8.8 1.7.8 2.7A5 5 0 0 1 11 17H9a5 5 0 0 1-5-4.9c0-1 .3-1.9.8-2.7L8 4.2V2zm1.5 1.5v1.1l-.3.4-3 4.9c-.3.5-.5 1-.5 1.6A3.5 3.5 0 0 0 9 15.5h2a3.5 3.5 0 0 0 3.3-3.5c0-.6-.2-1.1-.5-1.6l-3-4.9-.3-.4V3.5h-1z"/></svg>`;
}

function trendsIcon(): string {
  return `<svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor"><path d="M3 15.5 8.2 9l3.2 3.2L17 5.8V8h1.5V3.5H14V5h2.1l-4.7 5.8-3.2-3.2L3 14.2V15.5z"/></svg>`;
}
