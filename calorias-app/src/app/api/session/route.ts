import type { SessionInfo } from "@/lib/account";
import { currentUser, publicUser } from "@/server/auth";
import { isHttps, json } from "@/server/http";
import { storageEnabled } from "@/server/kv";

/** Estado con el que arranca la app: ¿hay cuentas? ¿quién está conectado? */
export async function GET(req: Request) {
  if (!storageEnabled()) return json({ storage: false, user: null } satisfies SessionInfo);
  const user = await currentUser({ secure: isHttps(req) });
  return json({ storage: true, user: user ? publicUser(user) : null } satisfies SessionInfo);
}
