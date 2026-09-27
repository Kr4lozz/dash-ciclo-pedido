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

export interface AppData {
  version: 1;
  profile: Profile | null;
  foods: FoodEntry[];
  exercises: ExerciseEntry[];
  /** ml de agua por fecha */
  water: Record<string, number>;
  weights: WeightEntry[];
}
