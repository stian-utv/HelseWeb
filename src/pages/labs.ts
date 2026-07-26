import { deleteLabResult, listLabResults, saveLabResult } from "../storage/localStore";
import {
  LAB_TEST_TYPES,
  labResultId,
  labTestDefaultUnit,
  type LabResult,
  type LabTestType,
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

function labCard(result: LabResult): string {
  return `
    <article class="entity-card" data-id="${escapeHtml(result.id)}">
      <div class="entity-card-main">
        <div class="entity-icon tint-purple">
          ${vialIcon()}
        </div>
        <div class="entity-text">
          <h3>${escapeHtml(result.testType)}</h3>
          <p class="lab-card-value">${escapeHtml(formatValue(result.value))} ${escapeHtml(result.unit)}</p>
          <p>${escapeHtml(formatDate(result.date))}${
            result.note ? ` · ${escapeHtml(result.note)}` : ""
          }</p>
        </div>
      </div>
      <div class="entity-card-actions">
        <button type="button" class="button button-ghost" data-action="edit" data-id="${escapeHtml(result.id)}">Rediger</button>
        <button type="button" class="button button-ghost button-danger-text" data-action="delete" data-id="${escapeHtml(result.id)}">Slett</button>
      </div>
    </article>
  `;
}

export async function renderLabsPage(root: HTMLElement): Promise<void> {
  const results = await listLabResults();

  root.innerHTML = `
    <div class="overview-page">
      <header class="overview-header">
        <div>
          <h1>Blodprøver</h1>
          <p>Registrer B12, folat, MMA og homocystein. Vises også under Innsikt.</p>
        </div>
        <button type="button" class="button button-primary" data-action="add">Legg til blodprøve</button>
      </header>

      ${
        results.length === 0
          ? `
        <div class="empty-state">
          <h2>Ingen blodprøver</h2>
          <p>Legg til B12, folat, MMA eller homocystein.</p>
          <button type="button" class="button button-primary" data-action="add">Legg til blodprøve</button>
        </div>
      `
          : `
        <section class="entity-section">
          <h2>Registrerte prøver <span class="section-count">${results.length}</span></h2>
          <div class="entity-list">
            ${results.map(labCard).join("")}
          </div>
        </section>
      `
      }
    </div>
  `;

  root.querySelectorAll<HTMLButtonElement>('[data-action="add"]').forEach((button) => {
    button.addEventListener("click", () => openLabEditor(root));
  });

  root.querySelectorAll<HTMLButtonElement>('[data-action="edit"]').forEach((button) => {
    button.addEventListener("click", () => {
      const result = results.find((item) => item.id === button.dataset.id);
      if (result) openLabEditor(root, result);
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-action="delete"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const result = results.find((item) => item.id === button.dataset.id);
      if (!result) return;
      if (!confirm(`Slett ${result.testType} fra ${formatDate(result.date)}?`)) return;
      await deleteLabResult(result.id);
      await renderLabsPage(root);
    });
  });
}

function openLabEditor(root: HTMLElement, existing?: LabResult): void {
  const isEdit = Boolean(existing);
  const initialType: LabTestType = existing?.testType ?? "B12";
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal editor-modal" role="dialog" aria-modal="true" aria-labelledby="lab-editor-title">
      <form id="lab-editor-form" class="editor-form">
        <header class="modal-header">
          <div>
            <p class="modal-kicker">Blodprøve</p>
            <h2 id="lab-editor-title">${isEdit ? "Rediger blodprøve" : "Ny blodprøve"}</h2>
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

          <fieldset class="form-field">
            <legend>Prøve</legend>
            <div class="segmented">
              ${LAB_TEST_TYPES.map(
                (type) => `
                <label class="segmented-option">
                  <input type="radio" name="testType" value="${type}" ${initialType === type ? "checked" : ""} />
                  <span>${type}</span>
                </label>
              `,
              ).join("")}
            </div>
          </fieldset>

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
              <span class="input-suffix" data-unit>${escapeHtml(labTestDefaultUnit(initialType))}</span>
            </div>
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
  const form = overlay.querySelector<HTMLFormElement>("#lab-editor-form")!;
  const unitEl = overlay.querySelector<HTMLElement>("[data-unit]")!;

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  overlay.querySelector('[data-action="cancel"]')?.addEventListener("click", close);

  form.querySelectorAll<HTMLInputElement>('input[name="testType"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      unitEl.textContent = labTestDefaultUnit(input.value as LabTestType);
    });
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
    const testTypeRaw = String(data.get("testType") ?? "B12") as LabTestType;
    const testType = LAB_TEST_TYPES.includes(testTypeRaw) ? testTypeRaw : "B12";
    const valueText = String(data.get("value") ?? "")
      .trim()
      .replace(",", ".");
    const value = Number(valueText);
    const note = String(data.get("note") ?? "").trim();

    if (!date || !Number.isFinite(value) || value < 0) {
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
      unit: labTestDefaultUnit(testType),
      note,
    });

    close();
    await renderLabsPage(root);
  });

  document.body.appendChild(overlay);
}
