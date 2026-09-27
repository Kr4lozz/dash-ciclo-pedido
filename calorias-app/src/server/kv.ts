import { Redis } from "@upstash/redis";

// Base de datos: Upstash Redis (se crea gratis desde Vercel → Storage).
// Sin estas variables la app funciona en modo local: cada celular guarda sus datos.

function restCredentials(): { url: string; token: string } | null {
  const env = process.env;
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return { url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN };
  }
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
    return { url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN };
  }
  // Vercel permite un prefijo propio al conectar la base (p. ej. STORAGE_REST_API_URL).
  for (const [name, url] of Object.entries(env)) {
    if (!url || !name.endsWith("_REST_API_URL")) continue;
    const token = env[name.replace(/_URL$/, "_TOKEN")];
    if (token) return { url, token };
  }
  return null;
}

let client: Redis | null | undefined;

export function kv(): Redis | null {
  if (client === undefined) {
    const creds = restCredentials();
    client = creds ? new Redis({ url: creds.url, token: creds.token }) : null;
  }
  return client;
}

export function storageEnabled(): boolean {
  return kv() !== null;
}

/** kv() para rutas que ya comprobaron storageEnabled(). */
export function db(): Redis {
  const c = kv();
  if (!c) throw new Error("Base de datos no configurada");
  return c;
}

export const keys = {
  users: "users", // hash: usuario → id
  user: (id: string) => `user:${id}`,
  session: (hash: string) => `sess:${hash}`,
  profile: (id: string) => `ud:${id}:profile`,
  weights: (id: string) => `ud:${id}:weights`,
  days: (id: string) => `ud:${id}:days`, // hash: fecha → día
  rate: (scope: string, id: string) => `rl:${scope}:${id}`,
  ai: (id: string, day: string) => `ai:${id}:${day}`,
};
