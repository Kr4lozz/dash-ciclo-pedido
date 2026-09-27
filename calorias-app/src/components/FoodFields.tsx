"use client";

import { fmt1, parseNum } from "@/lib/format";
import { Field, NumberInput, TextInput } from "./ui";

export interface FoodValues {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type FoodDraft = Record<keyof FoodValues, string>;

export const EMPTY_DRAFT: FoodDraft = {
  name: "",
  portion: "",
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
};

export function toDraft(v: FoodValues): FoodDraft {
  return {
    name: v.name,
    portion: v.portion,
    calories: String(Math.round(v.calories)),
    protein: fmt1(v.protein),
    carbs: fmt1(v.carbs),
    fat: fmt1(v.fat),
  };
}

function macro(v: string) {
  const n = parseNum(v);
  return v.trim() === "" || Number.isNaN(n) ? 0 : Math.max(0, n);
}

/** kcal a partir de los macros: 4 / 4 / 9 kcal por gramo. */
export function kcalFromMacros(d: FoodDraft): number {
  return Math.round(4 * macro(d.protein) + 4 * macro(d.carbs) + 9 * macro(d.fat));
}

/** Convierte el borrador en valores; null si falta el nombre o las calorías. */
export function fromDraft(d: FoodDraft): FoodValues | null {
  const name = d.name.trim();
  let calories = parseNum(d.calories);
  if (d.calories.trim() === "") calories = kcalFromMacros(d);
  if (!name || Number.isNaN(calories) || calories < 0) return null;
  return {
    name,
    portion: d.portion.trim(),
    calories: Math.round(calories),
    protein: macro(d.protein),
    carbs: macro(d.carbs),
    fat: macro(d.fat),
  };
}

/** Multiplica calorías y macros del borrador (½ porción, doble, etc.). */
export function scaleDraft(d: FoodDraft, factor: number): FoodDraft {
  const values = fromDraft({ ...d, name: d.name || "x" });
  if (!values) return d;
  return {
    ...d,
    calories: String(Math.round(values.calories * factor)),
    protein: fmt1(values.protein * factor),
    carbs: fmt1(values.carbs * factor),
    fat: fmt1(values.fat * factor),
  };
}

export function FoodFields({
  draft,
  onChange,
  autoFocus,
}: {
  draft: FoodDraft;
  onChange: (d: FoodDraft) => void;
  autoFocus?: boolean;
}) {
  const set = (k: keyof FoodDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...draft, [k]: e.target.value });
  const estimate = kcalFromMacros(draft);

  return (
    <div className="space-y-3">
      <Field label="Alimento">
        <TextInput
          value={draft.name}
          onChange={set("name")}
          placeholder="Ej. Pan con palta"
          maxLength={120}
          autoFocus={autoFocus}
          required
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Porción">
          <TextInput value={draft.portion} onChange={set("portion")} placeholder="1 unidad (80 g)" maxLength={80} />
        </Field>
        <Field label="Calorías (kcal)">
          <NumberInput
            value={draft.calories}
            onChange={set("calories")}
            placeholder={estimate > 0 ? String(estimate) : "0"}
          />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Proteína (g)">
          <NumberInput value={draft.protein} onChange={set("protein")} placeholder="0" />
        </Field>
        <Field label="Carbos (g)">
          <NumberInput value={draft.carbs} onChange={set("carbs")} placeholder="0" />
        </Field>
        <Field label="Grasa (g)">
          <NumberInput value={draft.fat} onChange={set("fat")} placeholder="0" />
        </Field>
      </div>
      {draft.calories.trim() === "" && estimate > 0 ? (
        <p className="text-xs text-muted">Si dejas las calorías vacías se usarán {estimate} kcal (calculadas con los macros).</p>
      ) : null}
    </div>
  );
}
