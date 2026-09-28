"use client";

// Datos de la app en el navegador. Dos modos:
// - local: sin base de datos en el servidor; todo vive en localStorage de este dispositivo.
// - cuenta: los datos de la persona se guardan en el servidor. localStorage funciona como
//   caché (la app abre al instante y sin conexión) y los cambios se envían por día en segundo
//   plano, con reintentos si no hay internet.
// useSyncExternalStore mantiene sincronizadas las pantallas.

import { useSyncExternalStore } from "react";
import { isValidDateStr, todayStr } from "./dates";
import { defaultMacroPct, defaultProfile } from "./nutrition";
import type { DataPut, DayDoc, ServerData } from "./schemas";
import { toast } from "./toast";
import {
  MEALS,
  type AppData,
  type DayBurn,
  type ExerciseEntry,
  type FoodEntry,
  type FoodSource,
  type MealType,
  type Profile,
  type WeightEntry,
} from "./types";

const LOCAL_KEY = "mis-calorias:v1";
const LEGACY_BACKUP_KEY = "mis-calorias:v1:respaldo";
const CODE_KEY = "mis-calorias:access-code";
const userKey = (uid: string) => `mis-calorias:u:${uid}`;
const pendingKey = (uid: string) => `mis-calorias:pendientes:${uid}`;

const EMPTY: AppData = {
  version: 1,
  profile: null,
  foods: [],
  exercises: [],
  water: {},
  burned: {},
  weights: [],
};

export type StoreMode = { kind: "none" } | { kind: "local" } | { kind: "user"; uid: string };

export interface StoreStatus {
  /** Hay datos para mostrar (caché o descarga completa). */
  ready: boolean;
  error: string | null;
}

/** idle: todo guardado · pending: cambios esperando · saving · offline · error */
export type SyncState = "idle" | "pending" | "saving" | "offline" | "error";

let mode: StoreMode = { kind: "none" };
let data: AppData = EMPTY;
let status: StoreStatus = { ready: false, error: null };
let syncState: SyncState = "idle";
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const SERVER_STATUS: StoreStatus = { ready: false, error: null };

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, () => data, () => EMPTY);
}

export function useStoreStatus(): StoreStatus {
  return useSyncExternalStore(subscribe, () => status, () => SERVER_STATUS);
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribe, () => syncState, () => "idle" as SyncState);
}

export function getStoreMode(): StoreMode {
  return mode;
}

// ---------- localStorage ----------

function readJSON<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function removeKey(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // sin almacenamiento
  }
}

function dataKey(): string | null {
  if (mode.kind === "local") return LOCAL_KEY;
  if (mode.kind === "user") return userKey(mode.uid);
  return null;
}

function persistData() {
  const key = dataKey();
  if (!key) return;
  if (!writeJSON(key, data) && mode.kind === "local") {
    toast(
      "No se pudo guardar en el dispositivo (almacenamiento lleno). Exporta tus datos desde Perfil.",
      "error",
    );
  }
}

// ---------- Modo ----------

/** La sesión decide el modo al arrancar, al entrar o al salir de una cuenta. */
export function configureStore(next: StoreMode) {
  const same =
    next.kind === mode.kind && (next.kind !== "user" || (mode.kind === "user" && mode.uid === next.uid));
  if (same) return;
  clearTimeout(flushTimer);
  mode = next;
  retryDelay = 0;
  pending = new Map();

  if (next.kind === "local") {
    const raw = readJSON<unknown>(LOCAL_KEY);
    data = raw ? normalizeData(raw) : EMPTY;
    status = { ready: true, error: null };
  } else if (next.kind === "user") {
    const raw = readJSON<unknown>(userKey(next.uid));
    data = raw ? normalizeData(raw) : EMPTY;
    pending = new Map(Object.entries(readJSON<Record<string, number>>(pendingKey(next.uid)) ?? {}));
    seq = Math.max(0, ...pending.values());
    status = { ready: raw !== null, error: null };
    void pullRemote();
  } else {
    data = EMPTY;
    status = { ready: false, error: null };
  }
  syncState = pending.size > 0 ? "pending" : "idle";
  emit();
}

let onUnauthorized: () => void = () => {};

