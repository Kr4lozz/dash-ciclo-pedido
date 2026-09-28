// Alimentos y platos caseros peruanos de bajo costo para el menú sugerido.
// Valores por 100 g de alimento listo para comer (cocido si corresponde), tomados de
// tablas de composición de alimentos (USDA, TACO y tablas peruanas); son aproximados.

/** P = fuente de proteína, C = de carbohidratos, G = de grasa; "fijo" no se ajusta. */
export type Role = "P" | "C" | "G" | "fijo";

export type DishKind = "desayuno" | "almuerzo" | "cena" | "snack";

export const AVOID = [
  { id: "pescado", label: "Pescado" },
  { id: "pollo", label: "Pollo" },
  { id: "carne", label: "Carne de res" },
  { id: "visceras", label: "Hígado" },
  { id: "huevo", label: "Huevo" },
  { id: "lacteos", label: "Lácteos" },
  { id: "menestras", label: "Menestras" },
] as const;
export type Avoid = (typeof AVOID)[number]["id"];

export const SNACK_KINDS = [
  { id: "fruta", label: "Fruta" },
  { id: "yogur", label: "Yogur" },
  { id: "pan", label: "Pan con algo" },
  { id: "mani", label: "Maní" },
  { id: "huevo", label: "Huevo sancochado" },
  { id: "choclo", label: "Choclo con queso" },
  { id: "camote", label: "Camote" },
  { id: "galletas", label: "Galletas o cancha" },
  { id: "avena", label: "Quaker con leche" },
] as const;
export type SnackKind = (typeof SNACK_KINDS)[number]["id"];

export interface Food {
  name: string;
  /** Medida casera: "g" = se indica en gramos */
  unit: string;
  units: string;
  /** Gramos (o ml) por unidad */
  grams: number;
  ml?: boolean;
  /** Mostrar los gramos junto a la medida casera */
  showGrams?: boolean;
  /** Incremento y límites por comida, en unidades */
  step: number;
  min: number;
  max: number;
  /** kcal, proteína, carbohidratos y grasa por 100 g */
  per100: [number, number, number, number];
}

const taza = { unit: "taza", units: "tazas" };
const unidad = { unit: "unidad", units: "unidades", showGrams: false };
const gramos = { unit: "g", units: "g", grams: 1, step: 10 };

