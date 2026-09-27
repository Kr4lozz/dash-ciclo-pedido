"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { CaloriesChart, CaloriesLegend, WeightChart } from "@/components/Charts";
import { Button, Card, NumberInput, PageHeader, Segmented } from "@/components/ui";
import { lastNDays, longDate, todayStr } from "@/lib/dates";
import { fmt, fmt1, parseNum } from "@/lib/format";
import { computeTargets } from "@/lib/nutrition";
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
    const byDate = new Map(dates.map((d) => [d, { date: d, consumed: 0, burned: 0, logged: false }]));
    for (const f of data.foods) {
      const d = byDate.get(f.date);
      if (d) {
        d.consumed += f.calories;
        d.logged = true;
      }
    }
    for (const e of data.exercises) {
      const d = byDate.get(e.date);
      if (d) d.burned += e.calories;
    }
    return [...byDate.values()];
  }, [data.foods, data.exercises, range, today]);

  const logged = days.filter((d) => d.logged);
  const avg = (vals: number[]) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);
  const avgConsumed = avg(logged.map((d) => d.consumed));
  const avgBurned = avg(days.map((d) => d.burned));
  const onTarget = logged.filter((d) => d.consumed <= targets.calories + d.burned).length;

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

        <dl className="grid grid-cols-3 gap-2">
          <Kpi label="Consumo medio" value={logged.length ? fmt(avgConsumed) : "—"} unit="kcal/día" />
          <Kpi label="Ejercicio medio" value={fmt(avgBurned)} unit="kcal/día" />
          <Kpi label="Días en meta" value={`${onTarget}/${logged.length}`} unit="registrados" />
        </dl>

        <Card className="space-y-3">
          <div>
            <h2 className="font-semibold">Calorías por día</h2>
            <p className="text-xs text-muted">Meta actual: {fmt(targets.calories)} kcal</p>
          </div>
          <CaloriesLegend />
          <CaloriesChart days={days} goal={targets.calories} />
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-accent-text">Ver tabla</summary>
            <table className="tabular mt-2 w-full text-left">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-1 font-medium">Día</th>
                  <th className="py-1 text-right font-medium">Consumidas</th>
                  <th className="py-1 text-right font-medium">Quemadas</th>
                  <th className="py-1 text-right font-medium">Neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...days].reverse().map((d) => (
                  <tr key={d.date}>
                    <td className="py-1.5">{longDate(d.date)}</td>
                    <td className="py-1.5 text-right">{fmt(d.consumed)}</td>
                    <td className="py-1.5 text-right">{fmt(d.burned)}</td>
                    <td className="py-1.5 text-right">{fmt(d.consumed - d.burned)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
