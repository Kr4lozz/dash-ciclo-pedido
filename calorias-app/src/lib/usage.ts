"use client";

import { todayStr } from "./dates";
import type { ActionId, PageId, UsageBatch } from "./usage-shared";

// Cuenta cómo se usa la app para quien administra la familia: cuántas veces se abrió, cuántos
// toques hubo y qué pantallas y acciones. Solo números, agrupados por día; nunca lo que la
// persona escribe o fotografía. Se manda al servidor en lotes (cada minuto y al salir de la app).
// Es una cuenta aproximada: si el celular se apaga o no hay conexión, algo puede perderse.

const FLUSH_MS = 60_000;
/** Si la app estuvo en segundo plano más de esto, volver a ella cuenta como una apertura nueva. */
const IDLE_OPEN_MS = 30 * 60_000;
const PENDING_KEY = "mis-calorias:uso-pendiente";
const OPENED_KEY = "mis-calorias:uso-abierta";

let uid: string | null = null;
let pending: Record<string, UsageBatch> = {};
let timer: ReturnType<typeof setTimeout> | null = null;
let sending = false;

function merge(into: Record<string, UsageBatch>, from: Record<string, UsageBatch>) {
  for (const [day, b] of Object.entries(from)) {
    const t = (into[day] ??= {});
    if (b.o) t.o = (t.o ?? 0) + b.o;
    if (b.t) t.t = (t.t ?? 0) + b.t;
    for (const [k, n] of Object.entries(b.p ?? {})) {
      const p = (t.p ??= {});
      p[k as PageId] = (p[k as PageId] ?? 0) + n;
    }
    for (const [k, n] of Object.entries(b.a ?? {})) {
      const a = (t.a ??= {});
      a[k as ActionId] = (a[k as ActionId] ?? 0) + n;
    }
  }
}

function add(fn: (day: UsageBatch) => void) {
  if (!uid) return;
  fn((pending[todayStr()] ??= {}));
  if (!timer) timer = setTimeout(() => void flush(), FLUSH_MS);
}

export function trackView(page: PageId) {
  add((d) => {
    const p = (d.p ??= {});
    p[page] = (p[page] ?? 0) + 1;
  });
}

/** Una acción clave (registrar una comida, un entrenamiento…). Sin cuenta conectada no hace nada. */
export function trackAction(action: ActionId) {
  add((d) => {
    const a = (d.a ??= {});
    a[action] = (a[action] ?? 0) + 1;
  });
}

function trackTap() {
  add((d) => {
    d.t = (d.t ?? 0) + 1;
  });
}

function trackOpen() {
  add((d) => {
    d.o = (d.o ?? 0) + 1;
  });
}

// ---------- Envío ----------

function stored(): Record<string, UsageBatch> {
  try {
    const raw = window.localStorage.getItem(`${PENDING_KEY}:${uid}`);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, UsageBatch>) : {};
  } catch {
    return {};
  }
}

/** Guarda en el dispositivo lo que no se pudo mandar, para mandarlo la próxima vez. */
function persist(batch: Record<string, UsageBatch>) {
  if (!uid || Object.keys(batch).length === 0) return;
  const all = stored();
  merge(all, batch);
  try {
    window.localStorage.setItem(`${PENDING_KEY}:${uid}`, JSON.stringify(all));
  } catch {
    // sin almacenamiento: se pierde, es una cuenta aproximada
  }
}

async function flush(keepalive = false) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!uid || sending || Object.keys(pending).length === 0) return;
  if (!keepalive && typeof navigator !== "undefined" && navigator.onLine === false) {
    timer = setTimeout(() => void flush(), FLUSH_MS);
    return;
  }
  const days = pending;
  pending = {};
  sending = true;
  try {
    const res = await fetch("/api/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days }),
      keepalive,
    });
    // Un 4xx (sesión terminada, datos inválidos) no se arregla reintentando: se descarta.
    if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
  } catch {
    merge(pending, days);
    if (uid && !timer) timer = setTimeout(() => void flush(), FLUSH_MS);
  } finally {
    sending = false;
  }
}

// ---------- Ciclo de vida ----------

/** Empieza a contar para esta persona; devuelve la función que lo detiene. */
export function startUsage(id: string): () => void {
  uid = id;
  merge(pending, stored());
  try {
    window.localStorage.removeItem(`${PENDING_KEY}:${id}`);
  } catch {
    // sin almacenamiento
  }

  let counted = false;
  try {
    counted = window.sessionStorage.getItem(`${OPENED_KEY}:${id}`) === "1";
    window.sessionStorage.setItem(`${OPENED_KEY}:${id}`, "1");
  } catch {
    // sin almacenamiento: se cuenta como apertura
  }
  if (!counted) trackOpen();

  let hiddenAt = 0;
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      void flush(true);
    } else if (hiddenAt && Date.now() - hiddenAt > IDLE_OPEN_MS) {
      hiddenAt = 0;
      trackOpen();
    }
  };
  document.addEventListener("click", trackTap, true);
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    document.removeEventListener("click", trackTap, true);
    document.removeEventListener("visibilitychange", onVisibility);
    if (timer) clearTimeout(timer);
    timer = null;
    // Al cerrar sesión no se puede mandar: queda guardado para la próxima vez que entre.
    persist(pending);
    pending = {};
    uid = null;
  };
}
