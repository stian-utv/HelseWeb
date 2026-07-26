import {
  DEFAULT_ENABLED_SYMPTOMS,
  SYMPTOM_CATALOG,
  SYMPTOM_CATEGORIES,
  normalizeEnabledSymptoms,
} from "../symptoms/catalog";
import { loadSettings, saveSettings } from "../storage/localStore";
import { DEFAULT_SETTINGS } from "../types";

export async function renderSymptomsPage(root: HTMLElement): Promise<void> {
  const stored = (await loadSettings()) ?? DEFAULT_SETTINGS;
  let enabled = new Set(normalizeEnabledSymptoms(stored.enabledSymptoms));

  const render = () => {
    root.innerHTML = `
      <div class="overview-page symptoms-page">
        <header class="overview-header">
          <div>
            <h1>Symptomer</h1>
            <p>
              Velg hvilke B12-relaterte symptomer som skal vises i dagsregistrering, kalender og grafer.
              Du kan endre dette når som helst.
            </p>
          </div>
          <div class="symptoms-header-actions">
            <button type="button" class="button button-ghost" data-action="select-defaults">Standardvalg</button>
            <button type="button" class="button button-ghost" data-action="clear-all">Fjern alle</button>
          </div>
        </header>

        <p class="hint">${enabled.size} av ${SYMPTOM_CATALOG.length} symptomer aktive</p>

        ${SYMPTOM_CATEGORIES.map((category) => {
          const items = SYMPTOM_CATALOG.filter((item) => item.category === category.id);
          return `
            <section class="insight-section">
              <h2>${category.title}</h2>
              <div class="symptom-toggle-list">
                ${items
                  .map((item) => {
                    const checked = enabled.has(item.id);
                    return `
                      <label class="symptom-toggle ${checked ? "is-on" : ""}">
                        <input type="checkbox" data-symptom="${item.id}" ${checked ? "checked" : ""} />
                        <span class="symptom-toggle-text">
                          <strong>${item.label}</strong>
                          <small>${item.description}</small>
                        </span>
                      </label>
                    `;
                  })
                  .join("")}
              </div>
            </section>
          `;
        }).join("")}
      </div>
    `;

    root.querySelectorAll<HTMLInputElement>("[data-symptom]").forEach((input) => {
      input.addEventListener("change", async () => {
        const id = input.dataset.symptom!;
        if (input.checked) enabled.add(id);
        else enabled.delete(id);

        // Keep at least one symptom for a usable day log
        if (enabled.size === 0) {
          enabled = new Set(DEFAULT_ENABLED_SYMPTOMS);
          alert("Minst ett symptom må være aktivt. Satte tilbake standardvalg.");
        }

        await saveSettings({
          ...stored,
          ...((await loadSettings()) ?? DEFAULT_SETTINGS),
          enabledSymptoms: [...enabled],
        });
        render();
      });
    });

    root.querySelector('[data-action="select-defaults"]')?.addEventListener("click", async () => {
      enabled = new Set(DEFAULT_ENABLED_SYMPTOMS);
      await saveSettings({
        ...((await loadSettings()) ?? DEFAULT_SETTINGS),
        enabledSymptoms: [...enabled],
      });
      render();
    });

    root.querySelector('[data-action="clear-all"]')?.addEventListener("click", async () => {
      if (!confirm("Fjerne alle symptomer? Standardvalg settes på igjen.")) return;
      enabled = new Set(DEFAULT_ENABLED_SYMPTOMS);
      await saveSettings({
        ...((await loadSettings()) ?? DEFAULT_SETTINGS),
        enabledSymptoms: [...enabled],
      });
      render();
    });
  };

  render();
}