/** La sesión registra qué hacer si el servidor responde que la sesión terminó. */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export function notifyUnauthorized() {
  if (mode.kind === "user") onUnauthorized();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    const key = dataKey();
    if (key && e.key === key) {
      const raw = readJSON<unknown>(key);
      data = raw ? normalizeData(raw) : EMPTY;
      emit();
    }
  });
  window.addEventListener("online", () => {
    if (pending.size > 0) void flush();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      if (pending.size > 0) void flush({ keepalive: true });
    } else if (mode.kind === "user" && !flushing && Date.now() - lastPull > 60_000) {
      // Trae lo que se haya registrado desde otro dispositivo.
      void pullRemote();
    }
  });
}

// ---------- Cambios ----------

interface Dirty {
  days?: string[];
  profile?: boolean;
  weights?: boolean;
  /** reemplazar todo (importar respaldo o borrar todo) */
  replace?: boolean;
}

function update(fn: (d: AppData) => AppData, dirty: Dirty) {
  if (mode.kind === "none") return;
  data = fn(data);
  persistData();
  if (mode.kind === "user") {
    markDirty(dirty);
    scheduleFlush();
  }
  emit();
}

export function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// ---------- Comidas ----------

export type NewFood = Omit<FoodEntry, "id" | "createdAt">;

export function addFoods(items: NewFood[]) {
  const now = Date.now();
  const entries = items
    .map((f, i) => normalizeFood({ ...f, id: uid(), createdAt: now + i }))
    .filter((e): e is FoodEntry => e !== null);
  update((d) => ({ ...d, foods: [...d.foods, ...entries] }), { days: entries.map((e) => e.date) });
}

export function updateFood(id: string, patch: Partial<NewFood>) {
  const before = data.foods.find((f) => f.id === id);
  if (!before) return;
  const after = normalizeFood({ ...before, ...patch }) ?? before;
  update((d) => ({ ...d, foods: d.foods.map((f) => (f.id === id ? after : f)) }), {
    days: [before.date, after.date],
  });
}

export function deleteFood(id: string) {
  const before = data.foods.find((f) => f.id === id);
  if (!before) return;
  update((d) => ({ ...d, foods: d.foods.filter((f) => f.id !== id) }), { days: [before.date] });
}

// ---------- Ejercicio ----------

export type NewExercise = Omit<ExerciseEntry, "id" | "createdAt">;

export function addExercise(e: NewExercise) {
  const entry = normalizeExercise({ ...e, id: uid(), createdAt: Date.now() });
  if (!entry) return;
  update((d) => ({ ...d, exercises: [...d.exercises, entry] }), { days: [entry.date] });
}

export function updateExercise(id: string, patch: Partial<NewExercise>) {
  const before = data.exercises.find((e) => e.id === id);
  if (!before) return;
  const after = normalizeExercise({ ...before, ...patch }) ?? before;
  update((d) => ({ ...d, exercises: d.exercises.map((e) => (e.id === id ? after : e)) }), {
    days: [before.date, after.date],
  });
}

export function deleteExercise(id: string) {
  const before = data.exercises.find((e) => e.id === id);
  if (!before) return;
  update((d) => ({ ...d, exercises: d.exercises.filter((e) => e.id !== id) }), {
    days: [before.date],
  });
}

// ---------- Agua ----------

export function setWater(date: string, ml: number) {
  update((d) => ({ ...d, water: { ...d.water, [date]: Math.max(0, Math.round(ml)) } }), {
    days: [date],
  });
}

// ---------- Calorías quemadas según el reloj ----------

/** Guarda lo que marca Apple Fitness para el día; null en ambos valores lo borra. */
export function setBurned(date: string, burn: DayBurn) {
  const clean = normalizeBurn(burn);
  update(
    (d) => {
      const burned = { ...d.burned };
      if (clean) burned[date] = clean;
      else delete burned[date];
      return { ...d, burned };
    },
    { days: [date] },
  );
}

// ---------- Perfil y peso ----------

export function saveProfile(p: Profile) {
  update(
    (d) => {
      const prevWeight = d.profile?.weightKg;
      let weights = d.weights;
      // Registrar el peso de hoy cuando se crea el perfil o cambia el peso.
      if (prevWeight !== p.weightKg) weights = upsertWeight(weights, todayStr(), p.weightKg);
      return { ...d, profile: p, weights };
    },
    { profile: true, weights: true },
  );
}

export function logWeight(date: string, kg: number) {
  update(
    (d) => {
      const weights = upsertWeight(d.weights, date, kg);
      const latest = weights[weights.length - 1];
      const profile =
        d.profile && latest.date === date ? { ...d.profile, weightKg: kg } : d.profile;
      return { ...d, weights, profile };
    },
    { weights: true, profile: true },
  );
}

