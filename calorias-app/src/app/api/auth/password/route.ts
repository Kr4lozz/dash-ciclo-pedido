import { passwordError } from "@/lib/account";
import {
  hashPassword,
  requireUser,
  saveUser,
  startSession,
  tooManyAttempts,
  verifyPassword,
} from "@/server/auth";
import { crossSite, isHttps, json, readJson } from "@/server/http";

/** Cambiar la propia contraseña. Cierra las sesiones de otros dispositivos. */
export async function POST(req: Request) {
  const blocked = crossSite(req);
  if (blocked) return blocked;
  const user = await requireUser();
  if (user instanceof Response) return user;

  const body = (await readJson(req)) as Record<string, unknown> | null;
  const current = String(body?.current ?? "");
  const next = String(body?.next ?? "");
  const invalid = passwordError(next);
  if (invalid) return json({ error: invalid }, 400);

  if (await tooManyAttempts("password", user.id, 10, 15 * 60)) {
    return json({ error: "Demasiados intentos. Espera 15 minutos." }, 429);
  }
  if (!(await verifyPassword(current, user.passwordHash))) {
    return json({ error: "La contraseña actual no es correcta." }, 403);
  }

  const updated = {
    ...user,
    passwordHash: await hashPassword(next),
    sessionVersion: user.sessionVersion + 1,
  };
  await saveUser(updated);
  await startSession(updated, isHttps(req));
  return json({ ok: true });
}
