"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  Camera,
  History,
  ImagePlus,
  LoaderCircle,
  PenLine,
  Plus,
  Search,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { AnalysisEditor } from "@/components/AnalysisEditor";
import {
  EMPTY_DRAFT,
  FoodFields,
  fromDraft,
  type FoodDraft,
  type FoodValues,
} from "@/components/FoodFields";
import { Button, PageHeader, Segmented, TextInput, cx, inputClass } from "@/components/ui";
import type { Analysis } from "@/lib/analysis";
import { ApiError, analyzeFood } from "@/lib/api";
import { dateLabel } from "@/lib/dates";
import { fmt } from "@/lib/format";
import { prepareImage, type PreparedImage } from "@/lib/image";
import { recentFoods } from "@/lib/nutrition";
import { useSession } from "@/lib/session";
import { addFoods, useAppData, useSelectedDate } from "@/lib/store";
import { toast } from "@/lib/toast";
import { MEALS, mealForHour, mealLabel, type FoodSource, type MealType } from "@/lib/types";

type Mode = "foto" | "texto" | "manual" | "recientes";

const MODES: { id: Mode; label: string; Icon: typeof Camera }[] = [
  { id: "foto", label: "Foto", Icon: Camera },
  { id: "texto", label: "Describir", Icon: Sparkles },
  { id: "manual", label: "Manual", Icon: PenLine },
  { id: "recientes", label: "Recientes", Icon: History },
];

export function AddFood() {
  const params = useSearchParams();
  const router = useRouter();
  const date = useSelectedDate();

  const [meal, setMeal] = useState<MealType>(() => {
    const q = params.get("comida");
    return MEALS.some((m) => m.id === q) ? (q as MealType) : mealForHour(new Date().getHours());
  });
  const [mode, setMode] = useState<Mode>(() => {
    const q = params.get("modo");
    return MODES.some((m) => m.id === q) ? (q as Mode) : "foto";
  });

  const save = (items: FoodValues[], source: FoodSource) => {
    addFoods(items.map((i) => ({ ...i, date, meal, source })));
    toast(
      items.length === 1
        ? `${items[0].name} agregado a ${mealLabel(meal).toLowerCase()}`
        : `${items.length} alimentos agregados a ${mealLabel(meal).toLowerCase()}`,
    );
    router.push("/");
  };
  const saveLabel = `Guardar en ${mealLabel(meal).toLowerCase()}`;

  return (
    <>
      <PageHeader title="Agregar comida" />
      <main className="space-y-4 px-4">
        <div className="space-y-2">
          <p className="text-sm text-ink-2">
            Registrando para <span className="font-semibold text-ink">{dateLabel(date).toLowerCase()}</span>
          </p>
          <Segmented
            label="Comida"
            value={meal}
            onChange={setMeal}
            options={MEALS.map((m) => ({ id: m.id, label: m.label }))}
          />
        </div>

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

        {/* Los modos quedan montados para no perder la foto o el análisis al cambiar de pestaña. */}
        <div hidden={mode !== "foto"}>
          <PhotoMode saveLabel={saveLabel} onSave={(items) => save(items, "foto")} />
        </div>
        <div hidden={mode !== "texto"}>
          <TextMode saveLabel={saveLabel} onSave={(items) => save(items, "texto")} />
        </div>
        <div hidden={mode !== "manual"}>
          <ManualMode saveLabel={saveLabel} onSave={(items) => save(items, "manual")} />
        </div>
        <div hidden={mode !== "recientes"}>
          <RecentMode meal={meal} date={date} />
        </div>
      </main>
    </>
  );
}

// ---------- Foto ----------

function PhotoMode({ saveLabel, onSave }: { saveLabel: string; onSave: (items: FoodValues[]) => void }) {
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [hint, setHint] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const ai = useAnalysis();

  async function onFile(file: File | undefined) {
    if (!file) return;
    ai.reset();
    try {
      setImage(await prepareImage(file));
    } catch (e) {
      ai.fail((e as Error).message);
    }
  }

  const pickers = (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );

  if (!image) {
    return (
      <div className="space-y-3">
        {pickers}
        <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-baseline bg-card px-4 py-8 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-accent-soft text-accent-text">
            <Camera className="size-7" />
          </div>
          <p className="mt-3 font-semibold">Toma una foto de tu comida</p>
          <p className="mt-1 text-sm text-ink-2">
            La IA reconoce los alimentos y estima porciones, calorías y macros.
          </p>
          <div className="mt-5 flex w-full gap-2">
            <Button className="flex-1" onClick={() => cameraRef.current?.click()}>
              <Camera className="size-5" /> Tomar foto
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => galleryRef.current?.click()}>
              <ImagePlus className="size-5" /> Galería
            </Button>
          </div>
        </div>
        <AnalysisError error={ai.error} status={ai.errorStatus} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pickers}
      <div className="relative overflow-hidden rounded-3xl bg-field">
        {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (data URL) */}
        <img src={image.previewUrl} alt="Foto de la comida" className="max-h-80 w-full object-cover" />
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur"
        >
          Cambiar foto
        </button>
      </div>

      {ai.result ? (
        <AnalysisEditor key={ai.runId} analysis={ai.result} saveLabel={saveLabel} onSave={onSave} />
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-2">Detalles (opcional)</span>
            <TextInput
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="Ej. sin aceite, porción grande, café sin azúcar"
              maxLength={300}
            />
          </label>
          <Button
            className="w-full"
            disabled={ai.loading}
            onClick={() =>
              ai.run({ image: { data: image.data, mediaType: image.mediaType }, text: hint.trim() || undefined })
            }
          >
            {ai.loading ? (
              <>
                <LoaderCircle className="size-5 animate-spin" /> Analizando tu comida…
              </>
            ) : (
              <>
                <Sparkles className="size-5" /> Analizar con IA
              </>
            )}
          </Button>
        </div>
      )}
      <AnalysisError error={ai.error} status={ai.errorStatus} />
    </div>
  );
}

