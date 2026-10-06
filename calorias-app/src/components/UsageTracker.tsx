"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/session";
import { startUsage, trackView } from "@/lib/usage";
import { pageOf } from "@/lib/usage-shared";

/**
 * Cuenta el uso de la app (aperturas, toques, pantallas) de quien tiene una cuenta conectada,
 * para que quien administra la familia sepa si la usan. Ver lib/usage.ts.
 */
export function UsageTracker() {
  const session = useSession();
  const pathname = usePathname();
  const id = session.status === "user" ? session.user.id : null;

  useEffect(() => (id ? startUsage(id) : undefined), [id]);

  useEffect(() => {
    const page = pageOf(pathname);
    if (id && page) trackView(page);
  }, [id, pathname]);

  return null;
}
