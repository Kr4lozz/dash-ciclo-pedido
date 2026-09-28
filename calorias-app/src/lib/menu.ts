import { DISHES, FOODS, type Avoid, type Dish, type DishItem, type DishKind, type Food, type SnackKind } from "./menu-data";
import { macroGrams, type Targets } from "./nutrition";
import type { FoodEntry, Macros, MealType } from "./types";

// Menú sugerido: elige platos caseros para las comidas del día y ajusta las cantidades de
// todo el día a la vez para acercarse a la meta de calorías y macros. Corre en el celular.

/** kcal, proteína, carbohidratos y grasa */
export type Vec = [number, number, number, number];

export type SlotId = "desayuno" | "media-manana" | "almuerzo" | "lonche" | "cena";

/**
 * Comidas posibles y cuánto de la meta del día lleva cada una (kcal, proteína, carbohidratos,
 * grasa): el almuerzo es la comida fuerte y la cena, más liviana y con más proteína.
 */
export const SLOTS: { id: SlotId; label: string; meal: MealType; kind: DishKind; share: Vec }[] = [
  { id: "desayuno", label: "Desayuno", meal: "desayuno", kind: "desayuno", share: [25, 20, 27, 25] },
  { id: "media-manana", label: "Media mañana", meal: "snack", kind: "snack", share: [8, 6, 10, 8] },
  { id: "almuerzo", label: "Almuerzo", meal: "almuerzo", kind: "almuerzo", share: [37, 40, 36, 37] },
  { id: "lonche", label: "Lonche", meal: "snack", kind: "snack", share: [10, 8, 12, 10] },
  { id: "cena", label: "Cena", meal: "cena", kind: "cena", share: [20, 26, 15, 20] },
];

export const slotInfo = (id: SlotId) => SLOTS.find((s) => s.id === id) ?? SLOTS[0];

export interface MenuSettings {
  slots: SlotId[];
  /** Snacks preferidos; vacío = cualquiera */
  snacks: SnackKind[];
  avoid: Avoid[];
  /** Restar lo que ya se registró ese día */
  discount: boolean;
}

export const DEFAULT_SETTINGS: MenuSettings = {
  slots: ["desayuno", "almuerzo", "lonche", "cena"],
  snacks: [],
  avoid: [],
  discount: true,
};

export interface PlannedItem {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface PlannedMeal {
  slot: SlotId;
  dishId: string;
  name: string;
  items: PlannedItem[];
  total: Vec;
  /** Calorías que le tocan a esta comida (se reutiliza al pedir otra opción) */
  size: number;
  /** Platos ya mostrados para esta comida */
  seen: string[];
  added: boolean;
}

export interface MenuPlan {
  date: string;
  seed: number;
  settings: MenuSettings;
  /** Meta del día (con la actividad) al armar el menú */
  goal: Vec;
  /** Lo ya registrado que se restó, si se restó */
  eaten: Vec | null;
  /** Comidas que ya estaban registradas */
  skipped: SlotId[];
  /** Comidas sin platos posibles con lo que no se come */
  missing: SlotId[];
  meals: PlannedMeal[];
}

const DEFAULT_PCT: Macros = { protein: 25, carbs: 50, fat: 25 };

/** Meta del día: la de Hoy más la actividad registrada (restantes = meta − comidas + ejercicio). */
export function dayGoal(targets: Targets, macroPct: Macros | null, activity: number): Vec {
  const kcal = targets.calories + Math.max(0, activity);
  const g = activity > 0 ? macroGrams(kcal, macroPct ?? DEFAULT_PCT) : targets;
  return [kcal, g.protein, g.carbs, g.fat];
}

function sumEntries(entries: FoodEntry[]): Vec {
  const t: Vec = [0, 0, 0, 0];
  for (const f of entries) {
    t[0] += f.calories;
    t[1] += f.protein;
    t[2] += f.carbs;
    t[3] += f.fat;
  }
  return t;
}

function addVec(a: Vec, b: Vec): Vec {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]];
}

/** Totales del día si se sigue el menú (incluye lo ya registrado que se restó). */
export function planTotal(plan: MenuPlan): Vec {
  return plan.meals.reduce((acc, m) => addVec(acc, m.total), plan.eaten ?? [0, 0, 0, 0]);
}

// ---------- Modelo de cada plato ----------