export function deleteWeight(date: string) {
  update((d) => ({ ...d, weights: d.weights.filter((w) => w.date !== date) }), { weights: true });
}

function upsertWeight(list: WeightEntry[], date: string, kg: number): WeightEntry[] {
  return [...list.filter((w) => w.date !== date), { date, kg: round1(kg) }].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

// ---------- Respaldo ----------

export function exportData(): string {
  return JSON.stringify(data, null, 2);
}

/** Reemplaza todos los datos. Lanza un error si el archivo no es válido. */
export function importData(raw: unknown) {
  if (!raw || typeof raw !== "object" || (raw as { version?: unknown }).version !== 1) {
    throw new Error("El archivo no es un respaldo válido de Mis Calorías.");
  }
  const next = normalizeData(raw);
  update(() => next, { replace: true });
  return next;
}

export function resetData() {
  update(() => EMPTY, { replace: true });
}

// ---------- Datos guardados en este celular antes de usar cuentas ----------

export interface LegacySummary {
  foods: number;
  exercises: number;
  /** días con calorías de Apple Fitness */
  burned: number;
  weights: number;
  profile: boolean;
}

/** Datos del modo local que siguen en este dispositivo (solo en modo cuenta). */
export function legacySummary(): LegacySummary | null {
  if (mode.kind !== "user") return null;
  const raw = readJSON<unknown>(LOCAL_KEY);
  if (!raw) return null;
  const d = normalizeData(raw);
  const summary = {
    foods: d.foods.length,
    exercises: d.exercises.length,
    burned: Object.keys(d.burned).length,
    weights: d.weights.length,
    profile: d.profile !== null,
  };
  const any = summary.foods || summary.exercises || summary.burned || summary.weights || summary.profile;
  return any ? summary : null;
}

/** Suma a la cuenta lo que había en este celular (sin pisar lo que ya tiene la cuenta). */
export function migrateLegacyData() {
  const raw = readJSON<unknown>(LOCAL_KEY);
  if (!raw || mode.kind !== "user") return;
  const legacy = normalizeData(raw);
  const foodIds = new Set(data.foods.map((f) => f.id));
  const exerciseIds = new Set(data.exercises.map((e) => e.id));
  const foods = legacy.foods.filter((f) => !foodIds.has(f.id));
  const exercises = legacy.exercises.filter((e) => !exerciseIds.has(e.id));
  const waterDates = Object.keys(legacy.water).filter((d) => !data.water[d]);
  const burnedDates = Object.keys(legacy.burned).filter((d) => !data.burned[d]);
  const weightDates = new Set(data.weights.map((w) => w.date));
  const days = new Set([
    ...foods.map((f) => f.date),
    ...exercises.map((e) => e.date),
    ...waterDates,
    ...burnedDates,
  ]);
  const takeProfile = !data.profile && legacy.profile !== null;

  update(
    (d) => ({
      ...d,
      profile: d.profile ?? legacy.profile,
      foods: [...d.foods, ...foods],
      exercises: [...d.exercises, ...exercises],
      water: { ...legacy.water, ...Object.fromEntries(Object.entries(d.water).filter(([, ml]) => ml > 0)) },
      burned: { ...legacy.burned, ...d.burned },
      weights: [...d.weights, ...legacy.weights.filter((w) => !weightDates.has(w.date))].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    }),
    { days: [...days], weights: true, profile: takeProfile },
  );
  archiveLegacy();
}

export function discardLegacyData() {
  archiveLegacy();
}

function archiveLegacy() {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (raw) window.localStorage.setItem(LEGACY_BACKUP_KEY, raw);
  } catch {
    // si no cabe la copia, igual se retira para no volver a ofrecerla
  }
  removeKey(LOCAL_KEY);
}

// ---------- Sincronización con la cuenta ----------

let pending = new Map<string, number>(); // "day:2026-09-27" | "profile" | "weights" | "replace" → secuencia
let seq = 0;
let flushing = false;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let retryDelay = 0;
let lastPull = 0;

function setSync(next: SyncState) {
  if (syncState !== next) {
    syncState = next;
    emit();
  }
}

function persistPending() {
  if (mode.kind !== "user") return;
  if (pending.size === 0) removeKey(pendingKey(mode.uid));
  else writeJSON(pendingKey(mode.uid), Object.fromEntries(pending));
}

