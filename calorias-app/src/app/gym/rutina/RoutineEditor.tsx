"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowDown, ArrowUp, Minus, Plus, Trash2, X } from "lucide-react";
import { ExercisePicker } from "@/components/ExercisePicker";
import { Button, Card, PageHeader, Segmented, TextInput, buttonClass } from "@/components/ui";
import { parseNum } from "@/lib/format";
import { timeUnit } from "@/lib/gym";
import { uid, deleteRoutine, saveRoutine, useAppData } from "@/lib/store";
import { toast } from "@/lib/toast";
import { muscleLabel, type GymExercise, type Routine, type RoutineExercise } from "@/lib/types";

export function RoutineEditor() {
  const id = useSearchParams().get("id");
  const data = useAppData();
  const existing = id ? data.routines.find((r) => r.id === id) : undefined;
  if (id && !existing) {
    return (
      <>
        <PageHeader title="Rutina" back="/gym?tab=rutinas" />
        <main className="px-4">
          <Card className="space-y-3 text-center">
            <p className="font-semibold">No encontramos esta rutina</p>
            <Link href="/gym?tab=rutinas" className={buttonClass("primary", "w-full")}>
              Ver mis rutinas
            </Link>
          </Card>
        </main>
      </>
    );
  }
  return <Form key={existing?.id ?? "nueva"} existing={existing} />;
}

/** Una serie cuando las series son distintas: repeticiones y peso tal como se escriben. */
interface PlanRow {
  key: string;
  reps: string;
  kg: string;
}

/**
 * Un ejercicio de la rutina tal como se edita: `value` es la repetición objetivo o la duración.
 * Con `varied`, cada serie tiene sus repeticiones y su peso (`plan`) y `sets` no se usa.
 */
interface Item {
  key: string;
  exerciseId: string;
  name: string;
  muscle: RoutineExercise["muscle"];
  mode: RoutineExercise["mode"];
  sets: number;
  value: string;
  varied: boolean;
  plan: PlanRow[];
}

const valueText = (n: number) => (n > 0 ? String(Math.round(n * 100) / 100).replace(".", ",") : "");

function toItem(e: RoutineExercise): Item {
  const unit = timeUnit(e.muscle);
  const plan = e.mode === "tiempo" ? [] : (e.plan ?? []);
  return {
    key: uid(),
    exerciseId: e.exerciseId,
    name: e.name,
    muscle: e.muscle,
    mode: e.mode,
    sets: e.sets,
    value: valueText(e.mode === "tiempo" ? (unit === "min" ? e.sec / 60 : e.sec) : e.reps),
    varied: plan.length > 0,
    plan: plan.map((p) => ({ key: uid(), reps: valueText(p.reps), kg: valueText(p.kg) })),
  };
}

function newItem(x: GymExercise): Item {
  return {
    key: uid(),
    exerciseId: x.id,
    name: x.name,
    muscle: x.muscle,
    mode: x.mode,
    sets: x.mode === "tiempo" ? 1 : 3,
    value: x.mode === "tiempo" ? (timeUnit(x.muscle) === "min" ? "20" : "45") : x.mode === "corporal" ? "12" : "10",
    varied: false,
    plan: [],
  };
}

