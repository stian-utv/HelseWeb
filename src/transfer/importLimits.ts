/** Grenseverdier for JSON-import (DoS / minne). */

/** Grenser tilpasset testversjon (~1 års bruk). */
export const IMPORT_LIMITS = {
  /** Maks filstørrelse (1 MB). */
  maxBytes: 1 * 1024 * 1024,
  maxDailyLogs: 366,
  maxMedications: 15,
  maxTrackers: 15,
  /** Ca. 1 år × 15 trackere. */
  maxTrackerValues: 5_500,
  maxLabResults: 150,
  maxNoteChars: 1_000,
  maxNameChars: 80,
  maxUnitChars: 40,
  maxExtraSymptomKeys: 40,
} as const;

export function formatMaxImportSize(): string {
  return `${Math.round(IMPORT_LIMITS.maxBytes / (1024 * 1024))} MB`;
}

export function assertImportByteSize(byteLength: number): void {
  if (byteLength > IMPORT_LIMITS.maxBytes) {
    throw new Error(
      `Filen er for stor (maks ${formatMaxImportSize()}). Velg en mindre backup.`,
    );
  }
}

export function assertArrayLength(
  value: unknown,
  max: number,
  label: string,
): unknown[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new Error(`Ugyldig format: «${label}» må være en liste.`);
  }
  if (value.length > max) {
    throw new Error(
      `For mange oppføringer i «${label}» (maks ${max.toLocaleString("nb-NO")}).`,
    );
  }
  return value;
}

export function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars);
}