/** Importancia de cada meta: calorías y proteína primero. */
const W: Vec = [2, 2, 1, 1];
/** Evita dividir entre metas muy pequeñas (snacks). */
const FLOOR: Vec = [80, 6, 10, 4];
/** Leve preferencia por la cantidad de la receta base. */
const LAMBDA = 0.02;
/** Penaliza cambiar las proporciones del plato (mucho pollo con poco pan, por ejemplo). */
const BALANCE = 0.1;
/** Penaliza que una comida quede mucho más grande o chica de lo que le toca. */
const MU = 0.5;

const GROUPS = ["P", "C", "G"] as const;
type Group = (typeof GROUPS)[number];

function perUnit(food: Food): Vec {
  const k = food.grams / 100;
  return [food.per100[0] * k, food.per100[1] * k, food.per100[2] * k, food.per100[3] * k];
}

function limits(it: DishItem) {
  const f: Food = FOODS[it.food];
  return { min: it.min ?? f.min, max: it.max ?? f.max, step: f.step };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const toStep = (v: number, step: number) => Math.round(v / step) * step;

/**
 * Un plato como problema lineal: los ingredientes de proteína, carbohidratos y grasa se
 * escalan por grupo (con sus límites) y los fijos (verduras, caldo) no cambian.
 */
interface Model {
  dish: Dish;
  groups: Group[];
  /** Aporte de cada grupo con las cantidades de la receta */
  A: Vec[];
  /** Aporte de los ingredientes fijos */
  base: Vec;
  lo: number[];
  hi: number[];
}

const models = new Map<string, Model>();

function modelOf(dish: Dish): Model {
  const cached = models.get(dish.id);
  if (cached) return cached;
  const groups = GROUPS.filter((g) => dish.items.some((i) => i.role === g));
  const model: Model = {
    dish,
    groups,
    A: groups.map((): Vec => [0, 0, 0, 0]),
    base: [0, 0, 0, 0],
    lo: groups.map(() => 0),
    hi: groups.map(() => Infinity),
  };
  for (const it of dish.items) {
    const u = perUnit(FOODS[it.food]);
    const g = groups.indexOf(it.role as Group);
    const into = g < 0 ? model.base : model.A[g];
    for (let k = 0; k < 4; k++) into[k] += u[k] * it.amount;
    if (g >= 0) {
      const { min, max } = limits(it);
      model.lo[g] = Math.max(model.lo[g], min / it.amount);
      model.hi[g] = Math.min(model.hi[g], max / it.amount);
    }
  }
  model.groups.forEach((_, g) => {
    if (model.lo[g] > model.hi[g]) model.lo[g] = model.hi[g];
  });
  models.set(dish.id, model);
  return model;
}

function totalOf(dish: Dish, amounts: number[]): Vec {
  const t: Vec = [0, 0, 0, 0];
  dish.items.forEach((it, i) => {
    const u = perUnit(FOODS[it.food]);
    for (let k = 0; k < 4; k++) t[k] += u[k] * amounts[i];
  });
  return t;
}

/** Error relativo ponderado frente a la meta (0 = exacto). */
function errorOf(total: Vec, target: Vec): number {
  let e = 0;
  for (let k = 0; k < 4; k++) {
    const d = (total[k] - target[k]) / Math.max(target[k], FLOOR[k]);
    e += (W[k] * d) ** 2;
  }
  return e;
}

/** Cuánto se alejan las cantidades de las proporciones de la receta. */
function distortion(dish: Dish, amounts: number[]): number {
  const ratios = dish.items.flatMap((it, i) => (it.role === "fijo" ? [] : [amounts[i] / it.amount]));
  if (ratios.length < 2) return 0;
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return BALANCE * ratios.reduce((s, r) => s + (r - mean) ** 2, 0);
}

/** Resuelve M·x = r con pivoteo parcial. */
function gaussSolve(M: number[][], r: number[]): number[] | null {
  const n = r.length;
  const a = M.map((row, i) => [...row, r[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let i = col + 1; i < n; i++) if (Math.abs(a[i][col]) > Math.abs(a[piv][col])) piv = i;
    if (Math.abs(a[piv][col]) < 1e-12) return null;
    [a[col], a[piv]] = [a[piv], a[col]];
    for (let i = 0; i < n; i++) {
      if (i === col) continue;
      const f = a[i][col] / a[col][col];
      for (let j = col; j <= n; j++) a[i][j] -= f * a[col][j];
    }
  }
  return a.map((row, i) => row[n] / row[i]);
}

// ---------- Ajuste del día completo ----------

/** Una comida por armar y las calorías que le tocan. */
interface Part {
  model: Model;
  size: number;
}

/**
 * Escalas de cada grupo de cada comida, todas a la vez: mínimos cuadrados ponderados sobre
 * los totales del día, el tamaño de cada comida y las proporciones de cada plato, con límites.
 */
function jointScales(parts: Part[], constant: Vec, goal: Vec): number[][] {
  const vars = parts.flatMap((p, m) => p.model.groups.map((_, g) => ({ m, g })));
  const n = vars.length;
  const x = new Array<number>(n).fill(1);
  if (n > 0) {
    const M = vars.map(() => new Array<number>(n).fill(0));
    const r = new Array<number>(n).fill(0);
    const addRow = (a: number[], y: number) => {
      for (let i = 0; i < n; i++) {
        if (a[i] === 0) continue;
        r[i] += a[i] * y;
        for (let j = 0; j < n; j++) M[i][j] += a[i] * a[j];
      }
    };
    const fixedPart = parts.reduce((acc, p) => addVec(acc, p.model.base), constant);
    for (let k = 0; k < 4; k++) {
      const s = W[k] / Math.max(goal[k], FLOOR[k]);
      addRow(
        vars.map(({ m, g }) => s * parts[m].model.A[g][k]),
        s * (goal[k] - fixedPart[k]),
      );
    }
    parts.forEach((p, m) => {
      const s = Math.sqrt(MU) / Math.max(p.size, FLOOR[0]);
      addRow(
        vars.map((v) => (v.m === m ? s * p.model.A[v.g][0] : 0)),
        s * (p.size - p.model.base[0]),
      );
    });
    vars.forEach((v, i) => {
      const groups = parts[v.m].model.groups.length;
      vars.forEach((w, j) => {
        if (w.m === v.m) M[i][j] += BALANCE * ((i === j ? 1 : 0) - 1 / groups);
      });
      M[i][i] += LAMBDA;
      r[i] += LAMBDA;
    });

    // Límites: se fija el grupo que más se sale y se vuelve a resolver el resto.
    const lo = vars.map((v) => parts[v.m].model.lo[v.g]);
    const hi = vars.map((v) => parts[v.m].model.hi[v.g]);
    const fixed = new Array<boolean>(n).fill(false);
    for (let iter = 0; iter <= n; iter++) {
      const free = x.map((_, i) => i).filter((i) => !fixed[i]);
      if (free.length === 0) break;
      const sol = gaussSolve(
        free.map((i) => free.map((j) => M[i][j])),
        free.map((i) => r[i] - x.reduce((s, xj, j) => s + (fixed[j] ? M[i][j] * xj : 0), 0)),
      );
      if (!sol) break;
      let worst = -1;
      let worstBy = 0;
      free.forEach((i, f) => {
        x[i] = sol[f];
        const by = x[i] < lo[i] ? lo[i] - x[i] : x[i] > hi[i] ? x[i] - hi[i] : 0;
        if (by > worstBy) {
          worstBy = by;
          worst = i;
        }
      });
      if (worst < 0) break;
      x[worst] = clamp(x[worst], lo[worst], hi[worst]);
      fixed[worst] = true;
    }
    vars.forEach((_, i) => {
      x[i] = clamp(x[i], lo[i], hi[i]);
    });
  }
  let i = 0;
  return parts.map((p) => p.model.groups.map(() => x[i++]));
}

function dayCost(parts: Part[], amounts: number[][], constant: Vec, goal: Vec): number {
  let total = constant;
  let extra = 0;
  parts.forEach((p, m) => {
    const t = totalOf(p.model.dish, amounts[m]);
    total = addVec(total, t);
    extra += MU * ((t[0] - p.size) / Math.max(p.size, FLOOR[0])) ** 2;
    extra += distortion(p.model.dish, amounts[m]);
  });
  return errorOf(total, goal) + extra;
}

/**
 * Cantidades en medidas caseras para las comidas por armar; `constant` es lo que ya está
 * fijo en el día (lo registrado y las comidas que no cambian).
 */
function solveDay(parts: Part[], constant: Vec, goal: Vec): { amounts: number[][]; cost: number } {
  const xs = jointScales(parts, constant, goal);
  const amounts = parts.map((p, m) =>
    p.model.dish.items.map((it) => {
      const g = p.model.groups.indexOf(it.role as Group);
      if (g < 0) return it.amount;
      const { min, max, step } = limits(it);
      return clamp(toStep(it.amount * xs[m][g], step), min, max);
    }),
  );
  // Al redondear a medidas caseras se pierde precisión: se corrige de a un paso.
  let cost = dayCost(parts, amounts, constant, goal);
  for (let iter = 0; iter < 150; iter++) {
    let best: { m: number; i: number; next: number; cost: number } | null = null;
    parts.forEach((p, m) => {
      p.model.dish.items.forEach((it, i) => {
        if (it.role === "fijo") return;
        const { min, max, step } = limits(it);
        for (const dir of [-1, 1]) {
          const next = toStep(amounts[m][i] + dir * step, step);
          if (next < min - 1e-9 || next > max + 1e-9) continue;
          const prev = amounts[m][i];
          amounts[m][i] = next;
          const c = dayCost(parts, amounts, constant, goal);
          amounts[m][i] = prev;
          if (c < (best?.cost ?? cost) - 1e-9) best = { m, i, next, cost: c };
        }
      });
    });
    if (!best) break;
    const { m, i, next, cost: c } = best;
    amounts[m][i] = next;
    cost = c;
  }
  return { amounts, cost };
}

// ---------- Elección de platos ----------

function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const newSeed = () => Math.floor(Math.random() * 2 ** 31);

/** Proteína principal del plato, para no repetirla en todas las comidas. */
const mainProtein = (d: Dish) => d.avoid[0] ?? "otro";

function candidates(kind: DishKind, settings: MenuSettings): Dish[] {
  const allowed = DISHES.filter((d) => d.kind === kind && !d.avoid.some((a) => settings.avoid.includes(a)));
  if (kind !== "snack" || settings.snacks.length === 0) return allowed;
  const preferred = allowed.filter((d) => d.snack && settings.snacks.includes(d.snack));
  return preferred.length > 0 ? preferred : allowed;
}

/** Índice al azar con probabilidad proporcional al peso. */
function sample(weights: number[], rand: () => number): number {
  let x = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i];
    if (x <= 0) return i;
  }
  return weights.length - 1;
}

