"use client";

import { TriangleAlert } from "lucide-react";
import { fmt, fmt1 } from "@/lib/format";
import { Swatch, cx } from "./ui";

/** Pista del medidor: un paso más claro del mismo color que el relleno. */
function track(color: string) {
  return `color-mix(in oklab, ${color} 18%, var(--card))`;
}

/**
 * Medidor circular de calorías. El número central (restantes) es la cifra principal
 * de la pantalla; al pasarse de la meta el relleno cambia al color de alerta.
 */
export function CalorieRing({
  goal,
  consumed,
  burned,
}: {
  goal: number;
  consumed: number;
  burned: number;
}) {
  const budget = goal + burned;
  const remaining = budget - consumed;
  const over = remaining < 0;
  const pct = budget > 0 ? Math.min(1, consumed / budget) : 0;

  const size = 196;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`Consumidas ${fmt(consumed)} de ${fmt(budget)} kcal disponibles`}
          className="-rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={track("var(--kcal)")}
            strokeWidth={stroke}
          />
          {pct > 0 ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={over ? "var(--danger)" : "var(--kcal)"}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${c * pct} ${c}`}
              className="transition-[stroke-dasharray] duration-500"
            />
          ) : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-5xl font-semibold tracking-tight">{fmt(Math.abs(remaining))}</span>
          <span
            className={cx(
              "mt-1 flex items-center gap-1 text-sm font-medium",
              over ? "text-danger-text" : "text-ink-2",
            )}
          >
            {over ? <TriangleAlert className="size-4" aria-hidden /> : null}
            {over ? "kcal de más" : "kcal restantes"}
          </span>
        </div>
      </div>

      <dl className="mt-4 grid w-full grid-cols-3 gap-2 text-center">
        <Stat label="Meta" value={fmt(goal)} />
        <Stat label="Comidas" value={fmt(consumed)} swatch="var(--kcal)" />
        <Stat label="Ejercicio" value={`${burned > 0 ? "+" : ""}${fmt(burned)}`} swatch="var(--burn)" />
      </dl>
      <p className="mt-2 text-xs text-muted">Restantes = meta − comidas + ejercicio</p>
    </div>
  );
}

/** Cifra con etiqueta para las filas de resumen (dentro de un <dl>). */
export function Stat({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <div className="rounded-2xl bg-field px-2 py-2.5">
      <dt className="flex items-center justify-center gap-1.5 text-xs text-ink-2">
        {swatch ? <Swatch color={swatch} /> : null}
        {label}
      </dt>
      <dd className="tabular mt-0.5 text-lg font-semibold">{value}</dd>
    </div>
  );
}

/** Barra de progreso horizontal (macros, agua). */
export function Meter({
  label,
  value,
  max,
  color,
  unit = "g",
  decimals = false,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  unit?: string;
  decimals?: boolean;
}) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const show = decimals ? fmt1 : fmt;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          <Swatch color={color} />
          {label}
        </span>
        <span className="tabular text-ink-2">
          <span className="font-semibold text-ink">{show(value)}</span> / {fmt(max)} {unit}
        </span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full"
        style={{ background: track(color) }}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.round(value)}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct * 100}%`, background: color }}
        />
      </div>
    </div>
  );
}

/** Barras horizontales de categorías sin orden propio: una sola serie, un solo color. */
export function BarList({
  rows,
  color,
  unit,
}: {
  rows: { label: string; value: number }[];
  color: string;
  /** Texto fijo o función del valor (para el singular: «1 vez», «2 veces»). */
  unit: string | ((value: number) => string);
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">{r.label}</span>
            <span className="tabular text-ink-2">
              <span className="font-semibold text-ink">{fmt(r.value)}</span> {typeof unit === "string" ? unit : unit(r.value)}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full" style={{ background: track(color) }} aria-hidden>
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Recuadro con una cifra (dentro de un <dl>). */
export function Kpi({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-3xl bg-card p-3 ring-1 ring-border">
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="mt-1 text-xl font-semibold">{value}</dd>
      <dd className="text-[11px] text-muted">{unit}</dd>
    </div>
  );
}