function markDirty(d: Dirty) {
  const mark = (k: string) => pending.set(k, ++seq);
  if (d.replace) mark("replace");
  if (d.profile) mark("profile");
  if (d.weights) mark("weights");
  for (const date of new Set(d.days ?? [])) mark(`day:${date}`);
  persistPending();
  syncState = "pending";
}

function scheduleFlush(delay = 700) {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flush(), delay);
}

function groupByDay(): Map<string, DayDoc> {
  const days = new Map<string, DayDoc>();
  const day = (date: string) => {
    let doc = days.get(date);
    if (!doc) {
      doc = {
        foods: [],
        exercises: [],
        water: data.water[date] ?? 0,
        burned: data.burned[date] ?? null,
      };
      days.set(date, doc);
    }
    return doc;
  };
  for (const f of data.foods) day(f.date).foods.push(f);
  for (const e of data.exercises) day(e.date).exercises.push(e);
  for (const [date, ml] of Object.entries(data.water)) if (ml > 0) day(date);
  for (const date of Object.keys(data.burned)) day(date);
  return days;
}

/** Arma las solicitudes con los cambios pendientes, en tandas de hasta 150 días. */
function buildPayloads(): DataPut[] {
  const days = groupByDay();
  const replace = pending.has("replace");
  const dates = replace
    ? [...days.keys()]
    : [...pending.keys()].filter((k) => k.startsWith("day:")).map((k) => k.slice(4));
  const first: DataPut = {};
  if (replace) first.replace = true;
  if (replace || pending.has("profile")) first.profile = data.profile;
  if (replace || pending.has("weights")) first.weights = data.weights;
  const payloads: DataPut[] = [first];
  for (let i = 0; i < dates.length; i += 150) {
    const chunk = Object.fromEntries(dates.slice(i, i + 150).map((d) => [d, days.get(d) ?? null]));
    if (i === 0) first.days = chunk;
    else payloads.push({ days: chunk });
  }
  return payloads;
}

