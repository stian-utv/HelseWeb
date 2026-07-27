import {
  deleteTracker,
  listTrackers,
  renameTrackerValues,
  saveTracker,
} from "../storage/localStore";
import {
  createId,
  TRACKER_TYPES,
  trackerTypeSubtitle,
  type Tracker,
  type TrackerType,
} from "../types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function trackerCard(tracker: Tracker): string {
  const emoji = tracker.emoji.trim() || "📊";
  return `
    <article class="entity-card" data-id="${tracker.id}">
      <div class="entity-card-main">
        <div class="entity-emoji" aria-hidden="true">${escapeHtml(emoji)}</div>
        <div class="entity-text">
          <h3>${escapeHtml(tracker.name)}</h3>
          <p>${escapeHtml(trackerTypeSubtitle(tracker))}</p>
        </div>
        <span class="status-badge ${tracker.isActive ? "is-active" : "is-paused"}">
          ${tracker.isActive ? "I bruk" : "Pause"}
        </span>
      </div>
      <div class="entity-card-actions">
        <button type="button" class="button button-ghost" data-action="edit" data-id="${tracker.id}">Rediger</button>
        <button type="button" class="button button-ghost button-danger-text" data-action="delete" data-id="${tracker.id}">Slett</button>
      </div>
    </article>
  `;
}

function section(title: string, items: Tracker[]): string {
  if (items.length === 0) return "";
  return `
    <section class="entity-section">
      <h2>${title}</h2>
      <div class="entity-list">
        ${items.map(trackerCard).join("")}
      </div>
    </section>
  `;
}

export async function renderTrackersPage(root: HTMLElement): Promise<void> {
  const trackers = await listTrackers();
  const active = trackers.filter((item) => item.isActive);
  const inactive = trackers.filter((item) => !item.isActive);

  root.innerHTML = `
    <div class="overview-page">
      <header class="overview-header">
        <div>
          <h1>Mine trackere</h1>
          <p>Egne målinger du vil følge med på – tall, ja/nei eller skala 0–10.</p>
        </div>
        <button type="button" class="button button-primary" data-action="add">Legg til tracker</button>
      </header>

      ${
        trackers.length === 0
          ? `
        <div class="empty-state">
          <h2>Ingen trackere</h2>
          <p>Legg til vaner du vil følge med på, for eksempel alkohol, trening eller kaffe.</p>
          <button type="button" class="button button-primary" data-action="add">Legg til tracker</button>
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
    button.addEventListener("click", () => openTrackerEditor(root));
  });

  root.querySelectorAll<HTMLButtonElement>('[data-action="edit"]').forEach((button) => {
    button.addEventListener("click", () => {
      const tracker = trackers.find((item) => item.id === button.dataset.id);
      if (tracker) openTrackerEditor(root, tracker);
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-action="delete"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const tracker = trackers.find((item) => item.id === button.dataset.id);
      if (!tracker) return;
      if (!confirm(`Slett «${tracker.name}» og alle registrerte verdier?`)) return;
      await deleteTracker(tracker.id, tracker.name);
      await renderTrackersPage(root);
    });
  });

  // Card tap opens editor
  root.querySelectorAll<HTMLElement>(".entity-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest("button")) return;
      const tracker = trackers.find((item) => item.id === card.dataset.id);
      if (tracker) openTrackerEditor(root, tracker);
    });
  });
}

function openTrackerEditor(root: HTMLElement, existing?: Tracker): void {
  const isEdit = Boolean(existing);
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal editor-modal" role="dialog" aria-modal="true" aria-labelledby="tracker-editor-title">
      <form id="tracker-editor-form" class="editor-form">
        <header class="modal-header">
          <div>
            <p class="modal-kicker">Tracker</p>
            <h2 id="tracker-editor-title">${isEdit ? "Rediger tracker" : "Legg til tracker"}</h2>
          </div>
          <div class="modal-actions">
            <button type="button" class="button button-ghost" data-action="cancel">Avbryt</button>
            <button type="submit" class="button button-primary">Lagre</button>
          </div>
        </header>
        <div class="editor-body">
          <label class="form-field">
            <span>Navn</span>
            <input name="name" type="text" required maxlength="80" value="${escapeHtml(existing?.name ?? "")}" placeholder="F.eks. Alkohol, trening…" autofocus />
          </label>

          <label class="form-field">
            <span>Emoji (valgfritt)</span>
            <input name="emoji" type="text" maxlength="4" value="${escapeHtml(existing?.emoji ?? "")}" placeholder="🍺" />
          </label>

          <fieldset class="form-field">
            <legend>Type</legend>
            <div class="segmented segmented-3">
              ${TRACKER_TYPES.map(
                (type) => `
                <label class="segmented-option">
                  <input type="radio" name="type" value="${type}" ${(existing?.type ?? "Tall") === type ? "checked" : ""} />
                  <span>${type === "Skala" ? "Skala 0–10" : type}</span>
                </label>
              `,
              ).join("")}
            </div>
          </fieldset>

          <label class="form-field unit-field">
            <span>Enhet (valgfritt)</span>
            <input name="unit" type="text" maxlength="20" value="${escapeHtml(existing?.unit ?? "")}" placeholder="f.eks. glass, km" />
          </label>

          <label class="checkbox-row">
            <input type="checkbox" name="isActive" ${(existing?.isActive ?? true) ? "checked" : ""} />
            <span>I bruk</span>
          </label>
        </div>
      </form>
    </div>
  `;

  const close = () => overlay.remove();
  const form = overlay.querySelector<HTMLFormElement>("#tracker-editor-form")!;
  const unitField = overlay.querySelector<HTMLElement>(".unit-field")!;

  const syncUnitVisibility = () => {
    const type = String(new FormData(form).get("type") ?? "Tall") as TrackerType;
    unitField.hidden = type !== "Tall";
  };

  form.querySelectorAll<HTMLInputElement>('input[name="type"]').forEach((input) => {
    input.addEventListener("change", syncUnitVisibility);
  });
  syncUnitVisibility();

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  overlay.querySelector('[data-action="cancel"]')?.addEventListener("click", close);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    if (!name) return;

    const typeRaw = String(data.get("type") ?? "Tall") as TrackerType;
    const type = TRACKER_TYPES.includes(typeRaw) ? typeRaw : "Tall";
    const emoji = Array.from(String(data.get("emoji") ?? "").trim()).slice(0, 2).join("");
    const unit = type === "Tall" ? String(data.get("unit") ?? "").trim() : "";
    const isActive = data.get("isActive") === "on";
    const oldName = existing?.name;

    const tracker: Tracker = {
      id: existing?.id ?? createId(),
      name,
      type,
      unit,
      emoji,
      isActive,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    const all = await listTrackers();
    if (all.some((item) => item.id !== tracker.id && item.name.toLowerCase() === name.toLowerCase())) {
      alert("Det finnes allerede en tracker med dette navnet.");
      return;
    }

    await saveTracker(tracker);
    if (oldName && oldName !== name) {
      await renameTrackerValues(oldName, name);
    }

    close();
    await renderTrackersPage(root);
  });

  document.body.appendChild(overlay);
}
