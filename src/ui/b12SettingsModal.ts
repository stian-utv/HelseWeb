import { loadSettings, saveSettings } from "../storage/localStore";
import { DEFAULT_SETTINGS } from "../types";

type Options = {
  onSaved?: () => void;
};

export async function openB12SettingsModal(options: Options = {}): Promise<void> {
  const stored = await loadSettings();
  const settings = stored ?? DEFAULT_SETTINGS;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal editor-modal" role="dialog" aria-modal="true" aria-labelledby="b12-settings-title">
      <form id="b12-settings-form" class="editor-form">
        <header class="modal-header">
          <div>
            <p class="modal-kicker">B12</p>
            <h2 id="b12-settings-title">B12-innstillinger</h2>
          </div>
          <div class="modal-actions">
            <button type="button" class="button button-ghost" data-action="cancel">Avbryt</button>
            <button type="submit" class="button button-primary">Ferdig</button>
          </div>
        </header>
        <div class="editor-body">
          <p class="hint">
            Angi hvor ofte du normalt tar B12-injeksjon. Banneret sammenligner dager siden sist
            injeksjon med dette intervallet.
          </p>
          <label class="form-field">
            <span>Intervall</span>
            <div class="input-with-suffix">
              <span class="input-prefix">Hver</span>
              <input
                name="intervalDays"
                type="number"
                min="1"
                max="60"
                required
                value="${settings.b12IntervalDays}"
                autofocus
              />
              <span class="input-suffix">dag</span>
            </div>
          </label>
          <p class="hint">Standard er 7 dager, men dette varierer mellom pasienter.</p>
        </div>
      </form>
    </div>
  `;

  const close = () => overlay.remove();
  const form = overlay.querySelector<HTMLFormElement>("#b12-settings-form")!;

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  overlay.querySelector('[data-action="cancel"]')?.addEventListener("click", close);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const value = Number(data.get("intervalDays"));
    if (!Number.isFinite(value) || value < 1 || value > 60) {
      alert("Skriv inn et gyldig antall dager (1–60).");
      return;
    }
    await saveSettings({ ...settings, b12IntervalDays: Math.round(value) });
    close();
    options.onSaved?.();
  });

  document.body.appendChild(overlay);
}
