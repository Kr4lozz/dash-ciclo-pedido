"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronDown, Copy, Dumbbell, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { Button, Card, PageHeader, Segmented, buttonClass, cx } from "@/components/ui";
import { dateLabel, longDate } from "@/lib/dates";
import { fmt } from "@/lib/format";
import { EXERCISE_CATALOG, ROUTINE_TEMPLATES } from "@/lib/gym-data";
import { chronological, exerciseNames, fmtMinutes, timeUnit, workoutTotals } from "@/lib/gym";
import {
  draftFromRoutine,
  newDraft,
  setDraft,
  toWorkoutExercises,
  useDraft,
  type Draft,
} from "@/lib/gym-draft";
import { deleteRoutine, saveRoutine, useAppData, useSelectedDate } from "@/lib/store";
import { toast } from "@/lib/toast";
import { muscleLabel, type Routine, type RoutineExercise, type Workout } from "@/lib/types";

type Tab = "entrenar" | "rutinas" | "historial";
const TABS: Tab[] = ["entrenar", "rutinas", "historial"];

export function GymHub() {
  const param = useSearchParams().get("tab");
  const [tab, setTab] = useState<Tab>(() => (TABS.includes(param as Tab) ? (param as Tab) : "entrenar"));
  const router = useRouter();
  const data = useAppData();
  const date = useSelectedDate();
  const draft = useDraft();

  /** Empieza un entrenamiento; si ya hay uno en curso, pregunta antes de reemplazarlo. */
  function begin(next: Draft) {
    if (draft && !confirm("Ya tienes un entrenamiento en curso. ¿Descartarlo y empezar uno nuevo?")) return;
    setDraft(next);
    router.push("/gym/entrenar");
  }

  return (
    <>
      <PageHeader title="Gym" back={null} />
      <main className="space-y-4 px-4">
        <Segmented
          label="Sección"
          value={tab}
          onChange={setTab}
          options={[
            { id: "entrenar", label: "Entrenar" },
            { id: "rutinas", label: "Rutinas" },
            { id: "historial", label: "Historial" },
          ]}
        />

        {tab === "entrenar" ? (
          <TrainTab
            draft={draft}
            routines={data.routines}
            workouts={data.workouts}
            date={date}
            onFree={() => begin(newDraft(date))}
            onRoutine={(r) => begin(draftFromRoutine(r, data.workouts, date))}
            onNewRoutine={() => setTab("rutinas")}
          />
        ) : null}
        {tab === "rutinas" ? (
          <RoutinesTab
            routines={data.routines}
            onStart={(r) => begin(draftFromRoutine(r, data.workouts, date))}
          />
        ) : null}
        {tab === "historial" ? <HistoryTab workouts={data.workouts} /> : null}
      </main>
    </>
  );
}

// ---------- Entrenar ----------

function TrainTab({
  draft,
  routines,
  workouts,
  date,
  onFree,
  onRoutine,
  onNewRoutine,
}: {
  draft: Draft | null;
  routines: Routine[];
  workouts: Workout[];
  date: string;
  onFree: () => void;
  onRoutine: (r: Routine) => void;
  onNewRoutine: () => void;
}) {
  const router = useRouter();
  const today = workouts.filter((w) => w.date === date);
  // Las mismas series que cuenta el resumen al terminar (fuerza y peso corporal).
  const done = draft ? workoutTotals({ exercises: toWorkoutExercises(draft, { onlyDone: true }) }) : null;

  return (
    <>
      {draft ? (
        <section aria-label="Entrenamiento en curso" className="space-y-3 rounded-3xl bg-accent-soft p-4 ring-1 ring-accent">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-text">Entrenamiento en curso</p>
            <h2 className="mt-0.5 text-lg font-bold leading-snug">{draft.name || "Entrenamiento"}</h2>
            <p className="text-sm text-ink-2">
              {draft.exercises.length} {draft.exercises.length === 1 ? "ejercicio" : "ejercicios"} ·{" "}
              {done?.sets ?? 0} {done?.sets === 1 ? "serie hecha" : "series hechas"} · desde las{" "}
              {new Date(draft.startedAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => router.push("/gym/entrenar")}>
              <Play className="size-5" /> Continuar
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (confirm("¿Descartar este entrenamiento? Se pierden las series que anotaste.")) setDraft(null);
              }}
            >
              Descartar
            </Button>
          </div>
        </section>
      ) : (
        <Card className="space-y-3">
          <div>
            <h2 className="text-lg font-bold">¿Qué entrenas hoy?</h2>
            <p className="text-sm text-ink-2">
              Anota cada serie con su peso. Empieza libre o con una de tus rutinas.
            </p>
          </div>
          <Button className="w-full" onClick={onFree}>
            <Dumbbell className="size-5" /> Entrenamiento libre
          </Button>
        </Card>
      )}

      <section aria-label="Tus rutinas" className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-2">Empezar con una rutina</h2>
        {routines.length > 0 ? (
          routines.map((r) => (
            <Card key={r.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.name}</p>
                <p className="truncate text-xs text-muted">{routineMeta(r)}</p>
              </div>
              <Button variant="secondary" aria-label={`Empezar ${r.name}`} onClick={() => onRoutine(r)}>
                <Play className="size-4" /> Empezar
              </Button>
            </Card>
          ))
        ) : (
          <Card className="space-y-2">
            <p className="text-sm text-ink-2">
              Todavía no tienes rutinas. Crea una o agrega una sugerida para empezar con un toque.
            </p>
            <Button variant="secondary" className="w-full" onClick={onNewRoutine}>
              Ver rutinas
            </Button>
          </Card>
        )}
      </section>

      {today.length > 0 ? (
        <section aria-label="Entrenamientos del día" className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-2">
            {dateLabel(date) === "Hoy" ? "Hecho hoy" : `Hecho ${dateLabel(date).toLowerCase()}`}
          </h2>
          {today.map((w) => (
            <WorkoutRow key={w.id} w={w} showDate={false} />
          ))}
        </section>
      ) : null}
    </>
  );
}

