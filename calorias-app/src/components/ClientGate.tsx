"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { WifiOff } from "lucide-react";
import { initSession, retrySession, useSession, type SessionState } from "@/lib/session";
import { retryLoad, useAppData, useStoreStatus } from "@/lib/store";
import type { AppData } from "@/lib/types";
import { Button } from "./ui";

const noop = () => () => {};

/** Pantallas que se ven sin haber entrado. */
export const PUBLIC_PATHS = new Set(["/bienvenida", "/entrar", "/registro"]);

export const WELCOME_SEEN_KEY = "mis-calorias:bienvenida-vista";

function welcomeSeen(): boolean {
  try {
    return window.localStorage.getItem(WELCOME_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

function redirectFor(session: SessionState, pathname: string, data: AppData): string | null {
  const isPublic = PUBLIC_PATHS.has(pathname);
  switch (session.status) {
    case "anon":
      if (isPublic) return null;
      return session.expired ? "/entrar" : "/bienvenida";
    case "user":
      // Recién entró: a Hoy; recién creó la cuenta: a completar el perfil.
      if (pathname === "/entrar") return "/";
      if (pathname === "/registro") return "/perfil";
      return null;
    case "local":
      if (pathname === "/entrar" || pathname === "/registro") return "/bienvenida";
      // Primera visita: mostrar cómo funciona la app.
      if (pathname === "/" && !data.profile && data.foods.length === 0 && !welcomeSeen()) {
        return "/bienvenida";
      }
      return null;
    default:
      return null;
  }
}

/**
 * Los datos viven en el dispositivo o en la cuenta, así que las pantallas se pintan solo en
 * el navegador y después de saber quién está conectado. Mientras tanto, un esqueleto.
 */
export function ClientGate({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const session = useSession();
  const store = useStoreStatus();
  const data = useAppData();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (hydrated) initSession();
  }, [hydrated]);

  const target = hydrated ? redirectFor(session, pathname, data) : null;
  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (!hydrated || session.status === "loading" || target) return <Skeleton />;
  if (session.status === "error") {
    return (
      <Problem
        message="No se pudo conectar con la app. Revisa tu conexión a internet."
        onRetry={retrySession}
      />
    );
  }
  if (session.status === "user" && !PUBLIC_PATHS.has(pathname) && !store.ready) {
    return store.error ? <Problem message={store.error} onRetry={retryLoad} /> : <Skeleton />;
  }
  return children;
}

function Problem({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-8 text-center">
      <WifiOff className="size-10 text-muted" />
      <p className="text-ink-2">{message}</p>
      <Button onClick={onRetry}>Reintentar</Button>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4 px-4 pt-6" aria-busy="true" aria-label="Cargando">
      <div className="h-8 w-40 rounded-xl bg-card" />
      <div className="h-64 rounded-3xl bg-card" />
      <div className="h-28 rounded-3xl bg-card" />
      <div className="h-40 rounded-3xl bg-card" />
    </div>
  );
}