const toNumber = (text: string) => {
  const n = parseNum(text);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

function fromItem(i: Item): RoutineExercise {
  const value = toNumber(i.value);
  if (i.varied && i.mode !== "tiempo" && i.plan.length > 0) {
    const plan = i.plan.slice(0, 20).map((r) => ({
      reps: Math.min(100, Math.round(toNumber(r.reps))),
      kg: Math.min(1000, Math.round(toNumber(r.kg) * 100) / 100),
    }));
    return {
      exerciseId: i.exerciseId,
      name: i.name,
      muscle: i.muscle,
      mode: i.mode,
      sets: plan.length,
      reps: plan[0].reps,
      sec: 0,
      plan,
    };
  }
  return {
    exerciseId: i.exerciseId,
    name: i.name,
    muscle: i.muscle,
    mode: i.mode,
    sets: i.sets,
    reps: i.mode === "tiempo" ? 0 : Math.round(value),
    sec: i.mode === "tiempo" ? Math.round(value * (timeUnit(i.muscle) === "min" ? 60 : 1)) : 0,
  };
}

function Form({ existing }: { existing?: Routine }) {
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [items, setItems] = useState<Item[]>(() => existing?.exercises.map(toItem) ?? []);
  const [picker, setPicker] = useState(false);
  const valid = name.trim().length > 0 && items.length > 0;

  const patch = (key: string, p: Partial<Item>) => setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...p } : i)));
  const move = (key: string, dir: -1 | 1) =>
    setItems((cur) => {
      const i = cur.findIndex((x) => x.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  function save() {
    if (!valid) return;
    const saved = saveRoutine({
      id: existing?.id,
      createdAt: existing?.createdAt,
      name: name.trim(),
      note: note.trim(),
      exercises: items.map(fromItem),
    });
    if (!saved) return;
    toast(existing ? "Rutina actualizada" : "Rutina guardada");
    router.replace("/gym?tab=rutinas");
  }

  return (
    <>
      <PageHeader title={existing ? "Editar rutina" : "Nueva rutina"} back="/gym?tab=rutinas" />
      <main className="space-y-4 px-4">
        <Card className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-2">Nombre</span>
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Pecho y tríceps"
              maxLength={80}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-2">Nota (opcional)</span>
            <TextInput
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. Lunes y jueves"
              maxLength={300}
            />
          </label>
        </Card>

        {items.length === 0 ? (
          <Card className="space-y-3 text-center">
            <p className="font-semibold">Agrega los ejercicios de la rutina</p>
            <p className="text-sm text-ink-2">
              Para cada uno defines las series y las repeticiones. El peso lo anotas al entrenar y la app te
              muestra el de la última vez.
            </p>
            <Button className="w-full" onClick={() => setPicker(true)}>
              <Plus className="size-5" /> Agregar ejercicios
            </Button>
          </Card>
        ) : (
          <>
            {items.map((it, idx) => {
              return (
                <Card key={it.key} className="space-y-3" as="section">
                  <div className="flex items-start gap-1">
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold leading-snug">{it.name}</h2>
                      <p className="text-xs text-muted">{muscleLabel(it.muscle)}</p>
                    </div>
                    <RowButton label={`Subir ${it.name}`} disabled={idx === 0} onClick={() => move(it.key, -1)}>
                      <ArrowUp className="size-4" />
                    </RowButton>
                    <RowButton label={`Bajar ${it.name}`} disabled={idx === items.length - 1} onClick={() => move(it.key, 1)}>
                      <ArrowDown className="size-4" />
                    </RowButton>
                    <RowButton label={`Quitar ${it.name}`} onClick={() => setItems((cur) => cur.filter((x) => x.key !== it.key))}>
                      <X className="size-4" />
                    </RowButton>
                  </div>
                  <SetFields it={it} patch={(p) => patch(it.key, p)} />
                </Card>
              );
            })}
            <Button variant="secondary" className="w-full" onClick={() => setPicker(true)}>
              <Plus className="size-5" /> Agregar ejercicios
            </Button>
          </>
        )}

        <Button className="w-full" disabled={!valid} onClick={save}>
          {existing ? "Guardar cambios" : "Guardar rutina"}
        </Button>
        {!valid ? (
          <p className="text-center text-xs text-muted">
            {name.trim() ? "Agrega al menos un ejercicio." : "Ponle un nombre y agrega al menos un ejercicio."}
          </p>
        ) : null}
        {existing ? (
          <Button
            variant="ghost"
            className="w-full text-danger-text hover:bg-danger-soft"
            onClick={() => {
              if (confirm(`¿Eliminar la rutina «${existing.name}»? Tus entrenamientos anteriores no cambian.`)) {
                deleteRoutine(existing.id);
                toast("Rutina eliminada");
                router.replace("/gym?tab=rutinas");
              }
            }}
          >
            <Trash2 className="size-4" /> Eliminar rutina
          </Button>
        ) : null}
      </main>

      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(picked) => setItems((cur) => [...cur, ...picked.map(newItem)])}
      />
    </>
  );
}

function RowButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-9 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-field disabled:opacity-30"
    >
      {children}
    </button>
  );
}

const numberCell =
  "tabular h-11 w-full rounded-xl bg-field px-3 text-center text-base ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-accent";

