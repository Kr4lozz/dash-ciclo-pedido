import { ApiError, GoogleGenAI, type Part } from "@google/genai";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  ActivityReadingSchema,
  AnalysisSchema,
  AnalyzeRequestSchema,
  type ActivityReading,
  type Analysis,
} from "@/lib/analysis";

export const maxDuration = 60;

// "gemini-flash-latest" apunta siempre al Flash más reciente (disponible en la capa gratuita).
// Si el alias dejara de existir, se prueba el siguiente modelo de la lista.
const MODELS = [
  ...new Set([process.env.GEMINI_MODEL?.trim() || "gemini-flash-latest", "gemini-2.5-flash"]),
];

const FOOD_PROMPT = `Eres un nutricionista que estima calorías y macronutrientes de comidas para el diario de alimentación personal de un usuario. Recibirás una foto de su comida, una descripción en texto, o ambas.

- Identifica cada alimento o bebida por separado (por ejemplo arroz, pollo a la plancha, ensalada, gaseosa) y estima su porción usando referencias visuales como el tamaño del plato, los cubiertos o las manos.
- Para cada elemento calcula kcal, proteína, carbohidratos y grasa en gramos con valores de referencia habituales (USDA o tablas de composición de alimentos latinoamericanas). Incluye lo que suele quedar oculto: aceite de cocción, mantequilla, salsas, azúcar en bebidas.
- Las calorías de cada elemento deben aproximarse a 4 × proteína + 4 × carbohidratos + 9 × grasa.
- Si el usuario indica cantidades, ingredientes o forma de preparación, dales prioridad sobre lo que infieras de la imagen.
- Reconoce platos típicos de Latinoamérica y España por su nombre y descomponlos en sus componentes principales cuando eso mejore la precisión.
- Si no hay comida ni bebida, responde con isFood = false, sin elementos, y explica en notes qué se ve.
- En portion usa una medida casera seguida del peso, por ejemplo "1 taza (160 g)". En notes escribe como máximo dos frases con los supuestos principales.

Escribe todo en español, con nombres de alimentos cortos y claros.`;

const ACTIVITY_PROMPT = `Lees capturas de pantalla de apps de actividad física (Actividad o Fitness de Apple, Apple Watch, Samsung Health, Google Fit, Garmin, etc.) para registrar las calorías que un usuario quemó en el día.

- activeCalories: calorías activas del día. En los anillos de Apple es el anillo rojo "Moverse" / "Move" (por ejemplo "450/600 KCAL" → 450). Usa el valor alcanzado, no la meta, y no uses calorías en reposo ni totales si hay un dato de calorías activas.
- exerciseMinutes: valor alcanzado del anillo verde "Ejercicio" / "Exercise".
- steps: pasos del día, si aparecen.
- Si un dato no se lee con claridad, omítelo; no lo inventes.
- Si la imagen no es una captura de actividad física, usa isActivityScreenshot = false.

Escribe notes en español.`;

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function accessError(req: Request): Response | null {
  const expected = process.env.APP_ACCESS_CODE?.trim();
  if (!expected) {
    // En local se permite sin código; en Vercel el enlace es público y cualquiera gastaría tu cuota.
    return process.env.VERCEL
      ? json({ error: "Falta configurar APP_ACCESS_CODE en las variables de entorno de Vercel." }, 503)
      : null;
  }
  const given = Buffer.from(req.headers.get("x-access-code")?.trim() ?? "");
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
    return json({ error: "Código de acceso incorrecto. Revísalo en Perfil → Conexión con la IA." }, 401);
  }
  return null;
}

const MISSING_KEY = "Falta configurar GEMINI_API_KEY en el servidor.";

/** Comprueba la configuración y el código de acceso sin llamar a la IA. */
export async function GET(req: Request) {
  const denied = accessError(req);
  if (denied) return denied;
  if (!process.env.GEMINI_API_KEY) return json({ error: MISSING_KEY }, 503);
  return json({ ok: true, model: MODELS[0] });
}

