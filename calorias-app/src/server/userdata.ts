import type { DataPut, DayDoc, ServerData } from "@/lib/schemas";
import { db, keys } from "./kv";

// Datos de cada persona: perfil, pesos, rutinas de gym y un documento por día (comidas,
// ejercicio, agua y entrenamientos). Guardar por día mantiene cada escritura pequeña aunque
// se acumulen años de registros.

export async function readData(uid: string): Promise<ServerData> {
  const r = db();
  const [profile, weights, days, gym] = await Promise.all([
    r.get<ServerData["profile"]>(keys.profile(uid)),
    r.get<ServerData["weights"]>(keys.weights(uid)),
    r.hgetall<Record<string, DayDoc>>(keys.days(uid)),
    r.get<ServerData["gym"]>(keys.gym(uid)),
  ]);
  return { profile: profile ?? null, weights: weights ?? [], days: days ?? {}, gym: gym ?? null };
}

const isEmpty = (d: DayDoc) =>
  d.foods.length === 0 &&
  d.exercises.length === 0 &&
  d.water === 0 &&
  d.burned?.total == null &&
  d.burned?.active == null &&
  (d.workouts?.length ?? 0) === 0;

export async function writeData(uid: string, put: DataPut) {
  const r = db();
  if (put.replace) await deleteData(uid);

  if (put.profile === null) await r.del(keys.profile(uid));
  else if (put.profile) await r.set(keys.profile(uid), put.profile);

  if (put.weights) await r.set(keys.weights(uid), put.weights);
  if (put.gym) await r.set(keys.gym(uid), put.gym);

  if (put.days) {
    const toSet: [string, DayDoc][] = [];
    const toDelete: string[] = [];
    for (const [date, doc] of Object.entries(put.days)) {
      if (!doc || isEmpty(doc)) toDelete.push(date);
      else toSet.push([date, doc]);
    }
    // En tandas para que ninguna solicitud a la base sea demasiado grande.
    for (let i = 0; i < toSet.length; i += 60) {
      await r.hset(keys.days(uid), Object.fromEntries(toSet.slice(i, i + 60)));
    }
    if (toDelete.length > 0) await r.hdel(keys.days(uid), ...toDelete);
  }
}

export async function deleteData(uid: string) {
  await db().del(keys.profile(uid), keys.weights(uid), keys.days(uid), keys.gym(uid));
}
