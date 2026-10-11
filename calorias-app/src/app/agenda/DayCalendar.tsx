"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Card, Segmented, cx } from "@/components/ui";
import { byTime, dayCounts, hourOf, hourRange, monthGrid, shiftMonth } from "@/lib/agenda";
import { longDate } from "@/lib/dates";
import type { Task } from "@/lib/types";

type CalView = "horas" | "mes";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const monthFmt = new Intl.DateTimeFormat("es", { month: "long", year: "numeric" });
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

/**
 * Calendario de la agenda: las horas del día elegido con cada actividad en su hora, o el mes con un
 * punto en los días que tienen actividades (al tocar un día se ven sus horas).
 */
export function DayCalendar({
  date,
  today,
  tasks,
  onPickDate,
  onAdd,
  onEdit,
}: {
  date: string;
  today: string;
  tasks: Task[];
  onPickDate: (date: string) => void;
  /** crear una actividad en esa fecha y hora (HH:MM) */
  onAdd: (date: string, time: string) => void;
  onEdit: (t: Task) => void;
}) {
  const [view, setView] = useState<CalView>("horas");
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Calendario</h2>
        <Segmented
          label="Vista del calendario"
          value={view}
          onChange={setView}
          className="w-44"
          options={[
            { id: "horas", label: "Horas" },
            { id: "mes", label: "Mes" },
          ]}
        />
      </div>
      {view === "horas" ? (
        <Hours date={date} tasks={tasks} onAdd={onAdd} onEdit={onEdit} />
      ) : (
        <Month
          date={date}
          today={today}
          tasks={tasks}
          onPick={(d) => {
            onPickDate(d);
            setView("horas");
          }}
        />
      )}
    </Card>
  );
}

function Hours({
  date,
  tasks,
  onAdd,
  onEdit,
}: {
  date: string;
  tasks: Task[];
  onAdd: (date: string, time: string) => void;
  onEdit: (t: Task) => void;
}) {
  const [all, setAll] = useState(false);
  const day = tasks.filter((t) => t.date === date);
  const timed = day.filter((t) => t.time);
  const untimed = day.filter((t) => !t.time).sort((a, b) => a.createdAt - b.createdAt);
  const hours = hourRange(timed, all);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">{longDate(date)} · toca una hora vacía para agregar algo ahí</p>
      {untimed.length > 0 ? (
        <div className="flex items-start gap-3 rounded-2xl bg-field p-2">
          <span className="w-12 shrink-0 pt-1 text-xs font-medium text-ink-2">Todo el día</span>
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {untimed.map((t) => (
              <Block key={t.id} task={t} onEdit={onEdit} compact />
            ))}
          </div>
        </div>
      ) : null}
      <ol className="divide-y divide-border" aria-label="Horas del día">
        {hours.map((h) => {
          const items = timed.filter((t) => hourOf(t) === h).sort(byTime);
          return (
            <li key={h} className="flex items-stretch gap-3" aria-label={hh(h)}>
              <span className="tabular w-12 shrink-0 pt-3 text-xs text-muted">{hh(h)}</span>
              <div className="min-w-0 flex-1 space-y-1 py-1">
                {items.length > 0 ? (
                  items.map((t) => <Block key={t.id} task={t} onEdit={onEdit} />)
                ) : (
                  <button
                    type="button"
                    onClick={() => onAdd(date, hh(h))}
                    aria-label={`Agregar a las ${hh(h)}`}
                    className="flex h-9 w-full items-center justify-end rounded-xl pr-2 text-muted/60 hover:bg-field hover:text-ink"
                  >
                    <Plus className="size-4" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        onClick={() => setAll(!all)}
        className="w-full text-center text-sm font-semibold text-accent-text"
      >
        {all ? "Ver menos horas" : "Ver las 24 horas"}
      </button>
    </div>
  );
}

function Block({ task, onEdit, compact }: { task: Task; onEdit: (t: Task) => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onEdit(task)}
      aria-label={`Ver ${task.title}${task.time ? ` de las ${task.time}` : ""}`}
      className={cx(
        "flex min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm",
        task.done ? "bg-field text-muted ring-1 ring-border" : "bg-accent-soft text-ink ring-1 ring-accent/40",
        compact ? "max-w-full" : "w-full",
      )}
    >
      {task.time ? <span className="tabular shrink-0 font-semibold">{task.time}</span> : null}
      <span className={cx("min-w-0 flex-1 break-words", task.done && "line-through")}>{task.title}</span>
    </button>
  );
}

function Month({
  date,
  today,
  tasks,
  onPick,
}: {
  date: string;
  today: string;
  tasks: Task[];
  onPick: (date: string) => void;
}) {
  // El mes que se ve sigue al día elegido hasta que se navega a otro.
  const [shown, setShown] = useState<string | null>(null);
  const anchor = shown ?? date;
  const cells = monthGrid(anchor);
  const counts = dayCounts(tasks);
  const label = monthFmt.format(new Date(Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)) - 1, 1));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShown(shiftMonth(anchor, -1))}
          aria-label="Mes anterior"
          className="grid size-10 place-items-center rounded-full hover:bg-field"
        >
          <ChevronLeft className="size-5" />
        </button>
        <p className="font-semibold first-letter:uppercase" aria-live="polite">
          {label}
        </p>
        <button
          type="button"
          onClick={() => setShown(shiftMonth(anchor, 1))}
          aria-label="Mes siguiente"
          className="grid size-10 place-items-center rounded-full hover:bg-field"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted" aria-hidden>
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c) => {
          const n = counts.get(c.date);
          const pending = n ? n.total - n.done : 0;
          const selected = c.date === date;
          const day = Number(c.date.slice(8));
          return (
            <button
              key={c.date}
              type="button"
              onClick={() => onPick(c.date)}
              aria-pressed={selected}
              aria-current={c.date === today ? "date" : undefined}
              aria-label={`${longDate(c.date)}${n ? `: ${n.total} ${n.total === 1 ? "actividad" : "actividades"}${n.done ? `, ${n.done} ${n.done === 1 ? "hecha" : "hechas"}` : ""}` : ""}`}
              className={cx(
                "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl text-sm tabular transition",
                selected ? "bg-accent font-semibold text-accent-ink" : "bg-field hover:brightness-95",
                !selected && !c.inMonth && "text-muted/60",
                c.date === today && !selected && "ring-2 ring-accent",
              )}
            >
              <span>{day}</span>
              <span className="flex h-1.5 items-center gap-0.5" aria-hidden>
                {n
                  ? Array.from({ length: Math.min(3, n.total) }, (_, i) => (
                      <span
                        key={i}
                        className={cx(
                          "size-1.5 rounded-full",
                          selected ? "bg-accent-ink" : pending > 0 ? "bg-accent" : "bg-muted",
                        )}
                      />
                    ))
                  : null}
              </span>
            </button>
          );
        })}
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-accent" aria-hidden /> con pendientes
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-muted" aria-hidden /> todo hecho
        </span>
        <span className="basis-full">Toca un día para ver sus horas.</span>
      </p>
    </div>
  );
}