// Equilibrio entre variedad y precisión, medido con miles de metas distintas: con 3 a 5
// comidas y sin restricciones, el 90 % de los menús queda a menos de 4 % de las calorías y
// 9 % de la proteína de la meta.
/** Hasta cuánto peor que el mejor plato se acepta uno, para variar. */
const WINDOW = 1;
/** Qué tanto se prefieren los platos que calzan mejor (menor = más estricto). */
const TEMPERATURE = 0.3;
/** Los snacks aportan poco al total: se eligen con más libertad. */
const SNACK_TEMPERATURE = 0.6;
/** Combinaciones de platos que se prueban por menú. */
const TRIES = 16;
/** Entre las combinaciones casi tan buenas como la mejor se elige al azar. */
const TOLERANCE = 0.06;

const round1 = (n: number) => Math.round(n * 10) / 10;

const FRACTIONS: Record<string, string> = { "0.25": "¼", "0.5": "½", "0.75": "¾" };

function formatAmount(n: number): string {
  const whole = Math.floor(n + 1e-9);
  const frac = FRACTIONS[String(Math.round((n - whole) * 4) / 4)] ?? "";
  if (whole === 0) return frac || "0";
  return `${whole}${frac}`;
}

function formatPortion(food: Food, amount: number): string {
  if (food.unit === "g") return `${Math.round(amount)} g`;
  const qty = `${formatAmount(amount)} ${amount > 1 ? food.units : food.unit}`;
  if (food.showGrams === false) return qty;
  const grams = Math.round((amount * food.grams) / 5) * 5;
  return `${qty} (${grams} ${food.ml ? "ml" : "g"})`;
}

