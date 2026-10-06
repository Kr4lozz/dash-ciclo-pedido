"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, Plus, RefreshCw, Settings2, Shuffle, Target, TriangleAlert } from "lucide-react";
import { Meter } from "@/components/Meters";
import { Button, Card, PageHeader, Segmented, Swatch, cx } from "@/components/ui";
import { dateLabel, todayStr } from "@/lib/dates";
import { fmt } from "@/lib/format";
import {
  MIN_KCAL_TO_PLAN,
  SLOTS,
  anotherOption,
  buildPlan,
  dayGoal,
  dishOptions,
  ingredientLists,
  mealTarget,
  newSeed,
  planTotal,
  refitPlan,
  slotForMeal,
  slotInfo,
  type DishOption,
  type MenuPlan,
  type MenuSettings,
  type PlannedMeal,
  type SlotId,
  type Vec,
} from "@/lib/menu";
import { AVOID, SNACK_KINDS } from "@/lib/menu-data";
import { loadMenu, saveMenu, type MenuState, type MenuView } from "@/lib/menu-storage";
import { computeTargets, dayActivity } from "@/lib/nutrition";
import { addFoods, setSelectedDate, useAppData, useSelectedDate } from "@/lib/store";
import { toast } from "@/lib/toast";
import { trackAction } from "@/lib/usage";
import { MEALS, mealForHour, mealLabel, type FoodEntry, type MealType } from "@/lib/types";

/** Comida pedida desde Hoy (?comida=cena), si viene una. */
function asMeal(q: string | null): MealType | null {
  return MEALS.some((m) => m.id === q) ? (q as MealType) : null;
}

export function MenuScreen() {
  const data = useAppData();
  const date = useSelectedDate();
  const router = useRouter();
  const requested = asMeal(useSearchParams().get("comida"));
  const [state, setState] = useState<MenuState>(() => {
    const s = loadMenu();
    return requested ? { ...s, view: "opciones" } : s;
  });
  const [editing, setEditing] = useState(false);
  // Se mantienen al editar las preferencias.
  const [meal, setMeal] = useState<MealType>(() => requested ?? mealForHour(new Date().getHours()));
  const [mode, setMode] = useState<"platos" | "ingredientes">("platos");

  const targets = useMemo(() => computeTargets(data.profile), [data.profile]);
  const logged = useMemo(() => data.foods.filter((f) => f.date === date), [data.foods, date]);
  const exercises = useMemo(() => data.exercises.filter((e) => e.date === date), [data.exercises, date]);
  const activity = dayActivity(data.burned[date], exercises);
  const goal = useMemo(
    () => dayGoal(targets, data.profile?.macroPct ?? null, activity),
    [targets, data.profile, activity],
  );
  const plan = state.plan?.date === date ? state.plan : null;

  const save = (next: MenuState) => {
    setState(next);
    saveMenu(next);
  };
  const setPlan = (next: MenuPlan) => save({ ...state, plan: next });
  const setView = (view: MenuView) => {
    save({ ...state, view });
    setEditing(false);
    // Sin la comida pedida desde Hoy, al volver a abrir se muestra la última vista.
    if (requested) router.replace("/menu", { scroll: false });
  };

  function generate(settings: MenuSettings) {
    trackAction("menu");
    save({ ...state, settings, plan: buildPlan({ date, goal, settings, logged, seed: newSeed() }) });
    setEditing(false);
    window.scrollTo({ top: 0 });
  }

  function addMeal(meal: PlannedMeal) {
    if (!plan) return;
    const slot = slotInfo(meal.slot);
    addFoods(
      meal.items.map((it) => ({
        date: plan.date,
        meal: slot.meal,
        name: it.name,
        portion: it.portion,
        calories: it.calories,
        protein: it.protein,
        carbs: it.carbs,
        fat: it.fat,
        source: "manual" as const,
      })),
    );
    setPlan({ ...plan, meals: plan.meals.map((m) => (m.slot === meal.slot ? { ...m, added: true } : m)) });
    toast(`${slot.label} agregado a tu diario`);
  }

  return (
    <>
      <PageHeader title="Menú" back={null} />
      <main className="space-y-4 px-4">
        <Segmented
          label="Vista"
          value={state.view}
          onChange={setView}
          options={[
            { id: "opciones", label: "Opciones" },
            { id: "dia", label: "Día completo" },
          ]}
        />
        <p className="text-sm text-ink-2">
          Para <span className="font-semibold text-ink">{dateLabel(date).toLowerCase()}</span>
          {date !== todayStr() ? (
            <>
              {" · "}
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr())}
                className="font-semibold text-accent-text"
              >
                Cambiar a hoy
              </button>
            </>
          ) : null}
        </p>

        {!data.profile ? (
          <Link
            href="/perfil"
            className="flex items-center gap-3 rounded-3xl bg-accent-soft p-4 ring-1 ring-border"
          >
            <Target className="size-6 shrink-0 text-accent-text" />
            <span className="text-sm">
              <span className="block font-semibold">Configura tu perfil</span>
              <span className="text-ink-2">
                Así el menú se ajusta a tu meta y tus macros. Mientras tanto usamos 2000 kcal.
              </span>
            </span>
          </Link>
        ) : null}

        {state.view === "opciones" ? (
          editing ? (
            <Questions
              key="preferencias"
              title="Tus preferencias"
              intro="Con esto calculamos cuánto te toca en cada comida y qué platos mostrarte."
              submitLabel="Guardar"
              initial={state.settings}
              logged={[]}
              onSubmit={(settings) => {
                save({ ...state, settings });
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <OptionsView
              date={date}
              goal={goal}
              settings={state.settings}
              logged={logged}
              meal={meal}
              onMeal={setMeal}
              mode={mode}
              onMode={setMode}
              onEditPrefs={() => setEditing(true)}
            />
          )
        ) : editing || !plan ? (
          <Questions
            key={plan ? "editar" : "nuevo"}
            initial={state.settings}
            logged={logged}
            onSubmit={generate}
            onCancel={plan ? () => setEditing(false) : undefined}
          />
        ) : (
          <PlanView
            plan={plan}
            goal={goal}
            logged={logged}
            onEdit={() => setEditing(true)}
            onRegenerate={() => generate(plan.settings)}
            onRefit={() => setPlan(refitPlan(plan, goal))}
            onAnother={(slot) => setPlan(anotherOption(plan, slot))}
            onAdd={addMeal}
          />
        )}

        <p className="px-1 pb-2 text-xs text-muted">
          Platos caseros con ingredientes económicos de mercado. Medidas: 1 taza ≈ 240 ml y 100 g de
          pollo o pescado ≈ la palma de tu mano. Los valores son aproximados; si tienes una condición
          de salud, consulta con un nutricionista.
        </p>
      </main>
    </>
  );
}

