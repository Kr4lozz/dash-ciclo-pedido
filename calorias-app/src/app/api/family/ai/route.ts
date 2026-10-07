import type { AiStatus } from "@/lib/ai-shared";
import { probeAi } from "@/server/ai";
import { requireUser, tooManyAttempts } from "@/server/auth";
import { crossSite, json } from "@/server/http";
import { db } from "@/server/kv";

export const maxDuration = 60;

/**
 * Estado de la IA (solo quien administra): comprueba la base de datos, cada modelo de Gemini y la
 * cadena real con una consulta de texto y otra con foto. Gasta unas pocas solicitudes de la cuota.
 */
export async function POST(req: Request) {
  const blocked = crossSite(req);
  if (blocked) return blocked;
  const user = await requireUser();
  if (user instanceof Response) return user;
  if (user.role !== "admin") return json({ error: "Solo quien administra puede hacer esto." }, 403);
  if (await tooManyAttempts("aiprobe", user.id, 8, 600)) {
    return json({ error: "Espera unos minutos antes de probar otra vez." }, 429);
  }

  const t0 = Date.now();
  const database = await db()
    .ping()
    .then(
      () => ({ ok: true, ms: Date.now() - t0 }),
      () => ({ ok: false, ms: Date.now() - t0 }),
    );
  return json({ ...(await probeAi()), database } satisfies AiStatus);
}
