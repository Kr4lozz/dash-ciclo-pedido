import { requireUser } from "@/server/auth";
import { createFitnessToken } from "@/server/fitness";
import { crossSite, json } from "@/server/http";

/** Crea una llave personal nueva (la anterior deja de valer). Se muestra solo esta vez. */
export async function POST(req: Request) {
  const blocked = crossSite(req);
  if (blocked) return blocked;
  const user = await requireUser();
  if (user instanceof Response) return user;
  return json({ token: await createFitnessToken(user.id) });
}
