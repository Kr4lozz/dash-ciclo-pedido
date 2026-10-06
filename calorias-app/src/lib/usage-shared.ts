import type { Role } from "./account";

// Uso de la app. Lo comparten el cliente (que cuenta) y el servidor (que valida y suma).
// Solo se guardan contadores por día: nunca lo que la persona escribe o fotografía, ni a qué
// botón exacto toca. Quien administra la familia los ve en Perfil → Familia.

/** Aviso que ve toda la familia: qué se cuenta y qué no. */
export const USAGE_NOTICE =
  "Quien administra la familia ve cuánto usas la app (aperturas, toques, pantallas y registros hechos), nunca lo que anotas ni tus fotos.";

/** Pantallas que se cuentan. */
export const PAGES = {
  hoy: "Hoy",
  agregar: "Registrar comida",
  ejercicio: "Registrar ejercicio",
  menu: "Menú",
  gym: "Gym",
  "gym-entrenar": "Entrenar",
  "gym-rutina": "Rutinas",
  progreso: "Progreso",
  perfil: "Perfil",
  familia: "Familia",
} as const;
export type PageId = keyof typeof PAGES;
export const PAGE_IDS = Object.keys(PAGES) as [PageId, ...PageId[]];

/** Acciones clave que se cuentan (solo cuántas veces, sin su contenido). */
export const ACTIONS = {
  food: "Comidas",
  exercise: "Ejercicios",
  water: "Agua",
  burned: "Calorías quemadas",
  weight: "Peso",
  workout: "Entrenamientos",
  routine: "Rutinas nuevas",
  menu: "Menús generados",
  ai: "Análisis con IA",
} as const;
export type ActionId = keyof typeof ACTIONS;
export const ACTION_IDS = Object.keys(ACTIONS) as [ActionId, ...ActionId[]];

/** Lo que cuenta como «registro»: algo que la persona anota para llevar su control. */
export const RECORD_ACTIONS: readonly ActionId[] = [
  "food",
  "exercise",
  "water",
  "burned",
  "weight",
  "workout",
];

const TOP_LEVEL: Record<string, PageId> = {
  agregar: "agregar",
  ejercicio: "ejercicio",
  menu: "menu",
  gym: "gym",
  progreso: "progreso",
  perfil: "perfil",
  familia: "familia",
};

/** Pantalla de una ruta, o null si no se cuenta (acceso, bienvenida, errores). */
export function pageOf(pathname: string): PageId | null {
  const [first, second] = pathname.split("/").filter(Boolean);
  if (!first) return "hoy";
  if (first === "gym") return second === "entrenar" ? "gym-entrenar" : second === "rutina" ? "gym-rutina" : "gym";
  return TOP_LEVEL[first] ?? null;
}

/** Contadores de un día tal como viajan al servidor. */
export interface UsageBatch {
  /** veces que abrió la app */
  o?: number;
  /** toques en la pantalla */
  t?: number;
  /** pantallas vistas */
  p?: Partial<Record<PageId, number>>;
  /** acciones clave */
  a?: Partial<Record<ActionId, number>>;
}

// ---------- Lo que ve quien administra ----------

export interface UsageDayStat {
  date: string;
  opens: number;
  taps: number;
  views: number;
  records: number;
  ai: number;
}

export interface UsageMemberReport {
  id: string;
  name: string;
  username: string;
  role: Role;
  /** última vez que la app le mandó actividad (ms), o null si nunca */
  lastSeen: number | null;
  days: UsageDayStat[];
  pages: Partial<Record<PageId, number>>;
  actions: Partial<Record<ActionId, number>>;
}

export interface UsageReport {
  from: string;
  to: string;
  members: UsageMemberReport[];
}

/** Un día cuenta como «activo» si abrió la app, la tocó o vio alguna pantalla. */
export const isActiveDay = (d: UsageDayStat) => d.opens > 0 || d.taps > 0 || d.views > 0;