function toMeal(slot: SlotId, dish: Dish, amounts: number[], size: number, seen: string[]): PlannedMeal {
  const items: PlannedItem[] = [];
  dish.items.forEach((it, i) => {
    const amount = amounts[i];
    if (amount <= 0) return;
    const food: Food = FOODS[it.food];
    const u = perUnit(food);
    items.push({
      name: it.label ?? food.name,
      portion: formatPortion(food, amount),
      calories: Math.round(u[0] * amount),
      protein: round1(u[1] * amount),
      carbs: round1(u[2] * amount),
      fat: round1(u[3] * amount),
    });
  });
  const total = items.reduce<Vec>(
    (t, it) => [t[0] + it.calories, t[1] + it.protein, t[2] + it.carbs, t[3] + it.fat],
    [0, 0, 0, 0],
  );
  return { slot, dishId: dish.id, name: dish.name, items, total, size, seen, added: false };
}

/** Comidas del día que ya tienen algo registrado. */
function loggedSlots(slots: SlotId[], logged: FoodEntry[]): SlotId[] {
  const out: SlotId[] = [];
  for (const id of ["desayuno", "almuerzo", "cena"] as const) {
    if (slots.includes(id) && logged.some((f) => f.meal === id)) out.push(id);
  }
  const snacks = logged.filter((f) => f.meal === "snack");
  if (snacks.length === 0) return out;
  if (slots.includes("media-manana") && slots.includes("lonche")) {
    // Con dos snacks, la hora del registro dice cuál fue.
    if (snacks.some((f) => new Date(f.createdAt).getHours() < 15)) out.push("media-manana");
    if (snacks.some((f) => new Date(f.createdAt).getHours() >= 15)) out.push("lonche");
  } else {
    for (const id of ["media-manana", "lonche"] as const) if (slots.includes(id)) out.push(id);
  }
  return out;
}

