/** Matcher Mac `HealthScoreColor.background(for:)` — HSB hue 0→0.33, sat 0.65, brightness 0.92 */
export function healthScoreBackground(score: number | null | undefined): string {
  if (score == null || score < 1 || score > 10) {
    return "rgba(128, 128, 128, 0.15)";
  }

  const progress = (score - 1) / 9;
  const [r, g, b] = hsvToRgb(progress * 0.33, 0.65, 0.92);
  return `rgb(${r}, ${g}, ${b})`;
}

export function healthScoreBackgroundAlpha(
  score: number | null | undefined,
  alpha: number,
): string {
  if (score == null || score < 1 || score > 10) {
    return `rgba(128, 128, 128, ${alpha})`;
  }

  const progress = (score - 1) / 9;
  const [r, g, b] = hsvToRgb(progress * 0.33, 0.65, 0.92);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function healthScoreTextOpacity(score: number | null | undefined): number {
  return score == null ? 1 : 0.85;
}

/** Høyere symptom = rødere (omvendt av helsescore). */
export function symptomTint(severity: number, maxSeverity = 10): string {
  if (severity <= 0) return "rgba(128, 128, 128, 0.45)";
  const inverted = Math.max(1, Math.min(10, maxSeverity + 1 - severity));
  return healthScoreBackground(inverted);
}

/** Mage 0–3 → helsescore-ekvivalenter 8 / 5 / 2. */
export function giSymptomTint(severity: number): string {
  if (severity <= 0) return "rgba(128, 128, 128, 0.45)";
  const healthEquivalent = severity === 1 ? 8 : severity === 2 ? 5 : 2;
  return healthScoreBackground(healthEquivalent);
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  let r = 0;
  let g = 0;
  let b = 0;

  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    default:
      r = v;
      g = p;
      b = q;
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
