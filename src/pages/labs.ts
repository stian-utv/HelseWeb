import {
  deleteLabAnalysis,
  deleteLabResult,
  listLabAnalyses,
  listLabResults,
  renameLabResults,
  saveLabAnalysis,
  saveLabResult,
} from "../storage/localStore";
import {
  createId,
  labResultId,
  type LabAnalysis,
  type LabResult,
} from "../types";
import { toDateKey } from "../utils/dates";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1).replace(".", ",");
}

function formatDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function vialIcon(): string {
  return `<svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor"><path d="M8 2h4v2.2l3.2 5.2c.5.8.8 1.7.8 2.7A5 5 0 0 1 11 17H9a5 5 0 0 1-5-4.9c0-1 .3-1.9.8-2.7L8 4.2V2zm1.5 1.5v1.1l-.3.4-3 4.9c-.3.5-.5 1-.5 1.6A3.5 3.5 0 0 0 9 15.5h2a3.5 3.5 0 0 0 3.3-3.5c0-.6-.2-1.1-.5-1.6l-3-4.9-.3-.4V3.5h-1z"/></svg>`;
}

function analysisCard(analysis: LabAnalysis): string {
  return `
    <article class="entity-card" data-analysis-id="${escapeHtml(analysis.id)}">
      <div class="entity-card-main">
        <div class="entity-icon tint-purple">${vialIcon()}</div>
        <div class="entity-text">
          <h3>${escapeHtml(analysis.name)}</h3>
          <p>${analysis.unit ? escapeHtml(analysis.unit) : "Ingen enhet"}</p>
        </div>
        <span class="status-badge ${analysis.isActive ? "is-active" : "is-paused"}">
          ${analysis.isActive ? "Aktiv" : "Skjult"}
        </span>
      </div>
      <div class="entity-card-actions">
        <button type="button" class="button button-ghost" data-action="edit-analysis" data-id="${escapeHtml(analysis.id)}">Rediger</button>
        <button type="button" class="button button-ghost button-danger-text" data-action="delete-analysis" data-id="${escapeHtml(analysis.id)}">Slett</button>
      </div>
    </article>
  `;
}

function labCard(result: LabResult): string {
  return `
    <article class="entity-card" data-id="${escapeHtml(result.id)}">
      <div class="entity-card-main">
        <div class="entity-icon tint-purple">${vialIcon()}</div>
        <div class="entity-text">
          <h3>${escapeHtml(result.testType)}</h3>
          <p class="lab-card-value">${escapeHtml(formatValue(result.value))} ${escapeHtml(result.unit)}</p>
          <p>${escapeHtml(formatDate(result.date))}${
            result.note ? ` · ${escapeHtml(result.note)}` : ""
          }</p>
        </div>
      </div>
      <div class="entity-card-actions">
        <button type="button" class="button button-ghost" data-action="edit-result" data-id="${escapeHtml(result.id)}">Rediger</button>
        <button type="button" class="button button-ghost button-danger-text" data-action="delete-result" data-id="${escapeHtml(result.id)}">Slett</button>
      </div>
    </article>
  `;
}

type LabsTab = "results" | "analyses";
let activeLabsTab: LabsTab = "results";

