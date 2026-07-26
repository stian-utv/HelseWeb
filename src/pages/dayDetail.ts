import {
  applySymptomValue,
  enabledSymptomDefs,
  getSymptomValue,
  normalizeEnabledSymptoms,
  type SymptomDef,
} from "../symptoms/catalog";
import { storageToUiScale, SYMPTOM_UI_MAX, uiToStorageScale } from "../symptoms/uiScale";
import {
  deleteDailyLog,
  listActiveMedications,
  listActiveTrackers,
  listTrackerValuesForDate,
  loadSettings,
  replaceTrackerValuesForDate,
  saveDailyLog,
} from "../storage/localStore";
import {
  clampTrackerValue,
  createEmptyDailyLog,
  DEFAULT_SETTINGS,
  type DailyLog,
  type Medication,
  type Tracker,
  type TrackerValue,
} from "../types";
import { formatDayHeading, parseDateKey } from "../utils/dates";
import {
  healthScoreBackground,
  healthScoreBackgroundAlpha,
  symptomTint,
} from "../utils/healthScoreColor";

type DayDetailOptions = {
  dateKey: string;
  existingLog?: DailyLog;
  onClose: () => void;
  onSaved: () => void;
};

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function readNumber(form: HTMLFormElement, name: string, fallback = 0): number {
  const raw = new FormData(form).get(name);
  if (raw == null || raw === "") return fallback;
  return Number(raw);
}

function hasContext(log: DailyLog): boolean {
  return (
    log.contextPoorSleep ||
    log.contextStress ||
    log.contextExercise ||
    log.contextAlcohol ||
    log.contextTravel
  );
}

type SliderTint = "symptom" | "none";

function sliderDisplayValue(value: number, tint: SliderTint): string {
  if (tint === "symptom" && value === 0) return "Ingen";
  return String(value);
}

function sliderRow(
  name: string,
  label: string,
  value: number,
  max = 10,
  min = 0,
  tint: SliderTint = "none",
): string {
  const accent =
    tint === "symptom" ? symptomTint(value, max) : "var(--accent)";
  return `
    <label class="field-row symptom-field">
      <span class="field-label">${escapeHtml(label)}</span>
      <div class="field-control">
        <input
          type="range"
          name="${name}"
          min="${min}"
          max="${max}"
          step="1"
          value="${value}"
          data-tint="${tint}"
          style="accent-color: ${accent};"
        />
        <output class="field-value" data-for="${name}" style="color: ${
          tint === "symptom" && value > 0 ? accent : "var(--text-secondary)"
        };">${sliderDisplayValue(value, tint)}</output>
      </div>
    </label>
  `;
}

function giRow(name: string, label: string, value: number): string {
  const options = [
    { v: 0, t: "Ingen" },
    { v: 1, t: "Lett" },
    { v: 2, t: "Moderat" },
    { v: 3, t: "Kraftig" },
  ];
  return `
    <fieldset class="gi-row symptom-field symptom-field-wide">
      <legend>${escapeHtml(label)}</legend>
      <div class="segmented">
        ${options
          .map(
            (opt) => `
          <label class="segmented-option">
            <input type="radio" name="${name}" value="${opt.v}" ${value === opt.v ? "checked" : ""} />
            <span>${opt.t}</span>
          </label>
        `,
          )
          .join("")}
      </div>
    </fieldset>
  `;
}

function symptomInput(symptom: SymptomDef, log: DailyLog): string {
  const value = getSymptomValue(log, symptom);
  const name = `symptom:${symptom.id}`;

  if (symptom.kind === "bool") {
    return `
      <label class="checkbox-row symptom-field">
        <input type="checkbox" name="${name}" ${value > 0 ? "checked" : ""} />
        <span>${escapeHtml(symptom.label)}</span>
      </label>
    `;
  }

  if (symptom.kind === "gi3") {
    return giRow(name, symptom.label, value);
  }

  if (symptom.kind === "sleepHours") {
    return sliderRow(name, symptom.label, value, 14, 0, "none");
  }

  // scale10 lagres 0–10; UI bruker 0–5 for enklere logging
  return sliderRow(name, symptom.label, storageToUiScale(value), SYMPTOM_UI_MAX, 0, "symptom");
}