/** Envía los cambios pendientes. true si quedó todo guardado. */
async function flush(opts?: { keepalive?: boolean }): Promise<boolean> {
  if (mode.kind !== "user" || pending.size === 0) return pending.size === 0;
  if (flushing) {
    scheduleFlush(500);
    return false;
  }
  clearTimeout(flushTimer);
  flushing = true;
  setSync("saving");
  const uidAtStart = mode.uid;
  const upTo = seq;
  try {
    for (const payload of buildPayloads()) {
      const body = JSON.stringify(payload);
      const res = await fetch("/api/data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: Boolean(opts?.keepalive) && body.length < 60_000,
      });
      if (res.status === 401) {
        setSync("pending");
        onUnauthorized();
        return false;
      }
      if (res.status >= 400 && res.status < 500) {
        // Datos que el servidor no acepta: se descartan para no reintentar para siempre.
        console.error("No se pudo guardar:", res.status, await res.text().catch(() => ""));
        toast("Un cambio no se pudo guardar en tu cuenta.", "error");
        break;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }
    if (mode.kind !== "user" || mode.uid !== uidAtStart) return false;
    for (const [key, s] of pending) if (s <= upTo) pending.delete(key);
    persistPending();
    retryDelay = 0;
    setSync(pending.size > 0 ? "pending" : "idle");
    if (pending.size > 0) scheduleFlush(300);
    return pending.size === 0;
  } catch {
    setSync(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
    retryDelay = Math.min(retryDelay ? retryDelay * 2 : 3000, 60_000);
    scheduleFlush(retryDelay);
    return false;
  } finally {
    flushing = false;
  }
}

/** Intenta guardar ya lo pendiente (antes de cerrar sesión). */
export async function flushNow(): Promise<boolean> {
  if (mode.kind !== "user") return true;
  if (pending.size === 0) return true;
  for (let i = 0; i < 20 && flushing; i++) await new Promise((r) => setTimeout(r, 150));
  return flush();
}

export function pendingChanges(): number {
  return pending.size;
}

/** Descarga los datos de la cuenta y los combina con los cambios que aún no se enviaron. */
async function pullRemote() {
  if (mode.kind !== "user") return;
  const uidAtStart = mode.uid;
  lastPull = Date.now();
  try {
    const res = await fetch("/api/data", { cache: "no-store" });
    if (res.status === 401) {
      onUnauthorized();
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const server = (await res.json()) as ServerData;
    if (mode.kind !== "user" || mode.uid !== uidAtStart) return;
    data = mergeRemote(server);
    persistData();
    status = { ready: true, error: null };
    emit();
    if (pending.size > 0) scheduleFlush(0);
  } catch {
    if (mode.kind === "user" && mode.uid === uidAtStart && !status.ready) {
      status = { ready: false, error: "No se pudieron cargar tus datos. Revisa tu conexión." };
      emit();
    }
  }
}

export function retryLoad() {
  if (mode.kind !== "user") return;
  status = { ready: false, error: null };
  emit();
  void pullRemote();
}

function mergeRemote(server: ServerData): AppData {
  if (pending.has("replace")) return data;
  const days = server.days ?? {};
  const remote = normalizeData({
    version: 1,
    profile: server.profile,
    weights: server.weights,
    foods: Object.values(days).flatMap((d) => d.foods ?? []),
    exercises: Object.values(days).flatMap((d) => d.exercises ?? []),
    water: Object.fromEntries(Object.entries(days).map(([date, d]) => [date, d.water ?? 0])),
    burned: Object.fromEntries(Object.entries(days).map(([date, d]) => [date, d.burned ?? null])),
  });
  // Lo que todavía no se envió manda sobre lo que hay en el servidor.
  const localDays = new Set(
    [...pending.keys()].filter((k) => k.startsWith("day:")).map((k) => k.slice(4)),
  );
  const keepLocal = <T extends { date: string }>(remoteList: T[], localList: T[]) => [
    ...remoteList.filter((e) => !localDays.has(e.date)),
    ...localList.filter((e) => localDays.has(e.date)),
  ];
  const water = Object.fromEntries(Object.entries(remote.water).filter(([d]) => !localDays.has(d)));
  for (const d of localDays) if (data.water[d]) water[d] = data.water[d];
  const burned = Object.fromEntries(
    Object.entries(remote.burned).filter(([d]) => !localDays.has(d)),
  );
  for (const d of localDays) if (data.burned[d]) burned[d] = data.burned[d];
  return {
    version: 1,
    profile: pending.has("profile") ? data.profile : remote.profile,
    weights: pending.has("weights") ? data.weights : remote.weights,
    foods: keepLocal(remote.foods, data.foods),
    exercises: keepLocal(remote.exercises, data.exercises),
    water,
    burned,
  };
}

/** Borra la copia de una cuenta de este dispositivo (al cerrar sesión). */
export function forgetUserCache(uidToForget: string) {
  removeKey(userKey(uidToForget));
  removeKey(pendingKey(uidToForget));
  removeKey(userScopedKey("menu", uidToForget));
}

/** Clave de este dispositivo para datos propios de cada cuenta (o del modo local). */
export function userScopedKey(name: string, uidOverride?: string): string {
  const id = uidOverride ?? (mode.kind === "user" ? mode.uid : "local");
  return `mis-calorias:${name}:${id}`;
}

// ---------- Código de acceso a la API (solo modo local) ----------

export function getAccessCode(): string {
  try {
    return window.localStorage.getItem(CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setAccessCode(code: string) {
  try {
    if (code) window.localStorage.setItem(CODE_KEY, code);
    else window.localStorage.removeItem(CODE_KEY);
  } catch {
    // Sin almacenamiento disponible: el código solo dura esta sesión.
  }
}

// ---------- Fecha seleccionada (no se guarda: al recargar vuelve a hoy) ----------

let selectedDate: string | null = null;
const dateListeners = new Set<() => void>();

function subscribeDate(l: () => void) {
  dateListeners.add(l);
  return () => {
    dateListeners.delete(l);
  };
}

export function setSelectedDate(date: string) {
  selectedDate = date === todayStr() ? null : date;
  for (const l of dateListeners) l();
}

export function useSelectedDate(): string {
  return useSyncExternalStore(
    subscribeDate,
    () => selectedDate ?? todayStr(),
    () => "",
  );
}

// ---------- Normalización (datos guardados, importados o del servidor) ----------

const MEAL_IDS = new Set<string>(MEALS.map((m) => m.id));
const SOURCES = new Set<string>(["foto", "texto", "manual", "reciente"]);

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function normalizeFood(v: unknown): FoodEntry | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const date = o.date;
  if (!isValidDateStr(date)) return null;
  const name = str(o.name).trim().slice(0, 120);
  if (!name) return null;
  return {
    id: str(o.id).slice(0, 64) || uid(),
    date,
    meal: (MEAL_IDS.has(str(o.meal)) ? o.meal : "snack") as MealType,
    name,
    portion: str(o.portion).trim().slice(0, 80),
    calories: Math.min(20000, Math.max(0, Math.round(num(o.calories)))),
    protein: Math.min(2000, Math.max(0, round1(num(o.protein)))),
    carbs: Math.min(2000, Math.max(0, round1(num(o.carbs)))),
    fat: Math.min(2000, Math.max(0, round1(num(o.fat)))),
    source: (SOURCES.has(str(o.source)) ? o.source : "manual") as FoodSource,
    createdAt: num(o.createdAt, Date.now()),
  };
}

function normalizeExercise(v: unknown): ExerciseEntry | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!isValidDateStr(o.date)) return null;
  const name = str(o.name).trim().slice(0, 120);
  if (!name) return null;
  const minutes = o.minutes == null ? null : Math.min(1440, Math.max(0, Math.round(num(o.minutes))));
  return {
    id: str(o.id).slice(0, 64) || uid(),
    date: o.date,
    name,
    minutes: minutes || null,
    calories: Math.min(20000, Math.max(0, Math.round(num(o.calories)))),
    createdAt: num(o.createdAt, Date.now()),
  };
}

function normalizeProfile(v: unknown): Profile | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const base = defaultProfile();
  const goal = (["perder", "mantener", "ganar"].includes(str(o.goal)) ? o.goal : base.goal) as Profile["goal"];
  const pct = (o.macroPct ?? {}) as Record<string, unknown>;
  const macroPct = {
    protein: num(pct.protein, NaN),
    carbs: num(pct.carbs, NaN),
    fat: num(pct.fat, NaN),
  };
  const override = num(o.calorieOverride, 0);
  const clamp = (n: number, max: number) => Math.min(max, Math.max(0, n));
  return {
    name: str(o.name).slice(0, 60),
    sex: o.sex === "hombre" ? "hombre" : "mujer",
    age: clamp(num(o.age, base.age), 120),
    heightCm: clamp(num(o.heightCm, base.heightCm), 260),
    weightKg: clamp(num(o.weightKg, base.weightKg), 400),
    activity: (["sedentario", "ligero", "moderado", "activo", "muy_activo"].includes(str(o.activity))
      ? o.activity
      : base.activity) as Profile["activity"],
    goal,
    rateKgWeek: clamp(num(o.rateKgWeek, base.rateKgWeek), 2),
    calorieOverride: override > 0 ? Math.min(10000, Math.round(override)) : null,
    macroPct: Object.values(macroPct).every((n) => Number.isFinite(n) && n >= 0 && n <= 100)
      ? macroPct
      : defaultMacroPct(goal),
    waterGoalMl: clamp(num(o.waterGoalMl, base.waterGoalMl), 20000),
  };
}

function normalizeBurn(v: unknown): DayBurn | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const kcal = (x: unknown) => {
    const n = Math.round(num(x));
    return n > 0 ? Math.min(20000, n) : null;
  };
  const burn = { total: kcal(o.total), active: kcal(o.active) };
  return burn.total === null && burn.active === null ? null : burn;
}

