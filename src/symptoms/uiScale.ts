/** Symptom-skala i UI: 0–5. Lagring forblir 0–10 (Mac JSON-paritet). */

export const SYMPTOM_UI_MAX = 5;
export const SYMPTOM_STORAGE_MAX = 10;

/** 0–10 → 0–5 for visning. */
export function storageToUiScale(storage: number): number {
  if (!Number.isFinite(storage) || storage <= 0) return 0;
  return Math.min(SYMPTOM_UI_MAX, Math.max(0, Math.round(storage / 2)));
}

/** 0–5 → 0–10 for lagring. */
export function uiToStorageScale(ui: number): number {
  if (!Number.isFinite(ui) || ui <= 0) return 0;
  return Math.min(SYMPTOM_STORAGE_MAX, Math.max(0, Math.round(ui) * 2));
}

/** Gjennomsnitt/område på lagringsverdier → UI-skala (én desimal). */
export function storageAverageToUi(average: number): number {
  return average / 2;
}