/** "5 ejercicios · 16 series · Pecho, Hombros" */
function routineMeta(r: Routine): string {
  const sets = r.exercises.reduce((n, e) => n + e.sets, 0);
  const groups = [...new Set(r.exercises.map((e) => muscleLabel(e.muscle)))].slice(0, 3);
  return `${r.exercises.length} ${r.exercises.length === 1 ? "ejercicio" : "ejercicios"} · ${sets} series${
    groups.length ? ` · ${groups.join(", ")}` : ""
  }`;
}

// ---------- Rutinas ----------

function target(e: RoutineExercise): string {
  if (e.mode === "tiempo") {
    const time = timeUnit(e.muscle) === "min" ? `${Math.round(e.sec / 60)} min` : `${e.sec} s`;
    return e.sets > 1 ? `${e.sets} × ${time}` : time;
  }
  return `${e.sets} × ${e.reps}`;
}

function RoutinesTab({ routines, onStart }: { routines: Routine[]; onStart: (r: Routine) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const router = useRouter();

  function addTemplate(id: string) {
    const t = ROUTINE_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    const exercises: RoutineExercise[] = t.items.flatMap((it) => {
      const ex = EXERCISE_CATALOG.find((x) => x.id === it.id);
      return ex
        ? [{ exerciseId: ex.id, name: ex.name, muscle: ex.muscle, mode: ex.mode, sets: it.sets, reps: it.reps, sec: it.sec ?? 0 }]
        : [];
    });
    if (saveRoutine({ name: t.name, note: t.description, exercises })) toast(`«${t.name}» agregada a tus rutinas`);
  }

  return (
    <>
      <Link href="/gym/rutina" className={buttonClass("primary", "w-full")}>
        <Plus className="size-5" /> Nueva rutina
      </Link>

      <section aria-label="Mis rutinas" className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-2">Mis rutinas</h2>
        {routines.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-2">
              Aquí aparecen las rutinas que guardes. Crea una desde cero, guárdala al terminar un entrenamiento
              libre o agrega una sugerida abajo.
            </p>
          </Card>
        ) : (
          routines.map((r) => (
            <Card key={r.id} className="space-y-3">
              <button
                type="button"
                aria-expanded={open === r.id}
                onClick={() => setOpen(open === r.id ? null : r.id)}
                className="flex w-full items-start gap-2 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-snug">{r.name}</span>
                  <span className="block text-xs text-muted">{routineMeta(r)}</span>
                </span>
                <ChevronDown className={cx("mt-1 size-5 shrink-0 text-muted transition", open === r.id && "rotate-180")} aria-hidden />
              </button>
              {open === r.id ? (
                <ul className="divide-y divide-border rounded-2xl bg-field px-3 text-sm">
                  {r.exercises.map((e, i) => (
                    <li key={i} className="flex items-center gap-3 py-2">
                      <span className="min-w-0 flex-1 font-medium">{e.name}</span>
                      <span className="tabular text-ink-2">{target(e)}</span>
                    </li>
                  ))}
                  {r.note ? <li className="py-2 text-xs text-muted">{r.note}</li> : null}
                </ul>
              ) : null}
              <div className="flex items-center gap-2">
                <Button className="flex-1" aria-label={`Empezar ${r.name}`} onClick={() => onStart(r)}>
                  <Play className="size-4" /> Empezar
                </Button>
                <IconButton label={`Editar ${r.name}`} onClick={() => router.push(`/gym/rutina?id=${r.id}`)}>
                  <Pencil className="size-5" />
                </IconButton>
                <IconButton
                  label={`Duplicar ${r.name}`}
                  onClick={() => {
                    const copy = saveRoutine({ name: `${r.name} (copia)`.slice(0, 80), note: r.note, exercises: r.exercises });
                    if (copy) toast("Rutina duplicada");
                  }}
                >
                  <Copy className="size-5" />
                </IconButton>
                <IconButton
                  label={`Eliminar ${r.name}`}
                  danger
                  onClick={() => {
                    if (confirm(`¿Eliminar la rutina «${r.name}»? Tus entrenamientos anteriores no cambian.`)) {
                      deleteRoutine(r.id);
                      toast("Rutina eliminada");
                    }
                  }}
                >
                  <Trash2 className="size-5" />
                </IconButton>
              </div>
            </Card>
          ))
        )}
      </section>

      <section aria-label="Rutinas sugeridas" className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-2">Rutinas sugeridas</h2>
        {ROUTINE_TEMPLATES.map((t) => {
          const added = routines.some((r) => r.name === t.name);
          return (
            <Card key={t.id} className="space-y-2">
              <button
                type="button"
                aria-expanded={open === `t-${t.id}`}
                onClick={() => setOpen(open === `t-${t.id}` ? null : `t-${t.id}`)}
                className="flex w-full items-start gap-2 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-snug">{t.name}</span>
                  <span className="block text-xs text-muted">{t.description}</span>
                </span>
                <ChevronDown className={cx("mt-1 size-5 shrink-0 text-muted transition", open === `t-${t.id}` && "rotate-180")} aria-hidden />
              </button>
              {open === `t-${t.id}` ? (
                <ul className="divide-y divide-border rounded-2xl bg-field px-3 text-sm">
                  {t.items.map((it) => {
                    const ex = EXERCISE_CATALOG.find((x) => x.id === it.id);
                    return ex ? (
                      <li key={it.id} className="flex items-center gap-3 py-2">
                        <span className="min-w-0 flex-1 font-medium">{ex.name}</span>
                        <span className="tabular text-ink-2">
                          {ex.mode === "tiempo"
                            ? timeUnit(ex.muscle) === "min"
                              ? `${Math.round((it.sec ?? 0) / 60)} min`
                              : `${it.sets} × ${it.sec} s`
                            : `${it.sets} × ${it.reps}`}
                        </span>
                      </li>
                    ) : null;
                  })}
                </ul>
              ) : null}
              <Button
                variant="secondary"
                className="w-full"
                disabled={added}
                aria-label={added ? `${t.name} ya está en tus rutinas` : `Agregar ${t.name} a mis rutinas`}
                onClick={() => addTemplate(t.id)}
              >
                {added ? "Ya está en tus rutinas" : "Agregar a mis rutinas"}
              </Button>
            </Card>
          );
        })}
      </section>
    </>
  );
}

