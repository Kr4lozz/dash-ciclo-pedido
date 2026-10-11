import { createHash, randomBytes } from "node:crypto";
import { addDays } from "@/lib/dates";
import type { FitnessStatus } from "@/lib/fitness-shared";
import type { DayDoc } from "@/lib/schemas";
import { db, keys } from "./kv";

// Fitness automático (iPhone): un Atajo lee Salud y manda las calorías de cada día a la cuenta,
// con una llave personal. Solo se guarda el hash de la llave; se muestra una vez al crearla.

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const PREFIX = "mcf_";

export async function createFitnessToken(uid: string): Promise<string> {
  const r = db();
  const old = await r.get<{ h: string }>(keys.fitnessKey(uid));
  if (old?.h) await r.del(keys.fitnessToken(old.h));
  const token = PREFIX + randomBytes(24).toString("base64url");
  const h = sha(token);
  await r.set(keys.fitnessToken(h), { uid });
  await r.set(keys.fitnessKey(uid), { h });
  return token;
}

export async function uidForToken(token: string): Promise<string | null> {
  if (!token.startsWith(PREFIX) || token.length > 100) return null;
  const rec = await db().get<{ uid: string }>(keys.fitnessToken(sha(token)));
  return rec?.uid ?? null;
}

export async function fitnessStatus(uid: string): Promise<FitnessStatus> {
  const r = db();
  const [key, sync] = await Promise.all([
    r.get<{ h: string }>(keys.fitnessKey(uid)),
    r.get<NonNullable<FitnessStatus["lastSync"]>>(keys.fitnessSync(uid)),
  ]);
  return { connected: Boolean(key?.h), lastSync: sync ?? null };
}

/** Desconecta: la llave deja de valer. */
export async function deleteFitness(uid: string) {
  const r = db();
  const old = await r.get<{ h: string }>(keys.fitnessKey(uid));
  if (old?.h) await r.del(keys.fitnessToken(old.h));
  await r.del(keys.fitnessKey(uid), keys.fitnessSync(uid));
}

// ---------- Lo que manda el Atajo ----------

export interface FitnessDay {
  date: string;
  active: number | null;
  total: number | null;
}

/** 450 · "450" · "450,5" · "1.234,5" · "1,234.5" → número; lo demás → null. */
function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let t = v.replace(/[^\d.,-]/g, "");
  if (!t) return null;
  const dot = t.lastIndexOf(".");
  const comma = t.lastIndexOf(",");
  if (dot >= 0 && comma >= 0) {
    // el último separador es el decimal
    t = dot > comma ? t.replace(/,/g, "") : t.replace(/\./g, "").replace(",", ".");
  } else if (comma >= 0 || dot >= 0) {
    const sep = comma >= 0 ? "," : ".";
    // «1.234» o «1,234» son miles; «450,5» o «450.5» son decimales
    t = new RegExp(`^-?\\d{1,3}(\\${sep}\\d{3})+$`).test(t) ? t.split(sep).join("") : t.replace(",", ".");
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const pick = (o: Record<string, unknown>, names: string[]) => names.map((n) => o[n]).find((v) => v !== undefined && v !== "");

const MAX_KCAL = 20000;

/** Acepta {fecha, activa, reposo|total}, una lista `days`/`dias` de eso, y nombres en español o inglés. */
export function parseFitnessUpload(body: unknown): { days: FitnessDay[] } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Envía un JSON con la fecha y las calorías." };
  const o = body as Record<string, unknown>;
  const list = pick(o, ["days", "dias", "días"]);
  const entries: unknown[] = Array.isArray(list) ? list : list && typeof list === "object" ? [list] : [o];
  if (entries.length === 0 || entries.length > 14) return { error: "Envía entre 1 y 14 días." };

  const today = new Date().toISOString().slice(0, 10);
  const oldest = addDays(today, -35);
  const newest = addDays(today, 1);
  const out = new Map<string, FitnessDay>();
  for (const e of entries) {
    if (!e || typeof e !== "object") return { error: "Cada día debe ser un objeto con fecha y calorías." };
    const x = e as Record<string, unknown>;
    const rawDate = pick(x, ["fecha", "date", "dia", "día"]);
    const date = typeof rawDate === "string" ? rawDate.trim().slice(0, 10) : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { error: `Fecha inválida (${String(rawDate ?? "falta")}). Usa el formato aaaa-mm-dd.` };
    }
    if (date < oldest || date > newest) return { error: `La fecha ${date} está fuera del rango permitido (últimos 35 días).` };

    const active = num(pick(x, ["activa", "active", "moverse", "move"]));
    const resting = num(pick(x, ["reposo", "resting", "basal"]));
    let total = num(pick(x, ["total", "totales"]));
    if (active === null && resting === null && total === null) return { error: `Faltan las calorías de ${date}.` };
    if (total === null && resting !== null) total = (active ?? 0) + resting;
    for (const n of [active, total]) {
      if (n !== null && (n < 0 || n > MAX_KCAL)) return { error: `Calorías fuera de rango en ${date}.` };
    }
    // El total incluye las activas: si no cuadra, no se guarda.
    if (active !== null && total !== null && total < active) total = null;
    out.set(date, {
      date,
      active: active === null ? null : Math.round(active),
      total: total === null ? null : Math.round(total),
    });
  }
  return { days: [...out.values()] };
}

/** Guarda las calorías en el día (conserva comidas, ejercicio y lo demás del día). */
export async function saveFitnessDays(uid: string, days: FitnessDay[]) {
  const r = db();
  for (const d of days) {
    const doc = await r.hget<DayDoc>(keys.days(uid), d.date);
    const base: DayDoc = doc ?? { foods: [], exercises: [], water: 0 };
    // Si el Atajo solo trae un dato, se conserva el que ya había del otro.
    const active = d.active ?? base.burned?.active ?? null;
    const total = d.total ?? (d.active === null ? (base.burned?.total ?? null) : null);
    await r.hset(keys.days(uid), { [d.date]: { ...base, burned: { active, total } } });
  }
  const last = days.map((d) => d.date).sort().pop() ?? "";
  await r.set(keys.fitnessSync(uid), { at: Date.now(), days: days.length, last });
}
