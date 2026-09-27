"use client";

import Link from "next/link";
import { useState } from "react";
import { Smartphone, Trash2, TrendingDown, TrendingUp, Watch } from "lucide-react";
import { fmt, parseNum } from "@/lib/format";
import { dayBalance, plannedDeficit, type Targets } from "@/lib/nutrition";
import { setBurned } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { DayBurn, ExerciseEntry, Goal } from "@/lib/types";
import { Sheet } from "./Sheet";
import { Stat } from "./Meters";
import { Button, Field, NumberInput, cx } from "./ui";

/**
 * Balance del día: gasto total (Apple Fitness o estimado) frente a lo comido.
 * El gasto se anota a mano desde lo que marca la app Fitness del iPhone.
 */
export function BalanceCard({
  targets,
  goal,
  eaten,
  burn,
  exercises,
  onEdit,
}: {
  targets: Targets;
  goal: Goal | null;
  eaten: number;
  burn: DayBurn | null;
  exercises: ExerciseEntry[];
  onEdit: () => void;
}) {
  const b = dayBalance(targets, burn, exercises, eaten);
  const planned = plannedDeficit(targets);

  return (
    <section className="space-y-3 rounded-3xl bg-card p-4 ring-1 ring-border" aria-label="Balance del día">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Balance del día</h2>
        {burn ? (
          <button
            type="button"
            onClick={onEdit}
            className="-my-1 rounded-xl px-2 py-1 text-sm font-semibold text-accent-text hover:bg-accent-soft"
          >
            Editar
          </button>
        ) : null}
      </div>

      {b.spent !== null && b.deficit !== null ? (
        <>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Gastaste" value={fmt(b.spent)} swatch="var(--burn)" />
            <Stat label="Comiste" value={fmt(eaten)} swatch="var(--kcal)" />
            <DeficitStat deficit={b.deficit} goal={goal} />
          </dl>
          <p className="text-xs text-muted">
            {sourceText(b.source, b.resting, b.active, exercises.length > 0)}
            {planned !== null && Math.abs(planned) >= 50
              ? ` · Tu meta apunta a un ${planned > 0 ? "déficit" : "superávit"} de ~${fmt(Math.abs(planned))} kcal.`
              : ""}
          </p>
        </>
      ) : (
        <p className="text-sm text-ink-2">
          Anota las calorías totales que marca Apple Fitness, o completa tu perfil, para ver tu déficit.
        </p>
      )}

      {burn ? (
        <p className="flex items-center gap-2 rounded-2xl bg-field px-3 py-2 text-sm text-ink-2">
          <Watch className="size-4 shrink-0" aria-hidden />
          <span>
            Apple Fitness:{" "}
            {[
              burn.total != null ? `${fmt(burn.total)} kcal totales` : null,
              burn.active != null ? `${fmt(burn.active)} kcal activas` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </p>
      ) : (
        <Button variant="secondary" className="w-full" onClick={onEdit}>
          <Watch className="size-5" /> Anotar calorías de Apple Fitness
        </Button>
      )}
    </section>
  );
}

function sourceText(
  source: ReturnType<typeof dayBalance>["source"],
  resting: number | null,
  active: number,
  hasExercises: boolean,
) {
  if (source === "reloj") return "Gasto total según Apple Fitness.";
  if (source === "reposo+activas")
    return `Gasto = ${fmt(resting ?? 0)} en reposo (estimado con tu perfil) + ${fmt(active)} activas.`;
  return hasExercises
    ? "Gasto estimado con tu perfil + ejercicio registrado."
    : "Gasto estimado con tu perfil; anota lo de Apple Fitness para un dato real.";
}

/** El déficit se resalta cuando va en la dirección del objetivo (bajar o subir de peso). */
function DeficitStat({ deficit, goal }: { deficit: number; goal: Goal | null }) {
  const isDeficit = deficit >= 0;
  const onTrack =
    goal === "perder" ? deficit > 0 : goal === "ganar" ? deficit < 0 : goal === "mantener" && Math.abs(deficit) <= 200;
  const Icon = isDeficit ? TrendingDown : TrendingUp;
  return (
    <div className={cx("rounded-2xl px-2 py-2.5", onTrack ? "bg-accent-soft" : "bg-field")}>
      <dt
        className={cx(
          "flex items-center justify-center gap-1 text-xs font-medium",
          onTrack ? "text-accent-text" : "text-ink-2",
        )}
      >
        <Icon className="size-3.5" aria-hidden />
        {isDeficit ? "Déficit" : "Superávit"}
      </dt>
      <dd className={cx("tabular mt-0.5 text-lg font-semibold", onTrack && "text-accent-text")}>
        {fmt(Math.abs(deficit))}
      </dd>
    </div>
  );
}

// ---------- Formulario ----------

/** Hoja para anotar (o borrar) las calorías que marca Apple Fitness en el día. */
export function BurnSheet({
  open,
  onClose,
  date,
  burn,
  bmr,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  burn: DayBurn | null;
  /** Calorías en reposo estimadas con el perfil; null sin perfil */
  bmr: number | null;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Calorías de Apple Fitness">
      <BurnForm date={date} burn={burn} bmr={bmr} onDone={onClose} />
    </Sheet>
  );
}

const MAX_KCAL = 20000;

/** "" = sin dato; NaN = inválido. */
function readKcal(v: string): number | null {
  if (!v.trim()) return null;
  const n = parseNum(v);
  return n >= 0 && n <= MAX_KCAL ? Math.round(n) : NaN;
}

function BurnForm({
  date,
  burn,
  bmr,
  onDone,
}: {
  date: string;
  burn: DayBurn | null;
  bmr: number | null;
  onDone: () => void;
}) {
  const [active, setActive] = useState(burn?.active != null ? String(burn.active) : "");
  const [total, setTotal] = useState(burn?.total != null ? String(burn.total) : "");
  const a = readKcal(active);
  const t = readKcal(total);
  const invalid = Number.isNaN(a) || Number.isNaN(t);
  const empty = !a && !t;
  const totalBelowActive = a !== null && t !== null && t > 0 && t < a;

  let preview: string | null = null;
  if (!invalid && t) preview = `Gasto del día: ${fmt(t)} kcal`;
  else if (!invalid && a && bmr) preview = `Gasto del día: ${fmt(bmr + a)} kcal (${fmt(bmr)} en reposo estimado + ${fmt(a)} activas)`;
  else if (!invalid && a) preview = "Completa tu perfil para estimar tus calorías en reposo, o anota las totales.";

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (invalid || empty || totalBelowActive) return;
        setBurned(date, { active: a || null, total: t || null });
        toast("Calorías de Apple Fitness guardadas");
        onDone();
      }}
    >
      <p className="text-sm text-ink-2">
        Abre la app <span className="font-semibold text-ink">Fitness</span> del iPhone y copia lo que marca hoy.
        Actualízalo al final del día para tener el total completo.
      </p>
      <Field label="Calorías activas (anillo Moverse)" hint="El número del anillo rojo, por ejemplo 450 en «450/600 kcal».">
        <NumberInput value={active} onChange={(e) => setActive(e.target.value)} placeholder="450" inputMode="numeric" />
      </Field>
      <Field
        label="Calorías totales (opcional)"
        hint="Activas + en reposo. En la app Salud: Energía activa + Energía en reposo. Si no la tienes, estimamos el reposo con tu perfil."
      >
        <NumberInput value={total} onChange={(e) => setTotal(e.target.value)} placeholder="2100" inputMode="numeric" />
      </Field>

      {invalid ? (
        <p role="alert" className="text-sm text-danger-text">
          Escribe un número entre 0 y {fmt(MAX_KCAL)}.
        </p>
      ) : totalBelowActive ? (
        <p role="alert" className="text-sm text-danger-text">
          Las totales no pueden ser menos que las activas (las totales ya las incluyen).
        </p>
      ) : preview ? (
        <p className="rounded-2xl bg-accent-soft p-3 text-sm">{preview}</p>
      ) : null}

      <Link
        href="/ejercicio"
        className="flex items-center gap-2 text-sm font-semibold text-accent-text"
      >
        <Smartphone className="size-4" /> Leerlas desde una captura de los anillos
      </Link>

      <div className="flex gap-2 pt-1">
        {burn ? (
          <Button
            variant="danger"
            aria-label="Borrar calorías de Apple Fitness"
            onClick={() => {
              setBurned(date, { active: null, total: null });
              toast("Calorías de Apple Fitness borradas");
              onDone();
            }}
          >
            <Trash2 className="size-5" />
          </Button>
        ) : null}
        <Button type="submit" className="flex-1" disabled={invalid || empty || totalBelowActive}>
          Guardar
        </Button>
      </div>
    </form>
  );
}