export async function POST(req: Request) {
  const denied = accessError(req);
  if (denied) return denied;
  if (!process.env.GEMINI_API_KEY) return json({ error: MISSING_KEY }, 503);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Solicitud inválida." }, 400);
  }
  const parsed = AnalyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Solicitud inválida." }, 400);
  }
  const { kind, image, text } = parsed.data;
  const detail = text?.trim();

  const parts: Part[] = [];
  if (image) parts.push({ inlineData: { mimeType: image.mediaType, data: image.data } });
  parts.push({
    text:
      kind === "actividad"
        ? "Lee los datos de actividad de esta captura."
        : image
          ? detail
            ? `Analiza la comida de la foto. Detalles del usuario: ${detail}`
            : "Analiza la comida de la foto."
          : `Estima las calorías y macros de esta comida: ${detail}`,
  });

  try {
    if (kind === "actividad") {
      const reading = await generate(ActivityReadingSchema, ACTIVITY_PROMPT, parts);
      return json({ result: cleanActivity(reading) });
    }
    const analysis = await generate(AnalysisSchema, FOOD_PROMPT, parts);
    return json({ result: clean(analysis) });
  } catch (err) {
    return errorResponse(err);
  }
}

class BlockedError extends Error {}

/** Llama a Gemini pidiendo JSON con el esquema dado y valida la respuesta. */
async function generate<T extends z.ZodType>(
  schema: T,
  systemInstruction: string,
  parts: Part[],
): Promise<z.infer<T>> {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout: 50_000 },
  });
  const responseJsonSchema = z.toJSONSchema(schema);
  delete responseJsonSchema.$schema; // Gemini no admite esta clave
  let lastError: unknown;
  for (const model of MODELS) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: parts,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseJsonSchema,
          temperature: 0.2,
        },
      });
      const text = res.text;
      if (!text) throw new BlockedError(res.promptFeedback?.blockReason ?? "sin respuesta");
      return schema.parse(JSON.parse(text));
    } catch (err) {
      // Modelo inexistente: probar el siguiente de la lista.
      if (err instanceof ApiError && err.status === 404) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

function errorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    console.error("Gemini API error:", err.status, err.message);
    if (err.status === 429) {
      return json(
        { error: "Llegaste al límite gratuito de Gemini. Espera un minuto (o hasta mañana si es el límite diario)." },
        429,
      );
    }
    if (err.status === 401 || err.status === 403 || /api key/i.test(err.message)) {
      return json({ error: "La GEMINI_API_KEY no es válida o no tiene permisos." }, 502);
    }
    if (err.status === 400) {
      return json({ error: "No se pudo procesar la imagen o el texto. Prueba con otra foto." }, 400);
    }
    return json({ error: "Gemini no está disponible ahora. Intenta en unos segundos." }, 502);
  }
  if (err instanceof BlockedError) {
    return json({ error: "La IA no pudo analizar esta solicitud. Prueba con otra imagen o descripción." }, 422);
  }
  if (err instanceof SyntaxError || err instanceof z.ZodError) {
    console.error("Respuesta de Gemini inválida:", err.message);
    return json({ error: "No se pudo interpretar la respuesta de la IA. Intenta de nuevo." }, 502);
  }
  if (err instanceof Error && /timeout|timed out|abort/i.test(`${err.name} ${err.message}`)) {
    return json({ error: "La IA tardó demasiado en responder. Intenta de nuevo." }, 504);
  }
  console.error(err);
  return json({ error: "Error inesperado al analizar la imagen." }, 500);
}

function cleanActivity(a: z.infer<typeof ActivityReadingSchema>): ActivityReading {
  const n = (v: number | undefined) => (v != null && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
  return {
    isActivityScreenshot: a.isActivityScreenshot,
    source: a.source.trim().slice(0, 60),
    activeCalories: n(a.activeCalories),
    exerciseMinutes: n(a.exerciseMinutes),
    steps: n(a.steps),
    notes: a.notes.trim().slice(0, 300),
  };
}

/** Redondea y acota los valores antes de devolverlos a la app. */
function clean(a: Analysis): Analysis {
  const n = (v: number, decimals = 0) => {
    const f = 10 ** decimals;
    return Number.isFinite(v) ? Math.max(0, Math.round(v * f) / f) : 0;
  };
  return {
    isFood: a.isFood,
    dishName: a.dishName.trim().slice(0, 100),
    confidence: a.confidence,
    notes: a.notes.trim().slice(0, 400),
    items: a.items.slice(0, 20).map((i) => ({
      name: i.name.trim().slice(0, 100),
      portion: i.portion.trim().slice(0, 80),
      grams: n(i.grams),
      calories: n(i.calories),
      protein: n(i.protein, 1),
      carbs: n(i.carbs, 1),
      fat: n(i.fat, 1),
    })),
  };
}