export async function renderLabsPage(root: HTMLElement): Promise<void> {
  const [analyses, results] = await Promise.all([listLabAnalyses(), listLabResults()]);
  const active = analyses.filter((item) => item.isActive);
  const inactive = analyses.filter((item) => !item.isActive);

  root.innerHTML = `
    <div class="overview-page">
      <header class="overview-header">
        <div>
          <h1>Blodprøver</h1>
          <p>${
            activeLabsTab === "results"
              ? "Registrer og følg prøvesvar over tid."
              : "Administrer hvilke analyser du vil følge."
          }</p>
        </div>
        <div class="overview-header-actions">
          ${
            activeLabsTab === "analyses"
              ? `<button type="button" class="button button-primary" data-action="add-analysis">Ny analyse</button>`
              : `<button type="button" class="button button-primary" data-action="add-result" ${active.length === 0 ? "disabled" : ""}>Registrer prøve</button>`
          }
        </div>
      </header>

      <div class="page-tabs" role="tablist" aria-label="Blodprøver">
        <button
          type="button"
          class="page-tab ${activeLabsTab === "results" ? "is-active" : ""}"
          data-labs-tab="results"
          role="tab"
          aria-selected="${activeLabsTab === "results"}"
        >Prøvesvar</button>
        <button
          type="button"
          class="page-tab ${activeLabsTab === "analyses" ? "is-active" : ""}"
          data-labs-tab="analyses"
          role="tab"
          aria-selected="${activeLabsTab === "analyses"}"
        >Analyser</button>
      </div>

      ${
        activeLabsTab === "analyses"
          ? `
        <section class="entity-section">
          <h2>Mine analyser <span class="section-count">${analyses.length}</span></h2>
          ${
            analyses.length === 0
              ? `
            <div class="empty-state compact">
              <p>Legg til analyser du vil følge — f.eks. B12, ferritin eller TSH.</p>
              <button type="button" class="button button-primary" data-action="add-analysis">Ny analyse</button>
            </div>
          `
              : `
            <div class="entity-list">
              ${active.map(analysisCard).join("")}
              ${inactive.map(analysisCard).join("")}
            </div>
          `
          }
        </section>
      `
          : `
        <section class="entity-section">
          <h2>Registrerte prøver <span class="section-count">${results.length}</span></h2>
          ${
            results.length === 0
              ? `
            <div class="empty-state compact">
              <p>${
                active.length === 0
                  ? "Opprett minst én analyse under fanen Analyser først."
                  : "Ingen prøver registrert ennå."
              }</p>
              ${
                active.length > 0
                  ? `<button type="button" class="button button-primary" data-action="add-result">Registrer prøve</button>`
                  : `<button type="button" class="button button-ghost" data-labs-tab="analyses">Gå til analyser</button>`
              }
            </div>
          `
              : `<div class="entity-list">${results.map(labCard).join("")}</div>`
          }
        </section>
      `
      }
    </div>
  `;

  root.querySelectorAll<HTMLButtonElement>("[data-labs-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeLabsTab = (button.dataset.labsTab as LabsTab) || "results";
      void renderLabsPage(root);
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-action="add-analysis"]').forEach((button) => {
    button.addEventListener("click", () => openAnalysisEditor(root));
  });

  root.querySelectorAll<HTMLButtonElement>('[data-action="edit-analysis"]').forEach((button) => {
    button.addEventListener("click", () => {
      const analysis = analyses.find((item) => item.id === button.dataset.id);
      if (analysis) openAnalysisEditor(root, analysis);
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-action="delete-analysis"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const analysis = analyses.find((item) => item.id === button.dataset.id);
      if (!analysis) return;
      const linked = results.filter((item) => item.testType === analysis.name).length;
      const message =
        linked > 0
          ? `Slett «${analysis.name}»? ${linked} registrerte prøver beholdes i historikken.`
          : `Slett «${analysis.name}»?`;
      if (!confirm(message)) return;
      await deleteLabAnalysis(analysis.id);
      await renderLabsPage(root);
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-action="add-result"]').forEach((button) => {
    button.addEventListener("click", () => {
      if (active.length === 0) return;
      openResultEditor(root, analyses);
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-action="edit-result"]').forEach((button) => {
    button.addEventListener("click", () => {
      const result = results.find((item) => item.id === button.dataset.id);
      if (result) openResultEditor(root, analyses, result);
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-action="delete-result"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const result = results.find((item) => item.id === button.dataset.id);
      if (!result) return;
      if (!confirm(`Slett ${result.testType} fra ${formatDate(result.date)}?`)) return;
      await deleteLabResult(result.id);
      await renderLabsPage(root);
    });
  });
}

function openAnalysisEditor(root: HTMLElement, existing?: LabAnalysis): void {
  const isEdit = Boolean(existing);
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal editor-modal" role="dialog" aria-modal="true" aria-labelledby="lab-analysis-title">
      <form id="lab-analysis-form" class="editor-form">
        <header class="modal-header">
          <div>
            <p class="modal-kicker">Analyse</p>
            <h2 id="lab-analysis-title">${isEdit ? "Rediger analyse" : "Ny analyse"}</h2>
          </div>
          <div class="modal-actions">
            <button type="button" class="button button-ghost" data-action="cancel">Avbryt</button>
            <button type="submit" class="button button-primary">Lagre</button>
          </div>
        </header>
        <div class="editor-body">
          <label class="form-field">
            <span>Navn</span>
            <input name="name" type="text" required maxlength="80" value="${escapeHtml(existing?.name ?? "")}" placeholder="F.eks. Ferritin, TSH, B12…" autofocus />
          </label>
          <label class="form-field">
            <span>Enhet</span>
            <input name="unit" type="text" maxlength="40" value="${escapeHtml(existing?.unit ?? "")}" placeholder="F.eks. pmol/L, µg/L…" />
          </label>
          <label class="checkbox-row">
            <input type="checkbox" name="isActive" ${(existing?.isActive ?? true) ? "checked" : ""} />
            <span>Aktiv (vises ved registrering)</span>
          </label>
        </div>
      </form>
    </div>
  `;

  const close = () => overlay.remove();
  const form = overlay.querySelector<HTMLFormElement>("#lab-analysis-form")!;

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  overlay.querySelector('[data-action="cancel"]')?.addEventListener("click", close);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const unit = String(data.get("unit") ?? "").trim();
    const isActive = data.get("isActive") === "on";
    if (!name) return;

    const all = await listLabAnalyses();
    const duplicate = all.find(
      (item) =>
        item.id !== existing?.id &&
        item.name.toLocaleLowerCase("nb") === name.toLocaleLowerCase("nb"),
    );
    if (duplicate) {
      alert(`Du har allerede en analyse som heter «${duplicate.name}».`);
      return;
    }

    if (existing && existing.name !== name) {
      await renameLabResults(existing.name, name);
    }

    await saveLabAnalysis({
      id: existing?.id ?? createId(),
      name,
      unit,
      isActive,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });

    close();
    await renderLabsPage(root);
  });

  document.body.appendChild(overlay);
}

function openResultEditor(
  root: HTMLElement,
  analyses: LabAnalysis[],
  existing?: LabResult,
): void {
  const selectable = analyses.filter((item) => item.isActive || item.name === existing?.testType);
  if (selectable.length === 0) {
    alert("Legg til minst én aktiv analyse først.");
    return;
  }

  const initialName = existing?.testType ?? selectable[0]!.name;
  const initialAnalysis = selectable.find((item) => item.name === initialName) ?? selectable[0]!;
  const isEdit = Boolean(existing);

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal editor-modal" role="dialog" aria-modal="true" aria-labelledby="lab-result-title">
      <form id="lab-result-form" class="editor-form">
        <header class="modal-header">
          <div>
            <p class="modal-kicker">Blodprøve</p>
            <h2 id="lab-result-title">${isEdit ? "Rediger blodprøve" : "Registrer prøve"}</h2>
          </div>
          <div class="modal-actions">
            <button type="button" class="button button-ghost" data-action="cancel">Avbryt</button>
            <button type="submit" class="button button-primary">Lagre</button>
          </div>
        </header>
        <div class="editor-body">
          <label class="form-field">
            <span>Dato</span>
            <input name="date" type="date" required value="${escapeHtml(existing?.date ?? toDateKey(new Date()))}" />
          </label>

          <label class="form-field">
            <span>Analyse</span>
            <select name="testType" required>
              ${selectable
                .map(
                  (item) => `
                <option value="${escapeHtml(item.name)}" ${item.name === initialName ? "selected" : ""}>
                  ${escapeHtml(item.name)}${item.unit ? ` (${escapeHtml(item.unit)})` : ""}
                </option>
              `,
                )
                .join("")}
            </select>
          </label>

          <label class="form-field">
            <span>Verdi</span>
            <div class="input-with-suffix">
              <input
                name="value"
                type="text"
                inputmode="decimal"
                required
                value="${existing != null ? escapeHtml(formatValue(existing.value)) : ""}"
                autofocus
              />
              <span class="input-suffix" data-unit>${escapeHtml(existing?.unit || initialAnalysis.unit)}</span>
            </div>
          </label>

          <label class="form-field">
            <span>Enhet</span>
            <input name="unit" type="text" maxlength="40" value="${escapeHtml(existing?.unit || initialAnalysis.unit)}" />
          </label>

          <label class="form-field">
            <span>Notat (valgfritt)</span>
            <textarea name="note" rows="3" maxlength="400">${escapeHtml(existing?.note ?? "")}</textarea>
          </label>

          ${
            isEdit
              ? `
            <button type="button" class="button button-danger-text" data-action="delete-result">
              Slett blodprøve
            </button>
          `
              : ""
          }
        </div>
      </form>
    </div>
  `;

  const close = () => overlay.remove();
  const form = overlay.querySelector<HTMLFormElement>("#lab-result-form")!;
  const unitEl = overlay.querySelector<HTMLElement>("[data-unit]")!;
  const unitInput = form.querySelector<HTMLInputElement>('input[name="unit"]')!;
  const typeSelect = form.querySelector<HTMLSelectElement>('select[name="testType"]')!;

  const syncUnitFromAnalysis = () => {
    const analysis = selectable.find((item) => item.name === typeSelect.value);
    if (!analysis) return;
    unitInput.value = analysis.unit;
    unitEl.textContent = analysis.unit;
  };

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  overlay.querySelector('[data-action="cancel"]')?.addEventListener("click", close);
  typeSelect.addEventListener("change", syncUnitFromAnalysis);
  unitInput.addEventListener("input", () => {
    unitEl.textContent = unitInput.value;
  });

  overlay.querySelector('[data-action="delete-result"]')?.addEventListener("click", async () => {
    if (!existing) return;
    if (!confirm(`Slett ${existing.testType} fra ${formatDate(existing.date)}?`)) return;
    await deleteLabResult(existing.id);
    close();
    await renderLabsPage(root);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const date = String(data.get("date") ?? "").trim();
    const testType = String(data.get("testType") ?? "").trim();
    const unit = String(data.get("unit") ?? "").trim();
    const valueText = String(data.get("value") ?? "")
      .trim()
      .replace(",", ".");
    const value = Number(valueText);
    const note = String(data.get("note") ?? "").trim();

    if (!date || !testType || !Number.isFinite(value) || value < 0) {
      alert("Skriv inn en gyldig verdi (0 eller høyere).");
      return;
    }

    const nextId = labResultId(date, testType);
    if (!existing || existing.id !== nextId) {
      const all = await listLabResults();
      if (all.some((item) => item.id === nextId && item.id !== existing?.id)) {
        alert(`Det finnes allerede en ${testType}-prøve for denne datoen.`);
        return;
      }
    }

    if (existing && existing.id !== nextId) {
      await deleteLabResult(existing.id);
    }

    await saveLabResult({
      id: nextId,
      date,
      testType,
      value,
      unit,
      note,
    });

    close();
    await renderLabsPage(root);
  });

  document.body.appendChild(overlay);
}
