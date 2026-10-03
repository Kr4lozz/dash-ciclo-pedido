"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Dumbbell, Trophy } from "lucide-react";
import { longDate, shortDate } from "@/lib/dates";
import { fmt, fmt1 } from "@/lib/format";
import {
  exerciseHistory,
  exercisesDone,
  fmtKg,
  fmtMinutes,
  muscleSets,
  periodTotals,
  personalRecords,
  type PersonalRecord,
} from "@/lib/gym";
import { muscleLabel, type Workout } from "@/lib/types";
import { VolumeChart, WeightChart } from "./Charts";
import { BarList, Kpi } from "./Meters";
import { Card, Segmented, Swatch, buttonClass } from "./ui";

/** Récords que se ven antes de «Ver todos». */
const RECORDS_SHOWN = 6;

/** Resumen del entrenamiento para Progreso: recuadros, volumen por día, músculos, récords y evolución. */
export function GymProgress({ workouts, dates }: { workouts: Workout[]; dates: string[] }) {
  const first = dates[0];
  const last = dates[dates.length - 1];
  const inRange = useMemo(() => workouts.filter((w) => w.date >= first && w.date <= last), [workouts, first, last]);
  const totals = useMemo(() => periodTotals(workouts, dates), [workouts, dates]);
  const muscles = useMemo(() => muscleSets(inRange), [inRange]);
  const records = useMemo(
    () =>
      personalRecords(workouts, first).sort(
        (a, b) => Number(b.isNew) - Number(a.isNew) || b.date.localeCompare(a.date) || a.name.localeCompare(b.name),
      ),
    [workouts, first],
  );

  if (workouts.length === 0) {
    return (
      <Card className="space-y-3 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-accent-soft text-accent-text">
          <Dumbbell className="size-6" />
        </div>
        <p className="font-semibold">Aún no registras entrenamientos</p>
        <p className="text-sm text-ink-2">
          Crea una rutina o entrena libre en Gym y anota el peso de cada serie: aquí verás tu volumen, tus
          récords y la evolución de cada ejercicio.
        </p>
        <Link href="/gym" className={buttonClass("primary", "w-full")}>
          Ir a Gym
        </Link>
      </Card>
    );
  }

  const days = dates.length;
  return (
    <>
      <dl className="grid grid-cols-2 gap-2">
        <div className="col-span-2 rounded-3xl bg-card p-4 ring-1 ring-border">
          <dt className="flex items-center gap-1.5 text-xs text-ink-2">
            <Swatch color="var(--gym)" />
            Entrenamientos · {days} días
          </dt>
          <dd className="mt-1 text-4xl font-semibold tracking-tight">{totals.sessions}</dd>
          <dd className="mt-0.5 text-xs text-muted">
            {totals.sessions > 0
              ? `En ${totals.daysTrained} de ${days} días`
              : `Sin entrenamientos en estos ${days} días`}
          </dd>
        </div>
        <Kpi label="Volumen total" value={totals.sessions ? fmt(totals.volume) : "—"} unit="kg movidos" />
        <Kpi
          label="Series"
          value={totals.sessions ? fmt(totals.sets) : "—"}
          unit={totals.sessions ? `${fmt(totals.reps)} repeticiones` : "repeticiones"}
        />
        <Kpi
          label="Tiempo"
          value={totals.minutes > 0 ? fmtMinutes(totals.minutes) : "—"}
          unit={totals.cardioSeconds > 0 ? `+ cardio ${fmtMinutes(totals.cardioSeconds / 60)}` : "entrenando"}
        />
        <Kpi
          label="Volumen medio"
          value={totals.sessions && totals.volume > 0 ? fmt(totals.volume / totals.sessions) : "—"}
          unit="kg por entrenamiento"
        />
      </dl>

      {totals.sessions > 0 ? (
        <Card className="space-y-3">
          <div>
            <h2 className="font-semibold">Volumen por día</h2>
            <p className="text-xs text-muted">Series × repeticiones × peso, en kg.</p>
          </div>
          <VolumeChart days={totals.perDay} />
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-accent-text">Ver tabla</summary>
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="tabular mt-2 w-full min-w-[17rem] text-left text-[13px]">
                <thead className="text-[11px] text-muted">
                  <tr>
                    <th className="py-1 font-medium">Día</th>
                    <th className="py-1 pl-2 text-right font-medium">Entrenos</th>
                    <th className="py-1 pl-2 text-right font-medium">Series</th>
                    <th className="py-1 pl-2 text-right font-medium">Volumen</th>
                    <th className="py-1 pl-2 text-right font-medium">Min</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[...totals.perDay]
                    .filter((d) => d.sessions > 0)
                    .reverse()
                    .map((d) => (
                      <tr key={d.date}>
                        <td className="whitespace-nowrap py-1.5">{shortDate(d.date)}</td>
                        <td className="py-1.5 pl-2 text-right">{d.sessions}</td>
                        <td className="py-1.5 pl-2 text-right">{d.sets}</td>
                        <td className="py-1.5 pl-2 text-right font-semibold">{fmt(d.volume)}</td>
                        <td className="py-1.5 pl-2 text-right">{d.minutes > 0 ? fmt(d.minutes) : "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </details>
        </Card>
      ) : null}

      {muscles.length > 0 ? (
        <Card className="space-y-3">
          <div>
            <h2 className="font-semibold">Series por grupo muscular</h2>
            <p className="text-xs text-muted">Cuánto trabajó cada zona en estos {days} días.</p>
          </div>
          <BarList
            rows={muscles.map((m) => ({ label: muscleLabel(m.muscle), value: m.sets }))}
            color="var(--gym)"
            unit="series"
          />
        </Card>
      ) : null}

      {records.length > 0 ? (
        <Card className="space-y-2">
          <div>
            <h2 className="font-semibold">Récords personales</h2>
            <p className="text-xs text-muted">La mejor serie de cada ejercicio. «Nuevo» = lo lograste en estos {days} días.</p>
          </div>
          <ul className="divide-y divide-border">
            {records.slice(0, RECORDS_SHOWN).map((r) => (
              <RecordRow key={r.exerciseId} r={r} />
            ))}
          </ul>
          {records.length > RECORDS_SHOWN ? (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-accent-text">
                Ver los otros {records.length - RECORDS_SHOWN}
              </summary>
              <ul className="divide-y divide-border">
                {records.slice(RECORDS_SHOWN).map((r) => (
                  <RecordRow key={r.exerciseId} r={r} />
                ))}
              </ul>
            </details>
          ) : null}
          <p className="text-[11px] text-muted">
            1RM = el peso máximo estimado para una repetición (fórmula de Epley, hasta 12 repeticiones).
          </p>
        </Card>
      ) : null}

      <Evolution workouts={workouts} />
    </>
  );
}

function RecordRow({ r }: { r: PersonalRecord }) {
  const set =
    r.mode === "corporal"
      ? `${r.reps} reps${r.kg > 0 ? ` · +${fmtKg(r.kg)} kg` : ""}`
      : `${fmtKg(r.kg)} kg × ${r.reps}`;
  return (
    <li className="flex items-center gap-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{r.name}</p>
        <p className="text-xs text-muted">
          {muscleLabel(r.muscle)} · {longDate(r.date)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="tabular font-semibold">{set}</p>
        {r.e1rm > 0 && r.mode !== "corporal" ? (
          <p className="tabular text-xs text-muted">1RM ≈ {fmt1(r.e1rm)} kg</p>
        ) : null}
      </div>
      {r.isNew ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-text">
          <Trophy className="size-3" aria-hidden /> Nuevo
        </span>
      ) : null}
    </li>
  );
}

/** Evolución de un ejercicio a lo largo de todo el historial (no solo del periodo elegido). */
function Evolution({ workouts }: { workouts: Workout[] }) {
  const done = useMemo(() => exercisesDone(workouts), [workouts]);
  const [pick, setPick] = useState<string | null>(null);
  const [metric, setMetric] = useState<"kg" | "e1rm">("kg");
  const selected = done.find((d) => d.exerciseId === pick) ?? done[0];
  const history = useMemo(
    () => (selected ? exerciseHistory(workouts, selected.exerciseId) : []),
    [workouts, selected],
  );
  if (!selected) return null;

  const corporal = selected.mode === "corporal";
  const unit = corporal ? "reps" : "kg";
  const points = history
    .map((p) => ({ date: p.date, kg: corporal ? p.reps : metric === "kg" ? p.kg : Math.round(p.e1rm * 10) / 10 }))
    .filter((p) => p.kg > 0);
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const diff = firstPoint && lastPoint ? lastPoint.kg - firstPoint.kg : 0;

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">Evolución por ejercicio</h2>
        <p className="text-xs text-muted">Todo tu historial, no solo estos días.</p>
      </div>
      <select
        value={selected.exerciseId}
        onChange={(e) => setPick(e.target.value)}
        aria-label="Ejercicio"
        className="w-full rounded-2xl bg-field px-3.5 py-2.5 text-base ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-accent"
      >
        {done.map((d) => (
          <option key={d.exerciseId} value={d.exerciseId}>
            {d.name} · {d.sessions} {d.sessions === 1 ? "vez" : "veces"}
          </option>
        ))}
      </select>
      {corporal ? null : (
        <Segmented
          label="Qué medir"
          value={metric}
          onChange={setMetric}
          options={[
            { id: "kg", label: "Peso máximo" },
            { id: "e1rm", label: "1RM estimado" },
          ]}
        />
      )}
      {points.length >= 2 ? (
        <>
          <WeightChart
            points={points}
            color="var(--gym)"
            unit={unit}
            label={`Evolución de ${selected.name}`}
          />
          <p className="text-sm text-ink-2">
            {fmt1(firstPoint.kg)} → {fmt1(lastPoint.kg)} {unit}{" "}
            <span className="font-semibold text-ink">
              ({diff >= 0 ? "+" : "−"}
              {fmt1(Math.abs(diff))} {unit})
            </span>{" "}
            desde el {shortDate(firstPoint.date)}
          </p>
        </>
      ) : (
        <p className="rounded-2xl bg-field p-3 text-sm text-ink-2">
          {points.length === 1
            ? `Solo hay un registro (${fmt1(points[0].kg)} ${unit} el ${shortDate(points[0].date)}). Haz este ejercicio otra vez para ver cómo evoluciona.`
            : "Todavía no hay series con datos para este ejercicio."}
        </p>
      )}
    </Card>
  );
}
