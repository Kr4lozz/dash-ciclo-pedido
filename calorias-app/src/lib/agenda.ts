import { addDays, dateLabel, toDateStr } from "./dates";
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

// ---------- Calendario ----------

export interface CalendarCell {
  date: string;
  /** false = día de otro mes que completa la semana */
  inMonth: boolean;
}

/** Las semanas (lunes a domingo) que cubren el mes de `date`. */
export function monthGrid(date: string): CalendarCell[] {
  const [y, m] = date.split("-").map(Number);
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7; // lunes = 0
  const days = new Date(y, m, 0).getDate();
  const total = Math.ceil((lead + days) / 7) * 7;
  return Array.from({ length: total }, (_, i) => {
    const d = new Date(y, m - 1, 1 - lead + i);
    return { date: toDateStr(d), inMonth: d.getMonth() === m - 1 };
  });
}

/** El día 1 del mes que está `n` meses después (o antes) del de `date`. */
export function shiftMonth(date: string, n: number): string {
  const [y, m] = date.split("-").map(Number);
  return toDateStr(new Date(y, m - 1 + n, 1));
}

export interface DayCount {
  total: number;
  done: number;
}

/** Cuántas actividades hay cada día y cuántas están hechas (los días sin fecha no cuentan). */
export function dayCounts(tasks: Task[]): Map<string, DayCount> {
  const counts = new Map<string, DayCount>();
  for (const t of tasks) {
    if (!t.date) continue;
    const c = counts.get(t.date) ?? { total: 0, done: 0 };
    c.total += 1;
    if (t.done) c.done += 1;
    counts.set(t.date, c);
  }
  return counts;
}

export const hourOf = (t: Pick<Task, "time">) => Number((t.time ?? "00:00").slice(0, 2));

export const DEFAULT_HOURS: [number, number] = [6, 22];

/** Horas que se muestran: 6:00 a 22:00, ampliadas si hay actividades fuera de ese rango; o las 24. */
export function hourRange(timed: Pick<Task, "time">[], all: boolean): number[] {
  const hours = timed.map(hourOf);
  const from = all ? 0 : Math.min(DEFAULT_HOURS[0], ...hours);
  const to = all ? 23 : Math.max(DEFAULT_HOURS[1], ...hours);
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
