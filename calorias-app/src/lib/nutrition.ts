import type {
  ActivityLevel,
  ExerciseEntry,
  FoodEntry,
  Goal,
  Macros,
  Profile,
} from "./types";

export const ACTIVITY_LEVELS: {
  id: ActivityLevel;
  label: string;
  hint: string;
  factor: number;
}[] = [
  { id: "sedentario", label: "Sedentario", hint: "Trabajo de escritorio, casi sin ejercicio", factor: 1.2 },
  { id: "ligero", label: "Ligero", hint: "Ejercicio 1–3 días por semana", factor: 1.375 },
  { id: "moderado", label: "Moderado", hint: "Ejercicio 3–5 días por semana", factor: 1.55 },
  { id: "activo", label: "Activo", hint: "Ejercicio intenso 6–7 días por semana", factor: 1.725 },
  { id: "muy_activo", label: "Muy activo", hint: "Trabajo físico o doble sesión diaria", factor: 1.9 },
];

export const GOALS: { id: Goal; label: string }[] = [
  { id: "perder", label: "Perder peso" },
  { id: "mantener", label: "Mantener" },
  { id: "ganar", label: "Ganar peso" },
];

export const RATES = [0.25, 0.5, 0.75, 1];

export function defaultMacroPct(goal: Goal): Macros {
  return goal === "perder"
    ? { protein: 30, carbs: 40, fat: 30 }
    : { protein: 25, carbs: 50, fat: 25 };
}

export function defaultWaterMl(weightKg: number): number {
  return Math.round((weightKg * 35) / 250) * 250;
}

export function defaultProfile(): Profile {
  return {
    name: "",
    sex: "mujer",
    age: 30,
    heightCm: 165,
    weightKg: 65,
    activity: "ligero",
    goal: "perder",
    rateKgWeek: 0.5,
    calorieOverride: null,
    macroPct: defaultMacroPct("perder"),
    waterGoalMl: defaultWaterMl(65),
  };
}

export interface Targets {
  /** Tasa metabólica basal (Mifflin-St Jeor) */
  bmr: number;
  /** Gasto energético diario total */
  tdee: number;
  /** Meta sugerida según objetivo */
  suggested: number;
  /** Meta en uso (sugerida o fijada por el usuario) */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  waterMl: number;
  /** La meta sugerida se subió al mínimo seguro */
  clamped: boolean;
  hasProfile: boolean;
}

const KCAL_PER_KG = 7700;

export function computeTargets(p: Profile | null): Targets {
  if (!p) {
    return {
      bmr: 0,
      tdee: 0,
      suggested: 2000,
      calories: 2000,
      ...macroGrams(2000, { protein: 25, carbs: 50, fat: 25 }),
      waterMl: 2000,
      clamped: false,
      hasProfile: false,
    };
  }
  const bmr =
    10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === "hombre" ? 5 : -161);
  const factor = ACTIVITY_LEVELS.find((a) => a.id === p.activity)?.factor ?? 1.2;
  const tdee = bmr * factor;
  const delta = p.goal === "mantener" ? 0 : (p.rateKgWeek * KCAL_PER_KG) / 7;
  let suggested = p.goal === "perder" ? tdee - delta : p.goal === "ganar" ? tdee + delta : tdee;
  // Mínimos habituales para no bajar de una ingesta segura sin supervisión.
  const floor = p.sex === "hombre" ? 1500 : 1200;
  const clamped = suggested < floor;
  if (clamped) suggested = floor;
  suggested = Math.round(suggested / 10) * 10;
  const calories = p.calorieOverride && p.calorieOverride > 0 ? p.calorieOverride : suggested;
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    suggested,
    calories,
    ...macroGrams(calories, p.macroPct),
    waterMl: p.waterGoalMl,
    clamped,
    hasProfile: true,
  };
}

export function macroGrams(kcal: number, pct: Macros): Macros {
  return {
    protein: Math.round((kcal * pct.protein) / 100 / 4),
    carbs: Math.round((kcal * pct.carbs) / 100 / 4),
    fat: Math.round((kcal * pct.fat) / 100 / 9),
  };
}

export interface DayTotals extends Macros {
  calories: number;
  burned: number;
}

export function sumFoods(foods: FoodEntry[]): Macros & { calories: number } {
  return foods.reduce(
    (acc, f) => ({
      calories: acc.calories + f.calories,
      protein: acc.protein + f.protein,
      carbs: acc.carbs + f.carbs,
      fat: acc.fat + f.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function sumExercises(exercises: ExerciseEntry[]): number {
  return exercises.reduce((acc, e) => acc + e.calories, 0);
}

/** Alimentos registrados antes, sin repetidos, del más reciente al más antiguo. */
export function recentFoods(foods: FoodEntry[], limit = 80): FoodEntry[] {
  const seen = new Set<string>();
  const out: FoodEntry[] = [];
  for (const f of [...foods].sort((a, b) => b.createdAt - a.createdAt)) {
    const key = `${f.name.trim().toLowerCase()}|${f.portion.trim().toLowerCase()}|${f.calories}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
    if (out.length >= limit) break;
  }
  return out;
}

export function dayTotals(
  date: string,
  foods: FoodEntry[],
  exercises: ExerciseEntry[],
): DayTotals {
  return {
    ...sumFoods(foods.filter((f) => f.date === date)),
    burned: sumExercises(exercises.filter((e) => e.date === date)),
  };
}
