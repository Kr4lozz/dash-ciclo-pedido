"use client";

import { useRef, useState } from "react";
import { Download, KeyRound, LoaderCircle, ShieldCheck, Trash2, Upload } from "lucide-react";
import { Button, Card, Field, NumberInput, PageHeader, Segmented, TextInput, cx } from "@/components/ui";
import { ApiError, checkConnection } from "@/lib/api";
import { todayStr } from "@/lib/dates";
import { fmt, parseNum } from "@/lib/format";
import {
  ACTIVITY_LEVELS,
  GOALS,
  RATES,
  computeTargets,
  defaultMacroPct,
  defaultProfile,
  defaultWaterMl,
} from "@/lib/nutrition";
import {
  exportData,
  getAccessCode,
  importData,
  resetData,
  saveProfile,
  setAccessCode,
  useAppData,
} from "@/lib/store";
import { toast } from "@/lib/toast";
import type { ActivityLevel, Goal, Profile, Sex } from "@/lib/types";

type Draft = {
  name: string;
  sex: Sex;
  age: string;
  heightCm: string;
  weightKg: string;
  activity: ActivityLevel;
  goal: Goal;
  rateKgWeek: number;
  manualCalories: boolean;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  water: string;
};

function toDraft(p: Profile): Draft {
  return {
    name: p.name,
    sex: p.sex,
    age: String(p.age),
    heightCm: String(p.heightCm),
    weightKg: String(p.weightKg).replace(".", ","),
    activity: p.activity,
    goal: p.goal,
    rateKgWeek: p.rateKgWeek,
    manualCalories: p.calorieOverride !== null,
    calories: p.calorieOverride ? String(p.calorieOverride) : "",
    protein: String(p.macroPct.protein),
    carbs: String(p.macroPct.carbs),
    fat: String(p.macroPct.fat),
    water: String(p.waterGoalMl),
  };
}

/** Devuelve el perfil o el primer error a mostrar. */
function fromDraft(d: Draft): Profile | string {
  const age = parseNum(d.age);
  const height = parseNum(d.heightCm);
  const weight = parseNum(d.weightKg);
  const macro = { protein: parseNum(d.protein), carbs: parseNum(d.carbs), fat: parseNum(d.fat) };
  const water = parseNum(d.water);
  const calories = parseNum(d.calories);
  if (!(age >= 14 && age <= 100)) return "Ingresa una edad entre 14 y 100 años.";
  if (!(height >= 120 && height <= 230)) return "Ingresa tu altura en centímetros (120–230).";
  if (!(weight >= 30 && weight <= 300)) return "Ingresa tu peso en kg (30–300).";
  if (!Object.values(macro).every((v) => v >= 0)) return "Revisa los porcentajes de macros.";
  if (Math.round(macro.protein + macro.carbs + macro.fat) !== 100) return "Los macros deben sumar 100 %.";
  if (d.manualCalories && !(calories >= 800 && calories <= 6000)) return "La meta manual debe estar entre 800 y 6000 kcal.";
  return {
    name: d.name.trim(),
    sex: d.sex,
    age: Math.round(age),
    heightCm: Math.round(height),
    weightKg: Math.round(weight * 10) / 10,
    activity: d.activity,
    goal: d.goal,
    rateKgWeek: d.rateKgWeek,
    calorieOverride: d.manualCalories ? Math.round(calories) : null,
    macroPct: macro,
    waterGoalMl: water >= 500 ? Math.round(water) : defaultWaterMl(weight),
  };
}