/** Por debajo de esto no vale la pena proponer otra comida. */
export const MIN_KCAL_TO_PLAN = 150;

const ZERO: Vec = [0, 0, 0, 0];

export function buildPlan(input: {
  date: string;
  goal: Vec;
  settings: MenuSettings;
  logged: FoodEntry[];
  seed: number;
}): MenuPlan {
  const { date, goal, settings, logged, seed } = input;
  const discount = settings.discount && logged.length > 0;
  const eaten = discount ? sumEntries(logged) : null;
  const skipped = discount ? loggedSlots(settings.slots, logged) : [];
  const slots = SLOTS.filter((s) => settings.slots.includes(s.id) && !skipped.includes(s.id));
  const remaining = goal.map((v, k) => Math.max(0, v - (eaten?.[k] ?? 0))) as Vec;
  const plan: MenuPlan = { date, seed, settings, goal, eaten, skipped, missing: [], meals: [] };
  if (remaining[0] < MIN_KCAL_TO_PLAN || slots.length === 0) return plan;

  // Lo que le toca a cada comida, repartiendo lo que falta del día según su peso por macro.
  const shareSum = slots.reduce<Vec>((acc, s) => addVec(acc, s.share), [0, 0, 0, 0]);
  const planned = slots.flatMap((slot) => {
    const target = remaining.map((v, k) => (v * slot.share[k]) / shareSum[k]) as Vec;
    // Qué tan bien calza cada plato por sí solo con lo que le toca a la comida. Los snacks
    // aportan poco y cualquiera sirve (fruta, yogur, pan…): el resto del día compensa.
    const options = candidates(slot.kind, settings)
      .map((dish) => ({
        dish,
        fit: slot.kind === "snack" ? 0 : solveDay([{ model: modelOf(dish), size: target[0] }], ZERO, target).cost,
      }))
      .sort((a, b) => a.fit - b.fit)
      .filter((o, _, all) => o.fit <= all[0].fit + WINDOW);
    if (options.length === 0) plan.missing.push(slot.id);
    return options.length > 0 ? [{ slot, target, options }] : [];
  });

  const rand = mulberry32(seed);
  const constant = eaten ?? ZERO;
  const tries: { dishes: Dish[]; amounts: number[][]; cost: number }[] = [];
  for (let t = 0; t < TRIES; t++) {
    const used = new Set<string>();
    const proteins: string[] = [];
    const dishes = planned.map(({ slot, options }) => {
      const free = options.filter((o) => !used.has(o.dish.id));
      const pool = free.length > 0 ? free : options;
      const snack = slot.kind === "snack";
      const weights = pool.map(
        (o) =>
          Math.exp(-(o.fit - pool[0].fit) / (snack ? SNACK_TEMPERATURE : TEMPERATURE)) *
          (!snack && proteins.includes(mainProtein(o.dish)) ? 0.3 : 1),
      );
      const dish = pool[sample(weights, rand)].dish;
      used.add(dish.id);
      if (slot.kind !== "snack") proteins.push(mainProtein(dish));
      return dish;
    });
    const parts = dishes.map((dish, i) => ({ model: modelOf(dish), size: planned[i].target[0] }));
    tries.push({ dishes, ...solveDay(parts, constant, goal) });
  }
  const best = Math.min(...tries.map((t) => t.cost));
  const near = tries.filter((t) => t.cost <= best + TOLERANCE);
  const chosen = near[Math.floor(rand() * near.length)];
  plan.meals = planned.map(({ slot, target }, i) =>
    toMeal(slot.id, chosen.dishes[i], chosen.amounts[i], target[0], [chosen.dishes[i].id]),
  );
  return plan;
}

