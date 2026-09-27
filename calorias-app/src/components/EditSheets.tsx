"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { parseNum } from "@/lib/format";
import { deleteExercise, deleteFood, updateExercise, updateFood } from "@/lib/store";
import { toast } from "@/lib/toast";
import { MEALS, mealLabel, type ExerciseEntry, type FoodEntry, type MealType } from "@/lib/types";
import { FoodFields, fromDraft, scaleDraft, toDraft, type FoodDraft } from "./FoodFields";
import { Sheet } from "./Sheet";
import { Button, Field, NumberInput, Segmented, TextInput } from "./ui";

export function FoodEditSheet({ entry, onClose }: { entry: FoodEntry | null; onClose: () => void }) {
  return (
    <Sheet open={entry !== null} onClose={onClose} title="Editar alimento">
      {entry ? <FoodEditForm key={entry.id} entry={entry} onDone={onClose} /> : null}
    </Sheet>
  );
}

function FoodEditForm({ entry, onDone }: { entry: FoodEntry; onDone: () => void }) {
  const [draft, setDraft] = useState<FoodDraft>(() => toDraft(entry));
  const [meal, setMeal] = useState<MealType>(entry.meal);
  const values = fromDraft(draft);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!values) return;
        updateFood(entry.id, { ...values, meal });
        toast("Cambios guardados");
        onDone();
      }}
    >
      <Segmented
        label="Comida"
        value={meal}
        onChange={setMeal}
        options={MEALS.map((m) => ({ id: m.id, label: m.label }))}
      />
      <FoodFields draft={draft} onChange={setDraft} />
      <div className="flex items-center gap-2 text-sm">
        <span className="text-ink-2">Ajustar porción:</span>
        {[
          { f: 0.5, l: "×½" },
          { f: 1.5, l: "×1½" },
          { f: 2, l: "×2" },
        ].map(({ f, l }) => (
          <button
            key={l}
            type="button"
            onClick={() => setDraft(scaleDraft(draft, f))}
            className="rounded-xl bg-field px-3 py-1.5 font-semibold ring-1 ring-border hover:brightness-95"
          >
            {l}
          </button>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          variant="danger"
          aria-label="Eliminar alimento"
          onClick={() => {
            deleteFood(entry.id);
            toast(`Eliminado de ${mealLabel(entry.meal)}`);
            onDone();
          }}
        >
          <Trash2 className="size-5" />
        </Button>
        <Button type="submit" className="flex-1" disabled={!values}>
          Guardar
        </Button>
      </div>
    </form>
  );
}

export function ExerciseEditSheet({
  entry,
  onClose,
}: {
  entry: ExerciseEntry | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={entry !== null} onClose={onClose} title="Editar ejercicio">
      {entry ? <ExerciseEditForm key={entry.id} entry={entry} onDone={onClose} /> : null}
    </Sheet>
  );
}

function ExerciseEditForm({ entry, onDone }: { entry: ExerciseEntry; onDone: () => void }) {
  const [name, setName] = useState(entry.name);
  const [minutes, setMinutes] = useState(entry.minutes ? String(entry.minutes) : "");
  const [kcal, setKcal] = useState(String(entry.calories));
  const calories = parseNum(kcal);
  const valid = name.trim() !== "" && calories >= 0;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        const mins = parseNum(minutes);
        updateExercise(entry.id, {
          name: name.trim(),
          minutes: mins > 0 ? Math.round(mins) : null,
          calories: Math.round(calories),
        });
        toast("Cambios guardados");
        onDone();
      }}
    >
      <Field label="Actividad">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Minutos">
          <NumberInput value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="—" />
        </Field>
        <Field label="Calorías quemadas">
          <NumberInput value={kcal} onChange={(e) => setKcal(e.target.value)} />
        </Field>
      </div>
      <p className="text-xs text-muted">
        Al cambiar los minutos, ajusta también las calorías si hace falta.
      </p>
      <div className="flex gap-2 pt-1">
        <Button
          variant="danger"
          aria-label="Eliminar ejercicio"
          onClick={() => {
            deleteExercise(entry.id);
            toast("Ejercicio eliminado");
            onDone();
          }}
        >
          <Trash2 className="size-5" />
        </Button>
        <Button type="submit" className="flex-1" disabled={!valid}>
          Guardar
        </Button>
      </div>
    </form>
  );
}
