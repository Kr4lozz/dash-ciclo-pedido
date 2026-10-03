import { ACTIVITIES, activityCalories } from "./activities";
import { EXERCISE_CATALOG } from "./gym-data";
import type {
  ExerciseMode,
  GymExercise,
  GymSet,
  MuscleGroup,
  Workout,
  WorkoutExercise,
} from "./types";

// Cálculos de gym: volumen, 1RM estimado, récords, última vez y resúmenes por periodo.

const CATALOG_BY_ID = new Map(EXERCISE_CATALOG.map((x) => [x.id, x]));

/** Catálogo de la app más los ejercicios propios. */
export function allExercises(custom: GymExercise[]): GymExercise[] {
  return [...EXERCISE_CATALOG, ...custom];
}

export function findExercise(id: string, custom: GymExercise[]): GymExercise | undefined {
  return CATALOG_BY_ID.get(id) ?? custom.find((x) => x.id === id);
}

/** Los ejercicios de tiempo se anotan en minutos (cardio) o en segundos (abdomen). */
export function timeUnit(muscle: MuscleGroup): "min" | "s" {
  return muscle === "cardio" ? "min" : "s";
}

const kgFmt = new Intl.NumberFormat("es", { maximumFractionDigits: 2 });

/** 62.5 → "62,5" · 60 → "60" */
export function fmtKg(n: number): string {
  return kgFmt.format(Math.round(n * 100) / 100);
}

/** 45 → "45 s" · 90 → "1 min 30 s" · 1200 → "20 min" */
export function fmtSeconds(sec: number): string {
  const s = Math.round(sec);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m} min ${rest} s` : `${m} min`;
}

/** 45 → "45 min" · 125 → "2 h 05 min" */
export function fmtMinutes(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${String(rest).padStart(2, "0")} min` : `${h} h`;
}

// ---------- Series, volumen y 1RM ----------

/** 1RM estimado (Epley). Solo es fiable hasta unas 12 repeticiones. */
export function e1rm(kg: number, reps: number): number {
  if (!(kg > 0) || !(reps >= 1) || reps > 12) return 0;
  return reps === 1 ? kg : kg * (1 + reps / 30);
}

export interface Totals {
  exercises: number;
  /** series de fuerza y peso corporal (sin las de tiempo) */
  sets: number;
  reps: number;
  /** kg × repeticiones */
  volume: number;
  /** segundos de cardio */
  cardioSeconds: number;
}

export function workoutTotals(w: Pick<Workout, "exercises">): Totals {
  const t: Totals = { exercises: w.exercises.length, sets: 0, reps: 0, volume: 0, cardioSeconds: 0 };
  for (const ex of w.exercises) {
    for (const s of ex.sets) {
      if (ex.mode === "tiempo") {
        if (ex.muscle === "cardio") t.cardioSeconds += s.sec;
        continue;
      }
      t.sets += 1;
      t.reps += s.reps;
      t.volume += s.kg * s.reps;
    }
  }
  return t;
}

/** Puntaje para comparar series de un mismo ejercicio: más peso, o más repeticiones en peso corporal. */
function score(s: GymSet, mode: ExerciseMode): number {
  if (mode === "tiempo") return 0;
  if (s.reps < 1) return 0;
  return mode === "corporal" ? s.reps * 1000 + s.kg : s.kg * 1000 + s.reps;
}

/** La mejor serie de una lista (la más pesada, o la de más repeticiones en peso corporal). */
export function topSet(sets: GymSet[], mode: ExerciseMode): GymSet | null {
  if (mode === "tiempo") {
    return sets.reduce<GymSet | null>((b, s) => (s.sec > (b?.sec ?? 0) ? s : b), null);
  }
  return sets.reduce<GymSet | null>((b, s) => (score(s, mode) > (b ? score(b, mode) : 0) ? s : b), null);
}

const sameDay = (a: Pick<Workout, "date" | "createdAt">, b: Pick<Workout, "date" | "createdAt">) =>
  a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1;

/** Entrenamientos del más antiguo al más reciente. */
export function chronological(workouts: Workout[]): Workout[] {
  return [...workouts].sort(sameDay);
}

/**
 * Las series de la última vez que se hizo un ejercicio. Con `before` solo cuenta lo anterior
 * a ese entrenamiento (para mostrar «última vez» al revisar uno antiguo).
 */
export function lastSets(
  workouts: Workout[],
  exerciseId: string,
  before?: Pick<Workout, "date" | "createdAt" | "id">,
): GymSet[] | null {
  let best: Workout | null = null;
  for (const w of workouts) {
    if (before && (w.id === before.id || sameDay(w, before) >= 0)) continue;
    if (!w.exercises.some((e) => e.exerciseId === exerciseId)) continue;
    if (!best || sameDay(w, best) > 0) best = w;
  }
  return best?.exercises.find((e) => e.exerciseId === exerciseId)?.sets ?? null;
}