export default function PerfilPage() {
  const data = useAppData();
  const [draft, setDraft] = useState<Draft>(() => toDraft(data.profile ?? defaultProfile()));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const result = fromDraft(draft);
  const preview = typeof result === "string" ? null : computeTargets(result);
  const macroSum = parseNum(draft.protein) + parseNum(draft.carbs) + parseNum(draft.fat);

  return (
    <>
      <PageHeader title="Perfil" back={null} />
      <main className="space-y-4 px-4">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (typeof result === "string") {
              toast(result, "error");
              return;
            }
            saveProfile(result);
            toast("Perfil guardado");
          }}
        >
          <Card className="space-y-3">
            <h2 className="font-semibold">Tus datos</h2>
            <Field label="Nombre (opcional)">
              <TextInput value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={60} />
            </Field>
            <Segmented
              label="Sexo"
              value={draft.sex}
              onChange={(v) => set("sex", v)}
              options={[
                { id: "mujer", label: "Mujer" },
                { id: "hombre", label: "Hombre" },
              ]}
            />
            <div className="grid grid-cols-3 gap-3">
              <Field label="Edad">
                <NumberInput value={draft.age} onChange={(e) => set("age", e.target.value)} inputMode="numeric" />
              </Field>
              <Field label="Altura (cm)">
                <NumberInput value={draft.heightCm} onChange={(e) => set("heightCm", e.target.value)} inputMode="numeric" />
              </Field>
              <Field label="Peso (kg)">
                <NumberInput value={draft.weightKg} onChange={(e) => set("weightKg", e.target.value)} />
              </Field>
            </div>
            <Field
              label="Nivel de actividad"
              hint="Si registras tu ejercicio o importas los anillos del iPhone, elige «Sedentario» para no contarlo dos veces."
            >
              <select
                value={draft.activity}
                onChange={(e) => set("activity", e.target.value as ActivityLevel)}
                className="w-full rounded-2xl bg-field px-3.5 py-2.5 text-base ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {ACTIVITY_LEVELS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} — {a.hint}
                  </option>
                ))}
              </select>
            </Field>
          </Card>

          <Card className="space-y-3">
            <h2 className="font-semibold">Objetivo</h2>
            <Segmented
              label="Objetivo"
              value={draft.goal}
              onChange={(g) => {
                setDraft((d) => {
                  const pct = defaultMacroPct(g);
                  return { ...d, goal: g, protein: String(pct.protein), carbs: String(pct.carbs), fat: String(pct.fat) };
                });
              }}
              options={GOALS.map((g) => ({ id: g.id, label: g.label }))}
            />
            {draft.goal !== "mantener" ? (
              <Field label={draft.goal === "perder" ? "Ritmo para bajar" : "Ritmo para subir"}>
                <Segmented
                  label="Ritmo"
                  value={String(draft.rateKgWeek)}
                  onChange={(v) => set("rateKgWeek", Number(v))}
                  options={RATES.map((r) => ({ id: String(r), label: `${String(r).replace(".", ",")} kg` }))}
                />
              </Field>
            ) : null}
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={draft.manualCalories}
                onChange={(e) => set("manualCalories", e.target.checked)}
                className="size-5 accent-[var(--accent)]"
              />
              Fijar mi meta de calorías manualmente
            </label>
            {draft.manualCalories ? (
              <Field label="Meta diaria (kcal)">
                <NumberInput
                  value={draft.calories}
                  onChange={(e) => set("calories", e.target.value)}
                  placeholder={preview ? String(preview.suggested) : "2000"}
                  inputMode="numeric"
                />
              </Field>
            ) : null}
          </Card>

          <Card className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">Macros (% de calorías)</h2>
              <span className={cx("tabular text-sm", Math.round(macroSum) === 100 ? "text-muted" : "font-semibold text-danger-text")}>
                Suma {Number.isFinite(macroSum) ? fmt(macroSum) : "—"} %
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Proteína">
                <NumberInput value={draft.protein} onChange={(e) => set("protein", e.target.value)} inputMode="numeric" />
              </Field>
              <Field label="Carbos">
                <NumberInput value={draft.carbs} onChange={(e) => set("carbs", e.target.value)} inputMode="numeric" />
              </Field>
              <Field label="Grasa">
                <NumberInput value={draft.fat} onChange={(e) => set("fat", e.target.value)} inputMode="numeric" />
              </Field>
            </div>
            <Field label="Meta de agua (ml)">
              <NumberInput value={draft.water} onChange={(e) => set("water", e.target.value)} inputMode="numeric" />
            </Field>
          </Card>

          <Card className="space-y-2">
            <h2 className="font-semibold">Tu plan diario</h2>
            {preview ? (
              <>
                <p className="text-4xl font-semibold tracking-tight">
                  {fmt(preview.calories)} <span className="text-base font-medium text-ink-2">kcal/día</span>
                </p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <Item label="Metabolismo basal" value={`${fmt(preview.bmr)} kcal`} />
                  <Item label="Gasto diario estimado" value={`${fmt(preview.tdee)} kcal`} />
                  <Item label="Proteína" value={`${preview.protein} g`} />
                  <Item label="Carbohidratos" value={`${preview.carbs} g`} />
                  <Item label="Grasas" value={`${preview.fat} g`} />
                  <Item label="Agua" value={`${fmt(preview.waterMl)} ml`} />
                </dl>
                {preview.clamped && !draft.manualCalories ? (
                  <p className="text-xs text-muted">
                    Ajustamos la meta al mínimo recomendado. Para bajar más rápido consulta con un profesional.
                  </p>
                ) : null}
                <p className="text-xs text-muted">Fórmula Mifflin-St Jeor. Es una estimación: ajústala según tu evolución.</p>
              </>
            ) : (
              <p className="text-sm text-danger-text">{result as string}</p>
            )}
          </Card>

          <Button type="submit" className="w-full">
            Guardar perfil
          </Button>
        </form>

        <ConnectionCard />
        <DataCard />
      </main>
    </>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-border py-1">
      <dt className="text-ink-2">{label}</dt>
      <dd className="tabular font-semibold">{value}</dd>
    </div>
  );
}