// ---------- Describir ----------

function TextMode({ saveLabel, onSave }: { saveLabel: string; onSave: (items: FoodValues[]) => void }) {
  const [text, setText] = useState("");
  const ai = useAnalysis();

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-2">¿Qué comiste?</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={1500}
          placeholder="Ej. 2 huevos revueltos, 1 pan francés con palta y un café con leche"
          className={cx(inputClass, "resize-none")}
        />
      </label>
      <Button className="w-full" disabled={ai.loading || !text.trim()} onClick={() => ai.run({ text: text.trim() })}>
        {ai.loading ? (
          <>
            <LoaderCircle className="size-5 animate-spin" /> Calculando…
          </>
        ) : (
          <>
            <Sparkles className="size-5" /> {ai.result ? "Volver a calcular" : "Calcular con IA"}
          </>
        )}
      </Button>
      <AnalysisError error={ai.error} status={ai.errorStatus} />
      {ai.result ? (
        <AnalysisEditor key={ai.runId} analysis={ai.result} saveLabel={saveLabel} onSave={onSave} />
      ) : null}
    </div>
  );
}

// ---------- Manual ----------

function ManualMode({ saveLabel, onSave }: { saveLabel: string; onSave: (items: FoodValues[]) => void }) {
  const [draft, setDraft] = useState<FoodDraft>(EMPTY_DRAFT);
  const values = fromDraft(draft);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (values) onSave([values]);
      }}
    >
      <FoodFields draft={draft} onChange={setDraft} />
      <Button type="submit" className="w-full" disabled={!values}>
        {saveLabel}
      </Button>
    </form>
  );
}

// ---------- Recientes ----------

function RecentMode({ meal, date }: { meal: MealType; date: string }) {
  const data = useAppData();
  const [query, setQuery] = useState("");
  const all = useMemo(() => recentFoods(data.foods), [data.foods]);
  const q = query.trim().toLowerCase();
  const list = q ? all.filter((f) => f.name.toLowerCase().includes(q)) : all;

  if (all.length === 0) {
    return (
      <p className="rounded-3xl bg-card p-6 text-center text-sm text-ink-2 ring-1 ring-border">
        Aquí aparecerán los alimentos que registres para agregarlos de nuevo con un toque.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar en tus alimentos"
          className="pl-10"
          type="search"
        />
      </div>
      <ul className="divide-y divide-border rounded-3xl bg-card px-4 ring-1 ring-border">
        {list.map((f) => (
          <li key={f.id} className="flex items-center gap-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{f.name}</span>
              <span className="block truncate text-xs text-muted">
                {f.portion ? `${f.portion} · ` : ""}
                {fmt(f.calories)} kcal
              </span>
            </span>
            <button
              type="button"
              aria-label={`Agregar ${f.name}`}
              onClick={() => {
                addFoods([
                  {
                    name: f.name,
                    portion: f.portion,
                    calories: f.calories,
                    protein: f.protein,
                    carbs: f.carbs,
                    fat: f.fat,
                    date,
                    meal,
                    source: "reciente",
                  },
                ]);
                toast(`${f.name} agregado a ${mealLabel(meal).toLowerCase()}`);
              }}
              className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-text hover:brightness-95"
            >
              <Plus className="size-5" />
            </button>
          </li>
        ))}
        {list.length === 0 ? <li className="py-4 text-center text-sm text-muted">Sin resultados</li> : null}
      </ul>
      <Link href="/" className="block text-center text-sm font-semibold text-accent-text">
        Listo, volver a hoy
      </Link>
    </div>
  );
}

// ---------- Estado compartido del análisis ----------

function useAnalysis() {
  const [result, setResult] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState(0);
  const [runId, setRunId] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  async function run(input: Parameters<typeof analyzeFood>[0]) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const r = await analyzeFood(input, ctrl.signal);
      setResult(r);
      setRunId((n) => n + 1);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
      setErrorStatus(e instanceof ApiError ? e.status : 0);
    } finally {
      if (abortRef.current === ctrl) setLoading(false);
    }
  }

  return {
    result,
    loading,
    error,
    errorStatus,
    runId,
    run,
    reset() {
      abortRef.current?.abort();
      setResult(null);
      setError(null);
      setLoading(false);
    },
    fail(message: string) {
      setError(message);
      setErrorStatus(0);
    },
  };
}

function AnalysisError({ error, status }: { error: string | null; status: number }): ReactNode {
  const session = useSession();
  if (!error) return null;
  // En modo local el código de acceso se escribe en Perfil.
  const needsCode = session.status === "local" && (status === 401 || status === 503);
  return (
    <div role="alert" className="flex gap-2 rounded-2xl bg-danger-soft p-3 text-sm text-danger-text">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <p>
        {error}
        {needsCode ? (
          <>
            {" "}
            <Link href="/perfil#conexion" className="font-semibold underline">
              Ir a Perfil
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