/** "60 kg × 8" · "+10 kg × 6" · "12 reps" · "45 s" */
export function formatSet(s: GymSet, ex: Pick<WorkoutExercise, "mode" | "muscle">): string {
  if (ex.mode === "tiempo") return fmtSeconds(s.sec);
  if (ex.mode === "corporal") return s.kg > 0 ? `+${fmtKg(s.kg)} kg × ${s.reps}` : `${s.reps} reps`;
  return `${fmtKg(s.kg)} kg × ${s.reps}`;
}

/** "3 × 8 · 60 kg" si todas son iguales; si no, "60×8 · 60×6 · 55×8". */
export function summarizeSets(sets: GymSet[], ex: Pick<WorkoutExercise, "mode" | "muscle">): string {
  if (sets.length === 0) return "";
  if (ex.mode === "tiempo") return sets.map((s) => fmtSeconds(s.sec)).join(" · ");
  const same = sets.every((s) => s.kg === sets[0].kg && s.reps === sets[0].reps);
  const kg = (s: GymSet) => (s.kg > 0 ? (ex.mode === "corporal" ? `+${fmtKg(s.kg)} kg` : `${fmtKg(s.kg)} kg`) : "");
  if (same) {
    const weight = kg(sets[0]);
    return `${sets.length} × ${sets[0].reps}${weight ? ` · ${weight}` : ""}`;
  }
  const shown = sets
    .slice(0, 5)
    .map((s) => (s.kg > 0 ? `${fmtKg(s.kg)}×${s.reps}` : `${s.reps}`))
    .join(" · ");
  return sets.length > 5 ? `${shown} …` : shown;
}

/** "Press de banca · Remo con barra · Sentadilla +2" */
export function exerciseNames(w: Pick<Workout, "exercises">, max = 3): string {
  const names = w.exercises.map((e) => e.name);
  return names.length > max ? `${names.slice(0, max).join(" · ")} +${names.length - max}` : names.join(" · ");
}

// ---------- Evolución y récords ----------

export interface ExercisePoint {
  date: string;
  /** el mayor peso de ese día (en peso corporal, el de la serie con más repeticiones) */
  kg: number;
  reps: number;
  e1rm: number;
  volume: number;
  sets: number;
}

/** Un punto por día en que se hizo el ejercicio, del más antiguo al más reciente. */
export function exerciseHistory(workouts: Workout[], exerciseId: string): ExercisePoint[] {
  const byDate = new Map<string, ExercisePoint>();
  for (const w of chronological(workouts)) {
    for (const ex of w.exercises) {
      if (ex.exerciseId !== exerciseId || ex.mode === "tiempo") continue;
      const p = byDate.get(w.date) ?? { date: w.date, kg: 0, reps: 0, e1rm: 0, volume: 0, sets: 0 };
      for (const s of ex.sets) {
        if (s.reps < 1) continue;
        p.sets += 1;
        p.volume += s.kg * s.reps;
        p.e1rm = Math.max(p.e1rm, e1rm(s.kg, s.reps));
        // La serie del día: la más pesada (con peso) o la de más repeticiones (peso corporal).
        const better =
          ex.mode === "corporal"
            ? s.reps > p.reps || (s.reps === p.reps && s.kg > p.kg)
            : s.kg > p.kg || (s.kg === p.kg && s.reps > p.reps);
        if (better) {
          p.kg = s.kg;
          p.reps = s.reps;
        }
      }
      byDate.set(w.date, p);
    }
  }
  return [...byDate.values()].filter((p) => p.sets > 0).sort((a, b) => a.date.localeCompare(b.date));
}

export interface ExerciseSummary {
  exerciseId: string;
  name: string;
  muscle: MuscleGroup;
  mode: ExerciseMode;
  sessions: number;
  lastDate: string;
}

