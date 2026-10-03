"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, EllipsisVertical, Plus, StickyNote, Trash2, X } from "lucide-react";
import { ExercisePicker } from "@/components/ExercisePicker";
import { Sheet } from "@/components/Sheet";
import { Button, Card, NumberInput, PageHeader, Segmented, TextInput, buttonClass, cx } from "@/components/ui";
import { dateLabel, isValidDateStr, todayStr } from "@/lib/dates";
import { fmt, parseNum } from "@/lib/format";
import {
  fmtKg,
  fmtMinutes,
  gymCalories,
  lastSets,
  newRecordsIn,
  summarizeSets,
  timeUnit,
  workoutTotals,
} from "@/lib/gym";
import {
  REST_OPTIONS,
  doneSets,
  draftFromWorkout,
  newDraftExercise,
  readRestSeconds,
  routineExercisesFrom,
  saveRestSeconds,
  setDraft,
  setHasData,
  toWorkoutExercises,
  unmarkedSets,
  useDraft,
  type Draft,
  type DraftExercise,
  type DraftSet,
} from "@/lib/gym-draft";
import {
  addExercise,
  deleteWorkout,
  saveRoutine,
  saveWorkout,
  useAppData,
} from "@/lib/store";
import { toast } from "@/lib/toast";
import { muscleLabel, type GymExercise, type Workout } from "@/lib/types";

/** La hora actual, para usarla dentro de los manejadores de eventos. */
const currentTime = () => Date.now();

export function WorkoutScreen() {
  const id = useSearchParams().get("sesion");
  return id ? <EditSaved id={id} /> : <Live />;
}

// ---------- Entrenamiento en curso ----------

function Live() {
  const draft = useDraft();
  const [leaving, setLeaving] = useState(false);
  if (leaving) return null;
  if (!draft) {
    return (
      <>
        <PageHeader title="Entrenando" back="/gym" />
        <main className="px-4">
          <Card className="space-y-3 text-center">
            <p className="font-semibold">No hay un entrenamiento en curso</p>
            <p className="text-sm text-ink-2">Empieza uno desde Gym: libre o con una de tus rutinas.</p>
            <Link href="/gym" className={buttonClass("primary", "w-full")}>
              Ir a Gym
            </Link>
          </Card>
        </main>
      </>
    );
  }
  return <Editor draft={draft} onChange={setDraft} live onLeave={() => setLeaving(true)} />;
}

// ---------- Entrenamiento guardado ----------

function EditSaved({ id }: { id: string }) {
  const data = useAppData();
  const workout = data.workouts.find((w) => w.id === id);
  const [draft, setLocal] = useState<Draft | null>(() => (workout ? draftFromWorkout(workout) : null));
  const [leaving, setLeaving] = useState(false);
  if (leaving) return null;
  if (!workout || !draft) {
    return (
      <>
        <PageHeader title="Entrenamiento" back="/gym?tab=historial" />
        <main className="px-4">
          <Card className="space-y-3 text-center">
            <p className="font-semibold">No encontramos este entrenamiento</p>
            <Link href="/gym?tab=historial" className={buttonClass("primary", "w-full")}>
              Ver historial
            </Link>
          </Card>
        </main>
      </>
    );
  }
  return <Editor draft={draft} onChange={setLocal} editing={workout} onLeave={() => setLeaving(true)} />;
}

// ---------- Editor (los dos casos) ----------

const patchSetIn = (ex: DraftExercise, i: number, patch: Partial<DraftSet>): DraftExercise => ({
  ...ex,
  sets: ex.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)),
});