function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cx(
        "grid size-11 shrink-0 place-items-center rounded-2xl bg-field ring-1 ring-border hover:brightness-95",
        danger ? "text-danger-text" : "text-ink-2",
      )}
    >
      {children}
    </button>
  );
}

// ---------- Historial ----------

const PAGE = 20;

function HistoryTab({ workouts }: { workouts: Workout[] }) {
  const [shown, setShown] = useState(PAGE);
  const sorted = useMemo(() => chronological(workouts).reverse(), [workouts]);

  if (sorted.length === 0) {
    return (
      <Card className="space-y-1">
        <p className="font-semibold">Todavía no hay entrenamientos</p>
        <p className="text-sm text-ink-2">Cuando termines uno, aparece aquí con sus pesos y series.</p>
      </Card>
    );
  }
  return (
    <>
      {sorted.slice(0, shown).map((w) => (
        <WorkoutRow key={w.id} w={w} showDate />
      ))}
      {sorted.length > shown ? (
        <Button variant="secondary" className="w-full" onClick={() => setShown(shown + PAGE)}>
          Ver {Math.min(PAGE, sorted.length - shown)} más
        </Button>
      ) : null}
    </>
  );
}

function WorkoutRow({ w, showDate }: { w: Workout; showDate: boolean }) {
  const t = workoutTotals(w);
  return (
    <Link
      href={`/gym/entrenar?sesion=${w.id}`}
      className="block rounded-3xl bg-card p-4 ring-1 ring-border hover:brightness-[0.98]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 truncate font-semibold">{w.name}</h3>
        {showDate ? <span className="shrink-0 text-xs text-muted">{longDate(w.date)}</span> : null}
      </div>
      <p className="mt-0.5 truncate text-sm text-ink-2">{exerciseNames(w)}</p>
      <p className="tabular mt-1 text-xs text-muted">
        {[
          `${w.exercises.length} ${w.exercises.length === 1 ? "ejercicio" : "ejercicios"}`,
          t.sets > 0 ? `${t.sets} ${t.sets === 1 ? "serie" : "series"}` : null,
          t.volume > 0 ? `${fmt(t.volume)} kg` : null,
          t.cardioSeconds > 0 ? `cardio ${fmtMinutes(t.cardioSeconds / 60)}` : null,
          w.minutes ? fmtMinutes(w.minutes) : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </Link>
  );
}
