import { DataPutSchema } from "@/lib/schemas";
import { requireUser } from "@/server/auth";
import { crossSite, json, readJson } from "@/server/http";
import { deleteData, readData, writeData } from "@/server/userdata";

export const maxDuration = 30;

/** Todos los datos de la persona conectada. */
export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  return json(await readData(user.id));
}

/** Guarda cambios: perfil, pesos y/o días completos (null borra el día). */
export async function PUT(req: Request) {
  const blocked = crossSite(req);
  if (blocked) return blocked;
  const user = await requireUser();
  if (user instanceof Response) return user;

  const parsed = DataPutSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    console.error("PUT /api/data inválido:", parsed.error.issues.slice(0, 3));
    return json({ error: "Datos inválidos." }, 400);
  }
  const days = parsed.data.days ?? {};
  if (Object.keys(days).length > 2000) return json({ error: "Demasiados días en una sola solicitud." }, 413);
  for (const [date, doc] of Object.entries(days)) {
    if (doc && [...doc.foods, ...doc.exercises].some((e) => e.date !== date)) {
      return json({ error: "Datos inválidos." }, 400);
    }
  }

  await writeData(user.id, parsed.data);
  return json({ ok: true });
}

/** Borra todos los registros y el perfil de la persona (la cuenta sigue existiendo). */
export async function DELETE(req: Request) {
  const blocked = crossSite(req);
  if (blocked) return blocked;
  const user = await requireUser();
  if (user instanceof Response) return user;
  await deleteData(user.id);
  return json({ ok: true });
}
