import type { ExerciseMode, GymExercise, MuscleGroup } from "./types";

// Catálogo de ejercicios de gimnasio y rutinas sugeridas. Los ids no cambian nunca: los
// entrenamientos guardados los usan para seguir la evolución de cada ejercicio.

const e = (id: string, name: string, muscle: MuscleGroup, mode: ExerciseMode = "peso"): GymExercise => ({
  id,
  name,
  muscle,
  mode,
});

export const EXERCISE_CATALOG: GymExercise[] = [
  // Pecho
  e("press-banca", "Press de banca", "pecho"),
  e("press-banca-inclinado", "Press de banca inclinado", "pecho"),
  e("press-mancuernas", "Press con mancuernas", "pecho"),
  e("press-inclinado-mancuernas", "Press inclinado con mancuernas", "pecho"),
  e("press-pecho-maquina", "Press de pecho en máquina", "pecho"),
  e("aperturas-mancuernas", "Aperturas con mancuernas", "pecho"),
  e("cruces-polea", "Cruces en polea", "pecho"),
  e("pec-deck", "Pec deck (aperturas en máquina)", "pecho"),
  e("fondos-paralelas", "Fondos en paralelas", "pecho", "corporal"),
  e("flexiones", "Flexiones", "pecho", "corporal"),

  // Espalda
  e("dominadas", "Dominadas", "espalda", "corporal"),
  e("jalon-pecho", "Jalón al pecho", "espalda"),
  e("jalon-agarre-cerrado", "Jalón con agarre cerrado", "espalda"),
  e("remo-barra", "Remo con barra", "espalda"),
  e("remo-mancuerna", "Remo con mancuerna", "espalda"),
  e("remo-polea", "Remo en polea baja", "espalda"),
  e("remo-maquina", "Remo en máquina", "espalda"),
  e("remo-t", "Remo en T", "espalda"),
  e("peso-muerto", "Peso muerto", "espalda"),
  e("pullover-polea", "Pullover en polea", "espalda"),
  e("hiperextensiones", "Hiperextensiones", "espalda", "corporal"),

  // Hombros
  e("press-militar", "Press militar con barra", "hombros"),
  e("press-hombros-mancuernas", "Press de hombros con mancuernas", "hombros"),
  e("press-hombros-maquina", "Press de hombros en máquina", "hombros"),
  e("press-arnold", "Press Arnold", "hombros"),
  e("elevaciones-laterales", "Elevaciones laterales", "hombros"),
  e("elevaciones-frontales", "Elevaciones frontales", "hombros"),
  e("pajaros", "Pájaros (deltoide posterior)", "hombros"),
  e("face-pull", "Face pull", "hombros"),
  e("remo-menton", "Remo al mentón", "hombros"),
  e("encogimientos", "Encogimientos (trapecio)", "hombros"),

  // Bíceps
  e("curl-barra", "Curl con barra", "biceps"),
  e("curl-mancuernas", "Curl con mancuernas", "biceps"),
  e("curl-martillo", "Curl martillo", "biceps"),
  e("curl-scott", "Curl en banco Scott", "biceps"),
  e("curl-polea", "Curl en polea", "biceps"),
  e("curl-inclinado", "Curl inclinado con mancuernas", "biceps"),
  e("curl-concentrado", "Curl concentrado", "biceps"),

  // Tríceps
  e("triceps-polea", "Extensión de tríceps en polea", "triceps"),
  e("press-frances", "Press francés", "triceps"),
  e("triceps-sobre-cabeza", "Extensión de tríceps sobre la cabeza", "triceps"),
  e("press-cerrado", "Press de banca agarre cerrado", "triceps"),
  e("fondos-triceps", "Fondos para tríceps (banco)", "triceps", "corporal"),
  e("patada-triceps", "Patada de tríceps", "triceps"),

  // Piernas
  e("sentadilla", "Sentadilla con barra", "piernas"),
  e("sentadilla-frontal", "Sentadilla frontal", "piernas"),
  e("sentadilla-goblet", "Sentadilla goblet", "piernas"),
  e("sentadilla-bulgara", "Sentadilla búlgara", "piernas"),
  e("sentadilla-hack", "Sentadilla hack", "piernas"),
  e("prensa", "Prensa de piernas", "piernas"),
  e("extension-cuadriceps", "Extensión de cuádriceps", "piernas"),
  e("zancadas", "Zancadas con mancuernas", "piernas"),
  e("peso-muerto-rumano", "Peso muerto rumano", "piernas"),
  e("curl-femoral-tumbado", "Curl femoral tumbado", "piernas"),
  e("curl-femoral-sentado", "Curl femoral sentado", "piernas"),
  e("elevacion-talones", "Elevación de talones de pie", "piernas"),
  e("elevacion-talones-sentado", "Elevación de talones sentado", "piernas"),
  e("aduccion-maquina", "Aducción de cadera en máquina", "piernas"),

  // Glúteos
  e("hip-thrust", "Hip thrust", "gluteos"),
  e("puente-gluteos", "Puente de glúteos", "gluteos", "corporal"),
  e("patada-gluteo-polea", "Patada de glúteo en polea", "gluteos"),
  e("abduccion-maquina", "Abducción de cadera en máquina", "gluteos"),
  e("step-up", "Step up con mancuernas", "gluteos"),
  e("buenos-dias", "Buenos días", "gluteos"),

  // Abdomen
  e("plancha", "Plancha", "core", "tiempo"),
  e("plancha-lateral", "Plancha lateral", "core", "tiempo"),
  e("crunch", "Crunch abdominal", "core", "corporal"),
  e("elevacion-piernas", "Elevación de piernas", "core", "corporal"),
  e("bicicleta-abdominal", "Bicicleta abdominal", "core", "corporal"),
  e("rueda-abdominal", "Rueda abdominal", "core", "corporal"),
  e("crunch-polea", "Crunch en polea", "core"),
  e("giros-rusos", "Giros rusos", "core"),

  // Cardio
  e("caminadora", "Caminadora (cinta)", "cardio", "tiempo"),
  e("bicicleta-estatica", "Bicicleta estática", "cardio", "tiempo"),
  e("eliptica", "Elíptica", "cardio", "tiempo"),
  e("remo-ergometro", "Remo (ergómetro)", "cardio", "tiempo"),
  e("escaladora", "Escaladora", "cardio", "tiempo"),
  e("cuerda", "Saltar la cuerda", "cardio", "tiempo"),
  e("spinning", "Spinning", "cardio", "tiempo"),
  e("hiit", "HIIT / circuito", "cardio", "tiempo"),
];