export const FOODS = {
  // Cereales, tubérculos y derivados
  arroz: { name: "Arroz blanco", ...taza, grams: 160, step: 0.25, min: 0.5, max: 3, per100: [130, 2.7, 28.2, 0.3] },
  fideos: { name: "Fideos", ...taza, grams: 140, step: 0.25, min: 0.5, max: 3, per100: [158, 5.8, 30.9, 0.9] },
  quinua: { name: "Quinua", ...taza, grams: 185, step: 0.25, min: 0.5, max: 2.5, per100: [120, 4.4, 21.3, 1.9] },
  avena: { name: "Avena en hojuelas", unit: "cucharada", units: "cucharadas", grams: 8, step: 1, min: 2, max: 10, per100: [379, 13.2, 67.7, 6.5] },
  pan: { name: "Pan francés", ...unidad, grams: 30, step: 1, min: 1, max: 4, per100: [272, 10.8, 51.9, 2.4] },
  papa: { name: "Papa sancochada", unit: "papa mediana", units: "papas medianas", grams: 150, step: 0.5, min: 0.5, max: 3, per100: [87, 1.9, 20.1, 0.1] },
  camote: { name: "Camote sancochado", unit: "trozo mediano", units: "trozos medianos", grams: 120, step: 0.5, min: 0.5, max: 3, per100: [76, 1.4, 17.7, 0.1] },
  yuca: { name: "Yuca sancochada", unit: "trozo mediano", units: "trozos medianos", grams: 120, step: 0.5, min: 0.5, max: 3, per100: [125, 0.6, 30.1, 0.3] },
  choclo: { name: "Choclo sancochado", unit: "choclo", units: "choclos", grams: 200, step: 0.5, min: 0.5, max: 1.5, per100: [96, 3.4, 21, 1.5] },
  cancha: { name: "Cancha serrana", unit: "puñado", units: "puñados", grams: 25, step: 0.5, min: 0.5, max: 2, per100: [410, 9, 74, 8] },
  galletas: { name: "Galletas de soda", unit: "paquete", units: "paquetes", grams: 30, step: 1, min: 1, max: 2, per100: [418, 9.5, 74, 8.6] },
  // Menestras (cocidas)
  lentejas: { name: "Lentejas", ...taza, grams: 200, step: 0.25, min: 0.5, max: 2, per100: [116, 9, 20.1, 0.4] },
  frejol: { name: "Frejol canario", ...taza, grams: 180, step: 0.25, min: 0.5, max: 2, per100: [127, 8.7, 22.8, 0.5] },
  garbanzos: { name: "Garbanzos", ...taza, grams: 165, step: 0.25, min: 0.5, max: 1.5, per100: [164, 8.9, 27.4, 2.6] },
  arvejas: { name: "Arveja partida", ...taza, grams: 200, step: 0.25, min: 0.5, max: 2, per100: [118, 8.3, 21.1, 0.4] },
  pallares: { name: "Pallares", ...taza, grams: 190, step: 0.25, min: 0.5, max: 2, per100: [115, 7.8, 20.9, 0.4] },
  habas: { name: "Habas", ...taza, grams: 170, step: 0.25, min: 0.5, max: 1.5, per100: [110, 7.6, 19.7, 0.4] },
  // Proteínas
  huevo: { name: "Huevo", ...unidad, grams: 50, step: 1, min: 1, max: 4, per100: [155, 12.6, 1.1, 10.6] },
  pechuga: { name: "Pechuga de pollo", ...gramos, min: 50, max: 250, per100: [165, 31, 0, 3.6] },
  pierna: { name: "Pollo (pierna sin piel)", ...gramos, min: 60, max: 250, per100: [185, 27, 0, 8.5] },
  higado: { name: "Hígado de pollo", ...gramos, min: 60, max: 200, per100: [167, 24.5, 0.9, 6.5] },
  carne: { name: "Carne molida de res", ...gramos, min: 50, max: 200, per100: [217, 26.1, 0, 11.7] },
  pescado: { name: "Pescado (jurel o bonito)", ...gramos, min: 60, max: 250, per100: [165, 27, 0, 6] },
  atun: { name: "Atún en agua", unit: "lata", units: "latas", grams: 120, step: 0.5, min: 0.5, max: 1.5, per100: [116, 25.5, 0, 0.8] },
  queso: { name: "Queso fresco", unit: "tajada", units: "tajadas", grams: 30, step: 1, min: 1, max: 3, per100: [299, 18.1, 3, 23.8] },
  yogur: { name: "Yogur bebible", unit: "vaso", units: "vasos", grams: 200, ml: true, step: 0.5, min: 0.5, max: 2, per100: [85, 3, 13.5, 2.2] },
  leche: { name: "Leche", ...taza, grams: 240, ml: true, step: 0.5, min: 0.5, max: 2, per100: [63, 3.3, 4.9, 3.4] },
  // Grasas
  mani: { name: "Maní tostado", unit: "puñado", units: "puñados", grams: 30, step: 0.5, min: 0.5, max: 1.5, per100: [585, 23.7, 21.5, 49.7] },
  palta: { name: "Palta", unit: "palta", units: "paltas", grams: 160, step: 0.25, min: 0.25, max: 1, per100: [160, 2, 8.5, 14.7] },
  aceite: { name: "Aceite vegetal", unit: "cucharadita", units: "cucharaditas", grams: 4.5, showGrams: false, step: 1, min: 0, max: 3, per100: [884, 0, 0, 100] },
  // Frutas
  platano: { name: "Plátano de seda", ...unidad, grams: 120, step: 1, min: 1, max: 2, per100: [89, 1.1, 22.8, 0.3] },
  manzana: { name: "Manzana", ...unidad, grams: 180, step: 1, min: 1, max: 1, per100: [52, 0.3, 13.8, 0.2] },
  mandarina: { name: "Mandarina", ...unidad, grams: 90, step: 1, min: 1, max: 3, per100: [53, 0.8, 13.3, 0.3] },
  naranja: { name: "Naranja", ...unidad, grams: 150, step: 1, min: 1, max: 2, per100: [47, 0.9, 11.8, 0.1] },
  papaya: { name: "Papaya", unit: "taza picada", units: "tazas picadas", grams: 145, step: 0.5, min: 0.5, max: 2, per100: [43, 0.5, 10.8, 0.3] },
  // Verduras y acompañamientos
  ensalada: { name: "Ensalada de lechuga, tomate y pepino", ...taza, grams: 100, step: 0.5, min: 0.5, max: 2, per100: [18, 0.9, 3.6, 0.2] },
  sarsa: { name: "Sarsa criolla", ...taza, grams: 100, step: 0.5, min: 0.5, max: 1, per100: [30, 0.9, 6.8, 0.1] },
  verduras: { name: "Verduras (zanahoria, vainita, zapallo)", ...taza, grams: 130, step: 0.5, min: 0.5, max: 2, per100: [35, 1.2, 7.5, 0.2] },
  arvejitas: { name: "Arvejitas con zanahoria", ...taza, grams: 130, step: 0.5, min: 0.5, max: 1, per100: [60, 3, 12, 0.2] },
  salsa: { name: "Salsa de tomate y cebolla", ...taza, grams: 240, step: 0.25, min: 0.25, max: 1, per100: [35, 1.3, 7.2, 0.3] },
  cremaAji: { name: "Crema de ají amarillo (pan, leche y ají)", ...taza, grams: 240, step: 0.25, min: 0.25, max: 1, per100: [180, 6.4, 17.7, 9.4] },
  olluco: { name: "Olluco", ...taza, grams: 150, step: 0.5, min: 0.5, max: 2, per100: [56, 1.1, 12.5, 0.1] },
  caldo: { name: "Caldo", ...taza, grams: 240, ml: true, step: 0.5, min: 0.5, max: 2, per100: [8, 0.5, 1.2, 0.2] },
} satisfies Record<string, Food>;

