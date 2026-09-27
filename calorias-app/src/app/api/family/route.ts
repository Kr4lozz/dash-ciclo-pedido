import { listUsers, publicUser, requireUser } from "@/server/auth";
import { json } from "@/server/http";

/** Miembros de la familia (solo para quien administra). */
export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  if (user.role !== "admin") return json({ error: "Solo quien administra puede ver esto." }, 403);
  const members = (await listUsers()).map((u) => ({ ...publicUser(u), createdAt: u.createdAt }));
  return json({ members, familyCode: process.env.APP_ACCESS_CODE?.trim() ?? "" });
}
