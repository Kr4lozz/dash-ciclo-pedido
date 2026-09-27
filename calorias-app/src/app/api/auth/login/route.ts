import { normalizeUsername } from "@/lib/account";
import {
  burnPasswordCheck,
  clearAttempts,
  getUserByUsername,
  publicUser,
  startSession,
  tooManyAttempts,
  verifyPassword,
} from "@/server/auth";
import { clientIp, crossSite, isHttps, json, readJson } from "@/server/http";
import { storageEnabled } from "@/server/kv";

const WRONG = "Usuario o contraseña incorrectos.";

export async function POST(req: Request) {
  const blocked = crossSite(req);
  if (blocked) return blocked;
  if (!storageEnabled()) return json({ error: "La app no tiene base de datos configurada." }, 503);

  const body = (await readJson(req)) as Record<string, unknown> | null;
  const username = normalizeUsername(String(body?.username ?? ""));
  const password = String(body?.password ?? "");
  if (!username || !password) return json({ error: "Escribe tu usuario y tu contraseña." }, 400);

  if (
    (await tooManyAttempts("login", username, 10, 15 * 60)) ||
    (await tooManyAttempts("login-ip", clientIp(req), 50, 15 * 60))
  ) {
    return json({ error: "Demasiados intentos. Espera 15 minutos e inténtalo de nuevo." }, 429);
  }

  const user = await getUserByUsername(username);
  if (!user) {
    await burnPasswordCheck(password);
    return json({ error: WRONG }, 401);
  }
  if (!(await verifyPassword(password, user.passwordHash))) return json({ error: WRONG }, 401);

  await clearAttempts("login", username);
  await startSession(user, isHttps(req));
  return json({ user: publicUser(user) });
}
