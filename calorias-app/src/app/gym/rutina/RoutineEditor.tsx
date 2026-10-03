"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowDown, ArrowUp, Minus, Plus, Trash2, X } from "lucide-react";
import { ExercisePicker } from "@/components/ExercisePicker";
import { Button, Card, PageHeader, TextInput, buttonClass } from "@/components/ui";
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

/** Un ejercicio de la rutina tal como se edita: `value` es la repetición objetivo o la duración. */
interface Item {
  key: string;
  exerciseId: string;
  name: string;
  muscle: RoutineExercise["muscle"];
  mode: RoutineExercise["mode"];
  sets: number;
  value: string;
}

const valueText = (n: number) => (n > 0 ? String(Math.round(n * 100) / 100).replace(".", ",") : "");

function toItem(e: RoutineExercise): Item {
  const unit = timeUnit(e.muscle);
  return {
    key: uid(),
    exerciseId: e.exerciseId,
    name: e.name,
    muscle: e.muscle,
    mode: e.mode,
    sets: e.sets,
    value: valueText(e.mode === "tiempo" ? (unit === "min" ? e.sec / 60 : e.sec) : e.reps),
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
  };
}

function fromItem(i: Item): RoutineExercise {
  const n = parseNum(i.value);
  const value = Number.isFinite(n) && n > 0 ? n : 0;
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
              const timed = it.mode === "tiempo";
              const unit = timeUnit(it.muscle);
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
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-ink-2">Series</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Menos series de ${it.name}`}
                          disabled={it.sets <= 1}
                          onClick={() => patch(it.key, { sets: it.sets - 1 })}
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
                          onClick={() => patch(it.key, { sets: it.sets + 1 })}
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
                        onChange={(e) => patch(it.key, { value: e.target.value })}
                        aria-label={`${timed ? "Duración" : "Repeticiones"} de ${it.name}`}
                        className="tabular h-11 w-full rounded-xl bg-field px-3 text-center text-base ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </label>
                  </div>
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
