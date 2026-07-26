/** Grenseverdier for JSON-import (DoS / minne). */

export const IMPORT_LIMITS = {
  /** Maks filstørrelse (5 MB). */
  maxBytes: 5 * 1024 * 1024,
  maxDailyLogs: 15_000,
  maxMedications: 500,
  maxTrackers: 500,
  maxTrackerValues: 100_000,
  maxLabResults: 10_000,
  maxNoteChars: 8_000,
  maxNameChars: 80,
  maxUnitChars: 40,
  maxExtraSymptomKeys: 80,
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