const dishById = (id: string) => DISHES.find((d) => d.id === id);

/**
 * Vuelve a calcular las cantidades de las comidas que aún no se agregaron al diario, con
 * sus platos (o los reemplazos indicados), para que el día cuadre con la meta.
 */
function refitMeals(plan: MenuPlan, goal: Vec, replace?: { slot: SlotId; dish: Dish; seen: string[] }) {
  const open = plan.meals.filter((m) => !m.added && (m.slot === replace?.slot || dishById(m.dishId)));
  const constant = plan.meals
    .filter((m) => !open.includes(m))
    .reduce((acc, m) => addVec(acc, m.total), plan.eaten ?? ZERO);
  const dishes = open.map((m) => (m.slot === replace?.slot ? replace.dish : (dishById(m.dishId) as Dish)));
  const solved = solveDay(
    dishes.map((dish, i) => ({ model: modelOf(dish), size: open[i].size })),
    constant,
    goal,
  );
  const meals = plan.meals.map((m) => {
    const i = open.indexOf(m);
    if (i < 0) return m;
    const seen = m.slot === replace?.slot ? replace.seen : m.seen;
    return toMeal(m.slot, dishes[i], solved.amounts[i], m.size, seen);
  });
  return { meals, cost: solved.cost };
}

/** Mismos platos, cantidades recalculadas para una meta nueva (cambió el perfil o la actividad). */
export function refitPlan(plan: MenuPlan, goal: Vec): MenuPlan {
  return { ...plan, goal, meals: refitMeals(plan, goal).meals };
}

/**
 * Otro plato para una comida. Las cantidades de las comidas que aún no están en el diario se
 * reajustan para que el día siga cuadrando con la meta.
 */
export function anotherOption(plan: MenuPlan, slotId: SlotId): MenuPlan {
  const meal = plan.meals.find((m) => m.slot === slotId);
  if (!meal || meal.added) return plan;
  const slot = slotInfo(slotId);
  const others = plan.meals.filter((m) => m.slot !== slotId);
  const taken = new Set(others.map((m) => m.dishId));
  const options = candidates(slot.kind, plan.settings).filter((d) => !taken.has(d.id) && d.id !== meal.dishId);
  if (options.length === 0) return plan;

  const proteins =
    slot.kind === "snack"
      ? []
      : others.flatMap((m) => {
          const d = dishById(m.dishId);
          return d && d.kind !== "snack" ? [mainProtein(d)] : [];
        });
  const penalty = (d: Dish) => (proteins.includes(mainProtein(d)) ? 0.1 : 0);

  // Primero un filtro rápido con el resto del día como está; luego se reajusta todo el día
  // para los mejores y se elige uno al azar entre los que mejor cuadran.
  const rest = others.reduce((acc, m) => addVec(acc, m.total), plan.eaten ?? ZERO);
  const quick = options
    .map((dish) => ({
      dish,
      score: solveDay([{ model: modelOf(dish), size: meal.size }], rest, plan.goal).cost + penalty(dish),
    }))
    .sort((a, b) => a.score - b.score)
    .filter((o, _, all) => o.score <= all[0].score + WINDOW);
  let seen = meal.seen;
  if (quick.every((o) => seen.includes(o.dish.id))) seen = [meal.dishId];
  const fresh = quick.filter((o) => !seen.includes(o.dish.id));
  const finalists = (fresh.length > 0 ? fresh : quick)
    .slice(0, 6)
    .map((o) => {
      const refit = refitMeals(plan, plan.goal, { slot: slotId, dish: o.dish, seen: [...seen, o.dish.id] });
      return { ...refit, score: refit.cost + penalty(o.dish) };
    })
    .sort((a, b) => a.score - b.score);
  const rand = mulberry32(plan.seed + seen.length * 7919 + SLOTS.findIndex((s) => s.id === slotId));
  const temperature = slot.kind === "snack" ? SNACK_TEMPERATURE : TEMPERATURE;
  const weights = finalists.map((f) => Math.exp(-(f.score - finalists[0].score) / temperature));
  return { ...plan, meals: finalists[sample(weights, rand)].meals };
}
