"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  Dumbbell,
  Footprints,
  ImagePlus,
  Info,
  LoaderCircle,
  PenLine,
  Smartphone,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Button, Field, NumberInput, PageHeader, TextInput, cx } from "@/components/ui";
import { ACTIVITIES, activityCalories, stepsCalories } from "@/lib/activities";
import type { ActivityReading } from "@/lib/analysis";
import { ApiError, readActivity } from "@/lib/api";
import { dateLabel } from "@/lib/dates";
import { fmt, parseNum } from "@/lib/format";
import { prepareImage, type PreparedImage } from "@/lib/image";
import { ocrActivity } from "@/lib/ocr";
import { addExercise, updateExercise, useAppData, useSelectedDate, type NewExercise } from "@/lib/store";
import { toast } from "@/lib/toast";

type Mode = "captura" | "actividad" | "pasos" | "manual";

const MODES: { id: Mode; label: string; Icon: typeof Dumbbell }[] = [
  { id: "captura", label: "Captura", Icon: Smartphone },
  { id: "actividad", label: "Actividad", Icon: Dumbbell },
  { id: "pasos", label: "Pasos", Icon: Footprints },
  { id: "manual", label: "Manual", Icon: PenLine },
];

/** Prefijo de los registros importados desde una captura; uno por día. */
const RING_PREFIX = "Calorías activas";

export default function EjercicioPage() {
  const router = useRouter();
  const data = useAppData();
  const date = useSelectedDate();
  const [mode, setMode] = useState<Mode>("captura");
  const weight = data.profile?.weightKg ?? 70;

  const save = (e: Omit<NewExercise, "date">) => {
    addExercise({ ...e, date });
    toast(`${e.name}: +${fmt(e.calories)} kcal`);
    router.push("/");
  };

  return (
    <>
      <PageHeader title="Agregar ejercicio" />
      <main className="space-y-4 px-4">
        <p className="text-sm text-ink-2">
          Registrando para <span className="font-semibold text-ink">{dateLabel(date).toLowerCase()}</span>
        </p>
        <div role="tablist" aria-label="Forma de registro" className="grid grid-cols-4 gap-2">
          {MODES.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={cx(
                "flex flex-col items-center gap-1 rounded-2xl py-2.5 text-xs font-semibold ring-1 transition",
                mode === id
                  ? "bg-accent-soft text-accent-text ring-accent"
                  : "bg-card text-ink-2 ring-border hover:text-ink",
              )}
            >
              <Icon className="size-5" />
              {label}
            </button>
          ))}
        </div>

        {mode === "captura" ? <ScreenshotMode date={date} /> : null}
        {mode === "actividad" ? <ActivityMode weight={weight} hasProfile={!!data.profile} onSave={save} /> : null}
        {mode === "pasos" ? <StepsMode weight={weight} onSave={save} /> : null}
        {mode === "manual" ? <ManualMode onSave={save} /> : null}
      </main>
    </>
  );
}

// ---------- Captura de los anillos de Actividad ----------

