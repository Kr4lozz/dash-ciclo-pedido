import { endSession } from "@/server/auth";
import { crossSite, json } from "@/server/http";
import { storageEnabled } from "@/server/kv";

export async function POST(req: Request) {
  const blocked = crossSite(req);
  if (blocked) return blocked;
  if (storageEnabled()) await endSession();
  return json({ ok: true });
}
