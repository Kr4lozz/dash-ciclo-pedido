"use client";

import { useState } from "react";
import { CalendarPlus, Clock, Trash2 } from "lucide-react";
import { Sheet } from "@/components/Sheet";
import { Button, Field, TextInput, buttonClass, inputClass, cx } from "@/components/ui";
import { icsUrl } from "@/lib/agenda";
import { todayStr } from "@/lib/dates";
import { addTask, deleteTask, updateTask } from "@/lib/store";
import { toast } from "@/lib/toast";

/** Lo que se edita: una actividad nueva (sin id) o una existente. */
export interface TaskDraft {
  id?: string;
  title: string;
  /** null = sin fecha */
  date: string | null;
  /** HH:MM o vacío */
  time: string;
  note: string;
}

const IDEAS = ["Entrenar", "Caminar 30 min", "Estirar", "Tomar agua", "Medir mi peso", "Preparar la comida"];

export function TaskSheet({
  draft,
  onClose,
  routines,
}: {
  draft: TaskDraft | null;
  onClose: () => void;
  /** nombres de las rutinas guardadas, como atajos para el título */
  routines: string[];
}) {
  return (
    <Sheet open={draft !== null} onClose={onClose} title={draft?.id ? "Editar actividad" : "Nueva actividad"}>
      {draft ? <TaskForm key={draft.id ?? "nueva"} draft={draft} onClose={onClose} routines={routines} /> : null}
    </Sheet>
  );
}

function TaskForm({ draft, onClose, routines }: { draft: TaskDraft; onClose: () => void; routines: string[] }) {
  const [title, setTitle] = useState(draft.title);
  const [date, setDate] = useState<string | null>(draft.date);
  const [time, setTime] = useState(draft.time);
  const [note, setNote] = useState(draft.note);
  const editing = draft.id !== undefined;
  const valid = title.trim().length > 0;
  const ics = editing && date ? icsUrl({ id: draft.id!, title: title.trim() || draft.title, note, date, time: time || null }) : null;

  function save() {
    if (!valid) return;
    const fields = { title: title.trim(), note: note.trim(), date, time: time || null };
    if (editing) updateTask(draft.id!, fields);
    else addTask(fields);
    toast(editing ? "Actividad actualizada" : "Actividad agregada");
    onClose();
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Field label="¿Qué quieres hacer?">
        <TextInput
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          placeholder="Ej. Entrenar pecho"
          autoFocus
        />
      </Field>
      {!editing && !title ? (
        <div className="-mt-2 flex flex-wrap gap-2" aria-label="Ideas">
          {[...routines.slice(0, 3).map((r) => `Entrenar: ${r}`), ...IDEAS].map((idea) => (
            <button
              key={idea}
              type="button"
              onClick={() => setTitle(idea)}
              className="rounded-full bg-field px-3 py-1.5 text-sm text-ink-2 ring-1 ring-border hover:text-ink"
            >
              {idea}
            </button>
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        <Field label="Fecha">
          <input
            type="date"
            value={date ?? ""}
            disabled={date === null}
            onChange={(e) => setDate(e.target.value || null)}
            className={cx(inputClass, "disabled:opacity-50")}
          />
        </Field>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={date === null}
            onChange={(e) => setDate(e.target.checked ? null : (draft.date ?? todayStr()))}
            className="size-5 shrink-0 accent-accent"
          />
          Sin fecha (una idea u objetivo para más adelante)
        </label>
      </div>

      <Field label="Hora (opcional)">
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={date === null}
            className={cx(inputClass, "flex-1 disabled:opacity-50")}
          />
          {time ? (
            <button
              type="button"
              onClick={() => setTime("")}
              className="shrink-0 text-sm font-semibold text-accent-text"
            >
              <Clock className="mr-1 inline size-4" aria-hidden />
              Quitar hora
            </button>
          ) : null}
        </div>
      </Field>

      <Field label="Nota (opcional)">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="Ej. Piernas y abdomen"
          className={cx(inputClass, "resize-none")}
        />
      </Field>

      <Button type="submit" className="w-full" disabled={!valid}>
        {editing ? "Guardar cambios" : "Agregar a la agenda"}
      </Button>

      {ics ? (
        <a href={ics} className={buttonClass("secondary", "w-full")}>
          <CalendarPlus className="size-5" /> Agregar al calendario del celular
        </a>
      ) : null}

      {editing ? (
        <Button
          variant="ghost"
          className="w-full text-danger-text hover:bg-danger-soft"
          onClick={() => {
            if (confirm(`¿Eliminar «${draft.title}»?`)) {
              deleteTask(draft.id!);
              toast("Actividad eliminada");
              onClose();
            }
          }}
        >
          <Trash2 className="size-4" /> Eliminar
        </Button>
      ) : null}
    </form>
  );
}