// ---------- Preguntas ----------

function Questions({
  title = "Arma tu menú",
  intro = "Te sugerimos platos caseros y económicos, con las cantidades para cumplir tu meta de calorías y tus macros.",
  submitLabel = "Armar mi menú",
  initial,
  logged,
  onSubmit,
  onCancel,
}: {
  title?: string;
  intro?: string;
  submitLabel?: string;
  initial: MenuSettings;
  /** Registros del día (para ofrecer descontarlos); vacío = no se pregunta */
  logged: FoodEntry[];
  onSubmit: (s: MenuSettings) => void;
  onCancel?: () => void;
}) {
  const [slots, setSlots] = useState<SlotId[]>(initial.slots);
  const [snacks, setSnacks] = useState(initial.snacks);
  const [avoid, setAvoid] = useState(initial.avoid);
  const [discount, setDiscount] = useState(initial.discount);
  const hasSnackSlot = slots.includes("media-manana") || slots.includes("lonche");
  const eatenKcal = logged.reduce((a, f) => a + f.calories, 0);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-1 text-sm text-ink-2">{intro}</p>
      </div>

      <Question title="¿Qué comidas haces en el día?" hint={`${slots.length} ${slots.length === 1 ? "comida" : "comidas"}`}>
        {SLOTS.map((s) => (
          <Chip key={s.id} active={slots.includes(s.id)} onClick={() => setSlots(toggle(slots, s.id))}>
            {s.label}
          </Chip>
        ))}
      </Question>

      {hasSnackSlot ? (
        <Question title="¿Qué snacks te gustan?" hint="Si no eliges ninguno, te sugerimos de todo.">
          {SNACK_KINDS.map((k) => (
            <Chip key={k.id} active={snacks.includes(k.id)} onClick={() => setSnacks(toggle(snacks, k.id))}>
              {k.label}
            </Chip>
          ))}
        </Question>
      ) : null}

      <Question title="¿Hay algo que no comes?">
        {AVOID.map((a) => (
          <Chip key={a.id} active={avoid.includes(a.id)} onClick={() => setAvoid(toggle(avoid, a.id))}>
            {a.label}
          </Chip>
        ))}
      </Question>

      {logged.length > 0 ? (
        <label className="flex items-start gap-3 rounded-2xl bg-field p-3 text-sm">
          <input
            type="checkbox"
            checked={discount}
            onChange={(e) => setDiscount(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-accent"
          />
          <span>
            <span className="block font-medium">Descontar lo que ya registraste ({fmt(eatenKcal)} kcal)</span>
            <span className="text-xs text-muted">Solo se arman las comidas que te faltan.</span>
          </span>
        </label>
      ) : null}

      <div className="flex gap-2">
        {onCancel ? (
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button
          className="flex-1"
          disabled={slots.length === 0}
          onClick={() =>
            onSubmit({
              // en el orden del día
              slots: SLOTS.map((s) => s.id).filter((id) => slots.includes(id)),
              snacks,
              avoid,
              discount,
            })
          }
        >
          {submitLabel}
        </Button>
      </div>
    </Card>
  );
}

function Question({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 flex w-full items-baseline justify-between gap-2 text-sm font-semibold">
        {title}
        {hint ? <span className="text-xs font-normal text-muted">{hint}</span> : null}
      </legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "inline-flex min-h-10 items-center gap-1 rounded-full px-3.5 text-sm font-medium ring-1 transition",
        active ? "bg-accent-soft text-accent-text ring-accent" : "bg-card text-ink-2 ring-border hover:text-ink",
      )}
    >
      {active ? <Check className="-ml-1 size-4" aria-hidden /> : null}
      {children}
    </button>
  );
}

// ---------- Menú armado ----------

function summary(s: MenuSettings): string {
  const parts = [`${s.slots.length} ${s.slots.length === 1 ? "comida" : "comidas"}`];
  if (s.snacks.length > 0 && s.slots.some((id) => slotInfo(id).kind === "snack")) {
    parts.push(`snacks: ${s.snacks.map((id) => SNACK_KINDS.find((k) => k.id === id)?.label.toLowerCase()).join(", ")}`);
  }
  if (s.avoid.length > 0) {
    parts.push(`sin ${s.avoid.map((id) => AVOID.find((a) => a.id === id)?.label.toLowerCase()).join(", ")}`);
  }
  return parts.join(" · ");
}

/** La meta cambió lo suficiente desde que se armó el menú (perfil o actividad del día). */
function goalChanged(a: Vec, b: Vec) {
  return Math.abs(a[0] - b[0]) > b[0] * 0.02 || Math.abs(a[1] - b[1]) > Math.max(3, b[1] * 0.03);
}

function PlanView({
  plan,
  goal,
  logged,
  onEdit,
  onRegenerate,
  onRefit,
  onAnother,
  onAdd,
}: {
  plan: MenuPlan;
  goal: Vec;
  logged: FoodEntry[];
  onEdit: () => void;
  onRegenerate: () => void;
  onRefit: () => void;
  onAnother: (slot: SlotId) => void;
  onAdd: (meal: PlannedMeal) => void;
}) {
  const total = planTotal(plan);
  const remaining = plan.goal[0] - (plan.eaten?.[0] ?? 0);
  const proteinShort = plan.meals.length > 0 && total[1] < plan.goal[1] * 0.9;

  return (
    <>
      <Card className="space-y-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-semibold">Tu día con este menú</h2>
          <span className="text-xs text-muted">meta: {fmt(plan.goal[0])} kcal</span>
        </div>
        <Meter label="Calorías" value={total[0]} max={plan.goal[0]} color="var(--kcal)" unit="kcal" />
        <Meter label="Proteína" value={total[1]} max={plan.goal[1]} color="var(--protein)" />
        <Meter label="Carbohidratos" value={total[2]} max={plan.goal[2]} color="var(--carbs)" />
        <Meter label="Grasas" value={total[3]} max={plan.goal[3]} color="var(--fat)" />
        {plan.eaten ? (
          <p className="text-xs text-muted">Incluye lo que ya registraste: {fmt(plan.eaten[0])} kcal.</p>
        ) : null}
        {proteinShort ? (
          <p className="flex gap-2 rounded-2xl bg-field p-3 text-xs text-ink-2">
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            Con lo que elegiste cuesta llegar a tu proteína. Prueba otra opción, suma huevo, atún o
            menestras, o ajusta tus macros en Perfil.
          </p>
        ) : null}
        <p className="text-xs text-muted">{summary(plan.settings)}</p>
        {/* Si no entran en una fila (celulares angostos), los botones bajan enteros. */}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="flex-1 whitespace-nowrap px-3" onClick={onEdit}>
            Cambiar respuestas
          </Button>
          <Button variant="secondary" className="flex-1 whitespace-nowrap px-3" onClick={onRegenerate}>
            <Shuffle className="size-4" /> Otro menú
          </Button>
        </div>
      </Card>

      {goalChanged(goal, plan.goal) ? (
        <div className="flex items-center gap-3 rounded-3xl bg-accent-soft p-4 text-sm ring-1 ring-border">
          <span className="flex-1">
            Tu meta de hoy cambió a {fmt(goal[0])} kcal desde que armaste el menú.
          </span>
          <Button variant="secondary" onClick={onRefit} className="shrink-0">
            Ajustar cantidades
          </Button>
        </div>
      ) : null}

      {plan.meals.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-2">
            {remaining < MIN_KCAL_TO_PLAN
              ? "Con lo que ya registraste llegaste a tu meta de hoy."
              : plan.missing.length > 0
                ? "No encontramos platos con lo que no comes. Cambia tus respuestas."
                : "Ya registraste todas tus comidas de hoy."}
          </p>
        </Card>
      ) : null}

      {SLOTS.map(({ id, label, meal: mealType }) => {
        if (plan.skipped.includes(id)) {
          const kcal = mealType === "snack" ? null : logged.filter((f) => f.meal === mealType).reduce((a, f) => a + f.calories, 0);
          return (
            <p key={id} className="flex items-center gap-2 rounded-3xl bg-card px-4 py-3 text-sm ring-1 ring-border">
              <Check className="size-4 text-accent-text" aria-hidden />
              <span className="flex-1 font-medium">{label}</span>
              <span className="text-ink-2">ya registrado{kcal ? ` · ${fmt(kcal)} kcal` : ""}</span>
            </p>
          );
        }
        const meal = plan.meals.find((m) => m.slot === id);
        return meal ? (
          <MealPlanCard key={id} meal={meal} onAnother={() => onAnother(id)} onAdd={() => onAdd(meal)} />
        ) : null;
      })}

      {plan.missing.length > 0 && plan.meals.length > 0 ? (
        <p className="flex gap-2 rounded-2xl bg-field p-3 text-sm text-ink-2">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          No encontramos platos para {plan.missing.map((id) => slotInfo(id).label.toLowerCase()).join(" y ")} con lo
          que no comes.
        </p>
      ) : null}
    </>
  );
}

