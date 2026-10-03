"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  ChevronRight,
  CircleCheck,
  CloudOff,
  Download,
  HelpCircle,
  KeyRound,
  LoaderCircle,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  TriangleAlert,
  Upload,
  Users,
} from "lucide-react";
import { LegacyDataCard } from "@/components/LegacyDataCard";
import { Sheet } from "@/components/Sheet";
import {
  Button,
  ButtonLink,
  Card,
  Field,
  NumberInput,
  PageHeader,
  PasswordField,
  Segmented,
  TextInput,
  cx,
} from "@/components/ui";
import type { SessionUser } from "@/lib/account";
import { ApiError, accountApi, checkConnection } from "@/lib/api";
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
  useSyncState,
  type SyncState,
} from "@/lib/store";
import { signOut, useSession } from "@/lib/session";
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
  const session = useSession();
  const account = session.status === "user";

  return (
    <>
      <PageHeader title="Perfil" back={null} />
      <main className="space-y-4 px-4">
        {session.status === "user" ? (
          <AccountCard user={session.user} />
        ) : session.status === "guest" ? (
          <GuestCard />
        ) : (
          <LocalModeCard />
        )}
        <LegacyDataCard />
        {/* Se vuelve a montar si el perfil cambia (p. ej. llega desde otro dispositivo). */}
        <ProfileForm key={JSON.stringify(data.profile)} profile={data.profile} showName={!account} />
        <Link
          href="/bienvenida"
          className="flex items-center gap-3 rounded-3xl bg-card p-4 ring-1 ring-border"
        >
          <HelpCircle className="size-5 text-accent-text" />
          <span className="flex-1 font-semibold">¿Cómo funciona la app?</span>
          <ChevronRight className="size-5 text-muted" />
        </Link>
        {session.status === "local" ? <ConnectionCard /> : null}
        <DataCard account={account} />
      </main>
    </>
  );
}

function ProfileForm({ profile, showName }: { profile: Profile | null; showName: boolean }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(profile ?? defaultProfile()));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const result = fromDraft(draft);
  const preview = typeof result === "string" ? null : computeTargets(result);
  const macroSum = parseNum(draft.protein) + parseNum(draft.carbs) + parseNum(draft.fat);

  return (
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
        {showName ? (
          <Field label="Nombre (opcional)">
            <TextInput value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={60} />
          </Field>
        ) : null}
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

function DataCard({ account }: { account: boolean }) {
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
      const where = account ? "de tu cuenta" : "de este dispositivo";
      if (!confirm(`Esto reemplazará todos los datos ${where} por los del respaldo. ¿Continuar?`)) return;
      const d = importData(raw);
      const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
      toast(
        `Respaldo importado: ${count(d.foods.length, "alimento", "alimentos")}, ${count(d.exercises.length, "ejercicio", "ejercicios")}, ${count(d.workouts.length, "entrenamiento de gym", "entrenamientos de gym")}`,
      );
    } catch (e) {
      toast(e instanceof SyntaxError ? "El archivo no es un JSON válido." : (e as Error).message, "error");
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Respaldo</h2>
      <p className="text-sm text-ink-2">
        {account
          ? "Tus registros se guardan en tu cuenta. Si quieres, descarga una copia en un archivo."
          : "Todo se guarda en este dispositivo. Descarga un respaldo de vez en cuando o para pasar tus datos a otro celular."}
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
          const where = account ? "de tu cuenta (en todos tus dispositivos)" : "de este dispositivo";
          if (confirm(`¿Borrar todos tus registros y tu perfil ${where}? No se puede deshacer.`)) {
            resetData();
            toast("Datos borrados");
          }
        }}
      >
        <Trash2 className="size-5" /> Borrar todo
      </Button>
    </Card>
  );
}