function ScreenshotMode({ date }: { date: string }) {
  const router = useRouter();
  const data = useAppData();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreparedImage | null>(null);
  const [reading, setReading] = useState<ActivityReading | null>(null);
  const [kcal, setKcal] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<{ message: string; status: number } | null>(null);

  const existing = data.exercises.find((e) => e.date === date && e.name.startsWith(RING_PREFIX));
  const loading = progress !== null || aiLoading;

  function show(r: ActivityReading) {
    setReading(r);
    setKcal(r.activeCalories != null ? String(r.activeCalories) : "");
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setReading(null);
    setProgress(0);
    try {
      // Vista previa y, si hace falta, envío a la IA con resolución suficiente para leer números.
      setPreview(await prepareImage(file, 1568, 0.9));
      const { reading: r } = await ocrActivity(file, setProgress);
      show(r);
    } catch (e) {
      setError({ message: (e as Error).message || "No se pudo leer la captura.", status: 0 });
    } finally {
      setProgress(null);
    }
  }

  /** Respaldo con IA (Gemini) cuando el OCR no encuentra las kcal. */
  async function readWithAi() {
    if (!preview) return;
    setError(null);
    setAiLoading(true);
    try {
      show(await readActivity({ data: preview.data, mediaType: preview.mediaType }));
    } catch (e) {
      setError({ message: (e as Error).message, status: e instanceof ApiError ? e.status : 0 });
    } finally {
      setAiLoading(false);
    }
  }

  const calories = parseNum(kcal);
  const valid = calories > 0;

  function save() {
    if (!valid || !reading) return;
    const source = /apple|iphone|fitness/i.test(reading.source) ? "iPhone" : reading.source || "captura";
    const entry = {
      name: `${RING_PREFIX} · ${source}`,
      minutes: reading.exerciseMinutes,
      calories: Math.round(calories),
    };
    if (existing) {
      updateExercise(existing.id, entry);
      toast(`Actualizado: ${fmt(entry.calories)} kcal activas`);
    } else {
      addExercise({ ...entry, date });
      toast(`+${fmt(entry.calories)} kcal activas`);
    }
    router.push("/");
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {!preview ? (
        <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-baseline bg-card px-4 py-8 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-accent-soft text-accent-text">
            <Smartphone className="size-7" />
          </div>
          <p className="mt-3 font-semibold">Sube una captura de tus anillos</p>
          <p className="mt-1 text-sm text-ink-2">
            Abre la app Fitness del iPhone, haz una captura del resumen del día y súbela. La app lee
            las kcal del anillo Moverse en tu celular, sin IA y gratis.
          </p>
          <Button className="mt-5 w-full" onClick={() => inputRef.current?.click()}>
            <ImagePlus className="size-5" /> Elegir captura
          </Button>
        </div>
      ) : (
        <div className="flex gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (data URL) */}
          <img src={preview.previewUrl} alt="Captura de actividad" className="h-40 w-24 shrink-0 rounded-2xl object-cover ring-1 ring-border" />
          <div className="min-w-0 flex-1 space-y-2 text-sm">
            {loading ? (
              <p className="flex items-center gap-2 text-ink-2">
                <LoaderCircle className="size-5 animate-spin" />
                {aiLoading
                  ? "Leyendo con IA…"
                  : `Leyendo la captura…${progress ? ` ${Math.round(progress * 100)} %` : ""}`}
              </p>
            ) : reading ? (
              <>
                <p className="font-semibold">{reading.source || "Actividad"}</p>
                <dl className="space-y-1 text-ink-2">
                  <Row label="Moverse" value={reading.activeCalories != null ? `${fmt(reading.activeCalories)} kcal` : "no se ve"} />
                  <Row label="Ejercicio" value={reading.exerciseMinutes != null ? `${reading.exerciseMinutes} min` : "—"} />
                  <Row label="Pasos" value={reading.steps != null ? fmt(reading.steps) : "—"} />
                </dl>
                {reading.notes ? <p className="text-xs text-muted">{reading.notes}</p> : null}
              </>
            ) : null}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-sm font-semibold text-accent-text"
            >
              Usar otra captura
            </button>
          </div>
        </div>
      )}

      {error ? (
        <div role="alert" className="flex gap-2 rounded-2xl bg-danger-soft p-3 text-sm text-danger-text">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            {error.message}{" "}
            {error.status === 401 || error.status === 503 ? (
              <Link href="/perfil#conexion" className="font-semibold underline">
                Ir a Perfil
              </Link>
            ) : null}
          </p>
        </div>
      ) : null}

      {reading && reading.activeCalories == null && !loading ? (
        <div className="space-y-2 rounded-2xl bg-field p-3 text-sm text-ink-2">
          <p>No pude leer las kcal del anillo Moverse. Escríbelas abajo o intenta leerla con IA.</p>
          <Button variant="secondary" className="w-full" onClick={() => void readWithAi()}>
            <Sparkles className="size-5" /> Leer con IA
          </Button>
        </div>
      ) : null}

      {reading ? (
        <div className="space-y-3">
          <Field label="Calorías activas a registrar">
            <NumberInput value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="0" />
          </Field>
          {existing ? (
            <p className="text-xs text-muted">
              Ya importaste {fmt(existing.calories)} kcal de actividad este día; se reemplazarán por el nuevo valor.
            </p>
          ) : null}
          <Button className="w-full" disabled={!valid} onClick={save}>
            {existing ? "Actualizar" : "Guardar"} {valid ? `${fmt(calories)} kcal` : ""}
          </Button>
        </div>
      ) : null}

      <p className="flex gap-2 rounded-2xl bg-field p-3 text-xs text-ink-2">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          Las kcal del anillo Moverse ya incluyen los entrenamientos del reloj: no los registres aparte.
          Si usas esta opción a diario, elige el nivel de actividad «Sedentario» en tu perfil para no
          contar el ejercicio dos veces.
        </span>
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{label}</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  );
}

