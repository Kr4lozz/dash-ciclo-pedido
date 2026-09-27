import { z } from "zod";

// Esquema de la respuesta de la IA (salida estructurada). Lo usa la ruta /api/analyze;
// el cliente solo importa los tipos.

export const FoodItemSchema = z.object({
  name: z.string().describe("Nombre corto del alimento, p. ej. 'Arroz blanco'"),
  portion: z
    .string()
    .describe("Medida casera seguida del peso estimado, p. ej. '1 taza (160 g)'"),
  grams: z.number().describe("Peso estimado de la porción en gramos (o ml si es bebida)"),
  calories: z.number().describe("Kilocalorías de la porción"),
  protein: z.number().describe("Proteína en gramos"),
  carbs: z.number().describe("Carbohidratos en gramos"),
  fat: z.number().describe("Grasa en gramos"),
});

export const AnalysisSchema = z.object({
  isFood: z.boolean().describe("false si la imagen o el texto no contienen comida ni bebida"),
  dishName: z.string().describe("Nombre corto del plato completo, p. ej. 'Lomo saltado con arroz'"),
  items: z.array(FoodItemSchema),
  confidence: z
    .enum(["alta", "media", "baja"])
    .describe("Qué tan segura es la estimación de porciones y calorías"),
  notes: z
    .string()
    .describe("Máximo dos frases con los supuestos principales que el usuario podría corregir"),
});

export type FoodItem = z.infer<typeof FoodItemSchema>;
export type Analysis = z.infer<typeof AnalysisSchema>;

/** Lectura de una captura de los anillos de Actividad (iPhone / Apple Watch) u otra app de fitness. */
export const ActivityReadingSchema = z.object({
  isActivityScreenshot: z
    .boolean()
    .describe("true si la imagen es una captura de una app de actividad física con datos legibles"),
  source: z.string().describe("App de origen, p. ej. 'Actividad de Apple', 'Fitness', 'Garmin Connect'"),
  activeCalories: z
    .number()
    .nullable()
    .describe("Calorías activas del día (anillo Moverse / 'Move'), en kcal; null si no se ven"),
  exerciseMinutes: z
    .number()
    .nullable()
    .describe("Minutos del anillo Ejercicio; null si no se ven"),
  steps: z.number().nullable().describe("Pasos del día; null si no se ven"),
  notes: z.string().describe("Una frase: qué se leyó o por qué no se pudo leer"),
});

export type ActivityReading = z.infer<typeof ActivityReadingSchema>;

export const ANALYZE_LIMITS = {
  /** Base64 de la imagen; el límite de cuerpo de Vercel Functions es 4,5 MB. */
  maxImageBase64: 4_000_000,
  maxText: 1500,
  imageTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] as const,
};

export const AnalyzeRequestSchema = z
  .object({
    kind: z.enum(["comida", "actividad"]).default("comida"),
    image: z
      .object({
        data: z.string().min(1).max(ANALYZE_LIMITS.maxImageBase64),
        mediaType: z.enum(ANALYZE_LIMITS.imageTypes),
      })
      .optional(),
    text: z.string().max(ANALYZE_LIMITS.maxText).optional(),
  })
  .refine((v) => Boolean(v.image) || Boolean(v.text?.trim()), {
    message: "Envía una foto o una descripción de la comida.",
  })
  .refine((v) => v.kind === "comida" || Boolean(v.image), {
    message: "Envía la captura de tu actividad.",
  });

export type AnalyzeRequest = z.input<typeof AnalyzeRequestSchema>;
