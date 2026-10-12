"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CalendarCheck, Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button, Card, PageHeader, Segmented, cx } from "@/components/ui";
import { byTime, carried, tasksOn, tomorrow, upcoming } from "@/lib/agenda";
import { addDays, dateLabel, isValidDateStr, longDate, todayStr } from "@/lib/dates";
import { toggleTask, useAppData } from "@/lib/store";
import type { Task } from "@/lib/types";
import { DayCalendar } from "./DayCalendar";
import { TaskSheet, type TaskDraft } from "./TaskSheet";

type View = "dia" | "proximos";

const toDraft = (t: Task, focusDate = false): TaskDraft => ({ id: t.id, title: t.title, date: t.date, time: t.time ?? "", note: t.note, focusDate });

/** Agenda: lo que quieres hacer cada día (con su hora), lo que ya hiciste y lo que dejas para más adelante. */
export function AgendaScreen() {
  const data = useAppData();
  const today = todayStr();
  const [view, setView] = useState<View>("dia");
  const fromLink = useSearchParams().get("fecha");
  const [date, setDate] = useState(isValidDateStr(fromLink) ? fromLink : today);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  // Con la pantalla abierta pasa la medianoche: si se estaba viendo «hoy», se pasa al nuevo día.
  const [seenToday, setSeenToday] = useState(today);
  if (seenToday !== today) {
    setSeenToday(today);
    if (date === seenToday) setDate(today);
  }

  const add = (d: string | null, time = "") => setDraft({ title: "", date: d, time, note: "" });

  return (
    <>
      <PageHeader title="Agenda" back={null} />
      <main className="space-y-4 px-4">
        <Segmented
          label="Vista de la agenda"
          value={view}
          onChange={setView}
          options={[
            { id: "dia", label: "Día" },
            { id: "proximos", label: "Próximos" },
          ]}
        />
        {view === "dia" ? (
          <DayView
            date={date}
            setDate={setDate}
            today={today}
            tasks={data.tasks}
            onAdd={() => add(date)}
            onAddAt={(d, time) => add(d, time)}
            onEdit={(t, focusDate) => setDraft(toDraft(t, focusDate))}
          />
        ) : (
          <UpcomingView today={today} tasks={data.tasks} onAdd={() => add(tomorrow(today))} onEdit={(t, focusDate) => setDraft(toDraft(t, focusDate))} />
        )}
      </main>
      <TaskSheet draft={draft} onClose={() => setDraft(null)} routines={data.routines.map((r) => r.name)} />
    </>
  );
}

