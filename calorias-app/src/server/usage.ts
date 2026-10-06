import { z } from "zod";
import { addDays, lastNDays } from "@/lib/dates";
import {
  ACTIONS,
  ACTION_IDS,
  PAGES,
  PAGE_IDS,
  RECORD_ACTIONS,
  type ActionId,
  type PageId,
  type UsageBatch,
  type UsageDayStat,
  type UsageMemberReport,
  type UsageReport,
} from "@/lib/usage-shared";
import type { UserRecord } from "./auth";
import { db, keys } from "./kv";

// Contadores de uso por persona y mes, en un hash por mes: «dd:o» (aperturas), «dd:t» (toques),
// «dd:p:pantalla» y «dd:a:acción». Un mes por clave mantiene cada lectura pequeña y deja
// borrar lo viejo solo (caducan a los ~14 meses).

const TTL = 400 * 24 * 60 * 60;
const KEEP_MONTHS = 14;

const utcToday = () => new Date().toISOString().slice(0, 10);

const count = (max: number) => z.number().int().min(1).max(max);

/** Lo único que acepta el servidor: números por día, con pantallas y acciones de la lista. */
export const UsageUploadSchema = z.object({
  days: z.record(
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    z.strictObject({
      o: count(100).optional(),
      t: count(20000).optional(),
      p: z.partialRecord(z.enum(PAGE_IDS), count(2000)).optional(),
      a: z.partialRecord(z.enum(ACTION_IDS), count(1000)).optional(),
    }),
  ),
});

/** Suma los contadores de una persona. Los días fuera de lo razonable se ignoran. */
export async function recordUsage(uid: string, days: Record<string, UsageBatch>) {
  const today = utcToday();
  const oldest = addDays(today, -35); // alcanza para quien estuvo un tiempo sin conexión
  const newest = addDays(today, 1); // la hora local puede ir un día por delante de UTC
  const pipe = db().pipeline();
  const touched = new Set<string>();
  for (const [date, batch] of Object.entries(days)) {
    if (date < oldest || date > newest) continue;
    const key = keys.usage(uid, date.slice(0, 7));
    const dd = date.slice(8, 10);
    const bump = (field: string, n: number | undefined) => {
      if (!n) return;
      pipe.hincrby(key, `${dd}:${field}`, n);
      touched.add(key);
    };
    bump("o", batch.o);
    bump("t", batch.t);
    for (const [page, n] of Object.entries(batch.p ?? {})) bump(`p:${page}`, n);
    for (const [action, n] of Object.entries(batch.a ?? {})) bump(`a:${action}`, n);
  }
  if (touched.size === 0) return;
  for (const key of touched) pipe.expire(key, TTL);
  pipe.hset(keys.seen, { [uid]: Date.now() });
  await pipe.exec();
}

/** Borra todo el uso de una persona (al eliminar su cuenta). */
export async function deleteUsage(uid: string) {
  const now = new Date();
  const months = Array.from({ length: KEEP_MONTHS + 1 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    return keys.usage(uid, d.toISOString().slice(0, 7));
  });
  await db().del(...months);
  await db().hdel(keys.seen, uid);
}

const isPage = (v: string): v is PageId => v in PAGES;
const isAction = (v: string): v is ActionId => v in ACTIONS;
const asCount = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

/** Uso de cada persona entre `to - days + 1` y `to` (días en hora local de quien consulta). */
export async function readUsage(members: UserRecord[], to: string, days: number): Promise<UsageReport> {
  const dates = lastNDays(to, days);
  const months = [...new Set(dates.map((d) => d.slice(0, 7)))];

  const pipe = db().pipeline();
  for (const m of members) for (const month of months) pipe.hgetall(keys.usage(m.id, month));
  pipe.hgetall(keys.seen);
  const out = (await pipe.exec()) as (Record<string, unknown> | null)[];
  const seen = out[out.length - 1] ?? {};

  return {
    from: dates[0],
    to,
    members: members.map((m, i): UsageMemberReport => {
      const perDay = new Map<string, UsageDayStat>(
        dates.map((date) => [date, { date, opens: 0, taps: 0, views: 0, records: 0, ai: 0 }]),
      );
      const pages: UsageMemberReport["pages"] = {};
      const actions: UsageMemberReport["actions"] = {};
      months.forEach((month, j) => {
        const hash = out[i * months.length + j] ?? {};
        for (const [field, raw] of Object.entries(hash)) {
          const n = asCount(raw);
          const [dd, kind, name] = field.split(":");
          const day = perDay.get(`${month}-${dd}`);
          if (!day || !n) continue;
          if (kind === "o") day.opens += n;
          else if (kind === "t") day.taps += n;
          else if (kind === "p" && isPage(name)) {
            day.views += n;
            pages[name] = (pages[name] ?? 0) + n;
          } else if (kind === "a" && isAction(name)) {
            if (name === "ai") day.ai += n;
            if (RECORD_ACTIONS.includes(name)) day.records += n;
            actions[name] = (actions[name] ?? 0) + n;
          }
        }
      });
      const last = asCount(seen[m.id]);
      return {
        id: m.id,
        name: m.name,
        username: m.username,
        role: m.role,
        lastSeen: last || null,
        days: dates.map((d) => perDay.get(d)!),
        pages,
        actions,
      };
    }),
  };
}