export type FoodId = keyof typeof FOODS;

export interface DishItem {
  food: FoodId;
  /** Cantidad de partida, en unidades de la medida casera */
  amount: number;
  role: Role;
  /** Nombre en este plato, por ejemplo "Huevo frito" */
  label?: string;
  min?: number;
  max?: number;
}

export interface Dish {
  id: string;
  kind: DishKind;
  name: string;
  items: DishItem[];
  /** Ingredientes que alguien podría no comer */
  avoid: Avoid[];
  snack?: SnackKind;
}

const P = (food: FoodId, amount: number, label?: string, limits?: { min?: number; max?: number }): DishItem => ({ food, amount, role: "P", label, ...limits });
const C = (food: FoodId, amount: number, label?: string, limits?: { min?: number; max?: number }): DishItem => ({ food, amount, role: "C", label, ...limits });
const G = (food: FoodId, amount: number, label?: string, limits?: { min?: number; max?: number }): DishItem => ({ food, amount, role: "G", label, ...limits });
const F = (food: FoodId, amount: number, label?: string): DishItem => ({ food, amount, role: "fijo", label });
/** Aceite para cocinar: al menos 1 cucharadita en lo frito o guisado. */
const oil = (amount: number, min = 1, max = 3, label = "Aceite (para cocinar)") => G("aceite", amount, label, { min, max });

