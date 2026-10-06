import {
  getUserById,
  hashPassword,
  requireUser,
  saveUser,
  tempPassword,
} from "@/server/auth";
import { crossSite, json } from "@/server/http";
import { db, keys } from "@/server/kv";
import { deleteUsage } from "@/server/usage";
import { deleteData } from "@/server/userdata";

async function adminAndTarget(req: Request, ctx: RouteContext<"/api/family/[id]">) {
  const blocked = crossSite(req);
  if (blocked) return blocked;
  const admin = await requireUser();
  if (admin instanceof Response) return admin;
  if (admin.role !== "admin") return json({ error: "Solo quien administra puede hacer esto." }, 403);
  const { id } = await ctx.params;
  const target = await getUserById(id);
  if (!target) return json({ error: "Esa cuenta no existe." }, 404);
  return { admin, target };
}

/** Restablece la contraseña de un miembro y devuelve una temporal para dictársela. */
export async function POST(req: Request, ctx: RouteContext<"/api/family/[id]">) {
  const res = await adminAndTarget(req, ctx);
  if (res instanceof Response) return res;
  const password = tempPassword();
  await saveUser({
    ...res.target,
    passwordHash: await hashPassword(password),
    sessionVersion: res.target.sessionVersion + 1,
  });
  return json({ password });
}

/** Elimina la cuenta de un miembro y todos sus datos. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/family/[id]">) {
  const res = await adminAndTarget(req, ctx);
  if (res instanceof Response) return res;
  const { admin, target } = res;
  if (target.id === admin.id) return json({ error: "No puedes eliminar tu propia cuenta." }, 400);
  await deleteData(target.id);
  await deleteUsage(target.id);
  await db().hdel(keys.users, target.username);
  await db().del(keys.user(target.id));
  return json({ ok: true });
}
