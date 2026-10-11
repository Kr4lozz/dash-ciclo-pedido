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

  // El total (activas + reposo) se busca primero y se quita del texto, para que no se confunda con las activas.
  const totalMatch = text.match(
    new RegExp(
      `(?:calor[ií]as\\s+totales|total(?:es)?(?:\\s+de)?(?:\\s+calor[ií]as)?|total\\s+(?:calories|energy)|energ[ií]a\\s+total)\\s*[:\\-]?\\s*${NUM}\\s*K?\\s?(?:CAL|kcal)?`,
      "i",
    ),
  );
  const totalRaw = totalMatch ? toNumber(totalMatch[1]) : null;
  const body = totalMatch ? text.replace(totalMatch[0], " ") : text;

  const kcal = first(body, [
    // valor/meta KCAL (anillo Moverse)
    new RegExp(`${NUM}\\s*/\\s*\\d[\\d.,]*\\s*K?\\s?CAL`, "i"),
    // valor KCAL sin meta
    new RegExp(`${NUM}\\s*K\\s?CAL`, "i"),
    // "Calorías activas 486"
    new RegExp(`(?:calor[ií]as\\s+activas|active\\s+(?:calories|energy)|energ[ií]a\\s+activa)\\D{0,12}${NUM}`, "i"),
  ]);
  const minutes = first(body, [
    /(\d{1,3})\s*\/\s*\d{1,3}\s*MIN/i,
    /(?:ejercicio|exercise)\D{0,12}(\d{1,3})\s*MIN/i,
  ]);
  const steps = first(body, [
    new RegExp(`(?:pasos|steps?(?:\\s*count)?)\\D{0,15}${NUM}`, "i"),
    new RegExp(`${NUM}\\s*(?:pasos|steps)`, "i"),
  ]);

  const found = kcal !== null || minutes !== null || steps !== null || totalRaw !== null;
  const plausible = (n: number | null, max: number) => (n !== null && n >= 0 && n <= max ? n : null);
  const active = plausible(kcal, 6000);
  // El total incluye las activas: si es menor, se descarta.
  const total = plausible(totalRaw, 20000);
  return {
    isActivityScreenshot: found,
    source: /fitness|moverse|move|actividad|activity/i.test(text) ? "iPhone" : "captura",
    activeCalories: active,
    totalCalories: total !== null && total >= (active ?? 0) ? total : null,
    exerciseMinutes: plausible(minutes, 1000),
    steps: plausible(steps, 150000),
    notes: found ? "Leído en tu dispositivo, sin IA." : "No encontré datos de actividad en la captura.",
  };
}
