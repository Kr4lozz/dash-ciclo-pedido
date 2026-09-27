"use client";

// Sesión del lado del navegador: al abrir la app pregunta al servidor si hay cuentas y
// quién está conectado, y configura el almacenamiento en consecuencia.

import { useSyncExternalStore } from "react";
import type { SessionInfo, SessionUser } from "./account";
import {
  configureStore,
  flushNow,
  forgetUserCache,
  setUnauthorizedHandler,
} from "./store";

export type SessionState =
  | { status: "loading" }
  /** sin base de datos: cada dispositivo guarda sus datos */
  | { status: "local" }
  /** hay cuentas y nadie entró (expired: la sesión terminó sola) */
  | { status: "anon"; expired?: boolean }
  | { status: "user"; user: SessionUser; offline: boolean }
  | { status: "error" };

const CACHE_KEY = "mis-calorias:sesion";
const LOADING: SessionState = { status: "loading" };

let state: SessionState = LOADING;
const listeners = new Set<() => void>();

function set(next: SessionState) {
  state = next;
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, () => state, () => LOADING);
}

export function getSession(): SessionState {
  return state;
}

function readCache(): SessionInfo | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as SessionInfo) : null;
  } catch {
    return null;
  }
}

function writeCache(info: SessionInfo) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(info));
  } catch {
    // sin almacenamiento
  }
}

function apply(info: SessionInfo, offline: boolean) {
  if (!info.storage) {
    configureStore({ kind: "local" });
    set({ status: "local" });
  } else if (info.user) {
    configureStore({ kind: "user", uid: info.user.id });
    set({ status: "user", user: info.user, offline });
  } else {
    configureStore({ kind: "none" });
    set({ status: "anon" });
  }
}

let started = false;

/** Se llama una vez al abrir la app. */
export function initSession() {
  if (started) return;
  started = true;
  setUnauthorizedHandler(expire);
  void load();
}

async function load() {
  const cached = readCache();
  let info: SessionInfo | null = null;
  let offline = false;
  try {
    const res = await fetch("/api/session", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    info = (await res.json()) as SessionInfo;
    writeCache(info);
  } catch {
    // Sin conexión: se abre con la última sesión conocida.
    info = cached;
    offline = true;
  }
  if (!info) set({ status: "error" });
  else if (info.storage && !info.user && cached?.user) {
    // Había alguien conectado en este dispositivo y su sesión ya no vale
    // (p. ej. le restablecieron la contraseña): se le pide volver a entrar.
    configureStore({ kind: "none" });
    set({ status: "anon", expired: true });
  } else apply(info, offline);
}

export function retrySession() {
  set(LOADING);
  void load();
}

/** Después de entrar o registrarse. */
export function signedIn(user: SessionUser) {
  const info = { storage: true, user };
  writeCache(info);
  apply(info, false);
}

/** El servidor dijo que la sesión terminó (p. ej. se restableció la contraseña). */
function expire() {
  writeCache({ storage: true, user: null });
  configureStore({ kind: "none" });
  set({ status: "anon", expired: true });
}

/**
 * Cierra la sesión. Si hay cambios sin guardar y no hay conexión devuelve "pending"
 * (salvo que se fuerce), para no perderlos.
 */
export async function signOut(force = false): Promise<"ok" | "pending"> {
  if (state.status !== "user") return "ok";
  const uid = state.user.id;
  if (!(await flushNow()) && !force) return "pending";
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  forgetUserCache(uid);
  writeCache({ storage: true, user: null });
  configureStore({ kind: "none" });
  set({ status: "anon" });
  return "ok";
}
