import {
  deleteMedication,
  listMedications,
  renameMedicationInLogs,
  saveMedication,
} from "../storage/localStore";
import {
  createId,
  MEDICATION_KINDS,
  type Medication,
  type MedicationKind,
} from "../types";
import { openBulkDayRegistration } from "./bulkRegistration";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function kindIcon(kind: MedicationKind): string {
  if (kind === "Medisin") {
    return `<svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor"><path d="M13.2 2.2a3.8 3.8 0 0 1 0 5.4L7.6 13.2a3.8 3.8 0 1 1-5.4-5.4l5.6-5.6a3.8 3.8 0 0 1 5.4 0z"/></svg>`;
  }
  return `<svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor"><path d="M10 2.2c.5 1.8 1.6 3.2 3.2 4.1-1.6.9-2.7 2.3-3.2 4.1-.5-1.8-1.6-3.2-3.2-4.1C8.4 5.4 9.5 4 10 2.2zm0 8c.4 1.4 1.3 2.5 2.6 3.2-1.3.7-2.2 1.8-2.6 3.2-.4-1.4-1.3-2.5-2.6-3.2 1.3-.7 2.2-1.8 2.6-3.2z"/></svg>`;
}

function medicationCard(medication: Medication): string {
  return `
    <article class="entity-card" data-id="${medication.id}">
      <div class="entity-card-main">
        <div class="entity-icon tint-${medication.kind === "Medisin" ? "green" : "teal"}">
          ${kindIcon(medication.kind)}
        </div>
        <div class="entity-text">
          <h3>${escapeHtml(medication.name)}</h3>
          <p>${escapeHtml(medication.kind)}</p>
        </div>
        <span class="status-badge ${medication.isActive ? "is-active" : "is-paused"}">
          ${medication.isActive ? "I bruk" : "Pause"}
        </span>
      </div>
      <div class="entity-card-actions">
        <button type="button" class="button button-ghost" data-action="bulk" data-id="${medication.id}">Registrer dager</button>
        <button type="button" class="button button-ghost" data-action="edit" data-id="${medication.id}">Rediger</button>
        <button type="button" class="button button-ghost button-danger-text" data-action="delete" data-id="${medication.id}">Slett</button>
      </div>
    </article>
  `;
}

function section(title: string, items: Medication[]): string {
  if (items.length === 0) return "";
  return `
    <section class="entity-section">
      <h2>${title}</h2>
      <div class="entity-list">
        ${items.map(medicationCard).join("")}
      </div>
    </section>
  `;
}

export async function renderMedicationsPage(root: HTMLElement): Promise<void> {
  const medications = await listMedications();
  const active = medications.filter((item) => item.isActive);
  const inactive = medications.filter((item) => !item.isActive);

  root.innerHTML = `
    <div class="overview-page">
      <header class="overview-header">
        <div>
          <h1>Medisinoversikt</h1>
          <p>Tilskudd og medisiner du bruker. Huk av i dagsregistrering når du har tatt dem.</p>
        </div>
        <button type="button" class="button button-primary" data-action="add">Legg til medisin</button>
      </header>

      ${
        medications.length === 0
          ? `
        <div class="empty-state">
          <h2>Ingen medisiner</h2>
          <p>Legg til tilskudd og medisiner du bruker.</p>
          <button type="button" class="button button-primary" data-action="add">Legg til medisin</button>
        </div>
      `
          : `
        ${section("I bruk", active)}
        ${section("Ikke i bruk", inactive)}
      `
      }
    </div>
  `;

  root.querySelectorAll<HTMLButtonElement>('[data-action="add"]').forEach((button) => {
    button.addEventListener("click", () => openMedicationEditor(root));
  });

  root.querySelectorAll<HTMLButtonElement>('[data-action="bulk"]').forEach((button) => {
    button.addEventListener("click", () => {
      const medication = medications.find((item) => item.id === button.dataset.id);
      if (!medication) return;
      void openBulkDayRegistration({
        kind: { type: "medication", medication },
        onSaved: () => {
          void renderMedicationsPage(root);
        },
      });
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-action="edit"]').forEach((button) => {
    button.addEventListener("click", () => {
      const medication = medications.find((item) => item.id === button.dataset.id);
      if (medication) openMedicationEditor(root, medication);
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-action="delete"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const medication = medications.find((item) => item.id === button.dataset.id);
      if (!medication) return;
      if (!confirm(`Slett «${medication.name}»? Historikk i daglogger beholdes.`)) return;
      await deleteMedication(medication.id);
      await renderMedicationsPage(root);
    });
  });
}

function openMedicationEditor(root: HTMLElement, existing?: Medication): void {
  const isEdit = Boolean(existing);
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal editor-modal" role="dialog" aria-modal="true" aria-labelledby="med-editor-title">
      <form id="medication-editor-form" class="editor-form">
        <header class="modal-header">
          <div>
            <p class="modal-kicker">Medisin / tilskudd</p>
            <h2 id="med-editor-title">${isEdit ? "Rediger" : "Legg til"}</h2>
          </div>
          <div class="modal-actions">
            <button type="button" class="button button-ghost" data-action="cancel">Avbryt</button>
            <button type="submit" class="button button-primary">Lagre</button>
          </div>
        </header>
        <div class="editor-body">
          <label class="form-field">
            <span>Navn</span>
            <input name="name" type="text" required maxlength="80" value="${escapeHtml(existing?.name ?? "")}" placeholder="F.eks. B12, magnesium…" autofocus />
          </label>

          <fieldset class="form-field">
            <legend>Type</legend>
            <div class="segmented">
              ${MEDICATION_KINDS.map(
                (kind) => `
                <label class="segmented-option">
                  <input type="radio" name="kind" value="${kind}" ${(existing?.kind ?? "Tilskudd") === kind ? "checked" : ""} />
                  <span>${kind}</span>
                </label>
              `,
              ).join("")}
            </div>
          </fieldset>

          <label class="checkbox-row">
            <input type="checkbox" name="isActive" ${(existing?.isActive ?? true) ? "checked" : ""} />
            <span>I bruk</span>
          </label>
        </div>
      </form>
    </div>
  `;

  const close = () => overlay.remove();
  const form = overlay.querySelector<HTMLFormElement>("#medication-editor-form")!;

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  overlay.querySelector('[data-action="cancel"]')?.addEventListener("click", close);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    if (!name) return;

    const kind = (String(data.get("kind") ?? "Tilskudd") as MedicationKind) || "Tilskudd";
    const isActive = data.get("isActive") === "on";
    const oldName = existing?.name;

    const medication: Medication = {
      id: existing?.id ?? createId(),
      name,
      kind: MEDICATION_KINDS.includes(kind) ? kind : "Tilskudd",
      isActive,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    const all = await listMedications();
    if (all.some((item) => item.id !== medication.id && item.name.toLowerCase() === name.toLowerCase())) {
      alert("Det finnes allerede en medisin med dette navnet.");
      return;
    }

    await saveMedication(medication);
    if (oldName && oldName !== name) {
      await renameMedicationInLogs(oldName, name);
    }

    close();
    await renderMedicationsPage(root);
  });

  document.body.appendChild(overlay);
}