/** Los ejercicios que se han hecho, del más frecuente al menos (sin los de tiempo). */
export function exercisesDone(workouts: Workout[]): ExerciseSummary[] {
  const map = new Map<string, ExerciseSummary>();
  for (const w of chronological(workouts)) {
    for (const ex of w.exercises) {
      if (ex.mode === "tiempo") continue;
      const cur = map.get(ex.exerciseId);
      map.set(ex.exerciseId, {
        exerciseId: ex.exerciseId,
        name: ex.name,
        muscle: ex.muscle,
        mode: ex.mode,
        sessions: (cur?.sessions ?? 0) + 1,
        lastDate: w.date,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.sessions - a.sessions || b.lastDate.localeCompare(a.lastDate));
}

export interface PersonalRecord {
  exerciseId: string;
  name: string;
  muscle: MuscleGroup;
  mode: ExerciseMode;
  kg: number;
  reps: number;
  e1rm: number;
  date: string;
  /** se logró desde `sinceDate` y superó lo que se había hecho en un entrenamiento anterior */
  isNew: boolean;
}

/**
 * La mejor serie de cada ejercicio. `isNew` marca las que se lograron desde `sinceDate`
 * mejorando a un entrenamiento anterior (la primera vez que se hace un ejercicio no cuenta).
 */
export function personalRecords(workouts: Workout[], sinceDate: string): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>();
  const bestScore = new Map<string, number>();
  const improved = new Map<string, boolean>();
  const seen = new Set<string>(); // ejercicios que ya tenían un entrenamiento anterior
  for (const w of chronological(workouts)) {
    const doneHere = new Set<string>();
    for (const ex of w.exercises) {
      if (ex.mode === "tiempo") continue;
      for (const s of ex.sets) {
        const sc = score(s, ex.mode);
        if (sc === 0) continue;
        doneHere.add(ex.exerciseId);
        // Con el mismo puntaje se conserva la primera vez que se logró.
        if (sc > (bestScore.get(ex.exerciseId) ?? 0)) {
          bestScore.set(ex.exerciseId, sc);
          improved.set(ex.exerciseId, seen.has(ex.exerciseId));
          best.set(ex.exerciseId, {
            exerciseId: ex.exerciseId,
            name: ex.name,
            muscle: ex.muscle,
            mode: ex.mode,
            kg: s.kg,
            reps: s.reps,
            e1rm: e1rm(s.kg, s.reps),
            date: w.date,
            isNew: false,
          });
        }
      }
    }
    // Las series de este mismo entrenamiento no cuentan como «anteriores» entre sí.
    for (const id of doneHere) seen.add(id);
  }
  return [...best.values()].map((r) => ({ ...r, isNew: (improved.get(r.exerciseId) ?? false) && r.date >= sinceDate }));
}

/** Ejercicios en los que `w` supera lo que había en `previous` (para felicitar al terminar). */
export function newRecordsIn(previous: Workout[], w: Workout): { name: string; kg: number; reps: number; mode: ExerciseMode }[] {
  const out: { name: string; kg: number; reps: number; mode: ExerciseMode }[] = [];
  for (const ex of w.exercises) {
    if (ex.mode === "tiempo") continue;
    let prev = 0;
    for (const p of previous) {
      if (p.id === w.id) continue;
      for (const pe of p.exercises) {
        if (pe.exerciseId !== ex.exerciseId) continue;
        for (const s of pe.sets) prev = Math.max(prev, score(s, ex.mode));
      }
    }
    const top = topSet(ex.sets, ex.mode);
    if (top && prev > 0 && score(top, ex.mode) > prev) {
      out.push({ name: ex.name, kg: top.kg, reps: top.reps, mode: ex.mode });
    }
  }
  return out;
}

// ---------- Resumen por periodo ----------

export interface DayTraining {
  date: string;
  sessions: number;
  sets: number;
  volume: number;
  minutes: number;
  names: string[];
}

export interface PeriodTotals {
  sessions: number;
  daysTrained: number;
  sets: number;
  reps: number;
  volume: number;
  minutes: number;
  cardioSeconds: number;
  /** un registro por cada fecha pedida, en el mismo orden */
  perDay: DayTraining[];
}

export function periodTotals(workouts: Workout[], dates: string[]): PeriodTotals {
  const byDate = new Map<string, DayTraining>(
    dates.map((date) => [date, { date, sessions: 0, sets: 0, volume: 0, minutes: 0, names: [] }]),
  );
  const t: PeriodTotals = {
    sessions: 0,
    daysTrained: 0,
    sets: 0,
    reps: 0,
    volume: 0,
    minutes: 0,
    cardioSeconds: 0,
    perDay: [],
  };
  for (const w of chronological(workouts)) {
    const day = byDate.get(w.date);
    if (!day) continue;
    const totals = workoutTotals(w);
    day.sessions += 1;
    day.sets += totals.sets;
    day.volume += totals.volume;
    day.minutes += w.minutes ?? 0;
    day.names.push(w.name);
    t.sessions += 1;
    t.sets += totals.sets;
    t.reps += totals.reps;
    t.volume += totals.volume;
    t.minutes += w.minutes ?? 0;
    t.cardioSeconds += totals.cardioSeconds;
  }
  t.perDay = dates.map((d) => byDate.get(d) as DayTraining);
  t.daysTrained = t.perDay.filter((d) => d.sessions > 0).length;
  return t;
}

/** Series por grupo muscular (sin el cardio ni los ejercicios de tiempo), de más a menos. */
export function muscleSets(workouts: Workout[]): { muscle: MuscleGroup; sets: number }[] {
  const map = new Map<MuscleGroup, number>();
  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (ex.mode === "tiempo") continue;
      map.set(ex.muscle, (map.get(ex.muscle) ?? 0) + ex.sets.filter((s) => s.reps > 0).length);
    }
  }
  return [...map.entries()]
    .filter(([, sets]) => sets > 0)
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((a, b) => b.sets - a.sets);
}

// ---------- Calorías ----------

const WEIGHTS_MET = ACTIVITIES.find((a) => a.id === "pesas")?.met ?? 3.5;

/** Estimación con el MET de pesas moderadas (Compendio de Actividades Físicas). */
export function gymCalories(minutes: number, weightKg: number): number {
  return activityCalories(WEIGHTS_MET, weightKg, minutes);
}