const SYNC_TEXT: Record<SyncState, { text: string; Icon: typeof CircleCheck; tone: string }> = {
  idle: { text: "Todo guardado en tu cuenta", Icon: CircleCheck, tone: "text-accent-text" },
  pending: { text: "Guardando cambios…", Icon: RefreshCw, tone: "text-ink-2" },
  saving: { text: "Guardando cambios…", Icon: RefreshCw, tone: "text-ink-2" },
  offline: {
    text: "Sin conexión: se guardará cuando vuelva internet",
    Icon: CloudOff,
    tone: "text-ink-2",
  },
  error: { text: "No se pudo guardar; reintentando…", Icon: TriangleAlert, tone: "text-danger-text" },
};

function AccountCard({ user }: { user: SessionUser }) {
  const sync = SYNC_TEXT[useSyncState()];
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function leave() {
    setLeaving(true);
    let result = await signOut();
    if (
      result === "pending" &&
      confirm("Hay cambios sin guardar porque no hay conexión. Si sales ahora se perderán. ¿Salir igual?")
    ) {
      result = await signOut(true);
    }
    if (result === "pending") setLeaving(false);
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-lg font-bold text-accent-ink">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-semibold">{user.name}</span>
          <span className="block truncate text-sm text-muted">
            @{user.username}
            {user.role === "admin" ? " · administra la familia" : ""}
          </span>
        </span>
      </div>
      <p className={cx("flex items-center gap-2 text-sm", sync.tone)}>
        <sync.Icon className="size-4 shrink-0" /> {sync.text}
      </p>
      {user.role === "admin" ? (
        <Link
          href="/familia"
          className="flex items-center gap-3 rounded-2xl bg-field p-3 ring-1 ring-border"
        >
          <Users className="size-5 text-accent-text" />
          <span className="flex-1 text-sm font-semibold">Familia: invitar y administrar cuentas</span>
          <ChevronRight className="size-5 text-muted" />
        </Link>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => setPasswordOpen(true)}>
          <KeyRound className="size-5" /> Contraseña
        </Button>
        <Button variant="secondary" onClick={() => void leave()} disabled={leaving}>
          {leaving ? <LoaderCircle className="size-5 animate-spin" /> : <LogOut className="size-5" />}
          Salir
        </Button>
      </div>
      <Sheet open={passwordOpen} onClose={() => setPasswordOpen(false)} title="Cambiar contraseña">
        <ChangePasswordForm onDone={() => setPasswordOpen(false)} />
      </Sheet>
    </Card>
  );
}

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
          await accountApi.changePassword({ current, next });
          toast("Contraseña cambiada");
          onDone();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setLoading(false);
        }
      }}
    >
      <PasswordField
        label="Contraseña actual"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        autoComplete="current-password"
        required
      />
      <PasswordField
        label="Contraseña nueva"
        hint="Mínimo 6 caracteres. Se cerrará la sesión en tus otros dispositivos."
        value={next}
        onChange={(e) => setNext(e.target.value)}
        autoComplete="new-password"
        required
      />
      {error ? <p className="text-sm text-danger-text">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={loading || !current || next.length < 6}>
        {loading ? <LoaderCircle className="size-5 animate-spin" /> : null}
        Guardar contraseña
      </Button>
    </form>
  );
}

function GuestCard() {
  return (
    <Card className="space-y-3">
      <p className="flex gap-3 text-sm text-ink-2">
        <Smartphone className="mt-0.5 size-5 shrink-0 text-accent-text" />
        <span>
          <span className="block font-semibold text-ink">Estás probando sin cuenta</span>
          Tus registros se guardan solo en este celular. Crea tu cuenta para guardarlos en la
          nube y no perderlos; al crearla podrás pasarlos a tu cuenta.
        </span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        <ButtonLink href="/registro">Crear cuenta</ButtonLink>
        <ButtonLink href="/entrar" variant="secondary">
          Ya tengo cuenta
        </ButtonLink>
      </div>
    </Card>
  );
}

function LocalModeCard() {
  return (
    <Card className="flex gap-3">
      <Smartphone className="mt-0.5 size-5 shrink-0 text-accent-text" />
      <p className="text-sm text-ink-2">
        <span className="block font-semibold text-ink">Modo local</span>
        Tus registros se guardan solo en este dispositivo.
      </p>
    </Card>
  );
}
