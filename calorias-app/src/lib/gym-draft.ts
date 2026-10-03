"use client";

// El entrenamiento en curso. Vive en este dispositivo (por cuenta) mientras se hace, así no se
// pierde si se cierra la app o se pasa a otra pantalla; al terminarlo se guarda en la cuenta.

import { useSyncExternalStore } from "react";
import { parseNum } from "./format";
import { lastSets, timeUnit } from "./gym";
import { uid, userScopedKey } from "./store";
import {
  MODE_IDS,
  MUSCLE_IDS,
  type ExerciseMode,
  type GymExercise,
  type GymSet,
  type MuscleGroup,
  type Routine,
  type RoutineExercise,
  type Workout,
  type WorkoutExercise,
} from "./types";

/** kg y repeticiones tal como se escriben; en los ejercicios de tiempo `reps` guarda la duración. */
export interface DraftSet {
  kg: string;
  reps: string;
  done: boolean;
}

export interface DraftExercise {
  key: string;
  exerciseId: string;
  name: string;
  muscle: MuscleGroup;
  mode: ExerciseMode;
  note: string;
  sets: DraftSet[];
}

export interface Draft {
  date: string;
  name: string;
  routineId: string | null;
  startedAt: number;
  note: string;
  exercises: DraftExercise[];
}

// ---------- Armado ----------

/** 62.5 → "62,5" · 0 → "" */
const text = (n: number) => (n > 0 ? String(Math.round(n * 100) / 100).replace(".", ",") : "");

export interface ExerciseSeed extends Pick<GymExercise, "name" | "muscle" | "mode"> {
  id: string;
  /** objetivo de una rutina */
  target?: { sets: number; reps: number; sec: number };
}

/** Un ejercicio con sus series ya llenas con lo de la última vez (o con el objetivo de la rutina). */
export function newDraftExercise(
  seed: ExerciseSeed,
  workouts: Workout[],
  before?: Pick<Workout, "date" | "createdAt" | "id">,
): DraftExercise {
  const last = lastSets(workouts, seed.id, before);
  const count = Math.min(10, Math.max(1, seed.target?.sets ?? last?.length ?? 3));
  const unit = timeUnit(seed.muscle);
  const sets = Array.from({ length: count }, (_, i): DraftSet => {
    const prev = last?.[i] ?? last?.[last.length - 1];
    if (seed.mode === "tiempo") {
      const sec = prev?.sec || seed.target?.sec || 0;
      return { kg: "", reps: text(unit === "min" ? sec / 60 : sec), done: false };
    }
    return {
      kg: text(prev?.kg ?? 0),
      reps: text(last?.[i]?.reps || prev?.reps || seed.target?.reps || 0),
      done: false,
    };
  });
  return {
    key: uid(),
    exerciseId: seed.id,
    name: seed.name,
    muscle: seed.muscle,
    mode: seed.mode,
    note: "",
    sets,
  };
}

export function newDraft(date: string, name = "Entrenamiento"): Draft {
  return { date, name, routineId: null, startedAt: Date.now(), note: "", exercises: [] };
}

export function draftFromRoutine(routine: Routine, workouts: Workout[], date: string): Draft {
  return {
    date,
    name: routine.name,
    routineId: routine.id,
    startedAt: Date.now(),
    note: "",
    exercises: routine.exercises.map((ex) =>
      newDraftExercise(
        {
          id: ex.exerciseId,
          name: ex.name,
          muscle: ex.muscle,
          mode: ex.mode,
          target: { sets: ex.sets, reps: ex.reps, sec: ex.sec },
        },
        workouts,
      ),
    ),
  };
}

/** Un entrenamiento guardado, para revisarlo o corregirlo: todas sus series ya están hechas. */
export function draftFromWorkout(w: Workout): Draft {
  return {
    date: w.date,
    name: w.name,
    routineId: w.routineId,
    startedAt: w.createdAt,
    note: w.note,
    exercises: w.exercises.map((ex) => ({
      key: uid(),
      exerciseId: ex.exerciseId,
      name: ex.name,
      muscle: ex.muscle,
      mode: ex.mode,
      note: ex.note,
      sets: ex.sets.map((s) =>
        ex.mode === "tiempo"
          ? { kg: "", reps: text(timeUnit(ex.muscle) === "min" ? s.sec / 60 : s.sec), done: true }
          : { kg: text(s.kg), reps: text(s.reps), done: true },
      ),
    })),
  };
}

// ---------- Conversión ----------

function readSet(s: DraftSet, ex: Pick<DraftExercise, "mode" | "muscle">): GymSet | null {
  const kg = parseNum(s.kg);
  const value = parseNum(s.reps);
  const n = Number.isFinite(value) && value > 0 ? value : 0;
  if (ex.mode === "tiempo") {
    const sec = Math.round(n * (timeUnit(ex.muscle) === "min" ? 60 : 1));
    return sec > 0 ? { kg: 0, reps: 0, sec } : null;
  }
  // Una serie sin repeticiones no es una serie.
  return n >= 1 ? { kg: Number.isFinite(kg) && kg > 0 ? kg : 0, reps: Math.round(n), sec: 0 } : null;
}