function DayView({
  date,
  setDate,
  today,
  tasks,
  onAdd,
  onAddAt,
  onEdit,
}: {
  date: string;
  setDate: (d: string) => void;
  today: string;
  tasks: Task[];
  onAdd: () => void;
  onAddAt: (date: string, time: string) => void;
  /** abrir la actividad; con `focusDate` la hoja se abre en el campo de la fecha */
  onEdit: (t: Task, focusDate?: boolean) => void;
}) {
  const day = tasksOn(tasks, date);
  const pending = day.filter((t) => !t.done).sort(byTime);
  const done = day.filter((t) => t.done).sort((a, b) => (a.doneAt ?? 0) - (b.doneAt ?? 0));
  const late = carried(tasks, date);
  const pct = day.length > 0 ? done.length / day.length : 0;

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setDate(addDays(date, -1))}
          aria-label="Día anterior"
          className="grid size-10 place-items-center rounded-full hover:bg-card"
        >
          <ChevronLeft className="size-6" />
        </button>
        <div className="relative flex-1 text-center">
          <p className="text-xl font-bold tracking-tight">{dateLabel(date)}</p>
          <p className="text-xs text-muted">{longDate(date)}</p>
          <input
            type="date"
            aria-label="Elegir fecha"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </div>
        <button
          type="button"
          onClick={() => setDate(addDays(date, 1))}
          aria-label="Día siguiente"
          className="grid size-10 place-items-center rounded-full hover:bg-card"
        >
          <ChevronRight className="size-6" />
        </button>
      </div>
      {date !== today ? (
        <button type="button" onClick={() => setDate(today)} className="-mt-2 w-full text-center text-sm font-semibold text-accent-text">
          Ir a hoy
        </button>
      ) : null}

      <Button className="w-full" onClick={onAdd}>
        <Plus className="size-5" /> Agregar actividad
      </Button>

      {day.length > 0 ? (
        <div role="status" className="space-y-1.5 rounded-3xl bg-card p-4 ring-1 ring-border">
          <p className="text-sm">
            <span className="font-semibold">{done.length}</span> de {day.length}{" "}
            {day.length === 1 ? "hecha" : "hechas"}
          </p>
          <div className="h-2.5 overflow-hidden rounded-full bg-accent-soft" aria-hidden>
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct * 100}%` }} />
          </div>
        </div>
      ) : null}

      {late.length > 0 ? (
        <div role="status" className="rounded-3xl bg-accent-soft p-4 text-sm ring-1 ring-accent/40">
          <p className="font-semibold">
            {late.length === 1 ? "Pasó a este día 1 actividad" : `Pasaron a este día ${late.length} actividades`} que no
            marcaste
          </p>
          <p className="text-ink-2">Cámbiales la fecha si prefieres hacerlas otro día, o márcalas cuando las cumplas.</p>
        </div>
      ) : null}

      {day.length === 0 ? (
        <Card className="space-y-2 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-accent-soft text-accent-text">
            <CalendarCheck className="size-6" />
          </div>
          <p className="font-semibold">Nada planeado para este día</p>
          <p className="text-sm text-ink-2">
            Anota lo que quieres hacer, con su hora si la tienes, y márcalo cuando lo cumplas.
          </p>
        </Card>
      ) : null}

      {pending.length > 0 ? (
        <Card className="space-y-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-2">Por hacer</h2>
          <ul className="divide-y divide-border">
            {pending.map((t) => (
              <TaskRow key={t.id} task={t} onEdit={() => onEdit(t)} onReschedule={() => onEdit(t, true)} />
            ))}
          </ul>
        </Card>
      ) : null}

      {done.length > 0 ? (
        <Card className="space-y-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-2">Hechas</h2>
          <ul className="divide-y divide-border">
            {done.map((t) => (
              <TaskRow key={t.id} task={t} onEdit={() => onEdit(t)} />
            ))}
          </ul>
        </Card>
      ) : null}

      <DayCalendar date={date} today={today} tasks={tasks} onPickDate={setDate} onAdd={onAddAt} onEdit={onEdit} />
    </>
  );
}

function UpcomingView({ today, tasks, onAdd, onEdit }: { today: string; tasks: Task[]; onAdd: () => void; onEdit: (t: Task, focusDate?: boolean) => void }) {
  const groups = upcoming(tasks, today);
  return (
    <>
      <Button className="w-full" onClick={onAdd}>
        <Plus className="size-5" /> Agregar actividad
      </Button>
      {groups.length === 0 ? (
        <Card className="space-y-2 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-accent-soft text-accent-text">
            <CalendarCheck className="size-6" />
          </div>
          <p className="font-semibold">Todavía no hay nada para más adelante</p>
          <p className="text-sm text-ink-2">
            Anota lo que quieras hacer otro día, o déjalo sin fecha como un objetivo para más adelante.
          </p>
        </Card>
      ) : (
        groups.map((g) => (
          <Card key={g.date ?? "sin-fecha"} className="space-y-1">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-2">
              {g.label}
              {g.date && g.label !== longDate(g.date) ? <span className="ml-1 font-normal normal-case text-muted">· {longDate(g.date)}</span> : null}
            </h2>
            <ul className="divide-y divide-border">
              {g.tasks.map((t) => (
                <TaskRow key={t.id} task={t} onEdit={() => onEdit(t)} onReschedule={() => onEdit(t, true)} />
              ))}
            </ul>
          </Card>
        ))
      )}
    </>
  );
}

function TaskRow({
  task,
  onEdit,
  onReschedule,
  children,
}: {
  task: Task;
  onEdit: () => void;
  /** abre la actividad en la fecha (para las que pasaron solas de un día anterior) */
  onReschedule?: () => void;
  children?: React.ReactNode;
}) {
  // Pendiente que pasó sola de un día anterior: se dice de cuándo venía y se ofrece cambiarle la fecha.
  const from = !task.done && task.movedFrom ? `desde ${dateLabel(task.movedFrom).toLowerCase()}` : "";
  return (
    <li className="flex items-center gap-3 py-2">
      <button
        type="button"
        aria-pressed={task.done}
        aria-label={task.done ? `Desmarcar ${task.title}` : `Marcar ${task.title} como hecha`}
        onClick={() => toggleTask(task.id)}
        className={cx(
          "grid size-11 shrink-0 place-items-center rounded-full ring-1 transition",
          task.done ? "bg-accent text-accent-ink ring-accent" : "bg-field text-transparent ring-border hover:text-muted",
        )}
      >
        <Check className="size-5" />
      </button>
      <button type="button" onClick={onEdit} aria-label={`Editar ${task.title}`} className="min-w-0 flex-1 py-1 text-left">
        <span className={cx("block break-words font-medium", task.done && "text-muted line-through")}>{task.title}</span>
        {task.note || from ? (
          <span className="block truncate text-xs text-muted">{[from, task.note].filter(Boolean).join(" · ")}</span>
        ) : null}
      </button>
      {from && onReschedule ? (
        <button
          type="button"
          onClick={onReschedule}
          aria-label={`Cambiar la fecha de ${task.title}`}
          className="shrink-0 text-sm font-semibold text-accent-text"
        >
          Cambiar fecha
        </button>
      ) : null}
      {task.time ? (
        <span className="tabular shrink-0 rounded-full bg-field px-2.5 py-1 text-xs font-semibold text-ink-2">{task.time}</span>
      ) : null}
      {children}
    </li>
  );
}
