import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { timingSafeEqual } from "node:crypto";
import {
  ActivityReadingSchema,
  AnalysisSchema,
  AnalyzeRequestSchema,
  type ActivityReading,
  type Analysis,
} from "@/lib/analysis";

export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5";
// `effort` no existe en Haiku 4.5 ni en modelos anteriores a la familia 4.6.
const SUPPORTS_EFFORT = !/haiku|sonnet-4-5|opus-4-5|claude-3/.test(MODEL);
// Reintento automático en otro modelo si el principal rechaza la solicitud.
const SUPPORTS_FALLBACKS = /^claude-(opus|fable)-5/.test(MODEL);

const FOOD_PROMPT = `Eres un nutricionista que estima calorías y macronutrientes de comidas para el diario de alimentación personal de un usuario. Recibirás una foto de su comida, una descripción en texto, o ambas.

- Identifica cada alimento o bebida por separado (por ejemplo arroz, pollo a la plancha, ensalada, gaseosa) y estima su porción usando referencias visuales como el tamaño del plato, los cubiertos o las manos.
- Para cada elemento calcula kcal, proteína, carbohidratos y grasa en gramos con valores de referencia habituales (USDA o tablas de composición de alimentos latinoamericanas). Incluye lo que suele quedar oculto: aceite de cocción, mantequilla, salsas, azúcar en bebidas.
- Las calorías de cada elemento deben aproximarse a 4 × proteína + 4 × carbohidratos + 9 × grasa.
- Si el usuario indica cantidades, ingredientes o forma de preparación, dales prioridad sobre lo que infieras de la imagen.
- Reconoce platos típicos de Latinoamérica y España por su nombre y descomponlos en sus componentes principales cuando eso mejore la precisión.
- Si no hay comida ni bebida, responde con isFood = false, sin elementos, y explica en notes qué se ve.

Escribe todo en español, con nombres de alimentos cortos y claros.`;

const ACTIVITY_PROMPT = `Lees capturas de pantalla de apps de actividad física (Actividad o Fitness de Apple, Apple Watch, Samsung Health, Google Fit, Garmin, etc.) para registrar las calorías que un usuario quemó en el día.

- activeCalories: calorías activas del día. En los anillos de Apple es el anillo rojo "Moverse" / "Move" (por ejemplo "450/600 KCAL" → 450). Usa el valor alcanzado, no la meta, y no uses calorías en reposo ni totales si hay un dato de calorías activas.
- exerciseMinutes: valor alcanzado del anillo verde "Ejercicio" / "Exercise".
- steps: pasos del día, si aparecen.
- Si un dato no se lee con claridad, devuélvelo como null; no lo inventes.
- Si la imagen no es una captura de actividad física, usa isActivityScreenshot = false.

Escribe notes en español.`;

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function accessError(req: Request): Response | null {
  const expected = process.env.APP_ACCESS_CODE?.trim();
  if (!expected) {
    // En local se permite sin código; en Vercel el enlace es público y gastaría tu saldo.
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

/** Comprueba la configuración y el código de acceso sin llamar a la IA. */
export async function GET(req: Request) {
  const denied = accessError(req);
  if (denied) return denied;
  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: "Falta configurar ANTHROPIC_API_KEY en el servidor." }, 503);
  }
  return json({ ok: true, model: MODEL });
}

export async function POST(req: Request) {
  const denied = accessError(req);
  if (denied) return denied;
  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: "Falta configurar ANTHROPIC_API_KEY en el servidor." }, 503);
  }

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

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (image) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: image.mediaType, data: image.data },
    });
  }
  content.push({
    type: "text",
    text:
      kind === "actividad"
        ? "Lee los datos de actividad de esta captura."
        : image
          ? detail
            ? `Analiza la comida de la foto. Detalles del usuario: ${detail}`
            : "Analiza la comida de la foto."
          : `Estima las calorías y macros de esta comida: ${detail}`,
  });

  const client = new Anthropic({ timeout: 50_000, maxRetries: 1 });
  const base = {
    model: MODEL,
    max_tokens: 16000,
    ...(SUPPORTS_FALLBACKS
      ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
      : {}),
    messages: [{ role: "user" as const, content }],
  };

  try {
    if (kind === "actividad") {
      const response = await client.beta.messages.parse({
        ...base,
        system: ACTIVITY_PROMPT,
        output_config: {
          ...(SUPPORTS_EFFORT ? { effort: "low" as const } : {}),
          format: betaZodOutputFormat(ActivityReadingSchema),
        },
      });
      const stopped = stopError(response.stop_reason);
      if (stopped || !response.parsed_output) return stopped ?? incomplete();
      return json({ result: cleanActivity(response.parsed_output) });
    }

    const response = await client.beta.messages.parse({
      ...base,
      system: FOOD_PROMPT,
      output_config: {
        ...(SUPPORTS_EFFORT ? { effort: "medium" as const } : {}),
        format: betaZodOutputFormat(AnalysisSchema),
      },
    });
    const stopped = stopError(response.stop_reason);
    if (stopped || !response.parsed_output) return stopped ?? incomplete();
    return json({ result: clean(response.parsed_output) });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      return json({ error: "La API key de Anthropic no es válida o no tiene permisos." }, 502);
    }
    if (err instanceof Anthropic.RateLimitError) {
      return json({ error: "Demasiadas solicitudes seguidas. Espera un momento e intenta de nuevo." }, 429);
    }
    if (err instanceof Anthropic.BadRequestError) {
      console.error("Anthropic 400:", err.message);
      return json({ error: "No se pudo procesar la imagen o el texto. Prueba con otra foto." }, 400);
    }
    if (err instanceof Anthropic.APIConnectionTimeoutError) {
      return json({ error: "La IA tardó demasiado en responder. Intenta de nuevo." }, 504);
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Anthropic API error:", err.status, err.message);
      return json({ error: "El servicio de IA no está disponible ahora. Intenta en unos minutos." }, 502);
    }
    if (err instanceof Anthropic.AnthropicError) {
      // Falló la validación de la salida estructurada.
      console.error("Anthropic parse error:", err.message);
      return json({ error: "No se pudo interpretar la respuesta de la IA. Intenta de nuevo." }, 502);
    }
    console.error(err);
    return json({ error: "Error inesperado al analizar la comida." }, 500);
  }
}

function stopError(stop: string | null): Response | null {
  if (stop === "refusal") {
    return json({ error: "La IA no pudo analizar esta solicitud. Prueba con otra imagen o descripción." }, 422);
  }
  return stop === "max_tokens" ? incomplete() : null;
}

function incomplete() {
  return json({ error: "La respuesta de la IA quedó incompleta. Intenta de nuevo." }, 502);
}

function cleanActivity(a: ActivityReading): ActivityReading {
  const n = (v: number | null) => (v != null && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
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
