import { isValidDateStr } from "@/lib/dates";
import { listUsers, requireUser } from "@/server/auth";
import { json } from "@/server/http";
import { readUsage } from "@/server/usage";

/** Uso de la app de cada miembro (solo para quien administra): contadores, nunca contenido. */
export async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  if (user.role !== "admin") return json({ error: "Solo quien administra puede ver esto." }, 403);

  const params = new URL(req.url).searchParams;
  const days = Number(params.get("days"));
  const to = params.get("to");
  if (!isValidDateStr(to) || !Number.isInteger(days) || days < 1 || days > 90) {
    return json({ error: "Solicitud inválida." }, 400);
  }
  return json(await readUsage(await listUsers(), to, days));
}