function MealPlanCard({
  meal,
  onAnother,
  onAdd,
}: {
  meal: PlannedMeal;
  onAnother: () => void;
  onAdd: () => void;
}) {
  const { label } = slotInfo(meal.slot);
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-text">{label}</p>
          <h3 className="mt-0.5 font-semibold leading-snug">{meal.name}</h3>
        </div>
        <span className="shrink-0 text-sm text-ink-2">
          <span className="font-semibold text-ink">{fmt(meal.total[0])}</span> kcal
        </span>
      </div>
      <ul className="mt-2 divide-y divide-border text-sm">
        {meal.items.map((it, i) => (
          <li key={i} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{it.name}</span>
              <span className="block text-xs text-muted">{it.portion}</span>
            </span>
            <span className="tabular text-ink-2">{fmt(it.calories)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-muted">
        P {fmt(meal.total[1])} g · C {fmt(meal.total[2])} g · G {fmt(meal.total[3])} g
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {meal.added ? (
          <p className="flex min-h-11 flex-1 items-center gap-2 text-sm font-semibold text-accent-text">
            <Check className="size-5" /> Agregado a tu diario
          </p>
        ) : (
          <>
            <Button
              variant="secondary"
              className="flex-1 whitespace-nowrap px-3"
              onClick={onAnother}
              aria-label={`Otra opción de ${label.toLowerCase()}`}
            >
              <RefreshCw className="size-4" /> Otra opción
            </Button>
            <Button className="flex-[1.4] whitespace-nowrap px-3" onClick={onAdd}>
              <Plus className="size-4" /> Agregar al diario
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

// ---------- Opciones por comida ----------

const MACRO_NAME = ["kcal", "proteína", "carbohidratos", "grasa"] as const;
/** Platos que se ven antes de pedir más. */
const SHOWN = 8;

/** "Pollo 120 g · Arroz blanco 1 taza · …" para la fila cerrada. */
function shortItems(o: DishOption) {
  return o.items
    .slice(0, 3)
    .map((it) => `${it.name} ${it.portion.replace(/ \(.*\)$/, "")}`)
    .join(" · ");
}

function OptionsView({
  date,
  goal,
  settings,
  logged,
  meal,
  onMeal,
  mode,
  onMode,
  onEditPrefs,
}: {
  date: string;
  goal: Vec;
  settings: MenuSettings;
  logged: FoodEntry[];
  meal: MealType;
  onMeal: (m: MealType) => void;
  mode: "platos" | "ingredientes";
  onMode: (m: "platos" | "ingredientes") => void;
  onEditPrefs: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const slotId = slotForMeal(meal, settings);
  const kind = slotInfo(slotId).kind;
  const { target, fromRemaining } = useMemo(
    () => mealTarget(goal, settings, logged, slotId),
    [goal, settings, logged, slotId],
  );
  const dishes = useMemo(() => dishOptions(kind, target, settings), [kind, target, settings]);
  const lists = useMemo(() => ingredientLists(kind, target, settings), [kind, target, settings]);
  const name = meal === "snack" ? "snack" : mealLabel(meal).toLowerCase();
  const loggedHere = logged.filter((f) => f.meal === meal).reduce((a, f) => a + f.calories, 0);

  function add(o: DishOption) {
    addFoods(
      o.items.map((it) => ({
        date,
        meal,
        name: it.name,
        portion: it.portion,
        calories: it.calories,
        protein: it.protein,
        carbs: it.carbs,
        fat: it.fat,
        source: "manual" as const,
      })),
    );
    toast(`${o.name} agregado a ${mealLabel(meal).toLowerCase()}`);
    setOpen(null);
  }

  return (
    <>
      <Segmented
        label="Comida"
        value={meal}
        onChange={(m) => {
          onMeal(m);
          setOpen(null);
          setAll(false);
        }}
        options={MEALS.map((m) => ({ id: m.id, label: m.id === "snack" ? "Snack" : m.label }))}
      />

      <Card className="space-y-2">
        <p className="text-sm text-ink-2">Para tu {name} te tocan</p>
        <p className="text-3xl font-semibold tracking-tight">
          {fmt(target[0])} <span className="text-base font-medium text-ink-2">kcal</span>
        </p>
        <dl className="grid grid-cols-3 gap-2 text-center">
          {(
            [
              ["Proteína", target[1], "var(--protein)"],
              ["Carbos", target[2], "var(--carbs)"],
              ["Grasa", target[3], "var(--fat)"],
            ] as const
          ).map(([label, grams, color]) => (
            <div key={label} className="rounded-2xl bg-field px-1 py-2">
              <dt className="flex items-center justify-center gap-1.5 text-xs text-ink-2">
                <Swatch color={color} />
                {label}
              </dt>
              <dd className="tabular font-semibold">{fmt(grams)} g</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted">
          {fromRemaining
            ? "Según lo que te queda hoy."
            : loggedHere > 0
              ? `Tu parte de la meta del día. Ya registraste ${fmt(loggedHere)} kcal en tu ${name}.`
              : "Tu parte de la meta del día."}
        </p>
        <div className="flex items-center gap-2 border-t border-border pt-2 text-xs text-muted">
          <span className="min-w-0 flex-1">{summary(settings)}</span>
          <button
            type="button"
            onClick={onEditPrefs}
            className="flex shrink-0 items-center gap-1 rounded-xl px-2 py-1 font-semibold text-accent-text hover:bg-accent-soft"
          >
            <Settings2 className="size-4" /> Preferencias
          </button>
        </div>
      </Card>

      <Segmented
        label="Ver por"
        value={mode}
        onChange={onMode}
        options={[
          { id: "platos", label: "Platos" },
          { id: "ingredientes", label: "Por ingrediente" },
        ]}
      />

      {mode === "platos" ? (
        dishes.length > 0 ? (
          <Card className="py-1">
            <ul className="divide-y divide-border">
              {(all ? dishes : dishes.slice(0, SHOWN)).map((o, i) => (
                <DishRow
                  key={o.dishId}
                  option={o}
                  recommended={i < 3}
                  open={open === o.dishId}
                  onToggle={() => setOpen(open === o.dishId ? null : o.dishId)}
                  onAdd={() => add(o)}
                  addLabel={`Agregar a ${mealLabel(meal).toLowerCase()}`}
                />
              ))}
            </ul>
            {!all && dishes.length > SHOWN ? (
              <button
                type="button"
                onClick={() => setAll(true)}
                className="w-full border-t border-border py-3 text-sm font-semibold text-accent-text"
              >
                Ver {dishes.length - SHOWN} platos más
              </button>
            ) : null}
          </Card>
        ) : (
          <Card>
            <p className="text-sm text-ink-2">No hay platos con lo que no comes. Cambia tus preferencias.</p>
          </Card>
        )
      ) : (
        <>
          <p className="px-1 text-sm text-ink-2">
            {kind === "snack"
              ? "Elige uno: cada cantidad es lo que te toca en tu snack."
              : "Arma tu plato con una opción de cada grupo. Las cantidades son para lo que te toca en esta comida."}
          </p>
          {lists.map((l) => (
            <Card key={l.id}>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{l.label}</h3>
                <span className="text-xs text-muted">{l.hint}</span>
              </div>
              <p className="text-xs text-muted">
                {l.macro === 0
                  ? `Cada opción ≈ ${fmt(l.goal)} kcal`
                  : `Cada opción aporta ≈ ${fmt(l.goal)} g de ${MACRO_NAME[l.macro]}`}
              </p>
              <ul className="mt-1 divide-y divide-border text-sm">
                {l.options.map((o) => (
                  <li key={o.name} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{o.name}</span>
                      <span className="block text-xs text-muted">
                        {o.portion}
                        {l.macro === 0 ? "" : ` · ${fmt(o.macro)} g de ${MACRO_NAME[l.macro]}`}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-ink-2">{fmt(o.calories)} kcal</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
          {kind !== "snack" ? (
            <Card>
              <h3 className="font-semibold">Verduras</h3>
              <p className="mt-1 text-sm text-ink-2">
                Libres: ensalada, verduras cocidas o sarsa, una taza o más. Casi no suman calorías.
              </p>
              <p className="mt-2 text-xs text-muted">
                Si eliges carne, huevo o queso, usa menos aceite: ya traen grasa.
              </p>
            </Card>
          ) : null}
        </>
      )}
    </>
  );
}

function DishRow({
  option,
  recommended,
  open,
  onToggle,
  onAdd,
  addLabel,
}: {
  option: DishOption;
  recommended: boolean;
  open: boolean;
  onToggle: () => void;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <li>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-3 py-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold leading-snug">{option.name}</span>
          {recommended ? (
            <span className="mt-1 inline-block rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-text">
              Recomendado
            </span>
          ) : null}
          {!open ? <span className="mt-0.5 block truncate text-xs text-muted">{shortItems(option)}</span> : null}
        </span>
        <span className="shrink-0 pt-0.5 text-sm text-ink-2">
          <span className="font-semibold text-ink">{fmt(option.total[0])}</span> kcal
        </span>
        <ChevronDown className={cx("mt-0.5 size-5 shrink-0 text-muted transition", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div className="pb-3">
          <ul className="divide-y divide-border rounded-2xl bg-field px-3 text-sm">
            {option.items.map((it, i) => (
              <li key={i} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{it.name}</span>
                  <span className="block text-xs text-muted">{it.portion}</span>
                </span>
                <span className="tabular text-ink-2">{fmt(it.calories)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            P {fmt(option.total[1])} g · C {fmt(option.total[2])} g · G {fmt(option.total[3])} g
          </p>
          <Button className="mt-2 w-full" onClick={onAdd}>
            <Plus className="size-5" /> {addLabel}
          </Button>
        </div>
      ) : null}
    </li>
  );
}
