import { requireUser, tooManyAttempts } from "@/server/auth";
import { fitnessStatus, deleteFitness, parseFitnessUpload, saveFitnessDays, uidForToken } from "@/server/fitness";
import { clientIp, crossSite, json, readJson } from "@/server/http";
import { storageEnabled } from "@/server/kv";

/**
 * Lo llama el Atajo del iPhone (no el navegador): con la llave personal manda las calorías activas
 * y en reposo (o el total) de uno o varios días. La llave va en `token` o en `Authorization: Bearer`.
 */
export async function POST(req: Request) {
  if (!storageEnabled()) return json({ error: "La app no tiene base de datos configurada." }, 503);
  const body = await readJson(req);
  const header = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const fromBody = body && typeof body === "object" ? (body as Record<string, unknown>).token : undefined;
  const token = header || (typeof fromBody === "string" ? fromBody.trim() : "");
  const uid = token ? await uidForToken(token) : null;
  if (!uid) {
    // Para que nadie pruebe llaves sin parar.
    if (await tooManyAttempts("fitbad", clientIp(req), 30, 600)) return json({ error: "Demasiados intentos." }, 429);
    return json({ error: "La llave de Fitness no es válida. Genera una nueva en Perfil → Fitness automático." }, 401);
  }
  if (await tooManyAttempts("fitness", uid, 200, 3600)) {
    return json({ error: "Demasiados envíos seguidos. Intenta en un rato." }, 429);
  }

  const parsed = parseFitnessUpload(body);
  if ("error" in parsed) return json({ error: parsed.error }, 400);
  await saveFitnessDays(uid, parsed.days);
  return json({
    ok: true,
    guardado: parsed.days,
    mensaje: parsed.days
      .map((d) => `${d.date}: ${d.active ?? "—"} activas · ${d.total ?? "—"} total`)
      .join(" | "),
  });
}

/** Estado de la conexión de la persona conectada (para Perfil). */
export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  return json(await fitnessStatus(user.id));
}

/** Desconecta: la llave deja de valer. */
export async function DELETE(req: Request) {
  const blocked = crossSite(req);
  if (blocked) return blocked;
  const user = await requireUser();
  if (user instanceof Response) return user;
  await deleteFitness(user.id);
  return json({ ok: true });
}