function Editor({
  draft,
  onChange,
  live = false,
  editing,
  onLeave,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  live?: boolean;
  /** el entrenamiento guardado que se corrige */
  editing?: Workout;
  onLeave: () => void;
}) {
  const router = useRouter();
  const data = useAppData();
  const [now, setNow] = useState(() => Date.now());
  const [picker, setPicker] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [openNotes, setOpenNotes] = useState<string[]>([]);
  const [finishing, setFinishing] = useState(false);
  const [restSec, setRestSec] = useState(readRestSeconds);
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null);

  // Reloj del entrenamiento (cada 15 s alcanza para minutos).
  useEffect(() => {
    if (!live) return;
    const tick = () => setNow(Date.now());
    const t = setInterval(tick, 15_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [live]);

  // Cuenta regresiva del descanso.
  useEffect(() => {
    if (!rest) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= rest.until) {
        setRest(null);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([200, 100, 200]);
      }
    }, 250);
    return () => clearInterval(t);
  }, [rest]);

  const totals = useMemo(() => workoutTotals({ exercises: toWorkoutExercises(draft, { onlyDone: true }) }), [draft]);
  const elapsed = live ? Math.max(0, Math.round((now - draft.startedAt) / 60_000)) : (editing?.minutes ?? 0);
  const weightKg = data.profile?.weightKg ?? 70;

  const patchExercise = (key: string, fn: (ex: DraftExercise) => DraftExercise) =>
    onChange({ ...draft, exercises: draft.exercises.map((ex) => (ex.key === key ? fn(ex) : ex)) });

  function toggleDone(ex: DraftExercise, i: number) {
    const s = ex.sets[i];
    if (!s.done && !setHasData(s, ex)) return;
    patchExercise(ex.key, (e) => patchSetIn(e, i, { done: !s.done }));
    if (!s.done && live && restSec > 0) {
      const n = currentTime();
      setNow(n);
      setRest({ until: n + restSec * 1000, total: restSec });
    }
  }

  function addPicked(picked: GymExercise[]) {
    const before = editing;
    onChange({
      ...draft,
      exercises: [
        ...draft.exercises,
        ...picked.map((x) => newDraftExercise(x, data.workouts, before)),
      ],
    });
  }

  function move(key: string, dir: -1 | 1) {
    const i = draft.exercises.findIndex((x) => x.key === key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= draft.exercises.length) return;
    const list = [...draft.exercises];
    [list[i], list[j]] = [list[j], list[i]];
    onChange({ ...draft, exercises: list });
  }

  function discard() {
    const msg = live
      ? "¿Cancelar este entrenamiento? Se pierden las series que anotaste."
      : "¿Eliminar este entrenamiento? No se puede deshacer.";
    if (!confirm(msg)) return;
    onLeave();
    if (editing) deleteWorkout(editing.id);
    else setDraft(null);
    router.replace(editing ? "/gym?tab=historial" : "/gym");
  }

  function finish(r: FinishResult) {
    const exercises = toWorkoutExercises(draft, { onlyDone: true });
    const saved = saveWorkout({
      id: editing?.id,
      createdAt: editing?.createdAt,
      date: r.date,
      name: r.name,
      routineId: draft.routineId,
      minutes: r.minutes,
      note: r.note,
      exercises,
    });
    if (!saved) {
      toast("Marca al menos una serie con ✓ para guardar.", "error");
      return;
    }
    if (r.routineName) saveRoutine({ name: r.routineName, note: "", exercises: routineExercisesFrom(saved.exercises) });
    if (r.addCalories && r.minutes) {
      addExercise({
        date: r.date,
        name: `Gym · ${saved.name}`.slice(0, 120),
        minutes: r.minutes,
        calories: gymCalories(r.minutes, weightKg),
      });
    }
    // Se felicita al terminar un entrenamiento nuevo, no al corregir uno guardado.
    const records = live ? newRecordsIn(data.workouts, saved) : [];
    toast(
      records.length > 0
        ? `🏆 Récord en ${records[0].name}: ${
            records[0].mode === "corporal" ? `${records[0].reps} reps` : `${fmtKg(records[0].kg)} kg`
          }${records.length > 1 ? ` y ${records.length - 1} más` : ""}`
        : live
          ? "Entrenamiento guardado"
          : "Cambios guardados",
    );
    onLeave();
    if (live) setDraft(null);
    // replace: «atrás» no debe volver a la pantalla de un entrenamiento que ya se cerró.
    router.replace("/gym?tab=historial");
  }

  const menuEx = draft.exercises.find((x) => x.key === menuFor) ?? null;
  const menuIndex = menuEx ? draft.exercises.indexOf(menuEx) : -1;
  const remaining = rest ? Math.max(0, Math.ceil((rest.until - now) / 1000)) : 0;

  return (
    <>
      <PageHeader
        title={live ? "Entrenando" : "Editar entrenamiento"}
        back={live ? "/gym" : "/gym?tab=historial"}
        right={
          <button type="button" onClick={() => setFinishing(true)} className={buttonClass("primary", "min-h-10 px-4")}>
            {live ? "Terminar" : "Guardar"}
          </button>
        }
      />
      <main className="space-y-4 px-4">
        <Card className="space-y-3">
          <TextInput
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            placeholder="Nombre del entrenamiento"
            aria-label="Nombre del entrenamiento"
            maxLength={80}
            className="font-semibold"
          />
          <p className="text-xs text-muted">
            Para <span className="font-semibold text-ink-2">{dateLabel(draft.date).toLowerCase()}</span>
          </p>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <Tile label={live ? "Tiempo" : "Duración"} value={elapsed > 0 ? fmtMinutes(elapsed) : "—"} />
            <Tile label="Series" value={String(totals.sets)} />
            <Tile label="Volumen (kg)" value={fmt(totals.volume)} />
          </dl>
          {live ? (
            <div>
              <p className="mb-1.5 text-xs font-medium text-ink-2">Descanso entre series</p>
              <Segmented
                label="Descanso entre series"
                value={String(restSec)}
                onChange={(v) => {
                  const sec = Number(v);
                  setRestSec(sec);
                  saveRestSeconds(sec);
                  if (sec === 0) setRest(null);
                }}
                options={REST_OPTIONS.map((s) => ({
                  id: String(s),
                  label: s === 0 ? "Sin" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`,
                }))}
              />
            </div>
          ) : null}
        </Card>

        {draft.exercises.length === 0 ? (
          <Card className="space-y-3 text-center">
            <p className="font-semibold">Agrega tu primer ejercicio</p>
            <p className="text-sm text-ink-2">Elige del catálogo o crea uno propio, y anota el peso de cada serie.</p>
            <Button className="w-full" onClick={() => setPicker(true)}>
              <Plus className="size-5" /> Agregar ejercicio
            </Button>
          </Card>
        ) : (
          <>
            {draft.exercises.map((ex) => (
              <ExerciseCard
                key={ex.key}
                ex={ex}
                last={(() => {
                  const sets = lastSets(data.workouts, ex.exerciseId, editing);
                  return sets ? summarizeSets(sets, ex) : null;
                })()}
                noteOpen={ex.note !== "" || openNotes.includes(ex.key)}
                onChange={(next) => patchExercise(ex.key, () => next)}
                onToggleDone={(i) => toggleDone(ex, i)}
                onMenu={() => setMenuFor(ex.key)}
              />
            ))}
            <Button variant="secondary" className="w-full" onClick={() => setPicker(true)}>
              <Plus className="size-5" /> Agregar ejercicio
            </Button>
          </>
        )}

        <Button variant="ghost" className="w-full text-danger-text hover:bg-danger-soft" onClick={discard}>
          <Trash2 className="size-4" /> {live ? "Cancelar entrenamiento" : "Eliminar entrenamiento"}
        </Button>
      </main>

      {rest ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-md items-center gap-2 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            <div className="w-[4.25rem] shrink-0">
              <p className="text-xs font-medium text-ink-2">Descanso</p>
              <p className="tabular text-2xl font-semibold leading-tight" role="timer" aria-live="off">
                {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
              </p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-field">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-300"
                  style={{ width: `${Math.min(100, (remaining / rest.total) * 100)}%` }}
                />
              </div>
            </div>
            <div className="flex min-w-0 flex-1 justify-end gap-2">
              <button
                type="button"
                aria-label="Quitar 15 segundos"
                onClick={() => setRest({ ...rest, until: Math.max(currentTime(), rest.until - 15_000) })}
                className="min-h-11 min-w-0 flex-1 rounded-2xl bg-field px-1 text-sm font-semibold ring-1 ring-border hover:brightness-95"
              >
                −15 s
              </button>
              <button
                type="button"
                aria-label="Sumar 15 segundos"
                onClick={() => setRest({ ...rest, until: rest.until + 15_000, total: rest.total + 15 })}
                className="min-h-11 min-w-0 flex-1 rounded-2xl bg-field px-1 text-sm font-semibold ring-1 ring-border hover:brightness-95"
              >
                +15 s
              </button>
              <button
                type="button"
                aria-label="Saltar el descanso"
                onClick={() => setRest(null)}
                className="min-h-11 min-w-0 flex-1 rounded-2xl bg-accent px-1 text-sm font-semibold text-accent-ink hover:brightness-110"
              >
                Saltar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={addPicked} />

      <Sheet open={menuEx !== null} onClose={() => setMenuFor(null)} title={menuEx?.name ?? "Ejercicio"}>
        {menuEx ? (
          <div className="space-y-2">
            <Button
              variant="secondary"
              className="w-full justify-start"
              disabled={menuIndex <= 0}
              onClick={() => {
                move(menuEx.key, -1);
                setMenuFor(null);
              }}
            >
              <ArrowUp className="size-5" /> Subir
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start"
              disabled={menuIndex >= draft.exercises.length - 1}
              onClick={() => {
                move(menuEx.key, 1);
                setMenuFor(null);
              }}
            >
              <ArrowDown className="size-5" /> Bajar
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={() => {
                setOpenNotes((cur) => (cur.includes(menuEx.key) ? cur : [...cur, menuEx.key]));
                setMenuFor(null);
              }}
            >
              <StickyNote className="size-5" /> {menuEx.note ? "Editar nota" : "Agregar nota"}
            </Button>
            <Button
              variant="danger"
              className="w-full justify-start"
              onClick={() => {
                onChange({ ...draft, exercises: draft.exercises.filter((x) => x.key !== menuEx.key) });
                setMenuFor(null);
              }}
            >
              <Trash2 className="size-5" /> Quitar ejercicio
            </Button>
          </div>
        ) : null}
      </Sheet>

      <Sheet open={finishing} onClose={() => setFinishing(false)} title={live ? "Terminar entrenamiento" : "Guardar cambios"}>
        <FinishForm
          draft={draft}
          live={live}
          initialMinutes={live ? elapsed : (editing?.minutes ?? 0)}
          weightKg={weightKg}
          onMarkAll={() =>
            onChange({
              ...draft,
              exercises: draft.exercises.map((ex) => ({
                ...ex,
                sets: ex.sets.map((s) => (setHasData(s, ex) ? { ...s, done: true } : s)),
              })),
            })
          }
          onConfirm={finish}
        />
      </Sheet>
    </>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-field px-1 py-2">
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="tabular mt-0.5 truncate text-base font-semibold">{value}</dd>
    </div>
  );
}

// ---------- Un ejercicio y sus series ----------

const cell =
  "tabular w-full min-w-0 rounded-xl px-1 py-2.5 text-center text-base text-ink ring-1 ring-border placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent";

function ExerciseCard({
  ex,
  last,
  noteOpen,
  onChange,
  onToggleDone,
  onMenu,
}: {
  ex: DraftExercise;
  last: string | null;
  noteOpen: boolean;
  onChange: (ex: DraftExercise) => void;
  onToggleDone: (i: number) => void;
  onMenu: () => void;
}) {
  const timed = ex.mode === "tiempo";
  const unit = timeUnit(ex.muscle);
  const setField = (i: number, patch: Partial<DraftSet>) => onChange(patchSetIn(ex, i, patch));

  return (
    <Card className="space-y-3" as="section">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold leading-snug">{ex.name}</h2>
          <p className="text-xs text-muted">
            {muscleLabel(ex.muscle)}
            {last ? ` · Última vez: ${last}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onMenu}
          aria-label={`Opciones de ${ex.name}`}
          className="-mr-1 grid size-9 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-field"
        >
          <EllipsisVertical className="size-5" />
        </button>
      </div>

      <div
        className={cx(
          "grid items-center gap-2 text-center text-[11px] font-medium text-muted",
          timed ? "grid-cols-[1.5rem_1fr_2.75rem_2rem]" : "grid-cols-[1.5rem_1fr_1fr_2.75rem_2rem]",
        )}
        aria-hidden
      >
        <span>#</span>
        {timed ? null : <span>{ex.mode === "corporal" ? "+kg" : "kg"}</span>}
        <span>{timed ? (unit === "min" ? "Minutos" : "Segundos") : "Reps"}</span>
        <span />
        <span />
      </div>

      <div className="space-y-2">
        {ex.sets.map((s, i) => (
          <div
            key={i}
            role="group"
            aria-label={`Serie ${i + 1}`}
            className={cx(
              "grid items-center gap-2 rounded-2xl",
              timed ? "grid-cols-[1.5rem_1fr_2.75rem_2rem]" : "grid-cols-[1.5rem_1fr_1fr_2.75rem_2rem]",
            )}
          >
            <span className="text-center text-sm font-semibold text-ink-2">{i + 1}</span>
            {timed ? null : (
              <input
                inputMode="decimal"
                autoComplete="off"
                value={s.kg}
                onChange={(e) => setField(i, { kg: e.target.value })}
                placeholder="0"
                aria-label={`Peso de la serie ${i + 1} en kg`}
                className={cx(cell, s.done ? "bg-accent-soft" : "bg-field")}
              />
            )}
            <input
              inputMode="decimal"
              autoComplete="off"
              value={s.reps}
              onChange={(e) => setField(i, { reps: e.target.value })}
              placeholder="0"
              aria-label={timed ? `Duración de la serie ${i + 1}` : `Repeticiones de la serie ${i + 1}`}
              className={cx(cell, s.done ? "bg-accent-soft" : "bg-field")}
            />
            <button
              type="button"
              aria-pressed={s.done}
              aria-label={s.done ? `Desmarcar la serie ${i + 1}` : `Marcar la serie ${i + 1} como hecha`}
              onClick={() => onToggleDone(i)}
              className={cx(
                "grid size-11 place-items-center rounded-xl ring-1 transition",
                s.done ? "bg-accent text-accent-ink ring-accent" : "bg-card text-muted ring-border hover:text-ink",
              )}
            >
              <Check className="size-5" />
            </button>
            <button
              type="button"
              aria-label={`Quitar la serie ${i + 1}`}
              onClick={() => onChange({ ...ex, sets: ex.sets.filter((_, j) => j !== i) })}
              className="grid size-8 place-items-center rounded-full text-muted hover:bg-field hover:text-danger-text"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          const prev = ex.sets[ex.sets.length - 1];
          onChange({ ...ex, sets: [...ex.sets, { kg: prev?.kg ?? "", reps: prev?.reps ?? "", done: false }] });
        }}
        className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-field text-sm font-semibold text-ink-2 ring-1 ring-border hover:text-ink"
      >
        <Plus className="size-4" /> Agregar serie
      </button>

      {noteOpen ? (
        <TextInput
          value={ex.note}
          onChange={(e) => onChange({ ...ex, note: e.target.value })}
          placeholder="Nota (ej. agarre ancho, banco a 30°)"
          aria-label={`Nota de ${ex.name}`}
          maxLength={300}
        />
      ) : null}
    </Card>
  );
}

// ---------- Terminar / guardar ----------

interface FinishResult {
  date: string;
  name: string;
  minutes: number | null;
  note: string;
  /** nombre de la rutina a guardar, si se pidió */
  routineName: string | null;
  addCalories: boolean;
}

function FinishForm({
  draft,
  live,
  initialMinutes,
  weightKg,
  onMarkAll,
  onConfirm,
}: {
  draft: Draft;
  live: boolean;
  initialMinutes: number;
  weightKg: number;
  onMarkAll: () => void;
  onConfirm: (r: FinishResult) => void;
}) {
  const [name, setName] = useState(draft.name.trim() || "Entrenamiento");
  const [date, setDate] = useState(draft.date);
  const [minutes, setMinutes] = useState(initialMinutes > 0 ? String(initialMinutes) : "");
  const [note, setNote] = useState(draft.note);
  const [asRoutine, setAsRoutine] = useState(false);
  const [routineName, setRoutineName] = useState(name);
  const [addCalories, setAddCalories] = useState(false);

  const done = doneSets(draft);
  const unmarked = unmarkedSets(draft);
  const totals = workoutTotals({ exercises: toWorkoutExercises(draft, { onlyDone: true }) });
  const min = parseNum(minutes);
  const mins = Number.isFinite(min) && min > 0 ? Math.min(1440, Math.round(min)) : null;
  const kcal = mins ? gymCalories(mins, weightKg) : 0;
  const canRoutine = live && draft.routineId === null && done > 0;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (done === 0) return;
        onConfirm({
          date: isValidDateStr(date) && date <= todayStr() ? date : draft.date,
          name: name.trim() || "Entrenamiento",
          minutes: mins,
          note: note.trim(),
          routineName: asRoutine && canRoutine ? routineName.trim() || name.trim() || "Rutina" : null,
          addCalories: addCalories && mins !== null && kcal > 0,
        });
      }}
    >
      <dl className="grid grid-cols-3 gap-2 text-center">
        <Tile label="Ejercicios" value={String(toWorkoutExercises(draft, { onlyDone: true }).length)} />
        <Tile label="Series" value={String(totals.sets)} />
        <Tile label="Volumen (kg)" value={fmt(totals.volume)} />
      </dl>

      {unmarked > 0 ? (
        <div className="flex items-center gap-3 rounded-2xl bg-field p-3 text-sm text-ink-2">
          <span className="flex-1">
            {unmarked} {unmarked === 1 ? "serie sin marcar no se guardará" : "series sin marcar no se guardarán"}.
          </span>
          <Button variant="secondary" onClick={onMarkAll} className="shrink-0">
            Marcarlas
          </Button>
        </div>
      ) : null}
      {done === 0 ? (
        <p role="alert" className="text-sm text-danger-text">
          Marca al menos una serie con ✓ para poder guardar.
        </p>
      ) : null}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-2">Nombre</span>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-2">Fecha</span>
        <input
          type="date"
          value={date}
          max={todayStr()}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="w-full rounded-2xl bg-field px-3.5 py-2.5 text-base text-ink ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-2">Duración (minutos)</span>
        <NumberInput value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="60" inputMode="numeric" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-2">Nota (opcional)</span>
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cómo te sentiste, qué mejorar…" maxLength={500} />
      </label>

      {canRoutine ? (
        <div className="space-y-2 rounded-2xl bg-field p-3">
          <label className="flex items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={asRoutine}
              onChange={(e) => setAsRoutine(e.target.checked)}
              className="size-5 shrink-0 accent-accent"
            />
            Guardar como rutina
          </label>
          {asRoutine ? (
            <TextInput
              value={routineName}
              onChange={(e) => setRoutineName(e.target.value)}
              aria-label="Nombre de la rutina"
              placeholder="Nombre de la rutina"
              maxLength={80}
            />
          ) : null}
        </div>
      ) : null}

      {kcal > 0 ? (
        <label className="flex items-start gap-3 rounded-2xl bg-field p-3 text-sm">
          <input
            type="checkbox"
            checked={addCalories}
            onChange={(e) => setAddCalories(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-accent"
          />
          <span>
            <span className="block font-medium">Sumar ≈ {fmt(kcal)} kcal a mi ejercicio de este día</span>
            <span className="text-xs text-muted">
              Estimado con tu peso. Si anotas Apple Fitness, ya cuenta tus entrenamientos: no hace falta.
            </span>
          </span>
        </label>
      ) : null}

      <Button type="submit" className="w-full" disabled={done === 0}>
        {live ? "Guardar entrenamiento" : "Guardar cambios"}
      </Button>
    </form>
  );
}
