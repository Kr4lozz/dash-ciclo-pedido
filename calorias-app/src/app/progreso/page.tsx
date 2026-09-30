"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { CaloriesChart, CaloriesLegend, WeightChart } from "@/components/Charts";
import { Button, Card, NumberInput, PageHeader, Segmented, Swatch } from "@/components/ui";
import { lastNDays, longDate, shortDate, todayStr } from "@/lib/dates";
import { fmt, fmt1, parseNum } from "@/lib/format";
import { KCAL_PER_KG, computeTargets, dayBalance } from "@/lib/nutrition";
import { deleteWeight, logWeight, useAppData } from "@/lib/store";
import { toast } from "@/lib/toast";

type Range = "7" | "30";

export default function ProgresoPage() {
  const data = useAppData();
  const [range, setRange] = useState<Range>("7");
  const targets = useMemo(() => computeTargets(data.profile), [data.profile]);
  const today = todayStr();

  const days = useMemo(() => {
    const dates = lastNDays(today, Number(range));
    return dates.map((date) => {
      const foods = data.foods.filter((f) => f.date === date);
      const consumed = foods.reduce((a, f) => a + f.calories, 0);
      const exercises = data.exercises.filter((e) => e.date === date);
      const burn = data.burned[date];
      const balance = dayBalance(targets, burn, exercises, consumed);
      const logged = foods.length > 0;
      return {
        date,
        consumed,
        /** Actividad del día: lo que suma a la meta («Días en meta») */
        activity: balance.active,
        /** Gasto total: solo hay algo que mostrar si ese día se registró algo */
        burned: logged || burn ? balance.spent : null,
        estimated: balance.source !== "reloj",
        /** Solo cuentan los días con comidas: sin ellas el «déficit» sería el gasto entero */
        deficit: logged ? balance.deficit : null,
        logged,
      };
    });
  }, [data.foods, data.exercises, data.burned, targets, range, today]);

  const logged = days.filter((d) => d.logged);
  const counted = days.filter((d) => d.deficit !== null);
  const avg = (vals: number[]) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);
  const sum = (vals: number[]) => vals.reduce((a, b) => a + b, 0);
  const avgConsumed = avg(logged.map((d) => d.consumed));
  const avgBurned = avg(counted.map((d) => d.burned ?? 0));
  const totalDeficit = sum(counted.map((d) => d.deficit ?? 0));
  const avgDeficit = avg(counted.map((d) => d.deficit ?? 0));
  const onTarget = logged.filter((d) => d.consumed <= targets.calories + d.activity).length;

  // Acumulado día a día (en orden cronológico) para la tabla.
  const rows = days.map((d, i) => ({
    ...d,
    cumulative: d.deficit === null ? null : sum(days.slice(0, i + 1).map((x) => x.deficit ?? 0)),
  }));

  return (
    <>
      <PageHeader title="Progreso" back={null} />
      <main className="space-y-4 px-4">
        <Segmented
          label="Periodo"
          value={range}
          onChange={setRange}
          options={[
            { id: "7", label: "7 días" },
            { id: "30", label: "30 días" },
          ]}
        />

        <dl className="grid grid-cols-2 gap-2">
          <div className="col-span-2 rounded-3xl bg-card p-4 ring-1 ring-border">
            <dt className="flex items-center gap-1.5 text-xs text-ink-2">
              <Swatch color="var(--deficit)" />
              {totalDeficit < 0 ? "Superávit acumulado" : "Déficit acumulado"} · {range} días
            </dt>
            <dd className="mt-1 text-4xl font-semibold tracking-tight">
              {counted.length ? fmt(Math.abs(totalDeficit)) : "—"}
              {counted.length ? <span className="ml-1.5 text-base font-medium text-ink-2">kcal</span> : null}
            </dd>
            <dd className="mt-0.5 text-xs text-muted">
              {counted.length
                ? `≈ ${fmt1(Math.abs(totalDeficit) / KCAL_PER_KG)} kg de grasa ${totalDeficit < 0 ? "de más" : "menos"} · ${counted.length} ${counted.length === 1 ? "día" : "días"} con comidas`
                : "Registra comidas y tu gasto (Apple Fitness) para verlo"}
            </dd>
          </div>
          <Kpi label="Consumo medio" value={logged.length ? fmt(avgConsumed) : "—"} unit="kcal/día" />
          <Kpi label="Quemado medio" value={counted.length ? fmt(avgBurned) : "—"} unit="kcal/día (gasto total)" />
          <Kpi
            label={avgDeficit < 0 ? "Superávit medio" : "Déficit medio"}
            value={counted.length ? fmt(Math.abs(avgDeficit)) : "—"}
            unit="kcal/día (quemado − consumo)"
          />
          <Kpi label="Días en meta" value={`${onTarget}/${logged.length}`} unit="días registrados" />
        </dl>

        <Card className="space-y-3">
          <div>
            <h2 className="font-semibold">Calorías por día</h2>
            <p className="text-xs text-muted">
              Quemadas = gasto total del día (Apple Fitness o estimado con tu perfil). Meta actual:{" "}
              {fmt(targets.calories)} kcal.
            </p>
          </div>
          <CaloriesLegend />
          <CaloriesChart days={days} goal={targets.calories} />
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-accent-text">Ver tabla</summary>
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="tabular mt-2 w-full min-w-[18.5rem] text-left text-[13px]">
                <thead className="text-[11px] text-muted">
                  <tr>
                    <th className="py-1 font-medium">Día</th>
                    <th className="py-1 pl-2 text-right font-medium">Consumidas</th>
                    <th className="py-1 pl-2 text-right font-medium">Quemadas</th>
                    <th className="py-1 pl-2 text-right font-medium">Déficit</th>
                    <th className="py-1 pl-2 text-right font-medium">Acumulado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[...rows].reverse().map((d) => (
                    <tr key={d.date}>
                      <td className="whitespace-nowrap py-1.5">{shortDate(d.date)}</td>
                      <td className="py-1.5 pl-2 text-right">{fmt(d.consumed)}</td>
                      <td className="py-1.5 pl-2 text-right">{d.burned === null ? "—" : fmt(d.burned)}</td>
                      <td className="py-1.5 pl-2 text-right font-semibold">{d.deficit === null ? "—" : fmt(d.deficit)}</td>
                      <td className="py-1.5 pl-2 text-right">{d.cumulative === null ? "—" : fmt(d.cumulative)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted">
              Déficit = quemadas − consumidas (negativo = superávit). Solo cuentan los días con comidas
              registradas. El gasto de los días sin Apple Fitness se estima con tu perfil. Como referencia,
              {" "}
              {fmt(KCAL_PER_KG)} kcal ≈ 1 kg de grasa; el peso real también varía por el agua y otros factores.
            </p>
          </details>
        </Card>

        <WeightCard />
      </main>
    </>
  );
}

function Kpi({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-3xl bg-card p-3 ring-1 ring-border">
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="mt-1 text-xl font-semibold">{value}</dd>
      <dd className="text-[11px] text-muted">{unit}</dd>
    </div>
  );
}

function WeightCard() {
  const data = useAppData();
  const today = todayStr();
  const weights = data.weights;
  const [value, setValue] = useState("");
  const kg = parseNum(value);
  const valid = kg >= 20 && kg <= 400;

  const first = weights[0];
  const last = weights[weights.length - 1];
  const change = first && last ? last.kg - first.kg : 0;

  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Peso</h2>
        {weights.length > 1 ? (
          <p className="text-sm text-ink-2">
            {change <= 0 ? "▼" : "▲"} {fmt1(Math.abs(change))} kg desde {longDate(first.date)}
          </p>
        ) : null}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          logWeight(today, kg);
          setValue("");
          toast(`Peso de hoy: ${fmt1(kg)} kg`);
        }}
      >
        <NumberInput
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={last ? `${fmt1(last.kg)} kg` : "Tu peso de hoy (kg)"}
          aria-label="Peso de hoy en kg"
        />
        <Button type="submit" disabled={!valid} className="shrink-0">
          Registrar
        </Button>
      </form>

      {weights.length > 0 ? (
        <>
          <WeightChart points={weights} />
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-accent-text">Ver registros</summary>
            <ul className="mt-2 divide-y divide-border">
              {[...weights].reverse().map((w) => (
                <li key={w.date} className="flex items-center gap-2 py-1.5">
                  <span className="flex-1">{longDate(w.date)}</span>
                  <span className="tabular font-semibold">{fmt1(w.kg)} kg</span>
                  <button
                    type="button"
                    aria-label={`Borrar peso del ${longDate(w.date)}`}
                    onClick={() => deleteWeight(w.date)}
                    className="grid size-8 place-items-center rounded-full text-muted hover:bg-field hover:text-danger-text"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : (
        <p className="text-sm text-muted">Registra tu peso para ver tu evolución.</p>
      )}
    </Card>
  );
}
