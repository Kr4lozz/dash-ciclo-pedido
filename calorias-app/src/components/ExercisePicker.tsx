"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { allExercises, findExercise } from "@/lib/gym";
import { addCustomExercise, deleteCustomExercise, useAppData } from "@/lib/store";
import { EXERCISE_MODES, MUSCLES, muscleLabel, type ExerciseMode, type GymExercise, type MuscleGroup } from "@/lib/types";
import { Sheet } from "./Sheet";
import { Button, Segmented, TextInput, cx } from "./ui";

/** "Sentadilla" y "sentadilla" y "SENTADILLA" coinciden; también sin tildes. */
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const modeHint = (m: ExerciseMode) => (m === "peso" ? "" : m === "corporal" ? "peso corporal" : "tiempo");

/** Hoja para elegir uno o varios ejercicios del catálogo o crear uno propio. */
export function ExercisePicker({
  open,
  onClose,
  onPick,
  title = "Agregar ejercicios",
}: {
  open: boolean;
  onClose: () => void;
  onPick: (exercises: GymExercise[]) => void;
  title?: string;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <PickerBody onPick={onPick} onClose={onClose} />
    </Sheet>
  );
}

function PickerBody({ onPick, onClose }: { onPick: (e: GymExercise[]) => void; onClose: () => void }) {
  const data = useAppData();
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<MuscleGroup | "todos">("todos");
  const [selected, setSelected] = useState<GymExercise[]>([]);
  const [creating, setCreating] = useState(false);

  const all = useMemo(() => allExercises(data.customExercises), [data.customExercises]);
  const recent = useMemo(() => {
    const seen = new Set<string>();
    const out: GymExercise[] = [];
    const sorted = [...data.workouts].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date)));
    for (const w of sorted) {
      for (const ex of w.exercises) {
        if (seen.has(ex.exerciseId) || out.length >= 8) continue;
        seen.add(ex.exerciseId);
        out.push(
          findExercise(ex.exerciseId, data.customExercises) ?? {
            id: ex.exerciseId,
            name: ex.name,
            muscle: ex.muscle,
            mode: ex.mode,
          },
        );
      }
    }
    return out;
  }, [data.workouts, data.customExercises]);

  const q = plain(query.trim());
  const filtered = all.filter((x) => (muscle === "todos" || x.muscle === muscle) && (!q || plain(x.name).includes(q)));
  const grouped = q === "" && muscle === "todos";
  const isSelected = (id: string) => selected.some((x) => x.id === id);
  const toggle = (x: GymExercise) =>
    setSelected((cur) => (cur.some((y) => y.id === x.id) ? cur.filter((y) => y.id !== x.id) : [...cur, x]));

  if (creating) {
    return (
      <CreateForm
        initialName={query.trim()}
        initialMuscle={muscle === "todos" ? "pecho" : muscle}
        onCancel={() => setCreating(false)}
        onCreated={(x) => {
          setSelected((cur) => (cur.some((y) => y.id === x.id) ? cur : [...cur, x]));
          setCreating(false);
        }}
      />
    );
  }

  const row = (x: GymExercise, keyPrefix = "") => (
    <li key={keyPrefix + x.id} className="flex items-center gap-1">
      <button
        type="button"
        aria-pressed={isSelected(x.id)}
        onClick={() => toggle(x)}
        className={cx(
          "flex min-h-12 flex-1 items-center gap-3 rounded-2xl px-2 py-2 text-left transition",
          isSelected(x.id) ? "bg-accent-soft" : "hover:bg-field",
        )}
      >
        <span
          aria-hidden
          className={cx(
            "grid size-6 shrink-0 place-items-center rounded-full ring-1",
            isSelected(x.id) ? "bg-accent text-accent-ink ring-accent" : "ring-border",
          )}
        >
          {isSelected(x.id) ? <Check className="size-4" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium leading-snug">{x.name}</span>
          <span className="block text-xs text-muted">
            {[muscleLabel(x.muscle), modeHint(x.mode), x.id.startsWith("x-") ? "propio" : ""].filter(Boolean).join(" · ")}
          </span>
        </span>
      </button>
      {x.id.startsWith("x-") ? (
        <button
          type="button"
          aria-label={`Borrar el ejercicio propio ${x.name}`}
          onClick={() => {
            if (confirm(`¿Borrar «${x.name}» de tus ejercicios? Tus entrenamientos anteriores no cambian.`)) {
              deleteCustomExercise(x.id);
              setSelected((cur) => cur.filter((y) => y.id !== x.id));
            }
          }}
          className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-field hover:text-danger-text"
        >
          <Trash2 className="size-4" />
        </button>
      ) : null}
    </li>
  );

  return (
    <div className="space-y-3">
      <TextInput
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar ejercicio"
        aria-label="Buscar ejercicio"
        enterKeyHint="search"
      />
      <div role="group" aria-label="Grupo muscular" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {[{ id: "todos" as const, label: "Todos" }, ...MUSCLES].map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={muscle === m.id}
            onClick={() => setMuscle(m.id)}
            className={cx(
              "min-h-9 shrink-0 rounded-full px-3.5 text-sm font-medium ring-1 transition",
              muscle === m.id ? "bg-accent-soft text-accent-text ring-accent" : "bg-card text-ink-2 ring-border hover:text-ink",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {grouped && recent.length > 0 ? (
        <section aria-label="Recientes">
          <h3 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-2">Recientes</h3>
          <ul>{recent.map((x) => row(x, "r-"))}</ul>
        </section>
      ) : null}

      {grouped ? (
        MUSCLES.map((m) => {
          const items = filtered.filter((x) => x.muscle === m.id);
          return items.length > 0 ? (
            <section key={m.id} aria-label={m.label}>
              <h3 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-2">{m.label}</h3>
              <ul>{items.map((x) => row(x))}</ul>
            </section>
          ) : null;
        })
      ) : filtered.length > 0 ? (
        <ul>{filtered.map((x) => row(x))}</ul>
      ) : (
        <p className="px-2 py-4 text-sm text-ink-2">
          No hay ejercicios con ese nombre. Puedes crearlo con el botón de abajo.
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 space-y-2 border-t border-border bg-card px-4 pb-1 pt-3">
        <Button
          className="w-full"
          disabled={selected.length === 0}
          onClick={() => {
            onPick(selected);
            onClose();
          }}
        >
          {selected.length === 0
            ? "Elige uno o más ejercicios"
            : `Agregar ${selected.length} ${selected.length === 1 ? "ejercicio" : "ejercicios"}`}
        </Button>
        <Button variant="secondary" className="w-full" onClick={() => setCreating(true)}>
          <Plus className="size-5" /> Crear ejercicio propio
        </Button>
      </div>
    </div>
  );
}

function CreateForm({
  initialName,
  initialMuscle,
  onCancel,
  onCreated,
}: {
  initialName: string;
  initialMuscle: MuscleGroup;
  onCancel: () => void;
  onCreated: (e: GymExercise) => void;
}) {
  const [name, setName] = useState(initialName);
  const [muscle, setMuscle] = useState<MuscleGroup>(initialMuscle);
  const [mode, setMode] = useState<ExerciseMode>("peso");
  const valid = name.trim().length > 0;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        const created = addCustomExercise({ name, muscle, mode });
        if (created) onCreated(created);
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-2">Nombre</span>
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Press en máquina Smith"
          maxLength={80}
          autoFocus
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-2">Grupo muscular</span>
        <select
          value={muscle}
          onChange={(e) => setMuscle(e.target.value as MuscleGroup)}
          className="w-full rounded-2xl bg-field px-3.5 py-2.5 text-base ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {MUSCLES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink-2">¿Cómo lo anotas?</span>
        <Segmented label="Tipo de ejercicio" value={mode} onChange={setMode} options={EXERCISE_MODES.map((m) => ({ id: m.id, label: m.label }))} />
        <p className="mt-1.5 text-xs text-muted">
          {mode === "peso"
            ? "Peso y repeticiones de cada serie."
            : mode === "corporal"
              ? "Repeticiones de cada serie, con peso extra si lo usas."
              : "La duración de cada serie (minutos en cardio, segundos en abdomen)."}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Volver
        </Button>
        <Button type="submit" className="flex-1" disabled={!valid}>
          Crear y elegir
        </Button>
      </div>
    </form>
  );
}
