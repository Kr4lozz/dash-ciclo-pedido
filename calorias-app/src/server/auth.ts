import {
  createHash,
  randomBytes,
  randomInt,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";
import { cookies } from "next/headers";
import type { SessionUser } from "@/lib/account";
import { json } from "./http";
import { db, keys, storageEnabled } from "./kv";

export interface UserRecord extends SessionUser {
  passwordHash: string;
  /** Al cambiar o restablecer la contraseña sube y las sesiones anteriores dejan de valer. */
  sessionVersion: number;
  createdAt: number;
}

export const SESSION_COOKIE = "mc_session";
const SESSION_TTL = 60 * 60 * 24 * 180; // 180 días: la familia casi nunca tiene que volver a entrar

// ---------- Contraseñas (scrypt de Node, sin dependencias) ----------

const SCRYPT: ScryptOptions = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function scryptAsync(password: string, salt: Buffer, length: number, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, length, options, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64, SCRYPT);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await scryptAsync(password, Buffer.from(salt, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT.maxmem,
  });
  return timingSafeEqual(key, expected);
}

let dummyHash: Promise<string> | null = null;

/** Mismo costo que una verificación real, para no revelar si un usuario existe. */
export async function burnPasswordCheck(password: string) {
  dummyHash ??= hashPassword("contraseña-de-relleno");
  await verifyPassword(password, await dummyHash);
}

const WORDS = [
  "mango", "luna", "palta", "limon", "coco", "kiwi", "pera", "fresa", "nube", "rio",
  "puma", "cafe", "menta", "trigo", "maiz", "nuez", "canela", "quinua", "olivo", "cacao",
];

/** Contraseña temporal fácil de dictar, p. ej. "mango-cacao-47". */
export function tempPassword(): string {
  const w = () => WORDS[randomInt(WORDS.length)];
  return `${w()}-${w()}-${randomInt(10, 100)}`;
}

// ---------- Usuarios ----------

export function publicUser(u: UserRecord): SessionUser {
  return { id: u.id, username: u.username, name: u.name, role: u.role };
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  return db().get<UserRecord>(keys.user(id));
}

export async function getUserByUsername(username: string): Promise<UserRecord | null> {
  const id = await db().hget<string>(keys.users, username);
  return id ? getUserById(String(id)) : null;
}

export async function saveUser(user: UserRecord) {
  await db().set(keys.user(user.id), user);
}

export async function listUsers(): Promise<UserRecord[]> {
  const map = await db().hgetall<Record<string, string>>(keys.users);
  const ids = Object.values(map ?? {}).map(String);
  if (ids.length === 0) return [];
  const users = await db().mget<(UserRecord | null)[]>(...ids.map(keys.user));
  return users.filter((u): u is UserRecord => u !== null).sort((a, b) => a.createdAt - b.createdAt);
}

// ---------- Sesiones (token aleatorio en cookie HttpOnly; en la base solo su hash) ----------

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

interface SessionRecord {
  uid: string;
  v: number;
}

async function setCookie(token: string, secure: boolean) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

export async function startSession(user: UserRecord, secure: boolean) {
  const token = randomBytes(32).toString("base64url");
  const record: SessionRecord = { uid: user.id, v: user.sessionVersion };
  await db().set(keys.session(sha256(token)), record, { ex: SESSION_TTL });
  await setCookie(token, secure);
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db().del(keys.session(sha256(token)));
  store.delete(SESSION_COOKIE);
}

/**
 * Usuario de la sesión actual o null. Con `renew` se extiende la sesión otros 180 días
 * (se usa al abrir la app).
 */
export async function currentUser(renew?: { secure: boolean }): Promise<UserRecord | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const key = keys.session(sha256(token));
  const session = await db().get<SessionRecord>(key);
  if (!session) return null;
  const user = await getUserById(session.uid);
  if (!user || user.sessionVersion !== session.v) return null;
  if (renew) {
    await db().expire(key, SESSION_TTL);
    await setCookie(token, renew.secure);
  }
  return user;
}

/** Para rutas que necesitan una cuenta: devuelve el usuario o la respuesta de error. */
export async function requireUser(): Promise<UserRecord | Response> {
  if (!storageEnabled()) return json({ error: "La app no tiene base de datos configurada." }, 503);
  return (await currentUser()) ?? json({ error: "Tu sesión terminó. Vuelve a entrar." }, 401);
}

// ---------- Límite de intentos ----------

/** Suma un intento; true si se superó el límite en la ventana de tiempo. */
export async function tooManyAttempts(scope: string, id: string, limit: number, windowSec: number) {
  const key = keys.rate(scope, id);
  const count = await db().incr(key);
  if (count === 1) await db().expire(key, windowSec);
  return count > limit;
}

export async function clearAttempts(scope: string, id: string) {
  await db().del(keys.rate(scope, id));
}