/** Los ejercicios del borrador como se guardan; con `onlyDone`, solo las series marcadas. */
export function toWorkoutExercises(
  d: Pick<Draft, "exercises">,
  opts: { onlyDone?: boolean } = {},
): WorkoutExercise[] {
  return d.exercises
    .map((ex) => ({
      exerciseId: ex.exerciseId,
      name: ex.name,
      muscle: ex.muscle,
      mode: ex.mode,
      note: ex.note.trim(),
      sets: ex.sets
        .filter((s) => !opts.onlyDone || s.done)
        .map((s) => readSet(s, ex))
        .filter((s): s is GymSet => s !== null),
    }))
    .filter((ex) => ex.sets.length > 0);
}

/** La serie tiene repeticiones (o duración): se puede marcar como hecha. */
export function setHasData(s: DraftSet, ex: Pick<DraftExercise, "mode" | "muscle">): boolean {
  return readSet(s, ex) !== null;
}

/** Series con datos que todavía no se marcaron como hechas. */
export function unmarkedSets(d: Pick<Draft, "exercises">): number {
  return d.exercises.reduce((n, ex) => n + ex.sets.filter((s) => !s.done && readSet(s, ex) !== null).length, 0);
}

/** Series que se guardarían. */
export function doneSets(d: Pick<Draft, "exercises">): number {
  return d.exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.done && readSet(s, ex) !== null).length, 0);
}

/** Una rutina a partir de lo que se hizo: mismas series y las repeticiones de la primera. */
export function routineExercisesFrom(exercises: WorkoutExercise[]): RoutineExercise[] {
  return exercises.map((ex) => ({
    exerciseId: ex.exerciseId,
    name: ex.name,
    muscle: ex.muscle,
    mode: ex.mode,
    sets: Math.min(20, ex.sets.length),
    reps: ex.sets[0]?.reps ?? 0,
    sec: ex.sets[0]?.sec ?? 0,
  }));
}

// ---------- Persistencia en este dispositivo ----------

const KEY = "gym-draft";

const isMuscle = (v: unknown): v is MuscleGroup => (MUSCLE_IDS as readonly unknown[]).includes(v);
const isMode = (v: unknown): v is ExerciseMode => (MODE_IDS as readonly unknown[]).includes(v);

/** Reconstruye un borrador guardado; null si el dato no sirve. */
function sanitize(raw: unknown): Draft | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o.date) || !Array.isArray(o.exercises)) {
    return null;
  }
  const exercises: DraftExercise[] = [];
  for (const e of o.exercises) {
    const ex = (e ?? {}) as Record<string, unknown>;
    if (typeof ex.exerciseId !== "string" || typeof ex.name !== "string" || !isMuscle(ex.muscle) || !isMode(ex.mode)) {
      continue;
    }
    const sets = (Array.isArray(ex.sets) ? ex.sets : []).slice(0, 40).map((s): DraftSet => {
      const x = (s ?? {}) as Record<string, unknown>;
      return {
        kg: typeof x.kg === "string" ? x.kg.slice(0, 10) : "",
        reps: typeof x.reps === "string" ? x.reps.slice(0, 10) : "",
        done: x.done === true,
      };
    });
    exercises.push({
      key: typeof ex.key === "string" && ex.key ? ex.key : uid(),
      exerciseId: ex.exerciseId.slice(0, 64),
      name: ex.name.slice(0, 80),
      muscle: ex.muscle,
      mode: ex.mode,
      note: typeof ex.note === "string" ? ex.note.slice(0, 300) : "",
      sets,
    });
  }
  return {
    date: o.date,
    name: typeof o.name === "string" ? o.name.slice(0, 80) : "Entrenamiento",
    routineId: typeof o.routineId === "string" ? o.routineId : null,
    startedAt: typeof o.startedAt === "number" && Number.isFinite(o.startedAt) ? o.startedAt : Date.now(),
    note: typeof o.note === "string" ? o.note.slice(0, 500) : "",
    exercises: exercises.slice(0, 40),
  };
}

function load(key: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? sanitize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

let cache: { key: string; draft: Draft | null } | null = null;
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

function read(): Draft | null {
  const key = userScopedKey(KEY);
  if (!cache || cache.key !== key) cache = { key, draft: load(key) };
  return cache.draft;
}

/** Guarda el borrador (o lo borra con null). */
export function setDraft(draft: Draft | null) {
  const key = userScopedKey(KEY);
  cache = { key, draft };
  try {
    if (draft) window.localStorage.setItem(key, JSON.stringify(draft));
    else window.localStorage.removeItem(key);
  } catch {
    // sin espacio: el entrenamiento sigue en pantalla
  }
  emit();
}

/** El entrenamiento en curso de esta persona en este dispositivo, si hay uno. */
export function useDraft(): Draft | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key?.includes(`:${KEY}:`)) {
      cache = null;
      emit();
    }
  });
}

// ---------- Descanso entre series (preferencia del dispositivo) ----------

const REST_KEY = "mis-calorias:gym-descanso";
export const REST_OPTIONS = [0, 60, 90, 120, 180] as const;

export function readRestSeconds(): number {
  try {
    const raw = window.localStorage.getItem(REST_KEY);
    // Sin preferencia guardada: 90 s (Number(null) sería 0, que significa «sin descanso»).
    if (raw === null) return 90;
    const n = Number(raw);
    return (REST_OPTIONS as readonly number[]).includes(n) ? n : 90;
  } catch {
    return 90;
  }
}

export function saveRestSeconds(sec: number) {
  try {
    window.localStorage.setItem(REST_KEY, String(sec));
  } catch {
    // sin almacenamiento
  }
}