export interface RoutineTemplate {
  id: string;
  name: string;
  description: string;
  /** id del ejercicio, series y repeticiones (o segundos en los de tiempo) */
  items: { id: string; sets: number; reps: number; sec?: number }[];
}

const t = (id: string, sets: number, reps: number, sec?: number) => ({ id, sets, reps, sec });

export const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  {
    id: "full-body",
    name: "Cuerpo completo",
    description: "Todo el cuerpo en una sesión. Ideal para 3 días por semana.",
    items: [
      t("sentadilla", 3, 8),
      t("press-banca", 3, 8),
      t("remo-barra", 3, 10),
      t("press-militar", 3, 10),
      t("peso-muerto-rumano", 3, 10),
      t("plancha", 3, 0, 45),
    ],
  },
  {
    id: "empuje",
    name: "Empuje (pecho, hombros y tríceps)",
    description: "Los músculos que empujan, para dividir en empuje, tirón y pierna.",
    items: [
      t("press-banca", 4, 8),
      t("press-inclinado-mancuernas", 3, 10),
      t("press-hombros-mancuernas", 3, 10),
      t("elevaciones-laterales", 3, 15),
      t("triceps-polea", 3, 12),
      t("press-frances", 3, 10),
    ],
  },
  {
    id: "tiron",
    name: "Tirón (espalda y bíceps)",
    description: "Los músculos que jalan, para dividir en empuje, tirón y pierna.",
    items: [
      t("jalon-pecho", 4, 10),
      t("remo-barra", 4, 8),
      t("remo-polea", 3, 12),
      t("face-pull", 3, 15),
      t("curl-barra", 3, 10),
      t("curl-martillo", 3, 12),
    ],
  },
  {
    id: "pierna",
    name: "Pierna",
    description: "Cuádriceps, isquios, glúteos y pantorrillas.",
    items: [
      t("sentadilla", 4, 8),
      t("prensa", 3, 12),
      t("peso-muerto-rumano", 3, 10),
      t("curl-femoral-tumbado", 3, 12),
      t("hip-thrust", 3, 10),
      t("elevacion-talones", 4, 15),
    ],
  },
  {
    id: "torso",
    name: "Torso",
    description: "Parte superior completa, para alternar con pierna en 4 días por semana.",
    items: [
      t("press-banca", 4, 8),
      t("remo-barra", 4, 8),
      t("press-militar", 3, 10),
      t("jalon-pecho", 3, 10),
      t("curl-mancuernas", 2, 12),
      t("triceps-polea", 2, 12),
    ],
  },
  {
    id: "brazos-hombros",
    name: "Brazos y hombros",
    description: "Bíceps, tríceps y deltoides.",
    items: [
      t("curl-barra", 3, 10),
      t("press-frances", 3, 10),
      t("curl-martillo", 3, 12),
      t("triceps-polea", 3, 12),
      t("elevaciones-laterales", 4, 15),
      t("pajaros", 3, 15),
    ],
  },
  {
    id: "gluteos-pierna",
    name: "Glúteos y pierna",
    description: "Énfasis en glúteos con trabajo de pierna.",
    items: [
      t("hip-thrust", 4, 10),
      t("sentadilla-bulgara", 3, 10),
      t("peso-muerto-rumano", 3, 10),
      t("prensa", 3, 12),
      t("abduccion-maquina", 3, 15),
      t("patada-gluteo-polea", 3, 12),
    ],
  },
  {
    id: "cardio-core",
    name: "Cardio y abdomen",
    description: "Cardio suave y abdomen para un día de descarga.",
    items: [
      t("caminadora", 1, 0, 20 * 60),
      t("crunch", 3, 15),
      t("elevacion-piernas", 3, 12),
      t("plancha", 3, 0, 45),
    ],
  },
];
