import {
  exportJsonBackup,
  formatImportSummary,
  importJsonBackup,
  type ImportMode,
} from "../transfer/dataTransfer";

type DataTransferMenuOptions = {
  onImported: () => void;
};

export function bindDataTransferMenu(
  root: HTMLElement,
  options: DataTransferMenuOptions,
): void {
  const trigger = root.querySelector<HTMLButtonElement>("[data-action='data-menu']");
  const panel = root.querySelector<HTMLElement>("[data-data-menu]");
  if (!trigger || !panel) return;

  const closeMenu = () => {
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  };

  const openMenu = () => {
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
  };

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    if (panel.hidden) openMenu();
    else closeMenu();
  });

  document.addEventListener("click", (event) => {
    if (!panel.hidden && !panel.contains(event.target as Node) && event.target !== trigger) {
      closeMenu();
    }
  });

  panel.querySelector('[data-action="export-json"]')?.addEventListener("click", async () => {
    closeMenu();
    try {
      await exportJsonBackup();
      showToast("Eksport fullført.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Kunne ikke eksportere data.");
    }
  });

  panel.querySelector('[data-action="import-json"]')?.addEventListener("click", () => {
    closeMenu();
    openImportDialog(options.onImported);
  });
}

export function dataMenuMarkup(): string {
  return `
    <div class="data-menu-wrap">
      <button
        type="button"
        class="button button-ghost data-menu-button"
        data-action="data-menu"
        aria-expanded="false"
        aria-haspopup="true"
      >
        ${transferIcon()}
        <span>Data</span>
      </button>
      <div class="data-menu-panel" data-data-menu hidden>
        <button type="button" data-action="export-json">Eksporter JSON (full backup)</button>
        <button type="button" data-action="import-json">Importer data…</button>
      </div>
    </div>
  `;
}

function openImportDialog(onImported: () => void): void {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal editor-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
      <form id="import-form" class="editor-form">
        <header class="modal-header">
          <div>
            <p class="modal-kicker">Dataoverføring</p>
            <h2 id="import-title">Importer data</h2>
          </div>
          <div class="modal-actions">
            <button type="button" class="button button-ghost" data-action="cancel">Avbryt</button>
            <button type="submit" class="button button-primary">Importer</button>
          </div>
        </header>
        <div class="editor-body">
          <p class="hint">
            Velg om importen skal slås sammen med det du har, eller erstatte eksisterende data.
            Støtter JSON-backup fra HelseApp (Mac/web).
          </p>

          <fieldset class="form-field">
            <legend>Importmodus</legend>
            <label class="radio-card">
              <input type="radio" name="mode" value="merge" checked />
              <span>
                <strong>Legg til (behold eksisterende)</strong>
                <small>Nye data slås sammen med det du har. Eksisterende dager oppdateres ved lik dato.</small>
              </span>
            </label>
            <label class="radio-card">
              <input type="radio" name="mode" value="replace" />
              <span>
                <strong>Erstatt alt med import</strong>
                <small>Sletter alt i appen først, deretter importeres innholdet fra filen.</small>
              </span>
            </label>
          </fieldset>

          <p class="import-warning" data-replace-warning hidden>
            Dette sletter alt i appen før import.
          </p>

          <label class="form-field">
            <span>Fil</span>
            <input type="file" name="file" accept="application/json,.json" required />
          </label>
        </div>
      </form>
    </div>
  `;

  const form = overlay.querySelector<HTMLFormElement>("#import-form")!;
  const warning = overlay.querySelector<HTMLElement>("[data-replace-warning]")!;
  const close = () => overlay.remove();

  const syncWarning = () => {
    const mode = String(new FormData(form).get("mode") ?? "merge");
    warning.hidden = mode !== "replace";
  };

  form.querySelectorAll<HTMLInputElement>('input[name="mode"]').forEach((input) => {
    input.addEventListener("change", syncWarning);
  });
  syncWarning();

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  overlay.querySelector('[data-action="cancel"]')?.addEventListener("click", close);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const mode = (new FormData(form).get("mode") as ImportMode) || "merge";
    const fileInput = form.querySelector<HTMLInputElement>('input[name="file"]');
    const file = fileInput?.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".json")) {
      alert("Filformatet støttes ikke. Bruk JSON.");
      return;
    }

    if (mode === "replace" && !confirm("Dette sletter alt i appen før import. Fortsette?")) {
      return;
    }

    try {
      const text = await file.text();
      const result = await importJsonBackup(text, mode);
      close();
      showToast(formatImportSummary(result));
      onImported();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Import mislyktes.");
    }
  });

  document.body.appendChild(overlay);
}

function showToast(message: string): void {
  const existing = document.querySelector(".app-toast");
  existing?.remove();

  const toast = document.createElement("div");
  toast.className = "app-toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

function transferIcon(): string {
  return `<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M6.5 3.5 3 7h2.5v6H8V7h2.5L6.5 3.5zm7 13L17 13h-2.5V7H12v6H9.5l4 3.5z"/></svg>`;
}
