"use client";

import { useEffect, useState } from "react";
import { Activity, LoaderCircle } from "lucide-react";
import { accountApi } from "@/lib/api";
import { addDays, longDate, parseDateStr, shortDate, todayStr, toDateStr, weekdayInitial } from "@/lib/dates";
import { fmt } from "@/lib/format";
import {
  ACTIONS,
  PAGES,
  isActiveDay,
  type ActionId,
  type PageId,
  type UsageDayStat,
  type UsageMemberReport,
  type UsageReport,
} from "@/lib/usage-shared";
import { BarList } from "./Meters";
import { Button, Card, Segmented } from "./ui";

type Result = { days: number; report: UsageReport } | { days: number; error: string };

/** Toques por día desde los que empieza cada paso del color (el primero también cubre «solo abrió la app»). */
const LEVELS = [1, 30, 100, 250];
const LEVEL_LABELS = ["0", "1–29", "30–99", "100–249", "250 o más"];
/** % del color de acento mezclado con el fondo de la tarjeta: una sola tonalidad, de menos a más. */
const LEVEL_MIX = [0, 30, 55, 78, 100];

const cellColor = (level: number) =>
  level === 0 ? "var(--field)" : `color-mix(in oklab, var(--accent) ${LEVEL_MIX[level]}%, var(--card))`;

function level(d: UsageDayStat): number {
  if (!isActiveDay(d)) return 0;
  return LEVELS.filter((t) => d.taps >= t).length || 1;
}

const viewsUnit = (n: number) => (n === 1 ? "vista" : "vistas");
const timesUnit = (n: number) => (n === 1 ? "vez" : "veces");

const timeFmt = new Intl.DateTimeFormat("es", { hour: "numeric", minute: "2-digit" });

/** «Hoy, 14:32», «Ayer, 20:10» o «Hace 4 días · mié, 2 oct». `today` es el día de quien consulta. */
function lastSeenLabel(ms: number | null, today: string): string {
  if (!ms) return "sin actividad registrada";
  const at = new Date(ms);
  const date = toDateStr(at);
  const time = timeFmt.format(at);
  if (date >= today) return `Hoy, ${time}`;
  if (date === addDays(today, -1)) return `Ayer, ${time}`;
  const ago = Math.round((parseDateStr(today).getTime() - parseDateStr(date).getTime()) / 86_400_000);
  return `Hace ${ago} días · ${longDate(date)}`;
}

/** Uso de la app de cada miembro (solo quien administra): contadores, nunca contenido. */
export function FamilyUsage({ selfId, refreshKey }: { selfId: string; refreshKey: number }) {
  const [days, setDays] = useState<"7" | "30">("7");
  const [result, setResult] = useState<Result | null>(null);
  const [retry, setRetry] = useState(0);
  const span = Number(days);

  useEffect(() => {
    let active = true;
    accountApi.usage(span, todayStr()).then(
      (report) => {
        if (active) setResult({ days: span, report });
      },
      (e: Error) => {
        if (active) setResult({ days: span, error: e.message });
      },
    );
    return () => {
      active = false;
    };
  }, [span, refreshKey, retry]);

  const current = result && result.days === span ? result : null;

  return (
    <>
      <Card className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Activity className="size-5" /> Uso de la app
        </h2>
        <p className="text-sm text-ink-2">
          Cuánto usa cada quien la app. Solo se cuentan números (aperturas, toques, pantallas y
          registros), nunca lo que anotan ni sus fotos. Los toques son aproximados y la cuenta empieza
          desde que se activó esta función.
        </p>
        <Segmented
          label="Periodo"
          value={days}
          onChange={setDays}
          options={[
            { id: "7", label: "7 días" },
            { id: "30", label: "30 días" },
          ]}
        />
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted"
          role="group"
          aria-label="Escala de toques por día"
        >
          <span>Toques por día:</span>
          {LEVEL_LABELS.map((label, i) => (
            <span key={label} className="inline-flex items-center gap-1">
              <span className="size-3 rounded-[4px] ring-1 ring-border" style={{ background: cellColor(i) }} aria-hidden />
              {label}
            </span>
          ))}
        </div>
      </Card>

      {!current ? (
        <Card className="flex justify-center py-6">
          <LoaderCircle className="size-5 animate-spin text-muted" aria-label="Cargando" />
        </Card>
      ) : "error" in current ? (
        <Card className="space-y-3 text-center">
          <p className="text-sm text-danger-text">{current.error}</p>
          <Button variant="secondary" onClick={() => setRetry((n) => n + 1)}>
            Reintentar
          </Button>
        </Card>
      ) : (
        current.report.members.map((m) => (
          <MemberUsage key={m.id} m={m} selfId={selfId} today={current.report.to} />
        ))
      )}
    </>
  );
}