// ---------- Actividad con MET ----------

function ActivityMode({
  weight,
  hasProfile,
  onSave,
}: {
  weight: number;
  hasProfile: boolean;
  onSave: (e: Omit<NewExercise, "date">) => void;
}) {
  const [activityId, setActivityId] = useState(ACTIVITIES[1].id);
  const [minutes, setMinutes] = useState("30");
  const [override, setOverride] = useState("");
  const activity = useMemo(() => ACTIVITIES.find((a) => a.id === activityId) ?? ACTIVITIES[0], [activityId]);
  const mins = parseNum(minutes);
  const estimate = activityCalories(activity.met, weight, mins);
  const calories = override.trim() ? parseNum(override) : estimate;
  const valid = mins > 0 && calories > 0;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave({ name: activity.name, minutes: Math.round(mins), calories: Math.round(calories) });
      }}
    >
      <Field label="Actividad">
        <select
          value={activityId}
          onChange={(e) => setActivityId(e.target.value)}
          className="w-full rounded-2xl bg-field px-3.5 py-2.5 text-base ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {ACTIVITIES.map((a) => (
            <option key={a.id} value={a.id}>
              {a.emoji} {a.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Duración (minutos)">
        <NumberInput value={minutes} onChange={(e) => setMinutes(e.target.value)} />
      </Field>
      <div className="flex gap-2">
        {[15, 30, 45, 60, 90].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMinutes(String(m))}
            className={cx(
              "flex-1 rounded-xl py-2 text-sm font-semibold ring-1",
              mins === m ? "bg-accent-soft text-accent-text ring-accent" : "bg-card ring-border",
            )}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="rounded-2xl bg-accent-soft p-3">
        <p className="text-sm text-ink-2">Estimación</p>
        <p className="text-2xl font-bold">{fmt(estimate)} kcal</p>
        <p className="text-xs text-ink-2">
          MET {activity.met} × {weight} kg × {mins > 0 ? fmt(mins) : 0} min
          {hasProfile ? "" : " (peso por defecto: completa tu perfil)"}
        </p>
      </div>
      <Field label="¿Tu reloj marca otro valor? (opcional)">
        <NumberInput value={override} onChange={(e) => setOverride(e.target.value)} placeholder={String(estimate)} />
      </Field>
      <Button type="submit" className="w-full" disabled={!valid}>
        Agregar {valid ? `${fmt(calories)} kcal` : ""}
      </Button>
    </form>
  );
}

// ---------- Pasos ----------

function StepsMode({ weight, onSave }: { weight: number; onSave: (e: Omit<NewExercise, "date">) => void }) {
  const [steps, setSteps] = useState("");
  const n = parseNum(steps);
  const calories = stepsCalories(n, weight);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (calories > 0) onSave({ name: `Pasos (${fmt(n)})`, minutes: null, calories });
      }}
    >
      <Field label="Pasos del día" hint="Aproximación: unas 0,04 kcal por paso para 70 kg.">
        <NumberInput value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="8000" inputMode="numeric" />
      </Field>
      <div className="rounded-2xl bg-accent-soft p-3">
        <p className="text-sm text-ink-2">Estimación</p>
        <p className="text-2xl font-bold">{fmt(calories)} kcal</p>
      </div>
      <Button type="submit" className="w-full" disabled={calories <= 0}>
        Agregar
      </Button>
    </form>
  );
}

// ---------- Manual ----------

function ManualMode({ onSave }: { onSave: (e: Omit<NewExercise, "date">) => void }) {
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState("");
  const [kcal, setKcal] = useState("");
  const calories = parseNum(kcal);
  const valid = name.trim() !== "" && calories > 0;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const mins = parseNum(minutes);
        if (valid) onSave({ name: name.trim(), minutes: mins > 0 ? Math.round(mins) : null, calories: Math.round(calories) });
      }}
    >
      <Field label="Actividad">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Clase de funcional" maxLength={120} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Minutos (opcional)">
          <NumberInput value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="45" />
        </Field>
        <Field label="Calorías quemadas">
          <NumberInput value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="350" />
        </Field>
      </div>
      <Button type="submit" className="w-full" disabled={!valid}>
        Agregar
      </Button>
    </form>
  );
}
