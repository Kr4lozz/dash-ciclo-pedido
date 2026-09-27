import { timingSafeEqual } from "node:crypto";

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Rechaza escrituras que vengan de otro sitio (defensa extra además de SameSite=Lax). */
export function crossSite(req: Request): Response | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host === host) return null;
  } catch {
    // Origin inválido
  }
  return json({ error: "Solicitud no permitida." }, 403);
}

export function isHttps(req: Request): boolean {
  return (
    req.headers.get("x-forwarded-proto") === "https" || new URL(req.url).protocol === "https:"
  );
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
