import { randomUUID } from "node:crypto";
import { nameError, normalizeUsername, passwordError, usernameError } from "@/lib/account";
import {
  hashPassword,
  publicUser,
  saveUser,
  startSession,
  tooManyAttempts,
  type UserRecord,
} from "@/server/auth";
import { clientIp, crossSite, isHttps, json, readJson, safeEqual } from "@/server/http";
import { db, keys, storageEnabled } from "@/server/kv";

const MAX_USERS = 30;

export async function POST(req: Request) {
  const blocked = crossSite(req);
  if (blocked) return blocked;
  if (!storageEnabled()) return json({ error: "La app no tiene base de datos configurada." }, 503);
  const familyCode = process.env.APP_ACCESS_CODE?.trim();
  if (!familyCode) {
    return json({ error: "Falta configurar el código familiar (APP_ACCESS_CODE) en Vercel." }, 503);
  }

  const body = (await readJson(req)) as Record<string, unknown> | null;
  const name = String(body?.name ?? "").trim();
  const username = normalizeUsername(String(body?.username ?? ""));
  const password = String(body?.password ?? "");
  const code = String(body?.familyCode ?? "").trim();

  const invalid = nameError(name) ?? usernameError(username) ?? passwordError(password);
  if (invalid) return json({ error: invalid }, 400);

  if (await tooManyAttempts("register", clientIp(req), 10, 60 * 60)) {
    return json({ error: "Demasiados intentos. Espera una hora e inténtalo de nuevo." }, 429);
  }
  if (!safeEqual(code, familyCode)) {
    return json({ error: "El código familiar no es correcto." }, 403);
  }

  const r = db();
  if ((await r.hlen(keys.users)) >= MAX_USERS) {
    return json({ error: `Se alcanzó el máximo de ${MAX_USERS} cuentas.` }, 403);
  }
  const id = randomUUID();
  if (!(await r.hsetnx(keys.users, username, id))) {
    return json({ error: "Ese usuario ya existe. Elige otro." }, 409);
  }
  // La primera cuenta administra a la familia (puede restablecer contraseñas).
  const first = (await r.hlen(keys.users)) === 1;
  const user: UserRecord = {
    id,
    username,
    name,
    role: first ? "admin" : "member",
    passwordHash: await hashPassword(password),
    sessionVersion: 1,
    createdAt: Date.now(),
  };
  await saveUser(user);
  await startSession(user, isHttps(req));
  return json({ user: publicUser(user) });
}
