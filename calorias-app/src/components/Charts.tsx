"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { longDate, shortDate, weekdayInitial } from "@/lib/dates";
import { fmt, fmt1 } from "@/lib/format";

/** Ancho real del contenedor para dibujar el SVG a escala 1:1 (texto nítido). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceStep(range: number, target = 4) {
  const raw = Math.max(range, 1e-9) / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * mag;
}

/** Columna con 4 px redondeados arriba y base recta. */
function barPath(x: number, y: number, w: number, h: number) {
  if (h <= 0 || w <= 0) return "";
  const r = Math.min(4, w / 2, h);
  const b = y + h;
  return `M${x},${b}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${b}Z`;
}

function LineKey({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <svg width="14" height="4" aria-hidden className="shrink-0">
      <line
        x1="0"
        y1="2"
        x2="14"
        y2="2"
        stroke={color}
        strokeWidth="2"
        strokeDasharray={dashed ? "3 2" : undefined}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------

export interface DayPoint {
  date: string;
  consumed: number;
  burned: number;
}

const PLOT_H = 170;
const AXIS_H = 26;

/** Calorías consumidas y quemadas por día (columnas agrupadas) con la meta como umbral. */
export function CaloriesChart({ days, goal }: { days: DayPoint[]; goal: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const left = 40;
  const right = 6;
  const top = 8;
  const plotW = Math.max(0, width - left - right);
  const maxVal = Math.max(goal, ...days.map((d) => Math.max(d.consumed, d.burned)));
  const step = niceStep(maxVal * 1.1);
  const yMax = Math.max(step, Math.ceil((maxVal * 1.08) / step) * step);
  const y = (v: number) => top + PLOT_H - (v / yMax) * PLOT_H;
  const ticks = Array.from({ length: Math.floor(yMax / step) + 1 }, (_, i) => i * step);

  const band = days.length ? plotW / days.length : 0;
  const gap = 2;
  const barW = Math.max(2, Math.min(24, (band - 6 - gap) / 2));
  const groupW = barW * 2 + gap;
  const dense = days.length > 10;

  const tip = active !== null ? days[active] : null;
  const tipX = active !== null ? left + band * active + band / 2 : 0;

  return (
    <div ref={ref} className="relative select-none" onPointerLeave={() => setActive(null)}>
      {width > 0 ? (
        <svg
          width={width}
          height={top + PLOT_H + AXIS_H}
          role="img"
          aria-label="Calorías consumidas y quemadas por día"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={left} x2={width - right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--baseline)" : "var(--grid)"} strokeWidth="1" />
              <text x={left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="tabular fill-muted text-[10px]">
                {fmt(t)}
              </text>
            </g>
          ))}

          {days.map((d, i) => {
            const x0 = left + band * i;
            const gx = x0 + (band - groupW) / 2;
            return (
              <g key={d.date}>
                {active === i ? (
                  <rect x={x0 + 1} y={top} width={band - 2} height={PLOT_H} rx="6" fill="var(--field)" />
                ) : null}
                <path d={barPath(gx, y(d.consumed), barW, y(0) - y(d.consumed))} fill="var(--kcal)" />
                <path d={barPath(gx + barW + gap, y(d.burned), barW, y(0) - y(d.burned))} fill="var(--burn)" />
                {!dense || i % 5 === days.length % 5 || i === days.length - 1 ? (
                  <text
                    x={x0 + band / 2}
                    y={top + PLOT_H + 16}
                    textAnchor="middle"
                    className="fill-muted text-[10px]"
                  >
                    {dense ? shortDate(d.date).split(" ")[0] : `${weekdayInitial(d.date)} ${shortDate(d.date).split(" ")[0]}`}
                  </text>
                ) : null}
                <rect
                  x={x0}
                  y={top}
                  width={band}
                  height={PLOT_H + AXIS_H}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${longDate(d.date)}: ${fmt(d.consumed)} kcal consumidas, ${fmt(d.burned)} quemadas`}
                  onPointerEnter={() => setActive(i)}
                  onPointerDown={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="outline-none"
                />
              </g>
            );
          })}

          {goal > 0 ? (
            <line
              x1={left}
              x2={width - right}
              y1={y(goal)}
              y2={y(goal)}
              stroke="var(--ink-2)"
              strokeWidth="1"
              strokeDasharray="4 3"
              pointerEvents="none"
            />
          ) : null}
        </svg>
      ) : (
        <div style={{ height: top + PLOT_H + AXIS_H }} />
      )}

      {tip ? (
        <div
          className="pointer-events-none absolute top-0 z-10 w-52 -translate-x-1/2 rounded-2xl bg-card p-2.5 text-xs shadow-lg ring-1 ring-border"
          style={{ left: Math.min(Math.max(tipX, 104), width - 104) }}
        >
          <p className="mb-1 font-semibold text-ink">{longDate(tip.date)}</p>
          <TipRow color="var(--kcal)" label="Consumidas" value={`${fmt(tip.consumed)} kcal`} />
          <TipRow color="var(--burn)" label="Quemadas" value={`${fmt(tip.burned)} kcal`} />
          <TipRow color="var(--ink-2)" dashed label="Meta" value={`${fmt(goal)} kcal`} />
        </div>
      ) : null}
    </div>
  );
}

function TipRow({ color, label, value, dashed }: { color: string; label: string; value: string; dashed?: boolean }) {
  return (
    <p className="flex items-center gap-1.5 py-0.5">
      <LineKey color={color} dashed={dashed} />
      <span className="flex-1 text-ink-2">{label}</span>
      <span className="tabular whitespace-nowrap font-semibold text-ink">{value}</span>
    </p>
  );
}

export function CaloriesLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-sm bg-kcal" /> Consumidas
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-sm bg-burn" /> Quemadas
      </span>
      <span className="flex items-center gap-1.5">
        <LineKey color="var(--ink-2)" dashed /> Meta
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------

export interface WeightPoint {
  date: string;
  kg: number;
}

/** Evolución del peso: línea de 2 px, punto final etiquetado y cursor que busca la fecha. */
export function WeightChart({ points }: { points: WeightPoint[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const left = 36;
  const right = 56;
  const top = 12;
  const plotW = Math.max(0, width - left - right);
  const kgs = points.map((p) => p.kg);
  const lo = Math.min(...kgs);
  const hi = Math.max(...kgs);
  const step = niceStep(Math.max(hi - lo, 2), 3);
  const yMin = Math.floor((lo - step * 0.25) / step) * step;
  const yMax = Math.ceil((hi + step * 0.25) / step) * step;
  const y = (v: number) => top + PLOT_H - ((v - yMin) / (yMax - yMin)) * PLOT_H;
  const ticks: number[] = [];
  for (let t = yMin; t <= yMax + 1e-9; t += step) ticks.push(Math.round(t * 10) / 10);

  const t0 = new Date(points[0].date).getTime();
  const span = new Date(points[points.length - 1].date).getTime() - t0;
  const x = (i: number) =>
    points.length === 1 ? left + plotW / 2 : left + ((new Date(points[i].date).getTime() - t0) / span) * plotW;

  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.kg)}`).join("");
  const last = points.length - 1;
  const shown = active ?? last;

  function nearest(clientX: number, rect: DOMRect) {
    const px = clientX - rect.left;
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    }
    setActive(best);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "ArrowLeft") setActive(Math.max(0, (active ?? last) - 1));
    if (e.key === "ArrowRight") setActive(Math.min(last, (active ?? last) + 1));
  }

  return (
    <div ref={ref} className="relative select-none">
      {width > 0 ? (
        <svg
          width={width}
          height={top + PLOT_H + AXIS_H}
          role="img"
          aria-label="Evolución del peso"
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
          onPointerMove={(e) => nearest(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerDown={(e) => nearest(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setActive(null)}
          className="outline-none"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={left} x2={width - right} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth="1" />
              <text x={left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="tabular fill-muted text-[10px]">
                {fmt1(t)}
              </text>
            </g>
          ))}
          <text x={left} y={top + PLOT_H + 16} className="fill-muted text-[10px]">
            {shortDate(points[0].date)}
          </text>
          {points.length > 1 ? (
            <text x={width - right} y={top + PLOT_H + 16} textAnchor="end" className="fill-muted text-[10px]">
              {shortDate(points[last].date)}
            </text>
          ) : null}

          {active !== null ? (
            <line x1={x(active)} x2={x(active)} y1={top} y2={top + PLOT_H} stroke="var(--baseline)" strokeWidth="1" />
          ) : null}
          <path d={path} fill="none" stroke="var(--water)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(shown)} cy={y(points[shown].kg)} r="4" fill="var(--water)" stroke="var(--card)" strokeWidth="2" />
          <text x={x(last) + 8} y={y(points[last].kg)} dy="0.32em" className="fill-ink text-xs font-semibold">
            {fmt1(points[last].kg)} kg
          </text>
        </svg>
      ) : (
        <div style={{ height: top + PLOT_H + AXIS_H }} />
      )}
      {active !== null && width > 0 ? (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl bg-card px-2.5 py-1.5 text-xs shadow-lg ring-1 ring-border"
          style={{ left: Math.min(Math.max(x(active), 60), width - 60) }}
        >
          <span className="font-semibold text-ink">{fmt1(points[active].kg)} kg</span>{" "}
          <span className="text-ink-2">· {shortDate(points[active].date)}</span>
        </div>
      ) : null}
    </div>
  );
}
