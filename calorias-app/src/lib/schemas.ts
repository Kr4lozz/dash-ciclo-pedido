import { z } from "zod";

// Validación de los datos que el cliente guarda en su cuenta.

const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const amount = (max: number) => z.number().finite().min(0).max(max);

export const FoodEntrySchema = z.object({
  id: z.string().min(1).max(64),
  date: DateStr,
  meal: z.enum(["desayuno", "almuerzo", "cena", "snack"]),
  name: z.string().min(1).max(120),
  portion: z.string().max(80),
  calories: amount(20000),
  protein: amount(2000),
  carbs: amount(2000),
  fat: amount(2000),
  source: z.enum(["foto", "texto", "manual", "reciente"]),
  createdAt: z.number().finite(),
});

export const ExerciseEntrySchema = z.object({
  id: z.string().min(1).max(64),
  date: DateStr,
  name: z.string().min(1).max(120),
  minutes: amount(1440).nullable(),
  calories: amount(20000),
  createdAt: z.number().finite(),
});

/** Todo lo registrado en un día: la unidad que se sincroniza. */
export const DayDocSchema = z.object({
  foods: z.array(FoodEntrySchema).max(300),
  exercises: z.array(ExerciseEntrySchema).max(100),
  water: amount(20000),
});

export const ProfileSchema = z.object({
  name: z.string().max(60),
  sex: z.enum(["hombre", "mujer"]),
  age: amount(120),
  heightCm: amount(260),
  weightKg: amount(400),
  activity: z.enum(["sedentario", "ligero", "moderado", "activo", "muy_activo"]),
  goal: z.enum(["perder", "mantener", "ganar"]),
  rateKgWeek: amount(2),
  calorieOverride: amount(10000).nullable(),
  macroPct: z.object({ protein: amount(100), carbs: amount(100), fat: amount(100) }),
  waterGoalMl: amount(20000),
});

export const WeightsSchema = z
  .array(z.object({ date: DateStr, kg: z.number().finite().min(10).max(500) }))
  .max(5000);

export const DataPutSchema = z.object({
  /** true = reemplazar todos los datos de la cuenta (importar respaldo) */
  replace: z.boolean().optional(),
  profile: ProfileSchema.nullable().optional(),
  weights: WeightsSchema.optional(),
  /** null borra el día */
  days: z.record(DateStr, DayDocSchema.nullable()).optional(),
});

export type DayDoc = z.infer<typeof DayDocSchema>;
export type DataPut = z.infer<typeof DataPutSchema>;

export interface ServerData {
  profile: z.infer<typeof ProfileSchema> | null;
  weights: z.infer<typeof WeightsSchema>;
  days: Record<string, DayDoc>;
}
