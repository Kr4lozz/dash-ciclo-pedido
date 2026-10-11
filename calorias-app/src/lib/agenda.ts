import { addDays, dateLabel } from "./dates";
import type { Task } from "./types";

// Cálculos de la agenda (sin pantalla): orden, grupos y el enlace al calendario del celular.

/** Primero las que tienen hora (de la más temprana a la más tarde), luego las demás en el orden en que se crearon. */
export const byTime = (a: Task, b: Task) =>
  (a.time ?? "99:99").localeCompare(b.time ?? "99:99") || a.createdAt - b.createdAt;

export const tasksOn = (tasks: Task[], date: string) => tasks.filter((t) => t.date === date);

/** Pendientes de días anteriores (lo más viejo primero). */
export function overdue(tasks: Task[], today: string): Task[] {
  return tasks
    .filter((t) => !t.done && t.date !== null && t.date < today)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || byTime(a, b));
}

export interface TaskGroup {
  /** null = sin fecha */
  date: string | null;
  label: string;
  tasks: Task[];
}

/** Lo que viene: cada día futuro con actividades y, al final, lo que no tiene fecha. */
export function upcoming(tasks: Task[], today: string): TaskGroup[] {
  const groups = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.date !== null && t.date > today) groups.set(t.date, [...(groups.get(t.date) ?? []), t]);
  }
  const out: TaskGroup[] = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({ date, label: dateLabel(date), tasks: list.sort(byTime) }));
  const undated = tasks.filter((t) => t.date === null).sort((a, b) => Number(a.done) - Number(b.done) || a.createdAt - b.createdAt);
  if (undated.length > 0) out.push({ date: null, label: "Sin fecha", tasks: undated });
  return out;
}

/** Enlace que abre la actividad en el calendario del celular (archivo .ics); null si no tiene fecha. */
export function icsUrl(t: Pick<Task, "id" | "title" | "note" | "date" | "time">): string | null {
  if (!t.date) return null;
  const p = new URLSearchParams({ id: t.id, title: t.title, date: t.date });
  if (t.time) p.set("time", t.time);
  if (t.note) p.set("note", t.note);
  return `/api/agenda/ics?${p}`;
}

export const tomorrow = (today: string) => addDays(today, 1);
