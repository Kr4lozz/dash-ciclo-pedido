export type MealType = "desayuno" | "almuerzo" | "cena" | "snack";

export const MEALS: { id: MealType; label: string; emoji: string }[] = [
  { id: "desayuno", label: "Desayuno", emoji: "🍳" },
  { id: "almuerzo", label: "Almuerzo", emoji: "🍲" },
  { id: "cena", label: "Cena", emoji: "🍽️" },
  { id: "snack", label: "Snacks", emoji: "🍎" },
];

export function mealLabel(meal: MealType): string {
  return MEALS.find((m) => m.id === meal)?.label ?? meal;
}

/** Comida sugerida según la hora del día. */
export function mealForHour(hour: number): MealType {
  if (hour < 11) return "desayuno";
  if (hour < 16) return "almuerzo";
  if (hour < 19) return "snack";
  return "cena";
}

export interface Macros {
  protein: number;
  carbs: number;
  fat: number;
}

export type FoodSource = "foto" | "texto" | "manual" | "reciente";

export interface FoodEntry extends Macros {
  id: string;
  /** Fecha local YYYY-MM-DD */
  date: string;
  meal: MealType;
  name: string;
  portion: string;
  calories: number;
  source: FoodSource;
  createdAt: number;
}

export interface ExerciseEntry {
  id: string;
  date: string;
  name: string;
  minutes: number | null;
  calories: number;
  createdAt: number;
}

export interface WeightEntry {
  date: string;
  kg: number;
}

export type Sex = "hombre" | "mujer";
export type ActivityLevel =
  | "sedentario"
  | "ligero"
  | "moderado"
  | "activo"
  | "muy_activo";
export type Goal = "perder" | "mantener" | "ganar";

export interface Profile {
  name: string;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
  /** kg por semana a perder o ganar */
  rateKgWeek: number;
  /** Meta calórica fija; null = calculada automáticamente */
  calorieOverride: number | null;
  /** Reparto de calorías en porcentaje (suma 100) */
  macroPct: Macros;
  waterGoalMl: number;
}

/** Calorías quemadas del día según Apple Fitness (u otro reloj), anotadas a mano o por captura. */
export interface DayBurn {
  /** Calorías totales del día (activas + en reposo) */
  total: number | null;
  /** Calorías activas (anillo Moverse) */
  active: number | null;
}

// ---------- Gym ----------

export const MUSCLE_IDS = [
  "pecho",
  "espalda",
  "hombros",
  "biceps",
  "triceps",
  "piernas",
  "gluteos",
  "core",
  "cardio",
] as const;
export type MuscleGroup = (typeof MUSCLE_IDS)[number];

export const MUSCLES: { id: MuscleGroup; label: string }[] = [
  { id: "pecho", label: "Pecho" },
  { id: "espalda", label: "Espalda" },
  { id: "hombros", label: "Hombros" },
  { id: "biceps", label: "Bíceps" },
  { id: "triceps", label: "Tríceps" },
  { id: "piernas", label: "Piernas" },
  { id: "gluteos", label: "Glúteos" },
  { id: "core", label: "Abdomen" },
  { id: "cardio", label: "Cardio" },
];

export function muscleLabel(m: MuscleGroup): string {
  return MUSCLES.find((x) => x.id === m)?.label ?? m;
}

/** peso: kg × repeticiones · corporal: repeticiones (con kg extra opcional) · tiempo: duración */
export const MODE_IDS = ["peso", "corporal", "tiempo"] as const;
export type ExerciseMode = (typeof MODE_IDS)[number];

export const EXERCISE_MODES: { id: ExerciseMode; label: string }[] = [
  { id: "peso", label: "Con peso" },
  { id: "corporal", label: "Peso corporal" },
  { id: "tiempo", label: "Tiempo" },
];

/** Un ejercicio del catálogo o creado por la persona. */
export interface GymExercise {
  id: string;
  name: string;
  muscle: MuscleGroup;
  mode: ExerciseMode;
}

/** Una serie: kg y repeticiones, o segundos en los ejercicios de tiempo. */
export interface GymSet {
  kg: number;
  reps: number;
  sec: number;
}

/** Un ejercicio dentro de un entrenamiento; guarda el nombre por si el ejercicio propio se borra. */
export interface WorkoutExercise {
  exerciseId: string;
  name: string;
  muscle: MuscleGroup;
  mode: ExerciseMode;
  note: string;
  sets: GymSet[];
}

export interface Workout {
  id: string;
  /** Fecha local YYYY-MM-DD */
  date: string;
  name: string;
  routineId: string | null;
  minutes: number | null;
  note: string;
  exercises: WorkoutExercise[];
  createdAt: number;
}

export interface RoutineExercise {
  exerciseId: string;
  name: string;
  muscle: MuscleGroup;
  mode: ExerciseMode;
  sets: number;
  reps: number;
  /** objetivo en segundos (ejercicios de tiempo) */
  sec: number;
}

export interface Routine {
  id: string;
  name: string;
  note: string;
  exercises: RoutineExercise[];
  createdAt: number;
}

export interface AppData {
  version: 1;
  profile: Profile | null;
  foods: FoodEntry[];
  exercises: ExerciseEntry[];
  /** ml de agua por fecha */
  water: Record<string, number>;
  /** calorías quemadas según el reloj, por fecha */
  burned: Record<string, DayBurn>;
  weights: WeightEntry[];
  /** entrenamientos de gym, cada uno con su fecha */
  workouts: Workout[];
  /** rutinas guardadas */
  routines: Routine[];
  /** ejercicios creados por la persona (los del catálogo vienen en la app) */
  customExercises: GymExercise[];
}