/** Series y repeticiones de un ejercicio: iguales para todas, o cada serie con las suyas y su peso. */
function SetFields({ it, patch }: { it: Item; patch: (p: Partial<Item>) => void }) {
  const timed = it.mode === "tiempo";
  const unit = timeUnit(it.muscle);

  const uniform = (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <p className="mb-1.5 text-xs font-medium text-ink-2">Series</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`Menos series de ${it.name}`}
            disabled={it.sets <= 1}
            onClick={() => patch({ sets: it.sets - 1 })}
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-field ring-1 ring-border disabled:opacity-40"
          >
            <Minus className="size-4" />
          </button>
          <span className="tabular min-w-6 flex-1 text-center text-lg font-semibold" aria-live="polite">
            {it.sets}
          </span>
          <button
            type="button"
            aria-label={`Más series de ${it.name}`}
            disabled={it.sets >= 20}
            onClick={() => patch({ sets: it.sets + 1 })}
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-field ring-1 ring-border disabled:opacity-40"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-ink-2">
          {timed ? (unit === "min" ? "Minutos" : "Segundos") : "Repeticiones"}
        </span>
        <input
          inputMode="decimal"
          autoComplete="off"
          value={it.value}
          onChange={(e) => patch({ value: e.target.value })}
          aria-label={`${timed ? "Duración" : "Repeticiones"} de ${it.name}`}
          className={numberCell}
        />
      </label>
    </div>
  );
  if (timed) return uniform;

  function setVaried(on: boolean) {
    if (on === it.varied) return;
    if (on) {
      // Parte de lo que ya había: las mismas repeticiones en cada serie, sin peso.
      patch({
        varied: true,
        plan: Array.from({ length: it.sets }, () => ({ key: uid(), reps: it.value, kg: "" })),
      });
    } else {
      patch({ varied: false, sets: Math.max(1, it.plan.length), value: it.plan[0]?.reps ?? it.value, plan: [] });
    }
  }
  const patchRow = (key: string, p: Partial<PlanRow>) =>
    patch({ plan: it.plan.map((r) => (r.key === key ? { ...r, ...p } : r)) });

  return (
    <div className="space-y-3">
      <Segmented
        label={`Series de ${it.name}`}
        value={it.varied ? "distintas" : "iguales"}
        onChange={(v) => setVaried(v === "distintas")}
        options={[
          { id: "iguales", label: "Todas iguales" },
          { id: "distintas", label: "Cada una distinta" },
        ]}
      />
      {it.varied ? (
        <div className="space-y-2">
          <div className="grid grid-cols-[1.5rem_1fr_1fr_2rem] items-center gap-2 text-center text-[11px] font-medium text-muted" aria-hidden>
            <span>#</span>
            <span>Reps</span>
            <span>{it.mode === "corporal" ? "+kg (opcional)" : "kg (opcional)"}</span>
            <span />
          </div>
          {it.plan.map((r, i) => (
            <div key={r.key} role="group" aria-label={`Serie ${i + 1} de ${it.name}`} className="grid grid-cols-[1.5rem_1fr_1fr_2rem] items-center gap-2">
              <span className="text-center text-sm font-semibold text-ink-2">{i + 1}</span>
              <input
                inputMode="decimal"
                autoComplete="off"
                value={r.reps}
                onChange={(e) => patchRow(r.key, { reps: e.target.value })}
                placeholder="0"
                aria-label={`Repeticiones de la serie ${i + 1} de ${it.name}`}
                className={numberCell}
              />
              <input
                inputMode="decimal"
                autoComplete="off"
                value={r.kg}
                onChange={(e) => patchRow(r.key, { kg: e.target.value })}
                placeholder="—"
                aria-label={`Peso de la serie ${i + 1} de ${it.name} en kg`}
                className={numberCell}
              />
              <button
                type="button"
                aria-label={`Quitar la serie ${i + 1} de ${it.name}`}
                disabled={it.plan.length <= 1}
                onClick={() => patch({ plan: it.plan.filter((x) => x.key !== r.key) })}
                className="grid size-8 place-items-center rounded-full text-muted hover:bg-field hover:text-danger-text disabled:opacity-30"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={it.plan.length >= 20}
            onClick={() => {
              const last = it.plan[it.plan.length - 1];
              patch({ plan: [...it.plan, { key: uid(), reps: last?.reps ?? "", kg: last?.kg ?? "" }] });
            }}
            className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-field text-sm font-semibold text-ink-2 ring-1 ring-border hover:text-ink disabled:opacity-40"
          >
            <Plus className="size-4" /> Agregar serie
          </button>
          <p className="text-xs text-muted">
            El peso es opcional: al entrenar lo verás ya escrito y podrás cambiarlo.
          </p>
        </div>
      ) : (
        uniform
      )}
    </div>
  );
}
