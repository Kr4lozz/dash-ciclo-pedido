"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const noop = () => () => {};

/**
 * Los datos viven en el dispositivo, así que las pantallas se pintan solo en el
 * navegador. En el servidor (y durante la hidratación) se muestra un esqueleto.
 */
export function ClientGate({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  if (!hydrated) return <Skeleton />;
  return children;
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