export const DISHES: Dish[] = [
  // ---------- Desayunos ----------
  { id: "d-avena-pan-huevo", kind: "desayuno", name: "Avena con leche y pan con huevo", avoid: ["huevo", "lacteos"],
    items: [C("avena", 4), F("leche", 1), C("pan", 1), P("huevo", 1, "Huevo sancochado")] },
  { id: "d-pan-huevo-revuelto", kind: "desayuno", name: "Pan con huevo revuelto y mandarina", avoid: ["huevo"],
    items: [C("pan", 2), P("huevo", 2, "Huevo revuelto"), oil(1, 0, 1, "Aceite (para el huevo)"), F("mandarina", 1)] },
  { id: "d-pan-queso-quaker", kind: "desayuno", name: "Pan con queso fresco y quaker con leche", avoid: ["lacteos"],
    items: [C("pan", 2), P("queso", 1), C("avena", 3, "Avena (quaker)"), F("leche", 1)] },
  { id: "d-pan-palta-huevo", kind: "desayuno", name: "Pan con palta y huevo sancochado", avoid: ["huevo"],
    items: [C("pan", 2), G("palta", 0.25), P("huevo", 1, "Huevo sancochado")] },
  { id: "d-quinua-pan-queso", kind: "desayuno", name: "Quinua con leche y pan con queso", avoid: ["lacteos"],
    items: [C("quinua", 0.5), F("leche", 1), C("pan", 1), P("queso", 1, "Queso fresco")] },
  { id: "d-camote-huevo", kind: "desayuno", name: "Camote sancochado con huevo y palta", avoid: ["huevo"],
    items: [C("camote", 1), P("huevo", 2, "Huevo sancochado"), G("palta", 0.25, undefined, { min: 0 })] },
  { id: "d-pan-tortilla", kind: "desayuno", name: "Pan con tortilla de verduras", avoid: ["huevo"],
    items: [C("pan", 2), P("huevo", 2, "Huevo (tortilla)"), F("verduras", 0.5, "Verduras picadas"), oil(1, 1, 2)] },
  { id: "d-yogur-avena", kind: "desayuno", name: "Yogur con avena, plátano y maní", avoid: ["lacteos"],
    items: [P("yogur", 1), C("avena", 3), F("platano", 1), G("mani", 0.5, undefined, { min: 0 })] },
  { id: "d-pan-pollo", kind: "desayuno", name: "Pan con pollo y papaya", avoid: ["pollo"],
    items: [C("pan", 2), P("pechuga", 60, "Pollo deshilachado"), G("palta", 0.25, undefined, { min: 0 }), F("papaya", 1)] },
  { id: "d-pan-atun", kind: "desayuno", name: "Pan con atún y tomate", avoid: ["pescado"],
    items: [C("pan", 2), P("atun", 0.5), F("ensalada", 0.5, "Tomate y lechuga"), G("palta", 0.25, undefined, { min: 0 })] },
  { id: "d-choclo-queso", kind: "desayuno", name: "Choclo con queso y té", avoid: ["lacteos"],
    items: [C("choclo", 0.5), P("queso", 2)] },
  { id: "d-avena-huevo", kind: "desayuno", name: "Avena con plátano y huevo sancochado", avoid: ["huevo"],
    items: [C("avena", 5, "Avena cocida en agua"), F("platano", 1), P("huevo", 1, "Huevo sancochado"), G("mani", 0.5, undefined, { min: 0 })] },
  { id: "d-quaker-pan-palta", kind: "desayuno", name: "Quaker con leche y pan con palta", avoid: ["lacteos"],
    items: [C("avena", 3, "Avena (quaker)"), F("leche", 1), C("pan", 1), G("palta", 0.25)] },
  { id: "d-avena-mani", kind: "desayuno", name: "Avena en agua con plátano y maní", avoid: [],
    items: [C("avena", 5, "Avena cocida en agua"), F("platano", 1), G("mani", 0.5)] },

  // ---------- Almuerzos ----------
  { id: "a-lentejas", kind: "almuerzo", name: "Lentejas con arroz, huevo frito y sarsa", avoid: ["menestras", "huevo"],
    items: [P("lentejas", 1, "Lentejas guisadas"), C("arroz", 1), P("huevo", 1, "Huevo frito"), oil(1), F("sarsa", 0.5)] },
  { id: "a-seco-frejoles", kind: "almuerzo", name: "Seco de pollo con frejoles y arroz", avoid: ["pollo", "menestras"],
    items: [P("pierna", 120, "Pollo (seco)"), C("frejol", 0.75), C("arroz", 0.75), oil(1)] },
  { id: "a-arroz-pollo", kind: "almuerzo", name: "Arroz con pollo y ensalada", avoid: ["pollo"],
    items: [P("pierna", 130, "Pollo"), C("arroz", 1.25, "Arroz verde"), F("arvejitas", 0.5), oil(1), F("ensalada", 1)] },
  { id: "a-estofado", kind: "almuerzo", name: "Estofado de pollo con papa y arroz", avoid: ["pollo"],
    items: [P("pierna", 120, "Pollo (estofado)"), C("papa", 1), C("arroz", 0.75), F("arvejitas", 0.5), oil(1)] },
  { id: "a-tallarines", kind: "almuerzo", name: "Tallarines rojos con pollo", avoid: ["pollo"],
    items: [C("fideos", 1.5, "Tallarines"), P("pierna", 110, "Pollo"), F("salsa", 0.5, "Salsa roja"), oil(1)] },
  { id: "a-pescado-frito", kind: "almuerzo", name: "Pescado frito con arroz, yuca y sarsa", avoid: ["pescado"],
    items: [P("pescado", 130, "Pescado frito (jurel o bonito)"), C("arroz", 1), C("yuca", 0.5), oil(2), F("sarsa", 0.5)] },
  { id: "a-sudado", kind: "almuerzo", name: "Sudado de pescado con yuca y arroz", avoid: ["pescado"],
    items: [P("pescado", 140, "Pescado sudado (jurel o bonito)"), C("yuca", 1), C("arroz", 0.5), F("salsa", 0.5, "Jugo del sudado (tomate y cebolla)"), oil(1)] },
  { id: "a-chaufa", kind: "almuerzo", name: "Arroz chaufa de pollo", avoid: ["pollo", "huevo"],
    items: [C("arroz", 1.5), P("pechuga", 100, "Pollo"), P("huevo", 1, "Huevo (tortilla)"), F("verduras", 0.5, "Cebolla china y pimiento"), oil(2)] },
  { id: "a-tacu-tacu", kind: "almuerzo", name: "Tacu tacu con huevo frito y sarsa", avoid: ["menestras", "huevo"],
    items: [C("arroz", 0.75), C("frejol", 0.75), P("huevo", 2, "Huevo frito"), oil(2), F("sarsa", 0.5)] },
  { id: "a-pollo-plancha", kind: "almuerzo", name: "Pollo a la plancha con arroz y ensalada", avoid: ["pollo"],
    items: [P("pechuga", 140, "Pollo a la plancha"), C("arroz", 1), F("ensalada", 1), oil(1, 0)] },
  { id: "a-higado", kind: "almuerzo", name: "Hígado encebollado con arroz y papa", avoid: ["visceras"],
    items: [P("higado", 120, "Hígado encebollado"), C("arroz", 0.75), C("papa", 0.5), F("sarsa", 0.5, "Cebolla y tomate"), oil(1)] },
  { id: "a-olluquito", kind: "almuerzo", name: "Olluquito con carne y arroz", avoid: ["carne"],
    items: [P("carne", 90, "Carne de res picada"), F("olluco", 1), C("arroz", 1), oil(1)] },
  { id: "a-garbanzos", kind: "almuerzo", name: "Garbanzos guisados con arroz y huevo", avoid: ["menestras", "huevo"],
    items: [C("garbanzos", 0.75, "Garbanzos guisados"), C("arroz", 0.75), P("huevo", 1, "Huevo sancochado"), oil(1)] },
  { id: "a-aji-gallina", kind: "almuerzo", name: "Ají de gallina con papa y arroz", avoid: ["pollo", "lacteos"],
    items: [P("pechuga", 100, "Pollo deshilachado"), F("cremaAji", 0.5), C("papa", 0.5), C("arroz", 0.75)] },
  { id: "a-arvejita-pescado", kind: "almuerzo", name: "Arvejita partida con arroz y pescado frito", avoid: ["menestras", "pescado"],
    items: [C("arvejas", 0.75, "Arvejita partida"), C("arroz", 0.75), P("pescado", 100, "Pescado frito (jurel o bonito)"), oil(1), F("sarsa", 0.5)] },
  { id: "a-quinua-queso", kind: "almuerzo", name: "Guiso de quinua con queso y huevo", avoid: ["lacteos", "huevo"],
    items: [C("quinua", 1.5, "Quinua atamalada"), P("queso", 1), P("huevo", 1, "Huevo sancochado"), F("verduras", 0.5), oil(1, 0)] },
  { id: "a-tortilla-arroz", kind: "almuerzo", name: "Tortilla de verduras con arroz y ensalada", avoid: ["huevo"],
    items: [P("huevo", 3, "Huevos (tortilla)"), F("verduras", 1), C("arroz", 1), oil(2), F("ensalada", 1)] },
  { id: "a-saltado-pollo", kind: "almuerzo", name: "Saltado de pollo con papas y arroz", avoid: ["pollo"],
    items: [P("pechuga", 120, "Pollo saltado"), C("papa", 1, "Papa dorada"), C("arroz", 0.75), F("sarsa", 0.5, "Cebolla y tomate"), oil(2)] },
  { id: "a-pallares", kind: "almuerzo", name: "Pallares con arroz y pollo guisado", avoid: ["menestras", "pollo"],
    items: [C("pallares", 0.75), C("arroz", 0.75), P("pierna", 90, "Pollo guisado"), oil(1)] },
  { id: "a-carne-molida", kind: "almuerzo", name: "Guiso de carne molida con papa y arroz", avoid: ["carne"],
    items: [P("carne", 100), C("papa", 1), C("arroz", 0.75), F("verduras", 0.5), oil(1)] },
  { id: "a-frejoles", kind: "almuerzo", name: "Frejoles con arroz, camote y sarsa", avoid: ["menestras"],
    items: [P("frejol", 1, "Frejoles guisados"), C("arroz", 0.75), C("camote", 0.5), oil(1), F("sarsa", 0.5)] },

  // ---------- Cenas ----------
  { id: "c-sopa-pollo", kind: "cena", name: "Sopa de pollo con fideos y verduras", avoid: ["pollo"],
    items: [P("pierna", 100, "Pollo"), C("fideos", 0.75), C("papa", 0.5), F("verduras", 0.5), F("caldo", 1)] },
  { id: "c-tortilla-pan", kind: "cena", name: "Tortilla de verduras con pan", avoid: ["huevo"],
    items: [P("huevo", 2, "Huevos (tortilla)"), F("verduras", 0.5), C("pan", 1), oil(1, 1, 2)] },
  { id: "c-pollo-camote", kind: "cena", name: "Pollo a la plancha con camote y ensalada", avoid: ["pollo"],
    items: [P("pechuga", 120, "Pollo a la plancha"), C("camote", 1), F("ensalada", 1), oil(1, 0, 2)] },
  { id: "c-pan-pollo", kind: "cena", name: "Pan con pollo y té", avoid: ["pollo"],
    items: [C("pan", 2), P("pechuga", 70, "Pollo deshilachado"), F("ensalada", 0.5, "Lechuga y tomate"), G("palta", 0.25, undefined, { min: 0 })] },
  { id: "c-atun-papa", kind: "cena", name: "Ensalada de atún con papa sancochada", avoid: ["pescado"],
    items: [P("atun", 0.5), C("papa", 1), F("ensalada", 1), oil(1, 0, 2, "Aceite (aliño)")] },
  { id: "c-quaker-pan-queso", kind: "cena", name: "Quaker con leche y pan con queso", avoid: ["lacteos"],
    items: [C("avena", 3, "Avena (quaker)"), F("leche", 1), C("pan", 1), P("queso", 1)] },
  { id: "c-pescado-plancha", kind: "cena", name: "Pescado a la plancha con yuca y ensalada", avoid: ["pescado"],
    items: [P("pescado", 130, "Pescado a la plancha (jurel o bonito)"), C("yuca", 1), F("ensalada", 1), oil(1, 0, 2)] },
  { id: "c-huevos-tomate", kind: "cena", name: "Huevos revueltos con tomate y pan", avoid: ["huevo"],
    items: [P("huevo", 2, "Huevos revueltos"), F("sarsa", 0.5, "Tomate y cebolla"), C("pan", 1), oil(1, 1, 2)] },
  { id: "c-solterito", kind: "cena", name: "Solterito de queso", avoid: ["lacteos"],
    items: [P("queso", 2), C("habas", 0.5), C("choclo", 0.5), F("sarsa", 0.5, "Tomate y cebolla"), oil(1, 0, 2, "Aceite (aliño)")] },
  { id: "c-sopa-quinua", kind: "cena", name: "Sopa de quinua con verduras y queso", avoid: ["lacteos"],
    items: [C("quinua", 0.75), C("papa", 0.5), P("queso", 1), F("verduras", 0.5), F("caldo", 1)] },
  { id: "c-caldo-gallina", kind: "cena", name: "Caldo de gallina con fideos y papa", avoid: ["pollo"],
    items: [P("pierna", 110, "Pollo o gallina"), C("fideos", 0.5), C("papa", 1), F("caldo", 1)] },
  { id: "c-pollo-quinua", kind: "cena", name: "Pollo con quinua y verduras salteadas", avoid: ["pollo"],
    items: [P("pechuga", 110, "Pollo salteado"), C("quinua", 0.75), F("verduras", 0.5), oil(1, 0, 2)] },
  { id: "c-ensalada-lentejas", kind: "cena", name: "Ensalada de lentejas con huevo", avoid: ["menestras", "huevo"],
    items: [C("lentejas", 0.75), P("huevo", 1, "Huevo sancochado"), F("sarsa", 0.5, "Cebolla, tomate y limón"), oil(1, 0, 2, "Aceite (aliño)")] },
  { id: "c-quinua-palta", kind: "cena", name: "Quinua con habas, verduras y palta", avoid: [],
    items: [C("quinua", 0.75), P("habas", 0.5), F("verduras", 0.5), G("palta", 0.25)] },

  // ---------- Snacks ----------
  { id: "s-platano", kind: "snack", snack: "fruta", name: "Plátano", avoid: [], items: [C("platano", 1)] },
  { id: "s-manzana", kind: "snack", snack: "fruta", name: "Manzana", avoid: [], items: [C("manzana", 1)] },
  { id: "s-mandarinas", kind: "snack", snack: "fruta", name: "Mandarinas", avoid: [], items: [C("mandarina", 2)] },
  { id: "s-papaya", kind: "snack", snack: "fruta", name: "Papaya picada", avoid: [], items: [C("papaya", 1)] },
  { id: "s-naranja", kind: "snack", snack: "fruta", name: "Naranja", avoid: [], items: [C("naranja", 1)] },
  { id: "s-yogur-avena", kind: "snack", snack: "yogur", name: "Yogur con avena", avoid: ["lacteos"], items: [P("yogur", 1), C("avena", 2)] },
  { id: "s-yogur-papaya", kind: "snack", snack: "yogur", name: "Yogur con papaya", avoid: ["lacteos"], items: [P("yogur", 1), C("papaya", 0.5)] },
  { id: "s-pan-queso", kind: "snack", snack: "pan", name: "Pan con queso fresco", avoid: ["lacteos"], items: [C("pan", 1), P("queso", 1)] },
  { id: "s-pan-huevo", kind: "snack", snack: "pan", name: "Pan con huevo sancochado", avoid: ["huevo"], items: [C("pan", 1), P("huevo", 1, "Huevo sancochado")] },
  { id: "s-pan-palta", kind: "snack", snack: "pan", name: "Pan con palta", avoid: [], items: [C("pan", 1), G("palta", 0.25)] },
  { id: "s-mani", kind: "snack", snack: "mani", name: "Maní tostado", avoid: [], items: [G("mani", 0.5)] },
  { id: "s-platano-mani", kind: "snack", snack: "mani", name: "Plátano con maní", avoid: [], items: [C("platano", 1), G("mani", 0.5)] },
  { id: "s-huevos", kind: "snack", snack: "huevo", name: "Huevo sancochado", avoid: ["huevo"], items: [P("huevo", 2, "Huevo sancochado")] },
  { id: "s-huevo-mandarina", kind: "snack", snack: "huevo", name: "Huevo sancochado y mandarina", avoid: ["huevo"], items: [P("huevo", 1, "Huevo sancochado"), C("mandarina", 1)] },
  { id: "s-choclo-queso", kind: "snack", snack: "choclo", name: "Choclo con queso", avoid: ["lacteos"], items: [C("choclo", 0.5), P("queso", 1)] },
  { id: "s-camote", kind: "snack", snack: "camote", name: "Camote sancochado", avoid: [], items: [C("camote", 1)] },
  { id: "s-galletas", kind: "snack", snack: "galletas", name: "Galletas de soda", avoid: [], items: [C("galletas", 1)] },
  { id: "s-cancha", kind: "snack", snack: "galletas", name: "Cancha serrana", avoid: [], items: [C("cancha", 1)] },
  { id: "s-quaker", kind: "snack", snack: "avena", name: "Quaker con leche", avoid: ["lacteos"], items: [C("avena", 2, "Avena (quaker)"), F("leche", 1)] },
];