function MemberUsage({ m, selfId, today }: { m: UsageMemberReport; selfId: string; today: string }) {
  const n = m.days.length;
  const sum = (pick: (d: UsageDayStat) => number) => m.days.reduce((acc, d) => acc + pick(d), 0);
  const active = m.days.filter(isActiveDay).length;
  const taps = sum((d) => d.taps);
  const records = sum((d) => d.records);
  const ai = sum((d) => d.ai);

  const pages = (Object.entries(m.pages) as [PageId, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([id, value]) => ({ label: PAGES[id], value }));
  const actions = (Object.entries(m.actions) as [ActionId, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([id, value]) => ({ label: ACTIONS[id], value }));
  const table = m.days.filter(isActiveDay).reverse();

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft font-bold text-accent-text">
          {m.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">
            {m.name}
            {m.id === selfId ? " (tú)" : ""}
          </h3>
          <p className="text-xs text-muted">Último uso: {lastSeenLabel(m.lastSeen, today)}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2">
        <Tile label="Días activos" value={`${active} de ${n}`} hint="abrió o tocó la app" />
        <Tile label="Aperturas" value={fmt(sum((d) => d.opens))} hint="veces que la abrió" />
        <Tile label="Toques" value={`≈ ${fmt(taps)}`} hint={active > 0 ? `≈ ${fmt(taps / active)} por día activo` : "en la pantalla"} />
        <Tile
          label="Registros"
          value={fmt(records)}
          hint={ai > 0 ? `y ${fmt(ai)} análisis con IA` : "comidas, ejercicio, peso…"}
        />
      </dl>

      <Strip days={m.days} name={m.name} active={active} />

      {active > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-accent-text">Ver detalle</summary>
          <div className="mt-3 space-y-4">
            {pages.length > 0 ? (
              <div>
                <h4 className="mb-2 text-xs font-medium text-ink-2">Pantallas más vistas</h4>
                <BarList rows={pages} color="var(--accent)" unit={viewsUnit} />
              </div>
            ) : null}
            {actions.length > 0 ? (
              <div>
                <h4 className="mb-2 text-xs font-medium text-ink-2">Lo que hizo</h4>
                <BarList rows={actions} color="var(--accent)" unit={timesUnit} />
              </div>
            ) : null}
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="tabular w-full min-w-[19rem] text-left text-[13px]">
                <caption className="sr-only">Uso de {m.name} por día</caption>
                <thead className="text-[11px] text-muted">
                  <tr>
                    <th className="py-1 font-medium">Día</th>
                    <th className="py-1 pl-2 text-right font-medium">Aperturas</th>
                    <th className="py-1 pl-2 text-right font-medium">Toques</th>
                    <th className="py-1 pl-2 text-right font-medium">Pantallas</th>
                    <th className="py-1 pl-2 text-right font-medium">Registros</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {table.map((d) => (
                    <tr key={d.date}>
                      <td className="whitespace-nowrap py-1.5">{shortDate(d.date)}</td>
                      <td className="py-1.5 pl-2 text-right">{d.opens}</td>
                      <td className="py-1.5 pl-2 text-right">{fmt(d.taps)}</td>
                      <td className="py-1.5 pl-2 text-right">{d.views}</td>
                      <td className="py-1.5 pl-2 text-right font-semibold">{d.records}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      ) : (
        <p className="rounded-2xl bg-field p-3 text-sm text-ink-2">
          Sin actividad en estos {n} días.
        </p>
      )}
    </Card>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl bg-field px-3 py-2.5">
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="tabular mt-0.5 text-xl font-semibold">{value}</dd>
      <dd className="text-[11px] text-muted">{hint}</dd>
    </div>
  );
}

/** Un cuadro por día, de más antiguo a más reciente; el color indica los toques de ese día. */
function Strip({ days, name, active }: { days: UsageDayStat[]; name: string; active: number }) {
  const week = days.length <= 7;
  const columns = week ? days.length : Math.ceil(days.length / 2);
  const grid = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };
  return (
    <div role="img" aria-label={`Actividad de ${name} en los últimos ${days.length} días: ${active} días activos. El detalle está en la tabla.`}>
      <div className="grid gap-1" style={grid}>
        {days.map((d) => (
          <div
            key={d.date}
            title={`${longDate(d.date)}: ${d.taps} toques`}
            className="aspect-square rounded-md ring-1 ring-border"
            style={{ background: cellColor(level(d)) }}
          />
        ))}
      </div>
      {week ? (
        <div className="mt-1 grid gap-1" style={grid}>
          {days.map((d) => (
            <span key={d.date} className="text-center text-[11px] text-muted">
              {weekdayInitial(d.date)}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-1 flex justify-between text-[11px] text-muted">
          <span>{shortDate(days[0].date)}</span>
          <span>{shortDate(days[days.length - 1].date)}</span>
        </div>
      )}
    </div>
  );
}
