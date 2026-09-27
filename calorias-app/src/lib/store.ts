"use client";

// Todos los datos viven en localStorage del dispositivo (uso personal, sin cuentas).
// useSyncExternalStore mantiene sincronizadas las pantallas y las pestañas abiertas.

import { useSyncExternalStore } from "react";
import { isValidDateStr, todayStr } from "./dates";
import { toast } from "./toast";
import {
  MEALS,
  type AppData,
  type ExerciseEntry,
  type FoodEntry,
  type FoodSource,
  type MealType,
  type Profile,
  type WeightEntry,
} from "./types";
import { defaultMacroPct, defaultProfile } from "./nutrition";

const DATA_KEY = "mis-calorias:v1";
const CODE_KEY = "mis-calorias:access-code";

const EMPTY: AppData = {
  version: 1,
  profile: null,
  foods: [],
  exercises: [],
  water: {},
  weights: [],
};

let data: AppData = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function readStorage(): AppData {
  try {
    const raw = window.localStorage.getItem(DATA_KEY);
    return raw ? normalizeData(JSON.parse(raw)) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  data = readStorage();
  window.addEventListener("storage", (e) => {
    if (e.key === DATA_KEY) {
      data = readStorage();
      emit();
    }
  });
}

function subscribe(listener: () => void) {
  ensureLoaded();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AppData {
  ensureLoaded();
  return data;
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

function update(fn: (d: AppData) => AppData) {
  ensureLoaded();
  data = fn(data);
  try {
    window.localStorage.setItem(DATA_KEY, JSON.stringify(data));
  } catch {
    toast(
      "No se pudo guardar en el dispositivo (almacenamiento lleno). Exporta tus datos desde Perfil.",
      "error",
    );
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
  const entries = items.map((f, i) => normalizeFood({ ...f, id: uid(), createdAt: now + i }));
  update((d) => ({ ...d, foods: [...d.foods, ...entries.filter((e): e is FoodEntry => e !== null)] }));
}

export function updateFood(id: string, patch: Partial<NewFood>) {
  update((d) => ({
    ...d,
    foods: d.foods.map((f) => (f.id === id ? (normalizeFood({ ...f, ...patch }) ?? f) : f)),
  }));
}

export function deleteFood(id: string) {
  update((d) => ({ ...d, foods: d.foods.filter((f) => f.id !== id) }));
}

// ---------- Ejercicio ----------

export type NewExercise = Omit<ExerciseEntry, "id" | "createdAt">;

export function addExercise(e: NewExercise) {
  const entry = normalizeExercise({ ...e, id: uid(), createdAt: Date.now() });
  if (!entry) return;
  update((d) => ({ ...d, exercises: [...d.exercises, entry] }));
}

export function updateExercise(id: string, patch: Partial<NewExercise>) {
  update((d) => ({
    ...d,
    exercises: d.exercises.map((e) =>
      e.id === id ? (normalizeExercise({ ...e, ...patch }) ?? e) : e,
    ),
  }));
}

export function deleteExercise(id: string) {
  update((d) => ({ ...d, exercises: d.exercises.filter((e) => e.id !== id) }));
}

// ---------- Agua ----------

export function setWater(date: string, ml: number) {
  update((d) => ({ ...d, water: { ...d.water, [date]: Math.max(0, Math.round(ml)) } }));
}

// ---------- Perfil y peso ----------

export function saveProfile(p: Profile) {
  update((d) => {
    const prevWeight = d.profile?.weightKg;
    let weights = d.weights;
    // Registrar el peso de hoy cuando se crea el perfil o cambia el peso.
    if (prevWeight !== p.weightKg) weights = upsertWeight(weights, todayStr(), p.weightKg);
    return { ...d, profile: p, weights };
  });
}

export function logWeight(date: string, kg: number) {
  update((d) => {
    const weights = upsertWeight(d.weights, date, kg);
    const latest = weights[weights.length - 1];
    const profile =
      d.profile && latest.date === date ? { ...d.profile, weightKg: kg } : d.profile;
    return { ...d, weights, profile };
  });
}

export function deleteWeight(date: string) {
  update((d) => ({ ...d, weights: d.weights.filter((w) => w.date !== date) }));
}

function upsertWeight(list: WeightEntry[], date: string, kg: number): WeightEntry[] {
  return [...list.filter((w) => w.date !== date), { date, kg: round1(kg) }].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

// ---------- Respaldo ----------

export function exportData(): string {
  ensureLoaded();
  return JSON.stringify(data, null, 2);
}

/** Reemplaza todos los datos. Lanza un error si el archivo no es válido. */
export function importData(raw: unknown) {
  if (!raw || typeof raw !== "object" || (raw as { version?: unknown }).version !== 1) {
    throw new Error("El archivo no es un respaldo válido de Mis Calorías.");
  }
  const next = normalizeData(raw);
  update(() => next);
  return next;
}

export function resetData() {
  update(() => EMPTY);
}

// ---------- Código de acceso a la API ----------

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

// ---------- Normalización (datos guardados o importados) ----------

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
    id: str(o.id) || uid(),
    date,
    meal: (MEAL_IDS.has(str(o.meal)) ? o.meal : "snack") as MealType,
    name,
    portion: str(o.portion).trim().slice(0, 80),
    calories: Math.max(0, Math.round(num(o.calories))),
    protein: Math.max(0, round1(num(o.protein))),
    carbs: Math.max(0, round1(num(o.carbs))),
    fat: Math.max(0, round1(num(o.fat))),
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
  const minutes = o.minutes == null ? null : Math.max(0, Math.round(num(o.minutes)));
  return {
    id: str(o.id) || uid(),
    date: o.date,
    name,
    minutes: minutes || null,
    calories: Math.max(0, Math.round(num(o.calories))),
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
  return {
    name: str(o.name).slice(0, 60),
    sex: o.sex === "hombre" ? "hombre" : "mujer",
    age: num(o.age, base.age),
    heightCm: num(o.heightCm, base.heightCm),
    weightKg: num(o.weightKg, base.weightKg),
    activity: (["sedentario", "ligero", "moderado", "activo", "muy_activo"].includes(str(o.activity))
      ? o.activity
      : base.activity) as Profile["activity"],
    goal,
    rateKgWeek: num(o.rateKgWeek, base.rateKgWeek),
    calorieOverride: override > 0 ? Math.round(override) : null,
    macroPct: Object.values(macroPct).every(Number.isFinite) ? macroPct : defaultMacroPct(goal),
    waterGoalMl: num(o.waterGoalMl, base.waterGoalMl),
  };
}

function normalizeData(raw: unknown): AppData {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  const water: Record<string, number> = {};
  if (o.water && typeof o.water === "object") {
    for (const [k, v] of Object.entries(o.water as Record<string, unknown>)) {
      if (isValidDateStr(k)) water[k] = Math.max(0, Math.round(num(v)));
    }
  }
  const weights = list(o.weights)
    .map((w) => {
      const e = (w ?? {}) as Record<string, unknown>;
      const kg = num(e.kg);
      return isValidDateStr(e.date) && kg > 0 ? { date: e.date, kg: round1(kg) } : null;
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
    weights,
  };
}