function normalizeData(raw: unknown): AppData {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  const water: Record<string, number> = {};
  if (o.water && typeof o.water === "object") {
    for (const [k, v] of Object.entries(o.water as Record<string, unknown>)) {
      const ml = Math.min(20000, Math.max(0, Math.round(num(v))));
      if (isValidDateStr(k) && ml > 0) water[k] = ml;
    }
  }
  const burned: Record<string, DayBurn> = {};
  if (o.burned && typeof o.burned === "object") {
    for (const [k, v] of Object.entries(o.burned as Record<string, unknown>)) {
      const burn = normalizeBurn(v);
      if (isValidDateStr(k) && burn) burned[k] = burn;
    }
  }
  const weights = list(o.weights)
    .map((w) => {
      const e = (w ?? {}) as Record<string, unknown>;
      const kg = num(e.kg);
      return isValidDateStr(e.date) && kg >= 10 && kg <= 500 ? { date: e.date, kg: round1(kg) } : null;
    })
    .filter((w): w is WeightEntry => w !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    version: 1,
    profile: normalizeProfile(o.profile),
    foods: list(o.foods).map(normalizeFood).filter((f): f is FoodEntry => f !== null),
    exercises: list(o.exercises)
      .map(normalizeExercise)
      .filter((e): e is ExerciseEntry => e !== null),
    water,
    burned,
    weights,
  };
}
