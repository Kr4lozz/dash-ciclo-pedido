import { requireUser } from "@/server/auth";
import { crossSite, json, readJson } from "@/server/http";
import { UsageUploadSchema, recordUsage } from "@/server/usage";

/** Suma los contadores de uso de la persona conectada (solo números; ver usage-shared.ts). */
export async function POST(req: Request) {
  const blocked = crossSite(req);
  if (blocked) return blocked;
  const user = await requireUser();
  if (user instanceof Response) return user;

  const parsed = UsageUploadSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: "Datos inválidos." }, 400);
  if (Object.keys(parsed.data.days).length > 8) return json({ error: "Datos inválidos." }, 400);

  await recordUsage(user.id, parsed.data.days);
  return json({ ok: true });
}