function symptomsSection(symptoms: SymptomDef[], log: DailyLog): string {
  if (symptoms.length === 0) {
    return `
      <section class="detail-card">
        <h3>Symptomer</h3>
        <p class="hint">Ingen symptomer er aktivert. Velg symptomer under fanen Symptomer.</p>
      </section>
    `;
  }

  const byCategory = new Map<string, SymptomDef[]>();
  for (const symptom of symptoms) {
    const list = byCategory.get(symptom.category) ?? [];
    list.push(symptom);
    byCategory.set(symptom.category, list);
  }

  const titles: Record<string, string> = {
    energi: "Energi og søvn",
    nevrologisk: "Nevrologisk",
    psykisk: "Psykisk form",
    mage: "Mage",
    annet: "Andre tegn",
  };

  const hasAnyValue = symptoms.some((symptom) => getSymptomValue(log, symptom) > 0);

  return `
    <details class="detail-card collapsible" ${hasAnyValue ? "open" : "open"}>
      <summary>
        <span>Symptomer</span>
        <span class="summary-hint">Skala 0–5 · 0 = ingen · 5 = sterkest</span>
      </summary>
      <div class="collapsible-body">
        ${[...byCategory.entries()]
          .map(
            ([category, items]) => `
          <div class="symptom-group">
            <p class="subheading">${titles[category] ?? category}</p>
            <div class="symptom-fields">
              ${items.map((item) => symptomInput(item, log)).join("")}
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    </details>
  `;
}

function medicationSection(medications: Medication[], selected: string[]): string {
  if (medications.length === 0) {
    return `
      <details class="detail-card collapsible">
        <summary>
          <span>Medisin og tilskudd</span>
          <span class="summary-hint">Ingen medisiner i bruk. Legg til under Medisinoversikt.</span>
        </summary>
      </details>
    `;
  }

  const open = selected.length > 0;
  return `
    <details class="detail-card collapsible" ${open ? "open" : ""}>
      <summary>
        <span>Medisin og tilskudd</span>
        <span class="summary-hint">${selected.length > 0 ? selected.join(", ") : "Ingen tatt i dag"}</span>
      </summary>
      <div class="collapsible-body">
        ${medications
          .map(
            (med) => `
          <label class="checkbox-row">
            <input type="checkbox" name="medication" value="${escapeHtml(med.name)}" ${selected.includes(med.name) ? "checked" : ""} />
            <span>${escapeHtml(med.name)}</span>
          </label>
        `,
          )
          .join("")}
      </div>
    </details>
  `;
}

function trackerInput(tracker: Tracker, existing: TrackerValue | undefined): string {
  const recorded = Boolean(existing);
  const value = existing?.value ?? 0;
  const field = `tracker:${tracker.name}`;
  const recordedField = `trackerRecorded:${tracker.name}`;
  const label = `${tracker.emoji ? `${escapeHtml(tracker.emoji)} ` : ""}${escapeHtml(tracker.name)}`;

  if (tracker.type === "Ja/nei") {
    const state = !recorded ? "none" : value > 0 ? "yes" : "no";
    return `
      <div class="tracker-row" data-tracker-type="boolean">
        <div class="tracker-row-label">${label}</div>
        <div class="segmented segmented-3">
          <label class="segmented-option">
            <input type="radio" name="${field}" value="none" ${state === "none" ? "checked" : ""} />
            <span>–</span>
          </label>
          <label class="segmented-option">
            <input type="radio" name="${field}" value="yes" ${state === "yes" ? "checked" : ""} />
            <span>Ja</span>
          </label>
          <label class="segmented-option">
            <input type="radio" name="${field}" value="no" ${state === "no" ? "checked" : ""} />
            <span>Nei</span>
          </label>
        </div>
      </div>
    `;
  }

  const max = tracker.type === "Skala" ? 10 : 100;
  const unit = tracker.type === "Tall" && tracker.unit.trim() ? ` ${escapeHtml(tracker.unit.trim())}` : "";

  return `
    <div class="tracker-row" data-tracker-type="${tracker.type === "Skala" ? "scale" : "number"}">
      <div class="tracker-row-label">${label}${unit ? `<span class="hint"> ·${unit}</span>` : ""}</div>
      <div class="tracker-number-row">
        <input type="number" name="${field}" min="0" max="${max}" value="${value}" data-tracker-value />
        ${
          tracker.type === "Skala"
            ? `<input type="range" min="0" max="10" step="1" value="${value}" data-tracker-slider />`
            : ""
        }
        <label class="checkbox-row tracker-recorded">
          <input type="checkbox" name="${recordedField}" ${recorded ? "checked" : ""} data-tracker-recorded />
          <span>Registrer</span>
        </label>
      </div>
    </div>
  `;
}

function trackersSection(
  trackers: Tracker[],
  valuesByName: Map<string, TrackerValue>,
): string {
  if (trackers.length === 0) return "";

  const recordedCount = trackers.filter((tracker) => valuesByName.has(tracker.name)).length;

  return `
    <details class="detail-card collapsible" ${recordedCount > 0 ? "open" : ""}>
      <summary>
        <span>Trackere</span>
        <span class="summary-hint">${
          recordedCount > 0
            ? `${recordedCount} registrert · trykk for å endre`
            : "Trykk for å registrere"
        }</span>
      </summary>
      <div class="collapsible-body">
        ${trackers.map((tracker) => trackerInput(tracker, valuesByName.get(tracker.name))).join("")}
      </div>
    </details>
  `;
}

function collectLog(
  form: HTMLFormElement,
  dateKey: string,
  base: DailyLog,
  symptoms: SymptomDef[],
): DailyLog {
  const data = new FormData(form);
  const medications = data
    .getAll("medication")
    .map(String)
    .sort((a, b) => a.localeCompare(b, "nb"));

  const next = normalizePreservingExtras(base, dateKey);
  next.healthValue = clampInt(readNumber(form, "healthValue", 5), 1, 10);
  next.note = String(data.get("note") ?? "");
  next.hadB12Injection = data.get("hadB12Injection") === "on";
  next.medications = medications;
  next.contextPoorSleep = data.get("contextPoorSleep") === "on";
  next.contextStress = data.get("contextStress") === "on";
  next.contextExercise = data.get("contextExercise") === "on";
  next.contextAlcohol = data.get("contextAlcohol") === "on";
  next.contextTravel = data.get("contextTravel") === "on";

  for (const symptom of symptoms) {
    const name = `symptom:${symptom.id}`;
    if (symptom.kind === "bool") {
      applySymptomValue(next, symptom, data.get(name) === "on" ? 1 : 0);
      continue;
    }
    const raw = readNumber(form, name, 0);
    const stored = symptom.kind === "scale10" ? uiToStorageScale(raw) : raw;
    applySymptomValue(next, symptom, stored);
  }

  return next;
}

/** Behold verdier for deaktiverte symptomer og klokkedata fra eksisterende logg. */
function normalizePreservingExtras(base: DailyLog, dateKey: string): DailyLog {
  return {
    ...createEmptyDailyLog(dateKey),
    ...base,
    date: dateKey,
    medications: [...base.medications],
    extraSymptoms: { ...base.extraSymptoms },
  };
}

function collectTrackerValues(
  form: HTMLFormElement,
  trackers: Tracker[],
): Array<{ trackerName: string; value: number }> {
  const data = new FormData(form);
  const result: Array<{ trackerName: string; value: number }> = [];

  for (const tracker of trackers) {
    const field = `tracker:${tracker.name}`;

    if (tracker.type === "Ja/nei") {
      const state = String(data.get(field) ?? "none");
      if (state === "none") continue;
      result.push({
        trackerName: tracker.name,
        value: clampTrackerValue(tracker.type, state === "yes" ? 1 : 0),
      });
      continue;
    }

    if (data.get(`trackerRecorded:${tracker.name}`) !== "on") continue;
    result.push({
      trackerName: tracker.name,
      value: clampTrackerValue(tracker.type, readNumber(form, field, 0)),
    });
  }

  return result;
}

export async function openDayDetail(options: DayDetailOptions): Promise<void> {
  const [medications, trackers, trackerValues, storedSettings] = await Promise.all([
    listActiveMedications(),
    listActiveTrackers(),
    listTrackerValuesForDate(options.dateKey),
    loadSettings(),
  ]);

  const settings = storedSettings ?? DEFAULT_SETTINGS;
  const symptoms = enabledSymptomDefs(normalizeEnabledSymptoms(settings.enabledSymptoms));
  const valuesByName = new Map(trackerValues.map((value) => [value.trackerName, value]));
  const log = options.existingLog ?? createEmptyDailyLog(options.dateKey);
  const day = parseDateKey(options.dateKey);

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal day-detail-modal" role="dialog" aria-modal="true" aria-labelledby="day-detail-title">
      <form class="day-detail-form" id="day-detail-form">
        <header class="modal-header">
          <div>
            <p class="modal-kicker">Dagsregistrering</p>
            <h2 id="day-detail-title">${formatDayHeading(day)}</h2>
          </div>
          <div class="modal-actions">
            <input
              type="checkbox"
              name="hadB12Injection"
              id="hadB12Injection"
              class="visually-hidden"
              ${log.hadB12Injection ? "checked" : ""}
            />
            <button
              type="button"
              class="b12-day-toggle ${log.hadB12Injection ? "is-on" : ""}"
              data-action="toggle-b12"
              aria-pressed="${log.hadB12Injection}"
              aria-controls="hadB12Injection"
            >
              ${syringeIcon()}
              <span>${log.hadB12Injection ? "B12 registrert" : "B12-injeksjon"}</span>
            </button>
            <button type="button" class="button button-ghost" data-action="cancel">Avbryt</button>
            <button type="submit" class="button button-primary" data-action="save">Lagre</button>
          </div>
        </header>

        <div class="day-detail-scroll">
          <div class="day-detail-columns">
            <div class="day-detail-column">
              <p class="column-label">Helse</p>

              <section class="detail-card">
                <h3>Helsescore</h3>
                <div class="health-score-editor">
                  <input class="health-score-number" type="number" name="healthValue" min="1" max="10" value="${log.healthValue}" />
                  <input class="health-score-slider" type="range" name="healthValueSlider" min="1" max="10" step="1" value="${log.healthValue}" />
                </div>
                <p class="hint">1 = dårlig · 10 = bra · skriv tall eller bruk slider</p>
              </section>

              ${medicationSection(medications, log.medications)}
            </div>

            <div class="day-detail-column">
              <p class="column-label">Kontekst</p>

              <details class="detail-card collapsible" ${hasContext(log) ? "open" : ""}>
                <summary>
                  <span>Dagskontekst</span>
                </summary>
                <div class="collapsible-body context-grid">
                  <label class="checkbox-row"><input type="checkbox" name="contextPoorSleep" ${log.contextPoorSleep ? "checked" : ""} /><span>Dårlig søvn</span></label>
                  <label class="checkbox-row"><input type="checkbox" name="contextStress" ${log.contextStress ? "checked" : ""} /><span>Stress</span></label>
                  <label class="checkbox-row"><input type="checkbox" name="contextExercise" ${log.contextExercise ? "checked" : ""} /><span>Trening</span></label>
                  <label class="checkbox-row"><input type="checkbox" name="contextAlcohol" ${log.contextAlcohol ? "checked" : ""} /><span>Alkohol</span></label>
                  <label class="checkbox-row"><input type="checkbox" name="contextTravel" ${log.contextTravel ? "checked" : ""} /><span>Reise</span></label>
                </div>
              </details>

              ${trackersSection(trackers, valuesByName)}
            </div>
          </div>

          ${symptomsSection(symptoms, log)}

          <section class="detail-card note-card">
            <h3>Notat</h3>
            <textarea name="note" rows="4" placeholder="Frivillig notat for dagen…">${escapeHtml(log.note)}</textarea>
          </section>

          ${
            options.existingLog
              ? `
            <footer class="day-detail-footer">
              <button type="button" class="button button-ghost button-danger-text" data-action="delete">
                Slett registrering
              </button>
            </footer>
          `
              : ""
          }
        </div>
      </form>
    </div>
  `;

  const form = overlay.querySelector<HTMLFormElement>("#day-detail-form")!;
  const healthNumber = form.querySelector<HTMLInputElement>('input[name="healthValue"]')!;
  const healthSlider = form.querySelector<HTMLInputElement>('input[name="healthValueSlider"]')!;

  const syncHealthUi = (value: number) => {
    const score = clampInt(value, 1, 10);
    healthNumber.value = String(score);
    healthSlider.value = String(score);
    healthNumber.style.background = healthScoreBackgroundAlpha(score, 0.18);
    healthSlider.style.accentColor = healthScoreBackground(score);
  };

  syncHealthUi(log.healthValue);
  healthNumber.addEventListener("input", () => syncHealthUi(Number(healthNumber.value)));
  healthSlider.addEventListener("input", () => syncHealthUi(Number(healthSlider.value)));

  const b12Input = form.querySelector<HTMLInputElement>("#hadB12Injection")!;
  const b12Toggle = form.querySelector<HTMLButtonElement>('[data-action="toggle-b12"]')!;
  const syncB12Toggle = () => {
    const on = b12Input.checked;
    b12Toggle.classList.toggle("is-on", on);
    b12Toggle.setAttribute("aria-pressed", String(on));
    const label = b12Toggle.querySelector("span");
    if (label) label.textContent = on ? "B12 registrert" : "B12-injeksjon";
  };
  b12Toggle.addEventListener("click", () => {
    b12Input.checked = !b12Input.checked;
    syncB12Toggle();
  });

  const syncSymptomSlider = (input: HTMLInputElement) => {
    const output = form.querySelector<HTMLOutputElement>(`output[data-for="${input.name}"]`);
    const tint = input.dataset.tint as SliderTint | undefined;
    const value = Number(input.value);
    const max = Number(input.max) || SYMPTOM_UI_MAX;

    if (tint === "symptom") {
      const color = symptomTint(value, max);
      input.style.accentColor = color;
      if (output) {
        output.textContent = sliderDisplayValue(value, "symptom");
        output.style.color = value > 0 ? color : "var(--text-secondary)";
      }
      return;
    }

    if (output) output.textContent = input.value;
  };

  form.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach((input) => {
    if (input.name === "healthValueSlider" || input.hasAttribute("data-tracker-slider")) return;
    syncSymptomSlider(input);
    input.addEventListener("input", () => syncSymptomSlider(input));
  });

  form.querySelectorAll<HTMLElement>(".tracker-row").forEach((row) => {
    const valueInput = row.querySelector<HTMLInputElement>("[data-tracker-value]");
    const slider = row.querySelector<HTMLInputElement>("[data-tracker-slider]");
    const recorded = row.querySelector<HTMLInputElement>("[data-tracker-recorded]");
    const markRecorded = () => {
      if (recorded) recorded.checked = true;
    };
    valueInput?.addEventListener("input", () => {
      markRecorded();
      if (slider && valueInput) slider.value = valueInput.value;
    });
    slider?.addEventListener("input", () => {
      if (valueInput && slider) valueInput.value = slider.value;
      markRecorded();
    });
  });

  const close = () => {
    overlay.remove();
    options.onClose();
  };

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  overlay.querySelector('[data-action="cancel"]')?.addEventListener("click", close);

  overlay.querySelector('[data-action="delete"]')?.addEventListener("click", async () => {
    if (!confirm("Slett registrering? Registreringen for denne dagen fjernes permanent.")) {
      return;
    }
    await deleteDailyLog(options.dateKey);
    close();
    options.onSaved();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const next = collectLog(form, options.dateKey, log, symptoms);
    next.healthValue = clampInt(Number(healthNumber.value), 1, 10);
    await saveDailyLog(next);
    await replaceTrackerValuesForDate(options.dateKey, collectTrackerValues(form, trackers));
    close();
    options.onSaved();
  });

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      window.removeEventListener("keydown", onKeyDown);
    }
  };
  window.addEventListener("keydown", onKeyDown);

  document.body.appendChild(overlay);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function syringeIcon(): string {
  return `<svg class="b12-day-toggle-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M11.2 1.2 12.8 2.8 11.5 4.1l1.4 1.4-1.1 1.1-1.4-1.4-1.6 1.6 4.2 4.2-.7.7-4.2-4.2-1.3 1.3.9.9-.7.7-.9-.9L4.3 12l-1.5-.2.2-1.5 1.5-1.5-.9-.9.7-.7.9.9 1.3-1.3L3.2 3.5l.7-.7 4.2 4.2 1.6-1.6-1.4-1.4 1.1-1.1 1.4 1.4z"/></svg>`;
}