function ConnectionCard() {
  const [code, setCode] = useState(() => getAccessCode());
  const [state, setState] = useState<{ kind: "idle" | "loading" | "ok" | "error"; message?: string }>({
    kind: "idle",
  });

  async function test() {
    setAccessCode(code.trim());
    setState({ kind: "loading" });
    try {
      const r = await checkConnection();
      setState({ kind: "ok", message: `Conectado (modelo ${r.model}).` });
    } catch (e) {
      setState({ kind: "error", message: e instanceof ApiError ? e.message : "No se pudo verificar." });
    }
  }

  return (
    <Card className="space-y-3">
      <h2 id="conexion" className="flex scroll-mt-4 items-center gap-2 font-semibold">
        <KeyRound className="size-5" /> Conexión con la IA
      </h2>
      <p className="text-sm text-ink-2">
        Escribe el código de acceso que configuraste en Vercel (<code className="text-xs">APP_ACCESS_CODE</code>).
        Se guarda solo en este dispositivo.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void test();
        }}
      >
        <TextInput
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Código de acceso"
          autoComplete="off"
          aria-label="Código de acceso"
        />
        <Button type="submit" className="shrink-0" disabled={state.kind === "loading"}>
          {state.kind === "loading" ? <LoaderCircle className="size-5 animate-spin" /> : "Guardar"}
        </Button>
      </form>
      {state.kind === "ok" ? (
        <p className="flex items-center gap-2 text-sm text-accent-text">
          <ShieldCheck className="size-4" /> {state.message}
        </p>
      ) : null}
      {state.kind === "error" ? <p className="text-sm text-danger-text">{state.message}</p> : null}
    </Card>
  );
}

function DataCard() {
  const fileRef = useRef<HTMLInputElement>(null);

  function download() {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mis-calorias-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function restore(file: File | undefined) {
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      if (!confirm("Esto reemplazará todos los datos de este dispositivo por los del respaldo. ¿Continuar?")) return;
      const d = importData(raw);
      toast(`Respaldo importado: ${d.foods.length} alimentos, ${d.exercises.length} ejercicios`);
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      toast(e instanceof SyntaxError ? "El archivo no es un JSON válido." : (e as Error).message, "error");
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Tus datos</h2>
      <p className="text-sm text-ink-2">
        Todo se guarda en este dispositivo. Descarga un respaldo de vez en cuando o para pasar tus datos a otro celular.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          void restore(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={download}>
          <Download className="size-5" /> Exportar
        </Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          <Upload className="size-5" /> Importar
        </Button>
      </div>
      <Button
        variant="danger"
        className="w-full"
        onClick={() => {
          if (confirm("¿Borrar todos tus registros y tu perfil de este dispositivo? No se puede deshacer.")) {
            resetData();
            toast("Datos borrados");
            setTimeout(() => window.location.reload(), 600);
          }
        }}
      >
        <Trash2 className="size-5" /> Borrar todo
      </Button>
    </Card>
  );
}
