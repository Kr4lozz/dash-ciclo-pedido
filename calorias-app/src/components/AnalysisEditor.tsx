"use client";

import { useState } from "react";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import type { Analysis } from "@/lib/analysis";
import { fmt, fmt1 } from "@/lib/format";
import {
  EMPTY_DRAFT,
  FoodFields,
  fromDraft,
  scaleDraft,
  toDraft,
  type FoodDraft,
  type FoodValues,
} from "./FoodFields";
import { Button, cx } from "./ui";

interface Row {
  key: number;
  draft: FoodDraft;
  include: boolean;
}

const CONFIDENCE: Record<Analysis["confidence"], string> = {
  alta: "Confianza alta",
  media: "Confianza media",
  baja: "Confianza baja",
};

/** Muestra lo que detectó la IA y deja corregir cada alimento antes de guardar. */
export function AnalysisEditor({
  analysis,
  saveLabel,
  onSave,
}: {
  analysis: Analysis;
  saveLabel: string;
  onSave: (items: FoodValues[]) => void;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    analysis.items.map((item, i) => ({ key: i, draft: toDraft(item), include: true })),
  );
  const [open, setOpen] = useState<number | null>(null);

  const chosen = rows
    .filter((r) => r.include)
    .map((r) => fromDraft(r.draft))
    .filter((v): v is FoodValues => v !== null);
  const total = chosen.reduce(
    (a, v) => ({
      calories: a.calories + v.calories,
      protein: a.protein + v.protein,
      carbs: a.carbs + v.carbs,
      fat: a.fat + v.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const patch = (key: number, p: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  if (!analysis.isFood && rows.length === 0) {
    return (
      <div className="rounded-3xl bg-field p-4 text-sm">
        <p className="font-semibold">No encontré comida en la imagen</p>
        {analysis.notes ? <p className="mt-1 text-ink-2">{analysis.notes}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold">{analysis.dishName || "Resultado"}</h3>
          <span className="rounded-full bg-field px-2.5 py-0.5 text-xs font-medium text-ink-2 ring-1 ring-border">
            {CONFIDENCE[analysis.confidence]}
          </span>
        </div>
        {analysis.notes ? <p className="mt-1 text-sm text-ink-2">{analysis.notes}</p> : null}
      </div>

      <ul className="space-y-2">
        {rows.map((r) => {
          const v = fromDraft(r.draft);
          const expanded = open === r.key;
          return (
            <li key={r.key} className="rounded-2xl bg-field ring-1 ring-border">
              <div className="flex items-center gap-2 p-2.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={r.include}
                  aria-label={`Incluir ${r.draft.name || "alimento"}`}
                  onClick={() => patch(r.key, { include: !r.include })}
                  className={cx(
                    "grid size-6 shrink-0 place-items-center rounded-lg ring-1",
                    r.include ? "bg-accent text-accent-ink ring-accent" : "bg-card ring-border",
                  )}
                >
                  {r.include ? <Check className="size-4" strokeWidth={3} /> : null}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : r.key)}
                  aria-expanded={expanded}
                  className={cx("flex min-w-0 flex-1 items-center gap-2 text-left", !r.include && "opacity-50")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.draft.name || "Sin nombre"}</span>
                    <span className="block truncate text-xs text-muted">
                      {r.draft.portion ? `${r.draft.portion} · ` : ""}
                      {v ? `P ${fmt1(v.protein)} · C ${fmt1(v.carbs)} · G ${fmt1(v.fat)}` : "Completa los datos"}
                    </span>
                  </span>
                  <span className="tabular text-sm font-semibold">{v ? fmt(v.calories) : "—"}</span>
                  <ChevronDown className={cx("size-4 shrink-0 text-muted transition", expanded && "rotate-180")} />
                </button>
              </div>
              {expanded ? (
                <div className="space-y-3 border-t border-border p-3">
                  <FoodFields draft={r.draft} onChange={(d) => patch(r.key, { draft: d })} />
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-ink-2">Porción:</span>
                    {[
                      { f: 0.5, l: "×½" },
                      { f: 1.5, l: "×1½" },
                      { f: 2, l: "×2" },
                    ].map(({ f, l }) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => patch(r.key, { draft: scaleDraft(r.draft, f) })}
                        className="rounded-xl bg-card px-3 py-1.5 font-semibold ring-1 ring-border"
                      >
                        {l}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                      className="ml-auto flex items-center gap-1 rounded-xl px-2 py-1.5 font-medium text-danger-text"
                    >
                      <Trash2 className="size-4" /> Quitar
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => {
          const key = Math.max(-1, ...rows.map((r) => r.key)) + 1;
          setRows((rs) => [...rs, { key, draft: EMPTY_DRAFT, include: true }]);
          setOpen(key);
        }}
        className="flex items-center gap-2 text-sm font-semibold text-accent-text"
      >
        <Plus className="size-4" /> Agregar otro alimento
      </button>

      <div className="rounded-2xl bg-accent-soft p-3 text-sm">
        <div className="flex items-baseline justify-between">
          <span className="font-semibold">Total</span>
          <span className="text-lg font-bold">{fmt(total.calories)} kcal</span>
        </div>
        <p className="tabular mt-0.5 text-ink-2">
          Proteína {fmt1(total.protein)} g · Carbos {fmt1(total.carbs)} g · Grasa {fmt1(total.fat)} g
        </p>
      </div>

      <Button className="w-full" disabled={chosen.length === 0} onClick={() => onSave(chosen)}>
        {saveLabel}
        {chosen.length > 1 ? ` (${chosen.length})` : ""}
      </Button>
    </div>
  );
}
