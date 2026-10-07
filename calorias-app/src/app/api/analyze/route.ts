import { z } from "zod";
import {
  ActivityReadingSchema,
  AnalysisSchema,
  AnalyzeRequestSchema,
  type ActivityReading,
  type Analysis,
} from "@/lib/analysis";
import {
  ACTIVITY_PROMPT,
  AiFailure,
  FOOD_PROMPT,
  aiConfigured,
  failureResponse,
  primaryModel,
  providerLabel,
  runAi,
  type AiInput,
} from "@/server/ai";
import { currentUser } from "@/server/auth";
import { clientIp, json, safeEqual } from "@/server/http";
import { db, keys, storageEnabled } from "@/server/kv";

export const maxDuration = 60;

/** Análisis por persona y día, para que nadie agote la cuota gratuita de toda la familia. */
const AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT) || 40;
/** Quien prueba sin cuenta: pocos análisis por día y por conexión (IP). */
const GUEST_AI_DAILY_LIMIT = Number(process.env.GUEST_AI_DAILY_LIMIT) || 5;

const usageKey = (id: string) => keys.ai(id, new Date().toISOString().slice(0, 10));

/** Suma un uso del día; true si se pasó del límite. */
async function overDailyLimit(key: string, limit: number) {
  const used = await db().incr(key);
  if (used === 1) await db().expire(key, 2 * 24 * 60 * 60);
  return used > limit;
}

/** Devuelve el uso si el análisis falló por Gemini (no es culpa de la persona). */
async function refundUsage(key: string | null) {
  if (key) await db().decr(key).catch(() => undefined);
}

/**
 * Con cuentas: con sesión se cuenta el uso diario de la persona; sin sesión (prueba sin
 * cuenta) se cuenta por IP con un límite menor.
 * Sin base de datos (modo local): se pide el código de acceso en la cabecera.
 */
async function checkAccess(
  req: Request,
  count = false,
): Promise<{ denied: Response | null; usage: string | null }> {
  if (storageEnabled()) {
    if (!count) return { denied: null, usage: null };
    const user = await currentUser();
    const usage = usageKey(user ? user.id : `invitado:${clientIp(req)}`);
    if (await overDailyLimit(usage, user ? AI_DAILY_LIMIT : GUEST_AI_DAILY_LIMIT)) {
      await refundUsage(usage); // el intento rechazado no cuenta
      const error = user
        ? `Llegaste al límite de ${AI_DAILY_LIMIT} análisis por hoy. Mañana se renueva.`
        : `La prueba sin cuenta permite ${GUEST_AI_DAILY_LIMIT} análisis por día. Crea tu cuenta para seguir usando la IA.`;
      return { denied: json({ error }, 429), usage: null };
    }
    return { denied: null, usage };
  }
  return { denied: legacyCodeError(req), usage: null };
}

/** Modo local (sin base de datos): se pide el código de acceso en la cabecera. */
function legacyCodeError(req: Request): Response | null {
  const expected = process.env.APP_ACCESS_CODE?.trim();
  if (!expected) {
    // Sin código configurado se permite en desarrollo; en Vercel el enlace es público y
    // cualquiera gastaría tu cuota.
    return process.env.VERCEL
      ? json({ error: "Falta configurar APP_ACCESS_CODE en las variables de entorno de Vercel." }, 503)
      : null;
  }
  if (!safeEqual(req.headers.get("x-access-code")?.trim() ?? "", expected)) {
    return json({ error: "Código de acceso incorrecto. Revísalo en Perfil → Conexión con la IA." }, 401);
  }
  return null;
}

const MISSING_KEY = "Falta configurar GEMINI_API_KEY en el servidor.";

/** Comprueba la configuración y el código de acceso sin llamar a la IA. */
export async function GET(req: Request) {
  const { denied } = await checkAccess(req);
  if (denied) return denied;
  if (!aiConfigured()) return json({ error: MISSING_KEY }, 503);
  return json({ ok: true, model: primaryModel() });
}

export async function POST(req: Request) {
  if (!aiConfigured()) return json({ error: MISSING_KEY }, 503);

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
  // Se cuenta el uso solo para solicitudes válidas.
  const { denied, usage } = await checkAccess(req, true);
  if (denied) return denied;
  const { kind, image, text } = parsed.data;
  const detail = text?.trim();

  const input: AiInput = {
    image,
    text:
      kind === "actividad"
        ? "Lee los datos de actividad de esta captura."
        : image
          ? detail
            ? `Analiza la comida de la foto. Detalles del usuario: ${detail}`
            : "Analiza la comida de la foto."
          : `Estima las calorías y macros de esta comida: ${detail}`,
  };

  try {
    if (kind === "actividad") {
      const r = await runAi(ActivityReadingSchema, ACTIVITY_PROMPT, input);
      return json({ result: cleanActivity(r.value), provider: r.provider, via: providerLabel(r.provider) });
    }
    const r = await runAi(AnalysisSchema, FOOD_PROMPT, input);
    return json({ result: clean(r.value), provider: r.provider, via: providerLabel(r.provider) });
  } catch (err) {
    await refundUsage(usage);
    return errorResponse(err);
  }
}

function errorResponse(err: unknown): Response {
  if (err instanceof AiFailure) {
    // Queda en los registros de Vercel: qué modelo respondió qué y por qué.
    console.error(
      "IA sin respuesta:",
      JSON.stringify(err.attempts.map(({ provider, model, status, reason, ms }) => ({ provider, model, status, reason, ms }))),
    );
    const { status, error } = failureResponse(err.attempts);
    return json({ error }, status);
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
