import type { ActivityReading } from "./analysis";

/** "9.120" / "9,120" / "9 120" → 9120 */
function toNumber(s: string): number {
  return Number(s.replace(/[.,\s]/g, ""));
}

function first(text: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = toNumber(m[1]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

const NUM = String.raw`(\d{1,2}[.,\s]?\d{3}|\d{1,5})`;

/**
 * Extrae los datos del texto que devuelve el OCR de una captura de actividad.
 * Formato de la app Fitness: "Moverse 486/600 KCAL", "Ejercicio 34/30 MIN", "Pasos 9.120".
 */
export function parseActivityText(raw: string): ActivityReading {
  const text = raw
    .replace(/[|\\]/g, "/")
    .replace(/[“”"'`´]/g, "")
    .replace(/[ \t]+/g, " ");

  const kcal = first(text, [
    // valor/meta KCAL (anillo Moverse)
    new RegExp(`${NUM}\\s*/\\s*\\d[\\d.,]*\\s*K?\\s?CAL`, "i"),
    // valor KCAL sin meta
    new RegExp(`${NUM}\\s*K\\s?CAL`, "i"),
    // "Calorías activas 486"
    new RegExp(`(?:calor[ií]as\\s+activas|active\\s+(?:calories|energy)|energ[ií]a\\s+activa)\\D{0,12}${NUM}`, "i"),
  ]);
  const minutes = first(text, [
    /(\d{1,3})\s*\/\s*\d{1,3}\s*MIN/i,
    /(?:ejercicio|exercise)\D{0,12}(\d{1,3})\s*MIN/i,
  ]);
  const steps = first(text, [
    new RegExp(`(?:pasos|steps?(?:\\s*count)?)\\D{0,15}${NUM}`, "i"),
    new RegExp(`${NUM}\\s*(?:pasos|steps)`, "i"),
  ]);

  const found = kcal !== null || minutes !== null || steps !== null;
  const plausible = (n: number | null, max: number) => (n !== null && n >= 0 && n <= max ? n : null);
  return {
    isActivityScreenshot: found,
    source: /fitness|moverse|move|actividad|activity/i.test(text) ? "iPhone" : "captura",
    activeCalories: plausible(kcal, 6000),
    exerciseMinutes: plausible(minutes, 1000),
    steps: plausible(steps, 150000),
    notes: found ? "Leído en tu dispositivo, sin IA." : "No encontré datos de actividad en la captura.",
  };
}
