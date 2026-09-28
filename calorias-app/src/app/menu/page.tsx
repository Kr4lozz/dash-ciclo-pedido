"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Check, Plus, RefreshCw, Shuffle, Target, TriangleAlert } from "lucide-react";
import { Meter } from "@/components/Meters";
import { Button, Card, PageHeader, cx } from "@/components/ui";
import { dateLabel, todayStr } from "@/lib/dates";
import { fmt } from "@/lib/format";
import {
  MIN_KCAL_TO_PLAN,
  SLOTS,
  anotherOption,
  buildPlan,
  dayGoal,
  newSeed,
  planTotal,
  refitPlan,
  slotInfo,
  type MenuPlan,
  type MenuSettings,
  type PlannedMeal,
  type SlotId,
  type Vec,
} from "@/lib/menu";
import { AVOID, SNACK_KINDS } from "@/lib/menu-data";
import { loadMenu, saveMenu, type MenuState } from "@/lib/menu-storage";
import { computeTargets, dayActivity } from "@/lib/nutrition";
import { addFoods, setSelectedDate, useAppData, useSelectedDate } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { FoodEntry } from "@/lib/types";

export default function MenuPage() {
  const data = useAppData();
  const date = useSelectedDate();
  const [state, setState] = useState<MenuState>(loadMenu);
  const [editing, setEditing] = useState(false);

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

  function generate(settings: MenuSettings) {
    save({ settings, plan: buildPlan({ date, goal, settings, logged, seed: newSeed() }) });
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
      <PageHeader title="Menú del día" back={null} />
      <main className="space-y-4 px-4">
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

        {editing || !plan ? (
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
  initial,
  logged,
  onSubmit,
  onCancel,
}: {
  initial: MenuSettings;
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
        <h2 className="text-lg font-bold">Arma tu menú</h2>
        <p className="mt-1 text-sm text-ink-2">
          Te sugerimos platos caseros y económicos, con las cantidades para cumplir tu meta de
          calorías y tus macros.
        </p>
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
          Armar mi menú
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
